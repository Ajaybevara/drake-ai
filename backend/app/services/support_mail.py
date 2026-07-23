import html
import io
import os
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import format_datetime, make_msgid
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from app.core.config import settings


def send_support_mail(
    *,
    subject: str,
    heading: str,
    fields: list[tuple[str, str]],
    html_body: str | None = None,
    attachments: list[tuple[str, str, bytes]] | None = None,
    inline_images: list[tuple[str, str, bytes, str]] | None = None,
) -> None:
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        raise RuntimeError("Support email is not configured")

    recipients = [address.strip() for address in settings.SUPPORT_RECIPIENTS if address.strip()]
    if not recipients:
        raise RuntimeError("Support email recipients are not configured")

    plain_lines = [heading, "", *[f"{label}: {value}" for label, value in fields]]
    rows = "".join(
        f"<tr><th style='text-align:left;padding:8px;border:1px solid #dbe3ee'>"
        f"{html.escape(label)}</th><td style='padding:8px;border:1px solid #dbe3ee'>"
        f"{html.escape(value)}</td></tr>"
        for label, value in fields
    )

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.SMTP_USERNAME
    message["To"] = ", ".join(recipients)
    message["Date"] = format_datetime(datetime.now(timezone.utc))
    message["Message-ID"] = make_msgid(domain=settings.SMTP_USERNAME.partition("@")[2] or None)
    message.set_content("\n".join(plain_lines))
    message.add_alternative(
        html_body or (
            "<div style='font-family:Arial,sans-serif;color:#0f172a'>"
            f"<h2>{html.escape(heading)}</h2>"
            f"<table style='border-collapse:collapse;width:100%;max-width:760px'>{rows}</table>"
            "</div>"
        ),
        subtype="html",
    )
    html_part = message.get_payload()[-1]
    for _filename, content_type, content, content_id in inline_images or []:
        maintype, subtype = content_type.split("/", 1)
        html_part.add_related(
            content,
            maintype=maintype,
            subtype=subtype,
            cid=f"<{content_id}>",
            disposition="inline",
        )
    for filename, content_type, content in attachments or []:
        maintype, subtype = content_type.split("/", 1)
        message.add_attachment(
            content,
            maintype=maintype,
            subtype=subtype,
            filename=filename,
        )

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as smtp:
        smtp.ehlo()
        if settings.SMTP_USE_TLS:
            smtp.starttls()
            smtp.ehlo()
        smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        refused_recipients = smtp.send_message(
            message,
            from_addr=settings.SMTP_USERNAME,
            to_addrs=recipients,
        )
        if refused_recipients:
            refused = ", ".join(sorted(refused_recipients))
            raise RuntimeError(f"SMTP refused support recipients: {refused}")


def build_feedback_flyer(
    *,
    user_fields: list[tuple[str, str]],
    page_path: str,
    modules: list[tuple[str, int, str]],
    submitted_at: str,
) -> str:
    user_rows = "".join(
        "<td style='padding:0 18px 14px 0;vertical-align:top'>"
        f"<div style='color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px'>{html.escape(label)}</div>"
        f"<div style='color:#f8fafc;font-size:14px;font-weight:700;margin-top:4px'>{html.escape(value)}</div>"
        "</td>"
        for label, value in user_fields
    )
    cards = "".join(
        "<div style='background:#0e1622;border:1px solid #26364f;border-radius:14px;padding:20px;margin:0 0 14px'>"
        "<table role='presentation' width='100%' cellspacing='0' cellpadding='0'><tr>"
        f"<td style='color:#f8fafc;font-size:18px;font-weight:800'>{html.escape(label)}</td>"
        f"<td align='right' style='color:#10b981;font-size:17px;font-weight:800'>{rating} / 5&nbsp; "
        f"<span style='letter-spacing:2px'>{'★' * rating}{'☆' * (5 - rating)}</span></td>"
        "</tr></table>"
        "<div style='color:#94a3b8;font-size:12px;font-weight:700;margin-top:16px'>Feedback</div>"
        f"<div style='background:#0b111a;border:1px solid #26364f;border-radius:9px;color:#dbeafe;font-size:14px;line-height:1.55;margin-top:7px;padding:13px'>"
        f"{html.escape(message.strip() or 'No written feedback')}</div></div>"
        for label, rating, message in modules
    )
    return (
        "<div style='margin:0;background:#070b12;padding:28px 12px;font-family:Arial,sans-serif'>"
        "<div style='max-width:820px;margin:0 auto'>"
        "<div style='background:#0b111a;border:1px solid #26364f;border-radius:16px;padding:24px;margin-bottom:18px'>"
        "<img src='cid:drake-logo@thedrake.ai' alt='Drake AI' width='190' style='display:block;width:190px;height:auto;margin:0 0 16px'>"
        "<h1 style='color:#f8fafc;font-size:30px;margin:8px 0'>Feedback Submission</h1>"
        "<p style='color:#94a3b8;line-height:1.5;margin:0 0 20px'>A user submitted ratings and suggestions for Drake AI modules.</p>"
        f"<table role='presentation' width='100%' cellspacing='0' cellpadding='0'><tr>{user_rows}</tr></table>"
        f"<div style='color:#64748b;font-size:12px;border-top:1px solid #26364f;padding-top:13px'>Page: {html.escape(page_path)} &nbsp;•&nbsp; Submitted: {html.escape(submitted_at)}</div>"
        "</div>"
        f"{cards}"
        "<div style='color:#64748b;font-size:11px;text-align:center;padding:8px'>Drake AI Enterprise Platform</div>"
        "</div></div>"
    )


