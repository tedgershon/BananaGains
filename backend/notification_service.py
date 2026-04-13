from supabase import Client


def _db_for_notifications(supabase: Client) -> Client:
    """Prefer service-role client so inserts/queries are not blocked by RLS."""
    from dependencies import get_supabase_service_client

    svc = get_supabase_service_client()
    return svc if svc is not None else supabase


def _creator_email(supabase: Client, creator_id: str) -> str | None:
    """Look up a creator's andrew_id and build their CMU email address.

    Returns None if the profile row is missing or the andrew_id is blank,
    so callers can skip sending email without tripping on a KeyError.
    """
    try:
        res = (
            supabase.table("profiles")
            .select("andrew_id")
            .eq("id", creator_id)
            .maybe_single()
            .execute()
        )
    except Exception:
        return None

    data = getattr(res, "data", None) or {}
    andrew_id = data.get("andrew_id") if isinstance(data, dict) else None
    if not andrew_id:
        return None
    return f"{andrew_id}@andrew.cmu.edu"


async def create_notification(
    supabase: Client,
    user_id: str,
    notification_type: str,
    title: str,
    body: str,
    metadata: dict | None = None,
):
    """Create an in-app notification."""
    db = _db_for_notifications(supabase)
    db.table("notifications").insert({
        "user_id": user_id,
        "type": notification_type,
        "title": title,
        "body": body,
        "metadata": metadata or {},
    }).execute()


async def notify_market_approved(
    supabase: Client,
    market: dict,
    review_notes: str | None,
):
    """Send in-app notification when a market is approved."""
    creator_id = market["creator_id"]

    email = _creator_email(supabase, creator_id)

    body_parts = [
        f"Your market \"{market['title']}\" has been approved and is now live!",
        "",
        f"Title: {market['title']}",
        f"Description: {market['description']}",
        f"Close Date: {market['close_at']}",
        f"Category: {market['category']}",
    ]
    if review_notes:
        body_parts.append(f"\nAdmin Notes: {review_notes}")

    body = "\n".join(body_parts)

    await create_notification(
        supabase=supabase,
        user_id=creator_id,
        notification_type="market_approved",
        title="Market Approved",
        body=body,
        metadata={"market_id": market["id"]},
    )


async def notify_market_denied(
    supabase: Client,
    market: dict,
    review_notes: str,
):
    """Send in-app notification when a market is denied."""
    creator_id = market["creator_id"]

    email = _creator_email(supabase, creator_id)

    body = (
        f"Your market \"{market['title']}\" was not approved.\n\n"
        f"Admin Feedback: {review_notes}\n\n"
        "Please review the feedback and consider resubmitting with the suggested changes."
    )

    await create_notification(
        supabase=supabase,
        user_id=creator_id,
        notification_type="market_denied",
        title="Market Not Approved",
        body=body,
        metadata={"market_id": market["id"]},
    )


async def notify_market_closed(
    supabase: Client,
    market: dict,
):
    """Send in-app notification when a market closes, prompting the creator to resolve."""
    creator_id = market["creator_id"]

    existing = (
        supabase.table("notifications")
        .select("id, metadata")
        .eq("user_id", creator_id)
        .eq("type", "market_closed")
        .execute()
    )
    already_sent = any(
        n.get("metadata", {}).get("market_id") == market["id"]
        for n in (existing.data or [])
    )
    if already_sent:
        return

    email = _creator_email(supabase, creator_id)

    body = (
        f"Your market \"{market['title']}\" has just closed and is no longer accepting bets.\n\n"
        "A 24-hour resolution period has begun. During this time, community members "
        "can vote on the outcome. As the market creator, you can also propose a "
        "resolution.\n\n"
        "Please visit the market page to review the results and propose your resolution."
    )

    await create_notification(
        supabase=supabase,
        user_id=creator_id,
        notification_type="market_closed",
        title="Your Market Has Closed - Time to Resolve",
        body=body,
        metadata={"market_id": market["id"]},
    )


async def notify_resolution_reminder(
    supabase: Client,
    market: dict,
):
    """Send a periodic in-app reminder to the market creator to resolve their closed market."""
    creator_id = market["creator_id"]

    body = (
        f"Reminder: Your market \"{market['title']}\" is still awaiting resolution.\n\n"
        "Users are waiting for the outcome to be decided. Please visit the market page "
        "and propose a resolution as soon as possible.\n\n"
        "If you don't resolve the market, it may be escalated to community voting or admin review."
    )

    await create_notification(
        supabase=supabase,
        user_id=creator_id,
        notification_type="resolution_reminder",
        title="Reminder: Resolve Your Market",
        body=body,
        metadata={"market_id": market["id"]},
    )


async def send_resolution_reminders_for_closed_markets(supabase: Client) -> int:
    """
    Check for closed markets that haven't been resolved and send reminders.
    Called periodically (e.g., by a cron job or background task).
    Only sends one reminder per market per 24 hours.
    """
    from datetime import datetime, timedelta, timezone

    now = datetime.now(tz=timezone.utc)
    reminder_interval = timedelta(hours=24)

    closed_markets = (
        supabase.table("markets")
        .select("id, title, description, creator_id, close_at, status")
        .eq("status", "closed")
        .execute()
    )

    if not closed_markets.data:
        return 0

    reminders_sent = 0

    for market in closed_markets.data:
        existing_reminders = (
            supabase.table("notifications")
            .select("created_at, metadata")
            .eq("user_id", market["creator_id"])
            .eq("type", "resolution_reminder")
            .execute()
        )

        recent_reminder = any(
            n.get("metadata", {}).get("market_id") == market["id"]
            and (now - datetime.fromisoformat(n["created_at"].replace("Z", "+00:00"))) < reminder_interval
            for n in (existing_reminders.data or [])
        )

        if not recent_reminder:
            await notify_resolution_reminder(supabase, market)
            reminders_sent += 1

    return reminders_sent
