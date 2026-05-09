import pytest
from datetime import datetime

from price_gate.engine import PriceEngine
from price_gate.models import (
    ConflictSeverity,
    OrderItem,
    PriceRule,
    RuleStatus,
    RuleType,
    SampleOrder,
)


@pytest.fixture
def engine() -> PriceEngine:
    return PriceEngine()


@pytest.fixture
def sample_order() -> SampleOrder:
    return SampleOrder(
        id="test-sample-1",
        name="测试订单",
        items=[
            OrderItem(
                sku="SKU-A",
                quantity=1,
                original_price=100.0,
                applied_discounts=[],
                final_price=0.0,
                total_final=0.0,
            )
        ],
        expected_total_original=100.0,
        expected_total_final=70.0,
    )


def test_direct_discount(engine: PriceEngine) -> None:
    rule = PriceRule(
        id="r1",
        name="9折",
        type=RuleType.DIRECT_DISCOUNT,
        status=RuleStatus.ACTIVE,
        skus=["SKU-A"],
        discount_percent=10.0,
    )
    sample = SampleOrder(
        id="s1",
        name="测试",
        items=[
            OrderItem(
                sku="SKU-A",
                quantity=1,
                original_price=100.0,
                applied_discounts=[],
                final_price=0.0,
                total_final=0.0,
            )
        ],
        expected_total_original=100.0,
        expected_total_final=90.0,
    )
    result = engine.calculate_sample(sample, [rule])
    assert result.passed
    assert result.actual == 90.0


def test_multibuy(engine: PriceEngine) -> None:
    rule = PriceRule(
        id="r1",
        name="买2送1",
        type=RuleType.MULTIBUY,
        status=RuleStatus.ACTIVE,
        skus=["SKU-A"],
        buy_count=2,
        get_free=1,
    )
    sample = SampleOrder(
        id="s1",
        name="测试买赠",
        items=[
            OrderItem(
                sku="SKU-A",
                quantity=3,
                original_price=100.0,
                applied_discounts=[],
                final_price=0.0,
                total_final=0.0,
            )
        ],
        expected_total_original=300.0,
        expected_total_final=200.0,
    )
    result = engine.calculate_sample(sample, [rule])
    assert result.passed
    assert result.actual == 200.0


def test_no_conflict_for_different_skus(engine: PriceEngine) -> None:
    r1 = PriceRule(
        id="r1",
        name="A 折扣",
        type=RuleType.DIRECT_DISCOUNT,
        status=RuleStatus.ACTIVE,
        skus=["SKU-A"],
        discount_percent=10.0,
    )
    r2 = PriceRule(
        id="r2",
        name="B 折扣",
        type=RuleType.DIRECT_DISCOUNT,
        status=RuleStatus.ACTIVE,
        skus=["SKU-B"],
        discount_percent=10.0,
    )
    conflicts = engine.detect_conflicts([r1, r2])
    assert len(conflicts) == 0


def test_conflict_detection_for_same_sku(engine: PriceEngine) -> None:
    r1 = PriceRule(
        id="r1",
        name="A 9折",
        type=RuleType.DIRECT_DISCOUNT,
        status=RuleStatus.ACTIVE,
        skus=["SKU-A"],
        discount_percent=30.0,
    )
    r2 = PriceRule(
        id="r2",
        name="A 再打8折",
        type=RuleType.DIRECT_DISCOUNT,
        status=RuleStatus.ACTIVE,
        skus=["SKU-A"],
        discount_percent=60.0,
    )
    conflicts = engine.detect_conflicts([r1, r2])
    assert len(conflicts) == 1
    assert conflicts[0].severity == ConflictSeverity.CRITICAL


def test_validate_single_rule_errors() -> None:
    engine = PriceEngine()
    bad_rule = PriceRule(
        id="bad",
        name="坏规则",
        type=RuleType.DIRECT_DISCOUNT,
        status=RuleStatus.ACTIVE,
        discount_percent=150.0,
    )
    errs = engine._validate_single_rule(bad_rule)
    assert any("超出 0-100 范围" in e for e in errs)


def test_coupon_applied_with_code(engine: PriceEngine) -> None:
    rule = PriceRule(
        id="r1",
        name="优惠券",
        type=RuleType.COUPON,
        status=RuleStatus.ACTIVE,
        coupon_code="SAVE10",
        discount_value=10.0,
    )
    sample = SampleOrder(
        id="s1",
        name="测试优惠券",
        items=[
            OrderItem(
                sku="SKU-A",
                quantity=1,
                original_price=100.0,
                applied_discounts=[],
                final_price=0.0,
                total_final=0.0,
            )
        ],
        expected_total_original=100.0,
        expected_total_final=90.0,
        applied_coupons=["SAVE10"],
    )
    result = engine.calculate_sample(sample, [rule])
    assert result.passed
    assert result.actual == 90.0


def test_coupon_not_applied_without_code(engine: PriceEngine) -> None:
    rule = PriceRule(
        id="r1",
        name="优惠券",
        type=RuleType.COUPON,
        status=RuleStatus.ACTIVE,
        coupon_code="SAVE10",
        discount_value=10.0,
    )
    sample = SampleOrder(
        id="s1",
        name="无优惠码",
        items=[
            OrderItem(
                sku="SKU-A",
                quantity=1,
                original_price=100.0,
                applied_discounts=[],
                final_price=0.0,
                total_final=0.0,
            )
        ],
        expected_total_original=100.0,
        expected_total_final=100.0,
        applied_coupons=[],
    )
    result = engine.calculate_sample(sample, [rule])
    assert result.passed
    assert result.actual == 100.0


def test_exclude_rule_ids_prevent_conflict(engine: PriceEngine) -> None:
    r1 = PriceRule(
        id="r1",
        name="折扣1",
        type=RuleType.DIRECT_DISCOUNT,
        status=RuleStatus.ACTIVE,
        skus=["SKU-A"],
        discount_percent=30.0,
        exclude_rule_ids=["r2"],
    )
    r2 = PriceRule(
        id="r2",
        name="折扣2",
        type=RuleType.DIRECT_DISCOUNT,
        status=RuleStatus.ACTIVE,
        skus=["SKU-A"],
        discount_percent=60.0,
    )
    conflicts = engine.detect_conflicts([r1, r2])
    assert len(conflicts) == 0
