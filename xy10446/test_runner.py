#!/usr/bin/env python3
"""测试脚本 - 分步验证所有功能"""

from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from freight_cancel_cli.datastore import DataStore
from freight_cancel_cli.importer import DataImporter
from freight_cancel_cli.calculator import FeeCalculator
from freight_cancel_cli.exception_detector import ExceptionDetector
from freight_cancel_cli.exporter import ReportExporter
from freight_cancel_cli.models import CancellationStatus

DB_PATH = "test.db"

if os.path.exists(DB_PATH):
    os.remove(DB_PATH)

def step1_import():
    print("\n" + "=" * 70)
    print("【步骤1】导入数据")
    print("=" * 70)
    
    store = DataStore(DB_PATH)
    importer = DataImporter(store)
    
    count = importer.import_bookings_from_csv("sample_data/bookings.csv")
    print(f"  订舱清单: {count} 条")
    
    count = importer.import_schedules_from_csv("sample_data/schedules.csv")
    print(f"  船期规则: {count} 条")
    
    records = importer.import_cancellations_from_csv("sample_data/cancellations.csv")
    for item in records:
        store.save_cancellation(item["record"])
    print(f"  取消/改船记录: {len(records)} 条")

def step2_calculate():
    print("\n" + "=" * 70)
    print("【步骤2】费用核算")
    print("=" * 70)
    
    store = DataStore(DB_PATH)
    calculator = FeeCalculator(store)
    detector = ExceptionDetector(store)
    
    records = store.get_all_cancellations()
    
    for rec in records:
        exceptions = detector.detect(rec)
        rec.exceptions = exceptions
        
        if any("已处理的取消" in e for e in exceptions):
            rec.is_repeat_import = True
            print(f"\n[重复导入] {rec.booking_no}: 检测到重复导入，跳过核算")
            store.save_cancellation(rec)
            continue
        
        if detector.is_fatal_exception(exceptions):
            rec.status = CancellationStatus.EXCEPTION
            print(f"\n[异常] {rec.booking_no}: {'; '.join(exceptions)}")
            store.save_cancellation(rec)
            continue
        
        result = calculator.calculate(rec)
        
        rec.original_fee = result.original_fee
        rec.charged_fee = result.charged_fee
        rec.status = result.status
        rec.processed = True
        
        print(f"\n[核算完成] {rec.booking_no}")
        print(f"  类型: {rec.cancellation_type.value}")
        print(f"  状态: {rec.status.value}")
        print(f"  原始费用: ¥{rec.original_fee:.2f}")
        if rec.original_fee != rec.charged_fee:
            print(f"  减免金额: ¥{rec.original_fee - rec.charged_fee:.2f}")
        print(f"  实际费用: ¥{rec.charged_fee:.2f}")
        print(f"  说明: {result.reason}")
        if rec.exceptions:
            print(f"  异常: {'; '.join(rec.exceptions)}")
        
        store.save_cancellation(rec)

def step3_list():
    print("\n" + "=" * 70)
    print("【步骤3】记录列表")
    print("=" * 70)
    
    store = DataStore(DB_PATH)
    records = store.get_all_cancellations()
    
    print(f"\n{'ID':<10} {'订舱号':<16} {'类型':<8} {'状态':<12} {'原始费用':<12} {'实际费用':<12} {'异常'}")
    print("-" * 90)
    for r in records:
        print(
            f"{r.id:<10} {r.booking_no:<16} {r.cancellation_type.value:<8} "
            f"{r.status.value:<12} ¥{r.original_fee:<10.2f} ¥{r.charged_fee:<10.2f} "
            f"{'是' if r.exceptions else '否'}"
        )

