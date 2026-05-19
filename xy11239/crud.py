from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
import models
import schemas
from typing import List, Optional


DANGER_LEVELS_REQUIRING_DOUBLE_APPROVAL = ["剧毒", "高毒", "爆炸品", "易制毒"]


def generate_application_no(db: Session) -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    count = db.query(func.count(models.Application.id)).filter(
        models.Application.application_no.like(f"APP{today}%")
    ).scalar() or 0
    return f"APP{today}{count + 1:04d}"


def log_operation(db: Session, log_data: schemas.OperationLogCreate):
    db_log = models.OperationLog(**log_data.model_dump())
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log


def get_total_inventory(db: Session, reagent_id: int) -> float:
    result = db.query(func.sum(models.Inventory.quantity)).filter(
        models.Inventory.reagent_id == reagent_id
    ).scalar()
    return float(result or 0)


def create_reagent(db: Session, reagent: schemas.ReagentCreate):
    db_reagent = models.Reagent(
        name=reagent.name,
        cas_no=reagent.cas_no,
        specification=reagent.specification,
        danger_level=reagent.danger_level,
        unit=reagent.unit,
        description=reagent.description,
        created_by=reagent.operator
    )
    db.add(db_reagent)
    db.commit()
    db.refresh(db_reagent)
    
    log_operation(db, schemas.OperationLogCreate(
        operation_type="create_reagent",
        reagent_id=db_reagent.id,
        operator=reagent.operator,
        operator_role=reagent.operator_role,
        result="success",
        reason=f"创建试剂: {reagent.name}"
    ))
    return db_reagent


def get_reagent(db: Session, reagent_id: int):
    return db.query(models.Reagent).filter(models.Reagent.id == reagent_id).first()


def get_reagents(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Reagent).offset(skip).limit(limit).all()


def add_inventory(db: Session, inventory: schemas.InventoryCreate):
    reagent = get_reagent(db, inventory.reagent_id)
    if not reagent:
        log_operation(db, schemas.OperationLogCreate(
            operation_type="add_inventory",
            reagent_id=inventory.reagent_id,
            operator=inventory.operator,
            operator_role=inventory.operator_role,
            quantity=inventory.quantity,
            result="failed",
            reason="试剂不存在"
        ))
        return None, "试剂不存在"
    
    db_inventory = models.Inventory(
        reagent_id=inventory.reagent_id,
        quantity=inventory.quantity,
        location=inventory.location,
        batch_no=inventory.batch_no,
        expired_at=inventory.expired_at,
        updated_by=inventory.operator
    )
    db.add(db_inventory)
    db.commit()
    db.refresh(db_inventory)
    
    log_operation(db, schemas.OperationLogCreate(
        operation_type="add_inventory",
        reagent_id=inventory.reagent_id,
        operator=inventory.operator,
        operator_role=inventory.operator_role,
        quantity=inventory.quantity,
        result="success",
        reason=f"入库成功，批次: {inventory.batch_no or 'N/A'}"
    ))
    return db_inventory, "入库成功"


def create_application(db: Session, application: schemas.ApplicationCreate, idempotency_key: Optional[str] = None):
    if idempotency_key:
        existing = db.query(models.OperationLog).filter(
            models.OperationLog.operation_type == "create_application",
            models.OperationLog.reason.like(f"%{idempotency_key}%")
        ).first()
        if existing:
            app = db.query(models.Application).filter(models.Application.id == existing.application_id).first()
            if app:
                return app, "重复申请，已返回原有记录", False
    
    reagent = get_reagent(db, application.reagent_id)
    if not reagent:
        log_operation(db, schemas.OperationLogCreate(
            operation_type="create_application",
            reagent_id=application.reagent_id,
            operator=application.applicant,
            operator_role=application.applicant_role,
            quantity=application.quantity,
            result="failed",
            reason="试剂不存在"
        ))
        return None, "试剂不存在", False
    
    if application.quantity <= 0:
        log_operation(db, schemas.OperationLogCreate(
            operation_type="create_application",
            reagent_id=application.reagent_id,
            operator=application.applicant,
            operator_role=application.applicant_role,
            quantity=application.quantity,
            result="failed",
            reason="申请数量必须大于0"
        ))
        return None, "申请数量必须大于0", False
    
    required_approvals = 2 if reagent.danger_level in DANGER_LEVELS_REQUIRING_DOUBLE_APPROVAL else 1
    
    application_no = generate_application_no(db)
    db_application = models.Application(
        application_no=application_no,
        reagent_id=application.reagent_id,
        applicant=application.applicant,
        applicant_role=application.applicant_role,
        quantity=application.quantity,
        purpose=application.purpose,
        required_approvals=required_approvals
    )
    db.add(db_application)
    db.commit()
    db.refresh(db_application)
    
    for i in range(required_approvals):
        db_approval = models.Approval(
            application_id=db_application.id,
            approver="",
            approver_role="",
            approval_index=i
        )
        db.add(db_approval)
    
    db.commit()
    db.refresh(db_application)
    
    reason_suffix = f" | idempotency: {idempotency_key}" if idempotency_key else ""
    log_operation(db, schemas.OperationLogCreate(
        operation_type="create_application",
        application_id=db_application.id,
        reagent_id=application.reagent_id,
        operator=application.applicant,
        operator_role=application.applicant_role,
        quantity=application.quantity,
        result="success",
        reason=f"申请创建成功，需要{required_approvals}人审批{reason_suffix}"
    ))
    
    return db_application, "申请创建成功", True


