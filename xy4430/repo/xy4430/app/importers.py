import csv
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.database import (
    Cylinder, FillRecord, CompressorMaintenance, 
    Appointment, Batch, Risk
)


class BaseImporter:
    def __init__(self, db: Session):
        self.db = db
    
    def parse_date(self, date_str: str) -> Optional[datetime]:
        if not date_str:
            return None
        formats = [
            "%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y",
            "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S",
            "%Y-%m-%d %H:%M", "%Y/%m/%d %H:%M"
        ]
        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt)
            except ValueError:
                continue
        return None
    
    def parse_int(self, value: Any, default: int = 0) -> int:
        if value is None or value == "":
            return default
        try:
            return int(float(str(value).strip()))
        except (ValueError, TypeError):
            return default
    
    def parse_float(self, value: Any, default: float = 0.0) -> float:
        if value is None or value == "":
            return default
        try:
            return float(str(value).strip())
        except (ValueError, TypeError):
            return default


class CylinderImporter(BaseImporter):
    def import_csv(self, file_path: str) -> Dict[str, Any]:
        results = {
            "success": 0,
            "failed": 0,
            "errors": [],
            "imported": []
        }
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    serial_number = row.get('serial_number', '').strip()
                    if not serial_number:
                        results["errors"].append(f"第{row_num}行: 缺少气瓶序列号")
                        results["failed"] += 1
                        continue
                    
                    existing = self.db.query(Cylinder).filter(
                        Cylinder.serial_number == serial_number
                    ).first()
                    
                    test_expiry_date = self.parse_date(row.get('test_expiry_date', ''))
                    if not test_expiry_date:
                        results["errors"].append(f"第{row_num}行: 无效的检验有效期格式")
                        results["failed"] += 1
                        continue
                    
                    if existing:
                        existing.cylinder_type = row.get('cylinder_type', existing.cylinder_type)
                        existing.capacity_liters = self.parse_float(row.get('capacity_liters'), existing.capacity_liters)
                        existing.working_pressure_bar = self.parse_int(row.get('working_pressure_bar'), existing.working_pressure_bar)
                        existing.test_expiry_date = test_expiry_date
                        existing.last_test_date = self.parse_date(row.get('last_test_date')) or existing.last_test_date
                        existing.owner_name = row.get('owner_name', existing.owner_name)
                        existing.owner_contact = row.get('owner_contact', existing.owner_contact)
                        results["imported"].append({"serial_number": serial_number, "action": "updated"})
                    else:
                        cylinder = Cylinder(
                            serial_number=serial_number,
                            cylinder_type=row.get('cylinder_type'),
                            capacity_liters=self.parse_float(row.get('capacity_liters')),
                            working_pressure_bar=self.parse_int(row.get('working_pressure_bar')),
                            test_expiry_date=test_expiry_date,
                            last_test_date=self.parse_date(row.get('last_test_date')),
                            owner_name=row.get('owner_name'),
                            owner_contact=row.get('owner_contact')
                        )
                        self.db.add(cylinder)
                        results["imported"].append({"serial_number": serial_number, "action": "created"})
                    
                    results["success"] += 1
                except Exception as e:
                    results["errors"].append(f"第{row_num}行: {str(e)}")
                    results["failed"] += 1
        
        self.db.commit()
        return results


class FillRecordImporter(BaseImporter):
    def import_csv(self, file_path: str) -> Dict[str, Any]:
        results = {
            "success": 0,
            "failed": 0,
            "errors": [],
            "imported": []
        }
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    serial_number = row.get('serial_number', '').strip()
                    if not serial_number:
                        results["errors"].append(f"第{row_num}行: 缺少气瓶序列号")
                        results["failed"] += 1
                        continue
                    
                    cylinder = self.db.query(Cylinder).filter(
                        Cylinder.serial_number == serial_number
                    ).first()
                    
                    if not cylinder:
                        results["errors"].append(f"第{row_num}行: 气瓶序列号 {serial_number} 不存在")
                        results["failed"] += 1
                        continue
                    
                    fill_date = self.parse_date(row.get('fill_date', ''))
                    if not fill_date:
                        results["errors"].append(f"第{row_num}行: 无效的充填日期格式")
                        results["failed"] += 1
                        continue
                    
                    fill_pressure = self.parse_int(row.get('fill_pressure_bar'))
                    if fill_pressure <= 0:
                        results["errors"].append(f"第{row_num}行: 充填压力无效")
                        results["failed"] += 1
                        continue
                    
                    fill_record = FillRecord(
                        cylinder_id=cylinder.id,
                        fill_date=fill_date,
                        fill_pressure_bar=fill_pressure,
                        target_pressure_bar=self.parse_int(row.get('target_pressure_bar')),
                        compressor_id=row.get('compressor_id'),
                        operator_name=row.get('operator_name'),
                        cooling_start_time=self.parse_date(row.get('cooling_start_time'))
                    )
                    self.db.add(fill_record)
                    
                    results["imported"].append({
                        "serial_number": serial_number,
                        "fill_date": fill_date.strftime("%Y-%m-%d %H:%M")
                    })
                    results["success"] += 1
                except Exception as e:
                    results["errors"].append(f"第{row_num}行: {str(e)}")
                    results["failed"] += 1
        
        self.db.commit()
        return results


