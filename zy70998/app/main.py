from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db, DATA_DIR
from app.routers import import_api, reconcile_api, review_api, report_api

app = FastAPI(
    title="工会福利领取核销对账服务",
    description="将导入、自动比对、人工复核、重新计算和报告下载串起来的后端对账服务。\n"
                "支持离职拦截、重复领取、代领留痕等异常检测；\n"
                "复核改动后详情、汇总和导出报告中的数字自动同步；\n"
                "可从单条明细一路追溯到最终报告，生成可解释的差异说明。",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(import_api.router)
app.include_router(reconcile_api.router)
app.include_router(review_api.router)
app.include_router(report_api.router)


@app.on_event("startup")
async def on_startup():
    init_db()


@app.get("/", tags=["根"])
async def root():
    return {
        "service": "工会福利领取核销对账服务",
        "version": "1.0.0",
        "data_dir": str(DATA_DIR),
        "endpoints": {
            "import": "/api/import",
            "reconcile": "/api/reconcile",
            "review": "/api/review",
            "report": "/api/report",
            "docs": "/docs",
        },
    }


@app.get("/health", tags=["根"])
async def health():
    return {"status": "ok"}
