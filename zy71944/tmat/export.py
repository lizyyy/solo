from __future__ import annotations

import json
import sys
from datetime import datetime
from typing import Any, TextIO

from .models import AttributionResult, AttributionRun, EvidenceLink
from .store import Store


def export_mission_brief(
    store: Store,
    run_id: str,
    output: TextIO | None = None,
) -> str:
    if output is None:
        output = sys.stdout

    run_rows = store.get_all_runs()
    run = next((r for r in run_rows if r.run_id == run_id), None)
    if run is None:
        raise ValueError(f"归因轮次 {run_id} 不存在")

    results = store.get_attribution_results_for_run(run_id)

    previous_runs = store.check_previous_run(run.batch_hash)
    history_note = ""
    if len(previous_runs) > 1:
        history_note = (
            f"\n[历史] 此批次已有{len(previous_runs)}次归因记录,"
            f"本次为第{len(previous_runs)}次,历史未覆盖\n"
        )

    lines: list[str] = []
    lines.append("=" * 60)
    lines.append("遥测异常归因 - 任务简报")
    lines.append("=" * 60)
    lines.append(f"归因轮次: {run.run_id[:8]}...")
    lines.append(f"生成时间: {run.run_timestamp.isoformat()}")
    lines.append(f"输入异常数: {run.input_anomaly_count}")
    lines.append(f"批次哈希: {run.batch_hash[:16]}...")
    if run.notes:
        lines.append(f"备注: {run.notes}")
    if history_note:
        lines.append(history_note)
    lines.append("")

    for i, result in enumerate(results, 1):
        anomaly = store.get_anomaly_record(result.anomaly_id)
        lines.append("-" * 40)
        lines.append(f"[{i}] 异常 {result.anomaly_id}")
        if anomaly:
            lines.append(f"    类型: {anomaly.anomaly_type.value}")
            lines.append(f"    时间: {anomaly.timestamp.isoformat()}")
            lines.append(f"    严重度: {anomaly.severity.value}")
            if anomaly.observed_value is not None:
                lines.append(f"    观测值: {anomaly.observed_value}")
            if anomaly.expected_value is not None:
                lines.append(f"    期望值: {anomaly.expected_value}")
        lines.append(f"    归因结论: {result.attributed_cause}")
        lines.append(f"    置信度: {result.confidence:.0%}")
        lines.append(f"    可复核原因: {result.verifiable_reason}")

        if result.evidence_links:
            lines.append(f"    证据链({len(result.evidence_links)}条):")
            for link in result.evidence_links:
                lines.append(f"      - [{link.source_type.value}] {link.source_id}")
                lines.append(f"        关联: {link.relevance}")
                if link.excerpt:
                    lines.append(f"        摘录: {link.excerpt}")
        else:
            lines.append("    证据链: 无(建议人工复核)")

        lines.append("")

    lines.append("=" * 60)
    lines.append("待办/需人工复核项:")
    needs_review = [r for r in results if r.confidence < 0.5 or not r.evidence_links]
    if needs_review:
        for r in needs_review:
            anomaly = store.get_anomaly_record(r.anomaly_id)
            atype = anomaly.anomaly_type.value if anomaly else "?"
            lines.append(f"  ! {r.anomaly_id} ({atype}) 置信度{r.confidence:.0%},需人工确认")
    else:
        lines.append("  (无)")
    lines.append("")

    overlaps = store.detect_window_overlaps()
    if overlaps:
        lines.append("窗口重叠警告:")
        for ov in overlaps:
            lines.append(
                f"  !! {ov['window_a']} x {ov['window_b']} "
                f"重叠{ov['overlap_seconds']:.0f}s "
                f"({ov['overlap_start']}~{ov['overlap_end']})"
            )
        lines.append("")

    lines.append("=" * 60)
    lines.append("可追溯性: 使用 tmat trace <result_id> 查看完整证据链")
    lines.append("=" * 60)

    brief = "\n".join(lines)
    output.write(brief)
    return brief


def export_mission_brief_json(
    store: Store,
    run_id: str,
) -> str:
    run_rows = store.get_all_runs()
    run = next((r for r in run_rows if r.run_id == run_id), None)
    if run is None:
        raise ValueError(f"归因轮次 {run_id} 不存在")

    results = store.get_attribution_results_for_run(run_id)
    previous_runs = store.check_previous_run(run.batch_hash)

    brief_data: dict[str, Any] = {
        "brief_type": "telemetry_anomaly_attribution",
        "run_id": run.run_id,
        "run_timestamp": run.run_timestamp.isoformat(),
        "batch_hash": run.batch_hash,
        "input_anomaly_count": run.input_anomaly_count,
        "notes": run.notes,
        "previous_run_count": len(previous_runs),
        "results": [],
        "needs_review": [],
        "window_overlaps": store.detect_window_overlaps(),
    }

    for result in results:
        anomaly = store.get_anomaly_record(result.anomaly_id)
        result_data: dict[str, Any] = {
            "result_id": result.result_id,
            "anomaly_id": result.anomaly_id,
            "anomaly_type": anomaly.anomaly_type.value if anomaly else None,
            "anomaly_timestamp": anomaly.timestamp.isoformat() if anomaly else None,
            "severity": anomaly.severity.value if anomaly else None,
            "attributed_cause": result.attributed_cause,
            "confidence": result.confidence,
            "verifiable_reason": result.verifiable_reason,
            "evidence": [
                {
                    "source_type": link.source_type.value,
                    "source_id": link.source_id,
                    "relevance": link.relevance,
                    "excerpt": link.excerpt,
                }
                for link in result.evidence_links
            ],
        }
        brief_data["results"].append(result_data)

        if result.confidence < 0.5 or not result.evidence_links:
            brief_data["needs_review"].append({
                "anomaly_id": result.anomaly_id,
                "confidence": result.confidence,
                "reason": "低置信度" if result.confidence < 0.5 else "无证据链",
            })

    return json.dumps(brief_data, ensure_ascii=False, indent=2)
