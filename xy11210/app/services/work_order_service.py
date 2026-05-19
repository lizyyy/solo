from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional, List
from datetime import datetime
import uuid
from app.models.models import WorkOrder, WorkOrderStatus, HistoryLog, User
from app.schemas.schemas import WorkOrderCreate, WorkOrderAssign, WorkOrderArrive, WorkOrderReinspect, WorkOrderClose
from app.utils.logger import logger


class WorkOrderService:
    @staticmethod
    def generate_order_no() -> str:
        date_str = datetime.now().strftime("%Y%m%d")
        uuid_str = str(uuid.uuid4())[:8].upper()
        return f"WO-{date_str}-{uuid_str}"
    
    @staticmethod
    def get_work_order(db: Session, order_id: int) -> Optional[WorkOrder]:
        return db.query(WorkOrder).filter(WorkOrder.id == order_id).first()
    
    @staticmethod
    def get_work_order_by_no(db: Session, order_no: str) -> Optional[WorkOrder]:
        return db.query(WorkOrder).filter(WorkOrder.order_no == order_no).first()
    
    @staticmethod
    def get_work_orders(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        status: Optional[WorkOrderStatus] = None,
        pump_room_id: Optional[int] = None,
        assigned_to: Optional[int] = None,
        created_by: Optional[int] = None
    ) -> List[WorkOrder]:
        query = db.query(WorkOrder)
        
        if status:
            query = query.filter(WorkOrder.status == status)
        if pump_room_id:
            query = query.filter(WorkOrder.pump_room_id == pump_room_id)
        if assigned_to:
            query = query.filter(WorkOrder.assigned_to == assigned_to)
        if created_by:
            query = query.filter(WorkOrder.created_by == created_by)
        
        return query.order_by(WorkOrder.created_at.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def count_work_orders(
        db: Session,
        status: Optional[WorkOrderStatus] = None,
        pump_room_id: Optional[int] = None,
        assigned_to: Optional[int] = None,
        created_by: Optional[int] = None
    ) -> int:
        query = db.query(WorkOrder)
        
        if status:
            query = query.filter(WorkOrder.status == status)
        if pump_room_id:
            query = query.filter(WorkOrder.pump_room_id == pump_room_id)
        if assigned_to:
            query = query.filter(WorkOrder.assigned_to == assigned_to)
        if created_by:
            query = query.filter(WorkOrder.created_by == created_by)
        
        return query.count()
    
    @staticmethod
    def _create_history_log(
        db: Session,
        work_order_id: int,
        user_id: int,
        action: str,
        from_status: Optional[str] = None,
        to_status: Optional[str] = None,
        description: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> HistoryLog:
        log = HistoryLog(
            work_order_id=work_order_id,
            user_id=user_id,
            action=action,
            from_status=from_status,
            to_status=to_status,
            description=description,
            ip_address=ip_address
        )
        db.add(log)
        return log
    
    @staticmethod
    def create_work_order(
        db: Session,
        order_in: WorkOrderCreate,
        created_by: int,
        ip_address: Optional[str] = None
    ) -> WorkOrder:
        order_no = WorkOrderService.generate_order_no()
        
        try:
            db_order = WorkOrder(
                order_no=order_no,
                pump_room_id=order_in.pump_room_id,
                inspection_record_id=order_in.inspection_record_id,
                created_by=created_by,
                title=order_in.title,
                description=order_in.description,
                priority=order_in.priority,
                issue_type=order_in.issue_type,
                status=WorkOrderStatus.CREATED
            )
            db.add(db_order)
            db.flush()
            
            WorkOrderService._create_history_log(
                db,
                work_order_id=db_order.id,
                user_id=created_by,
                action="create",
                to_status=WorkOrderStatus.CREATED.value,
                description="创建报修工单",
                ip_address=ip_address
            )
            
            db.commit()
            db.refresh(db_order)
            logger.info({"action": "create_work_order", "order_id": db_order.id, "order_no": order_no})
            return db_order
        except IntegrityError as e:
            db.rollback()
            logger.warning({"action": "create_work_order_failed", "reason": str(e)})
            raise ValueError("创建工单失败")
    
    @staticmethod
    def assign_work_order(
        db: Session,
        order_id: int,
        assign_in: WorkOrderAssign,
        assigned_by: int,
        ip_address: Optional[str] = None
    ) -> WorkOrder:
        db_order = WorkOrderService.get_work_order(db, order_id)
        if not db_order:
            raise ValueError("工单不存在")
        
        if db_order.status != WorkOrderStatus.CREATED:
            logger.warning({"action": "assign_failed", "order_id": order_id, "reason": "invalid_status", "current_status": db_order.status.value})
            raise ValueError(f"只有待派工状态的工单才能派工，当前状态: {db_order.status.value}")
        
        from_status = db_order.status.value
        
        db_order.assigned_to = assign_in.assigned_to
        db_order.status = WorkOrderStatus.ASSIGNED
        db_order.assigned_at = datetime.utcnow()
        
        WorkOrderService._create_history_log(
            db,
            work_order_id=db_order.id,
            user_id=assigned_by,
            action="assign",
            from_status=from_status,
            to_status=WorkOrderStatus.ASSIGNED.value,
            description=f"派工给用户ID: {assign_in.assigned_to}",
            ip_address=ip_address
        )
        
        db.commit()
        db.refresh(db_order)
        logger.info({"action": "assign_work_order", "order_id": order_id, "assigned_to": assign_in.assigned_to})
        return db_order
    
    @staticmethod
    def arrive_work_order(
        db: Session,
        order_id: int,
        arrive_in: WorkOrderArrive,
        user_id: int,
        ip_address: Optional[str] = None
    ) -> WorkOrder:
        db_order = WorkOrderService.get_work_order(db, order_id)
        if not db_order:
            raise ValueError("工单不存在")
        
        if db_order.status not in [WorkOrderStatus.ASSIGNED, WorkOrderStatus.ARRIVED]:
            logger.warning({"action": "arrive_failed", "order_id": order_id, "reason": "invalid_status", "current_status": db_order.status.value})
            raise ValueError(f"只有已派工状态的工单才能签到，当前状态: {db_order.status.value}")
        
        if db_order.assigned_to != user_id:
            logger.warning({"action": "arrive_failed", "order_id": order_id, "reason": "not_assigned_user"})
            raise ValueError("只有被派工的人员才能签到")
        
        if db_order.status == WorkOrderStatus.ARRIVED:
            logger.info({"action": "arrive_already_done", "order_id": order_id})
            return db_order
        
        from_status = db_order.status.value
        
        db_order.status = WorkOrderStatus.ARRIVED
        db_order.arrived_at = datetime.utcnow()
        db_order.arrival_photo = arrive_in.arrival_photo
        
        WorkOrderService._create_history_log(
            db,
            work_order_id=db_order.id,
            user_id=user_id,
            action="arrive",
            from_status=from_status,
            to_status=WorkOrderStatus.ARRIVED.value,
            description="现场签到完成",
            ip_address=ip_address
        )
        
        db.commit()
        db.refresh(db_order)
        logger.info({"action": "arrive_work_order", "order_id": order_id})
        return db_order
    
    @staticmethod
    def reinspect_work_order(
        db: Session,
        order_id: int,
        reinspect_in: WorkOrderReinspect,
        user_id: int,
        ip_address: Optional[str] = None
    ) -> WorkOrder:
        db_order = WorkOrderService.get_work_order(db, order_id)
        if not db_order:
            raise ValueError("工单不存在")
        
        if db_order.status not in [WorkOrderStatus.ARRIVED, WorkOrderStatus.REINSPECTED]:
            logger.warning({"action": "reinspect_failed", "order_id": order_id, "reason": "invalid_status", "current_status": db_order.status.value})
            raise ValueError(f"只有已到场状态的工单才能复测，当前状态: {db_order.status.value}")
        
        if db_order.status == WorkOrderStatus.REINSPECTED:
            logger.info({"action": "reinspect_already_done", "order_id": order_id})
            return db_order
        
        from_status = db_order.status.value
        
        db_order.status = WorkOrderStatus.REINSPECTED
        db_order.reinspected_at = datetime.utcnow()
        db_order.reinspection_result = reinspect_in.reinspection_result
        db_order.repair_description = reinspect_in.repair_description
        
        WorkOrderService._create_history_log(
            db,
            work_order_id=db_order.id,
            user_id=user_id,
            action="reinspect",
            from_status=from_status,
            to_status=WorkOrderStatus.REINSPECTED.value,
            description=f"复测完成: {reinspect_in.reinspection_result}",
            ip_address=ip_address
        )
        
        db.commit()
        db.refresh(db_order)
        logger.info({"action": "reinspect_work_order", "order_id": order_id})
        return db_order
    
    @staticmethod
    def close_work_order(
        db: Session,
        order_id: int,
        close_in: WorkOrderClose,
        user_id: int,
        ip_address: Optional[str] = None
    ) -> WorkOrder:
        db_order = WorkOrderService.get_work_order(db, order_id)
        if not db_order:
            raise ValueError("工单不存在")
        
        if db_order.status not in [WorkOrderStatus.REINSPECTED, WorkOrderStatus.CLOSED]:
            logger.warning({"action": "close_failed", "order_id": order_id, "reason": "invalid_status", "current_status": db_order.status.value})
            raise ValueError(f"只有已复测状态的工单才能关闭，当前状态: {db_order.status.value}")
        
        if db_order.status == WorkOrderStatus.CLOSED:
            logger.info({"action": "close_already_done", "order_id": order_id})
            return db_order
        
        from_status = db_order.status.value
        
        db_order.status = WorkOrderStatus.CLOSED
        db_order.closed_at = datetime.utcnow()
        db_order.close_reason = close_in.close_reason
        
        WorkOrderService._create_history_log(
            db,
            work_order_id=db_order.id,
            user_id=user_id,
            action="close",
            from_status=from_status,
            to_status=WorkOrderStatus.CLOSED.value,
            description=f"工单关闭: {close_in.close_reason or '正常关闭'}",
            ip_address=ip_address
        )
        
        db.commit()
        db.refresh(db_order)
        logger.info({"action": "close_work_order", "order_id": order_id})
        return db_order
    
    @staticmethod
    def get_history_logs(db: Session, order_id: int, skip: int = 0, limit: int = 50) -> List[HistoryLog]:
        return db.query(HistoryLog).filter(
            HistoryLog.work_order_id == order_id
        ).order_by(HistoryLog.created_at.desc()).offset(skip).limit(limit).all()
