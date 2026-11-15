"""Invoice importing subsystem.

# PATTERNS: Adapter (CsvInvoiceSource) + Chain of Responsibility (RowValidator chain)
Allows reading diverse data sources via standard iterator and validates row data
step-by-step before invoking InvoiceFactory.
"""
from __future__ import annotations

import csv
import io
from abc import ABC, abstractmethod
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from app.application.invoice_factory import InvoiceFactory
from app.application.ports import ClientRepository, InvoiceRepository, ProjectRepository
from app.domain.client import Client
from app.domain.exceptions import DomainValidationError
from app.domain.money import Money
from app.domain.project import Project


@dataclass(frozen=True)
class RawInvoiceRow:
    """Target data row representation produced by invoice sources."""

    row_number: int
    data: dict[str, str]


class InvoiceSource(ABC):
    """Target interface for invoice input sources.

    # PATTERN: Adapter — Target
    """

    @abstractmethod
    def read_rows(self) -> Iterator[RawInvoiceRow]:
        """Yield parsed RawInvoiceRow records."""
        ...

    @abstractmethod
    def file_errors(self) -> list[str]:
        """Return structural or header-level file errors (e.g., missing required headers)."""
        ...


class CsvInvoiceSource(InvoiceSource):
    """Adapter wrapping Python's csv.DictReader (Adaptee) to the InvoiceSource Target interface.

    # PATTERN: Adapter — Adapter
    """

    REQUIRED_HEADERS = {
        "client_name",
        "client_email",
        "issue_date",
        "due_date",
        "total_amount",
    }

    def __init__(self, content: str) -> None:
        self._content = content
        self._file_errors: list[str] = []
        self._validate_headers()

    def _validate_headers(self) -> None:
        if not self._content or not self._content.strip():
            self._file_errors.append("CSV content is empty")
            return

        f = io.StringIO(self._content.strip())
        reader = csv.reader(f)
        try:
            raw_headers = next(reader)
        except StopIteration:
            self._file_errors.append("CSV has no header row")
            return

        normalized = {h.strip().lower() for h in raw_headers if h and h.strip()}
        missing = self.REQUIRED_HEADERS - normalized
        if missing:
            self._file_errors.append(f"Missing required CSV headers: {', '.join(sorted(missing))}")

    def file_errors(self) -> list[str]:
        return list(self._file_errors)

    def read_rows(self) -> Iterator[RawInvoiceRow]:
        if self._file_errors:
            return

        f = io.StringIO(self._content.strip())
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            return

        # Map fieldnames to normalized lower-case
        field_map = {fn: fn.strip().lower() for fn in reader.fieldnames if fn}

        for row_idx, row in enumerate(reader, start=1):
            normalized_row: dict[str, str] = {}
            for k, v in row.items():
                if k in field_map:
                    normalized_row[field_map[k]] = v.strip() if v else ""
            yield RawInvoiceRow(row_number=row_idx, data=normalized_row)


class InvoiceSourceFactory:
    """Factory for instantiating InvoiceSource adapters."""

    @classmethod
    def for_format(cls, fmt: str, content: str) -> InvoiceSource:
        norm_fmt = fmt.strip().lower()
        if norm_fmt == "csv":
            return CsvInvoiceSource(content)
        raise DomainValidationError(f"Unsupported invoice source format: {fmt!r}")


# ── Chain of Responsibility: Row Validation ───────────────────────────────────

@dataclass
class ValidationContext:
    errors: list[str] = field(default_factory=list)
    parsed: dict[str, object] = field(default_factory=dict)
    seen_numbers: set[str] = field(default_factory=set)


class RowValidator(ABC):
    """Abstract validator link in the validation chain.

    # PATTERN: Chain of Responsibility — Handler
    """

    def __init__(self) -> None:
        self._next: RowValidator | None = None

    def set_next(self, validator: RowValidator) -> RowValidator:
        self._next = validator
        return validator

    def validate(self, row: RawInvoiceRow, ctx: ValidationContext) -> None:
        self.check(row, ctx)
        if self._next is not None:
            self._next.validate(row, ctx)

    @abstractmethod
    def check(self, row: RawInvoiceRow, ctx: ValidationContext) -> None: ...


