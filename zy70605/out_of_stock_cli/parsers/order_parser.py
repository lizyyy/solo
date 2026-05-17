from typing import Dict, Any, Optional

from .base_parser import BaseParser
from ..models import OrderItem, OrderStatus


class OrderParser(BaseParser):
    def _parse_row(self, row_dict: Dict[str, Any], row_number: int) -> Optional[OrderItem]:
        status_str = self._parse_str(row_dict.get("订单状态", ""), "订单状态").lower()
        try:
            order_status = OrderStatus(status_str)
        except ValueError:
            raise ValueError(f"无效的订单状态: {status_str}")

        return OrderItem(
            order_id=self._parse_str(row_dict.get("订单ID", ""), "订单ID"),
            sku_id=self._parse_str(row_dict.get("SKU_ID", ""), "SKU_ID"),
            sku_name=self._parse_str(row_dict.get("商品名称", ""), "商品名称"),
            quantity=self._parse_int(row_dict.get("数量", ""), "数量"),
            unit_price=self._parse_float(row_dict.get("单价", ""), "单价"),
            total_amount=self._parse_float(row_dict.get("总金额", ""), "总金额"),
            user_id=self._parse_str(row_dict.get("用户ID", ""), "用户ID"),
            user_name=self._parse_str(row_dict.get("用户名称", ""), "用户名称", required=False),
            order_time=self._parse_datetime(row_dict.get("下单时间", ""), "下单时间"),
            order_status=order_status,
            batch_id=self._parse_str(row_dict.get("批次ID", ""), "批次ID"),
            source_file=self.file_path,
            source_row=row_number,
            extra=row_dict,
        )
