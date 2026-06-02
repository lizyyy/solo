import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

from models import (
    ModelVersion,
    ExplanationReport,
    ExplanationStatus,
    HumanReview,
    Evidence,
    EvidenceType,
)
from storage import Storage


class VersionManager:
    def __init__(self, storage: Storage):
        self.storage = storage

    def register_model_version(
        self,
        version: str,
        threshold_config: Dict[str, float],
        description: str,
    ) -> ModelVersion:
        existing = self.storage.load_model_version(version)
        if existing:
            raise ValueError(
                f"Model version {version} already exists. Version registration is immutable."
            )

        model_version = ModelVersion(
            version=version,
            threshold_config=threshold_config,
            deployed_at=datetime.now().isoformat(),
            description=description,
        )

        self.storage.save_model_version(model_version)
        return model_version

    def update_threshold(
        self,
        version: str,
        new_thresholds: Dict[str, float],
        reason: str,
        operator: str,
    ) -> ModelVersion:
        existing = self.storage.load_model_version(version)
        if not existing:
            raise ValueError(f"Model version {version} not found")

        new_version = ModelVersion(
            version=f"{version}_thr_{uuid.uuid4().hex[:6]}",
            threshold_config=new_thresholds,
            deployed_at=datetime.now().isoformat(),
            description=f"Threshold update from {version}: {reason}. Operator: {operator}. Original thresholds: {existing.threshold_config}",
        )

        self.storage.save_model_version(new_version)
        return new_version

    def list_versions_with_changelog(self) -> List[Dict[str, Any]]:
        versions = self.storage.list_model_versions()
        result = []

        for v in versions:
            mv = self.storage.load_model_version(v)
            if mv:
                reports = self.storage.list_reports_for_model_version(v)
                result.append(
                    {
                        "version": mv.version,
                        "deployed_at": mv.deployed_at,
                        "description": mv.description,
                        "threshold_config": mv.threshold_config,
                        "report_count": len(reports),
                    }
                )

        return result

    def get_version_diff(
        self, version_old: str, version_new: str
    ) -> Dict[str, Any]:
        v_old = self.storage.load_model_version(version_old)
        v_new = self.storage.load_model_version(version_new)

        if not v_old or not v_new:
            return {"error": "One or both versions not found"}

        threshold_diffs = {}
        all_keys = set(v_old.threshold_config.keys()) | set(
            v_new.threshold_config.keys()
        )

        for key in sorted(all_keys):
            old_val = v_old.threshold_config.get(key, "NOT_SET")
            new_val = v_new.threshold_config.get(key, "NOT_SET")
            if old_val != new_val:
                threshold_diffs[key] = {"old": old_val, "new": new_val}

        reports_old = self.storage.list_reports_for_model_version(version_old)
        reports_new = self.storage.list_reports_for_model_version(version_new)

        return {
            "old_version": version_old,
            "new_version": version_old,
            "old_deployed_at": v_old.deployed_at,
            "new_deployed_at": v_new.deployed_at,
            "old_description": v_old.description,
            "new_description": v_new.description,
            "threshold_diffs": threshold_diffs,
            "report_counts": {
                "old": len(reports_old),
                "new": len(reports_new),
            },
        }


