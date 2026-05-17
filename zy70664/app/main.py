from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import engine, Base
from app.api.base import router as base_router
from app.api.orders import router as orders_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="部门订餐取消冲抵忌口统计系统",
    description="公司食堂订餐管理系统，支持多部门订餐导入、取消冲抵、忌口统计、异常处理和备餐报告导出",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(base_router, prefix="/api/v1")
app.include_router(orders_router, prefix="/api/v1")


@app.get("/", summary="健康检查")
def health_check():
    return {"status": "ok", "message": "部门订餐取消冲抵忌口统计系统运行中"}


@app.get("/health", summary="健康检查")
def health():
    return {"status": "healthy"}
