"""数据导入处理器"""

import pandas as pd
import numpy as np
from datetime import datetime
from typing import Tuple, Dict, Optional
from sklearn.linear_model import LinearRegression

from .models import (
    ImportRecord,
    OriginalRow,
    RowStatus,
    ImportStatus,
    calculate_file_hash,
    generate_import_id,
)
from .storage import StorageManager


class DataImporter:
    def __init__(self, storage: StorageManager):
        self.storage = storage

    def import_from_csv(
        self,
        file_path: str,
        source_name: Optional[str] = None,
        check_duplicate: bool = True,
    ) -> Tuple[ImportRecord, bool]:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        file_hash = calculate_file_hash(content)
        source_name = source_name or file_path

        if check_duplicate:
            duplicate = self.storage.find_duplicate(file_hash)
            if duplicate:
                duplicate.status = ImportStatus.DUPLICATE
                self.storage.save_record(duplicate)
                return duplicate, True

        df = pd.read_csv(file_path)
        rows = []
        for idx, row in df.iterrows():
            original_row = OriginalRow(
                original_line_no=idx + 1,
                current_line_no=idx + 1,
                x_value=float(row.get("x", 0)),
                y_value=float(row.get("y", 0)),
                status=RowStatus.NORMAL,
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
        )

        self._calculate_residuals(record)
        self.storage.save_record(record)
        return record, False

    def _calculate_residuals(self, record: ImportRecord):
        valid_rows = [r for r in record.rows if r.status == RowStatus.NORMAL]
        if len(valid_rows) < 2:
            return

        X = np.array([[r.x_value] for r in valid_rows])
        y = np.array([r.y_value for r in valid_rows])

        model = LinearRegression()
        model.fit(X, y)

        record.regression_params = {
            "slope": float(model.coef_[0]),
            "intercept": float(model.intercept_),
            "r_squared": float(model.score(X, y)),
        }

        for row in valid_rows:
            row.predicted = float(model.predict([[row.x_value]])[0])
            row.residual = row.y_value - row.predicted

    def recalculate_residuals(self, import_id: str) -> ImportRecord:
        record = self.storage.load_record(import_id)
        if not record:
            raise ValueError(f"Record {import_id} not found")

        self._calculate_residuals(record)
        record.params_version += 1
        self.storage.save_record(record)
        return record
