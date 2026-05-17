from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
import json
from datetime import datetime
from database import get_db
from models import Device, Quote, Inspection, InspectionItem, InspectionReport, Deduction, DeductionReason
from schemas import ReportGenerateRequest, InspectionReportResponse
from exceptions import NotFoundException

router = APIRouter()


def generate_report_number() -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"RPT{timestamp}"


@router.post("/generate", response_model=InspectionReportResponse)
def generate_report(
    request: ReportGenerateRequest,
    db: Session = Depends(get_db)
):
    device = db.query(Device).filter(Device.id == request.device_id).first()
    if not device:
        raise NotFoundException("设备", request.device_id)

    inspections = db.query(Inspection).filter(
        Inspection.device_id == request.device_id
    ).all()

    total_score = 0.0
    max_possible_score = 0.0
    inspection_details = []

    for insp in inspections:
        item = db.query(InspectionItem).filter(
            InspectionItem.id == insp.item_id
        ).first()
        if item:
            weighted_score = insp.score * item.weight
            total_score += weighted_score
            max_possible_score += item.max_score * item.weight
            inspection_details.append({
                "item_name": item.name,
                "category": item.category,
                "score": insp.score,
                "max_score": item.max_score,
                "weight": item.weight,
                "weighted_score": weighted_score,
                "inspector": insp.inspector,
                "notes": insp.notes
            })

    quote = db.query(Quote).filter(
        Quote.device_id == request.device_id
    ).order_by(Quote.version.desc()).first()

    final_price = quote.final_price if quote else None

    deductions = []
    if quote:
        deduction_list = db.query(Deduction).filter(
            Deduction.quote_id == quote.id
        ).all()
        for d in deduction_list:
            reason = db.query(DeductionReason).filter(
                DeductionReason.id == d.reason_id
            ).first()
            deductions.append({
                "reason_code": reason.code if reason else "",
                "reason_name": reason.name if reason else "",
                "amount": d.amount,
                "description": d.description
            })

    report_content = {
        "device_info": {
            "serial_number": device.serial_number,
            "brand": device.brand,
            "model": device.model,
            "storage": device.storage,
            "color": device.color
        },
        "inspection_summary": {
            "total_score": total_score,
            "max_possible_score": max_possible_score,
            "score_percentage": (total_score / max_possible_score * 100) if max_possible_score > 0 else 0,
            "inspection_count": len(inspection_details)
        },
        "inspection_details": inspection_details,
        "pricing_info": {
            "base_price": quote.base_price if quote else None,
            "deductions": deductions,
            "total_deductions": sum(d["amount"] for d in deductions),
            "final_price": final_price,
            "quote_version": quote.version if quote else None,
            "is_frozen": quote.is_frozen if quote else False
        },
        "generated_at": datetime.utcnow().isoformat(),
        "generated_by": request.generated_by
    }

    report_number = generate_report_number()

    db_report = InspectionReport(
        device_id=request.device_id,
        report_number=report_number,
        total_score=total_score,
        final_price=final_price,
        generated_by=request.generated_by,
        content=json.dumps(report_content, ensure_ascii=False, indent=2)
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)

    response = InspectionReportResponse(
        id=db_report.id,
        device_id=db_report.device_id,
        serial_number=device.serial_number,
        report_number=db_report.report_number,
        total_score=db_report.total_score,
        final_price=db_report.final_price,
        status=db_report.status,
        generated_by=db_report.generated_by,
        generated_at=db_report.generated_at,
        content=db_report.content
    )
    return response


@router.get("/", response_model=List[InspectionReportResponse])
def list_reports(
    skip: int = 0,
    limit: int = 100,
    device_id: int = None,
    report_number: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(InspectionReport)
    if device_id:
        query = query.filter(InspectionReport.device_id == device_id)
    if report_number:
        query = query.filter(InspectionReport.report_number == report_number)

    reports = query.order_by(
        InspectionReport.generated_at.desc()
    ).offset(skip).limit(limit).all()

    results = []
    for r in reports:
        device = db.query(Device).filter(Device.id == r.device_id).first()
        results.append(InspectionReportResponse(
            id=r.id,
            device_id=r.device_id,
            serial_number=device.serial_number if device else "",
            report_number=r.report_number,
            total_score=r.total_score,
            final_price=r.final_price,
            status=r.status,
            generated_by=r.generated_by,
            generated_at=r.generated_at,
            content=r.content
        ))
    return results


@router.get("/{report_id}", response_model=InspectionReportResponse)
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(InspectionReport).filter(
        InspectionReport.id == report_id
    ).first()
    if not report:
        raise NotFoundException("质检报告", report_id)

    device = db.query(Device).filter(Device.id == report.device_id).first()

    response = InspectionReportResponse(
        id=report.id,
        device_id=report.device_id,
        serial_number=device.serial_number,
        report_number=report.report_number,
        total_score=report.total_score,
        final_price=report.final_price,
        status=report.status,
        generated_by=report.generated_by,
        generated_at=report.generated_at,
        content=report.content
    )
    return response


@router.get("/export/{report_id}")
def export_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(InspectionReport).filter(
        InspectionReport.id == report_id
    ).first()
    if not report:
        raise NotFoundException("质检报告", report_id)

    device = db.query(Device).filter(Device.id == report.device_id).first()

    if report.content:
        content = json.loads(report.content)
    else:
        content = {}

    return {
        "report_number": report.report_number,
        "serial_number": device.serial_number,
        "exported_at": datetime.utcnow().isoformat(),
        "report_data": content
    }
