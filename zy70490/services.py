from datetime import datetime
from models import AuditTrailReport, RepairOrder
from sample_data import create_sample_orders


class AuditTrailService:
    def __init__(self):
        self.orders = create_sample_orders()
    
    def generate_report(self) -> AuditTrailReport:
        total_orders = len(self.orders)
        cross_day_orders = sum(1 for o in self.orders if o.is_cross_day)
        orders_with_errors = sum(1 for o in self.orders if o.processing_errors)
        orders_with_revisions = sum(1 for o in self.orders if o.revisions)
        orders_with_truncated = sum(1 for o in self.orders if o.has_truncated_fields)
        
        return AuditTrailReport(
            report_id=f"AUDIT-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
            generated_at=datetime.now(),
            total_orders=total_orders,
            cross_day_orders=cross_day_orders,
            orders_with_errors=orders_with_errors,
            orders_with_revisions=orders_with_revisions,
            orders_with_truncated_fields=orders_with_truncated,
            orders=self.orders
        )
    
    def get_order_by_id(self, order_id: str) -> RepairOrder:
        for order in self.orders:
            if order.order_id == order_id:
                return order
        raise ValueError(f"Order {order_id} not found")
    
    def get_orders_with_errors(self) -> list:
        return [o for o in self.orders if o.processing_errors]
    
    def get_orders_with_revisions(self) -> list:
        return [o for o in self.orders if o.revisions]
    
    def get_orders_with_truncated_fields(self) -> list:
        return [o for o in self.orders if o.has_truncated_fields]
