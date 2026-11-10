"""API error handlers and exception registration.

Translates domain exceptions to HTTP responses per Section 15.2:
- EntityNotFound → 404
- InvalidStateTransition → 409
- DuplicateInvoiceNumber → 409
- DomainValidationError → 422
- Response body: {"error": {"code": "<ExceptionClassName>", "message": "<text>"}}
- Pydantic validation errors keep FastAPI's 422 default.
"""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.domain.exceptions import (
    DomainValidationError,
    DuplicateInvoiceNumber,
    EntityNotFound,
    InvalidStateTransition,
)


def register_error_handlers(app: FastAPI) -> None:
    """Register domain exception handlers on the FastAPI app."""

    @app.exception_handler(EntityNotFound)
    async def entity_not_found_handler(request: Request, exc: EntityNotFound) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content={"error": {"code": exc.__class__.__name__, "message": str(exc)}},
        )

    @app.exception_handler(InvalidStateTransition)
    async def invalid_state_transition_handler(
        request: Request, exc: InvalidStateTransition
    ) -> JSONResponse:
        return JSONResponse(
            status_code=409,
            content={"error": {"code": exc.__class__.__name__, "message": str(exc)}},
        )

    @app.exception_handler(DuplicateInvoiceNumber)
    async def duplicate_invoice_number_handler(
        request: Request, exc: DuplicateInvoiceNumber
    ) -> JSONResponse:
        return JSONResponse(
            status_code=409,
            content={"error": {"code": exc.__class__.__name__, "message": str(exc)}},
        )

    @app.exception_handler(DomainValidationError)
    async def domain_validation_error_handler(
        request: Request, exc: DomainValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={"error": {"code": exc.__class__.__name__, "message": str(exc)}},
        )
