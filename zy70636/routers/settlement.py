from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import json
from database import get_db
from models import Settlement as SettlementModel, WeighingRecord as WeighingModel
from models import Customer as CustomerModel, Price as PriceModel, AuditLog as AuditModel
from models import AuditType, OperationType
from schemas import Settlement, SettlementCreate, SettlementReview, APIResponse, Weighing

router = APIRouter()


def create_audit_log(db: Session, weighing_id: int, operation_type: str, 
                     original_data: dict, new_data: dict, operator: str, conclusion: str):
    audit = AuditModel(
        weighing_id=weighing_id,
        operation_type=operation_type,
        original_data=json.dumps(original_data) if original_data else None,
        new_data=json.dumps(new_data) if new_data else None,
        operator=operator,
        conclusion=conclusion,
        created_at=datetime.utcnow()
    )
    db.add(audit)


@router.post("/", response_model=APIResponse)
def create_settlement(settlement: SettlementCreate, db: Session = Depends(get_db)):
    existing = db.query(SettlementModel).filter(
        SettlementModel.settlement_no == settlement.settlement_no
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="结算单号已存在")
    
    customer = db.query(CustomerModel).filter(CustomerModel.id == settlement.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")
    
    weighings = db.query(WeighingModel).filter(
        WeighingModel.id.in_(settlement.weighing_ids)
    ).all()
    
    if len(weighings) != len(settlement.weighing_ids):
        missing_ids = set(settlement.weighing_ids) - {w.id for w in weighings}
        raise HTTPException(status_code=404, detail=f"称重记录不存在: {missing_ids}")
    
    for w in weighings:
        if w.customer_id != settlement.customer_id:
            raise HTTPException(status_code=400, detail=f"称重记录 {w.id} 不属于当前客户")
        if w.settlement_id:
            raise HTTPException(status_code=400, detail=f"称重记录 {w.id} 已结算，重复结算拦截")
        if w.status == AuditType.CLOSED or w.status == AuditType.CANCELLED:
            raise HTTPException(status_code=400, detail=f"称重记录 {w.id} 已关闭或取消")
        if w.status != AuditType.DEDUCTED:
            raise HTTPException(status_code=400, detail=f"称重记录 {w.id} 未完成扣杂，无法结算")
    
    total_weight = 0
    total_amount = 0
    
    for w in weighings:
        if not w.price_id:
            raise HTTPException(status_code=400, detail=f"称重记录 {w.id} 未设置价格")
        
        price = db.query(PriceModel).filter(PriceModel.id == w.price_id).first()
        if not price:
            raise HTTPException(status_code=404, detail=f"价格不存在: {w.price_id}")
        
        total_weight += w.final_weight
        total_amount += w.final_weight * price.price
    
    db_settlement = SettlementModel(
        settlement_no=settlement.settlement_no,
        customer_id=settlement.customer_id,
        total_weight=total_weight,
        total_amount=total_amount,
        status=AuditType.SETTLED,
        settled_by=settlement.settled_by,
        settled_at=datetime.utcnow()
    )
    db.add(db_settlement)
    db.flush()
    
    for w in weighings:
        original_data = {
            "settlement_id": w.settlement_id,
            "status": w.status
        }
        
        w.settlement_id = db_settlement.id
        w.status = AuditType.SETTLED
        
        create_audit_log(
            db=db,
            weighing_id=w.id,
            operation_type=OperationType.SETTLE,
            original_data=original_data,
            new_data={
                "settlement_id": db_settlement.id,
                "status": AuditType.SETTLED,
                "settlement_no": settlement.settlement_no
            },
            operator=settlement.settled_by,
            conclusion=f"结算成功，结算单号: {settlement.settlement_no}"
        )
    
    db.commit()
    db.refresh(db_settlement)
    
    return APIResponse(
        success=True, 
        message="结算成功", 
        data={
            "settlement": Settlement.model_validate(db_settlement).model_dump(),
            "weighing_count": len(weighings),
            "total_weight": total_weight,
            "total_amount": total_amount
        }
    )


@router.get("/", response_model=List[Settlement])
def list_settlements(customer_id: int = None, status: str = None, 
                     skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(SettlementModel)
    if customer_id:
        query = query.filter(SettlementModel.customer_id == customer_id)
    if status:
        query = query.filter(SettlementModel.status == status)
    settlements = query.order_by(SettlementModel.created_at.desc()).offset(skip).limit(limit).all()
    return settlements


@router.get("/{settlement_id}", response_model=Settlement)
def get_settlement(settlement_id: int, db: Session = Depends(get_db)):
    settlement = db.query(SettlementModel).filter(SettlementModel.id == settlement_id).first()
    if not settlement:
        raise HTTPException(status_code=404, detail="结算记录不存在")
    return settlement


@router.get("/{settlement_id}/weighings", response_model=List[Weighing])
def get_settlement_weighings(settlement_id: int, db: Session = Depends(get_db)):
    settlement = db.query(SettlementModel).filter(SettlementModel.id == settlement_id).first()
    if not settlement:
        raise HTTPException(status_code=404, detail="结算记录不存在")
    
    weighings = db.query(WeighingModel).filter(WeighingModel.settlement_id == settlement_id).all()
    return weighings


@router.post("/{settlement_id}/review", response_model=APIResponse)
def review_settlement(settlement_id: int, data: SettlementReview, db: Session = Depends(get_db)):
    settlement = db.query(SettlementModel).filter(SettlementModel.id == settlement_id).first()
    if not settlement:
        raise HTTPException(status_code=404, detail="结算记录不存在")
    
    if settlement.status == AuditType.REVIEWED:
        raise HTTPException(status_code=400, detail="结算已复核，不能重复复核")
    
    if settlement.status == AuditType.CLOSED or settlement.status == AuditType.CANCELLED:
        raise HTTPException(status_code=400, detail="结算已关闭或取消")
    
    original_data = {
        "status": settlement.status,
        "reviewed_by": settlement.reviewed_by,
        "reviewed_at": settlement.reviewed_at.isoformat() if settlement.reviewed_at else None
    }
    
    if data.approved:
        settlement.status = AuditType.REVIEWED
        settlement.reviewed_by = data.reviewed_by
        settlement.reviewed_at = datetime.utcnow()
        conclusion = f"复核通过: {data.remarks}" if data.remarks else "复核通过"
    else:
        conclusion = f"复核驳回: {data.remarks}" if data.remarks else "复核驳回"
    
    weighings = db.query(WeighingModel).filter(WeighingModel.settlement_id == settlement_id).all()
    for w in weighings:
        w_original = {"status": w.status}
        if data.approved:
            w.status = AuditType.REVIEWED
        create_audit_log(
            db=db,
            weighing_id=w.id,
            operation_type=OperationType.STATUS_CHANGE,
            original_data=w_original,
            new_data={"status": w.status},
            operator=data.reviewed_by,
            conclusion=conclusion
        )
    
    db.commit()
    db.refresh(settlement)
    
    return APIResponse(
        success=True, 
        message=conclusion, 
        data={"settlement": Settlement.model_validate(settlement).model_dump()}
    )
