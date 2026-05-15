import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from .models import (
    RepairOrder, FailedRecord, ImportResult, 
    FieldSource, DiffItem, ManualCorrection
)
from .storage import Storage


class DataProcessor:
    def __init__(self, storage: Storage):
        self.storage = storage
    
    def _parse_datetime(self, value: Any) -> datetime:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                from dateutil import parser
                return parser.parse(value)
        raise ValueError(f"无法解析日期时间: {value}")
    
    def _extract_field_sources(self, data: Dict[str, Any], prefix: str = "") -> List[FieldSource]:
        sources = []
        for key, value in data.items():
            field_path = f"{prefix}.{key}" if prefix else key
            if isinstance(value, dict):
                sources.extend(self._extract_field_sources(value, field_path))
            else:
                source_info = data.get("_meta", {}).get(key, {})
                sources.append(FieldSource(
                    field_path=field_path,
                    source=source_info.get("source", "unknown"),
                    source_type=source_info.get("source_type", "direct"),
                    processing_rule=source_info.get("rule"),
                    raw_value=value,
                    processed_value=value
                ))
        return sources
    
    def validate_repair_order(self, data: Dict[str, Any]) -> Tuple[bool, List[str]]:
        errors = []
        
        required_fields = ["order_id", "source_system", "report_date", "repair_type", "building", "room", "description", "status"]
        for field in required_fields:
            if field not in data or not data[field]:
                errors.append(f"缺少必填字段: {field}")
        
        if "order_id" in data and len(data["order_id"]) < 5:
            errors.append("order_id格式不正确，长度至少5位")
        
        if "report_date" in data:
            try:
                datetime.strptime(data["report_date"], "%Y-%m-%d")
            except ValueError:
                errors.append("report_date格式不正确，应为YYYY-MM-DD")
        
        return len(errors) == 0, errors
    
    def process_repair_order(self, data: Dict[str, Any], batch_id: str) -> Tuple[Optional[RepairOrder], Optional[FailedRecord]]:
        record_id = str(uuid.uuid4())
        
        field_sources = self._extract_field_sources(data)
        
        is_valid, errors = self.validate_repair_order(data)
        if not is_valid:
            failed = FailedRecord(
                record_id=record_id,
                order_id=data.get("order_id"),
                error_type="VALIDATION_ERROR",
                error_message="; ".join(errors),
                input_data=data,
                field_sources=field_sources,
                suggestion="请检查必填字段是否完整，日期格式是否正确"
            )
            return None, failed
        
        try:
            created_at = self._parse_datetime(data.get("created_at", datetime.now().isoformat()))
            
            order = RepairOrder(
                order_id=data["order_id"],
                source_system=data["source_system"],
                report_date=data["report_date"],
                created_at=created_at,
                repair_type=data["repair_type"],
                building=data["building"],
                room=data["room"],
                description=data["description"],
                status=data["status"],
                assignee=data.get("assignee"),
                completed_at=self._parse_datetime(data["completed_at"]) if data.get("completed_at") else None,
                raw_data=data,
                field_sources=field_sources
            )
            
            return order, None
        except Exception as e:
            failed = FailedRecord(
                record_id=record_id,
                order_id=data.get("order_id"),
                error_type="PROCESSING_ERROR",
                error_message=str(e),
                input_data=data,
                field_sources=field_sources,
                suggestion="数据格式转换失败，请检查数据类型"
            )
            return None, failed
    
    def compare_with_existing(self, new_order: RepairOrder) -> List[DiffItem]:
        diffs = []
        existing = self.storage.get_repair_order(new_order.order_id)
        
        if not existing:
            return diffs
        
        fields_to_compare = ["source_system", "report_date", "repair_type", "building", "room", "description", "status", "assignee"]
        
        for field in fields_to_compare:
            old_val = getattr(existing, field)
            new_val = getattr(new_order, field)
            
            if old_val != new_val:
                diffs.append(DiffItem(
                    field_path=field,
                    old_value=old_val,
                    new_value=new_val,
                    source_old=existing.source_system,
                    source_new=new_order.source_system,
                    change_type="UPDATE"
                ))
        
        return diffs
    
    def import_batch(self, input_file: str) -> ImportResult:
        batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        started_at = datetime.now()
        
        with open(input_file, "r", encoding="utf-8") as f:
            records = json.load(f)
        
        result = ImportResult(
            batch_id=batch_id,
            total_records=len(records),
            success_count=0,
            failed_count=0,
            diff_count=0,
            started_at=started_at
        )
        
        for data in records:
            order, failed = self.process_repair_order(data, batch_id)
            
            if failed:
                result.failed_count += 1
                result.failed_records.append(failed)
                self.storage.save_failed_record(failed)
            elif order:
                diffs = self.compare_with_existing(order)
                
                if diffs:
                    result.diff_count += len(diffs)
                    result.diff_records.append({
                        "order_id": order.order_id,
                        "diffs": [d.model_dump(mode="json") for d in diffs]
                    })
                
                self.storage.save_repair_order(order)
                result.success_count += 1
        
        result.completed_at = datetime.now()
        self.storage.save_import_result(result)
        
        return result
    
    def add_manual_correction(
        self,
        order_id: str,
        field_path: str,
        new_value: Any,
        reason: str,
        source: str,
        processing_basis: str,
        is_gray_release: bool = False
    ) -> ManualCorrection:
        correction = ManualCorrection(
            correction_id=str(uuid.uuid4()),
            order_id=order_id,
            field_path=field_path,
            old_value=None,
            new_value=new_value,
            reason=reason,
            source=source,
            processing_basis=processing_basis,
            is_gray_release=is_gray_release
        )
        
        order = self.storage.get_repair_order(order_id)
        if order and hasattr(order, field_path):
            correction.old_value = getattr(order, field_path)
        
        self.storage.save_manual_correction(correction)
        return correction
    
    def generate_report(self, batch_id: str, output_file: str) -> None:
        result = self.storage.get_import_result(batch_id)
        if not result:
            raise ValueError(f"找不到批次: {batch_id}")
        
        failed_records = self.storage.get_failed_records()
        
        report = {
            "batch_info": {
                "batch_id": result.batch_id,
                "started_at": result.started_at.isoformat(),
                "completed_at": result.completed_at.isoformat() if result.completed_at else None,
                "statistics": {
                    "total_records": result.total_records,
                    "success_count": result.success_count,
                    "failed_count": result.failed_count,
                    "diff_count": result.diff_count
                }
            },
            "failed_records": [],
            "diff_records": result.diff_records
        }
        
        for failed in failed_records:
            report["failed_records"].append({
                "record_id": failed.record_id,
                "order_id": failed.order_id,
                "error_type": failed.error_type,
                "error_message": failed.error_message,
                "input_data": failed.input_data,
                "field_sources": [fs.model_dump(mode="json") for fs in failed.field_sources],
                "failed_at": failed.failed_at.isoformat(),
                "suggestion": failed.suggestion
            })
        
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
