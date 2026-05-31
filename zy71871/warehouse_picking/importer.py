import pandas as pd
from datetime import datetime
import uuid
from pathlib import Path
from typing import List, Dict, Any, Tuple
import hashlib

from .models import PickingResult, ValidationStatus


class DataImporter:
    def __init__(self):
        self.import_history: List[Dict[str, Any]] = []

    def _generate_record_id(self, row: pd.Series, run_id: str) -> str:
        key_fields = [
            str(row.get("order_no", "")),
            str(row.get("sku_code", "")),
            str(run_id),
        ]
        key = "|".join(key_fields)
        return hashlib.md5(key.encode("utf-8")).hexdigest()[:12]

    def _parse_datetime(self, value: Any) -> datetime:
        if isinstance(value, datetime):
            return value
        if pd.isna(value):
            return datetime.now()
        try:
            return pd.to_datetime(value).to_pydatetime()
        except (ValueError, TypeError):
            return datetime.now()

    def import_from_excel(
        self,
        file_path: str,
        run_id: str,
        batch_no: str,
        sheet_name: str = 0,
    ) -> Tuple[List[PickingResult], Dict[str, Any]]:
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        df = pd.read_excel(file_path, sheet_name=sheet_name)

        df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")

        required_columns = [
            "order_no",
            "sku_code",
            "sku_name",
            "pick_qty",
            "unit",
            "pick_location",
            "picker",
            "pick_time",
        ]
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            raise ValueError(f"缺少必需列: {', '.join(missing_cols)}")

        results: List[PickingResult] = []
        stats = {
            "total_rows": len(df),
            "imported": 0,
            "skipped_duplicates": 0,
            "warnings": [],
        }

        seen_fingerprints = set()

        for _, row in df.iterrows():
            record_id = self._generate_record_id(row, run_id)

            pick_qty = float(row.get("pick_qty", 0)) if not pd.isna(row.get("pick_qty")) else 0.0

            result = PickingResult(
                record_id=record_id,
                order_no=str(row.get("order_no", "")).strip(),
                sku_code=str(row.get("sku_code", "")).strip(),
                sku_name=str(row.get("sku_name", "")).strip(),
                pick_qty=pick_qty,
                unit=str(row.get("unit", "")).strip(),
                pick_location=str(row.get("pick_location", "")).strip(),
                picker=str(row.get("picker", "")).strip(),
                pick_time=self._parse_datetime(row.get("pick_time")),
                run_id=run_id,
                batch_no=batch_no,
                status=ValidationStatus.PENDING,
                issues=[],
            )

            fingerprint = result.generate_fingerprint()
            if fingerprint in seen_fingerprints:
                stats["skipped_duplicates"] += 1
                stats["warnings"].append(
                    f"跳过重复记录: 订单{result.order_no}-商品{result.sku_code}"
                )
                continue

            seen_fingerprints.add(fingerprint)
            results.append(result)
            stats["imported"] += 1

        self.import_history.append(
            {
                "file": str(file_path),
                "run_id": run_id,
                "batch_no": batch_no,
                "timestamp": datetime.now().isoformat(),
                "stats": stats,
            }
        )

        return results, stats

    def import_from_csv(
        self,
        file_path: str,
        run_id: str,
        batch_no: str,
        encoding: str = "utf-8",
    ) -> Tuple[List[PickingResult], Dict[str, Any]]:
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        df = pd.read_csv(file_path, encoding=encoding)
        temp_excel = file_path.with_suffix(".xlsx")
        df.to_excel(temp_excel, index=False)
        results, stats = self.import_from_excel(temp_excel, run_id, batch_no)
        temp_excel.unlink()

        return results, stats

    def get_import_history(self) -> List[Dict[str, Any]]:
        return self.import_history.copy()
