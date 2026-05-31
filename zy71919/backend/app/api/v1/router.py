from fastapi import APIRouter

from .materials import router as materials_router
from .imports import router as imports_router
from .exports import router as exports_router
from .history import router as history_router
from .health import router as health_router

api_router = APIRouter()

api_router.include_router(health_router, tags=["健康检查"])
api_router.include_router(materials_router, tags=["素材管理"])
api_router.include_router(imports_router, tags=["导入管理"])
api_router.include_router(exports_router, tags=["导出管理"])
api_router.include_router(history_router, tags=["历史追溯"])
