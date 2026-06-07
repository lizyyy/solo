import argparse
import json
import sys
from pprint import pprint

from .core import ForbiddenListEngine
from .data.demo_data import DEMO_DATA


def print_record(record):
    print(f"  记录ID: {record.id}")
    print(f"  关键词: {record.keyword}")
    print(f"  状态: {record.status.value}")
    print(f"  来源: {record.source.value}")
    print(f"  引用链接: {record.reference_url or '无'}")
    print(f"  链接404: {'是' if record.link_404 else '否'}")
    print(f"  冲突备注: {record.conflict_note or '无'}")
    print(f"  历史操作: {len(record.history)} 条")
    if record.history:
        for i, h in enumerate(record.history[-3:], 1):
            print(f"    [{i}] {h['action']} - {h['operator']} - {h['note'][:30]}...")


def cmd_stats(args):
    engine = ForbiddenListEngine()
    if args.demo:
        run_demo_workflow(engine, show_steps=False)
    stats = engine.get_statistics()
    print("\n=== 导购推荐禁推清单 - 统计 ===")
    for k, v in stats.items():
        if isinstance(v, dict):
            print(f"{k}:")
            for sk, sv in v.items():
                print(f"  {sk}: {sv}")
        else:
            print(f"{k}: {v}")
    print()


def cmd_list(args):
    engine = ForbiddenListEngine()
    if args.demo:
        run_demo_workflow(engine, show_steps=False)

    print(f"\n=== 禁推清单记录 (共 {len(engine.forbidden_records)} 条) ===")
    for i, record in enumerate(engine.forbidden_records, 1):
        print(f"\n[{i}] -------------------")
        print_record(record)
    print()


def cmd_conflicts(args):
    engine = ForbiddenListEngine()
    if args.demo:
        run_demo_workflow(engine, show_steps=False)

    print(f"\n=== 冲突样本表 (共 {len(engine.conflict_samples)} 条) ===")
    for i, c in enumerate(engine.conflict_samples, 1):
        print(f"\n[{i}] 冲突ID: {c.id}")
        print(f"  关联记录ID: {c.forbidden_record_id}")
        print(f"  冲突类型: {c.conflict_type.value}")
        print(f"  旧内容: {c.old_content}")
        print(f"  新内容: {c.new_content[:60]}...")
        print(f"  是否已解决: {'是' if c.resolved else '否'}")
    print()


def cmd_demo(args):
    engine = ForbiddenListEngine()
    run_demo_workflow(engine, show_steps=True)


def run_demo_workflow(engine: ForbiddenListEngine, show_steps: bool = True):
    if show_steps:
        print("\n" + "=" * 60)
        print("  导购推荐禁推清单 - 完整流程演示")
        print("=" * 60)

    if show_steps:
        print("\n【第一步】标注员导入留言")
        print("-" * 40)

    records = engine.run_full_workflow_step1_import(DEMO_DATA)

    if show_steps:
        for i, r in enumerate(records, 1):
            print(f"\n记录 {i}: {r.keyword}")
            print(f"  状态: {r.status.value}")
            print(f"  链接: {r.reference_url or '无'}")
            if r.link_404:
                print(f"  ⚠️  链接返回404!")

    review_decisions = {}
    for i, key in enumerate(["first_record", "second_record", "third_record"]):
        if i < len(records):
            review_decisions[records[i].id] = DEMO_DATA["review_decisions"][key]

    if show_steps:
        print("\n\n【第二步】标注负责人周姐复核")
        print("-" * 40)

    engine.run_full_workflow_step2_review("周姐", review_decisions)

    if show_steps:
        for i, r in enumerate(engine.forbidden_records, 1):
            print(f"\n记录 {i}: {r.keyword}")
            print(f"  复核后状态: {r.status.value}")
            if r.status.value == "待产品经理复核":
                print(f"  ⚠️  已标记为待产品经理复核")

    supplements = {}
    if len(records) >= 3:
        supplements[records[2].id] = DEMO_DATA["model_outputs_to_supplement"]["third_record"]

    if show_steps:
        print("\n\n【第三步】补录模型输出片段，更新冲突样本表")
        print("-" * 40)

    new_conflicts = engine.run_full_workflow_step3_supplement("周姐", supplements)

    if show_steps:
        for i, r in enumerate(engine.forbidden_records, 1):
            print(f"\n记录 {i}: {r.keyword}")
            print(f"  最终状态: {r.status.value}")
            if r.conflict_note:
                print(f"  冲突: {r.conflict_note}")

        if new_conflicts:
            print(f"\n✅ 新增 {len(new_conflicts)} 条冲突样本")
            for c in new_conflicts:
                print(f"  - 冲突ID: {c.id}, 类型: {c.conflict_type.value}")

    if show_steps:
        print("\n" + "=" * 60)
        print("  三种处理结果对比")
        print("=" * 60)
        outcomes = [
            ("顺利记录", 0, "链接有效，正常通过"),
            ("链接404待复核", 1, "链接失效，转产品经理"),
            ("补录发现旧口径", 2, "生成冲突样本"),
        ]
        for name, idx, desc in outcomes:
            if idx < len(engine.forbidden_records):
                r = engine.forbidden_records[idx]
                print(f"\n{name}:")
                print(f"  关键词: {r.keyword}")
                print(f"  最终状态: {r.status.value}")
                print(f"  说明: {desc}")
        print("\n" + "=" * 60 + "\n")


def cmd_import(args):
    engine = ForbiddenListEngine()
    if args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = {"annotator_comments": [
            {"content": args.content, "annotator": args.annotator, "reference_url": args.url}
        ]}
    records = engine.run_full_workflow_step1_import(data)
    print(f"\n✅ 已导入 {len(records)} 条记录")
    for r in records:
        print(f"  - {r.keyword}: {r.status.value}")


def main():
    parser = argparse.ArgumentParser(description="导购推荐禁推清单管理工具")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    parser_demo = subparsers.add_parser("demo", help="运行完整演示流程")
    parser_demo.set_defaults(func=cmd_demo)

    parser_stats = subparsers.add_parser("stats", help="查看统计信息")
    parser_stats.add_argument("--demo", action="store_true", help="加载演示数据")
    parser_stats.set_defaults(func=cmd_stats)

    parser_list = subparsers.add_parser("list", help="列出所有禁推记录")
    parser_list.add_argument("--demo", action="store_true", help="加载演示数据")
    parser_list.set_defaults(func=cmd_list)

    parser_conflicts = subparsers.add_parser("conflicts", help="查看冲突样本表")
    parser_conflicts.add_argument("--demo", action="store_true", help="加载演示数据")
    parser_conflicts.set_defaults(func=cmd_conflicts)

    parser_import = subparsers.add_parser("import", help="导入标注员留言")
    parser_import.add_argument("--content", required=True, help="留言内容")
    parser_import.add_argument("--annotator", required=True, help="标注员姓名")
    parser_import.add_argument("--url", help="引用链接")
    parser_import.add_argument("--file", help="从JSON文件批量导入")
    parser_import.set_defaults(func=cmd_import)

    args = parser.parse_args()
    if args.command is None:
        parser.print_help()
        return
    args.func(args)


if __name__ == "__main__":
    main()
