"""LED灯谱数据模型"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class SpectrumChannel:
    wavelength_range: str
    wavelength_nm: float
    intensity_ratio: float
    photon_efficiency: float
    
    def to_dict(self) -> Dict:
        return {
            "wavelength_range": self.wavelength_range,
            "wavelength_nm": self.wavelength_nm,
            "intensity_ratio": self.intensity_ratio,
            "photon_efficiency": self.photon_efficiency
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "SpectrumChannel":
        return cls(
            wavelength_range=data["wavelength_range"],
            wavelength_nm=data["wavelength_nm"],
            intensity_ratio=data["intensity_ratio"],
            photon_efficiency=data["photon_efficiency"]
        )
    
    def validate(self) -> List[str]:
        errors = []
        if self.intensity_ratio < 0 or self.intensity_ratio > 1:
            errors.append(f"通道 {self.wavelength_range} 的强度比例必须在0-1之间")
        if self.photon_efficiency <= 0:
            errors.append(f"通道 {self.wavelength_range} 的光子效率必须大于0")
        return errors


@dataclass
class LEDSpectrum:
    spectrum_id: str
    spectrum_name: str
    manufacturer: str
    model: str
    total_power: float
    photon_flux_density: float
    channels: List[SpectrumChannel] = field(default_factory=list)
    notes: str = ""
    custom_attributes: Dict[str, str] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "spectrum_id": self.spectrum_id,
            "spectrum_name": self.spectrum_name,
            "manufacturer": self.manufacturer,
            "model": self.model,
            "total_power": self.total_power,
            "photon_flux_density": self.photon_flux_density,
            "channels": [ch.to_dict() for ch in self.channels],
            "notes": self.notes,
            "custom_attributes": self.custom_attributes
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "LEDSpectrum":
        return cls(
            spectrum_id=data["spectrum_id"],
            spectrum_name=data["spectrum_name"],
            manufacturer=data.get("manufacturer", ""),
            model=data.get("model", ""),
            total_power=data["total_power"],
            photon_flux_density=data["photon_flux_density"],
            channels=[SpectrumChannel.from_dict(ch) for ch in data.get("channels", [])],
            notes=data.get("notes", ""),
            custom_attributes=data.get("custom_attributes", {})
        )
    
    def validate(self) -> List[str]:
        errors = []
        if not self.spectrum_id or not self.spectrum_id.strip():
            errors.append("灯谱ID不能为空")
        if not self.spectrum_name or not self.spectrum_name.strip():
            errors.append("灯谱名称不能为空")
        if self.total_power <= 0:
            errors.append("总功率必须大于0")
        if self.photon_flux_density <= 0:
            errors.append("光子通量密度必须大于0")
        
        total_ratio = sum(ch.intensity_ratio for ch in self.channels)
        if self.channels and abs(total_ratio - 1.0) > 0.01:
            errors.append(f"灯谱通道强度比例之和 ({total_ratio}) 必须为1.0")
        
        for channel in self.channels:
            errors.extend(channel.validate())
        
        return errors
    
    @property
    def blue_ratio(self) -> float:
        total = 0.0
        for ch in self.channels:
            if "blue" in ch.wavelength_range.lower() or (400 <= ch.wavelength_nm <= 500):
                total += ch.intensity_ratio
        return total
    
    @property
    def red_ratio(self) -> float:
        total = 0.0
        for ch in self.channels:
            if ("red" in ch.wavelength_range.lower() and 
                "far" not in ch.wavelength_range.lower()) or \
               (600 <= ch.wavelength_nm <= 700):
                total += ch.intensity_ratio
        return total
    
    @property
    def far_red_ratio(self) -> float:
        total = 0.0
        for ch in self.channels:
            if "far red" in ch.wavelength_range.lower() or \
               "far-red" in ch.wavelength_range.lower() or \
               (700 < ch.wavelength_nm <= 800):
                total += ch.intensity_ratio
        return total
    
    @property
    def blue_red_ratio(self) -> float:
        if self.red_ratio > 0:
            return self.blue_ratio / self.red_ratio
        return float("inf")
