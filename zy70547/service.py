import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from models import (
    Supplier, QuotaWindow, BusinessTag, QuotaUsage,
    CircuitBreakerEvent, QuotaReport, CircuitBreakerStatus
)


class QuotaCircuitBreakerService:
    def __init__(self, db: Session):
        self.db = db

    def create_supplier(self, name: str, code: str, description: str = None) -> Supplier:
        supplier = Supplier(
            name=name,
            code=code,
            description=description
        )
        self.db.add(supplier)
        self.db.commit()
        self.db.refresh(supplier)
        return supplier

    def create_business_tag(self, name: str, code: str, priority: int, description: str = None) -> BusinessTag:
        tag = BusinessTag(
            name=name,
            code=code,
            priority=priority,
            description=description
        )
        self.db.add(tag)
        self.db.commit()
        self.db.refresh(tag)
        return tag

    def create_quota_window(self, supplier_id: int, window_type: str, total_quota: int,
                            start_time: datetime, end_time: datetime,
                            warning_threshold: float = 0.8,
                            circuit_breaker_threshold: float = 0.95) -> QuotaWindow:
        window = QuotaWindow(
            supplier_id=supplier_id,
            window_type=window_type,
            total_quota=total_quota,
            warning_threshold=warning_threshold,
            circuit_breaker_threshold=circuit_breaker_threshold,
            start_time=start_time,
            end_time=end_time
        )
        self.db.add(window)
        self.db.commit()
        self.db.refresh(window)
        return window

    def get_current_quota_window(self, supplier_id: int, window_type: str = None) -> Optional[QuotaWindow]:
        query = self.db.query(QuotaWindow).filter(
            QuotaWindow.supplier_id == supplier_id,
            QuotaWindow.start_time <= datetime.utcnow(),
            QuotaWindow.end_time >= datetime.utcnow()
        )
        if window_type:
            query = query.filter(QuotaWindow.window_type == window_type)
        return query.order_by(QuotaWindow.created_at.desc()).first()

    def get_circuit_breaker_status(self, supplier_id: int) -> Dict[str, Any]:
        event = self.db.query(CircuitBreakerEvent).filter(
            CircuitBreakerEvent.supplier_id == supplier_id
        ).order_by(CircuitBreakerEvent.triggered_at.desc()).first()
        
        window = self.get_current_quota_window(supplier_id)
        usage_ratio = window.used_quota / window.total_quota if window and window.total_quota > 0 else 0
        
        if event:
            if event.status == CircuitBreakerStatus.OPEN.value and event.recovered_at is None:
                if window and usage_ratio < window.circuit_breaker_threshold * 0.9:
                    self._recover_circuit_breaker(event.id, "Quota usage dropped below recovery threshold")
                    return {"status": CircuitBreakerStatus.HALF_OPEN.value, "usage_ratio": usage_ratio}
                return {"status": CircuitBreakerStatus.OPEN.value, "usage_ratio": usage_ratio}
            elif event.status == CircuitBreakerStatus.HALF_OPEN.value:
                return {"status": CircuitBreakerStatus.HALF_OPEN.value, "usage_ratio": usage_ratio}
        
        return {"status": CircuitBreakerStatus.CLOSED.value, "usage_ratio": usage_ratio}

    def _check_circuit_breaker(self, window: QuotaWindow, business_tag: BusinessTag) -> Dict[str, Any]:
        usage_ratio = window.used_quota / window.total_quota if window.total_quota > 0 else 0
        status_info = self.get_circuit_breaker_status(window.supplier_id)
        
        if status_info["status"] == CircuitBreakerStatus.OPEN.value:
            if business_tag.priority > 5:
                return {"allowed": False, "reason": "Circuit breaker is OPEN, low priority request rejected"}
        
        if usage_ratio >= window.circuit_breaker_threshold:
            if business_tag.priority > 3:
                self._trigger_circuit_breaker(window, "Circuit breaker threshold exceeded")
                return {"allowed": False, "reason": "Circuit breaker threshold exceeded, low priority request rejected"}
        
        if usage_ratio >= window.warning_threshold:
            if business_tag.priority > 5:
                return {"allowed": False, "reason": "Warning threshold reached, low priority request rejected"}
        
        return {"allowed": True, "reason": "Within quota limits"}

    def _trigger_circuit_breaker(self, window: QuotaWindow, reason: str):
        event = CircuitBreakerEvent(
            supplier_id=window.supplier_id,
            quota_window_id=window.id,
            status=CircuitBreakerStatus.OPEN.value,
            reason=reason
        )
        self.db.add(event)
        self.db.commit()

    def _recover_circuit_breaker(self, event_id: int, reason: str):
        event = self.db.query(CircuitBreakerEvent).filter(CircuitBreakerEvent.id == event_id).first()
        if event:
            event.status = CircuitBreakerStatus.HALF_OPEN.value
            event.recovered_at = datetime.utcnow()
            event.recovery_reason = reason
            self.db.commit()

    def consume_quota(self, supplier_code: str, business_tag_code: str,
                      amount: int, request_id: str = None, raw_input: str = None) -> Dict[str, Any]:
        try:
            supplier = self.db.query(Supplier).filter(Supplier.code == supplier_code).first()
            if not supplier:
                return {"success": False, "error": f"Supplier {supplier_code} not found", "conclusion": "SUPPLIER_NOT_FOUND"}
            
            business_tag = self.db.query(BusinessTag).filter(BusinessTag.code == business_tag_code).first()
            if not business_tag:
                return {"success": False, "error": f"Business tag {business_tag_code} not found", "conclusion": "TAG_NOT_FOUND"}
            
            if request_id:
                existing = self.db.query(QuotaUsage).filter(QuotaUsage.request_id == request_id).first()
                if existing:
                    return {
                        "success": True,
                        "duplicate": True,
                        "usage_id": existing.id,
                        "conclusion": existing.conclusion,
                        "status": existing.status
                    }
            
            window = self.get_current_quota_window(supplier.id)
            if not window:
                return {"success": False, "error": "No active quota window found", "conclusion": "NO_ACTIVE_WINDOW"}
            
            check_result = self._check_circuit_breaker(window, business_tag)
            processing_rule = json.dumps({
                "usage_ratio": window.used_quota / window.total_quota if window.total_quota > 0 else 0,
                "warning_threshold": window.warning_threshold,
                "circuit_breaker_threshold": window.circuit_breaker_threshold,
                "business_priority": business_tag.priority,
                "check_result": check_result
            })
            
            if not check_result["allowed"]:
                usage = QuotaUsage(
                    quota_window_id=window.id,
                    business_tag_id=business_tag.id,
                    request_id=request_id,
                    amount=0,
                    raw_input=raw_input,
                    processing_rule=processing_rule,
                    conclusion=check_result["reason"],
                    status="REJECTED"
                )
                self.db.add(usage)
                self.db.commit()
                return {"success": False, "rejected": True, "reason": check_result["reason"], "conclusion": "REJECTED"}
            
            if window.used_quota + amount > window.total_quota:
                usage = QuotaUsage(
                    quota_window_id=window.id,
                    business_tag_id=business_tag.id,
                    request_id=request_id,
                    amount=0,
                    raw_input=raw_input,
                    processing_rule=processing_rule,
                    conclusion="Insufficient quota",
                    status="INSUFFICIENT_QUOTA"
                )
                self.db.add(usage)
                self.db.commit()
                return {"success": False, "error": "Insufficient quota", "conclusion": "INSUFFICIENT_QUOTA"}
            
            window.used_quota += amount
            usage = QuotaUsage(
                quota_window_id=window.id,
                business_tag_id=business_tag.id,
                request_id=request_id,
                amount=amount,
                raw_input=raw_input,
                processing_rule=processing_rule,
                conclusion="SUCCESS",
                status="SUCCESS"
            )
            self.db.add(usage)
            self.db.commit()
            self.db.refresh(usage)
            
            return {"success": True, "usage_id": usage.id, "conclusion": "SUCCESS", "remaining_quota": window.total_quota - window.used_quota}
        
        except Exception as e:
            self.db.rollback()
            return {"success": False, "error": str(e), "conclusion": "EXCEPTION"}

    def get_quota_usage_history(self, supplier_id: int = None, business_tag_id: int = None,
                                start_time: datetime = None, end_time: datetime = None) -> List[QuotaUsage]:
        query = self.db.query(QuotaUsage)
        if supplier_id:
            query = query.join(QuotaWindow).filter(QuotaWindow.supplier_id == supplier_id)
        if business_tag_id:
            query = query.filter(QuotaUsage.business_tag_id == business_tag_id)
        if start_time:
            query = query.filter(QuotaUsage.created_at >= start_time)
        if end_time:
            query = query.filter(QuotaUsage.created_at <= end_time)
        return query.order_by(QuotaUsage.created_at.desc()).all()

    def get_circuit_breaker_events(self, supplier_id: int = None) -> List[CircuitBreakerEvent]:
        query = self.db.query(CircuitBreakerEvent)
        if supplier_id:
            query = query.filter(CircuitBreakerEvent.supplier_id == supplier_id)
        return query.order_by(CircuitBreakerEvent.triggered_at.desc()).all()

    def manual_correct_quota(self, quota_window_id: int, new_used_quota: int, reason: str, operator: str) -> Dict[str, Any]:
        window = self.db.query(QuotaWindow).filter(QuotaWindow.id == quota_window_id).first()
        if not window:
            return {"success": False, "error": "Quota window not found"}
        
        old_used_quota = window.used_quota
        window.used_quota = new_used_quota
        
        report = QuotaReport(
            supplier_id=window.supplier_id,
            quota_window_id=window.id,
            report_type="MANUAL_CORRECTION",
            content=json.dumps({
                "old_used_quota": old_used_quota,
                "new_used_quota": new_used_quota,
                "reason": reason,
                "operator": operator
            }),
            generated_by=operator
        )
        self.db.add(report)
        
        self.db.commit()
        return {"success": True, "old_used_quota": old_used_quota, "new_used_quota": new_used_quota}

    def recalculate_quota_usage(self, quota_window_id: int) -> Dict[str, Any]:
        window = self.db.query(QuotaWindow).filter(QuotaWindow.id == quota_window_id).first()
        if not window:
            return {"success": False, "error": "Quota window not found"}
        
        successful_usages = self.db.query(QuotaUsage).filter(
            QuotaUsage.quota_window_id == quota_window_id,
            QuotaUsage.status == "SUCCESS"
        ).all()
        
        total_used = sum(usage.amount for usage in successful_usages)
        window.used_quota = total_used
        self.db.commit()
        
        return {"success": True, "recalculated_used_quota": total_used}

    def export_quota_report(self, supplier_id: int = None, quota_window_id: int = None,
                            report_type: str = "FULL") -> Dict[str, Any]:
        if quota_window_id:
            window = self.db.query(QuotaWindow).filter(QuotaWindow.id == quota_window_id).first()
            supplier_id = window.supplier_id if window else supplier_id
        
        supplier = self.db.query(Supplier).filter(Supplier.id == supplier_id).first() if supplier_id else None
        windows = self.db.query(QuotaWindow).filter(QuotaWindow.supplier_id == supplier_id).all() if supplier_id else []
        
        report_data = {
            "generated_at": datetime.utcnow().isoformat(),
            "supplier": {"id": supplier.id, "name": supplier.name, "code": supplier.code} if supplier else None,
            "quota_windows": []
        }
        
        for window in windows:
            usages = self.db.query(QuotaUsage).filter(QuotaUsage.quota_window_id == window.id).all()
            window_data = {
                "id": window.id,
                "window_type": window.window_type,
                "total_quota": window.total_quota,
                "used_quota": window.used_quota,
                "remaining_quota": window.total_quota - window.used_quota,
                "start_time": window.start_time.isoformat(),
                "end_time": window.end_time.isoformat(),
                "usages_count": len(usages),
                "successful_count": sum(1 for u in usages if u.status == "SUCCESS"),
                "rejected_count": sum(1 for u in usages if u.status == "REJECTED")
            }
            report_data["quota_windows"].append(window_data)
        
        events = self.get_circuit_breaker_events(supplier_id)
        report_data["circuit_breaker_events"] = [
            {
                "id": e.id,
                "status": e.status,
                "reason": e.reason,
                "triggered_at": e.triggered_at.isoformat(),
                "recovered_at": e.recovered_at.isoformat() if e.recovered_at else None
            }
            for e in events
        ]
        
        report = QuotaReport(
            supplier_id=supplier_id,
            quota_window_id=quota_window_id,
            report_type=report_type,
            content=json.dumps(report_data, ensure_ascii=False)
        )
        self.db.add(report)
        self.db.commit()
        
        return report_data
