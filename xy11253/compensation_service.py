import uuid
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from models import (
    Order, OrderItem, ShortageRecord, CompensationRecord,
    Coupon, SettlementRecord, SettlementItem,
    ShortageStatus, CompensationStatus, CouponStatus, SettlementStatus, CompensationType
)
from schemas import (
    ShortageIdentifyRequest, ShortageConfirmRequest, CompensationRequest,
    RollbackRequest, SettlementRequest, OperatorContext, OperationResult
)
from rules import RuleEngine
from idempotent import IdempotentManager
from audit_service import AuditService


class CompensationService:
    def __init__(self, db: Session):
        self.db = db
        self.rule_engine = RuleEngine(db)
        self.audit_service = AuditService(db)

    def _generate_no(self, prefix: str) -> str:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        unique_id = str(uuid.uuid4())[:8].upper()
        return f"{prefix}{timestamp}{unique_id}"

    def identify_shortage(
        self,
        request: ShortageIdentifyRequest,
        operator_context: OperatorContext
    ) -> OperationResult:
        idempotent_key = request.idempotent_key or IdempotentManager.generate_key("identify", request.dict())
        existing_hash = IdempotentManager.get_existing_result(self.db, idempotent_key)
        if existing_hash:
            return OperationResult(
                success=True,
                message="重复请求，操作已处理",
                data={"idempotent": True}
            )

        order = self.db.query(Order).filter(Order.order_no == request.order_no).first()
        if not order:
            return OperationResult(
                success=False,
                message=f"订单{request.order_no}不存在",
                rule_results=[]
            )

        order_item = self.db.query(OrderItem).filter(
            OrderItem.order_id == order.id,
            OrderItem.product_id == request.product_id
        ).first()
        if not order_item:
            return OperationResult(
                success=False,
                message=f"订单{request.order_no}中不存在商品{request.product_id}",
                rule_results=[]
            )

        shortage = ShortageRecord(
            shortage_no=self._generate_no("S"),
            order_id=order.id,
            order_item_id=order_item.id,
            product_id=order_item.product_id,
            product_name=order_item.product_name,
            shortage_quantity=request.shortage_quantity,
            shortage_amount=request.shortage_quantity * order_item.unit_price,
            status=ShortageStatus.IDENTIFIED,
            identified_by=operator_context.operator_name,
            identified_at=datetime.utcnow(),
            remark=request.remark
        )

        rule_context = {
            "shortage": shortage,
            "order_item": order_item,
            "operator_role": operator_context.operator_role,
            "operation": "identify",
        }
        rule_results = self.rule_engine.validate(rule_context, ["partial_shortage", "role_permission"])

        if self.rule_engine.has_blocking_rule(rule_results):
            self.audit_service.log_operation(
                operation_type="identify",
                operator_context=operator_context,
                result="blocked",
                reason=";".join(self.rule_engine.get_blocking_reasons(rule_results)),
                reference_type="shortage",
                request_data=request.dict()
            )
            return OperationResult(
                success=False,
                message="规则校验不通过",
                rule_results=rule_results
            )

        order_item.is_shortage = True
        order_item.shortage_quantity = request.shortage_quantity

        self.db.add(shortage)
        self.db.commit()
        self.db.refresh(shortage)

        IdempotentManager.check_and_set(self.db, idempotent_key, "identify", shortage.shortage_no)

        self.audit_service.log_operation(
            operation_type="identify",
            operator_context=operator_context,
            result="allowed",
            reason="缺货识别成功",
            reference_type="shortage",
            reference_id=shortage.shortage_no,
            request_data=request.dict(),
            response_data={"shortage_no": shortage.shortage_no}
        )

        return OperationResult(
            success=True,
            message="缺货识别成功",
            data={"shortage_no": shortage.shortage_no, "shortage_id": shortage.id},
            rule_results=rule_results
        )

    def confirm_shortage(
        self,
        request: ShortageConfirmRequest,
        operator_context: OperatorContext
    ) -> OperationResult:
        idempotent_key = request.idempotent_key or IdempotentManager.generate_key("confirm", request.dict())
        existing_hash = IdempotentManager.get_existing_result(self.db, idempotent_key)
        if existing_hash:
            return OperationResult(
                success=True,
                message="重复请求，操作已处理",
                data={"idempotent": True}
            )

        shortage = self.db.query(ShortageRecord).filter(
            ShortageRecord.shortage_no == request.shortage_no
        ).first()
        if not shortage:
            return OperationResult(
                success=False,
                message=f"缺货记录{request.shortage_no}不存在",
                rule_results=[]
            )

        rule_context = {
            "current_status": shortage.status,
            "target_status": ShortageStatus.CONFIRMED if request.confirmed else ShortageStatus.CANCELLED,
            "record_type": "shortage",
            "operator_role": operator_context.operator_role,
            "operation": "confirm",
        }
        rule_results = self.rule_engine.validate(rule_context, ["status_transition", "role_permission"])

        if self.rule_engine.has_blocking_rule(rule_results):
            self.audit_service.log_operation(
                operation_type="confirm",
                operator_context=operator_context,
                result="blocked",
                reason=";".join(self.rule_engine.get_blocking_reasons(rule_results)),
                reference_type="shortage",
                reference_id=shortage.shortage_no,
                request_data=request.dict()
            )
            return OperationResult(
                success=False,
                message="规则校验不通过",
                rule_results=rule_results
            )

        if request.confirmed:
            shortage.status = ShortageStatus.CONFIRMED
            shortage.confirmed_by = operator_context.operator_name
            shortage.confirmed_at = datetime.utcnow()
        else:
            shortage.status = ShortageStatus.CANCELLED

        shortage.remark = request.remark or shortage.remark
        self.db.commit()
        self.db.refresh(shortage)

        IdempotentManager.check_and_set(self.db, idempotent_key, "confirm", shortage.shortage_no)

        self.audit_service.log_operation(
            operation_type="confirm",
            operator_context=operator_context,
            result="allowed",
            reason="缺货确认成功",
            reference_type="shortage",
            reference_id=shortage.shortage_no,
            request_data=request.dict()
        )

        return OperationResult(
            success=True,
            message="缺货确认成功",
            data={"shortage_no": shortage.shortage_no, "status": shortage.status.value},
            rule_results=rule_results
        )

    def process_compensation(
        self,
        request: CompensationRequest,
        operator_context: OperatorContext
    ) -> OperationResult:
        idempotent_key = request.idempotent_key or IdempotentManager.generate_key("compensate", request.dict())
        existing_hash = IdempotentManager.get_existing_result(self.db, idempotent_key)
        if existing_hash:
            return OperationResult(
                success=True,
                message="重复请求，操作已处理",
                data={"idempotent": True}
            )

        shortage = self.db.query(ShortageRecord).filter(
            ShortageRecord.shortage_no == request.shortage_no
        ).first()
        if not shortage:
            return OperationResult(
                success=False,
                message=f"缺货记录{request.shortage_no}不存在",
                rule_results=[]
            )

        amount = request.amount or 0
        coupon_value = request.coupon_value or 0

        if request.compensation_type == CompensationType.REFUND:
            amount = shortage.shortage_amount
            coupon_value = 0
        elif request.compensation_type == CompensationType.COUPON:
            amount = 0
            coupon_value = coupon_value or shortage.shortage_amount

        compensation = CompensationRecord(
            compensation_no=self._generate_no("C"),
            shortage_id=shortage.id,
            compensation_type=request.compensation_type,
            amount=amount,
            coupon_value=coupon_value,
            exchange_product_id=request.exchange_product_id,
            exchange_product_name=request.exchange_product_name,
            status=CompensationStatus.APPROVED,
            operator_role=operator_context.operator_role.value,
            operator_id=operator_context.operator_id,
            operator_name=operator_context.operator_name,
            remark=request.remark
        )

        rule_context = {
            "shortage": shortage,
            "compensation": compensation,
            "compensation_type": request.compensation_type,
            "operator_role": operator_context.operator_role,
            "operation": "compensate",
        }
        rule_results = self.rule_engine.validate(
            rule_context,
            ["duplicate_compensation", "amount_consistency", "role_permission"]
        )

        if self.rule_engine.has_blocking_rule(rule_results):
            self.audit_service.log_operation(
                operation_type="compensate",
                operator_context=operator_context,
                result="blocked",
                reason=";".join(self.rule_engine.get_blocking_reasons(rule_results)),
                reference_type="compensation",
                request_data=request.dict()
            )
            return OperationResult(
                success=False,
                message="规则校验不通过",
                rule_results=rule_results
            )

        self.db.add(compensation)

        if request.compensation_type in [CompensationType.COUPON, CompensationType.PARTIAL_REFUND]:
            coupon_expiry = datetime.utcnow() + timedelta(days=request.coupon_expiry_days or 30)
            coupon = Coupon(
                coupon_no=self._generate_no("CP"),
                compensation_id=compensation.id,
                customer_id=shortage.order.customer_id,
                value=coupon_value,
                status=CouponStatus.ACTIVE,
                issue_date=datetime.utcnow(),
                expiry_date=coupon_expiry,
                created_by=operator_context.operator_name
            )
            self.db.add(coupon)
            compensation.coupon_id = coupon.coupon_no

        compensation.status = CompensationStatus.PROCESSED
        compensation.processed_at = datetime.utcnow()
        shortage.status = ShortageStatus.COMPENSATED

        self.db.commit()
        self.db.refresh(compensation)

        IdempotentManager.check_and_set(self.db, idempotent_key, "compensate", compensation.compensation_no)

        self.audit_service.log_operation(
            operation_type="compensate",
            operator_context=operator_context,
            result="allowed",
            reason="补偿处理成功",
            reference_type="compensation",
            reference_id=compensation.compensation_no,
            request_data=request.dict(),
            response_data={"compensation_no": compensation.compensation_no}
        )

        return OperationResult(
            success=True,
            message="补偿处理成功",
            data={
                "compensation_no": compensation.compensation_no,
                "compensation_id": compensation.id,
                "coupon_no": compensation.coupon_id
            },
            rule_results=rule_results
        )

    def rollback_compensation(
        self,
        request: RollbackRequest,
        operator_context: OperatorContext
    ) -> OperationResult:
        idempotent_key = request.idempotent_key or IdempotentManager.generate_key("rollback", request.dict())
        existing_hash = IdempotentManager.get_existing_result(self.db, idempotent_key)
        if existing_hash:
            return OperationResult(
                success=True,
                message="重复请求，操作已处理",
                data={"idempotent": True}
            )

        compensation = self.db.query(CompensationRecord).filter(
            CompensationRecord.compensation_no == request.compensation_no
        ).first()
        if not compensation:
            return OperationResult(
                success=False,
                message=f"补偿记录{request.compensation_no}不存在",
                rule_results=[]
            )

        rule_context = {
            "current_status": compensation.status,
            "target_status": CompensationStatus.ROLLED_BACK,
            "record_type": "compensation",
            "operator_role": operator_context.operator_role,
            "operation": "rollback",
        }
        rule_results = self.rule_engine.validate(rule_context, ["status_transition", "role_permission"])

        if self.rule_engine.has_blocking_rule(rule_results):
            self.audit_service.log_operation(
                operation_type="rollback",
                operator_context=operator_context,
                result="blocked",
                reason=";".join(self.rule_engine.get_blocking_reasons(rule_results)),
                reference_type="compensation",
                reference_id=compensation.compensation_no,
                request_data=request.dict()
            )
            return OperationResult(
                success=False,
                message="规则校验不通过",
                rule_results=rule_results
            )

        compensation.status = CompensationStatus.ROLLED_BACK
        compensation.rolled_back_by = operator_context.operator_name
        compensation.rolled_back_at = datetime.utcnow()
        compensation.rollback_reason = request.reason

        if compensation.coupon_id:
            coupon = self.db.query(Coupon).filter(Coupon.coupon_no == compensation.coupon_id).first()
            if coupon and coupon.status == CouponStatus.ACTIVE:
                coupon.status = CouponStatus.CANCELLED

        shortage = self.db.query(ShortageRecord).filter(ShortageRecord.id == compensation.shortage_id).first()
        if shortage:
            shortage.status = ShortageStatus.CONFIRMED

        self.db.commit()
        self.db.refresh(compensation)

        IdempotentManager.check_and_set(self.db, idempotent_key, "rollback", compensation.compensation_no)

        self.audit_service.log_operation(
            operation_type="rollback",
            operator_context=operator_context,
            result="allowed",
            reason="补偿回滚成功",
            reference_type="compensation",
            reference_id=compensation.compensation_no,
            request_data=request.dict()
        )

        return OperationResult(
            success=True,
            message="补偿回滚成功",
            data={"compensation_no": compensation.compensation_no, "status": compensation.status.value},
            rule_results=rule_results
        )

    def process_settlement(
        self,
        request: SettlementRequest,
        operator_context: OperatorContext
    ) -> OperationResult:
        idempotent_key = request.idempotent_key or IdempotentManager.generate_key("settle", request.dict())
        existing_hash = IdempotentManager.get_existing_result(self.db, idempotent_key)
        if existing_hash:
            return OperationResult(
                success=True,
                message="重复请求，操作已处理",
                data={"idempotent": True}
            )

        rule_context = {
            "operator_role": operator_context.operator_role,
            "operation": "settle",
        }
        rule_results = self.rule_engine.validate(rule_context, ["role_permission"])

        if self.rule_engine.has_blocking_rule(rule_results):
            self.audit_service.log_operation(
                operation_type="settle",
                operator_context=operator_context,
                result="blocked",
                reason=";".join(self.rule_engine.get_blocking_reasons(rule_results)),
                request_data=request.dict()
            )
            return OperationResult(
                success=False,
                message="规则校验不通过",
                rule_results=rule_results
            )

        start_dt = datetime.combine(request.start_date, datetime.min.time())
        end_dt = datetime.combine(request.end_date, datetime.max.time())

        shortages = self.db.query(ShortageRecord).filter(
            ShortageRecord.status == ShortageStatus.COMPENSATED,
            ShortageRecord.identified_at >= start_dt,
            ShortageRecord.identified_at <= end_dt
        ).all()

        if not shortages:
            return OperationResult(
                success=False,
                message="该时间段内没有待结算的缺货记录",
                rule_results=rule_results
            )

        settlement = SettlementRecord(
            settlement_no=self._generate_no("SET"),
            settlement_date=date.today(),
            total_shortage_count=len(shortages),
            total_shortage_amount=sum(s.shortage_amount for s in shortages),
            total_refund_amount=0,
            total_coupon_value=0,
            status=SettlementStatus.PENDING,
            operator_role=operator_context.operator_role.value,
            operator_id=operator_context.operator_id,
            operator_name=operator_context.operator_name,
            remark=request.remark
        )

        self.db.add(settlement)
        self.db.flush()

        for shortage in shortages:
            compensation = self.db.query(CompensationRecord).filter(
                CompensationRecord.shortage_id == shortage.id,
                CompensationRecord.status == CompensationStatus.PROCESSED
            ).first()

            settlement_item = SettlementItem(
                settlement_id=settlement.id,
                shortage_id=shortage.id,
                compensation_id=compensation.id if compensation else None,
                shortage_amount=shortage.shortage_amount,
                compensation_amount=compensation.amount if compensation else 0
            )
            self.db.add(settlement_item)

            if compensation:
                if compensation.compensation_type in [CompensationType.REFUND, CompensationType.PARTIAL_REFUND]:
                    settlement.total_refund_amount += compensation.amount
                if compensation.compensation_type in [CompensationType.COUPON, CompensationType.PARTIAL_REFUND]:
                    settlement.total_coupon_value += compensation.coupon_value

            shortage.status = ShortageStatus.SETTLED

        settlement.status = SettlementStatus.PROCESSED
        settlement.processed_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(settlement)

        IdempotentManager.check_and_set(self.db, idempotent_key, "settle", settlement.settlement_no)

        self.audit_service.log_operation(
            operation_type="settle",
            operator_context=operator_context,
            result="allowed",
            reason="结算处理成功",
            reference_type="settlement",
            reference_id=settlement.settlement_no,
            request_data=request.dict(),
            response_data={"settlement_no": settlement.settlement_no}
        )

        return OperationResult(
            success=True,
            message="结算处理成功",
            data={
                "settlement_no": settlement.settlement_no,
                "settlement_id": settlement.id,
                "total_shortage_count": settlement.total_shortage_count,
                "total_shortage_amount": settlement.total_shortage_amount,
                "total_refund_amount": settlement.total_refund_amount,
                "total_coupon_value": settlement.total_coupon_value
            },
            rule_results=rule_results
        )
