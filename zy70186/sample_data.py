#!/usr/bin/env python3
"""
样例数据脚本 - 用于演示系统的各种场景
覆盖：正常处理、异常拦截、重复操作
"""
import sys
sys.path.insert(0, '.')

from datetime import datetime
from sqlalchemy.orm import Session

from app.database import SessionLocal, engine, Base
from app.models import (
    Contract, DepositAccount, DepositTransaction, 
    ReleaseCondition, PaymentReceipt, BalanceSnapshot,
    ContractStatus, DepositStatus, TransactionType, TransactionStatus
)
from app.schemas import (
    ContractCreate, DepositRequest, ReleaseRequest,
    PenaltyApplyRequest, PenaltyApprovalRequest, ReleaseConditionCreate
)
from app.services import (
    ContractService, DepositService, ReleaseConditionService,
    PenaltyService, ReportService, BusinessException
)


def create_sample_contracts(db: Session):
    """创建样例合同"""
    print("\n=== 创建样例合同 ===")
    
    contract1_data = ContractCreate(
        contract_no="HT20260510001",
        contract_name="办公楼装修工程合同",
        party_a="XX集团有限公司",
        party_b="YY建筑工程有限公司",
        total_amount=5000000.00,
        deposit_rate=0.05,
        required_deposit_amount=250000.00,
        status=ContractStatus.ACTIVE,
        sign_date=datetime(2026, 5, 1),
        start_date=datetime(2026, 5, 10),
        end_date=datetime(2026, 11, 10)
    )
    contract1 = ContractService.create_contract(db, contract1_data)
    print(f"合同1创建成功: {contract1.contract_no} - {contract1.contract_name}")
    
    contract2_data = ContractCreate(
        contract_no="HT20260510002",
        contract_name="软件开发服务合同",
        party_a="ZZ科技公司",
        party_b="AA软件工作室",
        total_amount=1000000.00,
        deposit_rate=0.10,
        required_deposit_amount=100000.00,
        status=ContractStatus.ACTIVE,
        sign_date=datetime(2026, 5, 5),
        start_date=datetime(2026, 5, 15)
    )
    contract2 = ContractService.create_contract(db, contract2_data)
    print(f"合同2创建成功: {contract2.contract_no} - {contract2.contract_name}")
    
    return [contract1, contract2]


def create_release_conditions(db: Session, contracts):
    """为合同创建释放条件"""
    print("\n=== 创建释放条件 ===")
    
    for contract in contracts:
        account = contract.deposit_account
        if not account:
            continue
            
        conditions = [
            ReleaseConditionCreate(
                account_id=account.id,
                condition_name="进场验收通过",
                description="施工队进场并通过验收",
                release_amount=account.required_amount * 0.3,
                contract_node="进场节点",
                sort_order=1
            ),
            ReleaseConditionCreate(
                account_id=account.id,
                condition_name="中期进度款支付",
                description="工程进度达到50%",
                release_amount=account.required_amount * 0.3,
                contract_node="中期节点",
                sort_order=2
            ),
            ReleaseConditionCreate(
                account_id=account.id,
                condition_name="竣工验收通过",
                description="工程竣工验收合格",
                release_amount=account.required_amount * 0.4,
                contract_node="竣工验收节点",
                sort_order=3
            )
        ]
        
        for cond_data in conditions:
            cond = ReleaseConditionService.create_condition(db, cond_data)
            print(f"释放条件创建: {cond.condition_name} (金额: {cond.release_amount})")


def scenario_normal_deposit(db: Session, contract):
    """场景1: 正常缴纳保证金"""
    print("\n=== 场景1: 正常缴纳保证金 ===")
    
    account = contract.deposit_account
    print(f"缴纳前 - 账户状态: {account.status}, 余额: {account.current_balance}")
    
    deposit_data = DepositRequest(
        idempotent_key=f"DEP_{contract.contract_no}_20260510_001",
        contract_id=contract.id,
        amount=250000.00,
        reference_no="BANK202605100001",
        operator="财务-张三",
        payment_method="银行转账",
        bank_name="工商银行",
        bank_account="622202******1234",
        payer_name="YY建筑工程有限公司",
        payment_date=datetime.now()
    )
    
    result = DepositService.process_deposit(db, deposit_data)
    print(f"缴纳结果: {result['message']}, 重复: {result['is_duplicate']}")
    
    db.refresh(account)
    print(f"缴纳后 - 账户状态: {account.status}, 已缴: {account.paid_amount}, 余额: {account.current_balance}")
    
    snapshots = contract.snapshots
    print(f"余额快照数量: {len(snapshots)}")


def scenario_duplicate_deposit(db: Session, contract):
    """场景2: 重复提交缴纳请求（幂等性测试）"""
    print("\n=== 场景2: 重复提交缴纳请求（幂等性） ===")
    
    deposit_data = DepositRequest(
        idempotent_key=f"DEP_{contract.contract_no}_20260510_001",
        contract_id=contract.id,
        amount=250000.00,
        reference_no="BANK202605100001",
        operator="财务-张三",
        payment_method="银行转账"
    )
    
    result = DepositService.process_deposit(db, deposit_data)
    print(f"重复提交结果: {result['message']}, 重复: {result['is_duplicate']}")
    print(f"交易状态: {result['transaction'].status}")
    
    account = contract.deposit_account
    db.refresh(account)
    print(f"账户余额验证: {account.current_balance} (应仍为 250000)")


