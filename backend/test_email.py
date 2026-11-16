
import os
import requests
from dotenv import load_dotenv

load_dotenv()

# Use your IBK Grafix Resend API key
API_KEY = os.environ["IBKGRAFIX_RESEND_API_KEY"]

response = requests.post(
    "https://api.resend.com/emails",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    },
    json={
        "from": "IBK Grafix <info@ibkgrafix.com.ng>",
        "to": ["oje2098@gmail.com"],
        "subject": "Important Account Update",
        "text": """Hello,

An important update regarding your account information requires your attention.

To ensure your account details remain accurate and current, please review the information associated with your account.

Thank you for your attention to this matter.

Kind regards,
Customer Support Team"""
    },
    timeout=20
)

print(response.status_code, response.text)
