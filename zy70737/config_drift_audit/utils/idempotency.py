import json
import hashlib
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Optional, Set
from datetime import datetime

from ..models import ConfigItem, ExemptionRecord, AuditResult
from ..parsers import ParseResult


@dataclass
class RunHistory:
    run_id: str
    timestamp: str
    config_items_hash: str
    exemptions_hash: str
    record_count: int
    drift_count: int
    bad_rows_count: int
    file_paths: List[str]


class IdempotencyManager:
    def __init__(self, cache_dir: Optional[str] = None):
        if cache_dir is None:
            cache_dir = Path.home() / ".config_drift_audit" / "cache"
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.history_file = self.cache_dir / "run_history.json"
        self._history: Dict[str, RunHistory] = self._load_history()

    def _load_history(self) -> Dict[str, RunHistory]:
        if not self.history_file.exists():
            return {}
        try:
            with open(self.history_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return {k: RunHistory(**v) for k, v in data.items()}
        except Exception:
            return {}

    def _save_history(self) -> None:
        data = {k: asdict(v) for k, v in self._history.items()}
        with open(self.history_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def compute_input_hash(
        self,
        config_items: ParseResult[ConfigItem],
        exemptions: ParseResult[ExemptionRecord],
    ) -> str:
        config_hashes = sorted([item.row_hash for item in config_items.items])
        exemption_hashes = sorted([ex.exemption_id for ex in exemptions.items])

        combined = json.dumps({
            'configs': config_hashes,
            'exemptions': exemption_hashes,
            'config_file': config_items.file_path,
            'exemption_file': exemptions.file_path,
        }, sort_keys=True)

        return hashlib.sha256(combined.encode('utf-8')).hexdigest()

    def get_previous_run(self, input_hash: str) -> Optional[RunHistory]:
        return self._history.get(input_hash)

    def record_run(
        self,
        input_hash: str,
        run_id: str,
        config_items: ParseResult[ConfigItem],
        exemptions: ParseResult[ExemptionRecord],
        audit_result: AuditResult,
    ) -> None:
        history = RunHistory(
            run_id=run_id,
            timestamp=datetime.now().isoformat(),
            config_items_hash=input_hash,
            exemptions_hash=input_hash,
            record_count=audit_result.summary.total_records,
            drift_count=audit_result.summary.drifted_records,
            bad_rows_count=audit_result.summary.bad_rows_count,
            file_paths=[config_items.file_path, exemptions.file_path],
        )
        self._history[input_hash] = history
        self._save_history()

    def is_duplicate_run(
        self,
        config_items: ParseResult[ConfigItem],
        exemptions: ParseResult[ExemptionRecord],
    ) -> tuple[bool, Optional[RunHistory]]:
        input_hash = self.compute_input_hash(config_items, exemptions)
        previous = self.get_previous_run(input_hash)
        return (previous is not None, previous)

    def deduplicate_config_items(
        self,
        items: List[ConfigItem],
    ) -> List[ConfigItem]:
        seen: Set[str] = set()
        result: List[ConfigItem] = []
        for item in items:
            if item.row_hash not in seen:
                seen.add(item.row_hash)
                result.append(item)
        return result

    def deduplicate_exemptions(
        self,
        exemptions: List[ExemptionRecord],
    ) -> List[ExemptionRecord]:
        seen: Set[str] = set()
        result: List[ExemptionRecord] = []
        for exemption in exemptions:
            if exemption.exemption_id not in seen:
                seen.add(exemption.exemption_id)
                result.append(exemption)
        return result

    def clear_history(self) -> None:
        self._history.clear()
        if self.history_file.exists():
            self.history_file.unlink()

    def get_recent_runs(self, limit: int = 10) -> List[RunHistory]:
        runs = sorted(
            self._history.values(),
            key=lambda x: x.timestamp,
            reverse=True
        )
        return runs[:limit]
