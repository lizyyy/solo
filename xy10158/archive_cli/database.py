from sqlalchemy import create_engine, text, inspect
from sqlalchemy.engine import Engine
from typing import List, Dict, Any, Optional
import pandas as pd
from .config import DatabaseConfig


class DatabaseManager:
    def __init__(self, config: DatabaseConfig):
        self.config = config
        self.engine: Optional[Engine] = None
        self._inspector = None
    
    def connect(self) -> Engine:
        if self.engine is None:
            self.engine = create_engine(self.config.connection_string)
            self._inspector = inspect(self.engine)
        return self.engine
    
    def _get_inspector(self):
        if self._inspector is None:
            self.connect()
        return self._inspector
    
    def close(self):
        if self.engine is not None:
            self.engine.dispose()
            self.engine = None
            self._inspector = None
    
    def execute_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> pd.DataFrame:
        engine = self.connect()
        with engine.connect() as conn:
            result = pd.read_sql(text(query), conn, params=params or {})
        return result
    
    def execute_update(self, query: str, params: Optional[Dict[str, Any]] = None) -> int:
        engine = self.connect()
        with engine.connect() as conn:
            result = conn.execute(text(query), params or {})
            conn.commit()
            return result.rowcount
    
    def get_table_columns(self, table_name: str, schema: Optional[str] = None) -> List[str]:
        inspector = self._get_inspector()
        
        try:
            columns = inspector.get_columns(table_name, schema=schema)
            return [col['name'] for col in columns]
        except Exception:
            full_table_name = f"{schema}.{table_name}" if schema else table_name
            query = f"SELECT * FROM {full_table_name} LIMIT 0"
            empty_df = self.execute_query(query)
            return empty_df.columns.tolist()
    
    def get_table_row_count(self, table_name: str, schema: Optional[str] = None) -> int:
        full_table_name = f"{schema}.{table_name}" if schema else table_name
        query = f"SELECT COUNT(*) as cnt FROM {full_table_name}"
        result = self.execute_query(query)
        return int(result.iloc[0]['cnt'])
    
    def table_exists(self, table_name: str, schema: Optional[str] = None) -> bool:
        inspector = self._get_inspector()
        
        try:
            return inspector.has_table(table_name, schema=schema)
        except Exception:
            try:
                full_table_name = f"{schema}.{table_name}" if schema else table_name
                query = f"SELECT 1 FROM {full_table_name} LIMIT 1"
                self.execute_query(query)
                return True
            except Exception:
                return False
