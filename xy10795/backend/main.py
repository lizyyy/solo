from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
import uuid
from typing import List

from database import engine, get_db, Base
import models
import schemas

Base.metadata.create_all(bind=engine)

app = FastAPI(title="项目风险周报生成器 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def generate_operation_id():
    return str(uuid.uuid4())


def generate_update_token():
    return str(uuid.uuid4())


def generate_report_version(db: Session, project_id: int):
    count = db.query(models.WeeklyReport).filter(
        models.WeeklyReport.project_id == project_id
    ).count()
    return f"v{count + 1}.0"


@app.get("/api/projects", response_model=List[schemas.Project])
def get_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    projects = db.query(models.Project).order_by(
        models.Project.created_at.desc()
    ).offset(skip).limit(limit).all()
    return projects


@app.get("/api/projects/{project_id}", response_model=schemas.ProjectDetail)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


@app.post("/api/projects", response_model=schemas.Project)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    db_project = models.Project(**project.model_dump())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


@app.get("/api/projects/{project_id}/milestones", response_model=List[schemas.Milestone])
def get_project_milestones(project_id: int, db: Session = Depends(get_db)):
    milestones = db.query(models.Milestone).filter(
        models.Milestone.project_id == project_id
    ).order_by(models.Milestone.planned_date).all()
    return milestones


@app.post("/api/milestones", response_model=schemas.Milestone)
def create_milestone(milestone: schemas.MilestoneCreate, db: Session = Depends(get_db)):
    db_milestone = models.Milestone(**milestone.model_dump())
    db.add(db_milestone)
    db.commit()
    db.refresh(db_milestone)
    return db_milestone


@app.get("/api/milestones/{milestone_id}", response_model=schemas.MilestoneWithDelayReasons)
def get_milestone(milestone_id: int, db: Session = Depends(get_db)):
    milestone = db.query(models.Milestone).filter(
        models.Milestone.id == milestone_id
    ).first()
    if not milestone:
        raise HTTPException(status_code=404, detail="里程碑不存在")
    return milestone


@app.get("/api/projects/{project_id}/risks", response_model=List[schemas.Risk])
def get_project_risks(project_id: int, db: Session = Depends(get_db)):
    risks = db.query(models.Risk).filter(
        models.Risk.project_id == project_id
    ).order_by(models.Risk.created_at.desc()).all()
    return risks


@app.post("/api/risks", response_model=schemas.Risk)
def create_risk(risk: schemas.RiskCreate, db: Session = Depends(get_db)):
    db_risk = models.Risk(**risk.model_dump())
    db_risk.update_token = generate_update_token()
    db.add(db_risk)
    db.commit()
    db.refresh(db_risk)
    return db_risk


@app.put("/api/risks/{risk_id}", response_model=schemas.Risk)
def update_risk(risk_id: int, risk_update: schemas.RiskUpdate, db: Session = Depends(get_db)):
    db_risk = db.query(models.Risk).filter(models.Risk.id == risk_id).first()
    if not db_risk:
        raise HTTPException(status_code=404, detail="风险不存在")

    if risk_update.update_token and db_risk.update_token != risk_update.update_token:
        raise HTTPException(status_code=409, detail="数据已被更新，请刷新后重试")

    update_data = risk_update.model_dump(exclude_unset=True, exclude={"update_token"})
    for key, value in update_data.items():
        setattr(db_risk, key, value)

    db_risk.update_token = generate_update_token()
    db_risk.last_updated_at = datetime.now()
    db.commit()
    db.refresh(db_risk)
    return db_risk


@app.get("/api/projects/{project_id}/weekly-reports", response_model=List[schemas.WeeklyReport])
def get_project_weekly_reports(project_id: int, db: Session = Depends(get_db)):
    reports = db.query(models.WeeklyReport).filter(
        models.WeeklyReport.project_id == project_id
    ).order_by(models.WeeklyReport.created_at.desc()).all()
    return reports


@app.post("/api/weekly-reports", response_model=schemas.WeeklyReport)
def create_weekly_report(report: schemas.WeeklyReportCreate, db: Session = Depends(get_db)):
    version = generate_report_version(db, report.project_id)
    operation_id = generate_operation_id()
    
    db_report = models.WeeklyReport(
        **report.model_dump(),
        version=version,
        operation_id=operation_id
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


@app.get("/api/weekly-reports/{report_id}", response_model=schemas.WeeklyReportDetail)
def get_weekly_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(models.WeeklyReport).filter(
        models.WeeklyReport.id == report_id
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="周报不存在")
    return report


@app.put("/api/weekly-reports/{report_id}", response_model=schemas.WeeklyReport)
def update_weekly_report(
    report_id: int, 
    report_update: schemas.WeeklyReportUpdate, 
    db: Session = Depends(get_db)
):
    db_report = db.query(models.WeeklyReport).filter(
        models.WeeklyReport.id == report_id
    ).first()
    if not db_report:
        raise HTTPException(status_code=404, detail="周报不存在")

    if report_update.operation_id and db_report.operation_id != report_update.operation_id:
        raise HTTPException(status_code=409, detail="操作冲突，请刷新后重试")

    update_data = report_update.model_dump(exclude_unset=True, exclude={"operation_id"})
    for key, value in update_data.items():
        setattr(db_report, key, value)

    db_report.operation_id = generate_operation_id()
    db.commit()
    db.refresh(db_report)
    return db_report


@app.post("/api/report-risks", response_model=schemas.ReportRisk)
def add_risk_to_report(report_risk: schemas.ReportRiskCreate, db: Session = Depends(get_db)):
    existing = db.query(models.ReportRisk).filter(
        models.ReportRisk.weekly_report_id == report_risk.weekly_report_id,
        models.ReportRisk.risk_id == report_risk.risk_id
    ).first()
    if existing:
        return existing

    db_report_risk = models.ReportRisk(**report_risk.model_dump())
    db.add(db_report_risk)
    db.commit()
    db.refresh(db_report_risk)
    return db_report_risk


@app.post("/api/delay-reasons", response_model=schemas.DelayReason)
def create_delay_reason(delay_reason: schemas.DelayReasonCreate, db: Session = Depends(get_db)):
    db_delay_reason = models.DelayReason(**delay_reason.model_dump())
    db.add(db_delay_reason)
    db.commit()
    db.refresh(db_delay_reason)
    return db_delay_reason


@app.get("/api/milestones/{milestone_id}/delay-reasons", response_model=List[schemas.DelayReason])
def get_milestone_delay_reasons(milestone_id: int, db: Session = Depends(get_db)):
    reasons = db.query(models.DelayReason).filter(
        models.DelayReason.milestone_id == milestone_id
    ).order_by(models.DelayReason.created_at.desc()).all()
    return reasons


@app.put("/api/delay-reasons/{reason_id}", response_model=schemas.DelayReason)
def update_delay_reason(
    reason_id: int, 
    reason_update: schemas.DelayReasonUpdate, 
    db: Session = Depends(get_db)
):
    db_reason = db.query(models.DelayReason).filter(
        models.DelayReason.id == reason_id
    ).first()
    if not db_reason:
        raise HTTPException(status_code=404, detail="延期原因不存在")

    if reason_update.status == models.DelayReasonStatus.REJECTED:
        new_reason = models.DelayReason(
            milestone_id=db_reason.milestone_id,
            weekly_report_id=db_reason.weekly_report_id,
            reason=db_reason.reason,
            correction_path=reason_update.correction_path or db_reason.correction_path,
            status=models.DelayReasonStatus.PENDING,
            created_by=db_reason.created_by,
            version=db_reason.version + 1
        )
        db.add(new_reason)

    update_data = reason_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_reason, key, value)

    if reason_update.status:
        db_reason.reviewed_at = datetime.now()

    db.commit()
    db.refresh(db_reason)
    return db_reason


@app.post("/api/send-records", response_model=schemas.SendRecord)
def create_send_record(send_record: schemas.SendRecordCreate, db: Session = Depends(get_db)):
    if send_record.operation_id:
        existing = db.query(models.SendRecord).filter(
            models.SendRecord.operation_id == send_record.operation_id
        ).first()
        if existing:
            return existing

    operation_id = send_record.operation_id or generate_operation_id()
    
    db_send_record = models.SendRecord(
        **send_record.model_dump(exclude={"operation_id"}),
        operation_id=operation_id
    )
    db.add(db_send_record)

    db_report = db.query(models.WeeklyReport).filter(
        models.WeeklyReport.id == send_record.weekly_report_id
    ).first()
    if db_report:
        db_report.status = models.ReportStatus.SENT

    db.commit()
    db.refresh(db_send_record)
    return db_send_record


@app.get("/api/weekly-reports/{report_id}/send-records", response_model=List[schemas.SendRecord])
def get_report_send_records(report_id: int, db: Session = Depends(get_db)):
    records = db.query(models.SendRecord).filter(
        models.SendRecord.weekly_report_id == report_id
    ).order_by(models.SendRecord.sent_at.desc()).all()
    return records


@app.get("/api/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.now()}
