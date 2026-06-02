import math
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional


@dataclass
class BiasJudgment:
    record_id: str
    judgment: str
    reason: str
    evidence: str
    metrics: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AuditResult:
    judgments: List[BiasJudgment] = field(default_factory=list)
    overall_metrics: Dict[str, Any] = field(default_factory=dict)
    stratified_metrics: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    def summary(self) -> str:
        lines = ["[偏差审计结果]"]
        lines.append(f"  审计记录数: {len(self.judgments)}")
        flagged = [j for j in self.judgments if j.judgment != "通过"]
        lines.append(f"  标记偏差记录数: {len(flagged)}")
        for j in flagged:
            lines.append(f"    ID={j.record_id}, 判断={j.judgment}, 原因={j.reason}")
            lines.append(f"      证据: {j.evidence}")
        lines.append(f"\n  整体指标:")
        for k, v in self.overall_metrics.items():
            lines.append(f"    {k}: {v}")
        return "\n".join(lines)


class BiasAuditor:
    def __init__(
        self,
        score_diff_threshold: float = 0.3,
        boundary_score: float = 0.05,
        missing_penalty: bool = True,
    ):
        self.score_diff_threshold = score_diff_threshold
        self.boundary_score = boundary_score
        self.missing_penalty = missing_penalty

    def audit(self, alignment_result) -> AuditResult:
        result = AuditResult()
        score_diffs = []
        boundary_count = 0
        missing_count = 0

        for rid, aligned in alignment_result.records.items():
            judgment = BiasJudgment(record_id=rid, judgment="通过", reason="", evidence="")

            model_score = None
            manual_score = None
            online_label = None

            if aligned.model_output:
                model_score = aligned.model_output.get("score")
            if aligned.manual_correction:
                manual_score = aligned.manual_correction.get("score")
            if aligned.online_feedback:
                online_label = aligned.online_feedback.get("label")

            if model_score is not None and manual_score is not None:
                try:
                    diff = abs(float(model_score) - float(manual_score))
                    score_diffs.append(diff)
                    judgment.metrics["score_diff"] = round(diff, 4)
                    judgment.metrics["model_score"] = model_score
                    judgment.metrics["manual_score"] = manual_score

                    if diff >= self.score_diff_threshold:
                        judgment.judgment = "偏差-模型与人工差异大"
                        judgment.reason = (
                            f"模型分={model_score}, 人工分={manual_score}, "
                            f"差异={diff:.3f} >= 阈值{self.score_diff_threshold}"
                        )
                        judgment.evidence = (
                            f"ID={rid}, source=model_output+manual_correction, "
                            f"model_score={model_score}, manual_score={manual_score}, "
                            f"diff={diff:.3f}"
                        )
                    elif diff >= self.score_diff_threshold / 2:
                        judgment.judgment = "偏差-模型与人工差异中等"
                        judgment.reason = (
                            f"模型分={model_score}, 人工分={manual_score}, "
                            f"差异={diff:.3f} >= 阈值{self.score_diff_threshold}/2"
                        )
                        judgment.evidence = (
                            f"ID={rid}, source=model_output+manual_correction, "
                            f"model_score={model_score}, manual_score={manual_score}, "
                            f"diff={diff:.3f}"
                        )

                    if online_label is not None:
                        model_match = (
                            float(model_score) >= 0.5
                            if model_score is not None
                            else None
                        )
                        if model_match is not None:
                            label_positive = online_label in ("positive", "1", 1, True, "match", "yes")
                            if model_match != label_positive:
                                prev_judgment = judgment.judgment
                                if prev_judgment == "通过":
                                    judgment.judgment = "偏差-模型与线上反馈不一致"
                                else:
                                    judgment.judgment += "+线上反馈不一致"
                                judgment.reason += (
                                    f"; 模型判断={'匹配' if model_match else '不匹配'}"
                                    f", 线上反馈={'匹配' if label_positive else '不匹配'}"
                                )
                                judgment.evidence += (
                                    f"; online_label={online_label}, "
                                    f"model_match={model_match}, label_positive={label_positive}"
                                )
                except (ValueError, TypeError):
                    pass

            try:
                if model_score is not None and (
                    float(model_score) <= self.boundary_score
                    or float(model_score) >= 1.0 - self.boundary_score
                ):
                    boundary_count += 1
                    if judgment.judgment == "通过":
                        judgment.judgment = "边界-模型分数接近0或1"
                        judgment.reason = f"模型分={model_score}, 接近0或1的边界区域(<= {self.boundary_score} 或 >= {1-self.boundary_score})"
                        judgment.evidence = f"ID={rid}, source=model_output, model_score={model_score}"
            except (ValueError, TypeError):
                pass

            if self.missing_penalty and aligned.data_sources_missing:
                missing_count += 1
                if judgment.judgment == "通过":
                    judgment.judgment = "注意-数据源缺失"
                    judgment.reason = f"缺少数据源: {aligned.data_sources_missing}"
                    judgment.evidence = f"ID={rid}, missing_sources={aligned.data_sources_missing}"

            result.judgments.append(judgment)

        result.overall_metrics = self._compute_overall_metrics(
            score_diffs, boundary_count, missing_count, len(alignment_result.records)
        )

        return result

    def _compute_overall_metrics(
        self,
        score_diffs: List[float],
        boundary_count: int,
        missing_count: int,
        total: int,
    ) -> Dict[str, Any]:
        metrics = {}
        metrics["总记录数"] = total
        if score_diffs:
            avg_diff = sum(score_diffs) / len(score_diffs)
            max_diff = max(score_diffs)
            min_diff = min(score_diffs)
            variance = sum((d - avg_diff) ** 2 for d in score_diffs) / len(score_diffs)
            std_diff = math.sqrt(variance)
            metrics["模型人工平均差异"] = round(avg_diff, 4)
            metrics["模型人工最大差异"] = round(max_diff, 4)
            metrics["模型人工最小差异"] = round(min_diff, 4)
            metrics["模型人工差异标准差"] = round(std_diff, 4)
            metrics["差异>阈值记录数"] = sum(1 for d in score_diffs if d >= self.score_diff_threshold)
            metrics["差异>阈值比例"] = round(sum(1 for d in score_diffs if d >= self.score_diff_threshold) / len(score_diffs), 4)
        else:
            metrics["模型人工平均差异"] = None
        metrics["边界分数记录数"] = boundary_count
        metrics["数据源缺失记录数"] = missing_count
        return metrics

    def get_judgments_by_type(self, audit_result: AuditResult) -> Dict[str, List[BiasJudgment]]:
        grouped = {}
        for j in audit_result.judgments:
            if j.judgment not in grouped:
                grouped[j.judgment] = []
            grouped[j.judgment].append(j)
        return grouped
