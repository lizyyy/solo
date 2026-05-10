from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import date, datetime
from typing import List, Optional
from ..database import get_db
from ..models import Patient, Caregiver, CareCertificate, ReplacementRequest, OperationLog, WardRule
from ..schemas import ReplacementRequestCreate, ReplacementRequestReview, ReplacementRequestResponse
from ..utils.validators import validate_replacement_request, check_caregiver_limit, calculate_days_remaining

router = APIRouter(prefix="/api/replacements", tags=["replacements"])


def generate_request_no() -> str:
    today = date.today().strftime("%Y%m%d")
    timestamp = datetime.now().strftime("%H%M%S%f")[:8]
    return f"HR-{today}-{timestamp}"


def log_operation(db: Session, operation_type: str, operator: str, action: str, result: str,
                  patient_id: str = None, certificate_id: int = None,
                  old_value: str = None, new_value: str = None, notes: str = None):
    log = OperationLog(
        operation_type=operation_type,
        patient_id=patient_id,
        certificate_id=certificate_id,
        operator=operator,
        action=action,
        old_value=old_value,
        new_value=new_value,
        result=result,
        notes=notes
    )
    db.add(log)
    db.commit()


@router.post("", response_model=ReplacementRequestResponse)
def create_replacement_request(request_data: ReplacementRequestCreate, db: Session = Depends(get_db)):
    certificate = db.query(CareCertificate).filter(CareCertificate.id == request_data.certificate_id).first()
    if not certificate:
        raise HTTPException(status_code=404, detail="陪护证不存在")
    
    validation = validate_replacement_request(db, request_data.certificate_id)
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail={
            "error_code": validation["error_code"],
            "message": validation["message"],
            "details": validation.get("details")
        })
    
    patient = db.query(Patient).filter(Patient.patient_id == certificate.patient_id).first()
    old_caregiver = db.query(Caregiver).filter(Caregiver.caregiver_id == certificate.caregiver_id).first()
    
    request_no = generate_request_no()
    
    request = ReplacementRequest(
        request_no=request_no,
        certificate_id=request_data.certificate_id,
        patient_id=certificate.patient_id,
        old_caregiver_id=certificate.caregiver_id,
        new_caregiver_name=request_data.new_caregiver_name,
        new_caregiver_id_card=request_data.new_caregiver_id_card,
        new_caregiver_relation=request_data.new_caregiver_relation,
        new_caregiver_phone=request_data.new_caregiver_phone,
        reason=request_data.reason,
        requested_by=request_data.requested_by,
        status="pending"
    )
    
    db.add(request)
    db.commit()
    db.refresh(request)
    
    log_operation(
        db=db,
        operation_type="REPLACEMENT_REQUEST",
        operator=request_data.requested_by,
        action=f"提交换人申请: {request_no}",
        result="success",
        patient_id=certificate.patient_id,
        certificate_id=certificate.id,
        new_value=f"原陪护人: {old_caregiver.name if old_caregiver else '未知'} -> 新陪护人: {request_data.new_caregiver_name}",
        notes=request_data.reason
    )
    
    return {
        "id": request.id,
        "request_no": request.request_no,
        "certificate_id": request.certificate_id,
        "certificate_no": certificate.certificate_no,
        "patient_id": request.patient_id,
        "patient_name": patient.name if patient else None,
        "old_caregiver_id": request.old_caregiver_id,
        "old_caregiver_name": old_caregiver.name if old_caregiver else None,
        "new_caregiver_name": request.new_caregiver_name,
        "new_caregiver_id_card": request.new_caregiver_id_card,
        "new_caregiver_relation": request.new_caregiver_relation,
        "new_caregiver_phone": request.new_caregiver_phone,
        "reason": request.reason,
        "requested_by": request.requested_by,
        "request_date": request.request_date,
        "status": request.status,
        "approved_by": request.approved_by,
        "approval_date": request.approval_date,
        "approval_notes": request.approval_notes,
        "created_at": request.created_at,
        "updated_at": request.updated_at
    }


