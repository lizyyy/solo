"""数据导入模块 - 支持多源异构数据导入"""
import json
import uuid
import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

from .config import FIELD_MAPPING, RAW_DATA_DIR
from .database import get_db, DATA_SOURCES_TABLE, RAW_RECORDS_TABLE


class DataImporter:
    """多源数据导入器"""

    def __init__(self, batch_id: Optional[str] = None):
        self.db = get_db()
        self.batch_id = batch_id or self.db.new_batch_id()
        self.field_mapping = FIELD_MAPPING
        self.imported_sources: List[Dict] = []

    def _detect_source_type(self, file_path: str) -> str:
        """检测数据源类型"""
        ext = Path(file_path).suffix.lower()
        if ext in ['.xlsx', '.xls']:
            return '业务表'
        elif ext in ['.csv']:
            return '业务表'
        elif ext in ['.yaml', '.yml']:
            return '老师讲义'
        elif ext in ['.json']:
            return '老师讲义'
        elif ext in ['.txt']:
            return '临时截图转文本'
        return '未知类型'

    def _normalize_field_name(self, col_name: str) -> Optional[str]:
        """根据映射表标准化字段名"""
        col_lower = str(col_name).strip().lower()
        for standard_name, aliases in self.field_mapping.items():
            for alias in aliases:
                if col_lower == str(alias).lower():
                    return standard_name
        return None

    def _read_file(self, file_path: str, source_type: str) -> pd.DataFrame:
        """读取不同格式的文件"""
        ext = Path(file_path).suffix.lower()
        if ext in ['.xlsx', '.xls']:
            return pd.read_excel(file_path, dtype=str)
        elif ext == '.csv':
            return pd.read_csv(file_path, dtype=str)
        elif ext in ['.yaml', '.yml']:
            import yaml
            with open(file_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            if isinstance(data, list):
                return pd.DataFrame(data)
            elif isinstance(data, dict) and 'records' in data:
                return pd.DataFrame(data['records'])
            return pd.DataFrame([data])
        elif ext == '.json':
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if isinstance(data, list):
                return pd.DataFrame(data)
            elif isinstance(data, dict) and 'records' in data:
                return pd.DataFrame(data['records'])
            return pd.DataFrame([data])
        elif ext == '.txt':
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            records = []
            current = {}
            for line in lines:
                line = line.strip()
                if not line:
                    if current:
                        records.append(current)
                        current = {}
                    continue
                if ':' in line:
                    key, value = line.split(':', 1)
                    current[key.strip()] = value.strip()
            if current:
                records.append(current)
            return pd.DataFrame(records)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")

    def _normalize_dataframe(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, str]]:
        """标准化DataFrame的列名和数据"""
        mapping_used = {}
        new_columns = {}
        for col in df.columns:
            standard_name = self._normalize_field_name(col)
            if standard_name:
                new_columns[col] = standard_name
                mapping_used[col] = standard_name
            else:
                new_columns[col] = col
        df = df.rename(columns=new_columns)
        numeric_fields = ["音准得分", "节奏得分", "合声得分", "音量平衡", "情感表达", "排练时长", "声部人数"]
        for field in numeric_fields:
            if field in df.columns:
                df[field] = pd.to_numeric(df[field], errors='coerce')
        if "排练日期" in df.columns:
            df["排练日期"] = pd.to_datetime(df["排练日期"], errors='coerce').dt.strftime('%Y-%m-%d')
        return df, mapping_used

    def import_file(self, file_path: str, source_name: Optional[str] = None,
                    custom_mapping: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """导入单个文件"""
        file_path = str(Path(file_path).resolve())
        source_type = self._detect_source_type(file_path)
        source_name = source_name or Path(file_path).stem
        if custom_mapping:
            for k, v in custom_mapping.items():
                if v in self.field_mapping:
                    if k.lower() not in [a.lower() for a in self.field_mapping[v]]:
                        self.field_mapping[v] = list(self.field_mapping[v]) + [k]
        df = self._read_file(file_path, source_type)
        df_normalized, mapping_used = self._normalize_dataframe(df)
        source_id = str(uuid.uuid4())
        with self.db.transaction():
            cursor = self.db.conn.cursor()
            cursor.execute(
                f"INSERT INTO {DATA_SOURCES_TABLE} VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    source_id,
                    source_type,
                    source_name,
                    file_path,
                    len(df_normalized),
                    json.dumps(mapping_used, ensure_ascii=False),
                    self.batch_id,
                    datetime.now().isoformat()
                )
            )
            for _, row in df_normalized.iterrows():
                row_dict = row.where(pd.notnull(row), None).to_dict()
                original_data = {k: v for k, v in row_dict.items() if v is not None}
                normalized_data = dict(original_data)
                record_id = str(uuid.uuid4())
                section = normalized_data.get("声部")
                member_name = normalized_data.get("人员")
                rehearsal_date = normalized_data.get("排练日期")
                cursor.execute(
                    f"INSERT INTO {RAW_RECORDS_TABLE} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        record_id,
                        source_id,
                        self.batch_id,
                        json.dumps(original_data, ensure_ascii=False),
                        json.dumps(normalized_data, ensure_ascii=False),
                        section,
                        member_name,
                        rehearsal_date,
                        0,
                        None,
                        datetime.now().isoformat()
                    )
                )
        self.db.log_audit(
            "import_file",
            {
                "source_id": source_id,
                "source_type": source_type,
                "source_name": source_name,
                "record_count": len(df_normalized),
                "mapping_used": mapping_used
            },
            batch_id=self.batch_id
        )
        result = {
            "source_id": source_id,
            "source_type": source_type,
            "source_name": source_name,
            "record_count": len(df_normalized),
            "mapping_used": mapping_used,
            "columns": list(df_normalized.columns)
        }
        self.imported_sources.append(result)
        return result

    def import_directory(self, dir_path: str,
                         custom_mapping: Optional[Dict[str, str]] = None) -> List[Dict]:
        """导入整个目录下的所有支持文件"""
        dir_path = Path(dir_path)
        results = []
        supported_ext = ['.xlsx', '.xls', '.csv', '.yaml', '.yml', '.json', '.txt']
        for file_path in sorted(dir_path.iterdir()):
            if file_path.suffix.lower() in supported_ext:
                try:
                    result = self.import_file(str(file_path), custom_mapping=custom_mapping)
                    results.append(result)
                except Exception as e:
                    self.db.log_audit(
                        "import_file_error",
                        {"file": str(file_path), "error": str(e)},
                        batch_id=self.batch_id
                    )
        return results

    def get_imported_data(self) -> pd.DataFrame:
        """获取本批次已导入的标准化数据"""
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"SELECT normalized_data, id, source_id FROM {RAW_RECORDS_TABLE} WHERE batch_id = ?",
            (self.batch_id,)
        )
        rows = cursor.fetchall()
        if not rows:
            return pd.DataFrame()
        records = []
        for row in rows:
            data = json.loads(row['normalized_data'])
            data['_record_id'] = row['id']
            data['_source_id'] = row['source_id']
            records.append(data)
        return pd.DataFrame(records)

    def get_sources(self) -> List[Dict]:
        """获取本批次的数据源信息"""
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"SELECT * FROM {DATA_SOURCES_TABLE} WHERE batch_id = ?",
            (self.batch_id,)
        )
        rows = cursor.fetchall()
        sources = []
        for row in rows:
            sources.append({
                "id": row['id'],
                "source_type": row['source_type'],
                "source_name": row['source_name'],
                "file_path": row['file_path'],
                "record_count": row['record_count'],
                "field_mapping": json.loads(row['field_mapping']) if row['field_mapping'] else {}
            })
        return sources
