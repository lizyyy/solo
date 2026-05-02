from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple

from .config import AppConfig
from .models import (
    Event,
    EventType,
    ItemReturnEvent,
    ItemTakeEvent,
    PaymentCallbackEvent,
    WeightSampleEvent,
)


class ValidationResult:
    def __init__(self):
        self.is_valid: bool = True
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def add_error(self, msg: str):
        self.is_valid = False
        self.errors.append(msg)

    def add_warning(self, msg: str):
        self.warnings.append(msg)


class EventValidator:
    def __init__(self, config: AppConfig):
        self.config = config
        self._seen_event_ids: Set[str] = set()
        self._seen_payment_ids: Set[str] = set()
        self._last_timestamps: Dict[str, datetime] = {}

    def validate_single_event(self, event: Event) -> ValidationResult:
        result = ValidationResult()

        if not event.event_id:
            result.add_error("event_id 为空")

        if not event.cabinet_id:
            result.add_error("cabinet_id 为空")

        if not self.config.get_cabinet(event.cabinet_id):
            result.add_warning(f"未知的柜机 ID: {event.cabinet_id}")

        if not event.timestamp:
            result.add_error("timestamp 为空")

        if event.event_type in [
            EventType.ITEM_TAKE,
            EventType.ITEM_RETURN,
            EventType.WEIGHT_SAMPLE,
            EventType.MANUAL_CORRECTION,
        ]:
            if not event.order_id:
                result.add_error(f"{event.event_type} 事件缺少 order_id")

        if isinstance(event, ItemTakeEvent):
            self._validate_item_take(event, result)
        elif isinstance(event, ItemReturnEvent):
            self._validate_item_return(event, result)
        elif isinstance(event, PaymentCallbackEvent):
            self._validate_payment_callback(event, result)
        elif isinstance(event, WeightSampleEvent):
            self._validate_weight_sample(event, result)

        return result

    def _validate_item_take(self, event: ItemTakeEvent, result: ValidationResult):
        if not event.sku_id:
            result.add_error("ITEM_TAKE 缺少 sku_id")
        elif not self.config.get_sku(event.sku_id):
            result.add_warning(f"未知的 SKU: {event.sku_id}")

        if not event.channel_id:
            result.add_error("ITEM_TAKE 缺少 channel_id")
        else:
            channel = self.config.get_channel(event.cabinet_id, event.channel_id)
            if channel:
                pass
            else:
                result.add_warning(f"未知的货道: {event.channel_id}")

        if event.quantity <= 0:
            result.add_error("ITEM_TAKE quantity 必须大于 0")

    def _validate_item_return(self, event: ItemReturnEvent, result: ValidationResult):
        if not event.sku_id:
            result.add_error("ITEM_RETURN 缺少 sku_id")
        elif not self.config.get_sku(event.sku_id):
            result.add_warning(f"未知的 SKU: {event.sku_id}")

        if not event.channel_id:
            result.add_error("ITEM_RETURN 缺少 channel_id")

        if event.quantity <= 0:
            result.add_error("ITEM_RETURN quantity 必须大于 0")

    def _validate_payment_callback(self, event: PaymentCallbackEvent, result: ValidationResult):
        if not event.payment_id:
            result.add_error("PAYMENT_CALLBACK 缺少 payment_id")

        if event.amount < 0:
            result.add_error("PAYMENT_CALLBACK amount 不能为负数")

    def _validate_weight_sample(self, event: WeightSampleEvent, result: ValidationResult):
        for change in event.changes:
            if not change.channel_id:
                result.add_error("WEIGHT_SAMPLE 变化缺少 channel_id")

    def validate_event_relationships(
        self, events: List[Event], batch_id: str
    ) -> Dict[str, List[str]]:
        errors: Dict[str, List[str]] = {}

        event_ids: Set[str] = set()
        payment_ids: Set[str] = set()
        timestamps_by_cabinet: Dict[str, List[Tuple[datetime, str]]] = {}

        for event in events:
            event_key = event.event_id

            if event.event_id in event_ids:
                if event_key not in errors:
                    errors[event_key] = []
                errors[event_key].append(f"重复的 event_id: {event.event_id}")
            event_ids.add(event.event_id)

            if isinstance(event, PaymentCallbackEvent):
                if event.payment_id in payment_ids:
                    if event_key not in errors:
                        errors[event_key] = []
                    errors[event_key].append(
                        f"重复的 payment_id: {event.payment_id}"
                    )
                payment_ids.add(event.payment_id)

            if event.cabinet_id not in timestamps_by_cabinet:
                timestamps_by_cabinet[event.cabinet_id] = []
            timestamps_by_cabinet[event.cabinet_id].append(
                (event.timestamp, event.event_id)
            )

        for cabinet_id, timestamp_pairs in timestamps_by_cabinet.items():
            sorted_pairs = sorted(timestamp_pairs, key=lambda x: x[0])
            for i in range(1, len(sorted_pairs)):
                prev_time, prev_id = sorted_pairs[i - 1]
                curr_time, curr_id = sorted_pairs[i]

                if curr_time < prev_time:
                    drift = (prev_time - curr_time).total_seconds()
                    max_drift = self.config.max_clock_drift_seconds
                    if drift > max_drift:
                        if curr_id not in errors:
                            errors[curr_id] = []
                        errors[curr_id].append(
                            f"时间倒序: 前一个事件 {prev_id} 在 {prev_time}, "
                            f"此事件 {curr_id} 在 {curr_time}, "
                            f"漂移 {drift} 秒超出允许的 {max_drift} 秒"
                        )

        return errors

    def validate_weight_and_quantity_match(
        self,
        take_events: List[ItemTakeEvent],
        weight_sample: Optional[WeightSampleEvent],
    ) -> ValidationResult:
        result = ValidationResult()

        if not weight_sample:
            return result

        total_expected_delta = 0.0
        for take in take_events:
            sku = self.config.get_sku(take.sku_id)
            if sku and sku.weight_per_unit > 0:
                total_expected_delta -= sku.weight_per_unit * take.quantity

        total_actual_delta = (
            weight_sample.total_weight_after - weight_sample.total_weight_before
        )

        threshold = self.config.abnormal_weight_threshold_percent / 100.0

        if abs(total_expected_delta) > 0.001:
            diff_percent = abs(total_actual_delta - total_expected_delta) / abs(
                total_expected_delta
            )
            if diff_percent > threshold:
                result.add_warning(
                    f"称重变化与商品数量不匹配: "
                    f"预期变化 {total_expected_delta:.2f}g, "
                    f"实际变化 {total_actual_delta:.2f}g, "
                    f"差异 {diff_percent * 100:.1f}% 超出阈值 {threshold * 100}%"
                )

        return result

    def reset_batch_state(self):
        self._seen_event_ids.clear()
        self._seen_payment_ids.clear()
        self._last_timestamps.clear()
