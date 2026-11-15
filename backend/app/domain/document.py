"""SupportingDocument — metadata only, no file storage."""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Any, Optional

from app.domain.enums import DocumentType

ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "docx", "xlsx", "csv"}


class SupportingDocument:
    """Document metadata. Persistence is the repository's job, not the entity's."""

    def __init__(
        self,
        document_type: DocumentType,
        file_name: str,
        file_path: str,
        uploaded_at: datetime,
        file_type: Optional[str] = None,
        id: Optional[str] = None,
    ) -> None:
        self.id: str = id or uuid.uuid4().hex
        self.document_type: DocumentType = document_type
        self.file_name: str = file_name
        self.file_path: str = file_path
        self.uploaded_at: datetime = uploaded_at
        if file_type is not None:
            self.file_type: str = file_type
        else:
            ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
            self.file_type = ext

    @classmethod
    def reconstitute(cls, **fields: Any) -> "SupportingDocument":
        """Rebuild from stored data without side effects (used by mappers only)."""
        obj = object.__new__(cls)
        for k, v in fields.items():
            object.__setattr__(obj, k, v)
        return obj

    def validate_file_type(self) -> bool:
        """True if the file extension is in the allowed set."""
        ext = self.file_name.rsplit(".", 1)[-1].lower() if "." in self.file_name else ""
        return ext in ALLOWED_EXTENSIONS

    def details(self) -> str:
        """One-line document summary."""
        return f"{self.document_type.name}: {self.file_name} ({self.file_type})"
