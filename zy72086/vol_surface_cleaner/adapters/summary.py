from typing import List, Dict, Any, Tuple
import pandas as pd

from .base import BaseImporter
from core.models import VolatilityPoint, DataSource, DataSourceType


class SummaryPageImporter(BaseImporter):
    def __init__(self, source_name: str = "老板看的汇总页"):
        super().__init__(DataSourceType.SUMMARY_PAGE, source_name)

    def import_data(self, data: Any, **kwargs) -> Tuple[List[VolatilityPoint], DataSource]:
        points: List[VolatilityPoint] = []

        if isinstance(data, dict):
            raw_dict = [{"tenor_key": k, "implied_vol": v} for k, v in data.items()]
        elif isinstance(data, pd.DataFrame):
            raw_dict = data.to_dict('records')
        elif isinstance(data, list):
            raw_dict = data
        else:
            raise ValueError("汇总页数据格式不支持，请提供字典、DataFrame或字典列表")

        raw_fields = list(raw_dict[0].keys()) if raw_dict else []
        self.field_mapping = self._auto_detect_mapping(raw_fields)
        self.raw_data_hash = self._compute_data_hash(raw_dict)

        for i, row in enumerate(raw_dict):
            if "tenor_key" in row:
                key_parts = row["tenor_key"].split('_')
                tenor = key_parts[0] if len(key_parts) > 0 else f"T{i}"
                strike = float(key_parts[1]) if len(key_parts) > 1 else 100.0
            else:
                mapped = {}
                for raw_field, value in row.items():
                    if raw_field in self.field_mapping:
                        mapped[self.field_mapping[raw_field]] = value
                tenor = self._parse_tenor(mapped.get("tenor", f"T{i}"))
                strike = self._parse_value(mapped.get("strike", 100))

            maturity_map = {
                "1M": 1/12, "3M": 3/12, "6M": 6/12,
                "1Y": 1.0, "2Y": 2.0, "3Y": 3.0, "5Y": 5.0, "10Y": 10.0
            }
            maturity = maturity_map.get(tenor, 1.0)

            vol_value = row.get("implied_vol", 0.2)
            vp = VolatilityPoint(
                strike=strike,
                maturity=maturity,
                implied_vol=self._parse_value(vol_value),
                tenor=self._parse_tenor(tenor),
                option_type="call",
                raw_value=self._parse_value(vol_value),
                data_source_id="summary_page",
                tags=["summary_page", "reference"],
                confidence=0.8
            )
            points.append(vp)

        data_source = self._create_data_source(self.field_mapping, self.raw_data_hash)
        return points, data_source

    def to_summary_dict(self, points: List[VolatilityPoint]) -> Dict[str, float]:
        result = {}
        for p in points:
            key = f"{p.tenor}_{p.strike:.4f}"
            result[key] = p.implied_vol
        return result
