from __future__ import annotations
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from .storage import Storage
from .processor import RecordProcessor
from .validator import Validator
from .workflow import WorkflowManager
from .models import (
    TranslationRecord,
    EvidenceSummary,
    ValidationIssue,
    ExportRecord,
    RecordStatus,
)


app = FastAPI(
    title="多语言客服翻译回看 API",
    description="线上反馈工单与脱敏规则备注的统一管理平台",
    version="0.1.0",
)

_storage = None
_processor = None
_validator = None
_workflow = None


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        _storage = Storage()
    return _storage


def get_processor() -> RecordProcessor:
    global _processor
    if _processor is None:
        _processor = RecordProcessor(get_storage())
    return _processor


def get_validator() -> Validator:
    global _validator
    if _validator is None:
        _validator = Validator(get_storage())
    return _validator


def get_workflow() -> WorkflowManager:
    global _workflow
    if _workflow is None:
        _workflow = WorkflowManager(get_storage())
    return _workflow


class ImportRequest(BaseModel):
    ticket: Dict[str, Any]
    sample_no: str
    model_version: str
    model_translation: str
    import_batch_no: str = ""
    operator: str = "api"


class BatchImportRequest(BaseModel):
    records: List[ImportRequest]
    import_batch_no: str = ""
    operator: str = "api"


class DesensitizationRequest(BaseModel):
    rule_name: str
    rule_description: str
    reviewer: str
    is_desensitized: bool
    remark: str = ""


class TranslationUpdateRequest(BaseModel):
    new_translation: str
    operator: str
    reason: str


class OperatorReviewRequest(BaseModel):
    operator: str
    approve: bool
    remark: str = ""


@app.get("/")
def root():
    return {"service": "translation-review", "version": "0.1.0"}


@app.post("/records/import", response_model=Dict[str, Any])
def import_record(req: ImportRequest):
    processor = get_processor()
    record = processor.import_ticket(
        ticket_data=req.ticket,
        sample_no=req.sample_no,
        model_version=req.model_version,
        model_translation=req.model_translation,
        import_batch_no=req.import_batch_no,
        operator=req.operator,
    )
    evidence = get_workflow().get_evidence_summary(record.record_id)
    return {
        "record": record.model_dump(),
        "evidence_summary": evidence.model_dump(),
    }


@app.post("/records/batch-import", response_model=Dict[str, Any])
def batch_import(req: BatchImportRequest):
    processor = get_processor()
    records_data = [
        {
            "ticket": r.ticket,
            "sample_no": r.sample_no,
            "model_version": r.model_version,
            "model_translation": r.model_translation,
        }
        for r in req.records
    ]
    records = processor.batch_import(
        records_data,
        import_batch_no=req.import_batch_no,
        operator=req.operator,
    )
    return {
        "import_batch_no": records[0].import_batch_no if records else "",
        "count": len(records),
        "records": [r.model_dump() for r in records],
    }


@app.get("/records", response_model=List[Dict[str, Any]])
def list_records(
    status: Optional[RecordStatus] = None,
    sample_no: Optional[str] = None,
    include_evidence: bool = Query(False, description="是否包含证据摘要"),
):
    storage = get_storage()
    records = storage.list_records()

    if status:
        records = [r for r in records if r.status == status]
    if sample_no:
        records = [r for r in records if r.sample_no == sample_no]

    result = []
    workflow = get_workflow()
    for record in records:
        item = {"record": record.model_dump()}
        if include_evidence:
            item["evidence_summary"] = workflow.get_evidence_summary(record.record_id).model_dump()
        result.append(item)
    return result


@app.get("/records/{record_id}", response_model=Dict[str, Any])
def get_record(record_id: str, include_evidence: bool = Query(True)):
    storage = get_storage()
    record = storage.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    result = {"record": record.model_dump()}
    if include_evidence:
        workflow = get_workflow()
        result["evidence_summary"] = workflow.get_evidence_summary(record_id).model_dump()
        result["workflow_progress"] = workflow.get_workflow_progress(record_id)
        result["workflow_logs"] = [log.model_dump() for log in storage.list_workflow_logs(record_id=record_id)]
    return result


