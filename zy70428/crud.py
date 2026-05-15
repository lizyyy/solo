from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import models, schemas
from datetime import datetime
import json


def create_invoice_reversal_record(db: Session, invoice: schemas.InvoiceReversalRecordCreate):
    db_invoice = models.InvoiceReversalRecord(**invoice.model_dump())
    db.add(db_invoice)
    db.commit()
    db.refresh(db_invoice)
    return db_invoice


def batch_create_invoice_records(db: Session, invoices: list):
    db_invoices = [models.InvoiceReversalRecord(**inv) for inv in invoices]
    db.bulk_save_objects(db_invoices)
    db.commit()
    return len(db_invoices)


def get_invoice_records(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.InvoiceReversalRecord).offset(skip).limit(limit).all()


def create_sms_send_record(db: Session, sms: schemas.SMSSendRecordCreate):
    db_sms = models.SMSSendRecord(**sms.model_dump())
    db.add(db_sms)
    db.commit()
    db.refresh(db_sms)
    return db_sms


def batch_create_sms_records(db: Session, sms_list: list):
    db_sms_list = [models.SMSSendRecord(**sms) for sms in sms_list]
    db.bulk_save_objects(db_sms_list)
    db.commit()
    return len(db_sms_list)


def get_sms_records(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.SMSSendRecord).offset(skip).limit(limit).all()


def generate_candidate_list(db: Session, request: schemas.GenerateCandidateListRequest):
    filters = []
    if request.start_date:
        filters.append(models.InvoiceReversalRecord.reversal_date >= request.start_date)
    if request.end_date:
        filters.append(models.InvoiceReversalRecord.reversal_date <= request.end_date)
    if request.department:
        filters.append(models.InvoiceReversalRecord.department == request.department)

    if request.data_source == schemas.DataSource.PEAK_INVOICE_REVERSAL:
        records = db.query(models.InvoiceReversalRecord).filter(and_(*filters)).all()
        items = []
        for record in records:
            system_decision = "保留" if record.is_peak_period else "建议清理"
            original_value = json.dumps({
                "invoice_no": record.invoice_no,
                "buyer_name": record.buyer_name,
                "total_amount": record.total_amount,
                "reversal_date": record.reversal_date.isoformat() if record.reversal_date else None
            }, ensure_ascii=False)
            items.append({
                "invoice_record_id": record.id,
                "original_value": original_value,
                "suggested_value": original_value,
                "final_value": original_value,
                "system_decision": system_decision,
                "is_kept": record.is_peak_period,
                "action_type": "keep" if record.is_peak_period else "clean"
            })
    else:
        records = db.query(models.SMSSendRecord).filter(and_(*filters)).all()
        items = []
        for record in records:
            system_decision = "保留"
            original_value = json.dumps({
                "batch_no": record.batch_no,
                "phone_number": record.phone_number,
                "send_time": record.send_time.isoformat() if record.send_time else None,
                "invoice_related": record.invoice_related
            }, ensure_ascii=False)
            items.append({
                "sms_record_id": record.id,
                "original_value": original_value,
                "suggested_value": original_value,
                "final_value": original_value,
                "system_decision": system_decision,
                "is_kept": True,
                "action_type": "keep"
            })

    approval_nodes = [
        {"node_name": "部门初审", "node_order": 1},
        {"node_name": "财务复核", "node_order": 2},
        {"node_name": "终审", "node_order": 3}
    ]

    candidate_list = models.CandidateList(
        list_name=request.list_name,
        data_source=request.data_source,
        caliber_version=request.caliber_version,
        total_count=len(items),
        generated_by=request.generated_by,
        summary=f"共{len(items)}条记录，数据源：{request.data_source}，口径版本：{request.caliber_version}"
    )
    db.add(candidate_list)
    db.flush()

    for item in items:
        db_item = models.CandidateItem(candidate_list_id=candidate_list.id, **item)
        db.add(db_item)

    for node in approval_nodes:
        db_node = models.ApprovalNode(candidate_list_id=candidate_list.id, **node)
        db.add(db_node)

    db.commit()
    db.refresh(candidate_list)
    return candidate_list


def get_candidate_lists(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.CandidateList).offset(skip).limit(limit).all()


