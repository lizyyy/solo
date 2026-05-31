from __future__ import annotations

from typing import Any, List, Optional

from ..models import Experiment, ImportChange


class DiffResult:
    def __init__(self, changes: List[ImportChange]) -> None:
        self.changes = changes

    @property
    def has_config_change(self) -> bool:
        config_fields = {"dataset.version_hash", "metric_script.script_hash", "metric_script.parameters",
                         "threshold_config.config_hash", "threshold_config.thresholds", "threshold_config.custom_rules",
                         "dataset", "metric_script", "threshold_config", "dataset.sample_count",
                         "dataset.label_schema", "dataset.sample_range"}
        return any(c.field in config_fields for c in self.changes)

    @property
    def has_note_change(self) -> bool:
        return any(c.field == "note" for c in self.changes)

    def render(self) -> str:
        if not self.changes:
            return "两次实验配置完全一致，无差异"

        lines: List[str] = []
        for c in self.changes:
            old_str = _truncate(str(c.old_value), 60)
            new_str = _truncate(str(c.new_value), 60)
            lines.append(f"  {c.field}:")
            lines.append(f"    旧值: {old_str}")
            lines.append(f"    新值: {new_str}")

        header = "配置差异" if self.has_config_change else "非配置差异"
        return f"[{header}]\n" + "\n".join(lines)


def _truncate(s: str, max_len: int) -> str:
    if len(s) <= max_len:
        return s
    return s[: max_len - 3] + "..."


class Differ:
    def diff(self, exp_a: Experiment, exp_b: Experiment) -> DiffResult:
        changes: List[ImportChange] = []

        if exp_a.note != exp_b.note:
            changes.append(ImportChange(field="note", old_value=exp_a.note, new_value=exp_b.note))
        if exp_a.round_tag != exp_b.round_tag:
            changes.append(ImportChange(field="round_tag", old_value=exp_a.round_tag, new_value=exp_b.round_tag))

        changes.extend(_diff_dataset(exp_a, exp_b))
        changes.extend(_diff_script(exp_a, exp_b))
        changes.extend(_diff_threshold(exp_a, exp_b))

        return DiffResult(changes)

    def pinpoint_cause(self, metric_name: str, exp_a: Experiment, exp_b: Experiment) -> str:
        val_a = _find_metric(exp_a, metric_name)
        val_b = _find_metric(exp_b, metric_name)

        diff = self.diff(exp_a, exp_b)

        if val_a is None or val_b is None:
            return f"指标 {metric_name}: 一方或双方未记录该指标"

        if not diff.changes:
            delta = val_b - val_a
            if abs(delta) < 1e-9:
                return f"指标 {metric_name} 差异来源：两次实验配置完全相同，可能由随机性或运行环境导致"
            return f"指标 {metric_name}: {val_a:.4f} → {val_b:.4f} (Δ={delta:+.4f})，配置相同但分数不同，可能由随机性或运行环境导致"

        parts: List[str] = []
        if val_a is not None and val_b is not None:
            delta = val_b - val_a
            parts.append(f"指标 {metric_name}: {val_a:.4f} → {val_b:.4f} (Δ={delta:+.4f})")
        else:
            parts.append(f"指标 {metric_name}: 一方或双方未记录该指标")

        parts.append("")
        parts.append("差异溯源：")

        config_changes = [c for c in diff.changes if c.field != "note" and c.field != "round_tag"]
        note_changes = [c for c in diff.changes if c.field == "note"]

        if config_changes:
            for c in config_changes:
                parts.append(f"  ✦ {c.field}: {_truncate(str(c.old_value), 40)} → {_truncate(str(c.new_value), 40)}")
                if "threshold" in c.field:
                    parts.append(f"    ⚡ 这是阈值配置差异，直接影响指标计算口径")
                elif "dataset" in c.field:
                    parts.append(f"    ⚡ 这是数据集差异，可能导致样本范围不同")
                elif "script" in c.field:
                    parts.append(f"    ⚡ 这是脚本差异，计算逻辑可能不同")

        if note_changes:
            parts.append(f"  📝 仅备注变更，不影响指标")

        return "\n".join(parts)


def _diff_dataset(a: Experiment, b: Experiment) -> List[ImportChange]:
    changes: List[ImportChange] = []
    if a.dataset and b.dataset:
        if a.dataset.version_hash != b.dataset.version_hash:
            changes.append(ImportChange(field="dataset.version_hash", old_value=a.dataset.version_hash, new_value=b.dataset.version_hash))
        if a.dataset.sample_count != b.dataset.sample_count:
            changes.append(ImportChange(field="dataset.sample_count", old_value=a.dataset.sample_count, new_value=b.dataset.sample_count))
        if a.dataset.label_schema != b.dataset.label_schema:
            changes.append(ImportChange(field="dataset.label_schema", old_value=a.dataset.label_schema, new_value=b.dataset.label_schema))
        if a.dataset.sample_range != b.dataset.sample_range:
            changes.append(ImportChange(field="dataset.sample_range", old_value=a.dataset.sample_range.model_dump(), new_value=b.dataset.sample_range.model_dump()))
    elif not a.dataset and b.dataset:
        changes.append(ImportChange(field="dataset", old_value=None, new_value=b.dataset.model_dump()))
    elif a.dataset and not b.dataset:
        changes.append(ImportChange(field="dataset", old_value=a.dataset.model_dump(), new_value=None))
    return changes


def _diff_script(a: Experiment, b: Experiment) -> List[ImportChange]:
    changes: List[ImportChange] = []
    if a.metric_script and b.metric_script:
        if a.metric_script.script_hash != b.metric_script.script_hash:
            changes.append(ImportChange(field="metric_script.script_hash", old_value=a.metric_script.script_hash, new_value=b.metric_script.script_hash))
        if a.metric_script.parameters != b.metric_script.parameters:
            changes.append(ImportChange(field="metric_script.parameters", old_value=a.metric_script.parameters, new_value=b.metric_script.parameters))
    elif not a.metric_script and b.metric_script:
        changes.append(ImportChange(field="metric_script", old_value=None, new_value=b.metric_script.model_dump()))
    elif a.metric_script and not b.metric_script:
        changes.append(ImportChange(field="metric_script", old_value=a.metric_script.model_dump(), new_value=None))
    return changes


def _diff_threshold(a: Experiment, b: Experiment) -> List[ImportChange]:
    changes: List[ImportChange] = []
    if a.threshold_config and b.threshold_config:
        if a.threshold_config.config_hash != b.threshold_config.config_hash:
            changes.append(ImportChange(field="threshold_config.config_hash", old_value=a.threshold_config.config_hash, new_value=b.threshold_config.config_hash))
        if a.threshold_config.thresholds != b.threshold_config.thresholds:
            changes.append(ImportChange(field="threshold_config.thresholds", old_value=a.threshold_config.thresholds, new_value=b.threshold_config.thresholds))
        if a.threshold_config.custom_rules != b.threshold_config.custom_rules:
            changes.append(ImportChange(field="threshold_config.custom_rules", old_value=a.threshold_config.custom_rules, new_value=b.threshold_config.custom_rules))
    elif not a.threshold_config and b.threshold_config:
        changes.append(ImportChange(field="threshold_config", old_value=None, new_value=b.threshold_config.model_dump()))
    elif a.threshold_config and not b.threshold_config:
        changes.append(ImportChange(field="threshold_config", old_value=a.threshold_config.model_dump(), new_value=None))
    return changes


def _find_metric(exp: Experiment, name: str) -> Optional[float]:
    for r in exp.results:
        if r.metric_name == name:
            return r.metric_value
    return None
