import json
import pytest
import tempfile
from pathlib import Path
from datetime import datetime

from price_gate.manager import RuleManager
from price_gate.models import (
    PriceRule,
    RuleStatus,
    RuleType,
    SampleOrder,
    OrderItem,
)
from price_gate.storage import FileStorage


@pytest.fixture
def temp_storage() -> FileStorage:
    with tempfile.TemporaryDirectory() as td:
        yield FileStorage(base_dir=Path(td))


@pytest.fixture
def manager(temp_storage: FileStorage) -> RuleManager:
    return RuleManager(storage=temp_storage)


def test_import_rules_success(manager: RuleManager, tmp_path: Path) -> None:
    rules_file = tmp_path / "rules.json"
    rules_data = [
        {
            "id": "test-r1",
            "name": "测试规则",
            "type": "direct_discount",
            "status": "pending",
            "skus": ["SKU-A"],
            "discount_percent": 10.0,
        }
    ]
    rules_file.write_text(json.dumps(rules_data))
    success, skipped, messages, dirty_ids = manager.import_rules(rules_file, auto_validate=False)
    assert success == 1
    assert skipped == 0
    assert len(dirty_ids) == 0
    rule = manager.get_rule("test-r1")
    assert rule is not None
    assert rule.name == "测试规则"
    assert rule.version == 1


def test_import_rules_with_dirty_data(manager: RuleManager, tmp_path: Path) -> None:
    rules_file = tmp_path / "rules.json"
    rules_data = [
        {
            "id": "good-r1",
            "name": "好规则",
            "type": "direct_discount",
            "status": "pending",
            "skus": ["SKU-A"],
            "discount_percent": 10.0,
        },
        {
            "id": "bad-r1",
            "name": "坏规则",
            "type": "invalid_type",
            "status": "pending",
        },
    ]
    rules_file.write_text(json.dumps(rules_data))
    success, skipped, messages, dirty_ids = manager.import_rules(rules_file, auto_validate=False)
    assert success == 1
    assert skipped == 1
    assert len(dirty_ids) == 1
    dirty = manager.list_dirty()
    assert len(dirty) == 1


def test_rule_versioning(manager: RuleManager, tmp_path: Path) -> None:
    rules_file1 = tmp_path / "r1.json"
    rules_file1.write_text(
        json.dumps([{
            "id": "versioned-r1",
            "name": "版本1",
            "type": "direct_discount",
            "status": "pending",
            "skus": ["SKU-A"],
            "discount_percent": 10.0,
        }])
    )
    manager.import_rules(rules_file1, auto_validate=False)
    r = manager.get_rule("versioned-r1")
    assert r is not None
    assert r.version == 1
    rules_file2 = tmp_path / "r2.json"
    rules_file2.write_text(
        json.dumps([{
            "id": "versioned-r1",
            "name": "版本2",
            "type": "direct_discount",
            "status": "pending",
            "skus": ["SKU-A"],
            "discount_percent": 20.0,
        }])
    )
    manager.import_rules(rules_file2, auto_validate=False)
    r2 = manager.get_rule("versioned-r1")
    assert r2 is not None
    assert r2.version == 2
    assert r2.name == "版本2"
    versions = manager.list_versions("versioned-r1")
    assert 1 in versions
    assert 2 in versions


def test_import_samples(manager: RuleManager, tmp_path: Path) -> None:
    samples_file = tmp_path / "samples.json"
    samples_data = [
        {
            "id": "sample-1",
            "name": "测试样例",
            "items": [
                {
                    "sku": "SKU-A",
                    "quantity": 1,
                    "original_price": 100.0,
                    "applied_discounts": [],
                    "final_price": 90.0,
                    "total_final": 90.0,
                }
            ],
            "expected_total_original": 100.0,
            "expected_total_final": 90.0,
        }
    ]
    samples_file.write_text(json.dumps(samples_data))
    count, messages = manager.import_samples(samples_file)
    assert count == 1
    samples = manager.list_samples()
    assert len(samples) == 1


