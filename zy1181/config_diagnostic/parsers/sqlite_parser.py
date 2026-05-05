import os
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .base import ConfigParser, ConfigType, ConfigSource, ParsedConfig, ConfigValue


class SqliteParser(ConfigParser):
    COMMON_CONFIG_TABLES = [
        "config", "settings", "configuration", "options",
        "preferences", "app_config", "system_config",
    ]
    
    COMMON_KEY_COLUMNS = ["key", "name", "id", "config_key", "setting_key"]
    COMMON_VALUE_COLUMNS = ["value", "setting_value", "config_value", "content"]
    
    def __init__(self):
        super().__init__()
        self._config_type = ConfigType.SQLITE
    
    def can_parse(self, path: Path) -> bool:
        if not self._is_sqlite_file(path):
            return False
        
        try:
            return self._is_valid_sqlite(path)
        except Exception:
            return False
    
    def parse(self, path: Path) -> ParsedConfig:
        parsed = ParsedConfig(
            config_type=self._config_type,
            source_path=str(path),
        )
        
        try:
            conn = sqlite3.connect(str(path))
            conn.row_factory = sqlite3.Row
            
            tables = self._get_all_tables(conn)
            parsed.metadata["tables"] = tables
            
            config_tables = self._find_config_tables(conn, tables)
            
            for table in config_tables:
                key_col, value_col = self._find_key_value_columns(conn, table)
                
                if key_col and value_col:
                    self._parse_config_table(conn, table, key_col, value_col, parsed)
                else:
                    parsed.errors.append(
                        f"Table '{table}' does not have recognizable key-value columns"
                    )
            
            conn.close()
            
        except sqlite3.Error as e:
            parsed.errors.append(f"SQLite error: {str(e)}")
        except Exception as e:
            parsed.errors.append(f"Error reading SQLite file: {str(e)}")
        
        self._parsed = parsed
        return parsed
    
    def _is_valid_sqlite(self, path: Path) -> bool:
        if not path.exists() or path.stat().st_size < 100:
            return False
        
        try:
            with open(path, 'rb') as f:
                header = f.read(16)
                return header == b'SQLite format 3\x00'
        except Exception:
            return False
    
    def _get_all_tables(self, conn: sqlite3.Connection) -> List[str]:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
        return [row[0] for row in cursor.fetchall()]
    
    def _find_config_tables(self, conn: sqlite3.Connection, tables: List[str]) -> List[str]:
        config_tables = []
        
        for table in tables:
            if table.lower() in [t.lower() for t in self.COMMON_CONFIG_TABLES]:
                config_tables.append(table)
        
        if not config_tables:
            for table in tables:
                if self._is_likely_config_table(conn, table):
                    config_tables.append(table)
        
        return config_tables if config_tables else tables[:1]
    
    def _is_likely_config_table(self, conn: sqlite3.Connection, table: str) -> bool:
        cursor = conn.cursor()
        
        try:
            cursor.execute(f"PRAGMA table_info({table})")
            columns = [row[1].lower() for row in cursor.fetchall()]
            
            has_key = any(col in columns for col in [c.lower() for c in self.COMMON_KEY_COLUMNS])
            has_value = any(col in columns for col in [c.lower() for c in self.COMMON_VALUE_COLUMNS])
            
            return has_key and has_value
        except Exception:
            return False
    
    def _find_key_value_columns(
        self, 
        conn: sqlite3.Connection, 
        table: str
    ) -> Tuple[Optional[str], Optional[str]]:
        cursor = conn.cursor()
        
        try:
            cursor.execute(f"PRAGMA table_info({table})")
            columns = [row[1] for row in cursor.fetchall()]
            
            key_col = None
            value_col = None
            
            for key_pattern in self.COMMON_KEY_COLUMNS:
                for col in columns:
                    if col.lower() == key_pattern.lower():
                        key_col = col
                        break
                if key_col:
                    break
            
            for value_pattern in self.COMMON_VALUE_COLUMNS:
                for col in columns:
                    if col.lower() == value_pattern.lower():
                        value_col = col
                        break
                if value_col:
                    break
            
            if not key_col and len(columns) >= 2:
                key_col = columns[0]
                value_col = columns[1]
            
            return key_col, value_col
            
        except Exception:
            return None, None
    
    def _parse_config_table(
        self, 
        conn: sqlite3.Connection, 
        table: str,
        key_col: str,
        value_col: str,
        parsed: ParsedConfig
    ) -> None:
        cursor = conn.cursor()
        
        try:
            cursor.execute(f"SELECT {key_col}, {value_col} FROM {table}")
            
            for row in cursor.fetchall():
                key = str(row[0]) if row[0] is not None else ""
                value = row[1]
                
                if key:
                    parsed_value = self._parse_value(value)
                    
                    config_value = ConfigValue(
                        key=key,
                        value=parsed_value,
                        source=ConfigSource.SQLITE_DB,
                        source_path=parsed.source_path,
                        is_sensitive=self._detect_sensitive_key(key),
                    )
                    parsed.values[key] = config_value
                    
        except Exception as e:
            parsed.errors.append(f"Error reading table '{table}': {str(e)}")
    
    def _parse_value(self, value: Any) -> Any:
        if value is None:
            return None
        
        if isinstance(value, str):
            if value.lower() == 'true':
                return True
            if value.lower() == 'false':
                return False
            if value.lower() == 'null' or value.lower() == 'none':
                return None
            
            try:
                import json
                return json.loads(value)
            except (json.JSONDecodeError, ValueError):
                pass
            
            try:
                return int(value)
            except ValueError:
                pass
            
            try:
                return float(value)
            except ValueError:
                pass
        
        return value
