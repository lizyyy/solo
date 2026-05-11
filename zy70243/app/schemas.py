from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models import (
    AnimalType, InfectionRisk, CageStatus, 
    HospitalizationStatus, OrderStatus
)


class PetBase(BaseModel):
    name: str = Field(..., description="宠物名称")
    species: AnimalType = Field(..., description="动物种类")
    breed: Optional[str] = Field(None, description="品种")
    age: Optional[int] = Field(None, description="年龄（月）")
    weight: Optional[float] = Field(None, description="体重（kg）")
    gender: Optional[str] = Field(None, description="性别")
    owner_name: Optional[str] = Field(None, description="主人姓名")
    owner_phone: Optional[str] = Field(None, description="主人电话")
    medical_history: Optional[str] = Field(None, description="病史")
    allergy_info: Optional[str] = Field(None, description="过敏信息")


class PetCreate(PetBase):
    pass


class PetUpdate(BaseModel):
    name: Optional[str] = None
    species: Optional[AnimalType] = None
    breed: Optional[str] = None
    age: Optional[int] = None
    weight: Optional[float] = None
    gender: Optional[str] = None
    owner_name: Optional[str] = None
    owner_phone: Optional[str] = None
    medical_history: Optional[str] = None
    allergy_info: Optional[str] = None


class Pet(PetBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class CageBase(BaseModel):
    cage_number: str = Field(..., description="笼位编号")
    location: Optional[str] = Field(None, description="位置")
    status: CageStatus = Field(CageStatus.AVAILABLE, description="笼位状态")
    suitable_species: Optional[str] = Field(None, description="适合的动物种类（逗号分隔）")
    is_isolation: bool = Field(False, description="是否隔离笼位")
    max_infection_risk: InfectionRisk = Field(InfectionRisk.LOW, description="最大允许传染风险")
    notes: Optional[str] = Field(None, description="备注")


class CageCreate(CageBase):
    pass


class CageUpdate(BaseModel):
    cage_number: Optional[str] = None
    location: Optional[str] = None
    status: Optional[CageStatus] = None
    suitable_species: Optional[str] = None
    is_isolation: Optional[bool] = None
    max_infection_risk: Optional[InfectionRisk] = None
    notes: Optional[str] = None


class Cage(CageBase):
    id: int
    current_pet_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class MedicalOrderBase(BaseModel):
    pet_id: int = Field(..., description="宠物ID")
    diagnosis: str = Field(..., description="诊断结果")
    treatment_plan: str = Field(..., description="治疗计划")
    infection_risk: InfectionRisk = Field(InfectionRisk.NONE, description="传染风险等级")
    required_special_care: Optional[str] = Field(None, description="特殊护理要求")
    estimated_stay_days: Optional[int] = Field(None, description="预计住院天数")
    attending_vet: Optional[str] = Field(None, description="主治医生")


class MedicalOrderCreate(MedicalOrderBase):
    pass


class MedicalOrderUpdate(BaseModel):
    diagnosis: Optional[str] = None
    treatment_plan: Optional[str] = None
    infection_risk: Optional[InfectionRisk] = None
    required_special_care: Optional[str] = None
    estimated_stay_days: Optional[int] = None
    attending_vet: Optional[str] = None
    status: Optional[OrderStatus] = None


class MedicalOrder(MedicalOrderBase):
    id: int
    order_number: str
    status: OrderStatus
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class HospitalizationBase(BaseModel):
    pet_id: int = Field(..., description="宠物ID")
    medical_order_id: int = Field(..., description="住院医嘱ID")
    cage_id: int = Field(..., description="笼位ID")
    notes: Optional[str] = Field(None, description="备注")


class HospitalizationCreate(HospitalizationBase):
    pass


class HospitalizationUpdate(BaseModel):
    status: Optional[HospitalizationStatus] = None
    notes: Optional[str] = None


class CageTransfer(BaseModel):
    new_cage_id: int = Field(..., description="新笼位ID")
    reason: str = Field(..., description="转笼原因")


class Hospitalization(HospitalizationBase):
    id: int
    hospitalization_number: str
    status: HospitalizationStatus
    admission_date: Optional[datetime]
    discharge_date: Optional[datetime]
    current_infection_risk: InfectionRisk
    transfer_history: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None


class SuccessResponse(BaseModel):
    message: str
    data: Optional[dict] = None


class DashboardStats(BaseModel):
    total_cages: int
    available_cages: int
    occupied_cages: int
    maintenance_cages: int
    total_hospitalized: int
    high_risk_patients: int
    pending_transfers: int


class DailyReport(BaseModel):
    date: date
    total_admissions: int
    total_discharges: int
    current_occupancy: float
    high_risk_count: int
    cage_usage_by_species: dict
