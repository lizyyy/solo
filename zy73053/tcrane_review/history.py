#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""塔吊维保报告复核 - 历史记录与补注重跑对齐"""

import hashlib
import json
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .engine import ReviewResult, run_review


HISTORY_DIR = Path(__file__).resolve().parent.parent / "history"
HISTORY_DIR.mkdir(exist_ok=True)
INDEX_FILE = HISTORY_DIR / "index.json"


@dataclass
class RunRecord:
    run_id: str
    run_time: str
    report_id: str
    status: str
    note_append: str
    export_file: str
    data_hash: str  # 传感器+报告+BOM 的内容哈希，用于对齐校验


def _load_index() -> Dict[str, Any]:
    if INDEX_FILE.exists():
        with open(INDEX_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"runs": [], "current_batch_id": None, "batches": {}}


def _save_index(idx: Dict[str, Any]) -> None:
    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(idx, f, ensure_ascii=False, indent=2)


def compute_data_hash(report_path: Path, bom_path: Path, sensor_dir: Path) -> str:
    """计算输入数据整体哈希，用于验证前后次运行数据一致"""
    h = hashlib.sha256()
    for p in sorted([report_path, bom_path]):
        h.update(p.read_bytes())
    for log in sorted(sensor_dir.glob("*.log")):
        h.update(log.read_bytes())
    return h.hexdigest()[:16]


def save_run(result: ReviewResult, data_hash: str, extra_note: str = "",
             export_dir: Optional[Path] = None) -> Path:
    export_dir = export_dir or (HISTORY_DIR / "exports")
    export_dir.mkdir(exist_ok=True, parents=True)
    export_path = export_dir / f"{result.run_id}.json"

    # 导出完整复核结果（用于前后对齐）
    payload = result.to_dict()
    payload["data_hash"] = data_hash
    payload["extra_note"] = extra_note
    with open(export_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    # 更新索引
    idx = _load_index()
    idx.setdefault("runs", []).append(RunRecord(
        run_id=result.run_id,
        run_time=result.run_time,
        report_id=result.report_id,
        status=result.review_status,
        note_append=extra_note,
        export_file=str(export_path),
        data_hash=data_hash,
    ).__dict__)
    _save_index(idx)
    return export_path


def get_previous_runs(report_id: Optional[str] = None) -> List[Dict[str, Any]]:
    idx = _load_index()
    runs = idx.get("runs", [])
    if report_id:
        runs = [r for r in runs if r["report_id"] == report_id]
    return runs


def verify_alignment(cur_hash: str, report_id: str) -> Dict[str, Any]:
    """校验当前运行与前一次运行数据是否一致；用于补注重跑场景"""
    runs = get_previous_runs(report_id)
    if not runs:
        return {"aligned": None, "prev_run": None, "note": "无前序运行记录"}
    prev = runs[-1]
    same = prev["data_hash"] == cur_hash
    return {
        "aligned": same,
        "prev_run": prev["run_id"],
        "prev_time": prev["run_time"],
        "prev_status": prev["status"],
        "note": (f"与前次数据输入{'一致' if same else '不一致'}，"
                 f"{'补注重跑有效：历史记录可与本次导出前后对齐' if same else '⚠️ 数据输入与前次不同，导出结果会不一致'}"),
    }
