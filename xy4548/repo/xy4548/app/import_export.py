from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
import csv
import io
from . import models, schemas
from .models import FlyAshBatch, TonBag, InspectionRecord, LandfillReservation, ReviewNote, AuditLog
from .services import AuditService, InspectionService

class CSVImportService:
    @staticmethod
    def parse_date(date_str: Optional[str]) -> Optional[datetime]:
        if not date_str:
            return None
        formats = [
            "%Y-%m-%d",
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d",
            "%Y/%m/%d %H:%M:%S",
            "%d-%m-%Y",
            "%m/%d/%Y"
        ]
        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt)
            except (ValueError, AttributeError):
                continue
        return None

    @staticmethod
    def parse_float(value: Optional[str], default: float = 0.0) -> float:
        if not value:
            return default
        try:
            return float(str(value).strip())
        except (ValueError, TypeError):
            return default

    @staticmethod
    def parse_int(value: Optional[str], default: int = 0) -> int:
        if not value:
            return default
        try:
            return int(str(value).strip())
        except (ValueError, TypeError):
            return default

    @staticmethod
    def import_batches(db: Session, csv_content: str, operator: str) -> schemas.ImportResult:
        total_count = 0
        success_count = 0
        failed_count = 0
        failed_items = []
        warnings = []
        
        try:
            reader = csv.DictReader(io.StringIO(csv_content))
            for row in reader:
                total_count += 1
                batch_number = row.get('batch_number', '').strip()
                
                if not batch_number:
                    failed_count += 1
                    failed_items.append({"row": row, "error": "批次编号不能为空"})
                    continue
                
                existing = db.query(FlyAshBatch).filter(
                    FlyAshBatch.batch_number == batch_number
                ).first()
                
                if existing:
                    warnings.append(f"批次 {batch_number} 已存在，跳过")
                    continue
                
                try:
                    batch_date = CSVImportService.parse_date(row.get('batch_date'))
                    if not batch_date:
                        batch_date = datetime.now()
                    
                    batch = FlyAshBatch(
                        batch_number=batch_number,
                        batch_date=batch_date,
                        ash_source=row.get('ash_source', '').strip() or None,
                        total_weight=CSVImportService.parse_float(row.get('total_weight')),
                        bag_count=CSVImportService.parse_int(row.get('bag_count')),
                        chelating_agent_type=row.get('chelating_agent_type', '').strip() or None,
                        chelating_agent_dosage=CSVImportService.parse_float(row.get('chelating_agent_dosage')),
                        mixing_duration=CSVImportService.parse_float(row.get('mixing_duration')),
                        operator=row.get('operator', '').strip() or None
                    )
                    
                    db.add(batch)
                    db.commit()
                    db.refresh(batch)
                    success_count += 1
                    
                    AuditService.log_operation(
                        db=db,
                        operation_type="IMPORT",
                        module="batch_management",
                        resource_type="fly_ash_batch",
                        resource_id=str(batch.id),
                        operator=operator,
                        operation_detail=f"导入批次 {batch_number}"
                    )
                    
                except Exception as e:
                    db.rollback()
                    failed_count += 1
                    failed_items.append({"row": row, "error": str(e)})
        
        except Exception as e:
            return schemas.ImportResult(
                total_count=0,
                success_count=0,
                failed_count=0,
                failed_items=[{"error": f"CSV解析失败: {str(e)}"}],
                warnings=[]
            )
        
        return schemas.ImportResult(
            total_count=total_count,
            success_count=success_count,
            failed_count=failed_count,
            failed_items=failed_items,
            warnings=warnings
        )

    @staticmethod
    def import_ton_bags(db: Session, csv_content: str, operator: str) -> schemas.ImportResult:
        total_count = 0
        success_count = 0
        failed_count = 0
        failed_items = []
        warnings = []
        
        try:
            reader = csv.DictReader(io.StringIO(csv_content))
            for row in reader:
                total_count += 1
                bag_number = row.get('bag_number', '').strip()
                
                if not bag_number:
                    failed_count += 1
                    failed_items.append({"row": row, "error": "吨袋编号不能为空"})
                    continue
                
                existing = db.query(TonBag).filter(
                    TonBag.bag_number == bag_number
                ).first()
                
                if existing:
                    warnings.append(f"吨袋 {bag_number} 已存在，跳过")
                    continue
                
                batch_number = row.get('batch_number', '').strip()
                batch_id = None
                
                if batch_number:
                    batch = db.query(FlyAshBatch).filter(
                        FlyAshBatch.batch_number == batch_number
                    ).first()
                    if batch:
                        batch_id = batch.id
                    else:
                        warnings.append(f"批次 {batch_number} 不存在，吨袋 {bag_number} 将关联空批次")
                
                try:
                    weight = CSVImportService.parse_float(row.get('weight'))
                    if weight <= 0:
                        failed_count += 1
                        failed_items.append({"row": row, "error": f"吨袋 {bag_number} 重量必须大于0"})
                        continue
                    
                    bag = TonBag(
                        bag_number=bag_number,
                        batch_id=batch_id,
                        weight=weight,
                        rfid_tag=row.get('rfid_tag', '').strip() or None,
                        storage_location=row.get('storage_location', '').strip() or None,
                        production_time=CSVImportService.parse_date(row.get('production_time')),
                        inspection_status=row.get('inspection_status', 'pending').strip().lower() or 'pending',
                        risk_level=row.get('risk_level', 'unknown').strip().lower() or 'unknown',
                        is_qualified=row.get('is_qualified', '').lower() == 'true' if row.get('is_qualified') else False,
                        is_outbound=False
                    )
                    
                    db.add(bag)
                    db.commit()
                    db.refresh(bag)
                    success_count += 1
                    
                    AuditService.log_operation(
                        db=db,
                        operation_type="IMPORT",
                        module="ton_bag_management",
                        resource_type="ton_bag",
                        resource_id=str(bag.id),
                        operator=operator,
                        operation_detail=f"导入吨袋 {bag_number}"
                    )
                    
                except Exception as e:
                    db.rollback()
                    failed_count += 1
                    failed_items.append({"row": row, "error": str(e)})
        
        except Exception as e:
            return schemas.ImportResult(
                total_count=0,
                success_count=0,
                failed_count=0,
                failed_items=[{"error": f"CSV解析失败: {str(e)}"}],
                warnings=[]
            )
        
        return schemas.ImportResult(
            total_count=total_count,
            success_count=success_count,
            failed_count=failed_count,
            failed_items=failed_items,
            warnings=warnings
        )

    @staticmethod
    def import_inspections(db: Session, csv_content: str, operator: str) -> schemas.ImportResult:
        total_count = 0
        success_count = 0
        failed_count = 0
        failed_items = []
        warnings = []
        
        try:
            reader = csv.DictReader(io.StringIO(csv_content))
            for row in reader:
                total_count += 1
                inspection_number = row.get('inspection_number', '').strip()
                
                if not inspection_number:
                    failed_count += 1
                    failed_items.append({"row": row, "error": "检测编号不能为空"})
                    continue
                
                existing = db.query(InspectionRecord).filter(
                    InspectionRecord.inspection_number == inspection_number
                ).first()
                
                if existing:
                    warnings.append(f"检测记录 {inspection_number} 已存在，跳过")
                    continue
                
                batch_id = None
                bag_id = None
                
                batch_number = row.get('batch_number', '').strip()
                if batch_number:
                    batch = db.query(FlyAshBatch).filter(
                        FlyAshBatch.batch_number == batch_number
                    ).first()
                    if batch:
                        batch_id = batch.id
                
                bag_number = row.get('bag_number', '').strip()
                if bag_number:
                    bag = db.query(TonBag).filter(
                        TonBag.bag_number == bag_number
                    ).first()
                    if bag:
                        bag_id = bag.id
                
                try:
                    inspection_date = CSVImportService.parse_date(row.get('inspection_date'))
                    if not inspection_date:
                        inspection_date = datetime.now()
                    
                    inspection = InspectionRecord(
                        inspection_number=inspection_number,
                        batch_id=batch_id,
                        bag_id=bag_id,
                        inspection_type=row.get('inspection_type', '').strip() or None,
                        inspection_date=inspection_date,
                        inspector=row.get('inspector', '').strip() or None,
                        leaching_pb=CSVImportService.parse_float(row.get('leaching_pb'), None),
                        leaching_cd=CSVImportService.parse_float(row.get('leaching_cd'), None),
                        leaching_cr=CSVImportService.parse_float(row.get('leaching_cr'), None),
                        leaching_hg=CSVImportService.parse_float(row.get('leaching_hg'), None),
                        leaching_as=CSVImportService.parse_float(row.get('leaching_as'), None),
                        leaching_zn=CSVImportService.parse_float(row.get('leaching_zn'), None),
                        leaching_cu=CSVImportService.parse_float(row.get('leaching_cu'), None),
                        leaching_ni=CSVImportService.parse_float(row.get('leaching_ni'), None),
                        inspection_report=row.get('inspection_report', '').strip() or None
                    )
                    
                    is_qualified, violations = InspectionService.check_inspection_qualified(inspection)
                    inspection.is_qualified = is_qualified
                    
                    db.add(inspection)
                    db.commit()
                    db.refresh(inspection)
                    
                    InspectionService.update_inspection_status(db, inspection, is_qualified)
                    
                    success_count += 1
                    
                    AuditService.log_operation(
                        db=db,
                        operation_type="IMPORT",
                        module="inspection_management",
                        resource_type="inspection_record",
                        resource_id=str(inspection.id),
                        operator=operator,
                        operation_detail=f"导入检测记录 {inspection_number}"
                    )
                    
                except Exception as e:
                    db.rollback()
                    failed_count += 1
                    failed_items.append({"row": row, "error": str(e)})
        
        except Exception as e:
            return schemas.ImportResult(
                total_count=0,
                success_count=0,
                failed_count=0,
                failed_items=[{"error": f"CSV解析失败: {str(e)}"}],
                warnings=[]
            )
        
        return schemas.ImportResult(
            total_count=total_count,
            success_count=success_count,
            failed_count=failed_count,
            failed_items=failed_items,
            warnings=warnings
        )

    @staticmethod
    def import_reservations(db: Session, csv_content: str, operator: str) -> schemas.ImportResult:
        total_count = 0
        success_count = 0
        failed_count = 0
        failed_items = []
        warnings = []
        
        try:
            reader = csv.DictReader(io.StringIO(csv_content))
            for row in reader:
                total_count += 1
                reservation_number = row.get('reservation_number', '').strip()
                
                if not reservation_number:
                    failed_count += 1
                    failed_items.append({"row": row, "error": "预约编号不能为空"})
                    continue
                
                existing = db.query(LandfillReservation).filter(
                    LandfillReservation.reservation_number == reservation_number
                ).first()
                
                if existing:
                    warnings.append(f"预约 {reservation_number} 已存在，跳过")
                    continue
                
                batch_id = None
                batch_number = row.get('batch_number', '').strip()
                if batch_number:
                    batch = db.query(FlyAshBatch).filter(
                        FlyAshBatch.batch_number == batch_number
                    ).first()
                    if batch:
                        batch_id = batch.id
                
                try:
                    reservation_date = CSVImportService.parse_date(row.get('reservation_date'))
                    if not reservation_date:
                        reservation_date = datetime.now()
                    
                    reserved_weight = CSVImportService.parse_float(row.get('reserved_weight'))
                    if reserved_weight <= 0:
                        failed_count += 1
                        failed_items.append({"row": row, "error": f"预约 {reservation_number} 预约重量必须大于0"})
                        continue
                    
                    reservation = LandfillReservation(
                        reservation_number=reservation_number,
                        batch_id=batch_id,
                        reservation_date=reservation_date,
                        planned_outbound_date=CSVImportService.parse_date(row.get('planned_outbound_date')),
                        landfill_site=row.get('landfill_site', '').strip() or None,
                        transport_company=row.get('transport_company', '').strip() or None,
                        vehicle_number=row.get('vehicle_number', '').strip() or None,
                        driver_name=row.get('driver_name', '').strip() or None,
                        driver_phone=row.get('driver_phone', '').strip() or None,
                        reserved_weight=reserved_weight,
                        actual_weight=CSVImportService.parse_float(row.get('actual_weight'), None),
                        status=row.get('status', 'pending').strip().lower() or 'pending',
                        is_completed=row.get('is_completed', '').lower() == 'true' if row.get('is_completed') else False
                    )
                    
                    db.add(reservation)
                    db.commit()
                    db.refresh(reservation)
                    success_count += 1
                    
                    AuditService.log_operation(
                        db=db,
                        operation_type="IMPORT",
                        module="reservation_management",
                        resource_type="landfill_reservation",
                        resource_id=str(reservation.id),
                        operator=operator,
                        operation_detail=f"导入预约 {reservation_number}"
                    )
                    
                except Exception as e:
                    db.rollback()
                    failed_count += 1
                    failed_items.append({"row": row, "error": str(e)})
        
        except Exception as e:
            return schemas.ImportResult(
                total_count=0,
                success_count=0,
                failed_count=0,
                failed_items=[{"error": f"CSV解析失败: {str(e)}"}],
                warnings=[]
            )
        
        return schemas.ImportResult(
            total_count=total_count,
            success_count=success_count,
            failed_count=failed_count,
            failed_items=failed_items,
            warnings=warnings
        )

