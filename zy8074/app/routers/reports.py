from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Inventory, LinenStatus
from app.report_exporter import ReportExporter

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/markdown")
def export_markdown(db: Session = Depends(get_db)):
    linen_list = db.query(LinenStatus).order_by(LinenStatus.rfid, LinenStatus.id.desc()).all()
    latest_linen = {}
    for linen in linen_list:
        if linen.rfid not in latest_linen:
            latest_linen[linen.rfid] = linen
    inventory_list = db.query(Inventory).all()
    
    md = ReportExporter.to_markdown(list(latest_linen.values()), inventory_list)
    return Response(content=md, media_type="text/markdown")

@router.get("/csv")
def export_csv(db: Session = Depends(get_db)):
    linen_list = db.query(LinenStatus).order_by(LinenStatus.rfid, LinenStatus.id.desc()).all()
    latest_linen = {}
    for linen in linen_list:
        if linen.rfid not in latest_linen:
            latest_linen[linen.rfid] = linen
    inventory_list = db.query(Inventory).all()
    
    csv_content = ReportExporter.to_csv(list(latest_linen.values()), inventory_list)
    return Response(content=csv_content, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=linen_report.csv"})

@router.get("/anomalies/markdown")
def export_anomalies_markdown(db: Session = Depends(get_db)):
    from .anomalies import check_anomalies
    anomalies = check_anomalies(db)
    md = ReportExporter.anomalies_to_markdown(anomalies)
    return Response(content=md, media_type="text/markdown")
