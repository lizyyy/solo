from datetime import datetime, date
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, validator


class AnomalyType(str, Enum):
    EXPIRED = "EXPIRED"
    NOT_STERILIZED = "NOT_STERILIZED"
    BATCH_MISMATCH = "BATCH_MISMATCH"
    INVALID_DATE = "INVALID_DATE"
    MISSING_DATA = "MISSING_DATA"
    DUPLICATE_RECORD = "DUPLICATE_RECORD"
    FUTURE_USAGE = "FUTURE_USAGE"


class MaterialBatch(BaseModel):
    batch_id: str = Field(description="耗材批次号")
    material_name: str = Field(description="耗材名称")
    material_type: str = Field(description="耗材类型")
    manufacturer: str = Field(description="生产厂家")
    production_date: Optional[date] = Field(None, description="生产日期")
    expiration_date: Optional[date] = Field(None, description="有效期")
    initial_quantity: int = Field(ge=0, description="初始数量")
    received_date: date = Field(description="入库日期")
    supplier: Optional[str] = Field(None, description="供应商")
    notes: Optional[str] = Field(None, description="备注")

    @validator('batch_id')
    def batch_id_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("批次号不能为空")
        return v.strip()


class SterilizationRecord(BaseModel):
    sterilization_id: str = Field(description="灭菌记录ID")
    batch_id: str = Field(description="关联耗材批次号")
    sterilization_date: datetime = Field(description="灭菌日期时间")
    expiration_date: datetime = Field(description="灭菌有效期")
    sterilization_method: str = Field(description="灭菌方式")
    operator: str = Field(description="操作人员")
    sterilizer_id: Optional[str] = Field(None, description="灭菌器编号")
    temperature: Optional[float] = Field(None, description="灭菌温度")
    duration: Optional[int] = Field(None, description="灭菌时长(分钟)")
    indicator_result: Optional[str] = Field(None, description="指示剂结果")
    notes: Optional[str] = Field(None, description="备注")

    @validator('sterilization_id', 'batch_id', 'operator')
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("字段不能为空")
        return v.strip()


class Patient(BaseModel):
    patient_id: str = Field(description="患者ID")
    name: str = Field(description="患者姓名")
    gender: Optional[str] = Field(None, description="性别")
    age: Optional[int] = Field(None, ge=0, description="年龄")
    phone: Optional[str] = Field(None, description="联系电话")
    id_card: Optional[str] = Field(None, description="身份证号")
    registration_date: date = Field(description="建档日期")
    notes: Optional[str] = Field(None, description="备注")


class TreatmentItem(BaseModel):
    treatment_id: str = Field(description="治疗项目ID")
    patient_id: str = Field(description="患者ID")
    treatment_date: datetime = Field(description="治疗日期时间")
    treatment_type: str = Field(description="治疗类型")
    dentist: str = Field(description="主治医生")
    assistant: Optional[str] = Field(None, description="助手")
    chair_no: Optional[str] = Field(None, description="牙椅号")
    diagnosis: Optional[str] = Field(None, description="诊断")
    notes: Optional[str] = Field(None, description="备注")


class UsageRecord(BaseModel):
    usage_id: str = Field(description="使用记录ID")
    treatment_id: str = Field(description="关联治疗项目ID")
    batch_id: str = Field(description="耗材批次号")
    usage_date: datetime = Field(description="使用日期时间")
    quantity: int = Field(gt=0, description="使用数量")
    used_by: str = Field(description="使用人")
    notes: Optional[str] = Field(None, description="备注")


class TraceRecord(BaseModel):
    trace_id: str = Field(description="追溯ID")
    batch_id: str = Field(description="耗材批次号")
    sterilization_id: Optional[str] = Field(None, description="灭菌记录ID")
    usage_id: Optional[str] = Field(None, description="使用记录ID")
    treatment_id: Optional[str] = Field(None, description="治疗项目ID")
    patient_id: Optional[str] = Field(None, description="患者ID")
    trace_date: datetime = Field(default_factory=datetime.now, description="追溯时间")


class TraceResult(BaseModel):
    batch_id: str
    material_name: str
    sterilization_id: Optional[str]
    sterilization_date: Optional[datetime]
    sterilization_expiration: Optional[datetime]
    usage_id: Optional[str]
    usage_date: Optional[datetime]
    treatment_id: Optional[str]
    treatment_date: Optional[datetime]
    patient_id: Optional[str]
    patient_name: Optional[str]
    is_valid: bool
    anomalies: List[AnomalyType]
    anomaly_details: List[str]
    quantity_used: Optional[int]

    class Config:
        json_encoders = {
            datetime: lambda v: v.strftime('%Y-%m-%d %H:%M:%S'),
            date: lambda v: v.strftime('%Y-%m-%d')
        }
