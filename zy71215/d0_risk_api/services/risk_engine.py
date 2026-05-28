from __future__ import annotations

import math
from datetime import date, datetime, timedelta
from typing import Optional

from models.schemas import (
    AdvanceApplication,
    AdvanceCheckRequest,
    AdvanceCheckResponse,
    AdvanceStatus,
    FeeRule,
    FreezeRecord,
    FreezeReason,
    FreezeStatus,
    RefundRecord,
    RefundRollbackRequest,
    RefundRollbackResponse,
    RiskLevel,
    RiskReport,
    RiskReportItem,
    TransactionFlow,
)

_REFUND_SURGE_WINDOW_DAYS = 7
_REFUND_SURGE_THRESHOLD = 0.15
_REFUND_CRITICAL_THRESHOLD = 0.30


class DataStore:
    def __init__(self) -> None:
        self.flows: dict[str, list[TransactionFlow]] = {}
        self.advances: dict[str, AdvanceApplication] = {}
        self.refunds: dict[str, list[RefundRecord]] = {}
        self.freezes: dict[str, list[FreezeRecord]] = {}
        self.fee_rules: dict[str, list[FeeRule]] = {}
        self.reports: dict[str, list[RiskReport]] = {}

    def add_flow(self, flow: TransactionFlow) -> None:
        self.flows.setdefault(flow.merchant_id, []).append(flow)

    def get_flows(self, merchant_id: str, start: Optional[date] = None, end: Optional[date] = None) -> list[TransactionFlow]:
        rows = self.flows.get(merchant_id, [])
        if start:
            rows = [r for r in rows if r.trade_date >= start]
        if end:
            rows = [r for r in rows if r.trade_date <= end]
        return rows

    def add_advance(self, app: AdvanceApplication) -> None:
        self.advances[app.id] = app

    def get_advance(self, app_id: str) -> Optional[AdvanceApplication]:
        return self.advances.get(app_id)

    def get_advances_by_merchant(self, merchant_id: str) -> list[AdvanceApplication]:
        return [a for a in self.advances.values() if a.merchant_id == merchant_id]

    def add_refund(self, rec: RefundRecord) -> None:
        self.refunds.setdefault(rec.merchant_id, []).append(rec)

    def get_refunds(self, merchant_id: str, start: Optional[date] = None, end: Optional[date] = None) -> list[RefundRecord]:
        rows = self.refunds.get(merchant_id, [])
        if start:
            rows = [r for r in rows if r.refund_date >= start]
        if end:
            rows = [r for r in rows if r.refund_date <= end]
        return rows

    def add_freeze(self, rec: FreezeRecord) -> None:
        self.freezes.setdefault(rec.merchant_id, []).append(rec)

    def get_active_freezes(self, merchant_id: str) -> list[FreezeRecord]:
        return [f for f in self.freezes.get(merchant_id, []) if f.status == FreezeStatus.ACTIVE]

    def lift_freeze(self, freeze_id: str) -> Optional[FreezeRecord]:
        for recs in self.freezes.values():
            for f in recs:
                if f.id == freeze_id and f.status == FreezeStatus.ACTIVE:
                    f.status = FreezeStatus.LIFTED
                    f.lifted_at = datetime.now()
                    return f
        return None

    def add_fee_rule(self, rule: FeeRule) -> None:
        self.fee_rules.setdefault(rule.merchant_id, []).append(rule)

    def get_effective_fee(self, merchant_id: str, on_date: date) -> Optional[FeeRule]:
        rules = self.fee_rules.get(merchant_id, [])
        candidates = [r for r in rules if r.effective_from <= on_date and (r.effective_to is None or r.effective_to >= on_date)]
        if not candidates:
            return None
        return max(candidates, key=lambda r: r.effective_from)

    def get_fee_versions(self, merchant_id: str) -> list[FeeRule]:
        return sorted(self.fee_rules.get(merchant_id, []), key=lambda r: r.effective_from)

    def add_report(self, report: RiskReport) -> None:
        self.reports.setdefault(report.merchant_id, []).append(report)

    def get_latest_report(self, merchant_id: str) -> Optional[RiskReport]:
        reps = self.reports.get(merchant_id, [])
        return reps[-1] if reps else None


store = DataStore()


