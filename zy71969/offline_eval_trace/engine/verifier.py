from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from ..models import (
    EvaluationResult,
    Experiment,
    ExcludedSample,
    IssueSeverity,
    IssueType,
    VerificationIssue,
)


class VerifyResult:
    def __init__(self, issues: List[VerificationIssue]) -> None:
        self.issues = issues

    @property
    def has_critical(self) -> bool:
        return any(i.severity == IssueSeverity.CRITICAL for i in self.issues)

    @property
    def has_warning(self) -> bool:
        return any(i.severity == IssueSeverity.WARNING for i in self.issues)

    @property
    def passed(self) -> bool:
        return not self.has_critical

    def summary(self) -> str:
        if not self.issues:
            return "校验通过：未发现问题"
        parts = [f"发现 {len(self.issues)} 个问题："]
        for i in self.issues:
            icon = {"critical": "🔴", "warning": "🟡", "info": "🔵"}.get(i.severity.value, "⚪")
            parts.append(f"  {icon} [{i.severity.value}] {i.issue_type.value}: {i.description}")
            if i.suggestion:
                parts.append(f"     → 建议: {i.suggestion}")
            if i.affected_samples:
                sample_preview = i.affected_samples[:5]
                suffix = f" ...等{i.affected_samples.__len__()}个" if len(i.affected_samples) > 5 else ""
                parts.append(f"     → 受影响样本: {', '.join(sample_preview)}{suffix}")
        return "\n".join(parts)


