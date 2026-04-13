import logging

import httpx
from supabase import Client

from config import get_settings

logger = logging.getLogger(__name__)


def _db_for_notifications(supabase: Client) -> Client:
    """Prefer service-role client so inserts/queries are not blocked by RLS."""
    from dependencies import get_supabase_service_client

    svc = get_supabase_service_client()
    return svc if svc is not None else supabase


async def create_notification(
    supabase: Client,
    user_id: str,
    notification_type: str,
    title: str,
    body: str,
    metadata: dict | None = None,
    send_email: bool = False,
    recipient_email: str | None = None,
):
    """Create an in-app notification and optionally send an email."""
    db = _db_for_notifications(supabase)
    db.table("notifications").insert({
        "user_id": user_id,
        "type": notification_type,
        "title": title,
        "body": body,
        "metadata": metadata or {},
    }).execute()

    settings = get_settings()
    if send_email and recipient_email and settings.resend_api_key:
        await _send_email(
            to=recipient_email,
            subject=title,
            body=body,
            api_key=settings.resend_api_key,
            from_email=settings.notification_from_email,
        )


async def _send_email(
    to: str,
    subject: str,
    body: str,
    api_key: str,
    from_email: str,
):
    """Send an email notification via Resend API."""
    async with httpx.AsyncClient() as client:
        await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": from_email,
                "to": [to],
                "subject": f"BananaGains: {subject}",
                "html": f"""
                    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                        <h2 style="color: #333;">BananaGains</h2>
                        <p>{body}</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="color: #888; font-size: 12px;">
                            This is an automated notification from BananaGains, CMU's prediction market.
                        </p>
                    </div>
                """,
            },
        )


async def notify_market_approved(
    supabase: Client,
    market: dict,
    review_notes: str | None,
):
    """Send notification when a market is approved."""
    creator_id = market["creator_id"]

    creator = supabase.table("profiles").select("andrew_id").eq("id", creator_id).single().execute()
    email = f"{creator.data['andrew_id']}@andrew.cmu.edu" if creator.data else None

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
        send_email=True,
        recipient_email=email,
    )


async def notify_market_denied(
    supabase: Client,
    market: dict,
    review_notes: str,
):
    """Send notification when a market is denied."""
    creator_id = market["creator_id"]

    creator = supabase.table("profiles").select("andrew_id").eq("id", creator_id).single().execute()
    email = f"{creator.data['andrew_id']}@andrew.cmu.edu" if creator.data else None

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
        send_email=True,
        recipient_email=email,
    )


async def notify_market_closed(
    supabase: Client,
    market: dict,
):
    """Send notification when a market closes, prompting the creator to resolve."""
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

    creator = supabase.table("profiles").select("andrew_id").eq("id", creator_id).single().execute()
    email = f"{creator.data['andrew_id']}@andrew.cmu.edu" if creator.data else None

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
        title="Your Market Has Closed \u2014 Time to Resolve",
        body=body,
        metadata={"market_id": market["id"]},
        send_email=True,
        recipient_email=email,
    )


async def send_market_submitted_admin_emails(
    supabase: Client,
    market: dict,
    creator: dict,
):
    """Email admins after a market submit. In-app rows are created by RPC notify_admins_market_submitted."""
    settings = get_settings()
    if not settings.resend_api_key:
        return

    admins = (
        supabase.table("profiles")
        .select("id, andrew_id")
        .in_("role", ["admin", "super_admin"])
        .execute()
    )

    if not admins.data:
        logger.warning(
            "send_market_submitted_admin_emails: no admin/super_admin profiles found"
        )
        return

    body = (
        f"A new market has been submitted for review by {creator.get('display_name', creator.get('andrew_id', 'Unknown'))}.\n\n"
        f"Title: {market['title']}\n"
        f"Description: {market['description']}\n"
        f"Category: {market['category']}\n"
        f"Close Date: {market['close_at']}\n\n"
        "Please review the market in the Admin panel."
    )

    for admin in admins.data:
        email = f"{admin['andrew_id']}@andrew.cmu.edu" if admin.get("andrew_id") else None
        if not email:
            continue
        await _send_email(
            to=email,
            subject="New Market Awaiting Review",
            body=body,
            api_key=settings.resend_api_key,
            from_email=settings.notification_from_email,
        )


async def notify_resolution_reminder(
    supabase: Client,
    market: dict,
):
    """Send a periodic reminder to the market creator to resolve their closed market."""
    creator_id = market["creator_id"]

    creator = supabase.table("profiles").select("andrew_id").eq("id", creator_id).single().execute()
    email = f"{creator.data['andrew_id']}@andrew.cmu.edu" if creator.data else None

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
        send_email=True,
        recipient_email=email,
    )


async def send_resolution_reminders_for_closed_markets(supabase: Client):
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
        return

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
