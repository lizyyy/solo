from __future__ import annotations

from fastapi import FastAPI

from auto_chain_reconcile.db import engine, Base
from auto_chain_reconcile.routers import reconcile, trace

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="汽修连锁核销一致性 API",
    description=(
        "上传套餐 CSV、工单 JSON、配件库存，按规则区分 normal/pending/failed，"
        "保留原始字段与建议处理方式；同一批次幂等；可追溯配件批次来源。"
    ),
    version="0.1.0",
)

app.include_router(reconcile.router, prefix="/api/v1/reconcile", tags=["reconcile"])
app.include_router(trace.router, prefix="/api/v1/trace", tags=["trace"])


@app.get("/", tags=["meta"])
def root() -> dict:
    return {"service": "auto_chain_reconcile", "version": "0.1.0"}
