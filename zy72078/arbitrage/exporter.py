import csv
import json
import os
from datetime import datetime

from .models import SearchResult, AnnotationDiff


def export_results(result: SearchResult, output_dir: str, fmt: str = "csv",
                   annotation_diffs: list = None) -> dict:
    os.makedirs(output_dir, exist_ok=True)
    now = datetime.now().strftime("%Y%m%d_%H%M%S")
    exported = {}

    paths_file = os.path.join(output_dir, f"arbitrage_paths_{now}.{fmt}")
    _export_paths(result.paths, paths_file, fmt)
    exported["paths"] = paths_file

    anomalies_file = os.path.join(output_dir, f"anomalies_{now}.{fmt}")
    _export_anomalies(result.anomalies, anomalies_file, fmt)
    exported["anomalies"] = anomalies_file

    uncomputable_file = os.path.join(output_dir, f"uncomputable_{now}.{fmt}")
    _export_uncomputable(result.uncomputable_records, uncomputable_file, fmt)
    exported["uncomputable"] = uncomputable_file

    if annotation_diffs:
        diff_file = os.path.join(output_dir, f"annotation_diffs_{now}.{fmt}")
        _export_diffs(annotation_diffs, diff_file, fmt)
        exported["diffs"] = diff_file

    summary_file = os.path.join(output_dir, f"summary_{now}.json")
    _export_summary(result, summary_file)
    exported["summary"] = summary_file

    return exported


def _export_paths(paths: list, filepath: str, fmt: str):
    rows = []
    for p in paths:
        rows.append({
            "cycle": " → ".join(p.cycle) + f" → {p.cycle[0]}",
            "profit_rate": f"{p.profit_rate:.8f}",
            "profit_pct": f"{p.profit_pct:.6f}%",
            "reasoning": p.reasoning,
            "detected_at": p.detected_at,
            "original_sources": " | ".join(s for s in p.original_sources if s),
            "original_notes": " | ".join(n for n in p.original_notes if n),
        })

    _write_rows(rows, filepath, fmt)


def _export_anomalies(anomalies: list, filepath: str, fmt: str):
    rows = []
    for a in anomalies:
        rows.append({
            "row_index": a.row_index,
            "from_currency": a.from_currency,
            "to_currency": a.to_currency,
            "anomaly_type": a.anomaly_type,
            "detail": a.detail,
            "original_notes": a.original_notes,
            "original_source": a.original_source,
            "detected_at": a.detected_at,
        })

    _write_rows(rows, filepath, fmt)


def _export_uncomputable(records: list, filepath: str, fmt: str):
    rows = []
    for r in records:
        rows.append({
            "row_index": r.row_index,
            "from_currency": r.from_currency,
            "to_currency": r.to_currency,
            "rate_raw": r.raw_row.get("rate", ""),
            "unit": r.unit,
            "compute_reason": r.compute_reason,
            "original_notes": r.original_notes,
            "original_source": r.original_source,
            "loaded_at": r.loaded_at,
        })

    _write_rows(rows, filepath, fmt)


def _export_diffs(diffs: list, filepath: str, fmt: str):
    rows = []
    for d in diffs:
        rows.append({
            "row_index": d.row_index,
            "field": d.field,
            "before": d.before,
            "after": d.after,
            "explanation": d.explanation,
            "diff_timestamp": d.diff_timestamp,
        })

    _write_rows(rows, filepath, fmt)


def _export_summary(result: SearchResult, filepath: str):
    summary = {
        "search_timestamp": result.search_timestamp,
        "total_rows_loaded": result.total_rows_loaded,
        "total_rows_valid": result.total_rows_valid,
        "total_rows_uncomputable": result.total_rows_uncomputable,
        "arbitrage_paths_found": len(result.paths),
        "anomalies_found": len(result.anomalies),
        "top_paths": [
            {
                "cycle": " → ".join(p.cycle) + f" → {p.cycle[0]}",
                "profit_pct": round(p.profit_pct, 6),
            }
            for p in result.paths[:5]
        ],
    }

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)


def _write_rows(rows: list, filepath: str, fmt: str):
    if fmt == "csv":
        if not rows:
            with open(filepath, "w", encoding="utf-8-sig") as f:
                f.write("")
            return
        fieldnames = list(rows[0].keys())
        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
    elif fmt == "json":
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, indent=2)
    else:
        raise ValueError(f"不支持的导出格式: {fmt}")
