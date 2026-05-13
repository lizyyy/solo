from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from .models import (
    BillingRequest, BillingResult, CacheQueryResult, CacheHitReport,
    Plan, Coupon, PriceRule, DiscountType, CouponStatus
)
from .services import cache_service
from .store import store

router = APIRouter()


@router.post("/billing/trial", response_model=BillingResult)
def trial_bill(request: BillingRequest):
    try:
        return cache_service.trial_bill(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/cache/query/{trial_id}", response_model=CacheQueryResult)
def query_cache(trial_id: str):
    result = cache_service.query_cache(trial_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Trial {trial_id} not found")
    return result


@router.get("/cache/report", response_model=CacheHitReport)
def get_cache_report():
    return cache_service.get_hit_report()


@router.post("/cache/invalidate")
def invalidate_cache(
    cache_key: Optional[str] = Query(None, description="Specific cache key to invalidate"),
    user_id: Optional[str] = Query(None, description="Invalidate all cache for this user"),
    reason: str = Query("manual", description="Invalidation reason")
):
    store.invalidate_cache(cache_key=cache_key, user_id=user_id, reason=reason)
    return {"status": "ok", "message": f"Cache invalidated: {reason}"}


@router.post("/events/refund/{trial_id}")
def record_refund(trial_id: str, reason: str = Query("", description="Refund reason")):
    store.record_refund(trial_id, reason)
    return {"status": "ok", "trial_id": trial_id, "message": "Refund recorded"}


@router.post("/price-rules", response_model=PriceRule)
def create_price_rule(
    id: str,
    name: str,
    version: int = 1,
    description: Optional[str] = None,
    discount_percent: Optional[float] = None,
    tax_rate: float = 0.13,
    is_active: bool = True
):
    existing = store.get_price_rule(id)
    if existing and version == existing.version:
        raise HTTPException(status_code=400, detail=f"Version {version} already exists for rule {id}")
    if existing and version != existing.version + 1:
        raise HTTPException(
            status_code=400,
            detail=f"Next version must be {existing.version + 1}"
        )
    rule = PriceRule(
        id=id,
        name=name,
        version=version,
        description=description,
        discount_percent=discount_percent,
        tax_rate=tax_rate,
        is_active=is_active
    )
    store.add_price_rule(rule)
    return rule


@router.get("/price-rules/{rule_id}", response_model=PriceRule)
def get_price_rule(rule_id: str, version: Optional[int] = None):
    rule = store.get_price_rule(rule_id, version)
    if not rule:
        raise HTTPException(status_code=404, detail=f"Price rule {rule_id} not found")
    return rule


@router.post("/plans", response_model=Plan)
def create_plan(id: str, name: str, base_price: float, description: Optional[str] = None):
    existing = store.get_plan(id)
    if existing:
        raise HTTPException(status_code=400, detail=f"Plan {id} already exists")
    plan = Plan(id=id, name=name, base_price=base_price, description=description)
    store.add_plan(plan)
    return plan


@router.get("/plans/{plan_id}", response_model=Plan)
def get_plan(plan_id: str):
    plan = store.get_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan {plan_id} not found")
    return plan


@router.post("/coupons", response_model=Coupon)
def create_coupon(
    id: str,
    code: str,
    type: DiscountType,
    value: float,
    description: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_discount: Optional[float] = None
):
    existing = store.get_coupon(id)
    if existing:
        raise HTTPException(status_code=400, detail=f"Coupon {id} already exists")
    coupon = Coupon(
        id=id,
        code=code,
        type=type,
        value=value,
        description=description,
        min_amount=min_amount,
        max_discount=max_discount
    )
    store.add_coupon(coupon)
    return coupon


@router.post("/users/{user_id}/coupons/{coupon_id}")
def assign_coupon_to_user(user_id: str, coupon_id: str):
    coupon = store.get_coupon(coupon_id)
    if not coupon:
        raise HTTPException(status_code=404, detail=f"Coupon {coupon_id} not found")
    uc = store.assign_user_coupon(user_id, coupon_id)
    return {"status": "ok", "user_id": user_id, "coupon_id": coupon_id, "assigned_at": uc.assigned_at}


@router.get("/coupons/{coupon_id}", response_model=Coupon)
def get_coupon(coupon_id: str):
    coupon = store.get_coupon(coupon_id)
    if not coupon:
        raise HTTPException(status_code=404, detail=f"Coupon {coupon_id} not found")
    return coupon
