from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from ..services.expense_accrual_service import ExpenseAccrualService
from ..models.evidence import ProcessingStatus

router = APIRouter(prefix="/api/v1/expense-accrual", tags=["资管计划费用预提"])

_service: Optional[ExpenseAccrualService] = None


def get_service() -> ExpenseAccrualService:
    global _service
    if _service is None:
        _service = ExpenseAccrualService()
    return _service


class ScreenshotRow(BaseModel):
    original_line_number: int
    ex_rights_date: str
    business_no: str
    amount: float
    line_type: str
    raw_text: str = ""


class ImportScreenshotRequest(BaseModel):
    rows: List[ScreenshotRow]
    operator: str = "system"


class TaxNoteRow(BaseModel):
    business_no: str
    tax_rate: float
    note_text: str = ""
    stated_by: str = ""
    stated_date: str = ""


class ReviewTaxNoteRequest(BaseModel):
    notes: List[TaxNoteRow]
    operator: str = "system"


class ManualChangeRequest(BaseModel):
    record_id: str
    field_name: str
    new_value: Any
    reason: str
    operator: str


class WithdrawTaxNoteRequest(BaseModel):
    business_no: str
    reason: str
    operator: str = "system"


class RollbackRequest(BaseModel):
    target_version: int
    operator: str = "system"


@router.post("/screenshot/import")
def import_screenshot(req: ImportScreenshotRequest):
    svc = get_service()
    rows = [r.model_dump() for r in req.rows]
    records = svc.import_screenshot_evidence(rows, operator=req.operator)
    return {
        "imported_count": len(records),
        "records": [r.to_dict() for r in records],
    }


@router.post("/tax-note/review")
def review_tax_note(req: ReviewTaxNoteRequest):
    svc = get_service()
    notes = [n.model_dump() for n in req.notes]
    records = svc.review_tax_note_evidence(notes, operator=req.operator)
    return {
        "reviewed_count": len(records),
        "records": [r.to_dict() for r in records],
    }


@router.post("/diff-list/update")
def update_diff_list(req: ReviewTaxNoteRequest = None, operator: str = "system"):
    svc = get_service()
    version = svc.update_diff_list(operator=operator)
    return version.to_dict()


@router.post("/diff-list/rollback")
def rollback_diff_list(req: RollbackRequest):
    svc = get_service()
    result = svc.rollback_diff_list(req.target_version, operator=req.operator)
    if result is None:
        raise HTTPException(status_code=404, detail=f"版本 {req.target_version} 不存在或无法回滚")
    return result.to_dict()


@router.post("/tax-note/withdraw")
def withdraw_tax_note(req: WithdrawTaxNoteRequest):
    svc = get_service()
    result = svc.withdraw_tax_note(
        req.business_no, reason=req.reason, operator=req.operator
    )
    if result is None:
        raise HTTPException(status_code=404, detail=f"业务号 {req.business_no} 无匹配记录")
    return result.to_dict()


@router.post("/manual-change")
def apply_manual_change(req: ManualChangeRequest):
    svc = get_service()
    record = svc.apply_manual_change(
        req.record_id, req.field_name, req.new_value, req.reason, req.operator
    )
    if record is None:
        raise HTTPException(status_code=404, detail=f"记录 {req.record_id} 不存在")
    return record.to_dict()


@router.get("/records")
def get_all_records():
    svc = get_service()
    records = svc.get_all_records()
    return {"records": [r.to_dict() for r in records]}


@router.get("/records/{business_no}")
def get_records_by_business_no(business_no: str):
    svc = get_service()
    records = svc.get_records_by_business_no(business_no)
    return {"records": [r.to_dict() for r in records]}


@router.get("/accrual-result")
def get_accrual_result():
    svc = get_service()
    result = svc.get_accrual_result()
    return result.to_dict()


@router.get("/diff-list")
def get_diff_list():
    svc = get_service()
    return svc.get_diff_list().to_dict()


@router.get("/diff-list/version/{version}")
def get_diff_list_version(version: int):
    svc = get_service()
    v = svc.get_diff_list_version(version)
    if v is None:
        raise HTTPException(status_code=404, detail=f"版本 {version} 不存在")
    return v.to_dict()


@router.get("/export/details.csv", response_class=None)
def export_details_csv():
    svc = get_service()
    csv_content = svc.export_details_csv()
    from fastapi.responses import Response
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=expense_accrual_details.csv"},
    )


@router.get("/export/accrual.csv", response_class=None)
def export_accrual_csv():
    svc = get_service()
    csv_content = svc.export_accrual_csv()
    from fastapi.responses import Response
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=expense_accrual.csv"},
    )