def get_candidate_list(db: Session, list_id: int):
    return db.query(models.CandidateList).filter(models.CandidateList.id == list_id).first()


def process_approval(db: Session, approval: schemas.ApprovalRequest):
    candidate_list = get_candidate_list(db, approval.candidate_list_id)
    if not candidate_list:
        return None

    node = db.query(models.ApprovalNode).filter(
        and_(
            models.ApprovalNode.candidate_list_id == approval.candidate_list_id,
            models.ApprovalNode.node_name == approval.node_name
        )
    ).first()

    if node:
        node.approver = approval.approver
        node.approval_status = approval.approval_status
        node.approval_opinion = approval.approval_opinion
        node.approval_time = datetime.now()

    nodes = db.query(models.ApprovalNode).filter(
        models.ApprovalNode.candidate_list_id == approval.candidate_list_id
    ).order_by(models.ApprovalNode.node_order).all()

    all_approved = True
    current_node_name = "待审批"
    for n in nodes:
        if not n.approval_status:
            current_node_name = n.node_name
            all_approved = False
            break
        elif n.approval_status != schemas.ApprovalStatus.APPROVED:
            all_approved = False
            break

    if all_approved:
        candidate_list.approval_status = schemas.ApprovalStatus.APPROVED
        candidate_list.current_node = "已完成"
        candidate_list.can_execute = True
    else:
        candidate_list.current_node = current_node_name
        if approval.approval_status == schemas.ApprovalStatus.REJECTED:
            candidate_list.approval_status = schemas.ApprovalStatus.REJECTED
            candidate_list.can_execute = False

    db.commit()
    db.refresh(candidate_list)
    return candidate_list


def apply_manual_modification(db: Session, modify: schemas.ManualModifyRequest):
    candidate_list = get_candidate_list(db, modify.candidate_list_id)
    if not candidate_list:
        return None

    candidate_item = db.query(models.CandidateItem).filter(
        and_(
            models.CandidateItem.candidate_list_id == modify.candidate_list_id,
            models.CandidateItem.id == modify.candidate_item_id
        )
    ).first()

    if not candidate_item:
        return None

    original_value = candidate_item.final_value or candidate_item.original_value

    modification = models.ManualModification(
        candidate_list_id=modify.candidate_list_id,
        candidate_item_id=modify.candidate_item_id,
        field_name=modify.field_name,
        original_value=original_value,
        modified_value=modify.modified_value,
        modifier=modify.modifier,
        modification_remark=modify.modification_remark,
        reason=modify.reason
    )
    db.add(modification)

    candidate_item.final_value = modify.modified_value
    candidate_item.manual_decision = "人工修正"
    candidate_item.remarks = (candidate_item.remarks or "") + f" | 人工修正: {modify.modification_remark}"

    candidate_list.approval_status = schemas.ApprovalStatus.MANUAL_MODIFIED

    db.commit()
    db.refresh(candidate_list)
    return candidate_list


def handle_caliber_change(db: Session, list_id: int, new_caliber: str, reason: str):
    candidate_list = get_candidate_list(db, list_id)
    if not candidate_list:
        return None

    candidate_list.caliber_version = new_caliber
    candidate_list.approval_status = schemas.ApprovalStatus.CALIBER_CHANGED
    candidate_list.failure_reason = reason
    candidate_list.can_execute = False
    candidate_list.summary = (candidate_list.summary or "") + f" | 口径变更: {new_caliber}, 原因: {reason}"

    for item in candidate_list.items:
        item.system_decision = "口径变更，需重新判断"
        item.is_kept = True

    db.commit()
    db.refresh(candidate_list)
    return candidate_list


def validate_execution_permission(db: Session, list_id: int):
    candidate_list = get_candidate_list(db, list_id)
    if not candidate_list:
        return False, "候选清单不存在"
    
    if candidate_list.approval_status != schemas.ApprovalStatus.APPROVED:
        return False, f"候选清单未通过审批，当前状态: {candidate_list.approval_status}"
    
    if not candidate_list.can_execute:
        return False, "候选清单不可执行，请先完成审批流程"
    
    if candidate_list.execution_status == models.ExecutionStatus.EXECUTED:
        return False, "候选清单已执行，不可重复执行"
    
    return True, "允许执行"


