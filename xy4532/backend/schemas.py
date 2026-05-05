from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class RiskLevel(str, Enum):
    CRITICAL = "严重"
    HIGH = "高"
    MEDIUM = "中"
    LOW = "低"


class WorkOrderStatus(str, Enum):
    PENDING = "待处理"
    IN_PROGRESS = "处理中"
    COMPLETED = "已完成"


class WorkOrderPriority(str, Enum):
    EMERGENCY = "紧急"
    HIGH = "高"
    MEDIUM = "中"
    LOW = "低"


class AlarmSeverity(str, Enum):
    CRITICAL = "严重"
    HIGH = "高"
    MEDIUM = "中"
    LOW = "低"


# 风机相关Schema
class WindTurbineBase(BaseModel):
    turbine_id: str = Field(..., description="风机编号")
    name: Optional[str] = Field(None, description="风机名称")
    location: Optional[str] = Field(None, description="位置描述")
    latitude: Optional[float] = Field(None, description="纬度")
    longitude: Optional[float] = Field(None, description="经度")
    capacity: Optional[float] = Field(None, description="装机容量(MW)")
    installation_date: Optional[datetime] = Field(None, description="安装日期")


class WindTurbineCreate(WindTurbineBase):
    pass


class WindTurbineUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    capacity: Optional[float] = None
    status: Optional[str] = None


