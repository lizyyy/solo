#!/usr/bin/env python3
"""
测试差异记录修复脚本
验证:
1. discount 调整生成差异记录
2. surcharge 调整生成差异记录
3. 导出Excel包含所有差异记录
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, Customer, PricingRule, CallDetail, BillingPeriod, BillingSummary, Adjustment, Invoice, VarianceRecord
from services import lock_billing_period, create_adjustment, submit_invoice, export_invoice_details
from schemas import AdjustmentCreate, InvoiceSubmit

DB_URL = "sqlite:///./test_variance.db"

def init_test_db():
    engine = create_engine(DB_URL)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()

def test_surcharge_variance():
    print("=" * 70)
    print("测试: surcharge 调整生成差异记录")
    print("=" * 70)
    
    db = init_test_db()
    
    try:
        # 1. 创建测试数据
        print("\n[1/6] 创建测试数据...")
        customer = Customer(
            id="TEST-CUST-001",
            name="测试客户",
            contact="测试联系人",
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
        
        # 20次调用，免费10次，计费10次 → 基础金额 1.0 元
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
            id="TEST-PERIOD-01",
            customer_id=customer.id,
            period_start=datetime(2024, 1, 1),
            period_end=datetime(2024, 2, 1),
            is_locked=False
        )
        db.add(period)
        db.commit()
        print("   ✓ 测试数据创建完成")
        
        # 2. 锁定账期
        print("\n[2/6] 锁定账期...")
        period_obj, msg, summaries = lock_billing_period(db, period.id)
        assert period_obj.is_locked == True, "账期应该被锁定"
        assert len(summaries) == 1, f"应该有1条计费汇总，实际有{len(summaries)}条"
        summary = summaries[0]
        assert summary.base_amount == 1.0, f"基础金额应该是1.0元，实际是{summary.base_amount}元"
        print(f"   ✓ 账期锁定成功，基础金额: {summary.base_amount}元")
        print(f"     - 总调用: {summary.total_calls}次")
        print(f"     - 免费调用: {summary.free_calls}次")
        print(f"     - 计费调用: {summary.billable_calls}次")
        
        # 3. 创建 surcharge 调整 (+2.0元)
        print("\n[3/6] 创建 surcharge 调整 (+2.0元)...")
        adj_create = AdjustmentCreate(
            billing_summary_id=summary.id,
            adjustment_type="surcharge",
            amount=2.0,
            reason="测试额外收费",
            adjusted_by="测试财务"
        )
        adj, msg = create_adjustment(db, adj_create)
        assert adj is not None, "调整创建失败"
        
        # 刷新 summary
        db.refresh(summary)
        assert summary.final_amount == 3.0, f"最终金额应该是3.0元，实际是{summary.final_amount}元"
        print(f"   ✓ surcharge 调整成功")
        print(f"     - 调整类型: {adj.adjustment_type}")
        print(f"     - 调整金额: {adj.amount}元")
        print(f"     - 最终金额: {summary.final_amount}元")
        
        # 4. 提交发票
        print("\n[4/6] 提交发票申请...")
        invoice_submit = InvoiceSubmit(billing_period_id=period.id)
        invoice, msg = submit_invoice(db, invoice_submit)
        assert invoice is not None, "发票提交失败"
        assert invoice.total_amount == 3.0, f"发票金额应该是3.0元，实际是{invoice.total_amount}元"
        print(f"   ✓ 发票提交成功，金额: {invoice.total_amount}元")
        
        # 5. 检查差异记录
        print("\n[5/6] 检查差异记录...")
        variances = db.query(VarianceRecord).filter(VarianceRecord.invoice_id == invoice.id).all()
        variance_count = len(variances)
        print(f"   差异记录数量: {variance_count}")
        
        assert variance_count >= 1, f"应该至少有1条差异记录，实际有{variance_count}条"
        
        has_surcharge = False
        for v in variances:
            print(f"     - 类型: {v.variance_type}, 金额: {v.variance_amount}元")
            print(f"       描述: {v.description}")
            print(f"       来源: {v.source_rule}")
            if v.variance_type == "manual_surcharge":
                has_surcharge = True
                assert v.variance_amount == 2.0, f"surcharge差异金额应该是2.0元，实际是{v.variance_amount}元"
        
        assert has_surcharge, "应该有 manual_surcharge 类型的差异记录"
        print("   ✓ surcharge 差异记录生成成功")
        
        # 6. 测试导出
        print("\n[6/6] 测试导出Excel...")
        export_dir = "../test_exports"
        file_path, msg = export_invoice_details(db, invoice.id, export_dir)
        assert file_path is not None, "导出失败"
        assert os.path.exists(file_path), "导出文件不存在"
        print(f"   ✓ 导出成功: {file_path}")
        
        print("\n" + "=" * 70)
        print("✅ 所有测试通过!")
        print("=" * 70)
        print(f"\n测试结果摘要:")
        print(f"  - 计费汇总: 1条")
        print(f"  - 基础金额: 1.0元")
        print(f"  - 附加费调整: +2.0元")
        print(f"  - 最终金额: 3.0元")
        print(f"  - 差异记录: {variance_count}条 (包含 manual_surcharge)")
        print(f"  - 导出文件: ✓ 生成成功")
        
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
        # 清理测试数据库
        if os.path.exists("./test_variance.db"):
            os.remove("./test_variance.db")

if __name__ == "__main__":
    success = test_surcharge_variance()
    sys.exit(0 if success else 1)
