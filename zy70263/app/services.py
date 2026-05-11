from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from typing import Optional, List
import os

from .models import (
    Wristband, Deposit, Transaction, Settlement,
    WristbandStatus, DepositStatus, TransactionType, SettlementStatus
)
from .schemas import (
    WristbandCreate, DepositRecharge, ConsumptionRequest, LossReport
)


class BusinessError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class WristbandService:
    @staticmethod
    def issue_wristband(db: Session, data: WristbandCreate) -> Wristband:
        existing = db.query(Wristband).filter(Wristband.wristband_no == data.wristband_no).first()
        if existing:
            raise BusinessError("WRISTBAND_EXISTS", f"腕带号 {data.wristband_no} 已存在")

        wristband = Wristband(
            wristband_no=data.wristband_no,
            visitor_name=data.visitor_name,
            deposit_amount=data.deposit_amount,
            status=WristbandStatus.ISSUED
        )
        db.add(wristband)
        db.flush()
        return wristband

    @staticmethod
    def freeze_deposit(db: Session, wristband_no: str) -> Wristband:
        wristband = db.query(Wristband).filter(Wristband.wristband_no == wristband_no).first()
        if not wristband:
            raise BusinessError("WRISTBAND_NOT_FOUND", "腕带不存在", 404)
        
        if wristband.status != WristbandStatus.ISSUED:
            raise BusinessError("INVALID_STATUS", "腕带状态不允许冻结押金")

        existing_deposit = db.query(Deposit).filter(
            Deposit.wristband_id == wristband.id,
            Deposit.status == DepositStatus.FROZEN
        ).first()
        
        if existing_deposit:
            return wristband

        deposit = Deposit(
            wristband_id=wristband.id,
            amount=wristband.deposit_amount,
            status=DepositStatus.FROZEN
        )
        db.add(deposit)
        
        wristband.status = WristbandStatus.FROZEN
        db.flush()
        return wristband

    @staticmethod
    def activate_wristband(db: Session, wristband_no: str, initial_deposit: float = 0) -> Wristband:
        wristband = db.query(Wristband).filter(Wristband.wristband_no == wristband_no).first()
        if not wristband:
            raise BusinessError("WRISTBAND_NOT_FOUND", "腕带不存在", 404)
        
        if wristband.status != WristbandStatus.FROZEN:
            raise BusinessError("INVALID_STATUS", "腕带必须先冻结押金才能激活")

        wristband.status = WristbandStatus.ACTIVE
        
        if initial_deposit > 0:
            wristband.balance += initial_deposit
            transaction = Transaction(
                wristband_id=wristband.id,
                transaction_type=TransactionType.DEPOSIT,
                amount=initial_deposit,
                description="初始储值",
                balance_after=wristband.balance
            )
            db.add(transaction)
        
        db.flush()
        return wristband

    @staticmethod
    def recharge(db: Session, wristband_no: str, data: DepositRecharge) -> Transaction:
        wristband = db.query(Wristband).filter(Wristband.wristband_no == wristband_no).first()
        if not wristband:
            raise BusinessError("WRISTBAND_NOT_FOUND", "腕带不存在", 404)
        
        if wristband.status != WristbandStatus.ACTIVE:
            raise BusinessError("INVALID_STATUS", "腕带未激活，无法储值")

        if data.amount <= 0:
            raise BusinessError("INVALID_AMOUNT", "储值金额必须大于0")

        wristband.balance += data.amount
        
        transaction = Transaction(
            wristband_id=wristband.id,
            transaction_type=TransactionType.DEPOSIT,
            amount=data.amount,
            description="储值",
            balance_after=wristband.balance
        )
        db.add(transaction)
        db.flush()
        return transaction

    @staticmethod
    def consume(db: Session, wristband_no: str, data: ConsumptionRequest) -> Transaction:
        wristband = db.query(Wristband).filter(Wristband.wristband_no == wristband_no).first()
        if not wristband:
            raise BusinessError("WRISTBAND_NOT_FOUND", "腕带不存在", 404)
        
        if wristband.status != WristbandStatus.ACTIVE:
            raise BusinessError("INVALID_STATUS", "腕带未激活，无法消费")

        if data.amount <= 0:
            raise BusinessError("INVALID_AMOUNT", "消费金额必须大于0")

        if wristband.balance < data.amount:
            raise BusinessError("INSUFFICIENT_BALANCE", "余额不足")

        wristband.balance -= data.amount
        
        transaction = Transaction(
            wristband_id=wristband.id,
            transaction_type=TransactionType.CONSUMPTION,
            amount=data.amount,
            description=data.description or "消费",
            balance_after=wristband.balance
        )
        db.add(transaction)
        db.flush()
        return transaction

    @staticmethod
    def report_loss(db: Session, old_wristband_no: str, data: LossReport) -> Wristband:
        old_wristband = db.query(Wristband).filter(Wristband.wristband_no == old_wristband_no).first()
        if not old_wristband:
            raise BusinessError("WRISTBAND_NOT_FOUND", "原腕带不存在", 404)
        
        if old_wristband.status not in [WristbandStatus.ACTIVE, WristbandStatus.FROZEN]:
            raise BusinessError("INVALID_STATUS", "腕带状态不允许挂失")

        existing_new = db.query(Wristband).filter(Wristband.wristband_no == data.new_wristband_no).first()
        if existing_new:
            raise BusinessError("WRISTBAND_EXISTS", f"新腕带号 {data.new_wristband_no} 已存在")

        if old_wristband.status == WristbandStatus.ACTIVE:
            if old_wristband.balance < data.replacement_fee:
                raise BusinessError("INSUFFICIENT_BALANCE", "余额不足以支付补办费")
            old_wristband.balance -= data.replacement_fee
            fee_transaction = Transaction(
                wristband_id=old_wristband.id,
                transaction_type=TransactionType.REPLACEMENT_FEE,
                amount=data.replacement_fee,
                description="腕带补办费",
                balance_after=old_wristband.balance
            )
            db.add(fee_transaction)

        old_wristband.status = WristbandStatus.LOST

        new_wristband = Wristband(
            wristband_no=data.new_wristband_no,
            visitor_name=old_wristband.visitor_name,
            deposit_amount=old_wristband.deposit_amount,
            status=old_wristband.status if old_wristband.status == WristbandStatus.FROZEN else WristbandStatus.ACTIVE,
            balance=old_wristband.balance,
            original_wristband_id=old_wristband.id
        )
        db.add(new_wristband)
        db.flush()
        return new_wristband

    @staticmethod
    def get_wristband(db: Session, wristband_no: str) -> Optional[Wristband]:
        return db.query(Wristband).filter(Wristband.wristband_no == wristband_no).first()

    @staticmethod
    def get_transactions(db: Session, wristband_no: str) -> List[Transaction]:
        wristband = db.query(Wristband).filter(Wristband.wristband_no == wristband_no).first()
        if not wristband:
            return []
        return db.query(Transaction).filter(Transaction.wristband_id == wristband.id).order_by(Transaction.created_at.desc()).all()


