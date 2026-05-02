"""台账模型模块"""

import csv
import json
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import List, Optional, Dict, Any

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False


def parse_date(date_str: Optional[str]) -> Optional[date]:
    """解析日期字符串
    
    支持多种日期格式：YYYY-MM-DD, YYYY/MM/DD, YYYYMMDD 等
    """
    if not date_str or str(date_str).strip() == "":
        return None
    
    date_str = str(date_str).strip()
    
    formats = [
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%Y年%m月%d日",
        "%Y%m%d",
        "%m/%d/%Y",
        "%d-%m-%Y",
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    
    return None


@dataclass
class ScanRecord:
    """扫码记录类
    
    记录每次封签扫码的信息，用于封签连续性校验。
    """
    
    scan_id: str
    rescue_car_id: str
    seal_number: str
    scan_time: datetime
    operator: str
    shift: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    is_valid: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "scan_id": self.scan_id,
            "rescue_car_id": self.rescue_car_id,
            "seal_number": self.seal_number,
            "scan_time": self.scan_time.isoformat() if self.scan_time else None,
            "operator": self.operator,
            "shift": self.shift,
            "location": self.location,
            "notes": self.notes,
            "is_valid": self.is_valid,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ScanRecord":
        """从字典创建实例"""
        scan_time = None
        if data.get("scan_time"):
            try:
                scan_time = datetime.fromisoformat(data["scan_time"])
            except (ValueError, TypeError):
                pass
        
        return cls(
            scan_id=data["scan_id"],
            rescue_car_id=data["rescue_car_id"],
            seal_number=data["seal_number"],
            scan_time=scan_time,
            operator=data["operator"],
            shift=data.get("shift"),
            location=data.get("location"),
            notes=data.get("notes"),
            is_valid=data.get("is_valid", True),
        )
    
    @classmethod
    def from_csv(cls, csv_path: Path) -> List["ScanRecord"]:
        """从 CSV 文件加载扫码记录
        
        CSV 字段要求：
        - scan_id: 扫码记录ID
        - rescue_car_id: 抢救车编号
        - seal_number: 封签编号
        - scan_time: 扫码时间
        - operator: 操作人
        - shift: 班次（可选）
        - location: 地点（可选）
        - notes: 备注（可选）
        """
        records = []
        
        if HAS_PANDAS:
            df = pd.read_csv(csv_path, encoding="utf-8")
            for _, row in df.iterrows():
                scan_time = None
                if pd.notna(row.get("scan_time")):
                    try:
                        if isinstance(row["scan_time"], str):
                            scan_time = datetime.fromisoformat(row["scan_time"])
                        else:
                            scan_time = pd.to_datetime(row["scan_time"]).to_pydatetime()
                    except (ValueError, TypeError):
                        pass
                
                records.append(cls(
                    scan_id=str(row.get("scan_id", "")),
                    rescue_car_id=str(row.get("rescue_car_id", "")),
                    seal_number=str(row.get("seal_number", "")),
                    scan_time=scan_time,
                    operator=str(row.get("operator", "")),
                    shift=str(row.get("shift")) if pd.notna(row.get("shift")) else None,
                    location=str(row.get("location")) if pd.notna(row.get("location")) else None,
                    notes=str(row.get("notes")) if pd.notna(row.get("notes")) else None,
                    is_valid=bool(row.get("is_valid", True)),
                ))
        else:
            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    scan_time = None
                    if row.get("scan_time"):
                        try:
                            scan_time = datetime.fromisoformat(row["scan_time"])
                        except (ValueError, TypeError):
                            pass
                    
                    records.append(cls(
                        scan_id=row.get("scan_id", ""),
                        rescue_car_id=row.get("rescue_car_id", ""),
                        seal_number=row.get("seal_number", ""),
                        scan_time=scan_time,
                        operator=row.get("operator", ""),
                        shift=row.get("shift"),
                        location=row.get("location"),
                        notes=row.get("notes"),
                        is_valid=row.get("is_valid", "true").lower() in ("true", "1", "yes"),
                    ))
        
        return records


@dataclass
class MedicationExpiry:
    """药品效期表类
    
    记录抢救车中药品的效期信息。
    """
    
    medication_id: str
    name: str
    specification: str
    batch_number: str
    expiry_date: Optional[date]
    quantity: int = 1
    rescue_car_id: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    
    def days_until_expiry(self, reference_date: Optional[date] = None) -> int:
        """计算距离过期的天数
        
        Args:
            reference_date: 参考日期，默认为今天
        
        Returns:
            距离过期的天数，已过期返回负数
        """
        if not self.expiry_date:
            return 99999
        
        ref_date = reference_date or date.today()
        delta = self.expiry_date - ref_date
        return delta.days
    
    def is_near_expiry(self, days_threshold: int = 30, reference_date: Optional[date] = None) -> bool:
        """检查是否为近效期药品
        
        Args:
            days_threshold: 近效期阈值天数
            reference_date: 参考日期
        
        Returns:
            是否为近效期
        """
        days = self.days_until_expiry(reference_date)
        return 0 <= days <= days_threshold
    
    def is_expired(self, reference_date: Optional[date] = None) -> bool:
        """检查是否已过期
        
        Args:
            reference_date: 参考日期
        
        Returns:
            是否已过期
        """
        return self.days_until_expiry(reference_date) < 0
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "medication_id": self.medication_id,
            "name": self.name,
            "specification": self.specification,
            "batch_number": self.batch_number,
            "expiry_date": self.expiry_date.isoformat() if self.expiry_date else None,
            "quantity": self.quantity,
            "rescue_car_id": self.rescue_car_id,
            "location": self.location,
            "notes": self.notes,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MedicationExpiry":
        """从字典创建实例"""
        expiry_date = parse_date(data.get("expiry_date"))
        
        return cls(
            medication_id=data["medication_id"],
            name=data["name"],
            specification=data["specification"],
            batch_number=data["batch_number"],
            expiry_date=expiry_date,
            quantity=int(data.get("quantity", 1)),
            rescue_car_id=data.get("rescue_car_id"),
            location=data.get("location"),
            notes=data.get("notes"),
        )
    
    @classmethod
    def from_csv(cls, csv_path: Path) -> List["MedicationExpiry"]:
        """从 CSV 文件加载药品效期表
        
        CSV 字段要求：
        - medication_id: 药品ID
        - name: 药品名称
        - specification: 规格
        - batch_number: 批号
        - expiry_date: 有效期
        - quantity: 数量（可选）
        - rescue_car_id: 抢救车编号（可选）
        - location: 位置（可选）
        - notes: 备注（可选）
        """
        medications = []
        
        if HAS_PANDAS:
            df = pd.read_csv(csv_path, encoding="utf-8")
            for _, row in df.iterrows():
                expiry_date = None
                if pd.notna(row.get("expiry_date")):
                    expiry_date = parse_date(str(row["expiry_date"]))
                
                medications.append(cls(
                    medication_id=str(row.get("medication_id", "")),
                    name=str(row.get("name", "")),
                    specification=str(row.get("specification", "")),
                    batch_number=str(row.get("batch_number", "")),
                    expiry_date=expiry_date,
                    quantity=int(row.get("quantity", 1)) if pd.notna(row.get("quantity")) else 1,
                    rescue_car_id=str(row.get("rescue_car_id")) if pd.notna(row.get("rescue_car_id")) else None,
                    location=str(row.get("location")) if pd.notna(row.get("location")) else None,
                    notes=str(row.get("notes")) if pd.notna(row.get("notes")) else None,
                ))
        else:
            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    expiry_date = parse_date(row.get("expiry_date"))
                    
                    medications.append(cls(
                        medication_id=row.get("medication_id", ""),
                        name=row.get("name", ""),
                        specification=row.get("specification", ""),
                        batch_number=row.get("batch_number", ""),
                        expiry_date=expiry_date,
                        quantity=int(row.get("quantity", 1)) if row.get("quantity") else 1,
                        rescue_car_id=row.get("rescue_car_id"),
                        location=row.get("location"),
                        notes=row.get("notes"),
                    ))
        
        return medications


@dataclass
class MaintenanceBorrow:
    """维修借用单类
    
    记录设备的维修、借用、归还信息。
    """
    
    record_id: str
    device_id: str
    device_name: str
    operation_type: str
    request_time: datetime
    operator: str
    expected_return_time: Optional[datetime] = None
    actual_return_time: Optional[datetime] = None
    status: str = "active"
    notes: Optional[str] = None
    rescue_car_id: Optional[str] = None
    
    def is_borrowed(self) -> bool:
        """检查设备是否处于借出状态"""
        return (
            self.operation_type in ("借用", "借出", "borrow", "lend")
            and self.status in ("active", "进行中", "已借出")
            and self.actual_return_time is None
        )
    
    def is_overdue(self, reference_time: Optional[datetime] = None) -> bool:
        """检查是否超期未还
        
        Args:
            reference_time: 参考时间，默认为当前时间
        
        Returns:
            是否超期
        """
        if not self.is_borrowed():
            return False
        
        if not self.expected_return_time:
            return False
        
        ref_time = reference_time or datetime.now()
        return ref_time > self.expected_return_time
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "record_id": self.record_id,
            "device_id": self.device_id,
            "device_name": self.device_name,
            "operation_type": self.operation_type,
            "request_time": self.request_time.isoformat() if self.request_time else None,
            "operator": self.operator,
            "expected_return_time": self.expected_return_time.isoformat() if self.expected_return_time else None,
            "actual_return_time": self.actual_return_time.isoformat() if self.actual_return_time else None,
            "status": self.status,
            "notes": self.notes,
            "rescue_car_id": self.rescue_car_id,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MaintenanceBorrow":
        """从字典创建实例"""
        def parse_datetime(value: Any) -> Optional[datetime]:
            if not value:
                return None
            try:
                if isinstance(value, str):
                    return datetime.fromisoformat(value)
                return value
            except (ValueError, TypeError):
                return None
        
        return cls(
            record_id=data["record_id"],
            device_id=data["device_id"],
            device_name=data["device_name"],
            operation_type=data["operation_type"],
            request_time=parse_datetime(data.get("request_time")),
            operator=data["operator"],
            expected_return_time=parse_datetime(data.get("expected_return_time")),
            actual_return_time=parse_datetime(data.get("actual_return_time")),
            status=data.get("status", "active"),
            notes=data.get("notes"),
            rescue_car_id=data.get("rescue_car_id"),
        )
    
    @classmethod
    def from_csv(cls, csv_path: Path) -> List["MaintenanceBorrow"]:
        """从 CSV 文件加载维修借用单
        
        CSV 字段要求：
        - record_id: 记录ID
        - device_id: 设备ID
        - device_name: 设备名称
        - operation_type: 操作类型（借用/维修/归还等）
        - request_time: 申请时间
        - operator: 操作人
        - expected_return_time: 预计归还时间（可选）
        - actual_return_time: 实际归还时间（可选）
        - status: 状态（可选）
        - notes: 备注（可选）
        - rescue_car_id: 抢救车编号（可选）
        """
        records = []
        
        def parse_datetime_value(value: Any) -> Optional[datetime]:
            if pd.isna(value) if HAS_PANDAS else not value:
                return None
            try:
                if isinstance(value, str):
                    return datetime.fromisoformat(value)
                if HAS_PANDAS and isinstance(value, pd.Timestamp):
                    return value.to_pydatetime()
                return value
            except (ValueError, TypeError):
                return None
        
        if HAS_PANDAS:
            df = pd.read_csv(csv_path, encoding="utf-8")
            for _, row in df.iterrows():
                records.append(cls(
                    record_id=str(row.get("record_id", "")),
                    device_id=str(row.get("device_id", "")),
                    device_name=str(row.get("device_name", "")),
                    operation_type=str(row.get("operation_type", "")),
                    request_time=parse_datetime_value(row.get("request_time")),
                    operator=str(row.get("operator", "")),
                    expected_return_time=parse_datetime_value(row.get("expected_return_time")),
                    actual_return_time=parse_datetime_value(row.get("actual_return_time")),
                    status=str(row.get("status", "active")) if pd.notna(row.get("status")) else "active",
                    notes=str(row.get("notes")) if pd.notna(row.get("notes")) else None,
                    rescue_car_id=str(row.get("rescue_car_id")) if pd.notna(row.get("rescue_car_id")) else None,
                ))
        else:
            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    records.append(cls(
                        record_id=row.get("record_id", ""),
                        device_id=row.get("device_id", ""),
                        device_name=row.get("device_name", ""),
                        operation_type=row.get("operation_type", ""),
                        request_time=parse_datetime_value(row.get("request_time")),
                        operator=row.get("operator", ""),
                        expected_return_time=parse_datetime_value(row.get("expected_return_time")),
                        actual_return_time=parse_datetime_value(row.get("actual_return_time")),
                        status=row.get("status", "active"),
                        notes=row.get("notes"),
                        rescue_car_id=row.get("rescue_car_id"),
                    ))
        
        return records


@dataclass
class LedgerManager:
    """台账管理器
    
    统一管理所有台账数据。
    """
    
    scan_records: List[ScanRecord] = field(default_factory=list)
    medications: List[MedicationExpiry] = field(default_factory=list)
    maintenances: List[MaintenanceBorrow] = field(default_factory=list)
    created_time: datetime = field(default_factory=datetime.now)
    
    def get_scan_records_by_car(self, rescue_car_id: str) -> List[ScanRecord]:
        """按抢救车编号获取扫码记录"""
        return [r for r in self.scan_records if r.rescue_car_id == rescue_car_id]
    
    def get_scan_records_by_shift(self, shift: str) -> List[ScanRecord]:
        """按班次获取扫码记录"""
        return [r for r in self.scan_records if r.shift == shift]
    
    def get_medications_by_car(self, rescue_car_id: str) -> List[MedicationExpiry]:
        """按抢救车编号获取药品"""
        return [m for m in self.medications if m.rescue_car_id == rescue_car_id]
    
    def get_expired_medications(self, reference_date: Optional[date] = None) -> List[MedicationExpiry]:
        """获取已过期药品"""
        return [m for m in self.medications if m.is_expired(reference_date)]
    
    def get_near_expiry_medications(
        self, days_threshold: int = 30, reference_date: Optional[date] = None
    ) -> List[MedicationExpiry]:
        """获取近效期药品"""
        return [m for m in self.medications if m.is_near_expiry(days_threshold, reference_date)]
    
    def get_borrowed_devices(self) -> List[MaintenanceBorrow]:
        """获取当前借出的设备"""
        return [m for m in self.maintenances if m.is_borrowed()]
    
    def get_overdue_devices(self, reference_time: Optional[datetime] = None) -> List[MaintenanceBorrow]:
        """获取超期未还的设备"""
        return [m for m in self.maintenances if m.is_overdue(reference_time)]
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "scan_records": [r.to_dict() for r in self.scan_records],
            "medications": [m.to_dict() for m in self.medications],
            "maintenances": [m.to_dict() for m in self.maintenances],
            "created_time": self.created_time.isoformat(),
        }
    
    def save(self, output_path: Path) -> None:
        """保存到 JSON 文件"""
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, ensure_ascii=False, indent=2, default=str)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "LedgerManager":
        """从字典创建实例"""
        created_time = datetime.now()
        if data.get("created_time"):
            try:
                created_time = datetime.fromisoformat(data["created_time"])
            except (ValueError, TypeError):
                pass
        
        return cls(
            scan_records=[ScanRecord.from_dict(r) for r in data.get("scan_records", [])],
            medications=[MedicationExpiry.from_dict(m) for m in data.get("medications", [])],
            maintenances=[MaintenanceBorrow.from_dict(m) for m in data.get("maintenances", [])],
            created_time=created_time,
        )
    
    @classmethod
    def load(cls, input_path: Path) -> "LedgerManager":
        """从 JSON 文件加载"""
        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls.from_dict(data)
