from typing import List, Dict, Any, Tuple
import pandas as pd

from .base import BaseImporter
from core.models import VolatilityPoint, DataSource, DataSourceType


class LectureNoteImporter(BaseImporter):
    def __init__(self, source_name: str = "老师讲义"):
        super().__init__(DataSourceType.LECTURE_NOTE, source_name)

    def import_data(self, data: Any, **kwargs) -> Tuple[List[VolatilityPoint], DataSource]:
        points: List[VolatilityPoint] = []

        if isinstance(data, pd.DataFrame):
            raw_dict = data.to_dict('records')
        elif isinstance(data, list):
            raw_dict = data
        else:
            raise ValueError("老师讲义数据格式不支持，请提供DataFrame或字典列表")

        raw_fields = list(raw_dict[0].keys()) if raw_dict else []
        self.field_mapping = self._auto_detect_mapping(raw_fields)
        self.raw_data_hash = self._compute_data_hash(raw_dict)

        default_maturity_map = kwargs.get("maturity_map", {
            "1M": 1/12, "3M": 3/12, "6M": 6/12,
            "1Y": 1.0, "2Y": 2.0, "3Y": 3.0, "5Y": 5.0, "10Y": 10.0
        })

        for i, row in enumerate(raw_dict):
            mapped = {}
            for raw_field, value in row.items():
                if raw_field in self.field_mapping:
                    mapped[self.field_mapping[raw_field]] = value
                else:
                    mapped[raw_field] = value

            tenor = self._parse_tenor(mapped.get("tenor", f"T{i}"))
            maturity = self._parse_value(mapped.get("maturity", default_maturity_map.get(tenor, 1.0)))

            vp = VolatilityPoint(
                strike=self._parse_value(mapped.get("strike", 100)),
                maturity=maturity,
                implied_vol=self._parse_value(mapped.get("implied_vol", mapped.get("raw_value", 0.2))),
                tenor=tenor,
                option_type=self._parse_option_type(mapped.get("option_type", "call")),
                raw_value=self._parse_value(mapped.get("raw_value", mapped.get("implied_vol", 0.2))),
                data_source_id="lecture_note",
                tags=["lecture_import"]
            )
            points.append(vp)

        data_source = self._create_data_source(self.field_mapping, self.raw_data_hash)
        return points, data_source
