import re
import json
from typing import Dict, List, Tuple
from database import ErrorLog, SessionLocal

class ExecutionPlanAnalyzer:
    def __init__(self):
        self.index_patterns = [
            (r'WHERE\s+(\w+)\s*=', 'single_column'),
            (r'WHERE\s+(\w+)\s+LIKE', 'like_pattern'),
            (r'JOIN\s+\w+\s+ON\s+(\w+)\.(\w+)\s*=', 'join_condition'),
            (r'GROUP\s+BY\s+(\w+)', 'group_by'),
            (r'ORDER\s+BY\s+(\w+)', 'order_by'),
        ]
    
    def generate_execution_plan(self, sql: str, database: str) -> Dict:
        plan = {
            "database": database,
            "table_scans": [],
            "potential_indexes": [],
            "join_operations": [],
            "estimated_cost": 0,
            "warnings": []
        }
        
        tables = self._extract_tables(sql)
        plan["table_scans"] = tables
        
        where_columns = self._extract_where_columns(sql)
        join_columns = self._extract_join_columns(sql)
        groupby_columns = self._extract_groupby_columns(sql)
        orderby_columns = self._extract_orderby_columns(sql)
        
        all_columns = list(set(where_columns + join_columns + groupby_columns + orderby_columns))
        
        for col in all_columns:
            plan["potential_indexes"].append({
                "column": col,
                "reason": self._get_index_reason(col, where_columns, join_columns, groupby_columns, orderby_columns)
            })
        
        if len(tables) > 3:
            plan["warnings"].append("多表联查超过3张表，建议优化查询结构")
        
        if "SELECT *" in sql.upper():
            plan["warnings"].append("使用SELECT *，建议只查询需要的字段")
        
        if "LIKE '%" in sql:
            plan["warnings"].append("前导通配符LIKE查询，无法使用索引")
        
        plan["estimated_cost"] = len(tables) * 10 + len(all_columns) * 5
        
        return plan
    
    def generate_index_suggestion(self, sql: str, execution_plan: Dict) -> str:
        suggestions = []
        columns = []
        
        for idx_info in execution_plan.get("potential_indexes", []):
            columns.append(idx_info["column"])
        
        if columns:
            composite_index = f"CREATE INDEX idx_composite ON table_name ({', '.join(columns[:3])});"
            suggestions.append(f"联合索引建议: {composite_index}")
        
        for warning in execution_plan.get("warnings", []):
            suggestions.append(f"优化建议: {warning}")
        
        if not suggestions:
            return "当前查询结构良好，无特殊索引建议"
        
        return "\n".join(suggestions)
    
    def validate_query(self, sql: str, affected_endpoints: str) -> Tuple[bool, str]:
        errors = []
        
        if not sql or len(sql.strip()) < 10:
            errors.append("SQL语句过短或为空")
        
        if not re.match(r'^\s*(SELECT|UPDATE|DELETE|INSERT)\s+', sql, re.IGNORECASE):
            errors.append("SQL语句格式不合法")
        
        if "DROP" in sql.upper() or "TRUNCATE" in sql.upper():
            errors.append("检测到危险SQL操作")
        
        if affected_endpoints:
            endpoints = [e.strip() for e in affected_endpoints.split(',') if e.strip()]
            if len(endpoints) > 10:
                errors.append(f"影响接口过多({len(endpoints)}个)，请确认是否准确")
        
        if errors:
            return False, "; ".join(errors)
        
        return True, ""
    
    def _extract_tables(self, sql: str) -> List[str]:
        tables = []
        from_match = re.search(r'FROM\s+(\w+)', sql, re.IGNORECASE)
        if from_match:
            tables.append(from_match.group(1))
        
        join_matches = re.findall(r'JOIN\s+(\w+)', sql, re.IGNORECASE)
        tables.extend(join_matches)
        
        return list(set(tables))
    
    def _extract_where_columns(self, sql: str) -> List[str]:
        columns = []
        where_match = re.search(r'WHERE\s+(.+?)(?:GROUP|ORDER|LIMIT|$)', sql, re.IGNORECASE | re.DOTALL)
        if where_match:
            where_clause = where_match.group(1)
            col_matches = re.findall(r'(\w+)\s*=', where_clause)
            columns.extend(col_matches)
        return columns
    
    def _extract_join_columns(self, sql: str) -> List[str]:
        columns = []
        join_matches = re.findall(r'JOIN\s+\w+\s+ON\s+(\w+)\.(\w+)', sql, re.IGNORECASE)
        for match in join_matches:
            columns.append(match[1])
        return columns
    
    def _extract_groupby_columns(self, sql: str) -> List[str]:
        columns = []
        groupby_match = re.search(r'GROUP\s+BY\s+(.+?)(?:ORDER|LIMIT|$)', sql, re.IGNORECASE | re.DOTALL)
        if groupby_match:
            cols = re.findall(r'(\w+)', groupby_match.group(1))
            columns.extend(cols)
        return columns
    
    def _extract_orderby_columns(self, sql: str) -> List[str]:
        columns = []
        orderby_match = re.search(r'ORDER\s+BY\s+(.+?)(?:LIMIT|$)', sql, re.IGNORECASE | re.DOTALL)
        if orderby_match:
            cols = re.findall(r'(\w+)', orderby_match.group(1))
            columns.extend(cols)
        return columns
    
    def _get_index_reason(self, col: str, where_cols: List[str], join_cols: List[str], 
                          groupby_cols: List[str], orderby_cols: List[str]) -> str:
        reasons = []
        if col in where_cols:
            reasons.append("WHERE过滤条件")
        if col in join_cols:
            reasons.append("JOIN关联条件")
        if col in groupby_cols:
            reasons.append("GROUP BY分组")
        if col in orderby_cols:
            reasons.append("ORDER BY排序")
        return ", ".join(reasons)

def log_error(error_type: str, error_message: str, context: str = ""):
    db = SessionLocal()
    try:
        error_log = ErrorLog(
            error_type=error_type,
            error_message=error_message,
            context=context
        )
        db.add(error_log)
        db.commit()
    finally:
        db.close()
