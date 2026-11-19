
import os
import re
import base64
from html import escape
from html.parser import HTMLParser

import requests
from dotenv import load_dotenv

load_dotenv()

RESEND_API_KEY = os.getenv("RESEND_API_KEY")

# Preserve your current sender identity.
SENDER_EMAIL = "Spectrum Solutions <info@ibkgrafix.com.ng>"

ALLOWED_TAGS = {
    "p", "br", "strong", "b", "em", "i", "u", "s",
    "ul", "ol", "li", "a", "h1", "h2", "h3",
    "blockquote", "pre", "code", "hr"
}

VOID_TAGS = {"br", "hr"}

EMAIL_PATTERN = re.compile(
    r"^[^@\s,]+@[^@\s,]+\.[^@\s,]+$"
)


class EmailHTMLSanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.output = []
        self.blocked_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "iframe", "object", "svg"}:
            self.blocked_depth += 1
            return

        if self.blocked_depth or tag not in ALLOWED_TAGS:
            return

        if tag == "a":
            attributes = dict(attrs)
            href = attributes.get("href", "").strip()

            if not re.match(r"^(https?://|mailto:)", href, re.I):
                self.output.append("<a>")
                return

            safe_href = escape(href, quote=True)
            self.output.append(
                f'<a href="{safe_href}" '
                'target="_blank" rel="noopener noreferrer">'
            )
            return

        self.output.append(f"<{tag}>")

    def handle_endtag(self, tag):
        if tag in {"script", "style", "iframe", "object", "svg"}:
            if self.blocked_depth:
                self.blocked_depth -= 1
            return

        if self.blocked_depth or tag not in ALLOWED_TAGS:
            return

        if tag not in VOID_TAGS:
            self.output.append(f"</{tag}>")

    def handle_data(self, data):
        if not self.blocked_depth:
            self.output.append(escape(data))

    def get_html(self):
        return "".join(self.output)


def sanitize_html(html_content: str) -> str:
    sanitizer = EmailHTMLSanitizer()
    sanitizer.feed(html_content or "")
    sanitizer.close()
    return sanitizer.get_html()


def send_email(
    recipient_email: str,
    subject: str,
    html_body: str,
    text_body: str,
    attachments=None
):
    if not RESEND_API_KEY:
        raise ValueError("RESEND_API_KEY is missing.")

    recipient_email = recipient_email.strip().lower()
    subject = subject.strip()

    if not EMAIL_PATTERN.fullmatch(recipient_email):
        raise ValueError("Invalid recipient email address.")

    if not subject or len(subject) > 200:
        raise ValueError("Email subject must contain 1–200 characters.")

    if not html_body or not html_body.strip():
        raise ValueError("Email message cannot be empty.")

    safe_html = sanitize_html(html_body)

    if not safe_html.strip():
        raise ValueError("Email message contains no valid content.")

    safe_text = (text_body or "").strip()

    if not safe_text:
        safe_text = re.sub(r"<[^>]+>", " ", safe_html)
        safe_text = re.sub(r"\s+", " ", safe_text).strip()

    html_message = f"""
    <!DOCTYPE html>
    <html>
      <body>
        <div style="
          font-family: Arial, sans-serif;
          font-size: 15px;
          line-height: 1.7;
          color: #333333;
          max-width: 600px;
          margin: auto;
        ">
          {safe_html}
        </div>
      </body>
    </html>
    """

    payload = {
        "from": SENDER_EMAIL,
        "to": [recipient_email],
        "subject": subject,
        "text": safe_text,
        "html": html_message
    }

    # Resend expects attachment contents to be Base64 encoded.
    if attachments:
        payload["attachments"] = [
            {
                "filename": attachment["filename"],
                "content": base64.b64encode(
                    attachment["content"]
                ).decode("utf-8")
            }
            for attachment in attachments
        ]

    response = requests.post(
        "https://api.resend.com/emails",
        json=payload,
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json"
        },
        timeout=60
    )

    response.raise_for_status()
    return response.json()
