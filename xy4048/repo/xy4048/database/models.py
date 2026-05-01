import sqlite3
from datetime import datetime
from typing import Optional, List, Dict, Any, TypeVar, Type
from dataclasses import dataclass, field
from enum import Enum

from config import TaskStatus


T = TypeVar('T', bound='BaseModel')


class AttachmentType(Enum):
    SIGNATURE = "签收单"
    EXCEPTION = "异常照片"
    OTHER = "其他"


class ExceptionType(Enum):
    OVER_TEMPERATURE = "超温"
    LOW_BATTERY = "低电量"
    MISMATCH = "箱号不匹配"
    MISSING_SIGNATURE = "缺少签收单"
    OTHER = "其他"


@dataclass
class BaseModel:
    id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    @classmethod
    def table_name(cls) -> str:
        raise NotImplementedError
    
    @classmethod
    def columns(cls) -> List[str]:
        raise NotImplementedError
    
    def to_dict(self, include_id: bool = True) -> Dict[str, Any]:
        data = {}
        for col in self.columns():
            if hasattr(self, col):
                value = getattr(self, col)
                if isinstance(value, datetime):
                    value = value.isoformat()
                elif isinstance(value, Enum):
                    value = value.value
                data[col] = value
        if include_id and self.id is not None:
            data['id'] = self.id
        return data
    
    @classmethod
    def from_dict(cls: Type[T], data: Dict[str, Any]) -> T:
        raise NotImplementedError


@dataclass
class CoolerBox(BaseModel):
    box_number: str = ""
    device_id: str = ""
    description: str = ""
    is_active: bool = True
    
    @classmethod
    def table_name(cls) -> str:
        return "cooler_boxes"
    
    @classmethod
    def columns(cls) -> List[str]:
        return ["box_number", "device_id", "description", "is_active", "created_at", "updated_at"]
    
    @classmethod
    def from_dict(cls: Type[T], data: Dict[str, Any]) -> T:
        return cls(
            id=data.get('id'),
            box_number=data.get('box_number', ''),
            device_id=data.get('device_id', ''),
            description=data.get('description', ''),
            is_active=data.get('is_active', True),
            created_at=datetime.fromisoformat(data['created_at']) if data.get('created_at') else None,
            updated_at=datetime.fromisoformat(data['updated_at']) if data.get('updated_at') else None,
        )


@dataclass
class DrugBatch(BaseModel):
    batch_number: str = ""
    drug_name: str = ""
    specification: str = ""
    manufacturer: str = ""
    production_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    quantity: int = 0
    unit: str = "支"
    storage_condition: str = "2-8°C冷藏"
    notes: str = ""
    
    @classmethod
    def table_name(cls) -> str:
        return "drug_batches"
    
    @classmethod
    def columns(cls) -> List[str]:
        return [
            "batch_number", "drug_name", "specification", "manufacturer",
            "production_date", "expiry_date", "quantity", "unit",
            "storage_condition", "notes", "created_at", "updated_at"
        ]
    
    @classmethod
    def from_dict(cls: Type[T], data: Dict[str, Any]) -> T:
        return cls(
            id=data.get('id'),
            batch_number=data.get('batch_number', ''),
            drug_name=data.get('drug_name', ''),
            specification=data.get('specification', ''),
            manufacturer=data.get('manufacturer', ''),
            production_date=datetime.fromisoformat(data['production_date']) if data.get('production_date') else None,
            expiry_date=datetime.fromisoformat(data['expiry_date']) if data.get('expiry_date') else None,
            quantity=data.get('quantity', 0),
            unit=data.get('unit', '支'),
            storage_condition=data.get('storage_condition', '2-8°C冷藏'),
            notes=data.get('notes', ''),
            created_at=datetime.fromisoformat(data['created_at']) if data.get('created_at') else None,
            updated_at=datetime.fromisoformat(data['updated_at']) if data.get('updated_at') else None,
        )


@dataclass
class DeliveryRoute(BaseModel):
    route_name: str = ""
    description: str = ""
    is_active: bool = True
    
    @classmethod
    def table_name(cls) -> str:
        return "delivery_routes"
    
    @classmethod
    def columns(cls) -> List[str]:
        return ["route_name", "description", "is_active", "created_at", "updated_at"]
    
    @classmethod
    def from_dict(cls: Type[T], data: Dict[str, Any]) -> T:
        return cls(
            id=data.get('id'),
            route_name=data.get('route_name', ''),
            description=data.get('description', ''),
            is_active=data.get('is_active', True),
            created_at=datetime.fromisoformat(data['created_at']) if data.get('created_at') else None,
            updated_at=datetime.fromisoformat(data['updated_at']) if data.get('updated_at') else None,
        )


