from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.api import api_router

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
    设备能效基线管理系统 API
    
    主要功能：
    - 设备和分组管理
    - 能耗和产量数据导入
    - 异常数据检测和剔除
    - 基线版本管理（支持多版本、设备更换后重新计算）
    - 产量归一化和节能收益计算
    - 审计导出（用于业务复核）
    """,
    openapi_tags=[
        {"name": "设备管理", "description": "设备和设备分组的增删改查"},
        {"name": "能源管理", "description": "能耗数据、产量数据、基线计算、节能收益计算"},
        {"name": "数据导出", "description": "各类报告和数据导出"},
    ]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    init_db()


@app.get("/", tags=["系统"])
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health", tags=["系统"])
def health_check():
    return {"status": "healthy"}


app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
