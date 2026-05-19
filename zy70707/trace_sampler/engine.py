import json
import os
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from collections import defaultdict

from .models import (
    SamplingBudget,
    TagRule,
    AdjustmentRequest,
    AdjustmentStatus,
    TraceSampleDecision,
    BudgetReport,
    TagMatchType,
)


class SamplingEngine:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

        self._budgets: Dict[str, SamplingBudget] = {}
        self._rules: Dict[str, TagRule] = {}
        self._adjustments: Dict[str, AdjustmentRequest] = {}
        self._decisions: List[TraceSampleDecision] = []
        self._idempotency_keys: Dict[str, str] = {}

        self._load_data()

    def _load_data(self):
        budget_file = self.data_dir / "budgets.json"
        if budget_file.exists():
            with open(budget_file, "r") as f:
                data = json.load(f)
                for k, v in data.items():
                    self._budgets[k] = SamplingBudget(**v)

        rules_file = self.data_dir / "rules.json"
        if rules_file.exists():
            with open(rules_file, "r") as f:
                data = json.load(f)
                for k, v in data.items():
                    self._rules[k] = TagRule(**v)

        adjustments_file = self.data_dir / "adjustments.json"
        if adjustments_file.exists():
            with open(adjustments_file, "r") as f:
                data = json.load(f)
                for k, v in data.items():
                    adj = AdjustmentRequest(**v)
                    self._adjustments[k] = adj
                    self._idempotency_keys[adj.idempotency_key] = adj.request_id

        decisions_file = self.data_dir / "decisions.json"
        if decisions_file.exists():
            with open(decisions_file, "r") as f:
                data = json.load(f)
                self._decisions = [TraceSampleDecision(**d) for d in data]

    def _save_data(self):
        with open(self.data_dir / "budgets.json", "w") as f:
            json.dump({k: v.dict() for k, v in self._budgets.items()}, f, default=str, indent=2)

        with open(self.data_dir / "rules.json", "w") as f:
            json.dump({k: v.dict() for k, v in self._rules.items()}, f, default=str, indent=2)

        with open(self.data_dir / "adjustments.json", "w") as f:
            json.dump({k: v.dict() for k, v in self._adjustments.items()}, f, default=str, indent=2)

        with open(self.data_dir / "decisions.json", "w") as f:
            json.dump([d.dict() for d in self._decisions], f, default=str, indent=2)

    def create_budget(self, service_name: str, daily_budget: int, date: Optional[str] = None) -> SamplingBudget:
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")

        budget_key = f"{service_name}:{date}"
        if budget_key in self._budgets:
            raise ValueError(f"Budget for {service_name} on {date} already exists")

        budget = SamplingBudget(
            service_name=service_name,
            daily_budget=daily_budget,
            date=date,
        )
        self._budgets[budget_key] = budget
        self._save_data()
        return budget

    def get_budget(self, service_name: str, date: Optional[str] = None) -> Optional[SamplingBudget]:
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        budget_key = f"{service_name}:{date}"
        return self._budgets.get(budget_key)

    def create_rule(
        self,
        rule_id: str,
        service_name: str,
        tag_key: str,
        tag_value: Optional[str] = None,
        match_type: TagMatchType = TagMatchType.EXACT,
        priority: int = 50,
        sampling_rate: float = 1.0,
        budget_reservation: int = 0,
        created_by: str = "system",
    ) -> TagRule:
        if rule_id in self._rules:
            raise ValueError(f"Rule {rule_id} already exists")

        rule = TagRule(
            rule_id=rule_id,
            service_name=service_name,
            tag_key=tag_key,
            tag_value=tag_value,
            match_type=match_type,
            priority=priority,
            sampling_rate=sampling_rate,
            budget_reservation=budget_reservation,
            created_by=created_by,
        )
        self._rules[rule_id] = rule

        if budget_reservation > 0:
            budget = self.get_budget(service_name)
            if budget:
                budget.reserved_budget += budget_reservation

        self._save_data()
        return rule

    def get_matching_rules(self, service_name: str, tags: Dict[str, str]) -> List[TagRule]:
        service_rules = [r for r in self._rules.values() if r.service_name == service_name and r.is_active]
        matching_rules = [r for r in service_rules if r.matches(tags)]
        matching_rules.sort(key=lambda r: r.priority, reverse=True)
        return matching_rules

    def decide_sampling(
        self,
        trace_id: str,
        service_name: str,
        tags: Dict[str, str],
    ) -> TraceSampleDecision:
        budget = self.get_budget(service_name)
        matching_rules = self.get_matching_rules(service_name, tags)

        if not budget:
            return TraceSampleDecision(
                trace_id=trace_id,
                service_name=service_name,
                tags=tags,
                sampled=False,
                reason="NO_BUDGET_CONFIGURED",
            )

        if budget.remaining_budget <= 0:
            return TraceSampleDecision(
                trace_id=trace_id,
                service_name=service_name,
                tags=tags,
                sampled=False,
                reason="BUDGET_EXHAUSTED",
            )

        if not matching_rules:
            if budget.has_sufficient_budget():
                budget.used_budget += 1
                decision = TraceSampleDecision(
                    trace_id=trace_id,
                    service_name=service_name,
                    tags=tags,
                    sampled=True,
                    reason="DEFAULT_SAMPLING",
                    budget_impact=1,
                )
                self._decisions.append(decision)
                self._save_data()
                return decision
            else:
                return TraceSampleDecision(
                    trace_id=trace_id,
                    service_name=service_name,
                    tags=tags,
                    sampled=False,
                    reason="INSUFFICIENT_BUDGET",
                )

        top_rule = matching_rules[0]
        matched_rule_id = top_rule.rule_id

        if random.random() > top_rule.sampling_rate:
            return TraceSampleDecision(
                trace_id=trace_id,
                service_name=service_name,
                tags=tags,
                sampled=False,
                reason="RATE_BASED_DROP",
                matched_rule_id=matched_rule_id,
            )

        if budget.has_sufficient_budget():
            budget.used_budget += 1
            decision = TraceSampleDecision(
                trace_id=trace_id,
                service_name=service_name,
                tags=tags,
                sampled=True,
                reason=f"RULE_MATCH:{matched_rule_id}",
                matched_rule_id=matched_rule_id,
                budget_impact=1,
            )
            self._decisions.append(decision)
            self._save_data()
            return decision
        else:
            return TraceSampleDecision(
                trace_id=trace_id,
                service_name=service_name,
                tags=tags,
                sampled=False,
                reason="INSUFFICIENT_BUDGET_FOR_RULE",
                matched_rule_id=matched_rule_id,
            )

    def create_adjustment_request(
        self,
        request_id: str,
        service_name: str,
        requester: str,
        reason: str,
        adjustment_type: str,
        old_value: Any,
        new_value: Any,
        idempotency_key: str,
        effective_from: Optional[datetime] = None,
        effective_to: Optional[datetime] = None,
    ) -> Tuple[AdjustmentRequest, bool]:
        if idempotency_key in self._idempotency_keys:
            existing_id = self._idempotency_keys[idempotency_key]
            return self._adjustments[existing_id], True

        if request_id in self._adjustments:
            raise ValueError(f"Adjustment request {request_id} already exists")

        request = AdjustmentRequest(
            request_id=request_id,
            service_name=service_name,
            requester=requester,
            reason=reason,
            adjustment_type=adjustment_type,
            old_value=old_value,
            new_value=new_value,
            idempotency_key=idempotency_key,
            effective_from=effective_from,
            effective_to=effective_to,
        )

        self._adjustments[request_id] = request
        self._idempotency_keys[idempotency_key] = request_id
        self._save_data()
        return request, False

    def approve_adjustment(self, request_id: str, approver: str) -> Optional[AdjustmentRequest]:
        request = self._adjustments.get(request_id)
        if not request:
            return None

        if request.status != AdjustmentStatus.PENDING:
            raise ValueError(f"Request {request_id} is not pending")

        request.status = AdjustmentStatus.APPROVED
        request.approver = approver
        request.approved_at = datetime.now()

        self._apply_adjustment(request)
        self._save_data()
        return request

    def reject_adjustment(self, request_id: str, approver: str) -> Optional[AdjustmentRequest]:
        request = self._adjustments.get(request_id)
        if not request:
            return None

        request.status = AdjustmentStatus.REJECTED
        request.approver = approver
        request.approved_at = datetime.now()
        self._save_data()
        return request

    def _apply_adjustment(self, request: AdjustmentRequest):
        if not request.is_effective():
            return

        if request.adjustment_type == "BUDGET_INCREASE":
            budget = self.get_budget(request.service_name)
            if budget:
                budget.daily_budget = int(request.new_value)
        elif request.adjustment_type == "BUDGET_DECREASE":
            budget = self.get_budget(request.service_name)
            if budget:
                budget.daily_budget = int(request.new_value)
        elif request.adjustment_type == "RULE_PRIORITY":
            rule = self._rules.get(request.old_value.get("rule_id", ""))
            if rule:
                rule.priority = int(request.new_value)
        elif request.adjustment_type == "RULE_SAMPLING_RATE":
            rule = self._rules.get(request.old_value.get("rule_id", ""))
            if rule:
                rule.sampling_rate = float(request.new_value)

    def generate_report(self, service_name: str, date: Optional[str] = None) -> BudgetReport:
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")

        budget = self.get_budget(service_name, date)
        if not budget:
            raise ValueError(f"No budget found for {service_name} on {date}")

        service_rules = [r for r in self._rules.values() if r.service_name == service_name]
        rule_usage = defaultdict(int)
        for decision in self._decisions:
            if decision.matched_rule_id:
                rule_usage[decision.matched_rule_id] += 1

        top_rules = []
        for rule in service_rules:
            top_rules.append({
                "rule_id": rule.rule_id,
                "tag_key": rule.tag_key,
                "tag_value": rule.tag_value,
                "priority": rule.priority,
                "sampling_rate": rule.sampling_rate,
                "usage_count": rule_usage.get(rule.rule_id, 0),
            })
        top_rules.sort(key=lambda r: r["usage_count"], reverse=True)

        service_adjustments = [
            a for a in self._adjustments.values()
            if a.service_name == service_name
        ]
        service_adjustments.sort(key=lambda a: a.created_at, reverse=True)

        recent_adjustments = []
        for adj in service_adjustments[:10]:
            recent_adjustments.append({
                "request_id": adj.request_id,
                "adjustment_type": adj.adjustment_type,
                "status": adj.status.value,
                "requester": adj.requester,
                "reason": adj.reason,
                "created_at": adj.created_at,
            })

        service_decisions = [
            d for d in self._decisions
            if d.service_name == service_name
        ]
        service_decisions.sort(key=lambda d: d.timestamp, reverse=True)

        sampling_decisions = []
        for dec in service_decisions[:20]:
            sampling_decisions.append({
                "trace_id": dec.trace_id,
                "sampled": dec.sampled,
                "reason": dec.reason,
                "matched_rule_id": dec.matched_rule_id,
                "timestamp": dec.timestamp,
            })

        return BudgetReport(
            service_name=service_name,
            date=date,
            daily_budget=budget.daily_budget,
            used_budget=budget.used_budget,
            reserved_budget=budget.reserved_budget,
            remaining_budget=budget.remaining_budget,
            utilization_rate=budget.utilization_rate,
            top_rules=top_rules,
            recent_adjustments=recent_adjustments,
            sampling_decisions=sampling_decisions,
        )

    def list_services(self) -> List[str]:
        services = set()
        for budget in self._budgets.values():
            services.add(budget.service_name)
        for rule in self._rules.values():
            services.add(rule.service_name)
        return sorted(list(services))

    def list_rules(self, service_name: Optional[str] = None) -> List[TagRule]:
        rules = list(self._rules.values())
        if service_name:
            rules = [r for r in rules if r.service_name == service_name]
        rules.sort(key=lambda r: r.priority, reverse=True)
        return rules

    def list_adjustments(
        self,
        service_name: Optional[str] = None,
        status: Optional[AdjustmentStatus] = None,
    ) -> List[AdjustmentRequest]:
        adjustments = list(self._adjustments.values())
        if service_name:
            adjustments = [a for a in adjustments if a.service_name == service_name]
        if status:
            adjustments = [a for a in adjustments if a.status == status]
        adjustments.sort(key=lambda a: a.created_at, reverse=True)
        return adjustments