@dataclass
class DeliveryPoint(BaseModel):
    point_name: str = ""
    address: str = ""
    contact_person: str = ""
    contact_phone: str = ""
    route_id: Optional[int] = None
    is_active: bool = True
    
    @classmethod
    def table_name(cls) -> str:
        return "delivery_points"
    
    @classmethod
    def columns(cls) -> List[str]:
        return [
            "point_name", "address", "contact_person", "contact_phone",
            "route_id", "is_active", "created_at", "updated_at"
        ]
    
    @classmethod
    def from_dict(cls: Type[T], data: Dict[str, Any]) -> T:
        return cls(
            id=data.get('id'),
            point_name=data.get('point_name', ''),
            address=data.get('address', ''),
            contact_person=data.get('contact_person', ''),
            contact_phone=data.get('contact_phone', ''),
            route_id=data.get('route_id'),
            is_active=data.get('is_active', True),
            created_at=datetime.fromisoformat(data['created_at']) if data.get('created_at') else None,
            updated_at=datetime.fromisoformat(data['updated_at']) if data.get('updated_at') else None,
        )


@dataclass
class DeliveryTask(BaseModel):
    task_number: str = ""
    status: TaskStatus = TaskStatus.TO_PACK
    cooler_box_id: Optional[int] = None
    route_id: Optional[int] = None
    delivery_point_id: Optional[int] = None
    pharmacist: str = ""
    courier: str = ""
    packing_time: Optional[datetime] = None
    departure_time: Optional[datetime] = None
    arrival_time: Optional[datetime] = None
    sign_time: Optional[datetime] = None
    archive_time: Optional[datetime] = None
    notes: str = ""
    
    @classmethod
    def table_name(cls) -> str:
        return "delivery_tasks"
    
    @classmethod
    def columns(cls) -> List[str]:
        return [
            "task_number", "status", "cooler_box_id", "route_id", "delivery_point_id",
            "pharmacist", "courier", "packing_time", "departure_time",
            "arrival_time", "sign_time", "archive_time", "notes",
            "created_at", "updated_at"
        ]
    
    @classmethod
    def from_dict(cls: Type[T], data: Dict[str, Any]) -> T:
        status = data.get('status')
        if isinstance(status, str):
            try:
                status = TaskStatus(status)
            except ValueError:
                status = TaskStatus.TO_PACK
        
        return cls(
            id=data.get('id'),
            task_number=data.get('task_number', ''),
            status=status,
            cooler_box_id=data.get('cooler_box_id'),
            route_id=data.get('route_id'),
            delivery_point_id=data.get('delivery_point_id'),
            pharmacist=data.get('pharmacist', ''),
            courier=data.get('courier', ''),
            packing_time=datetime.fromisoformat(data['packing_time']) if data.get('packing_time') else None,
            departure_time=datetime.fromisoformat(data['departure_time']) if data.get('departure_time') else None,
            arrival_time=datetime.fromisoformat(data['arrival_time']) if data.get('arrival_time') else None,
            sign_time=datetime.fromisoformat(data['sign_time']) if data.get('sign_time') else None,
            archive_time=datetime.fromisoformat(data['archive_time']) if data.get('archive_time') else None,
            notes=data.get('notes', ''),
            created_at=datetime.fromisoformat(data['created_at']) if data.get('created_at') else None,
            updated_at=datetime.fromisoformat(data['updated_at']) if data.get('updated_at') else None,
        )


