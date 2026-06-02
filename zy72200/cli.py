import sys
from typing import List
from models import DividendStatus
from reconciliation_engine import ReconciliationEngine
from demo_data import (
    DEMO_TAIL_ADJUSTMENTS,
    DEMO_CUSTODIAN_CONFIRMATIONS,
    DEMO_MANUAL_CORRECTION,
)


def print_divider(title: str = "") -> None:
    width = 80
    if title:
        line = f" {title} ".center(width, "=")
    else:
        line = "=" * width
    print(f"\n{line}\n")


def print_entry_status(engine: ReconciliationEngine, entry_id: str) -> None:
    entry = engine.entries.get(entry_id)
    if not entry:
        return
    print(f"  [{entry.id}] {entry.stock_name}({entry.stock_code})")
    print(f"    原始金额栏: {entry.amount_str}")
    print(f"    当前状态: {entry.status.value}")
    print(f"    当前币别: {entry.currency or '未确认'}")
    print(f"    当前金额: {entry.amount:,.2f}")
    if entry.remark:
        print(f"    备注: {entry.remark}")


def print_audit_trail(engine: ReconciliationEngine, entry_id: str) -> None:
    logs = engine.get_entry_audit_trail(entry_id)
    print(f"\n  审计轨迹 ({entry_id}):")
    for log in logs:
        before = log.before_status.value if log.before_status else "无"
        after = log.after_status.value if log.after_status else "进行中"
        print(f"    [{log.timestamp.strftime('%H:%M:%S')}] {log.operator} - {log.action.value}")
        print(f"      状态变化: {before} → {after}")
        print(f"      备注: {log.remark}")


def run_full_demo() -> None:
    print_divider("跨市场股息到账对账 - 完整流程演示")
    print("对账运营阿芬为新人演示整个对账流程\n")

    engine = ReconciliationEngine()

    print_divider("第一步：导入尾差调整条")
    print("阿芬从柜面系统导出今日尾差调整条，共3条记录：\n")
    for entry in DEMO_TAIL_ADJUSTMENTS:
        engine.import_tail_adjustment(entry, operator="阿芬")
        print(f"  ✓ 导入: {entry.stock_name}({entry.stock_code}) - {entry.amount_str}")

    print_divider("第二步：系统自动对账处理")
    print("系统自动识别币别并对账...\n")
    for entry_id in list(engine.entries.keys()):
        engine.process_entry(entry_id, operator="系统")
        print_entry_status(engine, entry_id)
        print()

    print_divider("第三步：查看审计明细")
    print("注意 DIV002 港币人民币同列的情况，系统已留待托管复核：")
    print_audit_trail(engine, "DIV002")

    print_divider("第四步：补录托管确认页")
    print("阿芬收到托管发来的确认页，其中 DIV003 是旧口径补录数据：\n")
    for conf in DEMO_CUSTODIAN_CONFIRMATIONS:
        engine.add_custodian_confirmation(conf, operator="阿芬")
        print(f"  ✓ 补录托管确认: {conf.entry_id}")
        print(f"    确认金额: {conf.confirmed_currency} {conf.confirmed_amount:,.2f}")
        print(f"    旧口径: {'是' if conf.is_old_standard else '否'}")
        print(f"    托管备注: {conf.custodian_remark}")

    print("\n补录后的状态：")
    print_entry_status(engine, "DIV003")
    print_audit_trail(engine, "DIV003")

    print_divider("第五步：人工修正（托管复核后）")
    print("托管对接人李经理回电：DIV002 的人民币标注是笔误，全部是港币\n")
    manual = DEMO_MANUAL_CORRECTION
    print(f"  修正原因: {manual['reason']}")
    engine.manual_correct(
        entry_id=manual["entry_id"],
        new_currency=manual["new_currency"],
        new_amount=manual["new_amount"],
        operator=manual["operator"],
    )
    print(f"  ✓ 人工修正完成")

    print("\n修正后的状态：")
    print_entry_status(engine, "DIV002")
    print_audit_trail(engine, "DIV002")

    print_divider("第六步：重跑对账（可选演示）")
    print("为确保数据一致性，对 DIV002 执行一次重跑：\n")
    engine.rerun_reconciliation("DIV002", operator="阿芬")
    print("  ✓ 重跑完成")
    print_audit_trail(engine, "DIV002")

    print_divider("第七步：最终对账结果汇总")
    print("三种不同处理结果对比：\n")
    results = engine.get_all_results()
    for result in results:
        status_icon = "✓" if result.status == DividendStatus.MATCHED else "△"
        print(f"  {status_icon} [{result.entry_id}] {result.stock_name}")
        print(f"    最终金额: {result.final_currency} {result.final_amount:,.2f}")
        print(f"    状态: {result.status.value}")
        print(f"    港币人民币同列: {'是' if result.is_mixed_currency else '否'}")
        print(f"    旧口径补录: {'是' if result.is_old_standard else '否'}")
        print(f"    结论: {result.conclusion}")
        print()

    print_divider("演示总结")
    print("新人你看，三种情况各有各的处理方式：")
    print("  1. DIV001 腾讯控股 → 【顺利完成】币别金额清晰，自动对账通过")
    print("  2. DIV002 美团-W   → 【人工修正】港币人民币同列，等托管确认后人工修正")
    print("  3. DIV003 中国移动 → 【旧口径补录】金额没写币别，托管确认页补来是旧口径数据")
    print("\n关键记住：港币人民币同列别急着归正常，一定要留给托管对接人复核！")
    print_divider()


