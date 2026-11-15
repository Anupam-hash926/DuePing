"""SQLAlchemy ORM tables for DuePing.

Data only — zero business logic. All business rules reside strictly in domain/application.
All primary keys are String(32) UUID hex strings.
Amounts are stored as Integer minor units (*_minor).
Enums are stored as their .name string representations.
Child tables configure ON DELETE CASCADE.
"""
from __future__ import annotations
from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db import Base


class ClientModel(Base):
    """ORM table: clients."""

    __tablename__ = "clients"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    company_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    promises_kept: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    promises_missed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # Relationships
    projects: Mapped[List[ProjectModel]] = relationship(
        "ProjectModel", back_populates="client", cascade="all, delete-orphan"
    )
    invoices: Mapped[List[InvoiceModel]] = relationship(
        "InvoiceModel", back_populates="client", cascade="all, delete-orphan"
    )


class ProjectModel(Base):
    """ORM table: projects."""

    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    client_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Active", nullable=False)

    client: Mapped[ClientModel] = relationship("ClientModel", back_populates="projects")
    invoices: Mapped[List[InvoiceModel]] = relationship("InvoiceModel", back_populates="project")


class InvoiceModel(Base):
    """ORM table: invoices."""

    __tablename__ = "invoices"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    invoice_number: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[Optional[str]] = mapped_column(
        String(32), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="DRAFT", nullable=False, index=True)
    reminder_level: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    overdue_notified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # Relationships
    client: Mapped[ClientModel] = relationship("ClientModel", back_populates="invoices")
    project: Mapped[Optional[ProjectModel]] = relationship("ProjectModel", back_populates="invoices")

    payments: Mapped[List[PaymentModel]] = relationship(
        "PaymentModel", back_populates="invoice", cascade="all, delete-orphan", order_by="PaymentModel.recorded_at"
    )
    blockers: Mapped[List[BlockerModel]] = relationship(
        "BlockerModel", back_populates="invoice", cascade="all, delete-orphan", order_by="BlockerModel.created_at"
    )
    promises: Mapped[List[PromiseModel]] = relationship(
        "PromiseModel", back_populates="invoice", cascade="all, delete-orphan", order_by="PromiseModel.created_at"
    )
    follow_ups: Mapped[List[FollowUpModel]] = relationship(
        "FollowUpModel", back_populates="invoice", cascade="all, delete-orphan", order_by="FollowUpModel.contact_date"
    )
    documents: Mapped[List[DocumentModel]] = relationship(
        "DocumentModel", back_populates="invoice", cascade="all, delete-orphan", order_by="DocumentModel.uploaded_at"
    )
    actions: Mapped[List[NextActionModel]] = relationship(
        "NextActionModel", back_populates="invoice", cascade="all, delete-orphan", order_by="NextActionModel.due_date"
    )


class PaymentModel(Base):
    """ORM table: payments."""

    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    invoice_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    method: Mapped[str] = mapped_column(String(32), nullable=False)
    reference_number: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    invoice: Mapped[InvoiceModel] = relationship("InvoiceModel", back_populates="payments")


class BlockerModel(Base):
    """ORM table: blockers."""

    __tablename__ = "blockers"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    invoice_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    assigned_to: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="OPEN", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    invoice: Mapped[InvoiceModel] = relationship("InvoiceModel", back_populates="blockers")


class PromiseModel(Base):
    """ORM table: promises."""

    __tablename__ = "promises"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    invoice_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    promised_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount_minor: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    note: Mapped[str] = mapped_column(Text, default="", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    invoice: Mapped[InvoiceModel] = relationship("InvoiceModel", back_populates="promises")


class FollowUpModel(Base):
    """ORM table: follow_ups."""

    __tablename__ = "follow_ups"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    invoice_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    contact_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    channel: Mapped[str] = mapped_column(String(32), nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    outcome: Mapped[str] = mapped_column(String(32), nullable=False)

    invoice: Mapped[InvoiceModel] = relationship("InvoiceModel", back_populates="follow_ups")


class DocumentModel(Base):
    """ORM table: documents."""

    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    invoice_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_type: Mapped[str] = mapped_column(String(64), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(32), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    invoice: Mapped[InvoiceModel] = relationship("InvoiceModel", back_populates="documents")


class NextActionModel(Base):
    """ORM table: next_actions."""

    __tablename__ = "next_actions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    invoice_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(32), nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    source_ref: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    invoice: Mapped[InvoiceModel] = relationship("InvoiceModel", back_populates="actions")


class AuditEventModel(Base):
    """ORM table: audit_events."""

    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    invoice_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)


class NotificationModel(Base):
    """ORM table: notifications."""

    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class AppSettingsModel(Base):
    """ORM table: app_settings."""

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
