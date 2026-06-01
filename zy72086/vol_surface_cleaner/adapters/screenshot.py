from typing import List, Dict, Any, Tuple
import re

from .base import BaseImporter
from core.models import VolatilityPoint, DataSource, DataSourceType


class ScreenshotImporter(BaseImporter):
    def __init__(self, source_name: str = "截图OCR识别"):
        super().__init__(DataSourceType.SCREENSHOT, source_name)
        self.ocr_confidence = 0.7

    def _parse_ocr_text(self, ocr_text: str) -> List[Dict[str, Any]]:
        rows = []
        lines = ocr_text.strip().split('\n')

        numeric_pattern = re.compile(r'[-+]?\d*\.?\d+%?')
        tenor_pattern = re.compile(r'(1M|3M|6M|1Y|2Y|3Y|5Y|10Y|ONEMONTH|THREEMONTH)', re.IGNORECASE)

        current_row = {}
        for line in lines:
            numbers = numeric_pattern.findall(line)
            tenors = tenor_pattern.findall(line)

            if tenors:
                if current_row:
                    rows.append(current_row)
                current_row = {"tenor": tenors[0]}

            if len(numbers) >= 2:
                try:
                    current_row["strike"] = float(numbers[0].replace('%', ''))
                    current_row["implied_vol"] = float(numbers[1].replace('%', ''))
                    if len(numbers) >= 3:
                        current_row["maturity"] = float(numbers[2].replace('%', ''))
                except (ValueError, IndexError):
                    pass

        if current_row:
            rows.append(current_row)

        return rows

    def import_data(self, data: Any, **kwargs) -> Tuple[List[VolatilityPoint], DataSource]:
        points: List[VolatilityPoint] = []

        if isinstance(data, str):
            raw_dict = self._parse_ocr_text(data)
        elif isinstance(data, list):
            raw_dict = data
        else:
            raise ValueError("截图数据格式不支持，请提供OCR文本或字典列表")

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
                data_source_id="screenshot",
                confidence=self.ocr_confidence,
                tags=["screenshot_ocr", "low_confidence"]
            )
            points.append(vp)

        data_source = self._create_data_source(self.field_mapping, self.raw_data_hash)
        return points, data_source
