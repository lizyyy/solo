import json
import pytest
import tempfile
from pathlib import Path
from typing import Dict, List

from price_gate.engine import PriceEngine
from price_gate.manager import RuleManager
from price_gate.models import (
    ConflictSeverity,
    OrderItem,
    PriceRule,
    RuleStatus,
    RuleType,
    SampleOrder,
)
from price_gate.storage import FileStorage


@pytest.fixture
def engine() -> PriceEngine:
    return PriceEngine()


@pytest.fixture
def temp_storage() -> FileStorage:
    with tempfile.TemporaryDirectory() as td:
        yield FileStorage(base_dir=Path(td))


@pytest.fixture
def manager(temp_storage: FileStorage) -> RuleManager:
    return RuleManager(storage=temp_storage)


@pytest.fixture
def sample_rules() -> List[PriceRule]:
    return [
        PriceRule(
            id="rule-001",
            name="618 品类直降 10%",
            type=RuleType.CATEGORY,
            status=RuleStatus.ACTIVE,
            priority=10,
            categories=["手机", "数码"],
            discount_percent=10.0,
            can_overlay=True,
        ),
        PriceRule(
            id="rule-002",
            name="SKU 特价 iPhone",
            type=RuleType.DIRECT_DISCOUNT,
            status=RuleStatus.ACTIVE,
            priority=5,
            skus=["SKU-IPHONE-001"],
            discount_value=200.0,
            can_overlay=True,
        ),
        PriceRule(
            id="rule-003",
            name="买2送1 耳机促销",
            type=RuleType.MULTIBUY,
            status=RuleStatus.ACTIVE,
            priority=20,
            skus=["SKU-EARPODS-001"],
            buy_count=2,
            get_free=1,
            can_overlay=False,
        ),
        PriceRule(
            id="rule-004",
            name="品牌券满1000减100",
            type=RuleType.COUPON,
            status=RuleStatus.ACTIVE,
            priority=30,
            brands=["Apple"],
            coupon_code="APPLE100",
            min_amount=1000.0,
            discount_value=100.0,
            can_overlay=True,
        ),
    ]


@pytest.fixture
def sku_catalog() -> Dict[str, Dict]:
    return {
        "SKU-IPHONE-001": {
            "name": "iPhone 15 Pro",
            "category": "手机",
            "brand": "Apple",
        },
        "SKU-EARPODS-001": {
            "name": "AirPods Pro",
            "category": "数码",
            "brand": "Apple",
        },
    }


class TestDiscountStacking:
    def test_discount_applied_in_sequence_from_current_price(self, engine: PriceEngine) -> None:
        rule_a = PriceRule(
            id="A",
            name="先减100",
            type=RuleType.DIRECT_DISCOUNT,
            status=RuleStatus.ACTIVE,
            skus=["SKU-A"],
            discount_value=100.0,
            priority=20,
        )
        rule_b = PriceRule(
            id="B",
            name="再打9折",
            type=RuleType.DIRECT_DISCOUNT,
            status=RuleStatus.ACTIVE,
            skus=["SKU-A"],
            discount_percent=10.0,
            priority=10,
        )
        sample = SampleOrder(
            id="s1",
            name="叠加测试",
            items=[
                OrderItem(
                    sku="SKU-A",
                    quantity=1,
                    original_price=1000.0,
                    applied_discounts=[],
                    final_price=0.0,
                    total_final=0.0,
                )
            ],
            expected_total_original=1000.0,
            expected_total_final=810.0,
        )
        result = engine.calculate_sample(sample, [rule_a, rule_b])
        assert result.passed, f"Expected 810 but got {result.actual}"

    def test_percentage_then_value(self, engine: PriceEngine) -> None:
        rule_a = PriceRule(
            id="A",
            name="先打8折",
            type=RuleType.DIRECT_DISCOUNT,
            status=RuleStatus.ACTIVE,
            skus=["SKU-A"],
            discount_percent=20.0,
            priority=20,
        )
        rule_b = PriceRule(
            id="B",
            name="再减50",
            type=RuleType.DIRECT_DISCOUNT,
            status=RuleStatus.ACTIVE,
            skus=["SKU-A"],
            discount_value=50.0,
            priority=10,
        )
        sample = SampleOrder(
            id="s1",
            name="百分比后直减",
            items=[
                OrderItem(
                    sku="SKU-A",
                    quantity=1,
                    original_price=500.0,
                    applied_discounts=[],
                    final_price=0.0,
                    total_final=0.0,
                )
            ],
            expected_total_original=500.0,
            expected_total_final=350.0,
        )
        result = engine.calculate_sample(sample, [rule_a, rule_b])
        assert result.passed, f"Expected 350 but got {result.actual}"