def test_rollback(manager: RuleManager, tmp_path: Path) -> None:
    rules_file1 = tmp_path / "r1.json"
    rules_file1.write_text(
        json.dumps([{
            "id": "rollback-test",
            "name": "初始版本",
            "type": "direct_discount",
            "status": "pending",
            "skus": ["SKU-A"],
            "discount_percent": 10.0,
        }])
    )
    manager.import_rules(rules_file1, auto_validate=False)
    rules_file2 = tmp_path / "r2.json"
    rules_file2.write_text(
        json.dumps([{
            "id": "rollback-test",
            "name": "修改版本",
            "type": "direct_discount",
            "status": "pending",
            "skus": ["SKU-A"],
            "discount_percent": 50.0,
        }])
    )
    manager.import_rules(rules_file2, auto_validate=False)
    r = manager.get_rule("rollback-test")
    assert r is not None
    assert r.discount_percent == 50.0
    success, msg = manager.rollback_rule("rollback-test", target_version=1)
    assert success
    r2 = manager.get_rule("rollback-test")
    assert r2 is not None
    assert r2.version == 3


def test_history_tracking(manager: RuleManager, tmp_path: Path) -> None:
    rules_file = tmp_path / "r1.json"
    rules_file.write_text(
        json.dumps([{
            "id": "history-test",
            "name": "历史测试",
            "type": "direct_discount",
            "status": "pending",
            "skus": ["SKU-A"],
            "discount_percent": 10.0,
        }])
    )
    manager.import_rules(rules_file, auto_validate=False)
    records = manager.list_history(limit=10)
    assert len(records) >= 1
    assert any(r.type == "rule_import" for r in records)


def test_backup_and_restore(manager: RuleManager, tmp_path: Path) -> None:
    rules_file = tmp_path / "r1.json"
    rules_file.write_text(
        json.dumps([{
            "id": "backup-test",
            "name": "备份测试",
            "type": "direct_discount",
            "status": "pending",
            "skus": ["SKU-A"],
            "discount_percent": 10.0,
        }])
    )
    manager.import_rules(rules_file, auto_validate=False)
    backup_path = manager.backup()
    assert backup_path.exists()
    manager.reset()
    assert manager.list_rules() == []
    manager.restore(backup_path)
    restored = manager.list_rules()
    assert len(restored) == 1
    assert restored[0].id == "backup-test"


def test_detect_conflicts(manager: RuleManager) -> None:
    r1 = PriceRule(
        id="c1",
        name="冲突1",
        type=RuleType.DIRECT_DISCOUNT,
        status=RuleStatus.ACTIVE,
        skus=["SKU-A"],
        discount_percent=50.0,
    )
    r2 = PriceRule(
        id="c2",
        name="冲突2",
        type=RuleType.DIRECT_DISCOUNT,
        status=RuleStatus.ACTIVE,
        skus=["SKU-A"],
        discount_percent=40.0,
    )
    manager.storage.save_rule(r1)
    manager.storage.save_rule(r2)
    conflicts = manager.detect_conflicts()
    assert len(conflicts) == 1


def test_playback_samples(manager: RuleManager) -> None:
    rule = PriceRule(
        id="p1",
        name="播放测试",
        type=RuleType.DIRECT_DISCOUNT,
        status=RuleStatus.ACTIVE,
        skus=["SKU-A"],
        discount_percent=10.0,
    )
    sample = SampleOrder(
        id="playback-1",
        name="播放样例",
        items=[
            OrderItem(
                sku="SKU-A",
                quantity=1,
                original_price=100.0,
                applied_discounts=[],
                final_price=90.0,
                total_final=90.0,
            )
        ],
        expected_total_original=100.0,
        expected_total_final=90.0,
    )
    manager.storage.save_rule(rule)
    manager.storage.save_sample(sample)
    passed, failed, results = manager.playback_samples()
    assert passed == 1
    assert failed == 0