def process_approval(db: Session, approval: schemas.ApprovalCreate):
    application = db.query(models.Application).filter(models.Application.id == approval.application_id).first()
    if not application:
        log_operation(db, schemas.OperationLogCreate(
            operation_type="approval",
            application_id=approval.application_id,
            operator=approval.approver,
            operator_role=approval.approver_role,
            result="failed",
            reason="申请不存在"
        ))
        return None, "申请不存在"
    
    if application.status != "pending":
        log_operation(db, schemas.OperationLogCreate(
            operation_type="approval",
            application_id=approval.application_id,
            operator=approval.approver,
            operator_role=approval.approver_role,
            result="failed",
            reason=f"申请状态为{application.status}，无法审批"
        ))
        return None, f"申请状态为{application.status}，无法审批"
    
    current_idx = application.current_approval_index
    approval_record = db.query(models.Approval).filter(
        models.Approval.application_id == approval.application_id,
        models.Approval.approval_index == current_idx
    ).first()
    
    if not approval_record:
        return None, "审批记录不存在"
    
    if approval_record.decision:
        log_operation(db, schemas.OperationLogCreate(
            operation_type="approval",
            application_id=approval.application_id,
            operator=approval.approver,
            operator_role=approval.approver_role,
            result="failed",
            reason="该位置已审批，请勿重复操作"
        ))
        return None, "该位置已审批，请勿重复操作"
    
    approval_record.approver = approval.approver
    approval_record.approver_role = approval.approver_role
    approval_record.decision = approval.decision
    approval_record.comment = approval.comment
    approval_record.approved_at = datetime.utcnow()
    
    if approval.decision == "rejected":
        application.status = "rejected"
        result_msg = "申请已驳回"
    elif approval.decision == "approved":
        application.current_approval_index += 1
        if application.current_approval_index >= application.required_approvals:
            application.status = "approved"
            result_msg = "审批完成，申请已通过"
        else:
            result_msg = f"第{current_idx + 1}人审批通过，还需{application.required_approvals - current_idx - 1}人审批"
    else:
        return None, "无效的审批决策"
    
    db.commit()
    db.refresh(application)
    
    log_operation(db, schemas.OperationLogCreate(
        operation_type="approval",
        application_id=approval.application_id,
        operator=approval.approver,
        operator_role=approval.approver_role,
        result="success",
        reason=result_msg
    ))
    
    return application, result_msg


def resubmit_application(db: Session, application_id: int, resubmit_data: schemas.ApplicationResubmit):
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        log_operation(db, schemas.OperationLogCreate(
            operation_type="resubmit",
            application_id=application_id,
            operator=resubmit_data.applicant,
            operator_role=resubmit_data.applicant_role,
            result="failed",
            reason="申请不存在"
        ))
        return None, "申请不存在"
    
    if application.status != "rejected":
        log_operation(db, schemas.OperationLogCreate(
            operation_type="resubmit",
            application_id=application_id,
            operator=resubmit_data.applicant,
            operator_role=resubmit_data.applicant_role,
            result="failed",
            reason="只有被驳回的申请才能重新提交"
        ))
        return None, "只有被驳回的申请才能重新提交"
    
    application.status = "pending"
    application.current_approval_index = 0
    if resubmit_data.purpose:
        application.purpose = resubmit_data.purpose
    
    for approval in application.approvals:
        approval.approver = ""
        approval.approver_role = ""
        approval.decision = None
        approval.comment = None
        approval.approved_at = None
    
    db.commit()
    db.refresh(application)
    
    log_operation(db, schemas.OperationLogCreate(
        operation_type="resubmit",
        application_id=application_id,
        operator=resubmit_data.applicant,
        operator_role=resubmit_data.applicant_role,
        result="success",
        reason="申请已重新提交"
    ))
    
    return application, "申请已重新提交"


