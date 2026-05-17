from typing import Dict, Any, Optional

from .base_parser import BaseParser
from ..models import UserConfirmation, CompensationType


class ConfirmationParser(BaseParser):
    def _parse_row(self, row_dict: Dict[str, Any], row_number: int) -> Optional[UserConfirmation]:
        comp_type_str = self._parse_str(row_dict.get("补偿类型", ""), "补偿类型").lower()
        try:
            compensation_type = CompensationType(comp_type_str)
        except ValueError:
            raise ValueError(f"无效的补偿类型: {comp_type_str}")

        confirmed_str = self._parse_str(row_dict.get("是否确认", ""), "是否确认").lower()
        confirmed = confirmed_str in ["是", "yes", "true", "1", "确认"]

        return UserConfirmation(
            confirmation_id=self._parse_str(row_dict.get("确认ID", ""), "确认ID"),
            order_id=self._parse_str(row_dict.get("订单ID", ""), "订单ID"),
            sku_id=self._parse_str(row_dict.get("SKU_ID", ""), "SKU_ID"),
            user_id=self._parse_str(row_dict.get("用户ID", ""), "用户ID"),
            compensation_type=compensation_type,
            confirmed_at=self._parse_datetime(row_dict.get("确认时间", ""), "确认时间"),
            confirmed=confirmed,
            source_file=self.file_path,
            source_row=row_number,
            extra=row_dict,
        )
