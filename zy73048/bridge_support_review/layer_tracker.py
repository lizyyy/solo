from __future__ import annotations

from copy import deepcopy
from typing import Dict, List, Tuple

from .models import (
    RowJudgment,
    SparePartRow,
    VersionLayer,
)


LAYER_LABEL = {
    VersionLayer.ORIGINAL: "旧处理（首次导入原始清单）",
    VersionLayer.REMARK_PATCHED: "后补备注（彩排前人工补记备注）",
    VersionLayer.LATEST_EXPORT: "最新导出（本次重新导出的完整版本）",
}


def tag_layers(
    original_rows: List[SparePartRow],
    patched_rows: List[SparePartRow],
    latest_rows: List[SparePartRow],
) -> Dict[str, List[SparePartRow]]:
    original_ids = {r.row_id for r in original_rows}
    patched_ids = {r.row_id for r in patched_rows if r.source_layer == VersionLayer.REMARK_PATCHED}
    result: Dict[str, List[SparePartRow]] = {
        "ORIGINAL": [],
        "REMARK_PATCHED": [],
        "LATEST_EXPORT": [],
    }
    latest_ids = {r.row_id for r in latest_rows}
    for row in original_rows:
        copy_row = deepcopy(row)
        copy_row.source_layer = VersionLayer.ORIGINAL
        result["ORIGINAL"].append(copy_row)
    for row in patched_rows:
        if row.row_id in patched_ids:
            copy_row = deepcopy(row)
            copy_row.source_layer = VersionLayer.REMARK_PATCHED
            result["REMARK_PATCHED"].append(copy_row)
    for row in latest_rows:
        copy_row = deepcopy(row)
        if row.row_id in patched_ids:
            copy_row.source_layer = VersionLayer.REMARK_PATCHED
        else:
            copy_row.source_layer = VersionLayer.LATEST_EXPORT
        result["LATEST_EXPORT"].append(copy_row)
    return result


def layer_judgment_overlay(
    original_judgments: Dict[str, RowJudgment],
    patched_judgments: Dict[str, RowJudgment],
    latest_judgments: Dict[str, RowJudgment],
) -> List[Tuple[str, VersionLayer, str, str, str]]:
    all_rows = (
        set(original_judgments.keys())
        | set(patched_judgments.keys())
        | set(latest_judgments.keys())
    )
    table: List[Tuple[str, VersionLayer, str, str, str]] = []
    for rid in sorted(all_rows):
        o = original_judgments.get(rid)
        p = patched_judgments.get(rid)
        l = latest_judgments.get(rid)
        o_val = o.judgment.value if o else "—"
        p_val = p.judgment.value if p else "—"
        l_val = l.judgment.value if l else "—"
        if l and l_val != o_val and l_val != p_val:
            table.append((rid, VersionLayer.LATEST_EXPORT, o_val, p_val, l_val))
        elif p and p_val != o_val:
            table.append((rid, VersionLayer.REMARK_PATCHED, o_val, p_val, l_val))
        else:
            table.append((rid, VersionLayer.ORIGINAL, o_val, p_val, l_val))
    return table


def summarize_layer_changes(
    overlay: List[Tuple[str, VersionLayer, str, str, str]],
) -> Dict[str, int]:
    summary = {
        "latest_export_overrides": 0,
        "remark_patched_overrides": 0,
        "stable_original": 0,
    }
    for _, layer, _, _, _ in overlay:
        if layer == VersionLayer.LATEST_EXPORT:
            summary["latest_export_overrides"] += 1
        elif layer == VersionLayer.REMARK_PATCHED:
            summary["remark_patched_overrides"] += 1
        else:
            summary["stable_original"] += 1
    return summary
