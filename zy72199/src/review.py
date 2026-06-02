from typing import List, Dict
from collections import defaultdict
from datetime import datetime
import logging

from .data_models import (
    ProcessedRecord,
    DataStatus,
    LabelType,
    EvaluationRecord,
)
from .config import AppConfig

logger = logging.getLogger(__name__)


class ReviewManager:
    def __init__(self, config: AppConfig):
        self.config = config
        self.review_decisions: Dict[str, dict] = {}

    def get_records_needing_review(self, records: List[ProcessedRecord]) -> List[ProcessedRecord]:
        return [r for r in records if r.needs_review]

    def get_records_by_status(self, records: List[ProcessedRecord], status: DataStatus) -> List[ProcessedRecord]:
        return [r for r in records if r.status == status]

    def get_conflict_records(self, records: List[ProcessedRecord]) -> List[ProcessedRecord]:
        return [r for r in records if r.conflict_case is not None]

    def get_empty_records(self, records: List[ProcessedRecord]) -> List[ProcessedRecord]:
        return [r for r in records if r.status == DataStatus.EMPTY]

    def get_boundary_records(self, records: List[ProcessedRecord]) -> List[ProcessedRecord]:
        return [r for r in records if r.status == DataStatus.BOUNDARY]

    def detect_label_conflicts(self, records: List[ProcessedRecord]) -> List[ProcessedRecord]:
        conflict_records = []
        cfg = self.config.conflict

        for pr in records:
            if not pr.annotation:
                continue

            model_score = pr.primary_record.score
            human_label = pr.annotation.human_label

            if human_label == LabelType.ACCEPT and model_score < cfg.auto_flag_score_gap:
                pr.needs_review = True
                pr.review_notes = f"冲突：人工标注为accept，但模型分数仅{model_score:.2f}，低于阈值{cfg.auto_flag_score_gap}"
                conflict_records.append(pr)
            elif human_label == LabelType.REJECT and model_score > (1 - cfg.auto_flag_score_gap):
                pr.needs_review = True
                pr.review_notes = f"冲突：人工标注为reject，但模型分数达{model_score:.2f}，高于阈值{1 - cfg.auto_flag_score_gap}"
                conflict_records.append(pr)

        logger.info(f"检测到 {len(conflict_records)} 条标注冲突记录")
        return conflict_records

    def apply_human_decision(
        self,
        record: ProcessedRecord,
        decision: LabelType,
        reviewer: str,
        notes: str = "",
    ) -> ProcessedRecord:
        record.human_decision_override = decision
        record.needs_review = False
        record.review_notes = notes
        self.review_decisions[record.primary_record.sample_id] = {
            "decision": decision.value,
            "reviewer": reviewer,
            "review_time": datetime.now().isoformat(),
            "notes": notes,
            "original_annotation": record.annotation.human_label.value if record.annotation else "none",
        }
        logger.info(f"已应用人工决策: {record.primary_record.sample_id} -> {decision.value} (审核人: {reviewer})")
        return record

    def batch_apply_decisions(
        self,
        records: List[ProcessedRecord],
        decisions: Dict[str, dict],
    ) -> List[ProcessedRecord]:
        updated = []
        for sample_id, info in decisions.items():
            for pr in records:
                if pr.primary_record.sample_id == sample_id:
                    self.apply_human_decision(
                        pr,
                        LabelType(info["decision"]),
                        info.get("reviewer", "unknown"),
                        info.get("notes", ""),
                    )
                    updated.append(pr)
                    break
        return updated

    def generate_review_checklist(self, records: List[ProcessedRecord]) -> List[dict]:
        checklist = []
        need_review = self.get_records_needing_review(records)

        for pr in need_review:
            checklist.append({
                "sample_id": pr.primary_record.sample_id,
                "problem_id": pr.primary_record.problem_id,
                "model_version": pr.primary_record.model_version,
                "model_score": pr.primary_record.score,
                "status": pr.status.value,
                "original_annotation": pr.annotation.human_label.value if pr.annotation else "pending",
                "current_decision": pr.get_final_label().value,
                "review_reason": pr.review_notes,
                "conflict_case": pr.conflict_case.case_id if pr.conflict_case else None,
                "duplicate_count": len(pr.duplicates),
                "source_trace": pr.get_source_trace(),
                "model_output_preview": pr.primary_record.model_output[:100] + "..." if len(pr.primary_record.model_output) > 100 else pr.primary_record.model_output,
                "processing_time": pr.processed_at.isoformat(),
                "available_decisions": [
                    "accept - 接受当前判定",
                    "revise - 需要修改后接受",
                    "reject - 拒绝该输出",
                    "pending - 延后处理",
                ],
                "action_suggestion": self._get_action_suggestion(pr),
            })

        return checklist

    def _get_action_suggestion(self, pr: ProcessedRecord) -> str:
        if pr.status == DataStatus.EMPTY:
            return "【处理建议】请检查模型是否异常，或样本输入是否完整。如为模型bug请反馈给算法工程师；如为输入问题请重新提交评测。"
        elif pr.status == DataStatus.BOUNDARY:
            return "【处理建议】模型分数处于边界区间，请仔细阅读模型输出内容，参考人工标注判断质量。必要时可进行二次评测。"
        elif pr.status == DataStatus.CONFLICT:
            return f"【处理建议】存在已知冲突案例。请参考案例说明：{pr.conflict_case.expected_action if pr.conflict_case else '无'}。"
        elif pr.duplicates:
            return "【处理建议】已自动合并重复记录。请确认主记录选择是否正确（默认保留最高分/最新版本），如需调整请人工指定保留版本。"
        else:
            return "【处理建议】请复核模型输出质量与人工标注是否一致，如无问题可直接确认。"

    def get_statistics(self, records: List[ProcessedRecord]) -> Dict:
        stats = defaultdict(int)
        label_stats = defaultdict(int)
        reviewer_stats = defaultdict(int)

        for pr in records:
            stats[f"status_{pr.status.value}"] += 1
            label_stats[f"label_{pr.get_final_label().value}"] += 1
            if pr.needs_review:
                stats["needs_review"] += 1
            if pr.human_decision_override:
                stats["human_overridden"] += 1
                decision_key = f"override_to_{pr.human_decision_override.value}"
                label_stats[decision_key] += 1

        stats.update(dict(label_stats))
        return dict(stats)
