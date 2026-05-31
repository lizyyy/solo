import sys
import os
from typing import Optional

from models import (
    RecordStatus, DataSource,
    create_batch, create_revenue_record,
    confirm_record, suspend_record, flag_discrepancy,
    get_record, get_records_by_batch, get_batch,
    get_all_batches, get_all_records,
    get_discrepancy_list, get_summary
)
from exporter import export_discrepancy_list, export_full_report
from sample_data import init_sample_data


def print_separator(char="=", length=60):
    print(char * length)


def print_header(title):
    print()
    print_separator("=")
    print(f"  {title}")
    print_separator("=")


def print_record_short(record, index=None):
    status_label = RecordStatus.STATUS_LABELS.get(record["status"], record["status"])
    source_label = DataSource.SOURCE_LABELS.get(record["source"], record["source"])
    actual = f"{record['actual_amount']:.2f}" if record["actual_amount"] is not None else "待补"
    diff = ""
    if record["actual_amount"] is not None:
        d = record["expected_amount"] - record["actual_amount"]
        if abs(d) > 0.01:
            diff = f" 差异:{d:+.2f}"

    status_icon = {
        RecordStatus.CONFIRMED: "✅",
        RecordStatus.PENDING: "❓",
        RecordStatus.SUSPENDED: "⏸️",
        RecordStatus.DISCREPANCY: "⚠️"
    }.get(record["status"], "  ")

    idx = f"[{index}] " if index is not None else ""
    print(f"{status_icon} {idx}{record['id']} | {record['pile_no']} | {record['transaction_date']} | "
          f"应收:{record['expected_amount']:.2f} | 实收:{actual}{diff} | "
          f"{status_label} | 来源:{source_label}")


def print_record_detail(record):
    print_header("记录详情")
    print(f"记录ID：        {record['id']}")
    print(f"批次号：        {record['batch_no']}")
    print(f"账期：          {record.get('period', '')}")
    print(f"充电桩编号：    {record['pile_no']}")
    print(f"交易日期：      {record['transaction_date']}")
    print(f"数据来源：      {DataSource.SOURCE_LABELS.get(record['source'], record['source'])}")
    print(f"来源参考：      {record['source_ref']}")
    print(f"台账应收：      {record['expected_amount']:.2f} 元")
    actual = f"{record['actual_amount']:.2f} 元" if record['actual_amount'] is not None else "待补凭证"
    print(f"银行实收：      {actual}")
    if record['actual_amount'] is not None:
        diff = record['expected_amount'] - record['actual_amount']
        print(f"差异金额：      {diff:.2f} 元")
    print(f"当前状态：      {RecordStatus.STATUS_LABELS.get(record['status'], record['status'])}")
    print(f"最后处理人：    {record['operator']}")
    print(f"创建时间：      {record['created_at']}")
    print(f"更新时间：      {record['updated_at']}")
    print()
    print(f"原始备注：      {record['original_remarks'] or '(无)'}")
    print()
    print(f"处理意见：")
    if record['processing_notes']:
        for line in record['processing_notes'].split('\n'):
            print(f"                {line}")
    else:
        print(f"                (无)")
    print()
    print("处理历史：")
    for i, h in enumerate(record['processing_history'], 1):
        print(f"  [{i}] {h['timestamp']}")
        print(f"      操作人：{h['operator']}")
        print(f"      动作：{h['action']}")
        print(f"      原因：{h['reason']}")
        if h.get('notes'):
            print(f"      备注：{h['notes']}")
        print()


