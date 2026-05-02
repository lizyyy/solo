from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import (
    Reservation, SwipeLog, SampleRegistration, Violation,
    Bill, Instrument, User, ResearchGroup, AuditLog
)
from app.engine.rule_engine import RuleEngine, RuleType, RuleResult
from app.exports.exporter import ExportFormat, ExportResult, Exporter


@dataclass
class ReconciliationStatistics:
    total_reservations: int = 0
    active_reservations: int = 0
    cancelled_reservations: int = 0
    completed_reservations: int = 0
    no_show_reservations: int = 0
    
    total_swipe_logs: int = 0
    matched_swipe_logs: int = 0
    unmatched_swipe_logs: int = 0
    manual_release_count: int = 0
    
    total_samples: int = 0
    in_storage_samples: int = 0
    overdue_samples: int = 0
    picked_up_samples: int = 0
    
    total_violations: int = 0
    pending_violations: int = 0
    confirmed_violations: int = 0
    resolved_violations: int = 0
    dismissed_violations: int = 0
    
    total_bills: int = 0
    pending_bills: int = 0
    approved_bills: int = 0
    paid_bills: int = 0
    waived_bills: int = 0
    
    total_bill_amount: float = 0.0
    paid_amount: float = 0.0
    waived_amount: float = 0.0


@dataclass
class ReconciliationReport:
    report_date: date
    generated_at: datetime
    
    statistics: ReconciliationStatistics = field(default_factory=ReconciliationStatistics)
    
    rule_check_results: List[Dict[str, Any]] = field(default_factory=list)
    
    recent_violations: List[Dict[str, Any]] = field(default_factory=list)
    recent_bills: List[Dict[str, Any]] = field(default_factory=list)
    unmatched_swipes: List[Dict[str, Any]] = field(default_factory=list)
    overdue_samples: List[Dict[str, Any]] = field(default_factory=list)
    
    audit_summary: Dict[str, Any] = field(default_factory=dict)
    
    def to_markdown(self) -> str:
        lines = []
        
        lines.append(f"# 预约刷卡对账报告")
        lines.append("")
        lines.append(f"**报告日期**: {self.report_date.strftime('%Y-%m-%d')}")
        lines.append(f"**生成时间**: {self.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 一、统计概览")
        lines.append("")
        lines.append("### 1.1 预约统计")
        lines.append("")
        lines.append("| 指标 | 数量 |")
        lines.append("|------|------|")
        lines.append(f"| 总预约数 | {self.statistics.total_reservations} |")
        lines.append(f"| 有效预约 | {self.statistics.active_reservations} |")
        lines.append(f"| 已取消 | {self.statistics.cancelled_reservations} |")
        lines.append(f"| 已完成 | {self.statistics.completed_reservations} |")
        lines.append(f"| 未到（占机未到） | {self.statistics.no_show_reservations} |")
        lines.append("")
        
        lines.append("### 1.2 刷卡统计")
        lines.append("")
        lines.append("| 指标 | 数量 |")
        lines.append("|------|------|")
        lines.append(f"| 总刷卡数 | {self.statistics.total_swipe_logs} |")
        lines.append(f"| 已匹配预约 | {self.statistics.matched_swipe_logs} |")
        lines.append(f"| 未匹配（无预约刷卡） | {self.statistics.unmatched_swipe_logs} |")
        lines.append(f"| 人工放行 | {self.statistics.manual_release_count} |")
        lines.append("")
        
        lines.append("### 1.3 样品统计")
        lines.append("")
        lines.append("| 指标 | 数量 |")
        lines.append("|------|------|")
        lines.append(f"| 总样品数 | {self.statistics.total_samples} |")
        lines.append(f"| 存储中 | {self.statistics.in_storage_samples} |")
        lines.append(f"| 逾期未取 | {self.statistics.overdue_samples} |")
        lines.append(f"| 已取出 | {self.statistics.picked_up_samples} |")
        lines.append("")
        
        lines.append("### 1.4 违规统计")
        lines.append("")
        lines.append("| 指标 | 数量 |")
        lines.append("|------|------|")
        lines.append(f"| 总违规数 | {self.statistics.total_violations} |")
        lines.append(f"| 待处理 | {self.statistics.pending_violations} |")
        lines.append(f"| 已确认 | {self.statistics.confirmed_violations} |")
        lines.append(f"| 已解决 | {self.statistics.resolved_violations} |")
        lines.append(f"| 已驳回 | {self.statistics.dismissed_violations} |")
        lines.append("")
        
        lines.append("### 1.5 账单统计")
        lines.append("")
        lines.append("| 指标 | 数量/金额 |")
        lines.append("|------|-----------|")
        lines.append(f"| 总账单数 | {self.statistics.total_bills} |")
        lines.append(f"| 待审核 | {self.statistics.pending_bills} |")
        lines.append(f"| 已审核 | {self.statistics.approved_bills} |")
        lines.append(f"| 已支付 | {self.statistics.paid_bills} |")
        lines.append(f"| 已减免 | {self.statistics.waived_bills} |")
        lines.append(f"| **总金额** | **¥{self.statistics.total_bill_amount:.2f}** |")
        lines.append(f"| **已收金额** | **¥{self.statistics.paid_amount:.2f}** |")
        lines.append(f"| **减免金额** | **¥{self.statistics.waived_amount:.2f}** |")
        lines.append("")
        
        lines.append("## 二、规则检查结果")
        lines.append("")
        
        if self.rule_check_results:
            for result in self.rule_check_results:
                status = "✅ 通过" if result.get("success") else "❌ 发现问题"
                has_violation = result.get("has_violation", False)
                lines.append(f"### {result.get('rule_type', '')}")
                lines.append(f"")
                lines.append(f"- **状态**: {status}")
                lines.append(f"- **消息**: {result.get('message', '')}")
                if has_violation:
                    lines.append(f"- **严重程度**: {result.get('violation_severity', 'low')}")
                    affected = result.get('affected_records', [])
                    if affected:
                        lines.append(f"- **影响记录数**: {len(affected)}")
                lines.append("")
        else:
            lines.append("*暂无规则检查结果*")
            lines.append("")
        
        lines.append("## 三、问题明细")
        lines.append("")
        
        if self.unmatched_swipes:
            lines.append("### 3.1 无预约刷卡记录")
            lines.append("")
            lines.append("| 刷卡时间 | 卡号 | 设备ID |")
            lines.append("|----------|------|--------|")
            for swipe in self.unmatched_swipes[:10]:
                lines.append(f"| {swipe.get('swipe_time', '')} | {swipe.get('card_number', '')} | {swipe.get('device_id', '')} |")
            if len(self.unmatched_swipes) > 10:
                lines.append(f"| ... 共 {len(self.unmatched_swipes)} 条记录 |")
            lines.append("")
        
        if self.overdue_samples:
            lines.append("### 3.2 逾期样品")
            lines.append("")
            lines.append("| 样品编号 | 登记时间 | 逾期小时 |")
            lines.append("|----------|----------|----------|")
            for sample in self.overdue_samples[:10]:
                lines.append(f"| {sample.get('sample_code', '')} | {sample.get('registered_at', '')} | {sample.get('overdue_hours', 0)} |")
            if len(self.overdue_samples) > 10:
                lines.append(f"| ... 共 {len(self.overdue_samples)} 条记录 |")
            lines.append("")
        
        if self.recent_violations:
            lines.append("### 3.3 近期违规记录")
            lines.append("")
            lines.append("| 违规类型 | 检测时间 | 状态 | 严重程度 |")
            lines.append("|----------|----------|------|----------|")
            for vio in self.recent_violations[:10]:
                lines.append(f"| {vio.get('violation_type', '')} | {vio.get('detected_at', '')} | {vio.get('status', '')} | {vio.get('severity', '')} |")
            if len(self.recent_violations) > 10:
                lines.append(f"| ... 共 {len(self.recent_violations)} 条记录 |")
            lines.append("")
        
        if self.recent_bills:
            lines.append("### 3.4 近期账单")
            lines.append("")
            lines.append("| 账单编号 | 日期 | 金额 | 状态 |")
            lines.append("|----------|------|------|------|")
            for bill in self.recent_bills[:10]:
                lines.append(f"| {bill.get('bill_code', '')} | {bill.get('bill_date', '')} | ¥{bill.get('total_amount', 0):.2f} | {bill.get('status', '')} |")
            if len(self.recent_bills) > 10:
                lines.append(f"| ... 共 {len(self.recent_bills)} 条记录 |")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*本报告由预约刷卡对账台自动生成*")
        
        return "\n".join(lines)


