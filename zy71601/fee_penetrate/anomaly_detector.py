from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from sqlalchemy import and_, or_

from .database import Database
from .models import (
    Product, FeeRule, NavFlow, CustomerShare, ChannelRebate,
    FeeAccrual, AnomalyRecord, SalesChannel, FeeType
)


class AnomalySeverity(str):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class AnomalyType(str):
    FEE_RULE_GAP = "fee_rule_gap"
    FEE_RULE_OVERLAP = "fee_rule_overlap"
    SHARE_CALIBER_MISMATCH = "share_caliber_mismatch"
    SHARE_SUM_MISMATCH = "share_sum_mismatch"
    DUPLICATE_REBATE = "duplicate_rebate"
    REBATE_PERIOD_OVERLAP = "rebate_period_overlap"
    NAV_MISSING = "nav_missing"
    ACCRUAL_CROSS_PERIOD = "accrual_cross_period"
    FEE_RATE_ABNORMAL = "fee_rate_abnormal"
    DATA_INCONSISTENCY = "data_inconsistency"


class AnomalyDetector:
    def __init__(self, db: Optional[Database] = None):
        self.db = db or Database()
        self.detected: List[Dict[str, Any]] = []

    def _record_anomaly(
        self,
        anomaly_type: str,
        severity: str,
        entity_type: str,
        entity_id: int,
        description: str,
        expected_value: Optional[str] = None,
        actual_value: Optional[str] = None,
        period_start: Optional[date] = None,
        period_end: Optional[date] = None
    ):
        self.detected.append({
            "anomaly_type": anomaly_type,
            "severity": severity,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "description": description,
            "expected_value": expected_value,
            "actual_value": actual_value,
            "period_start": period_start,
            "period_end": period_end,
        })

    def save_to_db(self, operator: str) -> List[AnomalyRecord]:
        saved = []
        with self.db.get_session() as session:
            for anomaly in self.detected:
                existing = session.query(AnomalyRecord).filter(
                    and_(
                        AnomalyRecord.anomaly_type == anomaly["anomaly_type"],
                        AnomalyRecord.entity_type == anomaly["entity_type"],
                        AnomalyRecord.entity_id == anomaly["entity_id"],
                        AnomalyRecord.period_start == anomaly["period_start"],
                        AnomalyRecord.period_end == anomaly["period_end"],
                        AnomalyRecord.is_resolved == False
                    )
                ).first()

                if not existing:
                    record = AnomalyRecord(
                        anomaly_type=anomaly["anomaly_type"],
                        severity=anomaly["severity"],
                        entity_type=anomaly["entity_type"],
                        entity_id=anomaly["entity_id"],
                        period_start=anomaly["period_start"],
                        period_end=anomaly["period_end"],
                        description=anomaly["description"],
                        expected_value=anomaly["expected_value"],
                        actual_value=anomaly["actual_value"],
                        is_resolved=False,
                    )
                    session.add(record)
                    session.flush()
                    saved.append(record)
        return saved

    def detect_fee_rule_gaps_and_overlaps(
        self,
        product_code: Optional[str] = None,
        period_start: Optional[date] = None,
        period_end: Optional[date] = None
    ):
        with self.db.get_session() as session:
            query = session.query(Product)
            if product_code:
                query = query.filter(Product.product_code == product_code)
            products = query.all()

            for product in products:
                for fee_type in [FeeType.MANAGEMENT, FeeType.CUSTODIAN, FeeType.SALES_SERVICE]:
                    rules = (
                        session.query(FeeRule)
                        .filter(
                            and_(
                                FeeRule.product_id == product.id,
                                FeeRule.fee_type == fee_type.value,
                                FeeRule.is_active == True
                            )
                        )
                        .order_by(FeeRule.effective_date)
                        .all()
                    )

                    if not rules:
                        continue

                    for i in range(len(rules) - 1):
                        current = rules[i]
                        next_rule = rules[i + 1]

                        current_end = current.expire_date or date.max
                        next_start = next_rule.effective_date

                        if current_end >= next_start:
                            overlap_days = (current_end - next_start).days + 1
                            self._record_anomaly(
                                anomaly_type=AnomalyType.FEE_RULE_OVERLAP,
                                severity=AnomalySeverity.HIGH,
                                entity_type="FeeRule",
                                entity_id=current.id,
                                description=(
                                    f"产品[{product.product_code}] {fee_type.value} 费率规则重叠，"
                                    f"规则{current.id}({current.effective_date}~{current_end})与"
                                    f"规则{next_rule.id}({next_start}~{next_rule.expire_date})重叠{overlap_days}天"
                                ),
                                expected_value=f"不重叠，前一规则到期应为{next_start - timedelta(days=1)}",
                                actual_value=f"重叠{overlap_days}天",
                                period_start=next_start,
                                period_end=current_end
                            )
                        elif (next_start - current_end).days > 1:
                            gap_days = (next_start - current_end).days - 1
                            self._record_anomaly(
                                anomaly_type=AnomalyType.FEE_RULE_GAP,
                                severity=AnomalySeverity.HIGH,
                                entity_type="FeeRule",
                                entity_id=current.id,
                                description=(
                                    f"产品[{product.product_code}] {fee_type.value} 费率规则断档，"
                                    f"规则{current.id}到期({current_end})后{gap_days}天没有费率规则"
                                ),
                                expected_value="规则应连续无断档",
                                actual_value=f"断档{gap_days}天，从{current_end + timedelta(days=1)}到{next_start - timedelta(days=1)}",
                                period_start=current_end + timedelta(days=1),
                                period_end=next_start - timedelta(days=1)
                            )

    def detect_share_caliber_mismatch(
        self,
        product_code: Optional[str] = None,
        check_date: Optional[date] = None
    ):
        with self.db.get_session() as session:
            query = session.query(Product)
            if product_code:
                query = query.filter(Product.product_code == product_code)
            products = query.all()

            for product in products:
                nav_query = session.query(NavFlow).filter(
                    NavFlow.product_id == product.id
                )
                if check_date:
                    nav_query = nav_query.filter(NavFlow.nav_date == check_date)
                navs = nav_query.order_by(NavFlow.nav_date).all()

                for nav in navs:
                    customer_shares = session.query(CustomerShare).filter(
                        and_(
                            CustomerShare.product_id == product.id,
                            CustomerShare.share_date == nav.nav_date,
                            CustomerShare.is_active == True
                        )
                    ).all()

                    if not customer_shares:
                        continue

                    total_customer_share = sum(
                        cs.share_amount for cs in customer_shares
                    )
                    nav_total_share = nav.total_share
                    diff = abs(total_customer_share - nav_total_share)
                    diff_ratio = diff / nav_total_share if nav_total_share > 0 else 0

                    if diff_ratio > Decimal("0.0001"):
                        self._record_anomaly(
                            anomaly_type=AnomalyType.SHARE_SUM_MISMATCH,
                            severity=AnomalySeverity.HIGH if diff_ratio > Decimal("0.01") else AnomalySeverity.MEDIUM,
                            entity_type="CustomerShare",
                            entity_id=product.id,
                            description=(
                                f"产品[{product.product_code}] 在 {nav.nav_date} 的份额口径不一致，"
                                f"净值流水总份额{nav_total_share}，客户明细汇总{total_customer_share}，"
                                f"差异{diff}，差异率{diff_ratio*100:.4f}%"
                            ),
                            expected_value=str(nav_total_share),
                            actual_value=str(total_customer_share),
                            period_start=nav.nav_date,
                            period_end=nav.nav_date
                        )

    def detect_duplicate_rebates(
        self,
        channel_code: Optional[str] = None,
        product_code: Optional[str] = None
    ):
        with self.db.get_session() as session:
            query = session.query(ChannelRebate).filter(ChannelRebate.is_active == True)
            if channel_code:
                channel = session.query(SalesChannel).filter(
                    SalesChannel.channel_code == channel_code
                ).first()
                if channel:
                    query = query.filter(ChannelRebate.channel_id == channel.id)
            if product_code:
                product = session.query(Product).filter(
                    Product.product_code == product_code
                ).first()
                if product:
                    query = query.filter(ChannelRebate.product_id == product.id)

            rebates = query.order_by(
                ChannelRebate.channel_id,
                ChannelRebate.product_id,
                ChannelRebate.period_start
            ).all()

            seen = defaultdict(list)
            for rebate in rebates:
                key = (rebate.channel_id, rebate.product_id)
                existing_list = seen[key]

                for existing in existing_list:
                    overlap_start = max(existing.period_start, rebate.period_start)
                    overlap_end = min(existing.period_end or date.max, rebate.period_end or date.max)

                    if overlap_start <= overlap_end:
                        channel = session.query(SalesChannel).filter(
                            SalesChannel.id == rebate.channel_id
                        ).first()
                        product = session.query(Product).filter(
                            Product.id == rebate.product_id
                        ).first()

                        overlap_days = (overlap_end - overlap_start).days + 1
                        self._record_anomaly(
                            anomaly_type=AnomalyType.REBATE_PERIOD_OVERLAP,
                            severity=AnomalySeverity.HIGH,
                            entity_type="ChannelRebate",
                            entity_id=rebate.id,
                            description=(
                                f"渠道[{channel.channel_code if channel else 'unknown'}] "
                                f"产品[{product.product_code if product else 'unknown'}] "
                                f"返费期间重叠，记录{existing.id}({existing.period_start}~{existing.period_end})与"
                                f"记录{rebate.id}({rebate.period_start}~{rebate.period_end})重叠{overlap_days}天"
                            ),
                            expected_value="返费期间不重叠",
                            actual_value=f"重叠{overlap_days}天({overlap_start}~{overlap_end})",
                            period_start=overlap_start,
                            period_end=overlap_end
                        )

                    if (existing.period_start == rebate.period_start and
                        (existing.period_end == rebate.period_end) and
                        abs(existing.rebate_rate - rebate.rebate_rate) < Decimal("0.000001")):
                        channel = session.query(SalesChannel).filter(
                            SalesChannel.id == rebate.channel_id
                        ).first()
                        product = session.query(Product).filter(
                            Product.id == rebate.product_id
                        ).first()
                        self._record_anomaly(
                            anomaly_type=AnomalyType.DUPLICATE_REBATE,
                            severity=AnomalySeverity.HIGH,
                            entity_type="ChannelRebate",
                            entity_id=rebate.id,
                            description=(
                                f"渠道[{channel.channel_code if channel else 'unknown'}] "
                                f"产品[{product.product_code if product else 'unknown'}] "
                                f"存在完全重复的返费记录：{rebate.period_start}~{rebate.period_end}，费率{rebate.rebate_rate}"
                            ),
                            expected_value="无重复记录",
                            actual_value=f"记录{existing.id}与{rebate.id}完全重复",
                            period_start=rebate.period_start,
                            period_end=rebate.period_end
                        )

                existing_list.append(rebate)

    def detect_nav_missing(
        self,
        product_code: Optional[str] = None,
        period_start: Optional[date] = None,
        period_end: Optional[date] = None
    ):
        if not period_start or not period_end:
            return

        with self.db.get_session() as session:
            query = session.query(Product)
            if product_code:
                query = query.filter(Product.product_code == product_code)
            products = query.all()

            for product in products:
                navs = (
                    session.query(NavFlow)
                    .filter(
                        and_(
                            NavFlow.product_id == product.id,
                            NavFlow.nav_date >= period_start,
                            NavFlow.nav_date <= period_end,
                            NavFlow.is_active == True
                        )
                    )
                    .order_by(NavFlow.nav_date)
                    .all()
                )

                nav_dates = {nav.nav_date for nav in navs}
                expected_dates = set()
                current = period_start
                while current <= period_end:
                    expected_dates.add(current)
                    current += timedelta(days=1)

                missing_dates = sorted(expected_dates - nav_dates)
                if missing_dates:
                    consecutive_missing = []
                    current_start = missing_dates[0]
                    current_end = missing_dates[0]

                    for d in missing_dates[1:]:
                        if d == current_end + timedelta(days=1):
                            current_end = d
                        else:
                            consecutive_missing.append((current_start, current_end))
                            current_start = d
                            current_end = d
                    consecutive_missing.append((current_start, current_end))

                    for start, end in consecutive_missing:
                        days = (end - start).days + 1
                        self._record_anomaly(
                            anomaly_type=AnomalyType.NAV_MISSING,
                            severity=AnomalySeverity.MEDIUM,
                            entity_type="NavFlow",
                            entity_id=product.id,
                            description=(
                                f"产品[{product.product_code}] 在 {start}~{end} 期间缺失{days}天净值数据"
                            ),
                            expected_value=f"每日应有净值记录",
                            actual_value=f"缺失{days}天",
                            period_start=start,
                            period_end=end
                        )

    def detect_accrual_cross_period(
        self,
        product_code: Optional[str] = None
    ):
        with self.db.get_session() as session:
            query = session.query(FeeAccrual).filter(FeeAccrual.is_active == True)
            if product_code:
                product = session.query(Product).filter(
                    Product.product_code == product_code
                ).first()
                if product:
                    query = query.filter(FeeAccrual.product_id == product.id)

            accruals = query.all()

            for accrual in accruals:
                if accrual.period_start.month != accrual.period_end.month:
                    product = session.query(Product).filter(
                        Product.id == accrual.product_id
                    ).first()
                    self._record_anomaly(
                        anomaly_type=AnomalyType.ACCRUAL_CROSS_PERIOD,
                        severity=AnomalySeverity.MEDIUM,
                        entity_type="FeeAccrual",
                        entity_id=accrual.id,
                        description=(
                            f"产品[{product.product_code if product else 'unknown'}] "
                            f"{accrual.fee_type} 费用计提跨月：{accrual.period_start}~{accrual.period_end}，"
                            f"金额{accrual.accrual_amount}"
                        ),
                        expected_value="费用计提应按月进行",
                        actual_value=f"跨{accrual.period_start.month}月和{accrual.period_end.month}月",
                        period_start=accrual.period_start,
                        period_end=accrual.period_end
                    )

    def detect_fee_rate_abnormal(
        self,
        product_code: Optional[str] = None
    ):
        with self.db.get_session() as session:
            query = session.query(FeeRule).filter(FeeRule.is_active == True)
            if product_code:
                product = session.query(Product).filter(
                    Product.product_code == product_code
                ).first()
                if product:
                    query = query.filter(FeeRule.product_id == product.id)

            rules = query.all()

            rate_ranges = {
                FeeType.MANAGEMENT.value: (Decimal("0"), Decimal("0.03")),
                FeeType.CUSTODIAN.value: (Decimal("0"), Decimal("0.005")),
                FeeType.SALES_SERVICE.value: (Decimal("0"), Decimal("0.01")),
            }

            for rule in rules:
                product = session.query(Product).filter(
                    Product.id == rule.product_id
                ).first()
                min_rate, max_rate = rate_ranges.get(
                    rule.fee_type, (Decimal("0"), Decimal("0.1"))
                )

                if rule.rate < min_rate or rule.rate > max_rate:
                    severity = AnomalySeverity.HIGH
                    if rule.rate < min_rate:
                        description = (
                            f"产品[{product.product_code if product else 'unknown'}] "
                            f"{rule.fee_type} 费率{rule.rate*100:.6f}%过低，低于合理区间{min_rate*100:.2f}%~{max_rate*100:.2f}%"
                        )
                    else:
                        description = (
                            f"产品[{product.product_code if product else 'unknown'}] "
                            f"{rule.fee_type} 费率{rule.rate*100:.6f}%过高，高于合理区间{min_rate*100:.2f}%~{max_rate*100:.2f}%"
                        )

                    self._record_anomaly(
                        anomaly_type=AnomalyType.FEE_RATE_ABNORMAL,
                        severity=severity,
                        entity_type="FeeRule",
                        entity_id=rule.id,
                        description=description,
                        expected_value=f"{min_rate*100:.2f}%~{max_rate*100:.2f}%",
                        actual_value=f"{rule.rate*100:.6f}%",
                        period_start=rule.effective_date,
                        period_end=rule.expire_date
                    )

    def run_all_checks(
        self,
        product_code: Optional[str] = None,
        channel_code: Optional[str] = None,
        period_start: Optional[date] = None,
        period_end: Optional[date] = None,
        operator: str = "system"
    ) -> Dict[str, Any]:
        self.detected = []

        self.detect_fee_rule_gaps_and_overlaps(product_code, period_start, period_end)
        self.detect_share_caliber_mismatch(product_code, period_end)
        self.detect_duplicate_rebates(channel_code, product_code)
        if period_start and period_end:
            self.detect_nav_missing(product_code, period_start, period_end)
        self.detect_accrual_cross_period(product_code)
        self.detect_fee_rate_abnormal(product_code)

        saved = self.save_to_db(operator)

        by_severity = defaultdict(int)
        by_type = defaultdict(int)
        for anomaly in self.detected:
            by_severity[anomaly["severity"]] += 1
            by_type[anomaly["anomaly_type"]] += 1

        return {
            "total": len(self.detected),
            "saved": len(saved),
            "by_severity": dict(by_severity),
            "by_type": dict(by_type),
            "anomalies": self.detected,
        }

    def get_unresolved_anomalies(
        self,
        entity_type: Optional[str] = None,
        anomaly_type: Optional[str] = None,
        severity: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        with self.db.get_session() as session:
            query = session.query(AnomalyRecord).filter(
                AnomalyRecord.is_resolved == False
            )
            if entity_type:
                query = query.filter(AnomalyRecord.entity_type == entity_type)
            if anomaly_type:
                query = query.filter(AnomalyRecord.anomaly_type == anomaly_type)
            if severity:
                query = query.filter(AnomalyRecord.severity == severity)
            records = query.order_by(AnomalyRecord.severity, AnomalyRecord.created_at.desc()).all()
            return [
                {
                    "id": r.id,
                    "anomaly_type": r.anomaly_type,
                    "severity": r.severity,
                    "entity_type": r.entity_type,
                    "entity_id": r.entity_id,
                    "period_start": r.period_start,
                    "period_end": r.period_end,
                    "description": r.description,
                    "expected_value": r.expected_value,
                    "actual_value": r.actual_value,
                    "is_resolved": r.is_resolved,
                    "created_at": r.created_at,
                }
                for r in records
            ]

    def resolve_anomaly(
        self,
        anomaly_id: int,
        operator: str,
        resolution_note: str
    ) -> Optional[Dict[str, Any]]:
        with self.db.get_session() as session:
            anomaly = session.query(AnomalyRecord).filter(
                AnomalyRecord.id == anomaly_id
            ).first()
            if anomaly:
                anomaly.is_resolved = True
                anomaly.resolved_at = datetime.now()
                anomaly.resolved_by = operator
                anomaly.resolution_note = resolution_note
                session.flush()
                return {
                    "id": anomaly.id,
                    "anomaly_type": anomaly.anomaly_type,
                    "severity": anomaly.severity,
                    "entity_type": anomaly.entity_type,
                    "entity_id": anomaly.entity_id,
                    "description": anomaly.description,
                    "is_resolved": anomaly.is_resolved,
                    "resolved_at": anomaly.resolved_at,
                    "resolved_by": anomaly.resolved_by,
                    "resolution_note": anomaly.resolution_note,
                }
        return None
