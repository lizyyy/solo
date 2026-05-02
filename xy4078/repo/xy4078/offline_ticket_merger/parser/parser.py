"""文件解析模块"""

import csv
import json
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Type

from ..models import (
    Engineer,
    ImportedTicket,
    PhotoItem,
    SparePart,
    WorkOrder,
    WorkOrderStatus,
)
from ..storage import calculate_content_hash, calculate_file_hash


class ParserRegistry:
    _parsers: Dict[str, Type["FileParser"]] = {}
    
    @classmethod
    def register(cls, extension: str, parser_class: Type["FileParser"]) -> None:
        cls._parsers[extension.lower()] = parser_class
    
    @classmethod
    def get(cls, extension: str) -> Optional[Type["FileParser"]]:
        return cls._parsers.get(extension.lower())
    
    @classmethod
    def get_supported_extensions(cls) -> List[str]:
        return list(cls._parsers.keys())


def register_parser(extension: str):
    def decorator(cls: Type["FileParser"]) -> Type["FileParser"]:
        ParserRegistry.register(extension, cls)
        return cls
    return decorator


def get_parser(extension: str) -> Optional[Type["FileParser"]]:
    return ParserRegistry.get(extension)


class FileParser(ABC):
    @abstractmethod
    def parse(self, content: str, filename: str = "unknown") -> ImportedTicket:
        pass
    
    @abstractmethod
    def can_parse(self, content: str) -> bool:
        pass


