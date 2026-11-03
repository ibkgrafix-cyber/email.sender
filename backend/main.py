
import os
import re
import time
import uuid
import threading
import secrets
from datetime import datetime, timezone
from threading import Lock

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.services.email_service import send_email

load_dotenv()

app = FastAPI(
    title="Client Email Platform",
    version="1.0.0"
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
    allow_headers=["Content-Type", "X-Platform-Key"],
)

campaigns = {}
campaign_lock = Lock()

EMAIL_PATTERN = re.compile(
    r"^[^@\s,]+@[^@\s,]+\.[^@\s,]+$"
)

MAX_RECIPIENTS = 10000
EMAILS_PER_SECOND = 1

LOCAL_HOSTS = {"127.0.0.1", "::1"}


class CampaignRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    template_id: str
    recipients: list[str] = Field(
        min_length=1,
        max_length=10000
    )


def require_platform_key(
    key: str | None,
    request: Request
):
    # Local development: requests originating from the
    # same computer may use the dashboard without a key.
    #
    # Public deployments still require PLATFORM_API_KEY.
    local_mode = (
        os.getenv("LOCAL_DEVELOPMENT", "false").lower()
        == "true"
    )

    if local_mode and request.client:
        if request.client.host in LOCAL_HOSTS:
            return

    configured_key = os.getenv("PLATFORM_API_KEY")

    if not configured_key:
        raise HTTPException(
            status_code=503,
            detail="Platform API key is not configured."
        )

    if not key or not secrets.compare_digest(
        key,
        configured_key
    ):
        raise HTTPException(
            status_code=403,
            detail="Access denied."
        )


def process_campaign(campaign_id):
    with campaign_lock:
        campaign = campaigns[campaign_id]
        campaign["status"] = "processing"
        recipients = list(campaign["recipients"])

    for email in recipients:
        with campaign_lock:
            campaign = campaigns[campaign_id]

            if campaign["status"] == "cancelled":
                break

        try:
            result = send_email(email)

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

        except Exception:
            with campaign_lock:
                campaign["failed"] += 1
                campaign["results"].append({
                    "email": email,
                    "status": "failed",
                    "resend_id": None,
                    "error": "Unexpected sending error."
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
def create_campaign(
    campaign_request: CampaignRequest,
    request: Request,
    x_platform_key: str | None = Header(default=None)
):
    require_platform_key(x_platform_key, request)

    if campaign_request.template_id != "account-verification":
        raise HTTPException(
            status_code=400,
            detail="Unsupported email template."
        )

    recipients = list(dict.fromkeys(
        email.strip().lower()
        for email in campaign_request.recipients
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

    campaign_id = str(uuid.uuid4())

    with campaign_lock:
        campaigns[campaign_id] = {
            "id": campaign_id,
            "name": campaign_request.name,
            "template_id": campaign_request.template_id,
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
        "total": len(recipients)
    }


@app.get("/api/campaigns/{campaign_id}")
def get_campaign(
    campaign_id: str,
    request: Request,
    x_platform_key: str | None = Header(default=None)
):
    require_platform_key(x_platform_key, request)

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
