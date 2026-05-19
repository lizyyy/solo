from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from datetime import datetime
from typing import List, Tuple, Any
import json
import uuid

from models import (
    Order, Acceptance, Rework, Deduction, Settlement, AuditLog,
    BatchOperation, OrderStatus, Role
)
from schemas import (
    OrderCreate, OrderAssign, OrderComplete,
    AcceptanceCreate,
    ReworkCreate, ReworkComplete,
    DeductionCreate, DeductionApprove,
    SettlementCreate, SettlementPay,
    OperatorInfo, BatchResultItem
)


class AuditService:
    @staticmethod
    def log_action(
        db: Session,
        action: str,
        entity_type: str,
        entity_id: int,
        operator: OperatorInfo,
        details: dict = None,
        ip_address: str = None,
        user_agent: str = None
    ):
        audit_log = AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            operator_id=operator.operator_id,
            operator_name=operator.operator_name,
            operator_role=operator.operator_role,
            ip_address=ip_address,
            user_agent=user_agent,
            details=json.dumps(details) if details else None
        )
        db.add(audit_log)
        db.commit()


class IdempotencyService:
    @staticmethod
    def check_idempotency(db: Session, model: Any, idempotency_key: str) -> Tuple[bool, Any]:
        existing = db.query(model).filter(model.idempotency_key == idempotency_key).first()
        return (existing is not None, existing)


class OrderService:
    @staticmethod
    def create_order(db: Session, order_data: OrderCreate, operator: OperatorInfo) -> Order:
        exists, existing = IdempotencyService.check_idempotency(db, Order, order_data.idempotency_key)
        if exists:
            return existing

        db_order = Order(
            **order_data.model_dump(),
            created_by=operator.operator_id
        )
        db.add(db_order)
        db.commit()
        db.refresh(db_order)

        AuditService.log_action(
            db, "CREATE", "Order", db_order.id, operator,
            {"room_number": db_order.room_number, "status": db_order.status}
        )
        return db_order

    @staticmethod
    def assign_order(db: Session, order_id: int, assign_data: OrderAssign, operator: OperatorInfo) -> Order:
        db_order = db.query(Order).filter(Order.id == order_id).first()
        if not db_order:
            raise ValueError(f"Order {order_id} not found")
        if db_order.status not in [OrderStatus.PENDING, OrderStatus.ASSIGNED]:
            raise ValueError(f"Cannot assign order in status {db_order.status}")

        db_order.cleaner_id = assign_data.cleaner_id
        db_order.cleaner_name = assign_data.cleaner_name
        db_order.status = OrderStatus.ASSIGNED
        db_order.assigned_at = datetime.now()
        db_order.updated_by = operator.operator_id

        db.commit()
        db.refresh(db_order)

        AuditService.log_action(
            db, "ASSIGN", "Order", db_order.id, operator,
            {"cleaner_id": assign_data.cleaner_id, "cleaner_name": assign_data.cleaner_name}
        )
        return db_order

    @staticmethod
    def complete_order(db: Session, order_id: int, complete_data: OrderComplete, operator: OperatorInfo) -> Order:
        db_order = db.query(Order).filter(Order.id == order_id).first()
        if not db_order:
            raise ValueError(f"Order {order_id} not found")
        if db_order.status != OrderStatus.ASSIGNED:
            raise ValueError(f"Cannot complete order in status {db_order.status}")

        db_order.status = OrderStatus.COMPLETED
        db_order.completed_at = complete_data.completed_at or datetime.now()
        db_order.final_amount = db_order.estimated_amount
        db_order.updated_by = operator.operator_id

        db.commit()
        db.refresh(db_order)

        AuditService.log_action(
            db, "COMPLETE", "Order", db_order.id, operator,
            {"completed_at": db_order.completed_at.isoformat()}
        )
        return db_order

    @staticmethod
    def get_order(db: Session, order_id: int) -> Order:
        return db.query(Order).filter(Order.id == order_id).first()

    @staticmethod
    def query_orders(db: Session, query_params: dict, skip: int = 0, limit: int = 100) -> List[Order]:
        query = db.query(Order)
        if query_params.get("room_number"):
            query = query.filter(Order.room_number.contains(query_params["room_number"]))
        if query_params.get("status"):
            query = query.filter(Order.status == query_params["status"])
        if query_params.get("cleaner_id"):
            query = query.filter(Order.cleaner_id == query_params["cleaner_id"])
        if query_params.get("created_by"):
            query = query.filter(Order.created_by == query_params["created_by"])
        if query_params.get("start_date"):
            query = query.filter(Order.created_at >= query_params["start_date"])
        if query_params.get("end_date"):
            query = query.filter(Order.created_at <= query_params["end_date"])
        return query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()


