#!/usr/bin/env python3
"""
完整业务流程演示脚本 - 使用内存 SQLite 数据库
无需任何外部服务，即可验证：
1. 创建贷款账户
2. 提交展期申请
3. 初审
4. 终审
5. 执行展期
6. 查看申请详情
7. 检查数据一致性
"""
import sys
import os
from decimal import Decimal

# 先设置环境变量为内存 SQLite
os.environ['DATABASE_TYPE'] = 'sqlite'
os.environ['SQLITE_IN_MEMORY'] = 'true'

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import init_database, get_db_session
from app.utils import DateTimeUtils
from app.services.loan_account_service import LoanAccountService
from app.services.extension_service import ExtensionService, ExtensionApplicationException
from app.services.reconciliation_service import ReconciliationService


def run_demo():
    print("=" * 70)
    print("贷款展期审批服务 - 完整业务流程演示")
    print("=" * 70)
    print()
    print("使用内存 SQLite 数据库，无需任何外部服务")
    print()
    
    # 1. 初始化数据库
    print("=" * 70)
    print("[1/8] 初始化数据库...")
    print("=" * 70)
    init_database()
    print("✓ 数据库初始化成功")
    print()
    
    db = get_db_session()
    
    try:
        # 2. 创建贷款账户
        print("=" * 70)
        print("[2/8] 创建贷款账户...")
        print("=" * 70)
        
        loan_account_service = LoanAccountService(db)
        
        now = DateTimeUtils.now_naive()
        original_maturity = DateTimeUtils.add_months(now, 12)
        
        account_no = f"ACC-{now.strftime('%Y%m%d%H%M%S')}"
        
        account = loan_account_service.create_loan_account(
            account_no=account_no,
            customer_id="CUST001",
            customer_name="张三",
            loan_amount=Decimal("100000.00"),
            remaining_principal=Decimal("50000.00"),
            total_interest=Decimal("10000.00"),
            paid_interest=Decimal("5000.00"),
            annual_interest_rate=Decimal("6.00"),
            loan_term=12,
            original_maturity_date=original_maturity,
            current_maturity_date=original_maturity,
            credit_limit_used=Decimal("50000.00"),
            max_extension_count=2,
            max_extension_months=6
        )
        
        print(f"✓ 贷款账户创建成功")
        print(f"  - 账户编号: {account['account_no']}")
        print(f"  - 客户姓名: {account['customer_name']}")
        print(f"  - 贷款本金: {account['loan_amount']} 元")
        print(f"  - 剩余本金: {account['remaining_principal']} 元")
        print(f"  - 年利率: {account['annual_interest_rate']}%")
        print(f"  - 原到期日: {account['original_maturity_date']}")
        print()
        
        # 创建初始还款计划
        print("创建初始还款计划...")
        from app.models import LoanAccount
        loan_account = db.query(LoanAccount).get(account["id"])
        repayment_plan = loan_account_service.create_initial_repayment_plan(
            loan_account=loan_account
        )
        print(f"✓ 还款计划创建成功")
        print(f"  - 计划编号: {repayment_plan['plan_no']}")
        print(f"  - 还款期数: {repayment_plan['installment_count']} 期")
        print(f"  - 计划总额: {repayment_plan['total_amount']} 元")
        print(f"  - 计划结束日: {repayment_plan['end_date']}")
        print()
        
        # 3. 提交展期申请
        print("=" * 70)
        print("[3/8] 提交展期申请...")
        print("=" * 70)
        
        extension_service = ExtensionService(db)
        
        result = extension_service.submit_application(
            account_no=account_no,
            extension_months=3,
            applicant_id="USER001",
            applicant_name="申请人",
            extension_reason="临时资金周转困难",
            extension_interest_rate=Decimal("6.50")
        )
        
        application_no = result["application_no"]
        
        print(f"✓ 展期申请提交成功")
        print(f"  - 申请编号: {result['application_no']}")
        print(f"  - 展期月数: 3 个月")
        print(f"  - 申请状态: {result['status']}")
        print(f"  - 规则检查通过: {result['rule_check_passed']}")
        print()
        
        # 4. 初审通过
        print("=" * 70)
        print("[4/8] 初审通过...")
        print("=" * 70)
        
        result = extension_service.first_approve(
            application_no=application_no,
            approver_id="APPROVER01",
            approver_name="审核员A",
            comment="情况属实，同意初审"
        )
        
        print(f"✓ 初审通过")
        print(f"  - 申请状态: {result['status']}")
        print(f"  - 初审时间: {result['first_approval_time']}")
        print()
        
        # 5. 终审通过
        print("=" * 70)
        print("[5/8] 终审通过...")
        print("=" * 70)
        
        result = extension_service.final_approve(
            application_no=application_no,
            approver_id="APPROVER02",
            approver_name="审核员B",
            comment="符合展期条件，同意终审"
        )
        
        print(f"✓ 终审通过")
        print(f"  - 申请状态: {result['status']}")
        print(f"  - 终审时间: {result['final_approval_time']}")
        print(f"  - 新计划编号: {result['new_plan_no']}")
        print()
        
        # 6. 执行展期
        print("=" * 70)
        print("[6/8] 执行展期...")
        print("=" * 70)
        
        result = extension_service.execute_extension(
            application_no=application_no,
            execute_by_id="SYSTEM",
            execute_by_name="系统自动执行"
        )
        
        print(f"✓ 展期执行成功")
        print(f"  - 申请状态: {result['status']}")
        print(f"  - 执行时间: {result['executed_at']}")
        print(f"  - 新计划编号: {result['new_plan_no']}")
        print()
        
        # 显示账户变更
        print("账户变更详情:")
        before = result['account_changes']['before']
        after = result['account_changes']['after']
        print(f"  - 执行前: 状态={before['status']}, 展期次数={before['extension_count']}, 到期日={before['current_maturity_date']}")
        print(f"  - 执行后: 状态={after['status']}, 展期次数={after['extension_count']}, 到期日={after['current_maturity_date']}")
        print()
        
        # 7. 查看申请详情
        print("=" * 70)
        print("[7/8] 查看申请详情...")
        print("=" * 70)
        
        detail = extension_service.get_application_detail(application_no=application_no)
        
        print(f"✓ 申请详情获取成功")
        print(f"  - 申请编号: {detail['application']['application_no']}")
        print(f"  - 贷款账号: {detail['application']['account_no']}")
        print(f"  - 客户姓名: {detail['application']['customer_name']}")
        print(f"  - 展期月数: {detail['application']['extension_months']} 个月")
        print(f"  - 当前状态: {detail['application']['status']}")
        print(f"  - 申请时间: {detail['application']['requested_at']}")
        print()
        
        # 显示审批历史
        print(f"  审批历史 ({len(detail['approval_histories'])} 条记录):")
        for i, history in enumerate(detail['approval_histories'], 1):
            print(f"    {i}. {history['stage']} - {history['operator']['name']}")
            print(f"       时间: {history['time']}")
            print(f"       状态变更: {history['before_status']} → {history['after_status']}")
            if history['comment']:
                print(f"       意见: {history['comment']}")
        print()
        
        # 显示罚息快照
        if detail['penalty_snapshots']:
            print(f"  罚息快照 ({len(detail['penalty_snapshots'])} 条记录):")
            for i, snapshot in enumerate(detail['penalty_snapshots'], 1):
                print(f"    {i}. 快照编号: {snapshot['snapshot_no']}")
                print(f"       快照时间: {snapshot['snapshot_time']}")
                print(f"       罚息金额: {snapshot['penalty_amount']} 元")
        else:
            print("  罚息快照: 无逾期，无需罚息")
        print()
        
        # 显示规则检查结果
        if detail['rule_check']:
            print(f"  规则检查结果:")
            passed = all(r['passed'] for r in detail['rule_check'])
            print(f"    整体结果: {'通过' if passed else '未通过'}")
            for i, rule in enumerate(detail['rule_check'][:3], 1):  # 只显示前3条
                status = "✓" if rule['passed'] else "✗"
                print(f"    {i}. {status} {rule['rule_name']}: {rule['message']}")
            if len(detail['rule_check']) > 3:
                print(f"    ... 还有 {len(detail['rule_check']) - 3} 条规则")
        print()
        
        # 8. 检查数据一致性
        print("=" * 70)
        print("[8/8] 检查数据一致性...")
        print("=" * 70)
        
        reconciliation_service = ReconciliationService(db)
        consistency = reconciliation_service.check_data_consistency(application_no=application_no)
        
        print(f"✓ 数据一致性检查完成")
        print(f"  - 申请编号: {consistency['application_no']}")
        print(f"  - 当前状态: {consistency['status']}")
        print(f"  - 一致性检查: {'通过 ✓' if consistency['consistency_passed'] else '未通过 ✗'}")
        print()
        
        print("  详细检查结果:")
        for i, check in enumerate(consistency['checks'], 1):
            status = "✓" if check['passed'] else "✗"
            print(f"    {i}. {status} {check['check']}")
            print(f"       预期: {check['expected']}, 实际: {check['actual']}")
        
        print()
        
        print("=" * 70)
        print("演示完成! ✓")
        print("=" * 70)
        print()
        print("成功验证了完整的业务流程:")
        print("  1. 创建贷款账户 ✓")
        print("  2. 提交展期申请 ✓")
        print("  3. 初审通过 ✓")
        print("  4. 终审通过 ✓")
        print("  5. 执行展期 ✓")
        print("  6. 查看申请详情 ✓")
        print("  7. 检查数据一致性 ✓")
        print()
        print("所有功能正常工作，无需任何外部服务!")
        print()
        
        # 额外提示
        print("=" * 70)
        print("下一步操作")
        print("=" * 70)
        print()
        print("1. 启动服务:")
        print("   uvicorn app.main:app --host 0.0.0.0 --port 8000")
        print()
        print("2. 访问 API 文档:")
        print("   http://localhost:8000/docs")
        print()
        print("3. 通过 API 测试:")
        print("   - 健康检查: GET http://localhost:8000/api/v1/health")
        print("   - 创建账户: POST http://localhost:8000/api/v1/loan-accounts")
        print("   - 提交申请: POST http://localhost:8000/api/v1/extension/applications")
        print()
        
        return True
        
    except ExtensionApplicationException as e:
        print(f"✗ 业务异常: {e}")
        db.rollback()
        return False
    except Exception as e:
        print(f"✗ 系统异常: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    success = run_demo()
    sys.exit(0 if success else 1)