def execute_candidate_list(db: Session, request: schemas.ExecutionRequest):
    can_execute, message = validate_execution_permission(db, request.candidate_list_id)
    if not can_execute:
        return {"success": False, "message": message, "data": None}

    candidate_list = get_candidate_list(db, request.candidate_list_id)
    
    execution_record = models.ExecutionRecord(
        candidate_list_id=request.candidate_list_id,
        execution_type=request.execution_type,
        status=models.ExecutionStatus.EXECUTING,
        total_items=len(candidate_list.items),
        executed_by=request.executed_by,
        executed_at=datetime.now()
    )
    db.add(execution_record)
    db.flush()

    success_count = 0
    failed_count = 0
    execution_details = []

    for item in candidate_list.items:
        try:
            record_type = "invoice" if item.invoice_record_id else "sms"
            record_id = item.invoice_record_id or item.sms_record_id
            action = item.action_type or "keep"

            if request.dry_run:
                result = "skipped"
                remark = "试运行模式，未实际执行"
            else:
                if action == "clean":
                    result = "success"
                    remark = f"已执行{request.execution_type}操作"
                elif action == "rollback":
                    result = "success"
                    remark = f"已执行回滚操作"
                else:
                    result = "success"
                    remark = "保留数据，无需执行清理"

            detail = models.ExecutionDetail(
                execution_record_id=execution_record.id,
                candidate_item_id=item.id,
                record_type=record_type,
                record_id=record_id,
                action_type=action,
                original_value=item.final_value or item.original_value,
                execution_result=result,
                remark=remark
            )
            db.add(detail)
            execution_details.append(detail)

            if result == "success":
                success_count += 1
            else:
                failed_count += 1

        except Exception as e:
            failed_count += 1
            detail = models.ExecutionDetail(
                execution_record_id=execution_record.id,
                candidate_item_id=item.id,
                record_type="unknown",
                record_id=0,
                action_type=item.action_type or "unknown",
                original_value=item.final_value or item.original_value,
                execution_result="failed",
                remark=f"执行异常: {str(e)}"
            )
            db.add(detail)
            execution_details.append(detail)

    execution_record.success_count = success_count
    execution_record.failed_count = failed_count
    execution_record.completed_at = datetime.now()
    
    if failed_count == 0:
        execution_record.status = models.ExecutionStatus.EXECUTED
        candidate_list.execution_status = models.ExecutionStatus.EXECUTED
    elif success_count > 0:
        execution_record.status = models.ExecutionStatus.PARTIALLY_EXECUTED
        candidate_list.execution_status = models.ExecutionStatus.PARTIALLY_EXECUTED
    else:
        execution_record.status = models.ExecutionStatus.FAILED
        candidate_list.execution_status = models.ExecutionStatus.FAILED

    execution_record.summary = (
        f"{'试运行' if request.dry_run else '实际执行'}完成: "
        f"总数{execution_record.total_items}, "
        f"成功{success_count}, "
        f"失败{failed_count}"
    )

    db.commit()
    db.refresh(execution_record)

    return {
        "success": True,
        "message": "执行完成",
        "data": {
            "execution_id": execution_record.id,
            "status": execution_record.status,
            "total": execution_record.total_items,
            "success_count": success_count,
            "failed_count": failed_count,
            "dry_run": request.dry_run
        }
    }


def get_execution_records(db: Session, list_id: int = None, skip: int = 0, limit: int = 100):
    query = db.query(models.ExecutionRecord)
    if list_id:
        query = query.filter(models.ExecutionRecord.candidate_list_id == list_id)
    return query.order_by(models.ExecutionRecord.executed_at.desc()).offset(skip).limit(limit).all()


def get_execution_detail(db: Session, execution_id: int):
    return db.query(models.ExecutionRecord).filter(models.ExecutionRecord.id == execution_id).first()


def create_processing_conclusion(db: Session, conclusion: schemas.ProcessingConclusionCreate):
    db_conclusion = models.ProcessingConclusion(**conclusion.model_dump())
    db.add(db_conclusion)
    db.commit()
    db.refresh(db_conclusion)
    return db_conclusion


def get_processing_conclusions(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.ProcessingConclusion).offset(skip).limit(limit).all()


def get_conclusion_by_candidate_list(db: Session, list_id: int):
    return db.query(models.ProcessingConclusion).filter(
        models.ProcessingConclusion.candidate_list_id == list_id
    ).first()


