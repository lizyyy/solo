import json
import csv
import yaml
from datetime import datetime
from typing import List, Dict, Any, Tuple
from models import VehicleTemperature, DrugBatch, HandoverScan, TemperatureRule, Route
from sqlalchemy.orm import Session
import re


class DataImportError(Exception):
    def __init__(self, message: str, row_number: int = None, field: str = None):
        self.message = message
        self.row_number = row_number
        self.field = field
        super().__init__(self.format_message())

    def format_message(self) -> str:
        parts = [self.message]
        if self.row_number is not None:
            parts.append(f" (行 {self.row_number})")
        if self.field:
            parts.append(f" [字段: {self.field}]")
        return "".join(parts)


def parse_datetime(value: str, field_name: str = "时间", row_number: int = None) -> datetime:
    if not value or not str(value).strip():
        raise DataImportError(f"{field_name}不能为空", row_number, field_name)
    
    value = str(value).strip()
    
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y/%m/%d %H:%M:%S",
        "%Y-%m-%d",
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    
    raise DataImportError(
        f"{field_name}格式错误: '{value}', 支持格式: YYYY-MM-DD HH:MM:SS, YYYY-MM-DDTHH:MM:SS",
        row_number,
        field_name
    )


def parse_float(value: str, field_name: str = "数值", row_number: int = None, allow_empty: bool = False) -> float:
    if value is None or str(value).strip() == "":
        if allow_empty:
            return None
        raise DataImportError(f"{field_name}不能为空", row_number, field_name)
    
    try:
        return float(str(value).strip())
    except ValueError:
        raise DataImportError(
            f"{field_name}格式错误: '{value}', 必须是有效的数字",
            row_number,
            field_name
        )


def parse_int(value: str, field_name: str = "数值", row_number: int = None, allow_empty: bool = False) -> int:
    if value is None or str(value).strip() == "":
        if allow_empty:
            return None
        raise DataImportError(f"{field_name}不能为空", row_number, field_name)
    
    try:
        return int(str(value).strip())
    except ValueError:
        raise DataImportError(
            f"{field_name}格式错误: '{value}', 必须是有效的整数",
            row_number,
            field_name
        )


def import_vehicle_temperatures_jsonl(db: Session, file_content: str) -> Dict[str, Any]:
    records = []
    errors = []
    
    lines = file_content.strip().split('\n')
    
    for row_num, line in enumerate(lines, 1):
        line = line.strip()
        if not line:
            continue
        
        try:
            data = json.loads(line)
        except json.JSONDecodeError as e:
            errors.append({
                "row": row_num,
                "error": f"JSON格式错误: {str(e)}",
                "content": line[:100]
            })
            continue
        
        try:
            vehicle_id = data.get("vehicle_id") or data.get("vehicleId")
            if not vehicle_id:
                raise DataImportError("vehicle_id 不能为空", row_num, "vehicle_id")
            
            timestamp_str = data.get("timestamp") or data.get("time")
            timestamp = parse_datetime(timestamp_str, "时间戳", row_num)
            
            temperature = parse_float(
                data.get("temperature") or data.get("temp"),
                "温度",
                row_num
            )
            
            route_id = data.get("route_id") or data.get("routeId")
            
            record = VehicleTemperature(
                vehicle_id=str(vehicle_id).strip(),
                route_id=str(route_id).strip() if route_id else None,
                timestamp=timestamp,
                temperature=temperature
            )
            records.append(record)
            
        except DataImportError as e:
            errors.append({
                "row": row_num,
                "error": str(e),
                "field": e.field
            })
        except Exception as e:
            errors.append({
                "row": row_num,
                "error": f"解析错误: {str(e)}"
            })
    
    if records:
        db.bulk_save_objects(records)
        db.commit()
    
    return {
        "success": len(records),
        "failed": len(errors),
        "errors": errors[:10]
    }


