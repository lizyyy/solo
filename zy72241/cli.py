#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys

from core import (
    FactoringRepaymentStore,
    RecordType,
    build_demo_store,
)

_store: FactoringRepaymentStore | None = None


def _get_store(args) -> FactoringRepaymentStore:
    global _store
    if _store is None:
        if args.demo:
            _store = build_demo_store()
        else:
            _store = FactoringRepaymentStore()
    return _store


def _fmt_status(s: str) -> str:
    mapping = {
        "imported": "已导入",
        "consistent": "简称一致·顺畅",
        "inconsistent": "简称不一致·待复核",
        "custody_reviewed": "托管已审阅",
        "supplemented": "已补录",
        "completed": "已完成",
    }
    return mapping.get(s, s)


def _fmt_type(t: str) -> str:
    mapping = {
        "smooth": "顺利",
        "inconsistent_abbr": "简称不一致",
        "old_standard_supplement": "旧口径补录",
    }
    return mapping.get(t, t)


def _print_adj(a: dict):
    mismatch_tag = " ⚠ 简称不一致" if a["institution_short_name_imported"] != a["institution_short_name_on_file"] else ""
    print(f"  ID: {a['id']}")
    print(f"  机构全称: {a['institution_full_name']}")
    print(f"  导入简称: {a['institution_short_name_imported']}")
    print(f"  在册简称: {a['institution_short_name_on_file']}{mismatch_tag}")
    print(f"  金额: {a['amount']:,.2f}  尾差: {a['diff_amount']:.2f}")
    print(f"  类型: {_fmt_type(a['record_type'])}  状态: {_fmt_status(a['status'])}")
    print(f"  备注: {a['note']}")
    print(f"  风控审阅: {'是' if a['reviewed_by_risk'] else '否'}  财务复核: {'是' if a['reviewed_by_finance'] else '否'}")
    print(f"  托管确认: {'是' if a['custody_confirmed'] else '否'}  补录已应用: {'是' if a['supplement_applied'] else '否'}")
    print()


def cmd_list(args):
    store = _get_store(args)
    adjs = store.adjustments
    if not adjs:
        print("暂无尾差调整条记录。")
        return
    print(f"共 {len(adjs)} 条尾差调整条：\n")
    for a in adjs:
        _print_adj(a.to_dict())


def cmd_import(args):
    store = _get_store(args)
    try:
        with open(args.file, "r", encoding="utf-8") as f:
            items = json.load(f)
    except Exception as e:
        print(f"读取文件失败: {e}")
        sys.exit(1)

    if not isinstance(items, list):
        print("文件内容须为 JSON 数组")
        sys.exit(1)

    results = store.import_adjustments(items)
    print(f"导入 {len(results)} 条尾差调整条：\n")
    for a in results:
        _print_adj(a.to_dict())

    if args.rerun:
        print("--- 自动重跑 ---\n")
        for a in results:
            a2 = store.rerun(a.id)
            if a2:
                _print_adj(a2.to_dict())


def cmd_custody(args):
    store = _get_store(args)
    adj = store.get_adjustment(args.adj_id)
    if adj is None:
        print(f"找不到调整条 {args.adj_id}")
        sys.exit(1)

    result = store.review_custody_confirmation(
        adj_id=args.adj_id,
        custody_short_name=args.custody_name,
        confirmed_amount=args.amount,
        confirmed_date=args.date,
        note=args.note or "",
    )
    if result is None:
        print("托管确认审阅失败")
        sys.exit(1)

    cc, adj2 = result
    print("托管确认页审阅完成：\n")
    print(f"  托管确认ID: {cc.id}")
    print(f"  关联调整条: {cc.adjustment_id}")
    print(f"  托管页简称: {cc.institution_short_name_custody}")
    print(f"  确认金额: {cc.confirmed_amount:,.2f}")
    print(f"  确认日期: {cc.confirmed_date}")
    print(f"  风控审阅: {'是' if cc.reviewed_by_risk else '否'}")
    print()
    _print_adj(adj2.to_dict())


def cmd_supplement(args):
    store = _get_store(args)
    result = store.apply_supplement(
        adj_id=args.adj_id,
        custody_id=args.custody_id,
        new_short_name=args.new_name,
        new_amount=args.amount,
        reason=args.reason or "",
    )
    if result is None:
        print("补录失败，请检查调整条ID和托管确认ID是否正确")
        sys.exit(1)

    sr, adj2 = result
    print("补录记录已应用：\n")
    print(f"  补录ID: {sr.id}")
    print(f"  简称变更: '{sr.old_short_name}' → '{sr.new_short_name}'")
    print(f"  金额变更: {sr.old_amount:,.2f} → {sr.new_amount:,.2f}")
    print(f"  原因: {sr.reason}")
    print()
    _print_adj(adj2.to_dict())


