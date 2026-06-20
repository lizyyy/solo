import csv
import os
from datetime import datetime
from typing import List, Dict

from .models import RejudgeRecord


REJUDGE_FILENAME = "rejudge_history.csv"


def load_rejudge_history(csv_path: str) -> List[RejudgeRecord]:
    records = []
    if not os.path.exists(csv_path):
        return records
    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            records.append(RejudgeRecord(
                batch_no=row.get("batch_no", "").strip(),
                material_name=row.get("material_name", "").strip(),
                param_name=row.get("param_name", "").strip(),
                original_result=row.get("original_result", "").strip(),
                new_result=row.get("new_result", "").strip(),
                reason=row.get("reason", "").strip(),
                operator=row.get("operator", "").strip(),
                timestamp=row.get("timestamp", "").strip(),
            ))
    return records


def save_rejudge_history(records: List[RejudgeRecord], csv_path: str) -> None:
    os.makedirs(os.path.dirname(csv_path), exist_ok=True)
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "batch_no", "material_name", "param_name",
            "original_result", "new_result", "reason", "operator", "timestamp",
        ])
        for r in records:
            writer.writerow([
                r.batch_no, r.material_name, r.param_name,
                r.original_result, r.new_result, r.reason, r.operator, r.timestamp,
            ])


def add_rejudge(csv_path: str, batch_no: str, material_name: str, param_name: str,
                original_result: str, new_result: str, reason: str, operator: str) -> RejudgeRecord:
    history = load_rejudge_history(csv_path)
    record = RejudgeRecord(
        batch_no=batch_no,
        material_name=material_name,
        param_name=param_name,
        original_result=original_result,
        new_result=new_result,
        reason=reason,
        operator=operator,
    )
    history.append(record)
    save_rejudge_history(history, csv_path)
    return record


def get_rejudge_by_batch(history: List[RejudgeRecord], batch_no: str) -> List[RejudgeRecord]:
    return [r for r in history if r.batch_no == batch_no]


def print_rejudge_diff(history: List[RejudgeRecord]) -> None:
    if not history:
        print("  暂无改判记录")
        return

    print()
    print("=" * 70)
    print("  🔄 改判记录 — 改判前后差别一览")
    print("=" * 70)
    print(f"  共 {len(history)} 条改判记录")
    print("-" * 70)

    for i, r in enumerate(history, 1):
        print(f"  [{i:02d}] 批次 {r.batch_no}")
        print(f"       材料: {r.material_name} | 参数: {r.param_name}")
        print(f"       原结论: {r.original_result}  →  新结论: {r.new_result}")
        print(f"       改判原因: {r.reason}")
        print(f"       操作人: {r.operator} | 时间: {r.timestamp}")
        print()

    print("=" * 70)


def apply_rejudge_to_results(results, history: List[RejudgeRecord]) -> int:
    rejudged_count = 0
    rejudge_map: Dict[str, RejudgeRecord] = {}
    for rj in history:
        key = f"{rj.batch_no}|{rj.material_name}|{rj.param_name}"
        rejudge_map[key] = rj

    for r in results:
        key = f"{r.record.batch_no}|{r.record.material_name}|{r.record.param_name}"
        rj = rejudge_map.get(key)
        if rj:
            r._rejudged = True
            r._rejudge_reason = rj.reason
            r._original_result = rj.original_result
            r._new_result = rj.new_result
            r.is_pass = (rj.new_result in ["合格", "合格让步", "让步接收"])
            rejudged_count += 1
    return rejudged_count
