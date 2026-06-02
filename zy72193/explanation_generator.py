import uuid
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional

from models import (
    Sample,
    ModelVersion,
    Evidence,
    EvidenceType,
    ExplanationReport,
    ExplanationStatus,
)
from storage import Storage


class ExplanationGenerator:
    def __init__(self, storage: Storage):
        self.storage = storage

    def _collect_user_profile_evidence(
        self, sample: Sample, thresholds: Dict[str, float]
    ) -> List[Evidence]:
        evidence_list = []
        profile = sample.user_profile

        if "level" in profile:
            evidence_list.append(
                Evidence(
                    evidence_type=EvidenceType.USER_PROFILE,
                    source=f"user_profile:{sample.user_id}:level",
                    value=profile["level"],
                    description=f"用户当前等级为 {profile['level']}",
                    timestamp=datetime.now().isoformat(),
                )
            )

        if "learning_goal" in profile:
            evidence_list.append(
                Evidence(
                    evidence_type=EvidenceType.CAREER_GOAL,
                    source=f"user_profile:{sample.user_id}:learning_goal",
                    value=profile["learning_goal"],
                    description=f"用户学习目标为 {profile['learning_goal']}",
                    timestamp=datetime.now().isoformat(),
                )
            )

        if "available_hours_per_week" in profile:
            evidence_list.append(
                Evidence(
                    evidence_type=EvidenceType.USER_PROFILE,
                    source=f"user_profile:{sample.user_id}:available_hours",
                    value=profile["available_hours_per_week"],
                    description=f"用户每周可投入 {profile['available_hours_per_week']} 小时",
                    timestamp=datetime.now().isoformat(),
                )
            )

        return evidence_list

    def _collect_learning_history_evidence(
        self, sample: Sample, thresholds: Dict[str, float]
    ) -> List[Evidence]:
        evidence_list = []
        history = sample.learning_history

        if history:
            completed_courses = [
                h for h in history if h.get("status") == "completed"
            ]
            in_progress_courses = [
                h for h in history if h.get("status") == "in_progress"
            ]

            if completed_courses:
                evidence_list.append(
                    Evidence(
                        evidence_type=EvidenceType.LEARNING_HISTORY,
                        source=f"learning_history:{sample.user_id}:completed",
                        value=len(completed_courses),
                        description=f"已完成 {len(completed_courses)} 门课程",
                        timestamp=datetime.now().isoformat(),
                    )
                )

                avg_score = sum(
                    c.get("score", 0) for c in completed_courses
                ) / len(completed_courses)
                evidence_list.append(
                    Evidence(
                        evidence_type=EvidenceType.LEARNING_HISTORY,
                        source=f"learning_history:{sample.user_id}:avg_score",
                        value=round(avg_score, 2),
                        description=f"已完成课程平均得分 {round(avg_score, 2)}",
                        timestamp=datetime.now().isoformat(),
                    )
                )

            if in_progress_courses:
                evidence_list.append(
                    Evidence(
                        evidence_type=EvidenceType.LEARNING_HISTORY,
                        source=f"learning_history:{sample.user_id}:in_progress",
                        value=len(in_progress_courses),
                        description=f"正在学习 {len(in_progress_courses)} 门课程",
                        timestamp=datetime.now().isoformat(),
                    )
                )

            skill_gaps = self._identify_knowledge_gaps(history, sample.target_path)
            for gap in skill_gaps:
                evidence_list.append(gap)

        return evidence_list

    def _identify_knowledge_gaps(
        self, history: List[Dict[str, Any]], target_path: str
    ) -> List[Evidence]:
        gaps = []
        completed_skills = set()
        for h in history:
            if h.get("status") == "completed" and "skills" in h:
                completed_skills.update(h["skills"])

        path_prerequisites = {
            "data_scientist": ["python_basics", "linear_algebra", "statistics"],
            "frontend_engineer": ["html", "css", "javascript_basics"],
            "backend_engineer": ["programming_basics", "databases", "networking"],
            "ai_engineer": ["python_basics", "machine_learning", "deep_learning"],
        }

        prereqs = path_prerequisites.get(target_path, [])
        for prereq in prereqs:
            if prereq not in completed_skills:
                gaps.append(
                    Evidence(
                        evidence_type=EvidenceType.KNOWLEDGE_GAP,
                        source=f"prerequisite_check:{target_path}:{prereq}",
                        value=False,
                        description=f"目标路径 {target_path} 需要先修技能 {prereq}，尚未掌握",
                        timestamp=datetime.now().isoformat(),
                    )
                )
            else:
                gaps.append(
                    Evidence(
                        evidence_type=EvidenceType.SKILL_PREREQUISITE,
                        source=f"prerequisite_check:{target_path}:{prereq}",
                        value=True,
                        description=f"目标路径 {target_path} 需要先修技能 {prereq}，已掌握",
                        timestamp=datetime.now().isoformat(),
                    )
                )

        return gaps

    def _calculate_confidence(
        self, evidence_chain: List[Evidence], thresholds: Dict[str, float]
    ) -> Tuple[float, List[str]]:
        score = 0.0
        max_score = 0.0
        warnings = []

        prereq_evidences = [
            e
            for e in evidence_chain
            if e.evidence_type
            in [EvidenceType.SKILL_PREREQUISITE, EvidenceType.KNOWLEDGE_GAP]
        ]
        if prereq_evidences:
            max_score += 40
            satisfied = sum(1 for e in prereq_evidences if e.value)
            prereq_ratio = satisfied / len(prereq_evidences)
            score += 40 * prereq_ratio
            if prereq_ratio < thresholds.get("min_prereq_ratio", 0.7):
                warnings.append(
                    f"先修技能满足比例 {prereq_ratio:.2f} 低于阈值 {thresholds.get('min_prereq_ratio', 0.7)}"
                )

        avg_score_evidence = [
            e
            for e in evidence_chain
            if e.evidence_type == EvidenceType.LEARNING_HISTORY
            and "avg_score" in e.source
        ]
        if avg_score_evidence:
            max_score += 30
            avg = avg_score_evidence[0].value
            if avg >= thresholds.get("good_score", 85):
                score += 30
            elif avg >= thresholds.get("pass_score", 60):
                score += 20
            else:
                score += 10
                warnings.append(
                    f"历史平均得分 {avg} 低于及格线 {thresholds.get('pass_score', 60)}"
                )

        completed_count_evidence = [
            e
            for e in evidence_chain
            if e.evidence_type == EvidenceType.LEARNING_HISTORY
            and "completed" in e.source
        ]
        if completed_count_evidence:
            max_score += 20
            count = completed_count_evidence[0].value
            if count >= thresholds.get("min_completed_courses", 3):
                score += 20
            elif count >= 1:
                score += 10
            else:
                score += 0
                warnings.append("尚无已完成课程，学习历史数据不足")

        hours_evidence = [
            e
            for e in evidence_chain
            if e.evidence_type == EvidenceType.USER_PROFILE
            and "available_hours" in e.source
        ]
        if hours_evidence:
            max_score += 10
            hours = hours_evidence[0].value
            if hours >= thresholds.get("min_hours_per_week", 5):
                score += 10
            elif hours >= thresholds.get("min_hours_per_week", 5) / 2:
                score += 5
            else:
                warnings.append(
                    f"每周投入时间 {hours} 小时可能不足以完成学习路径"
                )

        if max_score == 0:
            return 0.5, ["缺乏足够证据进行置信度评估"]

        confidence = round(score / max_score, 4)
        return confidence, warnings

    def _determine_status(
        self,
        confidence: float,
        warnings: List[str],
        thresholds: Dict[str, float],
    ) -> Tuple[ExplanationStatus, str]:
        if confidence >= thresholds.get("auto_accept_threshold", 0.85):
            if not warnings:
                return (
                    ExplanationStatus.AUTO_SUCCESS,
                    f"置信度 {confidence} 高于自动通过阈值 {thresholds.get('auto_accept_threshold', 0.85)}，无警告，自动判定通过",
                )
            else:
                return (
                    ExplanationStatus.AUTO_SUCCESS,
                    f"置信度 {confidence} 高于阈值，但存在警告: {'; '.join(warnings)}",
                )
        elif confidence >= thresholds.get("human_review_threshold", 0.6):
            return (
                ExplanationStatus.NEED_HUMAN_REVIEW,
                f"置信度 {confidence} 在不确定区间 [{thresholds.get('human_review_threshold', 0.6)}, {thresholds.get('auto_accept_threshold', 0.85)})，需要人工审核。警告: {'; '.join(warnings)}",
            )
        else:
            return (
                ExplanationStatus.NEED_HUMAN_REVIEW,
                f"置信度 {confidence} 低于人工审核阈值 {thresholds.get('human_review_threshold', 0.6)}，必须人工审核。警告: {'; '.join(warnings)}",
            )

    def generate_explanation(
        self,
        sample: Sample,
        model_version: ModelVersion,
        legacy_source: Optional[str] = None,
    ) -> ExplanationReport:
        thresholds = model_version.threshold_config

        evidence_chain: List[Evidence] = []
        evidence_chain.extend(
            self._collect_user_profile_evidence(sample, thresholds)
        )
        evidence_chain.extend(
            self._collect_learning_history_evidence(sample, thresholds)
        )

        evidence_chain.append(
            Evidence(
                evidence_type=EvidenceType.MODEL_INFERENCE,
                source=f"model_version:{model_version.version}",
                value=model_version.version,
                description=f"使用模型版本 {model_version.version} 进行推断",
                timestamp=datetime.now().isoformat(),
            )
        )

        confidence, warnings = self._calculate_confidence(
            evidence_chain, thresholds
        )

        status, note = self._determine_status(confidence, warnings, thresholds)

        report = ExplanationReport(
            report_id=f"RPT-{uuid.uuid4().hex[:8].upper()}",
            sample_id=sample.sample_id,
            model_version=model_version.version,
            status=status,
            recommended_path=sample.target_path,
            confidence_score=confidence,
            evidence_chain=evidence_chain,
            threshold_used=thresholds.copy(),
            generated_at=datetime.now().isoformat(),
            generation_note=note,
            legacy_source=legacy_source,
            online_feedback=sample.online_feedback,
        )

        return report

    def generate_from_legacy_annotation(
        self,
        sample: Sample,
        model_version: ModelVersion,
        annotation_id: str,
        annotation_data: Dict[str, Any],
    ) -> ExplanationReport:
        evidence_chain: List[Evidence] = []

        evidence_chain.append(
            Evidence(
                evidence_type=EvidenceType.ANNOTATION_TABLE,
                source=f"annotation_table:{annotation_id}",
                value=annotation_id,
                description=f"从标注表 {annotation_id} 导入历史标注",
                timestamp=datetime.now().isoformat(),
            )
        )

        for key, value in annotation_data.get("evidence", {}).items():
            evidence_chain.append(
                Evidence(
                    evidence_type=EvidenceType.ANNOTATION_TABLE,
                    source=f"annotation_table:{annotation_id}:{key}",
                    value=value,
                    description=f"标注表证据: {key} = {value}",
                    timestamp=annotation_data.get(
                        "annotated_at", datetime.now().isoformat()
                    ),
                )
            )

        status = ExplanationStatus.LEGACY_FROM_ANNOTATION
        confidence = annotation_data.get("confidence", 1.0)

        report = ExplanationReport(
            report_id=f"RPT-{uuid.uuid4().hex[:8].upper()}",
            sample_id=sample.sample_id,
            model_version=model_version.version,
            status=status,
            recommended_path=annotation_data.get(
                "recommended_path", sample.target_path
            ),
            confidence_score=confidence,
            evidence_chain=evidence_chain,
            threshold_used={
                "legacy_import": True,
                "original_annotator": annotation_data.get("annotator", "unknown"),
                "original_annotation_date": annotation_data.get(
                    "annotated_at", "unknown"
                ),
            },
            generated_at=datetime.now().isoformat(),
            generation_note=f"从历史标注表导入，原标注人: {annotation_data.get('annotator', 'unknown')}，原标注时间: {annotation_data.get('annotated_at', 'unknown')}",
            legacy_source=annotation_id,
            online_feedback=sample.online_feedback,
        )

        return report

    def batch_generate(
        self,
        samples: List[Sample],
        model_version: ModelVersion,
        run_note: str = "",
    ) -> Tuple[str, List[ExplanationReport]]:
        from models import BatchRun

        run_id = f"BATCH-{uuid.uuid4().hex[:8].upper()}"
        reports = []

        for sample in samples:
            report = self.generate_explanation(sample, model_version)
            self.storage.save_report(report)
            reports.append(report)

        status_counts = {}
        for r in reports:
            status_key = r.status.value
            status_counts[status_key] = status_counts.get(status_key, 0) + 1

        avg_confidence = (
            sum(r.confidence_score for r in reports) / len(reports)
            if reports
            else 0
        )

        metrics = {
            "total_samples": len(reports),
            "avg_confidence": round(avg_confidence, 4),
            "auto_success_rate": round(
                status_counts.get("auto_success", 0) / len(reports), 4
            )
            if reports
            else 0,
            "need_human_review_rate": round(
                status_counts.get("need_human_review", 0) / len(reports), 4
            )
            if reports
            else 0,
            "legacy_rate": round(
                status_counts.get("legacy_from_annotation", 0) / len(reports), 4
            )
            if reports
            else 0,
        }
        metrics.update({f"count_{k}": v for k, v in status_counts.items()})

        sample_changes = []
        for report in reports:
            old_reports = self.storage.list_reports_for_sample(report.sample_id)
            if len(old_reports) > 1:
                old_r = old_reports[-2]
                if old_r.status != report.status or old_r.recommended_path != report.recommended_path:
                    sample_changes.append(
                        {
                            "sample_id": report.sample_id,
                            "old_report_id": old_r.report_id,
                            "new_report_id": report.report_id,
                            "change_type": "status_or_path_changed",
                        }
                    )

        batch_run = BatchRun(
            run_id=run_id,
            run_timestamp=datetime.now().isoformat(),
            model_version=model_version.version,
            sample_count=len(reports),
            report_ids=[r.report_id for r in reports],
            metrics=metrics,
            sample_changes=sample_changes,
        )

        self.storage.save_batch_run(batch_run)

        return run_id, reports
