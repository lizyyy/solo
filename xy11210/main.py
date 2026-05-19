from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import engine, Base, get_db
from app.api import auth, pump_rooms, inspections, work_orders, import_export
from app.services.user_service import UserService
from app.services.pump_room_service import PumpRoomService
from app.utils.logger import logger
import traceback


Base.metadata.create_all(bind=engine)


def init_database():
    db = next(get_db())
    try:
        UserService.init_default_user(db)
        PumpRoomService.init_default_pump_rooms(db)
        logger.info({"action": "database_initialized"})
    except Exception as e:
        logger.error({"action": "database_init_failed", "error": str(e)})
    finally:
        db.close()


app = FastAPI(
    title="泵房巡检管理系统",
    description="小区地下泵房巡检管理系统 - 解决微信群分散管理问题",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error({
        "action": "unhandled_exception",
        "path": request.url.path,
        "method": request.method,
        "error": str(exc),
        "traceback": traceback.format_exc()
    })
    return JSONResponse(
        status_code=500,
        content={"code": 500, "message": "服务器内部错误", "data": None}
    )


app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["认证"])
app.include_router(pump_rooms.router, prefix=f"{settings.API_V1_STR}/pump-rooms", tags=["泵房管理"])
app.include_router(inspections.router, prefix=f"{settings.API_V1_STR}/inspections", tags=["巡检记录"])
app.include_router(work_orders.router, prefix=f"{settings.API_V1_STR}/work-orders", tags=["工单管理"])
app.include_router(import_export.router, prefix=f"{settings.API_V1_STR}/io", tags=["导入导出"])


@app.on_event("startup")
async def startup_event():
    init_database()
    logger.info({"action": "app_startup"})


@app.on_event("shutdown")
async def shutdown_event():
    logger.info({"action": "app_shutdown"})


@app.get("/")
async def root():
    return {
        "message": "泵房巡检管理系统",
        "version": "1.0.0",
        "docs": "/docs",
        "api_prefix": settings.API_V1_STR
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
