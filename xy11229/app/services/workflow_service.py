import uuid
import json
import csv
from datetime import datetime
from typing import Optional, List, Dict, Any
from io import StringIO

from app.models.models import (
    ServiceOrder, DispatchRecord, ReviewRecord,
    OrderStatus, EventType
)
from app.models.storage import storage
from app.utils.sensitive import mask_sensitive_data


def receive_order(
    order_id: str,
    station_id: str,
    problem_description: str,
    report_time: datetime,
    customer_name: Optional[str] = None,
    customer_phone: Optional[str] = None,
    device_id: Optional[str] = None,
    source: str = "customer_service",
    idempotency_key: Optional[str] = None
) -> tuple:
    if idempotency_key:
        existing_order_id = storage.check_idempotency(idempotency_key)
        if existing_order_id:
            existing_order = storage.get_service_order(existing_order_id)
            return existing_order, False
    
    existing_order = storage.get_service_order(order_id)
    if existing_order:
        return existing_order, False
    
    order = ServiceOrder(
        order_id=order_id,
        customer_name=customer_name,
        customer_phone=customer_phone,
        station_id=station_id,
        device_id=device_id,
        problem_description=problem_description,
        report_time=report_time,
        source=source,
        status=OrderStatus.RECEIVED
    )
    
    storage.add_service_order(order)
    
    if idempotency_key:
        storage.set_idempotency(idempotency_key, order_id)
    
    return order, True


def attribute_order(
    order_id: str,
    attributed_type: str,
    attributed_reason: str,
    idempotency_key: Optional[str] = None
) -> tuple:
    if idempotency_key:
        existing_result = storage.check_idempotency(idempotency_key)
        if existing_result:
            order = storage.get_service_order(order_id)
            return order, False
    
    order = storage.get_service_order(order_id)
    if not order:
        return None, False
    
    if order.status == OrderStatus.ATTRIBUTED:
        return order, False
    
    event_type = EventType(attributed_type) if attributed_type in [e.value for e in EventType] else EventType.OTHER
    
    order.attributed_type = event_type
    order.attributed_reason = attributed_reason
    order.status = OrderStatus.ATTRIBUTED
    order.updated_at = datetime.now()
    
    storage.update_service_order(order)
    
    if idempotency_key:
        storage.set_idempotency(idempotency_key, order_id)
    
    return order, True


def dispatch_repair(
    order_id: str,
    technician_id: str,
    technician_name: Optional[str] = None,
    technician_phone: Optional[str] = None,
    estimated_arrival_time: Optional[datetime] = None,
    notes: Optional[str] = None,
    idempotency_key: Optional[str] = None
) -> tuple:
    if idempotency_key:
        existing_dispatch_id = storage.check_idempotency(idempotency_key)
        if existing_dispatch_id:
            existing_dispatch = storage.get_dispatch_record(existing_dispatch_id)
            if existing_dispatch:
                return existing_dispatch, False
    
    order = storage.get_service_order(order_id)
    if not order:
        return None, False
    
    existing_dispatches = storage.get_dispatch_records_by_order(order_id)
    for d in existing_dispatches:
        if d.status in ['pending', 'in_progress']:
            return d, False
    
    dispatch_id = f"dispatch_{uuid.uuid4().hex[:8]}"
    dispatch = DispatchRecord(
        dispatch_id=dispatch_id,
        order_id=order_id,
        technician_id=technician_id,
        technician_name=technician_name,
        technician_phone=technician_phone,
        dispatch_time=datetime.now(),
        estimated_arrival_time=estimated_arrival_time,
        status='pending',
        notes=notes
    )
    
    storage.add_dispatch_record(dispatch)
    
    order.status = OrderStatus.DISPATCHED
    order.updated_at = datetime.now()
    storage.update_service_order(order)
    
    if idempotency_key:
        storage.set_idempotency(idempotency_key, dispatch_id)
    
    return dispatch, True


def review_order(
    order_id: str,
    reviewer_id: str,
    reviewer_name: Optional[str] = None,
    review_result: str = "pass",
    review_notes: Optional[str] = None,
    is_verified: bool = False,
    idempotency_key: Optional[str] = None
) -> tuple:
    if idempotency_key:
        existing_review_id = storage.check_idempotency(idempotency_key)
        if existing_review_id:
            existing_review = storage.get_review_record(existing_review_id)
            if existing_review:
                return existing_review, False
    
    order = storage.get_service_order(order_id)
    if not order:
        return None, False
    
    existing_reviews = storage.get_review_records_by_order(order_id)
    for r in existing_reviews:
        if r.is_verified:
            return r, False
    
    review_id = f"review_{uuid.uuid4().hex[:8]}"
    review = ReviewRecord(
        review_id=review_id,
        order_id=order_id,
        reviewer_id=reviewer_id,
        reviewer_name=reviewer_name,
        review_time=datetime.now(),
        review_result=review_result,
        review_notes=review_notes,
        is_verified=is_verified
    )
    
    storage.add_review_record(review)
    
    if is_verified:
        order.status = OrderStatus.REVIEWED
        order.updated_at = datetime.now()
        storage.update_service_order(order)
    
    if idempotency_key:
        storage.set_idempotency(idempotency_key, review_id)
    
    return review, True


def export_orders(
    format: str = "csv",
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> str:
    orders = storage.get_all_service_orders()
    
    if status:
        orders = [o for o in orders if o.status.value == status]
    
    if start_date:
        orders = [o for o in orders if o.created_at >= start_date]
    
    if end_date:
        orders = [o for o in orders if o.created_at <= end_date]
    
    masked_orders = []
    for order in orders:
        order_dict = order.model_dump()
        order_dict = mask_sensitive_data(order_dict)
        masked_orders.append(order_dict)
    
    if format.lower() == "json":
        return json.dumps(masked_orders, ensure_ascii=False, default=str, indent=2)
    else:
        output = StringIO()
        if masked_orders:
            fieldnames = list(masked_orders[0].keys())
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            for order in masked_orders:
                writer.writerow(order)
        return output.getvalue()


def get_order_details(order_id: str) -> Optional[Dict[str, Any]]:
    order = storage.get_service_order(order_id)
    if not order:
        return None
    
    dispatches = storage.get_dispatch_records_by_order(order_id)
    reviews = storage.get_review_records_by_order(order_id)
    
    order_dict = order.model_dump()
    order_dict = mask_sensitive_data(order_dict)
    
    dispatches_dict = [mask_sensitive_data(d.model_dump()) for d in dispatches]
    reviews_dict = [mask_sensitive_data(r.model_dump()) for r in reviews]
    
    return {
        "order": order_dict,
        "dispatches": dispatches_dict,
        "reviews": reviews_dict
    }
