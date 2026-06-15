import argparse
import json
import sys
from pprint import pprint

from .core import ForbiddenListEngine
from .data.demo_data import DEMO_DATA
from .workflows.demo_flow import run_complete_demo


def _get_engine_with_demo(load_demo: bool, full: bool = False):
    engine = ForbiddenListEngine()
    if load_demo:
        if full:
            run_complete_demo()
        else:
            _run_full_five_steps(engine)
    return engine


def _run_full_five_steps(engine: ForbiddenListEngine):
    records = engine.run_full_workflow_step1_import(DEMO_DATA)

    review_decisions = {}
    for i, key in enumerate(["first_record", "second_record", "third_record"]):
        if i < len(records):
            review_decisions[records[i].id] = DEMO_DATA["review_decisions"][key]
    engine.run_full_workflow_step2_review("周姐", review_decisions)

    supplements = {}
    if len(records) >= 3:
        supplements[records[2].id] = DEMO_DATA["model_outputs_to_supplement"]["third_record"]
    engine.run_full_workflow_step3_supplement("周姐", supplements)

    corrections = {}
    third_record = engine.forbidden_records[2]
    corr_data = dict(DEMO_DATA["manual_corrections"]["third_record"])
    corr_data["resolve_conflict_id"] = engine.conflict_samples[0].id if engine.conflict_samples else None
    corrections[third_record.id] = corr_data
    engine.run_full_workflow_step4_manual_correct("周姐", corrections)

    pm_review_data = DEMO_DATA["pm_reviews"]["second_record"]
    second_record = engine.forbidden_records[1]
    engine.pm_review(second_record, "张总", pm_review_data["decision"], pm_review_data["reason"])

    rerun_ids = [engine.forbidden_records[2].id]
    engine.run_full_workflow_step5_rerun("周姐", rerun_ids)


def print_record(record, detail=False):
    print(f"  记录ID: {record.id}")
    print(f"  关键词: {record.keyword}")
    if record.resolved_keyword and record.resolved_keyword != record.keyword:
        print(f"  修正后口径: {record.resolved_keyword}")
    print(f"  状态: {record.status.value}")
    print(f"  来源: {record.source.value}")
    print(f"  引用链接: {record.reference_url or '无'}")
    print(f"  链接404: {'是' if record.link_404 else '否'}")
    if record.confirm_reason:
        print(f"  ✅ 确认理由: {record.confirm_reason}")
    if record.reject_reason:
        print(f"  ❌ 驳回理由: {record.reject_reason}")
    if record.conflict_note:
        print(f"  ⚠️  冲突备注: {record.conflict_note}")
    if record.pm_review_note:
        print(f"  📝 PM备注: {record.pm_review_note}")
    if record.rerun_count:
        print(f"  🔁 重跑次数: {record.rerun_count}")
    print(f"  历史操作: {len(record.history)} 条")
    if detail and record.history:
        print("  历史记录（最新在前）：")
        for i, h in enumerate(list(reversed(record.history))[:10], 1):
            b = h.get('before_status', '')
            a = h.get('after_status', '')
            arrow = f" [{b}→{a}]" if b and a and b != a else ""
            cr = f" ✅理由:{h['confirm_reason'][:30]}" if h.get('confirm_reason') else ""
            rj = f" ❌理由:{h['reject_reason'][:30]}" if h.get('reject_reason') else ""
            rn = f" 🔁重跑#{h['rerun_number']}" if h.get('rerun_number') else ""
            print(f"    [{i}] {h['action']}（{h['operator']}）{arrow}{cr}{rj}{rn}")
            if h.get('note'):
                print(f"         {h['note'][:60]}")


def cmd_demo(args):
    run_complete_demo()


def cmd_stats(args):
    engine = _get_engine_with_demo(args.demo, full=False)
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
    engine = _get_engine_with_demo(args.demo, full=False)
    print(f"\n=== 禁推清单记录 (共 {len(engine.forbidden_records)} 条) ===")
    for i, record in enumerate(engine.forbidden_records, 1):
        print(f"\n[{i}] " + "-" * 50)
        print_record(record, detail=args.detail)
    print()


