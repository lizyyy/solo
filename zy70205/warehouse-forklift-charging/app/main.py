from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from datetime import datetime

from app.database import engine, Base
from app.routers import (
    forklift_router, station_router, charging_router, 
    task_router, correction_router
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="仓库叉车充电排队 API",
    description="面向仓库夜班叉车集中回充场景的充电排队管理系统",
    version="1.0.0"
)

app.include_router(forklift_router.router)
app.include_router(station_router.router)
app.include_router(charging_router.router)
app.include_router(task_router.router)
app.include_router(correction_router.router)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        errors.append({
            "field": ".".join([str(x) for x in err["loc"] if x != "body"]),
            "code": err["type"],
            "message": err["msg"]
        })
    
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "code": "VALIDATION_ERROR",
            "message": "请求参数校验失败",
            "errors": errors,
            "timestamp": datetime.utcnow().isoformat()
        }
    )

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "warehouse-forklift-charging",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/")
def root():
    return {
        "name": "仓库叉车充电排队 API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "叉车档案": "/api/forklifts",
            "充电位管理": "/api/stations",
            "充电排队": "/api/charging",
            "任务管理": "/api/tasks",
            "人工修正": "/api/correction"
        }
    }
