import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .dedup import Stratifier
from .models import (
    Conflict,
    ConflictResolution,
    Correction,
    EvalStatus,
    Evaluation,
    OnlineFeedback,
    Sample,
)
from .store import Store


class ReportGenerator:
    def __init__(self, store: Store):
        self.store = store
        self.stratifier = Stratifier(store)

    def generate(self) -> Dict[str, Any]:
        layers = self.stratifier.stratify()
        report: Dict[str, Any] = {
            "report_meta": {
                "generated_at": datetime.now().isoformat(timespec="seconds"),
                "tool": "log_cluster_eval",
                "total_samples": len(self.store.list_samples()),
                "total_evaluations": len(self.store.list_evaluations()),
            },
            "summary": self._build_summary(layers),
            "layers": layers,
            "conflicts": self._build_conflict_section(),
            "detail": self._build_detail_section(),
        }
        return report

    def _build_summary(self, layers: Dict[str, List]) -> Dict[str, Any]:
        model_count = len(layers.get("model_only", []))
        manual_count = len(layers.get("manual_corrected", []))
        review_count = len(layers.get("needs_review", []))
        conflict_count = len(layers.get("conflict", []))
        total = model_count + manual_count + review_count + conflict_count
        return {
            "total_evaluated": total,
            "model_judgment_count": model_count,
            "manual_corrected_count": manual_count,
            "needs_review_count": review_count,
            "conflict_count": conflict_count,
            "model_judgment_pct": round(model_count / total * 100, 1) if total else 0,
            "manual_corrected_pct": round(manual_count / total * 100, 1) if total else 0,
            "needs_review_pct": round(review_count / total * 100, 1) if total else 0,
        }

    def _build_conflict_section(self) -> List[Dict[str, Any]]:
        conflicts = self.store.list_conflicts()
        result: List[Dict[str, Any]] = []
        for cf in conflicts:
            entry = cf.to_dict()
            entry["model_evidence_detail"] = [
                {"kind": e.kind, "location": e.location, "content": e.content}
                for e in cf.model_evidence
            ]
            entry["imported_evidence_detail"] = [
                {"kind": e.kind, "location": e.location, "content": e.content}
                for e in cf.imported_evidence
            ]
            result.append(entry)
        return result

    def _build_detail_section(self) -> List[Dict[str, Any]]:
        evaluations = self.store.list_evaluations()
        detail: List[Dict[str, Any]] = []
        for ev in evaluations:
            sample = self.store.get_sample(ev.sample_id)
            corrections = self.store.get_corrections_for_eval(ev.eval_id)
            conflicts = [
                c for c in self.store.list_conflicts()
                if c.sample_id == ev.sample_id
            ]
            feedback = self.store.get_feedback_for_sample(ev.sample_id)

            entry: Dict[str, Any] = {
                "eval_id": ev.eval_id,
                "sample_id": ev.sample_id,
                "raw_log": sample.raw_log if sample else "",
                "sample_source": sample.source if sample else "",
                "sample_imported_at": sample.imported_at if sample else "",
                "cluster_label": ev.cluster_label,
                "root_cause": ev.root_cause,
                "confidence": ev.confidence,
                "status": ev.status.value,
                "model_version": ev.model_version,
                "evaluated_at": ev.evaluated_at,
                "evidence": [e.to_dict() for e in ev.evidence],
                "corrections": [c.to_dict() for c in corrections],
                "conflicts": [
                    {
                        "conflict_id": cf.conflict_id,
                        "model_claim": cf.model_claim,
                        "imported_claim": cf.imported_claim,
                        "resolution": cf.resolution.value,
                        "suggested_action": cf.suggested_action,
                    }
                    for cf in conflicts
                ],
                "online_feedback": [fb.to_dict() for fb in feedback],
            }
            detail.append(entry)
        return detail

    def export_json(self, output_path: str) -> str:
        report = self.generate()
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return str(path)

    def export_markdown(self, output_path: str) -> str:
        report = self.generate()
        md = self._render_markdown(report)
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(md, encoding="utf-8")
        return str(path)

    def _render_markdown(self, report: Dict[str, Any]) -> str:
        lines: List[str] = []
        meta = report["report_meta"]
        lines.append("# 日志异常根因聚类评测报告")
        lines.append("")
        lines.append(f"- 生成时间: {meta['generated_at']}")
        lines.append(f"- 样本总数: {meta['total_samples']}")
        lines.append(f"- 评测总数: {meta['total_evaluations']}")
        lines.append("")

        summary = report["summary"]
        lines.append("## 概览")
        lines.append("")
        lines.append(f"| 类别 | 数量 | 占比 |")
        lines.append(f"| --- | --- | --- |")
        lines.append(f"| 模型判断 | {summary['model_judgment_count']} | {summary['model_judgment_pct']}% |")
        lines.append(f"| 人工修正 | {summary['manual_corrected_count']} | {summary['manual_corrected_pct']}% |")
        lines.append(f"| 需复核 | {summary['needs_review_count']} | {summary['needs_review_pct']}% |")
        lines.append(f"| 冲突 | {summary['conflict_count']} | - |")
        lines.append("")

        layers = report["layers"]
        for layer_name, layer_label in [
            ("model_only", "模型判断"),
            ("manual_corrected", "人工修正"),
            ("needs_review", "需复核"),
            ("conflict", "冲突"),
        ]:
            items = layers.get(layer_name, [])
            if not items:
                continue
            lines.append(f"## {layer_label}")
            lines.append("")
            lines.append("| 评测ID | 样本ID | 聚类 | 根因 | 置信度 | 时间 |")
            lines.append("| --- | --- | --- | --- | --- | --- |")
            for item in items:
                root_cause_short = item.get("root_cause", "")[:30]
                lines.append(
                    f"| {item['eval_id']} | {item['sample_id']} | "
                    f"{item['cluster_label']} | {root_cause_short} | "
                    f"{item['confidence']} | {item['evaluated_at']} |"
                )
            lines.append("")

        conflicts = report.get("conflicts", [])
        if conflicts:
            lines.append("## 冲突详情")
            lines.append("")
            for cf in conflicts:
                lines.append(f"### 冲突 {cf['conflict_id']}")
                lines.append(f"- 样本: {cf['sample_id']}")
                lines.append(f"- 模型主张: {cf['model_claim']}")
                lines.append(f"- 导入主张: {cf['imported_claim']}")
                lines.append(f"- 建议动作: {cf['suggested_action']}")
                lines.append(f"- 状态: {cf['resolution']}")
                if cf.get("resolution_detail"):
                    lines.append(f"- 处理说明: {cf['resolution_detail']}")
                lines.append("")
                if cf.get("model_evidence_detail"):
                    lines.append("**模型侧证据:**")
                    for ev in cf["model_evidence_detail"]:
                        lines.append(f"  - [{ev['kind']}] {ev['location']}: {ev['content'][:80]}")
                    lines.append("")
                if cf.get("imported_evidence_detail"):
                    lines.append("**导入侧证据:**")
                    for ev in cf["imported_evidence_detail"]:
                        lines.append(f"  - [{ev['kind']}] {ev['location']}: {ev['content'][:80]}")
                    lines.append("")

        detail = report.get("detail", [])
        if detail:
            lines.append("## 详细记录")
            lines.append("")
            for d in detail:
                lines.append(f"### {d['eval_id']} (样本 {d['sample_id']})")
                lines.append(f"- 原始日志: `{d['raw_log'][:100]}...`" if len(d.get("raw_log", "")) > 100 else f"- 原始日志: `{d.get('raw_log', '')}`")
                lines.append(f"- 来源: {d.get('sample_source', 'N/A')}")
                lines.append(f"- 导入时间: {d.get('sample_imported_at', 'N/A')}")
                lines.append(f"- 聚类: {d['cluster_label']}")
                lines.append(f"- 根因: {d['root_cause']}")
                lines.append(f"- 置信度: {d['confidence']}")
                lines.append(f"- 状态: {d['status']}")
                lines.append(f"- 模型版本: {d['model_version']}")
                lines.append(f"- 评测时间: {d['evaluated_at']}")
                lines.append("")
                if d.get("evidence"):
                    lines.append("**证据链:**")
                    for ev in d["evidence"]:
                        lines.append(f"  - [{ev['kind']}] {ev['location']}: {ev['content'][:80]} (置信度: {ev.get('confidence', 'N/A')})")
                    lines.append("")
                if d.get("corrections"):
                    lines.append("**修正记录:**")
                    for c in d["corrections"]:
                        lines.append(
                            f"  - [{c['corrected_at']}] {c['corrector']} 修正 {c['field_corrected']}: "
                            f"{c['old_value']} → {c['new_value']} (原因: {c['reason']})"
                        )
                    lines.append("")
                if d.get("online_feedback"):
                    lines.append("**线上反馈:**")
                    for fb in d["online_feedback"]:
                        lines.append(f"  - [{fb['reported_at']}] {fb['reporter']}: [{fb['feedback_type']}] {fb['feedback_content']}")
                    lines.append("")
                if d.get("conflicts"):
                    lines.append("**关联冲突:**")
                    for cf in d["conflicts"]:
                        lines.append(f"  - 冲突 {cf['conflict_id']}: {cf['model_claim']} vs {cf['imported_claim']} (状态: {cf['resolution']})")
                    lines.append("")

        return "\n".join(lines)
