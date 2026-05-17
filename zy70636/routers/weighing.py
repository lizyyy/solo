from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import json
from database import get_db
from models import WeighingRecord as WeighingModel, Customer as CustomerModel, Category as CategoryModel
from models import Price as PriceModel, DeductionRatio as DeductionModel, AuditLog as AuditModel
from models import AuditType, OperationType
from schemas import Weighing, WeighingCreate, WeighingPrice, WeighingDeduction
from schemas import WeighingManualCorrection, WeighingClose, APIResponse
from audit_utils import create_audit_log, log_failed_operation

router = APIRouter()


@router.post("/", response_model=APIResponse)
def create_weighing(weighing: WeighingCreate, db: Session = Depends(get_db)):
    input_data = weighing.model_dump()
    
    existing = db.query(WeighingModel).filter(WeighingModel.record_no == weighing.record_no).first()
    if existing:
        log_failed_operation(
            db=db,
            operation_type=OperationType.CREATE,
            input_data=input_data,
            operator=weighing.created_by,
            error_message="称重单号已存在"
        )
        raise HTTPException(status_code=400, detail="称重单号已存在")
    
    customer = db.query(CustomerModel).filter(CustomerModel.id == weighing.customer_id).first()
    if not customer:
        log_failed_operation(
            db=db,
            operation_type=OperationType.CREATE,
            input_data=input_data,
            operator=weighing.created_by,
            error_message="客户不存在"
        )
        raise HTTPException(status_code=404, detail="客户不存在")
    
    category = db.query(CategoryModel).filter(CategoryModel.id == weighing.category_id).first()
    if not category:
        log_failed_operation(
            db=db,
            operation_type=OperationType.CREATE,
            input_data=input_data,
            operator=weighing.created_by,
            error_message="品类不存在"
        )
        raise HTTPException(status_code=404, detail="品类不存在")
    
    if weighing.gross_weight <= 0:
        log_failed_operation(
            db=db,
            operation_type=OperationType.CREATE,
            input_data=input_data,
            operator=weighing.created_by,
            error_message="毛重必须大于0"
        )
        raise HTTPException(status_code=400, detail="毛重必须大于0")
    if weighing.tare_weight < 0:
        log_failed_operation(
            db=db,
            operation_type=OperationType.CREATE,
            input_data=input_data,
            operator=weighing.created_by,
            error_message="皮重不能为负数"
        )
        raise HTTPException(status_code=400, detail="皮重不能为负数")
    if weighing.gross_weight <= weighing.tare_weight:
        log_failed_operation(
            db=db,
            operation_type=OperationType.CREATE,
            input_data=input_data,
            operator=weighing.created_by,
            error_message="毛重必须大于皮重"
        )
        raise HTTPException(status_code=400, detail="毛重必须大于皮重")
    
    net_weight = weighing.gross_weight - weighing.tare_weight
    
    db_weighing = WeighingModel(
        **weighing.model_dump(),
        net_weight=net_weight,
        status=AuditType.WEIGHED,
        weighed_at=datetime.utcnow()
    )
    db.add(db_weighing)
    db.flush()
    
    create_audit_log(
        db=db,
        weighing_id=db_weighing.id,
        operation_type=OperationType.CREATE,
        original_data=None,
        new_data={
            "record_no": weighing.record_no,
            "gross_weight": weighing.gross_weight,
            "tare_weight": weighing.tare_weight,
            "net_weight": net_weight
        },
        operator=weighing.created_by,
        conclusion="称重记录创建成功",
        is_success=True
    )
    
    db.commit()
    db.refresh(db_weighing)
    return APIResponse(success=True, message="称重记录创建成功", data={"weighing": Weighing.model_validate(db_weighing).model_dump()})


@router.get("/", response_model=List[Weighing])
def list_weighings(customer_id: int = None, category_id: int = None, 
                   status: str = None, skip: int = 0, limit: int = 100, 
                   db: Session = Depends(get_db)):
    query = db.query(WeighingModel)
    if customer_id:
        query = query.filter(WeighingModel.customer_id == customer_id)
    if category_id:
        query = query.filter(WeighingModel.category_id == category_id)
    if status:
        query = query.filter(WeighingModel.status == status)
    weighings = query.order_by(WeighingModel.created_at.desc()).offset(skip).limit(limit).all()
    return weighings


@router.get("/{weighing_id}", response_model=Weighing)
def get_weighing(weighing_id: int, db: Session = Depends(get_db)):
    weighing = db.query(WeighingModel).filter(WeighingModel.id == weighing_id).first()
    if not weighing:
        raise HTTPException(status_code=404, detail="称重记录不存在")
    return weighing


