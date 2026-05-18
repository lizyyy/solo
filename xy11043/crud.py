from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from models import CuttingQueue
from schemas import CuttingQueueCreate, CuttingQueueUpdate
from datetime import date
from typing import Optional, List

def get_cutting_queue(db: Session, queue_id: int):
    return db.query(CuttingQueue).filter(CuttingQueue.id == queue_id).first()

def get_cutting_queue_by_order_no(db: Session, order_no: str):
    return db.query(CuttingQueue).filter(CuttingQueue.order_no == order_no).first()

def get_cutting_queues(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    store_name: Optional[str] = None,
    board_type: Optional[str] = None,
    is_urgent: Optional[bool] = None
):
    query = db.query(CuttingQueue)
    
    filters = []
    if start_date:
        filters.append(CuttingQueue.order_date >= start_date)
    if end_date:
        filters.append(CuttingQueue.order_date <= end_date)
    if status:
        filters.append(CuttingQueue.status == status)
    if assigned_to:
        filters.append(CuttingQueue.assigned_to == assigned_to)
    if store_name:
        filters.append(CuttingQueue.store_name.like(f"%{store_name}%"))
    if board_type:
        filters.append(CuttingQueue.board_type.like(f"%{board_type}%"))
    if is_urgent is not None:
        filters.append(CuttingQueue.is_urgent == is_urgent)
    
    if filters:
        query = query.filter(and_(*filters))
    
    return query.order_by(CuttingQueue.priority.desc(), CuttingQueue.created_at.desc()).offset(skip).limit(limit).all()

def create_cutting_queue(db: Session, queue: CuttingQueueCreate):
    db_queue = CuttingQueue(**queue.model_dump())
    db.add(db_queue)
    db.commit()
    db.refresh(db_queue)
    return db_queue

def update_cutting_queue(db: Session, queue_id: int, queue_update: CuttingQueueUpdate):
    db_queue = get_cutting_queue(db, queue_id)
    if db_queue:
        update_data = queue_update.model_dump(exclude_unset=True)
        update_data['version'] = db_queue.version + 1
        for key, value in update_data.items():
            setattr(db_queue, key, value)
        db.commit()
        db.refresh(db_queue)
    return db_queue

def delete_cutting_queue(db: Session, queue_id: int):
    db_queue = get_cutting_queue(db, queue_id)
    if db_queue:
        db.delete(db_queue)
        db.commit()
    return db_queue

def bulk_import_cutting_queue(db: Session, items: List[CuttingQueueCreate]):
    results = []
    success_count = 0
    failed_count = 0
    
    for idx, item in enumerate(items):
        row = idx + 1
        try:
            existing = get_cutting_queue_by_order_no(db, item.order_no)
            if existing:
                results.append({
                    "row": row,
                    "order_no": item.order_no,
                    "success": False,
                    "message": f"订单编号 {item.order_no} 已存在",
                    "error_type": "duplicate"
                })
                failed_count += 1
                continue
            
            material_conflict = db.query(CuttingQueue).filter(
                and_(
                    CuttingQueue.material_code == item.material_code,
                    CuttingQueue.material_location == item.material_location,
                    CuttingQueue.has_remaining_material == True,
                    CuttingQueue.status.in_(['pending', 'queued', 'cutting'])
                )
            ).first()
            
            if material_conflict and item.material_location:
                warning_msg = f"警告: 物料 {item.material_code} 在位置 {item.material_location} 的余料已被订单 {material_conflict.order_no} 预占"
                db_queue = CuttingQueue(**item.model_dump())
                db_queue.remarks = (db_queue.remarks or "") + f" [{warning_msg}]"
                db.add(db_queue)
                db.commit()
                db.refresh(db_queue)
                results.append({
                    "row": row,
                    "order_no": item.order_no,
                    "success": True,
                    "message": warning_msg,
                    "error_type": "material_conflict",
                    "data": db_queue
                })
                success_count += 1
            else:
                db_queue = CuttingQueue(**item.model_dump())
                db.add(db_queue)
                db.commit()
                db.refresh(db_queue)
                results.append({
                    "row": row,
                    "order_no": item.order_no,
                    "success": True,
                    "message": "导入成功",
                    "data": db_queue
                })
                success_count += 1
                
        except Exception as e:
            db.rollback()
            results.append({
                "row": row,
                "order_no": item.order_no,
                "success": False,
                "message": f"导入失败: {str(e)}",
                "error_type": "system_error"
            })
            failed_count += 1
    
    return {
        "total": len(items),
        "success_count": success_count,
        "failed_count": failed_count,
        "results": results
    }
