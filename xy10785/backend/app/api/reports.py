from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import DeliveryReport as ReportModel
from app.schemas import DeliveryReport, DeliveryReportCreate

router = APIRouter()

@router.get("/{plan_id}", response_model=List[DeliveryReport])
def get_reports(plan_id: int, db: Session = Depends(get_db)):
    return db.query(ReportModel).filter(
        ReportModel.ad_plan_id == plan_id
    ).order_by(ReportModel.report_date.desc()).all()

@router.post("/", response_model=DeliveryReport)
def create_report(report: DeliveryReportCreate, db: Session = Depends(get_db)):
    report_data = report.model_dump()
    if report.clicks > 0 and report.impressions > 0:
        report_data["ctr"] = round(report.clicks / report.impressions * 100, 2)
    else:
        report_data["ctr"] = 0
    
    if report.clicks > 0 and report.spend > 0:
        report_data["cpc"] = round(report.spend / report.clicks, 2)
    else:
        report_data["cpc"] = 0
    
    db_report = ReportModel(**report_data)
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report