def print_summary(summary):
    print("┌─────────────────────────────────────────────────────┐")
    print("│                新能源充电桩收益归集汇总              │")
    print("├─────────────────────────────────────────────────────┤")
    print(f"│ 总记录数：          {summary['total_count']:>6} 条                    │")
    print(f"│ 台账应收总额：      {summary['total_expected']:>10.2f} 元                 │")
    print(f"│ 银行实收总额：      {summary['total_actual']:>10.2f} 元                 │")
    print("├─────────────────────────────────────────────────────┤")
    print(f"│ ✅ 已确认归集：    {summary['confirmed_amount']:>10.2f} 元                 │")
    print(f"│ ⏸️  已挂起金额：    {summary['suspended_amount']:>10.2f} 元                 │")
    print(f"│ ❓ 待确认金额：    {summary['unconfirmed_amount']:>10.2f} 元                 │")
    print("├─────────────────────────────────────────────────────┤")
    print(f"│ ❓ 待确认：        {summary['status_counts'].get(RecordStatus.PENDING, 0):>6} 条                    │")
    print(f"│ ✅ 已确认：        {summary['status_counts'].get(RecordStatus.CONFIRMED, 0):>6} 条                    │")
    print(f"│ ⏸️  已挂起：        {summary['status_counts'].get(RecordStatus.SUSPENDED, 0):>6} 条                    │")
    print(f"│ ⚠️  有差异：        {summary['status_counts'].get(RecordStatus.DISCREPANCY, 0):>6} 条                    │")
    print("└─────────────────────────────────────────────────────┘")


def input_with_default(prompt, default=""):
    if default:
        result = input(f"{prompt} (默认: {default}): ").strip()
        return result or default
    else:
        return input(f"{prompt}: ").strip()


def select_batch() -> Optional[str]:
    batches = get_all_batches()
    if not batches:
        print("⚠️  暂无批次，请先创建批次。")
        return None

    print_header("选择批次")
    for i, b in enumerate(batches, 1):
        status = "进行中" if b["status"] == "open" else "已关闭"
        print(f"  [{i}] {b['batch_no']} | 账期:{b['period']} | {status} | "
              f"记录:{b['confirmed_count'] + b['pending_count'] + b['suspended_count'] + b['discrepancy_count']}条 | "
              f"已确认:{b['confirmed_amount']:.2f}元")

    choice = input("\n请输入批次序号（直接回车返回主菜单）：").strip()
    if not choice:
        return None

    try:
        idx = int(choice) - 1
        if 0 <= idx < len(batches):
            return batches[idx]["batch_no"]
    except ValueError:
        pass

    print("❌ 无效的选择")
    return None


def select_record(batch_no: Optional[str] = None) -> Optional[str]:
    if batch_no:
        records = get_records_by_batch(batch_no)
    else:
        records = get_all_records()

    if not records:
        print("⚠️  暂无记录。")
        return None

    print_header("选择记录")
    for i, r in enumerate(records, 1):
        print_record_short(r, i)

    choice = input("\n请输入记录序号（直接回车返回）：").strip()
    if not choice:
        return None

    try:
        idx = int(choice) - 1
        if 0 <= idx < len(records):
            return records[idx]["id"]
    except ValueError:
        pass

    print("❌ 无效的选择")
    return None


def action_create_batch():
    print_header("创建归集批次")
    period = input_with_default("请输入账期（如 2026-05）", "2026-05")
    operator = input_with_default("请输入操作人", "门店财务老曹")

    batch = create_batch(period, operator)
    print(f"\n✅ 批次创建成功！")
    print(f"   批次号：{batch['batch_no']}")
    print(f"   账期：{batch['period']}")
    return batch["batch_no"]


def action_add_record(batch_no: Optional[str] = None):
    if not batch_no:
        batch_no = select_batch()
        if not batch_no:
            return

    print_header("添加收益记录")
    print(f"批次号：{batch_no}")
    print()
    print("数据来源选项：")
    for i, (key, label) in enumerate(DataSource.SOURCE_LABELS.items(), 1):
        print(f"  [{i}] {label}")

    source_choice = input_with_default("请选择数据来源序号", "1")
    try:
        source_idx = int(source_choice) - 1
        sources = list(DataSource.SOURCE_LABELS.keys())
        source = sources[source_idx] if 0 <= source_idx < len(sources) else DataSource.BANK_RECEIPT
    except (ValueError, IndexError):
        source = DataSource.BANK_RECEIPT

    source_ref = input("请输入来源参考（如回单号、截图文件名）：").strip()
    pile_no = input("请输入充电桩编号：").strip()
    transaction_date = input_with_default("请输入交易日期（YYYY-MM-DD）", "2026-05-28")
    expected_amount = float(input_with_default("请输入台账应收金额（元）", "0"))
    actual_input = input("请输入银行实收金额（元，缺凭证直接回车）：").strip()
    actual_amount = float(actual_input) if actual_input else None
    original_remarks = input("请输入原始备注（保留月底对账表原始内容）：").strip()
    operator = input_with_default("请输入操作人", "门店财务老曹")
    period = input_with_default("请输入账期", "2026-05")

    record = create_revenue_record(
        batch_no=batch_no,
        source=source,
        source_ref=source_ref,
        pile_no=pile_no,
        transaction_date=transaction_date,
        expected_amount=expected_amount,
        actual_amount=actual_amount,
        original_remarks=original_remarks,
        operator=operator,
        period=period
    )

    print(f"\n✅ 记录创建成功！")
    print_record_short(record)
    status_label = RecordStatus.STATUS_LABELS.get(record["status"], record["status"])
    print(f"   系统自动判定状态：{status_label}")
    if record["processing_notes"]:
        print(f"   处理意见：{record['processing_notes'].split(chr(10))[0]}")


