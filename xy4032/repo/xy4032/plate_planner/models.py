"""
数据模型模块 - 样品、稀释步骤、孔位、方案等数据模型
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator


class SampleStatus(str, Enum):
    AVAILABLE = "available"
    USED = "used"
    DEPLETED = "depleted"


class Sample(BaseModel):
    sample_id: str = Field(..., description="样品编号")
    batch: str = Field(..., description="批次")
    initial_concentration: float = Field(..., gt=0, description="初始浓度")
    concentration_unit: str = Field(..., description="浓度单位")
    available_volume: float = Field(..., gt=0, description="可用体积 (ul)")
    target_concentration: float = Field(..., gt=0, description="目标浓度")
    target_concentration_unit: Optional[str] = Field(default=None, description="目标浓度单位")
    replicate_count: int = Field(default=1, ge=1, description="重复孔数")
    remark: Optional[str] = Field(default=None, description="备注")
    status: SampleStatus = Field(default=SampleStatus.AVAILABLE, description="状态")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: Optional[datetime] = Field(default=None)
    volume_unit: str = Field(default="ul", description="体积单位")
    molecular_weight: Optional[float] = Field(default=None, gt=0, description="分子量 (g/mol)")

    @validator("initial_concentration", "target_concentration")
    def check_positive(cls, v):
        if v <= 0:
            raise ValueError("浓度必须为正数")
        return v

    @validator("available_volume")
    def check_volume_positive(cls, v):
        if v <= 0:
            raise ValueError("体积必须为正数")
        return v

    @validator("replicate_count")
    def check_replicate_positive(cls, v):
        if v < 1:
            raise ValueError("重复孔数必须至少为1")
        return v

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }


class DilutionStep(BaseModel):
    step_number: int = Field(..., description="步骤编号")
    source_concentration: float = Field(..., description="来源浓度")
    target_concentration: float = Field(..., description="目标浓度")
    dilution_factor: float = Field(..., description="稀释倍数")
    sample_volume_ul: float = Field(..., description="样品体积 (ul)")
    diluent_volume_ul: float = Field(..., description="稀释液体积 (ul)")
    total_volume_ul: float = Field(..., description="最终体积 (ul)")
    unit: str = Field(default="ng/ul", description="浓度单位")


class WellAssignment(BaseModel):
    sample_id: str = Field(..., description="样品编号")
    well: str = Field(..., description="孔位 (如: A1, B12)")
    row: int = Field(..., description="行索引 (0-based)")
    col: int = Field(..., description="列索引 (0-based)")
    concentration: float = Field(..., description="工作浓度")
    concentration_unit: str = Field(..., description="浓度单位")
    volume_ul: float = Field(..., description="孔内体积 (ul)")
    replicate_index: Optional[int] = Field(default=None, description="重复孔序号")


class PlatePlan(BaseModel):
    plan_id: str = Field(..., description="方案ID")
    plate_number: int = Field(..., description="板号")
    created_at: datetime = Field(default_factory=datetime.now)
    samples: List[str] = Field(default_factory=list, description="包含的样品编号列表")
    dilution_steps: Dict[str, List[DilutionStep]] = Field(default_factory=dict, description="样品稀释步骤")
    well_assignments: List[WellAssignment] = Field(default_factory=list, description="孔位分配")
    reserved_wells: List[Dict[str, str]] = Field(default_factory=list, description="保留孔位")
    total_wells_used: int = Field(default=0, description="已使用孔数")
    total_wells_available: int = Field(default=96, description="总可用孔数")


class LedgerEntry(BaseModel):
    entry_id: str = Field(..., description="记录ID")
    timestamp: datetime = Field(default_factory=datetime.now)
    action: str = Field(..., description="操作类型")
    plate_number: Optional[int] = Field(default=None, description="板号")
    plan_id: Optional[str] = Field(default=None, description="方案ID")
    sample_changes: List[Dict[str, Any]] = Field(default_factory=list, description="样品变更记录")
    remarks: Optional[str] = Field(default=None, description="备注")


class Ledger(BaseModel):
    entries: List[LedgerEntry] = Field(default_factory=list)
    last_plate_number: int = Field(default=0)

    def get_next_plate_number(self) -> int:
        self.last_plate_number += 1
        return self.last_plate_number


class PlanHistory(BaseModel):
    plans: List[PlatePlan] = Field(default_factory=list)
