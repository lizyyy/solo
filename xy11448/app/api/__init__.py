from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.piles import router as piles_router
from app.api.alerts import router as alerts_router
from app.api.inspections import router as inspections_router
from app.api.complaints import router as complaints_router
from app.api.comments import router as comments_router
from app.api.work_orders import router as work_orders_router
from app.api.reconciliation import router as reconciliation_router
from app.api.playback import router as playback_router
from app.api.failed_data import router as failed_data_router
from app.api.audit import router as audit_router
from app.api.reports import router as reports_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["认证"])
api_router.include_router(piles_router, prefix="/piles", tags=["充电桩"])
api_router.include_router(alerts_router, prefix="/alerts", tags=["桩端告警"])
api_router.include_router(inspections_router, prefix="/inspections", tags=["巡检表"])
api_router.include_router(complaints_router, prefix="/complaints", tags=["客服投诉单"])
api_router.include_router(comments_router, prefix="/comments", tags=["主管批注"])
api_router.include_router(work_orders_router, prefix="/work-orders", tags=["工单"])
api_router.include_router(reconciliation_router, prefix="/reconciliation", tags=["对账链路"])
api_router.include_router(playback_router, prefix="/playback", tags=["回放异常"])
api_router.include_router(failed_data_router, prefix="/failed-data", tags=["失败数据"])
api_router.include_router(audit_router, prefix="/audit", tags=["审计日志"])
api_router.include_router(reports_router, prefix="/reports", tags=["报表导出"])
