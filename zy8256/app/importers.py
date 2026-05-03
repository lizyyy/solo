import csv
import json
import yaml
import io
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import (
    Cabin, WorkTicket, SensorLog, VentilationRule, AuditLog
)
from app.config import settings


class ImportResult:
    def __init__(self):
        self.success_count = 0
        self.error_count = 0
        self.errors: List[Dict[str, Any]] = []
        self.warnings: List[Dict[str, Any]] = []
    
    def add_error(self, row: int, message: str, data: Dict = None):
        self.error_count += 1
        self.errors.append({
            "row": row,
            "message": message,
            "data": data or {}
        })
    
    def add_warning(self, row: int, message: str, data: Dict = None):
        self.warnings.append({
            "row": row,
            "message": message,
            "data": data or {}
        })
    
    def increment_success(self):
        self.success_count += 1
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "success_count": self.success_count,
            "error_count": self.error_count,
            "errors": self.errors,
            "warnings": self.warnings
        }


def parse_datetime(value: str, formats: List[str] = None) -> Optional[datetime]:
    if not value or value.strip() == "":
        return None
    
    if formats is None:
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%d",
        ]
    
    value = value.strip()
    for fmt in formats:
        try:
            return datetime.strptime(value, fmt)
        except (ValueError, TypeError):
            continue
    return None


def parse_float(value: str, default: float = None) -> Optional[float]:
    if not value or value.strip() == "":
        return default
    try:
        return float(value.strip().replace(',', ''))
    except (ValueError, TypeError):
        return default


def parse_int(value: str, default: int = None) -> Optional[int]:
    if not value or value.strip() == "":
        return default
    try:
        return int(value.strip().replace(',', ''))
    except (ValueError, TypeError):
        return default


class CabinImporter:
    @staticmethod
    def import_from_csv(db: Session, content: str) -> ImportResult:
        result = ImportResult()
        
        try:
            reader = csv.DictReader(io.StringIO(content))
        except Exception as e:
            result.add_error(0, f"CSV 解析失败: {str(e)}")
            return result
        
        for row_idx, row in enumerate(reader, start=2):
            cabin_code = row.get("舱室代码", row.get("cabin_code", "")).strip()
            
            if not cabin_code:
                result.add_error(row_idx, "舱室代码不能为空", row)
                continue
            
            try:
                existing = db.query(Cabin).filter(Cabin.cabin_code == cabin_code).first()
                
                if existing:
                    existing.cabin_name = row.get("舱室名称", row.get("cabin_name", existing.cabin_name))
                    existing.area = parse_float(row.get("面积", row.get("area", "")), existing.area)
                    existing.volume = parse_float(row.get("容积", row.get("volume", "")), existing.volume)
                    existing.location = row.get("位置", row.get("location", existing.location))
                    existing.vessel_name = row.get("船名", row.get("vessel_name", existing.vessel_name))
                    existing.description = row.get("描述", row.get("description", existing.description))
                    existing.updated_at = datetime.now()
                    result.add_warning(row_idx, f"舱室 {cabin_code} 已存在，已更新", row)
                else:
                    cabin = Cabin(
                        cabin_code=cabin_code,
                        cabin_name=row.get("舱室名称", row.get("cabin_name", cabin_code)),
                        area=parse_float(row.get("面积", row.get("area", ""))),
                        volume=parse_float(row.get("容积", row.get("volume", ""))),
                        location=row.get("位置", row.get("location", "")),
                        vessel_name=row.get("船名", row.get("vessel_name", "")),
                        description=row.get("描述", row.get("description", "")),
                        created_at=datetime.now(),
                        updated_at=datetime.now()
                    )
                    db.add(cabin)
                
                db.commit()
                result.increment_success()
                
            except IntegrityError:
                db.rollback()
                result.add_error(row_idx, f"舱室 {cabin_code} 数据库冲突", row)
            except Exception as e:
                db.rollback()
                result.add_error(row_idx, f"导入失败: {str(e)}", row)
        
        CabinImporter._create_audit_log(db, "import_cabins", result)
        return result
    
    @staticmethod
    def _create_audit_log(db: Session, operation: str, result: ImportResult):
        audit = AuditLog(
            operation=operation,
            resource_type="Cabin",
            details=json.dumps({
                "success_count": result.success_count,
                "error_count": result.error_count
            }, ensure_ascii=False),
            performed_at=datetime.now()
        )
        db.add(audit)
        db.commit()


