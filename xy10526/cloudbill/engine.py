from typing import Optional, Dict, List, Tuple
from datetime import datetime
from .models import (
    CloudBill, Resource, TagStrategy, OwnerMapping, Project, Tag,
    BillStatus, ProjectStatus, HistoryRecord, generate_id
)
from .storage import Storage
import re


class RuleEngine:
    def __init__(self, storage: Storage):
        self.storage = storage

    def _find_matching_strategy(self, bill: CloudBill) -> Optional[TagStrategy]:
        strategies = sorted(
            [s for s in self.storage.strategies.all() if s.is_active],
            key=lambda s: -s.priority
        )
        for strategy in strategies:
            if self._matches_pattern(strategy.resource_type_pattern, bill.resource_type):
                return strategy
        return None

    def _matches_pattern(self, pattern: str, value: str) -> bool:
        if pattern == "*" or pattern == value:
            return True
        if "*" in pattern:
            regex_pattern = pattern.replace("*", ".*")
            return re.match(regex_pattern, value) is not None
        return False

    def _lookup_resource(self, resource_id: str) -> Optional[Resource]:
        return self.storage.resources.get(resource_id)

    def _lookup_owner_for_project(self, project_code: str) -> Optional[OwnerMapping]:
        for owner in self.storage.owners.all():
            if owner.is_active and project_code in owner.projects:
                return owner
        return None

    def _lookup_project(self, project_code: str) -> Optional[Project]:
        return self.storage.get_project_by_code(project_code)

    def check_bill(self, bill: CloudBill) -> Dict[str, any]:
        issues = []
        status = bill.status
        effective_tags = bill.effective_tags()

        raw_project = bill.raw_tags.project
        if raw_project:
            project = self._lookup_project(raw_project)
            if project and project.status == ProjectStatus.INACTIVE:
                issues.append(f"停用项目仍计费: {raw_project}")
                if not bill.is_manual_fix:
                    status = BillStatus.INACTIVE_PROJECT

        if not effective_tags.project:
            issues.append("缺少项目标签")
        if not effective_tags.env:
            issues.append("缺少环境标签")
        if not effective_tags.owner:
            issues.append("缺少负责人标签")

        if status != BillStatus.INACTIVE_PROJECT:
            if effective_tags.is_complete():
                status = BillStatus.FIXED
            else:
                status = BillStatus.UNASSIGNED

        return {
            "bill_id": bill.bill_id,
            "status": status,
            "issues": issues,
            "raw_tags": bill.raw_tags.to_dict(),
            "fixed_tags": bill.fixed_tags.to_dict() if bill.fixed_tags else None,
            "is_manual_fix": bill.is_manual_fix
        }

    def auto_fix_bill(self, bill: CloudBill, operator: Optional[str] = None) -> Dict[str, any]:
        before_tags = bill.effective_tags()

        if bill.is_manual_fix:
            return {
                "bill_id": bill.bill_id,
                "changed": False,
                "reason": "已有人工修正，保留原标签",
                "status": bill.status
            }

        new_tags = Tag(
            project=before_tags.project,
            env=before_tags.env,
            owner=before_tags.owner
        )
        applied_source = None

        strategy = self._find_matching_strategy(bill)
        if strategy:
            rules = strategy.tag_rules
            if not new_tags.project and rules.get("project"):
                new_tags.project = rules.get("project")
            if not new_tags.env and rules.get("env"):
                new_tags.env = rules.get("env")
            if not new_tags.owner and rules.get("owner"):
                new_tags.owner = rules.get("owner")
            applied_source = f"strategy:{strategy.strategy_id}"

        resource = self._lookup_resource(bill.resource_id)
        if resource:
            if not new_tags.project and resource.tags.project:
                new_tags.project = resource.tags.project
            if not new_tags.env and resource.tags.env:
                new_tags.env = resource.tags.env
            if not new_tags.owner and resource.tags.owner:
                new_tags.owner = resource.tags.owner
            applied_source = f"resource:{resource.resource_id}"

        if new_tags.project and not new_tags.owner:
            owner = self._lookup_owner_for_project(new_tags.project)
            if owner:
                new_tags.owner = owner.name
                if not applied_source:
                    applied_source = f"owner:{owner.owner_id}"

        diff = before_tags.diff(new_tags)

        if diff:
            bill.fixed_tags = new_tags
            bill.updated_at = datetime.now()
            bill.last_operator = operator
            if applied_source:
                history = HistoryRecord(
                    record_id=generate_id("hist_"),
                    bill_id=bill.bill_id,
                    action="auto_fix",
                    before=before_tags.to_dict(),
                    after=new_tags.to_dict(),
                    changes=diff,
                    reason=f"自动修复来源: {applied_source}",
                    operator=operator,
                    created_at=datetime.now()
                )
                self.storage.add_history(history)

        if not bill.is_manual_fix and new_tags.project:
            project = self._lookup_project(new_tags.project)
            if project and project.status == ProjectStatus.INACTIVE:
                bill.status = BillStatus.INACTIVE_PROJECT
            elif new_tags.is_complete():
                bill.status = BillStatus.FIXED
            else:
                bill.status = BillStatus.UNASSIGNED
        elif new_tags.is_complete():
            bill.status = BillStatus.FIXED
        else:
            bill.status = BillStatus.UNASSIGNED

        self.storage.bills.save(bill.bill_id, bill)

        return {
            "bill_id": bill.bill_id,
            "changed": bool(diff),
            "changes": diff,
            "source": applied_source,
            "status": bill.status
        }

    def manual_fix_bill(self, bill_id: str, new_project: Optional[str] = None,
                      new_env: Optional[str] = None,
                      new_owner: Optional[str] = None,
                      reason: str = "",
                      operator: str = "anonymous") -> Dict[str, any]:
        bill = self.storage.bills.get(bill_id)
        if not bill:
            return {"success": False, "error": f"账单不存在: {bill_id}"}

        before_tags = bill.effective_tags()
        before_status = bill.status

        new_tags = Tag(
            project=new_project if new_project else before_tags.project,
            env=new_env if new_env else before_tags.env,
            owner=new_owner if new_owner else before_tags.owner
        )

        diff = before_tags.diff(new_tags)
        if not diff:
            return {
                "success": True,
                "changed": False,
                "bill_id": bill_id,
                "reason": "标签无变化"
            }

        if new_tags.project:
            project = self._lookup_project(new_tags.project)
            if project and project.status == ProjectStatus.INACTIVE:
                return {
                    "success": False,
                    "error": f"项目已停用: {new_tags.project}",
                    "bill_id": bill_id
                }

        bill.fixed_tags = new_tags
        bill.is_manual_fix = True
        bill.status = BillStatus.FIXED if new_tags.is_complete() else BillStatus.UNASSIGNED
        bill.updated_at = datetime.now()
        bill.last_operator = operator

        history = HistoryRecord(
            record_id=generate_id("hist_"),
            bill_id=bill.bill_id,
            action="manual_fix",
            before=before_tags.to_dict(),
            after=new_tags.to_dict(),
            changes=diff,
            reason=reason or "人工修正",
            operator=operator,
            created_at=datetime.now()
        )
        self.storage.add_history(history)
        self.storage.bills.save(bill.bill_id, bill)

        return {
            "success": True,
            "changed": True,
            "bill_id": bill_id,
            "changes": diff,
            "status": bill.status
        }

    def check_all(self, update_status: bool = True) -> Dict[str, any]:
        all_bills = self.storage.bills.all()
        results = []
        stats = {
            "total": len(all_bills),
            "fixed": 0,
            "unassigned": 0,
            "inactive_project": 0,
            "raw": 0,
            "issues_count": 0
        }

        for bill in all_bills:
            check_result = self.check_bill(bill)
            results.append(check_result)
            if update_status and bill.status != check_result["status"]:
                bill.status = check_result["status"]
                bill.updated_at = datetime.now()
                self.storage.bills.save(bill.bill_id, bill)
            status_val = check_result["status"].value
            if status_val in stats:
                stats[status_val] = stats.get(status_val, 0) + 1
            stats["issues_count"] += len(check_result["issues"])

        return {"stats": stats, "details": results}