def stock_out(db: Session, stock_out_data: schemas.StockOut):
    application = db.query(models.Application).filter(models.Application.id == stock_out_data.application_id).first()
    if not application:
        log_operation(db, schemas.OperationLogCreate(
            operation_type="stock_out",
            application_id=stock_out_data.application_id,
            operator=stock_out_data.operator,
            operator_role=stock_out_data.operator_role,
            result="failed",
            reason="申请不存在"
        ))
        return None, "申请不存在"
    
    if application.status != "approved":
        log_operation(db, schemas.OperationLogCreate(
            operation_type="stock_out",
            application_id=stock_out_data.application_id,
            operator=stock_out_data.operator,
            operator_role=stock_out_data.operator_role,
            result="failed",
            reason=f"申请状态为{application.status}，无法出库"
        ))
        return None, f"申请状态为{application.status}，无法出库"
    
    already_out = db.query(models.OperationLog).filter(
        models.OperationLog.operation_type == "stock_out",
        models.OperationLog.application_id == stock_out_data.application_id,
        models.OperationLog.result == "success"
    ).first()
    if already_out:
        log_operation(db, schemas.OperationLogCreate(
            operation_type="stock_out",
            application_id=stock_out_data.application_id,
            operator=stock_out_data.operator,
            operator_role=stock_out_data.operator_role,
            result="failed",
            reason="该申请已完成出库，请勿重复操作"
        ))
        return None, "该申请已完成出库，请勿重复操作"
    
    current_stock = get_total_inventory(db, application.reagent_id)
    if current_stock < application.quantity:
        log_operation(db, schemas.OperationLogCreate(
            operation_type="stock_out",
            application_id=stock_out_data.application_id,
            reagent_id=application.reagent_id,
            operator=stock_out_data.operator,
            operator_role=stock_out_data.operator_role,
            quantity=application.quantity,
            result="failed",
            reason=f"库存不足，当前库存: {current_stock}, 申请数量: {application.quantity}"
        ))
        return None, f"库存不足，当前库存: {current_stock}, 申请数量: {application.quantity}"
    
    quantity_needed = application.quantity
    inventories = db.query(models.Inventory).filter(
        models.Inventory.reagent_id == application.reagent_id,
        models.Inventory.quantity > 0
    ).order_by(models.Inventory.expired_at.asc()).all()
    
    for inv in inventories:
        if quantity_needed <= 0:
            break
        deduct = min(inv.quantity, quantity_needed)
        inv.quantity -= deduct
        quantity_needed -= deduct
    
    application.status = "completed"
    db.commit()
    db.refresh(application)
    
    log_operation(db, schemas.OperationLogCreate(
        operation_type="stock_out",
        application_id=stock_out_data.application_id,
        reagent_id=application.reagent_id,
        operator=stock_out_data.operator,
        operator_role=stock_out_data.operator_role,
        quantity=application.quantity,
        result="success",
        reason=f"出库成功，扣减数量: {application.quantity}"
    ))
    
    return application, "出库成功"


def stock_return(db: Session, return_data: schemas.StockReturn):
    reagent = get_reagent(db, return_data.reagent_id)
    if not reagent:
        log_operation(db, schemas.OperationLogCreate(
            operation_type="stock_return",
            reagent_id=return_data.reagent_id,
            operator=return_data.operator,
            operator_role=return_data.operator_role,
            quantity=return_data.quantity,
            result="failed",
            reason="试剂不存在"
        ))
        return None, "试剂不存在"
    
    if return_data.quantity <= 0:
        log_operation(db, schemas.OperationLogCreate(
            operation_type="stock_return",
            reagent_id=return_data.reagent_id,
            operator=return_data.operator,
            operator_role=return_data.operator_role,
            quantity=return_data.quantity,
            result="failed",
            reason="归还数量必须大于0"
        ))
        return None, "归还数量必须大于0"
    
    db_inventory = models.Inventory(
        reagent_id=return_data.reagent_id,
        quantity=return_data.quantity,
        updated_by=return_data.operator
    )
    db.add(db_inventory)
    db.commit()
    db.refresh(db_inventory)
    
    log_operation(db, schemas.OperationLogCreate(
        operation_type="stock_return",
        reagent_id=return_data.reagent_id,
        operator=return_data.operator,
        operator_role=return_data.operator_role,
        quantity=return_data.quantity,
        result="success",
        reason=return_data.reason or "归还入库"
    ))
    
    return db_inventory, "归还成功"


