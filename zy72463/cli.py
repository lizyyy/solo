#!/usr/bin/env python3
import argparse
import json
import sys
from datetime import datetime

from service import InspectionService
from storage import InspectionStorage


def cmd_import(args):
    service = InspectionService()
    if args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            complaints = json.load(f)
    else:
        complaints = [
            {
                "complaint_id": cid,
                "intersection": args.intersection or "未填写",
                "description": args.description or "未填写",
                "reported_at": datetime.now().isoformat()
            }
            for cid in args.ids.split(",")
        ]

    created, skipped = service.import_complaints(complaints, args.by or "system")
    print(f"导入完成: 新增 {len(created)} 条, 跳过 {len(skipped)} 条")
    for insp in created:
        print(f"  [创建] {insp.complaint_id} -> {insp.inspection_id}")
    for cid in skipped:
        print(f"  [跳过] {cid} (已存在)")


def cmd_add_photo(args):
    service = InspectionService()
    result = service.add_photo(
        complaint_id=args.complaint,
        file_path=args.file,
        taken_at=datetime.now(),
        uploaded_by=args.by or "xiaojiang",
        remark=args.remark
    )
    if result:
        print(f"照片已添加: {result.complaint_id}, 当前状态: {result.status.value}")
    else:
        print(f"未找到投诉记录: {args.complaint}", file=sys.stderr)
        sys.exit(1)


def cmd_update_remark(args):
    service = InspectionService()
    result = service.update_remark(
        complaint_id=args.complaint,
        new_remark=args.remark,
        updated_by=args.by or "xiaojiang"
    )
    if result:
        print(f"备注已更新: {result.complaint_id}")
    else:
        print(f"未找到投诉记录: {args.complaint}", file=sys.stderr)
        sys.exit(1)


def cmd_update_score(args):
    service = InspectionService()
    result = service.update_score(
        complaint_id=args.complaint,
        new_score=args.score,
        updated_by=args.by or "xiaojiang"
    )
    if result:
        print(f"评分已更新: {result.complaint_id}, 评分: {result.score}")
    else:
        print(f"未找到投诉记录: {args.complaint}", file=sys.stderr)
        sys.exit(1)


def cmd_add_ramp(args):
    service = InspectionService()
    score = None if args.score == "null" else float(args.score)
    result = service.add_ramp_supplement(
        complaint_id=args.complaint,
        location=args.location,
        description=args.description or "",
        new_score=score,
        supplemented_by=args.by or "xiaojiang"
    )
    if result:
        print(f"坡道补录已添加: {result.complaint_id}, 状态: {result.status.value}")
        if result.has_ramp_score_unchanged():
            print("  ⚠️  评分未变化，已标记为需交通协管复核")
    else:
        print(f"未找到投诉记录: {args.complaint}", file=sys.stderr)
        sys.exit(1)


def cmd_update_suggestion(args):
    service = InspectionService()
    result = service.update_suggestion(
        complaint_id=args.complaint,
        suggestion=args.suggestion,
        updated_by=args.by or "xiaojiang"
    )
    if result:
        print(f"整改建议已更新: {result.complaint_id}, 状态: {result.status.value}")
    else:
        print(f"未找到投诉记录: {args.complaint}", file=sys.stderr)
        sys.exit(1)


def cmd_review(args):
    service = InspectionService()
    adjusted_score = args.score
    result = service.review_by_traffic_assistant(
        complaint_id=args.complaint,
        reviewed_by=args.by or "traffic_assistant",
        review_result=args.result,
        adjusted_score=adjusted_score
    )
    if result:
        print(f"复核完成: {result.complaint_id}, 状态: {result.status.value}")
    else:
        print(f"未找到投诉记录: {args.complaint}", file=sys.stderr)
        sys.exit(1)


def cmd_rollback(args):
    service = InspectionService()
    result = service.rollback(
        complaint_id=args.complaint,
        change_id=args.change,
        rolled_back_by=args.by or "system"
    )
    if result:
        print(f"已回滚变更: {args.change}")
    else:
        print(f"未找到记录或变更", file=sys.stderr)
        sys.exit(1)


def cmd_history(args):
    service = InspectionService()
    diffs = service.get_history_diff(args.complaint)
    if not diffs:
        print(f"未找到历史记录: {args.complaint}")
        return
    print(f"历史变更记录 - {args.complaint}:")
    for d in diffs:
        print(f"\n  [{d['at']}] {d['change_type']} by {d['by']}")
        print(f"      change_id: {d['change_id']}")
        if d['field']:
            print(f"      字段: {d['field']}")
            print(f"      旧值: {d['old']}")
            print(f"      新值: {d['new']}")
        if d['remark']:
            print(f"      备注: {d['remark']}")


def cmd_replay(args):
    service = InspectionService()
    commands = service.get_replay_commands(args.complaint)
    if not commands:
        print(f"未找到记录: {args.complaint}")
        return
    print(f"可重放命令 - {args.complaint}:")
    for i, cmd in enumerate(commands, 1):
        print(f"  {i}. python cli.py {cmd}")


def cmd_list(args):
    service = InspectionService()
    if args.needs_review:
        inspections = service.get_needs_review_list()
        print(f"待复核列表 ({len(inspections)} 条):")
    else:
        inspections = service.get_all_inspections()
        print(f"所有巡检记录 ({len(inspections)} 条):")
    for insp in inspections:
        status_mark = " ⚠️" if insp.status.value == "needs_review" else ""
        print(f"  {insp.complaint_id} | {insp.status.value}{status_mark} | {insp.complaint.intersection}")
        if insp.photos:
            print(f"      照片: {len(insp.photos)} 张")
        if insp.ramp_supplements:
            print(f"      坡道补录: {len(insp.ramp_supplements)} 条")


