from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .device import Device, DeviceRegistry
from .manifest import PackageManifest
from .package_registry import PackageRegistry, ValidPackage


@dataclass
class BlockingIssue:
    code: str
    message: str
    device_id: Optional[str] = None
    package_id: Optional[str] = None
    details: Dict = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "code": self.code,
            "message": self.message,
            "device_id": self.device_id,
            "package_id": self.package_id,
            "details": self.details
        }


@dataclass
class DeliveryItem:
    device_id: str
    device_model: str
    region: str
    package_id: str
    package_name: str
    package_version: str
    firmware_version: str
    calibration_version: Optional[str]
    has_rollback: bool
    source_dir: str
    owner: Optional[str]
    
    def to_dict(self) -> Dict:
        return {
            "device_id": self.device_id,
            "device_model": self.device_model,
            "region": self.region,
            "package_id": self.package_id,
            "package_name": self.package_name,
            "package_version": self.package_version,
            "firmware_version": self.firmware_version,
            "calibration_version": self.calibration_version,
            "has_rollback": self.has_rollback,
            "source_dir": self.source_dir,
            "owner": self.owner
        }


@dataclass
class DeliveryPlan:
    plan_id: str
    created_at: str
    is_dry_run: bool
    target_regions: Optional[List[str]]
    devices_count: int = 0
    packages_count: int = 0
    items: List[DeliveryItem] = field(default_factory=list)
    blocking_issues: List[BlockingIssue] = field(default_factory=list)
    warnings: List[Dict] = field(default_factory=list)
    
    def has_blockers(self) -> bool:
        return len(self.blocking_issues) > 0
    
    def can_execute(self) -> bool:
        return not self.has_blockers()
    
    def to_dict(self) -> Dict:
        return {
            "plan_id": self.plan_id,
            "created_at": self.created_at,
            "is_dry_run": self.is_dry_run,
            "target_regions": self.target_regions,
            "devices_count": self.devices_count,
            "packages_count": self.packages_count,
            "items": [item.to_dict() for item in self.items],
            "blocking_issues": [issue.to_dict() for issue in self.blocking_issues],
            "warnings": self.warnings
        }


