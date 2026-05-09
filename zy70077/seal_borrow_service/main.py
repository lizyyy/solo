from fastapi import FastAPI
from apscheduler.schedulers.background import BackgroundScheduler
from contextlib import asynccontextmanager
from .config import settings
from .database import init_db, SessionLocal
from .routers import seal_routes, application_routes, report_routes
from .services.timeout_service import TimeoutService
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone="Asia/Shanghai")


def run_timeout_check_job():
    """定时执行超时检测任务"""
    logger.info("开始执行超时检测定时任务...")
    try:
        db = SessionLocal()
        try:
            result = TimeoutService.check_timeout_applications(db)
            logger.info(f"超时检测任务完成：{result['message']}")
        except Exception as e:
            logger.error(f"超时检测任务执行失败：{str(e)}")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"数据库连接失败：{str(e)}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    init_db()
    logger.info(f"{settings.PROJECT_NAME} 数据库初始化完成")
    
    scheduler.add_job(
        run_timeout_check_job,
        'interval',
        hours=1,
        id='timeout_check_hourly',
        replace_existing=True,
        misfire_grace_time=300
    )
    scheduler.add_job(
        run_timeout_check_job,
        'cron',
        hour=8,
        minute=0,
        id='timeout_check_morning',
        replace_existing=True,
        misfire_grace_time=300
    )
    
    scheduler.start()
    logger.info("后台任务调度器已启动，超时检测将每小时执行一次")
    
    yield
    
    scheduler.shutdown()
    logger.info("后台任务调度器已停止")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    description="""
    印章外借审批服务 - 专门针对合同章外借场景设计
    
    核心能力：
    1. 印章申请、外借、归还全流程管理
    2. 使用材料上传与核验
    3. 4级超时升级告警机制
    4. 归还核验与最终结果判定
    5. 状态变更历史追踪（支持人工修正）
    6. 统计报告与数据一致性校验
    
    最终结果判定规则：
    - 正常完成：材料完整且无严重超时
    - 材料不全：缺少使用材料或核验未通过
    - 严重超时：三级及以上超时
    - 归还异常：印章损坏
    - 丢失：印章丢失
    """
)

app.include_router(seal_routes.router, prefix=settings.API_PREFIX)
app.include_router(application_routes.router, prefix=settings.API_PREFIX)
app.include_router(report_routes.router, prefix=settings.API_PREFIX)


@app.get("/", tags=["健康检查"])
def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "running",
        "api_docs": "/docs"
    }


@app.get("/health", tags=["健康检查"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "timestamp": __import__('datetime').datetime.now().isoformat()
    }
