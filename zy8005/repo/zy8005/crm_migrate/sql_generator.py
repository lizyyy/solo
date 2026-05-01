from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple


class SQLGenerator:
    def __init__(self, schema_config: Any, mapping_config: Any):
        self.schema = schema_config
        self.mapping = mapping_config
    
    def escape_string(self, value: Any) -> str:
        if value is None:
            return "NULL"
        
        str_val = str(value)
        escaped = str_val.replace("'", "''").replace("\\", "\\\\")
        return f"'{escaped}'"
    
    def format_value(self, value: Any, column_config: Dict[str, Any]) -> str:
        if value is None:
            default_val = column_config.get("default")
            if default_val is not None:
                return self.escape_string(default_val)
            return "NULL"
        
        col_type = column_config.get("type", "string").lower()
        
        if col_type in ("integer", "int", "bigint"):
            try:
                return str(int(float(value)))
            except (ValueError, TypeError):
                return self.escape_string(value)
        
        elif col_type in ("float", "decimal", "double"):
            try:
                return str(float(value))
            except (ValueError, TypeError):
                return self.escape_string(value)
        
        elif col_type == "boolean":
            lower_val = str(value).lower().strip()
            if lower_val in ("true", "yes", "y", "1", "on"):
                return "TRUE"
            elif lower_val in ("false", "no", "n", "0", "off"):
                return "FALSE"
            return self.escape_string(value)
        
        elif col_type in ("date", "datetime", "timestamp"):
            return self.escape_string(value)
        
        else:
            return self.escape_string(value)
    
    def generate_insert(
        self,
        table_name: str,
        row: Dict[str, Any],
        source_info: Optional[Dict[str, Any]] = None,
    ) -> str:
        columns = self.schema.get_columns(table_name)
        field_mappings = self.mapping.get_field_mappings(table_name)
        
        insert_columns: List[str] = []
        insert_values: List[str] = []
        
        for col_name, col_config in columns.items():
            if col_config.get("auto_increment", False):
                continue
            
            if col_name in field_mappings:
                value = row.get(col_name)
                insert_columns.append(col_name)
                insert_values.append(self.format_value(value, col_config))
            elif col_config.get("default") is not None:
                insert_columns.append(col_name)
                insert_values.append(self.format_value(col_config["default"], col_config))
        
        comment = ""
        if source_info:
            source_file = source_info.get("source_file", "")
            row_num = source_info.get("row_num", "")
            natural_keys = self.mapping.get_natural_keys(table_name)
            key_values = []
            for nk in natural_keys:
                if nk in row:
                    key_values.append(f"{nk}={row.get(nk)}")
            key_str = ", ".join(key_values) if key_values else ""
            comment_parts = [f"源文件: {source_file}", f"行号: {row_num}"]
            if key_str:
                comment_parts.append(f"自然键: {key_str}")
            comment = " -- " + " | ".join(comment_parts)
        
        columns_str = ", ".join(insert_columns)
        values_str = ", ".join(insert_values)
        
        return f"INSERT INTO {table_name} ({columns_str}) VALUES ({values_str});{comment}"
    
    def generate_delete(
        self,
        table_name: str,
        row: Dict[str, Any],
    ) -> str:
        natural_keys = self.mapping.get_natural_keys(table_name)
        
        if not natural_keys:
            first_col = next(iter(self.schema.get_columns(table_name).keys()), None)
            if first_col and first_col in row:
                natural_keys = [first_col]
            else:
                return f"-- WARN: 无法生成删除语句 - 表 '{table_name}' 没有定义自然键且无法确定唯一标识"
        
        conditions: List[str] = []
        for nk in natural_keys:
            if nk in row and row[nk] is not None:
                col_config = self.schema.get_columns(table_name).get(nk, {})
                conditions.append(f"{nk} = {self.format_value(row[nk], col_config)}")
            else:
                conditions.append(f"{nk} IS NULL")
        
        where_clause = " AND ".join(conditions)
        return f"DELETE FROM {table_name} WHERE {where_clause};"
    
    def generate_migrate_sql(
        self,
        sorted_tables: List[str],
        table_data: Dict[str, List[Dict[str, Any]]],
        has_errors: bool = False,
    ) -> str:
        lines: List[str] = []
        
        lines.append("-- ============================================")
        lines.append("-- CRM 数据迁移脚本")
        lines.append(f"-- 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("-- ============================================")
        lines.append("")
        
        if has_errors:
            lines.append("-- ============================================")
            lines.append("-- ⚠️ 警告：此脚本包含错误的草稿版本")
            lines.append("-- 预检发现阻断迁移的错误，不建议直接执行")
            lines.append("-- ============================================")
            lines.append("")
        
        lines.append("SET FOREIGN_KEY_CHECKS = 0;")
        lines.append("")
        
        for table_name in sorted_tables:
            rows = table_data.get(table_name, [])
            if not rows:
                continue
            
            lines.append(f"-- ============================================")
            lines.append(f"-- 表: {table_name}")
            lines.append(f"-- 记录数: {len(rows)}")
            lines.append(f"-- ============================================")
            lines.append("")
            
            for row in rows:
                source_info = {
                    "source_file": row.get("_source_file", ""),
                    "row_num": row.get("_row_num", ""),
                }
                insert_sql = self.generate_insert(table_name, row, source_info)
                lines.append(insert_sql)
            
            lines.append("")
        
        lines.append("SET FOREIGN_KEY_CHECKS = 1;")
        lines.append("")
        lines.append("-- ============================================")
        lines.append("-- 迁移脚本结束")
        lines.append("-- ============================================")
        
        return "\n".join(lines)
    
    def generate_rollback_sql(
        self,
        sorted_tables: List[str],
        table_data: Dict[str, List[Dict[str, Any]]],
    ) -> str:
        lines: List[str] = []
        
        lines.append("-- ============================================")
        lines.append("-- CRM 数据回滚脚本")
        lines.append(f"-- 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("-- ============================================")
        lines.append("")
        
        lines.append("SET FOREIGN_KEY_CHECKS = 0;")
        lines.append("")
        
        for table_name in sorted_tables:
            rows = table_data.get(table_name, [])
            if not rows:
                continue
            
            lines.append(f"-- ============================================")
            lines.append(f"-- 表: {table_name} (回滚顺序)")
            lines.append(f"-- 记录数: {len(rows)}")
            lines.append(f"-- ============================================")
            lines.append("")
            
            for row in reversed(rows):
                delete_sql = self.generate_delete(table_name, row)
                lines.append(delete_sql)
            
            lines.append("")
        
        lines.append("SET FOREIGN_KEY_CHECKS = 1;")
        lines.append("")
        lines.append("-- ============================================")
        lines.append("-- 回滚脚本结束")
        lines.append("-- ============================================")
        
        return "\n".join(lines)