class JSONImportService:
    @staticmethod
    def import_json_data(db: Session, json_content: str, operator: str) -> Dict[str, schemas.ImportResult]:
        results = {}
        
        try:
            data = json.loads(json_content)
            
            if 'batches' in data:
                batches_csv = JSONImportService._convert_to_csv(data['batches'], [
                    'batch_number', 'batch_date', 'ash_source', 'total_weight',
                    'bag_count', 'chelating_agent_type', 'chelating_agent_dosage',
                    'mixing_duration', 'operator'
                ])
                results['batches'] = CSVImportService.import_batches(db, batches_csv, operator)
            
            if 'ton_bags' in data:
                bags_csv = JSONImportService._convert_to_csv(data['ton_bags'], [
                    'bag_number', 'batch_number', 'weight', 'rfid_tag',
                    'storage_location', 'production_time', 'inspection_status',
                    'risk_level', 'is_qualified'
                ])
                results['ton_bags'] = CSVImportService.import_ton_bags(db, bags_csv, operator)
            
            if 'inspections' in data:
                inspections_csv = JSONImportService._convert_to_csv(data['inspections'], [
                    'inspection_number', 'batch_number', 'bag_number', 'inspection_type',
                    'inspection_date', 'inspector', 'leaching_pb', 'leaching_cd',
                    'leaching_cr', 'leaching_hg', 'leaching_as', 'leaching_zn',
                    'leaching_cu', 'leaching_ni', 'inspection_report'
                ])
                results['inspections'] = CSVImportService.import_inspections(db, inspections_csv, operator)
            
            if 'reservations' in data:
                reservations_csv = JSONImportService._convert_to_csv(data['reservations'], [
                    'reservation_number', 'batch_number', 'reservation_date',
                    'planned_outbound_date', 'landfill_site', 'transport_company',
                    'vehicle_number', 'driver_name', 'driver_phone', 'reserved_weight',
                    'actual_weight', 'status', 'is_completed'
                ])
                results['reservations'] = CSVImportService.import_reservations(db, reservations_csv, operator)
        
        except Exception as e:
            results['error'] = schemas.ImportResult(
                total_count=0,
                success_count=0,
                failed_count=1,
                failed_items=[{"error": f"JSON解析失败: {str(e)}"}],
                warnings=[]
            )
        
        return results

    @staticmethod
    def _convert_to_csv(data_list: List[Dict], fieldnames: List[str]) -> str:
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        for item in data_list:
            row = {}
            for key in fieldnames:
                value = item.get(key)
                if isinstance(value, datetime):
                    row[key] = value.isoformat()
                elif value is not None:
                    row[key] = str(value)
                else:
                    row[key] = ''
            writer.writerow(row)
        return output.getvalue()
