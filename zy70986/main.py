from __future__ import annotations

import io
from datetime import date
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

from package.models import (
    Package, SmsRecord, ReturnRule, DisposalRecord,
    DisposalType, ReconciliationStatus
)
from package.importer import DataImporter
from package.reconciler import Reconciler
from package.exporter import ReportExporter
from package.sample_data import SAMPLE_PACKAGES_CSV, SAMPLE_SMS_JSON, SAMPLE_RULES_JSON

app = FastAPI(title="驿站包裹对账服务")

reconciler = Reconciler(default_overdue_days=7)
_packages: List[Package] = []
_sms_records: List[SmsRecord] = []
_return_rules: List[ReturnRule] = []


class ReviewRequest(BaseModel):
    package_id: str
    new_disposal_type: DisposalType
    review_note: str
    reviewer: str = "station_master"


class ImportResponse(BaseModel):
    success: bool
    packages_count: int
    sms_count: int
    rules_count: int
    errors: List[str]


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.post("/api/import/sample", response_model=ImportResponse)
def import_sample_data():
    packages, pkg_errors = DataImporter.import_packages_csv(SAMPLE_PACKAGES_CSV)
    sms, sms_errors = DataImporter.import_sms_json(SAMPLE_SMS_JSON)
    rules, rule_errors = DataImporter.import_rules_json(SAMPLE_RULES_JSON)

    global _packages, _sms_records, _return_rules
    _packages = packages
    _sms_records = sms
    _return_rules = rules

    errors = pkg_errors + sms_errors + rule_errors
    return ImportResponse(
        success=len(errors) == 0,
        packages_count=len(packages),
        sms_count=len(sms),
        rules_count=len(rules),
        errors=errors
    )


@app.post("/api/import/packages", response_model=ImportResponse)
async def import_packages(file: UploadFile = File(...)):
    content = await file.read()
    packages, errors = DataImporter.import_packages_csv(content.decode("utf-8"))
    global _packages
    _packages = packages
    return ImportResponse(
        success=len(errors) == 0,
        packages_count=len(packages),
        sms_count=len(_sms_records),
        rules_count=len(_return_rules),
        errors=errors
    )


@app.post("/api/import/sms", response_model=ImportResponse)
async def import_sms(file: UploadFile = File(...)):
    content = await file.read()
    sms, errors = DataImporter.import_sms_json(content.decode("utf-8"))
    global _sms_records
    _sms_records = sms
    return ImportResponse(
        success=len(errors) == 0,
        packages_count=len(_packages),
        sms_count=len(sms),
        rules_count=len(_return_rules),
        errors=errors
    )


@app.post("/api/import/rules", response_model=ImportResponse)
async def import_rules(file: UploadFile = File(...)):
    content = await file.read()
    rules, errors = DataImporter.import_rules_json(content.decode("utf-8"))
    global _return_rules
    _return_rules = rules
    return ImportResponse(
        success=len(errors) == 0,
        packages_count=len(_packages),
        sms_count=len(_sms_records),
        rules_count=len(rules),
        errors=errors
    )


@app.get("/api/reconcile", response_model=List[DisposalRecord])
def reconcile(reference_date: Optional[str] = None):
    if not _packages:
        raise HTTPException(status_code=400, detail="请先导入包裹数据")
    ref_date = date.fromisoformat(reference_date) if reference_date else date(2026, 5, 27)
    disposals = reconciler.reconcile(_packages, _sms_records, _return_rules, ref_date)
    return disposals


@app.post("/api/reconcile/review")
def review_disposal(request: ReviewRequest):
    disposal = reconciler.review_disposal(
        request.package_id,
        request.new_disposal_type,
        request.review_note,
        request.reviewer
    )
    if not disposal:
        raise HTTPException(status_code=404, detail="处置记录不存在")
    return disposal


@app.post("/api/reconcile/recalculate")
def recalculate():
    if not _packages:
        raise HTTPException(status_code=400, detail="请先导入包裹数据")
    disposals = reconciler.recalculate(_packages, _sms_records, _return_rules)
    return disposals


@app.get("/api/explain/{package_id}")
def explain(package_id: str):
    explanation = reconciler.explain_disposal(package_id)
    if not explanation:
        raise HTTPException(status_code=404, detail="记录不存在")
    pkg = next((p for p in _packages if p.package_id == package_id), None)
    if pkg:
        explanation["pickup_code"] = pkg.pickup_code
        explanation["tracking_no"] = pkg.tracking_no
        explanation["arrival_date"] = pkg.arrival_date.isoformat()
    logs = reconciler.get_audit_logs(package_id)
    explanation["audit_logs"] = [l.model_dump() for l in logs]
    return explanation


@app.get("/api/report/summary")
def get_summary():
    if not _packages or not reconciler.disposals:
        raise HTTPException(status_code=400, detail="请先执行对账")
    summary = ReportExporter.build_summary(_packages, list(reconciler.disposals.values()))
    return summary


@app.get("/api/report/details.csv")
def export_details_csv():
    if not _packages or not reconciler.disposals:
        raise HTTPException(status_code=400, detail="请先执行对账")
    csv_content = ReportExporter.export_details_csv(_packages, list(reconciler.disposals.values()))
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=reconciliation_details.csv"}
    )


@app.get("/api/report/full.xlsx")
def export_full_excel():
    if not _packages or not reconciler.disposals:
        raise HTTPException(status_code=400, detail="请先执行对账")
    summary = ReportExporter.build_summary(_packages, list(reconciler.disposals.values()))
    excel_bytes = ReportExporter.export_excel(
        _packages, list(reconciler.disposals.values()), summary, reconciler.audit_logs
    )
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=reconciliation_full.xlsx"}
    )


@app.get("/api/audit/{package_id}")
def get_audit_logs(package_id: str):
    logs = reconciler.get_audit_logs(package_id)
    return {"package_id": package_id, "logs": logs}


@app.get("/api/data/packages")
def list_packages():
    return _packages


@app.get("/api/data/sms")
def list_sms():
    return _sms_records


@app.get("/api/data/rules")
def list_rules():
    return _return_rules


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
