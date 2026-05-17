from collections import defaultdict
from typing import List, Dict, Set
from pathlib import Path

from .models import (
    CodeReference,
    ImpactGroup,
    ImpactLevel,
    TestFile,
    TestSuggestion,
    VersionDiff,
    ReferenceType,
)


class ImpactAnalyzer:
    def __init__(
        self,
        references: List[CodeReference],
        test_files: List[TestFile],
        version_diff: VersionDiff,
        source_dir: Path,
    ):
        self.references = references
        self.test_files = test_files
        self.version_diff = version_diff
        self.source_dir = source_dir
        self.impact_groups: List[ImpactGroup] = []
        self.test_suggestions: List[TestSuggestion] = []

    def _get_affected_symbols(self) -> Set[str]:
        symbols = set()
        for change_list in [
            self.version_diff.deprecations,
            self.version_diff.removals,
            self.version_diff.signature_changes,
            self.version_diff.behavior_changes,
        ]:
            for change in change_list:
                symbols.update(change.affected_symbols)
        return symbols

    def _match_reference_to_changes(self, reference: CodeReference) -> List[str]:
        matched_categories = []
        ref_symbol = reference.symbol

        for deprecation in self.version_diff.deprecations:
            if any(s in ref_symbol or ref_symbol.startswith(s.split(".")[0]) for s in deprecation.affected_symbols):
                matched_categories.append("deprecation")

        for removal in self.version_diff.removals:
            if any(s in ref_symbol or ref_symbol.startswith(s.split(".")[0]) for s in removal.affected_symbols):
                matched_categories.append("removal")

        for sig_change in self.version_diff.signature_changes:
            if any(s in ref_symbol or ref_symbol.startswith(s.split(".")[0]) for s in sig_change.affected_symbols):
                matched_categories.append("signature_change")

        for behavior_change in self.version_diff.behavior_changes:
            if any(s in ref_symbol or ref_symbol.startswith(s.split(".")[0]) for s in behavior_change.affected_symbols):
                matched_categories.append("behavior_change")

        return matched_categories

    def _group_by_impact_level(self) -> Dict[ImpactLevel, List[CodeReference]]:
        groups = defaultdict(list)

        for ref in self.references:
            matched_categories = self._match_reference_to_changes(ref)

            if "removal" in matched_categories:
                groups[ImpactLevel.CRITICAL].append(ref)
            elif "signature_change" in matched_categories:
                groups[ImpactLevel.HIGH].append(ref)
            elif "deprecation" in matched_categories:
                groups[ImpactLevel.MEDIUM].append(ref)
            elif "behavior_change" in matched_categories:
                groups[ImpactLevel.MEDIUM].append(ref)
            else:
                groups[ImpactLevel.LOW].append(ref)

        return groups

    def _create_impact_groups(self) -> List[ImpactGroup]:
        level_groups = self._group_by_impact_level()
        impact_groups = []

        level_descriptions = {
            ImpactLevel.CRITICAL: "API已被移除，代码将无法编译/运行",
            ImpactLevel.HIGH: "函数签名变更，需要更新调用方式",
            ImpactLevel.MEDIUM: "API已废弃或行为变更，建议迁移",
            ImpactLevel.LOW: "使用了依赖但不涉及已知破坏性变更",
        }

        category_names = {
            ImpactLevel.CRITICAL: "critical_removals",
            ImpactLevel.HIGH: "signature_changes",
            ImpactLevel.MEDIUM: "deprecations_behavior",
            ImpactLevel.LOW: "general_usage",
        }

        for level, refs in level_groups.items():
            if refs:
                affected_files = list({ref.file_path for ref in refs})
                related_tests = [
                    tf for tf in self.test_files
                    if any(tr.file_path in affected_files for tr in tf.related_references)
                ]

                impact_groups.append(
                    ImpactGroup(
                        impact_level=level,
                        category=category_names[level],
                        description=level_descriptions[level],
                        references=refs,
                        affected_files=affected_files,
                        test_files=related_tests,
                    )
                )

        return sorted(impact_groups, key=lambda g: g.impact_level.value)

    def _generate_test_suggestions(self) -> List[TestSuggestion]:
        suggestions = []

        critical_group = next((g for g in self.impact_groups if g.impact_level == ImpactLevel.CRITICAL), None)
        if critical_group and critical_group.test_files:
            suggestions.append(
                TestSuggestion(
                    priority="P0",
                    description="立即运行涉及被移除API的测试用例",
                    test_files=[tf.file_path for tf in critical_group.test_files],
                    action_items=[
                        "运行所有相关测试，预期会失败",
                        "根据错误信息定位需要修改的代码",
                        "参考官方迁移文档重写调用",
                    ],
                )
            )

        high_group = next((g for g in self.impact_groups if g.impact_level == ImpactLevel.HIGH), None)
        if high_group and high_group.test_files:
            suggestions.append(
                TestSuggestion(
                    priority="P1",
                    description="优先测试签名变更的API调用",
                    test_files=[tf.file_path for tf in high_group.test_files],
                    action_items=[
                        "检查函数参数是否匹配新签名",
                        "运行集成测试验证行为一致性",
                        "更新类型注解和文档字符串",
                    ],
                )
            )

        medium_group = next((g for g in self.impact_groups if g.impact_level == ImpactLevel.MEDIUM), None)
        if medium_group and medium_group.test_files:
            suggestions.append(
                TestSuggestion(
                    priority="P2",
                    description="计划迁移废弃API和处理行为变更",
                    test_files=[tf.file_path for tf in medium_group.test_files],
                    action_items=[
                        "记录所有废弃API的使用位置",
                        "制定迁移时间表",
                        "确认行为变更对业务逻辑的影响",
                    ],
                )
            )

        all_test_files = list({tf.file_path for tf in self.test_files})
        if all_test_files:
            suggestions.append(
                TestSuggestion(
                    priority="P3",
                    description="运行完整回归测试套件",
                    test_files=all_test_files,
                    action_items=[
                        "运行完整测试套件排查潜在问题",
                        "关注边界情况和边缘用例",
                        "更新性能基准测试",
                    ],
                )
            )

        return suggestions

    def analyze(self) -> tuple[List[ImpactGroup], List[TestSuggestion]]:
        self.impact_groups = self._create_impact_groups()
        self.test_suggestions = self._generate_test_suggestions()
        return self.impact_groups, self.test_suggestions