def action_view_records(batch_no: Optional[str] = None):
    if batch_no:
        records = get_records_by_batch(batch_no)
    else:
        records = get_all_records()

    if not records:
        print("⚠️  暂无记录。")
        return

    print_header("记录列表")
    for i, r in enumerate(records, 1):
        print_record_short(r, i)

    choice = input("\n输入记录序号查看详情（直接回车返回）：").strip()
    if choice:
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(records):
                print_record_detail(records[idx])
        except (ValueError, IndexError):
            print("❌ 无效的选择")


def action_view_discrepancies(batch_no: Optional[str] = None):
    records = get_discrepancy_list(batch_no)

    if not records:
        print("🎉 当前无待确认或有差异的记录，所有记录均已处理完毕！")
        return

    print_header("差异清单（待确认 + 有差异）")
    for i, r in enumerate(records, 1):
        print_record_short(r, i)

    choice = input("\n输入记录序号查看详情或处理（直接回车返回）：").strip()
    if choice:
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(records):
                record_id = records[idx]["id"]
                print_record_detail(records[idx])
                action_process_record(record_id)
        except (ValueError, IndexError):
            print("❌ 无效的选择")


def action_process_record(record_id: Optional[str] = None):
    if not record_id:
        record_id = select_record()
        if not record_id:
            return

    record = get_record(record_id)
    if not record:
        print("❌ 记录不存在")
        return

    print_header("处理记录")
    print_record_short(record)
    print()
    print("请选择操作：")
    print("  [1] ✅ 确认归集（人工确认后可归集）")
    print("  [2] ⏸️  挂起处理（缺凭证，暂不归集）")
    print("  [3] ⚠️  标记差异（需要进一步核实）")
    print("  [4] 返回")

    choice = input("\n请选择操作：").strip()

    if choice == "1":
        reason = input("请输入确认原因：").strip()
        notes = input("请输入补充说明（可选）：").strip()
        operator = input_with_default("操作人", "门店财务老曹")
        if reason:
            confirm_record(record_id, operator, reason, notes)
            print(f"\n✅ 记录已确认归集！")
        else:
            print("❌ 请输入确认原因")

    elif choice == "2":
        reason = input("请输入挂起原因（如：缺银行回单）：").strip()
        notes = input("请输入补充说明（可选）：").strip()
        operator = input_with_default("操作人", "门店财务老曹")
        if reason:
            suspend_record(record_id, operator, reason, notes)
            print(f"\n⏸️  记录已挂起，暂不参与归集！")
        else:
            print("❌ 请输入挂起原因")

    elif choice == "3":
        reason = input("请输入差异原因：").strip()
        notes = input("请输入补充说明（可选）：").strip()
        operator = input_with_default("操作人", "门店财务老曹")
        if reason:
            flag_discrepancy(record_id, operator, reason, notes)
            print(f"\n⚠️  记录已标记为差异！")
        else:
            print("❌ 请输入差异原因")

    elif choice == "4":
        return
    else:
        print("❌ 无效的选择")


def action_view_summary(batch_no: Optional[str] = None):
    summary = get_summary(batch_no)
    print_header("归集汇总")
    print_summary(summary)


