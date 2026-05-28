from typing import List, Dict, Tuple
from collections import defaultdict
from models import RoyaltySplit, MatrixRow, ValidationIssue, RightType, Platform
from dataclasses import dataclass


@dataclass
class NormalizationResult:
    original_ratio: float
    normalized_ratio: float
    explanation: str
    evidence: List[Dict]


class RatioNormalizer:
    def __init__(self):
        pass

    def normalize_group(self, splits: List[RoyaltySplit]) -> Dict[str, NormalizationResult]:
        total = sum(s.split_ratio for s in splits)
        results = {}

        if abs(total - 1.0) < 0.001:
            for s in splits:
                results[s.id] = NormalizationResult(
                    original_ratio=s.split_ratio,
                    normalized_ratio=s.split_ratio,
                    explanation=f"原始比例 {s.split_ratio:.2%} 已闭合，无需归一化",
                    evidence=[{'原始比例': f"{s.split_ratio:.2%}", '分组总和': f"{total:.2%}"}]
                )
            return results

        for s in splits:
            if total == 0:
                normalized = 1.0 / len(splits)
                explanation = f"分组总和为0，平均分配为{normalized:.2%}"
            else:
                normalized = s.split_ratio / total
                explanation = (f"原始比例 {s.split_ratio:.2%} / 分组总和 {total:.2%} "
                              f"= 归一化比例 {normalized:.2%}")

            results[s.id] = NormalizationResult(
                original_ratio=s.split_ratio,
                normalized_ratio=normalized,
                explanation=explanation,
                evidence=[{
                    '原始比例': f"{s.split_ratio:.2%}",
                    '分组总和': f"{total:.2%}",
                    '计算公式': f"{s.split_ratio:.4f} / {total:.4f}",
                    '归一化结果': f"{normalized:.2%}"
                }]
            )

        return results

    def normalize_matrix(self, splits: List[RoyaltySplit],
                        matrix_rows: List[MatrixRow]) -> Tuple[List[MatrixRow], Dict]:
        grouped = defaultdict(list)
        for split in splits:
            key = (split.track_id, split.right_type, split.platform)
            grouped[key].append(split)

        all_normalizations = {}
        for key, group_splits in grouped.items():
            group_results = self.normalize_group(group_splits)
            all_normalizations.update(group_results)

        split_id_to_row = {}
        for split in splits:
            for row in matrix_rows:
                if (row.track_id == split.track_id and
                    row.right_type == split.right_type.value and
                    row.split_ratio == split.split_ratio):
                    split_id_to_row[split.id] = row
                    break

        for split_id, result in all_normalizations.items():
            if split_id in split_id_to_row:
                split_id_to_row[split_id].normalized_ratio = result.normalized_ratio

        normalization_summary = {
            '总分组数': len(grouped),
            '需要归一化组数': sum(
                1 for group in grouped.values()
                if abs(sum(s.split_ratio for s in group) - 1.0) > 0.001
            ),
            '归一化记录数': len(all_normalizations)
        }

        return matrix_rows, normalization_summary


class DifferenceExplainer:
    def explain_issue(self, issue: ValidationIssue) -> str:
        explanation_parts = [
            f"\n{'='*60}",
            f"【{issue.level.upper()}】{issue.category}",
            f"{'-'*60}",
            f"问题描述: {issue.message}",
            f"\n判断依据:",
        ]

        for idx, evidence in enumerate(issue.evidence, 1):
            explanation_parts.append(f"\n  证据 {idx}:")
            for key, value in evidence.items():
                explanation_parts.append(f"    - {key}: {value}")

        explanation_parts.append(f"\n复查建议:")
        explanation_parts.append(self._get_recommendation(issue.category))
        explanation_parts.append(f"{'='*60}\n")

        return '\n'.join(explanation_parts)

    def _get_recommendation(self, category: str) -> str:
        recommendations = {
            '比例不闭合': (
                "  1. 检查是否遗漏了某个权利人的分成比例\n"
                "  2. 核对合同中约定的分成比例是否正确录入\n"
                "  3. 确认是否有特殊的分成规则未被考虑\n"
                "  4. 如确认无误，可使用归一化功能调整比例"
            ),
            '合同版本冲突': (
                "  1. 核实各版本合同的生效/失效日期是否正确\n"
                "  2. 确认是否存在合同替代或补充协议\n"
                "  3. 与法务部门确认当前应执行的合同版本\n"
                "  4. 将过期合同标记为非活跃状态"
            ),
            '平台扣费重复': (
                "  1. 检查是否同一扣费项目被重复录入\n"
                "  2. 核实平台扣费规则的最新版本\n"
                "  3. 确认扣费类型的分类是否正确\n"
                "  4. 删除重复记录或调整扣费比例"
            )
        }
        return recommendations.get(category, "  请联系系统管理员获取帮助")

    def explain_normalization(self, track_title: str, right_type: str,
                            platform: str, results: List[NormalizationResult]) -> str:
        explanation = [
            f"\n{'='*60}",
            f"比例归一化说明",
            f"{'-'*60}",
            f"曲目: {track_title}",
            f"权利类型: {right_type}",
            f"平台: {platform}",
            f"\n归一化详情:"
        ]

        for result in results:
            explanation.append(f"\n  {result.explanation}")
            for ev in result.evidence:
                for key, value in ev.items():
                    explanation.append(f"    {key}: {value}")

        explanation.append(f"{'='*60}\n")
        return '\n'.join(explanation)
