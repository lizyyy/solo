"""排炉调度算法 - 考虑烤箱容量、醒发时间和配送窗口约束"""
from datetime import datetime, time, timedelta
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import uuid

from .database import Database
from .models import (
    Order, Product, Oven, DeliveryWindow, OrderStatus, ScheduleStatus,
    ProofingSchedule, BakingSchedule, Anomaly, ScheduledDelivery
)


@dataclass
class OvenTimeSlot:
    start: datetime
    end: datetime
    available_units: int


@dataclass
class SchedulingResult:
    scheduled_count: int = 0
    failed_count: int = 0
    warnings: List[str] = None
    scheduled_deliveries: List[ScheduledDelivery] = None

    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []
        if self.scheduled_deliveries is None:
            self.scheduled_deliveries = []


class ProductionScheduler:
    def __init__(self, db: Database, schedule_date: Optional[datetime] = None):
        self.db = db
        self.schedule_date = schedule_date or datetime.now()
        self.products: Dict[str, Product] = {}
        self.ovens: Dict[str, Oven] = {}
        self.delivery_windows: Dict[str, DeliveryWindow] = {}
        self.oven_schedules: Dict[str, List[OvenTimeSlot]] = {}
        self._load_reference_data()

    def _load_reference_data(self):
        for p in self.db.get_all_products():
            self.products[p.product_id] = p
        for o in self.db.get_all_ovens():
            self.ovens[o.oven_id] = o
            self.oven_schedules[o.oven_id] = []
        for w in self.db.get_all_delivery_windows():
            self.delivery_windows[w.window_id] = w

    def _generate_id(self, prefix: str) -> str:
        return f"{prefix}-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    def _create_anomaly(self, order_id: str, anomaly_type: str, description: str):
        anomaly = Anomaly(
            anomaly_id=self._generate_id("ANM"),
            order_id=order_id,
            anomaly_type=anomaly_type,
            description=description
        )
        self.db.create_anomaly(anomaly)

    def _combine_datetime(self, base_date: datetime, t: time) -> datetime:
        return datetime.combine(base_date.date(), t)

    def _calculate_earliest_start(self, order: Order, product: Product) -> datetime:
        window = self.delivery_windows[order.delivery_window_id]
        delivery_start = self._combine_datetime(self.schedule_date, window.start_time)
        latest_baking_end = delivery_start - timedelta(minutes=10)
        latest_proofing_end = latest_baking_end
        latest_proofing_start = latest_proofing_end - timedelta(minutes=product.proofing_time_minutes)
        
        earliest_oven_available = None
        for oven in self.ovens.values():
            oven_start = self._combine_datetime(self.schedule_date, oven.available_from)
            if earliest_oven_available is None or oven_start < earliest_oven_available:
                earliest_oven_available = oven_start
        
        return earliest_oven_available or datetime.combine(self.schedule_date.date(), time(4, 0))

    def _find_oven_slot(self, order: Order, product: Product, 
                       proofing_end: datetime) -> Optional[Tuple[str, datetime, datetime]]:
        window = self.delivery_windows[order.delivery_window_id]
        delivery_start = self._combine_datetime(self.schedule_date, window.start_time)
        baking_duration = timedelta(minutes=product.baking_time_minutes)
        required_units = product.oven_capacity_units * order.quantity
        
        for oven_id, oven in self.ovens.items():
            oven_start = self._combine_datetime(self.schedule_date, oven.available_from)
            oven_end = self._combine_datetime(self.schedule_date, oven.available_to)
            
            search_start = max(proofing_end, oven_start)
            search_end = min(delivery_start - timedelta(minutes=10), oven_end)
            
            if search_start >= search_end:
                continue
            
            slot = self._find_first_available_slot(
                oven_id, search_start, search_end, 
                baking_duration, required_units, oven.max_capacity_units
            )
            
            if slot:
                return oven_id, slot.start, slot.end
        
        return None

    def _find_first_available_slot(self, oven_id: str, search_start: datetime,
                                   search_end: datetime, duration: timedelta,
                                   required_units: int, max_units: int) -> Optional[OvenTimeSlot]:
        schedules = self.oven_schedules.get(oven_id, [])
        
        if not schedules:
            if required_units <= max_units:
                return OvenTimeSlot(search_start, search_start + duration, max_units - required_units)
            return None
        
        candidate_start = search_start
        
        while candidate_start + duration <= search_end:
            candidate_end = candidate_start + duration
            can_fit = True
            remaining_units = max_units
            
            for slot in schedules:
                if slot.start < candidate_end and slot.end > candidate_start:
                    remaining_units -= (max_units - slot.available_units)
                    if remaining_units < required_units:
                        can_fit = False
                        break
            
            if can_fit and remaining_units >= required_units:
                return OvenTimeSlot(candidate_start, candidate_end, remaining_units - required_units)
            
            candidate_start += timedelta(minutes=5)
        
        return None

    def _reserve_oven_slot(self, oven_id: str, slot: OvenTimeSlot):
        if oven_id not in self.oven_schedules:
            self.oven_schedules[oven_id] = []
        self.oven_schedules[oven_id].append(slot)

    def schedule_order(self, order: Order) -> Tuple[bool, Optional[str]]:
        if order.product_id not in self.products:
            self._create_anomaly(
                order.order_id, "product_missing",
                f"产品不存在: {order.product_id}"
            )
            return False, "产品不存在"
        
        if order.delivery_window_id not in self.delivery_windows:
            self._create_anomaly(
                order.order_id, "window_missing",
                f"配送窗口不存在: {order.delivery_window_id}"
            )
            return False, "配送窗口不存在"
        
        product = self.products[order.product_id]
        window = self.delivery_windows[order.delivery_window_id]
        
        total_units_needed = product.oven_capacity_units * order.quantity
        max_oven_capacity = max(o.max_capacity_units for o in self.ovens.values())
        
        if total_units_needed > max_oven_capacity:
            self._create_anomaly(
                order.order_id, "capacity_exceeded",
                f"订单容量需求({total_units_needed}单位)超过最大烤箱容量({max_oven_capacity}单位)"
            )
            return False, "订单容量超过最大烤箱"
        
        proofing_duration = timedelta(minutes=product.proofing_time_minutes)
        baking_duration = timedelta(minutes=product.baking_time_minutes)
        window_start = self._combine_datetime(self.schedule_date, window.start_time)
        
        latest_baking_end = window_start - timedelta(minutes=10)
        latest_baking_start = latest_baking_end - baking_duration
        latest_proofing_end = latest_baking_start
        latest_proofing_start = latest_proofing_end - proofing_duration
        
        earliest_start = self._calculate_earliest_start(order, product)
        
        proofing_start = max(earliest_start, latest_proofing_start - timedelta(hours=2))
        proofing_end = proofing_start + proofing_duration
        
        oven_result = None
        attempts = 0
        max_attempts = 24
        
        while attempts < max_attempts and proofing_end <= latest_proofing_end:
            oven_result = self._find_oven_slot(order, product, proofing_end)
            if oven_result:
                break
            proofing_start += timedelta(minutes=15)
            proofing_end = proofing_start + proofing_duration
            attempts += 1
        
        if not oven_result:
            self._create_anomaly(
                order.order_id, "scheduling_failed",
                f"无法安排订单: 产品={product.name}, 数量={order.quantity}, "
                f"配送窗口={window.description}。请考虑拆分订单或调整配送窗口。"
            )
            return False, "无法安排生产时间"
        
        oven_id, baking_start, baking_end = oven_result
        
        self.db.delete_proofing_schedules_for_order(order.order_id)
        self.db.delete_baking_schedules_for_order(order.order_id)
        
        proofing_schedule = ProofingSchedule(
            schedule_id=self._generate_id("PRF"),
            order_id=order.order_id,
            proofing_start=proofing_start,
            proofing_end=proofing_end,
            status=ScheduleStatus.CONFIRMED
        )
        self.db.create_proofing_schedule(proofing_schedule)
        
        baking_slot = OvenTimeSlot(baking_start, baking_end, 0)
        self._reserve_oven_slot(oven_id, baking_slot)
        
        baking_schedule = BakingSchedule(
            schedule_id=self._generate_id("BAK"),
            order_id=order.order_id,
            oven_id=oven_id,
            baking_start=baking_start,
            baking_end=baking_end,
            units_used=total_units_needed,
            status=ScheduleStatus.CONFIRMED
        )
        self.db.create_baking_schedule(baking_schedule)
        
        self.db.update_order_status(order.order_id, OrderStatus.PROOFING)
        
        return True, None

    def run_scheduling(self, orders: Optional[List[Order]] = None) -> SchedulingResult:
        result = SchedulingResult()
        
        if orders is None:
            orders = self.db.get_orders_by_status(OrderStatus.PENDING)
        
        sorted_orders = sorted(
            orders,
            key=lambda o: (
                -o.priority,
                self.delivery_windows[o.delivery_window_id].start_time 
                if o.delivery_window_id in self.delivery_windows else time(23, 59)
            )
        )
        
        for order in sorted_orders:
            success, message = self.schedule_order(order)
            if success:
                result.scheduled_count += 1
                product = self.products[order.product_id]
                window = self.delivery_windows[order.delivery_window_id]
                
                proofing_sched = self.db.get_proofing_schedules(order.order_id)
                baking_sched = self.db.get_baking_schedules(order.order_id)
                
                if proofing_sched and baking_sched:
                    delivery = ScheduledDelivery(
                        order_id=order.order_id,
                        product_name=product.name,
                        quantity=order.quantity,
                        customer_name=order.customer_name,
                        proofing_start=proofing_sched[0].proofing_start,
                        proofing_end=proofing_sched[0].proofing_end,
                        oven_id=baking_sched[0].oven_id,
                        baking_start=baking_sched[0].baking_start,
                        baking_end=baking_sched[0].baking_end,
                        delivery_window=window.description,
                        status="已安排"
                    )
                    result.scheduled_deliveries.append(delivery)
            else:
                result.failed_count += 1
                self.db.update_order_status(order.order_id, OrderStatus.ERROR, message)
                result.warnings.append(f"订单 {order.order_id}: {message}")
        
        return result

    def reschedule_all(self) -> SchedulingResult:
        self.db.clear_all_schedules()
        
        for order in self.db.get_all_orders():
            if order.status in [OrderStatus.PROOFING, OrderStatus.BAKING, OrderStatus.READY, OrderStatus.ERROR]:
                self.db.update_order_status(order.order_id, OrderStatus.PENDING)
        
        for oven_id in self.oven_schedules:
            self.oven_schedules[oven_id] = []
        
        return self.run_scheduling()

    def get_oven_utilization(self) -> Dict[str, Dict]:
        utilization = {}
        for oven_id, oven in self.ovens.items():
            schedules = self.db.get_baking_schedules()
            oven_schedules = [s for s in schedules if s.oven_id == oven_id]
            
            total_time = 0
            total_units = 0
            for s in oven_schedules:
                duration = (s.baking_end - s.baking_start).total_seconds() / 60
                total_time += duration
                total_units += s.units_used
            
            oven_available = self._combine_datetime(self.schedule_date, oven.available_from)
            oven_until = self._combine_datetime(self.schedule_date, oven.available_to)
            max_minutes = (oven_until - oven_available).total_seconds() / 60
            
            utilization[oven_id] = {
                'name': oven.name,
                'max_capacity': oven.max_capacity_units,
                'scheduled_count': len(oven_schedules),
                'total_baking_minutes': int(total_time),
                'utilization_percent': round((total_time / max_minutes * 100), 1) if max_minutes > 0 else 0,
                'total_units_used': total_units
            }
        return utilization
