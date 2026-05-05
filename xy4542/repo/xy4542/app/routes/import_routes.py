from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.config import get_db
from app.services.import_service import ImportService

router = APIRouter(prefix="/import", tags=["导入接口"])


@router.post("/teller-payment", summary="导入柜员缴款CSV")
async def import_teller_payment(
    file: UploadFile = File(..., description="柜员缴款CSV文件"),
    business_date: str = Form(..., description="营业日期, 格式: YYYY-MM-DD"),
    operator: Optional[str] = Form("system", description="操作人"),
    db: Session = Depends(get_db)
):
    content = await file.read()
    text_content = content.decode("utf-8-sig")
    
    try:
        data = ImportService.parse_teller_payment_csv(
            text_content, file.filename, business_date
        )
        count = ImportService.import_teller_payments(db, data, business_date, operator)
        
        return {
            "success": True,
            "message": f"成功导入 {count} 条柜员缴款记录",
            "count": count,
            "filename": file.filename
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sorting-log", summary="导入清分机冠字号日志CSV")
async def import_sorting_log(
    file: UploadFile = File(..., description="清分机日志CSV文件"),
    business_date: str = Form(..., description="营业日期, 格式: YYYY-MM-DD"),
    operator: Optional[str] = Form("system", description="操作人"),
    db: Session = Depends(get_db)
):
    content = await file.read()
    text_content = content.decode("utf-8-sig")
    
    try:
        data = ImportService.parse_sorting_log_csv(
            text_content, file.filename, business_date
        )
        count = ImportService.import_sorting_logs(db, data, business_date, operator)
        
        return {
            "success": True,
            "message": f"成功导入 {count} 条清分机日志记录",
            "count": count,
            "filename": file.filename
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/bundle-tag", summary="导入扎把标签JSON")
async def import_bundle_tag(
    file: UploadFile = File(..., description="扎把标签JSON文件"),
    business_date: str = Form(..., description="营业日期, 格式: YYYY-MM-DD"),
    operator: Optional[str] = Form("system", description="操作人"),
    db: Session = Depends(get_db)
):
    content = await file.read()
    text_content = content.decode("utf-8")
    
    try:
        data = ImportService.parse_bundle_tag_json(
            text_content, file.filename, business_date
        )
        count = ImportService.import_bundle_tags(db, data, business_date, operator)
        
        return {
            "success": True,
            "message": f"成功导入 {count} 条扎把标签",
            "count": count,
            "filename": file.filename
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/atm-plan", summary="导入ATM加钞计划CSV")
async def import_atm_plan(
    file: UploadFile = File(..., description="ATM加钞计划CSV文件"),
    business_date: str = Form(..., description="营业日期, 格式: YYYY-MM-DD"),
    operator: Optional[str] = Form("system", description="操作人"),
    db: Session = Depends(get_db)
):
    content = await file.read()
    text_content = content.decode("utf-8-sig")
    
    try:
        data = ImportService.parse_atm_plan_csv(
            text_content, file.filename, business_date
        )
        count = ImportService.import_atm_plans(db, data, business_date, operator)
        
        return {
            "success": True,
            "message": f"成功导入 {count} 条ATM加钞计划",
            "count": count,
            "filename": file.filename
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/error-remark", summary="导入差错备注CSV")
async def import_error_remark(
    file: UploadFile = File(..., description="差错备注CSV文件"),
    business_date: str = Form(..., description="营业日期, 格式: YYYY-MM-DD"),
    operator: Optional[str] = Form("system", description="操作人"),
    db: Session = Depends(get_db)
):
    content = await file.read()
    text_content = content.decode("utf-8-sig")
    
    try:
        data = ImportService.parse_error_remark_csv(
            text_content, file.filename, business_date
        )
        count = ImportService.import_error_remarks(db, data, business_date, operator)
        
        return {
            "success": True,
            "message": f"成功导入 {count} 条差错备注",
            "count": count,
            "filename": file.filename
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