class RequiredFieldsValidator(RowValidator):
    """Checks presence of required non-empty fields."""

    def check(self, row: RawInvoiceRow, ctx: ValidationContext) -> None:
        for field_name in ["client_name", "client_email", "issue_date", "due_date", "total_amount"]:
            val = row.data.get(field_name, "").strip()
            if not val:
                ctx.errors.append(f"Missing required field: {field_name}")
            else:
                ctx.parsed[field_name] = val


class ClientDataValidator(RowValidator):
    """Validates client email format."""

    def check(self, row: RawInvoiceRow, ctx: ValidationContext) -> None:
        email = str(ctx.parsed.get("client_email", "")).strip()
        if email and "@" not in email:
            ctx.errors.append(f"Invalid client email: {email!r}")


class DateValidator(RowValidator):
    """Parses issue_date and due_date (YYYY-MM-DD or DD/MM/YYYY) and asserts due_date >= issue_date."""

    def _parse_date(self, val: str) -> date | None:
        val = val.strip()
        for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
            try:
                return datetime.strptime(val, fmt).date()
            except ValueError:
                pass
        return None

    def check(self, row: RawInvoiceRow, ctx: ValidationContext) -> None:
        raw_issue = str(ctx.parsed.get("issue_date", "")).strip()
        raw_due = str(ctx.parsed.get("due_date", "")).strip()

        issue_d = self._parse_date(raw_issue) if raw_issue else None
        due_d = self._parse_date(raw_due) if raw_due else None

        if raw_issue and issue_d is None:
            ctx.errors.append(f"Invalid issue_date format: {raw_issue!r} (expected YYYY-MM-DD or DD/MM/YYYY)")
        if raw_due and due_d is None:
            ctx.errors.append(f"Invalid due_date format: {raw_due!r} (expected YYYY-MM-DD or DD/MM/YYYY)")

        if issue_d and due_d:
            if due_d < issue_d:
                ctx.errors.append(f"due_date {due_d} cannot be before issue_date {issue_d}")
            ctx.parsed["parsed_issue_date"] = issue_d
            ctx.parsed["parsed_due_date"] = due_d


class AmountValidator(RowValidator):
    """Validates total_amount is a positive decimal number."""

    def check(self, row: RawInvoiceRow, ctx: ValidationContext) -> None:
        raw_amt = str(ctx.parsed.get("total_amount", "")).strip()
        if not raw_amt:
            return
        try:
            amt = Decimal(raw_amt)
            if amt <= Decimal("0"):
                ctx.errors.append(f"total_amount must be positive, got {raw_amt!r}")
            else:
                curr = row.data.get("currency", "").strip() or "INR"
                ctx.parsed["parsed_total"] = Money.of(amt, currency=curr)
        except InvalidOperation:
            ctx.errors.append(f"Invalid total_amount: {raw_amt!r}")


class StatusValidator(RowValidator):
    """Validates invoice status ('draft' or 'sent', defaults to 'sent')."""

    def check(self, row: RawInvoiceRow, ctx: ValidationContext) -> None:
        raw_status = row.data.get("status", "").strip().lower()
        if not raw_status:
            ctx.parsed["parsed_status"] = "sent"
        elif raw_status in ("draft", "sent"):
            ctx.parsed["parsed_status"] = raw_status
        else:
            ctx.errors.append(f"Invalid status: {raw_status!r} (must be 'draft' or 'sent')")


class DuplicateInvoiceNumberValidator(RowValidator):
    """Validates invoice number uniqueness against seen numbers in file and repository."""

    def __init__(self, invoice_repo: InvoiceRepository) -> None:
        super().__init__()
        self.invoice_repo = invoice_repo

    def check(self, row: RawInvoiceRow, ctx: ValidationContext) -> None:
        num = row.data.get("invoice_number", "").strip()
        if not num:
            return
        if num in ctx.seen_numbers:
            ctx.errors.append(f"Duplicate invoice_number in file: {num!r}")
            return
        ctx.seen_numbers.add(num)
        existing = self.invoice_repo.find_by_number(num)
        if existing is not None:
            ctx.errors.append(f"Invoice number already exists: {num!r}")
        else:
            ctx.parsed["invoice_number"] = num


