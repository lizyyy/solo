from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import traceback

from app.database import engine, Base
from app.routers import members, duplicates, merges, reports

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="门店会员并卡 API",
    description="线下门店会员重复注册后合并手机号、积分、储值和消费历史的完整解决方案",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "code": "INTERNAL_ERROR",
            "message": str(exc),
            "data": {"traceback": traceback.format_exc()} if app.debug else None
        }
    )

app.include_router(members.router)
app.include_router(duplicates.router)
app.include_router(merges.router)
app.include_router(reports.router)

@app.get("/", tags=["健康检查"])
def root():
    return {
        "name": "门店会员并卡 API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "endpoints": {
            "会员管理": "/api/members",
            "重复识别": "/api/duplicates",
            "并卡管理": "/api/merges",
            "报告管理": "/api/reports"
        }
    }

@app.get("/health", tags=["健康检查"])
def health_check():
    return {"status": "healthy", "timestamp": __import__("datetime").datetime.utcnow().isoformat()}
