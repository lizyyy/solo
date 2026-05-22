import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
import tempfile
import os

from models import (
    ReconciliationResult, TransferReconciliation,
    ReviewAction, VerificationStatus
)
from importer import FileImporter
from reconciler import ReconciliationEngine
from reviewer import ReviewerService
from reporter import ReportGenerator

app = FastAPI(title="网点尾箱对账服务", version="1.0.0")

importer = FileImporter()
reconciler = ReconciliationEngine()
reviewer = ReviewerService()
reporter = ReportGenerator()

reconciliation_results: dict = {}


@app.post("/api/import/sample", summary="生成示例数据")
async def import_sample():
    sample_files = FileImporter.create_sample_files()
    return {
        "message": "示例数据已生成",
        "files": sample_files
    }


@app.post("/api/reconcile", summary="执行对账", response_model=ReconciliationResult)
async def reconcile(
    transfers_file: UploadFile = File(..., description="交接记录文件(JSON/CSV)"),
    schedules_file: UploadFile = File(..., description="柜员排班文件(JSON/CSV)"),
    errors_file: UploadFile = File(..., description="差错记录文件(JSON/CSV)"),
    batch_date: Optional[str] = None
):
    with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as tf:
        tf.write(await transfers_file.read())
        tf_path = tf.name
    try:
        transfers = importer.import_transfers(tf_path)
    finally:
        os.unlink(tf_path)
    with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as tf:
        tf.write(await schedules_file.read())
        sf_path = tf.name
    try:
        schedules = importer.import_schedules(sf_path)
    finally:
        os.unlink(sf_path)
    with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as tf:
        tf.write(await errors_file.read())
        ef_path = tf.name
    try:
        errors = importer.import_errors(ef_path)
    finally:
        os.unlink(ef_path)
    reconciled_records = reconciler.reconcile(transfers, schedules, errors)
    summary = reviewer.generate_summary(reconciled_records)
    reconciliation_id = str(uuid.uuid4())
    result = ReconciliationResult(
        reconciliation_id=reconciliation_id,
        batch_date=batch_date or datetime.now().strftime("%Y-%m-%d"),
        created_at=datetime.now(),
        summary=summary,
        records=reconciled_records,
        import_sources={
            "transfers_file": transfers_file.filename,
            "schedules_file": schedules_file.filename,
            "errors_file": errors_file.filename
        }
    )
    reconciliation_results[reconciliation_id] = result
    return result


@app.get("/api/reconciliation/{reconciliation_id}", summary="获取对账结果")
async def get_reconciliation(reconciliation_id: str):
    if reconciliation_id not in reconciliation_results:
        raise HTTPException(status_code=404, detail="对账记录不存在")
    return reconciliation_results[reconciliation_id]


