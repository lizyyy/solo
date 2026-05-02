import csv
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class DeviceModel(BaseModel):
    device_id: str = Field(..., description="设备号")
    model: str = Field(..., description="型号")
    region: str = Field(..., description="区域")
    current_firmware: Optional[str] = Field(default=None, description="当前固件版本")
    current_calibration: Optional[str] = Field(default=None, description="当前校准版本")
    last_online: Optional[datetime] = Field(default=None, description="最后上线时间")
    owner: Optional[str] = Field(default=None, description="负责人")

    class Config:
        extra = "forbid"


@dataclass
class Device:
    _model: DeviceModel = field(repr=False)

    @classmethod
    def from_dict(cls, data: Dict) -> "Device":
        model = DeviceModel(**data)
        return cls(_model=model)

    @classmethod
    def from_csv_row(cls, row: Dict[str, str]) -> "Device":
        processed = {
            "device_id": row.get("设备号") or row.get("device_id") or "",
            "model": row.get("型号") or row.get("model") or "",
            "region": row.get("区域") or row.get("region") or "",
            "current_firmware": row.get("当前固件") or row.get("current_firmware") or None,
            "current_calibration": row.get("当前校准版本") or row.get("current_calibration") or None,
            "owner": row.get("负责人") or row.get("owner") or None,
        }
        
        last_online_str = row.get("最后上线时间") or row.get("last_online")
        if last_online_str:
            try:
                processed["last_online"] = datetime.fromisoformat(last_online_str)
            except ValueError:
                pass
        
        return cls.from_dict(processed)

    @property
    def device_id(self) -> str:
        return self._model.device_id

    @property
    def model(self) -> str:
        return self._model.model

    @property
    def region(self) -> str:
        return self._model.region

    @property
    def current_firmware(self) -> Optional[str]:
        return self._model.current_firmware

    @property
    def current_calibration(self) -> Optional[str]:
        return self._model.current_calibration

    @property
    def last_online(self) -> Optional[datetime]:
        return self._model.last_online

    @property
    def owner(self) -> Optional[str]:
        return self._model.owner

    def to_dict(self) -> Dict:
        return self._model.model_dump()


@dataclass
class DeviceRegistry:
    devices: Dict[str, Device] = field(default_factory=dict)
    _file_path: Optional[Path] = None

    @classmethod
    def load(cls, file_path: Path) -> "DeviceRegistry":
        if not file_path.exists():
            raise FileNotFoundError(f"设备清单文件不存在: {file_path}")
        
        registry = cls(_file_path=file_path)
        
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                device = Device.from_csv_row(row)
                registry.add_device(device)
        
        return registry

    @classmethod
    def create(cls, file_path: Path) -> "DeviceRegistry":
        registry = cls(_file_path=file_path)
        registry.save()
        return registry

    def add_device(self, device: Device) -> None:
        self.devices[device.device_id] = device
        if self._file_path:
            self.save()

    def get_device(self, device_id: str) -> Optional[Device]:
        return self.devices.get(device_id)

    def get_devices_by_region(self, region: str) -> List[Device]:
        return [d for d in self.devices.values() if d.region == region]

    def get_devices_by_model(self, model: str) -> List[Device]:
        return [d for d in self.devices.values() if d.model == model]

    def all_devices(self) -> List[Device]:
        return list(self.devices.values())

    def save(self) -> None:
        if self._file_path is None:
            raise ValueError("设备清单文件路径未设置")
        
        from .utils import ensure_parent_dir
        ensure_parent_dir(self._file_path)
        
        fieldnames = [
            "设备号", "型号", "区域", "当前固件", 
            "当前校准版本", "最后上线时间", "负责人"
        ]
        
        with open(self._file_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for device in self.devices.values():
                row = {
                    "设备号": device.device_id,
                    "型号": device.model,
                    "区域": device.region,
                    "当前固件": device.current_firmware or "",
                    "当前校准版本": device.current_calibration or "",
                    "最后上线时间": device.last_online.isoformat() if device.last_online else "",
                    "负责人": device.owner or "",
                }
                writer.writerow(row)
