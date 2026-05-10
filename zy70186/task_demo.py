#!/usr/bin/env python3
"""
后台任务和补偿机制演示脚本
说明任务失败和再次执行的表现
"""
import sys
sys.path.insert(0, '.')

from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.database import SessionLocal, engine, Base
from app.models import (
    Contract, DepositAccount, DepositTransaction, 
    ReleaseCondition, PenaltyApproval, BackgroundTask,
    ContractStatus, DepositStatus, TransactionType, TransactionStatus,
    ApprovalStatus
)
from app.schemas import (
    ContractCreate, DepositRequest, ReleaseRequest,
    PenaltyApplyRequest, ReleaseConditionCreate
)
from app.services import (
    ContractService, DepositService, ReleaseConditionService,
    PenaltyService, TaskService, ReportService, BusinessException
)


def simulate_failed_transaction(db: Session, contract):
    """模拟一个失败的交易"""
    print("\n=== 模拟失败交易场景 ===")
    
    account = contract.deposit_account
    print(f"初始状态: 余额 {account.current_balance}, 版本 {account.version}")
    
    failed_transaction = DepositTransaction(
        transaction_no=ContractService.generate_no("TX"),
        contract_id=contract.id,
        account_id=account.id,
        transaction_type=TransactionType.RELEASE,
        amount=10000.00,
        status=TransactionStatus.FAILED,
        idempotent_key=f"FAILED_{datetime.now().strftime('%Y%m%d%H%M%S')}",
        error_message="模拟的失败: 银行系统临时不可用",
        retry_count=2,
        max_retry=3,
        processed_at=datetime.utcnow()
    )
    db.add(failed_transaction)
    db.commit()
    
    print(f"已创建失败交易: {failed_transaction.transaction_no}")
    print(f"  状态: {failed_transaction.status}")
    print(f"  错误: {failed_transaction.error_message}")
    print(f"  重试次数: {failed_transaction.retry_count}/{failed_transaction.max_retry}")
    
    return failed_transaction


def create_compensation_task(db: Session, failed_transaction):
    """创建补偿任务"""
    print("\n=== 创建后台补偿任务 ===")
    
    task = TaskService.create_task(
        db,
        task_type="retry_transaction",
        related_id=failed_transaction.id,
        related_type="DepositTransaction",
        payload={
            "transaction_no": failed_transaction.transaction_no,
            "original_error": failed_transaction.error_message,
            "attempt_at": datetime.now().isoformat()
        }
    )
    
    print(f"任务创建成功:")
    print(f"  任务ID: {task.task_id}")
    print(f"  任务类型: {task.task_type}")
    print(f"  状态: {task.status}")
    print(f"  重试计数: {task.retry_count}/{task.max_retry}")
    print(f"  下次执行时间: {task.next_run_at}")
    
    return task


def demonstrate_task_lifecycle(db: Session):
    """演示任务的整个生命周期"""
    print("\n" + "=" * 60)
    print("后台任务生命周期演示")
    print("=" * 60)
    
    contracts = ContractService.list_contracts(db)
    if not contracts:
        print("没有找到合同，请先运行 sample_data.py")
        return
    
    contract = contracts[0]
    
    failed_tx = simulate_failed_transaction(db, contract)
    task = create_compensation_task(db, failed_tx)
    
    print("\n=== 查看待执行任务 ===")
    pending = TaskService.get_pending_tasks(db)
    print(f"待执行任务数量: {len(pending)}")
    
    print("\n=== 第一次执行任务 (模拟失败) ===")
    task_from_db = db.query(BackgroundTask).filter(
        BackgroundTask.task_id == task.task_id
    ).first()
    
    task_from_db.status = "running"
    task_from_db.last_run_at = datetime.utcnow()
    db.commit()
    
    task_from_db.status = "failed"
    task_from_db.error_message = "第一次重试仍失败: 银行系统维护中"
    task_from_db.retry_count += 1
    task_from_db.next_run_at = datetime.utcnow() + timedelta(seconds=120)
    db.commit()
    db.refresh(task_from_db)
    
    print(f"执行后状态: {task_from_db.status}")
    print(f"错误信息: {task_from_db.error_message}")
    print(f"重试计数: {task_from_db.retry_count}/{task_from_db.max_retry}")
    print(f"下次执行时间: {task_from_db.next_run_at}")
    
    print("\n=== 手动触发重试 ===")
    retry_result = TaskService.retry_task(db, task_from_db.task_id, force=False)
    print(f"手动重试后的状态: {retry_result.status}")
    print(f"重试计数已重置: {retry_result.retry_count}")
    
    print("\n=== 模拟银行系统恢复，任务执行成功 ===")
    task_from_db = db.query(BackgroundTask).filter(
        BackgroundTask.task_id == task.task_id
    ).first()
    
    task_from_db.status = "running"
    task_from_db.last_run_at = datetime.utcnow()
    db.commit()
    
    task_from_db.status = "completed"
    task_from_db.retry_count += 1
    db.commit()
    db.refresh(task_from_db)
    
    print(f"最终状态: {task_from_db.status}")
    print(f"总重试次数: {task_from_db.retry_count}")
    
    print("\n=== 验证任务完成后不可重复执行 ===")
    try:
        TaskService.retry_task(db, task_from_db.task_id, force=False)
    except BusinessException as e:
        print(f"预期的拦截成功: {e}")
    
    print("\n=== 强制重试已完成的任务 ===")
    force_retry = TaskService.retry_task(db, task_from_db.task_id, force=True)
    print(f"强制重试后的状态: {force_retry.status}")


