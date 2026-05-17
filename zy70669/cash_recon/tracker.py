import hashlib
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime
from .rule_engine import ProcessedRecord


@dataclass
class RecordSignature:
    record_id: str
    hash: str
    first_seen: str
    last_seen: str
    seen_count: int


@dataclass
class TrackingResult:
    is_new: bool
    is_changed: bool
    previous_hash: Optional[str]
    current_hash: str
    signature: RecordSignature


class SourceTracker:
    def __init__(self, tracking_file: str = ".cash_recon_tracking.json"):
        self.tracking_file = Path(tracking_file)
        self.signatures: Dict[str, RecordSignature] = {}
        self._load_tracking_data()

    def _load_tracking_data(self):
        if self.tracking_file.exists():
            try:
                with open(self.tracking_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for record_id, sig_data in data.items():
                        self.signatures[record_id] = RecordSignature(**sig_data)
            except Exception:
                self.signatures = {}

    def _save_tracking_data(self):
        data = {rid: asdict(sig) for rid, sig in self.signatures.items()}
        with open(self.tracking_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _generate_record_id(self, record: ProcessedRecord) -> str:
        key_parts = [
            str(record.网点编号),
            str(record.日期),
            str(record.来源文件),
            str(record.来源行号)
        ]
        return "|".join(key_parts)

    def _generate_record_hash(self, record: ProcessedRecord) -> str:
        hash_data = {
            "网点编号": record.网点编号,
            "日期": record.日期,
            "账面金额": round(record.账面金额, 2),
            "盘点金额": round(record.盘点金额, 2),
            "备用金余额": round(record.备用金余额, 2),
            "备注": record.备注,
            "原始差异": round(record.原始差异, 2),
            "备用金调整额": round(record.备用金调整额, 2),
            "调整后差异": round(record.调整后差异, 2),
            "差异类型": record.差异类型.value,
        }
        json_str = json.dumps(hash_data, sort_keys=True, ensure_ascii=False)
        return hashlib.md5(json_str.encode('utf-8')).hexdigest()

    def track_record(self, record: ProcessedRecord) -> TrackingResult:
        record_id = self._generate_record_id(record)
        current_hash = self._generate_record_hash(record)
        now = datetime.now().isoformat()

        if record_id not in self.signatures:
            signature = RecordSignature(
                record_id=record_id,
                hash=current_hash,
                first_seen=now,
                last_seen=now,
                seen_count=1
            )
            self.signatures[record_id] = signature
            return TrackingResult(
                is_new=True,
                is_changed=False,
                previous_hash=None,
                current_hash=current_hash,
                signature=signature
            )

        existing = self.signatures[record_id]
        is_changed = existing.hash != current_hash

        existing.hash = current_hash
        existing.last_seen = now
        existing.seen_count += 1

        return TrackingResult(
            is_new=False,
            is_changed=is_changed,
            previous_hash=existing.hash if is_changed else None,
            current_hash=current_hash,
            signature=existing
        )

    def track_records(self, records: List[ProcessedRecord]) -> List[Tuple[ProcessedRecord, TrackingResult]]:
        results = []
        for record in records:
            tracking_result = self.track_record(record)
            results.append((record, tracking_result))
        self._save_tracking_data()
        return results

    def get_stable_records(self, records: List[ProcessedRecord]) -> List[ProcessedRecord]:
        key_func = lambda r: (
            r.来源文件,
            r.来源行号,
            r.网点编号,
            r.日期
        )
        return sorted(records, key=key_func)

    def find_duplicates(self, records: List[ProcessedRecord]) -> Dict[str, List[ProcessedRecord]]:
        groups: Dict[str, List[ProcessedRecord]] = {}
        for record in records:
            record_id = self._generate_record_id(record)
            if record_id not in groups:
                groups[record_id] = []
            groups[record_id].append(record)
        return {k: v for k, v in groups.items() if len(v) > 1}
