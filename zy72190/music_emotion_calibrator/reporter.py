from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from typing import Optional

from .models import CalibratorRun, JudgmentSource
from .stratifier import Stratifier


class Reporter:
    def __init__(self, run: CalibratorRun):
        self._run = run
        self._stratifier = Stratifier(run.records)

    def generate_text_report(self) -> str:
        lines: list[str] = []
        lines.append("=" * 72)
        lines.append("音乐情绪分类校准报告")
        lines.append("=" * 72)
        lines.append(f"运行ID:   {self._run.run_id}")
        lines.append(f"运行时间: {self._run.run_timestamp}")
        lines.append(f"输入文件: {json.dumps(self._run.input_files, ensure_ascii=False)}")
        lines.append("")

        summary = self._run.summary
        lines.append("-" * 72)
        lines.append("一、总览")
        lines.append("-" * 72)
        lines.append(f"总样本数: {summary['total_samples']}")
        lines.append(
            f"需复核:   {summary['requires_review_count']} "
            f"({summary['requires_review_ratio'] * 100:.1f}%)"
        )
        lines.append("")

        lines.append("按最终判断来源:")
        for src, cnt in sorted(summary["by_final_source"].items()):
            lines.append(f"  {src}: {cnt}")
        lines.append("")

        lines.append("按一致/冲突状态:")
        for status, cnt in sorted(summary["by_agreement_status"].items()):
            lines.append(f"  {status}: {cnt}")
        lines.append("")

        lines.append("按最终情绪分布:")
        for emo, cnt in sorted(summary["by_final_emotion"].items()):
            lines.append(f"  {emo}: {cnt}")
        lines.append("")

        strat = self._stratifier.summary()
        lines.append("-" * 72)
        lines.append("二、分层统计")
        lines.append("-" * 72)
        for layer_name, groups in strat.items():
            lines.append(f"  [{layer_name}]")
            for k, v in sorted(groups.items()):
                lines.append(f"    {k}: {v}")
            lines.append("")

        lines.append("-" * 72)
        lines.append("三、模型判断样本（来源=model）")
        lines.append("-" * 72)
        model_records = [r for r in self._run.records if r.final_source == JudgmentSource.MODEL]
        for r in model_records:
            lines.append(
                f"  [{r.sample_id}] {r.final_emotion}  "
                f"(模型置信度={r.model_confidence:.2f}, "
                f"状态={r.agreement_status}, "
                f"指纹={r.sample_fingerprint})"
            )
        lines.append("")

        lines.append("-" * 72)
        lines.append("四、人工修正样本（来源=manual）")
        lines.append("-" * 72)
        manual_records = [r for r in self._run.records if r.final_source == JudgmentSource.MANUAL]
        for r in manual_records:
            lines.append(
                f"  [{r.sample_id}] {r.model_prediction} → {r.final_emotion}  "
                f"(人工修正, 状态={r.agreement_status}, "
                f"指纹={r.sample_fingerprint})"
            )
        lines.append("")

        lines.append("-" * 72)
        lines.append("五、需复核样本（来源=requires_review）")
        lines.append("-" * 72)
        review_records = [
            r for r in self._run.records if r.final_source == JudgmentSource.REQUIRES_REVIEW
        ]
        for r in review_records:
            lines.append(f"  [{r.sample_id}] 当前={r.final_emotion}  (状态={r.agreement_status})")
            lines.append(f"    推理: {r.evidence_chain.reasoning}")
        lines.append("")

        if self._run.annotations:
            lines.append("-" * 72)
            lines.append("六、备注补录记录")
            lines.append("-" * 72)
            for a in self._run.annotations:
                lines.append(f"  [{a.sample_id}] {a.annotator_id} @ {a.annotation_timestamp}")
                lines.append(f"    备注: {a.annotation_text}")
                lines.append(f"    差异: {a.diff_description}")
            lines.append("")

        lines.append("-" * 72)
        lines.append("七、证据链明细（每条判断的完整依据）")
        lines.append("-" * 72)
        for r in self._run.records:
            lines.append(f"  [{r.sample_id}]")
            lines.append(f"    最终判断: {r.final_emotion} (来源={r.final_source.value})")
            lines.append(f"    推理过程: {r.evidence_chain.reasoning}")
            for idx, ev in enumerate(r.evidence_chain.evidence_items, 1):
                lines.append(f"    证据{idx}: {json.dumps(ev, ensure_ascii=False)}")
            lines.append(f"    处理时间: {r.processing_timestamp}")
            lines.append(f"    原始来源: {r.original_source_file}")
            lines.append("")

        lines.append("=" * 72)
        lines.append("报告结束")
        lines.append("=" * 72)
        return "\n".join(lines)

    def generate_json_report(self) -> str:
        return self._run.to_json(indent=2)

    def generate_csv_report(self) -> str:
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "sample_id",
            "sample_fingerprint",
            "final_emotion",
            "final_source",
            "model_prediction",
            "model_confidence",
            "model_version",
            "manual_correction",
            "online_feedback",
            "agreement_status",
            "reasoning",
            "evidence_count",
            "processing_timestamp",
            "original_source_file",
        ])
        for r in self._run.records:
            writer.writerow([
                r.sample_id,
                r.sample_fingerprint,
                r.final_emotion,
                r.final_source.value,
                r.model_prediction,
                r.model_confidence,
                r.model_version,
                r.manual_correction or "",
                r.online_feedback or "",
                r.agreement_status,
                r.evidence_chain.reasoning,
                len(r.evidence_chain.evidence_items),
                r.processing_timestamp,
                r.original_source_file,
            ])
        return buf.getvalue()