def cmd_show(args):
    service = InspectionService()
    insp = service.get_inspection(args.complaint)
    if not insp:
        print(f"未找到记录: {args.complaint}", file=sys.stderr)
        sys.exit(1)

    print(f"=== 巡检详情: {insp.complaint_id} ===")
    print(f"状态: {insp.status.value}")
    print(f"路口: {insp.complaint.intersection}")
    print(f"投诉描述: {insp.complaint.description}")
    print(f"评分: {insp.score}")
    print(f"备注: {insp.remark}")
    print(f"整改建议: {insp.suggestion}")

    if insp.photos:
        print(f"\n照片 ({len(insp.photos)} 张):")
        for p in insp.photos:
            print(f"  - {p.file_path} (by {p.uploaded_at})" if hasattr(p, 'uploaded_at') else f"  - {p.file_path} (by {p.uploaded_by})")
            if p.remark:
                print(f"    备注: {p.remark}")

    if insp.ramp_supplements:
        print(f"\n坡道补录 ({len(insp.ramp_supplements)} 条):")
        for r in insp.ramp_supplements:
            print(f"  - {r.location}: {r.description}")
            print(f"    评分变化: {r.old_score} → {r.new_score}")
            if r.old_score is not None and r.new_score is not None and abs(r.old_score - r.new_score) < 0.001:
                print(f"    ⚠️  评分未变化")

    if insp.has_ramp_score_unchanged():
        print(f"\n⚠️  存在坡道补录后评分未变化，需交通协管复核")


def main():
    parser = argparse.ArgumentParser(description="城市树池破损巡检系统")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    p_import = subparsers.add_parser("import-complaints", help="导入居民投诉")
    p_import.add_argument("--ids", help="投诉ID列表，逗号分隔")
    p_import.add_argument("--file", help="从JSON文件导入")
    p_import.add_argument("--intersection", help="路口")
    p_import.add_argument("--description", help="描述")
    p_import.add_argument("--by", help="操作人")

    p_add_photo = subparsers.add_parser("add-photo", help="添加路口照片")
    p_add_photo.add_argument("--complaint", required=True, help="投诉ID")
    p_add_photo.add_argument("--file", required=True, help="照片文件路径")
    p_add_photo.add_argument("--remark", help="照片备注")
    p_add_photo.add_argument("--by", help="操作人")

    p_update_remark = subparsers.add_parser("update-remark", help="更新备注")
    p_update_remark.add_argument("--complaint", required=True, help="投诉ID")
    p_update_remark.add_argument("--remark", required=True, help="新备注")
    p_update_remark.add_argument("--by", help="操作人")

    p_update_score = subparsers.add_parser("update-score", help="更新评分")
    p_update_score.add_argument("--complaint", required=True, help="投诉ID")
    p_update_score.add_argument("--score", required=True, type=float, help="新评分")
    p_update_score.add_argument("--by", help="操作人")

    p_add_ramp = subparsers.add_parser("add-ramp", help="添加坡道补录")
    p_add_ramp.add_argument("--complaint", required=True, help="投诉ID")
    p_add_ramp.add_argument("--location", required=True, help="坡道位置")
    p_add_ramp.add_argument("--description", help="描述")
    p_add_ramp.add_argument("--score", required=True, help="新评分 (null表示不设置)")
    p_add_ramp.add_argument("--by", help="操作人")

    p_update_suggestion = subparsers.add_parser("update-suggestion", help="更新整改建议")
    p_update_suggestion.add_argument("--complaint", required=True, help="投诉ID")
    p_update_suggestion.add_argument("--suggestion", required=True, help="整改建议")
    p_update_suggestion.add_argument("--by", help="操作人")

    p_review = subparsers.add_parser("review", help="交通协管复核")
    p_review.add_argument("--complaint", required=True, help="投诉ID")
    p_review.add_argument("--result", required=True, help="复核结论")
    p_review.add_argument("--score", type=float, help="调整后的评分")
    p_review.add_argument("--by", help="操作人")

    p_rollback = subparsers.add_parser("rollback", help="回滚变更")
    p_rollback.add_argument("--complaint", required=True, help="投诉ID")
    p_rollback.add_argument("--change", required=True, help="变更ID")
    p_rollback.add_argument("--by", help="操作人")

    p_history = subparsers.add_parser("history", help="查看历史变更")
    p_history.add_argument("--complaint", required=True, help="投诉ID")

    p_replay = subparsers.add_parser("replay", help="生成可重放命令")
    p_replay.add_argument("--complaint", required=True, help="投诉ID")

    p_list = subparsers.add_parser("list", help="列出所有记录")
    p_list.add_argument("--needs-review", action="store_true", help="只看待复核的")

    p_show = subparsers.add_parser("show", help="显示详情")
    p_show.add_argument("--complaint", required=True, help="投诉ID")

    args = parser.parse_args()

    if args.command == "import-complaints":
        cmd_import(args)
    elif args.command == "add-photo":
        cmd_add_photo(args)
    elif args.command == "update-remark":
        cmd_update_remark(args)
    elif args.command == "update-score":
        cmd_update_score(args)
    elif args.command == "add-ramp":
        cmd_add_ramp(args)
    elif args.command == "update-suggestion":
        cmd_update_suggestion(args)
    elif args.command == "review":
        cmd_review(args)
    elif args.command == "rollback":
        cmd_rollback(args)
    elif args.command == "history":
        cmd_history(args)
    elif args.command == "replay":
        cmd_replay(args)
    elif args.command == "list":
        cmd_list(args)
    elif args.command == "show":
        cmd_show(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