@app.get("/records/{record_id}/evidence", response_model=EvidenceSummary)
def get_evidence(record_id: str):
    try:
        return get_workflow().get_evidence_summary(record_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/records/{record_id}/desensitization", response_model=Dict[str, Any])
def add_desensitization(record_id: str, req: DesensitizationRequest):
    processor = get_processor()
    try:
        record = processor.add_desensitization_note(
            record_id,
            rule_name=req.rule_name,
            rule_description=req.rule_description,
            reviewer=req.reviewer,
            is_desensitized=req.is_desensitized,
            remark=req.remark,
        )
        evidence = get_workflow().get_evidence_summary(record_id)
        return {
            "record": record.model_dump(),
            "evidence_summary": evidence.model_dump(),
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/records/{record_id}/translation", response_model=Dict[str, Any])
def update_translation(record_id: str, req: TranslationUpdateRequest):
    processor = get_processor()
    try:
        record = processor.update_translation(
            record_id,
            new_translation=req.new_translation,
            operator=req.operator,
            reason=req.reason,
        )
        evidence = get_workflow().get_evidence_summary(record_id)
        return {
            "record": record.model_dump(),
            "evidence_summary": evidence.model_dump(),
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/records/{record_id}/recalculate", response_model=Dict[str, Any])
def recalculate(record_id: str, new_model_translation: Optional[str] = None, operator: str = "api"):
    processor = get_processor()
    try:
        record = processor.recalculate(record_id, new_model_translation, operator)
        evidence = get_workflow().get_evidence_summary(record_id)
        return {
            "record": record.model_dump(),
            "evidence_summary": evidence.model_dump(),
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/workflow/{record_id}/advance/desensitization", response_model=Dict[str, Any])
def advance_desensitization(record_id: str, operator: str = "api", remark: str = ""):
    wf = get_workflow()
    try:
        record = wf.advance_to_desensitization(record_id, operator, remark)
        return {
            "record": record.model_dump(),
            "workflow_progress": wf.get_workflow_progress(record_id),
            "evidence_summary": wf.get_evidence_summary(record_id).model_dump(),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/workflow/{record_id}/advance/product", response_model=Dict[str, Any])
def advance_product(record_id: str, operator: str = "api", remark: str = ""):
    wf = get_workflow()
    try:
        record = wf.advance_to_product_review(record_id, operator, remark)
        return {
            "record": record.model_dump(),
            "workflow_progress": wf.get_workflow_progress(record_id),
            "evidence_summary": wf.get_evidence_summary(record_id).model_dump(),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/workflow/{record_id}/operator-review", response_model=Dict[str, Any])
def operator_review(record_id: str, req: OperatorReviewRequest):
    wf = get_workflow()
    try:
        record = wf.operator_review(record_id, req.operator, req.approve, req.remark)
        return {
            "record": record.model_dump(),
            "workflow_progress": wf.get_workflow_progress(record_id),
            "evidence_summary": wf.get_evidence_summary(record_id).model_dump(),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/workflow/{record_id}/complete", response_model=Dict[str, Any])
def complete(record_id: str, operator: str = "api", remark: str = ""):
    wf = get_workflow()
    try:
        record = wf.complete_workflow(record_id, operator, remark)
        return {
            "record": record.model_dump(),
            "workflow_progress": wf.get_workflow_progress(record_id),
            "evidence_summary": wf.get_evidence_summary(record_id).model_dump(),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/workflow/needs-review", response_model=List[Dict[str, Any]])
def list_needs_review():
    wf = get_workflow()
    records = wf.list_records_needing_review()
    return [
        {
            "record": r.model_dump(),
            "evidence_summary": wf.get_evidence_summary(r.record_id).model_dump(),
        }
        for r in records
    ]


@app.get("/validation/check", response_model=Dict[str, Any])
def run_validation():
    validator = get_validator()
    results = validator.run_all_checks()
    summary = validator.get_check_summary()
    return {
        "summary": summary,
        "results": {
            k: [i.model_dump() for i in v] for k, v in results.items()
        },
    }


@app.get("/validation/summary", response_model=Dict[str, Any])
def validation_summary():
    return get_validator().get_check_summary()


@app.get("/export", response_model=List[Dict[str, Any]])
def export_records(batch_no: Optional[str] = None):
    storage = get_storage()
    if batch_no:
        records = storage.find_by_batch_no(batch_no)
    else:
        records = storage.list_records()

    export_data = []
    for record in records:
        export_record = ExportRecord(
            record_id=record.record_id,
            sample_no=record.sample_no,
            model_version=record.model_version,
            status=record.status,
            original_line_no=record.feedback_ticket.original_line_no,
            ticket_id=record.feedback_ticket.ticket_id,
            source_language=record.feedback_ticket.source_language,
            target_language=record.feedback_ticket.target_language,
            customer_text=record.feedback_ticket.customer_text,
            original_translation=record.feedback_ticket.original_translation,
            model_translation=record.model_translation,
            final_translation=record.final_translation,
            abnormal_types=[t.value for t in record.abnormal_types],
            has_manual_changes=len(record.manual_changes) > 0,
            desensitization_reviewed=record.desensitization_note is not None,
            imported_at=record.imported_at,
            recheck_count=record.recheck_count,
        )
        evidence = get_workflow().get_evidence_summary(record.record_id)
        export_data.append({
            "export": export_record.model_dump(),
            "evidence_summary": evidence.model_dump(),
        })
    return export_data
