from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class SensorRecordBase(BaseModel):
    sensor_no: str = Field(..., description="传感器编号")
    collision_time: datetime = Field(..., description="碰撞时间")
    car_mass_kg: float = Field(..., description="小车质量(kg)")
    velocity_ms: float = Field(..., description="碰撞速度(m/s)")
    friction_coeff: float = Field(..., description="摩擦系数")
    collision_efficiency: float = Field(..., description="碰撞效率系数")
    notes: Optional[str] = None


class SensorRecordCreate(SensorRecordBase):
    pass


class SensorRecord(SensorRecordBase):
    id: int
    raw_momentum: float = Field(..., description="原始动量(kg·m/s)")
    corrected_momentum: Optional[float] = Field(None, description="修正后动量")
    status: str = Field(..., description="状态: normal/pending_review/reviewed")
    has_manual_correction: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ManualCorrectionBase(BaseModel):
    record_id: int
    field_name: str = Field(..., description="修改的字段名")
    old_value: float
    new_value: float
    operator: str
    reason: Optional[str] = None


class ManualCorrectionCreate(ManualCorrectionBase):
    pass


class ManualCorrection(ManualCorrectionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class WorkPhotoBase(BaseModel):
    record_id: int
    photo_filename: str = Field(..., description="照片文件名")
    note: Optional[str] = Field(None, description="照片备注")
    extracted_friction_coeff: Optional[float] = Field(None, description="从照片提取的摩擦系数(旧口径)")
    uploader: str


class WorkPhotoCreate(WorkPhotoBase):
    pass


class WorkPhoto(WorkPhotoBase):
    id: int
    uploaded_at: datetime

    class Config:
        from_attributes = True


class PlaybackRunBase(BaseModel):
    record_id: int
    parameters_used: Dict[str, Any] = Field(..., description="本次回放使用的参数")
    source: str = Field(..., description="数据来源: original/manual_correction/photo_supplement")
    run_by: str


class PlaybackRunCreate(PlaybackRunBase):
    pass


class PlaybackRun(PlaybackRunBase):
    id: int
    result_momentum: float = Field(..., description="计算得到的动量")
    result_energy_loss: float = Field(..., description="能量损失")
    run_time: datetime

    class Config:
        from_attributes = True


class SensorRecordDetail(SensorRecord):
    corrections: List[ManualCorrection] = []
    photos: List[WorkPhoto] = []
    playbacks: List[PlaybackRun] = []


class RecordImportResult(BaseModel):
    record_id: int
    sensor_no: str
    status: str
    has_pending_correction: bool
    message: str
