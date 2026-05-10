from typing import Dict, Optional
from dataclasses import dataclass


@dataclass
class AlertRule:
    metric_name: str
    alert_type: str
    threshold: float
    operator: str = "gt"
    description: str = ""


class AlertRuleService:
    _rules: Dict[str, AlertRule] = {}

    @classmethod
    def register_rule(cls, rule: AlertRule):
        key = f"{rule.metric_name}:{rule.alert_type}"
        cls._rules[key] = rule

    @classmethod
    def get_rule(cls, metric_name: str, alert_type: str) -> Optional[AlertRule]:
        key = f"{metric_name}:{alert_type}"
        return cls._rules.get(key)

    @classmethod
    def get_rules_for_metric(cls, metric_name: str) -> list:
        return [r for r in cls._rules.values() if r.metric_name == metric_name]

    @classmethod
    def should_alert(cls, metric_name: str, value: float) -> Optional[AlertRule]:
        rules = cls.get_rules_for_metric(metric_name)
        for rule in rules:
            if cls._check_threshold(rule, value):
                return rule
        return None

    @staticmethod
    def _check_threshold(rule: AlertRule, value: float) -> bool:
        if rule.operator == "gt":
            return value > rule.threshold
        elif rule.operator == "lt":
            return value < rule.threshold
        elif rule.operator == "gte":
            return value >= rule.threshold
        elif rule.operator == "lte":
            return value <= rule.threshold
        return False


AlertRuleService.register_rule(AlertRule(
    metric_name="sales_amount",
    alert_type="high_sales",
    threshold=100000,
    operator="gt",
    description="单笔销售额超过10万告警"
))

AlertRuleService.register_rule(AlertRule(
    metric_name="order_count",
    alert_type="low_orders",
    threshold=10,
    operator="lt",
    description="小时订单量低于10告警"
))

AlertRuleService.register_rule(AlertRule(
    metric_name="conversion_rate",
    alert_type="low_conversion",
    threshold=0.01,
    operator="lt",
    description="转化率低于1%告警"
))
