import os
import json
from datetime import datetime
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum

from ..storage.quarantine import QuarantineItem, QuarantineManager


class ActionType(Enum):
    REMOVE_FROM_LDAP_GROUP = "remove_from_ldap_group"
    REVOKE_SUDO_RULE = "revoke_sudo_rule"
    DELETE_ACCOUNT = "delete_account"
    MODIFY_SUDO_RULE = "modify_sudo_rule"
    MOVE_TO_CORRECT_GROUP = "move_to_correct_group"
    DEDUPLICATE_ACCOUNT = "deduplicate_account"
    FIX_DATA_ROW = "fix_data_row"


ACTION_TYPE_TO_NAME = {
    ActionType.REMOVE_FROM_LDAP_GROUP: "从LDAP组移除",
    ActionType.REVOKE_SUDO_RULE: "撤销sudo规则",
    ActionType.DELETE_ACCOUNT: "删除账号",
    ActionType.MODIFY_SUDO_RULE: "修改sudo规则",
    ActionType.MOVE_TO_CORRECT_GROUP: "移动到正确的组",
    ActionType.DEDUPLICATE_ACCOUNT: "去重账号",
    ActionType.FIX_DATA_ROW: "修复数据行",
}


@dataclass
class PlanItem:
    item_id: str
    rule_id: str
    severity: str
    action_type: str
    affected_entity: str
    entity_type: str
    description: str
    undo_info: Dict[str, Any]
    evidence: Dict[str, Any]
    requires_approval: bool = True
    estimated_risk: str = "medium"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "item_id": self.item_id,
            "rule_id": self.rule_id,
            "severity": self.severity,
            "action_type": self.action_type,
            "affected_entity": self.affected_entity,
            "entity_type": self.entity_type,
            "description": self.description,
            "undo_info": self.undo_info,
            "evidence": self.evidence,
            "requires_approval": self.requires_approval,
            "estimated_risk": self.estimated_risk,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PlanItem":
        return cls(
            item_id=data.get("item_id", ""),
            rule_id=data.get("rule_id", ""),
            severity=data.get("severity", "medium"),
            action_type=data.get("action_type", ""),
            affected_entity=data.get("affected_entity", ""),
            entity_type=data.get("entity_type", ""),
            description=data.get("description", ""),
            undo_info=data.get("undo_info", {}),
            evidence=data.get("evidence", {}),
            requires_approval=data.get("requires_approval", True),
            estimated_risk=data.get("estimated_risk", "medium"),
        )


@dataclass
class RemediationPlan:
    plan_id: str
    generated_at: str
    items: List[PlanItem]
    summary: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "plan_id": self.plan_id,
            "generated_at": self.generated_at,
            "items": [item.to_dict() for item in self.items],
            "summary": self.summary,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RemediationPlan":
        return cls(
            plan_id=data.get("plan_id", ""),
            generated_at=data.get("generated_at", ""),
            items=[PlanItem.from_dict(i) for i in data.get("items", [])],
            summary=data.get("summary", {}),
        )

    def get_items_by_severity(self, severity: str) -> List[PlanItem]:
        return [i for i in self.items if i.severity == severity]

    def get_items_by_rule(self, rule_id: str) -> List[PlanItem]:
        return [i for i in self.items if i.rule_id == rule_id]