def action_export(batch_no: Optional[str] = None):
    print_header("导出报告")
    print("  [1] 导出差异清单（CSV）")
    print("  [2] 导出差异清单（Excel）")
    print("  [3] 导出完整归集报告（CSV）")
    print("  [4] 导出完整归集报告（Excel）")
    print("  [5] 返回")

    choice = input("\n请选择导出类型：").strip()

    if choice == "1":
        filepath = export_discrepancy_list(batch_no, "csv")
        print(f"\n✅ 差异清单已导出：{filepath}")
    elif choice == "2":
        filepath = export_discrepancy_list(batch_no, "xlsx")
        print(f"\n✅ 差异清单已导出：{filepath}")
    elif choice == "3":
        filepath = export_full_report(batch_no, "csv")
        print(f"\n✅ 完整报告已导出：{filepath}")
    elif choice == "4":
        filepath = export_full_report(batch_no, "xlsx")
        print(f"\n✅ 完整报告已导出：{filepath}")
    elif choice == "5":
        return
    else:
        print("❌ 无效的选择")


def action_view_history(record_id: Optional[str] = None):
    if not record_id:
        record_id = select_record()
        if not record_id:
            return

    record = get_record(record_id)
    if not record:
        print("❌ 记录不存在")
        return

    print_record_detail(record)


def batch_menu(batch_no: str):
    while True:
        batch = get_batch(batch_no)
        if not batch:
            print("❌ 批次不存在")
            return

        print_header(f"批次 {batch_no}（账期：{batch['period']}）")
        print("  [1] 📋 查看批次内所有记录")
        print("  [2] ➕ 添加收益记录")
        print("  [3] ⚠️  查看差异清单")
        print("  [4] 🔍 查看归集汇总")
        print("  [5] 📝 处理单条记录")
        print("  [6] 📜 查看单条记录处理历史")
        print("  [7] 📤 导出报告")
        print("  [0] ← 返回主菜单")

        choice = input("\n请选择操作：").strip()

        if choice == "1":
            action_view_records(batch_no)
        elif choice == "2":
            action_add_record(batch_no)
        elif choice == "3":
            action_view_discrepancies(batch_no)
        elif choice == "4":
            action_view_summary(batch_no)
        elif choice == "5":
            action_process_record()
        elif choice == "6":
            action_view_history()
        elif choice == "7":
            action_export(batch_no)
        elif choice == "0":
            return
        else:
            print("❌ 无效的选择")


def main_menu():
    current_batch = None

    while True:
        print_header("新能源充电桩收益归集系统")
        print("  [1] 📦 初始化样例数据（首次使用）")
        print("  [2] ➕ 创建新批次")
        print("  [3] 📂 选择批次并进入")
        print("  [4] 📋 查看所有记录")
        print("  [5] ⚠️  查看所有差异")
        print("  [6] 🔍 查看全量汇总")
        print("  [7] 📤 导出全量报告")
        print("  [8] 📜 查看记录处理历史")
        print("  [0] 🚪 退出系统")

        choice = input("\n请选择操作：").strip()

        if choice == "1":
            init_sample_data()
        elif choice == "2":
            batch_no = action_create_batch()
            if batch_no:
                enter = input("是否进入该批次？(y/n): ").strip().lower()
                if enter == "y":
                    batch_menu(batch_no)
        elif choice == "3":
            batch_no = select_batch()
            if batch_no:
                batch_menu(batch_no)
        elif choice == "4":
            action_view_records()
        elif choice == "5":
            action_view_discrepancies()
        elif choice == "6":
            action_view_summary()
        elif choice == "7":
            action_export()
        elif choice == "8":
            action_view_history()
        elif choice == "0":
            print("\n👋 感谢使用新能源充电桩收益归集系统！")
            print("   所有数据已保存在 data/ 目录，重启服务后数据不丢失。")
            sys.exit(0)
        else:
            print("❌ 无效的选择")


def main():
    try:
        if len(sys.argv) > 1:
            if sys.argv[1] == "init":
                init_sample_data()
                return
            elif sys.argv[1] == "api":
                from api import app
                app.run(host="127.0.0.1", port=5000, debug=False)
                return

        main_menu()
    except KeyboardInterrupt:
        print("\n\n👋 感谢使用新能源充电桩收益归集系统！")
        print("   所有数据已保存在 data/ 目录，重启服务后数据不丢失。")


if __name__ == "__main__":
    main()