def cmd_finance_review(args):
    store = _get_store(args)
    adj = store.finance_review(args.adj_id)
    if adj is None:
        print("财务复核失败，调整条状态不满足条件")
        sys.exit(1)
    print("财务复核通过：\n")
    _print_adj(adj.to_dict())


def cmd_rerun(args):
    store = _get_store(args)
    adj = store.rerun(args.adj_id)
    if adj is None:
        print(f"找不到调整条 {args.adj_id}")
        sys.exit(1)
    print("重跑完成：\n")
    _print_adj(adj.to_dict())


def cmd_log(args):
    store = _get_store(args)
    logs = store.get_run_log()
    if not logs:
        print("暂无运行日志。")
        return
    for line in logs:
        print(line)


def cmd_summary(args):
    store = _get_store(args)
    s = store.summary()
    print("保理回款认领 · 汇总\n")
    print(f"  尾差调整条: {s['total_adjustments']}")
    print(f"  托管确认: {s['total_custody_confirmations']}")
    print(f"  补录记录: {s['total_supplement_records']}")
    print()
    print("  按状态分布:")
    for status, count in s["by_status"].items():
        print(f"    {_fmt_status(status)}: {count}")


def cmd_demo_walk(_args):
    global _store
    _store = build_demo_store()
    store = _store

    print("=" * 60)
    print("保理回款认领 · 演示流程")
    print("（风控值班老秦 → 财务复核人 交接场景）")
    print("=" * 60)
    print()

    print("【第一步】尾差调整条首次导入")
    print("-" * 40)
    for a in store.adjustments:
        d = a.to_dict()
        _print_adj(d)

    print()
    print("老秦：三条记录已导入。华融保理那条简称一致，顺畅通过；")
    print("      中信保理那条简称不一致（导入写的是'中信商业保理'，")
    print("      在册是'中信保理'），别急着归正常，留给财务复核人看；")
    print("      远东宏信那条是旧口径，简称写的'远东租赁'，得从托管确认页补录。")
    print()

    print("【第二步】风控值班老秦补看托管确认页")
    print("-" * 40)

    inconsistent_adj = None
    old_standard_adj = None
    for a in store.adjustments:
        if a.record_type == RecordType.INCONSISTENT_ABBR.value:
            inconsistent_adj = a
        if a.record_type == RecordType.OLD_STANDARD_SUPPLEMENT.value:
            old_standard_adj = a

    if inconsistent_adj:
        print(f"\n审阅中信保理（{inconsistent_adj.id}）的托管确认页：")
        result = store.review_custody_confirmation(
            adj_id=inconsistent_adj.id,
            custody_short_name="中信保理",
            confirmed_amount=inconsistent_adj.amount,
            confirmed_date="2026-06-01",
            note="托管页确认简称应为'中信保理'，导入时误写'中信商业保理'",
        )
        cc, _ = result
        print(f"  托管页简称: {cc.institution_short_name_custody}")
        print(f"  确认金额: {cc.confirmed_amount:,.2f}")
        print()
        print("老秦：托管页写了'中信保理'，导入写的是'中信商业保理'，")
        print("      这条已经标记为简称不一致，我审阅了但不动它，留给财务复核人定。")
        print()

    if old_standard_adj:
        print(f"\n审阅远东宏信（{old_standard_adj.id}）的托管确认页：")
        result2 = store.review_custody_confirmation(
            adj_id=old_standard_adj.id,
            custody_short_name="远东宏信",
            confirmed_amount=old_standard_adj.amount,
            confirmed_date="2026-06-01",
            note="旧口径简称'远东租赁'，托管页确认现用'远东宏信'",
        )
        cc2, _ = result2
        print(f"  托管页简称: {cc2.institution_short_name_custody}")
        print(f"  确认金额: {cc2.confirmed_amount:,.2f}")
        print()
        print("老秦：远东这条是旧口径，托管页写的是'远东宏信'，")
        print("      我审阅完了，接下来补录更新。")
        print()

    print("【第三步】补录记录更新")
    print("-" * 40)

    if old_standard_adj:
        cc_for_old = None
        for c in store.custody_confirmations:
            if c.adjustment_id == old_standard_adj.id:
                cc_for_old = c
                break

        if cc_for_old:
            result3 = store.apply_supplement(
                adj_id=old_standard_adj.id,
                custody_id=cc_for_old.id,
                new_short_name="远东宏信",
                new_amount=old_standard_adj.amount,
                reason="旧口径更正：'远东租赁'→'远东宏信'，依据托管确认页",
            )
            sr, _ = result3
            print(f"\n远东宏信补录完成：")
            print(f"  简称变更: '{sr.old_short_name}' → '{sr.new_short_name}'")
            print(f"  金额: {sr.new_amount:,.2f}")
            print()
            print("老秦：远东这条补录搞定了，简称和金额都对上了。")

    if inconsistent_adj:
        print(f"\n中信保理（{inconsistent_adj.id}）状态仍然是'简称不一致·待复核'，")
        print("没动，等你——财务复核人——来定。")

    print()
    print("=" * 60)
    print("三种处理结果对比：")
    print("=" * 60)
    for a in store.adjustments:
        d = a.to_dict()
        tag = ""
        if d["record_type"] == "smooth":
            tag = "✅ 顺利通过"
        elif d["record_type"] == "inconsistent_abbr":
            tag = "⚠ 简称不一致·留待财务复核"
        elif d["record_type"] == "old_standard_supplement":
            tag = "🔄 旧口径·已补录更正"
        print(f"\n  [{tag}] {d['institution_full_name']}")
        print(f"    状态: {_fmt_status(d['status'])}")
        print(f"    导入简称: {d['institution_short_name_imported']}  在册简称: {d['institution_short_name_on_file']}")

    print()
    print("--- 人工修正演示（中信保理财务复核通过）---")
    if inconsistent_adj:
        adj5 = store.finance_review(inconsistent_adj.id)
        if adj5:
            print(f"  中信保理财务复核通过，状态: {_fmt_status(adj5.status)}")

    print()
    print("--- 重跑演示（远东宏信补录后重跑）---")
    if old_standard_adj:
        adj6 = store.rerun(old_standard_adj.id)
        if adj6:
            print(f"  远东宏信重跑结果: {_fmt_status(adj6.status)}")

    print()
    print("完整运行日志：")
    print("-" * 40)
    for line in store.get_run_log():
        print(line)


