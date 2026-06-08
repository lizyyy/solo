from __future__ import annotations

import os
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .models import EvidenceSummary, ProcessingStatus
from .store import ResultStore, DEFAULT_STORE_DIR, DEFAULT_STORE_FILE
from .workflow import WorkflowEngine

STORE_PATH = os.path.join(os.getcwd(), DEFAULT_STORE_DIR, DEFAULT_STORE_FILE)

app = FastAPI(title="网联通道清分差异", version="1.0.0")


class ImportRequest(BaseModel):
    records: list[dict]
    actor: str = "system"


class HolidayNoteRequest(BaseModel):
    clearing_batch_no: str
    note: str
    effective_date: str = ""
    source: str = ""
    actor: str = "system"


class SummaryUpdateRequest(BaseModel):
    clearing_batch_no: str
    note: str = ""
    actor: str = "system"


class ConfirmRequest(BaseModel):
    record_id: str
    actor: str = "risk_control"


class RejectRequest(BaseModel):
    record_id: str
    reason: str
    actor: str = "risk_control"


class SupplementRequest(BaseModel):
    record_id: str
    new_amount: int
    note: str = ""
    actor: str = "system"


class RecordResponse(BaseModel):
    id: str
    clearing_batch_no: str
    original_line_no: int
    channel: str
    amount: int
    remark: str
    status: str
    is_zero_reversed: bool
    holiday_extension_note: str
    supplement_applied: bool
    audit_trail_summary: list[str]
    manual_edits_summary: list[str]


class EvidenceResponse(BaseModel):
    clearing_batch_no: str
    original_line_no: int
    amount: int
    remark: str
    status: str
    is_zero_reversed: bool
    holiday_extension_note: str
    audit_trail_summary: list[str]


class SelfCheckResponse(BaseModel):
    rule: str
    passed: bool
    record_id: str = ""
    clearing_batch_no: str = ""
    message: str
    severity: str = "warning"


class FullReportResponse(BaseModel):
    records: list[RecordResponse]
    check_results: list[SelfCheckResponse]
    evidence_summaries: list[EvidenceResponse]


def _store() -> ResultStore:
    return ResultStore.get_instance(STORE_PATH)


def _engine() -> WorkflowEngine:
    return WorkflowEngine(_store())


def _record_to_response(record: dict) -> RecordResponse:
    audit_summary = [
        f"[{e.get('timestamp', '')}] {e.get('action', '')}: {e.get('detail', '')}"
        for e in record.get("audit_trail", [])
    ]
    manual_summary = [
        f"[{e.get('timestamp', '')}] {e.get('action', '')} by {e.get('actor', '')}: {e.get('detail', '')}"
        for e in record.get("manual_edits", [])
    ]
    return RecordResponse(
        id=record["id"],
        clearing_batch_no=record["clearing_batch_no"],
        original_line_no=record["original_line_no"],
        channel=record.get("channel", ""),
        amount=record["amount"],
        remark=record.get("remark", ""),
        status=record["status"],
        is_zero_reversed=record.get("is_zero_reversed", False),
        holiday_extension_note=record.get("holiday_extension_note", ""),
        supplement_applied=record.get("supplement_applied", False),
        audit_trail_summary=audit_summary,
        manual_edits_summary=manual_summary,
    )


def _evidence_to_response(ev: dict) -> EvidenceResponse:
    return EvidenceResponse(
        clearing_batch_no=ev["clearing_batch_no"],
        original_line_no=ev["original_line_no"],
        amount=ev["amount"],
        remark=ev["remark"],
        status=ev["status"],
        is_zero_reversed=ev["is_zero_reversed"],
        holiday_extension_note=ev.get("holiday_extension_note", ""),
        audit_trail_summary=ev.get("audit_trail_summary", []),
    )


@app.post("/api/import", response_model=list[RecordResponse])
def import_records(req: ImportRequest):
    engine = _engine()
    records = engine.import_records(req.records, actor=req.actor)
    check_results = engine.run_self_check()
    return [_record_to_response(r.model_dump(mode="json")) for r in records]


@app.get("/api/records", response_model=list[RecordResponse])
def list_records(clearing_batch_no: Optional[str] = None):
    store = _store()
    if clearing_batch_no:
        records = store.find_by_batch_no(clearing_batch_no)
    else:
        records = store.get_records()
    return [_record_to_response(r.model_dump(mode="json")) for r in records]


@app.get("/api/records/{record_id}", response_model=RecordResponse)
def get_record(record_id: str):
    store = _store()
    record = store.get_record(record_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"记录 {record_id} 不存在")
    return _record_to_response(record.model_dump(mode="json"))


