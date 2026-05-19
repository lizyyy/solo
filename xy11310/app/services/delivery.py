from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import date, datetime
import hashlib

from app.models import Elderly, Delivery, DeliveryStatus, MealAllocation, MealStatus
from app.core.logging import app_logger
from app.services.history import HistoryService


class DeliveryService:
    @staticmethod
    def generate_batch_id(delivery_date: date) -> str:
        data = f"delivery-{delivery_date.isoformat()}"
        return hashlib.md5(data.encode()).hexdigest()
    
    @staticmethod
    def create_delivery_records(
        db: Session,
        delivery_date: date,
        meal_type: str,
        elderly_ids: Optional[List[int]] = None,
        operator: Optional[str] = None
    ) -> Dict[str, Any]:
        batch_id = DeliveryService.generate_batch_id(delivery_date)
        
        existing = db.query(Delivery).filter(
            Delivery.delivery_batch_id == batch_id,
            Delivery.meal_type == meal_type
        ).first()
        
        if existing:
            app_logger.info(f"配送批次已存在: {batch_id}")
            count = db.query(Delivery).filter(
                Delivery.delivery_batch_id == batch_id,
                Delivery.meal_type == meal_type
            ).count()
            return {
                "success": True,
                "is_duplicate": True,
                "batch_id": batch_id,
                "delivery_count": count,
                "message": "配送批次已存在"
            }
        
        if elderly_ids is None:
            elderly_ids = [e.id for e in db.query(Elderly).filter(Elderly.is_active == True).all()]
        
        deliveries_created = 0
        for elderly_id in elderly_ids:
            elderly = db.query(Elderly).filter(Elderly.id == elderly_id).first()
            if not elderly:
                continue
            
            allocation = db.query(MealAllocation).filter(
                MealAllocation.elderly_id == elderly_id,
                MealAllocation.menu_date == delivery_date,
                MealAllocation.meal_type == meal_type
            ).first()
            
            delivery = Delivery(
                delivery_batch_id=batch_id,
                elderly_id=elderly_id,
                meal_allocation_id=allocation.id if allocation else None,
                delivery_date=delivery_date,
                meal_type=meal_type,
                route=elderly.delivery_route,
                sequence=elderly.delivery_sequence,
                status=DeliveryStatus.PENDING
            )
            
            db.add(delivery)
            deliveries_created += 1
        
        db.commit()
        
        HistoryService.record_operation(
            db=db,
            operation_type="create",
            entity_type="DeliveryBatch",
            after_data={
                "batch_id": batch_id,
                "delivery_date": str(delivery_date),
                "meal_type": meal_type,
                "deliveries_count": deliveries_created
            },
            operator=operator
        )
        
        app_logger.info(f"配送批次创建成功: {batch_id}, 数量: {deliveries_created}")
        
        return {
            "success": True,
            "is_duplicate": False,
            "batch_id": batch_id,
            "delivery_count": deliveries_created,
            "message": "配送批次创建成功"
        }
    
    @staticmethod
    def get_deliveries_by_batch(
        db: Session,
        batch_id: str
    ) -> Dict[str, Any]:
        deliveries = db.query(Delivery).filter(Delivery.delivery_batch_id == batch_id).all()
        
        result = []
        for delivery in deliveries:
            elderly = db.query(Elderly).filter(Elderly.id == delivery.elderly_id).first()
            result.append({
                "delivery_id": delivery.id,
                "elderly_id": delivery.elderly_id,
                "elderly_name": elderly.name if elderly else None,
                "route": delivery.route,
                "sequence": delivery.sequence,
                "status": delivery.status.value,
                "delivered_by": delivery.delivered_by,
                "delivered_at": delivery.delivered_at.isoformat() if delivery.delivered_at else None
            })
        
        return {
            "success": True,
            "batch_id": batch_id,
            "total": len(result),
            "deliveries": result
        }
    
    @staticmethod
    def mark_as_delivered(
        db: Session,
        delivery_id: int,
        delivered_by: str,
        received_by: Optional[str] = None,
        temperature: Optional[str] = None,
        packaging_condition: Optional[str] = None,
        operator: Optional[str] = None
    ) -> Dict[str, Any]:
        delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
        if not delivery:
            return {
                "success": False,
                "message": "配送记录不存在"
            }
        
        before_data = HistoryService.get_entity_before_data(delivery)
        
        delivery.status = DeliveryStatus.DELIVERED
        delivery.delivered_by = delivered_by
        delivery.delivered_at = datetime.now()
        delivery.received_by = received_by
        delivery.temperature = temperature
        delivery.packaging_condition = packaging_condition
        
        after_data = HistoryService.get_entity_before_data(delivery)
        
        db.commit()
        
        if delivery.meal_allocation_id:
            allocation = db.query(MealAllocation).filter(
                MealAllocation.id == delivery.meal_allocation_id
            ).first()
            if allocation:
                allocation.status = MealStatus.DELIVERED
                db.commit()
        
        HistoryService.record_operation(
            db=db,
            operation_type="update",
            entity_type="Delivery",
            entity_id=delivery.id,
            before_data=before_data,
            after_data=after_data,
            changes=HistoryService.calculate_changes(before_data, after_data),
            operator=operator
        )
        
        app_logger.info(f"配送完成: {delivery_id}, 配送员: {delivered_by}")
        
        return {
            "success": True,
            "delivery_id": delivery_id,
            "status": DeliveryStatus.DELIVERED,
            "message": "配送已完成"
        }
    
    @staticmethod
    def mark_as_failed(
        db: Session,
        delivery_id: int,
        failure_reason: str,
        delivered_by: str,
        operator: Optional[str] = None
    ) -> Dict[str, Any]:
        delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
        if not delivery:
            return {
                "success": False,
                "message": "配送记录不存在"
            }
        
        before_data = HistoryService.get_entity_before_data(delivery)
        
        delivery.status = DeliveryStatus.FAILED
        delivery.delivered_by = delivered_by
        delivery.delivered_at = datetime.now()
        delivery.failure_reason = failure_reason
        
        after_data = HistoryService.get_entity_before_data(delivery)
        
        db.commit()
        
        HistoryService.record_operation(
            db=db,
            operation_type="update",
            entity_type="Delivery",
            entity_id=delivery.id,
            before_data=before_data,
            after_data=after_data,
            changes=HistoryService.calculate_changes(before_data, after_data),
            operator=operator
        )
        
        app_logger.info(f"配送失败: {delivery_id}, 原因: {failure_reason}")
        
        return {
            "success": True,
            "delivery_id": delivery_id,
            "status": DeliveryStatus.FAILED,
            "message": "配送已标记为失败"
        }
