#!/usr/bin/env python3
import argparse
import json
import sys
import csv
from pathlib import Path
from datetime import datetime

from .engine import ClearanceEngine
from .consistency import SingleSourceOfTruth
from .models import ProcessingStatus


def load_json_file(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def cmd_import(args):
    engine = ClearanceEngine(args.storage)
    data = load_json_file(args.input)
    if isinstance(data, dict):
        data = [data]
    records = engine.step1_import_complaints(data, args.operator)
    print(f"成功导入 {len(records)} 条居民投诉记录")
    for r in records:
        print(f"  - {r.complaint_id}: {r.complaint.location} (原始行号: {r.complaint.original_row_number})")
    return 0


def cmd_review_photo(args):
    engine = ClearanceEngine(args.storage)
    photo_data = load_json_file(args.photo)
    record = engine.step2_review_photos(args.complaint_id, photo_data, args.operator)
    if not record:
        print(f"错误: 未找到投诉编号 {args.complaint_id}")
        return 1
    print(f"已为投诉 {args.complaint_id} 补录路口照片")
    print(f"  当前状态: {record.current_status.value}")
    if record.abnormal_type:
        print(f"  异常类型: {record.abnormal_type.value}")
        print(f"  备注: {record.abnormal_note}")
    return 0


def cmd_confirm(args):
    engine = ClearanceEngine(args.storage)
    record = engine.step3_confirm_and_update(
        args.complaint_id,
        args.operator,
        is_normal=args.normal,
        note=args.note or "",
    )
    if not record:
        print(f"错误: 未找到投诉编号 {args.complaint_id}")
        return 1
    status = "正常" if args.normal else "异常"
    print(f"投诉 {args.complaint_id} 已确认为{status}")
    print(f"  当前状态: {record.current_status.value}")
    return 0


def cmd_rollback(args):
    engine = ClearanceEngine(args.storage)
    record = engine.rollback_status(args.complaint_id, args.operator, args.reason or "")
    if not record:
        print(f"错误: 未找到投诉编号或无法回滚 {args.complaint_id}")
        return 1
    print(f"投诉 {args.complaint_id} 已回滚")
    print(f"  当前状态: {record.current_status.value}")
    return 0


def cmd_list(args):
    engine = ClearanceEngine(args.storage)
    ssot = SingleSourceOfTruth(engine)
    status_filter = ProcessingStatus(args.status) if args.status else None
    records = ssot.for_page_display(status_filter=status_filter)
    print(f"共 {len(records)} 条记录:")
    for r in records:
        status_icon = "⚠️" if r["abnormal_type"] else "✓"
        print(f"  {status_icon} {r['complaint_id']} | {r['location']} | {r['current_status']} | 原始行号:{r['original_row_number']}")
    return 0


def cmd_show(args):
    engine = ClearanceEngine(args.storage)
    ssot = SingleSourceOfTruth(engine)
    trace = ssot.for_audit_trace(args.complaint_id)
    if not trace:
        print(f"错误: 未找到投诉编号 {args.complaint_id}")
        return 1

    print(f"\n=== 投诉 {args.complaint_id} 三段追溯 ===")

    print("\n【第一段: 居民投诉编号来源】")
    src = trace["resident_complaint_source"]
    print(f"  原始行号: {src['original_row_number']}")
    print(f"  导入人: {src['imported_by']}")
    print(f"  导入时间: {src['imported_at']}")
    print(f"  原始数据: {json.dumps(src['raw_data'], ensure_ascii=False)}")
    if src["manual_changes"]:
        print(f"  人工改动 ({len(src['manual_changes'])} 处):")
        for c in src["manual_changes"]:
            print(f"    - {c['field']}: {c['old_value']} → {c['new_value']} (by {c['operator']})")

    print("\n【第二段: 路口照片补录】")
    for p in trace["photo_supplements"]:
        print(f"  照片 {p['photo_id']}:")
        print(f"    审核人: {p['reviewed_by']}")
        print(f"    审核时间: {p['reviewed_at']}")
        print(f"    现场说法: {p['scene_description']}")

    print("\n【第三段: 人工确认】")
    for c in trace["manual_confirmations"]:
        print(f"  {c['timestamp']} - {c['operator']}: {c['action']}")
        if c["details"]:
            print(f"    详情: {json.dumps(c['details'], ensure_ascii=False)}")

    return 0


def cmd_export(args):
    engine = ClearanceEngine(args.storage)
    ssot = SingleSourceOfTruth(engine)
    if args.format == "csv":
        result = ssot.for_export_csv(args.output)
    else:
        result = ssot.for_export_json(args.output)
    if args.output:
        print(f"已导出到: {result}")
    else:
        print(result)
    return 0


def cmd_summary(args):
    engine = ClearanceEngine(args.storage)
    ssot = SingleSourceOfTruth(engine)
    summary = ssot.for_summary()
    print("\n=== 街巷消防通道清障 汇总 ===")
    print(f"总记录数: {summary['total_records']}")
    print(f"待复核数: {summary['pending_review_count']}")
    print("\n状态分布:")
    for status, count in summary["status_breakdown"].items():
        print(f"  {status}: {count}")
    if summary["abnormal_breakdown"]:
        print("\n异常分布:")
        for ab, count in summary["abnormal_breakdown"].items():
            print(f"  {ab}: {count}")
    return 0


def cmd_run_workflow(args):
    engine = ClearanceEngine(args.storage)
    ssot = SingleSourceOfTruth(engine)
    workflow = load_json_file(args.workflow)

    print(f"执行可复现工作流: {args.workflow}")
    print(f"工作流描述: {workflow.get('description', '无')}")
    print(f"创建时间: {workflow.get('created_at', '未知')}")
    print()

    for idx, step in enumerate(workflow["steps"], 1):
        print(f"--- 步骤 {idx}: {step.get('name', step['action'])} ---")
        action = step["action"]
        params = step["params"]

        if action == "import":
            records = engine.step1_import_complaints(params["data"], params["operator"])
            print(f"  导入 {len(records)} 条记录")

        elif action == "review_photo":
            record = engine.step2_review_photos(
                params["complaint_id"],
                params["photo_data"],
                params["operator"],
            )
            print(f"  补录照片: {record.complaint_id} → {record.current_status.value}")

        elif action == "confirm":
            record = engine.step3_confirm_and_update(
                params["complaint_id"],
                params["operator"],
                is_normal=params["is_normal"],
                note=params.get("note", ""),
            )
            print(f"  确认结果: {record.complaint_id} → {record.current_status.value}")

        elif action == "rollback":
            record = engine.rollback_status(
                params["complaint_id"],
                params["operator"],
                params.get("reason", ""),
            )
            print(f"  回滚: {record.complaint_id} → {record.current_status.value}")

        elif action == "manual_edit":
            record = engine.update_complaint_manual(
                params["complaint_id"],
                params["field"],
                params["old_value"],
                params["new_value"],
                params["operator"],
            )
            print(f"  人工修改: {params['field']} = {params['new_value']}")

        else:
            print(f"  未知操作: {action}")
            continue

        print()

    print("=== 工作流执行完成 ===")
    cmd_summary(args)
    return 0


def cmd_replayable(args):
    engine = ClearanceEngine(args.storage)
    records = engine.get_all_records()

    steps = []
    for r in sorted(records, key=lambda x: x.created_at):
        steps.append({
            "name": f"导入投诉 {r.complaint_id}",
            "action": "import",
            "params": {
                "data": [r.complaint.raw_data],
                "operator": r.complaint.imported_by,
            },
        })
        for p in r.photos:
            steps.append({
                "name": f"补录照片 {p.photo_id}",
                "action": "review_photo",
                "params": {
                    "complaint_id": r.complaint_id,
                    "photo_data": p.raw_data,
                    "operator": p.reviewed_by,
                },
            })
        for log in r.audit_logs:
            log_action = log.details.get("action", "") if log.details else ""
            if log_action == "manual_edit":
                change = log.details.get("change", {})
                steps.append({
                    "name": f"人工修改 {r.complaint_id} - {change.get('field', '?')}",
                    "action": "manual_edit",
                    "params": {
                        "complaint_id": r.complaint_id,
                        "field": change.get("field", ""),
                        "old_value": change.get("old_value", ""),
                        "new_value": change.get("new_value", ""),
                        "operator": log.operator,
                    },
                })
            elif log_action == "rollback":
                steps.append({
                    "name": f"回滚 {r.complaint_id}",
                    "action": "rollback",
                    "params": {
                        "complaint_id": r.complaint_id,
                        "operator": log.operator,
                        "reason": log.details.get("reason", ""),
                    },
                })
            elif log.new_status == ProcessingStatus.CONFIRMED_ABNORMAL:
                steps.append({
                    "name": f"确认异常 {r.complaint_id}",
                    "action": "confirm",
                    "params": {
                        "complaint_id": r.complaint_id,
                        "operator": log.operator,
                        "is_normal": False,
                        "note": log.details.get("note", ""),
                    },
                })
            elif log.new_status == ProcessingStatus.CONFIRMED_NORMAL:
                steps.append({
                    "name": f"确认正常 {r.complaint_id}",
                    "action": "confirm",
                    "params": {
                        "complaint_id": r.complaint_id,
                        "operator": log.operator,
                        "is_normal": True,
                        "note": log.details.get("note", ""),
                    },
                })

    workflow = {
        "description": "街巷消防通道清障 - 自动生成的可复现工作流",
        "created_at": datetime.now().isoformat(),
        "replayable": True,
        "steps": steps,
    }

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(workflow, f, ensure_ascii=False, indent=2)
        print(f"可复现工作流已导出到: {args.output}")
    else:
        print(json.dumps(workflow, ensure_ascii=False, indent=2))

    return 0


def main():
    parser = argparse.ArgumentParser(
        prog="fire-clearance",
        description="街巷消防通道清障 - 证据整合与追溯系统",
    )
    parser.add_argument(
        "--storage",
        default="data/clearance_records.json",
        help="数据存储文件路径",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    p_import = subparsers.add_parser("import", help="第一步: 导入居民投诉编号")
    p_import.add_argument("input", help="投诉数据 JSON 文件")
    p_import.add_argument("--operator", required=True, help="操作人")
    p_import.set_defaults(func=cmd_import)

    p_review = subparsers.add_parser("review-photo", help="第二步: 补看路口照片")
    p_review.add_argument("complaint_id", help="投诉编号")
    p_review.add_argument("photo", help="照片数据 JSON 文件")
    p_review.add_argument("--operator", required=True, help="操作人")
    p_review.set_defaults(func=cmd_review_photo)

    p_confirm = subparsers.add_parser("confirm", help="第三步: 人工确认并更新")
    p_confirm.add_argument("complaint_id", help="投诉编号")
    p_confirm.add_argument("--operator", required=True, help="操作人")
    p_confirm.add_argument("--normal", action="store_true", help="确认为正常")
    p_confirm.add_argument("--abnormal", action="store_true", help="确认为异常")
    p_confirm.add_argument("--note", default="", help="备注说明")
    p_confirm.set_defaults(func=cmd_confirm)

    p_rollback = subparsers.add_parser("rollback", help="回滚状态")
    p_rollback.add_argument("complaint_id", help="投诉编号")
    p_rollback.add_argument("--operator", required=True, help="操作人")
    p_rollback.add_argument("--reason", default="", help="回滚原因")
    p_rollback.set_defaults(func=cmd_rollback)

    p_list = subparsers.add_parser("list", help="列出所有记录")
    p_list.add_argument("--status", help="按状态过滤")
    p_list.set_defaults(func=cmd_list)

    p_show = subparsers.add_parser("show", help="显示单条记录的三段追溯")
    p_show.add_argument("complaint_id", help="投诉编号")
    p_show.set_defaults(func=cmd_show)

    p_export = subparsers.add_parser("export", help="导出数据")
    p_export.add_argument("--format", choices=["json", "csv"], default="json")
    p_export.add_argument("--output", help="输出文件路径")
    p_export.set_defaults(func=cmd_export)

    p_summary = subparsers.add_parser("summary", help="汇总统计")
    p_summary.set_defaults(func=cmd_summary)

    p_workflow = subparsers.add_parser("run-workflow", help="执行可复现工作流")
    p_workflow.add_argument("workflow", help="工作流 JSON 文件")
    p_workflow.set_defaults(func=cmd_run_workflow)

    p_replayable = subparsers.add_parser("replayable", help="生成可复现工作流")
    p_replayable.add_argument("--output", help="输出文件路径")
    p_replayable.set_defaults(func=cmd_replayable)

    args = parser.parse_args()

    if hasattr(args, "func"):
        sys.exit(args.func(args))
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