def step4_detail():
    print("\n" + "=" * 70)
    print("【步骤4】查看单票详情 - REC002 (截关前取消)")
    print("=" * 70)
    
    store = DataStore(DB_PATH)
    rec = store.get_cancellation("REC002")
    booking = store.get_booking(rec.booking_no)
    schedule = store.get_schedule_rule(booking.vessel_name, booking.voyage_no)
    
    print(f"\n【取消记录】")
    print(f"  订舱号: {rec.booking_no}")
    print(f"  取消时间: {rec.cancellation_time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    print(f"\n【订舱信息】")
    print(f"  客户: {booking.customer_name} ({booking.customer_level.value})")
    print(f"  船名航次: {booking.vessel_name} {booking.voyage_no}")
    print(f"  柜量: {booking.container_type} x {booking.container_qty}")
    print(f"  海运费单价: ¥{booking.freight_rate:.2f}")
    
    print(f"\n【船期规则】")
    print(f"  截关时间: {schedule.cutoff_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  免费取消: {schedule.free_cancel_hours}h + VIP bonus")
    print(f"  取消费比例: {schedule.charge_rate * 100}%")
    
    hours = (schedule.cutoff_time - rec.cancellation_time).total_seconds() / 3600
    print(f"\n【计算逻辑】")
    print(f"  取消时间距截关: {hours:.1f} 小时")
    print(f"  VIP客户额外免费小时: 12h")
    print(f"  总免费小时: {schedule.free_cancel_hours + 12}h")
    print(f"  {hours}h < {schedule.free_cancel_hours + 12}h? 是，需收取消费")
    print(f"  取消费 = {booking.container_qty}柜 x ¥{booking.freight_rate} x {schedule.charge_rate * 100}%")
    print(f"         = {booking.container_qty * booking.freight_rate} x {schedule.charge_rate}")
    
    print(f"\n【费用结果】")
    print(f"  原始费用: ¥{rec.original_fee:.2f}")
    print(f"  实际费用: ¥{rec.charged_fee:.2f}")

def step5_waive():
    print("\n" + "=" * 70)
    print("【步骤5】登记人工减免 - REC002减免至¥1000")
    print("=" * 70)
    
    store = DataStore(DB_PATH)
    rec = store.get_cancellation("REC002")
    
    print(f"\n原始费用对照:")
    print(f"  订舱号: {rec.booking_no}")
    print(f"  原始状态: {rec.status.value}")
    print(f"  规则计算费用: ¥{rec.original_fee:.2f}")
    print(f"  当前收取费用: ¥{rec.charged_fee:.2f}")
    
    waive_amount = 1000
    rec.charged_fee = waive_amount
    rec.status = CancellationStatus.WAIVED
    rec.waiver_reason = "长期合作客户特殊申请"
    rec.waiver_operator = "张经理"
    rec.waiver_time = datetime.now()
    
    store.save_cancellation(rec)
    
    print(f"\n减免后:")
    print(f"  新状态: {rec.status.value}")
    print(f"  规则计算费用: ¥{rec.original_fee:.2f}")
    print(f"  减免金额: ¥{rec.original_fee - waive_amount:.2f}")
    print(f"  实际收取: ¥{waive_amount:.2f}")
    print(f"  减免原因: {rec.waiver_reason}")
    print(f"  操作人: {rec.waiver_operator}")

def step6_detail_after_waive():
    print("\n" + "=" * 70)
    print("【步骤6】减免后详情 - 含原始规则对照")
    print("=" * 70)
    
    store = DataStore(DB_PATH)
    rec = store.get_cancellation("REC002")
    
    print(f"\n【费用详情】")
    print(f"  状态: {rec.status.value}")
    print(f"  规则计算费用(原始): ¥{rec.original_fee:.2f}")
    print(f"  实际收取费用: ¥{rec.charged_fee:.2f}")
    print(f"  减免金额: ¥{rec.original_fee - rec.charged_fee:.2f}")
    
    print(f"\n【人工减免信息】")
    print(f"  减免原因: {rec.waiver_reason}")
    print(f"  操作人: {rec.waiver_operator}")

def step7_export():
    print("\n" + "=" * 70)
    print("【步骤7】导出报告")
    print("=" * 70)
    
    store = DataStore(DB_PATH)
    exporter = ReportExporter(store)
    
    exporter.export_summary_csv("report.csv")
    print("  CSV报告: report.csv")
    
    exporter.export_detail_report("report.txt")
    print("  文本报告: report.txt")

if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("  货代舱位取消CLI - 完整功能测试")
    print("=" * 70)
    
    step1_import()
    step2_calculate()
    step3_list()
    step4_detail()
    step5_waive()
    step6_detail_after_waive()
    step7_export()
    
    print("\n" + "=" * 70)
    print("  测试完成！")
    print("=" * 70)
    print("\n生成的文件:")
    print("  - test.db: 数据库文件")
    print("  - report.csv: 汇总报告")
    print("  - report.txt: 明细报告")