@router.post("/{weighing_id}/set-price", response_model=APIResponse)
def set_price(weighing_id: int, data: WeighingPrice, db: Session = Depends(get_db)):
    input_data = data.model_dump()
    input_data["weighing_id"] = weighing_id
    
    weighing = db.query(WeighingModel).filter(WeighingModel.id == weighing_id).first()
    if not weighing:
        log_failed_operation(
            db=db,
            operation_type=OperationType.UPDATE,
            input_data=input_data,
            operator=data.operator,
            error_message="称重记录不存在"
        )
        raise HTTPException(status_code=404, detail="称重记录不存在")
    
    if weighing.status == AuditType.CLOSED or weighing.status == AuditType.CANCELLED:
        log_failed_operation(
            db=db,
            operation_type=OperationType.UPDATE,
            input_data=input_data,
            operator=data.operator,
            error_message="称重记录已关闭或取消，无法修改",
            weighing_id=weighing_id
        )
        raise HTTPException(status_code=400, detail="称重记录已关闭或取消，无法修改")
    
    price = db.query(PriceModel).filter(PriceModel.id == data.price_id).first()
    if not price:
        log_failed_operation(
            db=db,
            operation_type=OperationType.UPDATE,
            input_data=input_data,
            operator=data.operator,
            error_message="价格不存在",
            weighing_id=weighing_id
        )
        raise HTTPException(status_code=404, detail="价格不存在")
    
    original_data = {
        "price_id": weighing.price_id,
        "status": weighing.status
    }
    
    weighing.price_id = data.price_id
    weighing.status = AuditType.PRICED
    
    create_audit_log(
        db=db,
        weighing_id=weighing_id,
        operation_type=OperationType.STATUS_CHANGE,
        original_data=original_data,
        new_data={"price_id": data.price_id, "status": AuditType.PRICED},
        operator=data.operator,
        conclusion="价格设置成功",
        is_success=True
    )
    
    db.commit()
    db.refresh(weighing)
    return APIResponse(success=True, message="价格设置成功", data={"weighing": Weighing.model_validate(weighing).model_dump()})


@router.post("/{weighing_id}/set-deduction", response_model=APIResponse)
def set_deduction(weighing_id: int, data: WeighingDeduction, db: Session = Depends(get_db)):
    input_data = data.model_dump()
    input_data["weighing_id"] = weighing_id
    
    weighing = db.query(WeighingModel).filter(WeighingModel.id == weighing_id).first()
    if not weighing:
        log_failed_operation(
            db=db,
            operation_type=OperationType.UPDATE,
            input_data=input_data,
            operator=data.operator,
            error_message="称重记录不存在"
        )
        raise HTTPException(status_code=404, detail="称重记录不存在")
    
    if weighing.status == AuditType.CLOSED or weighing.status == AuditType.CANCELLED:
        log_failed_operation(
            db=db,
            operation_type=OperationType.UPDATE,
            input_data=input_data,
            operator=data.operator,
            error_message="称重记录已关闭或取消，无法修改",
            weighing_id=weighing_id
        )
        raise HTTPException(status_code=400, detail="称重记录已关闭或取消，无法修改")
    
    if not weighing.price_id:
        log_failed_operation(
            db=db,
            operation_type=OperationType.UPDATE,
            input_data=input_data,
            operator=data.operator,
            error_message="请先设置价格",
            weighing_id=weighing_id
        )
        raise HTTPException(status_code=400, detail="请先设置价格")
    
    deduction = db.query(DeductionModel).filter(DeductionModel.id == data.deduction_id).first()
    if not deduction:
        log_failed_operation(
            db=db,
            operation_type=OperationType.UPDATE,
            input_data=input_data,
            operator=data.operator,
            error_message="扣杂比例不存在",
            weighing_id=weighing_id
        )
        raise HTTPException(status_code=404, detail="扣杂比例不存在")
    
    deducted_weight = weighing.net_weight * deduction.ratio
    final_weight = weighing.net_weight - deducted_weight
    
    original_data = {
        "deduction_id": weighing.deduction_id,
        "deducted_weight": weighing.deducted_weight,
        "final_weight": weighing.final_weight,
        "status": weighing.status
    }
    
    weighing.deduction_id = data.deduction_id
    weighing.deducted_weight = deducted_weight
    weighing.final_weight = final_weight
    weighing.status = AuditType.DEDUCTED
    
    create_audit_log(
        db=db,
        weighing_id=weighing_id,
        operation_type=OperationType.STATUS_CHANGE,
        original_data=original_data,
        new_data={
            "deduction_id": data.deduction_id,
            "deducted_weight": deducted_weight,
            "final_weight": final_weight,
            "status": AuditType.DEDUCTED
        },
        operator=data.operator,
        conclusion="扣杂设置成功",
        is_success=True
    )
    
    db.commit()
    db.refresh(weighing)
    return APIResponse(success=True, message="扣杂设置成功", data={"weighing": Weighing.model_validate(weighing).model_dump()})


