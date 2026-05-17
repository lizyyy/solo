from typing import Dict, Any, Optional

from .base_parser import BaseParser
from ..models import Batch


class BatchParser(BaseParser):
    def _parse_row(self, row_dict: Dict[str, Any], row_number: int) -> Optional[Batch]:
        return Batch(
            batch_id=self._parse_str(row_dict.get("批次ID", ""), "批次ID"),
            batch_name=self._parse_str(row_dict.get("批次名称", ""), "批次名称"),
            start_time=self._parse_datetime(row_dict.get("开始时间", ""), "开始时间"),
            end_time=self._parse_datetime(row_dict.get("结束时间", ""), "结束时间"),
            status=self._parse_str(row_dict.get("状态", ""), "状态"),
            source_file=self.file_path,
            source_row=row_number,
            extra=row_dict,
        )
