from typing import Dict, Any, Optional

from .base_parser import BaseParser
from ..models import CompensationPlan, CompensationType, CompensationStatus


class CompensationParser(BaseParser):
    def _parse_row(self, row_dict: Dict[str, Any], row_number: int) -> Optional[CompensationPlan]:
        comp_type_str = self._parse_str(row_dict.get("补偿类型", ""), "补偿类型").lower()
        try:
            compensation_type = CompensationType(comp_type_str)
        except ValueError:
            raise ValueError(f"无效的补偿类型: {comp_type_str}")

        status_str = self._parse_str(row_dict.get("状态", "pending"), "状态", required=False).lower() or "pending"
        try:
            status = CompensationStatus(status_str)
        except ValueError:
            status = CompensationStatus.PENDING

        refund_amount = None
        exchange_sku_id = None
        exchange_sku_name = None
        points_amount = None

        if compensation_type == CompensationType.REFUND:
            refund_amount = self._parse_float(row_dict.get("退款金额", ""), "退款金额")
        elif compensation_type == CompensationType.EXCHANGE:
            exchange_sku_id = self._parse_str(row_dict.get("换货SKU_ID", ""), "换货SKU_ID")
            exchange_sku_name = self._parse_str(row_dict.get("换货商品名称", ""), "换货商品名称", required=False)
        elif compensation_type == CompensationType.POINTS:
            points_amount = self._parse_int(row_dict.get("积分数量", ""), "积分数量")

        return CompensationPlan(
            plan_id=self._parse_str(row_dict.get("方案ID", ""), "方案ID"),
            batch_id=self._parse_str(row_dict.get("批次ID", ""), "批次ID"),
            sku_id=self._parse_str(row_dict.get("SKU_ID", ""), "SKU_ID"),
            order_id=self._parse_str(row_dict.get("订单ID", ""), "订单ID"),
            user_id=self._parse_str(row_dict.get("用户ID", ""), "用户ID"),
            compensation_type=compensation_type,
            quantity=self._parse_int(row_dict.get("数量", ""), "数量"),
            refund_amount=refund_amount,
            exchange_sku_id=exchange_sku_id,
            exchange_sku_name=exchange_sku_name,
            points_amount=points_amount,
            source_file=self.file_path,
            source_row=row_number,
            status=status,
            extra=row_dict,
        )