# ── Importer Coordinator ──────────────────────────────────────────────────────

@dataclass(frozen=True)
class RowError:
    row_number: int
    messages: list[str]


@dataclass(frozen=True)
class ImportResult:
    processed: int
    imported: int
    rejected: int
    errors: list[RowError]
    file_errors: list[str]

    def summary(self) -> str:
        return (
            f"Import complete: {self.imported} imported, {self.rejected} rejected "
            f"out of {self.processed} rows."
        )


class InvoiceImporter:
    """Coordinates invoice source reading, validator chain execution, and entity creation."""

    def __init__(
        self,
        invoice_repo: InvoiceRepository,
        client_repo: ClientRepository,
        project_repo: ProjectRepository,
        invoice_factory: InvoiceFactory,
        bus: object = None,
    ) -> None:
        self.invoice_repo = invoice_repo
        self.client_repo = client_repo
        self.project_repo = project_repo
        self.invoice_factory = invoice_factory
        self.bus = bus

    def _build_validator_chain(self) -> RowValidator:
        v1 = RequiredFieldsValidator()
        v2 = ClientDataValidator()
        v3 = DateValidator()
        v4 = AmountValidator()
        v5 = StatusValidator()
        v6 = DuplicateInvoiceNumberValidator(self.invoice_repo)

        v1.set_next(v2).set_next(v3).set_next(v4).set_next(v5).set_next(v6)
        return v1

    def import_invoices(self, source: InvoiceSource, now: datetime) -> ImportResult:
        file_errs = source.file_errors()
        if file_errs:
            return ImportResult(
                processed=0,
                imported=0,
                rejected=0,
                errors=[],
                file_errors=file_errs,
            )

        validator_chain = self._build_validator_chain()
        seen_numbers: set[str] = set()

        processed = 0
        imported = 0
        rejected = 0
        row_errors: list[RowError] = []

        for row in source.read_rows():
            processed += 1
            ctx = ValidationContext(seen_numbers=seen_numbers)
            validator_chain.validate(row, ctx)

            if ctx.errors:
                rejected += 1
                row_errors.append(RowError(row_number=row.row_number, messages=ctx.errors))
                continue

            # Find or create Client
            client_email = str(ctx.parsed["client_email"]).strip()
            client_name = str(ctx.parsed["client_name"]).strip()
            company_name = row.data.get("company_name", "").strip() or None
            phone = row.data.get("phone", "").strip() or None

            client = self.client_repo.find_by_email(client_email)
            if client is None:
                client = Client(
                    name=client_name,
                    email=client_email,
                    phone=phone,
                    company_name=company_name,
                    created_at=now,
                )
                self.client_repo.save(client)

            # Find or create Project if project_name given
            project_id = None
            project_name = row.data.get("project_name", "").strip()
            if project_name:
                existing_projects = self.project_repo.list_by_client(client.id)
                proj = next((p for p in existing_projects if p.project_name.lower() == project_name.lower()), None)
                if proj is None:
                    proj = Project(
                        client_id=client.id,
                        project_name=project_name,
                        start_date=ctx.parsed["parsed_issue_date"],  # type: ignore[arg-type]
                    )
                    self.project_repo.save(proj)
                project_id = proj.id

            # Create Invoice via factory
            inv_num = ctx.parsed.get("invoice_number")
            invoice = self.invoice_factory.create(
                client_id=client.id,
                total=ctx.parsed["parsed_total"],  # type: ignore[arg-type]
                issue_date=ctx.parsed["parsed_issue_date"],  # type: ignore[arg-type]
                due_date=ctx.parsed["parsed_due_date"],  # type: ignore[arg-type]
                now=now,
                invoice_number=str(inv_num) if inv_num else None,
                project_id=project_id,
            )

            # Transition to SENT if required
            status = ctx.parsed.get("parsed_status", "sent")
            if status == "sent":
                invoice.send(now)

            # Save and publish
            self.invoice_repo.save(invoice)
            if self.bus is not None and hasattr(self.bus, "publish_all"):
                self.bus.publish_all(invoice.pull_events())

            imported += 1

        return ImportResult(
            processed=processed,
            imported=imported,
            rejected=rejected,
            errors=row_errors,
            file_errors=[],
        )
