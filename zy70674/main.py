from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime
from typing import List, Optional
import os
from database import get_db, init_db, Bed, Patient, Admission, TransferRecord, TurnoverInterval, TurnoverReport
from schemas import (
    BedCreate, BedResponse, PatientCreate, PatientResponse,
    AdmissionCreate, AdmissionResponse, AdmissionUpdate,
    TransferRecordCreate, TransferRecordResponse,
    TurnoverIntervalResponse, TurnoverReportResponse,
    TurnoverCalculationRequest, TurnoverCalculationResponse,
    ReviewRequest, BatchImportResponse, ErrorResponse, ErrorCode
)
from services import generate_turnover_report, review_intervals, export_report_to_excel

app = FastAPI(
    title="床位周转转科拆分异常区间后端API",
    description="病区床位周转管理系统，支持转科拆分、预出院标记、异常区间检测和报告导出",
    version="1.0.0"
)


@app.on_event("startup")
def startup_event():
    init_db()


def create_http_exception(error_code: ErrorCode, message: str, status_code: int, details: dict = None):
    return HTTPException(
        status_code=status_code,
        detail={
            "error_code": error_code.value,
            "message": message,
            "details": details or {},
            "timestamp": datetime.utcnow().isoformat()
        }
    )


@app.post("/api/beds/", response_model=BedResponse, status_code=status.HTTP_201_CREATED)
def create_bed(bed: BedCreate, db: Session = Depends(get_db)):
    existing = db.query(Bed).filter(Bed.bed_number == bed.bed_number).first()
    if existing:
        raise create_http_exception(
            ErrorCode.DUPLICATE_ENTRY,
            f"床位号 {bed.bed_number} 已存在",
            status.HTTP_409_CONFLICT
        )
    
    db_bed = Bed(**bed.dict())
    db.add(db_bed)
    db.commit()
    db.refresh(db_bed)
    return db_bed


@app.get("/api/beds/", response_model=List[BedResponse])
def list_beds(ward: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Bed)
    if ward:
        query = query.filter(Bed.ward == ward)
    return query.all()


