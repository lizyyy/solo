from fastapi import APIRouter

from app.api import anomalies, devices, rules, compensation

router = APIRouter()

router.include_router(anomalies.router, prefix="/anomalies", tags=["异常记录"])
router.include_router(devices.router, prefix="/devices", tags=["设备指标"])
router.include_router(rules.router, prefix="/rules", tags=["异常规则"])
router.include_router(compensation.router, prefix="/compensation", tags=["补偿操作"])
