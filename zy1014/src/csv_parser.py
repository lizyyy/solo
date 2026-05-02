import pandas as pd
import re
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field


@dataclass
class ColumnMapping:
    time_column: Optional[str] = None
    bean_temp_column: Optional[str] = None
    env_temp_column: Optional[str] = None
    power_column: Optional[str] = None
    damper_column: Optional[str] = None
    event_column: Optional[str] = None


class ColumnMapper:
    TIME_PATTERNS = [r'time', r'时间', r'时刻', r'timestamp', r'elapsed']
    BEAN_TEMP_PATTERNS = [r'bean.?temp', r'bean.?temperature', r'豆温', r'bt', r'豆温_实际']
    ENV_TEMP_PATTERNS = [r'env.?temp', r'env.?temperature', r'环境温', r'et', r'排气温', r'exhaust']
    POWER_PATTERNS = [r'power', r'火力', r'heat', r'功率', r'火']
    DAMPER_PATTERNS = [r'damper', r'风门', r'风', r'air']
    EVENT_PATTERNS = [r'event', r'事件', r'备注', r'note', r'mark', r'event.?type']

    @classmethod
    def auto_detect(cls, columns: List[str]) -> ColumnMapping:
        mapping = ColumnMapping()

        def match_pattern(col: str, patterns: List[str]) -> bool:
            col_lower = col.lower().strip()
            for pattern in patterns:
                if re.search(pattern, col_lower, re.IGNORECASE):
                    return True
            return False

        for col in columns:
            if match_pattern(col, cls.TIME_PATTERNS) and not mapping.time_column:
                mapping.time_column = col
            elif match_pattern(col, cls.BEAN_TEMP_PATTERNS) and not mapping.bean_temp_column:
                mapping.bean_temp_column = col
            elif match_pattern(col, cls.ENV_TEMP_PATTERNS) and not mapping.env_temp_column:
                mapping.env_temp_column = col
            elif match_pattern(col, cls.POWER_PATTERNS) and not mapping.power_column:
                mapping.power_column = col
            elif match_pattern(col, cls.DAMPER_PATTERNS) and not mapping.damper_column:
                mapping.damper_column = col
            elif match_pattern(col, cls.EVENT_PATTERNS) and not mapping.event_column:
                mapping.event_column = col

        return mapping


class CSVParser:
    def __init__(self):
        self.mapper = ColumnMapper()

    def parse_file(self, file_path: str, mapping: Optional[ColumnMapping] = None) -> Tuple[pd.DataFrame, Dict]:
        df = pd.read_csv(file_path, encoding='utf-8-sig')

        if mapping is None:
            mapping = ColumnMapper.auto_detect(list(df.columns))

        result = self._normalize_columns(df, mapping)
        metadata = self._extract_metadata(df, mapping)

        return result, metadata

    def parse_uploaded_file(self, uploaded_file) -> Tuple[pd.DataFrame, Dict, ColumnMapping]:
        df = pd.read_csv(uploaded_file, encoding='utf-8-sig')
        auto_mapping = ColumnMapper.auto_detect(list(df.columns))
        result = self._normalize_columns(df, auto_mapping)
        metadata = self._extract_metadata(df, auto_mapping)

        return result, metadata, auto_mapping

    def _normalize_columns(self, df: pd.DataFrame, mapping: ColumnMapping) -> pd.DataFrame:
        result = pd.DataFrame()

        if mapping.time_column:
            result['time'] = df[mapping.time_column]
            result['time_seconds'] = self._parse_time_column(result['time'])

        if mapping.bean_temp_column:
            result['bean_temp'] = pd.to_numeric(df[mapping.bean_temp_column], errors='coerce')

        if mapping.env_temp_column:
            result['env_temp'] = pd.to_numeric(df[mapping.env_temp_column], errors='coerce')

        if mapping.power_column:
            result['power'] = pd.to_numeric(df[mapping.power_column], errors='coerce')

        if mapping.damper_column:
            result['damper'] = pd.to_numeric(df[mapping.damper_column], errors='coerce')

        if mapping.event_column:
            result['events'] = df[mapping.event_column].fillna('')

        if 'time_seconds' in result.columns:
            result = result.sort_values('time_seconds').reset_index(drop=True)

        return result

    def _parse_time_column(self, time_series: pd.Series) -> pd.Series:
        def to_seconds(val):
            if pd.isna(val):
                return None

            val_str = str(val).strip()

            match = re.match(r'(\d+):(\d+)(?::(\d+))?', val_str)
            if match:
                minutes = int(match.group(1))
                seconds = int(match.group(2))
                hours = int(match.group(3)) if match.group(3) else 0
                return hours * 3600 + minutes * 60 + seconds

            try:
                return float(val_str)
            except ValueError:
                return None

        return time_series.apply(to_seconds)

    def _extract_metadata(self, df: pd.DataFrame, mapping: ColumnMapping) -> Dict:
        metadata = {
            'row_count': len(df),
            'columns_original': list(df.columns),
            'mapping': {
                'time': mapping.time_column,
                'bean_temp': mapping.bean_temp_column,
                'env_temp': mapping.env_temp_column,
                'power': mapping.power_column,
                'damper': mapping.damper_column,
                'events': mapping.event_column
            }
        }
        return metadata

    @staticmethod
    def get_sample_columns() -> List[str]:
        return [
            'time', 'bean_temp', 'env_temp', 'power', 'damper', 'events'
        ]