class SettlementService:
    @staticmethod
    def has_settlement_today(db: Session) -> Optional[Settlement]:
        today = datetime.utcnow().date()
        return db.query(Settlement).filter(
            Settlement.settlement_date >= today,
            Settlement.status == SettlementStatus.COMPLETED
        ).first()

    @staticmethod
    def calculate_statistics(db: Session):
        total_wristbands = db.query(Wristband).count()
        active_wristbands = db.query(Wristband).filter(
            Wristband.status.in_([WristbandStatus.ACTIVE, WristbandStatus.FROZEN])
        ).count()
        
        frozen_deposits = db.query(Deposit).filter(
            Deposit.status == DepositStatus.FROZEN,
            Deposit.settlement_id.is_(None)
        ).all()
        total_deposit_frozen = sum(d.amount for d in frozen_deposits)
        
        total_balance = db.query(Wristband).filter(
            Wristband.status.in_([WristbandStatus.ACTIVE, WristbandStatus.FROZEN])
        ).with_entities(func.sum(Wristband.balance)).scalar() or 0
        
        consumption_transactions = db.query(Transaction).filter(
            Transaction.transaction_type == TransactionType.CONSUMPTION,
            Transaction.settlement_id.is_(None)
        ).all()
        total_consumption = sum(t.amount for t in consumption_transactions)
        
        replacement_transactions = db.query(Transaction).filter(
            Transaction.transaction_type == TransactionType.REPLACEMENT_FEE,
            Transaction.settlement_id.is_(None)
        ).all()
        total_replacement_fees = sum(t.amount for t in replacement_transactions)
        
        return {
            "total_wristbands": total_wristbands,
            "active_wristbands": active_wristbands,
            "total_deposit_frozen": total_deposit_frozen,
            "total_balance": total_balance,
            "total_consumption": total_consumption,
            "total_replacement_fees": total_replacement_fees
        }

    @staticmethod
    def perform_settlement(db: Session) -> Settlement:
        existing_settlement = SettlementService.has_settlement_today(db)
        if existing_settlement:
            return existing_settlement

        settlement = Settlement()
        db.add(settlement)
        db.flush()

        stats = SettlementService.calculate_statistics(db)
        
        settlement.total_deposit_frozen = stats["total_deposit_frozen"]
        settlement.total_consumption = stats["total_consumption"]
        settlement.total_replacement_fees = stats["total_replacement_fees"]

        deposits_to_settle = db.query(Deposit).filter(
            Deposit.status == DepositStatus.FROZEN,
            Deposit.settlement_id.is_(None)
        ).all()
        
        total_refunded = 0.0
        total_forfeited = 0.0
        
        for deposit in deposits_to_settle:
            wristband = db.query(Wristband).filter(Wristband.id == deposit.wristband_id).first()
            if wristband and wristband.status in [WristbandStatus.LOST, WristbandStatus.REPLACED]:
                deposit.status = DepositStatus.FORFEITED
                total_forfeited += deposit.amount
            else:
                deposit.status = DepositStatus.REFUNDED
                total_refunded += deposit.amount
            deposit.unfrozen_at = datetime.utcnow()
            deposit.settlement_id = settlement.id

        settlement.total_deposit_refunded = total_refunded
        settlement.total_deposit_forfeited = total_forfeited

        transactions_to_settle = db.query(Transaction).filter(
            Transaction.settlement_id.is_(None)
        ).all()
        
        for transaction in transactions_to_settle:
            transaction.settlement_id = settlement.id

        active_wristbands = db.query(Wristband).filter(
            Wristband.status.in_([WristbandStatus.ACTIVE, WristbandStatus.FROZEN])
        ).all()
        
        for wristband in active_wristbands:
            wristband.status = WristbandStatus.SETTLED

        export_path = SettlementService.generate_export_file(settlement)
        settlement.export_file_path = export_path
        settlement.status = SettlementStatus.COMPLETED
        
        db.commit()
        return settlement

    @staticmethod
    def generate_export_file(settlement: Settlement) -> str:
        os.makedirs("exports", exist_ok=True)
        filename = f"exports/settlement_{settlement.id}_{settlement.settlement_date.strftime('%Y%m%d')}.csv"
        
        with open(filename, "w", encoding="utf-8") as f:
            f.write("结算ID,结算日期,押金冻结总额,押金退还总额,押金没收总额,消费总额,补办费总额\n")
            f.write(f"{settlement.id},{settlement.settlement_date.strftime('%Y-%m-%d %H:%M:%S')},"
                   f"{settlement.total_deposit_frozen},{settlement.total_deposit_refunded},"
                   f"{settlement.total_deposit_forfeited},{settlement.total_consumption},"
                   f"{settlement.total_replacement_fees}\n")
        
        return filename

    @staticmethod
    def get_settlement(db: Session, settlement_id: int) -> Optional[Settlement]:
        return db.query(Settlement).filter(Settlement.id == settlement_id).first()

    @staticmethod
    def list_settlements(db: Session) -> List[Settlement]:
        return db.query(Settlement).order_by(Settlement.created_at.desc()).all()