class RemediationPlanner:
    RULE_TO_ACTION_MAP = {
        "orphan_account": ActionType.REMOVE_FROM_LDAP_GROUP,
        "group_drift": ActionType.MOVE_TO_CORRECT_GROUP,
        "sudo_overreach": ActionType.MODIFY_SUDO_RULE,
        "asset_env_mismatch": ActionType.REVOKE_SUDO_RULE,
        "duplicate_account": ActionType.DEDUPLICATE_ACCOUNT,
        "bad_row": ActionType.FIX_DATA_ROW,
    }

    SEVERITY_TO_RISK = {
        "critical": "high",
        "high": "medium",
        "medium": "low",
        "low": "low",
    }

    def __init__(self, quarantine_manager: QuarantineManager):
        self.quarantine_manager = quarantine_manager

    def generate_plan(self, filter_severity: Optional[List[str]] = None) -> RemediationPlan:
        pending_items = self.quarantine_manager.get_pending_items()

        if filter_severity:
            pending_items = [
                i for i in pending_items if i.severity in filter_severity
            ]

        plan_items: List[PlanItem] = []
        item_counter = 1

        for q_item in pending_items:
            action_type = self.RULE_TO_ACTION_MAP.get(
                q_item.rule_id, ActionType.FIX_DATA_ROW
            )

            undo_info = self._generate_undo_info(q_item, action_type)
            plan_item = PlanItem(
                item_id=f"ITEM-{item_counter:04d}",
                rule_id=q_item.rule_id,
                severity=q_item.severity,
                action_type=action_type.value,
                affected_entity=q_item.affected_entity,
                entity_type=q_item.entity_type,
                description=self._generate_action_description(q_item, action_type),
                undo_info=undo_info,
                evidence=q_item.evidence,
                requires_approval=q_item.severity in ["critical", "high"],
                estimated_risk=self.SEVERITY_TO_RISK.get(q_item.severity, "medium"),
            )
            plan_items.append(plan_item)
            item_counter += 1

        summary = self._generate_summary(plan_items)

        plan = RemediationPlan(
            plan_id=f"PLAN-{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            generated_at=datetime.now().isoformat(),
            items=plan_items,
            summary=summary,
        )

        return plan

    def _generate_action_description(self, q_item: QuarantineItem, action_type: ActionType) -> str:
        entity = q_item.affected_entity
        
        if q_item.rule_id == "orphan_account":
            groups = q_item.evidence.get("in_ldap_groups", [])
            if groups:
                return f"将离职用户 '{entity}' 从LDAP组 {groups} 中移除"
            return f"撤销离职用户 '{entity}' 的所有权限"

        elif q_item.rule_id == "group_drift":
            if "production_admin" in q_item.description.lower():
                return f"将测试部门用户 '{entity}' 从生产管理员组中移除"
            return f"检查并调整用户 '{entity}' 的组权限"

        elif q_item.rule_id == "sudo_overreach":
            issues = q_item.evidence.get("issues", [])
            return f"修复用户/组 '{entity}' 的危险sudo规则: {', '.join(issues)}"

        elif q_item.rule_id == "asset_env_mismatch":
            prod_host = q_item.evidence.get("production_host") or q_item.evidence.get("sudo_host", "")
            return f"移除测试用户 '{entity}' 在生产主机 '{prod_host}' 上的sudo权限"

        elif q_item.rule_id == "duplicate_account":
            count = q_item.evidence.get("count", 0)
            return f"去重账号 '{entity}' 的 {count} 条重复记录"

        elif q_item.rule_id == "bad_row":
            errors = q_item.evidence.get("errors", [])
            return f"修复无效数据行: {', '.join(errors)}"

        return f"处理问题: {q_item.description}"

    def _generate_undo_info(self, q_item: QuarantineItem, action_type: ActionType) -> Dict[str, Any]:
        undo_info: Dict[str, Any] = {
            "original_rule_id": q_item.rule_id,
            "original_affected_entity": q_item.affected_entity,
            "original_evidence": q_item.evidence,
        }

        if q_item.rule_id == "orphan_account":
            undo_info["action_undo"] = {
                "type": "add_to_groups",
                "groups": q_item.evidence.get("in_ldap_groups", []),
                "sudo_rules_count": q_item.evidence.get("in_sudo_rules_count", 0),
            }

        elif q_item.rule_id == "sudo_overreach":
            undo_info["action_undo"] = {
                "type": "restore_sudo_rule",
                "original_rule": q_item.evidence.get("rule", {}),
            }

        elif q_item.rule_id == "asset_env_mismatch":
            undo_info["action_undo"] = {
                "type": "restore_sudo_access",
                "host": q_item.evidence.get("production_host") or q_item.evidence.get("sudo_host"),
                "original_rule": q_item.evidence.get("rule", {}),
            }

        return undo_info

    def _generate_summary(self, items: List[PlanItem]) -> Dict[str, Any]:
        by_severity: Dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        by_rule: Dict[str, int] = {}
        by_action: Dict[str, int] = {}
        by_risk: Dict[str, int] = {"high": 0, "medium": 0, "low": 0}
        needs_approval = 0

        for item in items:
            by_severity[item.severity] = by_severity.get(item.severity, 0) + 1
            by_rule[item.rule_id] = by_rule.get(item.rule_id, 0) + 1
            by_action[item.action_type] = by_action.get(item.action_type, 0) + 1
            by_risk[item.estimated_risk] = by_risk.get(item.estimated_risk, 0) + 1
            if item.requires_approval:
                needs_approval += 1

        return {
            "total_items": len(items),
            "by_severity": by_severity,
            "by_rule": by_rule,
            "by_action": by_action,
            "by_risk": by_risk,
            "items_needing_approval": needs_approval,
        }

    def save_plan(self, plan: RemediationPlan, output_path: str) -> None:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(plan.to_dict(), f, ensure_ascii=False, indent=2)

    def load_plan(self, input_path: str) -> RemediationPlan:
        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return RemediationPlan.from_dict(data)
