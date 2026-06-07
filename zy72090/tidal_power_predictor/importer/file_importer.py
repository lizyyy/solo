import os
import csv
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field

import pandas as pd

from .column_mapper import (
    ColumnNameNormalizer,
    ColumnMapping,
    ImportPreview,
)
from ..core.calculator import TidalPredictionInput


@dataclass
class ImportResult:
    success: bool
    records: List[TidalPredictionInput] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    stats: Dict = field(default_factory=dict)


class TidalFileImporter:
    def __init__(self):
        self.normalizer = ColumnNameNormalizer()

    def preview_file(self, filepath: str) -> ImportPreview:
        filename = os.path.basename(filepath)
        ext = os.path.splitext(filename)[1].lower()

        if ext == '.csv':
            df = pd.read_csv(filepath, nrows=100, dtype=str, encoding='utf-8-sig')
        elif ext in ['.xlsx', '.xls']:
            df = pd.read_excel(filepath, nrows=100, dtype=str)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")

        source_columns = list(df.columns)
        sample_data = df.head(5).to_dict('records')
        suggested_mappings = self.normalizer.generate_suggested_mappings(source_columns)

        raw_preview = df.head(3).to_string(index=False)

        return ImportPreview(
            filename=filename,
            total_rows=len(df),
            total_columns=len(source_columns),
            sample_data=sample_data,
            source_columns=source_columns,
            suggested_mappings=suggested_mappings,
            raw_preview=raw_preview
        )

    def _safe_parse_number(self, value) -> Optional[float]:
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return None
        if isinstance(value, (int, float)):
            return float(value)
        try:
            cleaned = str(value).strip().replace(',', '')
            if cleaned == '' or cleaned.lower() in ['nan', 'none', 'null', '-']:
                return None
            return float(cleaned)
        except (ValueError, TypeError):
            return None

    def _safe_parse_datetime(self, value) -> Optional[datetime]:
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, pd.Timestamp):
            return value.to_pydatetime()
        try:
            from dateutil import parser
            return parser.parse(str(value))
        except Exception:
            try:
                return datetime.strptime(str(value).strip(), '%Y-%m-%d %H:%M:%S')
            except Exception:
                return datetime.now()

    def _safe_str(self, value) -> str:
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return ""
        return str(value).strip()

    def import_file(
        self,
        filepath: str,
        mappings: List[ColumnMapping],
        source_row_start: int = 1
    ) -> ImportResult:
        result = ImportResult(success=False)
        
        try:
            filename = os.path.basename(filepath)
            ext = os.path.splitext(filename)[1].lower()

            if ext == '.csv':
                df = pd.read_csv(filepath, dtype=str, encoding='utf-8-sig', skiprows=source_row_start - 1)
            elif ext in ['.xlsx', '.xls']:
                df = pd.read_excel(filepath, dtype=str, skiprows=source_row_start - 1)
            else:
                result.errors.append(f"不支持的文件格式: {ext}")
                return result

            mapping_dict = {
                m.source_column: m.target_column
                for m in mappings
                if m.target_column
            }

            if not mapping_dict:
                result.errors.append("至少需要映射一个列")
                return result

            imported_count = 0
            skipped_count = 0

            for idx, row in df.iterrows():
                try:
                    row_data = {}
                    for source_col, target_col in mapping_dict.items():
                        if source_col in df.columns:
                            row_data[target_col] = row.get(source_col)

                    record_id = self._safe_str(row_data.get('record_id', f"AUTO-{idx+1:04d}"))
                    if not record_id or record_id.startswith("AUTO-"):
                        record_id = f"AUTO-{idx+1:04d}"

                    timestamp = self._safe_parse_datetime(row_data.get('timestamp'))
                    if timestamp is None:
                        timestamp = datetime.now()

                    record = TidalPredictionInput(
                        record_id=record_id,
                        timestamp=timestamp,
                        station_name=self._safe_str(row_data.get('station_name')),
                        tidal_range=self._safe_parse_number(row_data.get('tidal_range')),
                        tidal_range_unit=self._safe_str(row_data.get('tidal_range_unit', 'm')) or "m",
                        flow_rate=self._safe_parse_number(row_data.get('flow_rate')),
                        flow_rate_unit=self._safe_str(row_data.get('flow_rate_unit', 'm³/s')) or "m³/s",
                        water_velocity=self._safe_parse_number(row_data.get('water_velocity')),
                        water_velocity_unit=self._safe_str(row_data.get('water_velocity_unit', 'm/s')) or "m/s",
                        turbine_efficiency=self._safe_parse_number(row_data.get('turbine_efficiency')),
                        cross_sectional_area=self._safe_parse_number(row_data.get('cross_sectional_area')),
                        cross_sectional_area_unit=self._safe_str(row_data.get('cross_sectional_area_unit', 'm²')) or "m²",
                        data_source=self._safe_str(row_data.get('data_source', 'imported')) or "imported",
                        notes=self._safe_str(row_data.get('notes'))
                    )

                    record.notes = f"[来源行: {idx + source_row_start + 1}] {record.notes}".strip()

                    result.records.append(record)
                    imported_count += 1

                except Exception as e:
                    skipped_count += 1
                    result.warnings.append(f"第 {idx + source_row_start + 1} 行导入失败: {str(e)}")

            result.success = True
            result.stats = {
                'total_rows': len(df),
                'imported': imported_count,
                'skipped': skipped_count,
                'source_file': filename,
                'import_time': datetime.now().isoformat()
            }

        except Exception as e:
            result.errors.append(f"文件导入失败: {str(e)}")

        return result
