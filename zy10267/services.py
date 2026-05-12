from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime
import uuid
from typing import Optional, List, Tuple
from database import (
    Family, Resident, PointAccount, ServiceRecord, InventoryItem,
    ExchangeOrder, PointTransaction, TransactionType, TransactionStatus,
    get_db
)


def generate_number(prefix: str) -> str:
    return f"{prefix}{uuid.uuid4().hex[:12].upper()}"


class ResidentService:
    @staticmethod
    def create_resident(db: Session, name: str, id_card: str, phone: str = None,
                       family_id: int = None) -> Tuple[Resident, PointAccount]:
        existing = db.query(Resident).filter(Resident.id_card == id_card).first()
        if existing:
            raise ValueError(f"身份证号 {id_card} 已存在")

        resident = Resident(
            resident_number=generate_number("R"),
            name=name,
            id_card=id_card,
            phone=phone,
            family_id=family_id
        )
        db.add(resident)
        db.flush()

        account = PointAccount(
            account_number=generate_number("A"),
            resident_id=resident.id
        )
        db.add(account)
        db.commit()
        db.refresh(resident)
        db.refresh(account)
        return resident, account

    @staticmethod
    def get_resident(db: Session, resident_id: int = None, resident_number: str = None,
                    id_card: str = None) -> Optional[Resident]:
        if resident_id:
            return db.query(Resident).filter(Resident.id == resident_id).first()
        if resident_number:
            return db.query(Resident).filter(Resident.resident_number == resident_number).first()
        if id_card:
            return db.query(Resident).filter(Resident.id_card == id_card).first()
        return None

    @staticmethod
    def list_residents(db: Session, family_id: int = None, is_active: bool = None) -> List[Resident]:
        query = db.query(Resident)
        if family_id:
            query = query.filter(Resident.family_id == family_id)
        if is_active is not None:
            query = query.filter(Resident.is_active == is_active)
        return query.all()


class FamilyService:
    @staticmethod
    def create_family(db: Session, family_name: str, family_number: str = None,
                     address: str = None, contact_phone: str = None) -> Tuple[Family, PointAccount]:
        if family_number:
            existing = db.query(Family).filter(Family.family_number == family_number).first()
            if existing:
                raise ValueError(f"家庭编号 {family_number} 已存在")

        family = Family(
            family_number=family_number or generate_number("F"),
            family_name=family_name,
            address=address,
            contact_phone=contact_phone
        )
        db.add(family)
        db.flush()

        account = PointAccount(
            account_number=generate_number("FA"),
            family_id=family.id
        )
        db.add(account)
        db.commit()
        db.refresh(family)
        db.refresh(account)
        return family, account

    @staticmethod
    def add_resident_to_family(db: Session, family_id: int, resident_id: int):
        family = db.query(Family).filter(Family.id == family_id).first()
        if not family:
            raise ValueError("家庭不存在")
        resident = db.query(Resident).filter(Resident.id == resident_id).first()
        if not resident:
            raise ValueError("居民不存在")
        resident.family_id = family_id
        db.commit()

    @staticmethod
    def merge_family_accounts(db: Session, target_family_id: int, source_account_ids: List[int],
                             operator_id: str = None) -> dict:
        target_family = db.query(Family).filter(Family.id == target_family_id).first()
        if not target_family:
            raise ValueError("目标家庭不存在")
        if not target_family.point_account:
            raise ValueError("目标家庭没有积分账户")

        target_account = target_family.point_account
        merge_details = []
        total_merged = 0

        for source_account_id in source_account_ids:
            source_account = db.query(PointAccount).filter(
                PointAccount.id == source_account_id
            ).first()
            if not source_account:
                continue
            if source_account.id == target_account.id:
                continue
            if source_account.balance <= 0:
                continue

            amount = source_account.balance

            source_transaction = PointTransaction(
                transaction_number=generate_number("T"),
                account_id=source_account.id,
                transaction_type=TransactionType.MERGE_OUT,
                amount=-amount,
                balance_before=source_account.balance,
                balance_after=source_account.balance - amount,
                description=f"家庭合并转出至家庭 {target_family.family_name}",
                operator_id=operator_id
            )
            db.add(source_transaction)

            target_transaction = PointTransaction(
                transaction_number=generate_number("T"),
                account_id=target_account.id,
                transaction_type=TransactionType.MERGE_IN,
                amount=amount,
                balance_before=target_account.balance,
                balance_after=target_account.balance + amount,
                description=f"家庭合并从账户 {source_account.account_number} 转入",
                operator_id=operator_id,
                needs_review=True
            )
            db.add(target_transaction)

            source_account.balance -= amount
            target_account.balance += amount
            target_account.total_earned += amount

            total_merged += amount
            merge_details.append({
                "source_account": source_account.account_number,
                "amount": amount,
                "resident_name": source_account.resident.name if source_account.resident else None
            })

        target_family.total_points = target_account.balance
        db.commit()

        return {
            "target_family": target_family.family_name,
            "target_account": target_account.account_number,
            "total_merged": total_merged,
            "details": merge_details
        }


