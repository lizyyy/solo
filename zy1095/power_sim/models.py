from datetime import time
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator
from enum import Enum


class BatteryChemistry(str, Enum):
    LITHIUM = "lithium"
    LEAD_ACID = "lead_acid"
    LIFEPO4 = "lifepo4"


class DeviceType(str, Enum):
    DC = "dc"
    AC = "ac"


class LoadPriority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class WeatherCondition(str, Enum):
    SUNNY = "sunny"
    PARTLY_CLOUDY = "partly_cloudy"
    CLOUDY = "cloudy"
    RAINY = "rainy"


class BatterySpec(BaseModel):
    name: str = Field(..., description="电池名称")
    capacity_ah: float = Field(..., gt=0, description="电池容量 (Ah)")
    voltage: float = Field(..., gt=0, description="电池电压 (V)")
    chemistry: BatteryChemistry = Field(default=BatteryChemistry.LIFEPO4, description="电池化学类型")
    min_soc_percent: float = Field(default=20.0, ge=0, le=100, description="最低允许 SOC (%)")
    max_soc_percent: float = Field(default=100.0, ge=0, le=100, description="最高允许 SOC (%)")
    initial_soc_percent: float = Field(default=100.0, ge=0, le=100, description="初始 SOC (%)")
    inverter_max_power_w: float = Field(default=2000.0, gt=0, description="逆变器最大功率 (W)")
    inverter_efficiency_percent: float = Field(default=85.0, ge=0, le=100, description="逆变器效率 (%)")
    charge_efficiency_percent: float = Field(default=90.0, ge=0, le=100, description="充电效率 (%)")

    @property
    def capacity_wh(self) -> float:
        return self.capacity_ah * self.voltage

    @property
    def usable_capacity_wh(self) -> float:
        usable_range = self.max_soc_percent - self.min_soc_percent
        return self.capacity_wh * (usable_range / 100.0)

    @validator("initial_soc_percent")
    def check_initial_soc(cls, v, values):
        if v < values.get("min_soc_percent", 0):
            raise ValueError(f"初始 SOC ({v}%) 不能低于最低 SOC ({values.get('min_soc_percent')}%)")
        if v > values.get("max_soc_percent", 100):
            raise ValueError(f"初始 SOC ({v}%) 不能高于最高 SOC ({values.get('max_soc_percent')}%)")
        return v


class Load(BaseModel):
    name: str = Field(..., description="设备名称")
    device_type: DeviceType = Field(default=DeviceType.DC, description="设备类型 (DC/AC)")
    power_w: Optional[float] = Field(None, gt=0, description="功率 (W)")
    current_a: Optional[float] = Field(None, gt=0, description="电流 (A)")
    voltage: Optional[float] = Field(None, gt=0, description="电压 (V)")
    priority: LoadPriority = Field(default=LoadPriority.MEDIUM, description="负载优先级")
    start_time: time = Field(..., description="开始时间")
    end_time: time = Field(..., description="结束时间")
    duty_cycle_percent: float = Field(default=100.0, ge=0, le=100, description="占空比 (%)，用于间歇性工作的设备如冰箱")

    @validator("end_time")
    def check_time_order(cls, v, values):
        if "start_time" in values and v <= values["start_time"]:
            raise ValueError(f"结束时间 ({v}) 必须晚于开始时间 ({values['start_time']})")
        return v

    @property
    def actual_power_w(self) -> float:
        if self.power_w is not None:
            return self.power_w
        if self.current_a is not None and self.voltage is not None:
            return self.current_a * self.voltage
        raise ValueError(f"设备 '{self.name}' 缺少功率或电流电压参数")

    def get_effective_power(self, battery_voltage: float, inverter_efficiency: float) -> float:
        power = self.actual_power_w
        if self.duty_cycle_percent < 100:
            power = power * (self.duty_cycle_percent / 100.0)
        if self.device_type == DeviceType.AC:
            efficiency_factor = inverter_efficiency / 100.0
            power = power / efficiency_factor
        return power


class SolarPanel(BaseModel):
    name: str = Field(..., description="太阳能板名称")
    max_power_w: float = Field(..., gt=0, description="最大功率 (W)")
    efficiency_percent: float = Field(default=100.0, ge=0, le=100, description="太阳能板效率 (%)")
    start_time: time = Field(..., description="开始发电时间")
    end_time: time = Field(..., description="结束发电时间")
    power_profile: Dict[int, float] = Field(
        default_factory=dict,
        description="每小时发电比例，键为小时(0-23)，值为占最大功率的比例(0-1)"
    )

    @validator("end_time")
    def check_time_order(cls, v, values):
        if "start_time" in values and v <= values["start_time"]:
            raise ValueError(f"结束发电时间 ({v}) 必须晚于开始发电时间 ({values['start_time']})")
        return v

    def get_hourly_output(self, hour: int, weather_factor: float) -> float:
        if self.start_time.hour <= hour < self.end_time.hour:
            profile_factor = self.power_profile.get(hour, 1.0)
            return self.max_power_w * profile_factor * (self.efficiency_percent / 100.0) * weather_factor
        return 0.0


class WeatherProfile(BaseModel):
    condition: WeatherCondition = Field(default=WeatherCondition.SUNNY, description="天气状况")
    factor_percent: float = Field(default=100.0, ge=0, le=100, description="天气折减系数 (%)")


WEATHER_FACTORS = {
    WeatherCondition.SUNNY: 100.0,
    WeatherCondition.PARTLY_CLOUDY: 70.0,
    WeatherCondition.CLOUDY: 40.0,
    WeatherCondition.RAINY: 15.0,
}


class Plan(BaseModel):
    name: str = Field(..., description="方案名称")
    description: Optional[str] = Field(None, description="方案描述")
    weather: WeatherProfile = Field(default_factory=WeatherProfile, description="天气配置")
    simulation_start_hour: int = Field(default=0, ge=0, le=23, description="模拟开始小时")
    simulation_duration_hours: int = Field(default=24, gt=0, description="模拟持续小时数")


class SimulationResult(BaseModel):
    plan_name: str
    battery_name: str
    timestamp: str
    hourly_data: List[Dict[str, Any]]
    initial_soc_percent: float
    final_soc_percent: float
    min_soc_percent: float
    max_soc_percent: float
    total_consumption_wh: float
    total_solar_generation_wh: float
    blackout_hour: Optional[int]
    risks: List[Dict[str, Any]]
    recommendations: List[str]


class HourlyData(BaseModel):
    hour: int
    soc_percent: float
    battery_voltage: float
    total_load_w: float
    solar_input_w: float
    net_power_w: float
    energy_change_wh: float
    dc_loads: List[str]
    ac_loads: List[str]
