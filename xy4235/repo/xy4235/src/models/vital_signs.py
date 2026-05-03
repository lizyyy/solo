from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Optional, Dict
import json


@dataclass
class VitalSignsRecord:
    """
    单条生命体征记录
    """
    timestamp: datetime
    heart_rate: Optional[float] = None  # 心率 (bpm)
    systolic_bp: Optional[float] = None  # 收缩压 (mmHg)
    diastolic_bp: Optional[float] = None  # 舒张压 (mmHg)
    mean_bp: Optional[float] = None  # 平均压 (mmHg)
    spo2: Optional[float] = None  # 血氧饱和度 (%)
    temperature: Optional[float] = None  # 体温 (°C)
    respiratory_rate: Optional[float] = None  # 呼吸频率 (rpm)
    etco2: Optional[float] = None  # 呼气末二氧化碳 (mmHg)
    source: str = "monitor"  # 数据来源
    
    def to_dict(self) -> Dict:
        """
        转换为字典
        """
        return {
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "heart_rate": self.heart_rate,
            "systolic_bp": self.systolic_bp,
            "diastolic_bp": self.diastolic_bp,
            "mean_bp": self.mean_bp,
            "spo2": self.spo2,
            "temperature": self.temperature,
            "respiratory_rate": self.respiratory_rate,
            "etco2": self.etco2,
            "source": self.source
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'VitalSignsRecord':
        """
        从字典创建对象
        """
        timestamp = datetime.fromisoformat(data["timestamp"]) if data.get("timestamp") else None
        return cls(
            timestamp=timestamp,
            heart_rate=data.get("heart_rate"),
            systolic_bp=data.get("systolic_bp"),
            diastolic_bp=data.get("diastolic_bp"),
            mean_bp=data.get("mean_bp"),
            spo2=data.get("spo2"),
            temperature=data.get("temperature"),
            respiratory_rate=data.get("respiratory_rate"),
            etco2=data.get("etco2"),
            source=data.get("source", "monitor")
        )


@dataclass
class VitalSigns:
    """
    完整的生命体征数据集
    """
    case_id: str
    records: List[VitalSignsRecord] = field(default_factory=list)
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    species: Optional[str] = None  # 物种 (犬/猫/其他)
    breed: Optional[str] = None  # 品种
    age: Optional[str] = None  # 年龄
    weight: Optional[float] = None  # 体重 (kg)
    procedure: Optional[str] = None  # 手术/操作名称
    anesthesiologist: Optional[str] = None  # 麻醉医师
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    def add_record(self, record: VitalSignsRecord):
        """
        添加生命体征记录
        """
        self.records.append(record)
        # 按时间排序
        self.records.sort(key=lambda x: x.timestamp if x.timestamp else datetime.min)
        
        # 更新开始和结束时间
        if self.records:
            if not self.start_time or (self.records[0].timestamp and self.records[0].timestamp < self.start_time):
                self.start_time = self.records[0].timestamp
            if not self.end_time or (self.records[-1].timestamp and self.records[-1].timestamp > self.end_time):
                self.end_time = self.records[-1].timestamp
    
    def get_records_in_range(self, start_time: datetime, end_time: datetime) -> List[VitalSignsRecord]:
        """
        获取指定时间范围内的记录
        """
        return [
            record for record in self.records
            if record.timestamp and start_time <= record.timestamp <= end_time
        ]
    
    def get_parameter_series(self, parameter: str) -> Dict[datetime, float]:
        """
        获取指定参数的时间序列
        参数名: heart_rate, systolic_bp, diastolic_bp, mean_bp, spo2, temperature, respiratory_rate, etco2
        """
        series = {}
        for record in self.records:
            if record.timestamp:
                value = getattr(record, parameter, None)
                if value is not None:
                    series[record.timestamp] = value
        return series
    
    def to_dict(self) -> Dict:
        """
        转换为字典
        """
        return {
            "case_id": self.case_id,
            "patient_id": self.patient_id,
            "patient_name": self.patient_name,
            "species": self.species,
            "breed": self.breed,
            "age": self.age,
            "weight": self.weight,
            "procedure": self.procedure,
            "anesthesiologist": self.anesthesiologist,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "records": [record.to_dict() for record in self.records]
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'VitalSigns':
        """
        从字典创建对象
        """
        start_time = datetime.fromisoformat(data["start_time"]) if data.get("start_time") else None
        end_time = datetime.fromisoformat(data["end_time"]) if data.get("end_time") else None
        
        records = []
        for record_data in data.get("records", []):
            records.append(VitalSignsRecord.from_dict(record_data))
        
        return cls(
            case_id=data["case_id"],
            patient_id=data.get("patient_id"),
            patient_name=data.get("patient_name"),
            species=data.get("species"),
            breed=data.get("breed"),
            age=data.get("age"),
            weight=data.get("weight"),
            procedure=data.get("procedure"),
            anesthesiologist=data.get("anesthesiologist"),
            start_time=start_time,
            end_time=end_time,
            records=records
        )
