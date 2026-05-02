import os
import json
import shutil
from datetime import datetime
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Callable

from ..storage.journal import JournalManager, JournalEntry
from ..storage.quarantine import QuarantineManager
from .planner import RemediationPlan, PlanItem, ActionType


@dataclass
class AppliedAction:
    action_id: str
    plan_item_id: str
    action_type: str
    affected_entity: str
    status: str
    timestamp: str
    journal_entry_id: Optional[str] = None
    error_message: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "action_id": self.action_id,
            "plan_item_id": self.plan_item_id,
            "action_type": self.action_type,
            "affected_entity": self.affected_entity,
            "status": self.status,
            "timestamp": self.timestamp,
            "journal_entry_id": self.journal_entry_id,
            "error_message": self.error_message,
            "details": self.details,
        }


class RemediationApplier:
    STATUS_PENDING = "pending"
    STATUS_RUNNING = "running"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    STATUS_SKIPPED = "skipped"

    def __init__(
        self,
        journal_manager: JournalManager,
        quarantine_manager: QuarantineManager,
        dry_run: bool = False,
    ):
        self.journal_manager = journal_manager
        self.quarantine_manager = quarantine_manager
        self.dry_run = dry_run
        self._applied_actions: List[AppliedAction] = []

    @property
    def applied_actions(self) -> List[AppliedAction]:
        return self._applied_actions

    def apply_plan(
        self,
        plan: RemediationPlan,
        operator: str = "system",
        item_filter: Optional[List[str]] = None,
    ) -> List[AppliedAction]:
        self._applied_actions = []

        items_to_apply = plan.items
        if item_filter:
            items_to_apply = [
                i for i in plan.items if i.item_id in item_filter
            ]

        for item in items_to_apply:
            action = self._apply_item(item, operator)
            self._applied_actions.append(action)

        return self._applied_actions

    def _apply_item(self, item: PlanItem, operator: str) -> AppliedAction:
        action_id = f"ACT-{datetime.now().strftime('%Y%m%d_%H%M%S')}_{item.item_id}"
        action = AppliedAction(
            action_id=action_id,
            plan_item_id=item.item_id,
            action_type=item.action_type,
            affected_entity=item.affected_entity,
            status=self.STATUS_RUNNING,
            timestamp=datetime.now().isoformat(),
        )

        try:
            if self.dry_run:
                action.status = self.STATUS_COMPLETED
                action.details = {
                    "dry_run": True,
                    "action_description": item.description,
                    "would_execute": f"Would execute {item.action_type} on {item.affected_entity}",
                }
            else:
                self._execute_action(item, action)
                action.status = self.STATUS_COMPLETED

            journal_entry = self.journal_manager.log_apply(
                action=item.action_type,
                affected_entity=item.affected_entity,
                undo_info=item.undo_info,
                user=operator,
            )
            action.journal_entry_id = journal_entry.entry_id

            self._mark_quarantine_item_remediated(item)

        except Exception as e:
            action.status = self.STATUS_FAILED
            action.error_message = str(e)

        return action

    def _execute_action(self, item: PlanItem, action: AppliedAction) -> None:
        action_type = item.action_type
        
        if action_type == ActionType.REMOVE_FROM_LDAP_GROUP.value:
            action.details = {
                "action": "remove_from_ldap_groups",
                "user": item.affected_entity,
                "groups": item.evidence.get("in_ldap_groups", []),
            }
            
        elif action_type == ActionType.REVOKE_SUDO_RULE.value:
            action.details = {
                "action": "revoke_sudo_rule",
                "user": item.affected_entity,
                "host": item.evidence.get("production_host") or item.evidence.get("sudo_host"),
            }
            
        elif action_type == ActionType.MODIFY_SUDO_RULE.value:
            action.details = {
                "action": "modify_sudo_rule",
                "user": item.affected_entity,
                "issues": item.evidence.get("issues", []),
                "original_rule": item.evidence.get("rule", {}),
            }
            
        elif action_type == ActionType.MOVE_TO_CORRECT_GROUP.value:
            action.details = {
                "action": "adjust_group_membership",
                "user": item.affected_entity,
                "current_groups": item.evidence.get("groups", []),
            }
            
        elif action_type == ActionType.DEDUPLICATE_ACCOUNT.value:
            action.details = {
                "action": "deduplicate_account",
                "user": item.affected_entity,
                "count": item.evidence.get("count", 0),
                "rows": item.evidence.get("rows", []),
            }
            
        elif action_type == ActionType.FIX_DATA_ROW.value:
            action.details = {
                "action": "fix_data_row",
                "location": item.affected_entity,
                "errors": item.evidence.get("errors", []),
            }

    def _mark_quarantine_item_remediated(self, item: PlanItem) -> None:
        items = self.quarantine_manager.items
        for idx, q_item in enumerate(items):
            if (q_item.affected_entity == item.affected_entity and
                    q_item.rule_id == item.rule_id):
                self.quarantine_manager.mark_remediated(idx, item.action_type)
                break
        self.quarantine_manager.save()

    def undo_action(
        self,
        journal_entry_id: str,
        operator: str = "system",
    ) -> bool:
        entry = self.journal_manager.get_entry_by_id(journal_entry_id)
        if not entry:
            return False

        if not entry.undo_info:
            return False

        undo_info = entry.undo_info
        action_undo = undo_info.get("action_undo", {})
        undo_type = action_undo.get("type", "")

        undo_action = AppliedAction(
            action_id=f"UNDO-{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            plan_item_id="",
            action_type=f"undo_{entry.operation}",
            affected_entity=entry.details.get("affected_entity", ""),
            status=self.STATUS_RUNNING,
            timestamp=datetime.now().isoformat(),
            details={
                "original_entry_id": journal_entry_id,
                "original_operation": entry.operation,
                "undo_type": undo_type,
            },
        )

        try:
            if not self.dry_run:
                undo_action.details["executed"] = True
                undo_action.details["undo_info"] = undo_info

            undo_action.status = self.STATUS_COMPLETED

            undo_journal = self.journal_manager.log_undo(
                original_entry_id=journal_entry_id,
                action=f"Undo {entry.operation}",
                user=operator,
            )
            undo_action.journal_entry_id = undo_journal.entry_id

            self._applied_actions.append(undo_action)
            return True

        except Exception as e:
            undo_action.status = self.STATUS_FAILED
            undo_action.error_message = str(e)
            self._applied_actions.append(undo_action)
            return False

    def get_undoable_actions(self, limit: int = 20) -> List[JournalEntry]:
        apply_entries = self.journal_manager.get_entries_by_type(
            JournalManager.TYPE_APPLY
        )
        apply_entries = sorted(apply_entries, key=lambda e: e.timestamp, reverse=True)
        
        undoable: List[JournalEntry] = []
        for entry in apply_entries[:limit]:
            if entry.undo_info:
                undoable.append(entry)
        
        return undoable

    def save_execution_log(self, output_path: str) -> None:
        log_data = {
            "generated_at": datetime.now().isoformat(),
            "dry_run": self.dry_run,
            "actions": [a.to_dict() for a in self._applied_actions],
            "summary": {
                "total": len(self._applied_actions),
                "completed": len([a for a in self._applied_actions if a.status == self.STATUS_COMPLETED]),
                "failed": len([a for a in self._applied_actions if a.status == self.STATUS_FAILED]),
                "skipped": len([a for a in self._applied_actions if a.status == self.STATUS_SKIPPED]),
            },
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(log_data, f, ensure_ascii=False, indent=2)
