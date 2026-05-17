from datetime import datetime, timedelta
from typing import Optional, List, Dict, Tuple
from collections import defaultdict
import uuid

from .models import (
    Machine, PaymentRecord, StartEvent, RefundApplication,
    TroubleshootingResult, VerificationResult, ConclusionStatus,
    FaultCode, PaymentStatus, StartEventStatus, RefundStatus,
    FAULT_DESCRIPTIONS
)


class PaymentVerifier:
    @staticmethod
    def verify(payment: Optional[PaymentRecord]) -> Tuple[VerificationResult, Dict]:
        details = {}

        if not payment:
            details["error"] = "支付记录不存在"
            details["severity"] = "critical"
            return VerificationResult.FAIL, details

        details["payment_id"] = payment.payment_id
        details["amount"] = payment.amount
        details["status"] = payment.status
        details["pay_time"] = payment.pay_time.isoformat() if payment.pay_time else None

        if payment.status == PaymentStatus.FAILED:
            details["issue"] = "支付失败，无法进行后续操作"
            details["severity"] = "critical"
            return VerificationResult.FAIL, details

        if payment.status == PaymentStatus.PENDING:
            details["issue"] = "支付正在处理中，请稍后再试"
            details["severity"] = "warning"
            return VerificationResult.PENDING, details

        if payment.status in [PaymentStatus.REFUNDED, PaymentStatus.PARTIAL_REFUNDED]:
            details["issue"] = "该订单已退款或部分退款"
            details["severity"] = "warning"
            return VerificationResult.WARNING, details

        if not payment.pay_time:
            details["issue"] = "支付时间缺失，可能是异常订单"
            details["severity"] = "warning"
            return VerificationResult.WARNING, details

        details["result"] = "支付核验通过，订单有效"
        return VerificationResult.PASS, details


class EventMatcher:
    TIME_WINDOW_SECONDS = 300

    @staticmethod
    def match(
        payment: Optional[PaymentRecord],
        events: List[StartEvent],
        machine_id: str
    ) -> Tuple[VerificationResult, Dict]:
        details = {}
        details["machine_id"] = machine_id
        details["total_events_found"] = len(events)

        if not events:
            details["error"] = "未找到任何启动事件"
            details["severity"] = "critical"
            return VerificationResult.FAIL, details

        machine_events = [e for e in events if e.machine_id == machine_id]
        details["machine_events_count"] = len(machine_events)

        if not machine_events:
            details["error"] = "该机器无相关启动事件"
            details["severity"] = "critical"
            return VerificationResult.FAIL, details

        matched_events = []
        if payment:
            for event in machine_events:
                if event.payment_id == payment.payment_id:
                    matched_events.append(event)

                elif payment.pay_time:
                    time_diff = abs((event.start_time - payment.pay_time).total_seconds())
                    if time_diff <= EventMatcher.TIME_WINDOW_SECONDS:
                        matched_events.append(event)
                        details[f"event_{event.event_id}_time_match"] = f"时间差: {time_diff:.1f}秒"
        else:
            matched_events = machine_events

        details["matched_events_count"] = len(matched_events)

        if not matched_events:
            details["error"] = "未找到与支付匹配的启动事件"
            details["severity"] = "critical"
            return VerificationResult.FAIL, details

        failed_events = [e for e in matched_events if e.status != StartEventStatus.SUCCESS]
        details["failed_events_count"] = len(failed_events)

        if failed_events:
            details["failed_events"] = []
            for e in failed_events:
                event_info = {
                    "event_id": e.event_id,
                    "status": e.status,
                    "fault_code": e.fault_code,
                    "start_time": e.start_time.isoformat(),
                    "error_message": e.error_message
                }
                details["failed_events"].append(event_info)

            if len(failed_events) == len(matched_events):
                details["result"] = "所有匹配的启动事件均失败，确认存在启动问题"
                return VerificationResult.PASS, details
            else:
                details["result"] = "存在失败的启动事件，但也有成功的，需要进一步核查"
                return VerificationResult.WARNING, details

        details["result"] = "所有匹配的启动事件均成功"
        return VerificationResult.FAIL, details