@app.post("/api/patients/", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
def create_patient(patient: PatientCreate, db: Session = Depends(get_db)):
    existing = db.query(Patient).filter(Patient.patient_id == patient.patient_id).first()
    if existing:
        raise create_http_exception(
            ErrorCode.DUPLICATE_ENTRY,
            f"患者ID {patient.patient_id} 已存在",
            status.HTTP_409_CONFLICT
        )
    
    db_patient = Patient(**patient.dict())
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient


@app.get("/api/patients/", response_model=List[PatientResponse])
def list_patients(db: Session = Depends(get_db)):
    return db.query(Patient).all()


@app.post("/api/admissions/", response_model=AdmissionResponse, status_code=status.HTTP_201_CREATED)
def create_admission(admission: AdmissionCreate, db: Session = Depends(get_db)):
    existing = db.query(Admission).filter(
        Admission.admission_number == admission.admission_number
    ).first()
    if existing:
        raise create_http_exception(
            ErrorCode.DUPLICATE_ENTRY,
            f"住院号 {admission.admission_number} 已存在",
            status.HTTP_409_CONFLICT
        )
    
    patient = db.query(Patient).filter(Patient.patient_id == admission.patient_id).first()
    if not patient:
        raise create_http_exception(
            ErrorCode.RESOURCE_NOT_FOUND,
            f"患者ID {admission.patient_id} 不存在",
            status.HTTP_404_NOT_FOUND
        )
    
    bed = db.query(Bed).filter(Bed.id == admission.bed_id).first()
    if not bed:
        raise create_http_exception(
            ErrorCode.RESOURCE_NOT_FOUND,
            f"床位ID {admission.bed_id} 不存在",
            status.HTTP_404_NOT_FOUND
        )
    
    db_admission = Admission(**admission.dict())
    db.add(db_admission)
    db.commit()
    db.refresh(db_admission)
    return db_admission


@app.put("/api/admissions/{admission_number}", response_model=AdmissionResponse)
def update_admission(admission_number: str, update: AdmissionUpdate, db: Session = Depends(get_db)):
    admission = db.query(Admission).filter(
        Admission.admission_number == admission_number
    ).first()
    if not admission:
        raise create_http_exception(
            ErrorCode.RESOURCE_NOT_FOUND,
            f"住院号 {admission_number} 不存在",
            status.HTTP_404_NOT_FOUND
        )
    
    update_data = update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(admission, key, value)
    
    db.commit()
    db.refresh(admission)
    return admission


@app.get("/api/admissions/", response_model=List[AdmissionResponse])
def list_admissions(ward: Optional[str] = None, status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Admission)
    if ward:
        query = query.filter(Admission.ward == ward)
    if status:
        query = query.filter(Admission.status == status)
    return query.all()


@app.post("/api/transfers/", response_model=TransferRecordResponse, status_code=status.HTTP_201_CREATED)
def create_transfer(transfer: TransferRecordCreate, db: Session = Depends(get_db)):
    admission = db.query(Admission).filter(
        Admission.admission_number == transfer.admission_number
    ).first()
    if not admission:
        raise create_http_exception(
            ErrorCode.RESOURCE_NOT_FOUND,
            f"住院号 {transfer.admission_number} 不存在",
            status.HTTP_404_NOT_FOUND
        )
    
    if admission.status == "discharged":
        raise create_http_exception(
            ErrorCode.INVALID_STATUS,
            "患者已出院，无法创建转科记录",
            status.HTTP_400_BAD_REQUEST
        )
    
    db_transfer = TransferRecord(**transfer.dict())
    db.add(db_transfer)
    
    admission.bed_id = transfer.to_bed_id
    admission.ward = transfer.to_ward
    
    db.commit()
    db.refresh(db_transfer)
    return db_transfer


@app.get("/api/transfers/", response_model=List[TransferRecordResponse])
def list_transfers(admission_number: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(TransferRecord)
    if admission_number:
        query = query.filter(TransferRecord.admission_number == admission_number)
    return query.order_by(TransferRecord.transfer_time.desc()).all()


@app.post("/api/turnover/calculate/", response_model=TurnoverCalculationResponse)
def calculate_turnover(request: TurnoverCalculationRequest, db: Session = Depends(get_db)):
    try:
        report, intervals = generate_turnover_report(db, request)
        return {
            "report_id": report.report_id,
            "report_name": report.report_name,
            "ward": report.ward,
            "start_date": report.start_date,
            "end_date": report.end_date,
            "total_intervals": report.total_intervals,
            "abnormal_intervals": report.abnormal_intervals,
            "transfer_count": report.transfer_count,
            "pre_discharge_count": report.pre_discharge_count,
            "average_turnover_hours": report.average_turnover_hours,
            "intervals": intervals
        }
    except Exception as e:
        raise create_http_exception(
            ErrorCode.INVALID_TIME_RANGE,
            str(e),
            status.HTTP_400_BAD_REQUEST
        )


@app.get("/api/turnover/reports/", response_model=List[TurnoverReportResponse])
def list_reports(ward: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(TurnoverReport)
    if ward:
        query = query.filter(TurnoverReport.ward == ward)
    return query.order_by(TurnoverReport.generated_at.desc()).all()


@app.get("/api/turnover/reports/{report_id}", response_model=TurnoverReportResponse)
def get_report(report_id: str, db: Session = Depends(get_db)):
    report = db.query(TurnoverReport).filter(TurnoverReport.report_id == report_id).first()
    if not report:
        raise create_http_exception(
            ErrorCode.RESOURCE_NOT_FOUND,
            f"报告ID {report_id} 不存在",
            status.HTTP_404_NOT_FOUND
        )
    return report


@app.get("/api/turnover/reports/{report_id}/intervals", response_model=List[TurnoverIntervalResponse])
def get_report_intervals(report_id: str, only_abnormal: bool = False, db: Session = Depends(get_db)):
    query = db.query(TurnoverInterval).filter(TurnoverInterval.report_id == report_id)
    if only_abnormal:
        query = query.filter(TurnoverInterval.is_abnormal == True)
    return query.order_by(TurnoverInterval.bed_number, TurnoverInterval.interval_start).all()


@app.post("/api/turnover/review/")
def review_interval(request: ReviewRequest, db: Session = Depends(get_db)):
    intervals = db.query(TurnoverInterval).filter(
        TurnoverInterval.id.in_(request.interval_ids)
    ).all()
    
    if not intervals:
        raise create_http_exception(
            ErrorCode.RESOURCE_NOT_FOUND,
            "未找到指定的区间记录",
            status.HTTP_404_NOT_FOUND
        )
    
    already_reviewed = [i.id for i in intervals if i.status == "reviewed"]
    if already_reviewed:
        raise create_http_exception(
            ErrorCode.ALREADY_PROCESSED,
            f"以下区间已复核：{already_reviewed}",
            status.HTTP_400_BAD_REQUEST,
            {"already_reviewed_ids": already_reviewed}
        )
    
    reviewed = review_intervals(
        db, request.interval_ids, request.review_notes,
        request.reviewed_by, request.approve
    )
    
    return {
        "reviewed_count": len(reviewed),
        "interval_ids": request.interval_ids,
        "approve": request.approve,
        "reviewed_by": request.reviewed_by
    }


@app.get("/api/turnover/export/{report_id}")
def export_report(report_id: str, db: Session = Depends(get_db)):
    report = db.query(TurnoverReport).filter(TurnoverReport.report_id == report_id).first()
    if not report:
        raise create_http_exception(
            ErrorCode.RESOURCE_NOT_FOUND,
            f"报告ID {report_id} 不存在",
            status.HTTP_404_NOT_FOUND
        )
    
    os.makedirs("exports", exist_ok=True)
    output_path = f"exports/{report_id}.xlsx"
    
    try:
        result = export_report_to_excel(db, report_id, output_path)
        return FileResponse(
            output_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=f"{report.report_name}.xlsx"
        )
    except Exception as e:
        raise create_http_exception(
            ErrorCode.INVALID_STATUS,
            f"导出失败：{str(e)}",
            status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@app.post("/api/batch/import/beds", response_model=BatchImportResponse)
def batch_import_beds(beds: List[BedCreate], db: Session = Depends(get_db)):
    success = 0
    failed = 0
    errors = []
    
    for idx, bed in enumerate(beds):
        try:
            existing = db.query(Bed).filter(Bed.bed_number == bed.bed_number).first()
            if existing:
                failed += 1
                errors.append({"index": idx, "bed_number": bed.bed_number, "reason": "床位号已存在"})
                continue
            
            db_bed = Bed(**bed.dict())
            db.add(db_bed)
            success += 1
        except Exception as e:
            failed += 1
            errors.append({"index": idx, "bed_number": bed.bed_number, "reason": str(e)})
    
    db.commit()
    return {"success_count": success, "failed_count": failed, "errors": errors}


@app.get("/api/stats/")
def get_stats(ward: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Admission)
    if ward:
        query = query.filter(Admission.ward == ward)
    
    total_admissions = query.count()
    active_admissions = query.filter(Admission.status == "active").count()
    pre_discharge_count = query.filter(Admission.is_pre_discharge == True).count()
    
    transfer_count = db.query(TransferRecord).count()
    if ward:
        transfer_count = db.query(TransferRecord).filter(
            (TransferRecord.from_ward == ward) | (TransferRecord.to_ward == ward)
        ).count()
    
    return {
        "ward": ward or "全部",
        "total_admissions": total_admissions,
        "active_admissions": active_admissions,
        "pre_discharge_count": pre_discharge_count,
        "transfer_count": transfer_count
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
