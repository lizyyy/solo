"""数据导入处理器 - 支持CSV/Excel多源、字段归一、补录行参与重算、参数历史快照"""

import os
import pandas as pd
import numpy as np
from datetime import datetime
from typing import Tuple, Dict, Optional, Any
from sklearn.linear_model import LinearRegression

from .models import (
    ImportRecord,
    OriginalRow,
    RowStatus,
    ImportStatus,
    ChangeType,
    ChangeLogEntry,
    calculate_file_hash,
    generate_import_id,
    normalize_field_name,
)
from .storage import StorageManager


SUPPORTED_VALID_STATUS = {RowStatus.NORMAL, RowStatus.SUPPLEMENTED, RowStatus.MODIFIED, RowStatus.REVIEWED}


class DataImporter:
    def __init__(self, storage: StorageManager):
        self.storage = storage

    def _read_file(self, file_path: str) -> Tuple[pd.DataFrame, str, str]:
        ext = os.path.splitext(file_path)[1].lower()
        source_format = ext.lstrip(".") if ext else "csv"

        if ext in [".xlsx", ".xls"]:
            with open(file_path, "rb") as f:
                binary = f.read()
            content_hash = calculate_file_hash(binary.hex())
            df = pd.read_excel(file_path)
        else:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            content_hash = calculate_file_hash(content)
            df = pd.read_csv(file_path)

        return df, content_hash, source_format

    def _normalize_columns(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, str], str, str]:
        field_mapping: Dict[str, str] = {}
        x_src, y_src = None, None

        for col in df.columns:
            canonical = normalize_field_name(col)
            if canonical:
                field_mapping[col] = canonical
                if canonical == "x":
                    x_src = col
                elif canonical == "y":
                    y_src = col

        if not x_src or not y_src:
            raise ValueError(
                f"未找到 x/y 字段。当前列: {list(df.columns)}。"
                f"支持的别名 x: {['x','X','自变量','x值','X轴','横坐标']},"
                f" y: {['y','Y','因变量','y值','Y轴','纵坐标','目标值','label']}"
            )

        renamed = df.rename(columns=field_mapping)
        return renamed, field_mapping, x_src, y_src

    def import_from_file(
        self,
        file_path: str,
        source_name: Optional[str] = None,
        check_duplicate: bool = True,
        author: str = "system",
    ) -> Tuple[ImportRecord, bool]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(file_path)

        df, file_hash, source_format = self._read_file(file_path)
        df_normalized, field_mapping, x_src, y_src = self._normalize_columns(df)
        source_name = source_name or os.path.basename(file_path)

        if check_duplicate:
            duplicate = self.storage.find_duplicate(file_hash)
            if duplicate:
                duplicate.status = ImportStatus.DUPLICATE
                duplicate.add_change_log(
                    ChangeLogEntry(
                        timestamp=datetime.now(),
                        change_type=ChangeType.IMPORT,
                        original_line_no=0,
                        author=author,
                        original_status=duplicate.status.value,
                        new_status=ImportStatus.DUPLICATE.value,
                        reason=f"重复导入检测: {source_name}",
                        next_action="通知运营规划阿岚确认是否需要重新导入",
                    )
                )
                self.storage.save_record(duplicate)
                return duplicate, True

        rows: list[OriginalRow] = []
        for idx, (_, df_row) in enumerate(df_normalized.iterrows()):
            line_no = idx + 1
            x_val = float(df_row["x"])
            y_val = float(df_row["y"])
            original_row = OriginalRow(
                original_line_no=line_no,
                current_line_no=line_no,
                x_value=x_val,
                y_value=y_val,
                status=RowStatus.NORMAL,
                original_x_value=x_val,
                original_y_value=y_val,
                source_field_x=x_src,
                source_field_y=y_src,
                source_file_ref=source_name,
            )
            rows.append(original_row)

        record = ImportRecord(
            import_id=generate_import_id(),
            import_time=datetime.now(),
            source_file=source_name,
            file_hash=file_hash,
            status=ImportStatus.INITIAL,
            total_rows=len(rows),
            rows=rows,
            field_mapping=field_mapping,
            source_format=source_format,
            data_owner=author,
        )

        for idx in range(len(rows)):
            record.add_change_log(
                ChangeLogEntry(
                    timestamp=datetime.now(),
                    change_type=ChangeType.IMPORT,
                    original_line_no=rows[idx].original_line_no,
                    author=author,
                    new_value_x=rows[idx].x_value,
                    new_value_y=rows[idx].y_value,
                    original_status=None,
                    new_status=RowStatus.NORMAL.value,
                    reason=f"首次导入 {source_name} 第{rows[idx].original_line_no}行",
                    next_action="",
                )
            )

        self._calculate_residuals(record, trigger=f"首次导入:{source_name}")
        self.storage.save_record(record)
        return record, False

    def import_from_csv(self, *args, **kwargs):
        return self.import_from_file(*args, **kwargs)

    def _calculate_residuals(self, record: ImportRecord, trigger: str = ""):
        valid_rows = [r for r in record.rows if r.status in SUPPORTED_VALID_STATUS]
        if len(valid_rows) < 2:
            return

        X = np.array([[r.x_value] for r in valid_rows])
        y = np.array([r.y_value for r in valid_rows])

        model = LinearRegression()
        model.fit(X, y)

        record.snapshot_params(trigger=trigger)

        record.regression_params = {
            "slope": float(model.coef_[0]),
            "intercept": float(model.intercept_),
            "r_squared": float(model.score(X, y)),
            "valid_rows_count": len(valid_rows),
            "total_rows": len(record.rows),
        }

        for row in record.rows:
            if row.status in SUPPORTED_VALID_STATUS:
                row.predicted = float(model.predict([[row.x_value]])[0])
                row.residual = row.y_value - row.predicted
            else:
                row.predicted = None
                row.residual = None
                row.current_line_no = None

    def recalculate_residuals(
        self, import_id: str, trigger: str = "", author: str = "system"
    ) -> ImportRecord:
        record = self.storage.load_record(import_id)
        if not record:
            raise ValueError(f"Record {import_id} not found")

        version_before = record.params_version
        self._calculate_residuals(record, trigger=trigger or f"手动触发重算")
        record.params_version += 1

        record.add_change_log(
            ChangeLogEntry(
                timestamp=datetime.now(),
                change_type=ChangeType.RECALC,
                original_line_no=0,
                author=author,
                params_version_before=version_before,
                params_version_after=record.params_version,
                reason=trigger or "手动触发残差重算",
                next_action="教研组复核回归参数和残差变化",
            )
        )

        record.status = ImportStatus.RESIDUALS_RECALCULATED
        self.storage.save_record(record)
        return record
