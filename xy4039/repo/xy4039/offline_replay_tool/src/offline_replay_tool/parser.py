import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Type, TypeVar

from pydantic import ValidationError

from .config import AppConfig
from .models import (
    DoorCloseEvent,
    DoorOpenEvent,
    Event,
    EventType,
    ItemReturnEvent,
    ItemTakeEvent,
    ManualCorrectionEvent,
    PaymentCallbackEvent,
    WeightChange,
    WeightSampleEvent,
)

T = TypeVar("T", bound=Event)


class EventParser:
    def __init__(self, config: AppConfig):
        self.config = config

    def parse_jsonl_file(self, file_path: Path) -> Iterator[Dict[str, Any]]:
        with open(file_path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except json.JSONDecodeError as e:
                    raise ValueError(f"文件 {file_path} 第 {line_num} 行 JSON 解析失败: {e}")

    def parse_event(self, raw_data: Dict[str, Any]) -> Event:
        event_type_str = raw_data.get("event_type")
        if not event_type_str:
            raise ValueError("缺少 event_type 字段")

        try:
            event_type = EventType(event_type_str)
        except ValueError:
            raise ValueError(f"未知的 event_type: {event_type_str}")

        event_classes: Dict[EventType, Type[Event]] = {
            EventType.DOOR_OPEN: DoorOpenEvent,
            EventType.DOOR_CLOSE: DoorCloseEvent,
            EventType.ITEM_TAKE: ItemTakeEvent,
            EventType.ITEM_RETURN: ItemReturnEvent,
            EventType.WEIGHT_SAMPLE: WeightSampleEvent,
            EventType.PAYMENT_CALLBACK: PaymentCallbackEvent,
            EventType.MANUAL_CORRECTION: ManualCorrectionEvent,
        }

        event_class = event_classes.get(event_type, Event)

        base_fields = {
            "event_id": raw_data.get("event_id"),
            "event_type": event_type,
            "cabinet_id": raw_data.get("cabinet_id"),
            "order_id": raw_data.get("order_id"),
            "timestamp": self._parse_timestamp(raw_data.get("timestamp")),
            "raw_data": raw_data,
        }

        if event_type == EventType.DOOR_OPEN:
            base_fields["user_id"] = raw_data.get("user_id")
            base_fields["session_id"] = raw_data.get("session_id")
        elif event_type == EventType.DOOR_CLOSE:
            base_fields["user_id"] = raw_data.get("user_id")
            base_fields["session_id"] = raw_data.get("session_id")
            base_fields["duration_seconds"] = raw_data.get("duration_seconds")
        elif event_type == EventType.ITEM_TAKE:
            base_fields["sku_id"] = raw_data.get("sku_id")
            base_fields["channel_id"] = raw_data.get("channel_id")
            base_fields["quantity"] = raw_data.get("quantity", 1)
            base_fields["recognized_by"] = raw_data.get("recognized_by", "ai")
        elif event_type == EventType.ITEM_RETURN:
            base_fields["sku_id"] = raw_data.get("sku_id")
            base_fields["channel_id"] = raw_data.get("channel_id")
            base_fields["quantity"] = raw_data.get("quantity", 1)
            base_fields["recognized_by"] = raw_data.get("recognized_by", "ai")
        elif event_type == EventType.WEIGHT_SAMPLE:
            changes = []
            raw_changes = raw_data.get("changes", [])
            for ch in raw_changes:
                changes.append(WeightChange(
                    channel_id=ch.get("channel_id", ""),
                    weight_before=ch.get("weight_before", 0.0),
                    weight_after=ch.get("weight_after", 0.0),
                    delta_weight=ch.get("delta_weight", 0.0),
                ))
            base_fields["changes"] = changes
            base_fields["total_weight_before"] = raw_data.get("total_weight_before", 0.0)
            base_fields["total_weight_after"] = raw_data.get("total_weight_after", 0.0)
        elif event_type == EventType.PAYMENT_CALLBACK:
            base_fields["payment_id"] = raw_data.get("payment_id", "")
            base_fields["payment_status"] = raw_data.get("payment_status", "unknown")
            base_fields["amount"] = raw_data.get("amount", 0.0)
            base_fields["payment_method"] = raw_data.get("payment_method", "wechat")
        elif event_type == EventType.MANUAL_CORRECTION:
            base_fields["operator_id"] = raw_data.get("operator_id")
            base_fields["reason"] = raw_data.get("reason", "")
            base_fields["override_ai"] = raw_data.get("override_ai", True)
            from .models import ItemChange
            item_changes = []
            raw_changes = raw_data.get("item_changes", [])
            for ch in raw_changes:
                item_changes.append(ItemChange(
                    sku_id=ch.get("sku_id", ""),
                    channel_id=ch.get("channel_id", ""),
                    quantity=ch.get("quantity", 0),
                    unit_price=ch.get("unit_price", 0.0),
                ))
            base_fields["item_changes"] = item_changes

        try:
            return event_class(**base_fields)
        except ValidationError as e:
            raise ValueError(f"事件解析失败: {e}")

    def _parse_timestamp(self, value: Any) -> datetime:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                try:
                    return datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    raise ValueError(f"无法解析时间戳: {value}")
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(value)
        raise ValueError(f"不支持的时间戳类型: {type(value)}")