class CompressorMaintenanceImporter(BaseImporter):
    def import_json(self, file_path: str) -> Dict[str, Any]:
        results = {
            "success": 0,
            "failed": 0,
            "errors": [],
            "imported": []
        }
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if isinstance(data, dict):
            data = [data]
        
        for idx, item in enumerate(data):
            try:
                compressor_id = item.get('compressor_id', '').strip()
                if not compressor_id:
                    results["errors"].append(f"第{idx+1}条: 缺少压缩机ID")
                    results["failed"] += 1
                    continue
                
                existing = self.db.query(CompressorMaintenance).filter(
                    CompressorMaintenance.compressor_id == compressor_id
                ).first()
                
                if existing:
                    existing.model = item.get('model', existing.model)
                    existing.last_maintenance_date = self.parse_date(item.get('last_maintenance_date')) or existing.last_maintenance_date
                    existing.filter_change_date = self.parse_date(item.get('filter_change_date')) or existing.filter_change_date
                    existing.filter_expiry_date = self.parse_date(item.get('filter_expiry_date')) or existing.filter_expiry_date
                    existing.next_service_date = self.parse_date(item.get('next_service_date')) or existing.next_service_date
                    existing.operating_hours = self.parse_float(item.get('operating_hours'), existing.operating_hours)
                    existing.notes = item.get('notes', existing.notes)
                    results["imported"].append({"compressor_id": compressor_id, "action": "updated"})
                else:
                    maintenance = CompressorMaintenance(
                        compressor_id=compressor_id,
                        model=item.get('model'),
                        last_maintenance_date=self.parse_date(item.get('last_maintenance_date')),
                        filter_change_date=self.parse_date(item.get('filter_change_date')),
                        filter_expiry_date=self.parse_date(item.get('filter_expiry_date')),
                        next_service_date=self.parse_date(item.get('next_service_date')),
                        operating_hours=self.parse_float(item.get('operating_hours')),
                        notes=item.get('notes')
                    )
                    self.db.add(maintenance)
                    results["imported"].append({"compressor_id": compressor_id, "action": "created"})
                
                results["success"] += 1
            except Exception as e:
                results["errors"].append(f"第{idx+1}条: {str(e)}")
                results["failed"] += 1
        
        self.db.commit()
        return results


class AppointmentImporter(BaseImporter):
    def import_csv(self, file_path: str) -> Dict[str, Any]:
        results = {
            "success": 0,
            "failed": 0,
            "errors": [],
            "imported": [],
            "risks": []
        }
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    appointment_number = row.get('appointment_number', '').strip()
                    if not appointment_number:
                        results["errors"].append(f"第{row_num}行: 缺少预约单号")
                        results["failed"] += 1
                        continue
                    
                    serial_number = row.get('serial_number', '').strip()
                    if not serial_number:
                        results["errors"].append(f"第{row_num}行: 缺少气瓶序列号")
                        results["failed"] += 1
                        continue
                    
                    cylinder = self.db.query(Cylinder).filter(
                        Cylinder.serial_number == serial_number
                    ).first()
                    
                    if not cylinder:
                        results["errors"].append(f"第{row_num}行: 气瓶序列号 {serial_number} 不存在")
                        results["failed"] += 1
                        continue
                    
                    existing_appointment = self.db.query(Appointment).filter(
                        Appointment.appointment_number == appointment_number
                    ).first()
                    
                    if existing_appointment:
                        results["errors"].append(f"第{row_num}行: 预约单号 {appointment_number} 已存在")
                        results["failed"] += 1
                        continue
                    
                    duplicate_appointments = self.db.query(Appointment).filter(
                        Appointment.cylinder_id == cylinder.id,
                        Appointment.status.in_(["pending", "confirmed"])
                    ).all()
                    
                    if duplicate_appointments:
                        results["risks"].append({
                            "type": "duplicate_appointment",
                            "serial_number": serial_number,
                            "message": f"气瓶 {serial_number} 已有待处理预约"
                        })
                    
                    pickup_date = self.parse_date(row.get('pickup_date', ''))
                    if not pickup_date:
                        results["errors"].append(f"第{row_num}行: 无效的取瓶日期格式")
                        results["failed"] += 1
                        continue
                    
                    appointment = Appointment(
                        appointment_number=appointment_number,
                        cylinder_id=cylinder.id,
                        customer_name=row.get('customer_name', ''),
                        customer_contact=row.get('customer_contact'),
                        pickup_date=pickup_date,
                        status=row.get('status', 'pending'),
                        notes=row.get('notes')
                    )
                    self.db.add(appointment)
                    self.db.flush()
                    
                    results["imported"].append({
                        "appointment_number": appointment_number,
                        "serial_number": serial_number,
                        "customer_name": appointment.customer_name
                    })
                    results["success"] += 1
                except Exception as e:
                    results["errors"].append(f"第{row_num}行: {str(e)}")
                    results["failed"] += 1
        
        self.db.commit()
        return results
