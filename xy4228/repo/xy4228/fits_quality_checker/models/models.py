"""数据模型定义。"""

from enum import Enum
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class FileStatus(str, Enum):
    """文件质量状态枚举。"""
    KEEP = "keep"
    ISOLATE = "isolate"
    RETRY = "retry"
    UNKNOWN = "unknown"


class FileType(str, Enum):
    """文件类型枚举。"""
    LIGHT = "light"
    DARK = "dark"
    FLAT = "flat"
    BIAS = "bias"


class ObservationConfig(BaseModel):
    """观测配置模型。"""
    config_name: str = Field(..., description="配置名称")
    observer: Optional[str] = Field(None, description="观测者姓名")
    telescope: Optional[str] = Field(None, description="望远镜型号")
    camera: Optional[str] = Field(None, description="相机型号")
    focal_length: Optional[float] = Field(None, description="焦距(mm)")
    aperture: Optional[float] = Field(None, description="光圈(mm)")
    pixel_size: Optional[float] = Field(None, description="像素大小(um)")
    target_name: Optional[str] = Field(None, description="目标名称")
    target_ra: Optional[str] = Field(None, description="目标赤经")
    target_dec: Optional[str] = Field(None, description="目标赤纬")
    expected_exposures: Optional[Dict[str, int]] = Field(
        default_factory=dict, 
        description="期望曝光次数: {滤镜: 次数}"
    )
    expected_temperature: Optional[float] = Field(None, description="期望温度(°C)")
    temperature_tolerance: float = Field(default=0.5, description="温度容差(°C)")
    fwhm_threshold: float = Field(default=3.0, description="FWHM阈值(像素)")
    roundness_threshold: float = Field(default=0.8, description="圆度阈值(0-1)")
    noise_threshold: float = Field(default=10.0, description="背景噪声阈值(ADU)")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")

    class Config:
        json_schema_extra = {
            "example": {
                "config_name": "M42_20240503",
                "observer": "天文爱好者",
                "telescope": "Celestron 8SE",
                "camera": "ZWO ASI2600MC-Pro",
                "focal_length": 2000.0,
                "aperture": 203.0,
                "pixel_size": 3.76,
                "target_name": "M42 猎户座大星云",
                "expected_exposures": {"L": 20, "R": 10, "G": 10, "B": 10},
                "expected_temperature": -10.0,
                "temperature_tolerance": 0.5,
                "fwhm_threshold": 3.0,
                "roundness_threshold": 0.8,
                "noise_threshold": 10.0,
            }
        }


class FITSMetadata(BaseModel):
    """FITS文件元数据模型。"""
    file_path: str = Field(..., description="文件路径")
    file_name: str = Field(..., description="文件名")
    file_type: FileType = Field(..., description="文件类型")
    exposure_time: Optional[float] = Field(None, description="曝光时间(秒)")
    filter_name: Optional[str] = Field(None, description="滤镜名称")
    temperature: Optional[float] = Field(None, description="相机温度(°C)")
    gain: Optional[float] = Field(None, description="增益")
    offset: Optional[float] = Field(None, description="偏移")
    ra: Optional[str] = Field(None, description="赤经")
    dec: Optional[str] = Field(None, description="赤纬")
    airmass: Optional[float] = Field(None, description="大气质量")
    observation_time: Optional[datetime] = Field(None, description="观测时间")
    object_name: Optional[str] = Field(None, description="目标名称")
    x_pixel_size: Optional[float] = Field(None, description="X像素大小(um)")
    y_pixel_size: Optional[float] = Field(None, description="Y像素大小(um)")
    x_bin: Optional[int] = Field(None, description="X binning")
    y_bin: Optional[int] = Field(None, description="Y binning")
    header: Dict[str, Any] = Field(default_factory=dict, description="原始头信息")
    import_time: datetime = Field(default_factory=datetime.now, description="导入时间")

    class Config:
        json_schema_extra = {
            "example": {
                "file_path": "/data/light_001.fits",
                "file_name": "light_001.fits",
                "file_type": "light",
                "exposure_time": 300.0,
                "filter_name": "L",
                "temperature": -10.0,
                "gain": 100.0,
                "observation_time": "2024-05-03T02:30:00",
                "x_pixel_size": 3.76,
                "y_pixel_size": 3.76,
            }
        }