class TestMinAmountCoupon:
    def test_coupon_not_applied_below_min(self, engine: PriceEngine) -> None:
        coupon = PriceRule(
            id="c1",
            name="满1000减100",
            type=RuleType.COUPON,
            status=RuleStatus.ACTIVE,
            coupon_code="SAVE100",
            min_amount=1000.0,
            discount_value=100.0,
        )
        sample = SampleOrder(
            id="s1",
            name="未达门槛",
            items=[
                OrderItem(
                    sku="SKU-A",
                    quantity=1,
                    original_price=500.0,
                    applied_discounts=[],
                    final_price=0.0,
                    total_final=0.0,
                )
            ],
            expected_total_original=500.0,
            expected_total_final=500.0,
            applied_coupons=["SAVE100"],
        )
        result = engine.calculate_sample(sample, [coupon])
        assert result.passed, f"Expected 500 (no discount) but got {result.actual}"

    def test_coupon_applied_above_min(self, engine: PriceEngine) -> None:
        coupon = PriceRule(
            id="c1",
            name="满1000减100",
            type=RuleType.COUPON,
            status=RuleStatus.ACTIVE,
            coupon_code="SAVE100",
            min_amount=1000.0,
            discount_value=100.0,
        )
        sample = SampleOrder(
            id="s1",
            name="达到门槛",
            items=[
                OrderItem(
                    sku="SKU-A",
                    quantity=1,
                    original_price=1500.0,
                    applied_discounts=[],
                    final_price=0.0,
                    total_final=0.0,
                )
            ],
            expected_total_original=1500.0,
            expected_total_final=1400.0,
            applied_coupons=["SAVE100"],
        )
        result = engine.calculate_sample(sample, [coupon])
        assert result.passed, f"Expected 1400 but got {result.actual}"


class TestSkuCatalogMatching:
    def test_category_rule_with_sku_catalog(self, engine: PriceEngine, sku_catalog: Dict[str, Dict]) -> None:
        rule = PriceRule(
            id="cat1",
            name="手机9折",
            type=RuleType.CATEGORY,
            status=RuleStatus.ACTIVE,
            categories=["手机"],
            discount_percent=10.0,
        )
        sample = SampleOrder(
            id="s1",
            name="品类折扣通过SKU目录",
            items=[
                OrderItem(
                    sku="SKU-IPHONE-001",
                    quantity=1,
                    original_price=5000.0,
                    applied_discounts=[],
                    final_price=0.0,
                    total_final=0.0,
                )
            ],
            expected_total_original=5000.0,
            expected_total_final=4500.0,
        )
        result = engine.calculate_sample(sample, [rule], sku_catalog=sku_catalog)
        assert result.passed, f"Expected 4500 but got {result.actual}"
        assert "cat1" in result.applied_rules

    def test_brand_coupon_with_sku_catalog(self, engine: PriceEngine, sku_catalog: Dict[str, Dict]) -> None:
        rule = PriceRule(
            id="brand1",
            name="Apple券减100",
            type=RuleType.COUPON,
            status=RuleStatus.ACTIVE,
            brands=["Apple"],
            coupon_code="APPLE",
            discount_value=100.0,
        )
        sample = SampleOrder(
            id="s1",
            name="品牌券通过SKU目录",
            items=[
                OrderItem(
                    sku="SKU-IPHONE-001",
                    quantity=1,
                    original_price=5000.0,
                    applied_discounts=[],
                    final_price=0.0,
                    total_final=0.0,
                )
            ],
            expected_total_original=5000.0,
            expected_total_final=4900.0,
            applied_coupons=["APPLE"],
        )
        result = engine.calculate_sample(sample, [rule], sku_catalog=sku_catalog)
        assert result.passed, f"Expected 4900 but got {result.actual}"

    def test_conflict_detection_with_sku_catalog(self, engine: PriceEngine, sku_catalog: Dict[str, Dict]) -> None:
        rule1 = PriceRule(
            id="r1",
            name="手机50%",
            type=RuleType.CATEGORY,
            status=RuleStatus.ACTIVE,
            categories=["手机"],
            discount_percent=50.0,
        )
        rule2 = PriceRule(
            id="r2",
            name="iPhone 40%",
            type=RuleType.DIRECT_DISCOUNT,
            status=RuleStatus.ACTIVE,
            skus=["SKU-IPHONE-001"],
            discount_percent=40.0,
        )
        conflicts = engine.detect_conflicts([rule1, rule2], sku_catalog=sku_catalog)
        assert len(conflicts) == 1
        assert conflicts[0].severity == ConflictSeverity.CRITICAL