def cmd_detail(args):
    engine = _get_engine_with_demo(args.demo, full=False)
    rid = args.record_id
    if not rid and engine.forbidden_records:
        rid = engine.forbidden_records[args.index - 1].id if args.index else engine.forbidden_records[0].id
    detail = engine.get_record_detail(rid)
    if not detail:
        print(f"❌ 未找到记录ID: {rid}")
        return
    r = detail["record"]
    print(f"\n=== 记录详情 ===")
    print(f"  记录ID: {r['id']}")
    print(f"  关键词: {r['keyword']}")
    if r.get('resolved_keyword'):
        print(f"  修正后口径: {r['resolved_keyword']}")
    print(f"  状态: {r['status']}")
    print(f"  来源: {r['source']}")
    print(f"  引用链接: {r['reference_url'] or '无'}")
    print(f"  链接404: {'是' if r['link_404'] else '否'}")
    if r.get('confirm_reason'):
        print(f"  ✅ 确认理由: {r['confirm_reason']}")
    if r.get('reject_reason'):
        print(f"  ❌ 驳回理由: {r['reject_reason']}")
    if r.get('conflict_note'):
        print(f"  ⚠️  冲突备注: {r['conflict_note']}")
    if r.get('pm_review_note'):
        print(f"  📝 PM备注: {r['pm_review_note']}")
    print(f"  🔁 重跑次数: {r['rerun_count']}")

    if detail.get('annotator_comment'):
        c = detail['annotator_comment']
        print(f"\n  📝 标注员留言（主材料，可反查）：")
        print(f"      留言ID: {c['id']}")
        print(f"      标注员: {c['annotator']}")
        print(f"      内容: {c['content']}")
        if c.get('reason'):
            print(f"      理由: {c['reason']}")
        if c.get('product_id'):
            print(f"      商品ID: {c['product_id']}")

    if detail.get('model_output'):
        m = detail['model_output']
        print(f"\n  🤖 模型输出片段（藏着关键备注）：")
        print(f"      片段ID: {m['id']}")
        print(f"      模型版本: {m['model_version']}")
        print(f"      任务ID: {m['source_task_id']}")
        print(f"      内容: {m['content']}")

    if detail.get('conflicts'):
        print(f"\n  ⚔️  关联冲突样本（{len(detail['conflicts'])} 条）：")
        for i, c in enumerate(detail['conflicts'], 1):
            print(f"      [{i}] 冲突ID: {c['id']}  类型: {c['type']}  已解决: {c['resolved']}")
            print(f"          旧内容: {c['old_content']}")
            if c.get('resolution_note'):
                print(f"          解决结论: {c['resolution_note']}")
            if c.get('confirm_reason'):
                print(f"          ✅ 确认理由: {c['confirm_reason']}")

    if detail.get('history'):
        print(f"\n  🕒 完整操作历史（{len(detail['history'])} 条，最新在前）：")
        for i, h in enumerate(detail['history'][:15], 1):
            b = h.get('before_status', '')
            a = h.get('after_status', '')
            arrow = f" [{b}→{a}]" if b and a and b != a else ""
            cr = f" ✅{h['confirm_reason'][:30]}" if h.get('confirm_reason') else ""
            rj = f" ❌{h['reject_reason'][:30]}" if h.get('reject_reason') else ""
            rn = f" 🔁重跑#{h['rerun_number']}" if h.get('rerun_number') else ""
            print(f"    [{i}] {h['action']}（{h['operator']}）{arrow}{cr}{rj}{rn}")
            if h.get('note'):
                print(f"         {h['note'][:80]}")
    print()


