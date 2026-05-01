from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from .config import AppConfig
from .models import (
    DoorCloseEvent,
    DoorOpenEvent,
    Event,
    EventType,
    ItemReturnEvent,
    ItemTakeEvent,
    ManualCorrectionEvent,
    OrderReplayState,
    OrderStatus,
    PaymentCallbackEvent,
    WeightSampleEvent,
)
from .validator import EventValidator


class OrderReplayEngine:
    def __init__(self, config: AppConfig, validator: EventValidator):
        self.config = config
        self.validator = validator
        self._orders: Dict[str, OrderReplayState] = {}
        self._seen_event_ids: set = set()

    def process_event(self, event: Event) -> OrderReplayState:
        if event.event_id in self._seen_event_ids:
            order_id = event.order_id or f"unknown_{event.cabinet_id}"
            if order_id in self._orders:
                state = self._orders[order_id]
                state.replay_notes.append(f"跳过重复事件: {event.event_id}")
                return state

        self._seen_event_ids.add(event.event_id)

        order_id = event.order_id
        if not order_id:
            order_id = f"temp_{event.cabinet_id}_{event.timestamp.strftime('%Y%m%d%H%M%S')}"

        if order_id not in self._orders:
            self._orders[order_id] = OrderReplayState(
                order_id=order_id,
                cabinet_id=event.cabinet_id,
                status=OrderStatus.OPEN,
                first_seen_at=event.timestamp,
            )

        state = self._orders[order_id]
        state.events.append(event)

        if state.first_seen_at is None or event.timestamp < state.first_seen_at:
            state.first_seen_at = event.timestamp
        if state.last_seen_at is None or event.timestamp > state.last_seen_at:
            state.last_seen_at = event.timestamp

        if isinstance(event, DoorOpenEvent):
            self._process_door_open(state, event)
        elif isinstance(event, DoorCloseEvent):
            self._process_door_close(state, event)
        elif isinstance(event, ItemTakeEvent):
            self._process_item_take(state, event)
        elif isinstance(event, ItemReturnEvent):
            self._process_item_return(state, event)
        elif isinstance(event, WeightSampleEvent):
            self._process_weight_sample(state, event)
        elif isinstance(event, PaymentCallbackEvent):
            self._process_payment_callback(state, event)
        elif isinstance(event, ManualCorrectionEvent):
            self._process_manual_correction(state, event)

        self._update_order_status(state)
        self._update_order_amounts(state)

        return state

    def _process_door_open(self, state: OrderReplayState, event: DoorOpenEvent):
        state.replay_notes.append(f"开门事件: {event.timestamp}")

    def _process_door_close(self, state: OrderReplayState, event: DoorCloseEvent):
        state.replay_notes.append(f"关门事件: {event.timestamp}")

    def _process_item_take(self, state: OrderReplayState, event: ItemTakeEvent):
        state.item_takes.append(event)
        state.replay_notes.append(
            f"取货事件: SKU={event.sku_id}, 数量={event.quantity}, 识别方式={event.recognized_by}"
        )

    def _process_item_return(self, state: OrderReplayState, event: ItemReturnEvent):
        state.item_returns.append(event)
        state.replay_notes.append(
            f"归还事件: SKU={event.sku_id}, 数量={event.quantity}"
        )

    def _process_weight_sample(self, state: OrderReplayState, event: WeightSampleEvent):
        state.replay_notes.append(
            f"称重采样: 变化前={event.total_weight_before}g, 变化后={event.total_weight_after}g"
        )

        net_takes = self._calculate_net_takes(state)
        weight_validation = self.validator.validate_weight_and_quantity_match(
            net_takes, event
        )
        for warning in weight_validation.warnings:
            state.replay_notes.append(f"⚠️ 称重警告: {warning}")

    def _process_payment_callback(self, state: OrderReplayState, event: PaymentCallbackEvent):
        state.payment_events.append(event)
        if event.payment_status == "success":
            state.replay_notes.append(
                f"支付成功: 单号={event.payment_id}, 金额={event.amount}元"
            )
        else:
            state.replay_notes.append(
                f"支付回调: 状态={event.payment_status}, 金额={event.amount}元"
            )

    def _process_manual_correction(self, state: OrderReplayState, event: ManualCorrectionEvent):
        state.manual_corrections.append(event)
        state.has_manual_override = True
        state.replay_notes.append(
            f"人工补录: 原因={event.reason}, 覆盖AI={event.override_ai}"
        )
        for change in event.item_changes:
            state.replay_notes.append(
                f"  - 商品变更: SKU={change.sku_id}, 数量={change.quantity}, 单价={change.unit_price}"
            )

    def _calculate_net_takes(self, state: OrderReplayState) -> List[ItemTakeEvent]:
        if state.has_manual_override:
            results = []
            for correction in state.manual_corrections:
                for change in correction.item_changes:
                    if change.quantity > 0:
                        results.append(ItemTakeEvent(
                            event_id=f"manual_{correction.event_id}_{change.sku_id}",
                            event_type=EventType.ITEM_TAKE,
                            cabinet_id=state.cabinet_id,
                            order_id=state.order_id,
                            timestamp=correction.timestamp,
                            raw_data=correction.raw_data,
                            sku_id=change.sku_id,
                            channel_id=change.channel_id,
                            quantity=change.quantity,
                            recognized_by="manual",
                        ))
            return results
        else:
            return state.item_takes

    def _update_order_status(self, state: OrderReplayState):
        has_open = any(isinstance(e, DoorOpenEvent) for e in state.events)
        has_close = any(isinstance(e, DoorCloseEvent) for e in state.events)
        has_successful_payment = any(
            isinstance(e, PaymentCallbackEvent) and e.payment_status == "success"
            for e in state.payment_events
        )

        if has_successful_payment:
            state.status = OrderStatus.PAID
        elif has_close:
            state.status = OrderStatus.CLOSED
        elif has_open:
            state.status = OrderStatus.OPEN

        if state.has_manual_override and has_successful_payment:
            state.status = OrderStatus.PAID

        if not has_close and state.payment_events:
            state.replay_notes.append("⚠️ 订单有支付但未关门，可能异常")

    def _update_order_amounts(self, state: OrderReplayState):
        if state.has_manual_override:
            state.total_amount = 0.0
            for correction in state.manual_corrections:
                for change in correction.item_changes:
                    state.total_amount += change.unit_price * change.quantity
        else:
            state.total_amount = 0.0
            for take in state.item_takes:
                sku = self.config.get_sku(take.sku_id)
                if sku:
                    state.total_amount += sku.price * take.quantity
            for ret in state.item_returns:
                sku = self.config.get_sku(ret.sku_id)
                if sku:
                    state.total_amount -= sku.price * ret.quantity

        state.paid_amount = sum(
            p.amount
            for p in state.payment_events
            if p.payment_status == "success"
        )

    def get_all_orders(self) -> List[OrderReplayState]:
        return list(self._orders.values())

    def get_order(self, order_id: str) -> Optional[OrderReplayState]:
        return self._orders.get(order_id)

    def get_orders_by_cabinet(self, cabinet_id: str) -> List[OrderReplayState]:
        return [o for o in self._orders.values() if o.cabinet_id == cabinet_id]

    def get_events_with_cabinet_key(
        self, events: List[Event]
    ) -> Dict[str, Dict[str, OrderReplayState]]:
        result: Dict[str, Dict[str, OrderReplayState]] = defaultdict(dict)
        for event in events:
            state = self.process_event(event)
            result[state.cabinet_id][state.order_id] = state
        return result

    def build_replay_results(
        self, events: List[Event], dry_run: bool = True
    ) -> Dict[str, any]:
        self._orders.clear()
        self._seen_event_ids.clear()

        sorted_events = sorted(events, key=lambda e: e.timestamp)
        for event in sorted_events:
            self.process_event(event)

        orders = self.get_all_orders()
        total_events = len(sorted_events)
        unique_orders = len(orders)
        paid_orders = sum(1 for o in orders if o.status == OrderStatus.PAID)
        open_orders = sum(1 for o in orders if o.status == OrderStatus.OPEN)
        disputed_orders = sum(1 for o in orders if o.status == OrderStatus.DISPUTED)

        total_expected = sum(o.total_amount for o in orders)
        total_paid = sum(o.paid_amount for o in orders)

        issues = []
        for order in orders:
            if order.status == OrderStatus.OPEN and order.payment_events:
                issues.append({
                    "order_id": order.order_id,
                    "cabinet_id": order.cabinet_id,
                    "issue": "有支付但订单未关闭",
                    "details": f"有 {len(order.payment_events)} 个支付事件但未找到关门事件",
                })

            if order.total_amount != order.paid_amount and order.status == OrderStatus.PAID:
                issues.append({
                    "order_id": order.order_id,
                    "cabinet_id": order.cabinet_id,
                    "issue": "支付金额不匹配",
                    "details": f"预期 {order.total_amount:.2f} 元, 实际支付 {order.paid_amount:.2f} 元",
                })

            if order.has_manual_override:
                issues.append({
                    "order_id": order.order_id,
                    "cabinet_id": order.cabinet_id,
                    "issue": "人工补录覆盖",
                    "details": f"订单包含 {len(order.manual_corrections)} 条人工补录记录",
                })

        return {
            "dry_run": dry_run,
            "statistics": {
                "total_events": total_events,
                "unique_orders": unique_orders,
                "paid_orders": paid_orders,
                "open_orders": open_orders,
                "disputed_orders": disputed_orders,
                "total_expected_amount": total_expected,
                "total_paid_amount": total_paid,
            },
            "issues": issues,
            "orders": [
                {
                    "order_id": o.order_id,
                    "cabinet_id": o.cabinet_id,
                    "status": o.status.value,
                    "total_amount": o.total_amount,
                    "paid_amount": o.paid_amount,
                    "event_count": len(o.events),
                    "has_manual_override": o.has_manual_override,
                    "first_seen": o.first_seen_at.isoformat() if o.first_seen_at else None,
                    "last_seen": o.last_seen_at.isoformat() if o.last_seen_at else None,
                    "notes": o.replay_notes,
                }
                for o in orders
            ],
        }
