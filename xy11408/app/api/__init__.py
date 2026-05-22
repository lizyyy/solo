from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.records import router as records_router
from app.api.replay import router as replay_router
from app.api.exports import router as exports_router
from app.api.audit_logs import router as audit_logs_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["认证"])
api_router.include_router(records_router, prefix="/records", tags=["验收记录"])
api_router.include_router(replay_router, prefix="/replay", tags=["回放链路"])
api_router.include_router(exports_router, prefix="/exports", tags=["数据导出"])
api_router.include_router(audit_logs_router, prefix="/audit-logs", tags=["审计日志"])
