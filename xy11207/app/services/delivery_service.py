from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models import (
    DeliveryOrder, DeliveryItem, TemperatureRecord, DeliveryPhoto,
    AnomalyRecord, DeliveryStatus, AnomalyType
)
from app.schemas import DeliveryOrderQuery, BatchOperationResult


class DeliveryService:
    def __init__(self, db: Session):
        self.db = db

    def get_delivery_order(self, order_id: int) -> Optional[DeliveryOrder]:
        return self.db.query(DeliveryOrder).filter(DeliveryOrder.id == order_id).first()

    def get_delivery_order_by_number(self, order_number: str) -> Optional[DeliveryOrder]:
        return self.db.query(DeliveryOrder).filter(DeliveryOrder.order_number == order_number).first()

    def query_delivery_orders(self, query_params: DeliveryOrderQuery) -> Dict[str, Any]:
        query = self.db.query(DeliveryOrder)

        if query_params.received_by:
            query = query.filter(DeliveryOrder.received_by == query_params.received_by)

        if query_params.start_date:
            query = query.filter(DeliveryOrder.delivery_date >= query_params.start_date)

        if query_params.end_date:
            query = query.filter(DeliveryOrder.delivery_date <= query_params.end_date)

        if query_params.status:
            query = query.filter(DeliveryOrder.status == query_params.status)

        if query_params.supplier_name:
            query = query.filter(DeliveryOrder.supplier_name.contains(query_params.supplier_name))

        if query_params.has_anomaly is not None:
            if query_params.has_anomaly:
                query = query.filter(DeliveryOrder.anomaly_count > 0)
            else:
                query = query.filter(DeliveryOrder.anomaly_count == 0)

        if query_params.anomaly_type:
            query = query.join(AnomalyRecord).filter(AnomalyRecord.anomaly_type == query_params.anomaly_type)

        total = query.count()

        orders = query.order_by(DeliveryOrder.delivery_date.desc()).offset(
            (query_params.page - 1) * query_params.page_size
        ).limit(query_params.page_size).all()

        return {
            "total": total,
            "page": query_params.page,
            "page_size": query_params.page_size,
            "items": orders
        }

    def update_status(self, order_id: int, new_status: DeliveryStatus,
                      updated_by: str = None) -> DeliveryOrder:
        order = self.get_delivery_order(order_id)
        if not order:
            raise ValueError("到货单不存在")

        valid_transitions = {
            DeliveryStatus.PENDING: [DeliveryStatus.IN_PROGRESS, DeliveryStatus.REJECTED],
            DeliveryStatus.IN_PROGRESS: [DeliveryStatus.RECEIVED, DeliveryStatus.REJECTED],
            DeliveryStatus.RECEIVED: [DeliveryStatus.INSPECTED, DeliveryStatus.REJECTED],
            DeliveryStatus.INSPECTED: [DeliveryStatus.COMPLETED],
            DeliveryStatus.COMPLETED: [],
            DeliveryStatus.REJECTED: []
        }

        if new_status not in valid_transitions.get(order.status, []):
            raise ValueError(f"无法从 {order.status.value} 转换到 {new_status.value}")

        order.status = new_status

        if new_status == DeliveryStatus.RECEIVED:
            order.received_by = updated_by
            order.received_at = datetime.now()

        self.db.commit()
        return order

    def batch_update_status(self, order_ids: List[int], new_status: DeliveryStatus,
                             updated_by: str = None) -> BatchOperationResult:
        success_count = 0
        failed_count = 0
        successful_ids = []
        failed_details = []

        for order_id in order_ids:
            try:
                self.update_status(order_id, new_status, updated_by)
                success_count += 1
                successful_ids.append(order_id)
            except Exception as e:
                failed_count += 1
                failed_details.append({
                    "id": order_id,
                    "error": str(e)
                })

        return BatchOperationResult(
            total=len(order_ids),
            success_count=success_count,
            failed_count=failed_count,
            successful_ids=successful_ids,
            failed_details=failed_details
        )

    def receive_order(self, order_id: int, received_by: str) -> DeliveryOrder:
        return self.update_status(order_id, DeliveryStatus.RECEIVED, received_by)

    def inspect_order(self, order_id: int, inspected_by: str) -> DeliveryOrder:
        return self.update_status(order_id, DeliveryStatus.INSPECTED, inspected_by)

    def complete_order(self, order_id: int) -> DeliveryOrder:
        return self.update_status(order_id, DeliveryStatus.COMPLETED)

    def reject_order(self, order_id: int, reason: str) -> DeliveryOrder:
        order = self.update_status(order_id, DeliveryStatus.REJECTED)
        order.remarks = reason
        self.db.commit()
        return order

    def add_anomaly(self, order_id: int, anomaly_type: AnomalyType,
                     description: str, reported_by: str = None) -> AnomalyRecord:
        order = self.get_delivery_order(order_id)
        if not order:
            raise ValueError("到货单不存在")

        anomaly = AnomalyRecord(
            delivery_order_id=order_id,
            anomaly_type=anomaly_type,
            description=description,
            reported_by=reported_by,
            severity="medium"
        )
        self.db.add(anomaly)
        self.db.flush()

        order.anomaly_count += 1
        self.db.commit()

        return anomaly

    def resolve_anomaly(self, anomaly_id: int, resolved_by: str,
                         resolution: str) -> AnomalyRecord:
        anomaly = self.db.query(AnomalyRecord).filter(AnomalyRecord.id == anomaly_id).first()
        if not anomaly:
            raise ValueError("异常记录不存在")

        anomaly.status = "resolved"
        anomaly.resolved_by = resolved_by
        anomaly.resolved_at = datetime.now()
        anomaly.resolution = resolution

        order = anomaly.delivery_order
        if order:
            open_anomalies = self.db.query(AnomalyRecord).filter(
                and_(AnomalyRecord.delivery_order_id == order.id, AnomalyRecord.status == "open")
            ).count()
            order.anomaly_count = open_anomalies

        self.db.commit()
        return anomaly

    def get_order_items(self, order_id: int) -> List[DeliveryItem]:
        return self.db.query(DeliveryItem).filter(DeliveryItem.delivery_order_id == order_id).all()

    def get_temperature_records(self, order_id: int) -> List[TemperatureRecord]:
        return self.db.query(TemperatureRecord).filter(
            TemperatureRecord.delivery_order_id == order_id
        ).order_by(TemperatureRecord.record_time).all()

    def get_photos(self, order_id: int) -> List[DeliveryPhoto]:
        return self.db.query(DeliveryPhoto).filter(DeliveryPhoto.delivery_order_id == order_id).all()

    def get_anomalies(self, order_id: int) -> List[AnomalyRecord]:
        return self.db.query(AnomalyRecord).filter(AnomalyRecord.delivery_order_id == order_id).all()

    def inspect_item(self, item_id: int, inspected_by: str, result: str,
                      remarks: str = None) -> DeliveryItem:
        item = self.db.query(DeliveryItem).filter(DeliveryItem.id == item_id).first()
        if not item:
            raise ValueError("货品不存在")

        item.is_inspected = True
        item.inspected_by = inspected_by
        item.inspected_at = datetime.now()
        item.inspection_result = result
        item.remarks = remarks

        self.db.commit()
        return item

    def batch_inspect_items(self, item_ids: List[int], inspected_by: str,
                             result: str) -> BatchOperationResult:
        success_count = 0
        failed_count = 0
        successful_ids = []
        failed_details = []

        for item_id in item_ids:
            try:
                self.inspect_item(item_id, inspected_by, result)
                success_count += 1
                successful_ids.append(item_id)
            except Exception as e:
                failed_count += 1
                failed_details.append({
                    "id": item_id,
                    "error": str(e)
                })

        return BatchOperationResult(
            total=len(item_ids),
            success_count=success_count,
            failed_count=failed_count,
            successful_ids=successful_ids,
            failed_details=failed_details
        )

    def get_order_summary(self, order_id: int) -> Dict[str, Any]:
        order = self.get_delivery_order(order_id)
        if not order:
            raise ValueError("到货单不存在")

        items = self.get_order_items(order_id)
        temperature_records = self.get_temperature_records(order_id)
        photos = self.get_photos(order_id)
        anomalies = self.get_anomalies(order_id)

        inspected_count = sum(1 for item in items if item.is_inspected)
        temp_anomaly_count = sum(1 for temp in temperature_records if temp.is_anomaly)

        return {
            "order": order,
            "total_items": len(items),
            "inspected_count": inspected_count,
            "temperature_records_count": len(temperature_records),
            "temperature_anomaly_count": temp_anomaly_count,
            "photos_count": len(photos),
            "anomalies_count": len(anomalies),
            "open_anomalies_count": sum(1 for a in anomalies if a.status == "open")
        }

    def get_statistics(self, start_date: datetime = None, end_date: datetime = None) -> Dict[str, Any]:
        query = self.db.query(DeliveryOrder)

        if start_date:
            query = query.filter(DeliveryOrder.delivery_date >= start_date)
        if end_date:
            query = query.filter(DeliveryOrder.delivery_date <= end_date)

        total_orders = query.count()
        orders_with_anomaly = query.filter(DeliveryOrder.anomaly_count > 0).count()

        status_stats = {}
        for status in DeliveryStatus:
            count = query.filter(DeliveryOrder.status == status).count()
            status_stats[status.value] = count

        anomaly_stats = {}
        for anomaly_type in AnomalyType:
            count = self.db.query(AnomalyRecord).filter(
                AnomalyRecord.anomaly_type == anomaly_type
            ).count()
            anomaly_stats[anomaly_type.value] = count

        return {
            "total_orders": total_orders,
            "orders_with_anomaly": orders_with_anomaly,
            "anomaly_rate": (orders_with_anomaly / total_orders * 100) if total_orders > 0 else 0,
            "status_distribution": status_stats,
            "anomaly_distribution": anomaly_stats
        }