class HumanReviewWorkflow:
    def __init__(self, storage: Storage):
        self.storage = storage

    def list_pending_reviews(
        self, model_version: Optional[str] = None
    ) -> List[ExplanationReport]:
        reports = (
            self.storage.list_reports_for_model_version(model_version)
            if model_version
            else self.storage.list_all_reports()
        )

        return [
            r
            for r in reports
            if r.status == ExplanationStatus.NEED_HUMAN_REVIEW
            and not r.human_review
        ]

    def confirm_recommendation(
        self,
        report_id: str,
        reviewer: str,
        note: str = "",
    ) -> ExplanationReport:
        report = self.storage.load_report(report_id)
        if not report:
            raise ValueError(f"Report {report_id} not found")

        if report.status != ExplanationStatus.NEED_HUMAN_REVIEW:
            raise ValueError(
                f"Report {report_id} is not pending review (status: {report.status})"
            )

        human_review = HumanReview(
            reviewer=reviewer,
            reviewed_at=datetime.now().isoformat(),
            original_status=report.status.value,
            final_status=ExplanationStatus.HUMAN_CONFIRMED.value,
            revision_note=note or "人工确认推荐路径正确",
        )

        report.status = ExplanationStatus.HUMAN_CONFIRMED
        report.human_review = human_review
        report.generation_note = (
            f"{report.generation_note} | 人工审核通过: {note}"
        )

        self.storage.update_report(report)
        return report

    def revise_recommendation(
        self,
        report_id: str,
        reviewer: str,
        revised_path: str,
        revision_note: str,
        revised_evidence: Optional[List[Dict[str, Any]]] = None,
    ) -> ExplanationReport:
        report = self.storage.load_report(report_id)
        if not report:
            raise ValueError(f"Report {report_id} not found")

        if report.status not in [
            ExplanationStatus.NEED_HUMAN_REVIEW,
            ExplanationStatus.AUTO_SUCCESS,
            ExplanationStatus.HUMAN_CONFIRMED,
        ]:
            raise ValueError(
                f"Report {report_id} cannot be revised (status: {report.status})"
            )

        evidence_objs = None
        if revised_evidence:
            evidence_objs = []
            for ev in revised_evidence:
                evidence_objs.append(
                    Evidence(
                        evidence_type=EvidenceType(ev.get("evidence_type", "annotation_table")),
                        source=ev.get("source", f"human_review:{report_id}"),
                        value=ev.get("value", ""),
                        description=ev.get("description", ""),
                        timestamp=datetime.now().isoformat(),
                    )
                )

        human_review = HumanReview(
            reviewer=reviewer,
            reviewed_at=datetime.now().isoformat(),
            original_status=report.status.value,
            final_status=ExplanationStatus.HUMAN_REVISED.value,
            revision_note=revision_note,
            revised_path=revised_path,
            revised_evidence=evidence_objs,
        )

        old_path = report.recommended_path
        report.status = ExplanationStatus.HUMAN_REVISED
        report.recommended_path = revised_path
        report.human_review = human_review
        report.generation_note = (
            f"{report.generation_note} | 人工改判: 原路径 {old_path} → 新路径 {revised_path}. 原因: {revision_note}"
        )

        if evidence_objs:
            report.evidence_chain.extend(evidence_objs)

        self.storage.update_report(report)
        return report

    def list_review_history(
        self, report_id: str
    ) -> List[ExplanationReport]:
        report = self.storage.load_report(report_id)
        if not report:
            return []

        return self.storage.list_reports_for_sample(report.sample_id)

    def get_reviewer_statistics(self) -> Dict[str, Any]:
        all_reports = self.storage.list_all_reports()
        stats: Dict[str, Dict[str, int]] = {}

        for r in all_reports:
            if r.human_review:
                reviewer = r.human_review.reviewer
                if reviewer not in stats:
                    stats[reviewer] = {
                        "confirmed": 0,
                        "revised": 0,
                        "total": 0,
                    }
                stats[reviewer]["total"] += 1
                if r.status == ExplanationStatus.HUMAN_CONFIRMED:
                    stats[reviewer]["confirmed"] += 1
                elif r.status == ExplanationStatus.HUMAN_REVISED:
                    stats[reviewer]["revised"] += 1

        return {
            "reviewer_stats": stats,
            "total_reviewed": sum(s["total"] for s in stats.values()),
        }

    def import_legacy_annotation(
        self,
        sample_id: str,
        annotation_id: str,
        annotation_data: Dict[str, Any],
        model_version: str,
    ) -> ExplanationReport:
        from explanation_generator import ExplanationGenerator

        sample = self.storage.load_sample(sample_id)
        if not sample:
            raise ValueError(f"Sample {sample_id} not found")

        mv = self.storage.load_model_version(model_version)
        if not mv:
            raise ValueError(f"Model version {model_version} not found")

        self.storage.save_legacy_annotation(annotation_id, annotation_data)

        generator = ExplanationGenerator(self.storage)
        report = generator.generate_from_legacy_annotation(
            sample, mv, annotation_id, annotation_data
        )

        self.storage.save_report(report)
        return report