class Verifier:
    def __init__(
        self,
        train_sample_ids: Optional[Set[str]] = None,
        expected_labels: Optional[Set[str]] = None,
        strict_threshold_check: bool = True,
    ) -> None:
        self.train_sample_ids = train_sample_ids or set()
        self.expected_labels = expected_labels or set()
        self.strict_threshold_check = strict_threshold_check

    def verify(self, exp: Experiment) -> VerifyResult:
        issues: List[VerificationIssue] = []
        issues.extend(self._check_train_leak(exp))
        issues.extend(self._check_label_mapping(exp))
        issues.extend(self._check_threshold_consistency(exp))
        issues.extend(self._check_sample_range_shift(exp))
        issues.extend(self._check_excluded_overlap(exp))
        return VerifyResult(issues)

    def _check_train_leak(self, exp: Experiment) -> List[VerificationIssue]:
        if not self.train_sample_ids:
            return []
        if not exp.dataset:
            return []

        issues: List[VerificationIssue] = []
        excluded_ids: Set[str] = set()
        for ex in exp.excluded_samples:
            excluded_ids.update(ex.sample_ids)

        dataset_path = Path(exp.dataset.source_path)
        if dataset_path.exists():
            try:
                data = json.loads(dataset_path.read_text())
                sample_ids_in_dataset = set()
                if isinstance(data, dict):
                    samples = data.get("samples", data.get("data", []))
                elif isinstance(data, list):
                    samples = data
                else:
                    samples = []

                for s in samples:
                    if isinstance(s, dict):
                        sid = s.get("id", s.get("sample_id", ""))
                        if sid:
                            sample_ids_in_dataset.add(str(sid))

                leaked = (sample_ids_in_dataset & self.train_sample_ids) - excluded_ids
                if leaked:
                    issues.append(VerificationIssue(
                        issue_type=IssueType.TRAIN_LEAK,
                        severity=IssueSeverity.CRITICAL,
                        description=f"评估集与训练集存在 {len(leaked)} 个重叠样本，且未被排除",
                        affected_samples=sorted(leaked)[:20],
                        suggestion=f"请在 excluded_samples 中排除这些样本，或确认数据集划分无误。"
                                   f"训练集共 {len(self.train_sample_ids)} 条，评估集共 {len(sample_ids_in_dataset)} 条",
                    ))
            except (json.JSONDecodeError, KeyError):
                issues.append(VerificationIssue(
                    issue_type=IssueType.TRAIN_LEAK,
                    severity=IssueSeverity.WARNING,
                    description="无法解析评估集文件进行训练集泄漏检查",
                    suggestion=f"请确认 {exp.dataset.source_path} 格式正确",
                ))

        return issues

    def _check_label_mapping(self, exp: Experiment) -> List[VerificationIssue]:
        if not exp.dataset or not self.expected_labels:
            return []

        issues: List[VerificationIssue] = []
        label_schema = exp.dataset.label_schema

        if not label_schema:
            issues.append(VerificationIssue(
                issue_type=IssueType.MISSING_LABEL,
                severity=IssueSeverity.WARNING,
                description="数据集缺少 label_schema，无法校验标签映射完整性",
                suggestion="请在数据集版本文件中补充 label_schema 字段，或手动确认标签无遗漏",
            ))
            return issues

        mapped_labels: Set[str] = set()
        if isinstance(label_schema, dict):
            mapping = label_schema.get("mapping", label_schema)
            if isinstance(mapping, dict):
                mapped_labels = set(mapping.keys()) | set(mapping.values())
            elif isinstance(mapping, list):
                for item in mapping:
                    if isinstance(item, dict):
                        mapped_labels.update(str(v) for v in item.values())
                    else:
                        mapped_labels.add(str(item))

        missing = self.expected_labels - mapped_labels
        if missing:
            issues.append(VerificationIssue(
                issue_type=IssueType.MISSING_LABEL,
                severity=IssueSeverity.CRITICAL,
                description=f"标签映射遗漏 {len(missing)} 个标签: {', '.join(sorted(missing)[:10])}",
                affected_samples=[],
                suggestion=f"请检查数据集的 label_schema，以下标签未映射: {', '.join(sorted(missing)[:10])}。"
                           f"预期标签共 {len(self.expected_labels)} 个，已映射 {len(mapped_labels)} 个",
            ))

        extra = mapped_labels - self.expected_labels
        if extra:
            issues.append(VerificationIssue(
                issue_type=IssueType.LABEL_LEAK,
                severity=IssueSeverity.WARNING,
                description=f"标签映射中存在 {len(extra)} 个不在预期标签集中的标签: {', '.join(sorted(extra)[:10])}",
                affected_samples=[],
                suggestion="请确认这些标签是否为新增类别或映射错误",
            ))

        return issues

    def _check_threshold_consistency(self, exp: Experiment) -> List[VerificationIssue]:
        if not exp.threshold_config or not exp.results:
            return []

        issues: List[VerificationIssue] = []
        thresholds = exp.threshold_config.thresholds

        for result in exp.results:
            threshold_key = result.metric_name
            if threshold_key in thresholds:
                expected_min = thresholds[threshold_key]
                if result.metric_value < expected_min and self.strict_threshold_check:
                    issues.append(VerificationIssue(
                        issue_type=IssueType.THRESHOLD_MISMATCH,
                        severity=IssueSeverity.WARNING,
                        description=f"指标 {result.metric_name}={result.metric_value:.4f} 低于阈值 {expected_min}",
                        suggestion=f"检查配置文件中 {threshold_key} 阈值设置 (来源: {exp.threshold_config.config_path})",
                    ))

        return issues

    def _check_sample_range_shift(self, exp: Experiment) -> List[VerificationIssue]:
        if not exp.dataset:
            return []

        issues: List[VerificationIssue] = []
        sr = exp.dataset.sample_range

        total_excluded = sum(len(ex.sample_ids) for ex in exp.excluded_samples)
        if sr.start_idx is not None and sr.end_idx is not None:
            range_count = sr.end_idx - sr.start_idx
            effective = range_count - total_excluded
            if exp.dataset.sample_count and abs(effective - exp.dataset.sample_count) > range_count * 0.1:
                issues.append(VerificationIssue(
                    issue_type=IssueType.SAMPLE_RANGE_SHIFT,
                    severity=IssueSeverity.WARNING,
                    description=f"样本范围 [{sr.start_idx}, {sr.end_idx}) 共 {range_count} 条，排除 {total_excluded} 条后 "
                                f"有效 {effective} 条，与声明样本数 {exp.dataset.sample_count} 偏差超过 10%",
                    suggestion="请确认 sample_range 与 sample_count 是否一致",
                ))

        return issues

    def _check_excluded_overlap(self, exp: Experiment) -> List[VerificationIssue]:
        if len(exp.excluded_samples) < 2:
            return []

        issues: List[VerificationIssue] = []
        all_ids: Dict[str, List[str]] = {}
        for ex in exp.excluded_samples:
            for sid in ex.sample_ids:
                all_ids.setdefault(sid, []).append(ex.reason)

        overlaps = {sid: reasons for sid, reasons in all_ids.items() if len(reasons) > 1}
        if overlaps:
            preview = list(overlaps.items())[:5]
            desc_parts = [f"{sid}({', '.join(reasons)})" for sid, reasons in preview]
            issues.append(VerificationIssue(
                issue_type=IssueType.SAMPLE_RANGE_SHIFT,
                severity=IssueSeverity.INFO,
                description=f"有 {len(overlaps)} 个样本被多次排除: {'; '.join(desc_parts)}",
                suggestion="确认是否为重复排除，可合并排除记录",
            ))

        return issues