class PointService:
    @staticmethod
    def earn_points(db: Session, account_id: int, amount: int, service_record_id: int = None,
                   description: str = None, operator_id: str = None,
                   needs_review: bool = False) -> PointTransaction:
        if amount <= 0:
            raise ValueError("积分必须为正数")

        account = db.query(PointAccount).filter(PointAccount.id == account_id).first()
        if not account:
            raise ValueError("账户不存在")

        if service_record_id:
            existing = db.query(PointTransaction).filter(
                and_(
                    PointTransaction.service_record_id == service_record_id,
                    PointTransaction.transaction_type == TransactionType.EARN
                )
            ).first()
            if existing:
                raise ValueError("该服务记录已经入账，不能重复积分")

        balance_before = account.balance
        balance_after = balance_before + amount

        transaction = PointTransaction(
            transaction_number=generate_number("T"),
            account_id=account_id,
            transaction_type=TransactionType.EARN,
            amount=amount,
            balance_before=balance_before,
            balance_after=balance_after,
            service_record_id=service_record_id,
            description=description or "服务积分入账",
            operator_id=operator_id,
            needs_review=needs_review
        )

        account.balance = balance_after
        account.total_earned += amount

        if account.resident:
            account.resident.total_points = account.balance
        if account.family:
            account.family.total_points = account.balance

        db.add(transaction)
        db.commit()
        db.refresh(transaction)
        return transaction

    @staticmethod
    def exchange_points(db: Session, account_id: int, item_id: int, quantity: int = 1,
                       operator_id: str = None) -> Tuple[ExchangeOrder, PointTransaction]:
        if quantity <= 0:
            raise ValueError("兑换数量必须为正数")

        account = db.query(PointAccount).filter(PointAccount.id == account_id).first()
        if not account:
            raise ValueError("账户不存在")

        item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
        if not item or not item.is_active:
            raise ValueError("兑换物品不存在或已下架")

        total_points = item.points_required * quantity

        if account.balance < total_points:
            raise ValueError(f"积分不足，当前余额: {account.balance}, 需要: {total_points}")

        if item.stock_quantity < quantity:
            raise ValueError(f"库存不足，当前库存: {item.stock_quantity}, 需要: {quantity}")

        balance_before = account.balance
        balance_after = balance_before - total_points

        order = ExchangeOrder(
            order_number=generate_number("O"),
            account_id=account_id,
            item_id=item_id,
            quantity=quantity,
            points_used=total_points,
            operator_id=operator_id
        )
        db.add(order)
        db.flush()

        transaction = PointTransaction(
            transaction_number=generate_number("T"),
            account_id=account_id,
            transaction_type=TransactionType.EXCHANGE,
            amount=-total_points,
            balance_before=balance_before,
            balance_after=balance_after,
            exchange_order_id=order.id,
            description=f"兑换 {item.item_name} x {quantity}",
            operator_id=operator_id
        )

        account.balance = balance_after
        account.total_exchanged += total_points
        item.stock_quantity -= quantity

        if account.resident:
            account.resident.total_points = account.balance
        if account.family:
            account.family.total_points = account.balance

        db.add(transaction)
        db.commit()
        db.refresh(order)
        db.refresh(transaction)
        return order, transaction

    @staticmethod
    def revoke_service_record(db: Session, service_record_id: int, reason: str,
                             operator_id: str = None) -> Tuple[ServiceRecord, PointTransaction]:
        service_record = db.query(ServiceRecord).filter(
            ServiceRecord.id == service_record_id
        ).first()
        if not service_record:
            raise ValueError("服务记录不存在")
        if service_record.is_revoked:
            raise ValueError("该服务记录已撤销")

        earn_transaction = db.query(PointTransaction).filter(
            and_(
                PointTransaction.service_record_id == service_record_id,
                PointTransaction.transaction_type == TransactionType.EARN,
                PointTransaction.status == TransactionStatus.CONFIRMED
            )
        ).first()

        if not earn_transaction:
            raise ValueError("未找到对应的积分入账记录")

        account = earn_transaction.account
        amount = earn_transaction.amount

        if account.balance < amount:
            raise ValueError(f"账户积分不足回滚，当前余额: {account.balance}, 需要回滚: {amount}")

        balance_before = account.balance
        balance_after = balance_before - amount

        rollback_transaction = PointTransaction(
            transaction_number=generate_number("T"),
            account_id=account.id,
            transaction_type=TransactionType.ROLLBACK,
            amount=-amount,
            balance_before=balance_before,
            balance_after=balance_after,
            service_record_id=service_record_id,
            related_transaction_id=earn_transaction.id,
            description=f"撤销服务记录回滚积分: {reason}",
            operator_id=operator_id
        )

        account.balance = balance_after
        earn_transaction.status = TransactionStatus.ROLLBACKED
        service_record.is_revoked = True
        service_record.revoked_at = datetime.utcnow()
        service_record.revoked_reason = reason

        if account.resident:
            account.resident.total_points = account.balance
        if account.family:
            account.family.total_points = account.balance

        db.add(rollback_transaction)
        db.commit()
        db.refresh(service_record)
        db.refresh(rollback_transaction)
        return service_record, rollback_transaction

    @staticmethod
    def revoke_exchange_order(db: Session, order_id: int, reason: str,
                             operator_id: str = None) -> Tuple[ExchangeOrder, PointTransaction]:
        order = db.query(ExchangeOrder).filter(ExchangeOrder.id == order_id).first()
        if not order:
            raise ValueError("兑换订单不存在")
        if order.is_revoked:
            raise ValueError("该订单已撤销")

        exchange_transaction = db.query(PointTransaction).filter(
            and_(
                PointTransaction.exchange_order_id == order_id,
                PointTransaction.transaction_type == TransactionType.EXCHANGE,
                PointTransaction.status == TransactionStatus.CONFIRMED
            )
        ).first()

        if not exchange_transaction:
            raise ValueError("未找到对应的兑换交易记录")

        account = exchange_transaction.account
        amount = abs(exchange_transaction.amount)
        item = order.item

        balance_before = account.balance
        balance_after = balance_before + amount

        rollback_transaction = PointTransaction(
            transaction_number=generate_number("T"),
            account_id=account.id,
            transaction_type=TransactionType.ROLLBACK,
            amount=amount,
            balance_before=balance_before,
            balance_after=balance_after,
            exchange_order_id=order_id,
            related_transaction_id=exchange_transaction.id,
            description=f"撤销兑换订单回滚积分: {reason}",
            operator_id=operator_id
        )

        account.balance = balance_after
        account.total_exchanged -= amount
        exchange_transaction.status = TransactionStatus.ROLLBACKED
        order.is_revoked = True
        order.revoked_at = datetime.utcnow()
        order.revoked_reason = reason
        item.stock_quantity += order.quantity

        if account.resident:
            account.resident.total_points = account.balance
        if account.family:
            account.family.total_points = account.balance

        db.add(rollback_transaction)
        db.commit()
        db.refresh(order)
        db.refresh(rollback_transaction)
        return order, rollback_transaction


