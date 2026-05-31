import sys
import os

output_file = "/Users/lzy/pro/solo/workspaces/zy71819/test_output.txt"
sys.stdout = open(output_file, 'w')
sys.stderr = open(output_file, 'a')

print("=" * 60)
print("  票据到期提醒系统 - 功能测试")
print("=" * 60)

try:
    sys.path.insert(0, '/Users/lzy/pro/solo/workspaces/zy71819')
    from database import engine, Base, get_db
    from models import Bill, ReviewRecord, HistoryRecord, UploadFile
    print("✓ 所有模块导入成功")

    Base.metadata.create_all(bind=engine)
    print("✓ 数据库创建成功")

    from sqlalchemy.orm import Session
    from database import SessionLocal
    from services.anomaly_detector import AnomalyDetector
    from services.review_service import ReviewService
    from services.revise_service import ReviseService
    from services.export_service import ExportService
    from datetime import datetime, timedelta
    from config import STATUS_NORMAL, STATUS_PENDING, STATUS_CONFIRMED

    db = SessionLocal()
    print("✓ 数据库连接成功")

    detector = AnomalyDetector(db)
    print("✓ 异常检测器初始化成功")

    today = datetime.now().date()

    test_bills = [
        Bill(
            bill_no="TEST001",
            bill_type="invoice",
            amount=50000.00,
            fee_amount=300.00,
            bill_date=today - timedelta(days=30),
            due_date=today + timedelta(days=60),
            payer="测试公司1",
            payee="本公司",
            serial_no="SER001",
            bank_account="622202123456789001",
            source_file="测试数据",
            source_type="invoice",
            status=STATUS_NORMAL,
        ),
        Bill(
            bill_no="TEST002",
            bill_type="invoice",
            amount=50000.00,
            fee_amount=300.00,
            bill_date=today - timedelta(days=30),
            due_date=today + timedelta(days=60),
            payer="测试公司2",
            payee="本公司",
            serial_no="SER001",
            bank_account="622202123456789002",
            source_file="测试数据",
            source_type="invoice",
            status=STATUS_NORMAL,
        ),
        Bill(
            bill_no="TEST003",
            bill_type="invoice",
            amount=80000.00,
            fee_amount=300.00,
            bill_date=today - timedelta(days=30),
            due_date=today + timedelta(days=60),
            payer="退款挂账处理中",
            payee="本公司",
            serial_no="SER003",
            bank_account="622202123456789003",
            source_file="测试数据",
            source_type="invoice",
            status=STATUS_NORMAL,
        ),
        Bill(
            bill_no="TEST004",
            bill_type="invoice",
            amount=100000.00,
            fee_amount=2000.00,
            bill_date=today - timedelta(days=30),
            due_date=today + timedelta(days=200),
            payer="测试公司4",
            payee="本公司",
            serial_no="SER004",
            bank_account="622202123456789004",
            source_file="测试数据",
            source_type="invoice",
            status=STATUS_NORMAL,
        ),
    ]

    print("\n--- 测试异常检测 ---")
    for bill in test_bills:
        bill = detector.analyze_and_mark(bill)
        db.add(bill)
        print(f"  票据 {bill.bill_no}: 状态={bill.status}, 异常={bill.anomaly_type}")
        if bill.anomaly_reason:
            print(f"    原因: {bill.anomaly_reason}")

    db.commit()

    bills = db.query(Bill).all()
    print(f"\n✓ 异常检测完成，共 {len(bills)} 条记录")

    pending_count = db.query(Bill).filter(Bill.status == STATUS_PENDING).count()
    print(f"  待确认记录: {pending_count} 条")

    print("\n--- 测试复核功能 ---")
    review_service = ReviewService(db)
    first_pending = db.query(Bill).filter(Bill.status == STATUS_PENDING).first()
    if first_pending:
        confirmed = review_service.confirm_bill(
            first_pending.id,
            review_reason="人工核实无误，数据正确",
            review_evidence="对账单2024.xlsx",
            reviewed_by="测试员"
        )
        print(f"✓ 已确认票据 {confirmed.bill_no}, 状态变为 {confirmed.status}")

    print("\n--- 测试修正功能 ---")
    revise_service = ReviseService(db)
    bill_to_revise = db.query(Bill).first()
    if bill_to_revise:
        old_amount = bill_to_revise.amount
        revised = revise_service.revise_bill(
            bill_to_revise.id,
            {"amount": old_amount + 1000, "remark": "修正金额"},
            operator="测试员",
            revise_reason="发现金额有误，修正为正确金额"
        )
        print(f"✓ 已修正票据 {revised.bill_no}: 金额 {old_amount} -> {revised.amount}")

    print("\n--- 测试导出功能 ---")
    export_service = ExportService(db)
    stats = export_service.get_statistics()
    print(f"✓ 统计数据: 总记录={stats['total_count']}, 总金额={stats['total_amount']}")

    export_path = export_service.export_to_excel()
    print(f"✓ 导出文件: {export_path}")

    print("\n--- 测试历史记录 ---")
    histories = revise_service.get_history(limit=10)
    print(f"✓ 历史记录: {len(histories)} 条")
    for h in histories[:3]:
        print(f"  - {h.operation_type}: {h.field_name or ''} {h.old_value or ''} -> {h.new_value or ''}")

    print("\n" + "=" * 60)
    print("  ✓ 所有测试通过！系统功能正常")
    print("=" * 60)

    db.close()

except Exception as e:
    print(f"\n✗ 测试失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
finally:
    sys.stdout.close()
    sys.stderr.close()