def generate_reconciliation_report(db: Session, 
                                     report_date: date = None,
                                     run_rules: bool = True) -> ReconciliationReport:
    report_date = report_date or date.today()
    generated_at = datetime.now()
    
    stats = ReconciliationStatistics()
    
    stats.total_reservations = db.query(func.count(Reservation.id)).scalar() or 0
    stats.active_reservations = db.query(func.count(Reservation.id)).filter(
        Reservation.is_cancelled == False
    ).scalar() or 0
    stats.cancelled_reservations = db.query(func.count(Reservation.id)).filter(
        Reservation.is_cancelled == True
    ).scalar() or 0
    stats.completed_reservations = db.query(func.count(Reservation.id)).filter(
        Reservation.status == "completed"
    ).scalar() or 0
    stats.no_show_reservations = db.query(func.count(Reservation.id)).filter(
        Reservation.status == "no_show"
    ).scalar() or 0
    
    stats.total_swipe_logs = db.query(func.count(SwipeLog.id)).scalar() or 0
    stats.matched_swipe_logs = db.query(func.count(SwipeLog.id)).filter(
        SwipeLog.is_matched == True
    ).scalar() or 0
    stats.unmatched_swipe_logs = db.query(func.count(SwipeLog.id)).filter(
        SwipeLog.is_matched == False,
        SwipeLog.is_manual_release == False
    ).scalar() or 0
    stats.manual_release_count = db.query(func.count(SwipeLog.id)).filter(
        SwipeLog.is_manual_release == True
    ).scalar() or 0
    
    stats.total_samples = db.query(func.count(SampleRegistration.id)).scalar() or 0
    stats.in_storage_samples = db.query(func.count(SampleRegistration.id)).filter(
        SampleRegistration.status == "in_storage"
    ).scalar() or 0
    stats.overdue_samples = db.query(func.count(SampleRegistration.id)).filter(
        SampleRegistration.is_overdue == True
    ).scalar() or 0
    stats.picked_up_samples = db.query(func.count(SampleRegistration.id)).filter(
        SampleRegistration.status == "picked_up"
    ).scalar() or 0
    
    stats.total_violations = db.query(func.count(Violation.id)).scalar() or 0
    stats.pending_violations = db.query(func.count(Violation.id)).filter(
        Violation.status == "pending"
    ).scalar() or 0
    stats.confirmed_violations = db.query(func.count(Violation.id)).filter(
        Violation.status == "confirmed"
    ).scalar() or 0
    stats.resolved_violations = db.query(func.count(Violation.id)).filter(
        Violation.is_resolved == True
    ).scalar() or 0
    stats.dismissed_violations = db.query(func.count(Violation.id)).filter(
        Violation.status == "dismissed"
    ).scalar() or 0
    
    stats.total_bills = db.query(func.count(Bill.id)).scalar() or 0
    stats.pending_bills = db.query(func.count(Bill.id)).filter(
        Bill.status == "pending"
    ).scalar() or 0
    stats.approved_bills = db.query(func.count(Bill.id)).filter(
        Bill.status == "approved"
    ).scalar() or 0
    stats.paid_bills = db.query(func.count(Bill.id)).filter(
        Bill.is_paid == True
    ).scalar() or 0
    stats.waived_bills = db.query(func.count(Bill.id)).filter(
        Bill.is_waived == True
    ).scalar() or 0
    
    from sqlalchemy.sql import func as sql_func
    total = db.query(sql_func.sum(Bill.total_amount)).scalar()
    stats.total_bill_amount = float(total) if total else 0.0
    
    paid = db.query(sql_func.sum(Bill.total_amount)).filter(Bill.is_paid == True).scalar()
    stats.paid_amount = float(paid) if paid else 0.0
    
    waived = db.query(sql_func.sum(Bill.total_amount)).filter(Bill.is_waived == True).scalar()
    stats.waived_amount = float(waived) if waived else 0.0
    
    rule_results = []
    if run_rules:
        engine = RuleEngine(db)
        results = engine.run_all_rules()
        for r in results:
            rule_results.append({
                "rule_type": r.rule_type.value if hasattr(r.rule_type, 'value') else str(r.rule_type),
                "success": r.success,
                "has_violation": r.has_violation,
                "violation_severity": r.violation_severity.value if hasattr(r.violation_severity, 'value') else str(r.violation_severity),
                "message": r.message,
                "details": r.details,
                "affected_records": r.affected_records
            })
    
    recent_violations = []
    violations = db.query(Violation).order_by(Violation.detected_at.desc()).limit(20).all()
    for v in violations:
        recent_violations.append({
            "id": v.id,
            "violation_code": v.violation_code,
            "violation_type": v.violation_type,
            "detected_at": v.detected_at.isoformat() if v.detected_at else None,
            "severity": v.severity,
            "status": v.status,
            "is_resolved": v.is_resolved
        })
    
    recent_bills = []
    bills = db.query(Bill).order_by(Bill.bill_date.desc()).limit(20).all()
    for b in bills:
        recent_bills.append({
            "id": b.id,
            "bill_code": b.bill_code,
            "bill_date": b.bill_date.isoformat() if b.bill_date else None,
            "total_amount": b.total_amount,
            "status": b.status,
            "is_paid": b.is_paid
        })
    
    unmatched_swipes = []
    swipes = db.query(SwipeLog).filter(
        SwipeLog.is_matched == False,
        SwipeLog.is_manual_release == False
    ).order_by(SwipeLog.swipe_time.desc()).limit(50).all()
    for s in swipes:
        unmatched_swipes.append({
            "id": s.id,
            "card_number": s.card_number,
            "swipe_time": s.swipe_time.isoformat() if s.swipe_time else None,
            "device_id": s.device_id,
            "instrument_id": s.instrument_id
        })
    
    overdue_samples = []
    samples = db.query(SampleRegistration).filter(
        SampleRegistration.is_overdue == True
    ).order_by(SampleRegistration.registered_at).all()
    for s in samples:
        overdue_samples.append({
            "id": s.id,
            "sample_code": s.sample_code,
            "registered_at": s.registered_at.isoformat() if s.registered_at else None,
            "max_storage_hours": s.max_storage_hours,
            "overdue_hours": 0
        })
    
    report = ReconciliationReport(
        report_date=report_date,
        generated_at=generated_at,
        statistics=stats,
        rule_check_results=rule_results,
        recent_violations=recent_violations,
        recent_bills=recent_bills,
        unmatched_swipes=unmatched_swipes,
        overdue_samples=overdue_samples
    )
    
    return report


def generate_daily_report(db: Session, date: date = None) -> ReconciliationReport:
    return generate_reconciliation_report(db, date, run_rules=True)
