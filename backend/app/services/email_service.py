
import os
import re
from html import escape

import requests
from dotenv import load_dotenv

load_dotenv()

RESEND_API_KEY = os.getenv("RESEND_API_KEY")

SENDER_EMAIL = "Spec-trum Assist Protal <info@rentassistportal.org>"

SUBJECT = "Information About Your Account"

MESSAGE = """Hello,

We are making some changes to improve the way account information is managed on our platform.

As part of these changes, we are asking active account holders to review their details and confirm that their information is up to date by December 20, 2026.

You can complete this review by visiting our official website and signing in through your usual account access page.

If you have already reviewed your information, you do not need to take any further action.

Thank you for your cooperation.

Customer Support Team
Spec-trum Assist Protal"""

BUTTON_TEXT = "Review Your Account Details"
BUTTON_URL = "https://rentassistportal.org"
BUTTON_COLOR = "#2563EB"

FOOTER_COPYRIGHT = "© 2026 Spectrum. All rights reserved."
FOOTER_NOTICE = "This is a system-generated message. Please do not reply."

# Replace these with the actual published policy URLs
# before enabling clickable policy links.
PRIVACY_POLICY_URL = ""
TERMS_OF_SERVICE_URL = ""


def send_email(recipient_email: str):
    if not RESEND_API_KEY:
        raise ValueError("RESEND_API_KEY is missing.")

    recipient_email = recipient_email.strip()

    if not re.fullmatch(
        r"[^@\s,]+@[^@\s,]+\.[^@\s,]+",
        recipient_email
    ):
        raise ValueError("Invalid recipient email address.")

    html_body = escape(MESSAGE).replace("\n", "<br>")

    def footer_item(label, url):
        if url:
            return (
                f'<a href="{escape(url, quote=True)}" '
                'style="color:#64748b;text-decoration:underline;">'
                f'{escape(label)}</a>'
            )
        return escape(label)

    privacy_html = footer_item("Privacy Policy", PRIVACY_POLICY_URL)
    terms_html = footer_item("Terms of Service", TERMS_OF_SERVICE_URL)

    html_message = f"""
    <html>
      <body>
        <div style="
          font-family:Arial,sans-serif;
          font-size:15px;
          line-height:1.7;
          color:#333333;
          max-width:600px;
          margin:auto;
        ">
          {html_body}

          <div style="text-align:center;margin:24px 0;">
            <a
              href="{escape(BUTTON_URL, quote=True)}"
              style="
                display:inline-block;
                background-color:{BUTTON_COLOR};
                color:#ffffff;
                padding:14px 22px;
                text-decoration:none;
                border-radius:6px;
                font-weight:bold;
              "
            >
              {escape(BUTTON_TEXT)}
            </a>
          </div>

          <div style="
            border-top:1px solid #e5e7eb;
            margin-top:28px;
            padding-top:20px;
            text-align:center;
            color:#64748b;
            font-size:12px;
            line-height:1.8;
          ">
            <div>
              {escape(FOOTER_COPYRIGHT)}
            </div>

            <div style="margin-top:6px;">
              {privacy_html} / {terms_html}
            </div>

            <div style="margin-top:12px;color:#94a3b8;">
              {escape(FOOTER_NOTICE)}
            </div>
          </div>
        </div>
      </body>
    </html>
    """

    text_message = (
        MESSAGE
        + "\n\n"
        + BUTTON_TEXT
        + "\n"
        + BUTTON_URL
        + "\n\n"
        + FOOTER_COPYRIGHT
        + "\n"
        + "Privacy Policy / Terms of Service"
        + "\n"
        + FOOTER_NOTICE
    )

    payload = {
        "from": SENDER_EMAIL,
        "to": [recipient_email],
        "subject": SUBJECT,
        "text": text_message,
        "html": html_message
    }

    response = requests.post(
        "https://api.resend.com/emails",
        json=payload,
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json"
        },
        timeout=30
    )

    response.raise_for_status()
    return response.json()
