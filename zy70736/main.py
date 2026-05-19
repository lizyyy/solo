from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import csv
from io import StringIO
from fastapi.responses import StreamingResponse

from database import engine, get_db, Base
import models
import schemas
import services
from models import SwitchStatus, HealthStatus

Base.metadata.create_all(bind=engine)

app = FastAPI(title="CDN源站故障切换恢复API", version="1.0.0")


@app.post("/domains/", response_model=schemas.Domain, status_code=201)
def create_domain(domain: schemas.DomainCreate, db: Session = Depends(get_db)):
    db_domain = db.query(models.Domain).filter(models.Domain.domain_name == domain.domain_name).first()
    if db_domain:
        raise HTTPException(status_code=409, detail="Domain already exists")
    db_domain = models.Domain(**domain.dict())
    db.add(db_domain)
    db.commit()
    db.refresh(db_domain)
    return db_domain


@app.get("/domains/", response_model=List[schemas.Domain])
def list_domains(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Domain).offset(skip).limit(limit).all()


@app.get("/domains/{domain_id}", response_model=schemas.Domain)
def get_domain(domain_id: int, db: Session = Depends(get_db)):
    db_domain = db.query(models.Domain).filter(models.Domain.id == domain_id).first()
    if not db_domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    return db_domain


@app.post("/switches/", response_model=schemas.SwitchRecord, status_code=201)
def create_switch(switch: schemas.SwitchRecordCreate, db: Session = Depends(get_db)):
    domain = db.query(models.Domain).filter(models.Domain.id == switch.domain_id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    active_switch = services.get_active_switch_for_domain(db, switch.domain_id)
    if active_switch:
        raise HTTPException(
            status_code=409,
            detail=f"Domain already has active switch (ID: {active_switch.id})"
        )

    db_switch = services.create_switch_record(db, switch)
    return db_switch


@app.get("/switches/", response_model=List[schemas.SwitchRecord])
def list_switches(
    domain_id: Optional[int] = None,
    status: Optional[SwitchStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.SwitchRecord)
    if domain_id:
        query = query.filter(models.SwitchRecord.domain_id == domain_id)
    if status:
        query = query.filter(models.SwitchRecord.status == status)
    return query.order_by(models.SwitchRecord.created_at.desc()).offset(skip).limit(limit).all()


@app.get("/switches/{switch_id}", response_model=schemas.SwitchRecordDetail)
def get_switch(switch_id: int, db: Session = Depends(get_db)):
    db_switch = db.query(models.SwitchRecord).filter(models.SwitchRecord.id == switch_id).first()
    if not db_switch:
        raise HTTPException(status_code=404, detail="Switch record not found")
    return db_switch


@app.post("/switches/{switch_id}/execute", response_model=schemas.SwitchRecord)
def execute_switch(switch_id: int, operator: str, db: Session = Depends(get_db)):
    db_switch = db.query(models.SwitchRecord).filter(models.SwitchRecord.id == switch_id).first()
    if not db_switch:
        raise HTTPException(status_code=404, detail="Switch record not found")

    result = services.transition_status(
        db, db_switch, SwitchStatus.SWITCHED,
        operator, "Execute switch to backup origin"
    )
    if not result:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {db_switch.status} to {SwitchStatus.SWITCHED}"
        )
    return result


@app.post("/switches/{switch_id}/start-health-check", response_model=schemas.SwitchRecord)
def start_health_check(switch_id: int, operator: str, db: Session = Depends(get_db)):
    db_switch = db.query(models.SwitchRecord).filter(models.SwitchRecord.id == switch_id).first()
    if not db_switch:
        raise HTTPException(status_code=404, detail="Switch record not found")

    result = services.transition_status(
        db, db_switch, SwitchStatus.HEALTH_CHECKING,
        operator, "Start health checking primary origin"
    )
    if not result:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {db_switch.status} to {SwitchStatus.HEALTH_CHECKING}"
        )
    return result


@app.post("/switches/{switch_id}/health-checks", response_model=schemas.HealthCheck, status_code=201)
def add_health_check(switch_id: int, health_check: schemas.HealthCheckBase, db: Session = Depends(get_db)):
    db_switch = db.query(models.SwitchRecord).filter(models.SwitchRecord.id == switch_id).first()
    if not db_switch:
        raise HTTPException(status_code=404, detail="Switch record not found")

    db_check = services.add_health_check(db, schemas.HealthCheckCreate(
        switch_record_id=switch_id,
        **health_check.dict()
    ))

    if db_switch.status == SwitchStatus.HEALTH_CHECKING:
        if services.should_restore(db, db_switch):
            services.transition_status(
                db, db_switch, SwitchStatus.READY_TO_RESTORE,
                "system", "Primary origin health restored automatically",
                f"Health check passed threshold"
            )
            db.refresh(db_switch)

    return db_check


