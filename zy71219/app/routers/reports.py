from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import LetterOfCredit
from app.schemas import ApiResponse
from app.core import ReportExporter

router = APIRouter(prefix="/api/reports", tags=["报告导出"])


@router.get("/discrepancy/{lc_id}/excel")
def export_discrepancy_excel(lc_id: int, db: Session = Depends(get_db)):
    lc = db.query(LetterOfCredit).filter(LetterOfCredit.id == lc_id).first()
    if not lc:
        raise HTTPException(status_code=404, detail=f"信用证 {lc_id} 不存在")

    exporter = ReportExporter(db)
    output = exporter.export_discrepancy_report_excel(lc_id)

    filename = f"不符点报告_{lc.lc_number}_{output.__sizeof__()}.xlsx".replace("/", "_")

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=discrepancy_report_{lc.lc_number}.xlsx"
        }
    )


@router.get("/discrepancy/{lc_id}/pdf")
def export_discrepancy_pdf(lc_id: int, db: Session = Depends(get_db)):
    lc = db.query(LetterOfCredit).filter(LetterOfCredit.id == lc_id).first()
    if not lc:
        raise HTTPException(status_code=404, detail=f"信用证 {lc_id} 不存在")

    exporter = ReportExporter(db)
    output = exporter.export_discrepancy_report_pdf(lc_id)

    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=discrepancy_report_{lc.lc_number}.pdf"
        }
    )


@router.get("/discrepancy/{lc_id}/summary", response_model=ApiResponse)
def get_report_summary(lc_id: int, db: Session = Depends(get_db)):
    from app.models import Discrepancy, Document
    from app.core import DISCREPANCY_CATEGORIES

    lc = db.query(LetterOfCredit).filter(LetterOfCredit.id == lc_id).first()
    if not lc:
        raise HTTPException(status_code=404, detail=f"信用证 {lc_id} 不存在")

    discrepancies = db.query(Discrepancy).filter(Discrepancy.lc_id == lc_id).all()
    documents = db.query(Document).filter(Document.lc_id == lc_id, Document.is_active == True).all()

    severity_summary = {
        "CRITICAL": len([d for d in discrepancies if d.severity == "CRITICAL"]),
        "HIGH": len([d for d in discrepancies if d.severity == "HIGH"]),
        "MEDIUM": len([d for d in discrepancies if d.severity == "MEDIUM"]),
        "LOW": len([d for d in discrepancies if d.severity == "LOW"]),
    }

    status_summary = {
        "OPEN": len([d for d in discrepancies if d.status == "OPEN"]),
        "IN_PROGRESS": len([d for d in discrepancies if d.status == "IN_PROGRESS"]),
        "RESOLVED": len([d for d in discrepancies if d.status == "RESOLVED"]),
        "ACCEPTED": len([d for d in discrepancies if d.status == "ACCEPTED"]),
        "CLOSED": len([d for d in discrepancies if d.status == "CLOSED"]),
    }

    type_summary = {}
    for d in discrepancies:
        cat_info = DISCREPANCY_CATEGORIES.get(d.discrepancy_type, {"name": d.discrepancy_type})
        type_name = cat_info.get("name", d.discrepancy_type)
        if type_name not in type_summary:
            type_summary[type_name] = 0
        type_summary[type_name] += 1

    doc_summary = {
        "BILL_OF_LADING": len([d for d in documents if d.document_type.upper() in ["BL", "BILL_OF_LADING"]]),
        "COMMERCIAL_INVOICE": len([d for d in documents if d.document_type.upper() in ["INVOICE", "COMMERCIAL_INVOICE"]]),
        "PACKING_LIST": len([d for d in documents if d.document_type.upper() in ["PL", "PACKING_LIST"]]),
        "OTHER": len([d for d in documents if d.document_type.upper() not in ["BL", "BILL_OF_LADING", "INVOICE", "COMMERCIAL_INVOICE", "PL", "PACKING_LIST"]]),
    }

    return ApiResponse(
        success=True,
        message="查询成功",
        data={
            "lc_info": {
                "id": lc.id,
                "lc_number": lc.lc_number,
                "issuing_bank": lc.issuing_bank,
                "applicant": lc.applicant,
                "beneficiary": lc.beneficiary,
                "amount": lc.amount,
                "currency": lc.currency,
                "status": lc.status,
                "latest_shipment_date": lc.latest_shipment_date,
                "expiry_date": lc.expiry_date,
            },
            "total_discrepancies": len(discrepancies),
            "severity_summary": severity_summary,
            "status_summary": status_summary,
            "type_summary": type_summary,
            "document_summary": doc_summary,
            "total_documents": len(documents),
            "can_export": len(discrepancies) > 0 or len(documents) > 0,
        }
    )
