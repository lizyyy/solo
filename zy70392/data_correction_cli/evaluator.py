from datetime import datetime, date
from typing import List, Dict, Any, Tuple, Optional
from .models import (
    CorrectionPlan, DownstreamDependency, ReportRule, BillRule, CacheConfig,
    AssessmentResult, AssessmentResultItem, RiskLevel, FieldType,
    ExecutionPlan, BusinessSignatureReport, RiskConfirmation
)


class ImpactEvaluator:
    def __init__(
        self,
        plan: CorrectionPlan,
        dependencies: List[DownstreamDependency],
        report_rules: List[ReportRule],
        bill_rules: List[BillRule],
        cache_configs: List[CacheConfig]
    ):
        self.plan = plan
        self.dependencies = dependencies
        self.report_rules = report_rules
        self.bill_rules = bill_rules
        self.cache_configs = cache_configs
        self.affected_fields = set(item.field_name for item in plan.items)
        self.has_amount_change = any(
            item.field_type == FieldType.AMOUNT for item in plan.items
        )
        self.has_channel_change = any(
            item.field_type == FieldType.CHANNEL for item in plan.items
        )
        self.has_tag_change = any(
            item.field_type == FieldType.USER_TAG for item in plan.items
        )

    def evaluate(self) -> AssessmentResult:
        result = AssessmentResult(
            plan_id=self.plan.plan_id,
            items=[],
            missing_owners=[],
            issues=[]
        )

        for dep in self.dependencies:
            item = self._evaluate_dependency(dep)
            if item:
                result.items.append(item)
                if not dep.owner:
                    result.missing_owners.append(dep.name)

        for rule in self.report_rules:
            item = self._evaluate_report_rule(rule)
            if item:
                result.items.append(item)
                if not rule.owner:
                    result.missing_owners.append(rule.report_name)

        for rule in self.bill_rules:
            item = self._evaluate_bill_rule(rule)
            if item:
                result.items.append(item)
                if rule.is_settled:
                    result.has_settled_bills = True
                if not rule.owner:
                    result.missing_owners.append(rule.bill_name)

        for config in self.cache_configs:
            item = self._evaluate_cache_config(config)
            if item:
                result.items.append(item)
                if not config.owner:
                    result.missing_owners.append(config.cache_name)

        result.needs_approval = any(
            item.requires_approval for item in result.items
        )

        result.missing_owners = list(set(result.missing_owners))

        if result.missing_owners:
            result.issues.append(
                f"以下下游缺少负责人: {', '.join(result.missing_owners)}"
            )

        return result

    def _evaluate_dependency(
        self, dep: DownstreamDependency
    ) -> Optional[AssessmentResultItem]:
        has_overlap = bool(set(dep.affected_fields) & self.affected_fields)
        if not has_overlap:
            return None

        if dep.refresh_method == "recalc":
            action = "recalc"
            risk = self._calculate_risk(dep.type, dep.name)
        elif dep.refresh_method == "refresh_cache":
            action = "refresh_cache"
            risk = RiskLevel.LOW
        else:
            action = "skip"
            risk = RiskLevel.LOW

        return AssessmentResultItem(
            target_id=dep.dependency_id,
            target_name=dep.name,
            target_type=dep.type,
            action=action,
            risk_level=risk,
            owner=dep.owner,
            reason=f"依赖字段 {', '.join(set(dep.affected_fields) & self.affected_fields)} 被修改",
            requires_approval=risk in [RiskLevel.HIGH, RiskLevel.CRITICAL]
        )

    def _evaluate_report_rule(
        self, rule: ReportRule
    ) -> Optional[AssessmentResultItem]:
        has_overlap = bool(set(rule.affected_fields) & self.affected_fields)
        if not has_overlap:
            return None

        action = "recalc" if rule.requires_recalc else "skip"
        risk = RiskLevel.HIGH if self.has_amount_change else RiskLevel.MEDIUM

        return AssessmentResultItem(
            target_id=rule.rule_id,
            target_name=rule.report_name,
            target_type="report",
            action=action,
            risk_level=risk,
            owner=rule.owner,
            reason=f"报表依赖字段 {', '.join(set(rule.affected_fields) & self.affected_fields)} 被修改，影响 {len(rule.affected_periods)} 个周期",
            requires_approval=risk == RiskLevel.HIGH
        )

    def _evaluate_bill_rule(
        self, rule: BillRule
    ) -> Optional[AssessmentResultItem]:
        has_overlap = bool(set(rule.affected_fields) & self.affected_fields)
        if not has_overlap:
            return None

        affects_amount = rule.affects_amount and self.has_amount_change
        affects_channel = self.has_channel_change and "channel" in rule.affected_fields

        if affects_amount:
            action = "recalc"
            risk = RiskLevel.CRITICAL if rule.is_settled else RiskLevel.HIGH
        elif affects_channel:
            action = "recalc"
            risk = RiskLevel.HIGH if rule.is_settled else RiskLevel.MEDIUM
        else:
            action = "recalc"
            risk = RiskLevel.MEDIUM

        return AssessmentResultItem(
            target_id=rule.rule_id,
            target_name=rule.bill_name,
            target_type="bill",
            action=action,
            risk_level=risk,
            owner=rule.owner,
            reason=f"账单{'金额' if affects_amount else '渠道'}字段被修改{'（已结算账单，需二次审批）' if rule.is_settled else ''}",
            requires_approval=rule.is_settled or risk in [RiskLevel.HIGH, RiskLevel.CRITICAL],
            is_settled=rule.is_settled
        )

    def _evaluate_cache_config(
        self, config: CacheConfig
    ) -> Optional[AssessmentResultItem]:
        has_overlap = bool(set(config.affected_fields) & self.affected_fields)
        if not has_overlap:
            return None

        return AssessmentResultItem(
            target_id=config.cache_id,
            target_name=config.cache_name,
            target_type="cache",
            action="refresh_cache",
            risk_level=RiskLevel.LOW,
            owner=config.owner,
            reason=f"缓存依赖字段 {', '.join(set(config.affected_fields) & self.affected_fields)} 被修改，需刷新 {len(config.cache_keys)} 个缓存键",
            requires_approval=False
        )

    def _calculate_risk(self, dep_type: str, name: str) -> RiskLevel:
        if dep_type == "bill":
            return RiskLevel.HIGH
        if dep_type == "report" and self.has_amount_change:
            return RiskLevel.HIGH
        if dep_type == "tag" and self.has_tag_change:
            return RiskLevel.MEDIUM
        return RiskLevel.MEDIUM


