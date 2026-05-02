from datetime import datetime, date
from typing import Dict, List, Optional, Any
from io import StringIO
import csv
import json

from fastapi import APIRouter, Depends, HTTPException, Query, Path
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc

from app.core.database import get_db
from app.models import (
    Reservation, SwipeLog, SampleRegistration, Bill, Violation,
    Instrument, User, ResearchGroup, AuditLog, Review
)
from app.exports.exporter import (
    export_to_csv, export_to_json, export_to_markdown, ExportResult
)
from app.exports.reconciliation_report import (
    generate_reconciliation_report, ReconciliationReport
)
from app.schemas.base import SuccessResponse


router = APIRouter(prefix="/export", tags=["数据导出"])


def format_date(dt: Any) -> str:
    """格式化日期"""
    if dt is None:
        return ""
    if isinstance(dt, date):
        return dt.strftime("%Y-%m-%d")
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    return str(dt)


@router.get("/reservations/{format}")
async def export_reservations(
    format: str = Path(..., regex="^(csv|json|md|markdown)$"),
    status: Optional[str] = Query(None),
    instrument_code: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    """导出预约单"""
    query = db.query(Reservation)
    
    if status:
        query = query.filter(Reservation.status == status)
    if instrument_code:
        query = query.join(Instrument).filter(Instrument.instrument_code == instrument_code)
    if date_from:
        query = query.filter(Reservation.start_time >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(Reservation.start_time <= datetime.combine(date_to, datetime.max.time()))
    
    reservations = query.order_by(desc(Reservation.start_time)).all()
    
    data = [
        {
            "预约编号": r.reservation_code,
            "仪器编号": r.instrument.instrument_code if r.instrument else "",
            "仪器名称": r.instrument.name if r.instrument else "",
            "预约人": r.user.name if r.user else "",
            "课题组": r.research_group.name if r.research_group else "",
            "开始时间": format_date(r.start_time),
            "结束时间": format_date(r.end_time),
            "预约用途": r.purpose or "",
            "状态": r.status,
            "是否已审批": "是" if r.is_approved else "否",
            "是否已取消": "是" if r.is_cancelled else "否"
        }
        for r in reservations
    ]
    
    fields = [
        "预约编号", "仪器编号", "仪器名称", "预约人", "课题组",
        "开始时间", "结束时间", "预约用途", "状态",
        "是否已审批", "是否已取消"
    ]
    
    if format.lower() in ["md", "markdown"]:
        result = export_to_markdown(data, title="预约单导出", fields=fields)
        media_type = "text/markdown"
        filename = f"reservations_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    elif format.lower() == "json":
        result = export_to_json(data)
        media_type = "application/json"
        filename = f"reservations_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    else:
        result = export_to_csv(data, fields=fields)
        media_type = "text/csv"
        filename = f"reservations_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    if not result.success:
        raise HTTPException(status_code=500, detail=f"导出失败: {result.error_message}")
    
    return StreamingResponse(
        iter([result.content]),
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/swipe-logs/{format}")
async def export_swipe_logs(
    format: str = Path(..., regex="^(csv|json|md|markdown)$"),
    match_status: Optional[str] = Query(None),
    instrument_code: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    """导出刷卡日志"""
    query = db.query(SwipeLog)
    
    if match_status:
        query = query.filter(SwipeLog.match_status == match_status)
    if instrument_code:
        query = query.join(Instrument).filter(Instrument.instrument_code == instrument_code)
    if date_from:
        query = query.filter(SwipeLog.swipe_time >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(SwipeLog.swipe_time <= datetime.combine(date_to, datetime.max.time()))
    
    swipe_logs = query.order_by(desc(SwipeLog.swipe_time)).all()
    
    data = [
        {
            "刷卡编号": s.swipe_code,
            "卡号": s.card_number,
            "刷卡时间": format_date(s.swipe_time),
            "仪器编号": s.instrument.instrument_code if s.instrument else "",
            "仪器名称": s.instrument.name if s.instrument else "",
            "刷卡人": s.user.name if s.user else "",
            "预约编号": s.reservation.reservation_code if s.reservation else "",
            "刷卡类型": s.swipe_type,
            "是否已匹配": "是" if s.is_matched else "否",
            "匹配状态": s.match_status,
            "人工放行": "是" if s.is_manual_release else "否"
        }
        for s in swipe_logs
    ]
    
    fields = [
        "刷卡编号", "卡号", "刷卡时间", "仪器编号", "仪器名称",
        "刷卡人", "预约编号", "刷卡类型", "是否已匹配",
        "匹配状态", "人工放行"
    ]
    
    if format.lower() in ["md", "markdown"]:
        result = export_to_markdown(data, title="刷卡日志导出", fields=fields)
        media_type = "text/markdown"
        filename = f"swipe_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    elif format.lower() == "json":
        result = export_to_json(data)
        media_type = "application/json"
        filename = f"swipe_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    else:
        result = export_to_csv(data, fields=fields)
        media_type = "text/csv"
        filename = f"swipe_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    if not result.success:
        raise HTTPException(status_code=500, detail=f"导出失败: {result.error_message}")
    
    return StreamingResponse(
        iter([result.content]),
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/samples/{format}")
async def export_samples(
    format: str = Path(..., regex="^(csv|json|md|markdown)$"),
    status: Optional[str] = Query(None),
    is_overdue: Optional[bool] = Query(None),
    db: Session = Depends(get_db)
):
    """导出样品登记"""
    query = db.query(SampleRegistration)
    
    if status:
        query = query.filter(SampleRegistration.status == status)
    
    samples = query.order_by(desc(SampleRegistration.registered_at)).all()
    
    if is_overdue is not None:
        samples = [s for s in samples if s.is_overdue == is_overdue]
    
    data = [
        {
            "样品编号": s.sample_code,
            "样品类型": s.sample_type,
            "描述": s.description or "",
            "登记人": s.user.name if s.user else "",
            "登记时间": format_date(s.registered_at),
            "预计取回时间": format_date(s.expected_pickup_at),
            "实际取回时间": format_date(s.actual_pickup_at),
            "最大存储小时": s.max_storage_hours,
            "状态": s.status,
            "是否逾期": "是" if s.is_overdue else "否",
            "逾期小时": s.overdue_hours or 0
        }
        for s in samples
    ]
    
    fields = [
        "样品编号", "样品类型", "描述", "登记人", "登记时间",
        "预计取回时间", "实际取回时间", "最大存储小时", "状态",
        "是否逾期", "逾期小时"
    ]
    
    if format.lower() in ["md", "markdown"]:
        result = export_to_markdown(data, title="样品登记导出", fields=fields)
        media_type = "text/markdown"
        filename = f"samples_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    elif format.lower() == "json":
        result = export_to_json(data)
        media_type = "application/json"
        filename = f"samples_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    else:
        result = export_to_csv(data, fields=fields)
        media_type = "text/csv"
        filename = f"samples_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    if not result.success:
        raise HTTPException(status_code=500, detail=f"导出失败: {result.error_message}")
    
    return StreamingResponse(
        iter([result.content]),
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/violations/{format}")
async def export_violations(
    format: str = Path(..., regex="^(csv|json|md|markdown)$"),
    violation_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """导出违规记录"""
    query = db.query(Violation)
    
    if violation_type:
        query = query.filter(Violation.violation_type == violation_type)
    if status:
        query = query.filter(Violation.status == status)
    
    violations = query.order_by(desc(Violation.created_at)).all()
    
    data = [
        {
            "违规编号": v.violation_code,
            "违规类型": v.violation_type,
            "严重程度": v.severity,
            "状态": v.status,
            "违规人员": v.user.name if v.user else "",
            "涉及仪器": v.instrument.name if v.instrument else "",
            "违规时间": format_date(v.violation_time),
            "描述": v.description or "",
            "已驳回": "是" if v.is_dismissed else "否",
            "驳回原因": v.dismiss_reason or "",
            "已申诉": "是" if v.has_appeal else "否",
            "申诉原因": v.appeal_reason or ""
        }
        for v in violations
    ]
    
    fields = [
        "违规编号", "违规类型", "严重程度", "状态", "违规人员",
        "涉及仪器", "违规时间", "描述", "已驳回", "驳回原因",
        "已申诉", "申诉原因"
    ]
    
    if format.lower() in ["md", "markdown"]:
        result = export_to_markdown(data, title="违规记录导出", fields=fields)
        media_type = "text/markdown"
        filename = f"violations_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    elif format.lower() == "json":
        result = export_to_json(data)
        media_type = "application/json"
        filename = f"violations_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    else:
        result = export_to_csv(data, fields=fields)
        media_type = "text/csv"
        filename = f"violations_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    if not result.success:
        raise HTTPException(status_code=500, detail=f"导出失败: {result.error_message}")
    
    return StreamingResponse(
        iter([result.content]),
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/bills/{format}")
async def export_bills(
    format: str = Path(..., regex="^(csv|json|md|markdown)$"),
    status: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    """导出账单"""
    query = db.query(Bill)
    
    if status:
        query = query.filter(Bill.status == status)
    if date_from:
        query = query.filter(Bill.bill_date >= date_from)
    if date_to:
        query = query.filter(Bill.bill_date <= date_to)
    
    bills = query.order_by(desc(Bill.bill_date)).all()
    
    data = [
        {
            "账单编号": b.bill_code,
            "账单日期": format_date(b.bill_date),
            "用户": b.user.name if b.user else "",
            "课题组": b.research_group.name if b.research_group else "",
            "仪器": b.instrument.name if b.instrument else "",
            "基础费用": float(b.base_amount) if b.base_amount else 0,
            "加班费用": float(b.overtime_amount) if b.overtime_amount else 0,
            "夜间附加费": float(b.night_surcharge) if b.night_surcharge else 0,
            "周末附加费": float(b.weekend_surcharge) if b.weekend_surcharge else 0,
            "折扣金额": float(b.discount_amount) if b.discount_amount else 0,
            "总金额": float(b.total_amount) if b.total_amount else 0,
            "减免金额": float(b.waived_amount) if b.waived_amount else 0,
            "已付金额": float(b.paid_amount) if b.paid_amount else 0,
            "状态": b.status,
            "支付状态": b.payment_status
        }
        for b in bills
    ]
    
    fields = [
        "账单编号", "账单日期", "用户", "课题组", "仪器",
        "基础费用", "加班费用", "夜间附加费", "周末附加费",
        "折扣金额", "总金额", "减免金额", "已付金额",
        "状态", "支付状态"
    ]
    
    if format.lower() in ["md", "markdown"]:
        result = export_to_markdown(data, title="账单导出", fields=fields)
        media_type = "text/markdown"
        filename = f"bills_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    elif format.lower() == "json":
        result = export_to_json(data)
        media_type = "application/json"
        filename = f"bills_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    else:
        result = export_to_csv(data, fields=fields)
        media_type = "text/csv"
        filename = f"bills_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    if not result.success:
        raise HTTPException(status_code=500, detail=f"导出失败: {result.error_message}")
    
    return StreamingResponse(
        iter([result.content]),
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/reconciliation-report/{format}")
async def export_reconciliation_report(
    format: str = Path(..., regex="^(csv|json|md|markdown)$"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    """导出对账报告"""
    report = generate_reconciliation_report(db, date_from, date_to)
    
    if format.lower() in ["md", "markdown"]:
        content = report.to_markdown()
        media_type = "text/markdown"
        filename = f"reconciliation_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    elif format.lower() == "json":
        report_data = {
            "report_period": {
                "start_date": format_date(date_from),
                "end_date": format_date(date_to),
                "generated_at": format_date(datetime.now())
            },
            "statistics": {
                "total_reservations": report.statistics.total_reservations,
                "total_swipe_logs": report.statistics.total_swipe_logs,
                "matched_swipes": report.statistics.matched_swipes,
                "unmatched_swipes": report.statistics.unmatched_swipes,
                "total_samples": report.statistics.total_samples,
                "overdue_samples": report.statistics.overdue_samples,
                "total_violations": report.statistics.total_violations,
                "pending_review_violations": report.statistics.pending_review_violations,
                "total_bills": report.statistics.total_bills,
                "total_bill_amount": float(report.statistics.total_bill_amount),
                "paid_amount": float(report.statistics.paid_amount),
                "waived_amount": float(report.statistics.waived_amount)
            },
            "violations_by_type": report.violations_by_type,
            "violations_by_status": report.violations_by_status,
            "bills_by_status": report.bills_by_status
        }
        content = json.dumps(report_data, ensure_ascii=False, indent=2)
        media_type = "application/json"
        filename = f"reconciliation_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    else:
        csv_data = []
        csv_data.append(["对账报告", ""])
        csv_data.append(["报告生成时间", format_date(datetime.now())])
        csv_data.append(["统计项", "数值"])
        csv_data.append(["总预约数", report.statistics.total_reservations])
        csv_data.append(["总刷卡记录", report.statistics.total_swipe_logs])
        csv_data.append(["已匹配刷卡", report.statistics.matched_swipes])
        csv_data.append(["未匹配刷卡", report.statistics.unmatched_swipes])
        csv_data.append(["总样品数", report.statistics.total_samples])
        csv_data.append(["逾期样品数", report.statistics.overdue_samples])
        csv_data.append(["总违规数", report.statistics.total_violations])
        csv_data.append(["待复核违规", report.statistics.pending_review_violations])
        csv_data.append(["总账单数", report.statistics.total_bills])
        csv_data.append(["总账单金额", report.statistics.total_bill_amount])
        csv_data.append(["已付金额", report.statistics.paid_amount])
        csv_data.append(["减免金额", report.statistics.waived_amount])
        
        output = StringIO()
        writer = csv.writer(output)
        writer.writerows(csv_data)
        content = output.getvalue()
        media_type = "text/csv"
        filename = f"reconciliation_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        iter([content]),
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/reconciliation-report/preview")
async def preview_reconciliation_report(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    """预览对账报告"""
    report = generate_reconciliation_report(db, date_from, date_to)
    
    return SuccessResponse(
        success=True,
        message="对账报告生成成功",
        data={
            "report_period": {
                "start_date": format_date(date_from),
                "end_date": format_date(date_to),
                "generated_at": format_date(datetime.now())
            },
            "statistics": {
                "total_reservations": report.statistics.total_reservations,
                "total_swipe_logs": report.statistics.total_swipe_logs,
                "matched_swipes": report.statistics.matched_swipes,
                "unmatched_swipes": report.statistics.unmatched_swipes,
                "total_samples": report.statistics.total_samples,
                "overdue_samples": report.statistics.overdue_samples,
                "total_violations": report.statistics.total_violations,
                "pending_review_violations": report.statistics.pending_review_violations,
                "total_bills": report.statistics.total_bills,
                "total_bill_amount": float(report.statistics.total_bill_amount),
                "paid_amount": float(report.statistics.paid_amount),
                "waived_amount": float(report.statistics.waived_amount)
            },
            "violations_by_type": report.violations_by_type,
            "violations_by_status": report.violations_by_status,
            "bills_by_status": report.bills_by_status
        }
    )