@app.get("/api/records/{record_id}/evidence", response_model=EvidenceResponse)
def get_evidence(record_id: str):
    store = _store()
    ev = store.build_evidence_summary(record_id)
    if ev is None:
        raise HTTPException(status_code=404, detail=f"记录 {record_id} 不存在")
    return _evidence_to_response(ev.model_dump(mode="json"))


@app.post("/api/self-check", response_model=list[SelfCheckResponse])
def run_self_check():
    engine = _engine()
    results = engine.run_self_check()
    return [
        SelfCheckResponse(
            rule=r["rule"],
            passed=r["passed"],
            record_id=r.get("record_id", ""),
            clearing_batch_no=r.get("clearing_batch_no", ""),
            message=r["message"],
            severity=r.get("severity", "warning"),
        )
        for r in results
    ]


@app.post("/api/holiday-note", response_model=dict)
def apply_holiday_note(req: HolidayNoteRequest):
    engine = _engine()
    info = engine.apply_holiday_note(
        req.clearing_batch_no, req.note, req.effective_date, req.source, req.actor
    )
    if info is None:
        raise HTTPException(status_code=404, detail=f"未找到清算批次号 {req.clearing_batch_no}")
    return {
        "clearing_batch_no": info.clearing_batch_no,
        "note": info.note,
        "effective_date": info.effective_date,
        "source": info.source,
        "evidence_summaries": [
            _evidence_to_response(e)
            for e in _store().export_evidence_summaries()
            if e["clearing_batch_no"] == req.clearing_batch_no
        ],
    }


@app.post("/api/summary", response_model=dict)
def update_summary(req: SummaryUpdateRequest):
    engine = _engine()
    update = engine.update_summary(req.clearing_batch_no, req.note, req.actor)
    if update is None:
        raise HTTPException(status_code=404, detail=f"未找到清算批次号 {req.clearing_batch_no}")

    store = _store()
    zero_reversed_records = [
        r for r in store.find_by_batch_no(req.clearing_batch_no) if r.is_zero_reversed
    ]

    return {
        "clearing_batch_no": update.clearing_batch_no,
        "total_diff": update.total_diff,
        "total_reversed": update.total_reversed,
        "pending_review_count": update.pending_review_count,
        "note": update.note,
        "warning": "金额为0且备注含'已冲正'的记录已留待风控复核" if zero_reversed_records else None,
        "pending_review_records": [
            {
                "record_id": r.id,
                "original_line_no": r.original_line_no,
                "remark": r.remark,
                "evidence_summary": store.build_evidence_summary(r.id).model_dump(mode="json")
                if store.build_evidence_summary(r.id) else None,
            }
            for r in zero_reversed_records
        ],
        "evidence_summaries": [
            _evidence_to_response(e)
            for e in store.export_evidence_summaries()
            if e["clearing_batch_no"] == req.clearing_batch_no
        ],
    }


@app.post("/api/confirm", response_model=RecordResponse)
def confirm_record(req: ConfirmRequest):
    engine = _engine()
    record = engine.confirm_record(req.record_id, req.actor)
    if record is None:
        raise HTTPException(status_code=404, detail=f"未找到记录 {req.record_id}")
    return _record_to_response(record.model_dump(mode="json"))


@app.post("/api/reject", response_model=RecordResponse)
def reject_record(req: RejectRequest):
    engine = _engine()
    record = engine.reject_record(req.record_id, req.reason, req.actor)
    if record is None:
        raise HTTPException(status_code=404, detail=f"未找到记录 {req.record_id}")
    return _record_to_response(record.model_dump(mode="json"))


@app.post("/api/supplement", response_model=RecordResponse)
def supplement_record(req: SupplementRequest):
    engine = _engine()
    record = engine.supplement_record(req.record_id, req.new_amount, req.note, req.actor)
    if record is None:
        raise HTTPException(status_code=404, detail=f"未找到记录 {req.record_id}")
    return _record_to_response(record.model_dump(mode="json"))


@app.get("/api/report", response_model=FullReportResponse)
def full_report(clearing_batch_no: Optional[str] = None):
    store = _store()
    if clearing_batch_no:
        records = store.find_by_batch_no(clearing_batch_no)
    else:
        records = store.get_records()

    return FullReportResponse(
        records=[_record_to_response(r.model_dump(mode="json")) for r in records],
        check_results=[
            SelfCheckResponse(
                rule=r["rule"],
                passed=r["passed"],
                record_id=r.get("record_id", ""),
                clearing_batch_no=r.get("clearing_batch_no", ""),
                message=r["message"],
                severity=r.get("severity", "warning"),
            )
            for r in store.export_check_results()
        ],
        evidence_summaries=[
            _evidence_to_response(e)
            for e in store.export_evidence_summaries()
            if clearing_batch_no is None or e["clearing_batch_no"] == clearing_batch_no
        ],
    )


@app.post("/api/reset")
def reset_store():
    ResultStore.reset()
    return {"status": "reset"}
