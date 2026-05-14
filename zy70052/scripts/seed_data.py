#!/usr/bin/env python3
"""
种子数据脚本 - 用于快速创建测试数据
"""
import sys
import os
from datetime import datetime, timedelta
from decimal import Decimal

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_db_session
from app.models import LoanAccount
from app.services.loan_account_service import LoanAccountService
from app.utils import DateTimeUtils


def create_sample_loan_account():
    """创建一个示例贷款账户"""
    db = get_db_session()
    
    try:
        service = LoanAccountService(db)
        
        now = DateTimeUtils.now_naive()
        original_maturity = DateTimeUtils.add_months(now, 12)
        
        account = service.create_loan_account(
            account_no=f"ACC-{now.strftime('%Y%m%d%H%M%S')}",
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
        
        loan_account = db.query(LoanAccount).get(account["id"])
        repayment_plan = service.create_initial_repayment_plan(loan_account=loan_account)
        
        print("✓ 成功创建测试贷款账户")
        print(f"  账户编号: {account['account_no']}")
        print(f"  客户姓名: {account['customer_name']}")
        print(f"  贷款本金: {account['loan_amount']}")
        print(f"  剩余本金: {account['remaining_principal']}")
        print(f"  年利率: {account['annual_interest_rate']}%")
        print(f"  还款计划编号: {repayment_plan['plan_no']}")
        print(f"  还款期数: {repayment_plan['installment_count']}")
        print(f"  计划总额: {repayment_plan['total_amount']}")
        
        return account, repayment_plan
        
    except Exception as e:
        print(f"✗ 创建失败: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return None
    finally:
        db.close()


def main():
    print("=" * 50)
    print("贷款展期审批服务 - 种子数据脚本")
    print("=" * 50)
    print()
    
    print("正在创建示例贷款账户...")
    result = create_sample_loan_account()
    
    if result:
        account, plan = result
        print()
        print("=" * 50)
        print("快速验证流程:")
        print("=" * 50)
        print()
        print(f"1. 提交展期申请:")
        print(f'   curl -X POST "http://localhost:8000/api/v1/extension/applications?account_no={account["account_no"]}&extension_months=3&applicant_id=USER001&applicant_name=申请人"')
        print()
        print("2. 查看返回的 application_no，然后执行初审:")
        print('   curl -X POST "http://localhost:8000/api/v1/extension/applications/<APPLICATION_NO>/first-approve?approver_id=APPROVER01&approver_name=审核员A"')
        print()
        print("3. 终审:")
        print('   curl -X POST "http://localhost:8000/api/v1/extension/applications/<APPLICATION_NO>/final-approve?approver_id=APPROVER02&approver_name=审核员B"')
        print()
        print("4. 执行展期:")
        print('   curl -X POST "http://localhost:8000/api/v1/extension/applications/<APPLICATION_NO>/execute"')
        print()
        print("5. 查看申请详情:")
        print('   curl -X GET "http://localhost:8000/api/v1/extension/applications/<APPLICATION_NO>"')
        print()


if __name__ == "__main__":
    main()
