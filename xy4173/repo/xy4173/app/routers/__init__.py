"""API 路由模块"""
from app.routers.health import router as health_router
from app.routers.imports import router as import_router
from app.routers.query import router as query_router
from app.routers.review import router as review_router
from app.routers.exports import router as export_router
from app.routers.admin import router as admin_router

__all__ = [
    "health_router",
    "import_router",
    "query_router",
    "review_router",
    "export_router",
    "admin_router"
]