class RefundStateMachine:
    VALID_TRANSITIONS = {
        RefundStatus.PENDING: [RefundStatus.PROCESSING, RefundStatus.REJECTED],
        RefundStatus.PROCESSING: [RefundStatus.APPROVED, RefundStatus.REJECTED],
        RefundStatus.APPROVED: [RefundStatus.COMPLETED, RefundStatus.FAILED],
        RefundStatus.COMPLETED: [],
        RefundStatus.REJECTED: [],
        RefundStatus.FAILED: [RefundStatus.PROCESSING],
    }

    @staticmethod
    def check(
        refund: Optional[RefundApplication],
        payment: Optional[PaymentRecord]
    ) -> Tuple[VerificationResult, Dict]:
        details = {}

        if not refund:
            details["info"] = "暂无退款申请记录"
            details["current_state"] = "none"
            details["next_possible_state"] = RefundStatus.PENDING
            return VerificationResult.PENDING, details

        details["refund_id"] = refund.refund_id
        details["current_status"] = refund.status
        details["apply_time"] = refund.apply_time.isoformat()
        details["refund_amount"] = refund.refund_amount

        if payment:
            if refund.refund_amount > payment.amount:
                details["issue"] = "退款金额大于支付金额，异常情况"
                details["severity"] = "critical"
                return VerificationResult.FAIL, details

            if refund.refund_amount == payment.amount:
                details["refund_type"] = "全额退款"
            else:
                details["refund_type"] = "部分退款"

        if refund.status == RefundStatus.PENDING:
            details["state_description"] = "退款申请已提交，等待处理"
            details["next_step"] = "进入处理流程"
        elif refund.status == RefundStatus.PROCESSING:
            details["state_description"] = "退款正在处理中"
            details["next_step"] = "等待处理结果"
        elif refund.status == RefundStatus.APPROVED:
            details["state_description"] = "退款已批准，等待转账完成"
            details["next_step"] = "等待银行处理"
        elif refund.status == RefundStatus.COMPLETED:
            details["state_description"] = "退款已完成"
            details["next_step"] = "流程结束"
        elif refund.status == RefundStatus.REJECTED:
            details["state_description"] = "退款已拒绝"
            details["next_step"] = "流程结束，可重新申请"
        elif refund.status == RefundStatus.FAILED:
            details["state_description"] = "退款处理失败"
            details["next_step"] = "可重新发起处理流程"

        return VerificationResult.PASS, details

    @staticmethod
    def can_transition(current: RefundStatus, target: RefundStatus) -> bool:
        return target in RefundStateMachine.VALID_TRANSITIONS.get(current, [])


