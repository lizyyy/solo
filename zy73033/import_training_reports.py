#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Import pet training reports with dedupe and note protection.

The original Base tables remain the delivery target. This script makes the
upsert rule executable and locally verifiable before an operator mirrors the
result into Feishu/Base or wires the same payloads to lark-cli.
"""

from __future__ import annotations

import argparse
import copy
import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "data_main_records.json"
DEFAULT_STATE = ROOT / "output" / "main_records.json"
DEFAULT_LOGS = ROOT / "output" / "import_logs.json"
DEFAULT_EXCEPTIONS = ROOT / "output" / "exceptions.json"
DEFAULT_CSV = ROOT / "output" / "复核明细.csv"

KEY_FIELDS = ["宠物姓名", "主人姓名", "上课日期"]
NOTE_FIELD = "主人微信备注"
NOTE_SOURCE_FIELD = "微信备注原始字段名"
PROTECT_FIELD = "人工备注保护标记"
STATUS_FIELD = "处理状态"
VACCINE_FIELD = "疫苗接种日期"
SOURCE_LINK = "https://pcnokj2bs6ug.feishu.cn/base/Fj4jbNvHaado6JsbEFgci9XMnJu"
BLOCKED_UPDATE_FIELDS = {"报告编号", "唯一去重键", "疫苗缺失标记", "创建时间", "创建人", PROTECT_FIELD}


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return copy.deepcopy(default)
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def load_rows(path: Path) -> list[dict[str, Any]]:
    payload = load_json(path, {})
    fields = payload.get("fields")
    rows = payload.get("rows")
    if not isinstance(fields, list) or not isinstance(rows, list):
        raise ValueError(f"{path} must contain fields and rows arrays")
    return [dict(zip(fields, row)) for row in rows]


def normalize_date(value: Any) -> str:
    if value in (None, ""):
        return ""
    text = str(value).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return text[:10]


def unique_key(row: dict[str, Any]) -> str:
    parts = []
    for field in KEY_FIELDS:
        value = normalize_date(row.get(field)) if field == "上课日期" else str(row.get(field) or "").strip()
        if not value:
            raise ValueError(f"missing required key field: {field}")
        parts.append(value)
    return "|".join(parts)


def report_number(index: int) -> str:
    return f"RPT-{index:06d}"


def enrich_new_row(row: dict[str, Any], index: int) -> dict[str, Any]:
    item = copy.deepcopy(row)
    item["报告编号"] = report_number(index)
    item["唯一去重键"] = unique_key(row)
    item["疫苗缺失标记"] = "缺失" if not item.get(VACCINE_FIELD) else "正常"
    if not item.get(STATUS_FIELD):
        item[STATUS_FIELD] = "待补材料" if item["疫苗缺失标记"] == "缺失" else "已处理"
    return item


def exception_record(report: dict[str, Any], kind: str, description: str, raw_field: str = "") -> dict[str, Any]:
    if kind == "疫苗日期缺失":
        reason = "导入数据未提供疫苗接种日期，需要运营主管按病历或主人补件确认"
        scope = "影响该宠物本次训练课报告是否可直接归档"
        status = "待确认"
    elif kind == "微信备注冲突":
        reason = "主表记录已勾选人工备注保护标记，批量导入不得覆盖人工备注"
        scope = "仅保护本记录主人微信备注；其他字段继续按重复导入规则更新"
        status = "已修复"
    else:
        reason = "字段别名映射命中，已保留原始字段名用于追溯"
        scope = "后续导入可继续使用该别名，不影响主表标准字段"
        status = "已修复"
    return {
        "关联报告编号": report.get("报告编号", ""),
        "关联宠物姓名": report.get("宠物姓名", ""),
        "异常类型": kind,
        "异常描述": description,
        "人工确认理由": reason,
        "影响范围": scope,
        "处理状态": status,
        "原始字段名记录": raw_field,
        "来源材料链接": SOURCE_LINK,
    }


def apply_duplicate_update(existing: dict[str, Any], incoming: dict[str, Any]) -> tuple[bool, bool]:
    protected = bool(existing.get(PROTECT_FIELD))
    note_changed = incoming.get(NOTE_FIELD) not in (None, existing.get(NOTE_FIELD))
    for field, value in incoming.items():
        if field in BLOCKED_UPDATE_FIELDS:
            continue
        if field == NOTE_FIELD and protected:
            continue
        existing[field] = value
    existing["唯一去重键"] = unique_key(existing)
    existing["疫苗缺失标记"] = "缺失" if not existing.get(VACCINE_FIELD) else "正常"
    if existing["疫苗缺失标记"] == "缺失":
        existing[STATUS_FIELD] = "待补材料"
    return protected, protected and note_changed


def import_rows(input_path: Path, state_path: Path, logs_path: Path, exceptions_path: Path, file_name: str) -> dict[str, int]:
    incoming_rows = load_rows(input_path)
    state = load_json(state_path, [])
    logs = load_json(logs_path, [])
    exceptions = load_json(exceptions_path, [])

    by_key = {row["唯一去重键"]: row for row in state if row.get("唯一去重键")}
    stats = {"total": len(incoming_rows), "created": 0, "duplicates": 0, "protected": 0, "exceptions": 0}

    for incoming in incoming_rows:
        key = unique_key(incoming)
        raw_note_field = incoming.get(NOTE_SOURCE_FIELD) or ""
        is_alias = raw_note_field and raw_note_field != NOTE_FIELD

        if key not in by_key:
            created = enrich_new_row(incoming, len(state) + 1)
            state.append(created)
            by_key[key] = created
            stats["created"] += 1
            if created["疫苗缺失标记"] == "缺失":
                exceptions.append(exception_record(created, "疫苗日期缺失", "疫苗接种日期为空，需补材料后再归档", VACCINE_FIELD))
                stats["exceptions"] += 1
            if is_alias:
                exceptions.append(exception_record(created, "字段名不一致", f"导入备注字段名为「{raw_note_field}」，已映射到主人微信备注", raw_note_field))
                stats["exceptions"] += 1
            continue

        existing = by_key[key]
        stats["duplicates"] += 1
        protected, note_conflict = apply_duplicate_update(existing, incoming)
        if protected:
            stats["protected"] += 1
        if note_conflict:
            exceptions.append(exception_record(existing, "微信备注冲突", "重复导入提供了新的主人微信备注，但现有记录已开启人工备注保护", NOTE_FIELD))
            stats["exceptions"] += 1

    logs.append(
        {
            "导入文件名": file_name,
            "导入时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "导入总条数": stats["total"],
            "新增条数": stats["created"],
            "跳过重复条数": stats["duplicates"],
            "人工备注保护条数": stats["protected"],
            "异常条数": stats["exceptions"],
            "导入人": "import_training_reports.py",
            "导入状态": "已完成" if stats["exceptions"] == 0 else "部分完成",
            "备注说明": "真实导入器写入：按唯一键 upsert，保护人工备注并记录异常",
        }
    )

    save_json(state_path, state)
    save_json(logs_path, logs)
    save_json(exceptions_path, exceptions)
    write_csv(DEFAULT_CSV, state)
    return stats


def protect_note(state_path: Path, pet: str, owner: str, date: str, note: str) -> None:
    state = load_json(state_path, [])
    target_key = "|".join([pet, owner, normalize_date(date)])
    for row in state:
        if row.get("唯一去重键") == target_key:
            row[NOTE_FIELD] = note
            row[PROTECT_FIELD] = True
            row[STATUS_FIELD] = "人工改判"
            save_json(state_path, state)
            write_csv(DEFAULT_CSV, state)
            return
    raise SystemExit(f"record not found for key {target_key}")


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        return
    fields = [
        "报告编号",
        "宠物姓名",
        "主人姓名",
        "上课日期",
        "数据来源",
        "处理状态",
        "微信备注原始字段名",
        NOTE_FIELD,
        PROTECT_FIELD,
        "唯一去重键",
        "疫苗缺失标记",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fields})


def reset_outputs() -> None:
    for path in (DEFAULT_STATE, DEFAULT_LOGS, DEFAULT_EXCEPTIONS, DEFAULT_CSV):
        if path.exists():
            path.unlink()


def main() -> None:
    parser = argparse.ArgumentParser(description="导入宠物训练课报告，验证去重和人工备注保护")
    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="导入一份 JSON 数据")
    run.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    run.add_argument("--file-name", default="")
    run.add_argument("--state", type=Path, default=DEFAULT_STATE)
    run.add_argument("--logs", type=Path, default=DEFAULT_LOGS)
    run.add_argument("--exceptions", type=Path, default=DEFAULT_EXCEPTIONS)

    protect = sub.add_parser("protect-note", help="模拟运营主管手工改备注并勾选保护")
    protect.add_argument("--pet", required=True)
    protect.add_argument("--owner", required=True)
    protect.add_argument("--date", required=True)
    protect.add_argument("--note", required=True)
    protect.add_argument("--state", type=Path, default=DEFAULT_STATE)

    sub.add_parser("reset", help="清空本地导入结果")

    args = parser.parse_args()
    if args.command == "reset":
        reset_outputs()
        print("已清空 output 导入结果")
    elif args.command == "protect-note":
        protect_note(args.state, args.pet, args.owner, args.date, args.note)
        print("已写入人工备注并开启保护")
    else:
        name = args.file_name or args.input.name
        stats = import_rows(args.input, args.state, args.logs, args.exceptions, name)
        print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
