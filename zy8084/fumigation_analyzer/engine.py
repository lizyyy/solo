"""
Risk evaluation engine for fumigation safety rules.
Evaluates rules against timeline events and generates risk events.
Handles combined conditions, time-based rules, and priority-based action selection.
"""

from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo


class RiskEngine:
    def __init__(self, rules_config: dict[str, Any], timezone: str = "Asia/Shanghai"):
        self.rules = rules_config.get("rules", [])
        self.tz = ZoneInfo(timezone)

    def evaluate(self, timeline: list[dict[str, Any]]) -> list[dict[str, Any]]:
        risk_events = []
        application_time = None

        for event in timeline:
            if event.get("event_type") == "sensor_reading":
                if application_time is None:
                    application_time = event["timestamp"]

                for rule in self.rules:
                    result = self._evaluate_rule(rule, event, application_time)
                    if result:
                        risk_events.append({
                            "timestamp": event["timestamp"],
                            "warehouse_id": event["warehouse_id"],
                            "sensor_id": event["sensor_id"],
                            "rule_name": rule.get("name", "unknown"),
                            "risk_level": rule.get("risk_level", "unknown"),
                            "action": rule.get("action", "unknown"),
                            "message": self._build_message(rule, event),
                            "concentration_ppm": event.get("concentration_ppm"),
                            "ventilation_active": event.get("ventilation_active", False),
                        })

        return risk_events

    def _evaluate_rule(self, rule: dict, event: dict, application_time: datetime) -> bool:
        condition = rule.get("condition")
        params = rule.get("params", {})

        if condition == "concentration_below":
            threshold = params.get("threshold_ppm", 0)
            return event.get("concentration_ppm", float("inf")) < threshold

        elif condition == "concentration_above":
            threshold = params.get("threshold_ppm", float("inf"))
            return event.get("concentration_ppm", 0) > threshold

        elif condition == "ventilation_active":
            return event.get("ventilation_active", False) is True

        elif condition == "ventilation_inactive":
            return event.get("ventilation_active", True) is False

        elif condition == "time_after_application":
            hours = params.get("hours", 0)
            elapsed = (event["timestamp"] - application_time).total_seconds() / 3600
            return elapsed >= hours

        elif condition == "combined":
            sub_conditions = params.get("conditions", [])
            operator = params.get("operator", "and")

            results = [
                self._evaluate_rule(sub_rule, event, application_time)
                for sub_rule in self._build_sub_rules(sub_conditions)
            ]

            if operator == "and":
                return all(results)
            elif operator == "or":
                return any(results)
            return False

        return False

    def _build_sub_rules(self, sub_conditions: list[dict]) -> list[dict]:
        return [
            {"condition": c.get("type"), "params": c} for c in sub_conditions
        ]

    def _build_message(self, rule: dict, event: dict) -> str:
        action = rule.get("action", "")
        wh_id = event.get("warehouse_id", "")
        conc = event.get("concentration_ppm", 0)
        vent = event.get("ventilation_active", False)

        if action == "safe_to_enter":
            return f"仓房 {wh_id} 浓度 {conc:.1f} ppm，通风{'进行中' if vent else '已停止'}，可安全进入"
        elif action == "do_not_enter":
            return f"仓房 {wh_id} 浓度 {conc:.1f} ppm，{'禁止' if not vent else ''}进入"
        elif action == "ventilate_now":
            return f"仓房 {wh_id} 浓度 {conc:.1f} ppm，需立即通风"
        elif action == "continue_monitoring":
            return f"仓房 {wh_id} 继续监测，浓度 {conc:.1f} ppm"
        return f"规则 {rule.get('name')} 触发: {action}"
