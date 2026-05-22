import pandas as pd
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import json

from pharmacy_expiry_tracker.importers.base_importer import (
    BaseImporter,
    ParsedRecord,
    ImportResultItem
)
from pharmacy_expiry_tracker.models.enums import ImportSourceType
from pharmacy_expiry_tracker.utils.helpers import get_days_near_expiry, get_expiry_category


class ExcelImporter(BaseImporter):
    COLUMN_MAPPING = {
        "pharmacy_code": ["药房编码", "门店编码", "店号", "pharmacode", "store_code"],
        "pharmacy_name": ["药房名称", "门店名称", "店名", "pharmacyname", "store_name"],
        "region": ["区域", "大区", "region", "area"],
        "town": ["乡镇", "区县", "town", "district"],
        "drug_code": ["药品编码", "货号", "drugcode", "product_code", "sku"],
        "drug_name": ["药品名称", "品名", "商品名", "drugname", "product_name"],
        "drug_spec": ["规格", "规格型号", "spec", "specification"],
        "batch_no": ["批号", "批次", "batch", "batchno", "lot_no"],
        "expiry_date": ["有效期", "有效期至", "到期日", "expirydate", "expire_date"],
        "quantity": ["数量", "库存数量", "qty", "quantity", "stock"],
        "unit": ["单位", "计量单位", "unit"],
        "remarks": ["备注", "说明", "remarks", "note"]
    }

    def __init__(
        self,
        source_type: ImportSourceType,
        allow_partial: bool = True,
        skip_duplicates: bool = True
    ):
        super().__init__(allow_partial, skip_duplicates)
        self.source_type = source_type
        self.column_mapping_used: Dict[str, str] = {}

    def _detect_columns(self, df: pd.DataFrame) -> Dict[str, str]:
        detected = {}
        columns_lower = {col.lower(): col for col in df.columns}

        for target, alternatives in self.COLUMN_MAPPING.items():
            for alt in alternatives:
                alt_lower = alt.lower()
                if alt_lower in columns_lower:
                    detected[target] = columns_lower[alt_lower]
                    break

        self.column_mapping_used = detected
        return detected

    def _parse_date(self, value: Any) -> Optional[datetime]:
        if pd.isna(value):
            return None

        if isinstance(value, datetime):
            return value

        if isinstance(value, pd.Timestamp):
            return value.to_pydatetime()

        date_str = str(value).strip()
        date_formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%Y年%m月%d日",
            "%Y%m%d",
            "%d-%m-%Y",
            "%m/%d/%Y"
        ]

        for fmt in date_formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue

        return None

    def _parse_int(self, value: Any) -> int:
        if pd.isna(value):
            return 0
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return 0

    def _parse_str(self, value: Any) -> str:
        if pd.isna(value):
            return ""
        return str(value).strip()

    def detect_duplicate(self, parsed: ParsedRecord, existing_records: List[Any]) -> bool:
        for rec in existing_records:
            if (rec.pharmacy_code == parsed.pharmacy_code and
                rec.drug_code == parsed.drug_code and
                rec.batch_no == parsed.batch_no):
                return True
        return False

    def parse_row(self, row_data: Dict[str, Any], row_number: int) -> Tuple[Optional[ParsedRecord], Optional[str]]:
        try:
            mapped = {}
            for target, source_col in self.column_mapping_used.items():
                mapped[target] = row_data.get(source_col)

            expiry_date = self._parse_date(mapped.get("expiry_date"))
            if not expiry_date:
                return None, f"无法解析有效期: {mapped.get('expiry_date')}"

            quantity = self._parse_int(mapped.get("quantity"))
            if quantity <= 0:
                return None, f"数量无效: {mapped.get('quantity')}"

            parsed = ParsedRecord(
                pharmacy_code=self._parse_str(mapped.get("pharmacy_code")),
                pharmacy_name=self._parse_str(mapped.get("pharmacy_name")),
                region=self._parse_str(mapped.get("region")),
                town=self._parse_str(mapped.get("town")),
                drug_code=self._parse_str(mapped.get("drug_code")),
                drug_name=self._parse_str(mapped.get("drug_name")),
                drug_spec=self._parse_str(mapped.get("drug_spec")),
                batch_no=self._parse_str(mapped.get("batch_no")),
                expiry_date=expiry_date,
                quantity=quantity,
                unit=self._parse_str(mapped.get("unit")),
                remarks=self._parse_str(mapped.get("remarks")),
                raw_data={k: str(v) for k, v in row_data.items()}
            )

            is_valid, error_msg = self.validate_parsed(parsed)
            if not is_valid:
                return None, error_msg

            return parsed, None

        except Exception as e:
            return None, f"解析异常: {str(e)}"

    def import_file(
        self,
        file_content: bytes,
        existing_records: List[Any] = None
    ) -> Tuple[List[ImportResultItem], Dict[str, Any]]:
        existing_records = existing_records or []
        results: List[ImportResultItem] = []

        df = pd.read_excel(file_content, engine='openpyxl')
        column_map = self._detect_columns(df)

        required_columns = ["pharmacy_code", "pharmacy_name", "drug_code", "drug_name", "batch_no", "expiry_date", "quantity"]
        missing = [col for col in required_columns if col not in column_map]
        if missing:
            raise ValueError(f"缺少必要列: {', '.join(missing)}")

        for idx, row in df.iterrows():
            row_number = idx + 2
            row_dict = row.to_dict()

            parsed, error = self.parse_row(row_dict, row_number)

            if error:
                results.append(ImportResultItem(
                    row_number=row_number,
                    success=False,
                    error_message=error,
                    parsed_data=None
                ))
                continue

            if self.skip_duplicates and self.detect_duplicate(parsed, existing_records):
                results.append(ImportResultItem(
                    row_number=row_number,
                    success=False,
                    error_message="重复记录（药房编码+药品编码+批号已存在）",
                    parsed_data=parsed
                ))
                continue

            results.append(ImportResultItem(
                row_number=row_number,
                success=True,
                parsed_data=parsed
            ))

        summary = {
            "total_rows": len(results),
            "success_rows": sum(1 for r in results if r.success),
            "failed_rows": sum(1 for r in results if not r.success),
            "columns_detected": list(column_map.keys()),
            "source_type": self.source_type.value
        }

        return results, summary
