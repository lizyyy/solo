"""作物分区数据模型"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional
from datetime import time


@dataclass
class LightThreshold:
    min_dli: float
    max_dli: float
    target_dli: float
    spectrum_requirements: Dict[str, float] = field(default_factory=dict)
    
    def validate(self) -> List[str]:
        errors = []
        if self.min_dli < 0:
            errors.append("最小DLI不能为负值")
        if self.max_dli <= self.min_dli:
            errors.append("最大DLI必须大于最小DLI")
        if self.target_dli < self.min_dli or self.target_dli > self.max_dli:
            errors.append("目标DLI必须在最小和最大DLI之间")
        return errors


@dataclass
class CropZone:
    zone_id: str
    zone_name: str
    crop_type: str
    shelf_count: int
    shelf_height: float
    shelf_width: float
    led_spectrum_id: str
    sensor_id: str
    light_threshold: LightThreshold
    installed_power: float
    photoperiod_start: time
    photoperiod_end: time
    notes: str = ""
    custom_attributes: Dict[str, str] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "zone_id": self.zone_id,
            "zone_name": self.zone_name,
            "crop_type": self.crop_type,
            "shelf_count": self.shelf_count,
            "shelf_height": self.shelf_height,
            "shelf_width": self.shelf_width,
            "led_spectrum_id": self.led_spectrum_id,
            "sensor_id": self.sensor_id,
            "light_threshold": {
                "min_dli": self.light_threshold.min_dli,
                "max_dli": self.light_threshold.max_dli,
                "target_dli": self.light_threshold.target_dli,
                "spectrum_requirements": self.light_threshold.spectrum_requirements
            },
            "installed_power": self.installed_power,
            "photoperiod_start": self.photoperiod_start.strftime("%H:%M"),
            "photoperiod_end": self.photoperiod_end.strftime("%H:%M"),
            "notes": self.notes,
            "custom_attributes": self.custom_attributes
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "CropZone":
        threshold_data = data.get("light_threshold", {})
        return cls(
            zone_id=data["zone_id"],
            zone_name=data["zone_name"],
            crop_type=data["crop_type"],
            shelf_count=data["shelf_count"],
            shelf_height=data["shelf_height"],
            shelf_width=data["shelf_width"],
            led_spectrum_id=data["led_spectrum_id"],
            sensor_id=data["sensor_id"],
            light_threshold=LightThreshold(
                min_dli=threshold_data.get("min_dli", 0),
                max_dli=threshold_data.get("max_dli", 0),
                target_dli=threshold_data.get("target_dli", 0),
                spectrum_requirements=threshold_data.get("spectrum_requirements", {})
            ),
            installed_power=data["installed_power"],
            photoperiod_start=time.fromisoformat(data["photoperiod_start"]),
            photoperiod_end=time.fromisoformat(data["photoperiod_end"]),
            notes=data.get("notes", ""),
            custom_attributes=data.get("custom_attributes", {})
        )
    
    def validate(self) -> List[str]:
        errors = []
        if not self.zone_id or not self.zone_id.strip():
            errors.append("分区ID不能为空")
        if not self.zone_name or not self.zone_name.strip():
            errors.append("分区名称不能为空")
        if self.shelf_count <= 0:
            errors.append("货架数量必须大于0")
        if self.shelf_height <= 0:
            errors.append("货架高度必须大于0")
        if self.shelf_width <= 0:
            errors.append("货架宽度必须大于0")
        if self.installed_power < 0:
            errors.append("安装功率不能为负值")
        errors.extend(self.light_threshold.validate())
        return errors
    
    @property
    def area_per_shelf(self) -> float:
        return self.shelf_width * 1.0
    
    @property
    def total_area(self) -> float:
        return self.area_per_shelf * self.shelf_count
    
    @property
    def photoperiod_hours(self) -> float:
        start_seconds = self.photoperiod_start.hour * 3600 + self.photoperiod_start.minute * 60
        end_seconds = self.photoperiod_end.hour * 3600 + self.photoperiod_end.minute * 60
        
        if end_seconds < start_seconds:
            end_seconds += 24 * 3600
        
        return (end_seconds - start_seconds) / 3600
