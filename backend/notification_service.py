import httpx
from supabase import Client

from config import get_settings


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
    send_email: bool = False,
    recipient_email: str | None = None,
):
    """Create an in-app notification and optionally send an email."""
    supabase.table("notifications").insert({
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
        .select("id")
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
        title="Your Market Has Closed \u2014 Time to Resolve",
        body=body,
        metadata={"market_id": market["id"]},
        send_email=True,
        recipient_email=email,
    )
