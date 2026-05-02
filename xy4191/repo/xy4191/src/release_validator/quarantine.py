import json
import shutil
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4


@dataclass
class QuarantineEntry:
    id: str
    original_path: str
    original_relative_path: Optional[str]
    quarantined_path: str
    reason: str
    category: str
    timestamp: str
    sha256: Optional[str] = None
    size: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class QuarantineManager:
    QUARANTINE_DIR_NAME = ".quarantine"
    MANIFEST_FILE = "manifest.json"
    
    def __init__(self, quarantine_base: Optional[Path] = None):
        if quarantine_base is None:
            quarantine_base = Path.cwd() / self.QUARANTINE_DIR_NAME
        
        self.quarantine_base = quarantine_base.resolve()
        self.entries: List[QuarantineEntry] = []
        self._load_manifest()
    
    def _load_manifest(self):
        manifest_path = self.quarantine_base / self.MANIFEST_FILE
        if manifest_path.exists():
            try:
                with open(manifest_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.entries = []
                    for entry_data in data.get("entries", []):
                        self.entries.append(QuarantineEntry(**entry_data))
            except (json.JSONDecodeError, KeyError, TypeError):
                self.entries = []
    
    def _save_manifest(self):
        self.quarantine_base.mkdir(parents=True, exist_ok=True)
        manifest_path = self.quarantine_base / self.MANIFEST_FILE
        
        manifest = {
            "quarantine_base": str(self.quarantine_base),
            "generated_at": datetime.now().isoformat(),
            "entries": [asdict(entry) for entry in self.entries],
        }
        
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
    
    def get_manifest_path(self) -> Path:
        return self.quarantine_base / self.MANIFEST_FILE
    
    def quarantine(
        self,
        source_path: Path,
        reason: str,
        category: str = "unknown",
        original_base: Optional[Path] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[Path]:
        source_path = source_path.resolve()
        
        if not source_path.exists():
            return None
        
        if not source_path.is_file():
            return None
        
        entry_id = str(uuid4())[:8]
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_filename = source_path.name.replace("/", "_").replace("\\", "_")
        target_filename = f"{timestamp}_{entry_id}_{safe_filename}"
        
        category_dir = self.quarantine_base / category
        category_dir.mkdir(parents=True, exist_ok=True)
        
        target_path = category_dir / target_filename
        
        shutil.copy2(source_path, target_path)
        
        import hashlib
        sha256_hash = hashlib.sha256()
        with open(source_path, "rb") as f:
            for byte_block in iter(lambda: f.read(8192), b""):
                sha256_hash.update(byte_block)
        sha256 = sha256_hash.hexdigest()
        
        original_relative_path = None
        if original_base:
            original_base = original_base.resolve()
            try:
                original_relative_path = str(source_path.relative_to(original_base))
            except ValueError:
                pass
        
        entry = QuarantineEntry(
            id=entry_id,
            original_path=str(source_path),
            original_relative_path=original_relative_path,
            quarantined_path=str(target_path),
            reason=reason,
            category=category,
            timestamp=datetime.now().isoformat(),
            sha256=sha256,
            size=source_path.stat().st_size,
            metadata=metadata or {},
        )
        
        self.entries.append(entry)
        self._save_manifest()
        
        return target_path
    
    def restore(self, entry_id: str, target_path: Optional[Path] = None) -> bool:
        entry = self._find_entry(entry_id)
        if not entry:
            return False
        
        quarantined_file = Path(entry.quarantined_path)
        if not quarantined_file.exists():
            return False
        
        if target_path is None:
            target_path = Path(entry.original_path)
        
        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(quarantined_file, target_path)
        
        return True
    
    def remove(self, entry_id: str) -> bool:
        entry = self._find_entry(entry_id)
        if not entry:
            return False
        
        quarantined_file = Path(entry.quarantined_path)
        if quarantined_file.exists():
            quarantined_file.unlink()
        
        self.entries = [e for e in self.entries if e.id != entry_id]
        self._save_manifest()
        
        return True
    
    def list_entries(
        self,
        category: Optional[str] = None,
        since: Optional[str] = None,
    ) -> List[QuarantineEntry]:
        filtered = self.entries
        
        if category:
            filtered = [e for e in filtered if e.category == category]
        
        if since:
            try:
                since_dt = datetime.fromisoformat(since)
                filtered = [
                    e for e in filtered
                    if datetime.fromisoformat(e.timestamp) >= since_dt
                ]
            except (ValueError, TypeError):
                pass
        
        return filtered
    
    def _find_entry(self, entry_id: str) -> Optional[QuarantineEntry]:
        for entry in self.entries:
            if entry.id == entry_id:
                return entry
        return None
    
    def get_summary(self) -> Dict[str, Any]:
        category_counts: Dict[str, int] = {}
        for entry in self.entries:
            category_counts[entry.category] = category_counts.get(entry.category, 0) + 1
        
        return {
            "quarantine_base": str(self.quarantine_base),
            "total_entries": len(self.entries),
            "categories": category_counts,
            "manifest_path": str(self.get_manifest_path()),
        }
