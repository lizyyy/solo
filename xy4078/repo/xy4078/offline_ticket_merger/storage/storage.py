"""本地存储模块"""

import hashlib
import json
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Type, TypeVar, Union

from pydantic import BaseModel

from ..models import (
    AuditReport,
    ImportedTicket,
    InventoryCheckResult,
    MergeConflict,
    MergeResult,
    SparePart,
    WorkOrder,
)

T = TypeVar("T", bound=BaseModel)

OTM_DIR = ".otm"
CONFIG_FILE = "config.json"
DATA_DIR = "data"
IMPORTS_DIR = "imports"
MERGED_DIR = "merged"
AUDITS_DIR = "audits"
INVENTORY_FILE = "inventory.json"
ENGINEERS_FILE = "engineers.json"


def get_current_dir() -> Path:
    return Path.cwd()


def get_otm_path(path: Optional[Path] = None) -> Path:
    base_path = path or get_current_dir()
    return base_path / OTM_DIR


def get_config_path(path: Optional[Path] = None) -> Path:
    return get_otm_path(path) / CONFIG_FILE


def get_data_path(path: Optional[Path] = None) -> Path:
    return get_otm_path(path) / DATA_DIR


def get_imports_path(path: Optional[Path] = None) -> Path:
    return get_otm_path(path) / IMPORTS_DIR


def get_merged_path(path: Optional[Path] = None) -> Path:
    return get_otm_path(path) / MERGED_DIR


def get_audits_path(path: Optional[Path] = None) -> Path:
    return get_otm_path(path) / AUDITS_DIR


def get_inventory_path(path: Optional[Path] = None) -> Path:
    return get_otm_path(path) / INVENTORY_FILE


def get_engineers_path(path: Optional[Path] = None) -> Path:
    return get_otm_path(path) / ENGINEERS_FILE


def is_repository(path: Optional[Path] = None) -> bool:
    otm_path = get_otm_path(path)
    config_path = get_config_path(path)
    return otm_path.exists() and config_path.exists()


def calculate_file_hash(file_path: Path, algorithm: str = "sha256") -> str:
    hash_func = hashlib.new(algorithm)
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hash_func.update(chunk)
    return hash_func.hexdigest()


def calculate_content_hash(content: str, algorithm: str = "sha256") -> str:
    hash_func = hashlib.new(algorithm)
    hash_func.update(content.encode("utf-8"))
    return hash_func.hexdigest()


class RepositoryConfig(BaseModel):
    version: str = "0.1.0"
    created_at: datetime
    repository_name: str
    description: Optional[str] = None
    
    default_merge_strategy: str = "timeline_order"
    strict_device_validation: bool = True
    auto_resolve_duplicates: bool = True
    
    inventory_enabled: bool = True
    inventory_warning_threshold: float = 0.8
    
    allowed_file_formats: List[str] = ["json", "csv"]
    date_formats: List[str] = ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"]
    
    metadata: Dict[str, Any] = {}
    
    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


def init_repository(
    path: Optional[Path] = None,
    name: Optional[str] = None,
    description: Optional[str] = None,
) -> LocalRepository:
    base_path = path or get_current_dir()
    otm_path = get_otm_path(base_path)
    
    if otm_path.exists():
        raise RuntimeError(f"Repository already exists at {otm_path}")
    
    otm_path.mkdir(parents=True, exist_ok=True)
    get_data_path(base_path).mkdir(parents=True, exist_ok=True)
    get_imports_path(base_path).mkdir(parents=True, exist_ok=True)
    get_merged_path(base_path).mkdir(parents=True, exist_ok=True)
    get_audits_path(base_path).mkdir(parents=True, exist_ok=True)
    
    config = RepositoryConfig(
        created_at=datetime.now(),
        repository_name=name or f"otm-repo-{datetime.now().strftime('%Y%m%d')}",
        description=description,
    )
    
    save_json(get_config_path(base_path), config)
    save_json(get_inventory_path(base_path), {"inventory": [], "last_updated": datetime.now().isoformat()})
    save_json(get_engineers_path(base_path), {"engineers": [], "last_updated": datetime.now().isoformat()})
    
    return LocalRepository(base_path)


def get_repository(path: Optional[Path] = None) -> Optional["LocalRepository"]:
    base_path = path or get_current_dir()
    
    if is_repository(base_path):
        return LocalRepository(base_path)
    
    current = base_path
    while current.parent != current:
        if is_repository(current):
            return LocalRepository(current)
        current = current.parent
    
    return None


def save_json(path: Path, data: Union[BaseModel, Dict[str, Any]]) -> None:
    if isinstance(data, BaseModel):
        data = json.loads(data.model_dump_json())
    
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)


