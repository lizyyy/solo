import csv
from typing import List, Dict, Any
from order_state_machine import OrderItem, OrderStatus, ExceptionType

class Exporter:
    @staticmethod
    def export_pickup_report(orders: List[OrderItem], filename: str = 'pickup_report.md'):
        pending_count = sum(1 for o in orders if o.status == OrderStatus.PENDING)
        scanned_count = sum(1 for o in orders if o.status == OrderStatus.SCANNED)
        exception_count = sum(1 for o in orders if o.status == OrderStatus.EXCEPTION)
        completed_count = sum(1 for o in orders if o.status == OrderStatus.COMPLETED)
        
        md_content = f"""# 自提日核对报告

## 概览

| 状态 | 数量 |
|------|------|
| 待拣货 | {pending_count} |
| 已扫描 | {scanned_count} |
| 异常 | {exception_count} |
| 已完成 | {completed_count} |

## 待拣货列表

| 订单号 | 商品名称 | SKU | 数量 | 货架 | 顾客 | 电话 |
|--------|----------|-----|------|------|------|------|
"""
        
        pending_orders = [o for o in orders if o.status == OrderStatus.PENDING]
        for order in pending_orders:
            md_content += f"| {order.order_id} | {order.product_name} | {order.sku} | {order.quantity} | {order.shelf_code} | {order.customer_name} | {order.phone} |\n"
        
        md_content += "\n## 异常订单列表\n\n| 订单号 | 商品名称 | SKU | 异常类型 | 备注 | 顾客 | 电话 |\n|--------|----------|-----|----------|------|------|------|\n"
        
        exception_orders = [o for o in orders if o.status == OrderStatus.EXCEPTION]
        for order in exception_orders:
            exception_type_str = Exporter._get_exception_type_str(order.exception_type)
            md_content += f"| {order.order_id} | {order.product_name} | {order.sku} | {exception_type_str} | {order.notes} | {order.customer_name} | {order.phone} |\n"
        
        md_content += "\n## 已扫描订单列表\n\n| 订单号 | 商品名称 | SKU | 扫描时间 | 扫描员 | 顾客 |\n|--------|----------|-----|----------|--------|------|\n"
        
        scanned_orders = [o for o in orders if o.status == OrderStatus.SCANNED]
        for order in scanned_orders:
            md_content += f"| {order.order_id} | {order.product_name} | {order.sku} | {order.last_scan_time or '-'} | {order.scanner_id or '-'} | {order.customer_name} |\n"
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(md_content)

    @staticmethod
    def export_refund_list(orders: List[OrderItem], filename: str = 'refund_list.csv'):
        exception_orders = [o for o in orders if o.status == OrderStatus.EXCEPTION]
        
        with open(filename, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['order_id', 'product_name', 'sku', 'quantity', 'exception_type', 'notes', 'customer_name', 'phone'])
            
            for order in exception_orders:
                exception_type_str = Exporter._get_exception_type_str(order.exception_type)
                writer.writerow([
                    order.order_id,
                    order.product_name,
                    order.sku,
                    order.quantity,
                    exception_type_str,
                    order.notes,
                    order.customer_name,
                    order.phone
                ])

    @staticmethod
    def _get_exception_type_str(exception_type) -> str:
        if exception_type == ExceptionType.MISSING:
            return '缺货'
        elif exception_type == ExceptionType.WRONG_PICK:
            return '错拿'
        elif exception_type == ExceptionType.DUPLICATE:
            return '重复扫描'
        elif exception_type == ExceptionType.OTHER:
            return '其他'
        return '未知'