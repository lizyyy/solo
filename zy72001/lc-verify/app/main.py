from fastapi import FastAPI
from app.database import init_db
from app.routers import records, verify, report

app = FastAPI(
    title="跨境信用证单证核验",
    description="批次核验 · 凭证追溯 · 冲突摆出 · 人工确认 · 报告导出",
    version="1.0.0",
)


@app.on_event("startup")
def startup():
    init_db()


app.include_router(records.router, prefix="/api")
app.include_router(verify.router, prefix="/api")
app.include_router(report.router, prefix="/api")


@app.get("/")
def root():
    return {
        "service": "跨境信用证单证核验",
        "docs": "/docs",
        "endpoints": {
            "导入批次": "POST /api/records/import",
            "查询记录": "GET /api/records/list?batch_id=xxx",
            "记录详情": "GET /api/records/{record_id}",
            "人工确认": "POST /api/verify/confirm",
            "核验报告": "GET /api/report/batch/{batch_id}",
            "差异报告": "GET /api/report/diff/{batch_id}",
        },
    }
