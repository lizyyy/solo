from typing import List, Dict, Any
from .models import (
    CheckSession,
    FeatureRecord,
    ConflictEvidence,
    CheckParameters,
    RecordStatus,
)


class UnifiedResultStore:
    def __init__(self, session: CheckSession):
        self.session = session

    def _record_to_dict(self, record: FeatureRecord) -> Dict[str, Any]:
        return {
            "feature_id": record.feature_id,
            "feature_name": record.feature_name,
            "bucket_id": record.bucket_id,
            "sample_id": record.sample_id,
            "feature_value": record.feature_value,
            "default_value_used": record.default_value_used,
            "time_window_start": record.time_window_start.isoformat() if record.time_window_start else None,
            "time_window_end": record.time_window_end.isoformat() if record.time_window_end else None,
            "feature_timestamp": record.feature_timestamp.isoformat() if record.feature_timestamp else None,
            "is_leakage": record.is_leakage,
            "status": record.status.value,
            "notes": record.notes,
        }

    def _conflict_to_dict(self, conflict: ConflictEvidence) -> Dict[str, Any]:
        return {
            "record_id": conflict.record_id,
            "bucket_value": conflict.bucket_value,
            "negative_value": conflict.negative_value,
            "description": conflict.description,
            "resolution": conflict.resolution.value,
            "resolved_by": conflict.resolved_by,
            "resolved_at": conflict.resolved_at.isoformat() if conflict.resolved_at else None,
        }

    def get_all_records_for_page(self) -> List[Dict[str, Any]]:
        all_records = self.session.bucket_records + self.session.negative_records
        return [self._record_to_dict(r) for r in all_records]

    def get_all_records_for_api(self) -> List[Dict[str, Any]]:
        return self.get_all_records_for_page()

    def get_all_records_for_export(self) -> List[Dict[str, Any]]:
        return self.get_all_records_for_page()

    def get_conflicts_for_page(self) -> List[Dict[str, Any]]:
        return [self._conflict_to_dict(c) for c in self.session.conflicts]

    def get_conflicts_for_api(self) -> List[Dict[str, Any]]:
        return self.get_conflicts_for_page()

    def get_conflicts_for_export(self) -> List[Dict[str, Any]]:
        return self.get_conflicts_for_page()

    def get_summary_data(self) -> Dict[str, Any]:
        all_records = self.session.bucket_records + self.session.negative_records
        status_counts = {}
        for status in RecordStatus:
            status_counts[status.value] = sum(1 for r in all_records if r.status == status)

        return {
            "session_id": self.session.session_id,
            "current_step": self.session.current_step.value,
            "total_records": len(all_records),
            "bucket_count": len(self.session.bucket_records),
            "negative_count": len(self.session.negative_records),
            "conflict_count": len(self.session.conflicts),
            "status_counts": status_counts,
            "parameters": {
                "time_window_gap_hours": self.session.parameters.time_window_gap_hours,
                "leakage_threshold_ratio": self.session.parameters.leakage_threshold_ratio,
                "default_fill_strategy": self.session.parameters.default_fill_strategy,
                "parameter_version": self.session.parameters.parameter_version,
                "rationale": self.session.parameters.rationale,
            },
            "summary": self.session.summary,
            "is_locked": self.session.is_locked,
            "reviewer": self.session.reviewer,
            "self_check_results": [
                {
                    "check_type": r.check_type,
                    "passed": r.passed,
                    "details": r.details,
                    "found_issues": r.found_issues,
                }
                for r in self.session.self_check_results
            ],
        }
