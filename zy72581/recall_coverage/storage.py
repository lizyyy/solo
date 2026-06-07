import json
import os
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime

from .models import (
    EvalSlice, CoverageGapRecord, FeatureSnapshot,
    ThresholdReplayResult, SliceSource, RecordStatus
)


class DataStore:
    def __init__(self, base_dir: str = "./data"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

        self.slices_file = self.base_dir / "slices.json"
        self.gaps_file = self.base_dir / "gaps.json"
        self.snapshots_file = self.base_dir / "snapshots.json"
        self.replays_file = self.base_dir / "replays.json"

        self._init_files()

    def _init_files(self):
        for f in [self.slices_file, self.gaps_file, self.snapshots_file, self.replays_file]:
            if not f.exists():
                f.write_text("[]")

    def _load_json(self, filepath: Path) -> List[Dict[str, Any]]:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_json(self, filepath: Path, data: List[Dict[str, Any]]):
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    def import_slice(self, slice_data: Dict[str, Any]) -> EvalSlice:
        slices = self._load_json(self.slices_file)
        new_slice = EvalSlice(
            slice_id=slice_data.get("slice_id", f"slice_{len(slices) + 1:04d}"),
            slice_name=slice_data["slice_name"],
            category=slice_data["category"],
            total_samples=slice_data["total_samples"],
            positive_samples=slice_data["positive_samples"],
            negative_samples=slice_data["negative_samples"],
            recall=slice_data["recall"],
            precision=slice_data.get("precision", 0.0),
            source=SliceSource(slice_data.get("source", "initial_import")),
            feature_snapshot_id=slice_data.get("feature_snapshot_id"),
            parent_slice_id=slice_data.get("parent_slice_id"),
            note=slice_data.get("note")
        )
        slices.append(new_slice.__dict__)
        self._save_json(self.slices_file, slices)
        return new_slice

    def _parse_slice(self, item: Dict[str, Any]) -> EvalSlice:
        if isinstance(item.get("source"), str):
            item["source"] = SliceSource(item["source"])
        if isinstance(item.get("created_at"), str):
            item["created_at"] = datetime.fromisoformat(item["created_at"])
        return EvalSlice(**item)

    def list_slices(self) -> List[EvalSlice]:
        data = self._load_json(self.slices_file)
        return [self._parse_slice(item) for item in data]

    def get_slice(self, slice_id: str) -> Optional[EvalSlice]:
        for s in self.list_slices():
            if s.slice_id == slice_id:
                return s
        return None

    def update_slice_feature_snapshot(self, slice_id: str, snapshot_id: str) -> Optional[EvalSlice]:
        slices = self._load_json(self.slices_file)
        for item in slices:
            if item["slice_id"] == slice_id:
                item["feature_snapshot_id"] = snapshot_id
                self._save_json(self.slices_file, slices)
                return EvalSlice(**item)
        return None

    def save_gap_record(self, gap: CoverageGapRecord):
        gaps = self._load_json(self.gaps_file)
        gaps.append(gap.__dict__)
        self._save_json(self.gaps_file, gaps)

    def _parse_gap(self, item: Dict[str, Any]) -> CoverageGapRecord:
        if isinstance(item.get("status"), str):
            item["status"] = RecordStatus(item["status"])
        if isinstance(item.get("created_at"), str):
            item["created_at"] = datetime.fromisoformat(item["created_at"])
        return CoverageGapRecord(**item)

    def list_gap_records(self) -> List[CoverageGapRecord]:
        data = self._load_json(self.gaps_file)
        return [self._parse_gap(item) for item in data]

    def get_gap_record(self, record_id: str) -> Optional[CoverageGapRecord]:
        for g in self.list_gap_records():
            if g.record_id == record_id:
                return g
        return None

    def update_gap_status(self, record_id: str, status: RecordStatus, note: Optional[str] = None):
        gaps = self._load_json(self.gaps_file)
        for item in gaps:
            if item["record_id"] == record_id:
                item["status"] = status
                if note:
                    if status == RecordStatus.FIXED:
                        item["fixed_note"] = note
                    elif status == RecordStatus.NEED_REVIEW:
                        item["review_note"] = note
                self._save_json(self.gaps_file, gaps)
                return
        raise ValueError(f"Gap record {record_id} not found")

    def save_feature_snapshot(self, snapshot: FeatureSnapshot):
        snapshots = self._load_json(self.snapshots_file)
        snapshots.append(snapshot.__dict__)
        self._save_json(self.snapshots_file, snapshots)

    def _parse_snapshot(self, item: Dict[str, Any]) -> FeatureSnapshot:
        if isinstance(item.get("created_at"), str):
            item["created_at"] = datetime.fromisoformat(item["created_at"])
        return FeatureSnapshot(**item)

    def list_feature_snapshots(self) -> List[FeatureSnapshot]:
        data = self._load_json(self.snapshots_file)
        return [self._parse_snapshot(item) for item in data]

    def get_feature_snapshot(self, snapshot_id: str) -> Optional[FeatureSnapshot]:
        for s in self.list_feature_snapshots():
            if s.snapshot_id == snapshot_id:
                return s
        return None

    def save_threshold_replay(self, replay: ThresholdReplayResult):
        replays = self._load_json(self.replays_file)
        replays.append(replay.__dict__)
        self._save_json(self.replays_file, replays)

    def _parse_replay(self, item: Dict[str, Any]) -> ThresholdReplayResult:
        if isinstance(item.get("created_at"), str):
            item["created_at"] = datetime.fromisoformat(item["created_at"])
        return ThresholdReplayResult(**item)

    def list_threshold_replays(self, slice_id: Optional[str] = None) -> List[ThresholdReplayResult]:
        data = self._load_json(self.replays_file)
        results = [self._parse_replay(item) for item in data]
        if slice_id:
            results = [r for r in results if r.slice_id == slice_id]
        return results

    def clear_all(self):
        for f in [self.slices_file, self.gaps_file, self.snapshots_file, self.replays_file]:
            f.write_text("[]")
