import json
from dataclasses import dataclass, field
from datetime import timedelta
from pathlib import Path
from typing import List, Optional

from pydantic import BaseModel, Field


class ConfigModel(BaseModel):
    project_name: str = Field(default="固件校准包投递项目")
    device_models: List[str] = Field(default_factory=list)
    regions: List[str] = Field(default_factory=list)
    allowed_firmware_versions: List[str] = Field(default_factory=list)
    calibration_validity_days: int = Field(default=365)
    public_key: Optional[str] = Field(default=None)
    delivery_directory: str = Field(default="./delivery")
    audit_directory: str = Field(default="./audit")
    manifest_version: str = Field(default="1.0")

    class Config:
        extra = "forbid"


@dataclass
class Config:
    _model: ConfigModel = field(default_factory=ConfigModel)
    _file_path: Optional[Path] = None

    @classmethod
    def load(cls, file_path: Path) -> "Config":
        if not file_path.exists():
            raise FileNotFoundError(f"配置文件不存在: {file_path}")
        
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        model = ConfigModel(**data)
        return cls(_model=model, _file_path=file_path)

    @classmethod
    def create(cls, file_path: Path, **kwargs) -> "Config":
        model = ConfigModel(**kwargs)
        config = cls(_model=model, _file_path=file_path)
        config.save()
        return config

    def save(self) -> None:
        if self._file_path is None:
            raise ValueError("配置文件路径未设置")
        
        ensure_parent_dir(self._file_path)
        with open(self._file_path, "w", encoding="utf-8") as f:
            json.dump(self._model.model_dump(), f, indent=2, ensure_ascii=False)

    @property
    def project_name(self) -> str:
        return self._model.project_name

    @property
    def device_models(self) -> List[str]:
        return self._model.device_models.copy()

    @property
    def regions(self) -> List[str]:
        return self._model.regions.copy()

    @property
    def allowed_firmware_versions(self) -> List[str]:
        return self._model.allowed_firmware_versions.copy()

    @property
    def calibration_validity_days(self) -> int:
        return self._model.calibration_validity_days

    @property
    def calibration_validity(self) -> timedelta:
        return timedelta(days=self._model.calibration_validity_days)

    @property
    def public_key(self) -> Optional[str]:
        return self._model.public_key

    @property
    def delivery_directory(self) -> Path:
        return Path(self._model.delivery_directory).resolve()

    @property
    def audit_directory(self) -> Path:
        return Path(self._model.audit_directory).resolve()

    @property
    def manifest_version(self) -> str:
        return self._model.manifest_version

    def add_device_model(self, model: str) -> None:
        if model not in self._model.device_models:
            self._model.device_models.append(model)
            self.save()

    def add_region(self, region: str) -> None:
        if region not in self._model.regions:
            self._model.regions.append(region)
            self.save()

    def add_allowed_version(self, version: str) -> None:
        if version not in self._model.allowed_firmware_versions:
            self._model.allowed_firmware_versions.append(version)
            self.save()

    def update(self, **kwargs) -> None:
        for key, value in kwargs.items():
            if hasattr(self._model, key):
                setattr(self._model, key, value)
        self.save()


def ensure_parent_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