@router.post("/{weighing_id}/manual-correction", response_model=APIResponse)
def manual_correction(weighing_id: int, data: WeighingManualCorrection, db: Session = Depends(get_db)):
    input_data = data.model_dump()
    input_data["weighing_id"] = weighing_id
    
    weighing = db.query(WeighingModel).filter(WeighingModel.id == weighing_id).first()
    if not weighing:
        log_failed_operation(
            db=db,
            operation_type=OperationType.MANUAL_CORRECTION,
            input_data=input_data,
            operator=data.operator,
            error_message="称重记录不存在"
        )
        raise HTTPException(status_code=404, detail="称重记录不存在")
    
    if weighing.status == AuditType.CLOSED or weighing.status == AuditType.CANCELLED:
        log_failed_operation(
            db=db,
            operation_type=OperationType.MANUAL_CORRECTION,
            input_data=input_data,
            operator=data.operator,
            error_message="称重记录已关闭或取消，无法修改",
            weighing_id=weighing_id
        )
        raise HTTPException(status_code=400, detail="称重记录已关闭或取消，无法修改")
    
    if weighing.settlement_id:
        log_failed_operation(
            db=db,
            operation_type=OperationType.MANUAL_CORRECTION,
            input_data=input_data,
            operator=data.operator,
            error_message="称重记录已结算，无法修改",
            weighing_id=weighing_id
        )
        raise HTTPException(status_code=400, detail="称重记录已结算，无法修改")
    
    original_data = {
        "gross_weight": weighing.gross_weight,
        "tare_weight": weighing.tare_weight,
        "net_weight": weighing.net_weight,
        "price_id": weighing.price_id,
        "deduction_id": weighing.deduction_id,
        "status": weighing.status
    }
    
    new_data = {"reason": data.reason}
    
    if data.gross_weight is not None or data.tare_weight is not None:
        new_gross = data.gross_weight if data.gross_weight is not None else weighing.gross_weight
        new_tare = data.tare_weight if data.tare_weight is not None else weighing.tare_weight
        
        if new_gross <= 0:
            log_failed_operation(
                db=db,
                operation_type=OperationType.MANUAL_CORRECTION,
                input_data=input_data,
                operator=data.operator,
                error_message="毛重必须大于0",
                weighing_id=weighing_id
            )
            raise HTTPException(status_code=400, detail="毛重必须大于0")
        if new_tare < 0:
            log_failed_operation(
                db=db,
                operation_type=OperationType.MANUAL_CORRECTION,
                input_data=input_data,
                operator=data.operator,
                error_message="皮重不能为负数",
                weighing_id=weighing_id
            )
            raise HTTPException(status_code=400, detail="皮重不能为负数")
        if new_gross <= new_tare:
            log_failed_operation(
                db=db,
                operation_type=OperationType.MANUAL_CORRECTION,
                input_data=input_data,
                operator=data.operator,
                error_message="毛重必须大于皮重",
                weighing_id=weighing_id
            )
            raise HTTPException(status_code=400, detail="毛重必须大于皮重")
        
        weighing.gross_weight = new_gross
        weighing.tare_weight = new_tare
        weighing.net_weight = new_gross - new_tare
        new_data.update({"gross_weight": new_gross, "tare_weight": new_tare, "net_weight": weighing.net_weight})
    
    if data.price_id is not None:
        price = db.query(PriceModel).filter(PriceModel.id == data.price_id).first()
        if not price:
            log_failed_operation(
                db=db,
                operation_type=OperationType.MANUAL_CORRECTION,
                input_data=input_data,
                operator=data.operator,
                error_message="价格不存在",
                weighing_id=weighing_id
            )
            raise HTTPException(status_code=404, detail="价格不存在")
        weighing.price_id = data.price_id
        new_data["price_id"] = data.price_id
    
    if data.deduction_id is not None:
        deduction = db.query(DeductionModel).filter(DeductionModel.id == data.deduction_id).first()
        if not deduction:
            log_failed_operation(
                db=db,
                operation_type=OperationType.MANUAL_CORRECTION,
                input_data=input_data,
                operator=data.operator,
                error_message="扣杂比例不存在",
                weighing_id=weighing_id
            )
            raise HTTPException(status_code=404, detail="扣杂比例不存在")
        weighing.deduction_id = data.deduction_id
        
        deducted_weight = weighing.net_weight * deduction.ratio
        final_weight = weighing.net_weight - deducted_weight
        weighing.deducted_weight = deducted_weight
        weighing.final_weight = final_weight
        new_data.update({
            "deduction_id": data.deduction_id,
            "deducted_weight": deducted_weight,
            "final_weight": final_weight
        })
    
    create_audit_log(
        db=db,
        weighing_id=weighing_id,
        operation_type=OperationType.MANUAL_CORRECTION,
        original_data=original_data,
        new_data=new_data,
        operator=data.operator,
        conclusion=f"人工修正: {data.reason}",
        is_success=True
    )
    
    db.commit()
    db.refresh(weighing)
    return APIResponse(success=True, message="人工修正成功", data={"weighing": Weighing.model_validate(weighing).model_dump()})


