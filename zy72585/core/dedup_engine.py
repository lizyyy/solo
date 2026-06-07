import hashlib
from typing import Any, Dict, List, Tuple
from models.candidate import CandidateRecord, CandidateTable


class DedupEngine:
    def __init__(self):
        self._global_record_hashes: Dict[str, str] = {}
        self._table_hashes: Dict[str, str] = {}

    @staticmethod
    def compute_record_hash(features: Dict[str, float], record_id: str = "") -> str:
        data = {
            "record_id": record_id,
            "features": dict(sorted(features.items())),
        }
        return hashlib.sha256(str(data).encode()).hexdigest()

    @staticmethod
    def compute_table_hash(records: List[CandidateRecord]) -> str:
        hashes = sorted([rec.get_record_hash() for rec in records])
        return hashlib.sha256("|".join(hashes).encode()).hexdigest()

    def check_record_duplicate(self, record: CandidateRecord) -> Tuple[bool, str]:
        rec_hash = record.get_record_hash()
        if rec_hash in self._global_record_hashes:
            return True, self._global_record_hashes[rec_hash]
        return False, ""

    def register_record(self, record: CandidateRecord) -> None:
        rec_hash = record.get_record_hash()
        self._global_record_hashes[rec_hash] = record.record_id

    def safe_import_records(
        self,
        table: CandidateTable,
        records: List[CandidateRecord],
        operator: str,
        reason: str = ""
    ) -> Dict[str, Any]:
        result = {
            "total_input": len(records),
            "global_duplicates": [],
            "table_duplicates": [],
            "imported": [],
        }

        for rec in records:
            is_global_dup, existing_id = self.check_record_duplicate(rec)
            if is_global_dup:
                result["global_duplicates"].append({
                    "record_id": rec.record_id,
                    "existing_id": existing_id,
                })
                continue

            added = table.add_record(rec, operator, reason)
            if added:
                self.register_record(rec)
                result["imported"].append(rec.record_id)
            else:
                result["table_duplicates"].append(rec.record_id)

        result["imported_count"] = len(result["imported"])
        result["global_dup_count"] = len(result["global_duplicates"])
        result["table_dup_count"] = len(result["table_duplicates"])
        return result