def run_interactive() -> None:
    engine = ReconciliationEngine()

    while True:
        print_divider("跨市场股息到账对账")
        print("请选择操作：")
        print("  1. 导入演示尾差调整条")
        print("  2. 查看当前对账状态")
        print("  3. 执行自动对账")
        print("  4. 补录托管确认页")
        print("  5. 人工修正")
        print("  6. 重跑对账")
        print("  7. 查看审计明细")
        print("  8. 运行完整演示")
        print("  0. 退出")

        choice = input("\n请输入选项: ").strip()

        if choice == "0":
            print("再见！")
            break
        elif choice == "1":
            print_divider("导入演示数据")
            for entry in DEMO_TAIL_ADJUSTMENTS:
                engine.import_tail_adjustment(entry)
                print(f"  ✓ 导入: {entry.stock_name}")
            input("\n按回车继续...")
        elif choice == "2":
            print_divider("当前对账状态")
            for entry_id in engine.entries.keys():
                print_entry_status(engine, entry_id)
                print()
            input("\n按回车继续...")
        elif choice == "3":
            print_divider("执行自动对账")
            for entry_id in list(engine.entries.keys()):
                engine.process_entry(entry_id)
                print(f"  ✓ 处理: {entry_id}")
            input("\n按回车继续...")
        elif choice == "4":
            print_divider("补录托管确认页")
            for conf in DEMO_CUSTODIAN_CONFIRMATIONS:
                engine.add_custodian_confirmation(conf)
                print(f"  ✓ 补录确认: {conf.entry_id}")
            input("\n按回车继续...")
        elif choice == "5":
            print_divider("人工修正")
            entry_id = input("请输入记录ID (如 DIV002): ").strip()
            currency = input("新币别 (HKD/CNY): ").strip().upper()
            amount = float(input("新金额: "))
            engine.manual_correct(entry_id, currency, amount)
            print("  ✓ 修正完成")
            input("\n按回车继续...")
        elif choice == "6":
            print_divider("重跑对账")
            entry_id = input("请输入记录ID: ").strip()
            engine.rerun_reconciliation(entry_id)
            print("  ✓ 重跑完成")
            input("\n按回车继续...")
        elif choice == "7":
            print_divider("查看审计明细")
            entry_id = input("请输入记录ID: ").strip()
            print_audit_trail(engine, entry_id)
            input("\n按回车继续...")
        elif choice == "8":
            run_full_demo()
            break
        else:
            print("无效选项，请重试")


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "--demo":
        run_full_demo()
    else:
        run_interactive()


if __name__ == "__main__":
    main()
