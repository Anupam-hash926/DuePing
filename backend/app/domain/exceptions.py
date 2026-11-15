"""Domain exceptions — translated to HTTP codes only in api/errors.py."""
from __future__ import annotations


class DomainError(Exception):
    """Base class for all domain errors."""


class DomainValidationError(DomainError):
    """Raised when a domain invariant or validation rule is violated."""


class InvalidStateTransition(DomainError):
    """Raised when an operation is not permitted in the current invoice state."""


class EntityNotFound(DomainError):
    """Raised when a requested entity does not exist in the repository."""


class DuplicateInvoiceNumber(DomainError):
    """Raised when an invoice number is already in use."""


class DuplicateClient(DomainError):
    """Raised when attempting to create or update a client with an existing email."""


class ConcurrencyConflict(DomainError):
    """Raised when an invoice modification conflicts with another concurrent modification."""