class TestExampleScenarios:
    def test_sample_001_without_coupon(
        self, engine: PriceEngine, sample_rules: List[PriceRule], sku_catalog: Dict[str, Dict]
    ) -> None:
        sample = SampleOrder(
            id="sample-001",
            name="iPhone 单购",
            items=[
                OrderItem(
                    sku="SKU-IPHONE-001",
                    quantity=1,
                    original_price=5000.0,
                    applied_discounts=[],
                    final_price=0.0,
                    total_final=0.0,
                )
            ],
            expected_total_original=5000.0,
            expected_total_final=4300.0,
        )
        result = engine.calculate_sample(sample, sample_rules, sku_catalog=sku_catalog)
        assert result.passed, f"Expected 4300 but got {result.actual}, diff={result.diff}"

    def test_sample_002_multibuy(
        self, engine: PriceEngine, sample_rules: List[PriceRule], sku_catalog: Dict[str, Dict]
    ) -> None:
        sample = SampleOrder(
            id="sample-002",
            name="耳机买2送1",
            items=[
                OrderItem(
                    sku="SKU-EARPODS-001",
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
        result = engine.calculate_sample(sample, sample_rules, sku_catalog=sku_catalog)
        assert result.passed, f"Expected 200 but got {result.actual}"

    def test_sample_003_with_coupon(
        self, engine: PriceEngine, sample_rules: List[PriceRule], sku_catalog: Dict[str, Dict]
    ) -> None:
        sample = SampleOrder(
            id="sample-003",
            name="使用品牌券",
            items=[
                OrderItem(
                    sku="SKU-IPHONE-001",
                    quantity=1,
                    original_price=5000.0,
                    applied_discounts=[],
                    final_price=0.0,
                    total_final=0.0,
                )
            ],
            expected_total_original=5000.0,
            expected_total_final=4200.0,
            applied_coupons=["APPLE100"],
        )
        result = engine.calculate_sample(sample, sample_rules, sku_catalog=sku_catalog)
        assert result.passed, f"Expected 4200 but got {result.actual}, diff={result.diff}"


class TestManagerEndToEnd:
    def test_full_workflow_with_sku_catalog(self, manager: RuleManager, tmp_path: Path) -> None:
        catalog_file = tmp_path / "catalog.json"
        catalog_file.write_text(json.dumps({
            "SKU-IPHONE-001": {
                "name": "iPhone",
                "category": "手机",
                "brand": "Apple",
            }
        }))
        rules_file = tmp_path / "rules.json"
        rules_file.write_text(json.dumps([{
            "id": "rule-001",
            "name": "手机9折",
            "type": "category",
            "status": "pending",
            "categories": ["手机"],
            "discount_percent": 10.0,
        }, {
            "id": "rule-002",
            "name": "iPhone 减 200",
            "type": "direct_discount",
            "status": "pending",
            "skus": ["SKU-IPHONE-001"],
            "discount_value": 200.0,
        }]))
        samples_file = tmp_path / "samples.json"
        samples_file.write_text(json.dumps([{
            "id": "sample-001",
            "name": "测试",
            "items": [{
                "sku": "SKU-IPHONE-001",
                "quantity": 1,
                "original_price": 5000.0,
                "applied_discounts": [],
                "final_price": 0.0,
                "total_final": 0.0,
            }],
            "expected_total_original": 5000.0,
            "expected_total_final": 4300.0,
        }]))
        catalog_count = manager.import_sku_catalog(catalog_file)
        assert catalog_count == 1
        success, skipped, msgs, dirty = manager.import_rules(rules_file, auto_validate=False)
        assert success == 2
        count, _ = manager.import_samples(samples_file)
        assert count == 1
        passed, failed, _ = manager.playback_samples()
        assert passed == 1
        assert failed == 0
        conflicts = manager.detect_conflicts()
        assert len(conflicts) == 0
