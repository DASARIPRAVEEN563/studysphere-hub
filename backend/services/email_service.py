"""Sends the face-verification confirmation mail to the student's email ID.

Uses SMTP when SMTP_HOST/SMTP_USER/SMTP_PASSWORD are configured in .env,
otherwise the message is logged so the flow keeps working in development.
"""
import os
import smtplib
from email.message import EmailMessage

SUBJECT = "Face verification successful - STUDENTS KA NOTES SHARING HUB"


def send_face_verified_email(to_email: str, full_name: str) -> bool:
    body = (
        f"Hello {full_name},\n\n"
        "Face verified is successfully completed.\n"
        "You can now download and share notes on STUDENTS KA NOTES SHARING HUB.\n\n"
        "- Notes Hub Team"
    )

    host = os.environ.get("SMTP_HOST")
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASSWORD")
    if not (host and user and password and to_email):
        print(f"[email] (not configured) would send to {to_email}: {SUBJECT}")
        return False

    message = EmailMessage()
    message["Subject"] = SUBJECT
    message["From"] = os.environ.get("SMTP_FROM", user)
    message["To"] = to_email
    message.set_content(body)

    try:
        port = int(os.environ.get("SMTP_PORT", "587"))
        with smtplib.SMTP(host, port, timeout=15) as smtp:
            smtp.starttls()
            smtp.login(user, password)
            smtp.send_message(message)
        return True
    except Exception as err:  # pragma: no cover - never break verification on mail failure
        print(f"[email] send failed: {err}")
        return False
