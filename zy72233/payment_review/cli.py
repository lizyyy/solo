import argparse
import sys
from pathlib import Path

from .importer import CustodianImporter
from .review_manager import ReviewManager
from .report_generator import ReportGenerator
from .models import ReviewStatus
from . import config

def cmd_import(args):
    importer = CustodianImporter()
    manager = ReviewManager()
    
    file_path = Path(args.file)
    if not file_path.exists():
        print(f"❌ 文件不存在: {file_path}")
        return 1
    
    record = importer.import_from_json(str(file_path))
    manager.add_record(record)
    
    print(f"✅ 成功导入付款记录: {record.id}")
    print(f"   状态: {record.status.value}")
    if record.issues:
        print(f"   发现问题: {len(record.issues)} 个")
        for issue in record.issues:
            print(f"     - {issue.value}")
    return 0

def cmd_list(args):
    manager = ReviewManager()
    records = manager.get_all_records()
    
    if not records:
        print("📋 暂无付款记录")
        return 0
    
    print(f"📋 共 {len(records)} 条付款记录\n")
    print(f"{'编号':<18} {'日期':<12} {'收款方':<20} {'金额':>15} {'状态':<12} {'问题数'}")
    print("-" * 90)
    
    for r in records:
        print(f"{r.id:<18} {r.payment_date:<12} {r.payee[:18]:<20} {r.amount:>14,.2f} {r.status.value:<12} {len(r.issues)}")
    return 0

def cmd_show(args):
    manager = ReviewManager()
    record = manager.get_record(args.id)
    
    if not record:
        print(f"❌ 未找到记录: {args.id}")
        return 1
    
    report = ReportGenerator.generate_report(record)
    print(report)
    return 0

def cmd_upload_xr(args):
    manager = ReviewManager()
    
    if not manager.get_record(args.id):
        print(f"❌ 未找到记录: {args.id}")
        return 1
    
    screenshot_path = Path(args.screenshot)
    if not screenshot_path.exists():
        print(f"❌ 截图文件不存在: {screenshot_path}")
        return 1
    
    success = manager.upload_xr_screenshot(args.id, str(screenshot_path))
    if success:
        print(f"✅ 除权日截图已上传")
        record = manager.get_record(args.id)
        print(f"   当前状态: {record.status.value}")
        if record.balance_change:
            print(f"   余额说明: {record.balance_change.reason}")
        return 0
    else:
        print(f"❌ 上传失败")
        return 1

def cmd_correct_amount(args):
    manager = ReviewManager()
    
    if not manager.get_record(args.id):
        print(f"❌ 未找到记录: {args.id}")
        return 1
    
    success = manager.correct_amount(args.id, args.new_amount)
    if success:
        print(f"✅ 余额已修正")
        record = manager.get_record(args.id)
        print(f"   当前状态: {record.status.value}")
        return 0
    else:
        print(f"❌ 修正失败")
        return 1

def cmd_confirm_approver(args):
    manager = ReviewManager()
    
    if not manager.get_record(args.id):
        print(f"❌ 未找到记录: {args.id}")
        return 1
    
    success = manager.confirm_pinyin_approver(args.id, args.full_name)
    if success:
        print(f"✅ 审批人已确认: {args.full_name}")
        record = manager.get_record(args.id)
        print(f"   当前状态: {record.status.value}")
        return 0
    else:
        print(f"❌ 确认失败")
        return 1

def cmd_rerun(args):
    manager = ReviewManager()
    
    if not manager.get_record(args.id):
        print(f"❌ 未找到记录: {args.id}")
        return 1
    
    success = manager.rerun_record(args.id)
    if success:
        record = manager.get_record(args.id)
        print(f"✅ 第 {record.rerun_count} 次重跑已触发")
        print(f"   当前状态: {record.status.value}")
        return 0
    else:
        print(f"❌ 重跑失败")
        return 1

def cmd_summary(args):
    manager = ReviewManager()
    records = manager.get_all_records()
    summary = ReportGenerator.generate_summary(records)
    print(summary)
    return 0

