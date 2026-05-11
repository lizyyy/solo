from datetime import datetime, date
import random
import string
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models import (
    Hospitalization, Pet, Cage, MedicalOrder,
    HospitalizationStatus, CageStatus, OrderStatus, InfectionRisk
)
from app.schemas import (
    Hospitalization as HospitalizationSchema, 
    HospitalizationCreate, HospitalizationUpdate, CageTransfer
)
from app.rules_engine import CageRulesEngine

router = APIRouter()


def generate_hospitalization_number() -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"HOSP-{timestamp}-{random_suffix}"


@router.post("/", response_model=HospitalizationSchema, status_code=status.HTTP_201_CREATED)
def create_hospitalization(hosp: HospitalizationCreate, db: Session = Depends(get_db)):
    pet = db.query(Pet).filter(Pet.id == hosp.pet_id).first()
    if not pet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"来源记录缺失：宠物ID {hosp.pet_id} 不存在"
        )
    
    cage = db.query(Cage).filter(Cage.id == hosp.cage_id).first()
    if not cage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"来源记录缺失：笼位ID {hosp.cage_id} 不存在"
        )
    
    medical_order = db.query(MedicalOrder).filter(MedicalOrder.id == hosp.medical_order_id).first()
    if not medical_order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"来源记录缺失：住院医嘱ID {hosp.medical_order_id} 不存在"
        )
    
    if medical_order.pet_id != hosp.pet_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"住院医嘱不属于该宠物"
        )
    
    active_hosp = db.query(Hospitalization).filter(
        Hospitalization.pet_id == hosp.pet_id,
        Hospitalization.status.in_([
            HospitalizationStatus.PENDING,
            HospitalizationStatus.ADMITTED,
            HospitalizationStatus.IN_TREATMENT
        ])
    ).first()
    
    if active_hosp:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"状态冲突：该宠物已有进行中的住院记录 (编号: {active_hosp.hospitalization_number})"
        )
    
    compatibility = CageRulesEngine.check_cage_compatibility(cage, pet, medical_order)
    if not compatibility.valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "笼位兼容性检查失败",
                "violations": compatibility.violations
            }
        )
    
    hosp_number = generate_hospitalization_number()
    
    db_hosp = Hospitalization(
        hospitalization_number=hosp_number,
        pet_id=hosp.pet_id,
        cage_id=hosp.cage_id,
        medical_order_id=hosp.medical_order_id,
        current_infection_risk=medical_order.infection_risk,
        notes=hosp.notes
    )
    
    cage.status = CageStatus.OCCUPIED
    cage.current_pet_id = hosp.pet_id
    
    medical_order.status = OrderStatus.IN_PROGRESS
    
    db.add(db_hosp)
    db.commit()
    db.refresh(db_hosp)
    
    return db_hosp


@router.post("/{hosp_id}/admit")
def admit_patient(hosp_id: int, db: Session = Depends(get_db)):
    hosp = db.query(Hospitalization).filter(Hospitalization.id == hosp_id).first()
    if not hosp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"住院记录ID {hosp_id} 不存在"
        )
    
    if hosp.status != HospitalizationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"状态冲突：当前状态为 {hosp.status}，无法执行入院操作"
        )
    
    hosp.status = HospitalizationStatus.ADMITTED
    hosp.admission_date = datetime.utcnow()
    
    db.commit()
    db.refresh(hosp)
    
    return {
        "message": "入院成功",
        "hospitalization_number": hosp.hospitalization_number,
        "status": hosp.status,
        "admission_date": hosp.admission_date
    }


@router.post("/{hosp_id}/start-treatment")
def start_treatment(hosp_id: int, db: Session = Depends(get_db)):
    hosp = db.query(Hospitalization).filter(Hospitalization.id == hosp_id).first()
    if not hosp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"住院记录ID {hosp_id} 不存在"
        )
    
    if hosp.status != HospitalizationStatus.ADMITTED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"状态冲突：当前状态为 {hosp.status}，无法开始治疗"
        )
    
    hosp.status = HospitalizationStatus.IN_TREATMENT
    
    db.commit()
    db.refresh(hosp)
    
    return {
        "message": "治疗开始",
        "hospitalization_number": hosp.hospitalization_number,
        "status": hosp.status
    }