class WindTurbineResponse(WindTurbineBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# 叶片相关Schema
class BladeBase(BaseModel):
    blade_number: int = Field(..., ge=1, le=3, description="叶片编号(1-3)")
    length: Optional[float] = Field(None, description="叶片长度(米)")
    manufacturer: Optional[str] = Field(None, description="制造商")
    installation_date: Optional[datetime] = Field(None, description="安装日期")


class BladeCreate(BladeBase):
    turbine_id: int


class BladeResponse(BladeBase):
    id: int
    turbine_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# 巡检记录相关Schema
class InspectionRecordBase(BaseModel):
    inspection_date: datetime = Field(..., description="巡检日期")
    inspector: Optional[str] = Field(None, description="巡检人员")
    weather_conditions: Optional[str] = Field(None, description="天气状况")
    notes: Optional[str] = Field(None, description="备注")


class InspectionRecordCreate(InspectionRecordBase):
    turbine_id: int
    drone_track_file: Optional[str] = None


class InspectionRecordResponse(InspectionRecordBase):
    id: int
    turbine_id: int
    drone_track_file: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# 叶片照片相关Schema
class BladePhotoBase(BaseModel):
    segment: Optional[str] = Field(None, description="分段位置")
    distance_from_root: Optional[float] = Field(None, description="距离叶根距离(米)")


class BladePhotoCreate(BladePhotoBase):
    blade_id: int
    inspection_id: int
    file_path: str
    file_name: str


class BladePhotoResponse(BladePhotoBase):
    id: int
    blade_id: int
    inspection_id: int
    file_path: str
    file_name: str
    image_features: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# SCADA告警相关Schema
class SCADAAllarmBase(BaseModel):
    alarm_code: str = Field(..., description="告警代码")
    alarm_name: Optional[str] = Field(None, description="告警名称")
    alarm_type: Optional[str] = Field(None, description="告警类型")
    severity: AlarmSeverity = Field(default=AlarmSeverity.MEDIUM, description="严重程度")
    start_time: datetime = Field(..., description="开始时间")
    end_time: Optional[datetime] = Field(None, description="结束时间")
    is_active: bool = Field(default=True, description="是否活跃")
    description: Optional[str] = Field(None, description="描述")


class SCADAAllarmCreate(SCADAAllarmBase):
    turbine_id: int


class SCADAAllarmResponse(SCADAAllarmBase):
    id: int
    turbine_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# 维修工单相关Schema
class WorkOrderBase(BaseModel):
    work_order_id: str = Field(..., description="工单编号")
    issue_type: Optional[str] = Field(None, description="问题类型")
    description: Optional[str] = Field(None, description="描述")
    priority: WorkOrderPriority = Field(default=WorkOrderPriority.MEDIUM, description="优先级")
    status: WorkOrderStatus = Field(default=WorkOrderStatus.PENDING, description="状态")
    blade_number: Optional[int] = Field(None, description="叶片编号")
    scheduled_time: Optional[datetime] = Field(None, description="计划时间")
    assigned_to: Optional[str] = Field(None, description="指派给")
    resolution: Optional[str] = Field(None, description="解决方案")


class WorkOrderCreate(WorkOrderBase):
    turbine_id: int


class WorkOrderResponse(WorkOrderBase):
    id: int
    turbine_id: int
    created_time: datetime
    completed_time: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# 风险评估相关Schema
class RiskAssessmentBase(BaseModel):
    ai_risk_level: Optional[str] = Field(None, description="AI风险等级")
    ai_risk_score: float = Field(..., description="AI风险评分")
    ai_detection_type: Optional[str] = Field(None, description="AI检测类型")
    ai_confidence: Optional[float] = Field(None, description="AI置信度")
    ai_description: Optional[str] = Field(None, description="AI描述")


class RiskAssessmentCreate(RiskAssessmentBase):
    photo_id: int
    inspection_id: int
    related_alarm_id: Optional[int] = None
    related_work_order_id: Optional[int] = None


class RiskAssessmentResponse(RiskAssessmentBase):
    id: int
    photo_id: int
    inspection_id: int
    
    manual_risk_level: Optional[str]
    manual_override: bool
    manual_reason: Optional[str]
    manual_judge: Optional[str]
    manual_time: Optional[datetime]
    
    final_risk_level: Optional[str]
    final_risk_score: Optional[float]
    
    related_alarm_id: Optional[int]
    related_work_order_id: Optional[int]
    
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# 人工改判Schema
class ManualJudgmentRequest(BaseModel):
    assessment_id: int = Field(..., description="评估ID")
    manual_risk_level: RiskLevel = Field(..., description="人工判定风险等级")
    manual_reason: str = Field(..., description="改判原因")
    judge_name: Optional[str] = Field(None, description="判定人姓名")


# 导出相关Schema
class ExportRequest(BaseModel):
    turbine_ids: Optional[List[int]] = Field(None, description="风机ID列表")
    risk_levels: Optional[List[RiskLevel]] = Field(None, description="风险等级筛选")
    include_photos: bool = Field(default=False, description="是否包含照片信息")
    include_alarms: bool = Field(default=True, description="是否包含告警信息")
    include_work_orders: bool = Field(default=True, description="是否包含工单信息")


# 图像特征提取响应
class FeatureExtractionResponse(BaseModel):
    photo_id: int
    features: Dict[str, Any]
    feature_vector: List[float]
    image_size: tuple
    image_mode: str


# 缺陷检测响应
class DefectDetectionResponse(BaseModel):
    photo_id: int
    defects: List[Dict[str, Any]]


# 风险评估响应
class RiskCalculationResponse(BaseModel):
    photo_id: int
    risk_score: float
    risk_level: str
    base_score: float
    location_adjustment: float
    alarm_impact: float
    work_order_impact: float
    description: str
    recommendation: str


# 批量操作响应
class BatchOperationResponse(BaseModel):
    success: bool
    total: int
    processed: int
    failed: int
    errors: Optional[List[str]] = None


# 统计信息Schema
class DashboardStatistics(BaseModel):
    total_turbines: int
    total_blades: int
    total_inspections: int
    total_photos: int
    
    critical_risks: int
    high_risks: int
    medium_risks: int
    low_risks: int
    
    active_alarms: int
    pending_work_orders: int
    
    recent_inspections: List[Dict[str, Any]]
    high_risk_items: List[Dict[str, Any]]


# 响应包装器
class APIResponse(BaseModel):
    success: bool = True
    message: str = "操作成功"
    data: Optional[Any] = None
    errors: Optional[List[str]] = None