@app.get("/api/reconciliation/{reconciliation_id}/record/{transfer_id}", summary="获取单条记录说明")
async def get_record_explanation(reconciliation_id: str, transfer_id: str):
    if reconciliation_id not in reconciliation_results:
        raise HTTPException(status_code=404, detail="对账记录不存在")
    result = reconciliation_results[reconciliation_id]
    record = next((r for r in result.records if r.transfer_id == transfer_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="交接记录不存在")
    explanation = reviewer.get_record_explanation(record)
    return {
        "transfer_id": transfer_id,
        "explanation": explanation,
        "record": record
    }


@app.post("/api/reconciliation/{reconciliation_id}/record/{transfer_id}/review", summary="复核单条记录")
async def review_record(
    reconciliation_id: str,
    transfer_id: str,
    action: ReviewAction,
    reviewer_id: str,
    reviewer_name: str,
    notes: Optional[str] = None,
    adjusted_cash: Optional[float] = None,
    adjusted_check: Optional[float] = None
):
    if reconciliation_id not in reconciliation_results:
        raise HTTPException(status_code=404, detail="对账记录不存在")
    result = reconciliation_results[reconciliation_id]
    record_idx = next((i for i, r in enumerate(result.records) if r.transfer_id == transfer_id), None)
    if record_idx is None:
        raise HTTPException(status_code=404, detail="交接记录不存在")
    reviewed_record = reviewer.review_record(
        result.records[record_idx],
        action,
        reviewer_id,
        reviewer_name,
        notes,
        adjusted_cash,
        adjusted_check
    )
    result.records[record_idx] = reviewed_record
    result.summary = reviewer.generate_summary(result.records)
    return {
        "message": "复核完成",
        "record": reviewed_record
    }


@app.post("/api/reconciliation/{reconciliation_id}/record/{transfer_id}/recalculate", summary="重新计算金额")
async def recalculate_record(
    reconciliation_id: str,
    transfer_id: str,
    new_cash: Optional[float] = None,
    new_check: Optional[float] = None,
    notes: Optional[str] = None
):
    if reconciliation_id not in reconciliation_results:
        raise HTTPException(status_code=404, detail="对账记录不存在")
    result = reconciliation_results[reconciliation_id]
    record_idx = next((i for i, r in enumerate(result.records) if r.transfer_id == transfer_id), None)
    if record_idx is None:
        raise HTTPException(status_code=404, detail="交接记录不存在")
    recalculated = reconciler.recalculate_record(
        result.records[record_idx],
        new_cash,
        new_check,
        notes
    )
    result.records[record_idx] = recalculated
    result.summary = reviewer.generate_summary(result.records)
    return {
        "message": "重新计算完成",
        "record": recalculated
    }


@app.post("/api/reconciliation/{reconciliation_id}/record/{transfer_id}/notes", summary="添加备注")
async def add_note(
    reconciliation_id: str,
    transfer_id: str,
    note: str,
    author: Optional[str] = None
):
    if reconciliation_id not in reconciliation_results:
        raise HTTPException(status_code=404, detail="对账记录不存在")
    result = reconciliation_results[reconciliation_id]
    record = next((r for r in result.records if r.transfer_id == transfer_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="交接记录不存在")
    reviewer.add_note(record, note, author)
    return {
        "message": "备注已添加",
        "notes": record.review_notes
    }


@app.get("/api/reconciliation/{reconciliation_id}/report/text", summary="生成文字说明报告")
async def get_text_report(reconciliation_id: str):
    if reconciliation_id not in reconciliation_results:
        raise HTTPException(status_code=404, detail="对账记录不存在")
    result = reconciliation_results[reconciliation_id]
    report = reporter.generate_explanation_report(result)
    return {"report": report}


@app.get("/api/reconciliation/{reconciliation_id}/report/csv", summary="导出CSV报告")
async def get_csv_report(reconciliation_id: str):
    if reconciliation_id not in reconciliation_results:
        raise HTTPException(status_code=404, detail="对账记录不存在")
    result = reconciliation_results[reconciliation_id]
    output_path = f"/tmp/reconciliation_{reconciliation_id}.csv"
    reporter.export_csv(result, output_path)
    return FileResponse(
        output_path,
        media_type="text/csv",
        filename=f"对账报告_{result.batch_date}.csv"
    )


@app.get("/api/reconciliation/{reconciliation_id}/report/json", summary="导出JSON报告")
async def get_json_report(reconciliation_id: str):
    if reconciliation_id not in reconciliation_results:
        raise HTTPException(status_code=404, detail="对账记录不存在")
    result = reconciliation_results[reconciliation_id]
    output_path = f"/tmp/reconciliation_{reconciliation_id}.json"
    reporter.export_json(result, output_path)
    return FileResponse(
        output_path,
        media_type="application/json",
        filename=f"对账报告_{result.batch_date}.json"
    )


@app.get("/api/discrepancy-types", summary="获取差异类型说明")
async def get_discrepancy_types():
    from models import DiscrepancyType
    return {
        "amount_mismatch": {
            "name": "金额不平",
            "description": "现金+支票与总金额不符，需核对原始凭证",
            "severity": "high"
        },
        "missing_double_sign": {
            "name": "缺少双签",
            "description": "交接缺少双人签核，违反内控要求",
            "severity": "high"
        },
        "cross_day_transfer": {
            "name": "跨日交接",
            "description": "交接时间不在正常营业时间",
            "severity": "medium"
        },
        "missing_teller": {
            "name": "柜员缺失",
            "description": "参与交接的柜员当日无排班记录或不在岗",
            "severity": "medium"
        },
        "duplicate_record": {
            "name": "交接频繁",
            "description": "同一尾箱当日交接次数过多",
            "severity": "medium"
        },
        "error_mismatch": {
            "name": "差错未闭环",
            "description": "该交接记录关联的差错尚未处理",
            "severity": "high"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
