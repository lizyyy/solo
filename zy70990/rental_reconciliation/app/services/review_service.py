from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, Dict, Any
from app.models import Order, Deduction, DepositRecord, ReviewRecord
from app.schemas import ReviewAction, ReviewRecordCreate, ReconciliationResult
from app.services.reconciliation_service import ReconciliationService
from app.config import settings


class ReviewService:
    def __init__(self, db: Session):
        self.db = db
        self.reconciliation_service = ReconciliationService(db)

    def execute_review_action(self, action: ReviewAction) -> Dict[str, Any]:
        result = {
            "success": False,
            "message": "",
            "review_record": None,
            "reconciliation_result": None
        }

        try:
            if action.target_type == "deduction":
                result = self._handle_deduction_action(action)
            elif action.target_type == "meter_reading":
                result = self._handle_meter_action(action)
            elif action.target_type == "deposit":
                result = self._handle_deposit_action(action)
            else:
                result["message"] = f"未知的目标类型: {action.target_type}"

            if result["success"] and action.target_type != "deposit":
                order_id = self._get_order_id_from_action(action)
                if order_id:
                    result["reconciliation_result"] = self.reconciliation_service.reconcile_order(order_id)

            return result

        except Exception as e:
            result["message"] = f"操作失败: {str(e)}"
            return result

    def _handle_deduction_action(self, action: ReviewAction) -> Dict[str, Any]:
        result = {"success": False, "message": "", "review_record": None}

        if action.action == "verify":
            deduction = self.db.query(Deduction).filter(Deduction.id == action.target_id).first()
            if not deduction:
                result["message"] = f"扣款记录 {action.target_id} 不存在"
                return result

            before_value = {"is_verified": deduction.is_verified, "amount": deduction.amount}

            deduction.is_verified = True
            deduction.verified_by = action.reviewer
            deduction.verified_at = datetime.now()

            after_value = {"is_verified": True, "amount": deduction.amount}

            review_record = ReviewRecord(
                order_id=deduction.order_id,
                review_type="deduction_verification",
                action="verify",
                before_value=before_value,
                after_value=after_value,
                reason=action.reason,
                reviewer=action.reviewer
            )
            self.db.add(review_record)

            self._sync_deposit_records(deduction.order_id)

            self.db.commit()
            result["success"] = True
            result["message"] = "扣款记录已验证"
            result["review_record"] = review_record

        elif action.action == "reject":
            deduction = self.db.query(Deduction).filter(Deduction.id == action.target_id).first()
            if not deduction:
                result["message"] = f"扣款记录 {action.target_id} 不存在"
                return result

            before_value = {"is_verified": deduction.is_verified, "amount": deduction.amount}

            deduction.is_verified = False

            after_value = {"is_verified": False, "amount": deduction.amount}

            review_record = ReviewRecord(
                order_id=deduction.order_id,
                review_type="deduction_rejection",
                action="reject",
                before_value=before_value,
                after_value=after_value,
                reason=action.reason,
                reviewer=action.reviewer
            )
            self.db.add(review_record)

            self._sync_deposit_records(deduction.order_id)

            self.db.commit()
            result["success"] = True
            result["message"] = "扣款记录已驳回"
            result["review_record"] = review_record

        elif action.action == "modify":
            deduction = self.db.query(Deduction).filter(Deduction.id == action.target_id).first()
            if not deduction:
                result["message"] = f"扣款记录 {action.target_id} 不存在"
                return result

            before_value = {
                "amount": deduction.amount,
                "description": deduction.description,
                "deduction_type": deduction.deduction_type
            }

            if "amount" in action.new_value:
                deduction.amount = action.new_value["amount"]
            if "description" in action.new_value:
                deduction.description = action.new_value["description"]
            if "deduction_type" in action.new_value:
                deduction.deduction_type = action.new_value["deduction_type"]

            after_value = {
                "amount": deduction.amount,
                "description": deduction.description,
                "deduction_type": deduction.deduction_type
            }

            review_record = ReviewRecord(
                order_id=deduction.order_id,
                review_type="deduction_modification",
                action="modify",
                before_value=before_value,
                after_value=after_value,
                reason=action.reason,
                reviewer=action.reviewer
            )
            self.db.add(review_record)

            self._sync_deposit_records(deduction.order_id)

            self.db.commit()
            result["success"] = True
            result["message"] = "扣款记录已修改"
            result["review_record"] = review_record

        else:
            result["message"] = f"未知的操作: {action.action}"

        return result

    def _handle_meter_action(self, action: ReviewAction) -> Dict[str, Any]:
        result = {"success": False, "message": "", "review_record": None}

        from app.models import MeterReading

        if action.action == "modify":
            reading = self.db.query(MeterReading).filter(MeterReading.id == action.target_id).first()
            if not reading:
                result["message"] = f"抄表记录 {action.target_id} 不存在"
                return result

            before_value = {
                "initial_reading": reading.initial_reading,
                "final_reading": reading.final_reading
            }

            if "initial_reading" in action.new_value:
                reading.initial_reading = action.new_value["initial_reading"]
            if "final_reading" in action.new_value:
                reading.final_reading = action.new_value["final_reading"]

            after_value = {
                "initial_reading": reading.initial_reading,
                "final_reading": reading.final_reading
            }

            review_record = ReviewRecord(
                order_id=reading.order_id,
                review_type="meter_reading_modification",
                action="modify",
                before_value=before_value,
                after_value=after_value,
                reason=action.reason,
                reviewer=action.reviewer
            )
            self.db.add(review_record)

            self._sync_deposit_records(reading.order_id)

            self.db.commit()
            result["success"] = True
            result["message"] = "抄表记录已修改"
            result["review_record"] = review_record

        else:
            result["message"] = f"未知的操作: {action.action}"

        return result

    def _handle_deposit_action(self, action: ReviewAction) -> Dict[str, Any]:
        result = {"success": False, "message": "", "review_record": None}

        if action.action == "refund_correction":
            order_id = action.new_value.get("order_id") if action.new_value else None
            if not order_id:
                result["message"] = "缺少订单ID"
                return result

            order = self.db.query(Order).filter(Order.id == order_id).first()
            if not order:
                result["message"] = f"订单 {order_id} 不存在"
                return result

            correction_amount = action.new_value.get("correction_amount", 0)
            current_balance = self._get_current_balance(order_id)

            before_value = {
                "current_balance": current_balance,
                "deposit_status": order.deposit_status
            }

            deposit_record = DepositRecord(
                order_id=order_id,
                transaction_type="correction",
                amount=correction_amount,
                balance=current_balance + correction_amount,
                operator=action.reviewer,
                remark=f"退款冲正: {action.reason}"
            )
            self.db.add(deposit_record)

            if current_balance + correction_amount >= 0:
                order.deposit_status = "completed"
            else:
                order.deposit_status = "pending"

            after_value = {
                "new_balance": current_balance + correction_amount,
                "deposit_status": order.deposit_status,
                "correction_amount": correction_amount
            }

            review_record = ReviewRecord(
                order_id=order_id,
                review_type="deposit_correction",
                action="refund_correction",
                before_value=before_value,
                after_value=after_value,
                reason=action.reason,
                reviewer=action.reviewer
            )
            self.db.add(review_record)

            self.db.commit()
            result["success"] = True
            result["message"] = "退款冲正已处理"
            result["review_record"] = review_record

        else:
            result["message"] = f"未知的操作: {action.action}"

        return result

    def _get_order_id_from_action(self, action: ReviewAction) -> Optional[str]:
        if action.target_type == "deduction" and action.target_id:
            deduction = self.db.query(Deduction).filter(Deduction.id == action.target_id).first()
            return deduction.order_id if deduction else None
        elif action.target_type == "meter_reading" and action.target_id:
            from app.models import MeterReading
            reading = self.db.query(MeterReading).filter(MeterReading.id == action.target_id).first()
            return reading.order_id if reading else None
        return None

    def _get_current_balance(self, order_id: str) -> float:
        order = self.db.query(Order).filter(Order.id == order_id).first()
        if not order:
            return 0

        balance = order.deposit_amount
        deposit_records = self.db.query(DepositRecord).filter(
            DepositRecord.order_id == order_id
        ).order_by(DepositRecord.created_at.asc()).all()

        for record in deposit_records:
            if record.transaction_type == "charge":
                balance += record.amount
            elif record.transaction_type in ["refund", "deduct", "correction"]:
                balance -= record.amount

        return balance

    def _sync_deposit_records(self, order_id: str):
        from app.models import MeterReading
        
        meter_readings = self.db.query(MeterReading).filter(
            MeterReading.order_id == order_id
        ).all()

        deductions = self.db.query(Deduction).filter(
            Deduction.order_id == order_id,
            Deduction.is_verified == True
        ).all()

        total_utility = 0
        for reading in meter_readings:
            consumption = reading.final_reading - reading.initial_reading
            consumption = max(0, consumption)
            if reading.meter_type in ["electricity", "electric"]:
                tier1_threshold = settings.ELECTRICITY_TIER_THRESHOLD_1
                tier2_threshold = settings.ELECTRICITY_TIER_THRESHOLD_2
                tier1_rate = settings.ELECTRICITY_TIER_RATE_1
                tier2_rate = settings.ELECTRICITY_TIER_RATE_2
                tier3_rate = settings.ELECTRICITY_TIER_RATE_3

                tier1_usage = min(consumption, tier1_threshold)
                tier1_cost = tier1_usage * tier1_rate

                remaining = consumption - tier1_usage
                tier2_usage = min(remaining, tier2_threshold - tier1_threshold) if remaining > 0 else 0
                tier2_cost = tier2_usage * tier2_rate

                remaining -= tier2_usage
                tier3_usage = max(0, remaining)
                tier3_cost = tier3_usage * tier3_rate

                total_utility += tier1_cost + tier2_cost + tier3_cost
            elif reading.meter_type == "water":
                total_utility += consumption * settings.WATER_RATE

        total_deduction = sum(d.amount for d in deductions)

        existing_utility_records = self.db.query(DepositRecord).filter(
            DepositRecord.order_id == order_id,
            DepositRecord.reference_type == "utility"
        ).first()

        if existing_utility_records:
            existing_utility_records.amount = total_utility
            existing_utility_records.balance = self._get_current_balance(order_id)
        else:
            current_balance = self._get_current_balance(order_id)
            deposit_record = DepositRecord(
                order_id=order_id,
                transaction_type="deduct",
                amount=total_utility,
                balance=current_balance - total_utility,
                reference_type="utility",
                operator="system",
                remark="水电费自动计算"
            )
            self.db.add(deposit_record)

        existing_deduction_records = self.db.query(DepositRecord).filter(
            DepositRecord.order_id == order_id,
            DepositRecord.reference_type == "deduction"
        ).first()

        if existing_deduction_records:
            existing_deduction_records.amount = total_deduction
            existing_deduction_records.balance = self._get_current_balance(order_id)
        else:
            current_balance = self._get_current_balance(order_id)
            deposit_record = DepositRecord(
                order_id=order_id,
                transaction_type="deduct",
                amount=total_deduction,
                balance=current_balance - total_deduction,
                reference_type="deduction",
                operator="system",
                remark="损坏扣款自动计算"
            )
            self.db.add(deposit_record)

        current_balance = self._get_current_balance(order_id)
        if current_balance >= 0:
            order = self.db.query(Order).filter(Order.id == order_id).first()
            if order:
                order.deposit_status = "completed"