
import os
import re
import json
import time
import uuid
import threading

from datetime import datetime, timezone
from threading import Lock

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.services.email_service import send_email

load_dotenv()

app = FastAPI(
    title="Client Email Platform",
    version="1.2.0"
)

FRONTEND_ORIGIN = os.getenv(
    "FRONTEND_ORIGIN",
    "http://localhost:5173"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_ORIGIN,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

campaigns = {}
campaign_lock = Lock()

EMAIL_PATTERN = re.compile(
    r"^[^@\s,]+@[^@\s,]+\.[^@\s,]+$"
)

MAX_RECIPIENTS = 10000
EMAILS_PER_SECOND = 1

# Attachment restrictions
ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
}

MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024
MAX_TOTAL_ATTACHMENT_SIZE = 20 * 1024 * 1024
MAX_ATTACHMENTS = 10


def process_campaign(campaign_id):
    with campaign_lock:
        campaign = campaigns[campaign_id]

        campaign["status"] = "processing"

        recipients = list(campaign["recipients"])
        subject = campaign["subject"]
        html_body = campaign["html_body"]
        text_body = campaign["text_body"]
        attachments = campaign["attachments"]

    for email in recipients:

        with campaign_lock:
            campaign = campaigns[campaign_id]

            if campaign["status"] == "cancelled":
                break

        try:
            result = send_email(
                recipient_email=email,
                subject=subject,
                html_body=html_body,
                text_body=text_body,
                attachments=attachments
            )

            with campaign_lock:
                campaign["sent"] += 1

                campaign["results"].append({
                    "email": email,
                    "status": "submitted",
                    "resend_id": result.get("id"),
                    "error": None
                })

        except requests.exceptions.RequestException as error:
            with campaign_lock:
                campaign["failed"] += 1

                campaign["results"].append({
                    "email": email,
                    "status": "failed",
                    "resend_id": None,
                    "error": str(error)[:200]
                })

        except Exception as error:
            with campaign_lock:
                campaign["failed"] += 1

                campaign["results"].append({
                    "email": email,
                    "status": "failed",
                    "resend_id": None,
                    "error": str(error)[:200]
                })

        time.sleep(1 / EMAILS_PER_SECOND)

    with campaign_lock:
        campaign = campaigns[campaign_id]

        if campaign["status"] != "cancelled":
            campaign["status"] = "completed"

        campaign["completed_at"] = datetime.now(
            timezone.utc
        ).isoformat()


@app.get("/")
def home():
    return {
        "status": "success",
        "message": "Email Platform API is running"
    }


@app.post("/api/campaigns")
async def create_campaign(
    name: str = Form(...),
    template_id: str = Form("custom"),
    subject: str = Form(...),
    html_body: str = Form(...),
    text_body: str = Form(""),
    recipients: str = Form(...),
    files: list[UploadFile] | None = File(default=None)
):
    name = name.strip()
    subject = subject.strip()
    html_body = html_body.strip()

    if not name or len(name) > 200:
        raise HTTPException(
            status_code=400,
            detail="Campaign name must contain 1–200 characters."
        )

    if not subject or len(subject) > 200:
        raise HTTPException(
            status_code=400,
            detail="Email subject must contain 1–200 characters."
        )

    if not html_body or len(html_body) > 500000:
        raise HTTPException(
            status_code=400,
            detail="Email message is empty or too large."
        )

    try:
        recipient_list = json.loads(recipients)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Recipient list is not valid JSON."
        )

    if not isinstance(recipient_list, list):
        raise HTTPException(
            status_code=400,
            detail="Recipients must be a list of email addresses."
        )

    recipients = list(dict.fromkeys(
        email.strip().lower()
        for email in recipient_list
        if isinstance(email, str)
    ))

    if not recipients or len(recipients) > MAX_RECIPIENTS:
        raise HTTPException(
            status_code=400,
            detail="Invalid recipient count."
        )

    if any(
        not EMAIL_PATTERN.fullmatch(email)
        for email in recipients
    ):
        raise HTTPException(
            status_code=400,
            detail="Recipient list contains invalid emails."
        )

    uploaded_attachments = []
    total_attachment_size = 0

    selected_files = files or []

    if len(selected_files) > MAX_ATTACHMENTS:
        raise HTTPException(
            status_code=400,
            detail=f"You can attach a maximum of {MAX_ATTACHMENTS} files."
        )

    for uploaded_file in selected_files:
        if not uploaded_file.filename:
            continue

        filename = os.path.basename(uploaded_file.filename)
        extension = os.path.splitext(filename)[1].lower()

        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File type not supported: {filename}"
            )

        content = await uploaded_file.read(
            MAX_ATTACHMENT_SIZE + 1
        )

        if not content:
            raise HTTPException(
                status_code=400,
                detail=f"The selected file is empty: {filename}"
            )

        if len(content) > MAX_ATTACHMENT_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"{filename} exceeds the 10 MB file limit."
            )

        total_attachment_size += len(content)

        if total_attachment_size > MAX_TOTAL_ATTACHMENT_SIZE:
            raise HTTPException(
                status_code=400,
                detail="Combined attachment size cannot exceed 20 MB."
            )

        uploaded_attachments.append({
            "filename": filename,
            "content": content
        })

    campaign_id = str(uuid.uuid4())

    with campaign_lock:
        campaigns[campaign_id] = {
            "id": campaign_id,
            "name": name,
            "template_id": template_id,
            "subject": subject,
            "html_body": html_body,
            "text_body": text_body,
            "attachments": uploaded_attachments,
            "status": "queued",
            "total": len(recipients),
            "sent": 0,
            "failed": 0,
            "delivered": 0,
            "bounced": 0,
            "recipients": recipients,
            "results": [],
            "created_at": datetime.now(
                timezone.utc
            ).isoformat(),
            "completed_at": None
        }

    worker = threading.Thread(
        target=process_campaign,
        args=(campaign_id,),
        daemon=True
    )

    worker.start()

    return {
        "campaign_id": campaign_id,
        "status": "queued",
        "total": len(recipients),
        "attachment_count": len(uploaded_attachments)
    }


@app.get("/api/campaigns/{campaign_id}")
def get_campaign(campaign_id: str):
    with campaign_lock:
        campaign = campaigns.get(campaign_id)

        if not campaign:
            raise HTTPException(
                status_code=404,
                detail="Campaign not found."
            )

        return {
            "id": campaign["id"],
            "name": campaign["name"],
            "status": campaign["status"],
            "total": campaign["total"],
            "sent": campaign["sent"],
            "failed": campaign["failed"],
            "delivered": campaign["delivered"],
            "bounced": campaign["bounced"],
            "completed_at": campaign["completed_at"],
            "results": list(campaign["results"])
        }
