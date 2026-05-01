import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class FileEntry(BaseModel):
    filename: str = Field(..., description="文件名")
    sha256: str = Field(..., description="SHA256哈希")
    size: int = Field(default=0, description="文件大小")
    file_type: str = Field(default="unknown", description="文件类型")


class ManifestModel(BaseModel):
    manifest_version: str = Field(..., description="Manifest版本")
    package_name: str = Field(..., description="包名称")
    package_version: str = Field(..., description="包版本")
    target_device_models: List[str] = Field(default_factory=list, description="目标设备型号")
    target_regions: Optional[List[str]] = Field(default=None, description="目标区域")
    
    firmware: Optional[FileEntry] = Field(default=None, description="固件文件")
    firmware_version: str = Field(default="", description="固件版本")
    
    calibration: Optional[FileEntry] = Field(default=None, description="校准参数文件")
    calibration_version: str = Field(default="", description="校准版本")
    calibration_date: Optional[datetime] = Field(default=None, description="校准日期")
    calibration_validity_days: Optional[int] = Field(default=None, description="校准有效期天数")
    
    rollback: Optional[FileEntry] = Field(default=None, description="回滚包")
    rollback_from_version: Optional[str] = Field(default=None, description="从哪个版本回滚")
    
    dependencies: List[str] = Field(default_factory=list, description="依赖版本")
    
    signature: Optional[str] = Field(default=None, description="签名")
    signed_by: Optional[str] = Field(default=None, description="签名者")
    signature_algorithm: str = Field(default="SHA256withRSA", description="签名算法")
    
    created_at: datetime = Field(default_factory=lambda: datetime.now())
    description: str = Field(default="", description="描述")
    
    class Config:
        extra = "forbid"


@dataclass
class PackageManifest:
    _model: ManifestModel = field(repr=False)
    _package_dir: Optional[Path] = None

    @classmethod
    def from_file(cls, file_path: Path) -> "PackageManifest":
        if not file_path.exists():
            raise FileNotFoundError(f"Manifest文件不存在: {file_path}")
        
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        model = ManifestModel(**data)
        return cls(_model=model, _package_dir=file_path.parent)

    @classmethod
    def from_dict(cls, data: Dict) -> "PackageManifest":
        model = ManifestModel(**data)
        return cls(_model=model)

    @property
    def manifest_version(self) -> str:
        return self._model.manifest_version

    @property
    def package_name(self) -> str:
        return self._model.package_name

    @property
    def package_version(self) -> str:
        return self._model.package_version

    @property
    def target_device_models(self) -> List[str]:
        return self._model.target_device_models.copy()

    @property
    def target_regions(self) -> Optional[List[str]]:
        return self._model.target_regions.copy() if self._model.target_regions else None

    @property
    def firmware(self) -> Optional[FileEntry]:
        return self._model.firmware

    @property
    def firmware_version(self) -> str:
        return self._model.firmware_version

    @property
    def calibration(self) -> Optional[FileEntry]:
        return self._model.calibration

    @property
    def calibration_version(self) -> str:
        return self._model.calibration_version

    @property
    def calibration_date(self) -> Optional[datetime]:
        return self._model.calibration_date

    @property
    def calibration_validity_days(self) -> Optional[int]:
        return self._model.calibration_validity_days

    @property
    def rollback(self) -> Optional[FileEntry]:
        return self._model.rollback

    @property
    def rollback_from_version(self) -> Optional[str]:
        return self._model.rollback_from_version

    @property
    def dependencies(self) -> List[str]:
        return self._model.dependencies.copy()

    @property
    def signature(self) -> Optional[str]:
        return self._model.signature

    @property
    def signed_by(self) -> Optional[str]:
        return self._model.signed_by

    @property
    def signature_algorithm(self) -> str:
        return self._model.signature_algorithm

    @property
    def created_at(self) -> datetime:
        return self._model.created_at

    @property
    def description(self) -> str:
        return self._model.description

    @property
    def package_dir(self) -> Optional[Path]:
        return self._package_dir

    def get_all_files(self) -> List[FileEntry]:
        files = []
        if self._model.firmware:
            files.append(self._model.firmware)
        if self._model.calibration:
            files.append(self._model.calibration)
        if self._model.rollback:
            files.append(self._model.rollback)
        return files

    def to_dict(self) -> Dict:
        return self._model.model_dump()

    def is_compatible_with_device(self, device_model: str, region: Optional[str] = None) -> bool:
        if device_model not in self._model.target_device_models:
            return False
        
        if self._model.target_regions and region is not None:
            if region not in self._model.target_regions:
                return False
        
        return True
