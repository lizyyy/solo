from fastapi import APIRouter
from app.api.auth import router as auth_router
from app.api.source_data import router as source_data_router
from app.api.tasks import router as tasks_router
from app.api.reports import router as reports_router
from app.api.manager import router as manager_router
from app.api.compensation import router as compensation_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["认证"])
api_router.include_router(source_data_router, prefix="/source-data", tags=["来源数据"])
api_router.include_router(tasks_router, prefix="/tasks", tags=["任务管理"])
api_router.include_router(reports_router, prefix="/reports", tags=["报表与追踪"])
api_router.include_router(manager_router, prefix="/manager", tags=["项目经理视图"])
api_router.include_router(compensation_router, prefix="/compensation", tags=["补偿管理"])