def main():
    parser = argparse.ArgumentParser(
        prog="保理回款认领",
        description="保理回款认领 · 风控值班老秦和财务复核人的交接工具",
    )
    parser.add_argument("--demo", action="store_true", help="使用内置演示数据")
    sub = parser.add_subparsers(dest="command")

    p_list = sub.add_parser("list", help="列出所有尾差调整条")
    p_list.set_defaults(func=cmd_list)

    p_import = sub.add_parser("import", help="从JSON文件导入尾差调整条")
    p_import.add_argument("file", help="JSON文件路径")
    p_import.add_argument("--rerun", action="store_true", help="导入后自动重跑")
    p_import.set_defaults(func=cmd_import)

    p_custody = sub.add_parser("custody", help="审阅托管确认页")
    p_custody.add_argument("adj_id", help="调整条ID")
    p_custody.add_argument("--custody-name", required=True, help="托管页上的机构简称")
    p_custody.add_argument("--amount", type=float, required=True, help="确认金额")
    p_custody.add_argument("--date", required=True, help="确认日期")
    p_custody.add_argument("--note", default="", help="备注")
    p_custody.set_defaults(func=cmd_custody)

    p_supplement = sub.add_parser("supplement", help="补录记录更新")
    p_supplement.add_argument("adj_id", help="调整条ID")
    p_supplement.add_argument("--custody-id", required=True, help="托管确认ID")
    p_supplement.add_argument("--new-name", required=True, help="更正后的机构简称")
    p_supplement.add_argument("--amount", type=float, required=True, help="更正后的金额")
    p_supplement.add_argument("--reason", default="", help="补录原因")
    p_supplement.set_defaults(func=cmd_supplement)

    p_finance = sub.add_parser("finance-review", help="财务复核通过")
    p_finance.add_argument("adj_id", help="调整条ID")
    p_finance.set_defaults(func=cmd_finance_review)

    p_rerun = sub.add_parser("rerun", help="重跑检查")
    p_rerun.add_argument("adj_id", help="调整条ID")
    p_rerun.set_defaults(func=cmd_rerun)

    p_log = sub.add_parser("log", help="查看运行日志")
    p_log.set_defaults(func=cmd_log)

    p_summary = sub.add_parser("summary", help="查看汇总")
    p_summary.set_defaults(func=cmd_summary)

    p_walk = sub.add_parser("demo-walk", help="走一遍完整演示流程（三步+人工修正+重跑）")
    p_walk.set_defaults(func=cmd_demo_walk)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(0)
    args.func(args)


if __name__ == "__main__":
    main()