@router.post("/{hosp_id}/transfer")
def transfer_cage(hosp_id: int, transfer: CageTransfer, db: Session = Depends(get_db)):
    hosp = db.query(Hospitalization).filter(Hospitalization.id == hosp_id).first()
    if not hosp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"住院记录ID {hosp_id} 不存在"
        )
    
    if hosp.status not in [HospitalizationStatus.ADMITTED, HospitalizationStatus.IN_TREATMENT]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"状态冲突：当前状态为 {hosp.status}，无法执行转笼操作"
        )
    
    source_cage = db.query(Cage).filter(Cage.id == hosp.cage_id).first()
    target_cage = db.query(Cage).filter(Cage.id == transfer.new_cage_id).first()
    
    if not target_cage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"来源记录缺失：目标笼位ID {transfer.new_cage_id} 不存在"
        )
    
    medical_order = db.query(MedicalOrder).filter(MedicalOrder.id == hosp.medical_order_id).first()
    pet = db.query(Pet).filter(Pet.id == hosp.pet_id).first()
    
    compatibility = CageRulesEngine.check_transfer_compatibility(
        source_cage, target_cage, pet, medical_order
    )
    
    if not compatibility.valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "转笼兼容性检查失败",
                "violations": compatibility.violations
            }
        )
    
    transfer_record = {
        "timestamp": datetime.utcnow().isoformat(),
        "from_cage": source_cage.cage_number,
        "to_cage": target_cage.cage_number,
        "reason": transfer.reason
    }
    
    import json
    existing_history = json.loads(hosp.transfer_history) if hosp.transfer_history else []
    existing_history.append(transfer_record)
    
    source_cage.status = CageStatus.AVAILABLE
    source_cage.current_pet_id = None
    
    target_cage.status = CageStatus.OCCUPIED
    target_cage.current_pet_id = hosp.pet_id
    
    hosp.cage_id = transfer.new_cage_id
    hosp.status = HospitalizationStatus.TRANSFERRED
    hosp.transfer_history = json.dumps(existing_history, ensure_ascii=False)
    
    db.commit()
    db.refresh(hosp)
    
    return {
        "message": "转笼成功",
        "hospitalization_number": hosp.hospitalization_number,
        "from_cage": source_cage.cage_number,
        "to_cage": target_cage.cage_number,
        "warnings": compatibility.warnings
    }


@router.post("/{hosp_id}/discharge")
def discharge_patient(hosp_id: int, db: Session = Depends(get_db)):
    hosp = db.query(Hospitalization).filter(Hospitalization.id == hosp_id).first()
    if not hosp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"住院记录ID {hosp_id} 不存在"
        )
    
    if hosp.status not in [
        HospitalizationStatus.ADMITTED, 
        HospitalizationStatus.IN_TREATMENT,
        HospitalizationStatus.TRANSFERRED
    ]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"状态冲突：当前状态为 {hosp.status}，无法执行出院操作"
        )
    
    cage = db.query(Cage).filter(Cage.id == hosp.cage_id).first()
    medical_order = db.query(MedicalOrder).filter(MedicalOrder.id == hosp.medical_order_id).first()
    
    cage.status = CageStatus.AVAILABLE
    cage.current_pet_id = None
    
    medical_order.status = OrderStatus.COMPLETED
    
    hosp.status = HospitalizationStatus.DISCHARGED
    hosp.discharge_date = datetime.utcnow()
    
    db.commit()
    db.refresh(hosp)
    
    return {
        "message": "出院成功",
        "hospitalization_number": hosp.hospitalization_number,
        "discharge_date": hosp.discharge_date
    }


