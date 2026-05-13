import hashlib
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from uuid import uuid4

from .models import (
    Plan, Coupon, UserCoupon, PriceRule, BillingRequest, BillingResult,
    CacheRecord, CacheKeyComponents, InvalidationEvent, InvalidationReason
)


class InMemoryStore:
    def __init__(self, cache_ttl_seconds: int = 3600):
        self.plans: Dict[str, Plan] = {}
        self.coupons: Dict[str, Coupon] = {}
        self.user_coupons: Dict[str, Dict[str, UserCoupon]] = {}
        self.price_rules: Dict[str, List[PriceRule]] = {}
        self.cache_records: Dict[str, CacheRecord] = {}
        self.cache_records_by_trial: Dict[str, str] = {}
        self.invalidation_events: List[InvalidationEvent] = []
        self.user_coupon_versions: Dict[str, int] = {}
        self.rule_versions: Dict[str, int] = {}
        self.refunded_trials: Dict[str, bool] = {}
        self.cache_ttl_seconds = cache_ttl_seconds

    def add_plan(self, plan: Plan) -> Plan:
        self.plans[plan.id] = plan
        return plan

    def get_plan(self, plan_id: str) -> Optional[Plan]:
        return self.plans.get(plan_id)

    def add_coupon(self, coupon: Coupon) -> Coupon:
        self.coupons[coupon.id] = coupon
        return coupon

    def get_coupon(self, coupon_id: str) -> Optional[Coupon]:
        return self.coupons.get(coupon_id)

    def assign_user_coupon(self, user_id: str, coupon_id: str) -> UserCoupon:
        if user_id not in self.user_coupons:
            self.user_coupons[user_id] = {}
        uc = UserCoupon(user_id=user_id, coupon_id=coupon_id)
        self.user_coupons[user_id][coupon_id] = uc
        self._bump_user_coupon_version(user_id)
        self._add_invalidation_event(
            "coupon_assigned",
            affected_user_id=user_id,
            affected_coupon_id=coupon_id,
            reason=f"User {user_id} assigned coupon {coupon_id}"
        )
        return uc

    def get_user_coupons(self, user_id: str) -> List[UserCoupon]:
        if user_id not in self.user_coupons:
            return []
        return list(self.user_coupons[user_id].values())

    def get_user_coupon_version(self, user_id: str) -> int:
        return self.user_coupon_versions.get(user_id, 0)

    def _bump_user_coupon_version(self, user_id: str):
        self.user_coupon_versions[user_id] = self.user_coupon_versions.get(user_id, 0) + 1

    def use_user_coupon(self, user_id: str, coupon_id: str):
        if user_id in self.user_coupons and coupon_id in self.user_coupons[user_id]:
            self.user_coupons[user_id][coupon_id].used_at = datetime.utcnow()
            self._bump_user_coupon_version(user_id)
            self._add_invalidation_event(
                "coupon_used",
                affected_user_id=user_id,
                affected_coupon_id=coupon_id,
                reason=f"User {user_id} used coupon {coupon_id}"
            )

    def add_price_rule(self, rule: PriceRule) -> PriceRule:
        if rule.id not in self.price_rules:
            self.price_rules[rule.id] = []
        self.price_rules[rule.id].append(rule)
        self.rule_versions[rule.id] = rule.version
        if rule.version > 1:
            self._add_invalidation_event(
                "rule_version_changed",
                affected_rule_id=rule.id,
                reason=f"Price rule {rule.id} updated to version {rule.version}"
            )
        return rule

    def get_price_rule(self, rule_id: str, version: Optional[int] = None) -> Optional[PriceRule]:
        if rule_id not in self.price_rules:
            return None
        versions = self.price_rules[rule_id]
        if version is None:
            return max(versions, key=lambda r: r.version)
        for r in versions:
            if r.version == version:
                return r
        return None

    def get_active_price_rule(self) -> Optional[PriceRule]:
        for rules in self.price_rules.values():
            active = [r for r in rules if r.is_active]
            if active:
                return max(active, key=lambda r: r.version)
        return None

    def get_price_rule_version(self, rule_id: str) -> int:
        return self.rule_versions.get(rule_id, 0)

    def _add_invalidation_event(
        self,
        event_type: str,
        affected_user_id: Optional[str] = None,
        affected_plan_id: Optional[str] = None,
        affected_coupon_id: Optional[str] = None,
        affected_rule_id: Optional[str] = None,
        reason: str = ""
    ) -> InvalidationEvent:
        event = InvalidationEvent(
            id=str(uuid4()),
            type=event_type,
            affected_user_id=affected_user_id,
            affected_plan_id=affected_plan_id,
            affected_coupon_id=affected_coupon_id,
            affected_rule_id=affected_rule_id,
            reason=reason
        )
        self.invalidation_events.append(event)
        self._invalidate_cache_by_event(event)
        return event

    def _invalidate_cache_by_event(self, event: InvalidationEvent):
        now = datetime.utcnow()
        for cache_key, record in self.cache_records.items():
            if record.invalidated:
                continue
            should_invalidate = False
            reason = None
            if event.affected_rule_id and event.affected_rule_id == record.price_rule_id:
                should_invalidate = True
                reason = InvalidationReason.RULE_VERSION_CHANGED
            elif event.affected_user_id and event.affected_user_id == record.key_components.user_id:
                should_invalidate = True
                reason = InvalidationReason.USER_COUPON_CHANGED
            elif event.type == "refund":
                should_invalidate = True
                reason = InvalidationReason.REFUND_EVENT
            if should_invalidate:
                record.invalidated = True
                record.invalidation_reason = reason
                record.invalidation_at = now

    def invalidate_cache(self, cache_key: Optional[str] = None, user_id: Optional[str] = None, reason: str = "explicit"):
        now = datetime.utcnow()
        if cache_key:
            if cache_key in self.cache_records:
                self.cache_records[cache_key].invalidated = True
                self.cache_records[cache_key].invalidation_reason = InvalidationReason.EXPLICIT_INVALIDATION
                self.cache_records[cache_key].invalidation_at = now
        elif user_id:
            for ck, record in self.cache_records.items():
                if record.key_components.user_id == user_id and not record.invalidated:
                    record.invalidated = True
                    record.invalidation_reason = InvalidationReason.EXPLICIT_INVALIDATION
                    record.invalidation_at = now
        else:
            for ck, record in self.cache_records.items():
                if not record.invalidated:
                    record.invalidated = True
                    record.invalidation_reason = InvalidationReason.EXPLICIT_INVALIDATION
                    record.invalidation_at = now
        self._add_invalidation_event(
            "explicit_invalidation",
            affected_user_id=user_id,
            reason=f"Explicit invalidation: {reason}"
        )

    def record_refund(self, trial_id: str, reason: str = ""):
        self.refunded_trials[trial_id] = True
        self._add_invalidation_event(
            "refund",
            reason=f"Refund recorded for trial {trial_id}: {reason}"
        )

    def is_refunded(self, trial_id: str) -> bool:
        return trial_id in self.refunded_trials

    def get_events_for_trial(self, trial_id: str) -> List[InvalidationEvent]:
        cache_key = self.cache_records_by_trial.get(trial_id)
        if not cache_key:
            return []
        record = self.cache_records.get(cache_key)
        if not record:
            return []
        events = []
        for event in self.invalidation_events:
            if event.timestamp < record.created_at:
                continue
            if (event.affected_rule_id and event.affected_rule_id == record.price_rule_id):
                events.append(event)
            elif (event.affected_user_id and event.affected_user_id == record.key_components.user_id):
                events.append(event)
            elif event.type == "refund":
                events.append(event)
        return events

    def generate_cache_key(self, request: BillingRequest) -> str:
        sorted_coupon_ids = sorted(request.coupon_ids)
        metadata_str = json.dumps(request.metadata, sort_keys=True)
        metadata_hash = hashlib.md5(metadata_str.encode()).hexdigest()
        key_parts = [
            request.user_id,
            request.plan_id,
            ",".join(sorted_coupon_ids),
            str(request.quantity),
            str(request.billing_period_months),
            metadata_hash
        ]
        key_str = "|".join(key_parts)
        return hashlib.md5(key_str.encode()).hexdigest()

    def get_cache_key_components(self, request: BillingRequest) -> CacheKeyComponents:
        sorted_coupon_ids = sorted(request.coupon_ids)
        metadata_str = json.dumps(request.metadata, sort_keys=True)
        metadata_hash = hashlib.md5(metadata_str.encode()).hexdigest()
        return CacheKeyComponents(
            user_id=request.user_id,
            plan_id=request.plan_id,
            coupon_ids=sorted_coupon_ids,
            quantity=request.quantity,
            billing_period_months=request.billing_period_months,
            metadata_hash=metadata_hash
        )

    def get_cache(self, cache_key: str) -> Optional[CacheRecord]:
        record = self.cache_records.get(cache_key)
        if not record:
            return None
        if record.invalidated:
            return None
        if record.expires_at and datetime.utcnow() > record.expires_at:
            return None
        return record

    def set_cache(
        self,
        cache_key: str,
        key_components: CacheKeyComponents,
        billing_result: BillingResult,
        price_rule_id: str,
        price_rule_version: int,
        user_coupon_version: int
    ) -> CacheRecord:
        record = CacheRecord(
            cache_key=cache_key,
            key_components=key_components,
            price_rule_id=price_rule_id,
            price_rule_version=price_rule_version,
            user_coupon_version=user_coupon_version,
            billing_result=billing_result,
            expires_at=datetime.utcnow() + timedelta(seconds=self.cache_ttl_seconds)
        )
        self.cache_records[cache_key] = record
        self.cache_records_by_trial[billing_result.trial_id] = cache_key
        return record

    def get_cache_by_trial(self, trial_id: str) -> Optional[CacheRecord]:
        cache_key = self.cache_records_by_trial.get(trial_id)
        if not cache_key:
            return None
        return self.cache_records.get(cache_key)


store = InMemoryStore()
