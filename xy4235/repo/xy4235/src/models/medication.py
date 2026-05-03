from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict
from enum import Enum


class MedicationRoute(Enum):
    """
    给药途径
    """
    IV = "静脉注射"
    IM = "肌肉注射"
    SC = "皮下注射"
    INHALATION = "吸入"
    ORAL = "口服"
    OTHER = "其他"


class MedicationType(Enum):
    """
    药物类型
    """
    INDUCTION = "诱导药"
    MAINTENANCE = "维持药"
    ANALGESIC = "镇痛药"
    MUSCLE_RELAXANT = "肌松药"
    EMERGENCY = "急救药"
    OTHER = "其他"


@dataclass
class MedicationRecord:
    """
    单条给药记录
    """
    timestamp: datetime
    medication_name: str
    dose: float
    unit: str  # mg, ml, mcg等
    route: MedicationRoute
    medication_type: MedicationType = MedicationType.OTHER
    concentration: Optional[str] = None  # 浓度，如 "10mg/ml"
    administered_by: Optional[str] = None  # 给药人员
    notes: Optional[str] = None  # 备注
    
    def to_dict(self) -> Dict:
        """
        转换为字典
        """
        return {
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "medication_name": self.medication_name,
            "dose": self.dose,
            "unit": self.unit,
            "route": self.route.value,
            "route_code": self.route.name,
            "medication_type": self.medication_type.value,
            "medication_type_code": self.medication_type.name,
            "concentration": self.concentration,
            "administered_by": self.administered_by,
            "notes": self.notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'MedicationRecord':
        """
        从字典创建对象
        """
        timestamp = datetime.fromisoformat(data["timestamp"]) if data.get("timestamp") else None
        
        # 解析给药途径
        route_code = data.get("route_code", data.get("route", "OTHER"))
        try:
            route = MedicationRoute[route_code]
        except KeyError:
            route = MedicationRoute.OTHER
        
        # 解析药物类型
        type_code = data.get("medication_type_code", data.get("medication_type", "OTHER"))
        try:
            medication_type = MedicationType[type_code]
        except KeyError:
            medication_type = MedicationType.OTHER
        
        return cls(
            timestamp=timestamp,
            medication_name=data["medication_name"],
            dose=float(data["dose"]) if data.get("dose") else 0.0,
            unit=data.get("unit", "mg"),
            route=route,
            medication_type=medication_type,
            concentration=data.get("concentration"),
            administered_by=data.get("administered_by"),
            notes=data.get("notes")
        )


@dataclass
class Medication:
    """
    完整的给药记录集
    """
    case_id: str
    records: List[MedicationRecord] = field(default_factory=list)
    
    def add_record(self, record: MedicationRecord):
        """
        添加给药记录
        """
        self.records.append(record)
        # 按时间排序
        self.records.sort(key=lambda x: x.timestamp if x.timestamp else datetime.min)
    
    def get_records_in_range(self, start_time: datetime, end_time: datetime) -> List[MedicationRecord]:
        """
        获取指定时间范围内的给药记录
        """
        return [
            record for record in self.records
            if record.timestamp and start_time <= record.timestamp <= end_time
        ]
    
    def get_medications_by_type(self, medication_type: MedicationType) -> List[MedicationRecord]:
        """
        按类型获取给药记录
        """
        return [
            record for record in self.records
            if record.medication_type == medication_type
        ]
    
    def to_dict(self) -> Dict:
        """
        转换为字典
        """
        return {
            "case_id": self.case_id,
            "records": [record.to_dict() for record in self.records]
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Medication':
        """
        从字典创建对象
        """
        records = []
        for record_data in data.get("records", []):
            records.append(MedicationRecord.from_dict(record_data))
        
        return cls(
            case_id=data["case_id"],
            records=records
        )
