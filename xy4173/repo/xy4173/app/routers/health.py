from datetime import datetime
from typing import Dict, Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db, init_db
from app.core.config import settings
from app.schemas.base import BaseResponse, SuccessResponse
from app.utils.self_check import run_self_check, SelfCheckResult


router = APIRouter(tags=["健康检查"])


@router.get("/health", response_model=BaseResponse)
async def health_check():
    """健康检查端点"""
    return BaseResponse(
        success=True,
        message="服务运行正常",
        timestamp=datetime.now()
    )


@router.get("/health/detailed", response_model=SuccessResponse)
async def detailed_health_check():
    """详细健康检查"""
    return SuccessResponse(
        success=True,
        message="服务运行正常",
        data={
            "app_name": settings.APP_NAME,
            "app_version": settings.APP_VERSION,
            "debug": settings.DEBUG,
            "database_url": str(settings.DATABASE_URL),
            "timestamp": datetime.now().isoformat()
        }
    )


@router.get("/self-check", response_model=SuccessResponse)
async def self_check(db: Session = Depends(get_db)):
    """系统自检"""
    try:
        init_db()
        check_result = run_self_check(db)
        
        return SuccessResponse(
            success=check_result.success,
            message=f"自检完成: {check_result.passed}/{check_result.total_checks} 通过",
            data={
                "check_time": check_result.check_time.isoformat(),
                "total_checks": check_result.total_checks,
                "passed": check_result.passed,
                "failed": check_result.failed,
                "results": [
                    {
                        "name": r.name,
                        "success": r.success,
                        "message": r.message,
                        "duration_ms": r.duration_ms,
                        "details": r.details,
                        "error_message": r.error_message
                    }
                    for r in check_result.results
                ]
            }
        )
    except Exception as e:
        return SuccessResponse(
            success=False,
            message=f"自检过程出错: {str(e)}",
            data={"error": str(e)}
        )


@router.get("/version")
async def get_version():
    """获取版本信息"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "api_prefix": settings.API_PREFIX,
        "timezone": settings.TIMEZONE
    }