class ServiceRecordService:
    @staticmethod
    def create_service_record(db: Session, resident_id: int, service_type: str,
                             service_date: datetime, service_hours: float = 0,
                             points_earned: int = 0, description: str = None,
                             operator_id: str = None, import_batch_id: str = None) -> ServiceRecord:
        resident = db.query(Resident).filter(Resident.id == resident_id).first()
        if not resident:
            raise ValueError("居民不存在")

        record = ServiceRecord(
            record_number=generate_number("S"),
            resident_id=resident_id,
            service_type=service_type,
            service_date=service_date,
            service_hours=service_hours,
            points_earned=points_earned,
            description=description,
            operator_id=operator_id,
            import_batch_id=import_batch_id
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def batch_import_service_records(db: Session, records: List[dict],
                                    import_batch_id: str = None) -> dict:
        batch_id = import_batch_id or generate_number("B")
        success_count = 0
        duplicate_count = 0
        error_count = 0
        errors = []

        for record_data in records:
            try:
                resident_id = record_data.get("resident_id")
                service_type = record_data.get("service_type")
                service_date = record_data.get("service_date")

                existing = db.query(ServiceRecord).filter(
                    and_(
                        ServiceRecord.resident_id == resident_id,
                        ServiceRecord.service_type == service_type,
                        ServiceRecord.service_date == service_date,
                        ServiceRecord.import_batch_id == batch_id
                    )
                ).first()

                if existing:
                    duplicate_count += 1
                    continue

                ServiceRecordService.create_service_record(
                    db, resident_id, service_type, service_date,
                    record_data.get("service_hours", 0),
                    record_data.get("points_earned", 0),
                    record_data.get("description"),
                    record_data.get("operator_id"),
                    batch_id
                )
                success_count += 1
            except Exception as e:
                error_count += 1
                errors.append(f"{record_data.get('resident_id')}: {str(e)}")

        return {
            "batch_id": batch_id,
            "success_count": success_count,
            "duplicate_count": duplicate_count,
            "error_count": error_count,
            "errors": errors
        }


class InventoryService:
    @staticmethod
    def create_item(db: Session, item_name: str, points_required: int,
                   item_code: str = None, category: str = None, stock_quantity: int = 0,
                   unit: str = "份", description: str = None) -> InventoryItem:
        if points_required <= 0:
            raise ValueError("所需积分必须为正数")

        if item_code:
            existing = db.query(InventoryItem).filter(InventoryItem.item_code == item_code).first()
            if existing:
                raise ValueError(f"物品编码 {item_code} 已存在")

        item = InventoryItem(
            item_code=item_code or generate_number("I"),
            item_name=item_name,
            category=category,
            points_required=points_required,
            stock_quantity=stock_quantity,
            unit=unit,
            description=description
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def update_stock(db: Session, item_id: int, quantity_change: int, operator_id: str = None) -> InventoryItem:
        item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
        if not item:
            raise ValueError("物品不存在")

        new_stock = item.stock_quantity + quantity_change
        if new_stock < 0:
            raise ValueError("库存不能为负数")

        item.stock_quantity = new_stock
        db.commit()
        db.refresh(item)
        return item


class TransactionService:
    @staticmethod
    def get_account_balance(db: Session, account_id: int) -> dict:
        account = db.query(PointAccount).filter(PointAccount.id == account_id).first()
        if not account:
            raise ValueError("账户不存在")

        return {
            "account_number": account.account_number,
            "balance": account.balance,
            "frozen_balance": account.frozen_balance,
            "total_earned": account.total_earned,
            "total_exchanged": account.total_exchanged,
            "resident_name": account.resident.name if account.resident else None,
            "family_name": account.family.family_name if account.family else None
        }

    @staticmethod
    def list_transactions(db: Session, account_id: int = None, transaction_type: TransactionType = None,
                         status: TransactionStatus = None, needs_review: bool = None,
                         start_date: datetime = None, end_date: datetime = None,
                         skip: int = 0, limit: int = 100) -> List[PointTransaction]:
        query = db.query(PointTransaction)
        if account_id:
            query = query.filter(PointTransaction.account_id == account_id)
        if transaction_type:
            query = query.filter(PointTransaction.transaction_type == transaction_type)
        if status:
            query = query.filter(PointTransaction.status == status)
        if needs_review is not None:
            query = query.filter(PointTransaction.needs_review == needs_review)
        if start_date:
            query = query.filter(PointTransaction.created_at >= start_date)
        if end_date:
            query = query.filter(PointTransaction.created_at <= end_date)
        return query.order_by(PointTransaction.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def get_balance_history(db: Session, account_id: int) -> List[dict]:
        transactions = TransactionService.list_transactions(db, account_id=account_id)
        history = []
        for tx in transactions:
            history.append({
                "transaction_number": tx.transaction_number,
                "date": tx.created_at,
                "type": tx.transaction_type.value,
                "amount": tx.amount,
                "balance_before": tx.balance_before,
                "balance_after": tx.balance_after,
                "description": tx.description,
                "operator": tx.operator_id
            })
        return history

    @staticmethod
    def export_pending_review_transactions(db: Session) -> List[dict]:
        transactions = db.query(PointTransaction).filter(
            PointTransaction.needs_review == True
        ).order_by(PointTransaction.created_at.desc()).all()

        result = []
        for tx in transactions:
            result.append({
                "transaction_number": tx.transaction_number,
                "account_number": tx.account.account_number,
                "resident_name": tx.account.resident.name if tx.account.resident else None,
                "family_name": tx.account.family.family_name if tx.account.family else None,
                "transaction_type": tx.transaction_type.value,
                "amount": tx.amount,
                "balance_before": tx.balance_before,
                "balance_after": tx.balance_after,
                "description": tx.description,
                "created_at": tx.created_at,
                "operator_id": tx.operator_id
            })
        return result

    @staticmethod
    def review_transaction(db: Session, transaction_id: int, approved: bool,
                          review_note: str, reviewer_id: str) -> PointTransaction:
        transaction = db.query(PointTransaction).filter(
            PointTransaction.id == transaction_id
        ).first()
        if not transaction:
            raise ValueError("交易记录不存在")
        if not transaction.needs_review:
            raise ValueError("该交易不需要复核")

        transaction.needs_review = False
        transaction.status = TransactionStatus.CONFIRMED if approved else TransactionStatus.REJECTED
        transaction.review_note = review_note
        transaction.reviewed_by = reviewer_id
        transaction.reviewed_at = datetime.utcnow()

        if not approved:
            account = transaction.account
            if transaction.amount > 0:
                account.balance -= transaction.amount
                account.total_earned -= transaction.amount
            else:
                account.balance += abs(transaction.amount)
                account.total_exchanged -= abs(transaction.amount)

        db.commit()
        db.refresh(transaction)
        return transaction
