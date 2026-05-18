from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import Response
from typing import List
from app.models.schemas import (
    MealVoucher, MealVoucherCreate, VerificationRequest,
    VerificationResult, BatchImportResult, ExportRequest,
    SubsidyLevel
)
from app.services.database import db
from app.services.verification import verification_service
from app.services.import_export import import_export_service

router = APIRouter(prefix="/api/v1")


@router.post("/vouchers", response_model=MealVoucher)
def create_voucher(voucher: MealVoucherCreate):
    return db.add_voucher(voucher)


@router.get("/vouchers/{voucher_no}", response_model=MealVoucher)
def get_voucher(voucher_no: str):
    voucher = db.get_voucher(voucher_no)
    if not voucher:
        raise HTTPException(status_code=404, detail="助餐券不存在")
    return voucher


@router.get("/vouchers", response_model=List[MealVoucher])
def list_vouchers():
    return db.get_all_vouchers()


@router.post("/vouchers/verify", response_model=dict)
def verify_voucher(request: VerificationRequest):
    try:
        result, failed_rules = verification_service.verify_voucher(
            request.voucher_no,
            request.verifier,
            request.verification_remark
        )
        return {
            "result": result.model_dump(),
            "failed_rules": failed_rules
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/vouchers/{voucher_no}/subsidy-level", response_model=MealVoucher)
def update_subsidy_level(voucher_no: str, new_level: SubsidyLevel, operator: str):
    try:
        return verification_service.update_subsidy_level(voucher_no, new_level, operator)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/vouchers/batch-import", response_model=BatchImportResult)
async def batch_import(operator: str, file: UploadFile = File(...)):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="仅支持Excel文件")
    content = await file.read()
    return import_export_service.batch_import(content, operator)


@router.post("/vouchers/export")
def export_vouchers(request: ExportRequest):
    excel_content = import_export_service.export_to_excel(request)
    return Response(
        content=excel_content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=meal_vouchers.xlsx"}
    )


@router.delete("/vouchers/{voucher_no}")
def withdraw_voucher(voucher_no: str, operator: str):
    voucher = db.get_voucher(voucher_no)
    if not voucher:
        raise HTTPException(status_code=404, detail="助餐券不存在")
    db.update_voucher(
        voucher_no,
        verification_status="已撤回",
        operator=operator
    )
    return {"message": "助餐券已撤回", "voucher_no": voucher_no}
