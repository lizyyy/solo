from __future__ import annotations

from datetime import datetime
from typing import Any, List

from .engine.differ import Differ
from .engine.tracer import Tracer
from .engine.verifier import Verifier
from .models import Experiment, VerificationIssue
from .store import Store


class Report:
    def __init__(self, exp: Experiment, store: Store) -> None:
        self.exp = exp
        self.store = store
        self.tracer = Tracer()
        self.differ = Differ()

    def generate(self) -> str:
        sections: List[str] = []
        sections.append(self._header())
        sections.append(self._dataset_section())
        sections.append(self._metric_section())
        sections.append(self._threshold_section())
        sections.append(self._excluded_section())
        sections.append(self._score_trace_section())
        sections.append(self._import_history_section())
        return "\n\n".join(sections)

    def _header(self) -> str:
        return (
            f"{'=' * 60}\n"
            f"  离线评估说明 — {self.exp.name}\n"
            f"{'=' * 60}\n"
            f"  轮次标签: {self.exp.round_tag or '未指定'}\n"
            f"  状态: {self.exp.status.value}\n"
            f"  创建时间: {self.exp.created_at}\n"
            f"  更新时间: {self.exp.updated_at}\n"
            f"  配置指纹: {self.exp.config_fingerprint()}\n"
            f"  备注: {self.exp.note or '无'}"
        )

    def _dataset_section(self) -> str:
        ds = self.exp.dataset
        if not ds:
            return "[数据集] 未关联数据集版本"

        sr = ds.sample_range
        range_desc = f"{sr.split} [{sr.start_idx}, {sr.end_idx})" if sr.start_idx is not None else f"{sr.split} 全部"

        lines = [
            f"[数据集] {ds.dataset_name}",
            f"  版本哈希: {ds.version_hash}",
            f"  数据源: {ds.source_path}",
            f"  声明样本数: {ds.sample_count}",
            f"  样本范围: {range_desc}",
            f"  过滤条件: {sr.filters or '无'}",
        ]
        if ds.label_schema:
            keys = list(ds.label_schema.keys())[:10]
            lines.append(f"  标签体系: {', '.join(str(k) for k in keys)}{'...' if len(ds.label_schema) > 10 else ''}")
        else:
            lines.append("  标签体系: 未声明")
        return "\n".join(lines)

    def _metric_section(self) -> str:
        ms = self.exp.metric_script
        if not ms:
            return "[指标脚本] 未关联指标脚本"

        lines = [
            f"[指标脚本] {ms.script_version_tag or ms.script_hash}",
            f"  脚本路径: {ms.script_path}",
            f"  脚本哈希: {ms.script_hash}",
            f"  参数: {ms.parameters or '无'}",
        ]
        return "\n".join(lines)

    def _threshold_section(self) -> str:
        tc = self.exp.threshold_config
        if not tc:
            return "[阈值配置] 未关联阈值配置"

        lines = [
            f"[阈值配置]",
            f"  配置文件: {tc.config_path}",
            f"  配置哈希: {tc.config_hash}",
        ]
        if tc.thresholds:
            for k, v in tc.thresholds.items():
                lines.append(f"  阈值.{k}: {v}")
        else:
            lines.append("  阈值: 无")
        if tc.custom_rules:
            lines.append(f"  自定义规则: {tc.custom_rules}")
        return "\n".join(lines)

    def _excluded_section(self) -> str:
        if not self.exp.excluded_samples:
            return "[人工排除] 无排除样本"

        total = sum(len(ex.sample_ids) for ex in self.exp.excluded_samples)
        lines = [f"[人工排除] 共 {total} 个样本"]
        for ex in self.exp.excluded_samples:
            preview = ex.sample_ids[:5]
            suffix = f" ...等{len(ex.sample_ids)}个" if len(ex.sample_ids) > 5 else ""
            lines.append(f"  原因: {ex.reason}")
            lines.append(f"    样本: {', '.join(preview)}{suffix}")
            lines.append(f"    操作: {ex.excluded_by or '未知'} @ {ex.excluded_at}")
        return "\n".join(lines)

    def _score_trace_section(self) -> str:
        if not self.exp.results:
            return "[分数追溯] 无评估结果"

        lines = ["[分数追溯]"]
        for r in self.exp.results:
            chain = self.tracer.trace_score(self.exp, r.metric_name)
            if chain:
                lines.append(f"  --- {r.metric_name} = {r.metric_value:.4f} ---")
                for node in chain.nodes[1:]:
                    lines.append(f"    [{node.node_type}] {node.label}")
                    for k, v in node.detail.items():
                        lines.append(f"      ↳ {k}: {v}")
        return "\n".join(lines)

    def _import_history_section(self) -> str:
        history = self.store.get_import_history(self.exp.name)
        if not history:
            return "[导入历史] 首次导入"

        lines = ["[导入历史]"]
        for h in history:
            changes = h.get("changes", [])
            change_desc = ""
            if changes:
                change_desc = " | ".join(f"{c['field']}" for c in changes)
            lines.append(f"  {h['import_time']}: {h['import_type']}")
            if change_desc:
                lines.append(f"    变更: {change_desc}")
        return "\n".join(lines)
