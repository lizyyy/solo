from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import uuid

from database import get_db, init_db
from models import QueueEntry, Prescription, User, DecoctionPot, StatusHistory, SamePotGroup
from schemas import (
    QueueEntryResponse, QueueEntryDetail, StatusHistoryResponse,
    PrescriptionCreate, ActionRequest, AssignPotRequest,
    CancellationRequest, ExceptionHandleRequest, SamePotGroupResponse
)
from state_machine import StateMachine, StateTransitionError

app = FastAPI(title="中药代煎房代煎处方排队API", version="1.0.0")


@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/")
def root():
    return {
        "message": "中药代煎房代煎处方排队API系统",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/queue/", response_model=List[QueueEntryDetail])
def get_queue(status: str = None, db: Session = Depends(get_db)):
    query = db.query(
        QueueEntry, Prescription
    ).join(Prescription, QueueEntry.prescription_id == Prescription.id)
    
    if status:
        query = query.filter(QueueEntry.status == status)
    
    results = query.order_by(QueueEntry.queue_position.asc(), QueueEntry.created_at.desc()).all()
    
    return [
        {
            "id": qe.id,
            "queue_no": qe.queue_no,
            "prescription_id": qe.prescription_id,
            "status": qe.status,
            "pot_id": qe.pot_id,
            "queue_position": qe.queue_position,
            "is_same_pot": qe.is_same_pot,
            "same_pot_group_id": qe.same_pot_group_id,
            "cancellation_requested": qe.cancellation_requested,
            "exception_flag": qe.exception_flag,
            "created_at": qe.created_at,
            "updated_at": qe.updated_at,
            "patient_name": p.patient_name,
            "prescription_no": p.prescription_no,
            "total_doses": p.total_doses,
            "diagnosis": p.diagnosis,
            "doctor_name": p.doctor_name,
        }
        for qe, p in results
    ]


@app.get("/queue/{queue_id}", response_model=QueueEntryDetail)
def get_queue_entry(queue_id: int, db: Session = Depends(get_db)):
    result = db.query(
        QueueEntry, Prescription
    ).join(Prescription, QueueEntry.prescription_id == Prescription.id
    ).filter(QueueEntry.id == queue_id).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="排队记录不存在")
    
    qe, p = result
    return {
        "id": qe.id,
        "queue_no": qe.queue_no,
        "prescription_id": qe.prescription_id,
        "status": qe.status,
        "pot_id": qe.pot_id,
        "queue_position": qe.queue_position,
        "is_same_pot": qe.is_same_pot,
        "same_pot_group_id": qe.same_pot_group_id,
        "cancellation_requested": qe.cancellation_requested,
        "exception_flag": qe.exception_flag,
        "created_at": qe.created_at,
        "updated_at": qe.updated_at,
        "patient_name": p.patient_name,
        "prescription_no": p.prescription_no,
        "total_doses": p.total_doses,
        "diagnosis": p.diagnosis,
        "doctor_name": p.doctor_name,
    }


@app.get("/queue/{queue_id}/history", response_model=List[StatusHistoryResponse])
def get_status_history(queue_id: int, db: Session = Depends(get_db)):
    histories = db.query(StatusHistory).filter(
        StatusHistory.queue_entry_id == queue_id
    ).order_by(StatusHistory.created_at.desc()).all()
    return histories


@app.post("/prescriptions/", status_code=201)
def create_prescription(prescription: PrescriptionCreate, db: Session = Depends(get_db)):
    db_prescription = Prescription(**prescription.model_dump())
    db.add(db_prescription)
    db.flush()
    
    queue_no = f"DJ{datetime.now().strftime('%Y%m%d')}{str(db_prescription.id).zfill(4)}"
    
    queue_entry = QueueEntry(
        queue_no=queue_no,
        prescription_id=db_prescription.id,
        status="待排队",
        updated_by=prescription.submitted_by,
    )
    db.add(queue_entry)
    db.commit()
    db.refresh(queue_entry)
    
    return {"prescription_id": db_prescription.id, "queue_no": queue_no}


@app.post("/queue/{queue_id}/enqueue", response_model=QueueEntryResponse)
def enqueue(queue_id: int, request: ActionRequest, db: Session = Depends(get_db)):
    queue_entry = db.query(QueueEntry).filter(QueueEntry.id == queue_id).first()
    if not queue_entry:
        raise HTTPException(status_code=404, detail="排队记录不存在")
    
    sm = StateMachine(db)
    try:
        max_position = db.query(QueueEntry).filter(
            QueueEntry.status == "已排队"
        ).count()
        queue_entry.queue_position = max_position + 1
        
        result = sm.transition(queue_entry, "排队登记", request.performed_by, notes=request.notes)
        db.commit()
        db.refresh(result)
        return result
    except StateTransitionError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/queue/{queue_id}/assign-pot", response_model=QueueEntryResponse)
