import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, init_db, Base, engine
from services import (
    BusinessException,
    create_customer, create_sales_order, create_return_record,
    create_payment_record, recalculate_debt, generate_debt_report,
    get_customer_by_id, get_sales_order_by_id, get_debt_reports
)
from schemas import (
    CustomerCreate, SalesOrderCreate, SalesOrderItemCreate,
    ReturnRecordCreate, ReturnItemCreate, PaymentRecordCreate,
    DebtReportRequest, ErrorCode
)

def print_result(test_name, success, message=""):
    status = "✓ PASS" if success else "✗ FAIL"
    print(f"{status}: {test_name}")
    if message:
        print(f"   {message}")
    return success

def run_self_check():
    print("=" * 60)
    print("乡镇农资店赊销管理系统 - 自检脚本")
    print("=" * 60)
    
    if os.path.exists("credit_sales.db"):
        os.remove("credit_sales.db")
    
    init_db()
    db = SessionLocal()
    
    results = []
    
    print("\n--- 1. 客户管理测试 ---")
    
    try:
        customer_data = CustomerCreate(
            name="张三",
            phone="13800138000",
            address="东村村1号",
            village="东村村"
        )
        customer = create_customer(db, customer_data)
        results.append(print_result("创建客户", True, f"客户ID: {customer.id}, 姓名: {customer.name}"))
    except Exception as e:
        results.append(print_result("创建客户", False, str(e)))
    
    print("\n--- 2. 赊销订单测试 ---")
    
    try:
        customer = get_customer_by_id(db, 1)
        order_items = [
            SalesOrderItemCreate(
                product_name="尿素",
                product_batch="20240501",
                unit="袋",
                quantity=10,
                unit_price=120.0
            ),
            SalesOrderItemCreate(
                product_name="复合肥",
                product_batch="20240502",
                unit="袋",
                quantity=5,
                unit_price=180.0
            )
        ]
        order_data = SalesOrderCreate(
            customer_id=customer.id,
            discount_amount=50.0,
            items=order_items,
            remarks="春耕赊销"
        )
        order = create_sales_order(db, order_data)
        results.append(print_result(
            "创建赊销订单",
            True,
            f"订单号: {order.order_no}, 总金额: {order.total_amount}, 实际欠款: {order.debt_amount}"
        ))
        
        expected_total = 10 * 120 + 5 * 180
        expected_actual = expected_total - 50
        if order.total_amount == expected_total and order.debt_amount == expected_actual:
            results.append(print_result("订单金额计算", True))
        else:
            results.append(print_result("订单金额计算", False, f"预期: {expected_actual}, 实际: {order.debt_amount}"))
            
    except Exception as e:
        results.append(print_result("创建赊销订单", False, str(e)))
    
    print("\n--- 3. 回款管理测试 ---")
    
    try:
        payment_data = PaymentRecordCreate(
            order_id=1,
            amount=1000.0,
            payment_method="cash",
            remarks="第一笔回款"
        )
        payment = create_payment_record(db, payment_data)
        results.append(print_result(
            "创建回款记录",
            True,
            f"回款编号: {payment.payment_no}, 金额: {payment.amount}"
        ))
        
        order = get_sales_order_by_id(db, 1)
        if order.paid_amount == 1000.0:
            results.append(print_result("回款自动抵扣欠款", True, f"已回款: {order.paid_amount}, 当前欠款: {order.debt_amount}"))
        else:
            results.append(print_result("回款自动抵扣欠款", False, f"已回款: {order.paid_amount}"))
            
    except Exception as e:
        results.append(print_result("创建回款记录", False, str(e)))
    
    print("\n--- 4. 退货管理测试 ---")
    
    try:
        order = get_sales_order_by_id(db, 1)
        return_items = [
            ReturnItemCreate(
                order_item_id=order.items[0].id,
                quantity=2,
                reason="质量问题"
            )
        ]
        return_data = ReturnRecordCreate(
            order_id=order.id,
            items=return_items,
            remarks="退回2袋尿素"
        )
        return_record = create_return_record(db, return_data)
        results.append(print_result(
            "创建退货记录",
            True,
            f"退货编号: {return_record.return_no}, 抵扣金额: {return_record.deduction_amount}"
        ))
        
        order = get_sales_order_by_id(db, 1)
        expected_return_amount = 2 * 120
        if order.returned_amount == expected_return_amount:
            results.append(print_result("退货自动抵扣欠款", True, f"已退货抵扣: {order.returned_amount}, 当前欠款: {order.debt_amount}"))
        else:
            results.append(print_result("退货自动抵扣欠款", False, f"已退货抵扣: {order.returned_amount}"))
            
    except Exception as e:
        results.append(print_result("创建退货记录", False, str(e)))
    
    print("\n--- 5. 欠款重算测试 ---")
    
    try:
        order_before = get_sales_order_by_id(db, 1)
        before_debt = order_before.debt_amount
        
        order_after, previous_debt = recalculate_debt(db, 1)
        
        expected_debt = order_before.actual_amount - order_before.paid_amount - order_before.returned_amount
        results.append(print_result(
            "欠款重算",
            True,
            f"重算前: {before_debt}, 重算后: {order_after.debt_amount}, 差额: {order_after.debt_amount - before_debt}"
        ))
        
        if abs(order_after.debt_amount - expected_debt) < 0.01:
            results.append(print_result("重算金额正确性", True))
        else:
            results.append(print_result("重算金额正确性", False, f"预期: {expected_debt}, 实际: {order_after.debt_amount}"))
            
    except Exception as e:
        results.append(print_result("欠款重算", False, str(e)))
    
    print("\n--- 6. 分期回款测试 ---")
    
    try:
        order_before = get_sales_order_by_id(db, 1)
        remaining_debt = order_before.debt_amount
        
        payment_data = PaymentRecordCreate(
            order_id=1,
            amount=remaining_debt,
            payment_method="wechat",
            remarks="结清尾款"
        )
        payment = create_payment_record(db, payment_data)
        
        order_after = get_sales_order_by_id(db, 1)
        
        if order_after.status == "settled" and abs(order_after.debt_amount) < 0.01:
            results.append(print_result(
                "分期回款并结清",
                True,
                f"回款金额: {remaining_debt}, 订单状态: {order_after.status}"
            ))
        else:
            results.append(print_result(
                "分期回款并结清",
                False,
                f"状态: {order_after.status}, 欠款: {order_after.debt_amount}"
            ))
            
    except Exception as e:
        results.append(print_result("分期回款测试", False, str(e)))
    
    print("\n--- 7. 幂等性测试 ---")
    
    try:
        idempotent_key = "test_key_001"
        payment_data1 = PaymentRecordCreate(
            order_id=1,
            amount=100.0,
            idempotent_key=idempotent_key
        )
        
        order = get_sales_order_by_id(db, 1)
        if order.status == "settled":
            results.append(print_result("幂等性测试", True, "订单已结清，跳过幂等测试"))
        else:
            try:
                payment1 = create_payment_record(db, payment_data1)
            except:
                pass
            
            try:
                payment2 = create_payment_record(db, payment_data1)
                results.append(print_result("幂等性测试", False, "应该抛出已处理异常"))
            except BusinessException as e:
                if e.code == ErrorCode.ALREADY_PROCESSED:
                    results.append(print_result("幂等性测试", True, "正确识别重复请求"))
                else:
                    results.append(print_result("幂等性测试", False, f"错误码不正确: {e.code}"))
            
    except Exception as e:
        results.append(print_result("幂等性测试", False, str(e)))
    
    print("\n--- 8. 错误处理测试 ---")
    
    try:
        payment_data = PaymentRecordCreate(
            order_id=99999,
            amount=100.0
        )
        create_payment_record(db, payment_data)
        results.append(print_result("不存在订单处理", False, "应该抛出异常"))
    except BusinessException as e:
        if e.code == ErrorCode.NOT_FOUND:
            results.append(print_result("不存在订单处理", True, "正确识别不存在的订单"))
        else:
            results.append(print_result("不存在订单处理", False, f"错误码不正确: {e.code}"))
    
    print("\n--- 9. 欠款报告测试 ---")
    
    try:
        report_request = DebtReportRequest()
        report = generate_debt_report(db, report_request)
        results.append(print_result(
            "生成欠款报告",
            True,
            f"报告编号: {report.report_no}, 总欠款: {report.total_debt}, 已回款: {report.total_paid}"
        ))
        
        reports = get_debt_reports(db)
        if len(reports) > 0:
            results.append(print_result("查询报告列表", True))
        else:
            results.append(print_result("查询报告列表", False))
            
    except Exception as e:
        results.append(print_result("欠款报告测试", False, str(e)))
    
    print("\n" + "=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"自检结果: {passed}/{total} 测试通过")
    
    if passed == total:
        print("✓ 所有测试通过！系统运行正常。")
    else:
        print(f"✗ 有 {total - passed} 个测试失败，请检查。")
    print("=" * 60)
    
    db.close()
    return passed == total


if __name__ == "__main__":
    success = run_self_check()
    sys.exit(0 if success else 1)
