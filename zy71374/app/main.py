from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.database import engine, Base
from app.exceptions import AnomalyError
from app.routers import experiments, formulas, kiln, photos, search, reports, anomalies, records

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="陶瓷釉色实验库 API",
    version="0.1.0",
    description="轻量级陶艺试釉实验记录与检索服务，支持配方版本、窑温关联、照片归档、相似检索、报告导出",
)

app.include_router(experiments.router)
app.include_router(formulas.router)
app.include_router(kiln.router)
app.include_router(photos.router)
app.include_router(search.router)
app.include_router(reports.router)
app.include_router(anomalies.router)
app.include_router(records.clay_router)
app.include_router(records.note_router)
app.include_router(records.report_router)


@app.exception_handler(AnomalyError)
async def anomaly_error_handler(request: Request, exc: AnomalyError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "category": exc.category,
            "message": exc.detail.get("message", str(exc.detail)) if isinstance(exc.detail, dict) else str(exc.detail),
            "detail": exc.detail,
            "suggestion": exc.suggestion,
        },
    )


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "category": "internal",
            "message": str(exc),
            "detail": None,
            "suggestion": "请检查请求参数；如问题持续，请联系管理员并附上请求详情",
        },
    )


@app.get("/health")
def health_check():
    return {"status": "ok", "version": "0.1.0"}
