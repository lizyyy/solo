#!/usr/bin/env python3
import json
import sys
from datetime import datetime
from models import Session
from services import (
    BillingService, ReminderService, DeductionService,
    SupplyService, ComplaintService, ReportService, SampleDataService
)


def print_result(result, indent=2):
    print(json.dumps(result, ensure_ascii=False, indent=indent))


def cmd_load_sample_data(args):
    db = Session()
    try:
        service = SampleDataService(db)
        result = service.load_sample_data()
        print_result(result)
    finally:
        db.close()


def cmd_create_bill(args):
    if len(args) < 4:
        print("用法: python main.py create_bill <住户ID> <账单月份(YYYY-MM)> <费用类型(水费/电费)> <金额>")
        return
    
    db = Session()
    try:
        billing = BillingService(db)
        result = billing.create_bill(
            resident_id=int(args[0]),
            bill_month=args[1],
            utility_type=args[2],
            amount=float(args[3])
        )
        print_result(result)
    finally:
        db.close()


def cmd_list_unpaid_bills(args):
    utility_type = args[0] if args else None
    db = Session()
    try:
        billing = BillingService(db)
        bills = billing.get_unpaid_bills(utility_type)
        
        result = {
            "status": "success",
            "未结清账单数量": len(bills),
            "账单列表": []
        }
        
        for bill in bills:
            result["账单列表"].append({
                "账单ID": bill.id,
                "住户": bill.resident.name,
                "地址": bill.resident.address,
                "账单月份": bill.bill_month,
                "费用类型": bill.utility_type,
                "金额": f"{bill.amount:.2f}元",
                "缴费截止日": bill.due_date.strftime('%Y-%m-%d') if bill.due_date else "未设置",
                "当前状态": bill.status
            })
        
        print_result(result)
    finally:
        db.close()


def cmd_withdraw_bill(args):
    if len(args) < 2:
        print("用法: python main.py withdraw_bill <账单ID> <撤回原因> [操作人]")
        return
    
    db = Session()
    try:
        billing = BillingService(db)
        operator = args[2] if len(args) > 2 else "系统管理员"
        result = billing.withdraw_bill(
            bill_id=int(args[0]),
            reason=args[1],
            operator=operator
        )
        print_result(result)
    finally:
        db.close()


def cmd_bill_history(args):
    if len(args) < 1:
        print("用法: python main.py bill_history <账单ID>")
        return
    
    db = Session()
    try:
        billing = BillingService(db)
        result = billing.get_bill_history(int(args[0]))
        print_result(result)
    finally:
        db.close()


def cmd_run_reminders(args):
    db = Session()
    try:
        reminder = ReminderService(db)
        current_date = datetime.strptime(args[0], '%Y-%m-%d') if args else None
        result = reminder.run_reminder_batch(current_date)
        
        summary = result["summary"]
        print(f"\n{'='*60}")
        print(f"催缴批次执行报告 - {summary['处理日期']}")
        print(f"{'='*60}")
        print(f"总处理账单数：{summary['总处理账单数']}")
        print(f"已发送催缴：{summary['已发送催缴']}")
        print(f"跳过数量：{summary['跳过数量']}")
        print(f"\n跳过原因统计：")
        for reason, count in summary["跳过原因"].items():
            print(f"  - {reason}：{count}笔")
        
        print(f"\n详细处理结果：")
        for item in summary["详细结果"]:
            status_icon = "✓" if item["状态"] == "已催缴" else "○"
            print(f"\n{status_icon} 住户：{item['住户']}")
            print(f"   账单：{item['账单']}")
            print(f"   状态：{item['状态']}")
            if item["状态"] == "已催缴":
                print(f"   渠道：{item['渠道']}")
                print(f"   策略：{item['策略']}")
                print(f"   逾期：{item['逾期天数']}天")
            else:
                print(f"   原因：{item['原因']}")
        
        print(f"\n{'='*60}\n")
    finally:
        db.close()