def load_json(path: Path, model_class: Optional[Type[T]] = None) -> Union[Dict[str, Any], T]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    if model_class:
        return model_class(**data)
    return data


class LocalRepository:
    def __init__(self, path: Path):
        self.path = path
        self.otm_path = get_otm_path(path)
        self._config: Optional[RepositoryConfig] = None
        self._validate_repo()
    
    def _validate_repo(self) -> None:
        if not is_repository(self.path):
            raise RuntimeError(f"Not a valid repository: {self.path}")
    
    @property
    def config(self) -> RepositoryConfig:
        if self._config is None:
            self._config = load_json(get_config_path(self.path), RepositoryConfig)
        return self._config
    
    @config.setter
    def config(self, value: RepositoryConfig) -> None:
        self._config = value
        save_json(get_config_path(self.path), value)
    
    def save_imported_ticket(self, imported: ImportedTicket) -> Path:
        imports_dir = get_imports_path(self.path)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_filename = "".join(c if c.isalnum() or c in ".-_" else "_" for c in imported.original_filename)
        filename = f"{timestamp}_{safe_filename}.json"
        file_path = imports_dir / filename
        
        save_json(file_path, imported)
        return file_path
    
    def list_imported_tickets(self) -> List[Path]:
        imports_dir = get_imports_path(self.path)
        if not imports_dir.exists():
            return []
        return sorted(imports_dir.glob("*.json"), key=lambda p: p.stat().st_mtime)
    
    def load_imported_ticket(self, file_path: Path) -> ImportedTicket:
        return load_json(file_path, ImportedTicket)
    
    def load_all_imported_tickets(self) -> List[ImportedTicket]:
        tickets = []
        for path in self.list_imported_tickets():
            try:
                tickets.append(self.load_imported_ticket(path))
            except Exception as e:
                print(f"Warning: Failed to load {path}: {e}")
        return tickets
    
    def save_merge_result(self, result: MergeResult) -> Path:
        merged_dir = get_merged_path(self.path)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"merge_{result.id}_{timestamp}.json"
        file_path = merged_dir / filename
        
        save_json(file_path, result)
        return file_path
    
    def list_merge_results(self) -> List[Path]:
        merged_dir = get_merged_path(self.path)
        if not merged_dir.exists():
            return []
        return sorted(merged_dir.glob("merge_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    
    def load_latest_merge_result(self) -> Optional[MergeResult]:
        paths = self.list_merge_results()
        if not paths:
            return None
        return load_json(paths[0], MergeResult)
    
    def load_merge_result(self, file_path: Path) -> MergeResult:
        return load_json(file_path, MergeResult)
    
    def save_audit_report(self, report: AuditReport) -> Path:
        audits_dir = get_audits_path(self.path)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"audit_{report.id}_{timestamp}.json"
        file_path = audits_dir / filename
        
        save_json(file_path, report)
        return file_path
    
    def list_audit_reports(self) -> List[Path]:
        audits_dir = get_audits_path(self.path)
        if not audits_dir.exists():
            return []
        return sorted(audits_dir.glob("audit_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    
    def save_inventory(self, parts: List[SparePart]) -> None:
        inventory_data = {
            "inventory": [json.loads(p.model_dump_json()) for p in parts],
            "last_updated": datetime.now().isoformat()
        }
        save_json(get_inventory_path(self.path), inventory_data)
    
    def load_inventory(self) -> List[SparePart]:
        try:
            data = load_json(get_inventory_path(self.path))
            return [SparePart(**item) for item in data.get("inventory", [])]
        except FileNotFoundError:
            return []
    
    def get_inventory_by_part_number(self, part_number: str) -> Optional[SparePart]:
        for part in self.load_inventory():
            if part.part_number == part_number:
                return part
        return None
    
    def update_inventory_quantity(self, part_number: str, quantity_change: int) -> bool:
        parts = self.load_inventory()
        for part in parts:
            if part.part_number == part_number:
                new_quantity = part.quantity + quantity_change
                if new_quantity < 0:
                    return False
                part.quantity = new_quantity
                self.save_inventory(parts)
                return True
        return False
    
    def cleanup_imports(self, older_than_days: int = 30) -> int:
        imports_dir = get_imports_path(self.path)
        if not imports_dir.exists():
            return 0
        
        import time
        now = time.time()
        cutoff = now - (older_than_days * 24 * 60 * 60)
        deleted = 0
        
        for path in imports_dir.glob("*.json"):
            if path.stat().st_mtime < cutoff:
                path.unlink()
                deleted += 1
        
        return deleted
