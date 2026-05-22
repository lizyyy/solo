import uuid
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models import SourceData, RepairTask, RepairOrder, OrderMergeHistory
from app.core.config import SourceType

class OrderMerger:
    async def merge_if_needed(self, source_data: SourceData, task: RepairTask, 
                              db: Session) -> Optional[RepairOrder]:
        existing_order = self.find_existing_order(source_data, db)
        
        if existing_order:
            await self.merge_into_existing_order(existing_order, source_data, task, db)
            task.order_id = existing_order.order_id
            return existing_order
        else:
            new_order = self.create_new_order(source_data, task, db)
            task.order_id = new_order.order_id
            return new_order
    
    def find_existing_order(self, source_data: SourceData, db: Session) -> Optional[RepairOrder]:
        order = None
        
        if source_data.original_order_id:
            order = db.query(RepairOrder).filter(
                RepairOrder.order_id == source_data.original_order_id
            ).first()
            if order:
                return order
        
        if source_data.resident_id and source_data.room_number and source_data.repair_type:
            time_window = datetime.now() - timedelta(days=7)
            order = db.query(RepairOrder).filter(
                RepairOrder.resident_id == source_data.resident_id,
                RepairOrder.room_number == source_data.room_number,
                RepairOrder.repair_type == source_data.repair_type,
                RepairOrder.created_at >= time_window,
                RepairOrder.status == "active"
            ).first()
            if order:
                return order
        
        if source_data.source_id:
            order = db.query(RepairOrder).filter(
                RepairOrder.merged_source_ids.contains([source_data.source_id])
            ).first()
            if order:
                return order
        
        return None
    
    async def merge_into_existing_order(self, order: RepairOrder, 
                                        source_data: SourceData, 
                                        task: RepairTask,
                                        db: Session):
        details_before = {
            "is_repair_needed": order.is_repair_needed,
            "is_part_replacement": order.is_part_replacement,
            "total_material_cost": order.total_material_cost,
            "total_labor_cost": order.total_labor_cost,
            "merged_source_count": len(order.merged_source_ids or [])
        }
        
        if source_data.source_type == SourceType.TECHNICIAN_RECEIPT.value:
            if source_data.completion_status == "repair_needed":
                order.is_repair_needed = True
                task.is_repair = True
            elif source_data.completion_status == "part_replacement":
                order.is_part_replacement = True
                task.is_part_replacement = True
        
        if source_data.material_cost:
            order.total_material_cost += source_data.material_cost
        
        if source_data.work_hours:
            hourly_rate = 100.0
            order.total_labor_cost += source_data.work_hours * hourly_rate
        
        if not order.merged_source_ids:
            order.merged_source_ids = []
        if source_data.source_id not in order.merged_source_ids:
            order.merged_source_ids.append(source_data.source_id)
        
        if not order.related_task_ids:
            order.related_task_ids = []
        if task.task_id not in order.related_task_ids:
            order.related_task_ids.append(task.task_id)
        
        details_after = {
            "is_repair_needed": order.is_repair_needed,
            "is_part_replacement": order.is_part_replacement,
            "total_material_cost": order.total_material_cost,
            "total_labor_cost": order.total_labor_cost,
            "merged_source_count": len(order.merged_source_ids or [])
        }
        
        self.record_merge_history(order, source_data, task, 
                                 details_before, details_after, db)
    
    def create_new_order(self, source_data: SourceData, 
                         task: RepairTask, 
                         db: Session) -> RepairOrder:
        order_id = f"ORD-{uuid.uuid4().hex[:12].upper()}"
        
        order = RepairOrder(
            order_id=order_id,
            resident_id=source_data.resident_id,
            resident_name=source_data.resident_name,
            room_number=source_data.room_number,
            repair_type=source_data.repair_type,
            original_repair_content=source_data.repair_content,
            first_repair_time=source_data.submit_time,
            technician_id=source_data.technician_id,
            technician_name=source_data.technician_name,
            is_repair_needed=source_data.completion_status == "repair_needed",
            is_part_replacement=source_data.completion_status == "part_replacement",
            total_material_cost=source_data.material_cost or 0.0,
            total_labor_cost=(source_data.work_hours or 0.0) * 100.0,
            merged_source_ids=[source_data.source_id] if source_data.source_id else [],
            related_task_ids=[task.task_id]
        )
        
        db.add(order)
        db.flush()
        
        return order
    
    def record_merge_history(self, order: RepairOrder, 
                            source_data: SourceData,
                            task: RepairTask,
                            details_before: dict,
                            details_after: dict,
                            db: Session):
        merge_id = f"MRG-{uuid.uuid4().hex[:8].upper()}"
        
        merge_reason = self.determine_merge_reason(source_data)
        
        history = OrderMergeHistory(
            merge_id=merge_id,
            target_order_id=order.order_id,
            source_order_id=source_data.original_order_id,
            source_type=source_data.source_type,
            source_data_id=source_data.id,
            merge_reason=merge_reason,
            merge_type="auto_merge",
            details_before=details_before,
            details_after=details_after
        )
        
        db.add(history)
    
    def determine_merge_reason(self, source_data: SourceData) -> str:
        if source_data.source_type == SourceType.SUPPLEMENTARY_FORM.value:
            return "Supplementary form linked to original order"
        elif source_data.source_type == SourceType.MATERIAL_FORM.value:
            return "Material usage linked to existing repair"
        elif source_data.source_type == SourceType.TECHNICIAN_RECEIPT.value:
            return "Technician receipt for ongoing repair"
        else:
            return "Same resident, room, and repair type within 7 days"