class IdempotencyChecker:
    def __init__(self):
        self.processed_refunds: Dict[str, List[str]] = defaultdict(list)

    def check(
        self,
        refund: Optional[RefundApplication],
        all_refunds: List[RefundApplication],
        payment: Optional[PaymentRecord]
    ) -> Tuple[VerificationResult, Dict]:
        details = {}

        if not payment:
            details["info"] = "无支付记录，跳过幂等性检查"
            return VerificationResult.PENDING, details

        payment_refunds = [r for r in all_refunds if r.payment_id == payment.payment_id]
        details["total_refunds_for_payment"] = len(payment_refunds)

        if not payment_refunds:
            details["result"] = "该支付无退款申请记录，可以处理"
            return VerificationResult.PASS, details

        completed_refunds = [
            r for r in payment_refunds
            if r.status in [RefundStatus.COMPLETED, RefundStatus.APPROVED]
        ]
        details["completed_refunds_count"] = len(completed_refunds)

        if completed_refunds:
            total_completed_amount = sum(r.refund_amount for r in completed_refunds)
            details["total_completed_amount"] = total_completed_amount
            details["original_payment_amount"] = payment.amount

            if total_completed_amount >= payment.amount:
                details["issue"] = "该支付已完成全额退款，重复申请"
                details["duplicate_refund_ids"] = [r.refund_id for r in completed_refunds]
                details["severity"] = "critical"
                return VerificationResult.FAIL, details

            if refund and refund.refund_id in [r.refund_id for r in completed_refunds]:
                details["issue"] = "该退款申请已处理完成，重复请求"
                details["severity"] = "warning"
                return VerificationResult.WARNING, details

            remaining = payment.amount - total_completed_amount
            details["remaining_amount"] = remaining
            if refund and refund.refund_amount > remaining:
                details["issue"] = f"退款金额超过可退余额，剩余可退: {remaining}"
                details["severity"] = "warning"
                return VerificationResult.WARNING, details

        pending_refunds = [r for r in payment_refunds if r.status == RefundStatus.PENDING]
        details["pending_refunds_count"] = len(pending_refunds)

        if pending_refunds and refund and refund.status == RefundStatus.PENDING:
            other_pending = [r for r in pending_refunds if r.refund_id != refund.refund_id]
            if other_pending:
                details["issue"] = "存在其他待处理的退款申请"
                details["pending_refund_ids"] = [r.refund_id for r in other_pending]
                details["severity"] = "warning"
                return VerificationResult.WARNING, details

        details["result"] = "幂等性检查通过，可以处理"
        return VerificationResult.PASS, details


class FaultAnalyzer:
    REFUNDABLE_FAULTS = {FaultCode.E001, FaultCode.E002, FaultCode.E003, FaultCode.E004}

    @staticmethod
    def analyze(events: List[StartEvent], machine: Optional[Machine]) -> Dict:
        result = {
            "faults_found": [],
            "refundable": True,
            "suggested_action": "",
            "fault_descriptions": []
        }

        fault_codes = set()
        for event in events:
            if event.fault_code:
                fault_codes.add(event.fault_code)
                result["faults_found"].append({
                    "event_id": event.event_id,
                    "fault_code": event.fault_code,
                    "description": FAULT_DESCRIPTIONS.get(event.fault_code, "未知"),
                    "error_message": event.error_message
                })

        if machine and machine.last_fault_code:
            fault_codes.add(machine.last_fault_code)

        if not fault_codes:
            result["refundable"] = False
            result["suggested_action"] = "未检测到明确的机器故障，需要人工核实"
            return result

        for code in fault_codes:
            desc = FAULT_DESCRIPTIONS.get(code, "未知故障")
            result["fault_descriptions"].append(f"{code}: {desc}")

        non_refundable = fault_codes - FaultAnalyzer.REFUNDABLE_FAULTS
        if non_refundable:
            result["refundable"] = False
            result["suggested_action"] = f"存在不可退款故障: {', '.join(non_refundable)}，需人工判断"
        else:
            result["suggested_action"] = "检测到明确的机器故障，建议退款"

        return result


