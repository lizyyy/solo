from datetime import datetime
from typing import List, Optional, Tuple
from uuid import uuid4

from .models import (
    BillingRequest, BillingResult, BillLineItem, Coupon, PriceRule, Plan,
    CacheQueryResult, CacheHitReport, CacheHitReportItem, InvalidationReason
)
from .store import store


class BillingService:
    def calculate_bill(self, request: BillingRequest) -> BillingResult:
        trial_id = str(uuid4())
        plan = store.get_plan(request.plan_id)
        if not plan:
            raise ValueError(f"Plan {request.plan_id} not found")
        rule = store.get_active_price_rule()
        if not rule:
            raise ValueError("No active price rule found")
        applied_coupons = self._get_and_validate_coupons(request.coupon_ids, request.user_id)
        line_items = self._build_line_items(plan, request, rule)
        subtotal = sum(item.amount for item in line_items)
        discount_amount = self._calculate_discount(applied_coupons, subtotal)
        discounted_subtotal = max(0, subtotal - discount_amount)
        tax_amount = round(discounted_subtotal * rule.tax_rate, 2)
        total_amount = round(discounted_subtotal + tax_amount, 2)
        return BillingResult(
            trial_id=trial_id,
            request=request,
            plan=plan,
            applied_coupons=applied_coupons,
            line_items=line_items,
            subtotal=round(subtotal, 2),
            discount_amount=round(discount_amount, 2),
            tax_amount=tax_amount,
            total_amount=total_amount,
            price_rule_id=rule.id,
            price_rule_version=rule.version,
            is_cached=False
        )

    def _get_and_validate_coupons(self, coupon_ids: List[str], user_id: str) -> List[Coupon]:
        valid_coupons = []
        user_coupons = {uc.coupon_id for uc in store.get_user_coupons(user_id)}
        for cid in coupon_ids:
            if cid not in user_coupons:
                continue
            coupon = store.get_coupon(cid)
            if not coupon:
                continue
            if coupon.status != "active":
                continue
            if coupon.valid_until and datetime.utcnow() > coupon.valid_until:
                continue
            valid_coupons.append(coupon)
        return valid_coupons

    def _build_line_items(self, plan: Plan, request: BillingRequest, rule: PriceRule) -> List[BillLineItem]:
        items = []
        base_amount = plan.base_price * request.quantity * request.billing_period_months
        items.append(BillLineItem(
            name=f"{plan.name} x{request.quantity}",
            description=f"{request.billing_period_months} month(s) subscription",
            quantity=request.quantity,
            unit_price=plan.base_price * request.billing_period_months,
            amount=base_amount
        ))
        if rule.discount_percent and rule.discount_percent > 0:
            rule_discount = base_amount * (rule.discount_percent / 100)
            items.append(BillLineItem(
                name=f"Price Rule Discount ({rule.discount_percent}%)",
                description=rule.name,
                quantity=1,
                unit_price=-rule_discount,
                amount=-rule_discount
            ))
        return items

    def _calculate_discount(self, coupons: List[Coupon], subtotal: float) -> float:
        total_discount = 0.0
        for coupon in coupons:
            if coupon.min_amount and subtotal < coupon.min_amount:
                continue
            discount = 0.0
            if coupon.type == "percentage":
                discount = subtotal * (coupon.value / 100)
                if coupon.max_discount:
                    discount = min(discount, coupon.max_discount)
            elif coupon.type == "fixed_amount":
                discount = coupon.value
            total_discount += discount
        return total_discount


class CacheService:
    def __init__(self):
        self.billing_service = BillingService()

    def trial_bill(self, request: BillingRequest) -> BillingResult:
        cache_key = store.generate_cache_key(request)
        cached_record = store.get_cache(cache_key)
        if cached_record:
            result = cached_record.billing_result.model_copy()
            result.is_cached = True
            return result
        result = self.billing_service.calculate_bill(request)
        user_coupon_version = store.get_user_coupon_version(request.user_id)
        key_components = store.get_cache_key_components(request)
        store.set_cache(
            cache_key=cache_key,
            key_components=key_components,
            billing_result=result,
            price_rule_id=result.price_rule_id,
            price_rule_version=result.price_rule_version,
            user_coupon_version=user_coupon_version
        )
        return result

    def query_cache(self, trial_id: str) -> Optional[CacheQueryResult]:
        record = store.get_cache_by_trial(trial_id)
        if not record:
            return None
        is_hit = not record.invalidated
        if record.expires_at and datetime.utcnow() > record.expires_at:
            is_hit = False
        current_rule_version = store.get_price_rule_version(record.price_rule_id)
        current_user_version = store.get_user_coupon_version(record.key_components.user_id)
        invalidation_reason = None
        if record.invalidated and record.invalidation_reason:
            invalidation_reason = record.invalidation_reason.value
        elif not is_hit and current_rule_version > record.price_rule_version:
            invalidation_reason = InvalidationReason.RULE_VERSION_CHANGED.value
        elif not is_hit and current_user_version > record.user_coupon_version:
            invalidation_reason = InvalidationReason.USER_COUPON_CHANGED.value
        events = store.get_events_for_trial(trial_id)
        return CacheQueryResult(
            trial_id=trial_id,
            cache_key=record.cache_key,
            price_rule_id=record.price_rule_id,
            price_rule_version=record.price_rule_version,
            user_coupon_version=record.user_coupon_version,
            is_hit=is_hit,
            invalidation_reason=invalidation_reason,
            invalidation_events=events,
            created_at=record.created_at,
            expires_at=record.expires_at,
            result=record.billing_result if is_hit else None
        )

    def get_hit_report(self) -> CacheHitReport:
        total = 0
        hits = 0
        items = []
        for cache_key, record in store.cache_records.items():
            total += 1
            is_hit = not record.invalidated
            if record.expires_at and datetime.utcnow() > record.expires_at:
                is_hit = False
            if is_hit:
                hits += 1
            trial_id = record.billing_result.trial_id
            events = store.get_events_for_trial(trial_id)
            items.append(CacheHitReportItem(
                trial_id=trial_id,
                cache_key=cache_key,
                cache_key_components=record.key_components,
                price_rule_id=record.price_rule_id,
                price_rule_version=record.price_rule_version,
                user_coupon_version=record.user_coupon_version,
                is_hit=is_hit,
                invalidation_reason=record.invalidation_reason,
                invalidation_events=events,
                created_at=record.created_at,
                expires_at=record.expires_at
            ))
        hit_rate = (hits / total * 100) if total > 0 else 0.0
        return CacheHitReport(
            total_requests=total,
            hit_count=hits,
            miss_count=total - hits,
            hit_rate=round(hit_rate, 2),
            items=items
        )


billing_service = BillingService()
cache_service = CacheService()
