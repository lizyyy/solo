from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.api import auth, consumables, workflow, audit, export, dashboard

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="学校实验室耗材权限追责台账 API",
    description="领用单、采购到货表、老师补签记录、盘点差异全流程管理系统",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.API_V1_STR, tags=["认证"])
app.include_router(consumables.router, prefix=settings.API_V1_STR, tags=["耗材管理"])
app.include_router(workflow.router, prefix=settings.API_V1_STR, tags=["工作流"])
app.include_router(audit.router, prefix=settings.API_V1_STR, tags=["审计日志"])
app.include_router(export.router, prefix=settings.API_V1_STR, tags=["数据导出"])
app.include_router(dashboard.router, prefix=settings.API_V1_STR, tags=["学院秘书视图"])


@app.get("/")
def root():
    return {"message": "学校实验室耗材权限追责台账服务", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "lab-consumables-tracker"}
