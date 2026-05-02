from app.routers.batteries import router as batteries_router
from app.routers.imports import router as imports_router
from app.routers.release_check import router as release_check_router
from app.routers.quarantine import router as quarantine_router
from app.routers.history import router as history_router
from app.routers.config import router as config_router

__all__ = [
    "batteries_router",
    "imports_router",
    "release_check_router",
    "quarantine_router",
    "history_router",
    "config_router"
]
