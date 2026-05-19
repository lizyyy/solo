import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from .models import TranslationEntry, MemoryDB, EntryStatus, RollbackReason


class ImportResult:
    def __init__(self):
        self.success_count = 0
        self.duplicate_count = 0
        self.invalid_count = 0
        self.skipped_entries: List[Dict[str, Any]] = []
        self.imported_entries: List[Dict[str, Any]] = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success_count": self.success_count,
            "duplicate_count": self.duplicate_count,
            "invalid_count": self.invalid_count,
            "skipped_entries": self.skipped_entries,
            "imported_entries": self.imported_entries
        }


class RollbackResult:
    def __init__(self):
        self.rollback_count = 0
        self.not_found_count = 0
        self.rollbacked_entries: List[Dict[str, Any]] = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rollback_count": self.rollback_count,
            "not_found_count": self.not_found_count,
            "rollbacked_entries": self.rollbacked_entries
        }


class TranslationMemoryEngine:
    def __init__(self, db_path: str = "memory_db.json"):
        self.db = MemoryDB(db_path)

    def validate_entry(self, entry_data: Dict[str, Any]) -> tuple[bool, List[str]]:
        errors = []
        required_fields = ["key", "source_lang", "target_lang", "source_text", "target_text", "version_batch"]
        
        for field in required_fields:
            if field not in entry_data or not entry_data[field]:
                errors.append(f"Missing or empty required field: {field}")
        
        if "source_lang" in entry_data and len(entry_data["source_lang"]) != 2:
            errors.append("source_lang must be 2-letter code")
            
        if "target_lang" in entry_data and len(entry_data["target_lang"]) != 2:
            errors.append("target_lang must be 2-letter code")
        
        return len(errors) == 0, errors

    def import_entry(self, entry_data: Dict[str, Any]) -> tuple[bool, Optional[str], Optional[TranslationEntry]]:
        is_valid, errors = self.validate_entry(entry_data)
        if not is_valid:
            return False, "; ".join(errors), None

        entry = TranslationEntry(**entry_data)
        
        if self.db.is_imported(entry.import_id):
            return True, "duplicate", None
        
        success = self.db.add_entry(entry)
        if success:
            return True, None, entry
        return False, "Failed to add entry", None

    def import_from_file(self, file_path: str) -> ImportResult:
        result = ImportResult()
        path = Path(file_path)
        
        if not path.exists():
            result.invalid_count = -1
            return result
        
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        entries = data if isinstance(data, list) else [data]
        
        for entry_data in entries:
            is_valid, errors = self.validate_entry(entry_data)
            if not is_valid:
                result.invalid_count += 1
                result.skipped_entries.append({
                    "entry": entry_data,
                    "reason": "; ".join(errors) if isinstance(errors, list) else errors
                })
                continue
            
            entry = TranslationEntry(**entry_data)
            
            if self.db.is_imported(entry.import_id):
                result.duplicate_count += 1
                result.skipped_entries.append({
                    "entry": entry_data,
                    "reason": "duplicate_import"
                })
                continue
            
            success = self.db.add_entry(entry)
            if success:
                result.success_count += 1
                result.imported_entries.append(entry.to_dict())
            else:
                result.invalid_count += 1
        
        return result

    def rollback_by_key(self, key: str, source_lang: str, target_lang: str, 
                        reason: RollbackReason, note: str = "", 
                        rollback_batch: str = "") -> RollbackResult:
        result = RollbackResult()
        entry = self.db.rollback_entry(key, source_lang, target_lang, reason, note, rollback_batch)
        if entry:
            result.rollback_count = 1
            result.rollbacked_entries.append(entry.to_dict())
        else:
            result.not_found_count = 1
        return result

    def rollback_by_batch(self, version_batch: str, reason: RollbackReason, 
                          note: str = "", rollback_batch: str = "") -> RollbackResult:
        result = RollbackResult()
        all_entries = self.db.get_all_entries()
        
        for entry in all_entries:
            if entry.version_batch == version_batch and entry.status == EntryStatus.ACTIVE:
                rolled_back = self.db.rollback_entry(
                    entry.key, entry.source_lang, entry.target_lang,
                    reason, note, rollback_batch
                )
                if rolled_back:
                    result.rollback_count += 1
                    result.rollbacked_entries.append(rolled_back.to_dict())
        
        return result

    def check_consistency(self) -> Dict[str, Any]:
        conflicts = self.db.find_conflicts()
        all_entries = self.db.get_all_entries()
        
        active_entries = [e for e in all_entries if e.status == EntryStatus.ACTIVE]
        rollbacked_entries = [e for e in all_entries if e.status == EntryStatus.ROLLBACKED]
        
        stats = {
            "total_entries": len(all_entries),
            "active_entries": len(active_entries),
            "rollbacked_entries": len(rollbacked_entries),
            "conflict_count": len(conflicts),
            "conflicts": [],
            "rollbacked_summary": []
        }
        
        for conflict in conflicts:
            stats["conflicts"].append({
                "key": conflict["key"],
                "source_lang": conflict["source_lang"],
                "target_lang": conflict["target_lang"],
                "active_count": conflict["active_count"],
                "versions": [
                    {
                        "version_batch": e.version_batch,
                        "target_text": e.target_text,
                        "created_at": e.created_at
                    }
                    for e in conflict["entries"]
                ]
            })
        
        rollback_groups: Dict[str, List[TranslationEntry]] = {}
        for entry in rollbacked_entries:
            rb_batch = entry.rollback_batch or "unknown"
            if rb_batch not in rollback_groups:
                rollback_groups[rb_batch] = []
            rollback_groups[rb_batch].append(entry)
        
        for rb_batch, entries in rollback_groups.items():
            stats["rollbacked_summary"].append({
                "rollback_batch": rb_batch,
                "count": len(entries),
                "reasons": list(set(e.rollback_reason.value for e in entries if e.rollback_reason))
            })
        
        return stats

    def generate_report(self, output_format: str = "json") -> Any:
        consistency = self.check_consistency()
        
        if output_format == "json":
            return consistency
        
        return consistency

    def get_entry_history(self, key: str, source_lang: str, target_lang: str) -> List[Dict[str, Any]]:
        entries = self.db.get_entries(key, source_lang, target_lang)
        return [e.to_dict() for e in entries]

    def search_entries(self, keyword: str = "", status: Optional[EntryStatus] = None,
                      source_lang: Optional[str] = None, 
                      target_lang: Optional[str] = None) -> List[Dict[str, Any]]:
        all_entries = self.db.get_all_entries()
        results = []
        
        for entry in all_entries:
            if status and entry.status != status:
                continue
            if source_lang and entry.source_lang != source_lang:
                continue
            if target_lang and entry.target_lang != target_lang:
                continue
            if keyword and keyword not in entry.key and keyword not in entry.source_text:
                continue
            results.append(entry.to_dict())
        
        return results
