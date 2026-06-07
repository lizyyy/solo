import argparse
import json
from datetime import datetime
from typing import List
from models import DemoReview
from core import (
    import_tuner_comment,
    supplement_rehearsal_signup,
    manual_correct,
    rerun_review,
    review_rework_complete,
    get_track_status,
)
from demo_data import create_demo_review, create_normal_demo_review, create_three_step_demo


def demo_review_to_dict(review: DemoReview) -> dict:
    return {
        "id": review.id,
        "song_name": review.song_name,
        "tuner_comment": {
            "id": review.tuner_comment.id,
            "track_name": review.tuner_comment.track_name,
            "comment": review.tuner_comment.comment,
            "has_rework_reason": review.tuner_comment.has_rework_reason,
            "rework_reason": review.tuner_comment.rework_reason,
            "import_time": review.tuner_comment.import_time.isoformat(),
        } if review.tuner_comment else None,
        "rehearsal_signups": [
            {
                "id": s.id,
                "signer": s.signer,
                "remark": s.remark,
                "signup_time": s.signup_time.isoformat(),
            }
            for s in review.rehearsal_signups
        ],
        "change_records": [
            {
                "id": r.id,
                "track_name": r.track_name,
                "why_kept": r.why_kept,
                "missing_materials": r.missing_materials,
                "next_step": r.next_step.value,
                "reason": r.reason.value,
                "operator": r.operator,
                "created_at": r.created_at.isoformat(),
            }
            for r in review.change_records
        ],
        "status": get_track_status(review).value,
        "review_report": {
            "status": review.review_report.status,
            "notes": review.review_report.notes,
            "import_tuner_time": review.review_report.import_tuner_time.isoformat(),
            "supplement_signup_time": review.review_report.supplement_signup_time.isoformat()
            if review.review_report.supplement_signup_time
            else None,
        } if review.review_report else None,
        "created_at": review.created_at.isoformat(),
        "updated_at": review.updated_at.isoformat(),
    }


def print_review(review: DemoReview):
    data = demo_review_to_dict(review)
    print(json.dumps(data, ensure_ascii=False, indent=2))


def print_report(review: DemoReview):
    print("\n" + "=" * 60)
    print(f"  原创歌曲 Demo 评审报告 - {review.song_name}")
    print("=" * 60)

    if review.tuner_comment:
        print(f"\n【第一步】调音师留言导入")
        print(f"  轨道: {review.tuner_comment.track_name}")
        print(f"  留言: {review.tuner_comment.comment}")
        if review.tuner_comment.has_rework_reason:
            print(f"  ⚠️  检测到返工原因: {review.tuner_comment.rework_reason}")
        else:
            print(f"  ✅ 无明显返工原因")

    if review.rehearsal_signups:
        print(f"\n【第二步】排练群接龙补录")
        for i, signup in enumerate(review.rehearsal_signups, 1):
            print(f"  接龙 {i}: {signup.signer} - {signup.remark}")

    print(f"\n【第三步】排练变更记录")
    for i, record in enumerate(review.change_records, 1):
        print(f"\n  记录 {i} ({record.reason.value}) - 操作人: {record.operator}")
        print(f"    为什么留下: {record.why_kept}")
        if record.missing_materials:
            print(f"    还缺材料: {', '.join(record.missing_materials)}")
        print(f"    下一步: {record.next_step.value}")

    print(f"\n【当前状态】{get_track_status(review).value}")
    if review.review_report:
        print(f"【报告状态】{review.review_report.status}")
        if review.review_report.notes:
            print(f"【备注】{review.review_report.notes}")

    print("\n" + "=" * 60 + "\n")


def main():
    parser = argparse.ArgumentParser(description="原创歌曲 Demo 评审系统")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    demo_parser = subparsers.add_parser("demo", help="运行演示数据")
    demo_parser.add_argument("--type", choices=["full", "normal", "threestep"], default="full", help="演示类型")

    import_parser = subparsers.add_parser("import", help="导入调音师留言")
    import_parser.add_argument("--song", required=True, help="歌曲名")
    import_parser.add_argument("--track", required=True, help="轨道名")
    import_parser.add_argument("--comment", required=True, help="调音师留言")

    supplement_parser = subparsers.add_parser("supplement", help="补录排练群接龙")
    supplement_parser.add_argument("--song", required=True, help="歌曲名")
    supplement_parser.add_argument("--signer", required=True, help="接龙人")
    supplement_parser.add_argument("--remark", required=True, help="接龙备注")

    subparsers.add_parser("list", help="查看评审列表")

    args = parser.parse_args()

    if args.command == "demo":
        if args.type == "full":
            review = create_demo_review()
        elif args.type == "normal":
            review = create_normal_demo_review()
        else:
            review = create_three_step_demo()
        print_report(review)

    elif args.command == "import":
        review = import_tuner_comment(args.song, args.track, args.comment)
        print_report(review)

    elif args.command == "supplement":
        print("请先导入调音师留言（演示模式下使用 demo 命令）")

    elif args.command == "list":
        print("\n演示评审列表:")
        print("1. 夏天的风 - 完整流程演示 (含人工修正+重跑)")
        print("2. 晴天 - 正常流程演示")
        print("3. 稻香 - 三步标准流程演示")
        print("\n运行: python cli.py demo --type [full|normal|threestep]")


if __name__ == "__main__":
    main()
