import os
import hashlib
import pandas as pd
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from pathlib import Path

from .models import ReleaseRecord, OriginalSnapshot, ChangeLog, ChangeType, ProcessStatus, BoundaryType


class DataImporter:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        self.import_history_file = self.data_dir / "import_history.json"
        self._ensure_import_history()

    def _ensure_import_history(self) -> None:
        if not self.import_history_file.exists():
            import json
            with open(self.import_history_file, "w", encoding="utf-8") as f:
                json.dump({"imports": []}, f, ensure_ascii=False, indent=2)

    def _get_file_hash(self, file_path: str) -> str:
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                hasher.update(chunk)
        return hasher.hexdigest()

    def _generate_record_id(self, ex_dividend_date: str, bill_number: str, row_number: int) -> str:
        raw_id = f"{ex_dividend_date}_{bill_number}_{row_number}"
        return hashlib.md5(raw_id.encode("utf-8")).hexdigest()[:16]

    def _is_duplicate_import(self, file_hash: str) -> Tuple[bool, Optional[Dict]]:
        import json
        with open(self.import_history_file, "r", encoding="utf-8") as f:
            history = json.load(f)

        for import_record in history["imports"]:
            if import_record["file_hash"] == file_hash:
                return True, import_record
        return False, None

    def _record_import(self, file_path: str, file_hash: str, batch_id: str, record_count: int, operator: str) -> None:
        import json
        with open(self.import_history_file, "r", encoding="utf-8") as f:
            history = json.load(f)

        history["imports"].append({
            "timestamp": datetime.now().isoformat(),
            "file_path": file_path,
            "file_name": os.path.basename(file_path),
            "file_hash": file_hash,
            "batch_id": batch_id,
            "record_count": record_count,
            "operator": operator,
        })

        with open(self.import_history_file, "w", encoding="utf-8") as f:
            json.dump(history, f, ensure_ascii=False, indent=2)

    def _read_excel(self, file_path: str) -> pd.DataFrame:
        df = pd.read_excel(file_path, dtype={"票据号": str, "除权日": str})
        return df

    def _normalize_column_names(self, df: pd.DataFrame) -> pd.DataFrame:
        column_mapping = {
            "除权日": "ex_dividend_date",
            "票据号": "bill_number",
            "金额": "amount",
            "备注": "remark",
            "税费率": "tax_rate",
            "税费金额": "tax_amount",
        }
        df = df.rename(columns={k: v for k, v in column_mapping.items() if k in df.columns})
        return df

    def import_excel(
        self,
        file_path: str,
        operator: str,
        skip_duplicate_check: bool = False,
    ) -> Tuple[List[ReleaseRecord], Dict]:
        file_hash = self._get_file_hash(file_path)

        is_duplicate, existing_import = self._is_duplicate_import(file_hash)
        if is_duplicate and not skip_duplicate_check:
            raise ValueError(
                f"文件已在 {existing_import['timestamp']} 由 {existing_import['operator']} 导入，"
                f"批次号: {existing_import['batch_id']}，共 {existing_import['record_count']} 条记录。"
                f"如需强制重新导入，请设置 skip_duplicate_check=True"
            )

        df = self._read_excel(file_path)
        df = self._normalize_column_names(df)

        required_columns = ["ex_dividend_date", "bill_number", "amount", "remark"]
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"缺少必要列: {', '.join(missing_columns)}")

        batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        records: List[ReleaseRecord] = []
        import_timestamp = datetime.now()

        for idx, row in df.iterrows():
            row_number = idx + 2

            raw_data = row.to_dict()
            record_id = self._generate_record_id(
                str(row.get("ex_dividend_date", "")),
                str(row.get("bill_number", "")),
                row_number,
            )

            snapshot = OriginalSnapshot(
                row_number=row_number,
                source_file=os.path.basename(file_path),
                import_timestamp=import_timestamp,
                raw_data={str(k): str(v) for k, v in raw_data.items()},
            )

            record = ReleaseRecord(
                record_id=record_id,
                ex_dividend_date=str(row.get("ex_dividend_date", "")),
                bill_number=str(row.get("bill_number", "")),
                amount=float(row.get("amount", 0) or 0),
                remark=str(row.get("remark", "")),
                tax_rate=float(row.get("tax_rate")) if pd.notna(row.get("tax_rate")) else None,
                tax_amount=float(row.get("tax_amount")) if pd.notna(row.get("tax_amount")) else None,
                original_snapshot=snapshot,
            )

            import_log = ChangeLog(
                change_type=ChangeType.IMPORT,
                operator=operator,
                field_name=None,
                old_value=None,
                new_value="record_created",
                reason="首次导入除权日截图",
                batch_id=batch_id,
            )
            record.add_change_log(import_log)

            records.append(record)

        self._record_import(file_path, file_hash, batch_id, len(records), operator)

        summary = {
            "batch_id": batch_id,
            "total_records": len(records),
            "file_hash": file_hash,
            "import_timestamp": import_timestamp.isoformat(),
            "operator": operator,
        }

        return records, summary

    def get_import_history(self) -> List[Dict]:
        import json
        with open(self.import_history_file, "r", encoding="utf-8") as f:
            history = json.load(f)
        return history["imports"]

    def get_import_by_batch_id(self, batch_id: str) -> Optional[Dict]:
        for import_record in self.get_import_history():
            if import_record["batch_id"] == batch_id:
                return import_record
        return None