@dataclass
class PackingItem(BaseModel):
    task_id: int = 0
    drug_batch_id: int = 0
    quantity: int = 0
    unit: str = "支"
    notes: str = ""
    
    @classmethod
    def table_name(cls) -> str:
        return "packing_items"
    
    @classmethod
    def columns(cls) -> List[str]:
        return ["task_id", "drug_batch_id", "quantity", "unit", "notes", "created_at", "updated_at"]
    
    @classmethod
    def from_dict(cls: Type[T], data: Dict[str, Any]) -> T:
        return cls(
            id=data.get('id'),
            task_id=data.get('task_id', 0),
            drug_batch_id=data.get('drug_batch_id', 0),
            quantity=data.get('quantity', 0),
            unit=data.get('unit', '支'),
            notes=data.get('notes', ''),
            created_at=datetime.fromisoformat(data['created_at']) if data.get('created_at') else None,
            updated_at=datetime.fromisoformat(data['updated_at']) if data.get('updated_at') else None,
        )


@dataclass
class TemperatureReading(BaseModel):
    task_id: int = 0
    device_id: str = ""
    reading_time: Optional[datetime] = None
    temperature: float = 0.0
    box_number: str = ""
    battery: Optional[float] = None
    is_overtemp: bool = False
    source_file: str = ""
    raw_data: str = ""
    
    @classmethod
    def table_name(cls) -> str:
        return "temperature_readings"
    
    @classmethod
    def columns(cls) -> List[str]:
        return [
            "task_id", "device_id", "reading_time", "temperature",
            "box_number", "battery", "is_overtemp", "source_file",
            "raw_data", "created_at", "updated_at"
        ]
    
    @classmethod
    def from_dict(cls: Type[T], data: Dict[str, Any]) -> T:
        return cls(
            id=data.get('id'),
            task_id=data.get('task_id', 0),
            device_id=data.get('device_id', ''),
            reading_time=datetime.fromisoformat(data['reading_time']) if data.get('reading_time') else None,
            temperature=data.get('temperature', 0.0),
            box_number=data.get('box_number', ''),
            battery=data.get('battery'),
            is_overtemp=data.get('is_overtemp', False),
            source_file=data.get('source_file', ''),
            raw_data=data.get('raw_data', ''),
            created_at=datetime.fromisoformat(data['created_at']) if data.get('created_at') else None,
            updated_at=datetime.fromisoformat(data['updated_at']) if data.get('updated_at') else None,
        )


@dataclass
class Attachment(BaseModel):
    task_id: int = 0
    attachment_type: AttachmentType = AttachmentType.OTHER
    original_filename: str = ""
    stored_filename: str = ""
    file_path: str = ""
    file_size: int = 0
    sha256_hash: str = ""
    notes: str = ""
    
    @classmethod
    def table_name(cls) -> str:
        return "attachments"
    
    @classmethod
    def columns(cls) -> List[str]:
        return [
            "task_id", "attachment_type", "original_filename", "stored_filename",
            "file_path", "file_size", "sha256_hash", "notes",
            "created_at", "updated_at"
        ]
    
    @classmethod
    def from_dict(cls: Type[T], data: Dict[str, Any]) -> T:
        att_type = data.get('attachment_type')
        if isinstance(att_type, str):
            try:
                att_type = AttachmentType(att_type)
            except ValueError:
                att_type = AttachmentType.OTHER
        
        return cls(
            id=data.get('id'),
            task_id=data.get('task_id', 0),
            attachment_type=att_type,
            original_filename=data.get('original_filename', ''),
            stored_filename=data.get('stored_filename', ''),
            file_path=data.get('file_path', ''),
            file_size=data.get('file_size', 0),
            sha256_hash=data.get('sha256_hash', ''),
            notes=data.get('notes', ''),
            created_at=datetime.fromisoformat(data['created_at']) if data.get('created_at') else None,
            updated_at=datetime.fromisoformat(data['updated_at']) if data.get('updated_at') else None,
        )


@dataclass
class AuditLog(BaseModel):
    task_id: int = 0
    action: str = ""
    operator: str = ""
    details: str = ""
    ip_address: str = ""
    
    @classmethod
    def table_name(cls) -> str:
        return "audit_logs"
    
    @classmethod
    def columns(cls) -> List[str]:
        return ["task_id", "action", "operator", "details", "ip_address", "created_at", "updated_at"]
    
    @classmethod
    def from_dict(cls: Type[T], data: Dict[str, Any]) -> T:
        return cls(
            id=data.get('id'),
            task_id=data.get('task_id', 0),
            action=data.get('action', ''),
            operator=data.get('operator', ''),
            details=data.get('details', ''),
            ip_address=data.get('ip_address', ''),
            created_at=datetime.fromisoformat(data['created_at']) if data.get('created_at') else None,
            updated_at=datetime.fromisoformat(data['updated_at']) if data.get('updated_at') else None,
        )


