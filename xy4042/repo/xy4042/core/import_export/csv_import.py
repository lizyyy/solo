from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import csv

from models.patient import Patient
from models.order import Order
from models.measurement import Measurement
from core.patient_repository import PatientRepository
from core.order_repository import OrderRepository
from core.measurement_repository import MeasurementRepository
from core.workflow.order_validator import OrderValidator, ValidationError


@dataclass
class ImportResult:
    success: bool
    total_rows: int = 0
    imported_rows: int = 0
    failed_rows: int = 0
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[ValidationError] = field(default_factory=list)
    imported_patients: List[Patient] = field(default_factory=list)
    imported_orders: List[Order] = field(default_factory=list)


class CSVImporter:
    REQUIRED_FIELDS = ["患者姓名", "订单号", "诊断部位", "左右侧"]
    
    FIELD_MAPPING = {
        "患者姓名": "patient_name",
        "姓名": "patient_name",
        "name": "patient_name",
        "订单号": "order_number",
        "order_number": "order_number",
        "诊断部位": "body_part",
        "部位": "body_part",
        "body_part": "body_part",
        "左右侧": "side",
        "侧别": "side",
        "side": "side",
        "联系电话": "phone",
        "电话": "phone",
        "phone": "phone",
        "取模日期": "impression_date",
        "日期": "impression_date",
        "date": "impression_date",
        "复诊日期": "follow_up_date",
        "follow_up": "follow_up_date",
        "技师": "technician",
        "technician": "technician",
        "备注": "notes",
        "notes": "notes",
    }
    
    def __init__(self):
        self.validator = OrderValidator()
        self.patient_repo = PatientRepository()
        self.order_repo = OrderRepository()
        self.measurement_repo = MeasurementRepository()
    
    def import_from_file(self, file_path: Path) -> ImportResult:
        result = ImportResult(success=False)
        
        if not file_path.exists():
            result.errors.append(ValidationError(
                field="file",
                message=f"文件不存在: {file_path}",
                severity="error"
            ))
            return result
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
        except UnicodeDecodeError:
            with open(file_path, 'r', encoding='gbk') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
        except Exception as e:
            result.errors.append(ValidationError(
                field="file",
                message=f"读取文件失败: {e}",
                severity="error"
            ))
            return result
        
        result.total_rows = len(rows)
        
        existing_order_numbers = self.order_repo.get_all_order_numbers()
        
        for row_idx, row in enumerate(rows, start=2):
            mapped_row = self._map_fields(row)
            
            validation_errors = self.validator.validate_import_row(
                mapped_row, row_idx, existing_order_numbers
            )
            
            for err in validation_errors:
                if err.severity == "error":
                    result.errors.append(err)
                else:
                    result.warnings.append(err)
            
            has_critical_errors = any(
                e.severity == "error" and e.row_number == row_idx 
                for e in result.errors
            )
            
            if has_critical_errors:
                result.failed_rows += 1
                continue
            
            patient, order = self._create_patient_and_order(mapped_row)
            
            if patient and order:
                result.imported_patients.append(patient)
                result.imported_orders.append(order)
                result.imported_rows += 1
                if order.order_number not in existing_order_numbers:
                    existing_order_numbers.append(order.order_number)
                
                self._create_measurement_from_row(order.id, mapped_row)
            else:
                result.failed_rows += 1
        
        result.success = len(result.errors) == 0 or all(
            e.severity == "warning" for e in result.errors
        )
        
        return result
    
    def _map_fields(self, row: Dict[str, Any]) -> Dict[str, Any]:
        mapped = {}
        for csv_field, internal_field in self.FIELD_MAPPING.items():
            if csv_field in row:
                value = row[csv_field]
                if isinstance(value, str):
                    value = value.strip()
                mapped[internal_field] = value
        
        for key, value in row.items():
            if key.startswith("尺寸") or key.startswith("dim"):
                mapped[key] = value
        
        return mapped
    
    def _create_patient_and_order(self, mapped_row: Dict[str, Any]) -> Tuple[Optional[Patient], Optional[Order]]:
        patient_name = mapped_row.get("patient_name", "")
        phone = mapped_row.get("phone")
        
        patient = None
        if phone:
            patient = self.patient_repo.get_by_phone(phone)
        
        if patient is None and patient_name:
            patient = Patient(
                name=patient_name,
                phone=phone
            )
            patient = self.patient_repo.create(patient)
        
        if patient is None:
            return None, None
        
        order_number = mapped_row.get("order_number", "")
        if not order_number:
            order_number = self._generate_order_number()
        
        body_part = mapped_row.get("body_part", "")
        side = mapped_row.get("side", "双侧")
        
        impression_date, _ = self.validator.validate_date(
            mapped_row.get("impression_date"), "impression_date"
        )
        follow_up_date, _ = self.validator.validate_date(
            mapped_row.get("follow_up_date"), "follow_up_date"
        )
        
        order = Order(
            patient_id=patient.id,
            order_number=order_number,
            body_part=body_part,
            side=side if side in ["左侧", "右侧", "双侧"] else "双侧",
            impression_date=impression_date,
            follow_up_date=follow_up_date,
            technician=mapped_row.get("technician"),
            notes=mapped_row.get("notes")
        )
        
        order = self.order_repo.create(order)
        
        return patient, order
    
    def _create_measurement_from_row(self, order_id: int, mapped_row: Dict[str, Any]) -> Optional[Measurement]:
        dimensions = {}
        for key, value in mapped_row.items():
            if (key.startswith("尺寸") or key.startswith("dim") or 
                any(k in key for k in ["长", "宽", "高", "周", "直径", "围度"])):
                if value:
                    dimensions[key] = value
        
        if not dimensions:
            return None
        
        measurement = Measurement(
            order_id=order_id,
            version=1
        )
        measurement.set_dimensions_dict(dimensions)
        measurement.technician = mapped_row.get("technician")
        measurement.notes = "从CSV导入的尺寸初稿"
        
        return self.measurement_repo.create(measurement)
    
    def _generate_order_number(self) -> str:
        today = date.today()
        date_str = today.strftime("%Y%m%d")
        
        existing = self.order_repo.get_all_order_numbers()
        today_orders = [o for o in existing if o.startswith(date_str)]
        
        seq = len(today_orders) + 1
        return f"{date_str}{seq:04d}"
