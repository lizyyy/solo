from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base


class ContractStatus(str, enum.Enum):
    DRAFT = "草稿"
    SIGNING = "待签署"
    ACTIVE = "履约中"
    COMPLETED = "已完成"
    TERMINATED = "已终止"


class DepositStatus(str, enum.Enum):
    PENDING_PAYMENT = "待缴纳"
    FULLY_PAID = "已足额缴纳"
    PARTIALLY_PAID = "部分缴纳"
    RELEASED = "已释放"
    PARTIALLY_RELEASED = "部分释放"


class TransactionType(str, enum.Enum):
    DEPOSIT = "缴纳"
    RELEASE = "释放"
    DEDUCT = "扣罚"


class TransactionStatus(str, enum.Enum):
    PENDING = "待处理"
    PROCESSING = "处理中"
    SUCCESS = "成功"
    FAILED = "失败"
    NEED_RETRY = "待重试"


class ApprovalStatus(str, enum.Enum):
    DRAFT = "草稿"
    PENDING = "待审批"
    APPROVED = "已通过"
    REJECTED = "已驳回"
    CANCELLED = "已取消"


class Contract(Base):
    __tablename__ = "contracts"
    
    id = Column(Integer, primary_key=True, index=True)
    contract_no = Column(String(50), unique=True, index=True, nullable=False)
    contract_name = Column(String(200), nullable=False)
    party_a = Column(String(100), nullable=False)
    party_b = Column(String(100), nullable=False)
    total_amount = Column(Float, default=0.0)
    deposit_rate = Column(Float, default=0.0)
    required_deposit_amount = Column(Float, default=0.0)
    status = Column(Enum(ContractStatus), default=ContractStatus.DRAFT)
    sign_date = Column(DateTime, nullable=True)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    remarks = Column(Text, nullable=True)
    
    deposit_account = relationship("DepositAccount", back_populates="contract", uselist=False)
    snapshots = relationship("BalanceSnapshot", back_populates="contract")
    transactions = relationship("DepositTransaction", back_populates="contract")


class DepositAccount(Base):
    __tablename__ = "deposit_accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), unique=True, nullable=False)
    account_no = Column(String(50), unique=True, index=True, nullable=False)
    required_amount = Column(Float, default=0.0)
    paid_amount = Column(Float, default=0.0)
    released_amount = Column(Float, default=0.0)
    deducted_amount = Column(Float, default=0.0)
    current_balance = Column(Float, default=0.0)
    status = Column(Enum(DepositStatus), default=DepositStatus.PENDING_PAYMENT)
    last_transaction_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    version = Column(Integer, default=1, nullable=False)
    
    contract = relationship("Contract", back_populates="deposit_account")
    transactions = relationship("DepositTransaction", back_populates="account")
    receipts = relationship("PaymentReceipt", back_populates="account")
    release_conditions = relationship("ReleaseCondition", back_populates="account")


class DepositTransaction(Base):
    __tablename__ = "deposit_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    transaction_no = Column(String(50), unique=True, index=True, nullable=False)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("deposit_accounts.id"), nullable=False)
    transaction_type = Column(Enum(TransactionType), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(Enum(TransactionStatus), default=TransactionStatus.PENDING)
    idempotent_key = Column(String(100), unique=True, index=True, nullable=False)
    reference_no = Column(String(100), nullable=True)
    operator = Column(String(50), nullable=True)
    processed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    max_retry = Column(Integer, default=3)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    remarks = Column(Text, nullable=True)
    
    contract = relationship("Contract", back_populates="transactions")
    account = relationship("DepositAccount", back_populates="transactions")
    receipt = relationship("PaymentReceipt", back_populates="transaction", uselist=False)
    penalty = relationship("PenaltyApproval", back_populates="transaction", uselist=False)


class PaymentReceipt(Base):
    __tablename__ = "payment_receipts"
    
    id = Column(Integer, primary_key=True, index=True)
    receipt_no = Column(String(50), unique=True, index=True, nullable=False)
    account_id = Column(Integer, ForeignKey("deposit_accounts.id"), nullable=False)
    transaction_id = Column(Integer, ForeignKey("deposit_transactions.id"), nullable=False)
    amount = Column(Float, nullable=False)
    payment_method = Column(String(50), nullable=True)
    bank_name = Column(String(100), nullable=True)
    bank_account = Column(String(100), nullable=True)
    payer_name = Column(String(100), nullable=True)
    payment_date = Column(DateTime, nullable=True)
    receipt_content = Column(Text, nullable=True)
    verified = Column(Boolean, default=False)
    verified_by = Column(String(50), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    account = relationship("DepositAccount", back_populates="receipts")
    transaction = relationship("DepositTransaction", back_populates="receipt")


class ReleaseCondition(Base):
    __tablename__ = "release_conditions"
    
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("deposit_accounts.id"), nullable=False)
    condition_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    release_amount = Column(Float, nullable=False)
    is_met = Column(Boolean, default=False)
    met_at = Column(DateTime, nullable=True)
    met_by = Column(String(50), nullable=True)
    contract_node = Column(String(100), nullable=True)
    sort_order = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    account = relationship("DepositAccount", back_populates="release_conditions")


class PenaltyApproval(Base):
    __tablename__ = "penalty_approvals"
    
    id = Column(Integer, primary_key=True, index=True)
    approval_no = Column(String(50), unique=True, index=True, nullable=False)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("deposit_accounts.id"), nullable=False)
    transaction_id = Column(Integer, ForeignKey("deposit_transactions.id"), nullable=True)
    penalty_amount = Column(Float, nullable=False)
    penalty_reason = Column(Text, nullable=False)
    penalty_type = Column(String(100), nullable=True)
    contract_node = Column(String(100), nullable=True)
    status = Column(Enum(ApprovalStatus), default=ApprovalStatus.DRAFT)
    applicant = Column(String(50), nullable=True)
    apply_time = Column(DateTime, nullable=True)
    approver = Column(String(50), nullable=True)
    approval_time = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    transaction = relationship("DepositTransaction", back_populates="penalty")


class BalanceSnapshot(Base):
    __tablename__ = "balance_snapshots"
    
    id = Column(Integer, primary_key=True, index=True)
    snapshot_no = Column(String(50), unique=True, index=True, nullable=False)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("deposit_accounts.id"), nullable=False)
    required_amount = Column(Float, default=0.0)
    paid_amount = Column(Float, default=0.0)
    released_amount = Column(Float, default=0.0)
    deducted_amount = Column(Float, default=0.0)
    current_balance = Column(Float, default=0.0)
    snapshot_type = Column(String(50), nullable=True)
    reference_transaction_id = Column(Integer, nullable=True)
    taken_by = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    contract = relationship("Contract", back_populates="snapshots")


class BackgroundTask(Base):
    __tablename__ = "background_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(100), unique=True, index=True, nullable=False)
    task_type = Column(String(50), nullable=False)
    related_id = Column(Integer, nullable=True)
    related_type = Column(String(50), nullable=True)
    status = Column(String(20), default="pending")
    payload = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    max_retry = Column(Integer, default=5)
    last_run_at = Column(DateTime, nullable=True)
    next_run_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
