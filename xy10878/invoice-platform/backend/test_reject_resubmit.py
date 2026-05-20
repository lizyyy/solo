#!/usr/bin/env python3
"""
测试发票驳回重提完整流程
验证:
1. surcharge + discount 组合调整金额正确
2. 驳回重提后金额不丢失
3. 差异记录不重复
4. 完整对账追溯链
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, Customer, PricingRule, CallDetail, BillingPeriod, BillingSummary, Adjustment, Invoice, VarianceRecord
from services import lock_billing_period, create_adjustment, submit_invoice, reject_invoice, export_invoice_details
from schemas import AdjustmentCreate, InvoiceSubmit, InvoiceReject

DB_URL = "sqlite:///./test_reject_resubmit.db"

def init_test_db():
    engine = create_engine(DB_URL)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()

def test_reject_resubmit_flow():
    print("=" * 70)
    print("测试: 发票驳回重提完整流程")
    print("=" * 70)
    
    db = init_test_db()
    
    try:
        # 1. 创建测试数据
        print("\n[1/8] 创建测试数据...")
        customer = Customer(
            id="TEST-CUST-002",
            name="重提测试客户",
            contact="测试员",
            email="test@example.com"
        )
        db.add(customer)
        
        rule = PricingRule(
            id="TEST-RULE-v1",
            version="v1.0",
            customer_id=customer.id,
            free_quota=10,
            price_per_call=0.10,
            effective_date=datetime(2024, 1, 1),
            description="测试规则"
        )
        db.add(rule)
        
        # 20次调用 → 基础金额 1.0 元
        for i in range(20):
            call = CallDetail(
                id=f"CALL-{i:03d}",
                customer_id=customer.id,
                api_name="test_api",
                call_time=datetime(2024, 1, 15) + timedelta(hours=i),
                response_time_ms=100,
                status_code=200
            )
            db.add(call)
        
        period = BillingPeriod(
            id="TEST-PERIOD-02",
            customer_id=customer.id,
            period_start=datetime(2024, 1, 1),
            period_end=datetime(2024, 2, 1),
            is_locked=False
        )
        db.add(period)
        db.commit()
        print("   ✓ 测试数据创建完成")
        
        # 2. 锁定账期
        print("\n[2/8] 锁定账期...")
        period_obj, msg, summaries = lock_billing_period(db, period.id)
        summary = summaries[0]
        assert summary.base_amount == 1.0
        assert summary.manual_discount == 0.0
        assert summary.manual_surcharge == 0.0
        assert summary.final_amount == 1.0
        print(f"   ✓ 账期锁定成功")
        print(f"     - 基础金额: {summary.base_amount}元")
        
        # 3. 创建 surcharge 调整 (+2.0元)
        print("\n[3/8] 创建 surcharge 调整 (+2.0元)...")
        adj1 = AdjustmentCreate(
            billing_summary_id=summary.id,
            adjustment_type="surcharge",
            amount=2.0,
            reason="加急处理费",
            adjusted_by="财务A"
        )
        create_adjustment(db, adj1)
        db.refresh(summary)
        assert summary.manual_surcharge == 2.0
        assert summary.final_amount == 3.0
        print(f"   ✓ surcharge 调整成功")
        print(f"     - 附加费: {summary.manual_surcharge}元")
        print(f"     - 最终金额: {summary.final_amount}元")
        
        # 4. 第一次提交发票
        print("\n[4/8] 第一次提交发票...")
        invoice_submit = InvoiceSubmit(billing_period_id=period.id)
        invoice, msg = submit_invoice(db, invoice_submit)
        assert invoice.total_amount == 3.0
        
        variances = db.query(VarianceRecord).filter(VarianceRecord.invoice_id == invoice.id).all()
        assert len(variances) == 1
        assert variances[0].variance_type == "manual_surcharge"
        assert variances[0].variance_amount == 2.0
        print(f"   ✓ 发票提交成功")
        print(f"     - 发票金额: {invoice.total_amount}元")
        print(f"     - 差异记录: {len(variances)}条")
        
        # 5. 驳回发票
        print("\n[5/8] 驳回发票...")
        reject_data = InvoiceReject(rejection_reason="请补充调用明细")
        invoice, msg = reject_invoice(db, invoice.id, reject_data)
        assert invoice.status.value == "rejected"
        print(f"   ✓ 发票已驳回: {invoice.rejection_reason}")
        
        # 6. 追加 discount 调整 (-1.0元)
        print("\n[6/8] 追加 discount 调整 (-1.0元)...")
        adj2 = AdjustmentCreate(
            billing_summary_id=summary.id,
            adjustment_type="discount",
            amount=1.0,
            reason="老客户优惠",
            adjusted_by="财务B"
        )
        create_adjustment(db, adj2)
        db.refresh(summary)
        
        assert summary.manual_surcharge == 2.0
        assert summary.manual_discount == 1.0
        assert summary.final_amount == 2.0
        print(f"   ✓ discount 调整成功")
        print(f"     - 附加费: {summary.manual_surcharge}元")
        print(f"     - 折扣: {summary.manual_discount}元")
        print(f"     - 最终金额: {summary.final_amount}元")
        
        # 7. 重新提交发票
        print("\n[7/8] 重新提交发票...")
        invoice_submit2 = InvoiceSubmit(billing_period_id=period.id)
        invoice2, msg = submit_invoice(db, invoice_submit2)
        
        assert invoice2.id == invoice.id
        assert invoice2.total_amount == 2.0
        
        variances2 = db.query(VarianceRecord).filter(VarianceRecord.invoice_id == invoice.id).all()
        
        print(f"   ✓ 重新提交成功")
        print(f"     - 发票金额: {invoice2.total_amount}元")
        print(f"     - 差异记录: {len(variances2)}条")
        
        assert len(variances2) == 2, f"应该有2条差异记录，实际有{len(variances2)}条"
        
        has_surcharge = any(v.variance_type == "manual_surcharge" for v in variances2)
        has_discount = any(v.variance_type == "manual_discount" for v in variances2)
        
        assert has_surcharge, "缺少 surcharge 差异记录"
        assert has_discount, "缺少 discount 差异记录"
        
        for v in variances2:
            print(f"       * {v.variance_type}: {v.variance_amount}元")
            print(f"         {v.description}")
        
        # 8. 验证导出
        print("\n[8/8] 验证Excel导出...")
        export_dir = "../test_exports"
        file_path, msg = export_invoice_details(db, invoice.id, export_dir)
        assert file_path is not None
        print(f"   ✓ 导出成功: {file_path}")
        
        print("\n" + "=" * 70)
        print("✅ 所有测试通过!")
        print("=" * 70)
        print(f"\n测试结果摘要:")
        print(f"  基础金额: 1.0元")
        print(f"  + surcharge: +2.0元")
        print(f"  - discount: -1.0元")
        print(f"  = 最终金额: 2.0元 ✓")
        print(f"  差异记录: 2条 (surcharge + discount) ✓")
        print(f"  金额不丢失: ✓")
        print(f"  差异不重复: ✓")
        
        return True
        
    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()
        if os.path.exists("./test_reject_resubmit.db"):
            os.remove("./test_reject_resubmit.db")

if __name__ == "__main__":
    success = test_reject_resubmit_flow()
    sys.exit(0 if success else 1)