@router.post("/{hosp_id}/cancel")
def cancel_hospitalization(hosp_id: int, db: Session = Depends(get_db)):
    hosp = db.query(Hospitalization).filter(Hospitalization.id == hosp_id).first()
    if not hosp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"住院记录ID {hosp_id} 不存在"
        )
    
    if hosp.status != HospitalizationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"状态冲突：当前状态为 {hosp.status}，只有待入院状态可以取消"
        )
    
    cage = db.query(Cage).filter(Cage.id == hosp.cage_id).first()
    medical_order = db.query(MedicalOrder).filter(MedicalOrder.id == hosp.medical_order_id).first()
    
    cage.status = CageStatus.AVAILABLE
    cage.current_pet_id = None
    
    medical_order.status = OrderStatus.CANCELLED
    
    hosp.status = HospitalizationStatus.CANCELLED
    
    db.commit()
    db.refresh(hosp)
    
    return {
        "message": "住院记录已取消",
        "hospitalization_number": hosp.hospitalization_number
    }


@router.put("/{hosp_id}/revise")
def revise_hospitalization(
    hosp_id: int, 
    hosp_update: HospitalizationUpdate,
    db: Session = Depends(get_db)
):
    hosp = db.query(Hospitalization).filter(Hospitalization.id == hosp_id).first()
    if not hosp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"住院记录ID {hosp_id} 不存在"
        )
    
    if hosp.status in [HospitalizationStatus.DISCHARGED, HospitalizationStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"状态冲突：已出院或已取消的记录无法修正"
        )
    
    update_data = hosp_update.model_dump(exclude_unset=True)
    
    if "status" in update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"修正操作不允许修改状态，请使用专用的状态推进接口"
        )
    
    for key, value in update_data.items():
        setattr(hosp, key, value)
    
    db.commit()
    db.refresh(hosp)
    
    return {
        "message": "记录已修正",
        "hospitalization_number": hosp.hospitalization_number,
        "updated_fields": list(update_data.keys())
    }


@router.get("/", response_model=List[HospitalizationSchema])
def get_hospitalizations(
    skip: int = 0,
    limit: int = 100,
    pet_id: Optional[int] = None,
    status: Optional[str] = None,
    infection_risk: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Hospitalization)
    
    if pet_id:
        query = query.filter(Hospitalization.pet_id == pet_id)
    
    if status:
        query = query.filter(Hospitalization.status == status)
    
    if infection_risk:
        query = query.filter(Hospitalization.current_infection_risk == infection_risk)
    
    return query.order_by(Hospitalization.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{hosp_id}", response_model=HospitalizationSchema)
def get_hospitalization(hosp_id: int, db: Session = Depends(get_db)):
    hosp = db.query(Hospitalization).filter(Hospitalization.id == hosp_id).first()
    if not hosp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"住院记录ID {hosp_id} 不存在"
        )
    return hosp


@router.get("/{hosp_id}/detail")
def get_hospitalization_detail(hosp_id: int, db: Session = Depends(get_db)):
    hosp = db.query(Hospitalization).filter(Hospitalization.id == hosp_id).first()
    if not hosp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"住院记录ID {hosp_id} 不存在"
        )
    
    pet = db.query(Pet).filter(Pet.id == hosp.pet_id).first()
    cage = db.query(Cage).filter(Cage.id == hosp.cage_id).first()
    medical_order = db.query(MedicalOrder).filter(MedicalOrder.id == hosp.medical_order_id).first()
    
    import json
    transfer_history = json.loads(hosp.transfer_history) if hosp.transfer_history else []
    
    return {
        "hospitalization": {
            "id": hosp.id,
            "number": hosp.hospitalization_number,
            "status": hosp.status,
            "infection_risk": hosp.current_infection_risk,
            "admission_date": hosp.admission_date,
            "discharge_date": hosp.discharge_date,
            "notes": hosp.notes
        },
        "pet": {
            "id": pet.id,
            "name": pet.name,
            "species": pet.species.value,
            "breed": pet.breed,
            "owner_name": pet.owner_name
        },
        "cage": {
            "id": cage.id,
            "number": cage.cage_number,
            "location": cage.location,
            "is_isolation": cage.is_isolation
        },
        "medical_order": {
            "id": medical_order.id,
            "number": medical_order.order_number,
            "diagnosis": medical_order.diagnosis,
            "treatment_plan": medical_order.treatment_plan,
            "attending_vet": medical_order.attending_vet
        },
        "transfer_history": transfer_history
    }
