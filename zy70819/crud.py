from sqlalchemy.orm import Session
from sqlalchemy import and_
from models import Batch, BatchItem, ChangeHistory, BatchStatus, ClassificationType
from schemas import BatchCreate, ModifyItemRequest
from utils import calculate_expiry_classification
from datetime import datetime


def get_batch_by_number(db: Session, batch_number: str):
    return db.query(Batch).filter(Batch.batch_number == batch_number).first()


def check_duplicate_batch(db: Session, items):
    """
    检查是否为重复批次
    基于物料编码+批号+数量的组合判断
    """
    if not items:
        return None
    
    first_item = items[0]
    
    existing_items = db.query(BatchItem).filter(
        and_(
            BatchItem.material_code == first_item.material_code,
            BatchItem.batch_no == first_item.batch_no,
            BatchItem.quantity == first_item.quantity
        )
    ).all()
    
    if existing_items:
        for existing_item in existing_items:
            batch = db.query(Batch).filter(Batch.id == existing_item.batch_id).first()
            batch_items = batch.items if batch else []
            if batch and len(batch_items) == len(items):
                all_match = True
                for new_item in items:
                    match_found = False
                    for existing in batch_items:
                        if (existing.material_code == new_item.material_code and
                            existing.batch_no == new_item.batch_no and
                            existing.quantity == new_item.quantity):
                            match_found = True
                            break
                    if not match_found:
                        all_match = False
                        break
                if all_match:
                    return batch
    
    return None


def create_batch(db: Session, batch_data: BatchCreate):
    duplicate_batch = check_duplicate_batch(db, batch_data.items)
    if duplicate_batch:
        return duplicate_batch, True
    
    db_batch = Batch(
        batch_number=batch_data.batch_number,
        submitted_by=batch_data.submitted_by,
        total_items=len(batch_data.items),
        status=BatchStatus.PROCESSED
    )
    db.add(db_batch)
    db.flush()
    
    for item_data in batch_data.items:
        result = calculate_expiry_classification(
            item_data.expiry_date,
            item_data.production_date
        )
        
        db_item = BatchItem(
            batch_id=db_batch.id,
            material_code=item_data.material_code,
            material_name=item_data.material_name,
            specification=item_data.specification,
            manufacturer=item_data.manufacturer,
            batch_no=item_data.batch_no,
            production_date=item_data.production_date,
            expiry_date=item_data.expiry_date,
            quantity=item_data.quantity,
            unit=item_data.unit,
            storage_condition=item_data.storage_condition,
            supplier=item_data.supplier,
            classification=result["classification"],
            reason=result["reason"],
            follow_up_action=result["follow_up_action"]
        )
        db.add(db_item)
    
    db.commit()
    db.refresh(db_batch)
    return db_batch, False


def get_batch(db: Session, batch_id: int):
    return db.query(Batch).filter(Batch.id == batch_id).first()


def get_all_batches(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Batch).order_by(Batch.submit_time.desc()).offset(skip).limit(limit).all()


def get_batch_item(db: Session, item_id: int):
    return db.query(BatchItem).filter(BatchItem.id == item_id).first()


def modify_batch_item(db: Session, item_id: int, modify_data: ModifyItemRequest):
    db_item = get_batch_item(db, item_id)
    if not db_item:
        return None
    
    history = ChangeHistory(
        item_id=item_id,
        changed_by=modify_data.changed_by,
        old_classification=db_item.classification,
        new_classification=modify_data.classification,
        old_reason=db_item.reason,
        new_reason=modify_data.reason,
        old_follow_up_action=db_item.follow_up_action,
        new_follow_up_action=modify_data.follow_up_action,
        change_reason=modify_data.change_reason
    )
    db.add(history)
    
    db_item.classification = modify_data.classification
    db_item.reason = modify_data.reason
    db_item.follow_up_action = modify_data.follow_up_action
    
    db.commit()
    db.refresh(db_item)
    return db_item


def get_item_change_history(db: Session, item_id: int):
    return db.query(ChangeHistory).filter(ChangeHistory.item_id == item_id).order_by(ChangeHistory.change_time.desc()).all()


def get_batches_by_classification(db: Session, classification: ClassificationType):
    return db.query(Batch).join(BatchItem).filter(BatchItem.classification == classification).distinct().all()


def get_statistics(db: Session):
    total_batches = db.query(Batch).count()
    total_items = db.query(BatchItem).count()
    
    normal_count = db.query(BatchItem).filter(BatchItem.classification == ClassificationType.NORMAL).count()
    pending_count = db.query(BatchItem).filter(BatchItem.classification == ClassificationType.PENDING_SUPPLEMENT).count()
    blocked_count = db.query(BatchItem).filter(BatchItem.classification == ClassificationType.BLOCKED).count()
    
    return {
        "total_batches": total_batches,
        "total_items": total_items,
        "classification_distribution": {
            "正常": normal_count,
            "待补充": pending_count,
            "已拦截": blocked_count
        }
    }