class WorkTicketImporter:
    @staticmethod
    def import_from_jsonl(db: Session, content: str) -> ImportResult:
        result = ImportResult()
        
        lines = content.strip().split('\n')
        
        for line_idx, line in enumerate(lines, start=1):
            line = line.strip()
            if not line:
                continue
            
            try:
                data = json.loads(line)
            except json.JSONDecodeError as e:
                result.add_error(line_idx, f"JSON 解析失败: {str(e)}", {"line": line})
                continue
            
            ticket_no = data.get("ticket_no", data.get("作业票编号", "")).strip()
            
            if not ticket_no:
                result.add_error(line_idx, "作业票编号不能为空", data)
                continue
            
            start_time = parse_datetime(data.get("start_time", data.get("开始时间", "")))
            end_time = parse_datetime(data.get("end_time", data.get("结束时间", "")))
            
            if not start_time or not end_time:
                result.add_error(line_idx, "开始时间或结束时间无效", data)
                continue
            
            try:
                existing = db.query(WorkTicket).filter(WorkTicket.ticket_no == ticket_no).first()
                
                if existing:
                    existing.cabin_code = data.get("cabin_code", data.get("舱室代码", existing.cabin_code))
                    existing.operation_type = data.get("operation_type", data.get("作业类型", existing.operation_type))
                    existing.paint_type = data.get("paint_type", data.get("油漆类型", existing.paint_type))
                    existing.start_time = start_time
                    existing.end_time = end_time
                    existing.workers_count = parse_int(str(data.get("workers_count", data.get("工人数量", ""))))
                    existing.supervisor = data.get("supervisor", data.get("负责人", existing.supervisor))
                    existing.status = data.get("status", existing.status)
                    existing.updated_at = datetime.now()
                    result.add_warning(line_idx, f"作业票 {ticket_no} 已存在，已更新", data)
                else:
                    ticket = WorkTicket(
                        ticket_no=ticket_no,
                        cabin_code=data.get("cabin_code", data.get("舱室代码", "")),
                        operation_type=data.get("operation_type", data.get("作业类型", "")),
                        paint_type=data.get("paint_type", data.get("油漆类型", "")),
                        start_time=start_time,
                        end_time=end_time,
                        workers_count=parse_int(str(data.get("workers_count", data.get("工人数量", "")))),
                        supervisor=data.get("supervisor", data.get("负责人", "")),
                        status=data.get("status", "pending"),
                        created_at=datetime.now(),
                        updated_at=datetime.now()
                    )
                    db.add(ticket)
                
                db.commit()
                result.increment_success()
                
            except IntegrityError:
                db.rollback()
                result.add_error(line_idx, f"作业票 {ticket_no} 数据库冲突", data)
            except Exception as e:
                db.rollback()
                result.add_error(line_idx, f"导入失败: {str(e)}", data)
        
        WorkTicketImporter._create_audit_log(db, "import_work_tickets", result)
        return result
    
    @staticmethod
    def _create_audit_log(db: Session, operation: str, result: ImportResult):
        audit = AuditLog(
            operation=operation,
            resource_type="WorkTicket",
            details=json.dumps({
                "success_count": result.success_count,
                "error_count": result.error_count
            }, ensure_ascii=False),
            performed_at=datetime.now()
        )
        db.add(audit)
        db.commit()


class SensorLogImporter:
    @staticmethod
    def import_from_csv(db: Session, content: str) -> ImportResult:
        result = ImportResult()
        
        try:
            reader = csv.DictReader(io.StringIO(content))
        except Exception as e:
            result.add_error(0, f"CSV 解析失败: {str(e)}")
            return result
        
        for row_idx, row in enumerate(reader, start=2):
            sensor_id = row.get("传感器ID", row.get("sensor_id", "")).strip()
            cabin_code = row.get("舱室代码", row.get("cabin_code", "")).strip()
            timestamp_str = row.get("时间戳", row.get("timestamp", ""))
            
            if not sensor_id or not cabin_code or not timestamp_str:
                result.add_error(row_idx, "传感器ID、舱室代码或时间戳不能为空", row)
                continue
            
            timestamp = parse_datetime(timestamp_str)
            if not timestamp:
                result.add_error(row_idx, f"时间戳格式无效: {timestamp_str}", row)
                continue
            
            voc_value = parse_float(row.get("VOC值", row.get("voc_value", "")), 0.0)
            voc_unit = row.get("单位", row.get("voc_unit", "ppm")).strip().lower()
            voc_unit = voc_unit if voc_unit in ["ppm", "mg/m3", "mg_m3"] else "ppm"
            voc_unit = "mg/m3" if voc_unit == "mg_m3" else voc_unit
            
            try:
                sensor_log = SensorLog(
                    sensor_id=sensor_id,
                    cabin_code=cabin_code,
                    timestamp=timestamp,
                    voc_value=voc_value,
                    voc_unit=voc_unit,
                    temperature=parse_float(row.get("温度", row.get("temperature", ""))),
                    humidity=parse_float(row.get("湿度", row.get("humidity", ""))),
                    ventilation_rate=parse_float(row.get("排风速率", row.get("ventilation_rate", ""))),
                    air_changes_per_hour=parse_float(row.get("换气次数", row.get("air_changes_per_hour", ""))),
                    is_valid=True
                )
                db.add(sensor_log)
                db.commit()
                result.increment_success()
                
            except Exception as e:
                db.rollback()
                result.add_error(row_idx, f"导入失败: {str(e)}", row)
        
        SensorLogImporter._create_audit_log(db, "import_sensor_logs", result)
        return result
    
    @staticmethod
    def _create_audit_log(db: Session, operation: str, result: ImportResult):
        audit = AuditLog(
            operation=operation,
            resource_type="SensorLog",
            details=json.dumps({
                "success_count": result.success_count,
                "error_count": result.error_count
            }, ensure_ascii=False),
            performed_at=datetime.now()
        )
        db.add(audit)
        db.commit()


