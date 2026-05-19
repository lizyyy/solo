from typing import Dict, List, Optional
from .models import (
    DeviceEvent, ServiceOrder, DispatchRecord, 
    ReviewRecord, BadRecord, WorkOrderStats
)


class InMemoryStorage:
    def __init__(self):
        self.device_events: Dict[str, DeviceEvent] = {}
        self.service_orders: Dict[str, ServiceOrder] = {}
        self.dispatch_records: Dict[str, DispatchRecord] = {}
        self.review_records: Dict[str, ReviewRecord] = {}
        self.bad_records: Dict[str, BadRecord] = {}
        self.idempotency_keys: Dict[str, str] = {}
    
    def add_device_event(self, event: DeviceEvent) -> bool:
        if event.event_id in self.device_events:
            return False
        self.device_events[event.event_id] = event
        return True
    
    def get_device_event(self, event_id: str) -> Optional[DeviceEvent]:
        return self.device_events.get(event_id)
    
    def get_all_device_events(self) -> List[DeviceEvent]:
        return list(self.device_events.values())
    
    def add_service_order(self, order: ServiceOrder) -> bool:
        if order.order_id in self.service_orders:
            return False
        self.service_orders[order.order_id] = order
        return True
    
    def get_service_order(self, order_id: str) -> Optional[ServiceOrder]:
        return self.service_orders.get(order_id)
    
    def get_all_service_orders(self) -> List[ServiceOrder]:
        return list(self.service_orders.values())
    
    def update_service_order(self, order: ServiceOrder) -> bool:
        if order.order_id not in self.service_orders:
            return False
        self.service_orders[order.order_id] = order
        return True
    
    def add_dispatch_record(self, record: DispatchRecord) -> bool:
        if record.dispatch_id in self.dispatch_records:
            return False
        self.dispatch_records[record.dispatch_id] = record
        return True
    
    def get_dispatch_record(self, dispatch_id: str) -> Optional[DispatchRecord]:
        return self.dispatch_records.get(dispatch_id)
    
    def get_dispatch_records_by_order(self, order_id: str) -> List[DispatchRecord]:
        return [r for r in self.dispatch_records.values() if r.order_id == order_id]
    
    def get_all_dispatch_records(self) -> List[DispatchRecord]:
        return list(self.dispatch_records.values())
    
    def add_review_record(self, record: ReviewRecord) -> bool:
        if record.review_id in self.review_records:
            return False
        self.review_records[record.review_id] = record
        return True
    
    def get_review_record(self, review_id: str) -> Optional[ReviewRecord]:
        return self.review_records.get(review_id)
    
    def get_review_records_by_order(self, order_id: str) -> List[ReviewRecord]:
        return [r for r in self.review_records.values() if r.order_id == order_id]
    
    def get_all_review_records(self) -> List[ReviewRecord]:
        return list(self.review_records.values())
    
    def add_bad_record(self, record: BadRecord) -> None:
        self.bad_records[record.id] = record
    
    def get_all_bad_records(self) -> List[BadRecord]:
        return list(self.bad_records.values())
    
    def get_bad_record(self, record_id: str) -> Optional[BadRecord]:
        return self.bad_records.get(record_id)
    
    def check_idempotency(self, key: str) -> Optional[str]:
        return self.idempotency_keys.get(key)
    
    def set_idempotency(self, key: str, value: str) -> None:
        self.idempotency_keys[key] = value
    
    def get_stats(self) -> WorkOrderStats:
        stats = WorkOrderStats(total=len(self.service_orders))
        for order in self.service_orders.values():
            if hasattr(stats, order.status.value):
                setattr(stats, order.status.value, getattr(stats, order.status.value) + 1)
        return stats
    
    def clear_all(self) -> None:
        self.device_events.clear()
        self.service_orders.clear()
        self.dispatch_records.clear()
        self.review_records.clear()
        self.bad_records.clear()
        self.idempotency_keys.clear()


storage = InMemoryStorage()
