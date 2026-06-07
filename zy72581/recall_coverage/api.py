from typing import List, Dict, Any, Optional
from .storage import DataStore
from .analyzer import CoverageAnalyzer
from .replay import ThresholdReplayEngine
from .models import (
    EvalSlice, CoverageGapRecord, FeatureSnapshot,
    ThresholdReplayResult, RecordStatus
)


class RecallCoverageAPI:
    def __init__(self, data_dir: str = "./data"):
        self.store = DataStore(data_dir)
        self.analyzer = CoverageAnalyzer()
        self.replay_engine = ThresholdReplayEngine(self.store)

    def import_eval_slice(self, slice_data: Dict[str, Any]) -> EvalSlice:
        return self.store.import_slice(slice_data)

    def analyze_coverage(self) -> Dict[str, Any]:
        slices = self.store.list_slices()
        if not slices:
            return {"error": "no slices found"}
        records = self.analyzer.analyze(slices)
        for gap in records:
            existing = self.store.get_gap_record(gap.record_id)
            if not existing:
                self.store.save_gap_record(gap)
        report = self.analyzer.generate_report(records, slices)
        return report

    def get_all_slices(self) -> List[EvalSlice]:
        return self.store.list_slices()

    def get_all_gaps(self) -> List[CoverageGapRecord]:
        return self.store.list_gap_records()

    def link_feature_snapshot(self, slice_id: str, snapshot_id: str) -> Optional[EvalSlice]:
        return self.store.update_slice_feature_snapshot(slice_id, snapshot_id)

    def run_threshold_replay(
        self,
        slice_id: str,
        snapshot_id: str,
        is_old_caliber: bool = False,
        note: Optional[str] = None
    ) -> Optional[ThresholdReplayResult]:
        return self.replay_engine.replay_with_snapshot(
            slice_id, snapshot_id, is_old_caliber, note
        )

    def mark_gap_status(
        self,
        record_id: str,
        status: str,
        note: Optional[str] = None
    ):
        status_enum = RecordStatus(status)
        self.store.update_gap_status(record_id, status_enum, note)

    def get_all_snapshots(self) -> List[FeatureSnapshot]:
        return self.store.list_feature_snapshots()

    def get_replay_history(self, slice_id: Optional[str] = None) -> List[ThresholdReplayResult]:
        return self.store.list_threshold_replays(slice_id)

    def run_demo(self) -> Dict[str, Any]:
        from .demo import DemoDataGenerator
        generator = DemoDataGenerator(self.store)
        return generator.run_full_demo()

    def clear_all_data(self):
        self.store.clear_all()