class VentilationRuleImporter:
    @staticmethod
    def import_from_yaml(db: Session, content: str) -> ImportResult:
        result = ImportResult()
        
        try:
            data = yaml.safe_load(content)
        except yaml.YAMLError as e:
            result.add_error(0, f"YAML 解析失败: {str(e)}")
            return result
        
        if not isinstance(data, list):
            data = [data]
        
        for item_idx, item in enumerate(data, start=1):
            rule_code = item.get("rule_code", item.get("规则代码", "")).strip()
            
            if not rule_code:
                result.add_error(item_idx, "规则代码不能为空", item)
                continue
            
            min_ach = parse_float(str(item.get("min_air_changes_per_hour", item.get("最小换气次数", 0))))
            
            if min_ach is None or min_ach <= 0:
                result.add_error(item_idx, "最小换气次数必须大于0", item)
                continue
            
            try:
                existing = db.query(VentilationRule).filter(
                    VentilationRule.rule_code == rule_code
                ).first()
                
                if existing:
                    existing.rule_name = item.get("rule_name", item.get("规则名称", existing.rule_name))
                    existing.cabin_code = item.get("cabin_code", item.get("舱室代码", existing.cabin_code))
                    existing.operation_type = item.get("operation_type", item.get("作业类型", existing.operation_type))
                    existing.paint_type = item.get("paint_type", item.get("油漆类型", existing.paint_type))
                    existing.min_air_changes_per_hour = min_ach
                    existing.voc_threshold_ppm = parse_float(str(item.get("voc_threshold_ppm", item.get("VOC阈值(ppm)", ""))))
                    existing.voc_threshold_mg_m3 = parse_float(str(item.get("voc_threshold_mg_m3", item.get("VOC阈值(mg/m3)", ""))))
                    existing.is_active = item.get("is_active", item.get("是否启用", existing.is_active))
                    existing.priority = parse_int(str(item.get("priority", item.get("优先级", 0))))
                    existing.description = item.get("description", item.get("描述", existing.description))
                    existing.updated_at = datetime.now()
                    result.add_warning(item_idx, f"规则 {rule_code} 已存在，已更新", item)
                else:
                    rule = VentilationRule(
                        rule_code=rule_code,
                        rule_name=item.get("rule_name", item.get("规则名称", rule_code)),
                        cabin_code=item.get("cabin_code", item.get("舱室代码")),
                        operation_type=item.get("operation_type", item.get("作业类型")),
                        paint_type=item.get("paint_type", item.get("油漆类型")),
                        min_air_changes_per_hour=min_ach,
                        voc_threshold_ppm=parse_float(str(item.get("voc_threshold_ppm", item.get("VOC阈值(ppm)", "")))),
                        voc_threshold_mg_m3=parse_float(str(item.get("voc_threshold_mg_m3", item.get("VOC阈值(mg/m3)", "")))),
                        is_active=item.get("is_active", item.get("是否启用", True)),
                        priority=parse_int(str(item.get("priority", item.get("优先级", 0)))),
                        description=item.get("description", item.get("描述", "")),
                        created_at=datetime.now(),
                        updated_at=datetime.now()
                    )
                    db.add(rule)
                
                db.commit()
                result.increment_success()
                
            except IntegrityError:
                db.rollback()
                result.add_error(item_idx, f"规则 {rule_code} 数据库冲突", item)
            except Exception as e:
                db.rollback()
                result.add_error(item_idx, f"导入失败: {str(e)}", item)
        
        VentilationRuleImporter._create_audit_log(db, "import_ventilation_rules", result)
        return result
    
    @staticmethod
    def _create_audit_log(db: Session, operation: str, result: ImportResult):
        audit = AuditLog(
            operation=operation,
            resource_type="VentilationRule",
            details=json.dumps({
                "success_count": result.success_count,
                "error_count": result.error_count
            }, ensure_ascii=False),
            performed_at=datetime.now()
        )
        db.add(audit)
        db.commit()
