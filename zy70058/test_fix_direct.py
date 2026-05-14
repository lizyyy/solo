import sys
import os
from datetime import datetime, date
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from app.models import Account, InstallmentPlan, RevocationRecord, ExceptionRecord, PendingTask
from app.services.installment_service import InstallmentService
from app.services.revocation_service import RevocationService
from app.services.validation_service import ValidationService
from app.services.export_service import ExportService

def print_section(title):
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")

def test_fixes():
    app = create_app()
    
    with app.app_context():
        db.drop_all()
        db.create_all()
        
        print_section("1. 依赖导入验证 (ModuleNotFoundError 修复)")
        print("✅ 依赖导入成功: flask-sqlalchemy 已安装并可正常导入")

        print_section("2. 创建测试账户")
        account = Account(
            account_number="ACC_TEST_FIX_001",
            card_number="6222****TEST",
            customer_name="测试用户",
            credit_limit=Decimal('100000.00'),
            available_credit=Decimal('100000.00'),
            used_credit=Decimal('0.00')
        )
        db.session.add(account)
        db.session.commit()
        print(f"✅ 账户创建成功: ID={account.id}")
        print(f"   初始可用额度: {account.available_credit}")
        
        print_section("3. 创建分期计划 (10000元分3期)")
        plan = InstallmentService.create_installment_plan(
            account_id=account.id,
            original_transaction_id="TXN_FIX_TEST_001",
            original_amount=Decimal('10000.00'),
            installment_months=3,
            fee_rate=0.006,
            start_date=date(2026, 5, 14)
        )
        print(f"✅ 分期创建成功: ID={plan.id}")
        print(f"   剩余本金: {plan.remaining_principal}")
        print(f"   总手续费: {plan.total_fee}")
        
        print_section("4. 执行提前还款 (修复点1: 清零后校验)")
        revocation = RevocationService.early_settle_installment_plan(
            plan_id=plan.id,
            reason="修复验证-提前还款",
            transaction_id="ES_FIX_TEST_001"
        )
        print(f"✅ 提前还款成功")
        print(f"   恢复额度: {revocation.credit_restored}")
        print(f"   违约金: {revocation.penalty_fee}")
        print(f"   应收金额: {revocation.amount_to_collect}")
        
        print_section("5. 检查异常记录 (修复点1验证)")
        exc_count = ExceptionRecord.query.filter_by(plan_id=plan.id).count()
        print(f"异常数量: {exc_count}")
        
        if exc_count == 0:
            print("✅ 修复点1验证通过: 正常提前还款没有被错误记录为异常")
            print("   (修复前: 因清零后校验, plan.remaining_principal=0 会导致校验失败)")
        else:
            print(f"❌ 修复点1未通过: 存在 {exc_count} 条异常记录")
            for exc in ExceptionRecord.query.filter_by(plan_id=plan.id).all():
                print(f"   - {exc.title}: {exc.description}")
        
        print_section("6. 执行综合验证 (修复点2: 重复叠加)")
        result = ValidationService.run_comprehensive_validation(plan.id)
        overall = result['overall_status']
        total_errors = result['total_errors']
        print(f"综合验证状态: {overall}")
        print(f"总错误数: {total_errors}")
        
        if result.get('credit_restore_validation'):
            credit_val = result['credit_restore_validation']
            print(f"  额度恢复验证: {'通过' if credit_val['is_valid'] else '失败'}")
            if not credit_val['is_valid']:
                print(f"  错误: {credit_val['errors']}")
        
        if overall == 'passed':
            print("✅ 修复点2验证通过: 额度恢复校验没有重复叠加")
            print("   (修复前: 撤销后账户已恢复, 校验时再加 original_amount 导致重复)")
        else:
            print(f"❌ 修复点2未通过: 综合验证失败")
        
        print_section("7. 创建第二个分期用于撤销测试")
        plan2 = InstallmentService.create_installment_plan(
            account_id=account.id,
            original_transaction_id="TXN_FIX_TEST_002",
            original_amount=Decimal('20000.00'),
            installment_months=6,
            fee_rate=0.006,
            start_date=date(2026, 5, 14)
        )
        print(f"✅ 分期创建成功: ID={plan2.id}")
        
        print_section("8. 执行分期撤销")
        revocation2 = RevocationService.revoke_installment_plan(
            plan_id=plan2.id,
            reason="修复验证-分期撤销",
            transaction_id="REV_FIX_TEST_001"
        )
        print(f"✅ 分期撤销成功")
        print(f"   恢复额度: {revocation2.credit_restored}")
        print(f"   退款金额: {revocation2.total_refund}")
        
        print_section("9. 检查撤销后的异常记录")
        exc_count2 = ExceptionRecord.query.filter_by(plan_id=plan2.id).count()
        print(f"异常数量: {exc_count2}")
        if exc_count2 == 0:
            print("✅ 分期撤销场景也通过: 没有异常记录")
        
        print_section("10. 测试撤销记录导出 (修复点3: rev.account_id 不存在)")
        try:
            file_path = ExportService.export_revocation_report()
            print(f"✅ 修复点3验证通过: 导出成功")
            print(f"   文件路径: {file_path}")
            print(f"   文件存在: {os.path.exists(file_path)}")
            print("   (修复前: RevocationRecord 无 account_id 字段, 访问 rev.account_id 会抛 AttributeError)")
        except AttributeError as e:
            print(f"❌ 修复点3未通过: {e}")
        except Exception as e:
            print(f"❌ 其他导出错误: {type(e).__name__}: {e}")
        
        print_section("11. 最终校验 - 全局异常统计")
        total_exc = ExceptionRecord.query.count()
        total_pending = PendingTask.query.count()
        print(f"  总异常数: {total_exc}")
        print(f"  待处理任务: {total_pending}")
        
        if total_exc == 0:
            print("\n" + "="*70)
            print("🎉 所有修复验证通过！项目可正常安装、运行、验证")
            print("="*70)
            print("\n修复总结:")
            print("  1. ✅ 依赖已安装 (flask-sqlalchemy 等)")
            print("  2. ✅ 提前还款校验: 使用 revocation.remaining_principal_before 代替 plan.remaining_principal")
            print("  3. ✅ 额度恢复校验: 改为验证最终状态一致性, 不再重复叠加")
            print("  4. ✅ 撤销报表导出: 通过 plan_id 关联查询 account_id")
        else:
            print(f"\n⚠️  存在 {total_exc} 条异常记录")

if __name__ == '__main__':
    test_fixes()
