import hashlib
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import (
    EvaluationSlice,
    FeatureSnapshot,
    CheckResult,
    ThresholdRecord,
    ManualChange,
)


class CheckService:
    def __init__(self, db: Session):
        self.db = db

    def _build_evidence_chain(
        self,
        evaluation_slice: EvaluationSlice,
        feature_snapshot: Optional[FeatureSnapshot] = None,
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        evidence = {
            "original_row_number": evaluation_slice.original_row_number,
            "import_batch_id": evaluation_slice.import_batch_id,
            "import_time": evaluation_slice.import_time.isoformat() if evaluation_slice.import_time else None,
            "evaluation_slice_id": evaluation_slice.id,
            "main_process_summary": {
                k: v for k, v in evaluation_slice.main_process_data.items()
                if k in ["slice_id", "metric_name", "metric_value", "report_threshold"]
            },
            "current_status": evaluation_slice.current_status,
        }
        if feature_snapshot:
            evidence["feature_snapshot"] = {
                "snapshot_number": feature_snapshot.snapshot_number,
                "on_site_statement": feature_snapshot.on_site_statement,
                "supplemented_by": feature_snapshot.supplemented_by,
                "supplement_time": feature_snapshot.supplement_time.isoformat() if feature_snapshot.supplement_time else None,
                "is_resupplemented": feature_snapshot.is_resupplemented,
            }
        if extra:
            evidence.update(extra)
        return evidence

    def check_duplicate_import(
        self, evaluation_slice: EvaluationSlice
    ) -> Optional[CheckResult]:
        existing = (
            self.db.query(EvaluationSlice)
            .filter(
                EvaluationSlice.original_row_number == evaluation_slice.original_row_number,
                EvaluationSlice.import_batch_id == evaluation_slice.import_batch_id,
                EvaluationSlice.id != evaluation_slice.id,
            )
            .first()
        )

        if existing:
            result_detail = {
                "message": "检测到重复导入",
                "duplicate_with_slice_id": existing.id,
                "original_import_time": existing.import_time.isoformat() if existing.import_time else None,
            }
            evidence = self._build_evidence_chain(
                evaluation_slice,
                extra={"duplicate_slice_id": existing.id},
            )
            return CheckResult(
                evaluation_slice_id=evaluation_slice.id,
                check_type="duplicate_import",
                check_status="abnormal",
                severity="medium",
                result_detail=result_detail,
                evidence_chain=evidence,
            )
        return None

    def check_threshold_mismatch(
        self,
        evaluation_slice: EvaluationSlice,
        feature_snapshot: Optional[FeatureSnapshot] = None,
    ) -> Optional[CheckResult]:
        main_data = evaluation_slice.main_process_data
        report_threshold = main_data.get("report_threshold")

        if report_threshold is None:
            return None

        latest_threshold = (
            self.db.query(ThresholdRecord)
            .filter(ThresholdRecord.threshold_name == main_data.get("metric_name", "default"))
            .order_by(ThresholdRecord.change_time.desc())
            .first()
        )

        if not latest_threshold:
            return None

        current_threshold = latest_threshold.new_value

        if abs(report_threshold - current_threshold) > 1e-9:
            result_detail = {
                "message": "阈值已更新但报告仍使用旧值",
                "metric_name": main_data.get("metric_name"),
                "threshold_in_report": report_threshold,
                "current_system_threshold": current_threshold,
                "threshold_change_time": latest_threshold.change_time.isoformat() if latest_threshold.change_time else None,
                "changed_by": latest_threshold.changed_by,
            }
            evidence = self._build_evidence_chain(evaluation_slice, feature_snapshot)

            return CheckResult(
                evaluation_slice_id=evaluation_slice.id,
                feature_snapshot_id=feature_snapshot.id if feature_snapshot else None,
                check_type="threshold_mismatch",
                check_status="pending_review",
                severity="high",
                result_detail=result_detail,
                evidence_chain=evidence,
                threshold_old_value=report_threshold,
                threshold_new_value=current_threshold,
                report_threshold_value=report_threshold,
                needs_data_scientist_review=True,
            )
        return None

    def check_resupplement_recalc(
        self,
        evaluation_slice: EvaluationSlice,
        feature_snapshot: FeatureSnapshot,
    ) -> Optional[CheckResult]:
        if not feature_snapshot.is_resupplemented:
            return None

        old_snapshots = (
            self.db.query(FeatureSnapshot)
            .filter(
                FeatureSnapshot.evaluation_slice_id == evaluation_slice.id,
                FeatureSnapshot.id != feature_snapshot.id,
            )
            .order_by(FeatureSnapshot.supplement_time.asc())
            .all()
        )

        result_detail = {
            "message": "检测到补录后重算",
            "supplemented_by": feature_snapshot.supplemented_by,
            "supplement_count": len(old_snapshots) + 1,
            "previous_snapshots": [
                {
                    "snapshot_number": s.snapshot_number,
                    "supplement_time": s.supplement_time.isoformat() if s.supplement_time else None,
                }
                for s in old_snapshots
            ],
        }
        evidence = self._build_evidence_chain(evaluation_slice, feature_snapshot)

        return CheckResult(
            evaluation_slice_id=evaluation_slice.id,
            feature_snapshot_id=feature_snapshot.id,
            check_type="resupplement",
            check_status="normal",
            severity="low",
            result_detail=result_detail,
            evidence_chain=evidence,
        )

    def check_cross_leak(
        self,
        evaluation_slice: EvaluationSlice,
        feature_snapshot: FeatureSnapshot,
    ) -> Optional[CheckResult]:
        main_data = evaluation_slice.main_process_data
        feature_data = feature_snapshot.feature_data or {}

        cross_leak_indicators = []

        main_metric_value = main_data.get("metric_value")
        feature_metric_value = feature_data.get("metric_value")

        if main_metric_value is not None and feature_metric_value is not None:
            if abs(main_metric_value - feature_metric_value) > 1e-9:
                cross_leak_indicators.append(
                    {
                        "field": "metric_value",
                        "main_process_value": main_metric_value,
                        "feature_snapshot_value": feature_metric_value,
                        "diff": abs(main_metric_value - feature_metric_value),
                    }
                )

        main_threshold = main_data.get("report_threshold")
        feature_threshold = feature_data.get("threshold")
        if main_threshold is not None and feature_threshold is not None:
            if abs(main_threshold - feature_threshold) > 1e-9:
                cross_leak_indicators.append(
                    {
                        "field": "threshold",
                        "main_process_value": main_threshold,
                        "feature_snapshot_value": feature_threshold,
                        "diff": abs(main_threshold - feature_threshold),
                    }
                )

        if cross_leak_indicators:
            result_detail = {
                "message": "检测到特征交叉泄漏风险，主流程与特征快照数据不一致",
                "cross_leak_indicators": cross_leak_indicators,
                "on_site_statement": feature_snapshot.on_site_statement,
            }
            evidence = self._build_evidence_chain(evaluation_slice, feature_snapshot)

            return CheckResult(
                evaluation_slice_id=evaluation_slice.id,
                feature_snapshot_id=feature_snapshot.id,
                check_type="cross_leak",
                check_status="pending_review",
                severity="high",
                result_detail=result_detail,
                evidence_chain=evidence,
                needs_data_scientist_review=True,
            )
        return None

    def run_all_checks(
        self,
        evaluation_slice: EvaluationSlice,
        feature_snapshot: Optional[FeatureSnapshot] = None,
    ) -> List[CheckResult]:
        results = []

        duplicate_check = self.check_duplicate_import(evaluation_slice)
        if duplicate_check:
            results.append(duplicate_check)

        threshold_check = self.check_threshold_mismatch(evaluation_slice, feature_snapshot)
        if threshold_check:
            results.append(threshold_check)

        if feature_snapshot:
            resupplement_check = self.check_resupplement_recalc(evaluation_slice, feature_snapshot)
            if resupplement_check:
                results.append(resupplement_check)

            cross_leak_check = self.check_cross_leak(evaluation_slice, feature_snapshot)
            if cross_leak_check:
                results.append(cross_leak_check)

        return results

    def get_check_results(
        self,
        check_status: Optional[str] = None,
        check_type: Optional[str] = None,
        needs_review: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[CheckResult]:
        query = self.db.query(CheckResult)

        if check_status:
            query = query.filter(CheckResult.check_status == check_status)
        if check_type:
            query = query.filter(CheckResult.check_type == check_type)
        if needs_review is not None:
            query = query.filter(CheckResult.needs_data_scientist_review == needs_review)

        return query.order_by(CheckResult.created_at.desc()).offset(offset).limit(limit).all()

    def get_check_result_summary(self) -> Dict[str, Any]:
        all_results = self.db.query(CheckResult).all()

        by_type = {}
        by_severity = {}
        normal_count = 0
        abnormal_count = 0
        pending_review_count = 0

        for r in all_results:
            by_type[r.check_type] = by_type.get(r.check_type, 0) + 1
            by_severity[r.severity] = by_severity.get(r.severity, 0) + 1
            if r.check_status == "normal":
                normal_count += 1
            elif r.check_status == "abnormal":
                abnormal_count += 1
            elif r.check_status == "pending_review":
                pending_review_count += 1

        return {
            "total_count": len(all_results),
            "normal_count": normal_count,
            "abnormal_count": abnormal_count,
            "pending_review_count": pending_review_count,
            "by_type": by_type,
            "by_severity": by_severity,
        }

    def review_check_result(
        self,
        check_result_id: int,
        reviewer: str,
        review_comment: str,
        new_status: Optional[str] = None,
    ) -> Optional[CheckResult]:
        result = self.db.query(CheckResult).filter(CheckResult.id == check_result_id).first()
        if not result:
            return None

        result.reviewer = reviewer
        result.review_comment = review_comment
        result.review_time = datetime.utcnow()
        if new_status:
            result.check_status = new_status
        result.needs_data_scientist_review = False

        self.db.commit()
        self.db.refresh(result)
        return result

    def verify_export_consistency(
        self, check_result_ids: List[int], export_content_hash: str
    ) -> CheckResult:
        results = (
            self.db.query(CheckResult)
            .filter(CheckResult.id.in_(check_result_ids))
            .all()
        )

        result_data = []
        for r in sorted(results, key=lambda x: x.id):
            result_data.append(
                {
                    "id": r.id,
                    "check_type": r.check_type,
                    "check_status": r.check_status,
                    "result_detail": r.result_detail,
                }
            )

        canonical_hash = hashlib.sha256(
            json.dumps(result_data, sort_keys=True, default=str).encode()
        ).hexdigest()

        is_consistent = canonical_hash == export_content_hash

        if not results:
            slice_id = None
        else:
            slice_id = results[0].evaluation_slice_id

        result_detail = {
            "message": "导出一致性校验" + ("通过" if is_consistent else "不通过"),
            "exported_result_count": len(check_result_ids),
            "actual_result_count": len(results),
            "export_hash": export_content_hash,
            "canonical_hash": canonical_hash,
            "is_consistent": is_consistent,
        }

        check_result = CheckResult(
            evaluation_slice_id=slice_id,
            check_type="export_consistency",
            check_status="normal" if is_consistent else "abnormal",
            severity="low" if is_consistent else "medium",
            result_detail=result_detail,
            evidence_chain={"check_result_ids": check_result_ids},
        )

        self.db.add(check_result)
        self.db.commit()
        self.db.refresh(check_result)
        return check_result