@dataclass
class AuditPackage(BaseModel):
    task_id: int = 0
    package_number: str = ""
    temperature_risk: str = ""
    handling_opinion: str = ""
    attachments_hash: str = ""
    full_hash: str = ""
    file_path: str = ""
    generated_at: Optional[datetime] = None
    
    @classmethod
    def table_name(cls) -> str:
        return "audit_packages"
    
    @classmethod
    def columns(cls) -> List[str]:
        return [
            "task_id", "package_number", "temperature_risk", "handling_opinion",
            "attachments_hash", "full_hash", "file_path", "generated_at",
            "created_at", "updated_at"
        ]
    
    @classmethod
    def from_dict(cls: Type[T], data: Dict[str, Any]) -> T:
        return cls(
            id=data.get('id'),
            task_id=data.get('task_id', 0),
            package_number=data.get('package_number', ''),
            temperature_risk=data.get('temperature_risk', ''),
            handling_opinion=data.get('handling_opinion', ''),
            attachments_hash=data.get('attachments_hash', ''),
            full_hash=data.get('full_hash', ''),
            file_path=data.get('file_path', ''),
            generated_at=datetime.fromisoformat(data['generated_at']) if data.get('generated_at') else None,
            created_at=datetime.fromisoformat(data['created_at']) if data.get('created_at') else None,
            updated_at=datetime.fromisoformat(data['updated_at']) if data.get('updated_at') else None,
        )


@dataclass
class QuarantineRecord(BaseModel):
    source_file: str = ""
    row_number: int = 0
    raw_data: str = ""
    error_reason: str = ""
    error_category: str = ""
    is_resolved: bool = False
    resolution_notes: str = ""
    
    @classmethod
    def table_name(cls) -> str:
        return "quarantine_records"
    
    @classmethod
    def columns(cls) -> List[str]:
        return [
            "source_file", "row_number", "raw_data", "error_reason",
            "error_category", "is_resolved", "resolution_notes",
            "created_at", "updated_at"
        ]
    
    @classmethod
    def from_dict(cls: Type[T], data: Dict[str, Any]) -> T:
        return cls(
            id=data.get('id'),
            source_file=data.get('source_file', ''),
            row_number=data.get('row_number', 0),
            raw_data=data.get('raw_data', ''),
            error_reason=data.get('error_reason', ''),
            error_category=data.get('error_category', ''),
            is_resolved=data.get('is_resolved', False),
            resolution_notes=data.get('resolution_notes', ''),
            created_at=datetime.fromisoformat(data['created_at']) if data.get('created_at') else None,
            updated_at=datetime.fromisoformat(data['updated_at']) if data.get('updated_at') else None,
        )


@dataclass
class ExceptionRecord(BaseModel):
    task_id: int = 0
    exception_type: ExceptionType = ExceptionType.OTHER
    reading_id: Optional[int] = None
    details: str = ""
    is_resolved: bool = False
    resolution_notes: str = ""
    resolved_at: Optional[datetime] = None
    
    @classmethod
    def table_name(cls) -> str:
        return "exception_records"
    
    @classmethod
    def columns(cls) -> List[str]:
        return [
            "task_id", "exception_type", "reading_id", "details",
            "is_resolved", "resolution_notes", "resolved_at",
            "created_at", "updated_at"
        ]
    
    @classmethod
    def from_dict(cls: Type[T], data: Dict[str, Any]) -> T:
        exc_type = data.get('exception_type')
        if isinstance(exc_type, str):
            try:
                exc_type = ExceptionType(exc_type)
            except ValueError:
                exc_type = ExceptionType.OTHER
        
        return cls(
            id=data.get('id'),
            task_id=data.get('task_id', 0),
            exception_type=exc_type,
            reading_id=data.get('reading_id'),
            details=data.get('details', ''),
            is_resolved=data.get('is_resolved', False),
            resolution_notes=data.get('resolution_notes', ''),
            resolved_at=datetime.fromisoformat(data['resolved_at']) if data.get('resolved_at') else None,
            created_at=datetime.fromisoformat(data['created_at']) if data.get('created_at') else None,
            updated_at=datetime.fromisoformat(data['updated_at']) if data.get('updated_at') else None,
        )
