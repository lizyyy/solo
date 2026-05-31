from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime


@dataclass
class CalibrationEntry:
    sample_id: str
    temperature_ref: float
    thermal_conductivity_ref: float
    unit: str = "°C"
    calibration_date: str = ""
    version: str = ""
    operator: str = ""


@dataclass
class ExperimentRecord:
    id: str
    sample_id: str
    timestamp: str
    temperature: float
    thermal_conductivity: float
    unit: str = "°C"
    source: str = "experiment"
    is_correction: bool = False
    is_late_attachment: bool = False
    corrected_record_id: Optional[str] = None
    operator: str = ""
    batch_id: str = ""
    notes: str = ""
    original_temperature: Optional[float] = None
    original_tc: Optional[float] = None


@dataclass
class DriftReport:
    sample_id: str
    drift_value: float
    source: str
    operator: str
    record_id: str = ""
    calibration_version: str = ""
    message: str = ""


@dataclass
class DataPackage:
    records: list = field(default_factory=list)
    calibrations: list = field(default_factory=list)
    package_name: str = ""
    import_time: str = ""
    errors: list = field(default_factory=list)
    warnings: list = field(default_factory=list)
    drifts: list = field(default_factory=list)
