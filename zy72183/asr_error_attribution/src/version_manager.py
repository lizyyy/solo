import json
import yaml
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from . import PROJECT_ROOT, CONFIG_PATH


class VersionManager:
    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or CONFIG_PATH
        self.config = self._load_config()
        self.versions_dir = PROJECT_ROOT / self.config["data"]["versions_dir"]
        self.versions_dir.mkdir(parents=True, exist_ok=True)
        self.manifest_path = self.versions_dir / "manifest.json"
        self._init_manifest()

    def _load_config(self) -> Dict[str, Any]:
        with open(self.config_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)

    def _init_manifest(self):
        if not self.manifest_path.exists():
            manifest = {
                "versions": [],
                "latest_version": None,
                "created_at": datetime.now().isoformat(),
            }
            self._save_manifest(manifest)

    def _load_manifest(self) -> Dict[str, Any]:
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_manifest(self, manifest: Dict[str, Any]):
        with open(self.manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

    def _parse_version(self, version_str: str) -> tuple:
        match = re.match(r"v(\d+)\.(\d+)\.(\d+)", version_str)
        if match:
            return (int(match.group(1)), int(match.group(2)), int(match.group(3)))
        return (0, 0, 0)

    def _format_version(self, major: int, minor: int, patch: int) -> str:
        return f"v{major}.{minor}.{patch}"

    def get_latest_version(self) -> Optional[str]:
        manifest = self._load_manifest()
        return manifest.get("latest_version")

    def list_versions(self) -> List[Dict[str, Any]]:
        manifest = self._load_manifest()
        return manifest.get("versions", [])

    def create_new_version(
        self,
        model_version: str,
        threshold_version: str,
        description: str = "",
        created_by: str = "system",
    ) -> str:
        manifest = self._load_manifest()
        latest = manifest.get("latest_version")

        if latest:
            major, minor, patch = self._parse_version(latest)
            patch += 1
        else:
            major, minor, patch = 1, 0, 0

        new_version = self._format_version(major, minor, patch)
        version_dir = self.versions_dir / new_version
        version_dir.mkdir(parents=True, exist_ok=True)

        version_info = {
            "version": new_version,
            "model_version": model_version,
            "threshold_version": threshold_version,
            "description": description,
            "created_by": created_by,
            "created_at": datetime.now().isoformat(),
            "status": "active",
        }

        manifest["versions"].append(version_info)
        manifest["latest_version"] = new_version
        self._save_manifest(manifest)

        version_meta_path = version_dir / "meta.json"
        with open(version_meta_path, "w", encoding="utf-8") as f:
            json.dump(version_info, f, ensure_ascii=False, indent=2)

        return new_version

    def get_version_dir(self, version: str) -> Path:
        return self.versions_dir / version

    def save_version_data(
        self, version: str, data_type: str, data: Dict[str, Any]
    ) -> Path:
        version_dir = self.get_version_dir(version)
        if not version_dir.exists():
            raise ValueError(f"Version {version} does not exist")

        file_path = version_dir / f"{data_type}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return file_path

    def load_version_data(self, version: str, data_type: str) -> Dict[str, Any]:
        version_dir = self.get_version_dir(version)
        file_path = version_dir / f"{data_type}.json"

        if not file_path.exists():
            raise FileNotFoundError(f"{data_type} not found for version {version}")

        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def append_to_version_data(
        self, version: str, data_type: str, new_records: List[Dict[str, Any]]
    ) -> Path:
        version_dir = self.get_version_dir(version)
        file_path = version_dir / f"{data_type}.json"

        if file_path.exists():
            with open(file_path, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
        else:
            existing_data = {"records": []}

        if "records" not in existing_data:
            existing_data = {"records": existing_data}

        existing_data["records"].extend(new_records)
        existing_data["last_updated"] = datetime.now().isoformat()

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(existing_data, f, ensure_ascii=False, indent=2)

        return file_path

    def get_version_info(self, version: str) -> Optional[Dict[str, Any]]:
        manifest = self._load_manifest()
        for v in manifest["versions"]:
            if v["version"] == version:
                return v
        return None

    def archive_version(self, version: str, archived_by: str = "system") -> bool:
        manifest = self._load_manifest()
        for v in manifest["versions"]:
            if v["version"] == version:
                v["status"] = "archived"
                v["archived_at"] = datetime.now().isoformat()
                v["archived_by"] = archived_by
                self._save_manifest(manifest)
                return True
        return False

    def find_versions_by_model(self, model_version: str) -> List[Dict[str, Any]]:
        manifest = self._load_manifest()
        return [v for v in manifest["versions"] if v["model_version"] == model_version]

    def get_version_report_path(self, version: str, format: str = "csv") -> Path:
        version_dir = self.get_version_dir(version)
        return version_dir / f"report_{version}.{format}"
