import json
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from offline_replay_tool.config import (
    AppConfig,
    CabinetConfig,
    ChannelConfig,
    SKUConfig,
)
from offline_replay_tool.ledger import Ledger
from offline_replay_tool.models import (
    BatchInfo,
    Event,
    EventType,
    ItemTakeEvent,
    OrderStatus,
    PaymentCallbackEvent,
)
from offline_replay_tool.parser import EventParser
from offline_replay_tool.quarantine import QuarantineStore
from offline_replay_tool.replay import OrderReplayEngine
from offline_replay_tool.validator import EventValidator


@pytest.fixture
def test_config():
    return AppConfig(
        cabinets=[
            CabinetConfig(cabinet_id="TEST001", name="测试柜机", location="测试地点"),
        ],
        skus=[
            SKUConfig(sku_id="SKU001", name="测试商品1", price=10.0, weight_per_unit=100.0),
            SKUConfig(sku_id="SKU002", name="测试商品2", price=20.0, weight_per_unit=200.0),
        ],
        channels=[
            ChannelConfig(channel_id="TEST001_CH01", sku_id="SKU001", capacity=10, initial_quantity=5),
            ChannelConfig(channel_id="TEST001_CH02", sku_id="SKU002", capacity=8, initial_quantity=4),
        ],
        deduplication_window_seconds=3600,
        max_clock_drift_seconds=300,
        abnormal_weight_threshold_percent=20.0,
    )


@pytest.fixture
def temp_data_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


class TestEventParser:
    def test_parse_valid_event(self, test_config):
        parser = EventParser(test_config)
        raw_data = {
            "event_id": "TEST001",
            "event_type": "door_open",
            "cabinet_id": "TEST001",
            "order_id": "ORD001",
            "timestamp": "2026-05-01T10:00:00+08:00",
            "user_id": "USER001",
            "session_id": "SESS001",
        }
        event = parser.parse_event(raw_data)
        assert event.event_id == "TEST001"
        assert event.event_type == EventType.DOOR_OPEN
        assert event.cabinet_id == "TEST001"

    def test_parse_item_take_event(self, test_config):
        parser = EventParser(test_config)
        raw_data = {
            "event_id": "TEST002",
            "event_type": "item_take",
            "cabinet_id": "TEST001",
            "order_id": "ORD001",
            "timestamp": "2026-05-01T10:00:15+08:00",
            "sku_id": "SKU001",
            "channel_id": "TEST001_CH01",
            "quantity": 2,
            "recognized_by": "ai",
        }
        event = parser.parse_event(raw_data)
        assert isinstance(event, ItemTakeEvent)
        assert event.sku_id == "SKU001"
        assert event.quantity == 2


class TestEventValidator:
    def test_validate_single_event_valid(self, test_config):
        validator = EventValidator(test_config)
        event = ItemTakeEvent(
            event_id="TEST001",
            event_type=EventType.ITEM_TAKE,
            cabinet_id="TEST001",
            order_id="ORD001",
            timestamp=datetime.now(),
            raw_data={},
            sku_id="SKU001",
            channel_id="TEST001_CH01",
            quantity=1,
        )
        result = validator.validate_single_event(event)
        assert result.is_valid is True

    def test_validate_event_missing_order_id(self, test_config):
        validator = EventValidator(test_config)
        event = ItemTakeEvent(
            event_id="TEST001",
            event_type=EventType.ITEM_TAKE,
            cabinet_id="TEST001",
            order_id=None,
            timestamp=datetime.now(),
            raw_data={},
            sku_id="SKU001",
            channel_id="TEST001_CH01",
            quantity=1,
        )
        result = validator.validate_single_event(event)
        assert result.is_valid is False

    def test_validate_relationship_duplicate_event_id(self, test_config):
        validator = EventValidator(test_config)
        base_time = datetime.now()
        events = [
            ItemTakeEvent(
                event_id="DUP001",
                event_type=EventType.ITEM_TAKE,
                cabinet_id="TEST001",
                order_id="ORD001",
                timestamp=base_time,
                raw_data={},
                sku_id="SKU001",
                channel_id="TEST001_CH01",
                quantity=1,
            ),
            ItemTakeEvent(
                event_id="DUP001",
                event_type=EventType.ITEM_TAKE,
                cabinet_id="TEST001",
                order_id="ORD002",
                timestamp=base_time + timedelta(seconds=1),
                raw_data={},
                sku_id="SKU002",
                channel_id="TEST001_CH02",
                quantity=1,
            ),
        ]
        errors = validator.validate_event_relationships(events, "TEST_BATCH")
        assert "DUP001" in errors


class TestQuarantineStore:
    def test_add_and_get_event(self, temp_data_dir, test_config):
        quarantine = QuarantineStore(temp_data_dir)
        event = ItemTakeEvent(
            event_id="QEVT001",
            event_type=EventType.ITEM_TAKE,
            cabinet_id="TEST001",
            order_id="ORD001",
            timestamp=datetime.now(),
            raw_data={},
            sku_id="SKU001",
            channel_id="TEST001_CH01",
            quantity=1,
        )
        qe = quarantine.add_event(event, "测试原因", "TEST_BATCH")
        assert qe.event.event_id == "QEVT001"
        assert quarantine.get_event("QEVT001") is not None

    def test_get_events_by_batch(self, temp_data_dir, test_config):
        quarantine = QuarantineStore(temp_data_dir)
        event1 = ItemTakeEvent(
            event_id="QEVT002",
            event_type=EventType.ITEM_TAKE,
            cabinet_id="TEST001",
            order_id="ORD001",
            timestamp=datetime.now(),
            raw_data={},
            sku_id="SKU001",
            channel_id="TEST001_CH01",
            quantity=1,
        )
        event2 = ItemTakeEvent(
            event_id="QEVT003",
            event_type=EventType.ITEM_TAKE,
            cabinet_id="TEST001",
            order_id="ORD001",
            timestamp=datetime.now(),
            raw_data={},
            sku_id="SKU001",
            channel_id="TEST001_CH01",
            quantity=1,
        )
        quarantine.add_event(event1, "原因1", "BATCH_A")
        quarantine.add_event(event2, "原因2", "BATCH_B")
        assert len(quarantine.get_events_by_batch("BATCH_A")) == 1
        assert len(quarantine.get_events_by_batch("BATCH_B")) == 1


