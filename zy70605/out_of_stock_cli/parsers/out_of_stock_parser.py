from typing import Dict, Any, Optional

from .base_parser import BaseParser
from ..models import OutOfStockItem


class OutOfStockParser(BaseParser):
    def _parse_row(self, row_dict: Dict[str, Any], row_number: int) -> Optional[OutOfStockItem]:
        return OutOfStockItem(
            batch_id=self._parse_str(row_dict.get("批次ID", ""), "批次ID"),
            sku_id=self._parse_str(row_dict.get("SKU_ID", ""), "SKU_ID"),
            sku_name=self._parse_str(row_dict.get("商品名称", ""), "商品名称"),
            total_ordered=self._parse_int(row_dict.get("总订购量", ""), "总订购量"),
            available_quantity=self._parse_int(row_dict.get("可用库存", ""), "可用库存"),
            shortage_quantity=self._parse_int(row_dict.get("缺货数量", ""), "缺货数量"),
            source_file=self.file_path,
            source_row=row_number,
            extra=row_dict,
        )
