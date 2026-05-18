from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import date, datetime
from typing import List, Optional
import csv
from io import StringIO

import models
import schemas
import crud
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="牙科复诊排班匹配系统", description="牙科诊所复诊提醒、排班匹配、爽约记录管理系统")


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "timestamp": str(datetime.now())}
    )


@app.post("/patients/", response_model=schemas.Patient, tags=["患者管理"])
def create_patient(patient: schemas.PatientCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_patient(db=db, patient=patient)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/patients/", response_model=List[schemas.Patient], tags=["患者管理"])
def read_patients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    patients = crud.get_patients(db, skip=skip, limit=limit)
    return patients


@app.get("/patients/{patient_id}", response_model=schemas.Patient, tags=["患者管理"])
def read_patient(patient_id: int, db: Session = Depends(get_db)):
    db_patient = crud.get_patient(db, patient_id=patient_id)
    if db_patient is None:
        raise HTTPException(status_code=404, detail="患者不存在")
    return db_patient


@app.post("/doctors/", response_model=schemas.Doctor, tags=["医生管理"])
def create_doctor(doctor: schemas.DoctorCreate, db: Session = Depends(get_db)):
    return crud.create_doctor(db=db, doctor=doctor)


@app.get("/doctors/", response_model=List[schemas.Doctor], tags=["医生管理"])
def read_doctors(db: Session = Depends(get_db)):
    return crud.get_doctors(db)


@app.post("/schedules/", response_model=schemas.DoctorSchedule, tags=["排班管理"])
def create_schedule(schedule: schemas.DoctorScheduleCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_doctor_schedule(db=db, schedule=schedule)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/schedules/available/", response_model=List[schemas.DoctorSchedule], tags=["排班管理"])
def read_available_schedules(target_date: Optional[date] = None, doctor_id: Optional[int] = None, db: Session = Depends(get_db)):
    return crud.get_available_schedules(db, target_date=target_date, doctor_id=doctor_id)


@app.post("/treatment-plans/", response_model=schemas.TreatmentPlan, tags=["治疗计划管理"])
def create_treatment_plan(plan: schemas.TreatmentPlanCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_treatment_plan(db=db, plan=plan)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/treatment-plans/pending/", tags=["治疗计划管理"])
def read_pending_plans(db: Session = Depends(get_db)):
    return crud.get_pending_treatment_plans(db)


@app.get("/treatment-plans/{plan_id}", response_model=schemas.TreatmentPlan, tags=["治疗计划管理"])
def read_treatment_plan(plan_id: int, db: Session = Depends(get_db)):
    db_plan = crud.get_treatment_plan(db, plan_id=plan_id)
    if db_plan is None:
        raise HTTPException(status_code=404, detail="治疗计划不存在")
    return db_plan


@app.post("/reminders/match/", response_model=schemas.ReminderRecord, tags=["提醒管理"])
def match_reminder_schedule(match_req: schemas.ReminderMatchRequest, db: Session = Depends(get_db)):
    try:
        return crud.match_schedule_for_reminder(
            db, 
            treatment_plan_id=match_req.treatment_plan_id,
            schedule_id=match_req.schedule_id
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/reminders/", response_model=schemas.ReminderRecord, tags=["提醒管理"])
def create_reminder(reminder: schemas.ReminderRecordCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_reminder_record(db=db, reminder=reminder)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/reminders/", response_model=List[schemas.ReminderRecord], tags=["提醒管理"])
def read_reminders(
    patient_id: Optional[int] = None,
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    return crud.get_reminder_records(db, patient_id=patient_id, status=status, start_date=start_date, end_date=end_date)


@app.get("/reminders/{reminder_id}", response_model=schemas.ReminderRecord, tags=["提醒管理"])
def read_reminder(reminder_id: int, db: Session = Depends(get_db)):
    db_reminder = crud.get_reminder_record(db, reminder_id=reminder_id)
    if db_reminder is None:
        raise HTTPException(status_code=404, detail="提醒记录不存在")
    return db_reminder


@app.patch("/reminders/{reminder_id}/status/", response_model=schemas.ReminderRecord, tags=["提醒管理"])
def update_reminder_status(
    reminder_id: int,
    status_update: schemas.StatusUpdateRequest,
    db: Session = Depends(get_db)
):
    try:
        return crud.update_reminder_status(
            db, 
            reminder_id=reminder_id,
            status=status_update.status,
            notes=status_update.notes,
            operator=status_update.operator
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.patch("/reminders/{reminder_id}/correct/", response_model=schemas.ReminderRecord, tags=["提醒管理"])
def manual_correct_reminder(
    reminder_id: int,
    correction: schemas.ManualCorrectionRequest,
    db: Session = Depends(get_db)
):
    try:
        return crud.manual_correct_reminder(db, reminder_id=reminder_id, correction=correction)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/reminders/{reminder_id}/cancel/", response_model=schemas.ReminderRecord, tags=["提醒管理"])
def cancel_reminder(
    reminder_id: int,
    operator: Optional[str] = None,
    reason: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        return crud.cancel_reminder(db, reminder_id=reminder_id, operator=operator, reason=reason)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/missed-appointments/", response_model=schemas.MissedAppointment, tags=["爽约管理"])
def record_missed_appointment(missed: schemas.MissedAppointmentCreate, db: Session = Depends(get_db)):
    return crud.create_missed_appointment(db=db, missed=missed)


@app.get("/missed-appointments/", response_model=List[schemas.MissedAppointment], tags=["爽约管理"])
def read_missed_appointments(
    patient_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    return crud.get_missed_appointments(db, patient_id=patient_id, start_date=start_date, end_date=end_date)


@app.post("/revisit-reports/", response_model=schemas.RevisitReport, tags=["复诊报告"])
def create_revisit_report(report: schemas.RevisitReportCreate, db: Session = Depends(get_db)):
    return crud.create_revisit_report(db=db, report=report)


@app.get("/revisit-reports/", response_model=List[schemas.RevisitReport], tags=["复诊报告"])
def read_revisit_reports(
    patient_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    return crud.get_revisit_reports(db, patient_id=patient_id, start_date=start_date, end_date=end_date)


@app.get("/export/reminders/", tags=["数据导出"])
def export_reminders(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    status: Optional[str] = None,
    patient_id: Optional[int] = None,
    format: str = "json",
    db: Session = Depends(get_db)
):
    data = crud.export_reminder_data(db, start_date=start_date, end_date=end_date, status=status, patient_id=patient_id)
    
    if format == "csv":
        output = StringIO()
        if data:
            writer = csv.DictWriter(output, fieldnames=data[0].keys())
            writer.writeheader()
            writer.writerows(data)
        csv_content = output.getvalue()
        return JSONResponse(
            content={"data": csv_content, "format": "csv"},
            headers={"Content-Disposition": "attachment; filename=reminders.csv"}
        )
    
    return {"data": data, "format": "json", "count": len(data)}


@app.get("/exceptions/", response_model=List[schemas.ExceptionLog], tags=["异常管理"])
def read_exceptions(is_resolved: Optional[bool] = None, db: Session = Depends(get_db)):
    query = db.query(models.ExceptionLog)
    if is_resolved is not None:
        query = query.filter(models.ExceptionLog.is_resolved == is_resolved)
    return query.all()


@app.patch("/exceptions/{exception_id}/resolve/", response_model=schemas.ExceptionLog, tags=["异常管理"])
def resolve_exception(exception_id: int, handler: str, conclusion: str, db: Session = Depends(get_db)):
    result = crud.resolve_exception(db, exception_id=exception_id, handler=handler, conclusion=conclusion)
    if result is None:
        raise HTTPException(status_code=404, detail="异常记录不存在")
    return result


@app.get("/", tags=["系统"])
def root():
    return {
        "message": "牙科复诊排班匹配系统 API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }
