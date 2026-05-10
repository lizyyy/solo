from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import uuid
import json

from app.models import (
    Contract, DepositAccount, DepositTransaction, PaymentReceipt,
    ReleaseCondition, PenaltyApproval, BalanceSnapshot, BackgroundTask,
    ContractStatus, DepositStatus, TransactionType, TransactionStatus,
    ApprovalStatus
)
from app.schemas import (
    ContractCreate, ContractUpdate, DepositRequest, ReleaseRequest,
    PenaltyApplyRequest, PenaltyApprovalRequest, ReleaseConditionCreate
)


class BusinessException(Exception):
    pass


class ContractService:
    
    @staticmethod
    def generate_no(prefix: str) -> str:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        suffix = uuid.uuid4().hex[:6].upper()
        return f"{prefix}{timestamp}{suffix}"
    
    @staticmethod
    def create_contract(db: Session, data: ContractCreate) -> Contract:
        existing = db.query(Contract).filter(
            Contract.contract_no == data.contract_no
        ).first()
        if existing:
            raise BusinessException(f"合同编号 {data.contract_no} 已存在")
        
        contract = Contract(**data.dict())
        db.add(contract)
        db.flush()
        
        account = DepositAccount(
            contract_id=contract.id,
            account_no=ContractService.generate_no("DA"),
            required_amount=data.required_deposit_amount,
            status=DepositStatus.PENDING_PAYMENT,
            version=1
        )
        db.add(account)
        db.commit()
        db.refresh(contract)
        return contract
    
    @staticmethod
    def update_contract(db: Session, contract_id: int, data: ContractUpdate) -> Contract:
        contract = db.query(Contract).filter(Contract.id == contract_id).first()
        if not contract:
            raise BusinessException(f"合同不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(contract, key, value)
        
        if "required_deposit_amount" in update_data and contract.deposit_account:
            contract.deposit_account.required_amount = update_data["required_deposit_amount"]
        
        db.commit()
        db.refresh(contract)
        return contract
    
    @staticmethod
    def get_contract(db: Session, contract_id: int) -> Optional[Contract]:
        return db.query(Contract).filter(Contract.id == contract_id).first()
    
    @staticmethod
    def list_contracts(db: Session) -> List[Contract]:
        return db.query(Contract).order_by(Contract.created_at.desc()).all()


class DepositService:
    
    @staticmethod
    def check_idempotency(db: Session, idempotent_key: str) -> Optional[DepositTransaction]:
        return db.query(DepositTransaction).filter(
            DepositTransaction.idempotent_key == idempotent_key
        ).first()
    
    @staticmethod
    def _calculate_account_status(account: DepositAccount) -> DepositStatus:
        if account.current_balance <= 0:
            if account.released_amount >= account.required_amount:
                return DepositStatus.RELEASED
            elif account.released_amount > 0:
                return DepositStatus.PARTIALLY_RELEASED
        
        if account.paid_amount >= account.required_amount:
            if account.released_amount > 0 or account.deducted_amount > 0:
                return DepositStatus.PARTIALLY_RELEASED
            return DepositStatus.FULLY_PAID
        elif account.paid_amount > 0:
            return DepositStatus.PARTIALLY_PAID
        
        return DepositStatus.PENDING_PAYMENT
    
    @staticmethod
    def _create_snapshot(
        db: Session, 
        account: DepositAccount, 
        snapshot_type: str, 
        reference_transaction_id: Optional[int] = None,
        taken_by: Optional[str] = None
    ) -> BalanceSnapshot:
        snapshot = BalanceSnapshot(
            snapshot_no=ContractService.generate_no("SS"),
            contract_id=account.contract_id,
            account_id=account.id,
            required_amount=account.required_amount,
            paid_amount=account.paid_amount,
            released_amount=account.released_amount,
            deducted_amount=account.deducted_amount,
            current_balance=account.current_balance,
            snapshot_type=snapshot_type,
            reference_transaction_id=reference_transaction_id,
            taken_by=taken_by
        )
        db.add(snapshot)
        return snapshot
    
    @staticmethod
    def process_deposit(db: Session, data: DepositRequest) -> Dict[str, Any]:
        existing = DepositService.check_idempotency(db, data.idempotent_key)
        if existing:
            return {
                "success": existing.status == TransactionStatus.SUCCESS,
                "message": "重复请求，返回已有结果",
                "is_duplicate": True,
                "transaction": existing
            }
        
        contract = db.query(Contract).filter(Contract.id == data.contract_id).first()
        if not contract:
            raise BusinessException("合同不存在")
        
        account = contract.deposit_account
        if not account:
            raise BusinessException("保证金账户不存在")
        
        if contract.status not in [ContractStatus.ACTIVE, ContractStatus.SIGNING]:
            raise BusinessException(f"合同状态为{contract.status.value}，无法缴纳保证金")
        
        transaction = DepositTransaction(
            transaction_no=ContractService.generate_no("TX"),
            contract_id=data.contract_id,
            account_id=account.id,
            transaction_type=TransactionType.DEPOSIT,
            amount=data.amount,
            status=TransactionStatus.PROCESSING,
            idempotent_key=data.idempotent_key,
            reference_no=data.reference_no,
            operator=data.operator,
            remarks=data.remarks
        )
        db.add(transaction)
        db.flush()
        
        try:
            original_version = account.version
            account.paid_amount += data.amount
            account.current_balance = account.paid_amount - account.released_amount - account.deducted_amount
            account.status = DepositService._calculate_account_status(account)
            account.last_transaction_at = datetime.utcnow()
            account.version += 1
            
            updated = db.query(DepositAccount).filter(
                DepositAccount.id == account.id,
                DepositAccount.version == original_version
            ).update({
                "paid_amount": account.paid_amount,
                "current_balance": account.current_balance,
                "status": account.status,
                "last_transaction_at": account.last_transaction_at,
                "version": account.version
            })
            
            if updated == 0:
                raise BusinessException("账户版本冲突，请重试")
            
            receipt = PaymentReceipt(
                receipt_no=ContractService.generate_no("RC"),
                account_id=account.id,
                transaction_id=transaction.id,
                amount=data.amount,
                payment_method=data.payment_method,
                bank_name=data.bank_name,
                bank_account=data.bank_account,
                payer_name=data.payer_name,
                payment_date=data.payment_date or datetime.utcnow()
            )
            db.add(receipt)
            
            DepositService._create_snapshot(
                db, account, 
                snapshot_type="缴纳",
                reference_transaction_id=transaction.id,
                taken_by=data.operator
            )
            
            transaction.status = TransactionStatus.SUCCESS
            transaction.processed_at = datetime.utcnow()
            
            db.commit()
            db.refresh(transaction)
            db.refresh(account)
            
            return {
                "success": True,
                "message": "保证金缴纳成功",
                "is_duplicate": False,
                "transaction": transaction,
                "account": account
            }
            
        except BusinessException:
            db.rollback()
            transaction.status = TransactionStatus.FAILED
            transaction.error_message = "账户版本冲突"
            db.commit()
            raise
        
        except Exception as e:
            db.rollback()
            transaction.status = TransactionStatus.FAILED
            transaction.error_message = str(e)
            db.commit()
            raise BusinessException(f"缴纳失败: {str(e)}")
    
    @staticmethod
    def process_release(db: Session, data: ReleaseRequest) -> Dict[str, Any]:
        existing = DepositService.check_idempotency(db, data.idempotent_key)
        if existing:
            return {
                "success": existing.status == TransactionStatus.SUCCESS,
                "message": "重复请求，返回已有结果",
                "is_duplicate": True,
                "transaction": existing
            }
        
        contract = db.query(Contract).filter(Contract.id == data.contract_id).first()
        if not contract:
            raise BusinessException("合同不存在")
        
        account = contract.deposit_account
        if not account:
            raise BusinessException("保证金账户不存在")
        
        if data.release_condition_id:
            condition = db.query(ReleaseCondition).filter(
                ReleaseCondition.id == data.release_condition_id,
                ReleaseCondition.account_id == account.id
            ).first()
            if not condition:
                raise BusinessException("释放条件不存在")
            if not condition.is_met:
                raise BusinessException("释放条件未满足，无法释放")
            if condition.release_amount != data.amount:
                raise BusinessException(f"释放金额与条件金额不符，应为 {condition.release_amount}")
        
        if account.current_balance < data.amount:
            raise BusinessException(f"可释放余额不足，当前余额: {account.current_balance}")
        
        if account.status in [DepositStatus.PENDING_PAYMENT]:
            raise BusinessException("保证金尚未缴纳，无法释放")
        
        transaction = DepositTransaction(
            transaction_no=ContractService.generate_no("TX"),
            contract_id=data.contract_id,
            account_id=account.id,
            transaction_type=TransactionType.RELEASE,
            amount=data.amount,
            status=TransactionStatus.PROCESSING,
            idempotent_key=data.idempotent_key,
            reference_no=data.reference_no,
            operator=data.operator,
            remarks=data.remarks
        )
        db.add(transaction)
        db.flush()
        
        try:
            original_version = account.version
            account.released_amount += data.amount
            account.current_balance = account.paid_amount - account.released_amount - account.deducted_amount
            account.status = DepositService._calculate_account_status(account)
            account.last_transaction_at = datetime.utcnow()
            account.version += 1
            
            updated = db.query(DepositAccount).filter(
                DepositAccount.id == account.id,
                DepositAccount.version == original_version
            ).update({
                "released_amount": account.released_amount,
                "current_balance": account.current_balance,
                "status": account.status,
                "last_transaction_at": account.last_transaction_at,
                "version": account.version
            })
            
            if updated == 0:
                raise BusinessException("账户版本冲突，请重试")
            
            DepositService._create_snapshot(
                db, account,
                snapshot_type="释放",
                reference_transaction_id=transaction.id,
                taken_by=data.operator
            )
            
            transaction.status = TransactionStatus.SUCCESS
            transaction.processed_at = datetime.utcnow()
            
            db.commit()
            db.refresh(transaction)
            db.refresh(account)
            
            return {
                "success": True,
                "message": "保证金释放成功",
                "is_duplicate": False,
                "transaction": transaction,
                "account": account
            }
            
        except BusinessException:
            db.rollback()
            transaction.status = TransactionStatus.FAILED
            transaction.error_message = "账户版本冲突"
            db.commit()
            raise
        
        except Exception as e:
            db.rollback()
            transaction.status = TransactionStatus.FAILED
            transaction.error_message = str(e)
            db.commit()
            raise BusinessException(f"释放失败: {str(e)}")
    
    @staticmethod
    def process_deduct(db: Session, approval: PenaltyApproval) -> Dict[str, Any]:
        account = db.query(DepositAccount).filter(
            DepositAccount.id == approval.account_id
        ).first()
        if not account:
            raise BusinessException("保证金账户不存在")
        
        idempotent_key = f"DEDUCT_{approval.approval_no}"
        existing = DepositService.check_idempotency(db, idempotent_key)
        if existing:
            return {
                "success": existing.status == TransactionStatus.SUCCESS,
                "message": "已处理过",
                "is_duplicate": True,
                "transaction": existing
            }
        
        if account.current_balance < approval.penalty_amount:
            raise BusinessException(f"可扣罚余额不足，当前余额: {account.current_balance}")
        
        transaction = DepositTransaction(
            transaction_no=ContractService.generate_no("TX"),
            contract_id=approval.contract_id,
            account_id=approval.account_id,
            transaction_type=TransactionType.DEDUCT,
            amount=approval.penalty_amount,
            status=TransactionStatus.PROCESSING,
            idempotent_key=idempotent_key,
            reference_no=approval.approval_no,
            operator=approval.approver,
            remarks=approval.penalty_reason
        )
        db.add(transaction)
        db.flush()
        
        try:
            original_version = account.version
            account.deducted_amount += approval.penalty_amount
            account.current_balance = account.paid_amount - account.released_amount - account.deducted_amount
            account.status = DepositService._calculate_account_status(account)
            account.last_transaction_at = datetime.utcnow()
            account.version += 1
            
            updated = db.query(DepositAccount).filter(
                DepositAccount.id == account.id,
                DepositAccount.version == original_version
            ).update({
                "deducted_amount": account.deducted_amount,
                "current_balance": account.current_balance,
                "status": account.status,
                "last_transaction_at": account.last_transaction_at,
                "version": account.version
            })
            
            if updated == 0:
                raise BusinessException("账户版本冲突")
            
            DepositService._create_snapshot(
                db, account,
                snapshot_type="扣罚",
                reference_transaction_id=transaction.id,
                taken_by=approval.approver
            )
            
            transaction.status = TransactionStatus.SUCCESS
            transaction.processed_at = datetime.utcnow()
            
            approval.transaction_id = transaction.id
            
            db.commit()
            db.refresh(transaction)
            db.refresh(account)
            db.refresh(approval)
            
            return {
                "success": True,
                "message": "保证金扣罚成功",
                "is_duplicate": False,
                "transaction": transaction,
                "account": account
            }
            
        except Exception as e:
            db.rollback()
            transaction.status = TransactionStatus.FAILED
            transaction.error_message = str(e)
            db.commit()
            raise BusinessException(f"扣罚失败: {str(e)}")


class ReleaseConditionService:
    
    @staticmethod
    def create_condition(db: Session, data: ReleaseConditionCreate) -> ReleaseCondition:
        account = db.query(DepositAccount).filter(
            DepositAccount.id == data.account_id
        ).first()
        if not account:
            raise BusinessException("保证金账户不存在")
        
        condition = ReleaseCondition(**data.dict())
        db.add(condition)
        db.commit()
        db.refresh(condition)
        return condition
    
    @staticmethod
    def meet_condition(db: Session, condition_id: int, met_by: Optional[str] = None) -> ReleaseCondition:
        condition = db.query(ReleaseCondition).filter(
            ReleaseCondition.id == condition_id
        ).first()
        if not condition:
            raise BusinessException("释放条件不存在")
        
        if condition.is_met:
            raise BusinessException("释放条件已满足")
        
        condition.is_met = True
        condition.met_at = datetime.utcnow()
        condition.met_by = met_by
        db.commit()
        db.refresh(condition)
        return condition
    
    @staticmethod
    def list_by_account(db: Session, account_id: int) -> List[ReleaseCondition]:
        return db.query(ReleaseCondition).filter(
            ReleaseCondition.account_id == account_id
        ).order_by(ReleaseCondition.sort_order.asc()).all()


class PenaltyService:
    
    @staticmethod
    def apply_penalty(db: Session, data: PenaltyApplyRequest) -> PenaltyApproval:
        contract = db.query(Contract).filter(Contract.id == data.contract_id).first()
        if not contract:
            raise BusinessException("合同不存在")
        
        account = contract.deposit_account
        if not account:
            raise BusinessException("保证金账户不存在")
        
        if account.current_balance < data.penalty_amount:
            raise BusinessException(f"可扣罚余额不足，当前余额: {account.current_balance}")
        
        if data.idempotent_key:
            existing = db.query(PenaltyApproval).filter(
                PenaltyApproval.contract_id == data.contract_id,
                PenaltyApproval.penalty_amount == data.penalty_amount,
                PenaltyApproval.penalty_reason == data.penalty_reason,
                PenaltyApproval.status != ApprovalStatus.CANCELLED
            ).first()
            if existing:
                return existing
        
        approval = PenaltyApproval(
            approval_no=ContractService.generate_no("PA"),
            contract_id=data.contract_id,
            account_id=account.id,
            penalty_amount=data.penalty_amount,
            penalty_reason=data.penalty_reason,
            penalty_type=data.penalty_type,
            contract_node=data.contract_node,
            applicant=data.applicant,
            apply_time=datetime.utcnow(),
            status=ApprovalStatus.PENDING
        )
        db.add(approval)
        db.commit()
        db.refresh(approval)
        return approval
    
    @staticmethod
    def process_approval(db: Session, data: PenaltyApprovalRequest) -> Dict[str, Any]:
        approval = db.query(PenaltyApproval).filter(
            PenaltyApproval.approval_no == data.approval_no
        ).first()
        if not approval:
            raise BusinessException("审批单不存在")
        
        if approval.status != ApprovalStatus.PENDING:
            return {
                "success": approval.status == ApprovalStatus.APPROVED,
                "message": f"审批单状态为{approval.status.value}，无法重复审批",
                "is_duplicate": True,
                "approval": approval
            }
        
        if data.action == "approve":
            approval.status = ApprovalStatus.APPROVED
            approval.approver = data.approver
            approval.approval_time = datetime.utcnow()
            db.flush()
            
            try:
                result = DepositService.process_deduct(db, approval)
                db.commit()
                return {
                    "success": True,
                    "message": "审批通过，扣罚执行成功",
                    "is_duplicate": False,
                    "approval": approval,
                    "transaction": result.get("transaction")
                }
            except BusinessException as e:
                db.rollback()
                approval.status = ApprovalStatus.PENDING
                db.commit()
                raise BusinessException(f"扣罚执行失败: {str(e)}")
        
        elif data.action == "reject":
            approval.status = ApprovalStatus.REJECTED
            approval.approver = data.approver
            approval.approval_time = datetime.utcnow()
            approval.rejection_reason = data.rejection_reason
            db.commit()
            db.refresh(approval)
            return {
                "success": True,
                "message": "审批已驳回",
                "is_duplicate": False,
                "approval": approval
            }
        
        else:
            raise BusinessException(f"未知的审批操作: {data.action}")
    
    @staticmethod
    def list_pending(db: Session) -> List[PenaltyApproval]:
        return db.query(PenaltyApproval).filter(
            PenaltyApproval.status == ApprovalStatus.PENDING
        ).order_by(PenaltyApproval.created_at.desc()).all()


class ReportService:
    
    @staticmethod
    def get_contract_report(db: Session, contract_id: int) -> Dict[str, Any]:
        contract = db.query(Contract).filter(Contract.id == contract_id).first()
        if not contract:
            raise BusinessException("合同不存在")
        
        account = contract.deposit_account
        if not account:
            raise BusinessException("保证金账户不存在")
        
        pending_conditions = db.query(ReleaseCondition).filter(
            ReleaseCondition.account_id == account.id,
            ReleaseCondition.is_met == False
        ).count()
        
        total_transactions = db.query(DepositTransaction).filter(
            DepositTransaction.account_id == account.id
        ).count()
        
        return {
            "contract_id": contract.id,
            "contract_no": contract.contract_no,
            "contract_name": contract.contract_name,
            "required_deposit_amount": account.required_amount,
            "paid_amount": account.paid_amount,
            "released_amount": account.released_amount,
            "deducted_amount": account.deducted_amount,
            "current_balance": account.current_balance,
            "deposit_status": account.status,
            "pending_release_conditions": pending_conditions,
            "total_transactions": total_transactions
        }
    
    @staticmethod
    def get_all_reports(db: Session) -> List[Dict[str, Any]]:
        contracts = db.query(Contract).all()
        reports = []
        for contract in contracts:
            try:
                reports.append(ReportService.get_contract_report(db, contract.id))
            except BusinessException:
                continue
        return reports


class TaskService:
    
    @staticmethod
    def create_task(
        db: Session, 
        task_type: str, 
        related_id: Optional[int] = None,
        related_type: Optional[str] = None,
        payload: Optional[Dict] = None
    ) -> BackgroundTask:
        task = BackgroundTask(
            task_id=ContractService.generate_no("TASK"),
            task_type=task_type,
            related_id=related_id,
            related_type=related_type,
            status="pending",
            payload=json.dumps(payload) if payload else None,
            retry_count=0,
            max_retry=5,
            next_run_at=datetime.utcnow()
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return task
    
    @staticmethod
    def get_pending_tasks(db: Session) -> List[BackgroundTask]:
        return db.query(BackgroundTask).filter(
            BackgroundTask.status.in_(["pending", "failed"]),
            BackgroundTask.retry_count < BackgroundTask.max_retry,
            or_(
                BackgroundTask.next_run_at == None,
                BackgroundTask.next_run_at <= datetime.utcnow()
            )
        ).order_by(BackgroundTask.created_at.asc()).all()
    
    @staticmethod
    def execute_task(db: Session, task: BackgroundTask) -> bool:
        task.status = "running"
        task.last_run_at = datetime.utcnow()
        db.commit()
        
        try:
            if task.task_type == "retry_transaction":
                return TaskService._retry_transaction(db, task)
            elif task.task_type == "retry_deduct":
                return TaskService._retry_deduct(db, task)
            else:
                raise BusinessException(f"未知任务类型: {task.task_type}")
        
        except Exception as e:
            task.status = "failed"
            task.error_message = str(e)
            task.retry_count += 1
            
            if task.retry_count >= task.max_retry:
                task.status = "exhausted"
            else:
                delay = min(60 * (2 ** task.retry_count), 3600)
                task.next_run_at = datetime.utcnow() + timedelta(seconds=delay)
            
            db.commit()
            return False
    
    @staticmethod
    def _retry_transaction(db: Session, task: BackgroundTask) -> bool:
        transaction = db.query(DepositTransaction).filter(
            DepositTransaction.id == task.related_id
        ).first()
        if not transaction:
            raise BusinessException("交易不存在")
        
        if transaction.status == TransactionStatus.SUCCESS:
            task.status = "completed"
            db.commit()
            return True
        
        if transaction.transaction_type == TransactionType.DEPOSIT:
            pass
        elif transaction.transaction_type == TransactionType.RELEASE:
            pass
        
        transaction.retry_count += 1
        
        if transaction.retry_count >= transaction.max_retry:
            transaction.status = TransactionStatus.NEED_RETRY
            task.status = "completed"
            db.commit()
            return True
        
        return True
    
    @staticmethod
    def _retry_deduct(db: Session, task: BackgroundTask) -> bool:
        approval = db.query(PenaltyApproval).filter(
            PenaltyApproval.id == task.related_id
        ).first()
        if not approval:
            raise BusinessException("审批单不存在")
        
        if approval.transaction_id:
            task.status = "completed"
            db.commit()
            return True
        
        result = DepositService.process_deduct(db, approval)
        if result["success"]:
            task.status = "completed"
            db.commit()
            return True
        else:
            raise BusinessException(result.get("message", "未知错误"))
    
    @staticmethod
    def retry_task(db: Session, task_id: str, force: bool = False) -> BackgroundTask:
        task = db.query(BackgroundTask).filter(
            BackgroundTask.task_id == task_id
        ).first()
        if not task:
            raise BusinessException("任务不存在")
        
        if not force and task.status == "completed":
            raise BusinessException("任务已完成，无需重试")
        
        if not force and task.retry_count >= task.max_retry:
            raise BusinessException("已达最大重试次数，请使用 force=true 强制重试")
        
        task.status = "pending"
        task.retry_count = 0 if force else task.retry_count
        task.next_run_at = datetime.utcnow()
        task.error_message = None
        db.commit()
        db.refresh(task)
        return task
    
    @staticmethod
    def run_scheduler_once(db: Session) -> Dict[str, Any]:
        tasks = TaskService.get_pending_tasks(db)
        results = []
        for task in tasks:
            success = TaskService.execute_task(db, task)
            results.append({
                "task_id": task.task_id,
                "task_type": task.task_type,
                "status": task.status,
                "success": success
            })
        return {
            "total_tasks": len(tasks),
            "results": results
        }
