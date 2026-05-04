from fastapi import APIRouter

from app.api.detect import router as detect_router
from app.api.lexicon import router as lexicon_router
from app.api.history import router as history_router
from app.api.review import router as review_router
from app.api.export import router as export_router

api_router = APIRouter()

api_router.include_router(detect_router, prefix="/detect", tags=["检测"])
api_router.include_router(lexicon_router, prefix="/lexicon", tags=["词库管理"])
api_router.include_router(history_router, prefix="/history", tags=["历史记录"])
api_router.include_router(review_router, prefix="/review", tags=["人工复核"])
api_router.include_router(export_router, prefix="/export", tags=["报告导出"])

__all__ = ["api_router"]
