"""FastAPI 入口 + 路由装配。"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import batches, health, imports as import_routes, reviews, reports


app = FastAPI(
    title="区域财务对账服务",
    version="0.1.0",
    description="导入、自动比对、人工复核、重新计算与报告导出的一体化对账服务",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/health", tags=["健康检查"])
app.include_router(batches.router, prefix="/api/batches", tags=["批次"])
app.include_router(import_routes.router, prefix="/api/imports", tags=["导入"])
app.include_router(reviews.router, prefix="/api/reviews", tags=["复核"])
app.include_router(reports.router, prefix="/api/reports", tags=["报告"])


def run(host: str = "0.0.0.0", port: int = 8000) -> None:
    import uvicorn
    uvicorn.run("recon_service.main:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    run()
