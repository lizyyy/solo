import json
import os
from datetime import datetime
from typing import Dict, List, Optional

from .models.models import (
    Artifact,
    ArtifactGrade,
    ReconciliationRecord,
    ReconciliationStatus,
    ReviewStatus,
    TransportRecord,
    InsurancePolicy,
)
from .importers.importer import DataImporter
from .engine.comparator import ReconciliationEngine
from .review.reviewer import ReviewManager
from .report.reporter import ReportGenerator


class ReconciliationService:
    def __init__(self):
        self.importer = DataImporter()
        self.engine = ReconciliationEngine()
        self.reviewer = ReviewManager()
        self.reporter = ReportGenerator()
        self._initialized = False

    def initialize(
        self,
        csv_path: str,
        transport_json_path: str,
        insurance_json_path: str,
    ) -> dict:
        self.importer.import_all(csv_path, transport_json_path, insurance_json_path)

        self.engine.reconcile(
            self.importer.artifacts,
            self.importer.transports,
            self.importer.insurance_policies,
        )

        self._initialized = True

        return self.get_dashboard()

    def initialize_with_data(
        self,
        artifacts: Dict[str, Artifact],
        transports: Dict[str, TransportRecord],
        policies: Dict[str, InsurancePolicy],
    ) -> dict:
        self.importer.artifacts = artifacts
        self.importer.transports = transports
        self.importer.insurance_policies = policies

        self.engine.reconcile(artifacts, transports, policies)

        self._initialized = True
        return self.get_dashboard()

    def get_dashboard(self) -> dict:
        summary = self.engine.get_summary()
        pending = self.reviewer.get_pending_reviews(self.engine.records)
        return {
            "status": "success",
            "initialized": self._initialized,
            "import_batch": self.importer.import_batch,
            "reconciliation_batch": self.engine.reconciliation_batch,
            "summary": summary,
            "pending_reviews": pending,
        }

    def get_record_detail(self, artifact_id: str) -> dict:
        if artifact_id not in self.engine.records:
            return {"status": "error", "message": f"未找到记录: {artifact_id}"}

        record = self.engine.records[artifact_id]
        detail = self.reporter.generate_detail_report(record)
        guidance = self.reviewer.get_review_guidance(record)

        return {
            "status": "success",
            "detail": detail,
            "review_guidance": guidance,
        }

    def get_all_records(self) -> dict:
        records = []
        for artifact_id in sorted(self.engine.records.keys()):
            record = self.engine.records[artifact_id]
            records.append({
                "artifact_id": record.artifact_id,
                "artifact_name": record.artifact_name,
                "grade": record.artifact_grade.value if record.artifact_grade else "未分级",
                "status": record.status.value,
                "discrepancy_count": len(record.discrepancies),
                "critical_count": sum(1 for d in record.discrepancies if d.severity == "critical"),
                "has_review_decision": record.review_decision is not None,
                "review_status": (
                    record.review_decision.decision.value
                    if record.review_decision
                    else None
                ),
            })

        return {
            "status": "success",
            "records": records,
            "total": len(records),
        }

    def review_record(
        self,
        artifact_id: str,
        decision: str,
        reviewer: str,
        comments: str = "",
        required_actions: str = "",
        manual_fix_fields: Optional[List[str]] = None,
    ) -> dict:
        if artifact_id not in self.engine.records:
            return {"status": "error", "message": f"未找到记录: {artifact_id}"}

        record = self.engine.records[artifact_id]

        self.reviewer.make_decision(
            record, decision, reviewer, comments, required_actions, manual_fix_fields
        )

        self.reporter.invalidate_cache(artifact_id)

        return self.get_record_detail(artifact_id)

    def correct_field(
        self,
        artifact_id: str,
        field: str,
        value,
        reviewer: str,
        reason: str,
    ) -> dict:
        if artifact_id not in self.engine.records:
            return {"status": "error", "message": f"未找到记录: {artifact_id}"}

        record = self.engine.records[artifact_id]

        self.reviewer.correct_artifact_field(record, field, value, reviewer, reason)

        self.engine.update_record_field(artifact_id, field, value, reviewer, reason)

        self.reporter.invalidate_cache(artifact_id)

        return self.get_record_detail(artifact_id)

    def generate_reports(self, output_dir: str) -> dict:
        os.makedirs(output_dir, exist_ok=True)

        json_report = self.reporter.generate_export_report(
            self.engine.records, output_dir
        )
        csv_summary = self.reporter.export_csv(self.engine.records, output_dir)
        csv_discrepancies = self.reporter.export_discrepancy_details(
            self.engine.records, output_dir
        )

        return {
            "status": "success",
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "reports": {
                "json_report": json_report,
                "csv_summary": csv_summary,
                "csv_discrepancies": csv_discrepancies,
            },
        }

    def get_summary(self) -> dict:
        return self.reporter.generate_summary(self.engine.records)

    def get_import_info(self) -> dict:
        return self.importer.get_import_summary()

    def run_full_reconciliation(
        self,
        csv_path: str,
        transport_json_path: str,
        insurance_json_path: str,
        output_dir: str,
    ) -> dict:
        init_result = self.initialize(csv_path, transport_json_path, insurance_json_path)

        reports = self.generate_reports(output_dir)

        return {
            "status": "success",
            "initialization": init_result,
            "reports": reports,
            "completed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }