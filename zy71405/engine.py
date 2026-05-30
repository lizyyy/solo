from typing import List, Tuple, Dict, Optional
from datetime import datetime
import uuid

from models import (
    TradeRecord, CustomerGroup, CommissionRule, RefundResult,
    ProblemRecord, RecordStatus, ErrorType, SourceRef, CommissionTier
)


class CommissionRefundEngine:
    def __init__(self):
        self.trades: Dict[str, TradeRecord] = {}
        self.customer_groups: Dict[str, List[CustomerGroup]] = {}
        self.rules: Dict[Tuple[str, str, str], List[CommissionRule]] = {}
        self.refund_results: List[RefundResult] = []
        self.problem_records: List[ProblemRecord] = []
        self.processed_trade_ids: set = set()

    def add_trade(self, trade: TradeRecord):
        self.trades[trade.trade_id] = trade

    def add_customer_group(self, group: CustomerGroup):
        if group.customer_id not in self.customer_groups:
            self.customer_groups[group.customer_id] = []
        self.customer_groups[group.customer_id].append(group)

    def add_rule(self, rule: CommissionRule):
        key = (rule.group_id, rule.product_type, rule.effective_date[:7])
        if key not in self.rules:
            self.rules[key] = []
        self.rules[key].append(rule)

    def get_customer_group(self, customer_id: str, trade_date: str) -> Optional[CustomerGroup]:
        if customer_id not in self.customer_groups:
            return None
        groups = self.customer_groups[customer_id]
        trade_dt = datetime.strptime(trade_date, "%Y-%m-%d")
        for group in groups:
            valid_from = datetime.strptime(group.valid_from, "%Y-%m-%d")
            valid_to = datetime.strptime(group.valid_to, "%Y-%m-%d") if group.valid_to else datetime.max
            if valid_from <= trade_dt <= valid_to:
                return group
        return None

    def get_rule(self, group_id: str, product_type: str, trade_date: str) -> Optional[CommissionRule]:
        key = (group_id, product_type, trade_date[:7])
        if key not in self.rules:
            for (g, p, m), rules in self.rules.items():
                if g == group_id and p == product_type:
                    for rule in rules:
                        if rule.effective_date <= trade_date:
                            return rule
            return None
        rules = self.rules[key]
        return max(rules, key=lambda r: r.effective_date) if rules else None

    def validate_tiers(self, tiers: List[CommissionTier]) -> Tuple[bool, str]:
        if not tiers:
            return False, "无阶梯配置"
        sorted_tiers = sorted(tiers, key=lambda t: t.min_amount)
        for i in range(len(sorted_tiers) - 1):
            if sorted_tiers[i].max_amount is None:
                continue
            if sorted_tiers[i + 1].min_amount > sorted_tiers[i].max_amount:
                return False, f"阶梯存在缺口: {sorted_tiers[i].max_amount} - {sorted_tiers[i + 1].min_amount}"
            if sorted_tiers[i + 1].min_amount < sorted_tiers[i].max_amount:
                return False, f"阶梯跨档重叠: {sorted_tiers[i].max_amount} 与 {sorted_tiers[i + 1].min_amount}"
        return True, ""

    def calculate_refund(self, trade: TradeRecord) -> Tuple[Optional[RefundResult], Optional[ProblemRecord]]:
        if trade.trade_amount <= 0:
            problem = ProblemRecord(
                record_id=str(uuid.uuid4()),
                status=RecordStatus.ERROR,
                error_type=ErrorType.INVALID_AMOUNT,
                description=f"交易金额无效: {trade.trade_amount}",
                sources=[trade.source] if trade.source else [],
                related_ids=[trade.trade_id],
                raw_data={"trade_id": trade.trade_id, "trade_amount": trade.trade_amount},
                rule_version=""
            )
            return None, problem

        group = self.get_customer_group(trade.customer_id, trade.trade_date)
        if not group:
            problem = ProblemRecord(
                record_id=str(uuid.uuid4()),
                status=RecordStatus.ERROR,
                error_type=ErrorType.MISSING_GROUP,
                description=f"客户 {trade.customer_id} 在 {trade.trade_date} 无对应分组",
                sources=[trade.source] if trade.source else [],
                related_ids=[trade.trade_id, trade.customer_id],
                raw_data={"trade_id": trade.trade_id, "customer_id": trade.customer_id, "trade_date": trade.trade_date},
                rule_version=""
            )
            return None, problem

        rule = self.get_rule(group.group_id, trade.product_type, trade.trade_date)
        if not rule:
            problem = ProblemRecord(
                record_id=str(uuid.uuid4()),
                status=RecordStatus.ERROR,
                error_type=ErrorType.MISSING_RULE,
                description=f"分组 {group.group_id} 产品 {trade.product_type} 无佣金规则",
                sources=[trade.source, group.source] if trade.source and group.source else [trade.source] if trade.source else [],
                related_ids=[trade.trade_id, group.group_id, trade.product_type],
                raw_data={"trade_id": trade.trade_id, "group_id": group.group_id, "product_type": trade.product_type},
                rule_version=""
            )
            return None, problem

        valid, tier_error = self.validate_tiers(rule.tiers)
        if not valid:
            problem = ProblemRecord(
                record_id=str(uuid.uuid4()),
                status=RecordStatus.ERROR,
                error_type=ErrorType.STEP_CROSS,
                description=f"规则 {rule.rule_id} {tier_error}",
                sources=[rule.source, trade.source] if rule.source and trade.source else [],
                related_ids=[trade.trade_id, rule.rule_id],
                raw_data={"rule_id": rule.rule_id, "tiers": [(t.min_amount, t.max_amount, t.refund_rate) for t in rule.tiers]},
                rule_version=rule.rule_version
            )
            return None, problem

        sorted_tiers = sorted(rule.tiers, key=lambda t: t.min_amount)
        applicable_tier = None
        for tier in sorted_tiers:
            if trade.trade_amount >= tier.min_amount:
                if tier.max_amount is None or trade.trade_amount < tier.max_amount:
                    applicable_tier = tier
                    break
        if not applicable_tier and sorted_tiers:
            applicable_tier = sorted_tiers[-1]

        refund_amount = trade.trade_amount * applicable_tier.refund_rate
        refund_result = RefundResult(
            refund_id=str(uuid.uuid4()),
            trade_id=trade.trade_id,
            customer_id=trade.customer_id,
            customer_name=group.customer_name,
            group_id=group.group_id,
            product_type=trade.product_type,
            trade_amount=trade.trade_amount,
            refund_amount=round(refund_amount, 2),
            refund_rate=applicable_tier.refund_rate,
            rule_id=rule.rule_id,
            rule_version=rule.rule_version,
            refund_date=datetime.now().strftime("%Y-%m-%d"),
            trade_source=trade.source,
            rule_source=rule.source
        )
        return refund_result, None

    def detect_duplicates(self) -> List[ProblemRecord]:
        duplicates = []
        seen = {}
        for result in self.refund_results:
            key = (result.customer_id, result.product_type, result.trade_id, result.rule_version)
            if key in seen:
                problem = ProblemRecord(
                    record_id=str(uuid.uuid4()),
                    status=RecordStatus.ERROR,
                    error_type=ErrorType.DUPLICATE_REFUND,
                    description=f"返还重复入账: 客户{result.customer_id} 产品{result.product_type} 交易{result.trade_id}",
                    sources=[result.trade_source, result.rule_source] if result.trade_source and result.rule_source else [],
                    related_ids=[result.refund_id, seen[key]],
                    raw_data={"trade_id": result.trade_id, "customer_id": result.customer_id},
                    rule_version=result.rule_version
                )
                duplicates.append(problem)
            else:
                seen[key] = result.refund_id
        return duplicates

    def detect_group_changes(self) -> List[ProblemRecord]:
        changes = []
        for customer_id, groups in self.customer_groups.items():
            if len(groups) > 1:
                sorted_groups = sorted(groups, key=lambda g: g.valid_from)
                for i in range(len(sorted_groups) - 1):
                    if sorted_groups[i].group_id != sorted_groups[i + 1].group_id:
                        problem = ProblemRecord(
                            record_id=str(uuid.uuid4()),
                            status=RecordStatus.ERROR,
                            error_type=ErrorType.GROUP_CHANGE,
                            description=f"客户 {customer_id} 分组变更: {sorted_groups[i].group_id} -> {sorted_groups[i+1].group_id}",
                            sources=[sorted_groups[i].source, sorted_groups[i+1].source] if sorted_groups[i].source and sorted_groups[i+1].source else [],
                            related_ids=[customer_id, sorted_groups[i].group_id, sorted_groups[i+1].group_id],
                            raw_data={"customer_id": customer_id, "old_group": sorted_groups[i].group_id, "new_group": sorted_groups[i+1].group_id},
                            rule_version=""
                        )
                        changes.append(problem)
        return changes

    def process_all(self):
        self.refund_results = []
        self.problem_records = []
        for trade in self.trades.values():
            if trade.trade_id in self.processed_trade_ids:
                continue
            result, problem = self.calculate_refund(trade)
            if result:
                self.refund_results.append(result)
                self.processed_trade_ids.add(trade.trade_id)
            if problem:
                self.problem_records.append(problem)
        self.problem_records.extend(self.detect_duplicates())
        self.problem_records.extend(self.detect_group_changes())
