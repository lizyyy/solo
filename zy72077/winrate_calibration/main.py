from __future__ import annotations
import csv
import sys
import os
from calibrator import calibrate_record

APPENDED_COLUMNS = [
    "calibrated_winrate", "calibration_status", "judgment_process",
    "data_source", "processed_at", "skip_reason", "original_fields_json",
]

STATUS_ORDER = {
    "calibrated": 0,
    "calibrated_low_confidence": 1,
    "calibrated_unknown_confidence": 2,
    "calibrated_from_old": 3,
    "needs_manual_review": 4,
}

LABEL_MAP = {
    "calibrated": "校准完成",
    "calibrated_low_confidence": "校准完成(低置信度)",
    "calibrated_unknown_confidence": "校准完成(置信度未知)",
    "calibrated_from_old": "旧口径补录",
    "needs_manual_review": "需人工确认",
}


def run(input_path: str, output_path: str, exception_path: str) -> None:
    with open(input_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if not rows:
        print("输入文件为空，无记录可处理。")
        return

    results = []
    exceptions = []

    for row in rows:
        result = calibrate_record(row)
        results.append(result)

        status = result.get("calibration_status", "")
        if status in ("needs_manual_review", "calibrated_low_confidence",
                       "calibrated_unknown_confidence"):
            exceptions.append(result)

    fieldnames = list(rows[0].keys())
    extra_cols = [c for c in APPENDED_COLUMNS if c not in fieldnames]
    all_fieldnames = fieldnames + extra_cols

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    os.makedirs(os.path.dirname(exception_path) or ".", exist_ok=True)

    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=all_fieldnames, extrasaction="ignore")
        writer.writeheader()
        for r in results:
            writer.writerow(r)

    with open(exception_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=all_fieldnames, extrasaction="ignore")
        writer.writeheader()
        for r in sorted(
            exceptions,
            key=lambda x: STATUS_ORDER.get(x.get("calibration_status", ""), 99),
        ):
            writer.writerow(r)

    print(f"共处理 {len(results)} 条记录")
    status_counts: dict[str, int] = {}
    for r in results:
        s = r.get("calibration_status", "unknown")
        status_counts[s] = status_counts.get(s, 0) + 1

    for s, cnt in sorted(status_counts.items(), key=lambda x: STATUS_ORDER.get(x[0], 99)):
        label = LABEL_MAP.get(s, s)
        print(f"  {label}: {cnt} 条")

    print(f"\n校准结果: {output_path}")
    print(f"异常清单: {exception_path} ({len(exceptions)} 条)")


def main():
    if len(sys.argv) < 2:
        print("用法: python main.py <输入CSV> [输出CSV] [异常清单CSV]")
        print("示例: python main.py sample_data.csv output/calibrated.csv output/exceptions.csv")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else "output/calibrated.csv"
    exception_path = sys.argv[3] if len(sys.argv) > 3 else "output/exceptions.csv"

    if not os.path.exists(input_path):
        print(f"错误: 输入文件不存在: {input_path}")
        sys.exit(1)

    run(input_path, output_path, exception_path)


if __name__ == "__main__":
    main()
