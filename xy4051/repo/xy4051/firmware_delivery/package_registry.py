import json
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

from .manifest import PackageManifest
from .utils import ensure_dir, get_current_timestamp


@dataclass
class ValidPackage:
    package_id: str
    package_name: str
    package_version: str
    package_dir: str
    manifest: dict
    imported_at: str
    
    def to_dict(self) -> Dict:
        return {
            "package_id": self.package_id,
            "package_name": self.package_name,
            "package_version": self.package_version,
            "package_dir": self.package_dir,
            "manifest": self.manifest,
            "imported_at": self.imported_at
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "ValidPackage":
        return cls(
            package_id=data["package_id"],
            package_name=data["package_name"],
            package_version=data["package_version"],
            package_dir=data["package_dir"],
            manifest=data["manifest"],
            imported_at=data["imported_at"]
        )


class PackageRegistry:
    def __init__(self, registry_dir: Path):
        self.registry_dir = registry_dir
        self.registry_json = registry_dir / "registry.json"
        self.packages_dir = registry_dir / "packages"
        ensure_dir(self.registry_dir)
        ensure_dir(self.packages_dir)
    
    def _load_registry(self) -> List[ValidPackage]:
        if not self.registry_json.exists():
            return []
        
        with open(self.registry_json, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return [ValidPackage.from_dict(entry) for entry in data]
    
    def _save_registry(self, packages: List[ValidPackage]) -> None:
        with open(self.registry_json, "w", encoding="utf-8") as f:
            json.dump([p.to_dict() for p in packages], f, indent=2, ensure_ascii=False)
    
    def import_package(
        self, 
        source_dir: Path, 
        manifest: PackageManifest
    ) -> ValidPackage:
        package_name = manifest.package_name
        package_version = manifest.package_version
        package_id = f"{package_name}-{package_version}"
        
        dest_dir = self.packages_dir / package_id
        
        if dest_dir.exists():
            existing_hash = self._get_package_hash(dest_dir)
            new_hash = self._get_package_hash(source_dir)
            
            if existing_hash == new_hash:
                for pkg in self._load_registry():
                    if pkg.package_id == package_id:
                        return pkg
            
            shutil.rmtree(dest_dir)
        
        shutil.copytree(source_dir, dest_dir)
        
        valid_package = ValidPackage(
            package_id=package_id,
            package_name=package_name,
            package_version=package_version,
            package_dir=str(dest_dir),
            manifest=manifest.to_dict(),
            imported_at=get_current_timestamp()
        )
        
        packages = self._load_registry()
        packages = [p for p in packages if p.package_id != package_id]
        packages.append(valid_package)
        self._save_registry(packages)
        
        return valid_package
    
    def _get_package_hash(self, package_dir: Path) -> str:
        import hashlib
        manifest_path = package_dir / "manifest.json"
        if manifest_path.exists():
            with open(manifest_path, "rb") as f:
                return hashlib.sha256(f.read()).hexdigest()
        return ""
    
    def get_all_packages(self) -> List[ValidPackage]:
        return self._load_registry()
    
    def get_package(self, package_id: str) -> Optional[ValidPackage]:
        for pkg in self._load_registry():
            if pkg.package_id == package_id:
                return pkg
        return None
    
    def get_packages_by_model(self, device_model: str) -> List[ValidPackage]:
        matching = []
        for pkg in self._load_registry():
            manifest = PackageManifest.from_dict(pkg.manifest)
            if device_model in manifest.target_device_models:
                matching.append(pkg)
        return matching
    
    def get_packages_by_version(self, version: str) -> List[ValidPackage]:
        matching = []
        for pkg in self._load_registry():
            manifest = PackageManifest.from_dict(pkg.manifest)
            if manifest.firmware_version == version or pkg.package_version == version:
                matching.append(pkg)
        return matching
    
    def remove_package(self, package_id: str, delete_files: bool = True) -> bool:
        packages = self._load_registry()
        pkg_to_remove = None
        
        for pkg in packages:
            if pkg.package_id == package_id:
                pkg_to_remove = pkg
                break
        
        if not pkg_to_remove:
            return False
        
        packages = [p for p in packages if p.package_id != package_id]
        self._save_registry(packages)
        
        if delete_files:
            package_dir = Path(pkg_to_remove.package_dir)
            if package_dir.exists():
                shutil.rmtree(package_dir)
        
        return True
