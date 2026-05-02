from enum import Enum, auto
from typing import Dict, List, Optional, Set

class OrderStatus(Enum):
    PENDING = auto()
    SCANNED = auto()
    EXCEPTION = auto()
    COMPLETED = auto()

class ExceptionType(Enum):
    MISSING = auto()
    WRONG_PICK = auto()
    DUPLICATE = auto()
    OTHER = auto()

class OrderItem:
    def __init__(self, order_data: Dict):
        self.order_id = order_data['order_id']
        self.product_name = order_data['product_name']
        self.sku = order_data['sku']
        self.quantity = int(order_data['quantity'])
        self.shelf_code = order_data['shelf_code']
        self.customer_name = order_data['customer_name']
        self.phone = order_data['phone']
        self.status = OrderStatus.PENDING
        self.exception_type: Optional[ExceptionType] = None
        self.scan_count = 0
        self.notes = ""
        self.last_scan_time: Optional[str] = None
        self.scanner_id: Optional[str] = None

class OrderStateMachine:
    def __init__(self):
        self.orders: Dict[str, OrderItem] = {}
        self.sku_order_map: Dict[str, List[str]] = {}

    def add_order(self, order_data: Dict):
        item = OrderItem(order_data)
        self.orders[item.order_id] = item
        
        if item.sku not in self.sku_order_map:
            self.sku_order_map[item.sku] = []
        self.sku_order_map[item.sku].append(item.order_id)

    def record_scan(self, sku: str, shelf_code: str, scan_time: str, scanner_id: str) -> Dict[str, str]:
        result = {
            'status': 'success',
            'message': '',
            'order_ids': []
        }
        
        if sku not in self.sku_order_map:
            result['status'] = 'warning'
            result['message'] = f"未找到商品SKU: {sku}"
            return result
        
        order_ids = self.sku_order_map[sku]
        pending_orders = [
            self.orders[oid] for oid in order_ids 
            if self.orders[oid].status == OrderStatus.PENDING
        ]
        
        if not pending_orders:
            result['status'] = 'warning'
            result['message'] = f"商品 {sku} 已全部扫描完成"
            
            scanned_order = self.orders.get(order_ids[0])
            if scanned_order:
                scanned_order.scan_count += 1
                scanned_order.last_scan_time = scan_time
                scanned_order.scanner_id = scanner_id
                
                if scanned_order.scan_count > 1:
                    scanned_order.status = OrderStatus.EXCEPTION
                    scanned_order.exception_type = ExceptionType.DUPLICATE
                    scanned_order.notes = f"重复扫描 {scanned_order.scan_count} 次"
                    result['message'] = f"警告: 商品 {sku} 已重复扫描 {scanned_order.scan_count} 次"
            return result
        
        order = pending_orders[0]
        
        if order.shelf_code != shelf_code:
            order.status = OrderStatus.EXCEPTION
            order.exception_type = ExceptionType.WRONG_PICK
            order.notes = f"货架错拿: 应为 {order.shelf_code}，实际扫描 {shelf_code}"
            order.last_scan_time = scan_time
            order.scanner_id = scanner_id
            order.scan_count += 1
            result['status'] = 'exception'
            result['message'] = f"异常: 货架错拿 - {order.product_name}"
            result['order_ids'] = [order.order_id]
            return result
        
        order.status = OrderStatus.SCANNED
        order.last_scan_time = scan_time
        order.scanner_id = scanner_id
        order.scan_count += 1
        result['message'] = f"已扫描: {order.product_name}"
        result['order_ids'] = [order.order_id]
        return result

    def set_exception(self, order_id: str, exception_type: ExceptionType, notes: str = ""):
        if order_id in self.orders:
            self.orders[order_id].status = OrderStatus.EXCEPTION
            self.orders[order_id].exception_type = exception_type
            if notes:
                self.orders[order_id].notes = notes

    def set_completed(self, order_id: str):
        if order_id in self.orders:
            self.orders[order_id].status = OrderStatus.COMPLETED

    def set_pending(self, order_id: str):
        if order_id in self.orders:
            self.orders[order_id].status = OrderStatus.PENDING
            self.orders[order_id].exception_type = None

    def update_notes(self, order_id: str, notes: str):
        if order_id in self.orders:
            self.orders[order_id].notes = notes

    def get_orders_by_status(self, status: OrderStatus) -> List[OrderItem]:
        return [order for order in self.orders.values() if order.status == status]

    def get_orders_by_shelf(self, shelf_code: str) -> List[OrderItem]:
        return [order for order in self.orders.values() if order.shelf_code == shelf_code]

    def get_order(self, order_id: str) -> Optional[OrderItem]:
        return self.orders.get(order_id)

    def get_stats(self) -> Dict[str, int]:
        stats = {status.name: 0 for status in OrderStatus}
        for order in self.orders.values():
            stats[order.status.name] += 1
        return stats

    def get_exception_orders(self) -> List[OrderItem]:
        return self.get_orders_by_status(OrderStatus.EXCEPTION)