def import_drug_batches_csv(db: Session, file_content: str) -> Dict[str, Any]:
    records = []
    errors = []
    
    lines = file_content.strip().split('\n')
    if not lines:
        return {"success": 0, "failed": 0, "errors": [{"error": "文件为空"}]}
    
    reader = csv.DictReader(lines)
    
    for row_num, row in enumerate(reader, 2):
        try:
            batch_number = row.get("batch_number") or row.get("batchNumber") or row.get("批号")
            if not batch_number or not str(batch_number).strip():
                raise DataImportError("批号不能为空", row_num, "batch_number")
            
            drug_name = row.get("drug_name") or row.get("drugName") or row.get("药品名称")
            if not drug_name or not str(drug_name).strip():
                raise DataImportError("药品名称不能为空", row_num, "drug_name")
            
            production_date_str = row.get("production_date") or row.get("productionDate") or row.get("生产日期")
            production_date = None
            if production_date_str and str(production_date_str).strip():
                production_date = parse_datetime(production_date_str, "生产日期", row_num)
            
            expiry_date_str = row.get("expiry_date") or row.get("expiryDate") or row.get("有效期")
            expiry_date = None
            if expiry_date_str and str(expiry_date_str).strip():
                expiry_date = parse_datetime(expiry_date_str, "有效期", row_num)
            
            min_temp = parse_float(
                row.get("min_temp") or row.get("minTemp") or row.get("最低温度"),
                "最低温度",
                row_num,
                allow_empty=True
            )
            
            max_temp = parse_float(
                row.get("max_temp") or row.get("maxTemp") or row.get("最高温度"),
                "最高温度",
                row_num,
                allow_empty=True
            )
            
            existing = db.query(DrugBatch).filter(
                DrugBatch.batch_number == str(batch_number).strip()
            ).first()
            
            if existing:
                existing.drug_name = str(drug_name).strip()
                existing.production_date = production_date
                existing.expiry_date = expiry_date
                existing.min_temp = min_temp
                existing.max_temp = max_temp
            else:
                record = DrugBatch(
                    batch_number=str(batch_number).strip(),
                    drug_name=str(drug_name).strip(),
                    production_date=production_date,
                    expiry_date=expiry_date,
                    min_temp=min_temp,
                    max_temp=max_temp
                )
                records.append(record)
            
        except DataImportError as e:
            errors.append({
                "row": row_num,
                "error": str(e),
                "field": e.field
            })
        except Exception as e:
            errors.append({
                "row": row_num,
                "error": f"解析错误: {str(e)}"
            })
    
    if records:
        db.bulk_save_objects(records)
        db.commit()
    
    return {
        "success": len(records),
        "failed": len(errors),
        "errors": errors[:10]
    }


def import_handover_scans_csv(db: Session, file_content: str) -> Dict[str, Any]:
    records = []
    errors = []
    
    lines = file_content.strip().split('\n')
    if not lines:
        return {"success": 0, "failed": 0, "errors": [{"error": "文件为空"}]}
    
    reader = csv.DictReader(lines)
    
    for row_num, row in enumerate(reader, 2):
        try:
            scan_time_str = row.get("scan_time") or row.get("scanTime") or row.get("扫描时间")
            scan_time = parse_datetime(scan_time_str, "扫描时间", row_num)
            
            batch_number = row.get("batch_number") or row.get("batchNumber") or row.get("批号")
            if not batch_number or not str(batch_number).strip():
                raise DataImportError("批号不能为空", row_num, "batch_number")
            
            vehicle_id = row.get("vehicle_id") or row.get("vehicleId") or row.get("车辆ID")
            if not vehicle_id or not str(vehicle_id).strip():
                raise DataImportError("车辆ID不能为空", row_num, "vehicle_id")
            
            scan_type = row.get("scan_type") or row.get("scanType") or row.get("扫描类型")
            if not scan_type or not str(scan_type).strip():
                raise DataImportError("扫描类型不能为空", row_num, "scan_type")
            
            scan_type = str(scan_type).strip().lower()
            valid_types = ["装车", "卸车", "load", "unload", "in", "out"]
            if scan_type not in valid_types:
                raise DataImportError(
                    f"扫描类型无效: '{scan_type}', 有效值: {', '.join(valid_types)}",
                    row_num,
                    "scan_type"
                )
            
            operator = row.get("operator") or row.get("操作人员")
            location = row.get("location") or row.get("地点")
            
            record = HandoverScan(
                scan_time=scan_time,
                batch_number=str(batch_number).strip(),
                vehicle_id=str(vehicle_id).strip(),
                scan_type=scan_type,
                operator=str(operator).strip() if operator else None,
                location=str(location).strip() if location else None
            )
            records.append(record)
            
        except DataImportError as e:
            errors.append({
                "row": row_num,
                "error": str(e),
                "field": e.field
            })
        except Exception as e:
            errors.append({
                "row": row_num,
                "error": f"解析错误: {str(e)}"
            })
    
    if records:
        db.bulk_save_objects(records)
        db.commit()
    
    return {
        "success": len(records),
        "failed": len(errors),
        "errors": errors[:10]
    }


