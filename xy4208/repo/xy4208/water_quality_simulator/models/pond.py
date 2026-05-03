from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class PondConfig(BaseModel):
    pond_id: str = Field(..., description="池塘唯一标识")
    pond_name: str = Field(..., description="池塘名称")
    volume: float = Field(..., gt=0, description="池塘水体体积(立方米)")
    area: float = Field(..., gt=0, description="池塘水面面积(平方米)")
    depth: float = Field(..., gt=0, description="池塘平均水深(米)")
    species: str = Field(..., description="养殖品种")
    stage: str = Field(..., description="育苗阶段")
    stocking_density: float = Field(..., gt=0, description="放养密度(尾/立方米)")
    created_at: datetime = Field(default_factory=datetime.now)
    notes: Optional[str] = Field(None, description="备注信息")

    @field_validator("depth")
    @classmethod
    def validate_depth(cls, v: float, info: dict) -> float:
        if "volume" in info.data and "area" in info.data:
            expected_depth = info.data["volume"] / info.data["area"]
            if abs(v - expected_depth) > 0.1:
                raise ValueError(
                    f"水深 {v}m 与体积/面积计算值 {expected_depth:.2f}m 不一致"
                )
        return v


class PondState(BaseModel):
    pond_id: str = Field(..., description="池塘ID")
    timestamp: datetime = Field(default_factory=datetime.now)
    temperature: float = Field(..., ge=0, le=40, description="水温(℃)")
    ph: float = Field(..., ge=0, le=14, description="pH值")
    ammonia_nitrogen: float = Field(..., ge=0, description="氨氮(mg/L)")
    nitrite: float = Field(..., ge=0, description="亚硝酸盐(mg/L)")
    salinity: float = Field(..., ge=0, description="盐度(‰)")
    dissolved_oxygen: float = Field(..., ge=0, description="溶解氧(mg/L)")
    turbidity: Optional[float] = Field(None, ge=0, description="浊度(NTU)")
    alkalinity: Optional[float] = Field(None, ge=0, description="碱度(mg/L)")
    hardness: Optional[float] = Field(None, ge=0, description="硬度(mg/L)")

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "temperature": self.temperature,
            "ph": self.ph,
            "ammonia_nitrogen": self.ammonia_nitrogen,
            "nitrite": self.nitrite,
            "salinity": self.salinity,
            "dissolved_oxygen": self.dissolved_oxygen,
            "turbidity": self.turbidity,
            "alkalinity": self.alkalinity,
            "hardness": self.hardness,
        }