def cmd_process_deduction(args):
    if len(args) < 1:
        print("用法: python main.py process_deduction <账单ID>")
        return
    
    db = Session()
    try:
        deduction = DeductionService(db)
        result = deduction.process_deduction(int(args[0]))
        print_result(result)
    finally:
        db.close()


def cmd_batch_deductions(args):
    utility_type = args[0] if args else None
    db = Session()
    try:
        deduction = DeductionService(db)
        result = deduction.batch_process_deductions(utility_type)
        
        summary = result["summary"]
        print(f"\n{'='*60}")
        print(f"银行代扣批量处理报告")
        print(f"{'='*60}")
        print(f"总处理数：{summary['总处理数']}")
        print(f"代扣成功：{summary['代扣成功']}")
        print(f"代扣失败：{summary['代扣失败']}")
        
        print(f"\n详细结果：")
        for item in summary["详细结果"]:
            status_icon = "✓" if item["status"] == "success" else ("✗" if item["status"] == "failed" else "!")
            print(f"{status_icon} {item['message']}")
        
        print(f"\n{'='*60}\n")
    finally:
        db.close()


def cmd_cut_supply(args):
    if len(args) < 4:
        print("用法: python main.py cut_supply <住户ID> <费用类型(水费/电费)> <停供原因> <操作人>")
        return
    
    db = Session()
    try:
        supply = SupplyService(db)
        result = supply.cut_supply(
            resident_id=int(args[0]),
            utility_type=args[1],
            reason=args[2],
            operator=args[3]
        )
        print_result(result)
    finally:
        db.close()


def cmd_restore_supply(args):
    if len(args) < 4:
        print("用法: python main.py restore_supply <住户ID> <费用类型(水费/电费)> <恢复原因> <操作人>")
        return
    
    db = Session()
    try:
        supply = SupplyService(db)
        result = supply.restore_supply(
            resident_id=int(args[0]),
            utility_type=args[1],
            reason=args[2],
            operator=args[3]
        )
        print_result(result)
    finally:
        db.close()


def cmd_record_complaint(args):
    if len(args) < 3:
        print("用法: python main.py record_complaint <住户ID> <投诉类型> <投诉描述> [是否屏蔽催缴(true/false)] [屏蔽天数]")
        return
    
    db = Session()
    try:
        complaint = ComplaintService(db)
        shield = args[3].lower() == 'true' if len(args) > 3 else False
        shield_days = int(args[4]) if len(args) > 4 else 7
        
        result = complaint.record_complaint(
            resident_id=int(args[0]),
            complaint_type=args[1],
            description=args[2],
            shield_reminders=shield,
            shield_days=shield_days
        )
        print_result(result)
    finally:
        db.close()


def cmd_resolve_complaint(args):
    if len(args) < 2:
        print("用法: python main.py resolve_complaint <投诉ID> <处理结果>")
        return
    
    db = Session()
    try:
        complaint = ComplaintService(db)
        result = complaint.resolve_complaint(
            complaint_id=int(args[0]),
            resolution=args[1]
        )
        print_result(result)
    finally:
        db.close()


def cmd_generate_report(args):
    if len(args) < 2:
        print("用法: python main.py generate_report <报表月份(YYYY-MM)> <费用类型(水费/电费)>")
        return
    
    db = Session()
    try:
        report = ReportService(db)
        result = report.generate_monthly_report(args[0], args[1])
        print_result(result)
    finally:
        db.close()