def drake_logo_bytes() -> bytes:
    logo_path = Path(__file__).resolve().parents[3] / "frontend" / "public" / "logo.png"
    return logo_path.read_bytes()


def build_feedback_flyer_png(
    *,
    user_fields: list[tuple[str, str]],
    page_path: str,
    modules: list[tuple[str, int, str]],
    submitted_at: str,
) -> bytes:
    width = 1400
    margin = 74
    content_width = width - (margin * 2)

    def font(size: int, bold: bool = False):
        windows_fonts = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
        candidates = [
            windows_fonts / ("arialbd.ttf" if bold else "arial.ttf"),
            Path("/usr/share/fonts/truetype/dejavu") / (
                "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
            ),
        ]
        for candidate in candidates:
            if candidate.is_file():
                return ImageFont.truetype(str(candidate), size)
        return ImageFont.load_default(size=size)

    def wrap(draw: ImageDraw.ImageDraw, value: str, selected_font, max_width: int) -> list[str]:
        words = value.split() or [""]
        lines: list[str] = []
        current = words[0]
        for word in words[1:]:
            candidate = f"{current} {word}"
            if draw.textbbox((0, 0), candidate, font=selected_font)[2] <= max_width:
                current = candidate
            else:
                lines.append(current)
                current = word
        lines.append(current)
        return lines

    probe = Image.new("RGB", (width, 100), "#070b12")
    probe_draw = ImageDraw.Draw(probe)
    body_font = font(24)
    card_heights: list[int] = []
    for _, _, message in modules:
        lines = wrap(probe_draw, message.strip() or "No written feedback", body_font, content_width - 80)
        card_heights.append(168 + max(58, len(lines) * 35))
    height = 500 + sum(card_heights) + (len(card_heights) * 22) + 90

    image = Image.new("RGB", (width, height), "#070b12")
    draw = ImageDraw.Draw(image)
    panel = "#0b111a"
    card = "#0e1622"
    border = "#26364f"
    white = "#f8fafc"
    muted = "#94a3b8"
    green = "#10b981"

    draw.rounded_rectangle((margin, 45, width - margin, 430), radius=24, fill=panel, outline=border, width=2)
    logo = Image.open(io.BytesIO(drake_logo_bytes())).convert("RGBA")
    logo.thumbnail((220, 100))
    image.paste(logo, (margin + 30, 75), logo)
    draw.text((margin + 30, 190), "Feedback Submission", font=font(44, True), fill=white)
    draw.text((margin + 30, 252), "A user submitted ratings and suggestions for Drake AI modules.", font=body_font, fill=muted)

    columns = [margin + 30, margin + 320, margin + 650, margin + 1030]
    for index, (label, value) in enumerate(user_fields[:4]):
        x = columns[index]
        draw.text((x, 308), label.upper(), font=font(16, True), fill=muted)
        draw.text((x, 339), value, font=font(21, True), fill=white)
    draw.line((margin + 30, 385, width - margin - 30, 385), fill=border, width=2)
    metadata = f"Page: {page_path}  •  Submitted: {submitted_at}"
    draw.text((margin + 30, 398), metadata, font=font(15), fill="#64748b")

    y = 465
    for (label, rating, message), card_height in zip(modules, card_heights):
        draw.rounded_rectangle((margin, y, width - margin, y + card_height), radius=20, fill=card, outline=border, width=2)
        draw.text((margin + 30, y + 28), label, font=font(28, True), fill=white)
        rating_text = f"{rating} / 5   {'★' * rating}{'☆' * (5 - rating)}"
        rating_width = draw.textbbox((0, 0), rating_text, font=font(23, True))[2]
        draw.text((width - margin - 30 - rating_width, y + 31), rating_text, font=font(23, True), fill=green)
        draw.text((margin + 30, y + 88), "FEEDBACK", font=font(15, True), fill=muted)
        feedback_lines = wrap(draw, message.strip() or "No written feedback", body_font, content_width - 80)
        text_y = y + 124
        for line in feedback_lines:
            draw.text((margin + 30, text_y), line, font=body_font, fill="#dbeafe")
            text_y += 35
        y += card_height + 22

    draw.text((width // 2, height - 48), "Drake AI Enterprise Platform", anchor="mm", font=font(16), fill="#64748b")
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=True)
    return output.getvalue()
