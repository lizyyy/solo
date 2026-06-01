import hashlib
import json
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

from core.models import VolatilityPoint, DataSource, DataSourceType


class BaseImporter(ABC):
    FIELD_MAPPINGS = {
        "strike": ["行权价", "执行价", "strike", "K", "履约价"],
        "maturity": ["期限", "到期时间", "maturity", "T", "到期期限", "剩余期限"],
        "tenor": ["期限代码", "tenor", "品种", "合约代码"],
        "implied_vol": ["隐含波动率", "IV", "波动率", "vol", "implied_vol", "波动率值"],
        "option_type": ["期权类型", "type", "看涨看跌", "call_put", "类型"],
        "raw_value": ["原始值", "原始波动率", "raw"]
    }

    def __init__(self, source_type: DataSourceType, source_name: str):
        self.source_type = source_type
        self.source_name = source_name
        self.field_mapping: Dict[str, str] = {}
        self.raw_data_hash = ""

    def _normalize_field_name(self, raw_field: str) -> Optional[str]:
        raw_lower = raw_field.lower().strip()
        for standard, aliases in self.FIELD_MAPPINGS.items():
            if raw_lower in [a.lower() for a in aliases]:
                return standard
        return None

    def _auto_detect_mapping(self, raw_fields: List[str]) -> Dict[str, str]:
        mapping = {}
        for raw_field in raw_fields:
            standard = self._normalize_field_name(raw_field)
            if standard:
                mapping[raw_field] = standard
        return mapping

    def _compute_data_hash(self, raw_data: Any) -> str:
        data_str = json.dumps(raw_data, sort_keys=True, default=str)
        return hashlib.md5(data_str.encode('utf-8')).hexdigest()

    def _parse_tenor(self, tenor_str: str) -> str:
        tenor_str = str(tenor_str).upper().strip()
        tenor_map = {
            "1M": ["1M", "1月", "1个月", "ONEMONTH"],
            "3M": ["3M", "3月", "3个月", "THREEMONTH"],
            "6M": ["6M", "6月", "6个月", "SIXMONTH"],
            "1Y": ["1Y", "1年", "12M", "ONEYEAR"],
            "2Y": ["2Y", "2年", "TWOYEAR"],
            "3Y": ["3Y", "3年", "THREEYEAR"],
            "5Y": ["5Y", "5年", "FIVEYEAR"],
            "10Y": ["10Y", "10年", "TENYEAR"]
        }
        for standard, variants in tenor_map.items():
            if tenor_str in variants:
                return standard
        return tenor_str

    def _parse_option_type(self, type_str: str) -> str:
        type_str = str(type_str).lower().strip()
        if type_str in ["call", "看涨", "c", "认购"]:
            return "call"
        elif type_str in ["put", "看跌", "p", "认沽"]:
            return "put"
        return "call"

    def _parse_value(self, value: Any) -> float:
        if isinstance(value, (int, float)):
            return float(value)
        s = str(value).strip().replace('%', '')
        try:
            v = float(s)
            if v > 5:
                v = v / 100.0
            return v
        except ValueError:
            return 0.0

    def _create_data_source(self, mapping: Dict[str, str], raw_hash: str) -> DataSource:
        return DataSource(
            source_type=self.source_type,
            source_name=self.source_name,
            field_mapping=mapping,
            raw_data_hash=raw_hash
        )

    @abstractmethod
    def import_data(self, data: Any, **kwargs) -> Tuple[List[VolatilityPoint], DataSource]:
        pass