class ExecutionPlanGenerator:
    def __init__(self, plan: CorrectionPlan, assessment: AssessmentResult):
        self.plan = plan
        self.assessment = assessment

    def generate(self) -> ExecutionPlan:
        steps = []
        sorted_items = sorted(
            self.assessment.items,
            key=lambda x: self._action_priority(x.action)
        )

        for idx, item in enumerate(sorted_items, 1):
            step = {
                "step": idx,
                "target": item.target_name,
                "type": item.target_type,
                "action": item.action,
                "risk_level": item.risk_level.value,
                "requires_approval": item.requires_approval,
                "is_settled": item.is_settled,
                "owner": item.owner,
                "description": self._get_step_description(item)
            }
            steps.append(step)

        rollback_plan = self._generate_rollback_plan()

        return ExecutionPlan(
            plan_id=self.plan.plan_id,
            steps=steps,
            rollback_plan=rollback_plan
        )

    def _action_priority(self, action: str) -> int:
        priorities = {
            "recalc": 1,
            "refresh_cache": 2,
            "skip": 3
        }
        return priorities.get(action, 3)

    def _get_step_description(self, item: AssessmentResultItem) -> str:
        if item.action == "recalc":
            if item.target_type == "bill":
                return f"重新计算账单: {item.target_name}"
            elif item.target_type == "report":
                return f"重新生成报表: {item.target_name}"
            else:
                return f"重新计算下游系统: {item.target_name}"
        elif item.action == "refresh_cache":
            return f"刷新缓存: {item.target_name}"
        return f"跳过: {item.target_name}"

    def _generate_rollback_plan(self) -> List[Dict[str, Any]]:
        rollback_steps = []
        for idx, item in enumerate(self.assessment.items, 1):
            if item.action != "skip":
                rollback_steps.append({
                    "step": idx,
                    "target": item.target_name,
                    "action": "rollback_" + item.action,
                    "description": f"回滚 {item.target_name} 的操作"
                })
        return rollback_steps