def cmd_history(args):
    engine = _get_engine_with_demo(args.demo, full=False)
    rid = args.record_id
    if not rid and engine.forbidden_records:
        rid = engine.forbidden_records[args.index - 1].id if args.index else engine.forbidden_records[0].id
    history = engine.get_record_history(rid)
    if not history:
        print(f"❌ 未找到记录ID: {rid}")
        return
    print(f"\n=== 记录 {rid} 操作历史（最新在前，共 {len(history)} 条）===")
    for i, h in enumerate(history, 1):
        b = h.get('before_status', '')
        a = h.get('after_status', '')
        arrow = f" [{b}→{a}]" if b and a and b != a else ""
        cr = f" ✅理由:{h['confirm_reason'][:40]}" if h.get('confirm_reason') else ""
        rj = f" ❌理由:{h['reject_reason'][:40]}" if h.get('reject_reason') else ""
        rn = f" 🔁#{h['rerun_number']}" if h.get('rerun_number') else ""
        print(f"\n[{i}] {h['action']}（操作人：{h['operator']}）{arrow}{cr}{rj}{rn}")
        print(f"    时间: {h['timestamp']}")
        if h.get('note'):
            print(f"    说明: {h['note']}")
    print()


def cmd_conflicts(args):
    engine = _get_engine_with_demo(args.demo, full=False)
    print(f"\n=== 冲突样本表 (共 {len(engine.conflict_samples)} 条) ===")
    for i, c in enumerate(engine.conflict_samples, 1):
        print(f"\n[{i}] " + "-" * 50)
        print(f"  冲突ID: {c.id}")
        print(f"  关联记录ID: {c.forbidden_record_id}")
        print(f"  冲突类型: {c.conflict_type.value}")
        print(f"  旧内容: {c.old_content}")
        print(f"  新内容: {c.new_content[:80]}")
        print(f"  是否已解决: {'是（解决人：' + str(c.resolved_by) + '）' if c.resolved else '否'}")
        if c.resolution_note:
            print(f"  解决结论: {c.resolution_note}")
        if c.confirm_reason:
            print(f"  ✅ 确认理由: {c.confirm_reason}")
        if c.reject_reason:
            print(f"  ❌ 驳回理由: {c.reject_reason}")
    print()


def cmd_pm_review(args):
    engine = _get_engine_with_demo(args.demo, full=False)
    rid = args.record_id
    if not rid and engine.forbidden_records:
        rid = engine.forbidden_records[1].id
    record = engine._find_record_by_id(rid)
    if not record:
        print(f"❌ 未找到记录: {rid}")
        return
    engine.pm_review(record, args.operator, args.decision, args.reason)
    print(f"\n✅ PM复核完成: {record.keyword} → {record.status.value}")
    print(f"   决策: {args.decision}  理由: {args.reason}")


def cmd_rerun(args):
    engine = _get_engine_with_demo(args.demo, full=False)
    rid = args.record_id
    if not rid and engine.forbidden_records:
        rid = engine.forbidden_records[args.index - 1].id if args.index else engine.forbidden_records[-1].id
    record = engine._find_record_by_id(rid)
    if not record:
        print(f"❌ 未找到记录: {rid}")
        return
    engine.rerun_record(record, args.operator, args.note)
    print(f"\n✅ 重跑完成: {record.keyword}")
    print(f"   重跑次数: {record.rerun_count}  当前状态: {record.status.value}")


