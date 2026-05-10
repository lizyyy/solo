from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.config import settings
from app.database import init_db
from app.routers import (
    collection_router,
    approval_router,
    insurance_router,
    tracking_router,
    task_router
)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.API_VERSION,
    description="博物馆藏品出库审批 API - 支持藏品档案管理、出库审批流程、保险单管理、运输追踪、环境监测和归还验收"
)


@app.on_event("startup")
async def startup_event():
    init_db()
    print(f"{settings.APP_NAME} 启动完成，数据库已初始化")


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=400,
        content={"success": False, "message": str(exc), "data": None}
    )


app.include_router(collection_router.router)
app.include_router(approval_router.router)
app.include_router(insurance_router.router)
app.include_router(tracking_router.router)
app.include_router(task_router.router)


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.API_VERSION,
        "status": "running",
        "docs": "/docs",
        "endpoints": {
            "藏品档案": "/api/v1/collection",
            "出库审批": "/api/v1/approvals",
            "保险单管理": "/api/v1/insurance",
            "运输与追踪": "/api/v1/tracking",
            "后台任务": "/api/v1/tasks"
        }
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "museum-approval-api"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
