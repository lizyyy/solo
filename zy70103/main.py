from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
from datetime import datetime

from farm_verification.config import settings
from farm_verification.database import init_db
from farm_verification.api import (
    batches, grids, lesions, verifications, reports, rules, rollbacks
)


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"正在启动 {settings.APP_NAME} v{settings.APP_VERSION}")
    
    logger.info("初始化数据库...")
    init_db()
    logger.info("数据库初始化完成")
    
    logger.info(f"{settings.APP_NAME} 启动成功，运行在 http://localhost:8000")
    logger.info(f"API文档: http://localhost:8000/docs")
    logger.info(f"ReDoc文档: http://localhost:8000/redoc")
    
    yield
    
    logger.info(f"{settings.APP_NAME} 正在关闭")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
    农田遥感病斑核验系统 API

    ## 核心功能

    ### 影像批次管理
    - 创建、查询、更新、删除无人机影像批次
    - 查看批次统计数据

    ### 地块网格管理
    - 管理农田地块数据
    - **坐标反查**: 根据经纬度坐标查找对应地块
    - 批量匹配病斑到地块

    ### 病斑记录管理
    - 录入无人机识别的疑似病斑
    - 自动匹配地块
    - 查询病斑详情和核验历史

    ### 人工核验管理
    - 记录人工核验结果
    - 支持多轮核验
    - 查看核验统计

    ### 误报回滚管理
    - 回滚错误的核验结论
    - 恢复到上一轮核验状态
    - 查看回滚历史

    ### 病斑报告管理
    - 生成批次核验报告
    - 导出Excel格式报告
    - 包含多维度汇总和明细数据

    ### 业务规则引擎
    - 定义可复查的业务规则
    - 规则执行日志可追溯
    - 支持规则启用/停用
    """,
    lifespan=lifespan
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "code": 400,
            "message": str(exc),
            "timestamp": datetime.now().isoformat()
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"未处理的异常: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "code": 500,
            "message": "系统内部错误，请联系管理员",
            "error_detail": str(exc) if settings.DEBUG else None,
            "timestamp": datetime.now().isoformat()
        }
    )


app.include_router(batches.router)
app.include_router(grids.router)
app.include_router(lesions.router)
app.include_router(verifications.router)
app.include_router(rollbacks.router)
app.include_router(reports.router)
app.include_router(rules.router)


@app.get("/", tags=["系统信息"])
async def root():
    return {
        "success": True,
        "code": 200,
        "message": f"{settings.APP_NAME} 运行正常",
        "data": {
            "app_name": settings.APP_NAME,
            "app_version": settings.APP_VERSION,
            "debug_mode": settings.DEBUG,
            "database": settings.DATABASE_URL,
            "api_docs": "/docs",
            "redoc_docs": "/redoc"
        },
        "timestamp": datetime.now()
    }


@app.get("/health", tags=["系统信息"])
async def health_check():
    return {
        "success": True,
        "code": 200,
        "message": "健康检查通过",
        "data": {
            "status": "healthy",
            "timestamp": datetime.now().isoformat()
        },
        "timestamp": datetime.now()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
