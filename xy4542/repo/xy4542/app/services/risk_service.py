from datetime import datetime
from typing import List, Dict, Any, Tuple
from collections import defaultdict

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.models import (
    TellerPayment, SortingLog, BundleTag, ATMPlan, Bundle, RiskAlert, AuditLog
)


class RiskService:
    RISK_TYPES = {
        "DUPLICATE_BUNDLE": {"code": "R001", "name": "重复入库", "severity": "high"},
        "TELLER_AMOUNT_MISMATCH": {"code": "R002", "name": "柜员金额不平", "severity": "high"},
        "SERIAL_GAP": {"code": "R003", "name": "冠字号断档", "severity": "medium"},
        "ATM_PLAN_MISMATCH": {"code": "R004", "name": "ATM计划不匹配", "severity": "medium"},
        "BUNDLE_AMOUNT_MISMATCH": {"code": "R005", "name": "扎把金额不一致", "severity": "high"},
    }

    @staticmethod
    def check_duplicate_bundles(db: Session, business_date: str) -> List[RiskAlert]:
        alerts = []
        
        bundle_counts = db.query(
            Bundle.bundle_no,
            func.count(Bundle.id).label("count")
        ).filter(
            Bundle.business_date == business_date
        ).group_by(Bundle.bundle_no).having(func.count(Bundle.id) > 1).all()
        
        for bundle_no, count in bundle_counts:
            alert = RiskAlert(
                business_date=business_date,
                alert_type="DUPLICATE_BUNDLE",
                alert_code="R001",
                severity="high",
                reference_id=bundle_no,
                description=f"扎把编号 {bundle_no} 重复入库，共出现 {count} 次",
                expected_value="1次",
                actual_value=f"{count}次",
                is_reviewed=False
            )
            alerts.append(alert)
        
        return alerts

    @staticmethod
    def check_teller_amount_mismatch(db: Session, business_date: str) -> List[RiskAlert]:
        alerts = []
        
        teller_payments = db.query(
            TellerPayment.teller_no,
            TellerPayment.teller_name,
            func.sum(TellerPayment.amount).label("total_amount"),
            func.count(TellerPayment.id).label("bundle_count")
        ).filter(
            TellerPayment.business_date == business_date
        ).group_by(TellerPayment.teller_no, TellerPayment.teller_name).all()
        
        for payment in teller_payments:
            teller_bundles = db.query(Bundle).filter(
                Bundle.teller_no == payment.teller_no,
                Bundle.business_date == business_date
            ).all()
            
            bundle_total = sum(b.amount for b in teller_bundles if b.amount)
            
            if abs(bundle_total - payment.total_amount) > 0.01:
                alert = RiskAlert(
                    business_date=business_date,
                    alert_type="TELLER_AMOUNT_MISMATCH",
                    alert_code="R002",
                    severity="high",
                    reference_id=payment.teller_no,
                    description=f"柜员 {payment.teller_name}({payment.teller_no}) 缴款金额不平：缴款记录金额 {payment.total_amount} 元，实际扎把金额 {bundle_total} 元",
                    expected_value=f"{payment.total_amount}元",
                    actual_value=f"{bundle_total}元",
                    is_reviewed=False
                )
                alerts.append(alert)
        
        return alerts

    @staticmethod
    def check_serial_gaps(db: Session, business_date: str) -> List[RiskAlert]:
        alerts = []
        
        bundle_tags = db.query(BundleTag).filter(
            BundleTag.business_date == business_date
        ).all()
        
        for tag in bundle_tags:
            if not tag.start_serial or not tag.end_serial:
                continue
            
            serials_from_logs = db.query(SortingLog.serial_number).filter(
                SortingLog.bundle_no == tag.bundle_no,
                SortingLog.business_date == business_date
            ).order_by(SortingLog.id).all()
            
            if len(serials_from_logs) == 0:
                continue
            
            serial_list = [s[0] for s in serials_from_logs if s[0]]
            
            if len(serial_list) < 2:
                continue
            
            gaps = RiskService._find_serial_gaps(serial_list, tag.start_serial, tag.end_serial)
            
            if gaps:
                gap_info = ", ".join(gaps[:3])
                if len(gaps) > 3:
                    gap_info += f" 等共{len(gaps)}处"
                
                alert = RiskAlert(
                    business_date=business_date,
                    alert_type="SERIAL_GAP",
                    alert_code="R003",
                    severity="medium",
                    reference_id=tag.bundle_no,
                    description=f"扎把 {tag.bundle_no} 冠字号存在断档：{gap_info}",
                    expected_value="冠字号连续",
                    actual_value=f"存在{len(gaps)}处断档",
                    is_reviewed=False
                )
                alerts.append(alert)
        
        return alerts

    @staticmethod
    def _find_serial_gaps(serials: List[str], start: str, end: str) -> List[str]:
        if not all(serials):
            return []
        
        def extract_numeric_part(s: str) -> Tuple[str, int]:
            prefix = ""
            num_str = ""
            for i, char in enumerate(s):
                if char.isdigit():
                    num_str = s[i:]
                    prefix = s[:i]
                    break
            if num_str:
                return prefix, int(num_str)
            return s, 0
        
        gaps = []
        sorted_serials = sorted(serials)
        
        for i in range(len(sorted_serials) - 1):
            curr = sorted_serials[i]
            next_ = sorted_serials[i + 1]
            
            curr_prefix, curr_num = extract_numeric_part(curr)
            next_prefix, next_num = extract_numeric_part(next_)
            
            if curr_prefix == next_prefix and next_num > curr_num + 1:
                gaps.append(f"{curr} -> {next_}")
        
        return gaps

    @staticmethod
    def check_atm_plan_mismatch(db: Session, business_date: str) -> List[RiskAlert]:
        alerts = []
        
        atm_plans = db.query(ATMPlan).filter(
            ATMPlan.business_date == business_date
        ).all()
        
        for plan in atm_plans:
            if plan.bundle_nos:
                bundle_nos = [bn.strip() for bn in plan.bundle_nos.split(",") if bn.strip()]
                
                actual_amount = 0
                for bundle_no in bundle_nos:
                    bundle = db.query(Bundle).filter(
                        Bundle.bundle_no == bundle_no,
                        Bundle.business_date == business_date
                    ).first()
                    if bundle and bundle.amount:
                        actual_amount += bundle.amount
                
                if actual_amount > 0 and abs(actual_amount - plan.plan_amount) > 0.01:
                    alert = RiskAlert(
                        business_date=business_date,
                        alert_type="ATM_PLAN_MISMATCH",
                        alert_code="R004",
                        severity="medium",
                        reference_id=f"{plan.atm_no}-{plan.box_no}",
                        description=f"ATM {plan.atm_no} 钞箱 {plan.box_no} 金额不匹配：计划 {plan.plan_amount} 元，实际 {actual_amount} 元",
                        expected_value=f"{plan.plan_amount}元",
                        actual_value=f"{actual_amount}元",
                        is_reviewed=False
                    )
                    alerts.append(alert)
        
        return alerts

    @staticmethod
    def check_bundle_amount_consistency(db: Session, business_date: str) -> List[RiskAlert]:
        alerts = []
        
        bundles = db.query(Bundle).filter(
            Bundle.business_date == business_date
        ).all()
        
        for bundle in bundles:
            tag = db.query(BundleTag).filter(
                BundleTag.bundle_no == bundle.bundle_no
            ).first()
            
            if tag and tag.amount and abs(tag.amount - bundle.amount) > 0.01:
                alert = RiskAlert(
                    business_date=business_date,
                    alert_type="BUNDLE_AMOUNT_MISMATCH",
                    alert_code="R005",
                    severity="high",
                    reference_id=bundle.bundle_no,
                    description=f"扎把 {bundle.bundle_no} 金额不一致：主记录 {bundle.amount} 元，标签 {tag.amount} 元",
                    expected_value=f"{bundle.amount}元",
                    actual_value=f"{tag.amount}元",
                    is_reviewed=False
                )
                alerts.append(alert)
        
        return alerts

    @staticmethod
    def run_all_checks(db: Session, business_date: str, operator: str = "system") -> int:
        db.query(RiskAlert).filter(
            RiskAlert.business_date == business_date,
            RiskAlert.is_reviewed == False
        ).delete(synchronize_session=False)
        
        all_alerts = []
        
        all_alerts.extend(RiskService.check_duplicate_bundles(db, business_date))
        all_alerts.extend(RiskService.check_teller_amount_mismatch(db, business_date))
        all_alerts.extend(RiskService.check_serial_gaps(db, business_date))
        all_alerts.extend(RiskService.check_atm_plan_mismatch(db, business_date))
        all_alerts.extend(RiskService.check_bundle_amount_consistency(db, business_date))
        
        for alert in all_alerts:
            db.add(alert)
        
        db.commit()
        
        audit = AuditLog(
            operation_type="risk_check",
            operator=operator,
            business_date=business_date,
            details=f"完成风险检查，发现 {len(all_alerts)} 个风险预警"
        )
        db.add(audit)
        db.commit()
        
        return len(all_alerts)

    @staticmethod
    def review_alert(db: Session, alert_id: int, reviewer: str, decision: str, remark: str = "") -> RiskAlert:
        from app.models.models import ReviewRecord
        
        alert = db.query(RiskAlert).filter(RiskAlert.id == alert_id).first()
        if not alert:
            raise ValueError(f"未找到风险预警 ID: {alert_id}")
        
        alert.is_reviewed = True
        alert.reviewed_by = reviewer
        alert.reviewed_at = datetime.utcnow()
        alert.review_remark = remark
        
        review_record = ReviewRecord(
            risk_alert_id=alert_id,
            reviewer=reviewer,
            decision=decision,
            remark=remark
        )
        db.add(review_record)
        
        audit = AuditLog(
            operation_type="review_alert",
            operator=reviewer,
            business_date=alert.business_date,
            details=f"复核风险预警 ID: {alert_id}, 结论: {decision}"
        )
        db.add(audit)
        
        db.commit()
        
        return alert

    @staticmethod
    def sync_bundles_from_sources(db: Session, business_date: str) -> int:
        count = 0
        
        teller_payments = db.query(TellerPayment).filter(
            TellerPayment.business_date == business_date
        ).all()
        
        for payment in teller_payments:
            existing = db.query(Bundle).filter(
                Bundle.bundle_no == payment.bundle_no,
                Bundle.business_date == business_date
            ).first()
            
            if not existing:
                bundle = Bundle(
                    business_date=business_date,
                    bundle_no=payment.bundle_no,
                    denomination=payment.denomination,
                    quantity=payment.quantity,
                    amount=payment.amount,
                    teller_no=payment.teller_no,
                    source="teller",
                    status="pending"
                )
                db.add(bundle)
                count += 1
        
        atm_plans = db.query(ATMPlan).filter(
            ATMPlan.business_date == business_date
        ).all()
        
        for plan in atm_plans:
            if plan.bundle_nos:
                bundle_nos = [bn.strip() for bn in plan.bundle_nos.split(",") if bn.strip()]
                for bundle_no in bundle_nos:
                    existing = db.query(Bundle).filter(
                        Bundle.bundle_no == bundle_no,
                        Bundle.business_date == business_date
                    ).first()
                    
                    if not existing:
                        bundle = Bundle(
                            business_date=business_date,
                            bundle_no=bundle_no,
                            denomination=plan.denomination,
                            quantity=100,
                            amount=plan.denomination * 100 if plan.denomination else 0,
                            source="atm",
                            status="pending"
                        )
                        db.add(bundle)
                        count += 1
        
        db.commit()
        return count
