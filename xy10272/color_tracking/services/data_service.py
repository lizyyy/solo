import json
import os
from typing import Dict, List, Optional, Any
from pathlib import Path
from datetime import datetime
from ..models import (
    SampleRecord,
    SampleComparison,
    TrackingReport,
    generate_id
)


class DataService:
    def __init__(self, base_dir: str = "./data"):
        self.base_dir = Path(base_dir)
        self.records_dir = self.base_dir / "records"
        self.comparisons_dir = self.base_dir / "comparisons"
        self.reports_dir = self.base_dir / "reports"
        self._ensure_directories()

    def _ensure_directories(self):
        for directory in [self.base_dir, self.records_dir, self.comparisons_dir, self.reports_dir]:
            directory.mkdir(parents=True, exist_ok=True)

    def save_record(self, record: SampleRecord) -> str:
        filename = f"{record.sequence_number:03d}_{record.record_id}.json"
        filepath = self.records_dir / record.batch_info.order_id / filename
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(record.to_dict(), f, ensure_ascii=False, indent=2)
        return str(filepath)

    def load_record(self, order_id: str, record_id: str) -> Optional[SampleRecord]:
        order_dir = self.records_dir / order_id
        if not order_dir.exists():
            return None
        for filepath in order_dir.glob(f"*_{record_id}.json"):
            return self._load_record_from_file(filepath)
        return None

    def load_records_by_order(self, order_id: str) -> List[SampleRecord]:
        order_dir = self.records_dir / order_id
        if not order_dir.exists():
            return []
        records = []
        for filepath in sorted(order_dir.glob("*.json")):
            record = self._load_record_from_file(filepath)
            if record:
                records.append(record)
        return sorted(records, key=lambda r: r.sequence_number)

    def _load_record_from_file(self, filepath: Path) -> Optional[SampleRecord]:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            return SampleRecord.from_dict(data)
        except (json.JSONDecodeError, KeyError):
            return None

    def save_comparison(self, comparison: SampleComparison) -> str:
        filename = f"{comparison.comparison_id}.json"
        filepath = self.comparisons_dir / comparison.order_id / filename
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(comparison.to_dict(), f, ensure_ascii=False, indent=2)
        return str(filepath)

    def save_report(self, report: TrackingReport) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"report_{timestamp}_{report.order_id}.json"
        filepath = self.reports_dir / report.order_id / filename
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(report.to_dict(), f, ensure_ascii=False, indent=2)
        return str(filepath)

    def get_next_sequence_number(self, order_id: str) -> int:
        records = self.load_records_by_order(order_id)
        return len(records) + 1

    def list_orders(self) -> List[str]:
        if not self.records_dir.exists():
            return []
        return sorted([d.name for d in self.records_dir.iterdir() if d.is_dir()])

    def get_order_summary(self, order_id: str) -> Dict[str, Any]:
        records = self.load_records_by_order(order_id)
        if not records:
            return {"order_id": order_id, "total_samples": 0}

        deltas = [r.color_delta.delta_e2000 for r in records if r.color_delta]

        return {
            "order_id": order_id,
            "total_samples": len(records),
            "latest_sequence": max(r.sequence_number for r in records),
            "delta_e2000": {
                "min": min(deltas) if deltas else None,
                "max": max(deltas) if deltas else None,
                "avg": sum(deltas) / len(deltas) if deltas else None,
            },
            "latest_status": records[-1].status.value,
        }