class AcceptanceService:
    @staticmethod
    def create_acceptance(db: Session, acceptance_data: AcceptanceCreate, operator: OperatorInfo) -> Acceptance:
        exists, existing = IdempotencyService.check_idempotency(db, Acceptance, acceptance_data.idempotency_key)
        if exists:
            return existing

        db_order = db.query(Order).filter(Order.id == acceptance_data.order_id).first()
        if not db_order:
            raise ValueError(f"Order {acceptance_data.order_id} not found")
        if db_order.status != OrderStatus.COMPLETED:
            raise ValueError(f"Cannot accept order in status {db_order.status}")

        db_acceptance = Acceptance(
            **acceptance_data.model_dump(),
            created_by=operator.operator_id
        )
        db.add(db_acceptance)

        if acceptance_data.passed:
            db_order.status = OrderStatus.ACCEPTED
        else:
            db_order.status = OrderStatus.REWORK_REQUIRED
        db_order.updated_by = operator.operator_id

        db.commit()
        db.refresh(db_acceptance)

        AuditService.log_action(
            db, "ACCEPT", "Acceptance", db_acceptance.id, operator,
            {"order_id": acceptance_data.order_id, "passed": acceptance_data.passed}
        )
        return db_acceptance


class ReworkService:
    @staticmethod
    def create_rework(db: Session, rework_data: ReworkCreate, operator: OperatorInfo) -> Rework:
        exists, existing = IdempotencyService.check_idempotency(db, Rework, rework_data.idempotency_key)
        if exists:
            return existing

        db_order = db.query(Order).filter(Order.id == rework_data.order_id).first()
        if not db_order:
            raise ValueError(f"Order {rework_data.order_id} not found")

        existing_reworks = db.query(Rework).filter(Rework.order_id == rework_data.order_id).count()

        db_rework = Rework(
            **rework_data.model_dump(),
            rework_count=existing_reworks + 1,
            created_by=operator.operator_id
        )
        db.add(db_rework)
        db.commit()
        db.refresh(db_rework)

        AuditService.log_action(
            db, "REWORK_CREATE", "Rework", db_rework.id, operator,
            {"order_id": rework_data.order_id, "reason": rework_data.reason}
        )
        return db_rework

    @staticmethod
    def complete_rework(db: Session, rework_id: int, complete_data: ReworkComplete, operator: OperatorInfo) -> Rework:
        db_rework = db.query(Rework).filter(Rework.id == rework_id).first()
        if not db_rework:
            raise ValueError(f"Rework {rework_id} not found")
        if db_rework.completed:
            return db_rework

        db_rework.completed = True
        db_rework.completed_at = complete_data.completed_at or datetime.now()
        db_rework.updated_by = operator.operator_id

        db_order = db.query(Order).filter(Order.id == db_rework.order_id).first()
        if db_order:
            db_order.status = OrderStatus.COMPLETED
            db_order.updated_by = operator.operator_id

        db.commit()
        db.refresh(db_rework)

        AuditService.log_action(
            db, "REWORK_COMPLETE", "Rework", db_rework.id, operator,
            {"completed_at": db_rework.completed_at.isoformat()}
        )
        return db_rework