class ImageQualityMetrics(BaseModel):
    """图像质量指标模型。"""
    file_path: str = Field(..., description="文件路径")
    fwhm: Optional[float] = Field(None, description="半高全宽(像素)")
    fwhm_arcsec: Optional[float] = Field(None, description="半高全宽(角秒)")
    roundness: Optional[float] = Field(None, description="圆度(0-1)")
    background_noise: Optional[float] = Field(None, description="背景噪声(ADU)")
    star_count: Optional[int] = Field(None, description="检测到的星点数量")
    median_flux: Optional[float] = Field(None, description="中位流量")
    temperature_deviation: Optional[float] = Field(None, description="温度偏差(°C)")
    calculated_at: datetime = Field(default_factory=datetime.now, description="计算时间")

    class Config:
        json_schema_extra = {
            "example": {
                "file_path": "/data/light_001.fits",
                "fwhm": 2.5,
                "fwhm_arcsec": 1.2,
                "roundness": 0.92,
                "background_noise": 8.5,
                "star_count": 150,
                "temperature_deviation": 0.2,
            }
        }


class RuleResult(BaseModel):
    """规则检查结果模型。"""
    rule_name: str = Field(..., description="规则名称")
    rule_type: str = Field(..., description="规则类型")
    passed: bool = Field(..., description="是否通过")
    message: str = Field(..., description="结果消息")
    severity: str = Field(default="warning", description="严重程度: info/warning/error")
    details: Dict[str, Any] = Field(default_factory=dict, description="详细信息")

    class Config:
        json_schema_extra = {
            "example": {
                "rule_name": "TemperatureCheck",
                "rule_type": "temperature",
                "passed": True,
                "message": "温度在容差范围内",
                "severity": "info",
                "details": {"actual_temp": -10.0, "expected_temp": -10.0, "tolerance": 0.5},
            }
        }


class QualityResult(BaseModel):
    """质量评估结果模型。"""
    file_path: str = Field(..., description="文件路径")
    file_name: str = Field(..., description="文件名")
    file_type: FileType = Field(..., description="文件类型")
    status: FileStatus = Field(default=FileStatus.UNKNOWN, description="质量状态")
    overall_score: Optional[float] = Field(None, description="综合评分(0-100)")
    metrics: Optional[ImageQualityMetrics] = Field(None, description="质量指标")
    rule_results: List[RuleResult] = Field(default_factory=list, description="规则检查结果")
    issues: List[str] = Field(default_factory=list, description="问题列表")
    recommendations: List[str] = Field(default_factory=list, description="建议列表")
    metadata: Optional[FITSMetadata] = Field(None, description="原始元数据")
    evaluated_at: datetime = Field(default_factory=datetime.now, description="评估时间")

    class Config:
        json_schema_extra = {
            "example": {
                "file_path": "/data/light_001.fits",
                "file_name": "light_001.fits",
                "file_type": "light",
                "status": "keep",
                "overall_score": 85.5,
                "issues": [],
                "recommendations": ["可以用于叠加"],
            }
        }


class AnalysisResult(BaseModel):
    """分析结果汇总模型。"""
    config_name: str = Field(..., description="配置名称")
    total_files: int = Field(default=0, description="总文件数")
    light_files: int = Field(default=0, description="光场文件数")
    dark_files: int = Field(default=0, description="暗场文件数")
    flat_files: int = Field(default=0, description="平场文件数")
    keep_count: int = Field(default=0, description="保留文件数")
    isolate_count: int = Field(default=0, description="隔离文件数")
    retry_count: int = Field(default=0, description="重拍文件数")
    unknown_count: int = Field(default=0, description="未知状态文件数")
    results: List[QualityResult] = Field(default_factory=list, description="各文件质量结果")
    summary: Dict[str, Any] = Field(default_factory=dict, description="汇总信息")
    generated_at: datetime = Field(default_factory=datetime.now, description="生成时间")

    class Config:
        json_schema_extra = {
            "example": {
                "config_name": "M42_20240503",
                "total_files": 50,
                "light_files": 40,
                "dark_files": 10,
                "keep_count": 45,
                "isolate_count": 3,
                "retry_count": 2,
                "summary": {
                    "avg_fwhm": 2.3,
                    "avg_roundness": 0.91,
                    "avg_noise": 7.8,
                },
            }
        }
