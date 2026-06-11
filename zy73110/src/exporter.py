import os
import csv
from datetime import datetime

from .state import ReviewState, STATUS_LABELS
from .material import MATERIAL_TYPES


def export_detail_csv(state: ReviewState, csv_path: str) -> str:
    os.makedirs(os.path.dirname(csv_path), exist_ok=True)

    headers = [
        "材料类型",
        "材料编号",
        "标题",
        "当前版本",
        "最新批次",
        "状态",
        "历史版本数",
        "是否改过口径",
        "最近变更动作",
        "最近变更时间",
        "备注",
    ]

    rows = []
    for key in sorted(state.materials.keys()):
        ms = state.materials[key]
        type_label = MATERIAL_TYPES.get(ms.material_type, ms.material_type)
        status_label = STATUS_LABELS.get(ms.status, ms.status)

        history_count = len(ms.history)
        changed = "是" if history_count > 1 else "否"

        last_action = ""
        last_time = ""
        if ms.history:
            last = ms.history[-1]
            last_action = last.get("action", "")
            last_time = last.get("time", "")

        rows.append([
            type_label,
            ms.material_id,
            ms.title,
            ms.current_version,
            ms.latest_batch,
            status_label,
            history_count,
            changed,
            last_action,
            last_time,
            ms.remarks,
        ])

    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)

    state.csv_export_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return csv_path


def export_history_csv(state: ReviewState, csv_path: str) -> str:
    os.makedirs(os.path.dirname(csv_path), exist_ok=True)

    headers = [
        "材料类型",
        "材料编号",
        "标题",
        "版本",
        "批次",
        "动作",
        "时间",
        "签名(旧)",
        "签名(新)",
    ]

    rows = []
    for key in sorted(state.materials.keys()):
        ms = state.materials[key]
        type_label = MATERIAL_TYPES.get(ms.material_type, ms.material_type)
        for h in ms.history:
            rows.append([
                type_label,
                ms.material_id,
                ms.title,
                h.get("version", ""),
                h.get("batch_no", ""),
                h.get("action", ""),
                h.get("time", ""),
                h.get("old_signature", ""),
                h.get("new_signature", h.get("signature", "")),
            ])

    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)

    return csv_path


def export_summary_csv(state: ReviewState, csv_path: str) -> str:
    os.makedirs(os.path.dirname(csv_path), exist_ok=True)

    headers = ["项目", "数值"]
    summary = {
        "项目名称": state.project_name,
        "整体状态": STATUS_LABELS.get(state.overall_status, state.overall_status),
        "当前处理批次": state.current_batch,
        "材料总数": len(state.materials),
        "运行次数": state.run_count,
        "最后运行时间": state.last_run_time,
        "CSV导出时间": state.csv_export_time,
        "挂起原因数": len(state.suspension_reasons),
    }

    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        for k, v in summary.items():
            writer.writerow([k, v])
        if state.suspension_reasons:
            writer.writerow([])
            writer.writerow(["挂起原因", ""])
            for i, r in enumerate(state.suspension_reasons, 1):
                writer.writerow([f"原因{i}", r])

    return csv_path
