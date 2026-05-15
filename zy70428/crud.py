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
    else:
        candidate_list.current_node = current_node_name
        if approval.approval_status == schemas.ApprovalStatus.REJECTED:
            candidate_list.approval_status = schemas.ApprovalStatus.REJECTED

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
    candidate_list.summary = (candidate_list.summary or "") + f" | 口径变更: {new_caliber}, 原因: {reason}"

    for item in candidate_list.items:
        item.system_decision = "口径变更，需重新判断"
        item.is_kept = True

    db.commit()
    db.refresh(candidate_list)
    return candidate_list


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

    export_data = {
        "list_info": {
            "id": candidate_list.id,
            "name": candidate_list.list_name,
            "data_source": candidate_list.data_source,
            "caliber_version": candidate_list.caliber_version,
            "status": candidate_list.approval_status,
            "current_node": candidate_list.current_node,
            "summary": candidate_list.summary
        },
        "items": [],
        "modifications": [],
        "approval_history": []
    }

    for item in candidate_list.items:
        item_data = {
            "id": item.id,
            "original_value": item.original_value,
            "suggested_value": item.suggested_value,
            "final_value": item.final_value,
            "system_decision": item.system_decision,
            "manual_decision": item.manual_decision,
            "is_kept": item.is_kept,
            "action_type": item.action_type,
            "remarks": item.remarks
        }

        if include_sms and item.sms_record_id:
            sms = db.query(models.SMSSendRecord).filter(models.SMSSendRecord.id == item.sms_record_id).first()
            if sms:
                item_data["sms_details"] = {
                    "batch_no": sms.batch_no,
                    "phone_number": sms.phone_number,
                    "sms_content": sms.sms_content,
                    "send_time": sms.send_time.isoformat() if sms.send_time else None,
                    "send_status": sms.send_status
                }

        export_data["items"].append(item_data)

    for mod in candidate_list.modifications:
        export_data["modifications"].append({
            "id": mod.id,
            "candidate_item_id": mod.candidate_item_id,
            "field_name": mod.field_name,
            "original_value": mod.original_value,
            "modified_value": mod.modified_value,
            "modifier": mod.modifier,
            "modification_time": mod.modification_time.isoformat(),
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

    return export_data
