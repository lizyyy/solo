from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import date, datetime
import pandas as pd
from io import BytesIO
from fastapi.responses import StreamingResponse

from app.core.database import get_db
from app.schemas.schemas import (
    OrderRecord, OrderRecordCreate,
    CancellationRecord, CancellationRecordCreate,
    OrderException, OrderExceptionHandle,
    MealReport, MealReportGenerate,
    BatchImportResult, CancelOffsetResult,
    ReportSummary
)
from app.services import order_service

router = APIRouter(prefix="/orders", tags=["订餐管理"])


@router.post("/batch-import", response_model=BatchImportResult, summary="批量导入订餐记录")
def batch_import_orders(
    orders: List[OrderRecordCreate],
    source_file: Optional[str] = None,
    created_by: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return order_service.batch_import_orders(db, orders, source_file, created_by)


@router.get("", response_model=List[OrderRecord], summary="获取订餐记录列表")
def get_orders(
    meal_date: Optional[date] = None,
    department_id: Optional[int] = None,
    meal_type_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return order_service.get_order_records(db, meal_date, department_id, meal_type_id, status, skip, limit)


@router.post("/cancellation-offset", response_model=CancelOffsetResult, summary="取消记录冲抵")
def process_cancellation(
    cancellations: List[CancellationRecordCreate],
    source_file: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return order_service.process_cancellation_offset(db, cancellations, source_file)


@router.get("/cancellations", response_model=List[CancellationRecord], summary="获取取消记录列表")
def get_cancellations(
    cancel_date: Optional[date] = None,
    matched: Optional[bool] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return order_service.get_cancellation_records(db, cancel_date, matched, status, skip, limit)


@router.get("/exceptions", response_model=List[OrderException], summary="获取异常记录列表")
def get_exceptions(
    batch_id: Optional[str] = None,
    status: Optional[str] = None,
    exception_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return order_service.get_exceptions(db, batch_id, status, exception_type, skip, limit)


@router.put("/exceptions/{exception_id}/handle", response_model=OrderException, summary="处理异常记录")
def handle_exception(
    exception_id: int,
    handle_data: OrderExceptionHandle,
    db: Session = Depends(get_db)
):
    try:
        return order_service.handle_exception(db, exception_id, handle_data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{order_id}/correct", response_model=OrderRecord, summary="人工修正订餐记录")
def correct_order(
    order_id: int,
    update_data: Dict[str, Any],
    handler: str = Query(..., description="处理人"),
    db: Session = Depends(get_db)
):
    try:
        return order_service.manually_correct_order(db, order_id, update_data, handler)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{order_id}/withdraw", response_model=OrderRecord, summary="撤回订餐记录")
def withdraw_order(
    order_id: int,
    handler: str = Query(..., description="处理人"),
    reason: str = Query(..., description="撤回原因"),
    db: Session = Depends(get_db)
):
    try:
        return order_service.withdraw_order(db, order_id, handler, reason)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/generate-report", response_model=List[MealReport], summary="生成备餐报告")
def generate_report(
    report_data: MealReportGenerate,
    generated_by: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return order_service.generate_meal_report(db, report_data, generated_by)


@router.get("/reports", response_model=List[MealReport], summary="获取备餐报告列表")
def get_reports(
    report_date: Optional[date] = None,
    department_id: Optional[int] = None,
    meal_type_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return order_service.get_reports(db, report_date, department_id, meal_type_id, status, skip, limit)


@router.put("/reports/{report_id}/confirm", response_model=MealReport, summary="确认备餐报告")
def confirm_report(
    report_id: int,
    confirmed_by: str = Query(..., description="确认人"),
    db: Session = Depends(get_db)
):
    try:
        return order_service.confirm_report(db, report_id, confirmed_by)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/reports/{report_id}/close", response_model=MealReport, summary="关闭备餐报告")
def close_report(
    report_id: int,
    closed_by: str = Query(..., description="关闭人"),
    db: Session = Depends(get_db)
):
    try:
        return order_service.close_report(db, report_id, closed_by)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/diet-restriction-summary", response_model=ReportSummary, summary="获取忌口统计汇总")
def get_diet_summary(
    report_date: date,
    meal_type_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    return order_service.get_diet_restriction_summary(db, report_date, meal_type_id)


@router.get("/export-report", summary="导出备餐报告Excel")
def export_report(
    report_date: date,
    meal_type_id: Optional[int] = None,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    reports = order_service.get_reports(db, report_date, department_id, meal_type_id)

    data = []
    for report in reports:
        from app.models.models import Department, MealType
        dept = db.query(Department).filter(Department.id == report.department_id).first()
        mt = db.query(MealType).filter(MealType.id == report.meal_type_id).first()

        restrictions_text = ""
        if report.diet_restrictions:
            try:
                import json
                rests = json.loads(report.diet_restrictions)
                restrictions_text = ", ".join([f"{k}({v})" for k, v in rests.items()])
            except:
                pass

        data.append({
            "日期": str(report.report_date),
            "餐别": mt.name if mt else "",
            "部门": dept.name if dept else "",
            "订餐总数": report.total_orders,
            "已取消数": report.total_cancelled,
            "净备餐数": report.net_quantity,
            "忌口类型数量": report.restriction_count,
            "忌口详情": restrictions_text,
            "状态": report.status,
            "生成时间": str(report.generated_at) if report.generated_at else "",
            "生成人": report.generated_by or ""
        })

    df = pd.DataFrame(data)

    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='备餐报告')

    output.seek(0)

    filename = f"meal_report_{report_date.strftime('%Y%m%d')}_{datetime.now().strftime('%H%M%S')}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
