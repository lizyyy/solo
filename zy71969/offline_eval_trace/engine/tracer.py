from __future__ import annotations

from typing import Any, Dict, List, Optional

from ..models import (
    EvaluationResult,
    Experiment,
    ExcludedSample,
    ThresholdConfig,
)


class TraceNode:
    def __init__(
        self,
        node_type: str,
        label: str,
        detail: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.node_type = node_type
        self.label = label
        self.detail = detail or {}


class TraceChain:
    def __init__(self, nodes: Optional[List[TraceNode]] = None) -> None:
        self.nodes = nodes or []

    def add(self, node: TraceNode) -> TraceChain:
        self.nodes.append(node)
        return self

    def render(self) -> str:
        lines: List[str] = []
        for i, node in enumerate(self.nodes):
            prefix = "  " * i + ("└─ " if i > 0 else "")
            lines.append(f"{prefix}[{node.node_type}] {node.label}")
            for k, v in node.detail.items():
                lines.append(f"{'  ' * (i + 1)}├─ {k}: {v}")
        return "\n".join(lines)


class Tracer:
    def trace_score(self, exp: Experiment, metric_name: str) -> Optional[TraceChain]:
        result = None
        for r in exp.results:
            if r.metric_name == metric_name:
                result = r
                break
        if result is None:
            return None

        chain = TraceChain()
        chain.add(TraceNode(
            "评估结果",
            f"{result.metric_name} = {result.metric_value:.4f}",
            {"样本组": result.sample_group, "计算时间": str(result.computed_at)},
        ))

        if exp.threshold_config:
            threshold_val = exp.threshold_config.thresholds.get(metric_name)
            chain.add(TraceNode(
                "阈值配置",
                f"{metric_name} 阈值: {threshold_val}" if threshold_val is not None else f"{metric_name} 无阈值",
                {
                    "配置文件": exp.threshold_config.config_path,
                    "配置哈希": exp.threshold_config.config_hash,
                    "全部阈值": str(exp.threshold_config.thresholds),
                },
            ))

        if exp.metric_script:
            chain.add(TraceNode(
                "指标脚本",
                f"{exp.metric_script.script_version_tag or exp.metric_script.script_hash}",
                {
                    "脚本路径": exp.metric_script.script_path,
                    "脚本哈希": exp.metric_script.script_hash,
                    "参数": str(exp.metric_script.parameters),
                },
            ))

        if exp.dataset:
            sr = exp.dataset.sample_range
            range_desc = f"[{sr.start_idx}, {sr.end_idx})" if sr.start_idx is not None else "全部"
            chain.add(TraceNode(
                "数据集",
                f"{exp.dataset.dataset_name} (v{exp.dataset.version_hash})",
                {
                    "样本数": exp.dataset.sample_count,
                    "样本范围": f"{sr.split} {range_desc}",
                    "过滤条件": str(sr.filters) if sr.filters else "无",
                    "数据源": exp.dataset.source_path,
                },
            ))

        total_excluded = sum(len(ex.sample_ids) for ex in exp.excluded_samples)
        if total_excluded > 0:
            reasons = "; ".join(f"{ex.reason}({len(ex.sample_ids)}条)" for ex in exp.excluded_samples)
            chain.add(TraceNode(
                "人工排除",
                f"共排除 {total_excluded} 个样本",
                {"排除原因": reasons},
            ))

        return chain

    def trace_sample_range(self, exp: Experiment) -> TraceChain:
        chain = TraceChain()

        if exp.dataset:
            sr = exp.dataset.sample_range
            range_desc = f"[{sr.start_idx}, {sr.end_idx})" if sr.start_idx is not None else "全部"
            chain.add(TraceNode(
                "原始样本范围",
                f"{exp.dataset.dataset_name}: {sr.split} {range_desc}",
                {
                    "声明样本数": exp.dataset.sample_count,
                    "标签体系": str(list(exp.dataset.label_schema.keys())[:10]) if exp.dataset.label_schema else "未声明",
                },
            ))

        for ex in exp.excluded_samples:
            chain.add(TraceNode(
                "排除",
                f"{ex.reason}: {len(ex.sample_ids)} 条",
                {"操作人": ex.excluded_by or "未知", "排除时间": str(ex.excluded_at)},
            ))

        return chain