class TroubleshootingEngine:
    def __init__(self):
        self.payment_verifier = PaymentVerifier()
        self.event_matcher = EventMatcher()
        self.refund_machine = RefundStateMachine()
        self.idempotency_checker = IdempotencyChecker()
        self.fault_analyzer = FaultAnalyzer()

    def troubleshoot(
        self,
        machine_id: str,
        payment_id: Optional[str] = None,
        refund_id: Optional[str] = None,
        machines: Optional[List[Machine]] = None,
        payments: Optional[List[PaymentRecord]] = None,
        events: Optional[List[StartEvent]] = None,
        refunds: Optional[List[RefundApplication]] = None
    ) -> TroubleshootingResult:
        machines = machines or []
        payments = payments or []
        events = events or []
        refunds = refunds or []

        machine = next((m for m in machines if m.machine_id == machine_id), None)
        payment = next((p for p in payments if p.payment_id == payment_id), None) if payment_id else None
        refund = next((r for r in refunds if r.refund_id == refund_id), None) if refund_id else None

        payment_result, payment_details = self.payment_verifier.verify(payment)
        event_result, event_details = self.event_matcher.match(payment, events, machine_id)
        refund_result, refund_details = self.refund_machine.check(refund, payment)
        idempotency_result, idempotency_details = self.idempotency_checker.check(refund, refunds, payment)

        matched_events = [e for e in events if e.machine_id == machine_id]
        if payment:
            def is_matching_event(e):
                if e.payment_id and payment_id:
                    if e.payment_id == payment_id:
                        return True
                if payment.pay_time:
                    time_diff = abs((e.start_time - payment.pay_time).total_seconds())
                    if time_diff <= 300:
                        return True
                return False
            matched_events = [e for e in matched_events if is_matching_event(e)]

        fault_analysis = self.fault_analyzer.analyze(matched_events, machine)

        conclusion, reason, suggested_amount = self._make_conclusion(
            payment_result, event_result, refund_result, idempotency_result,
            fault_analysis, payment, refund
        )

        case_id = f"CASE-{datetime.now().strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:8]}"

        return TroubleshootingResult(
            case_id=case_id,
            machine_id=machine_id,
            payment_id=payment_id,
            refund_id=refund_id,
            payment_verification=payment_result,
            payment_verification_details=payment_details,
            event_matching=event_result,
            event_matching_details=event_details,
            refund_state_check=refund_result,
            refund_state_details=refund_details,
            idempotency_check=idempotency_result,
            idempotency_details=idempotency_details,
            fault_analysis=fault_analysis,
            conclusion=conclusion,
            conclusion_reason=reason,
            suggested_refund_amount=suggested_amount,
            related_records={
                "machine": machine.dict() if machine else None,
                "payment": payment.dict() if payment else None,
                "refund": refund.dict() if refund else None,
                "matched_events_count": len(matched_events)
            }
        )

    def _make_conclusion(
        self,
        payment_result: VerificationResult,
        event_result: VerificationResult,
        refund_result: VerificationResult,
        idempotency_result: VerificationResult,
        fault_analysis: Dict,
        payment: Optional[PaymentRecord],
        refund: Optional[RefundApplication]
    ) -> Tuple[ConclusionStatus, str, Optional[float]]:

        if idempotency_result == VerificationResult.FAIL:
            return ConclusionStatus.REJECT_REFUND, "重复退款申请，该订单已完成退款", None

        if payment_result == VerificationResult.FAIL:
            return ConclusionStatus.REJECT_REFUND, "支付核验失败，订单无效", None

        if payment_result == VerificationResult.PENDING:
            return ConclusionStatus.NEED_MORE_INFO, "支付正在处理中，请稍后核查", None

        if event_result == VerificationResult.FAIL:
            if fault_analysis["refundable"]:
                amount = payment.amount if payment else None
                return ConclusionStatus.APPROVE_REFUND, f"检测到明确机器故障: {fault_analysis['suggested_action']}", amount
            else:
                return ConclusionStatus.NEED_MORE_INFO, fault_analysis["suggested_action"], None

        if event_result == VerificationResult.PASS:
            amount = payment.amount if payment else None
            return ConclusionStatus.APPROVE_REFUND, "启动事件匹配确认失败，符合退款条件", amount

        if event_result == VerificationResult.WARNING:
            if fault_analysis["refundable"]:
                amount = payment.amount if payment else None
                return ConclusionStatus.PARTIAL_REFUND, "存在部分失败事件，建议部分退款", amount * 0.5 if amount else None
            else:
                return ConclusionStatus.NEED_MORE_INFO, "存在异常但无明确故障，需要人工核实", None

        return ConclusionStatus.NEED_MORE_INFO, "需要更多信息进行判断", None
