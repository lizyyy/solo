from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field, validator


class CocoonGrade(str, Enum):
    """蚕茧等级"""
    GRADE_1A = "1A"
    GRADE_2A = "2A"
    GRADE_3A = "3A"
    GRADE_4A = "4A"
    GRADE_5A = "5A"
    GRADE_6A = "6A"
    GRADE_A = "A"
    GRADE_B = "B"
    GRADE_C = "C"
    GRADE_D = "D"


class DeliveryGrade(str, Enum):
    """交货等级"""
    SUPERIOR = "特级"
    GRADE_1 = "一级"
    GRADE_2 = "二级"
    GRADE_3 = "三级"
    OUTSIDE = "等外品"


class BreakageSeverity(str, Enum):
    """断头严重程度"""
    LOW = "低"
    MEDIUM = "中"
    HIGH = "高"


class CocoonBatch(BaseModel):
    """蚕茧批次模型"""
    batch_id: str = Field(..., description="批次编号")
    source: str = Field(..., description="来源产地")
    purchase_date: datetime = Field(..., description="收购日期")
    total_weight_kg: float = Field(..., gt=0, description="总重量(kg)")
    grade: CocoonGrade = Field(..., description="蚕茧等级")
    supplier: Optional[str] = Field(None, description="供应商")
    notes: Optional[str] = Field(None, description="备注")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")
        }


class MoistureInspection(BaseModel):
    """含水率抽检模型"""
    inspection_id: str = Field(..., description="抽检编号")
    batch_id: str = Field(..., description="关联批次编号")
    inspection_date: datetime = Field(..., description="抽检日期")
    sample_weight_g: float = Field(..., gt=0, description="样品重量(g)")
    dry_weight_g: float = Field(..., gt=0, description="烘干后重量(g)")
    moisture_content: Optional[float] = Field(None, description="含水率(%)")
    inspector: Optional[str] = Field(None, description="抽检人")
    notes: Optional[str] = Field(None, description="备注")
    
    @validator('moisture_content', pre=True, always=True)
    def calculate_moisture(cls, v, values):
        """自动计算含水率"""
        if v is not None:
            return v
        sample_weight = values.get('sample_weight_g')
        dry_weight = values.get('dry_weight_g')
        if sample_weight and dry_weight and sample_weight > dry_weight:
            return ((sample_weight - dry_weight) / sample_weight) * 100
        return None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")
        }


class TemperaturePoint(BaseModel):
    """温度曲线点模型"""
    time_min: float = Field(..., ge=0, description="时间(分钟)")
    temperature: float = Field(..., description="温度(℃)")


class CookingCurve(BaseModel):
    """煮茧温度曲线模型"""
    curve_id: str = Field(..., description="曲线编号")
    batch_id: str = Field(..., description="关联批次编号")
    cooking_date: datetime = Field(..., description="煮茧日期")
    curve_name: str = Field(..., description="曲线名称")
    temperature_points: List[TemperaturePoint] = Field(..., description="温度点列表")
    total_cooking_time_min: Optional[float] = Field(None, description="总煮茧时间(分钟)")
    max_temperature: Optional[float] = Field(None, description="最高温度(℃)")
    operator: Optional[str] = Field(None, description="操作人")
    notes: Optional[str] = Field(None, description="备注")
    
    @validator('total_cooking_time_min', pre=True, always=True)
    def calculate_total_time(cls, v, values):
        """自动计算总煮茧时间"""
        if v is not None:
            return v
        points = values.get('temperature_points')
        if points:
            return max(p.time_min for p in points)
        return None
    
    @validator('max_temperature', pre=True, always=True)
    def calculate_max_temp(cls, v, values):
        """自动计算最高温度"""
        if v is not None:
            return v
        points = values.get('temperature_points')
        if points:
            return max(p.temperature for p in points)
        return None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")
        }