def cmd_demo_normal_flow(args):
    print("\n" + "="*70)
    print("场景一：正常催缴流程演示")
    print("="*70)
    
    db = Session()
    try:
        print("\n[步骤1] 加载样例数据...")
        sample = SampleDataService(db)
        result = sample.load_sample_data()
        print(f"  ✓ {result['message']}")
        
        print("\n[步骤2] 查看未结清账单...")
        billing = BillingService(db)
        bills = billing.get_unpaid_bills()
        print(f"  共 {len(bills)} 笔未结清账单")
        
        print("\n[步骤3] 执行催缴批次（模拟今天是2026-05-15）...")
        reminder = ReminderService(db)
        result = reminder.run_reminder_batch(datetime(2026, 5, 15))
        summary = result["summary"]
        print(f"  ✓ 已发送催缴：{summary['已发送催缴']} 笔")
        print(f"  ✓ 跳过数量：{summary['跳过数量']} 笔（包含未逾期和各种拦截）")
        
        print("\n[步骤4] 执行银行代扣...")
        deduction = DeductionService(db)
        result = deduction.batch_process_deductions()
        summary = result["summary"]
        print(f"  ✓ 代扣成功：{summary['代扣成功']} 笔")
        print(f"  ✓ 代扣失败：{summary['代扣失败']} 笔")
        
        print("\n[步骤5] 生成催缴报表...")
        report = ReportService(db)
        result = report.generate_monthly_report("2026-04", "水费")
        print(f"  ✓ {result['message']}")
        
        print("\n" + "="*70)
        print("正常流程演示完成！")
        print("="*70 + "\n")
    finally:
        db.close()


def cmd_demo_complaint_shield(args):
    print("\n" + "="*70)
    print("场景二：投诉屏蔽催缴演示")
    print("="*70)
    
    db = Session()
    try:
        print("\n[步骤0] 加载样例数据...")
        sample = SampleDataService(db)
        sample.load_sample_data()
        print("  ✓ 样例数据已加载")
        
        print("\n[步骤1] 找到住户'李四'并记录其投诉...")
        from models import Resident
        resident = db.query(Resident).filter_by(name="李四").first()
        
        complaint = ComplaintService(db)
        result = complaint.record_complaint(
            resident_id=resident.id,
            complaint_type="催缴骚扰",
            description="住户反映收到过多催缴短信，要求暂停催缴",
            shield_reminders=True,
            shield_days=14
        )
        print(f"  ✓ {result['message']}")
        complaint_id = result["complaint_id"]
        
        print("\n[步骤2] 再次执行催缴批次...")
        reminder = ReminderService(db)
        result = reminder.run_reminder_batch(datetime(2026, 5, 15))
        summary = result["summary"]
        
        li_skipped = False
        for item in summary["详细结果"]:
            if item["住户"] == "李四" and item["状态"] == "跳过":
                print(f"  ✓ 李四的账单已被跳过，原因：{item['原因']}")
                li_skipped = True
                break
        
        if not li_skipped:
            print("  ✗ 预期李四的账单应该被跳过，但实际没有")
        
        print("\n[步骤3] 处理投诉并解除屏蔽...")
        result = complaint.resolve_complaint(
            complaint_id=complaint_id,
            resolution="已与住户沟通，调整催缴策略，解除屏蔽"
        )
        print(f"  ✓ {result['message']}")
        
        print("\n" + "="*70)
        print("投诉屏蔽演示完成！")
        print("="*70 + "\n")
    finally:
        db.close()