def inventory_check(db: Session, check_data: schemas.InventoryCheck):
    reagent = get_reagent(db, check_data.reagent_id)
    if not reagent:
        log_operation(db, schemas.OperationLogCreate(
            operation_type="inventory_check",
            reagent_id=check_data.reagent_id,
            operator=check_data.operator,
            operator_role=check_data.operator_role,
            quantity=check_data.actual_quantity,
            result="failed",
            reason="试剂不存在"
        ))
        return None, "试剂不存在"
    
    system_quantity = get_total_inventory(db, check_data.reagent_id)
    diff = check_data.actual_quantity - system_quantity
    
    if diff != 0:
        db_inventory = models.Inventory(
            reagent_id=check_data.reagent_id,
            quantity=diff,
            location="盘点调整",
            updated_by=check_data.operator
        )
        db.add(db_inventory)
    
    new_system_quantity = get_total_inventory(db, check_data.reagent_id)
    
    db.commit()
    
    log_operation(db, schemas.OperationLogCreate(
        operation_type="inventory_check",
        reagent_id=check_data.reagent_id,
        operator=check_data.operator,
        operator_role=check_data.operator_role,
        quantity=check_data.actual_quantity,
        result="success",
        reason=f"盘点完成，系统原数量: {system_quantity}, 实盘数量: {check_data.actual_quantity}, 差异: {diff}, 调整后: {new_system_quantity}"
    ))
    
    return {
        "reagent_id": check_data.reagent_id,
        "system_quantity": system_quantity,
        "actual_quantity": check_data.actual_quantity,
        "difference": diff,
        "new_quantity": new_system_quantity
    }, "盘点完成"


def get_operation_logs(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.OperationLog).order_by(models.OperationLog.created_at.desc()).offset(skip).limit(limit).all()


def get_application(db: Session, application_id: int):
    return db.query(models.Application).filter(models.Application.id == application_id).first()


def get_applications(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Application).order_by(models.Application.created_at.desc()).offset(skip).limit(limit).all()


def get_inventory_summary(db: Session):
    results = db.query(
        models.Inventory.reagent_id,
        func.sum(models.Inventory.quantity).label("total_quantity")
    ).group_by(models.Inventory.reagent_id).all()
    
    summary = []
    for reagent_id, total_qty in results:
        reagent = get_reagent(db, reagent_id)
        summary.append({
            "reagent_id": reagent_id,
            "reagent_name": reagent.name if reagent else "Unknown",
            "danger_level": reagent.danger_level if reagent else "Unknown",
            "total_quantity": float(total_qty),
            "unit": reagent.unit if reagent else ""
        })
    return summary


def export_all_data(db: Session):
    reagents = get_reagents(db)
    applications = get_applications(db)
    inventory = get_inventory_summary(db)
    logs = get_operation_logs(db)
    
    return {
        "export_time": datetime.utcnow().isoformat(),
        "reagents": [
            {
                "id": r.id,
                "name": r.name,
                "cas_no": r.cas_no,
                "danger_level": r.danger_level,
                "unit": r.unit,
                "created_at": r.created_at.isoformat(),
                "created_by": r.created_by
            }
            for r in reagents
        ],
        "inventory_summary": inventory,
        "applications": [
            {
                "id": a.id,
                "application_no": a.application_no,
                "reagent_id": a.reagent_id,
                "applicant": a.applicant,
                "applicant_role": a.applicant_role,
                "quantity": a.quantity,
                "purpose": a.purpose,
                "status": a.status,
                "required_approvals": a.required_approvals,
                "created_at": a.created_at.isoformat(),
                "approvals": [
                    {
                        "index": ap.approval_index,
                        "approver": ap.approver,
                        "decision": ap.decision,
                        "comment": ap.comment,
                        "approved_at": ap.approved_at.isoformat() if ap.approved_at else None
                    }
                    for ap in a.approvals
                ]
            }
            for a in applications
        ],
        "operation_logs": [
            {
                "id": l.id,
                "operation_type": l.operation_type,
                "application_id": l.application_id,
                "reagent_id": l.reagent_id,
                "operator": l.operator,
                "operator_role": l.operator_role,
                "quantity": l.quantity,
                "result": l.result,
                "reason": l.reason,
                "created_at": l.created_at.isoformat()
            }
            for l in logs
        ]
    }
