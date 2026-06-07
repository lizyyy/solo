"""
边界规则引擎 - 负责边界规则的定义、匹配、执行和回滚
"""
import json
from pathlib import Path
from typing import List, Dict, Optional, Callable, Any
from datetime import datetime

from .models import (
    BoundaryRule,
    BoundaryRuleType,
    SnapshotRecord,
    ProcessingStatus,
)


class BoundaryRuleEngine:
    def __init__(self, rules_dir: str = "data/rules"):
        self.rules_dir = Path(rules_dir)
        self.rules_dir.mkdir(parents=True, exist_ok=True)
        self.rules_file = self.rules_dir / "boundary_rules.json"
        self._rules: Dict[str, BoundaryRule] = {}
        self._load_rules()
        self._init_default_rules()

    def _load_rules(self):
        if self.rules_file.exists():
            with open(self.rules_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for rule_id, rule_data in data.items():
                    self._rules[rule_id] = BoundaryRule.from_dict(rule_data)

    def _save_rules(self):
        data = {
            rule_id: rule.to_dict()
            for rule_id, rule in self._rules.items()
        }
        with open(self.rules_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _init_default_rules(self):
        default_rules = [
            BoundaryRule(
                rule_type=BoundaryRuleType.MISSING_FEATURE_DEFAULT_SCORE,
                name="线上特征缺失却给了默认分",
                description="当特征快照中存在缺失特征，且点击偏差分数使用了默认值时触发",
                condition="record.missing_features and record.default_score_applied",
                action="record.status = ProcessingStatus.NEEDS_REVIEW; record.assigned_to = '推荐负责人'",
                rollback_action="record.status = ProcessingStatus.IMPORTED; record.assigned_to = None",
                enabled=True,
                created_by="system",
            ),
            BoundaryRule(
                rule_type=BoundaryRuleType.CLICK_BIAS_INCONSISTENT,
                name="排名学习点击偏差前后不一致",
                description="当同一特征快照编号多次导入的点击偏差分数差异超过阈值时触发",
                condition="context.get('old_score') is not None and context.get('new_score') is not None and abs(context['new_score'] - context['old_score']) > 0.1",
                action="record.status = ProcessingStatus.NEEDS_REVIEW; record.notes = '点击偏差分数前后不一致'",
                rollback_action="record.status = ProcessingStatus.IMPORTED",
                enabled=True,
                created_by="system",
            ),
        ]

        for rule in default_rules:
            existing = [r for r in self._rules.values() if r.name == rule.name]
            if not existing:
                self._rules[rule.rule_id] = rule

        self._save_rules()

    def add_rule(self, rule: BoundaryRule) -> BoundaryRule:
        self._rules[rule.rule_id] = rule
        self._save_rules()
        return rule

    def remove_rule(self, rule_id: str) -> bool:
        if rule_id in self._rules:
            del self._rules[rule_id]
            self._save_rules()
            return True
        return False

    def enable_rule(self, rule_id: str) -> bool:
        if rule_id in self._rules:
            self._rules[rule_id].enabled = True
            self._save_rules()
            return True
        return False

    def disable_rule(self, rule_id: str) -> bool:
        if rule_id in self._rules:
            self._rules[rule_id].enabled = False
            self._save_rules()
            return True
        return False

    def list_rules(
        self,
        rule_type: Optional[BoundaryRuleType] = None,
        enabled_only: bool = False,
    ) -> List[BoundaryRule]:
        rules = list(self._rules.values())
        if rule_type:
            rules = [r for r in rules if r.rule_type == rule_type]
        if enabled_only:
            rules = [r for r in rules if r.enabled]
        return sorted(rules, key=lambda r: r.created_at)

    def get_rule(self, rule_id: str) -> Optional[BoundaryRule]:
        return self._rules.get(rule_id)

    def evaluate_record(
        self,
        record: SnapshotRecord,
        context: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        triggered_rules = []
        context = context or {}

        for rule in self._rules.values():
            if not rule.enabled:
                continue

            try:
                rule_context = {
                    "record": record,
                    "ProcessingStatus": ProcessingStatus,
                    "context": context,
                }
                condition_met = eval(rule.condition, {"__builtins__": {}}, rule_context)

                if condition_met:
                    triggered_rules.append({
                        "rule_id": rule.rule_id,
                        "rule_name": rule.name,
                        "rule_type": rule.rule_type.value,
                        "action": rule.action,
                        "description": rule.description,
                    })
            except Exception as e:
                print(f"规则 {rule.name} 执行出错: {e}")

        return triggered_rules

    def apply_rules(
        self,
        record: SnapshotRecord,
        context: Optional[Dict[str, Any]] = None,
        applied_by: str = "system",
    ) -> Dict[str, Any]:
        triggered = self.evaluate_record(record, context)
        applied_actions = []

        for rule_info in triggered:
            rule = self._rules.get(rule_info["rule_id"])
            if not rule:
                continue

            try:
                exec_context = {
                    "record": record,
                    "ProcessingStatus": ProcessingStatus,
                    "context": context or {},
                }
                exec(rule.action, {"__builtins__": {}}, exec_context)
                applied_actions.append({
                    "rule_id": rule.rule_id,
                    "rule_name": rule.name,
                    "applied_at": datetime.now().isoformat(),
                    "applied_by": applied_by,
                })
            except Exception as e:
                print(f"执行规则 {rule.name} 的动作时出错: {e}")

        return {
            "triggered_rules": triggered,
            "applied_actions": applied_actions,
            "record_status_after": record.status,
        }

    def rollback_rule(
        self,
        record: SnapshotRecord,
        rule_id: str,
        rolled_back_by: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> bool:
        rule = self._rules.get(rule_id)
        if not rule or not rule.rollback_action:
            return False

        try:
            exec_context = {
                "record": record,
                "ProcessingStatus": ProcessingStatus,
                "context": context or {},
            }
            exec(rule.rollback_action, {"__builtins__": {}}, exec_context)
            record.custom_fields[f"rollback_{rule_id}"] = {
                "rolled_back_by": rolled_back_by,
                "rolled_back_at": datetime.now().isoformat(),
            }
            return True
        except Exception as e:
            print(f"回滚规则 {rule.name} 时出错: {e}")
            return False

    def check_missing_feature_default_score(
        self,
        record: SnapshotRecord,
    ) -> Dict[str, Any]:
        has_missing = bool(record.missing_features)
        has_default = record.default_score_applied

        return {
            "violation": has_missing and has_default,
            "has_missing_features": has_missing,
            "has_default_score": has_default,
            "missing_features": record.missing_features,
            "recommendation": "需推荐负责人复核，不急着归为正常" if (has_missing and has_default) else "正常",
        }
