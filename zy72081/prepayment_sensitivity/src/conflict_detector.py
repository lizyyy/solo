from typing import Dict, List
from .models import LoanSample, ReviewChartData, DataConflict, generate_id


class ConflictDetector:
    def __init__(self, tolerance_pct: float = 5.0):
        self.tolerance_pct = tolerance_pct

    def detect(
        self,
        samples: List[LoanSample],
        chart_data: List[ReviewChartData],
        calculated_results: Dict[str, float],
    ) -> List[DataConflict]:
        conflicts = []

        chart_by_loan = {c.loan_id: c for c in chart_data}

        for sample in samples:
            if sample.loan_id not in chart_by_loan:
                continue

            chart_record = chart_by_loan[sample.loan_id]
            calculated_score = calculated_results.get(sample.sample_id)

            if calculated_score is None:
                continue

            sensitivity_diff_pct = abs(
                calculated_score - chart_record.reported_sensitivity
            ) * 100

            if sensitivity_diff_pct > self.tolerance_pct:
                if calculated_score > chart_record.reported_sensitivity:
                    action = (
                        f"建议：新系统计算值({calculated_score:.4f})高于复盘图表值"
                        f"({chart_record.reported_sensitivity:.4f})，"
                        f"差异{sensitivity_diff_pct:.2f}%。"
                        f"请核对参数版本（当前参数版本见计算明细）"
                        f"或确认复盘图表数据是否为旧口径。"
                    )
                else:
                    action = (
                        f"建议：新系统计算值({calculated_score:.4f})低于复盘图表值"
                        f"({chart_record.reported_sensitivity:.4f})，"
                        f"差异{sensitivity_diff_pct:.2f}%。"
                        f"请核对样本数据是否有更新，或确认复盘图表是否为人工调整值。"
                    )

                id_content = f"{sample.loan_id}_sensitivity_score_{calculated_score:.4f}_{chart_record.reported_sensitivity:.4f}"
                conflicts.append(DataConflict(
                    conflict_id=generate_id("CONFLICT", id_content),
                    loan_id=sample.loan_id,
                    sample_value=calculated_score,
                    chart_value=chart_record.reported_sensitivity,
                    field_name="sensitivity_score",
                    sample_source=f"样本ID: {sample.sample_id}, 来源: {sample.source}",
                    chart_source=f"复盘图表, 报告期: {chart_record.report_period}, 来源: {chart_record.data_source}",
                    difference=round(sensitivity_diff_pct, 2),
                    suggested_action=action,
                    resolved=False,
                    resolution_note="",
                ))

            calculated_risk = self._score_to_risk(calculated_score)
            if calculated_risk != chart_record.reported_risk:
                id_content = f"{sample.loan_id}_risk_level_{calculated_risk}_{chart_record.reported_risk}"
                conflicts.append(DataConflict(
                    conflict_id=generate_id("CONFLICT", id_content),
                    loan_id=sample.loan_id,
                    sample_value=calculated_risk,
                    chart_value=chart_record.reported_risk,
                    field_name="risk_level",
                    sample_source=f"样本ID: {sample.sample_id}, 来源: {sample.source}",
                    chart_source=f"复盘图表, 报告期: {chart_record.report_period}, 来源: {chart_record.data_source}",
                    difference=0,
                    suggested_action=(
                        f"风险等级不一致：系统判定{calculated_risk}，"
                        f"复盘图表记录{chart_record.reported_risk}。"
                        f"请核对风险阈值参数或是否存在人工调整记录。"
                    ),
                    resolved=False,
                    resolution_note="",
                ))

            principal_diff_pct = 0
            if chart_record.data_source and "principal" in chart_record.manual_note.lower():
                try:
                    chart_principal = float(
                        chart_record.manual_note.split("principal:")[1].split(",")[0].strip()
                    )
                    principal_diff_pct = abs(sample.principal - chart_principal) / chart_principal * 100
                    if principal_diff_pct > self.tolerance_pct:
                        id_content = f"{sample.loan_id}_principal_{sample.principal:.0f}_{chart_principal:.0f}"
                        conflicts.append(DataConflict(
                            conflict_id=generate_id("CONFLICT", id_content),
                            loan_id=sample.loan_id,
                            sample_value=sample.principal,
                            chart_value=chart_principal,
                            field_name="principal",
                            sample_source=f"样本ID: {sample.sample_id}, 来源: {sample.source}",
                            chart_source=f"复盘图表备注, 报告期: {chart_record.report_period}",
                            difference=round(principal_diff_pct, 2),
                            suggested_action=(
                                f"本金不一致：样本{sample.principal:,.0f}，"
                                f"复盘图表{chart_principal:,.0f}，"
                                f"差异{principal_diff_pct:.2f}%。请以最新数据为准。"
                            ),
                            resolved=False,
                            resolution_note="",
                        ))
                except (IndexError, ValueError):
                    pass

        return conflicts

    def _score_to_risk(self, score: float) -> str:
        if score >= 0.70:
            return "high"
        elif score >= 0.40:
            return "medium"
        else:
            return "low"

    def get_conflict_summary(self, conflicts: List[DataConflict]) -> Dict:
        field_counts = {}
        for c in conflicts:
            field_counts[c.field_name] = field_counts.get(c.field_name, 0) + 1

        unresolved = sum(1 for c in conflicts if not c.resolved)

        return {
            "total_conflicts": len(conflicts),
            "unresolved_conflicts": unresolved,
            "resolved_conflicts": len(conflicts) - unresolved,
            "field_distribution": field_counts,
        }

    def generate_evidence_table(self, conflicts: List[DataConflict]) -> List[Dict]:
        evidence = []
        for conflict in conflicts:
            evidence.append({
                "conflict_id": conflict.conflict_id,
                "loan_id": conflict.loan_id,
                "field": conflict.field_name,
                "system_value": conflict.sample_value,
                "chart_value": conflict.chart_value,
                "difference_pct": conflict.difference,
                "system_evidence": conflict.sample_source,
                "chart_evidence": conflict.chart_source,
                "suggested_action": conflict.suggested_action,
                "resolved": conflict.resolved,
                "resolution": conflict.resolution_note,
            })
        return evidence
