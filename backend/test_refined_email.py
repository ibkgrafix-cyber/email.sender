
import os
import requests
from dotenv import load_dotenv
from html import escape

load_dotenv()

API_KEY = os.getenv("RESEND_API_KEY")

if not API_KEY:
    raise ValueError("RESEND_API_KEY is missing")

recipient = "ibksam4@gmail.com"

message = """Hello,

We are contacting you regarding an upcoming update to the Rent Assist Portal platform.

As part of this update, registered customers are required to review and verify their account information by December 20, 2026.

To complete this process, please visit our official website and sign in to your account:

https://rentassistportal.org

If you have already completed the verification, no further action is required.

If you have questions about this update, please contact Rent Assist Portal through our official website.

Thank you,
Rent Assist Portal Support
https://rentassistportal.org
"""

html_message = (
    '<html><body>'
    '<div style="font-family:Arial,sans-serif;'
    'font-size:15px;line-height:1.7;'
    'color:#333333;max-width:600px;margin:auto;">'
    + escape(message).replace("\n", "<br>")
    + '</div></body></html>'
)

payload = {
    "from": "Rent Assist Portal <info@rentassistportal.org>",
    "to": [recipient],
    "subject": "Important Update to Your Rent Assist Portal Account",
    "text": message,
    "html": html_message
}

response = requests.post(
    "https://api.resend.com/emails",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    },
    json=payload,
    timeout=30
)

print("Status:", response.status_code)
print("Response:", response.text)

response.raise_for_status()
