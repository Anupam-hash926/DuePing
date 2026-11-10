"""FastAPI application entry point.

Creates the FastAPI app instance, registers routers under /api, configures
CORS middleware, registers domain exception handlers, and creates DB tables.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import register_error_handlers
from app.api.routers import actions, clients, importing, invoices, reports, system
from app.infrastructure.db import create_all


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist
    create_all()
    yield


app = FastAPI(
    title="DuePing API",
    description="Resolution-first payment follow-up and collections API",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS middleware for local frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
register_error_handlers(app)

# Mount routers under /api
app.include_router(clients.router, prefix="/api")
app.include_router(invoices.router, prefix="/api")
app.include_router(actions.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(importing.router, prefix="/api")
app.include_router(system.router, prefix="/api")


@app.get("/")
def root():
    return {"message": "DuePing API is running. See /docs for OpenAPI documentation."}
