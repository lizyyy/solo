from app.api.tools import router as tools_router
from app.api.permissions import router as permissions_router
from app.api.calls import router as calls_router
from app.api.approvals import router as approvals_router
from app.api.exceptions import router as exceptions_router
from app.api.audit import router as audit_router

__all__ = [
    "tools_router",
    "permissions_router",
    "calls_router",
    "approvals_router",
    "exceptions_router",
    "audit_router",
]
