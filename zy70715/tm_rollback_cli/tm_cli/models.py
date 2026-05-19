import json
import hashlib
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict, field


class EntryStatus(Enum):
    ACTIVE = "active"
    ROLLBACKED = "rollbacked"
    CONFLICT = "conflict"
    INVALID = "invalid"


class RollbackReason(Enum):
    WRONG_TRANSLATION = "wrong_translation"
    MISTAKE_IMPORT = "mistake_import"
    QUALITY_ISSUE = "quality_issue"
    SOURCE_TEXT_CHANGED = "source_text_changed"
    OTHER = "other"


@dataclass
class TranslationEntry:
    key: str
    source_lang: str
    target_lang: str
    source_text: str
    target_text: str
    version_batch: str
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    status: EntryStatus = EntryStatus.ACTIVE
    rollback_reason: Optional[RollbackReason] = None
    rollback_note: Optional[str] = None
    rollback_batch: Optional[str] = None
    import_id: str = ""

    def __post_init__(self):
        if not self.import_id:
            self.import_id = self._generate_import_id()

    def _generate_import_id(self) -> str:
        content = f"{self.key}:{self.source_lang}:{self.target_lang}:{self.source_text}:{self.target_text}:{self.version_batch}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["status"] = self.status.value
        if self.rollback_reason:
            data["rollback_reason"] = self.rollback_reason.value
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TranslationEntry":
        data["status"] = EntryStatus(data.get("status", "active"))
        if data.get("rollback_reason"):
            data["rollback_reason"] = RollbackReason(data["rollback_reason"])
        return cls(**data)

    def get_unique_key(self) -> str:
        return f"{self.key}:{self.source_lang}:{self.target_lang}"


class MemoryDB:
    def __init__(self, db_path: str = "memory_db.json"):
        self.db_path = Path(db_path)
        self.entries: Dict[str, List[TranslationEntry]] = {}
        self.import_ids: Dict[str, bool] = {}
        self._load()

    def _load(self):
        if self.db_path.exists():
            with open(self.db_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.import_ids = data.get("import_ids", {})
                entries_data = data.get("entries", {})
                self.entries = {
                    k: [TranslationEntry.from_dict(e) for e in v]
                    for k, v in entries_data.items()
                }
        else:
            self.entries = {}
            self.import_ids = {}

    def _save(self):
        data = {
            "import_ids": self.import_ids,
            "entries": {
                k: [e.to_dict() for e in v]
                for k, v in self.entries.items()
            }
        }
        with open(self.db_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def is_imported(self, import_id: str) -> bool:
        return self.import_ids.get(import_id, False)

    def mark_imported(self, import_id: str):
        self.import_ids[import_id] = True
        self._save()

    def add_entry(self, entry: TranslationEntry) -> bool:
        if self.is_imported(entry.import_id):
            return False
        unique_key = entry.get_unique_key()
        if unique_key not in self.entries:
            self.entries[unique_key] = []
        self.entries[unique_key].append(entry)
        self.mark_imported(entry.import_id)
        return True

    def get_entries(self, key: str, source_lang: str, target_lang: str) -> List[TranslationEntry]:
        unique_key = f"{key}:{source_lang}:{target_lang}"
        return self.entries.get(unique_key, [])

    def get_active_entry(self, key: str, source_lang: str, target_lang: str) -> Optional[TranslationEntry]:
        entries = self.get_entries(key, source_lang, target_lang)
        active_entries = [e for e in entries if e.status == EntryStatus.ACTIVE]
        return active_entries[-1] if active_entries else None

    def get_all_entries(self) -> List[TranslationEntry]:
        all_entries = []
        for entry_list in self.entries.values():
            all_entries.extend(entry_list)
        return all_entries

    def rollback_entry(self, key: str, source_lang: str, target_lang: str, 
                      reason: RollbackReason, note: str = "", rollback_batch: str = "") -> Optional[TranslationEntry]:
        active_entry = self.get_active_entry(key, source_lang, target_lang)
        if active_entry:
            active_entry.status = EntryStatus.ROLLBACKED
            active_entry.rollback_reason = reason
            active_entry.rollback_note = note
            active_entry.rollback_batch = rollback_batch
            self._save()
        return active_entry

    def find_conflicts(self) -> List[Dict[str, Any]]:
        conflicts = []
        for unique_key, entries in self.entries.items():
            active_entries = [e for e in entries if e.status == EntryStatus.ACTIVE]
            if len(active_entries) > 1:
                key, source_lang, target_lang = unique_key.split(":", 2)
                conflicts.append({
                    "key": key,
                    "source_lang": source_lang,
                    "target_lang": target_lang,
                    "active_count": len(active_entries),
                    "entries": active_entries
                })
        return conflicts
