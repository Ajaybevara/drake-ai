from app.services import support_mail


def test_inline_logo_is_related_content_not_a_download(monkeypatch):
    captured = {}

    class FakeSMTP:
        def __init__(self, *_args, **_kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def ehlo(self):
            return None

        def starttls(self):
            return None

        def login(self, *_args):
            return None

        def send_message(self, message, **_kwargs):
            captured["message"] = message
            return {}

    monkeypatch.setattr(support_mail.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(support_mail.settings, "SMTP_USERNAME", "sender@example.com")
    monkeypatch.setattr(support_mail.settings, "SMTP_PASSWORD", "configured")
    monkeypatch.setattr(support_mail.settings, "SUPPORT_RECIPIENTS", ["admin@example.com"])

    support_mail.send_support_mail(
        subject="Feedback",
        heading="Feedback",
        fields=[("Name", "User")],
        html_body="<img src='cid:drake-logo@thedrake.ai'>",
        inline_images=[
            ("drake-ai-logo.png", "image/png", b"png-data", "drake-logo@thedrake.ai"),
        ],
    )

    inline_part = next(
        part
        for part in captured["message"].walk()
        if part.get("Content-ID") == "<drake-logo@thedrake.ai>"
    )
    assert inline_part.get_content_disposition() == "inline"
    assert inline_part.get_filename() is None