def demonstrate_deduct_task(db: Session):
    """演示扣罚审批的后台任务补偿"""
    print("\n" + "=" * 60)
    print("扣罚审批补偿任务演示")
    print("=" * 60)
    
    contracts = ContractService.list_contracts(db)
    if not contracts:
        print("没有找到合同")
        return
    
    contract = contracts[0]
    
    print("\n=== 步骤1: 创建扣罚申请 ===")
    apply_data = PenaltyApplyRequest(
        contract_id=contract.id,
        penalty_amount=5000.00,
        penalty_reason="安全检查不合格",
        penalty_type="安全扣罚",
        contract_node="施工现场",
        applicant="安全员-周八"
    )
    approval = PenaltyService.apply_penalty(db, apply_data)
    print(f"扣罚申请: {approval.approval_no}, 金额: {approval.penalty_amount}")
    
    print("\n=== 步骤2: 审批通过 (假设扣罚执行时失败) ===")
    approval.status = ApprovalStatus.APPROVED
    approval.approver = "财务总监"
    approval.approval_time = datetime.utcnow()
    db.commit()
    
    print("\n=== 步骤3: 创建扣罚补偿任务 ===")
    task = TaskService.create_task(
        db,
        task_type="retry_deduct",
        related_id=approval.id,
        related_type="PenaltyApproval"
    )
    print(f"补偿任务: {task.task_id}")
    
    print("\n=== 步骤4: 执行调度器 ===")
    result = TaskService.run_scheduler_once(db)
    print(f"调度执行结果: {result}")
    
    db.refresh(approval)
    if approval.transaction_id:
        print(f"扣罚执行成功，交易ID: {approval.transaction_id}")
        account = contract.deposit_account
        db.refresh(account)
        print(f"账户余额: {account.current_balance}, 已扣罚: {account.deducted_amount}")
    else:
        print(f"扣罚未执行，仍需补偿")


def main():
    print("=" * 60)
    print("后台任务和补偿机制演示")
    print("=" * 60)
    print("""
任务状态说明:
- pending: 待执行，等待调度器
- running: 正在执行中
- completed: 执行成功
- failed: 执行失败，等待重试
- exhausted: 已达最大重试次数，需要人工介入

重试策略:
- 默认最大重试5次
- 指数退避: 第1次失败后等2分钟，第2次等4分钟，最多1小时
- 可使用 force=true 强制重试已耗尽的任务

用户无需清库重来的场景:
1. 网络超时导致的部分成功 - 通过幂等键查询，返回已有结果
2. 银行系统维护 - 创建后台任务，系统自动重试
3. 审批通过但扣罚失败 - 补偿任务会自动执行扣罚
4. 并发操作导致版本冲突 - 返回错误，用户可重新提交
""")
    
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        demonstrate_task_lifecycle(db)
        demonstrate_deduct_task(db)
        
        print("\n" + "=" * 60)
        print("后台任务演示完成！")
        print("=" * 60)
        
    finally:
        db.close()


if __name__ == "__main__":
    main()
