import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List

from .models import (
    ProjectState, Asset, License, Risk,
    AssetType, RiskType, RiskLevel
)


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None


class ProjectStorage:
    DEFAULT_STATE_FILE = ".license_scanner_state.json"

    def __init__(self, project_dir: Optional[str] = None):
        self.project_dir = Path(project_dir).resolve() if project_dir else None

    def _get_state_file(self, directory: Optional[str] = None) -> Path:
        if directory:
            return Path(directory) / self.DEFAULT_STATE_FILE
        elif self.project_dir:
            return self.project_dir / self.DEFAULT_STATE_FILE
        else:
            raise ValueError("No project directory specified")

    def save_state(self, 
                   state: ProjectState,
                   output_path: Optional[str] = None) -> str:
        if output_path:
            file_path = Path(output_path)
            if file_path.is_dir():
                file_path = file_path / self.DEFAULT_STATE_FILE
        else:
            file_path = self._get_state_file()

        state_dict = state.to_dict()
        
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(state_dict, f, cls=DateTimeEncoder, indent=2, ensure_ascii=False)

        return str(file_path)

    def load_state(self, 
                   input_path: Optional[str] = None,
                   directory: Optional[str] = None) -> ProjectState:
        if input_path:
            file_path = Path(input_path)
            if file_path.is_dir():
                file_path = file_path / self.DEFAULT_STATE_FILE
        elif directory:
            file_path = self._get_state_file(directory)
        elif self.project_dir:
            file_path = self._get_state_file()
        else:
            raise ValueError("No input path or directory specified")

        if not file_path.exists():
            raise FileNotFoundError(f"State file not found: {file_path}")

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        return self._dict_to_project_state(data)

    def _dict_to_project_state(self, data: Dict[str, Any]) -> ProjectState:
        assets = [self._dict_to_asset(a) for a in data.get('assets', [])]
        licenses = [self._dict_to_license(l) for l in data.get('licenses', [])]
        risks = [self._dict_to_risk(r) for r in data.get('risks', [])]
        
        license_map = {lic.license_id: lic for lic in licenses}
        
        for asset_data in data.get('assets', []):
            matched_ids = asset_data.get('matched_license_ids', [])
            asset = next((a for a in assets if a.file_path == asset_data['file_path']), None)
            if asset:
                for lic_id in matched_ids:
                    if lic_id in license_map:
                        asset.matched_licenses.append(license_map[lic_id])
        
        for risk_data in data.get('risks', []):
            risk = next((r for r in risks if r.risk_id == risk_data['risk_id']), None)
            if risk:
                asset_file = risk_data.get('asset_file')
                if asset_file:
                    risk.asset = next((a for a in assets if a.file_path == asset_file), None)
                
                lic_id = risk_data.get('license_id')
                if lic_id:
                    risk.license = license_map.get(lic_id)

        return ProjectState(
            project_name=data.get('project_name', 'Unnamed Project'),
            scan_date=parse_datetime(data.get('scan_date')) or datetime.now(),
            assets=assets,
            licenses=licenses,
            risks=risks,
            matches=data.get('matches', [])
        )

    def _dict_to_asset(self, data: Dict[str, Any]) -> Asset:
        asset_type_str = data.get('asset_type')
        asset_type = AssetType(asset_type_str) if asset_type_str else AssetType.OTHER
        
        return Asset(
            file_path=data['file_path'],
            file_name=data['file_name'],
            file_size=data['file_size'],
            file_hash=data['file_hash'],
            asset_type=asset_type,
            extension=data.get('extension', ''),
            modified_time=parse_datetime(data.get('modified_time')),
            created_time=parse_datetime(data.get('created_time')),
            metadata=data.get('metadata', {})
        )

    def _dict_to_license(self, data: Dict[str, Any]) -> License:
        asset_type_str = data.get('asset_type')
        asset_type = AssetType(asset_type_str) if asset_type_str else None
        
        return License(
            license_id=data['license_id'],
            asset_name=data['asset_name'],
            asset_type=asset_type,
            vendor=data.get('vendor'),
            license_type=data.get('license_type'),
            purchase_date=parse_datetime(data.get('purchase_date')),
            expiry_date=parse_datetime(data.get('expiry_date')),
            seats=data.get('seats'),
            allowed_usage=data.get('allowed_usage', []),
            restrictions=data.get('restrictions', []),
            original_file=data.get('original_file'),
            asset_hash=data.get('asset_hash'),
            notes=data.get('notes'),
            source=data.get('source', 'imported')
        )

    def _dict_to_risk(self, data: Dict[str, Any]) -> Risk:
        risk_type = RiskType(data['risk_type']) if data.get('risk_type') else RiskType.MISSING_LICENSE
        risk_level = RiskLevel(data['risk_level']) if data.get('risk_level') else RiskLevel.MEDIUM
        
        return Risk(
            risk_id=data['risk_id'],
            risk_type=risk_type,
            risk_level=risk_level,
            message=data.get('message', ''),
            details=data.get('details', {})
        )

    def state_exists(self, directory: Optional[str] = None) -> bool:
        try:
            file_path = self._get_state_file(directory)
            return file_path.exists()
        except ValueError:
            return False


def save_project_state(state: ProjectState, output_path: str) -> str:
    storage = ProjectStorage()
    return storage.save_state(state, output_path)


def load_project_state(input_path: str) -> ProjectState:
    storage = ProjectStorage()
    return storage.load_state(input_path=input_path)
