from fastapi import APIRouter
from app.api.compensation import router as compensation_router
from app.api.export import router as export_router
from app.api.voucher import router as voucher_router

api_router = APIRouter()

api_router.include_router(compensation_router, prefix="/compensation", tags=["补偿管理"])
api_router.include_router(export_router, prefix="/export", tags=["导出统计"])
api_router.include_router(voucher_router, prefix="/voucher", tags=["补偿券管理"])
