from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator
import numpy as np


class TimeUnit(str, Enum):
    SECOND = "s"
    MINUTE = "min"
    HOUR = "h"
    DAY = "day"


class LengthUnit(str, Enum):
    MILLIMETER = "mm"
    CENTIMETER = "cm"
    METER = "m"


class AreaUnit(str, Enum):
    SQUARE_METER = "m2"
    HECTARE = "ha"
    SQUARE_KILOMETER = "km2"


class InfiltrationModel(str, Enum):
    HORTON = "horton"
    GREEN_AMPT = "green-ampt"
    PHILIP = "philip"
    SCS = "scs"


class WarningLevel(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class WarningType(str, Enum):
    CAPACITY_INSUFFICIENT = "capacity_insufficient"
    DRAIN_TIMEOUT = "drain_timeout"
    SOIL_PARAMS_UNRELIABLE = "soil_params_unreliable"
    RUNOFF_COEFFICIENT_CONFLICT = "runoff_coefficient_conflict"
    UNIT_MISMATCH = "unit_mismatch"
    MISSING_DATA = "missing_data"
    OUTLIER = "outlier"
    TIMESTEP_INCONSISTENT = "timestep_inconsistent"
    OVERFLOW_RISK = "overflow_risk"


class UnitConversion:
    LENGTH_FACTORS = {
        LengthUnit.MILLIMETER: {
            LengthUnit.MILLIMETER: 1.0,
            LengthUnit.CENTIMETER: 0.1,
            LengthUnit.METER: 0.001,
        },
        LengthUnit.CENTIMETER: {
            LengthUnit.MILLIMETER: 10.0,
            LengthUnit.CENTIMETER: 1.0,
            LengthUnit.METER: 0.01,
        },
        LengthUnit.METER: {
            LengthUnit.MILLIMETER: 1000.0,
            LengthUnit.CENTIMETER: 100.0,
            LengthUnit.METER: 1.0,
        },
    }

    AREA_FACTORS = {
        AreaUnit.SQUARE_METER: {
            AreaUnit.SQUARE_METER: 1.0,
            AreaUnit.HECTARE: 0.0001,
            AreaUnit.SQUARE_KILOMETER: 1e-6,
        },
        AreaUnit.HECTARE: {
            AreaUnit.SQUARE_METER: 10000.0,
            AreaUnit.HECTARE: 1.0,
            AreaUnit.SQUARE_KILOMETER: 0.01,
        },
        AreaUnit.SQUARE_KILOMETER: {
            AreaUnit.SQUARE_METER: 1e6,
            AreaUnit.HECTARE: 100.0,
            AreaUnit.SQUARE_KILOMETER: 1.0,
        },
    }

    TIME_FACTORS = {
        TimeUnit.SECOND: {
            TimeUnit.SECOND: 1.0,
            TimeUnit.MINUTE: 1/60,
            TimeUnit.HOUR: 1/3600,
            TimeUnit.DAY: 1/86400,
        },
        TimeUnit.MINUTE: {
            TimeUnit.SECOND: 60.0,
            TimeUnit.MINUTE: 1.0,
            TimeUnit.HOUR: 1/60,
            TimeUnit.DAY: 1/1440,
        },
        TimeUnit.HOUR: {
            TimeUnit.SECOND: 3600.0,
            TimeUnit.MINUTE: 60.0,
            TimeUnit.HOUR: 1.0,
            TimeUnit.DAY: 1/24,
        },
        TimeUnit.DAY: {
            TimeUnit.SECOND: 86400.0,
            TimeUnit.MINUTE: 1440.0,
            TimeUnit.HOUR: 24.0,
            TimeUnit.DAY: 1.0,
        },
    }

    @classmethod
    def convert_length(cls, value: float, from_unit: LengthUnit, to_unit: LengthUnit) -> float:
        return value * cls.LENGTH_FACTORS[from_unit][to_unit]

    @classmethod
    def convert_area(cls, value: float, from_unit: AreaUnit, to_unit: AreaUnit) -> float:
        return value * cls.AREA_FACTORS[from_unit][to_unit]

    @classmethod
    def convert_time(cls, value: float, from_unit: TimeUnit, to_unit: TimeUnit) -> float:
        return value * cls.TIME_FACTORS[from_unit][to_unit]


class RainfallDataPoint(BaseModel):
    time: float
    intensity: float
    accumulated: Optional[float] = None


class RainfallSeries(BaseModel):
    name: str
    return_period: float
    time_unit: TimeUnit = TimeUnit.MINUTE
    intensity_unit: LengthUnit = LengthUnit.MILLIMETER
    data: List[RainfallDataPoint]
    total_rainfall: float = 0.0
    peak_intensity: float = 0.0
    duration: float = 0.0
    time_step: float = 0.0

    @validator("data")
    @classmethod
    def calculate_statistics(cls, v, values):
        if not v:
            return v
        sorted_data = sorted(v, key=lambda x: x.time)
        total = 0.0
        peak = 0.0
        for i, point in enumerate(sorted_data):
            if i == 0:
                point.accumulated = point.intensity
            else:
                point.accumulated = sorted_data[i-1].accumulated + point.intensity
            total = point.accumulated
            if point.intensity > peak:
                peak = point.intensity
        values["total_rainfall"] = total
        values["peak_intensity"] = peak
        if len(sorted_data) >= 2:
            values["duration"] = sorted_data[-1].time - sorted_data[0].time
            time_steps = [sorted_data[i].time - sorted_data[i-1].time for i in range(1, len(sorted_data))]
            values["time_step"] = np.mean(time_steps) if time_steps else 0
        return sorted_data


class SoilInfiltrationTest(BaseModel):
    test_id: str
    test_date: Optional[datetime] = None
    soil_type: str
    initial_moisture: float = Field(ge=0, le=1)
    saturated_moisture: float = Field(ge=0, le=1)
    saturated_hydraulic_conductivity: float
    conductivity_unit: LengthUnit = LengthUnit.MILLIMETER
    conductivity_time_unit: TimeUnit = TimeUnit.HOUR
    suction_head: Optional[float] = None
    suction_unit: LengthUnit = LengthUnit.CENTIMETER
    horton_f0: Optional[float] = None
    horton_fc: Optional[float] = None
    horton_k: Optional[float] = None
    sorptivity: Optional[float] = None

    def to_horton_params(self) -> Dict[str, float]:
        return {
            "f0": self.horton_f0 if self.horton_f0 else self.saturated_hydraulic_conductivity * 2,
            "fc": self.horton_fc if self.horton_fc else self.saturated_hydraulic_conductivity,
            "k": self.horton_k if self.horton_k else 0.5,
        }

    def to_green_ampt_params(self) -> Dict[str, float]:
        return {
            "Ks": self.saturated_hydraulic_conductivity,
            "theta_s": self.saturated_moisture,
            "theta_i": self.initial_moisture,
            "psi_f": self.suction_head if self.suction_head else 10.0,
        }

    def to_philip_params(self) -> Dict[str, float]:
        return {
            "S": self.sorptivity if self.sorptivity else 5.0,
            "A": self.saturated_hydraulic_conductivity / 2,
        }


class CatchmentArea(BaseModel):
    name: str
    area: float
    area_unit: AreaUnit = AreaUnit.SQUARE_METER
    runoff_coefficient: float = Field(ge=0, le=1)
    land_use_type: Optional[str] = None
    impervious_ratio: Optional[float] = Field(None, ge=0, le=1)

    @validator("runoff_coefficient")
    @classmethod
    def check_impervious_consistency(cls, v, values):
        if "impervious_ratio" in values and values["impervious_ratio"] is not None:
            expected_min = values["impervious_ratio"] * 0.6
            expected_max = values["impervious_ratio"] * 0.95
            if not (expected_min <= v <= expected_max):
                pass
        return v


class PondGeometry(BaseModel):
    name: str
    surface_area: float
    area_unit: AreaUnit = AreaUnit.SQUARE_METER
    depth: float
    depth_unit: LengthUnit = LengthUnit.METER
    storage_volume: Optional[float] = None
    underdrain_rate: Optional[float] = None
    underdrain_unit: LengthUnit = LengthUnit.MILLIMETER
    underdrain_time_unit: TimeUnit = TimeUnit.HOUR
    shape_type: str = "rectangular"
    bottom_area: Optional[float] = None
    side_slope: Optional[float] = None

    @validator("storage_volume", always=True)
    @classmethod
    def calculate_volume(cls, v, values):
        if v is not None:
            return v
        if values.get("side_slope") and values.get("bottom_area"):
            depth = UnitConversion.convert_length(
                values["depth"], values["depth_unit"], LengthUnit.METER
            )
            bottom_area = UnitConversion.convert_area(
                values["bottom_area"], values["area_unit"], AreaUnit.SQUARE_METER
            )
            side_slope = values["side_slope"]
            surface_area = bottom_area + 4 * side_slope * depth * depth + 4 * depth * (bottom_area ** 0.5)
            return (depth / 3) * (bottom_area + surface_area + (bottom_area * surface_area) ** 0.5)
        else:
            depth_m = UnitConversion.convert_length(
                values["depth"], values["depth_unit"], LengthUnit.METER
            )
            area_m2 = UnitConversion.convert_area(
                values["surface_area"], values["area_unit"], AreaUnit.SQUARE_METER
            )
            return area_m2 * depth_m


class ValidationWarning(BaseModel):
    level: WarningLevel
    warning_type: WarningType
    message: str
    field: Optional[str] = None
    value: Optional[Any] = None
    suggestion: Optional[str] = None


class SimulationConfig(BaseModel):
    infiltration_model: InfiltrationModel = InfiltrationModel.HORTON
    time_step: float = 5.0
    time_unit: TimeUnit = TimeUnit.MINUTE
    max_drain_hours: float = 72.0
    enable_underdrain: bool = True
    routing_method: str = "kinematic"


class SimulationTimeStep(BaseModel):
    time: float
    rainfall_intensity: float
    runoff_inflow: float
    infiltration_rate: float
    pond_level: float
    storage_volume: float
    overflow_rate: float
    underdrain_rate: float
    cumulative_infiltration: float
    cumulative_overflow: float


class SimulationResult(BaseModel):
    rainfall_name: str
    return_period: float
    config: SimulationConfig
    time_series: List[SimulationTimeStep]
    total_runoff_volume: float
    total_infiltration_volume: float
    total_overflow_volume: float
    peak_pond_level: float
    peak_storage: float
    drain_time_hours: float
    has_overflow: bool = False


class ProjectConfig(BaseModel):
    project_name: str
    project_id: str
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    description: Optional[str] = None
    version: str = "0.1.0"
    simulation_config: SimulationConfig = Field(default_factory=SimulationConfig)


class ComparisonResult(BaseModel):
    rainfall_a_name: str
    rainfall_a_return_period: float
    rainfall_b_name: str
    rainfall_b_return_period: float
    volume_difference: float
    peak_difference: float
    overflow_a: bool
    overflow_b: bool
    drain_time_a: float
    drain_time_b: float


class CheckReport(BaseModel):
    project_id: str
    checked_at: datetime = Field(default_factory=datetime.now)
    warnings: List[ValidationWarning] = Field(default_factory=list)
    has_critical: bool = False
    has_warnings: bool = False


class FullReport(BaseModel):
    project: ProjectConfig
    simulation_results: List[SimulationResult]
    check_report: CheckReport
    generated_at: datetime = Field(default_factory=datetime.now)
