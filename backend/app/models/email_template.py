
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, DateTime, Boolean
from app.database import Base


class EmailTemplate(Base):
    __tablename__ = "email_templates"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(150), nullable=False)

    resend_template_id = Column(
        String(255),
        unique=True,
        nullable=False
    )

    subject = Column(String(255), nullable=False)

    is_active = Column(
        Boolean,
        default=True,
        nullable=False
    )

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
