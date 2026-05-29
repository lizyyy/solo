import pandas as pd
from pathlib import Path
from typing import Dict, Optional, List
from datetime import datetime
import logging

from .config import Config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DataLoader:
    def __init__(self, config: Config):
        self.config = config
        self.raw_data: Dict[str, pd.DataFrame] = {}
        self.load_timestamps: Dict[str, datetime] = {}

    def load_all(self) -> Dict[str, pd.DataFrame]:
        data_sources = [
            "service_list",
            "key_versions",
            "callback_urls",
            "task_logs",
            "owners",
            "inspection_reports"
        ]
        
        for source in data_sources:
            self._load_source(source)
        
        return self.raw_data

    def _load_source(self, source_name: str) -> Optional[pd.DataFrame]:
        file_path = self.config.get_data_source_path(source_name)
        encoding = self.config.get(f"api_key_rotation.data_sources.{source_name}.encoding", "utf-8")
        
        if not file_path.exists():
            logger.warning(f"数据源文件不存在: {file_path}")
            return None
        
        try:
            df = pd.read_csv(file_path, encoding=encoding, dtype=str)
            df = self._preserve_raw_data(df, source_name)
            self.raw_data[source_name] = df
            self.load_timestamps[source_name] = datetime.now()
            logger.info(f"已加载 {source_name}: {len(df)} 条记录")
            return df
        except Exception as e:
            logger.error(f"加载 {source_name} 失败: {e}")
            return None

    def _preserve_raw_data(self, df: pd.DataFrame, source_name: str) -> pd.DataFrame:
        df = df.copy()
        df['_raw_source'] = source_name
        df['_load_time'] = datetime.now().isoformat()
        df['_row_hash'] = df.apply(lambda row: hash(tuple(row.dropna().astype(str))), axis=1)
        
        if '备注' in df.columns:
            df['_has_manual_note'] = df['备注'].notna() & (df['备注'] != '')
        
        return df

    def get_raw_data(self, source_name: str) -> Optional[pd.DataFrame]:
        return self.raw_data.get(source_name)

    def reload_source(self, source_name: str) -> Optional[pd.DataFrame]:
        return self._load_source(source_name)

    def get_data_summary(self) -> Dict[str, dict]:
        summary = {}
        for source, df in self.raw_data.items():
            summary[source] = {
                'count': len(df),
                'columns': list(df.columns),
                'load_time': self.load_timestamps.get(source),
                'has_manual_notes': '_has_manual_note' in df.columns and df['_has_manual_note'].any()
            }
        return summary