@register_parser("json")
class JsonParser(FileParser):
    def can_parse(self, content: str) -> bool:
        try:
            json.loads(content)
            return True
        except json.JSONDecodeError:
            return False
    
    def parse(self, content: str, filename: str = "unknown") -> ImportedTicket:
        data = json.loads(content)
        errors: List[str] = []
        
        work_orders: List[WorkOrder] = []
        source_engineer: Optional[Engineer] = None
        
        if "engineer" in data:
            source_engineer = self._parse_engineer(data["engineer"])
        
        if "work_orders" in data:
            for idx, wo_data in enumerate(data["work_orders"]):
                try:
                    wo = self._parse_work_order(wo_data, source_engineer)
                    work_orders.append(wo)
                except Exception as e:
                    errors.append(f"Work order #{idx}: {str(e)}")
        
        elif "ticket_number" in data or "device_id" in data:
            try:
                wo = self._parse_work_order(data, source_engineer)
                work_orders.append(wo)
            except Exception as e:
                errors.append(f"Work order: {str(e)}")
        
        elif len(data) > 0:
            for key, value in data.items():
                if isinstance(value, dict) and ("ticket_number" in value or "device_id" in value):
                    try:
                        wo = self._parse_work_order(value, source_engineer)
                        work_orders.append(wo)
                    except Exception as e:
                        errors.append(f"Work order '{key}': {str(e)}")
        
        return ImportedTicket(
            original_filename=filename,
            source_engineer=source_engineer,
            work_orders=work_orders,
            raw_content=content,
            file_hash=calculate_content_hash(content),
            validation_errors=errors,
            is_valid=len(errors) == 0,
        )
    
    def _parse_engineer(self, data: Dict[str, Any]) -> Engineer:
        return Engineer(
            id=data.get("id", data.get("engineer_id", "")),
            name=data.get("name", data.get("engineer_name", "Unknown")),
            employee_id=data.get("employee_id"),
            phone=data.get("phone"),
            department=data.get("department"),
        )
    
    def _parse_work_order(self, data: Dict[str, Any], engineer: Optional[Engineer] = None) -> WorkOrder:
        status = self._parse_status(data.get("status", "pending"))
        
        photos: List[PhotoItem] = []
        if "photos" in data:
            for p_data in data["photos"]:
                photos.append(self._parse_photo(p_data))
        
        spare_parts: List[SparePart] = []
        if "spare_parts" in data:
            for sp_data in data["spare_parts"]:
                spare_parts.append(self._parse_spare_part(sp_data))
        
        engineer_id = data.get("engineer_id")
        engineer_name = data.get("engineer_name")
        
        if engineer:
            engineer_id = engineer_id or engineer.id
            engineer_name = engineer_name or engineer.name
        
        return WorkOrder(
            ticket_number=str(data.get("ticket_number", data.get("id", ""))),
            device_id=str(data.get("device_id", "")),
            device_name=data.get("device_name"),
            device_location=data.get("device_location"),
            status=status,
            priority=data.get("priority", "normal"),
            engineer_id=engineer_id,
            engineer_name=engineer_name,
            issue_description=data.get("issue_description", data.get("description")),
            inspection_results=data.get("inspection_results"),
            solution_taken=data.get("solution_taken"),
            temporary_measures=data.get("temporary_measures"),
            photos=photos,
            spare_parts=spare_parts,
            scheduled_time=self._parse_datetime(data.get("scheduled_time")),
            start_time=self._parse_datetime(data.get("start_time")),
            end_time=self._parse_datetime(data.get("end_time")),
            estimated_duration=data.get("estimated_duration"),
            created_at=self._parse_datetime(data.get("created_at")) or datetime.now(),
            updated_at=self._parse_datetime(data.get("updated_at")),
            imported_from=data.get("imported_from"),
            source_engineer_id=data.get("source_engineer_id"),
            custom_fields=data.get("custom_fields", {}),
        )
    
    def _parse_status(self, value: Any) -> WorkOrderStatus:
        if isinstance(value, WorkOrderStatus):
            return value
        
        value_lower = str(value).lower().replace("-", "_").replace(" ", "_")
        
        status_map = {
            "pending": WorkOrderStatus.PENDING,
            "open": WorkOrderStatus.PENDING,
            "new": WorkOrderStatus.PENDING,
            "in_progress": WorkOrderStatus.IN_PROGRESS,
            "inprogress": WorkOrderStatus.IN_PROGRESS,
            "active": WorkOrderStatus.IN_PROGRESS,
            "working": WorkOrderStatus.IN_PROGRESS,
            "completed": WorkOrderStatus.COMPLETED,
            "done": WorkOrderStatus.COMPLETED,
            "closed": WorkOrderStatus.COMPLETED,
            "finished": WorkOrderStatus.COMPLETED,
            "cancelled": WorkOrderStatus.CANCELLED,
            "canceled": WorkOrderStatus.CANCELLED,
            "rejected": WorkOrderStatus.CANCELLED,
        }
        
        return status_map.get(value_lower, WorkOrderStatus.PENDING)
    
    def _parse_datetime(self, value: Any) -> Optional[datetime]:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            formats = [
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%dT%H:%M:%S.%f",
                "%Y-%m-%d %H:%M",
                "%Y-%m-%d",
                "%Y/%m/%d %H:%M:%S",
                "%Y/%m/%d",
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(value, fmt)
                except (ValueError, TypeError):
                    continue
            
            from dateutil.parser import parse
            try:
                return parse(value)
            except (ValueError, TypeError):
                pass
        
        return None
    
    def _parse_photo(self, data: Dict[str, Any]) -> PhotoItem:
        return PhotoItem(
            filename=data.get("filename", data.get("name", "unknown.jpg")),
            file_hash=data.get("file_hash"),
            file_size=data.get("file_size"),
            photo_type=data.get("photo_type", data.get("type", "unknown")),
            description=data.get("description"),
            capture_time=self._parse_datetime(data.get("capture_time", data.get("taken_at"))),
            device_id=data.get("device_id"),
            location=data.get("location"),
        )
    
    def _parse_spare_part(self, data: Dict[str, Any]) -> SparePart:
        return SparePart(
            part_number=str(data.get("part_number", data.get("sku", data.get("id", "")))),
            part_name=data.get("part_name", data.get("name", "Unknown Part")),
            quantity=int(data.get("quantity", 1)),
            unit_price=data.get("unit_price", data.get("price")),
            warehouse_location=data.get("warehouse_location", data.get("location")),
            used_at=self._parse_datetime(data.get("used_at")),
            engineer_id=data.get("engineer_id"),
            work_order_id=data.get("work_order_id"),
            notes=data.get("notes"),
        )


@register_parser("csv")
class CsvParser(FileParser):
    def can_parse(self, content: str) -> bool:
        lines = content.strip().split("\n")
        if not lines:
            return False
        
        import io
        try:
            reader = csv.reader(io.StringIO(content))
            next(reader)
            return True
        except csv.Error:
            return False
    
    def parse(self, content: str, filename: str = "unknown") -> ImportedTicket:
        import io
        
        errors: List[str] = []
        work_orders: List[WorkOrder] = []
        
        reader = csv.DictReader(io.StringIO(content))
        json_parser = JsonParser()
        
        for row_num, row in enumerate(reader, start=2):
            try:
                wo_data = self._row_to_dict(row)
                wo = json_parser._parse_work_order(wo_data, None)
                work_orders.append(wo)
            except Exception as e:
                errors.append(f"Row #{row_num}: {str(e)}")
        
        return ImportedTicket(
            original_filename=filename,
            work_orders=work_orders,
            raw_content=content,
            file_hash=calculate_content_hash(content),
            validation_errors=errors,
            is_valid=len(errors) == 0,
        )
    
    def _row_to_dict(self, row: Dict[str, str]) -> Dict[str, Any]:
        result: Dict[str, Any] = {}
        
        field_mapping = {
            "ticket_number": ["ticket_number", "ticket_no", "工单编号", "ticket", "id"],
            "device_id": ["device_id", "设备编号", "device_no", "device"],
            "device_name": ["device_name", "设备名称", "device"],
            "device_location": ["device_location", "设备位置", "location"],
            "status": ["status", "状态"],
            "priority": ["priority", "优先级"],
            "engineer_id": ["engineer_id", "工程师编号", "engineer"],
            "engineer_name": ["engineer_name", "工程师姓名", "engineer"],
            "issue_description": ["issue_description", "问题描述", "description", "issue"],
            "inspection_results": ["inspection_results", "巡检结果", "inspection"],
            "solution_taken": ["solution_taken", "解决方案", "solution"],
            "temporary_measures": ["temporary_measures", "临时措施", "temporary"],
            "photos": ["photos", "照片", "photo"],
            "spare_parts": ["spare_parts", "备件", "parts", "spare"],
            "scheduled_time": ["scheduled_time", "计划时间", "scheduled"],
            "start_time": ["start_time", "开始时间", "start"],
            "end_time": ["end_time", "结束时间", "end"],
            "created_at": ["created_at", "创建时间", "created"],
            "updated_at": ["updated_at", "更新时间", "updated"],
        }
        
        for target_field, possible_names in field_mapping.items():
            for name in possible_names:
                if name in row and row[name].strip():
                    value = row[name].strip()
                    
                    if target_field in ["photos", "spare_parts"]:
                        try:
                            result[target_field] = json.loads(value)
                        except json.JSONDecodeError:
                            pass
                    else:
                        result[target_field] = value
                    break
        
        for key, value in row.items():
            if key not in result:
                if key not in [item for sublist in field_mapping.values() for item in sublist]:
                    if "custom_fields" not in result:
                        result["custom_fields"] = {}
                    result["custom_fields"][key] = value
        
        return result


def parse_file(file_path: Path) -> ImportedTicket:
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    
    extension = file_path.suffix.lstrip(".")
    parser_class = ParserRegistry.get(extension)
    
    if parser_class is None:
        raise ValueError(f"Unsupported file format: .{extension}. "
                        f"Supported formats: {ParserRegistry.get_supported_extensions()}")
    
    content = file_path.read_text(encoding="utf-8")
    parser = parser_class()
    
    return parser.parse(content, filename=file_path.name)


def parse_json_content(content: str, filename: str = "data.json") -> ImportedTicket:
    parser = JsonParser()
    return parser.parse(content, filename=filename)


def parse_csv_content(content: str, filename: str = "data.csv") -> ImportedTicket:
    parser = CsvParser()
    return parser.parse(content, filename=filename)
