import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from app.models import (
    CompensationRecord, Order, ElectricityRecord, ChargingPile,
    CompensationVoucher, OperationLog, CompensationStatus,
    FaultCategory, ConclusionType
)
from app.schemas import CompensationUploadRequest, CompensationSuggestion


class CompensationStateMachine:
    VALID_TRANSITIONS = {
        CompensationStatus.PENDING: [
            CompensationStatus.VERIFYING,
            CompensationStatus.APPROVED,
            CompensationStatus.REJECTED,
            CompensationStatus.CANCELLED,
            CompensationStatus.CLOSED
        ],
        CompensationStatus.VERIFYING: [
            CompensationStatus.APPROVED,
            CompensationStatus.REJECTED,
            CompensationStatus.PENDING,
            CompensationStatus.CANCELLED,
            CompensationStatus.CLOSED
        ],
        CompensationStatus.APPROVED: [
            CompensationStatus.COMPENSATED,
            CompensationStatus.REJECTED,
            CompensationStatus.CANCELLED,
            CompensationStatus.CLOSED
        ],
        CompensationStatus.COMPENSATED: [
            CompensationStatus.CLOSED,
            CompensationStatus.APPROVED
        ],
        CompensationStatus.REJECTED: [
            CompensationStatus.PENDING,
            CompensationStatus.CANCELLED,
            CompensationStatus.APPROVED,
            CompensationStatus.CLOSED
        ],
        CompensationStatus.CANCELLED: [
            CompensationStatus.PENDING,
            CompensationStatus.CLOSED
        ],
        CompensationStatus.CLOSED: [
            CompensationStatus.PENDING
        ]
    }

    @classmethod
    def can_transition(cls, from_status: str, to_status: str) -> bool:
        valid_next = cls.VALID_TRANSITIONS.get(from_status, [])
        return to_status in valid_next