class ReportGenerator:
    def __init__(
        self,
        plan: CorrectionPlan,
        assessment: AssessmentResult,
        execution_plan: ExecutionPlan
    ):
        self.plan = plan
        self.assessment = assessment
        self.execution_plan = execution_plan

    def generate_signature_report(self) -> BusinessSignatureReport:
        overall_risk = self._calculate_overall_risk()
        settled_items = self._get_settled_items()
        cannot_auto = self._get_cannot_auto_process()
        suggested_order = self._get_suggested_order()

        return BusinessSignatureReport(
            plan_id=self.plan.plan_id,
            plan_name=self.plan.plan_name,
            created_by=self.plan.created_by,
            affected_objects=self._get_affected_objects(),
            recalc_steps=[s for s in self.execution_plan.steps if s["action"] == "recalc"],
            risk_level=overall_risk,
            rollback_suggestions=self._get_rollback_suggestions(),
            settled_items=settled_items,
            cannot_auto_process=cannot_auto,
            suggested_order=suggested_order,
            signature_fields={
                "assessor": "",
                "assessor_signature": "",
                "assessor_date": None,
                "approver": "",
                "approver_signature": "",
                "approver_date": None
            }
        )

    def _calculate_overall_risk(self) -> RiskLevel:
        if any(item.risk_level == RiskLevel.CRITICAL for item in self.assessment.items):
            return RiskLevel.CRITICAL
        if any(item.risk_level == RiskLevel.HIGH for item in self.assessment.items):
            return RiskLevel.HIGH
        if any(item.risk_level == RiskLevel.MEDIUM for item in self.assessment.items):
            return RiskLevel.MEDIUM
        return RiskLevel.LOW

    def _get_affected_objects(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": item.target_name,
                "type": item.target_type,
                "action": item.action,
                "risk_level": item.risk_level.value,
                "owner": item.owner,
                "reason": item.reason
            }
            for item in self.assessment.items
        ]

    def _get_settled_items(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": item.target_name,
                "type": item.target_type,
                "risk_level": item.risk_level.value,
                "reason": item.reason
            }
            for item in self.assessment.items
            if item.is_settled
        ]

    def _get_cannot_auto_process(self) -> List[Dict[str, Any]]:
        items = []
        for item in self.assessment.items:
            if item.requires_approval:
                items.append({
                    "name": item.target_name,
                    "type": item.target_type,
                    "reason": f"需要审批: {item.reason}",
                    "risk_level": item.risk_level.value
                })
        for missing in self.assessment.missing_owners:
            items.append({
                "name": missing,
                "type": "unknown",
                "reason": "缺少负责人，无法自动处理",
                "risk_level": RiskLevel.MEDIUM.value
            })
        return items

    def _get_suggested_order(self) -> List[str]:
        order = []
        for step in self.execution_plan.steps:
            if step["action"] != "skip":
                prefix = "【需审批】" if step["requires_approval"] else ""
                settled_mark = "【已结算⚠️】" if step["is_settled"] else ""
                order.append(f"{prefix}{settled_mark}{step['target']} ({step['action']})")
        return order

    def _get_rollback_suggestions(self) -> List[str]:
        suggestions = [
            "执行前备份原始数据",
            "先执行非关键路径的重算，验证结果后再执行关键路径",
            "已结算账单的修改需财务审批后执行",
            "建议在业务低峰期执行缓存刷新",
            "执行完成后抽查关键报表和账单数据"
        ]
        if self.assessment.has_settled_bills:
            suggestions.insert(0, "⚠️ 已结算账单修改需执行二次审批流程")
        return suggestions


def load_yaml(filepath: str) -> Dict[str, Any]:
    import yaml
    with open(filepath, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def _convert_enums(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _convert_enums(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_convert_enums(item) for item in obj]
    elif hasattr(obj, 'value'):
        return obj.value
    return obj


def save_yaml(data: Dict[str, Any], filepath: str):
    import yaml
    converted = _convert_enums(data)
    with open(filepath, 'w', encoding='utf-8') as f:
        yaml.dump(converted, f, allow_unicode=True, default_flow_style=False)


def save_json(data: Dict[str, Any], filepath: str):
    import json
    converted = _convert_enums(data)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(converted, f, ensure_ascii=False, indent=2, default=str)
