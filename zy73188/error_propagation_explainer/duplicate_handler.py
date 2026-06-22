"""重复样本处理器 - 一致合并 / 不一致挂起"""

from typing import List, Dict, Tuple
from collections import defaultdict

from .models import (
    CaseRecord,
    CaseStatus,
    AnomalyRecord,
    AnomalyType,
    SeverityLevel,
)


class DuplicateHandler:
    """重复样本检测与处理"""

    def process(
        self,
        cases: List[CaseRecord],
        anomalies: List[AnomalyRecord],
    ) -> Tuple[List[CaseRecord], List[AnomalyRecord]]:
        """处理重复样本

        规则:
        - 按 case_id 分组
        - 如果组内所有记录内容完全一致 → 合并（保留第一条，其余标记 MERGED）
        - 如果组内有任何记录内容不一致 → 整组挂起（标记 SUSPENDED）

        Returns:
            (处理后的cases, 新增的anomalies)
        """
        groups: Dict[str, List[CaseRecord]] = defaultdict(list)
        for case in cases:
            groups[case.case_id].append(case)

        result_cases: List[CaseRecord] = []

        for case_id, group in groups.items():
            if len(group) == 1:
                result_cases.append(group[0])
                continue

            all_identical = self._check_all_identical(group)

            if all_identical:
                primary = group[0]
                for dup in group[1:]:
                    dup.status = CaseStatus.MERGED
                    dup.is_duplicate = True
                    dup.merged_into = primary.case_id
                    dup.duplicate_group_id = case_id
                    anomalies.append(AnomalyRecord(
                        anomaly_type=AnomalyType.DUPLICATE_IDENTICAL,
                        severity=SeverityLevel.INFO,
                        message=f"题目 {case_id} 的重复样本内容完全一致，已合并到主记录 {primary.file_name}",
                        case_id=case_id,
                        file_name=dup.file_name,
                        details={
                            "merged_from": dup.file_name,
                            "merged_into": primary.file_name,
                            "action": "merged",
                        },
                        resolution_hint="内容一致已自动合并，无需额外处理",
                    ))

                primary.is_duplicate = True
                primary.duplicate_group_id = case_id
                primary.warnings.append(
                    f"检测到 {len(group)} 条重复记录（内容一致），已合并为 1 条"
                )
                result_cases.append(primary)
                for dup in group[1:]:
                    result_cases.append(dup)
            else:
                diffs = self._describe_differences(group)
                for case in group:
                    case.status = CaseStatus.SUSPENDED
                    case.is_duplicate = True
                    case.duplicate_group_id = case_id
                    anomalies.append(AnomalyRecord(
                        anomaly_type=AnomalyType.DUPLICATE_CONFLICT,
                        severity=SeverityLevel.WARNING,
                        message=f"题目 {case_id} 的重复样本数值不一致，已挂起",
                        case_id=case_id,
                        file_name=case.file_name,
                        details={
                            "action": "suspended",
                            "differences": diffs,
                            "file": case.file_name,
                        },
                        resolution_hint=(
                            "重复样本数值不一致会改变误差传播结果，"
                            "请核实哪条记录正确后放行，或删除错误记录后重新运行"
                        ),
                    ))
                    result_cases.append(case)

        return result_cases, anomalies

    def _check_all_identical(self, group: List[CaseRecord]) -> bool:
        """检查组内所有记录是否完全一致"""
        if len(group) <= 1:
            return True

        first = group[0]
        for other in group[1:]:
            if not self._cases_identical(first, other):
                return False
        return True

    def _cases_identical(self, a: CaseRecord, b: CaseRecord) -> bool:
        """比较两条记录的实质内容是否一致"""
        if a.formula_name_resolved != b.formula_name_resolved:
            return False
        if len(a.variables) != len(b.variables):
            return False

        vars_a = {v.symbol: v for v in a.variables}
        vars_b = {v.symbol: v for v in b.variables}

        if set(vars_a.keys()) != set(vars_b.keys()):
            return False

        for symbol in vars_a:
            va = vars_a[symbol]
            vb = vars_b[symbol]
            if (abs(va.value - vb.value) > 1e-10 or
                abs(va.uncertainty - vb.uncertainty) > 1e-10 or
                va.unit != vb.unit):
                return False

        return True

    def _describe_differences(self, group: List[CaseRecord]) -> List[dict]:
        """描述组内差异"""
        diffs = []
        for case in group:
            var_info = {
                "file": case.file_name,
                "variables": {
                    v.symbol: {
                        "value": v.value,
                        "uncertainty": v.uncertainty,
                        "unit": v.unit,
                    }
                    for v in case.variables
                }
            }
            diffs.append(var_info)
        return diffs
