from fastapi import FastAPI
from datetime import datetime, timedelta

from billing_cache.routers import router
from billing_cache.models import Plan, Coupon, PriceRule, DiscountType
from billing_cache.store import store


def init_sample_data():
    plans = [
        Plan(id="plan_basic", name="基础版", base_price=99.0, description="适合个人用户的基础订阅"),
        Plan(id="plan_pro", name="专业版", base_price=299.0, description="适合团队协作的专业订阅"),
        Plan(id="plan_enterprise", name="企业版", base_price=999.0, description="适合大型企业的定制化方案")
    ]
    for p in plans:
        store.add_plan(p)

    coupons = [
        Coupon(
            id="coupon_newuser20",
            code="NEWUSER20",
            type=DiscountType.PERCENTAGE,
            value=20.0,
            description="新用户首单 8 折优惠",
            max_discount=100.0
        ),
        Coupon(
            id="coupon_summer50",
            code="SUMMER50",
            type=DiscountType.FIXED_AMOUNT,
            value=50.0,
            description="夏季促销立减 50 元",
            min_amount=200.0
        ),
        Coupon(
            id="coupon_vip100",
            code="VIP100",
            type=DiscountType.FIXED_AMOUNT,
            value=100.0,
            description="VIP 用户专属 100 元减免"
        )
    ]
    for c in coupons:
        store.add_coupon(c)

    rule_v1 = PriceRule(
        id="global_rule",
        version=1,
        name="2026 Q1 全球定价规则",
        description="第一季度定价策略，含税 13%，无额外折扣",
        tax_rate=0.13,
        is_active=True
    )
    store.add_price_rule(rule_v1)


app = FastAPI(
    title="账单试算缓存 API",
    description="提供账单试算、缓存管理、规则版本和失效报告能力",
    version="1.0.0"
)

app.include_router(router, prefix="/api/v1")


@app.on_event("startup")
async def startup_event():
    init_sample_data()


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