def assign_pot(queue_id: int, request: AssignPotRequest, db: Session = Depends(get_db)):
    queue_entry = db.query(QueueEntry).filter(QueueEntry.id == queue_id).first()
    if not queue_entry:
        raise HTTPException(status_code=404, detail="排队记录不存在")
    
    pot = db.query(DecoctionPot).filter(DecoctionPot.id == request.pot_id).first()
    if not pot:
        raise HTTPException(status_code=404, detail="煎锅不存在")
    
    prescription = db.query(Prescription).filter(Prescription.id == queue_entry.prescription_id).first()
    
    sm = StateMachine(db)
    try:
        if request.same_pot_group_id:
            valid, msg = sm.validate_same_pot_assignment(request.pot_id, prescription.decoction_type)
            if not valid:
                raise HTTPException(status_code=400, detail=msg)
            queue_entry.is_same_pot = True
            queue_entry.same_pot_group_id = request.same_pot_group_id
            
            group = db.query(SamePotGroup).filter(
                SamePotGroup.group_id == request.same_pot_group_id
            ).first()
            if group:
                group.active_prescriptions += 1
                group.total_prescriptions += 1
        else:
            group_id = f"SP{datetime.now().strftime('%Y%m%d%H%M%S')}"
            new_group = SamePotGroup(
                group_id=group_id,
                pot_id=request.pot_id,
                status="已分配锅次",
                total_prescriptions=1,
                active_prescriptions=1,
                created_by=request.performed_by
            )
            db.add(new_group)
            db.flush()
            queue_entry.is_same_pot = True
            queue_entry.same_pot_group_id = group_id
        
        queue_entry.pot_id = request.pot_id
        result = sm.transition(queue_entry, "分配锅次", request.performed_by, notes=request.notes)
        db.commit()
        db.refresh(result)
        return result
    except StateTransitionError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/queue/{queue_id}/start-boiling", response_model=QueueEntryResponse)
def start_boiling(queue_id: int, request: ActionRequest, db: Session = Depends(get_db)):
    queue_entry = db.query(QueueEntry).filter(QueueEntry.id == queue_id).first()
    if not queue_entry:
        raise HTTPException(status_code=404, detail="排队记录不存在")
    
    sm = StateMachine(db)
    try:
        queue_entry.actual_start_time = datetime.now()
        result = sm.transition(queue_entry, "开始煎煮", request.performed_by, notes=request.notes)
        db.commit()
        db.refresh(result)
        return result
    except StateTransitionError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/queue/{queue_id}/complete-boiling", response_model=QueueEntryResponse)
def complete_boiling(queue_id: int, request: ActionRequest, db: Session = Depends(get_db)):
    queue_entry = db.query(QueueEntry).filter(QueueEntry.id == queue_id).first()
    if not queue_entry:
        raise HTTPException(status_code=404, detail="排队记录不存在")
    
    sm = StateMachine(db)
    try:
        result = sm.transition(queue_entry, "完成煎煮", request.performed_by, notes=request.notes)
        db.commit()
        db.refresh(result)
        return result
    except StateTransitionError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/queue/{queue_id}/start-packing", response_model=QueueEntryResponse)
def start_packing(queue_id: int, request: ActionRequest, db: Session = Depends(get_db)):
    queue_entry = db.query(QueueEntry).filter(QueueEntry.id == queue_id).first()
    if not queue_entry:
        raise HTTPException(status_code=404, detail="排队记录不存在")
    
    sm = StateMachine(db)
    try:
        result = sm.transition(queue_entry, "开始包装", request.performed_by, notes=request.notes)
        db.commit()
        db.refresh(result)
        return result
    except StateTransitionError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/queue/{queue_id}/complete-packing", response_model=QueueEntryResponse)
def complete_packing(queue_id: int, request: ActionRequest, db: Session = Depends(get_db)):
    queue_entry = db.query(QueueEntry).filter(QueueEntry.id == queue_id).first()
    if not queue_entry:
        raise HTTPException(status_code=404, detail="排队记录不存在")
    
    sm = StateMachine(db)
    try:
        queue_entry.completed_at = datetime.now()
        result = sm.transition(queue_entry, "完成包装", request.performed_by, notes=request.notes)
        db.commit()
        db.refresh(result)
        return result
    except StateTransitionError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/queue/{queue_id}/request-cancellation", response_model=QueueEntryResponse)
