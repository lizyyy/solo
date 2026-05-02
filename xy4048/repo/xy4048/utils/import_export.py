import csv
import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from enum import Enum

from config import CONFIG, TaskStatus
from database import (
    DatabaseManager, DeliveryTask, CoolerBox, DrugBatch,
    DeliveryRoute, DeliveryPoint, PackingItem, TemperatureReading,
    Attachment, AuditLog, AuditPackage, ExceptionRecord,
    QuarantineRecord, AttachmentType, ExceptionType
)
from core import (
    TemperatureCSVParser, Validator, ValidationResult,
    StateMachine
)


@dataclass
class ImportResult:
    success: bool
    imported_count: int = 0
    failed_count: int = 0
    errors: List[Dict[str, Any]] = None
    warnings: List[Dict[str, Any]] = None


class ImportExportManager:
    def __init__(self, db: DatabaseManager):
        self.db = db
        self.config = CONFIG
        self.parser = TemperatureCSVParser()
        self.validator = Validator(db)
        self.state_machine = StateMachine(db)
    
    def generate_task_number(self) -> str:
        today = datetime.now().strftime("%Y%m%d")
        count = self.db.execute_query(
            "SELECT COUNT(*) as cnt FROM delivery_tasks WHERE task_number LIKE ?",
            (f"TK{today}%",)
        )
        seq = count[0]['cnt'] + 1 if count else 1
        return f"TK{today}{seq:04d}"
    
    def import_temperature_csv(
        self,
        file_path: Path,
        operator: str = ""
    ) -> ImportResult:
        errors = []
        warnings = []
        imported_count = 0
        
        parse_result = self.parser.parse(file_path)
        
        if parse_result.errors:
            for err in parse_result.errors:
                errors.append({
                    "source": "parse",
                    "row": err.get("row", 0),
                    "reason": err.get("reason", ""),
                    "category": err.get("category", "解析错误")
                })
        
        if not parse_result.readings and parse_result.total_rows == 0:
            return ImportResult(
                success=False,
                errors=errors,
                warnings=warnings
            )
        
        validation_result = self.validator.validate(
            parse_result,
            file_path.name
        )
        
        if validation_result.errors:
            self.validator.create_quarantine_records(
                validation_result.errors,
                file_path.name
            )
            
            for err in validation_result.errors:
                errors.append({
                    "source": "validation",
                    "row": err.row_number,
                    "reason": err.message,
                    "category": err.category.value
                })
        
        if validation_result.warnings:
            for warn in validation_result.warnings:
                warnings.append({
                    "row": warn.row_number,
                    "reason": warn.message,
                    "category": warn.category.value
                })
        
        device_task_map = validation_result.device_to_task_map
        
        for reading in validation_result.valid_readings:
            task_id = None
            
            if reading.device_id in device_task_map:
                task_id = device_task_map[reading.device_id]
            elif reading.box_number in device_task_map:
                task_id = device_task_map[reading.box_number]
            
            if task_id is None:
                continue
            
            is_overtemp = self.config.is_temperature_over(reading.temperature)
            
            temp_reading = TemperatureReading(
                task_id=task_id,
                device_id=reading.device_id,
                reading_time=reading.reading_time,
                temperature=reading.temperature,
                box_number=reading.box_number,
                battery=reading.battery,
                is_overtemp=is_overtemp,
                source_file=file_path.name,
                raw_data=reading.raw_data
            )
            
            self.db.create(temp_reading)
            imported_count += 1
            
            task = self.db.get_by_id(DeliveryTask, task_id)
            if task and task.status == TaskStatus.IN_TRANSIT:
                has_consecutive, readings_list = self.validator.check_consecutive_overtemp(task_id)
                
                if has_consecutive:
                    reading_ids = [r.id for r in readings_list if r.id]
                    self.state_machine.flag_for_review(
                        task,
                        f"连续{self.config.consecutive_overtemp_count}次超温",
                        reading_ids,
                        operator
                    )
        
        return ImportResult(
            success=True,
            imported_count=imported_count,
            failed_count=len(errors),
            errors=errors,
            warnings=warnings
        )
    
    def import_pharmacy_tasks(
        self,
        file_path: Path,
        operator: str = ""
    ) -> ImportResult:
        errors = []
        warnings = []
        imported_count = 0
        
        tasks_data, parse_errors = self.parser.parse_pharmacy_csv(file_path)
        
        if parse_errors:
            errors.extend(parse_errors)
        
        for task_data in tasks_data:
            try:
                cooler_box = None
                if task_data.get('cooler_box_number'):
                    cooler_box = self.db.get_by_field(
                        CoolerBox,
                        "box_number",
                        task_data['cooler_box_number']
                    )
                
                drug_batch = None
                if task_data.get('drug_batch_number'):
                    drug_batch = self.db.get_by_field(
                        DrugBatch,
                        "batch_number",
                        task_data['drug_batch_number']
                    )
                
                delivery_route = None
                if task_data.get('route'):
                    delivery_route = self.db.get_by_field(
                        DeliveryRoute,
                        "route_name",
                        task_data['route']
                    )
                
                delivery_point = None
                if task_data.get('delivery_point'):
                    delivery_point = self.db.get_by_field(
                        DeliveryPoint,
                        "point_name",
                        task_data['delivery_point']
                    )
                
                task_number = task_data.get('task_number') or self.generate_task_number()
                
                existing_task = self.db.get_by_field(DeliveryTask, "task_number", task_number)
                if existing_task:
                    warnings.append({
                        "task_number": task_number,
                        "reason": "任务编号已存在，跳过"
                    })
                    continue
                
                task = DeliveryTask(
                    task_number=task_number,
                    status=TaskStatus.TO_PACK,
                    cooler_box_id=cooler_box.id if cooler_box else None,
                    route_id=delivery_route.id if delivery_route else None,
                    delivery_point_id=delivery_point.id if delivery_point else None,
                    pharmacist=task_data.get('pharmacist', ''),
                    courier=task_data.get('courier', ''),
                    notes=task_data.get('notes', '')
                )
                
                task = self.db.create(task)
                
                if drug_batch and task_data.get('quantity', 0) > 0:
                    packing_item = PackingItem(
                        task_id=task.id,
                        drug_batch_id=drug_batch.id,
                        quantity=task_data['quantity'],
                        unit=task_data.get('unit', '支')
                    )
                    self.db.create(packing_item)
                
                self.db.log_audit(
                    task_id=task.id,
                    action="任务创建",
                    operator=operator,
                    details=f"从CSV导入创建任务: {task_number}"
                )
                
                imported_count += 1
                
            except Exception as e:
                errors.append({
                    "task_number": task_data.get('task_number', '未知'),
                    "reason": str(e)
                })
        
        return ImportResult(
            success=len(errors) < len(tasks_data),
            imported_count=imported_count,
            failed_count=len(errors),
            errors=errors,
            warnings=warnings
        )
    
    def export_overtemperature_risk_csv(
        self,
        output_path: Path,
        task_ids: List[int] = None
    ) -> int:
        query = '''
            SELECT 
                dt.task_number,
                dt.status,
                tr.reading_time,
                tr.temperature,
                tr.box_number,
                tr.device_id,
                tr.is_overtemp,
                dt.pharmacist,
                dt.courier
            FROM temperature_readings tr
            JOIN delivery_tasks dt ON tr.task_id = dt.id
            WHERE tr.is_overtemp = 1
        '''
        
        params = []
        if task_ids:
            placeholders = ', '.join(['?' for _ in task_ids])
            query += f" AND dt.id IN ({placeholders})"
            params = task_ids
        
        query += " ORDER BY tr.reading_time DESC"
        
        results = self.db.execute_query(query, tuple(params) if params else ())
        
        if not results:
            return 0
        
        with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(
                f,
                fieldnames=[
                    'task_number', 'status', 'reading_time', 'temperature',
                    'box_number', 'device_id', 'is_overtemp', 'pharmacist', 'courier'
                ]
            )
            writer.writeheader()
            for row in results:
                writer.writerow({
                    'task_number': row['task_number'],
                    'status': row['status'],
                    'reading_time': row['reading_time'],
                    'temperature': row['temperature'],
                    'box_number': row['box_number'],
                    'device_id': row['device_id'],
                    'is_overtemp': '是' if row['is_overtemp'] else '否',
                    'pharmacist': row['pharmacist'],
                    'courier': row['courier']
                })
        
        return len(results)
    
    def export_audit_package_json(
        self,
        task_id: int,
        output_path: Optional[Path] = None
    ) -> Tuple[bool, Optional[Path], Dict[str, Any]]:
        task = self.db.get_by_id(DeliveryTask, task_id)
        if not task:
            return False, None, {}
        
        audit_package = self.db.get_by_field(AuditPackage, "task_id", task_id)
        
        temperature_readings = self.db.get_all(
            TemperatureReading,
            "task_id = ?",
            (task_id,)
        )
        
        attachments = self.db.get_all(
            Attachment,
            "task_id = ?",
            (task_id,)
        )
        
        audit_logs = self.db.get_all(
            AuditLog,
            "task_id = ?",
            (task_id,)
        )
        
        exceptions = self.db.get_all(
            ExceptionRecord,
            "task_id = ?",
            (task_id,)
        )
        
        cooler_box = None
        if task.cooler_box_id:
            cooler_box = self.db.get_by_id(CoolerBox, task.cooler_box_id)
        
        delivery_point = None
        if task.delivery_point_id:
            delivery_point = self.db.get_by_id(DeliveryPoint, task.delivery_point_id)
        
        route = None
        if task.route_id:
            route = self.db.get_by_id(DeliveryRoute, task.route_id)
        
        package_data = {
            "package_info": {
                "task_number": task.task_number,
                "generated_at": datetime.now().isoformat(),
                "version": "1.0"
            },
            "task_summary": {
                "task_number": task.task_number,
                "status": task.status.value,
                "pharmacist": task.pharmacist,
                "courier": task.courier,
                "packing_time": task.packing_time.isoformat() if task.packing_time else None,
                "departure_time": task.departure_time.isoformat() if task.departure_time else None,
                "arrival_time": task.arrival_time.isoformat() if task.arrival_time else None,
                "sign_time": task.sign_time.isoformat() if task.sign_time else None,
                "archive_time": task.archive_time.isoformat() if task.archive_time else None,
                "notes": task.notes
            },
            "cooler_box": {
                "box_number": cooler_box.box_number if cooler_box else None,
                "device_id": cooler_box.device_id if cooler_box else None,
                "description": cooler_box.description if cooler_box else None
            } if cooler_box else None,
            "delivery_point": {
                "point_name": delivery_point.point_name if delivery_point else None,
                "address": delivery_point.address if delivery_point else None,
                "contact_person": delivery_point.contact_person if delivery_point else None,
                "contact_phone": delivery_point.contact_phone if delivery_point else None
            } if delivery_point else None,
            "route": {
                "route_name": route.route_name if route else None,
                "description": route.description if route else None
            } if route else None,
            "temperature_readings": [
                {
                    "reading_time": r.reading_time.isoformat() if r.reading_time else None,
                    "temperature": r.temperature,
                    "box_number": r.box_number,
                    "device_id": r.device_id,
                    "battery": r.battery,
                    "is_overtemp": r.is_overtemp,
                    "source_file": r.source_file
                }
                for r in temperature_readings
            ],
            "attachments": [
                {
                    "original_filename": a.original_filename,
                    "stored_filename": a.stored_filename,
                    "file_size": a.file_size,
                    "sha256_hash": a.sha256_hash,
                    "attachment_type": a.attachment_type.value if hasattr(a.attachment_type, 'value') else a.attachment_type,
                    "created_at": a.created_at.isoformat() if a.created_at else None
                }
                for a in attachments
            ],
            "audit_logs": [
                {
                    "action": l.action,
                    "operator": l.operator,
                    "details": l.details,
                    "created_at": l.created_at.isoformat() if l.created_at else None
                }
                for l in audit_logs
            ],
            "exceptions": [
                {
                    "exception_type": e.exception_type.value if hasattr(e.exception_type, 'value') else e.exception_type,
                    "details": e.details,
                    "is_resolved": e.is_resolved,
                    "resolution_notes": e.resolution_notes,
                    "resolved_at": e.resolved_at.isoformat() if e.resolved_at else None,
                    "created_at": e.created_at.isoformat() if e.created_at else None
                }
                for e in exceptions
            ],
            "audit_assessment": {
                "temperature_risk": audit_package.temperature_risk if audit_package else None,
                "handling_opinion": audit_package.handling_opinion if audit_package else None,
                "attachments_hash": audit_package.attachments_hash if audit_package else None
            } if audit_package else None
        }
        
        json_str = json.dumps(package_data, ensure_ascii=False, indent=2)
        full_hash = hashlib.sha256(json_str.encode('utf-8')).hexdigest()
        package_data["full_hash"] = full_hash
        
        if output_path is None:
            output_path = CONFIG.exports_dir / f"audit_{task.task_number}_{datetime.now().strftime('%Y%m%d%H%M%S')}.json"
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(package_data, f, ensure_ascii=False, indent=2)
        
        return True, output_path, package_data