class TestOrderReplayEngine:
    def test_process_simple_order(self, test_config):
        validator = EventValidator(test_config)
        engine = OrderReplayEngine(test_config, validator)
        base_time = datetime.now()
        events = [
            Event(
                event_id="EVT001",
                event_type=EventType.DOOR_OPEN,
                cabinet_id="TEST001",
                order_id="ORDER001",
                timestamp=base_time,
                raw_data={},
            ),
            ItemTakeEvent(
                event_id="EVT002",
                event_type=EventType.ITEM_TAKE,
                cabinet_id="TEST001",
                order_id="ORDER001",
                timestamp=base_time + timedelta(seconds=10),
                raw_data={},
                sku_id="SKU001",
                channel_id="TEST001_CH01",
                quantity=2,
            ),
            Event(
                event_id="EVT003",
                event_type=EventType.DOOR_CLOSE,
                cabinet_id="TEST001",
                order_id="ORDER001",
                timestamp=base_time + timedelta(seconds=20),
                raw_data={},
            ),
            PaymentCallbackEvent(
                event_id="EVT004",
                event_type=EventType.PAYMENT_CALLBACK,
                cabinet_id="TEST001",
                order_id="ORDER001",
                timestamp=base_time + timedelta(seconds=60),
                raw_data={},
                payment_id="PAY001",
                payment_status="success",
                amount=20.0,
            ),
        ]
        for event in events:
            engine.process_event(event)
        order = engine.get_order("ORDER001")
        assert order is not None
        assert order.status == OrderStatus.PAID
        assert len(order.item_takes) == 1
        assert order.total_amount == 20.0
        assert order.paid_amount == 20.0

    def test_build_replay_results(self, test_config):
        validator = EventValidator(test_config)
        engine = OrderReplayEngine(test_config, validator)
        base_time = datetime.now()
        events = [
            Event(
                event_id="EVT001",
                event_type=EventType.DOOR_OPEN,
                cabinet_id="TEST001",
                order_id="ORDER001",
                timestamp=base_time,
                raw_data={},
            ),
            ItemTakeEvent(
                event_id="EVT002",
                event_type=EventType.ITEM_TAKE,
                cabinet_id="TEST001",
                order_id="ORDER001",
                timestamp=base_time + timedelta(seconds=10),
                raw_data={},
                sku_id="SKU001",
                channel_id="TEST001_CH01",
                quantity=1,
            ),
            Event(
                event_id="EVT003",
                event_type=EventType.DOOR_CLOSE,
                cabinet_id="TEST001",
                order_id="ORDER001",
                timestamp=base_time + timedelta(seconds=20),
                raw_data={},
            ),
            PaymentCallbackEvent(
                event_id="EVT004",
                event_type=EventType.PAYMENT_CALLBACK,
                cabinet_id="TEST001",
                order_id="ORDER001",
                timestamp=base_time + timedelta(seconds=60),
                raw_data={},
                payment_id="PAY001",
                payment_status="success",
                amount=10.0,
            ),
        ]
        results = engine.build_replay_results(events, dry_run=True)
        assert results["dry_run"] is True
        assert results["statistics"]["unique_orders"] == 1
        assert results["statistics"]["paid_orders"] == 1
        assert len(results["orders"]) == 1


class TestLedger:
    def test_register_batch(self, temp_data_dir, test_config):
        ledger = Ledger(temp_data_dir, test_config)
        batch = BatchInfo(
            batch_id="TEST_BATCH_001",
            import_time=datetime.now(),
            source_files=["test.jsonl"],
            event_count=10,
            valid_event_count=8,
            quarantined_count=2,
        )
        ledger.register_batch(batch)
        assert ledger.get_batch("TEST_BATCH_001") is not None

    def test_apply_batch_idempotency(self, temp_data_dir, test_config):
        ledger = Ledger(temp_data_dir, test_config)
        validator = EventValidator(test_config)
        batch = BatchInfo(
            batch_id="TEST_BATCH_002",
            import_time=datetime.now(),
            source_files=["test2.jsonl"],
            event_count=5,
            valid_event_count=5,
            quarantined_count=0,
        )
        ledger.register_batch(batch)
        result1 = ledger.apply_batch("TEST_BATCH_002", [], dry_run=False)
        assert result1["success"] is True
        result2 = ledger.apply_batch("TEST_BATCH_002", [], dry_run=False)
        assert result2.get("already_applied") is True

    def test_undo_last_batch(self, temp_data_dir, test_config):
        ledger = Ledger(temp_data_dir, test_config)
        validator = EventValidator(test_config)
        batch = BatchInfo(
            batch_id="TEST_BATCH_003",
            import_time=datetime.now(),
            source_files=["test3.jsonl"],
            event_count=3,
            valid_event_count=3,
            quarantined_count=0,
        )
        ledger.register_batch(batch)
        ledger.apply_batch("TEST_BATCH_003", [], dry_run=False)
        assert len(ledger.get_applied_batches()) == 1
        result = ledger.undo_last_batch()
        assert result["success"] is True
        assert len(ledger.get_applied_batches()) == 0
