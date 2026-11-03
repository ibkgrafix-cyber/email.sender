
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


class EmailDelivery(Base):
    __tablename__ = "email_deliveries"

    id = Column(Integer, primary_key=True, index=True)

    campaign_id = Column(
        Integer,
        ForeignKey("campaigns.id"),
        nullable=False
    )

    customer_id = Column(
        Integer,
        ForeignKey("customers.id"),
        nullable=False
    )

    resend_email_id = Column(
        String(255),
        unique=True,
        nullable=True
    )

    status = Column(
        String(30),
        default="pending",
        nullable=False
    )

    error_message = Column(
        String(500),
        nullable=True
    )

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    sent_at = Column(
        DateTime(timezone=True),
        nullable=True
    )

    delivered_at = Column(
        DateTime(timezone=True),
        nullable=True
    )

    campaign = relationship("Campaign")
    customer = relationship("Customer")

    __table_args__ = (
        UniqueConstraint(
            "campaign_id",
            "customer_id",
            name="uq_campaign_customer"
        ),
    )
