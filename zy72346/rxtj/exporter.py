from __future__ import annotations

import csv
import io
import json
from pathlib import Path
from typing import Optional

from .store import Store
from .workflow import build_unified_report


def export_report_json(store: Store, output_path: Optional[str] = None) -> str:
    report = build_unified_report(store)
    data = json.dumps(report, ensure_ascii=False, indent=2)
    if output_path:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(data)
    return data


def export_report_csv(store: Store, output_path: Optional[str] = None) -> str:
    report = build_unified_report(store)
    results = report["calculation_results"]
    summary = report["annotations_summary"]
    batches = report["batches"]

    buf = io.StringIO()
    writer = csv.writer(buf)

    writer.writerow(["=== 容斥统计优惠叠加 — 汇总报告 ==="])
    writer.writerow([""])
    writer.writerow(["项目", "数值"])
    writer.writerow(["批注总条数", summary["total"]])
    writer.writerow(["抽样总条数", summary["sampling_total"]])
    writer.writerow(["正常(参与计算)", summary["normal_pending_count"]])
    writer.writerow(["待复核(不参与计算)", summary["flagged_count"]])
    writer.writerow(["已复核(按处理方式)", summary["reviewed_count"]])
    writer.writerow(["导入批次数", len(batches)])
    writer.writerow([""])

    writer.writerow(["=== 导入批次详情 ==="])
    writer.writerow([
        "批次ID", "来源", "总条数", "新增", "改动", "未变", "跳过",
        "标记复核", "是否回滚", "创建时间"
    ])
    for b in batches:
        writer.writerow([
            b["id"], b["source"], b["total_rows"], b["new"], b["changed"],
            b["unchanged"], b["skipped"], b["flagged"],
            "是" if b["rolled_back"] else "否", b["created_at"]
        ])
    writer.writerow([""])

    writer.writerow(["=== 容斥计算结果(含证据摘要) ==="])
    writer.writerow([
        "类别", "项目", "计算值", "是否边界", "边界类型", "状态",
        "原始行号", "原始值", "当前值", "抽样值", "原始说法", "改后值",
        "复核原因", "下一步找谁", "复核人", "复核时间", "变更次数",
        "最后变更人", "最后变更原因", "冲突处理"
    ])
    for r in results:
        ev = r.get("evidence") or {}
        writer.writerow([
            r.get("category", ""),
            r.get("item_name", ""),
            r.get("value", ""),
            "是" if r.get("was_edge_case") else "否",
            r.get("edge_case_type") or "",
            r.get("status", ""),
            ev.get("original_line_number", ""),
            ev.get("original_value", ""),
            ev.get("current_value", ""),
            ev.get("sampling_list_value", ""),
            ev.get("original_statement", ""),
            ev.get("corrected_value", ""),
            ev.get("review_reason", ""),
            ev.get("next_contact", ""),
            ev.get("reviewed_by", ""),
            ev.get("reviewed_at", ""),
            ev.get("change_count", 0),
            ev.get("last_changed_by", ""),
            ev.get("last_changed_reason", ""),
            ev.get("conflict_resolution") or "",
        ])
    writer.writerow([""])

    data = buf.getvalue()
    if output_path:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            f.write(data)
    return data
