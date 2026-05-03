from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator


class SensorRecord(BaseModel):
    record_id: str = Field(..., description="记录唯一标识")
    pond_id: str = Field(..., description="池塘ID")
    timestamp: datetime = Field(..., description="记录时间")
    sensor_type: str = Field(..., description="传感器类型")
    sensor_id: Optional[str] = Field(None, description="传感器ID")
    value: float = Field(..., description="测量值")
    unit: str = Field(..., description="单位")
    location: Optional[str] = Field(None, description="测量位置")
    is_valid: bool = Field(True, description="数据是否有效")
    invalid_reason: Optional[str] = Field(None, description="无效原因")

    @field_validator("timestamp")
    @classmethod
    def ensure_naive_datetime(cls, v: datetime) -> datetime:
        if v.tzinfo is not None:
            return v.replace(tzinfo=None)
        return v


class SensorData(BaseModel):
    pond_id: str = Field(..., description="池塘ID")
    start_time: datetime = Field(..., description="数据起始时间")
    end_time: datetime = Field(..., description="数据结束时间")
    records: List[SensorRecord] = Field(default_factory=list, description="传感器记录列表")

    @field_validator("end_time")
    @classmethod
    def validate_time_range(cls, v: datetime, info: dict) -> datetime:
        if "start_time" in info.data and v < info.data["start_time"]:
            raise ValueError("结束时间不能早于开始时间")
        return v

    def add_record(self, record: SensorRecord) -> None:
        if record.pond_id != self.pond_id:
            raise ValueError(f"记录池塘ID {record.pond_id} 与数据集池塘ID {self.pond_id} 不匹配")
        self.records.append(record)
        self.records.sort(key=lambda r: r.timestamp)

    def get_records_by_type(self, sensor_type: str) -> List[SensorRecord]:
        return [r for r in self.records if r.sensor_type == sensor_type and r.is_valid]

    def get_latest_state(self) -> dict:
        latest_values = {}
        for record in sorted(self.records, key=lambda r: r.timestamp, reverse=True):
            if record.is_valid and record.sensor_type not in latest_values:
                latest_values[record.sensor_type] = {
                    "value": record.value,
                    "timestamp": record.timestamp,
                    "unit": record.unit,
                }
        return latest_values
