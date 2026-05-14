from datetime import datetime, timedelta
from models import BillStatus
from bill_service import BillService
from risk_service import RiskService


def demo_normal_collection_flow():
    print("\n" + "=" * 60)
    print("场景1: 正常托收流程（票据登记 -> 背书 -> 到期托收 -> 付款）")
    print("=" * 60)
    
    service = BillService()
    
    past_maturity = datetime.now() - timedelta(days=5)
    bill = service.register_bill(
        bill_no="NORMAL-001",
        drawer="供应商A",
        acceptor="工商银行",
        amount=500000,
        currency="CNY",
        issue_date=datetime(2024, 1, 1),
        maturity_date=past_maturity,
        initial_holder="供应商A"
    )
    print(f"✓ 票据登记成功: {bill.bill_no}, 状态: {bill.status.value}, 持票人: {bill.current_holder}")
    
    endorsement1 = service.endorse_bill(
        bill_id=bill.id,
        from_holder="供应商A",
        to_holder="供应商B"
    )
    bill = service.get_bill(bill.id)
    print(f"✓ 第1次背书: {endorsement1.from_holder} -> {endorsement1.to_holder}")
    print(f"  当前持票人: {bill.current_holder}, 背书链验证: {'通过' if bill.verify_endorsement_chain() else '失败'}")
    
    endorsement2 = service.endorse_bill(
        bill_id=bill.id,
        from_holder="供应商B",
        to_holder="贸易公司C"
    )
    bill = service.get_bill(bill.id)
    print(f"✓ 第2次背书: {endorsement2.from_holder} -> {endorsement2.to_holder}")
    print(f"  当前持票人: {bill.current_holder}, 背书链验证: {'通过' if bill.verify_endorsement_chain() else '失败'}")
    
    request = service.initiate_collection(
        bill_id=bill.id,
        holder_id="贸易公司C",
        collection_bank="招商银行",
        collection_account="6226000000000001"
    )
    bill = service.get_bill(bill.id)
    print(f"✓ 发起托收: 银行={request.collection_bank}, 状态={bill.status.value}")
    
    service.submit_collection(bill.id)
    bill = service.get_bill(bill.id)
    print(f"✓ 提交托收银行: 状态={bill.status.value}")
    
    service.confirm_collection(bill.id)
    bill = service.get_bill(bill.id)
    print(f"✓ 银行确认托收: 状态={bill.status.value}")
    
    payment = service.pay_bill(bill.id)
    bill = service.get_bill(bill.id)
    print(f"✓ 付款完成: 金额={payment.amount} {payment.currency}")
    print(f"  最终状态: {bill.status.value}")
    print(f"  资金流水数: {len(bill.transactions)}")
    
    return service


def demo_return_flow():
    print("\n" + "=" * 60)
    print("场景2: 退票处理流程（托收中 -> 退票）")
    print("=" * 60)
    
    service = BillService()
    
    past_maturity = datetime.now() - timedelta(days=3)
    bill = service.register_bill(
        bill_no="RETURN-001",
        drawer="制造商D",
        acceptor="建设银行",
        amount=200000,
        currency="CNY",
        issue_date=datetime(2024, 1, 1),
        maturity_date=past_maturity,
        initial_holder="制造商D"
    )
    print(f"✓ 票据登记成功: {bill.bill_no}")
    
    service.initiate_collection(
        bill_id=bill.id,
        holder_id="制造商D",
        collection_bank="农业银行",
        collection_account="6228000000000001"
    )
    service.submit_collection(bill.id)
    bill = service.get_bill(bill.id)
    print(f"✓ 已提交托收: 状态={bill.status.value}")
    
    return_record = service.process_return(
        bill_id=bill.id,
        return_bank="建设银行",
        return_reason="承兑人账户余额不足"
    )
    bill = service.get_bill(bill.id)
    print(f"✗ 发生退票: 原因={return_record.return_reason}")
    print(f"  票据状态: {bill.status.value}")
    print(f"  托收状态: {bill.collection_request.status.value}")
    
    return service