def request_cancellation(queue_id: int, request: CancellationRequest, db: Session = Depends(get_db)):
    queue_entry = db.query(QueueEntry).filter(QueueEntry.id == queue_id).first()
    if not queue_entry:
        raise HTTPException(status_code=404, detail="排队记录不存在")
    
    sm = StateMachine(db)
    try:
        result = sm.transition(
            queue_entry, "申请取消", request.performed_by, notes=request.notes, reason=request.reason
        )
        db.commit()
        db.refresh(result)
        return result
    except StateTransitionError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/queue/{queue_id}/confirm-cancellation", response_model=QueueEntryResponse)
def confirm_cancellation(queue_id: int, request: ActionRequest, db: Session = Depends(get_db)):
    queue_entry = db.query(QueueEntry).filter(QueueEntry.id == queue_id).first()
    if not queue_entry:
        raise HTTPException(status_code=404, detail="排队记录不存在")
    
    if not queue_entry.cancellation_requested:
        raise HTTPException(status_code=400, detail="该处方未申请取消")
    
    sm = StateMachine(db)
    try:
        result = sm.transition(queue_entry, "确认取消", request.performed_by, notes=request.notes)
        db.commit()
        db.refresh(result)
        return result
    except StateTransitionError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/queue/{queue_id}/mark-exception", response_model=QueueEntryResponse)
def mark_exception(queue_id: int, request: ExceptionHandleRequest, db: Session = Depends(get_db)):
    queue_entry = db.query(QueueEntry).filter(QueueEntry.id == queue_id).first()
    if not queue_entry:
        raise HTTPException(status_code=404, detail="排队记录不存在")
    
    sm = StateMachine(db)
    try:
        result = sm.transition(
            queue_entry, "标记异常", request.performed_by,
            notes=request.notes, exception_notes=request.exception_notes
        )
        db.commit()
        db.refresh(result)
        return result
    except StateTransitionError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/queue/{queue_id}/handle-exception", response_model=QueueEntryResponse)
def handle_exception(queue_id: int, request: ExceptionHandleRequest, db: Session = Depends(get_db)):
    queue_entry = db.query(QueueEntry).filter(QueueEntry.id == queue_id).first()
    if not queue_entry:
        raise HTTPException(status_code=404, detail="排队记录不存在")
    
    if not queue_entry.exception_flag:
        raise HTTPException(status_code=400, detail="该处方未标记异常")
    
    sm = StateMachine(db)
    try:
        result = sm.transition(
            queue_entry, "处理异常", request.performed_by,
            target_status=request.new_status,
            notes=request.notes, exception_notes=request.exception_notes
        )
        queue_entry.exception_flag = False
        queue_entry.exception_handled_by = request.performed_by
        queue_entry.exception_handled_at = datetime.now()
        db.commit()
        db.refresh(result)
        return result
    except StateTransitionError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/same-pot-groups/", response_model=List[SamePotGroupResponse])
def get_same_pot_groups(db: Session = Depends(get_db)):
    groups = db.query(SamePotGroup).all()
    result = []
    
    for group in groups:
        entries = db.query(QueueEntry, Prescription).join(
            Prescription, QueueEntry.prescription_id == Prescription.id
        ).filter(QueueEntry.same_pot_group_id == group.group_id).all()
        
        prescriptions = []
        for qe, p in entries:
            prescriptions.append({
                "id": qe.id,
                "queue_no": qe.queue_no,
                "prescription_id": qe.prescription_id,
                "status": qe.status,
                "pot_id": qe.pot_id,
                "queue_position": qe.queue_position,
                "is_same_pot": qe.is_same_pot,
                "same_pot_group_id": qe.same_pot_group_id,
                "cancellation_requested": qe.cancellation_requested,
                "exception_flag": qe.exception_flag,
                "created_at": qe.created_at,
                "updated_at": qe.updated_at,
                "patient_name": p.patient_name,
                "prescription_no": p.prescription_no,
                "total_doses": p.total_doses,
                "diagnosis": p.diagnosis,
                "doctor_name": p.doctor_name,
            })
        
        result.append({
            "group_id": group.group_id,
            "pot_id": group.pot_id,
            "status": group.status,
            "total_prescriptions": group.total_prescriptions,
            "active_prescriptions": group.active_prescriptions,
            "prescriptions": prescriptions
        })
    
    return result


@app.get("/users/allowed-actions/{queue_id}")
def get_allowed_actions(queue_id: int, username: str, db: Session = Depends(get_db)):
    queue_entry = db.query(QueueEntry).filter(QueueEntry.id == queue_id).first()
    if not queue_entry:
        raise HTTPException(status_code=404, detail="排队记录不存在")
    
    sm = StateMachine(db)
    try:
        actions = sm.get_allowed_actions(queue_entry, username)
        return {"allowed_actions": actions}
    except StateTransitionError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/rules/")
def get_rules():
    from state_machine import StateMachine
    return {"rules": StateMachine.RULES}