class BreakageRecord(BaseModel):
    """缫丝断头记录模型"""
    record_id: str = Field(..., description="记录编号")
    batch_id: str = Field(..., description="关联批次编号")
    record_date: datetime = Field(..., description="记录日期")
    machine_id: str = Field(..., description="机器编号")
    spindle_count: int = Field(..., gt=0, description="锭数")
    breakage_count: int = Field(..., ge=0, description="断头次数")
    operating_hours: float = Field(..., gt=0, description="运行时间(小时)")
    breakage_per_hour: Optional[float] = Field(None, description="每小时断头数")
    severity: BreakageSeverity = Field(default=BreakageSeverity.MEDIUM, description="严重程度")
    operator: Optional[str] = Field(None, description="记录人")
    notes: Optional[str] = Field(None, description="备注")
    
    @validator('breakage_per_hour', always=True)
    def calculate_breakage_rate(cls, v, values):
        """自动计算每小时断头数"""
        if v is not None:
            return v
        breakage_count = values.get('breakage_count')
        operating_hours = values.get('operating_hours')
        if breakage_count is not None and operating_hours and operating_hours > 0:
            return breakage_count / operating_hours
        return None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")
        }


class DeliveryRecord(BaseModel):
    """交货记录模型"""
    delivery_id: str = Field(..., description="交货编号")
    batch_id: str = Field(..., description="关联批次编号")
    delivery_date: datetime = Field(..., description="交货日期")
    silk_weight_kg: float = Field(..., gt=0, description="丝重量(kg)")
    grade: DeliveryGrade = Field(..., description="交货等级")
    filature_rate: Optional[float] = Field(None, description="出丝率(%)")
    customer: Optional[str] = Field(None, description="客户")
    inspector: Optional[str] = Field(None, description="检验人")
    notes: Optional[str] = Field(None, description="备注")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")
        }


class ProcessCalculation(BaseModel):
    """工艺计算结果模型"""
    calculation_id: str = Field(..., description="计算编号")
    batch_id: str = Field(..., description="关联批次编号")
    calculation_date: datetime = Field(default_factory=datetime.now)
    
    # 补水计算
    target_moisture: float = Field(..., description="目标含水率(%)")
    current_moisture: float = Field(..., description="当前含水率(%)")
    water_supplement_kg: float = Field(..., description="需补水量(kg)")
    
    # 煮茧参数建议
    recommended_cooking_temp: float = Field(..., description="建议煮茧温度(℃)")
    recommended_cooking_time_min: float = Field(..., description="建议煮茧时间(分钟)")
    soaking_time_min: Optional[float] = Field(None, description="建议浸泡时间(分钟)")
    steam_pressure: Optional[float] = Field(None, description="建议蒸汽压力(MPa)")
    
    # 出丝率预估
    estimated_filature_rate: float = Field(..., description="预估出丝率(%)")
    estimated_silk_output_kg: float = Field(..., description="预估产丝量(kg)")
    
    # 断头风险评估
    breakage_risk_level: str = Field(..., description="断头风险等级")
    estimated_breakage_per_hour: float = Field(..., description="预估每小时断头数")
    risk_factors: List[str] = Field(default_factory=list, description="风险因素")
    
    # 人工复核
    reviewer_notes: Optional[str] = Field(None, description="复核备注")
    reviewed_by: Optional[str] = Field(None, description="复核人")
    reviewed_at: Optional[datetime] = Field(None, description="复核时间")
    
    # 异常数据
    anomalies: List[Dict[str, Any]] = Field(default_factory=list, description="异常数据列表")
    warnings: List[str] = Field(default_factory=list, description="警告信息列表")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")
        }


class BatchProcessData(BaseModel):
    """批次工艺数据汇总模型"""
    batch: CocoonBatch
    moisture_inspections: List[MoistureInspection] = Field(default_factory=list)
    cooking_curves: List[CookingCurve] = Field(default_factory=list)
    breakage_records: List[BreakageRecord] = Field(default_factory=list)
    delivery_records: List[DeliveryRecord] = Field(default_factory=list)
    calculations: List[ProcessCalculation] = Field(default_factory=list)