class DeductionService:
    @staticmethod
    def create_deduction(db: Session, deduction_data: DeductionCreate, operator: OperatorInfo) -> Deduction:
        exists, existing = IdempotencyService.check_idempotency(db, Deduction, deduction_data.idempotency_key)
        if exists:
            return existing

        db_order = db.query(Order).filter(Order.id == deduction_data.order_id).first()
        if not db_order:
            raise ValueError(f"Order {deduction_data.order_id} not found")

        db_deduction = Deduction(
            **deduction_data.model_dump(),
            created_by=operator.operator_id
        )
        db.add(db_deduction)
        db.commit()
        db.refresh(db_deduction)

        AuditService.log_action(
            db, "DEDUCTION_CREATE", "Deduction", db_deduction.id, operator,
            {
                "order_id": deduction_data.order_id,
                "amount": deduction_data.amount,
                "type": deduction_data.deduction_type.value
            }
        )
        return db_deduction

    @staticmethod
    def approve_deduction(db: Session, deduction_id: int, approve_data: DeductionApprove, operator: OperatorInfo) -> Deduction:
        db_deduction = db.query(Deduction).filter(Deduction.id == deduction_id).first()
        if not db_deduction:
            raise ValueError(f"Deduction {deduction_id} not found")
        if db_deduction.approved == approve_data.approved:
            return db_deduction

        db_deduction.approved = approve_data.approved
        db_deduction.approved_by = operator.operator_id
        db_deduction.approved_at = datetime.now()

        if approve_data.approved:
            db_order = db.query(Order).filter(Order.id == db_deduction.order_id).first()
            if db_order:
                db_order.final_amount = max(0, db_order.final_amount - db_deduction.amount)

        db.commit()
        db.refresh(db_deduction)

        AuditService.log_action(
            db, "DEDUCTION_APPROVE", "Deduction", db_deduction.id, operator,
            {"approved": approve_data.approved, "amount": db_deduction.amount}
        )
        return db_deduction

    @staticmethod
    def query_deductions(db: Session, query_params: dict, skip: int = 0, limit: int = 100) -> List[Deduction]:
        query = db.query(Deduction)
        if query_params.get("deduction_type"):
            query = query.filter(Deduction.deduction_type == query_params["deduction_type"])
        if "approved" in query_params and query_params["approved"] is not None:
            query = query.filter(Deduction.approved == query_params["approved"])
        if query_params.get("created_by"):
            query = query.filter(Deduction.created_by == query_params["created_by"])
        if query_params.get("start_date"):
            query = query.filter(Deduction.created_at >= query_params["start_date"])
        if query_params.get("end_date"):
            query = query.filter(Deduction.created_at <= query_params["end_date"])
        return query.order_by(Deduction.created_at.desc()).offset(skip).limit(limit).all()


class SettlementService:
    @staticmethod
    def create_settlement(db: Session, settlement_data: SettlementCreate, operator: OperatorInfo) -> Settlement:
        exists, existing = IdempotencyService.check_idempotency(db, Settlement, settlement_data.idempotency_key)
        if exists:
            return existing

        existing_settlement = db.query(Settlement).filter(Settlement.order_id == settlement_data.order_id).first()
        if existing_settlement:
            return existing_settlement

        total_deductions = db.query(Deduction).filter(
            Deduction.order_id == settlement_data.order_id,
            Deduction.approved == True
        ).with_entities(func.sum(Deduction.amount)).scalar() or 0

        db_settlement = Settlement(
            **settlement_data.model_dump(),
            total_deductions=total_deductions,
            final_settlement=max(0, settlement_data.base_amount - total_deductions),
            created_by=operator.operator_id
        )
        db.add(db_settlement)

        db_order = db.query(Order).filter(Order.id == settlement_data.order_id).first()
        if db_order:
            db_order.status = OrderStatus.CLOSED
            db_order.updated_by = operator.operator_id

        db.commit()
        db.refresh(db_settlement)

        AuditService.log_action(
            db, "SETTLEMENT_CREATE", "Settlement", db_settlement.id, operator,
            {
                "order_id": settlement_data.order_id,
                "base_amount": settlement_data.base_amount,
                "total_deductions": total_deductions,
                "final_settlement": db_settlement.final_settlement
            }
        )
        return db_settlement

    @staticmethod
    def pay_settlement(db: Session, settlement_id: int, pay_data: SettlementPay, operator: OperatorInfo) -> Settlement:
        db_settlement = db.query(Settlement).filter(Settlement.id == settlement_id).first()
        if not db_settlement:
            raise ValueError(f"Settlement {settlement_id} not found")
        if db_settlement.paid == pay_data.paid:
            return db_settlement

        db_settlement.paid = pay_data.paid
        db_settlement.paid_by = operator.operator_id
        db_settlement.paid_at = datetime.now()

        db.commit()
        db.refresh(db_settlement)

        AuditService.log_action(
            db, "SETTLEMENT_PAY", "Settlement", db_settlement.id, operator,
            {"paid": pay_data.paid}
        )
        return db_settlement

    @staticmethod
    def query_settlements(db: Session, query_params: dict, skip: int = 0, limit: int = 100) -> List[Settlement]:
        query = db.query(Settlement)
        if query_params.get("cleaner_id"):
            query = query.filter(Settlement.cleaner_id == query_params["cleaner_id"])
        if query_params.get("settlement_month"):
            query = query.filter(Settlement.settlement_month == query_params["settlement_month"])
        if "paid" in query_params and query_params["paid"] is not None:
            query = query.filter(Settlement.paid == query_params["paid"])
        if query_params.get("start_date"):
            query = query.filter(Settlement.created_at >= query_params["start_date"])
        if query_params.get("end_date"):
            query = query.filter(Settlement.created_at <= query_params["end_date"])
        return query.order_by(Settlement.created_at.desc()).offset(skip).limit(limit).all()