class CompensationService:
    def __init__(self, db: Session):
        self.db = db

    def check_duplicate(
        self,
        case_no: str,
        order_no: str,
        user_id: str
    ) -> Tuple[bool, Optional[CompensationRecord]]:
        existing = self.db.query(CompensationRecord).filter(
            CompensationRecord.case_no == case_no
        ).first()
        if existing:
            return True, existing

        same_order = self.db.query(CompensationRecord).filter(
            CompensationRecord.order_no == order_no,
            CompensationRecord.user_id == user_id,
            CompensationRecord.status.in_([
                CompensationStatus.PENDING,
                CompensationStatus.VERIFYING,
                CompensationStatus.APPROVED,
                CompensationStatus.COMPENSATED
            ])
        ).first()
        if same_order:
            return True, same_order

        return False, None

    def verify_order(self, order_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        result = {
            "is_valid": True,
            "paid": False,
            "amount": 0,
            "has_amount": False,
            "has_time_range": False,
            "issues": []
        }

        if not order_data:
            result["is_valid"] = False
            result["issues"].append("订单数据缺失")
            return result

        pay_status = order_data.get("pay_status", "")
        amount = order_data.get("amount", 0)
        pay_time = order_data.get("pay_time")
        start_time = order_data.get("start_time")
        end_time = order_data.get("end_time")

        result["amount"] = amount

        if pay_status == "paid" or (pay_time and amount > 0):
            result["paid"] = True
        else:
            result["issues"].append("订单未支付")

        if amount and amount > 0:
            result["has_amount"] = True
        else:
            result["issues"].append("订单金额为0")

        if start_time and end_time:
            result["has_time_range"] = True
        else:
            result["issues"].append("订单时间不完整")

        if result["issues"]:
            result["is_valid"] = False

        return result

    def verify_electricity(self, electricity_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        result = {
            "has_record": False,
            "has_energy": False,
            "total_energy": 0,
            "time_matches": False,
            "issues": []
        }

        if not electricity_data:
            result["issues"].append("电量记录缺失")
            return result

        result["has_record"] = True

        total_energy = electricity_data.get("total_energy", 0) or \
            (electricity_data.get("end_energy", 0) - electricity_data.get("start_energy", 0))
        result["total_energy"] = total_energy

        if total_energy > 0:
            result["has_energy"] = True
        else:
            result["issues"].append("充电电量为0")

        start_time = electricity_data.get("start_time")
        end_time = electricity_data.get("end_time")
        if start_time and end_time and end_time > start_time:
            result["time_matches"] = True
        else:
            result["issues"].append("充电时间异常")

        return result

    def analyze_fault(
        self,
        order_verify: Dict[str, Any],
        electricity_verify: Dict[str, Any],
        fault_code: Optional[str] = None,
        fault_description: Optional[str] = None
    ) -> CompensationSuggestion:
        risk_warnings = []
        should_compensate = False
        reason = ""
        fault_category = FaultCategory.OTHER
        conclusion = ConclusionType.OTHER
        suggested_amount = 0.0

        if order_verify["paid"] and not electricity_verify["has_energy"]:
            fault_category = FaultCategory.PAYMENT_NO_ELECTRICITY
            conclusion = ConclusionType.PILE_FAULT
            should_compensate = True
            suggested_amount = order_verify.get("amount", 0)
            reason = "支付成功但无充电电量，属于典型的充电桩故障"
            risk_warnings.append("高频故障：支付成功无电量")

        elif fault_code:
            fault_code_upper = fault_code.upper()
            if "E0" in fault_code_upper or "HARDWARE" in fault_code_upper:
                fault_category = FaultCategory.HARDWARE_FAULT
                conclusion = ConclusionType.PILE_FAULT
                should_compensate = True
                reason = f"硬件故障代码 {fault_code}"
                suggested_amount = order_verify.get("amount", 0) * 0.8
            elif "NET" in fault_code_upper or "COMM" in fault_code_upper:
                fault_category = FaultCategory.NETWORK_FAULT
                conclusion = ConclusionType.NETWORK_ISSUE
                should_compensate = True
                reason = f"网络通讯故障 {fault_code}"
                suggested_amount = order_verify.get("amount", 0) * 0.5

        elif fault_description:
            desc_lower = fault_description.lower()
            if "无法充电" in desc_lower or "没充电" in desc_lower:
                fault_category = FaultCategory.PAYMENT_NO_ELECTRICITY
                conclusion = ConclusionType.PILE_FAULT
                should_compensate = True
                suggested_amount = order_verify.get("amount", 0)
                reason = "用户反馈无法充电"
            elif "多扣费" in desc_lower or "多收" in desc_lower:
                fault_category = FaultCategory.OVERCHARGE
                conclusion = ConclusionType.SYSTEM_ERROR
                should_compensate = True
                suggested_amount = order_verify.get("amount", 0) * 0.3
                reason = "用户反馈多扣费"

        if not should_compensate:
            reason = "故障特征不明显，建议人工复核"

        return CompensationSuggestion(
            should_compensate=should_compensate,
            reason=reason,
            suggested_amount=round(suggested_amount, 2),
            fault_category=fault_category,
            conclusion=conclusion,
            risk_warnings=risk_warnings
        )

    def create_or_update_record(
        self,
        request: CompensationUploadRequest,
        is_resubmit: bool = False
    ) -> Tuple[CompensationRecord, CompensationSuggestion, bool]:
        order_dict = request.order.model_dump() if request.order else {}
        electricity_dict = request.electricity.model_dump() if request.electricity else {}

        order_verify = self.verify_order(order_dict)
        electricity_verify = self.verify_electricity(electricity_dict)

        suggestion = self.analyze_fault(
            order_verify,
            electricity_verify,
            request.fault_code,
            request.fault_description
        )

        is_duplicate, existing = self.check_duplicate(
            request.case_no,
            request.order_no,
            request.user_id
        )

        if is_duplicate and existing and not is_resubmit:
            return existing, suggestion, True

        order = None
        if request.order:
            order = self.db.query(Order).filter(
                Order.order_no == request.order.order_no
            ).first()
            if not order:
                order = Order(**request.order.model_dump())
                self.db.add(order)
            else:
                for key, value in request.order.model_dump(exclude_unset=True).items():
                    setattr(order, key, value)

        electricity = None
        if request.electricity:
            electricity = self.db.query(ElectricityRecord).filter(
                ElectricityRecord.record_no == request.electricity.record_no
            ).first()
            if not electricity:
                electricity = ElectricityRecord(**request.electricity.model_dump())
                self.db.add(electricity)
            else:
                for key, value in request.electricity.model_dump(exclude_unset=True).items():
                    setattr(electricity, key, value)

        pile = self.db.query(ChargingPile).filter(
            ChargingPile.pile_no == request.pile_no
        ).first()
        if not pile:
            pile = ChargingPile(pile_no=request.pile_no)
            self.db.add(pile)

        self.db.flush()

        raw_input_json = json.dumps(request.raw_input or {}, ensure_ascii=False)

        if existing and is_resubmit:
            existing.batch_no = request.batch_no
            existing.user_id = request.user_id
            existing.pile_no = request.pile_no
            existing.order_no = request.order_no
            existing.fault_code = request.fault_code
            existing.description = request.description
            existing.raw_input = raw_input_json
            existing.fault_category = suggestion.fault_category
            existing.suggestion = suggestion.reason
            existing.compensation_amount = suggestion.suggested_amount
            existing.conclusion = suggestion.conclusion
            existing.status = CompensationStatus.PENDING
            existing.order_id = order.id if order else None
            existing.electricity_id = electricity.id if electricity else None
            existing.pile_id = pile.id if pile else None
            record = existing

            self._add_operation_log(
                record.id,
                "resubmit",
                record.status,
                CompensationStatus.PENDING,
                "system",
                "撤回后重新提交"
            )
        else:
            record = CompensationRecord(
                batch_no=request.batch_no,
                case_no=request.case_no,
                user_id=request.user_id,
                pile_no=request.pile_no,
                order_no=request.order_no,
                fault_code=request.fault_code,
                fault_category=suggestion.fault_category,
                description=request.description,
                raw_input=raw_input_json,
                suggestion=suggestion.reason,
                compensation_amount=suggestion.suggested_amount,
                conclusion=suggestion.conclusion,
                is_duplicate=is_duplicate,
                status=CompensationStatus.PENDING,
                order_id=order.id if order else None,
                electricity_id=electricity.id if electricity else None,
                pile_id=pile.id if pile else None
            )
            self.db.add(record)

        self.db.flush()
        return record, suggestion, False

    def confirm_record(
        self,
        case_no: str,
        operator: str,
        approved: bool,
        conclusion: Optional[str] = None,
        compensation_amount: Optional[float] = None,
        remark: Optional[str] = None
    ) -> Optional[CompensationRecord]:
        record = self.db.query(CompensationRecord).filter(
            CompensationRecord.case_no == case_no
        ).first()

        if not record:
            return None

        old_status = record.status

        if approved:
            new_status = CompensationStatus.APPROVED
            if compensation_amount is not None:
                record.compensation_amount = compensation_amount
        else:
            new_status = CompensationStatus.REJECTED

        if conclusion:
            record.conclusion = conclusion

        record.status = new_status
        record.operator = operator
        record.confirmed_at = datetime.utcnow()

        self._add_operation_log(
            record.id,
            "confirm",
            old_status,
            new_status,
            operator,
            remark or ("批准补偿" if approved else "拒绝补偿")
        )

        self.db.flush()
        return record

    def cancel_record(
        self,
        case_no: str,
        operator: str,
        remark: str
    ) -> Optional[CompensationRecord]:
        record = self.db.query(CompensationRecord).filter(
            CompensationRecord.case_no == case_no
        ).first()

        if not record:
            return None

        old_status = record.status
        record.status = CompensationStatus.CANCELLED

        self._add_operation_log(
            record.id,
            "cancel",
            old_status,
            CompensationStatus.CANCELLED,
            operator,
            remark
        )

        self.db.flush()
        return record

    def rejudge_record(
        self,
        case_no: str,
        operator: str,
        new_status: str,
        conclusion: Optional[str] = None,
        compensation_amount: Optional[float] = None,
        remark: str = ""
    ) -> Optional[CompensationRecord]:
        record = self.db.query(CompensationRecord).filter(
            CompensationRecord.case_no == case_no
        ).first()

        if not record:
            return None

        old_status = record.status

        if not CompensationStateMachine.can_transition(old_status, new_status):
            raise ValueError(f"无效的状态转换: {old_status} -> {new_status}")

        record.status = new_status
        record.operator = operator

        if conclusion:
            record.conclusion = conclusion
        if compensation_amount is not None:
            record.compensation_amount = compensation_amount

        if new_status == CompensationStatus.CLOSED:
            record.closed_at = datetime.utcnow()

        self._add_operation_log(
            record.id,
            "rejudge",
            old_status,
            new_status,
            operator,
            remark
        )

        self.db.flush()
        return record

    def _add_operation_log(
        self,
        record_id: int,
        operation: str,
        old_status: str,
        new_status: str,
        operator: str,
        remark: str
    ):
        log = OperationLog(
            compensation_record_id=record_id,
            operation=operation,
            old_status=old_status,
            new_status=new_status,
            operator=operator,
            remark=remark
        )
        self.db.add(log)

    def get_record(self, case_no: str) -> Optional[CompensationRecord]:
        return self.db.query(CompensationRecord).filter(
            CompensationRecord.case_no == case_no
        ).first()

    def get_operation_logs(self, record_id: int) -> List[OperationLog]:
        return self.db.query(OperationLog).filter(
            OperationLog.compensation_record_id == record_id
        ).order_by(OperationLog.created_at.desc()).all()

    def query_records(
        self,
        case_no: Optional[str] = None,
        user_id: Optional[str] = None,
        pile_no: Optional[str] = None,
        order_no: Optional[str] = None,
        status: Optional[str] = None,
        batch_no: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[CompensationRecord], int]:
        query = self.db.query(CompensationRecord)

        if case_no:
            query = query.filter(CompensationRecord.case_no == case_no)
        if user_id:
            query = query.filter(CompensationRecord.user_id == user_id)
        if pile_no:
            query = query.filter(CompensationRecord.pile_no == pile_no)
        if order_no:
            query = query.filter(CompensationRecord.order_no == order_no)
        if status:
            query = query.filter(CompensationRecord.status == status)
        if batch_no:
            query = query.filter(CompensationRecord.batch_no == batch_no)
        if start_date:
            query = query.filter(CompensationRecord.created_at >= start_date)
        if end_date:
            query = query.filter(CompensationRecord.created_at <= end_date)

        total = query.count()
        records = query.order_by(CompensationRecord.created_at.desc()) \
            .offset((page - 1) * page_size) \
            .limit(page_size) \
            .all()

        return records, total
