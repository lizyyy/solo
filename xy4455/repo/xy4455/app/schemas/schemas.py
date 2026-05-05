from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.models.models import PatientStatus
import enum

class DataSource(str, enum.Enum):
    ANESTHESIA = "anesthesia"
    INFUSION = "infusion"
    CAGE = "cage"
    MEDICATION = "medication"

class AnesthesiaRecordBase(BaseModel):
    patient_id: str = Field(..., description="患者ID")
    patient_name: Optional[str] = Field(None, description="患者名称")
    species: Optional[str] = Field(None, description="物种")
    breed: Optional[str] = Field(None, description="品种")
    
    anesthesia_start_time: Optional[datetime] = Field(None, description="麻醉开始时间")
    anesthesia_end_time: Optional[datetime] = Field(None, description="麻醉结束时间")
    awakening_time: Optional[datetime] = Field(None, description="苏醒时间")
    
    anesthetic_type: Optional[str] = Field(None, description="麻醉类型")
    dosage: Optional[float] = Field(None, description="剂量")
    
    heart_rate: Optional[float] = Field(None, description="心率")
    respiratory_rate: Optional[float] = Field(None, description="呼吸频率")
    blood_pressure_systolic: Optional[float] = Field(None, description="收缩压")
    blood_pressure_diastolic: Optional[float] = Field(None, description="舒张压")
    temperature: Optional[float] = Field(None, description="体温")
    spo2: Optional[float] = Field(None, description="血氧饱和度")
    
    notes: Optional[str] = Field(None, description="备注")

class AnesthesiaRecordCreate(AnesthesiaRecordBase):
    pass

class AnesthesiaRecordResponse(AnesthesiaRecordBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class InfusionPumpLogBase(BaseModel):
    patient_id: str = Field(..., description="患者ID")
    log_time: datetime = Field(..., description="记录时间")
    drug_name: Optional[str] = Field(None, description="药物名称")
    concentration: Optional[str] = Field(None, description="浓度")
    infusion_rate: Optional[float] = Field(None, description="输注速率")
    volume_infused: Optional[float] = Field(None, description="已输注体积")
    volume_remaining: Optional[float] = Field(None, description="剩余体积")
    is_interrupted: bool = Field(default=False, description="是否中断")
    interruption_reason: Optional[str] = Field(None, description="中断原因")
    interruption_start_time: Optional[datetime] = Field(None, description="中断开始时间")
    interruption_end_time: Optional[datetime] = Field(None, description="中断结束时间")
    pump_status: Optional[str] = Field(None, description="泵状态")
    alarms: Optional[str] = Field(None, description="警报信息")

class InfusionPumpLogCreate(InfusionPumpLogBase):
    pass

class InfusionPumpLogResponse(InfusionPumpLogBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class CageSensorBase(BaseModel):
    patient_id: str = Field(..., description="患者ID")
    cage_number: Optional[str] = Field(None, description="笼位号")
    reading_time: datetime = Field(..., description="读取时间")
    temperature: Optional[float] = Field(None, description="温度")
    temperature_min: float = Field(default=36.0, description="温度下限")
    temperature_max: float = Field(default=39.0, description="温度上限")
    oxygen_level: Optional[float] = Field(None, description="氧含量")
    oxygen_min: float = Field(default=90.0, description="氧含量下限")
    oxygen_max: float = Field(default=100.0, description="氧含量上限")
    humidity: Optional[float] = Field(None, description="湿度")

class CageSensorCreate(CageSensorBase):
    pass

class CageSensorResponse(CageSensorBase):
    id: int
    is_temperature_abnormal: bool
    is_oxygen_abnormal: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class MedicationPlanBase(BaseModel):
    patient_id: str = Field(..., description="患者ID")
    drug_name: str = Field(..., description="药物名称")
    generic_name: Optional[str] = Field(None, description="通用名")
    dosage: Optional[str] = Field(None, description="剂量")
    dosage_value: Optional[float] = Field(None, description="剂量值")
    dosage_unit: Optional[str] = Field(None, description="剂量单位")
    route: Optional[str] = Field(None, description="给药途径")
    frequency: Optional[str] = Field(None, description="给药频率")
    start_time: Optional[datetime] = Field(None, description="开始时间")
    end_time: Optional[datetime] = Field(None, description="结束时间")
    prescribing_vet: Optional[str] = Field(None, description="开处方兽医")
    notes: Optional[str] = Field(None, description="备注")

class MedicationPlanCreate(MedicationPlanBase):
    pass

class MedicationPlanResponse(MedicationPlanBase):
    id: int
    is_conflict: bool
    conflict_drugs: Optional[str]
    conflict_notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class HandoffRecordBase(BaseModel):
    patient_id: str = Field(..., description="患者ID")
    patient_name: Optional[str] = Field(None, description="患者名称")
    species: Optional[str] = Field(None, description="物种")
    breed: Optional[str] = Field(None, description="品种")
    shift_date: datetime = Field(..., description="交接日期")
    nurse_name: Optional[str] = Field(None, description="护士姓名")
    nurse_review_notes: Optional[str] = Field(None, description="护士复核备注")

class HandoffRecordCreate(HandoffRecordBase):
    pass

class HandoffRecordResponse(BaseModel):
    id: int
    handoff_id: str
    patient_id: str
    patient_name: Optional[str]
    species: Optional[str]
    breed: Optional[str]
    shift_date: datetime
    nurse_name: Optional[str]
    status: PatientStatus
    final_status: Optional[PatientStatus]
    has_awakening_timeout: bool
    has_infusion_interruption: bool
    has_temp_oxygen_abnormal: bool
    has_medication_conflict: bool
    abnormal_details: Optional[str]
    nurse_review_notes: Optional[str]
    is_reviewed: bool
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class StatusChangeRequest(BaseModel):
    new_status: PatientStatus = Field(..., description="新状态")
    review_notes: Optional[str] = Field(None, description="复核备注")
    reviewed_by: Optional[str] = Field(None, description="复核人")

class ImportResult(BaseModel):
    success: bool
    total_records: int
    imported_records: int
    failed_records: int
    errors: List[str] = []
    warnings: List[str] = []

class PatientSummary(BaseModel):
    patient_id: str
    patient_name: Optional[str]
    species: Optional[str]
    breed: Optional[str]
    
    anesthesia_status: Optional[str]
    awakening_timeout: bool
    
    infusion_status: Optional[str]
    has_infusion_interruption: bool
    
    temperature_status: Optional[str]
    oxygen_status: Optional[str]
    
    medication_count: int
    has_medication_conflict: bool
    
    overall_status: PatientStatus
    handoff_id: Optional[str]

class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None
    errors: List[str] = []