def demo_retry_mechanism():
    print("\n" + "=" * 60)
    print("场景3: 失败操作补偿机制（无需清库，直接重试）")
    print("=" * 60)
    
    service = BillService()
    
    past_maturity = datetime.now() - timedelta(days=10)
    bill = service.register_bill(
        bill_no="RETRY-001",
        drawer="企业E",
        acceptor="交通银行",
        amount=300000,
        currency="CNY",
        issue_date=datetime(2024, 1, 1),
        maturity_date=past_maturity,
        initial_holder="企业E"
    )
    print(f"✓ 票据登记成功: {bill.bill_no}")
    
    service.initiate_collection(
        bill_id=bill.id,
        holder_id="企业E",
        collection_bank="中国银行",
        collection_account="6217000000000001"
    )
    
    print("\n模拟异常情况：托收提交时数据库断连...")
    original_do_submit = service._do_submit_collection
    def broken_submit(bill_obj, data):
        raise RuntimeError("Database connection failed")
    service._do_submit_collection = broken_submit
    
    try:
        service.submit_collection(bill.id)
    except Exception as e:
        print(f"✗ 操作失败: {e}")
    
    bill = service.get_bill(bill.id)
    print(f"  票据状态: {bill.status.value}")
    print(f"  失败操作数: {len([op for op in bill.failed_operations if not op.resolved])}")
    
    service._do_submit_collection = original_do_submit
    print("\n修复问题后，重试失败操作...")
    
    failed_op = [op for op in bill.failed_operations if not op.resolved][0]
    service.retry_failed_operation(bill.id, failed_op.id)
    
    bill = service.get_bill(bill.id)
    print(f"✓ 重试成功!")
    print(f"  票据状态: {bill.status.value}")
    print(f"  托收状态: {bill.collection_request.status.value}")
    print(f"  失败操作已解决: {failed_op.resolved}")
    
    return service


def demo_risk_report():
    print("\n" + "=" * 60)
    print("场景4: 风险报表（自动检测异常）")
    print("=" * 60)
    
    service = BillService()
    
    normal_bill = service.register_bill(
        bill_no="RISK-NORMAL",
        drawer="企业F",
        acceptor="工商银行",
        amount=100000,
        currency="CNY",
        issue_date=datetime(2024, 1, 1),
        maturity_date=datetime.now() + timedelta(days=30),
        initial_holder="企业F"
    )
    print(f"✓ 正常票据: {normal_bill.bill_no}")
    
    past_maturity = datetime.now() - timedelta(days=10)
    error_bill = service.register_bill(
        bill_no="RISK-ERROR",
        drawer="企业G",
        acceptor="建设银行",
        amount=150000,
        currency="CNY",
        issue_date=datetime(2024, 1, 1),
        maturity_date=past_maturity,
        initial_holder="企业G"
    )
    service.initiate_collection(
        bill_id=error_bill.id,
        holder_id="企业G",
        collection_bank="招商银行",
        collection_account="6226000000000002"
    )
    print(f"✓ 托收中票据: {error_bill.bill_no}")
    
    broken_chain_bill = service.register_bill(
        bill_no="RISK-BROKEN",
        drawer="企业H",
        acceptor="农业银行",
        amount=200000,
        currency="CNY",
        issue_date=datetime(2024, 1, 1),
        maturity_date=datetime.now() + timedelta(days=60),
        initial_holder="企业H"
    )
    service.endorse_bill(
        bill_id=broken_chain_bill.id,
        from_holder="企业H",
        to_holder="企业I",
        confirm_immediately=False
    )
    print(f"✓ 背书链断裂票据: {broken_chain_bill.bill_no} (未确认的背书)")
    
    risk_service = RiskService(service)
    report = risk_service.generate_report()
    print("\n风险报表生成中...")
    risk_service.print_report(report)
    
    return service


if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════╗
║           银行票据托收系统演示                                 ║
║  覆盖：登记、背书链、托收、退票、补偿、风险检测               ║
╚══════════════════════════════════════════════════════════════╝
""")
    
    demo_normal_collection_flow()
    demo_return_flow()
    demo_retry_mechanism()
    demo_risk_report()
    
    print("\n" + "=" * 60)
    print("验证指南（如何确认功能可用）:")
    print("=" * 60)
    print("""
1. 正常流程验证:
   - 票据状态按顺序变化: registered -> endorsed -> collection_pending 
     -> collection_submitted -> collection_confirmed -> paid
   - 每次背书后 current_holder 正确更新
   - 付款后产生资金流水记录

2. 状态规则验证:
   - 尝试在错误状态下操作（如已付款后再背书）
   - 系统应拒绝并提示状态不允许
   - 运行测试: python3 -m pytest test_bill_service.py -v

3. 背书链验证:
   - 添加未确认背书 (confirm_immediately=False)
   - verify_endorsement_chain() 返回 False
   - 此时尝试托收应失败

4. 退票验证:
   - 托收任一阶段发生退票
   - 票据状态变为 returned
   - 托收请求状态变为 failed

5. 补偿机制验证:
   - 模拟操作失败（网络/数据库错误）
   - 票据状态变为 error
   - 修复后调用 retry_failed_operation()
   - 票据状态恢复正常，继续流程

6. 风险报表验证:
   - 创建异常票据（状态错误、链断裂、超期等）
   - 生成风险报表应能检测出所有异常
   - 查看摘要是否准确描述风险点

7. 单元测试验证:
   运行全部测试: python3 -m pytest test_bill_service.py -v
   所有 27 个测试应全部通过
""")
    print("=" * 60)