def cmd_demo(args):
    print("🎬 加载演示数据并运行完整流程...\n")
    
    importer = CustodianImporter()
    manager = ReviewManager()
    generator = ReportGenerator()
    
    demo_dir = config.DEMO_DIR
    
    print("=" * 60)
    print("【第一步】导入托管确认页")
    print("=" * 60)
    
    demo_files = [
        demo_dir / "custodian_page_01.json",
        demo_dir / "custodian_page_02.json",
        demo_dir / "custodian_page_03.json",
    ]
    
    for f in demo_files:
        if f.exists():
            record = importer.import_from_json(str(f))
            manager.add_record(record)
            print(f"  ✅ 导入 {f.name} → {record.id}")
            print(f"     状态: {record.status.value}")
    
    print()
    
    print("=" * 60)
    print("【第二步】基金会计林姐补看除权日截图")
    print("=" * 60)
    
    xr_file = demo_dir / "xr_screenshot_01.txt"
    if xr_file.exists():
        print("  📤 上传除权日截图到 PAY20260601001...")
        manager.upload_xr_screenshot("PAY20260601001", str(xr_file))
        record = manager.get_record("PAY20260601001")
        print(f"     新状态: {record.status.value}")
        print(f"     说明: {record.balance_change.reason}")
    
    print()
    
    print("=" * 60)
    print("【第三步】人工修正余额口径")
    print("=" * 60)
    
    print("  ✏️  修正 PAY20260601002 余额...")
    manager.correct_amount("PAY20260601002", 8020000.00)
    record = manager.get_record("PAY20260601002")
    print(f"     新状态: {record.status.value}")
    print(f"     修正记录: {record.corrections[-1]}")
    
    print()
    
    print("=" * 60)
    print("【第四步】系统重跑")
    print("=" * 60)
    
    print("  🔄 重跑 PAY20260601003...")
    manager.rerun_record("PAY20260601003")
    record = manager.get_record("PAY20260601003")
    print(f"     重跑次数: {record.rerun_count}")
    print(f"     新状态: {record.status.value}")
    
    print()
    
    print("=" * 60)
    print("【第五步】余额变化表更新")
    print("=" * 60)
    print()
    
    walkthrough = generator.generate_demo_walkthrough(manager.get_all_records())
    print(walkthrough)
    
    return 0

def cmd_delete(args):
    manager = ReviewManager()
    if manager.delete_record(args.id):
        print(f"✅ 已删除记录: {args.id}")
        return 0
    else:
        print(f"❌ 未找到记录: {args.id}")
        return 1

def main():
    parser = argparse.ArgumentParser(
        prog="payment-review",
        description="银企直联付款复核系统"
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    import_parser = subparsers.add_parser("import", help="导入托管确认页")
    import_parser.add_argument("file", help="JSON文件路径")
    import_parser.set_defaults(func=cmd_import)
    
    list_parser = subparsers.add_parser("list", help="列出所有记录")
    list_parser.set_defaults(func=cmd_list)
    
    show_parser = subparsers.add_parser("show", help="显示记录详情")
    show_parser.add_argument("id", help="付款记录编号")
    show_parser.set_defaults(func=cmd_show)
    
    upload_parser = subparsers.add_parser("upload-xr", help="上传除权日截图")
    upload_parser.add_argument("id", help="付款记录编号")
    upload_parser.add_argument("screenshot", help="截图文件路径")
    upload_parser.set_defaults(func=cmd_upload_xr)
    
    correct_parser = subparsers.add_parser("correct-amount", help="修正余额")
    correct_parser.add_argument("id", help="付款记录编号")
    correct_parser.add_argument("new_amount", type=float, help="新的余额")
    correct_parser.set_defaults(func=cmd_correct_amount)
    
    approver_parser = subparsers.add_parser("confirm-approver", help="确认审批人全名")
    approver_parser.add_argument("id", help="付款记录编号")
    approver_parser.add_argument("full_name", help="审批人全名")
    approver_parser.set_defaults(func=cmd_confirm_approver)
    
    rerun_parser = subparsers.add_parser("rerun", help="系统重跑")
    rerun_parser.add_argument("id", help="付款记录编号")
    rerun_parser.set_defaults(func=cmd_rerun)
    
    summary_parser = subparsers.add_parser("summary", help="汇总看板")
    summary_parser.set_defaults(func=cmd_summary)
    
    demo_parser = subparsers.add_parser("demo", help="运行演示流程")
    demo_parser.set_defaults(func=cmd_demo)
    
    delete_parser = subparsers.add_parser("delete", help="删除记录")
    delete_parser.add_argument("id", help="付款记录编号")
    delete_parser.set_defaults(func=cmd_delete)
    
    args = parser.parse_args()
    
    if args.command is None:
        parser.print_help()
        return 1
    
    return args.func(args)

if __name__ == "__main__":
    sys.exit(main())
