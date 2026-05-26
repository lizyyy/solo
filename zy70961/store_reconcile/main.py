"""
门店财务对账 API
================
处理门店现金缴存、POS 销售和备用金的每日对账。

核心功能：
- 上传或读取缴存 CSV、销售 JSON、备用金流水
- 对账结果分正常项、待确认项、失败项返回
- 失败记录保留原始字段和建议处理方式
- 同一批材料再次提交不重复生效（幂等控制）
- 支持规则：长短款、重复缴存、节假日延迟
- 备用金账户可从历史追溯来源
"""

import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware

from store_reconcile.db.database import DatabaseManager, get_db_manager
from store_reconcile.models.schemas import (
    BatchUploadRequest,
    ReconcileBatch,
    ReconcileItem,
    ReconcileRequest,
    ReconcileResult,
    ReconcileStatus,
    TraceResult,
)
from store_reconcile.services.parser import DataParser
from store_reconcile.services.reconciler import ReconcileEngine
from store_reconcile.services.tracer import PettyCashTracer


app = FastAPI(
    title="门店财务对账 API",
    description="门店现金缴存、POS 销售和备用金每日对账系统",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = get_db_manager()
reconcile_engine = ReconcileEngine()
parser = DataParser()
tracer = PettyCashTracer(db)


@app.get("/")
def root():
    return {
        "service": "门店财务对账 API",
        "version": "1.0.0",
        "endpoints": {
            "reconcile": "/api/v1/reconcile",
            "upload": "/api/v1/reconcile/upload",
            "batch": "/api/v1/batch/{batch_id}",
            "batches": "/api/v1/batches",
            "items": "/api/v1/batch/{batch_id}/items",
            "trace": "/api/v1/petty-cash/trace",
            "summary": "/api/v1/petty-cash/summary",
        },
    }


@app.post("/api/v1/reconcile", response_model=ReconcileResult)
def reconcile(request: ReconcileRequest):
    """直接提交结构化数据进行对账"""
    try:
        deposits = [d.model_dump() for d in request.deposits]
        sales = [s.model_dump() for s in request.sales]
        petty_cash = [p.model_dump() for p in request.petty_cash]

        valid, msg = parser.validate_batch_data(deposits, sales, petty_cash)
        if not valid:
            raise HTTPException(status_code=400, detail=msg)

        source_hash = db.compute_source_hash(deposits, sales, petty_cash)

        existing_batch = db.is_batch_processed(
            store_id=request.store_id,
            batch_date=request.batch_date,
            source_hash=source_hash,
        )
        if existing_batch:
            existing_items = db.get_reconcile_items(existing_batch)
            result = _build_result_from_items(existing_batch, request.batch_date, existing_items)
            result["summary"]["note"] = "该批次数据已处理，返回历史结果"
            return result

        batch_id = db.create_batch(
            store_id=request.store_id,
            batch_date=request.batch_date,
            deposit_count=len(deposits),
            sales_count=len(sales),
            petty_cash_count=len(petty_cash),
            source_hash=source_hash,
        )

        reconcile_result = reconcile_engine.reconcile(
            deposits=deposits,
            sales=sales,
            petty_cash=petty_cash,
            store_id=request.store_id,
            batch_date=request.batch_date,
        )

        db.save_deposits(batch_id, deposits)
        db.save_sales(batch_id, sales)
        db.save_petty_cash(batch_id, petty_cash)
        db.save_reconcile_items(
            batch_id,
            reconcile_result["normal_items"]
            + reconcile_result["pending_items"]
            + reconcile_result["failed_items"],
        )
        db.update_batch_status(batch_id, "completed")

        result = ReconcileResult(
            batch_id=batch_id,
            batch_date=request.batch_date,
            total_count=reconcile_result["total_count"],
            normal_count=reconcile_result["normal_count"],
            pending_count=reconcile_result["pending_count"],
            failed_count=reconcile_result["failed_count"],
            normal_items=[ReconcileItem(**item) for item in reconcile_result["normal_items"]],
            pending_items=[ReconcileItem(**item) for item in reconcile_result["pending_items"]],
            failed_items=[ReconcileItem(**item) for item in reconcile_result["failed_items"]],
            summary=reconcile_result["summary"],
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"对账处理失败: {str(e)}")


@app.post("/api/v1/reconcile/upload", response_model=ReconcileResult)
async def reconcile_upload(
    store_id: str = Form(...),
    batch_date: str = Form(...),
    deposit_file: Optional[UploadFile] = File(None),
    sales_file: Optional[UploadFile] = File(None),
    petty_cash_file: Optional[UploadFile] = File(None),
):
    """通过文件上传进行对账 - 支持 CSV 和 JSON 格式"""
    try:
        deposits: List[Dict[str, Any]] = []
        sales: List[Dict[str, Any]] = []
        petty_cash: List[Dict[str, Any]] = []

        if deposit_file:
            content = (await deposit_file.read()).decode("utf-8")
            deposits = parser.parse_deposit_csv(content, store_id)

        if sales_file:
            content = (await sales_file.read()).decode("utf-8")
            sales = parser.parse_sales_json(content, store_id)

        if petty_cash_file:
            content = (await petty_cash_file.read()).decode("utf-8")
            petty_cash = parser.parse_petty_cash_json(content, store_id)

        valid, msg = parser.validate_batch_data(deposits, sales, petty_cash)
        if not valid:
            raise HTTPException(status_code=400, detail=msg)

        source_hash = db.compute_source_hash(deposits, sales, petty_cash)

        existing_batch = db.is_batch_processed(
            store_id=store_id,
            batch_date=batch_date,
            source_hash=source_hash,
        )
        if existing_batch:
            existing_items = db.get_reconcile_items(existing_batch)
            result = _build_result_from_items(existing_batch, batch_date, existing_items)
            result["summary"]["note"] = "该批次数据已处理，返回历史结果"
            return result

        batch_id = db.create_batch(
            store_id=store_id,
            batch_date=batch_date,
            deposit_count=len(deposits),
            sales_count=len(sales),
            petty_cash_count=len(petty_cash),
            source_hash=source_hash,
        )

        reconcile_result = reconcile_engine.reconcile(
            deposits=deposits,
            sales=sales,
            petty_cash=petty_cash,
            store_id=store_id,
            batch_date=batch_date,
        )

        db.save_deposits(batch_id, deposits)
        db.save_sales(batch_id, sales)
        db.save_petty_cash(batch_id, petty_cash)
        db.save_reconcile_items(
            batch_id,
            reconcile_result["normal_items"]
            + reconcile_result["pending_items"]
            + reconcile_result["failed_items"],
        )
        db.update_batch_status(batch_id, "completed")

        result = ReconcileResult(
            batch_id=batch_id,
            batch_date=batch_date,
            total_count=reconcile_result["total_count"],
            normal_count=reconcile_result["normal_count"],
            pending_count=reconcile_result["pending_count"],
            failed_count=reconcile_result["failed_count"],
            normal_items=[ReconcileItem(**item) for item in reconcile_result["normal_items"]],
            pending_items=[ReconcileItem(**item) for item in reconcile_result["pending_items"]],
            failed_items=[ReconcileItem(**item) for item in reconcile_result["failed_items"]],
            summary=reconcile_result["summary"],
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件处理失败: {str(e)}")


@app.get("/api/v1/batch/{batch_id}", response_model=ReconcileBatch)
def get_batch(batch_id: str):
    """查询单个批次信息"""
    batch = db.get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次未找到")
    return ReconcileBatch(**batch)


@app.get("/api/v1/batches")
def list_batches(
    store_id: str = Query(..., description="门店ID"),
    start_date: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
):
    """查询门店的所有对账批次"""
    batches = db.get_batches_by_store(store_id, start_date, end_date)
    return {"batches": [ReconcileBatch(**b) for b in batches]}


@app.get("/api/v1/batch/{batch_id}/items")
def get_batch_items(
    batch_id: str,
    status: Optional[ReconcileStatus] = Query(None, description="筛选状态"),
):
    """查询批次的对账明细"""
    items = db.get_reconcile_items(batch_id, status.value if status else None)
    return {
        "batch_id": batch_id,
        "items": [ReconcileItem(**_parse_item(item)) for item in items],
    }


@app.get("/api/v1/petty-cash/trace", response_model=TraceResult)
def trace_petty_cash(
    store_id: str = Query(..., description="门店ID"),
    target_date: str = Query(..., description="追溯到日期 YYYY-MM-DD"),
):
    """追溯备用金历史 - 从历史记录追踪来源和流向"""
    result = tracer.trace_petty_cash(store_id, target_date)
    return TraceResult(**result)


@app.get("/api/v1/petty-cash/summary")
def get_petty_cash_summary(
    store_id: str = Query(..., description="门店ID"),
    start_date: Optional[str] = Query(None, description="开始日期"),
    end_date: Optional[str] = Query(None, description="结束日期"),
):
    """获取备用金汇总信息"""
    summary = tracer.get_balance_summary(store_id, start_date, end_date)
    return summary


@app.get("/api/v1/petty-cash/batch-impact")
def get_batch_impact(
    batch_id: str = Query(..., description="批次ID"),
    store_id: str = Query(..., description="门店ID"),
):
    """查询某个批次对备用金的影响"""
    impact = tracer.trace_batch_impact(batch_id, store_id)
    return impact


@app.get("/api/v1/health")
def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "rules": reconcile_engine._rules,
    }


def _build_result_from_items(
    batch_id: str, batch_date: str, items: List[Dict[str, Any]]
) -> ReconcileResult:
    normal = []
    pending = []
    failed = []

    for item in items:
        parsed = _parse_item(item)
        status = item.get("status", "failed")
        if status == "normal":
            normal.append(ReconcileItem(**parsed))
        elif status == "pending":
            pending.append(ReconcileItem(**parsed))
        else:
            failed.append(ReconcileItem(**parsed))

    return ReconcileResult(
        batch_id=batch_id,
        batch_date=batch_date,
        total_count=len(normal) + len(pending) + len(failed),
        normal_count=len(normal),
        pending_count=len(pending),
        failed_count=len(failed),
        normal_items=normal,
        pending_items=pending,
        failed_items=failed,
        summary={
            "note": "该批次数据已处理，返回历史结果",
        },
    )


def _parse_item(item: Dict[str, Any]) -> Dict[str, Any]:
    parsed = dict(item)
    for field in ["raw_record", "rule_matched"]:
        if field in parsed and isinstance(parsed[field], str):
            try:
                parsed[field] = json.loads(parsed[field])
            except (json.JSONDecodeError, TypeError):
                pass
    return parsed


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