@router.post("/{weighing_id}/cancel", response_model=APIResponse)
def cancel_weighing(weighing_id: int, data: WeighingClose, db: Session = Depends(get_db)):
    input_data = data.model_dump()
    input_data["weighing_id"] = weighing_id
    
    weighing = db.query(WeighingModel).filter(WeighingModel.id == weighing_id).first()
    if not weighing:
        log_failed_operation(
            db=db,
            operation_type=OperationType.CANCEL,
            input_data=input_data,
            operator=data.operator,
            error_message="称重记录不存在"
        )
        raise HTTPException(status_code=404, detail="称重记录不存在")
    
    if weighing.status == AuditType.CLOSED or weighing.status == AuditType.CANCELLED:
        log_failed_operation(
            db=db,
            operation_type=OperationType.CANCEL,
            input_data=input_data,
            operator=data.operator,
            error_message="称重记录已关闭或取消",
            weighing_id=weighing_id
        )
        raise HTTPException(status_code=400, detail="称重记录已关闭或取消")
    
    if weighing.settlement_id:
        log_failed_operation(
            db=db,
            operation_type=OperationType.CANCEL,
            input_data=input_data,
            operator=data.operator,
            error_message="称重记录已结算，无法取消",
            weighing_id=weighing_id
        )
        raise HTTPException(status_code=400, detail="称重记录已结算，无法取消")
    
    original_data = {"status": weighing.status}
    
    weighing.status = AuditType.CANCELLED
    
    create_audit_log(
        db=db,
        weighing_id=weighing_id,
        operation_type=OperationType.CANCEL,
        original_data=original_data,
        new_data={"status": AuditType.CANCELLED},
        operator=data.operator,
        conclusion=f"撤回称重记录: {data.reason}",
        is_success=True
    )
    
    db.commit()
    db.refresh(weighing)
    return APIResponse(success=True, message="称重记录已撤回", data={"weighing": Weighing.model_validate(weighing).model_dump()})


@router.post("/{weighing_id}/close", response_model=APIResponse)
def close_weighing(weighing_id: int, data: WeighingClose, db: Session = Depends(get_db)):
    input_data = data.model_dump()
    input_data["weighing_id"] = weighing_id
    
    weighing = db.query(WeighingModel).filter(WeighingModel.id == weighing_id).first()
    if not weighing:
        log_failed_operation(
            db=db,
            operation_type=OperationType.CLOSE,
            input_data=input_data,
            operator=data.operator,
            error_message="称重记录不存在"
        )
        raise HTTPException(status_code=404, detail="称重记录不存在")
    
    if weighing.status == AuditType.CLOSED or weighing.status == AuditType.CANCELLED:
        log_failed_operation(
            db=db,
            operation_type=OperationType.CLOSE,
            input_data=input_data,
            operator=data.operator,
            error_message="称重记录已关闭或取消",
            weighing_id=weighing_id
        )
        raise HTTPException(status_code=400, detail="称重记录已关闭或取消")
    
    if not weighing.settlement_id:
        log_failed_operation(
            db=db,
            operation_type=OperationType.CLOSE,
            input_data=input_data,
            operator=data.operator,
            error_message="未结算记录不能关闭，请先结算",
            weighing_id=weighing_id
        )
        raise HTTPException(status_code=400, detail="未结算记录不能关闭，请先结算")
    
    original_data = {"status": weighing.status}
    
    weighing.status = AuditType.CLOSED
    
    create_audit_log(
        db=db,
        weighing_id=weighing_id,
        operation_type=OperationType.CLOSE,
        original_data=original_data,
        new_data={"status": AuditType.CLOSED},
        operator=data.operator,
        conclusion=f"关闭称重记录: {data.reason}",
        is_success=True
    )
    
    db.commit()
    db.refresh(weighing)
    return APIResponse(success=True, message="称重记录已关闭", data={"weighing": Weighing.model_validate(weighing).model_dump()})
