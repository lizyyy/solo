from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.api import router as api_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME or "任务输出归档 API",
    description="""
    任务输出归档管理系统，提供完整的任务生命周期管理：
    
    - **创建任务**: 初始化归档任务，设置归档策略和权限
    - **登记输出**: 登记任务输出文件，重复提交相同文件不会产生脏数据
    - **归档任务**: 将任务输出归档到指定位置
    - **撤销任务**: 撤销已创建/登记/归档的任务
    - **过期清理**: 自动或手动清理过期归档
    - **时间线追踪**: 每个关键动作都留下时间线，便于排查问题
    - **导出报告**: 导出完整的归档汇总报告（Excel格式）
    """,
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR, tags=["任务归档"])


@app.get("/", tags=["系统"])
def root():
    return {"message": "任务输出归档 API 服务运行中", "docs": "/docs", "api_version": settings.API_V1_STR}


@app.get("/health", tags=["系统"])
def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
