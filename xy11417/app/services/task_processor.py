import hashlib
import json
from dataclasses import dataclass
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import SourceData, RepairTask, RepairOrder, OrderMergeHistory
from app.core.config import TaskStatus, RetryCategory, SourceType
from app.services.order_merger import OrderMerger

@dataclass
class ProcessResult:
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    retry_category: Optional[str] = None

class TaskProcessor:
    def __init__(self):
        self.order_merger = OrderMerger()
    
    async def process(self, task: RepairTask, db: Session) -> ProcessResult:
        try:
            source_data = db.query(SourceData).filter(
                SourceData.id == task.source_data_id
            ).first()
            
            if not source_data:
                return ProcessResult(
                    success=False,
                    error="Source data not found",
                    retry_category=RetryCategory.MISSING_DATA.value
                )
            
            if not source_data.is_valid:
                return ProcessResult(
                    success=False,
                    error=f"Source data invalid: {source_data.validation_errors}",
                    retry_category=RetryCategory.DATA_VALIDATION.value
                )
            
            merged_order = await self.order_merger.merge_if_needed(source_data, task, db)
            
            result_data = {
                "order_id": merged_order.order_id if merged_order else None,
                "order_merged": merged_order is not None,
                "source_processed": True,
                "merged_source_count": len(merged_order.merged_source_ids or []) if merged_order else 1
            }
            
            return ProcessResult(success=True, data=result_data)
            
        except Exception as e:
            return ProcessResult(
                success=False,
                error=str(e),
                retry_category=RetryCategory.SYSTEM_ERROR.value
            )
    
    def validate_source_data(self, source_data: SourceData) -> tuple[bool, list]:
        errors = []
        
        if not source_data.resident_id:
            errors.append("resident_id is required")
        if not source_data.room_number:
            errors.append("room_number is required")
        if not source_data.repair_type:
            errors.append("repair_type is required")
        
        if source_data.source_type == SourceType.MATERIAL_FORM.value:
            if not source_data.material_used or len(source_data.material_used) == 0:
                errors.append("material_used is required for material_form")
        
        if source_data.source_type == SourceType.TECHNICIAN_RECEIPT.value:
            if not source_data.technician_id:
                errors.append("technician_id is required for technician_receipt")
            if not source_data.receipt_number:
                errors.append("receipt_number is required for technician_receipt")
        
        if source_data.source_type == SourceType.SUPPLEMENTARY_FORM.value:
            if not source_data.original_order_id:
                errors.append("original_order_id is required for supplementary_form")
            if not source_data.supplementary_reason:
                errors.append("supplementary_reason is required for supplementary_form")
        
        return len(errors) == 0, errors
    
    def calculate_data_hash(self, data_dict: dict) -> str:
        sorted_data = json.dumps(data_dict, sort_keys=True)
        return hashlib.sha256(sorted_data.encode()).hexdigest()