@router.get("", response_model=List[ReplacementRequestResponse])
def get_replacement_requests(
    status: Optional[str] = None,
    patient_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(ReplacementRequest)
    
    if status:
        query = query.filter(ReplacementRequest.status == status)
    
    if patient_id:
        query = query.filter(ReplacementRequest.patient_id == patient_id)
    
    requests = query.order_by(ReplacementRequest.created_at.desc()).offset(skip).limit(limit).all()
    
    results = []
    for req in requests:
        certificate = db.query(CareCertificate).filter(CareCertificate.id == req.certificate_id).first()
        patient = db.query(Patient).filter(Patient.patient_id == req.patient_id).first()
        old_caregiver = db.query(Caregiver).filter(Caregiver.caregiver_id == req.old_caregiver_id).first()
        
        results.append({
            "id": req.id,
            "request_no": req.request_no,
            "certificate_id": req.certificate_id,
            "certificate_no": certificate.certificate_no if certificate else None,
            "patient_id": req.patient_id,
            "patient_name": patient.name if patient else None,
            "old_caregiver_id": req.old_caregiver_id,
            "old_caregiver_name": old_caregiver.name if old_caregiver else None,
            "new_caregiver_name": req.new_caregiver_name,
            "new_caregiver_id_card": req.new_caregiver_id_card,
            "new_caregiver_relation": req.new_caregiver_relation,
            "new_caregiver_phone": req.new_caregiver_phone,
            "reason": req.reason,
            "requested_by": req.requested_by,
            "request_date": req.request_date,
            "status": req.status,
            "approved_by": req.approved_by,
            "approval_date": req.approval_date,
            "approval_notes": req.approval_notes,
            "created_at": req.created_at,
            "updated_at": req.updated_at
        })
    
    return results


@router.get("/{request_id}", response_model=ReplacementRequestResponse)
def get_replacement_request(request_id: int, db: Session = Depends(get_db)):
    request = db.query(ReplacementRequest).filter(ReplacementRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="换人申请不存在")
    
    certificate = db.query(CareCertificate).filter(CareCertificate.id == request.certificate_id).first()
    patient = db.query(Patient).filter(Patient.patient_id == request.patient_id).first()
    old_caregiver = db.query(Caregiver).filter(Caregiver.caregiver_id == request.old_caregiver_id).first()
    
    return {
        "id": request.id,
        "request_no": request.request_no,
        "certificate_id": request.certificate_id,
        "certificate_no": certificate.certificate_no if certificate else None,
        "patient_id": request.patient_id,
        "patient_name": patient.name if patient else None,
        "old_caregiver_id": request.old_caregiver_id,
        "old_caregiver_name": old_caregiver.name if old_caregiver else None,
        "new_caregiver_name": request.new_caregiver_name,
        "new_caregiver_id_card": request.new_caregiver_id_card,
        "new_caregiver_relation": request.new_caregiver_relation,
        "new_caregiver_phone": request.new_caregiver_phone,
        "reason": request.reason,
        "requested_by": request.requested_by,
        "request_date": request.request_date,
        "status": request.status,
        "approved_by": request.approved_by,
        "approval_date": request.approval_date,
        "approval_notes": request.approval_notes,
        "created_at": request.created_at,
        "updated_at": request.updated_at
    }


@router.post("/{request_id}/review", response_model=ReplacementRequestResponse)
def review_replacement_request(request_id: int, review_data: ReplacementRequestReview, db: Session = Depends(get_db)):
    request = db.query(ReplacementRequest).filter(ReplacementRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="换人申请不存在")
    
    if request.status != "pending":
        raise HTTPException(status_code=400, detail=f"申请已{request.status}，无法重复审批")
    
    certificate = db.query(CareCertificate).filter(CareCertificate.id == request.certificate_id).first()
    patient = db.query(Patient).filter(Patient.patient_id == request.patient_id).first()
    old_caregiver = db.query(Caregiver).filter(Caregiver.caregiver_id == request.old_caregiver_id).first()
    
    if review_data.status == "approved":
        new_caregiver_id = f"CG{request.new_caregiver_id_card[-8:]}"
        
        new_caregiver = db.query(Caregiver).filter(Caregiver.id_card == request.new_caregiver_id_card).first()
        if not new_caregiver:
            new_caregiver = Caregiver(
                caregiver_id=new_caregiver_id,
                name=request.new_caregiver_name,
                gender="未知",
                id_card=request.new_caregiver_id_card,
                relation_to_patient=request.new_caregiver_relation,
                phone=request.new_caregiver_phone
            )
            db.add(new_caregiver)
            db.flush()
        
        certificate.caregiver_id = new_caregiver.caregiver_id
        
        request.status = "approved"
        request.approved_by = review_data.approved_by
        request.approval_date = datetime.now()
        request.approval_notes = review_data.approval_notes
        
        log_operation(
            db=db,
            operation_type="REPLACEMENT_APPROVE",
            operator=review_data.approved_by,
            action=f"审批通过换人申请: {request.request_no}",
            result="success",
            patient_id=request.patient_id,
            certificate_id=certificate.id,
            old_value=f"陪护人: {old_caregiver.name if old_caregiver else '未知'}",
            new_value=f"陪护人: {request.new_caregiver_name}",
            notes=review_data.approval_notes
        )
    else:
        request.status = "rejected"
        request.approved_by = review_data.approved_by
        request.approval_date = datetime.now()
        request.approval_notes = review_data.approval_notes
        
        log_operation(
            db=db,
            operation_type="REPLACEMENT_REJECT",
            operator=review_data.approved_by,
            action=f"审批驳回换人申请: {request.request_no}",
            result="success",
            patient_id=request.patient_id,
            certificate_id=certificate.id,
            notes=review_data.approval_notes
        )
    
    db.commit()
    db.refresh(request)
    db.refresh(certificate)
    
    return {
        "id": request.id,
        "request_no": request.request_no,
        "certificate_id": request.certificate_id,
        "certificate_no": certificate.certificate_no if certificate else None,
        "patient_id": request.patient_id,
        "patient_name": patient.name if patient else None,
        "old_caregiver_id": request.old_caregiver_id,
        "old_caregiver_name": old_caregiver.name if old_caregiver else None,
        "new_caregiver_name": request.new_caregiver_name,
        "new_caregiver_id_card": request.new_caregiver_id_card,
        "new_caregiver_relation": request.new_caregiver_relation,
        "new_caregiver_phone": request.new_caregiver_phone,
        "reason": request.reason,
        "requested_by": request.requested_by,
        "request_date": request.request_date,
        "status": request.status,
        "approved_by": request.approved_by,
        "approval_date": request.approval_date,
        "approval_notes": request.approval_notes,
        "created_at": request.created_at,
        "updated_at": request.updated_at
    }