def get_modifications_by_candidate_list(db: Session, list_id: int):
    return db.query(models.ManualModification).filter(
        models.ManualModification.candidate_list_id == list_id
    ).all()


def get_export_data(db: Session, list_id: int, include_sms: bool = True, filter_node: str = None):
    candidate_list = get_candidate_list(db, list_id)
    if not candidate_list:
        return None

    modifications = get_modifications_by_candidate_list(db, list_id)
    
    export_data = {
        "list_info": {
            "id": candidate_list.id,
            "name": candidate_list.list_name,
            "data_source": candidate_list.data_source,
            "caliber_version": candidate_list.caliber_version,
            "status": candidate_list.approval_status,
            "execution_status": candidate_list.execution_status,
            "can_execute": candidate_list.can_execute,
            "current_node": candidate_list.current_node,
            "summary": candidate_list.summary
        },
        "items": [],
        "modifications_count": len(modifications),
        "modifications": [],
        "approval_history": [],
        "sms_details_count": 0
    }

    sms_details_count = 0
    for item in candidate_list.items:
        item_data = {
            "id": item.id,
            "original_value": item.original_value,
            "suggested_value": item.suggested_value,
            "final_value": item.final_value,
            "value_modified": item.original_value != item.final_value,
            "system_decision": item.system_decision,
            "manual_decision": item.manual_decision,
            "is_kept": item.is_kept,
            "action_type": item.action_type,
            "remarks": item.remarks
        }

        if include_sms and item.sms_record_id:
            sms = db.query(models.SMSSendRecord).filter(models.SMSSendRecord.id == item.sms_record_id).first()
            if sms:
                sms_details_count += 1
                item_data["sms_details"] = {
                    "id": sms.id,
                    "batch_no": sms.batch_no,
                    "phone_number": sms.phone_number,
                    "sms_content": sms.sms_content,
                    "send_time": sms.send_time.isoformat() if sms.send_time else None,
                    "send_status": sms.send_status,
                    "department": sms.department,
                    "operator": sms.operator,
                    "invoice_related": sms.invoice_related
                }
        elif include_sms and item.invoice_record_id:
            invoice = db.query(models.InvoiceReversalRecord).filter(
                models.InvoiceReversalRecord.id == item.invoice_record_id
            ).first()
            if invoice:
                related_sms = db.query(models.SMSSendRecord).filter(
                    models.SMSSendRecord.invoice_related == invoice.invoice_no
                ).all()
                if related_sms:
                    sms_details_count += len(related_sms)
                    item_data["related_sms"] = [{
                        "id": s.id,
                        "batch_no": s.batch_no,
                        "phone_number": s.phone_number,
                        "send_status": s.send_status
                    } for s in related_sms]

        export_data["items"].append(item_data)

    export_data["sms_details_count"] = sms_details_count

    for mod in modifications:
        export_data["modifications"].append({
            "id": mod.id,
            "candidate_item_id": mod.candidate_item_id,
            "field_name": mod.field_name,
            "original_value": mod.original_value,
            "modified_value": mod.modified_value,
            "value_changed": mod.original_value != mod.modified_value,
            "modifier": mod.modifier,
            "modification_time": mod.modification_time.isoformat() if mod.modification_time else None,
            "modification_remark": mod.modification_remark,
            "reason": mod.reason
        })

    for node in candidate_list.approval_nodes:
        if filter_node and node.node_name != filter_node:
            continue
        export_data["approval_history"].append({
            "node_name": node.node_name,
            "node_order": node.node_order,
            "approver": node.approver,
            "approval_status": node.approval_status,
            "approval_time": node.approval_time.isoformat() if node.approval_time else None,
            "approval_opinion": node.approval_opinion
        })

    execution_records = get_execution_records(db, list_id)
    export_data["execution_records"] = [{
        "id": e.id,
        "execution_type": e.execution_type,
        "status": e.status,
        "total_items": e.total_items,
        "success_count": e.success_count,
        "failed_count": e.failed_count,
        "executed_by": e.executed_by,
        "executed_at": e.executed_at.isoformat() if e.executed_at else None,
        "summary": e.summary
    } for e in execution_records]

    return export_data