@app.post("/switches/{switch_id}/restore", response_model=schemas.SwitchRecord)
def restore_restore(switch_id: int, operator: str, db: Session = Depends(get_db)):
    db_switch = db.query(models.SwitchRecord).filter(models.SwitchRecord.id == switch_id).first()
    if not db_switch:
        raise HTTPException(status_code=404, detail="Switch record not found")

    result = services.transition_status(
        db, db_switch, SwitchStatus.RESTORED,
        operator, "Restore to primary origin"
    )
    if not result:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {db_switch.status} to {SwitchStatus.RESTORED}"
        )
    return result


@app.post("/switches/{switch_id}/correct", response_model=schemas.SwitchRecord)
def manual_correct(switch_id: int, request: schemas.ManualCorrectRequest, db: Session = Depends(get_db)):
    db_switch = db.query(models.SwitchRecord).filter(models.SwitchRecord.id == switch_id).first()
    if not db_switch:
        raise HTTPException(status_code=404, detail="Switch record not found")

    result = services.transition_status(
        db, db_switch, request.target_status,
        request.operator, request.reason,
        request.original_input
    )
    if not result:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {db_switch.status} to {request.target_status}"
        )
    return result


@app.post("/switches/{switch_id}/cancel", response_model=schemas.SwitchRecord)
def cancel_switch(switch_id: int, operator: str, reason: str, db: Session = Depends(get_db)):
    db_switch = db.query(models.SwitchRecord).filter(models.SwitchRecord.id == switch_id).first()
    if not db_switch:
        raise HTTPException(status_code=404, detail="Switch record not found")

    result = services.transition_status(
        db, db_switch, SwitchStatus.CANCELLED,
        operator, reason
    )
    if not result:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {db_switch.status} to {SwitchStatus.CANCELLED}"
        )
    return result


@app.post("/switches/{switch_id}/close", response_model=schemas.SwitchRecord)
def close_switch(switch_id: int, operator: str, reason: str, db: Session = Depends(get_db)):
    db_switch = db.query(models.SwitchRecord).filter(models.SwitchRecord.id == switch_id).first()
    if not db_switch:
        raise HTTPException(status_code=404, detail="Switch record not found")

    result = services.transition_status(
        db, db_switch, SwitchStatus.CLOSED,
        operator, reason
    )
    if not result:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {db_switch.status} to {SwitchStatus.CLOSED}"
        )
    return result


@app.get("/switches/{switch_id}/report")
def get_switch_report(switch_id: int, db: Session = Depends(get_db)):
    report = services.get_switch_report(db, switch_id)
    if not report:
        raise HTTPException(status_code=404, detail="Switch record not found")
    return report


@app.get("/switches/{switch_id}/report/export")
def export_report(switch_id: int, db: Session = Depends(get_db)):
    report = services.get_switch_report(db, switch_id)
    if not report:
        raise HTTPException(status_code=404, detail="Switch record not found")

    def generate_csv():
        csv_buffer = StringIO()
        writer = csv.writer(csv_buffer)
        
        writer.writerow(["Field", "Value"])
        writer.writerow(["Switch Record ID", report.switch_record_id])
        writer.writerow(["Domain Name", report.domain_name])
        writer.writerow(["Primary Origin", report.primary_origin])
        writer.writerow(["Backup Origin", report.backup_origin])
        writer.writerow(["Switch Reason", report.switch_reason])
        writer.writerow(["Restore Condition", report.restore_condition or ""])
        writer.writerow(["Status", report.status])
        writer.writerow(["Created By", report.created_by])
        writer.writerow(["Created At", report.created_at.isoformat()])
        writer.writerow(["Switched At", report.switched_at.isoformat() if report.switched_at else ""])
        writer.writerow(["Restored At", report.restored_at.isoformat() if report.restored_at else ""])
        writer.writerow(["Total Health Checks", report.total_health_checks])
        writer.writerow(["Successful Checks", report.successful_checks])
        writer.writerow(["Failed Checks", report.failed_checks])
        writer.writerow([])
        writer.writerow(["Operation Logs"])
        writer.writerow(["Time", "Type", "Operator", "Conclusion"])
        for op in report.operations:
            writer.writerow([
                op.created_at.isoformat(), op.operation_type, op.operator, op.conclusion or ""])
        
        yield csv_buffer.getvalue()

    return StreamingResponse(
        generate_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=switch_report_{switch_id}.csv"}
    )


@app.get("/reminders/restore")
def get_restore_reminders(db: Session = Depends(get_db)):
    switches = services.check_restore_reminders(db)
    return {
        "count": len(switches),
        "switches": [
            {
                "id": s.id,
                "domain_id": s.domain_id,
                "status": s.status,
                "switch_reason": s.switch_reason,
                "created_at": s.created_at
            } for s in switches
        ]
    }


@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}