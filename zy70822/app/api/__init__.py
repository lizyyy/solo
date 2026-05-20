from fastapi import APIRouter
from . import import_routes, reconciliation_routes, review_routes, report_routes, trace_routes

api_router = APIRouter()

api_router.include_router(import_routes.router, prefix="/import", tags=["数据导入"])
api_router.include_router(reconciliation_routes.router, prefix="/reconciliation", tags=["对账处理"])
api_router.include_router(review_routes.router, prefix="/review", tags=["人工复核"])
api_router.include_router(report_routes.router, prefix="/report", tags=["报告生成"])
api_router.include_router(trace_routes.router, prefix="/trace", tags=["数据追溯"])

__all__ = ["api_router"]
