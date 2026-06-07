import uuid
from datetime import datetime
from typing import List, Optional
from .models import (
    ExperimentComparison,
    DriftRecord,
    Status,
    NextOwner,
    BucketDiff,
)


class ExperimentManager:
    def __init__(self):
        self.experiments: dict = {}

    def create_experiment(
        self,
        name: str,
        drift_records: List[DriftRecord],
        baseline_version: str = "",
        current_version: str = "",
        notes: str = "",
    ) -> ExperimentComparison:
        exp = ExperimentComparison(
            experiment_id=str(uuid.uuid4()),
            experiment_name=name,
            drift_records=drift_records,
            baseline_version=baseline_version,
            current_version=current_version,
            notes=notes,
        )
        self.experiments[exp.experiment_id] = exp
        return exp

    def get_experiment(self, experiment_id: str) -> Optional[ExperimentComparison]:
        return self.experiments.get(experiment_id)

    def update_record_status(
        self,
        experiment_id: str,
        record_id: str,
        status: Status,
        review_notes: str = "",
        reviewed_by: str = "",
    ) -> Optional[DriftRecord]:
        exp = self.experiments.get(experiment_id)
        if not exp:
            return None

        for record in exp.drift_records:
            if record.record_id == record_id:
                record.status = status
                record.updated_at = datetime.now()
                if review_notes:
                    record.review_notes = review_notes

                if status == Status.REVIEWED_BY_OP:
                    record.missing_materials = [
                        m for m in record.missing_materials if "复核意见" not in m
                    ]
                    if not record.missing_materials and len(record.recall_candidates) > 0:
                        record.next_owner = NextOwner.ALGORITHM
                    elif not record.missing_materials:
                        record.next_owner = NextOwner.OPERATION

                if status == Status.CONFIRMED_NORMAL:
                    record.why_kept += f" | 已由{reviewed_by}确认为正常"
                elif status == Status.NEEDS_INVESTIGATION:
                    record.why_kept += f" | 需要进一步调查"
                    record.next_owner = NextOwner.ALGORITHM

                return record
        return None

    def add_records_to_experiment(
        self, experiment_id: str, new_records: List[DriftRecord]
    ) -> bool:
        exp = self.experiments.get(experiment_id)
        if not exp:
            return False
        exp.drift_records.extend(new_records)
        return True

    def generate_report(self, experiment_id: str) -> dict:
        exp = self.experiments.get(experiment_id)
        if not exp:
            return {}

        one_bucket_count = sum(
            1 for r in exp.drift_records if r.bucket_diff == BucketDiff.ONE_BUCKET
        )
        multi_bucket_count = sum(
            1 for r in exp.drift_records if r.bucket_diff == BucketDiff.MULTI_BUCKET
        )
        pending_count = sum(
            1 for r in exp.drift_records if r.status == Status.PENDING_REVIEW
        )
        reviewed_count = sum(
            1 for r in exp.drift_records if r.status == Status.REVIEWED_BY_OP
        )
        supplemented_count = sum(
            1 for r in exp.drift_records if r.status == Status.SUPPLEMENTED_BY_ALGO
        )

        report = {
            "experiment_id": exp.experiment_id,
            "experiment_name": exp.experiment_name,
            "baseline_version": exp.baseline_version,
            "current_version": exp.current_version,
            "total_records": len(exp.drift_records),
            "one_bucket_diff_count": one_bucket_count,
            "multi_bucket_diff_count": multi_bucket_count,
            "pending_review": pending_count,
            "reviewed_by_op": reviewed_count,
            "supplemented_by_algo": supplemented_count,
            "details": [],
        }

        for record in exp.drift_records:
            report["details"].append(
                {
                    "record_id": record.record_id,
                    "sample_id": record.sample_id,
                    "offline_bucket": record.offline_bucket,
                    "online_bucket": record.online_bucket,
                    "bucket_diff": record.bucket_diff.value,
                    "status": record.status.value,
                    "why_kept": record.why_kept,
                    "missing_materials": record.missing_materials,
                    "next_owner": record.next_owner.value,
                    "recall_candidates_count": len(record.recall_candidates),
                    "review_notes": record.review_notes,
                }
            )

        return report

    def get_one_bucket_records(self, experiment_id: str) -> List[DriftRecord]:
        exp = self.experiments.get(experiment_id)
        if not exp:
            return []
        return [r for r in exp.drift_records if r.bucket_diff == BucketDiff.ONE_BUCKET]

    def load_experiment_from_report(self, report_data: dict) -> ExperimentComparison:
        from datetime import datetime

        records = []
        for d in report_data.get("details", []):
            record = DriftRecord(
                record_id=d["record_id"],
                sample_id=d["sample_id"],
                offline_bucket=d["offline_bucket"],
                online_bucket=d["online_bucket"],
                bucket_diff=BucketDiff(d["bucket_diff"]),
                offline_score=0,
                online_score=0,
                status=Status(d["status"]),
                why_kept=d.get("why_kept", ""),
                missing_materials=d.get("missing_materials", []),
                next_owner=NextOwner(d["next_owner"]),
                review_notes=d.get("review_notes", ""),
                recall_candidates=[],
                updated_at=datetime.now(),
            )
            records.append(record)

        exp = ExperimentComparison(
            experiment_id=report_data.get("experiment_id", str(uuid.uuid4())),
            experiment_name=report_data.get("experiment_name", "已加载实验"),
            drift_records=records,
            baseline_version=report_data.get("baseline_version", ""),
            current_version=report_data.get("current_version", ""),
            notes=report_data.get("notes", ""),
        )
        self.experiments[exp.experiment_id] = exp
        return exp