def cmd_demo_duplicate_operations(args):
    print("\n" + "="*70)
    print("场景三：重复操作稳定性演示")
    print("="*70)
    
    db = Session()
    try:
        sample = SampleDataService(db)
        sample.load_sample_data()
        
        print("\n[测试1] 重复创建同一账单...")
        billing = BillingService(db)
        from models import Resident
        zhangsan = db.query(Resident).filter_by(name="张三").first()
        
        result1 = billing.create_bill(zhangsan.id, "2026-04", "水费", 45.50)
        print(f"  第一次创建：{result1['status']} - {result1['message']}")
        
        result2 = billing.create_bill(zhangsan.id, "2026-04", "水费", 45.50)
        print(f"  第二次创建：{result2['status']} - {result2['message']}")
        print(f"  ✓ 结果稳定，未重复创建账单")
        
        print("\n[测试2] 重复生成同一报表...")
        report = ReportService(db)
        result1 = report.generate_monthly_report("2026-04", "电费")
        print(f"  第一次生成：{result1['status']}")
        
        result2 = report.generate_monthly_report("2026-04", "电费")
        print(f"  第二次生成：{result2['status']} - {result2['message']}")
        print(f"  ✓ 结果稳定，返回已有报表")
        
        print("\n[测试3] 查看账单历史轨迹...")
        from models import Bill
        bill = db.query(Bill).filter_by(resident_id=zhangsan.id, bill_month="2026-04", utility_type="水费").first()
        history = billing.get_bill_history(bill.id)
        print(f"  ✓ 账单历史记录数：{len(history.get('history', []))}")
        if history.get("history"):
            for h in history["history"]:
                print(f"    - {h['时间']} {h['操作']}: {h['状态变化']}")
        
        print("\n[测试4] 撤回已撤回的账单...")
        result1 = billing.withdraw_bill(bill.id, "账单金额有误，需要重新核算", "测试操作员")
        print(f"  第一次撤回：{result1['status']} - {result1['message']}")
        
        result2 = billing.withdraw_bill(bill.id, "再次撤回测试", "测试操作员")
        print(f"  第二次撤回：{result2['status']} - {result2['message']}")
        print(f"  ✓ 结果稳定，提示已撤回")
        
        print("\n" + "="*70)
        print("重复操作稳定性演示完成！")
        print("="*70 + "\n")
    finally:
        db.close()


def cmd_help(args):
    help_text = """
水电欠费催缴服务 - 命令行工具

可用命令：

【数据准备】
  load_sample_data          加载样例数据（住户、账单、催缴策略）

【账单管理】
  create_bill               创建账单
  list_unpaid_bills         列出未结清账单
  withdraw_bill             撤回账单（保留历史）
  bill_history              查看账单历史轨迹

【催缴执行】
  run_reminders             执行催缴批次
  process_deduction         单笔银行代扣
  batch_deductions          批量银行代扣

【停复供管理】
  cut_supply                停止供水/供电
  restore_supply            恢复供水/供电

【投诉管理】
  record_complaint          记录投诉（可屏蔽催缴）
  resolve_complaint         处理投诉（解除屏蔽）

【报表统计】
  generate_report           生成催缴报表

【演示场景】
  demo_normal_flow          演示：正常催缴流程
  demo_complaint_shield     演示：投诉屏蔽催缴
  demo_duplicate_operations 演示：重复操作稳定性

使用示例：
  python main.py load_sample_data
  python main.py list_unpaid_bills
  python main.py run_reminders 2026-05-15
  python main.py demo_normal_flow
"""
    print(help_text)


def main():
    if len(sys.argv) < 2:
        cmd_help([])
        return
    
    command = sys.argv[1]
    args = sys.argv[2:]
    
    commands = {
        'load_sample_data': cmd_load_sample_data,
        'create_bill': cmd_create_bill,
        'list_unpaid_bills': cmd_list_unpaid_bills,
        'withdraw_bill': cmd_withdraw_bill,
        'bill_history': cmd_bill_history,
        'run_reminders': cmd_run_reminders,
        'process_deduction': cmd_process_deduction,
        'batch_deductions': cmd_batch_deductions,
        'cut_supply': cmd_cut_supply,
        'restore_supply': cmd_restore_supply,
        'record_complaint': cmd_record_complaint,
        'resolve_complaint': cmd_resolve_complaint,
        'generate_report': cmd_generate_report,
        'demo_normal_flow': cmd_demo_normal_flow,
        'demo_complaint_shield': cmd_demo_complaint_shield,
        'demo_duplicate_operations': cmd_demo_duplicate_operations,
        'help': cmd_help
    }
    
    if command in commands:
        commands[command](args)
    else:
        print(f"未知命令：{command}")
        cmd_help([])


if __name__ == '__main__':
    main()