def import_temperature_rules_yaml(db: Session, file_content: str) -> Dict[str, Any]:
    records = []
    errors = []
    
    try:
        data = yaml.safe_load(file_content)
    except yaml.YAMLError as e:
        return {
            "success": 0,
            "failed": 1,
            "errors": [{"error": f"YAML格式错误: {str(e)}"}]
        }
    
    if not data:
        return {"success": 0, "failed": 0, "errors": []}
    
    rules = data.get("rules", []) if isinstance(data, dict) else data
    if not isinstance(rules, list):
        rules = [rules]
    
    for row_num, rule_data in enumerate(rules, 1):
        try:
            if not isinstance(rule_data, dict):
                raise DataImportError(f"规则格式错误，应为对象", row_num)
            
            rule_name = rule_data.get("rule_name") or rule_data.get("ruleName") or rule_data.get("名称")
            if not rule_name or not str(rule_name).strip():
                raise DataImportError("规则名称不能为空", row_num, "rule_name")
            
            min_temp = parse_float(
                rule_data.get("min_temp") or rule_data.get("minTemp") or rule_data.get("最低温度"),
                "最低温度",
                row_num
            )
            
            max_temp = parse_float(
                rule_data.get("max_temp") or rule_data.get("maxTemp") or rule_data.get("最高温度"),
                "最高温度",
                row_num
            )
            
            if min_temp >= max_temp:
                raise DataImportError(
                    f"最低温度({min_temp}°C)必须小于最高温度({max_temp}°C)",
                    row_num,
                    "temperature_range"
                )
            
            allowed_exceed = parse_int(
                rule_data.get("allowed_exceed_duration_minutes") or 
                rule_data.get("allowedExceedMinutes") or 
                rule_data.get("允许超窗分钟"),
                "允许超窗时间",
                row_num,
                allow_empty=True
            )
            
            drug_category = rule_data.get("drug_category") or rule_data.get("drugCategory") or rule_data.get("药品类别")
            
            existing = db.query(TemperatureRule).filter(
                TemperatureRule.rule_name == str(rule_name).strip()
            ).first()
            
            if existing:
                existing.drug_category = str(drug_category).strip() if drug_category else None
                existing.min_temp = min_temp
                existing.max_temp = max_temp
                existing.allowed_exceed_duration_minutes = allowed_exceed or 0
            else:
                record = TemperatureRule(
                    rule_name=str(rule_name).strip(),
                    drug_category=str(drug_category).strip() if drug_category else None,
                    min_temp=min_temp,
                    max_temp=max_temp,
                    allowed_exceed_duration_minutes=allowed_exceed or 0
                )
                records.append(record)
            
        except DataImportError as e:
            errors.append({
                "row": row_num,
                "error": str(e),
                "field": e.field
            })
        except Exception as e:
            errors.append({
                "row": row_num,
                "error": f"解析错误: {str(e)}"
            })
    
    if records:
        db.bulk_save_objects(records)
        db.commit()
    
    return {
        "success": len(records),
        "failed": len(errors),
        "errors": errors[:10]
    }