class RiskEngine:
    def check_freeze(self, merchant_id: str) -> list[RiskReportItem]:
        items: list[RiskReportItem] = []
        freezes = store.get_active_freezes(merchant_id)
        for fz in freezes:
            items.append(RiskReportItem(
                rule_code="FREEZE_001",
                rule_name="冻结拦截",
                level=RiskLevel.CRITICAL,
                detail=f"商户存在生效冻结(id={fz.id}, 原因={fz.reason.value}, 冻结金额={fz.frozen_amount})",
                suggestion="冻结状态下禁止垫资, 请先解冻或等待风控复核",
            ))
        return items

    def check_refund_surge(self, merchant_id: str, ref_date: date) -> list[RiskReportItem]:
        items: list[RiskReportItem] = []
        window_start = ref_date - timedelta(days=_REFUND_SURGE_WINDOW_DAYS)
        flows = store.get_flows(merchant_id, start=window_start, end=ref_date)
        refunds = store.get_refunds(merchant_id, start=window_start, end=ref_date)

        total_tx = sum(f.tx_amount for f in flows)
        total_refund = sum(r.refund_amount for r in refunds)
        if total_tx == 0:
            return items

        refund_rate = total_refund / total_tx
        if refund_rate >= _REFUND_CRITICAL_THRESHOLD:
            items.append(RiskReportItem(
                rule_code="REFUND_001",
                rule_name="退款激增-严重",
                level=RiskLevel.CRITICAL,
                detail=f"近{_REFUND_SURGE_WINDOW_DAYS}天退款率={refund_rate:.2%}(阈值={_REFUND_CRITICAL_THRESHOLD:.0%}), 交易额={total_tx:.2f}, 退款额={total_refund:.2f}",
                suggestion="拒绝垫资, 触发人工复核",
            ))
        elif refund_rate >= _REFUND_SURGE_THRESHOLD:
            items.append(RiskReportItem(
                rule_code="REFUND_002",
                rule_name="退款激增-预警",
                level=RiskLevel.HIGH,
                detail=f"近{_REFUND_SURGE_WINDOW_DAYS}天退款率={refund_rate:.2%}(阈值={_REFUND_SURGE_THRESHOLD:.0%}), 交易额={total_tx:.2f}, 退款额={total_refund:.2f}",
                suggestion="降低垫资比例, 缩短D0结算周期",
            ))
        return items

    def check_fee_version(self, merchant_id: str, apply_date: date, claimed_version: Optional[str]) -> list[RiskReportItem]:
        items: list[RiskReportItem] = []
        effective = store.get_effective_fee(merchant_id, apply_date)
        if effective is None:
            items.append(RiskReportItem(
                rule_code="FEE_001",
                rule_name="费率规则缺失",
                level=RiskLevel.HIGH,
                detail=f"申请日{apply_date}无生效费率规则, 无法试算",
                suggestion="先录入对应日期的费率规则再提交垫资申请",
            ))
            return items

        if claimed_version and claimed_version != effective.fee_version:
            items.append(RiskReportItem(
                rule_code="FEE_002",
                rule_name="费率版本不匹配",
                level=RiskLevel.HIGH,
                detail=f"申请使用版本={claimed_version}, 实际生效版本={effective.fee_version}(生效自{effective.effective_from})",
                suggestion="以系统生效版本为准, 请确认费率变更是否已同步",
            ))
        return items

    def calculate_quota(self, merchant_id: str, apply_date: date, apply_amount: float) -> tuple[float, list[RiskReportItem]]:
        items: list[RiskReportItem] = []
        effective = store.get_effective_fee(merchant_id, apply_date)
        if effective is None:
            items.append(RiskReportItem(
                rule_code="QUOTA_001",
                rule_name="额度试算失败",
                level=RiskLevel.HIGH,
                detail="无生效费率规则, 无法计算额度",
                suggestion="录入费率规则后重试",
            ))
            return 0.0, items

        flows = store.get_flows(merchant_id, start=apply_date, end=apply_date)
        day_volume = sum(f.tx_amount for f in flows)
        max_advance = day_volume * effective.advance_ratio

        if apply_amount > max_advance:
            items.append(RiskReportItem(
                rule_code="QUOTA_002",
                rule_name="超额申请",
                level=RiskLevel.MEDIUM,
                detail=f"申请金额={apply_amount:.2f}, 当日可垫资上限={max_advance:.2f}(交易额={day_volume:.2f}×垫资比例={effective.advance_ratio:.0%})",
                suggestion=f"降低申请金额至{max_advance:.2f}以内",
            ))
            return max_advance, items

        return apply_amount, items

    def run_full_check(self, req: AdvanceCheckRequest) -> AdvanceCheckResponse:
        all_items: list[RiskReportItem] = []

        freeze_items = self.check_freeze(req.merchant_id)
        all_items.extend(freeze_items)

        refund_items = self.check_refund_surge(req.merchant_id, req.apply_date)
        all_items.extend(refund_items)

        fee_items = self.check_fee_version(req.merchant_id, req.apply_date, req.fee_version)
        all_items.extend(fee_items)

        effective = store.get_effective_fee(req.merchant_id, req.apply_date)
        fee_version_used = effective.fee_version if effective else None

        has_critical = any(i.level == RiskLevel.CRITICAL for i in all_items)
        has_high = any(i.level == RiskLevel.HIGH for i in all_items)

        if has_critical:
            approved = 0.0
            passed = False
        elif has_high:
            quota, quota_items = self.calculate_quota(req.merchant_id, req.apply_date, req.apply_amount)
            all_items.extend(quota_items)
            approved = math.floor(quota * 0.5 * 100) / 100
            passed = approved > 0
        else:
            quota, quota_items = self.calculate_quota(req.merchant_id, req.apply_date, req.apply_amount)
            all_items.extend(quota_items)
            approved = quota
            passed = True

        overall = RiskLevel.LOW
        if any(i.level == RiskLevel.CRITICAL for i in all_items):
            overall = RiskLevel.CRITICAL
        elif any(i.level == RiskLevel.HIGH for i in all_items):
            overall = RiskLevel.HIGH
        elif any(i.level == RiskLevel.MEDIUM for i in all_items):
            overall = RiskLevel.MEDIUM

        reject_reasons = [i.detail for i in all_items if i.level in (RiskLevel.CRITICAL, RiskLevel.HIGH)]

        app = AdvanceApplication(
            merchant_id=req.merchant_id,
            apply_amount=req.apply_amount,
            apply_date=req.apply_date,
            fee_version=fee_version_used,
            status=AdvanceStatus.APPROVED if passed else AdvanceStatus.REJECTED,
            risk_check_passed=passed,
            reject_reasons=reject_reasons,
        )
        store.add_advance(app)

        report = RiskReport(
            merchant_id=req.merchant_id,
            report_date=req.apply_date,
            items=all_items,
            overall_level=overall,
        )
        store.add_report(report)

        return AdvanceCheckResponse(
            application_id=app.id,
            merchant_id=req.merchant_id,
            passed=passed,
            approved_amount=approved,
            fee_version_used=fee_version_used,
            risk_level=overall,
            reject_reasons=reject_reasons,
            report_items=all_items,
        )

    def rollback_refund(self, req: RefundRollbackRequest) -> RefundRollbackResponse:
        refunds = store.get_refunds(req.merchant_id)
        target: Optional[RefundRecord] = None
        for r in refunds:
            if r.id == req.refund_id:
                target = r
                break

        if target is None:
            return RefundRollbackResponse(
                refund_id=req.refund_id,
                merchant_id=req.merchant_id,
                rolled_back=False,
                reason=f"退款记录{req.refund_id}不存在",
            )

        advances = store.get_advances_by_merchant(req.merchant_id)
        affected = [
            a.id for a in advances
            if a.status == AdvanceStatus.APPROVED and a.apply_date >= target.refund_date
        ]

        for adv_id in affected:
            adv = store.get_advance(adv_id)
            if adv:
                adv.status = AdvanceStatus.ROLLED_BACK
                adv.updated_at = datetime.now()

        freeze = FreezeRecord(
            merchant_id=req.merchant_id,
            reason=FreezeReason.REFUND_SURGE,
            frozen_amount=target.refund_amount,
        )
        store.add_freeze(freeze)

        return RefundRollbackResponse(
            refund_id=req.refund_id,
            merchant_id=req.merchant_id,
            rolled_back=True,
            affected_advances=affected,
            reason=f"退款回滚完成, 冻结{target.refund_amount:.2f}, 影响{len(affected)}笔垫资",
        )


engine = RiskEngine()