def scenario_exception_insufficient_balance(db: Session, contract):
    """场景3: 异常拦截 - 释放金额超过余额"""
    print("\n=== 场景3: 异常拦截 - 释放金额超过余额 ===")
    
    try:
        release_data = ReleaseRequest(
            idempotent_key=f"REL_{contract.contract_no}_20260510_001",
            contract_id=contract.id,
            amount=500000.00,
            operator="财务-李四",
            remarks="合同中期进度款释放"
        )
        
        result = DepositService.process_release(db, release_data)
        print(f"释放结果: {result}")
    except BusinessException as e:
        print(f"预期的异常拦截成功: {e}")


def scenario_normal_release(db: Session, contract):
    """场景4: 正常释放保证金（需先满足条件）"""
    print("\n=== 场景4: 正常释放保证金 ===")
    
    account = contract.deposit_account
    conditions = ReleaseConditionService.list_by_account(db, account.id)
    
    first_condition = conditions[0]
    print(f"满足条件前: {first_condition.condition_name} - is_met={first_condition.is_met}")
    
    ReleaseConditionService.meet_condition(db, first_condition.id, met_by="监理-王五")
    db.refresh(first_condition)
    print(f"满足条件后: {first_condition.condition_name} - is_met={first_condition.is_met}")
    
    release_data = ReleaseRequest(
        idempotent_key=f"REL_{contract.contract_no}_20260510_002",
        contract_id=contract.id,
        amount=first_condition.release_amount,
        reference_no=f"REL_{contract.contract_no}_001",
        operator="财务-李四",
        release_condition_id=first_condition.id,
        remarks="进场验收通过，释放30%保证金"
    )
    
    result = DepositService.process_release(db, release_data)
    print(f"释放结果: {result['message']}")
    
    db.refresh(account)
    print(f"释放后 - 账户状态: {account.status}, 已释放: {account.released_amount}, 余额: {account.current_balance}")


def scenario_penalty_approval(db: Session, contract):
    """场景5: 扣罚审批流程"""
    print("\n=== 场景5: 扣罚审批流程 ===")
    
    apply_data = PenaltyApplyRequest(
        contract_id=contract.id,
        penalty_amount=20000.00,
        penalty_reason="工程质量问题，违反合同第15条规定",
        penalty_type="质量扣罚",
        contract_node="施工过程中",
        applicant="项目经理-赵六",
        idempotent_key=f"PEN_{contract.contract_no}_20260510_001"
    )
    
    approval = PenaltyService.apply_penalty(db, apply_data)
    print(f"扣罚申请创建: {approval.approval_no}, 金额: {approval.penalty_amount}")
    
    pending = PenaltyService.list_pending(db)
    print(f"待审批数量: {len(pending)}")
    
    approve_data = PenaltyApprovalRequest(
        approval_no=approval.approval_no,
        action="approve",
        approver="财务总监-孙七",
        idempotent_key=f"APP_{approval.approval_no}"
    )
    
    result = PenaltyService.process_approval(db, approve_data)
    print(f"审批结果: {result['message']}")
    
    account = contract.deposit_account
    db.refresh(account)
    print(f"扣罚后 - 已扣罚: {account.deducted_amount}, 余额: {account.current_balance}")


def scenario_contract_report(db: Session, contract):
    """场景6: 合同报表"""
    print("\n=== 场景6: 合同报表 ===")
    
    report = ReportService.get_contract_report(db, contract.id)
    print(f"合同: {report['contract_no']} - {report['contract_name']}")
    print(f"  应缴: {report['required_deposit_amount']}")
    print(f"  已缴: {report['paid_amount']}")
    print(f"  已释放: {report['released_amount']}")
    print(f"  已扣罚: {report['deducted_amount']}")
    print(f"  当前余额: {report['current_balance']}")
    print(f"  账户状态: {report['deposit_status']}")
    print(f"  待满足释放条件: {report['pending_release_conditions']}")
    print(f"  总交易数: {report['total_transactions']}")


def scenario_exception_wrong_contract_status(db: Session):
    """场景7: 异常拦截 - 合同状态不允许缴纳"""
    print("\n=== 场景7: 异常拦截 - 合同状态不允许 ===")
    
    from app.schemas import ContractUpdate
    
    contracts = ContractService.list_contracts(db)
    if len(contracts) < 2:
        print("需要至少2个合同进行测试")
        return
    
    contract2 = contracts[1]
    ContractService.update_contract(db, contract2.id, ContractUpdate(status=ContractStatus.DRAFT))
    db.refresh(contract2)
    
    try:
        deposit_data = DepositRequest(
            idempotent_key=f"DEP_{contract2.contract_no}_20260510_001",
            contract_id=contract2.id,
            amount=100000.00,
            operator="财务-张三"
        )
        
        DepositService.process_deposit(db, deposit_data)
    except BusinessException as e:
        print(f"预期的异常拦截成功: {e}")
    
    ContractService.update_contract(db, contract2.id, ContractUpdate(status=ContractStatus.ACTIVE))


def main():
    print("=" * 60)
    print("合同履约保证金 API - 样例数据演示")
    print("=" * 60)
    
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        contracts = create_sample_contracts(db)
        create_release_conditions(db, contracts)
        
        if contracts:
            contract1 = contracts[0]
            
            scenario_normal_deposit(db, contract1)
            scenario_duplicate_deposit(db, contract1)
            scenario_exception_insufficient_balance(db, contract1)
            scenario_normal_release(db, contract1)
            scenario_penalty_approval(db, contract1)
            scenario_contract_report(db, contract1)
            scenario_exception_wrong_contract_status(db)
        
        print("\n" + "=" * 60)
        print("所有场景演示完成！")
        print("=" * 60)
        
    finally:
        db.close()


if __name__ == "__main__":
    main()