class BatchService:
    @staticmethod
    def create_batch_operation(db: Session, operation_type: str, total_count: int, operator: OperatorInfo) -> str:
        batch_id = str(uuid.uuid4())
        db_batch = BatchOperation(
            batch_id=batch_id,
            operation_type=operation_type,
            total_count=total_count,
            created_by=operator.operator_id
        )
        db.add(db_batch)
        db.commit()
        return batch_id

    @staticmethod
    def update_batch_operation(db: Session, batch_id: str, success_count: int, failed_count: int, status: str, error_details: str = None):
        db_batch = db.query(BatchOperation).filter(BatchOperation.batch_id == batch_id).first()
        if db_batch:
            db_batch.success_count = success_count
            db_batch.failed_count = failed_count
            db_batch.status = status
            db_batch.error_details = error_details
            if status == "completed":
                db_batch.completed_at = datetime.now()
            db.commit()

    @staticmethod
    def process_batch(
        db: Session,
        items: List[Any],
        process_func,
        operation_type: str,
        operator: OperatorInfo
    ) -> Tuple[str, List[BatchResultItem]]:
        batch_id = BatchService.create_batch_operation(db, operation_type, len(items), operator)
        results = []
        success_count = 0
        failed_count = 0
        errors = []

        for idx, item in enumerate(items):
            try:
                result = process_func(db, item, operator)
                results.append(BatchResultItem(index=idx, success=True, id=result.id))
                success_count += 1
            except Exception as e:
                results.append(BatchResultItem(index=idx, success=False, error=str(e)))
                failed_count += 1
                errors.append(f"Item {idx}: {str(e)}")

        BatchService.update_batch_operation(
            db, batch_id, success_count, failed_count, "completed",
            error_details="; ".join(errors) if errors else None
        )
        return batch_id, results


class AuditLogService:
    @staticmethod
    def query_logs(db: Session, query_params: dict, skip: int = 0, limit: int = 100) -> List[AuditLog]:
        query = db.query(AuditLog)
        if query_params.get("action"):
            query = query.filter(AuditLog.action.contains(query_params["action"]))
        if query_params.get("entity_type"):
            query = query.filter(AuditLog.entity_type == query_params["entity_type"])
        if query_params.get("operator_id"):
            query = query.filter(AuditLog.operator_id == query_params["operator_id"])
        if query_params.get("operator_role"):
            query = query.filter(AuditLog.operator_role == query_params["operator_role"])
        if query_params.get("start_date"):
            query = query.filter(AuditLog.created_at >= query_params["start_date"])
        if query_params.get("end_date"):
            query = query.filter(AuditLog.created_at <= query_params["end_date"])
        return query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