class DeliveryPlanner:
    def __init__(
        self,
        device_registry: DeviceRegistry,
        package_registry: PackageRegistry,
        allowed_versions: Optional[List[str]] = None
    ):
        self.device_registry = device_registry
        self.package_registry = package_registry
        self.allowed_versions = allowed_versions or []
    
    def create_plan(
        self,
        plan_id: str,
        target_regions: Optional[List[str]] = None,
        is_dry_run: bool = True,
        require_owner_confirmation: bool = False
    ) -> DeliveryPlan:
        from .utils import get_current_timestamp
        
        plan = DeliveryPlan(
            plan_id=plan_id,
            created_at=get_current_timestamp(),
            is_dry_run=is_dry_run,
            target_regions=target_regions
        )
        
        devices = self._get_target_devices(target_regions)
        valid_packages = self.package_registry.get_all_packages()
        
        device_to_packages: Dict[str, List[ValidPackage]] = {}
        
        for device in devices:
            matching_packages = self._find_matching_packages(device, valid_packages)
            if matching_packages:
                device_to_packages[device.device_id] = matching_packages
        
        self._check_multiple_package_hits(device_to_packages, plan)
        self._check_missing_rollback(devices, device_to_packages, plan)
        self._check_version_jumps(devices, device_to_packages, plan)
        self._check_unknown_versions(devices, plan)
        
        if require_owner_confirmation:
            self._check_owner_confirmation(devices, plan)
        
        if not plan.has_blockers():
            self._build_delivery_items(device_to_packages, devices, plan)
        
        plan.devices_count = len(devices)
        plan.packages_count = len(set(
            pkg.package_id 
            for pkgs in device_to_packages.values() 
            for pkg in pkgs
        ))
        
        return plan
    
    def _get_target_devices(self, target_regions: Optional[List[str]]) -> List[Device]:
        devices = self.device_registry.all_devices()
        
        if target_regions:
            devices = [d for d in devices if d.region in target_regions]
        
        return devices
    
    def _find_matching_packages(
        self, 
        device: Device, 
        packages: List[ValidPackage]
    ) -> List[ValidPackage]:
        matching = []
        
        for pkg in packages:
            manifest = PackageManifest.from_dict(pkg.manifest)
            
            if manifest.is_compatible_with_device(device.model, device.region):
                if self.allowed_versions:
                    if manifest.firmware_version in self.allowed_versions:
                        matching.append(pkg)
                else:
                    matching.append(pkg)
        
        return matching
    
    def _check_multiple_package_hits(
        self,
        device_to_packages: Dict[str, List[ValidPackage]],
        plan: DeliveryPlan
    ):
        for device_id, packages in device_to_packages.items():
            if len(packages) > 1:
                plan.blocking_issues.append(BlockingIssue(
                    code="MULTIPLE_PACKAGE_HITS",
                    message=f"设备 {device_id} 匹配到多个投递包",
                    device_id=device_id,
                    details={
                        "matching_packages": [p.package_id for p in packages]
                    }
                ))
    
    def _check_missing_rollback(
        self,
        devices: List[Device],
        device_to_packages: Dict[str, List[ValidPackage]],
        plan: DeliveryPlan
    ):
        device_map = {d.device_id: d for d in devices}
        
        for device_id, packages in device_to_packages.items():
            device = device_map.get(device_id)
            if not device:
                continue
            
            for pkg in packages:
                manifest = PackageManifest.from_dict(pkg.manifest)
                
                if not manifest.rollback and manifest.firmware:
                    if device.current_firmware and device.current_firmware != manifest.firmware_version:
                        plan.blocking_issues.append(BlockingIssue(
                            code="MISSING_ROLLBACK",
                            message=f"设备 {device_id} 升级到 {manifest.firmware_version} 缺少回滚包",
                            device_id=device_id,
                            package_id=pkg.package_id,
                            details={
                                "current_version": device.current_firmware,
                                "target_version": manifest.firmware_version
                            }
                        ))
    
    def _check_version_jumps(
        self,
        devices: List[Device],
        device_to_packages: Dict[str, List[ValidPackage]],
        plan: DeliveryPlan
    ):
        device_map = {d.device_id: d for d in devices}
        
        for device_id, packages in device_to_packages.items():
            device = device_map.get(device_id)
            if not device or not device.current_firmware:
                continue
            
            for pkg in packages:
                manifest = PackageManifest.from_dict(pkg.manifest)
                
                if manifest.dependencies and device.current_firmware not in manifest.dependencies:
                    plan.blocking_issues.append(BlockingIssue(
                        code="VERSION_JUMP",
                        message=f"设备 {device_id} 版本跳升: 当前 {device.current_firmware} 不在允许的依赖版本中",
                        device_id=device_id,
                        package_id=pkg.package_id,
                        details={
                            "current_version": device.current_firmware,
                            "target_version": manifest.firmware_version,
                            "required_dependencies": manifest.dependencies
                        }
                    ))
    
    def _check_unknown_versions(
        self,
        devices: List[Device],
        plan: DeliveryPlan
    ):
        for device in devices:
            if not device.current_firmware:
                plan.blocking_issues.append(BlockingIssue(
                    code="UNKNOWN_VERSION",
                    message=f"设备 {device.device_id} 当前固件版本未知",
                    device_id=device.device_id,
                    details={
                        "device_model": device.model,
                        "region": device.region
                    }
                ))
    
    def _check_owner_confirmation(
        self,
        devices: List[Device],
        plan: DeliveryPlan
    ):
        for device in devices:
            if not device.owner:
                plan.blocking_issues.append(BlockingIssue(
                    code="OWNER_NOT_CONFIRMED",
                    message=f"设备 {device.device_id} 未指定负责人",
                    device_id=device.device_id,
                    details={
                        "device_model": device.model,
                        "region": device.region
                    }
                ))
    
    def _build_delivery_items(
        self,
        device_to_packages: Dict[str, List[ValidPackage]],
        devices: List[Device],
        plan: DeliveryPlan
    ):
        device_map = {d.device_id: d for d in devices}
        
        for device_id, packages in device_to_packages.items():
            if len(packages) != 1:
                continue
            
            device = device_map.get(device_id)
            if not device:
                continue
            
            pkg = packages[0]
            manifest = PackageManifest.from_dict(pkg.manifest)
            
            item = DeliveryItem(
                device_id=device_id,
                device_model=device.model,
                region=device.region,
                package_id=pkg.package_id,
                package_name=pkg.package_name,
                package_version=pkg.package_version,
                firmware_version=manifest.firmware_version,
                calibration_version=manifest.calibration_version if manifest.calibration else None,
                has_rollback=manifest.rollback is not None,
                source_dir=pkg.package_dir,
                owner=device.owner
            )
            
            plan.items.append(item)