def cmd_report(args):
    engine = _get_engine_with_demo(args.demo, full=False)
    report = engine.generate_report()
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"\n✅ 报告已保存到: {args.output}")
    else:
        print("\n=== 导购推荐禁推清单 - 结果报告 ===")
        print(f"  生成时间: {report['生成时间']}")
        stats = report["统计概览"]
        print(f"\n  📊 统计概览:")
        for k, v in stats.items():
            if isinstance(v, dict):
                print(f"    {k}:")
                for sk, sv in v.items():
                    print(f"      {sk}: {sv}")
            else:
                print(f"    {k}: {v}")
        print(f"\n  📋 记录明细:")
        for i, r in enumerate(report["记录明细"], 1):
            print(f"    [{i}] {r['keyword']} → {r['status']}")
            if r.get('confirm_reason'):
                print(f"        ✅ 确认理由: {r['confirm_reason'][:50]}")
            if r.get('reject_reason'):
                print(f"        ❌ 驳回理由: {r['reject_reason'][:50]}")
            if r.get('rerun_count', 0) > 0:
                print(f"        🔁 重跑次数: {r['rerun_count']}")
        if report.get("冲突样本表"):
            print(f"\n  ⚔️  冲突样本表:")
            for i, c in enumerate(report["冲突样本表"], 1):
                status = "已解决" if c['resolved'] else "未解决"
                print(f"    [{i}] {c['old_content']} → {status}")
                if c.get('confirm_reason'):
                    print(f"        ✅ {c['confirm_reason'][:50]}")
        print()


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

    subparsers.add_parser("demo", help="运行五步完整演示流程").set_defaults(func=cmd_demo)

    p = subparsers.add_parser("stats", help="查看统计信息")
    p.add_argument("--demo", action="store_true", help="加载演示数据")
    p.set_defaults(func=cmd_stats)

    p = subparsers.add_parser("list", help="列出所有禁推记录")
    p.add_argument("--demo", action="store_true", help="加载演示数据")
    p.add_argument("--detail", action="store_true", help="显示详细历史")
    p.set_defaults(func=cmd_list)

    p = subparsers.add_parser("detail", help="查看单条记录完整详情（含标注留言、模型输出、冲突、历史）")
    p.add_argument("--demo", action="store_true", help="加载演示数据")
    p.add_argument("--record-id", help="记录ID")
    p.add_argument("--index", type=int, help="按序号选择（1=第一条）")
    p.set_defaults(func=cmd_detail)

    p = subparsers.add_parser("history", help="查看单条记录操作历史")
    p.add_argument("--demo", action="store_true", help="加载演示数据")
    p.add_argument("--record-id", help="记录ID")
    p.add_argument("--index", type=int, help="按序号选择")
    p.set_defaults(func=cmd_history)

    p = subparsers.add_parser("conflicts", help="查看冲突样本表")
    p.add_argument("--demo", action="store_true", help="加载演示数据")
    p.set_defaults(func=cmd_conflicts)

    p = subparsers.add_parser("pm-review", help="产品经理复核（支持通过/驳回，保留理由）")
    p.add_argument("--demo", action="store_true", help="加载演示数据")
    p.add_argument("--record-id", help="记录ID（默认选第二条演示记录）")
    p.add_argument("--operator", required=True, help="PM姓名")
    p.add_argument("--decision", choices=["approve", "reject"], required=True, help="approve通过/reject驳回")
    p.add_argument("--reason", required=True, help="确认/驳回理由")
    p.set_defaults(func=cmd_pm_review)

    p = subparsers.add_parser("rerun", help="对记录执行重跑")
    p.add_argument("--demo", action="store_true", help="加载演示数据")
    p.add_argument("--record-id", help="记录ID")
    p.add_argument("--index", type=int, help="按序号选择")
    p.add_argument("--operator", required=True, help="操作人")
    p.add_argument("--note", default="", help="重跑说明")
    p.set_defaults(func=cmd_rerun)

    p = subparsers.add_parser("report", help="生成结果报告")
    p.add_argument("--demo", action="store_true", help="加载演示数据")
    p.add_argument("--output", help="输出JSON文件路径")
    p.set_defaults(func=cmd_report)

    p = subparsers.add_parser("import", help="导入标注员留言")
    p.add_argument("--content", help="留言内容")
    p.add_argument("--annotator", help="标注员姓名")
    p.add_argument("--url", help="引用链接")
    p.add_argument("--file", help="从JSON文件批量导入")
    p.set_defaults(func=cmd_import)

    args = parser.parse_args()
    if args.command is None:
        parser.print_help()
        return
    args.func(args)


if __name__ == "__main__":
    main()
