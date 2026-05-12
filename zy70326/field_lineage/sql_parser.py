from typing import List, Set, Tuple, Dict, Optional
from dataclasses import dataclass
import re

try:
    import sqlglot
    from sqlglot import exp
    SQLGLOT_AVAILABLE = True
except ImportError:
    SQLGLOT_AVAILABLE = False


@dataclass
class SQLAnalysisResult:
    source_tables: List[str]
    source_fields: List[Tuple[str, str]]
    target_table: str
    target_fields: List[str]
    field_dependencies: Dict[str, List[Tuple[str, str]]]
    parse_error: Optional[str] = None


class SQLParser:
    def __init__(self):
        self.use_sqlglot = SQLGLOT_AVAILABLE
    
    def parse(self, sql: str, target_table: str = "", target_fields: List[str] = None) -> SQLAnalysisResult:
        if target_fields is None:
            target_fields = []
        
        if self.use_sqlglot:
            return self._parse_with_sqlglot(sql, target_table, target_fields)
        else:
            return self._parse_regex(sql, target_table, target_fields)
    
    def _parse_with_sqlglot(self, sql: str, target_table: str, target_fields: List[str]) -> SQLAnalysisResult:
        try:
            parsed = sqlglot.parse_one(sql)
        except Exception as e:
            return self._parse_regex(sql, target_table, target_fields, parse_error=str(e))
        
        source_tables = []
        source_fields = []
        field_dependencies = {}
        
        insert_into = parsed.find(exp.Insert)
        insert_table_name = None
        if insert_into and insert_into.this:
            insert_table_name = insert_into.this.name
            if insert_into.this.db:
                insert_table_name = f"{insert_into.this.db}.{insert_table_name}"
        
        aliases = {}
        from_clause_tables = set()
        
        for table_alias in parsed.find_all(exp.TableAlias):
            if isinstance(table_alias.this, exp.Identifier):
                alias_name = table_alias.this.name
                table_node = table_alias.parent
                if isinstance(table_node, exp.Table):
                    table_name = table_node.name
                    if table_node.db:
                        table_name = f"{table_node.db}.{table_name}"
                    aliases[alias_name] = table_name
                    from_clause_tables.add(table_name)
        
        select_stmt = parsed.find(exp.Select)
        
        if select_stmt:
            for t in select_stmt.find_all(exp.Table):
                table_name = t.name
                if t.db:
                    table_name = f"{t.db}.{table_name}"
                from_clause_tables.add(table_name)
        
        source_tables = list(from_clause_tables)
        
        if select_stmt:
            select_cols = []
            for expr in select_stmt.find_all(exp.Column):
                table_alias = expr.table or ""
                col_name = expr.name
                if col_name:
                    select_cols.append((table_alias, col_name))
            
            source_fields_set = set()
            for table_alias, col_name in select_cols:
                actual_table = aliases.get(table_alias, table_alias)
                if actual_table and actual_table in from_clause_tables:
                    source_fields_set.add((actual_table, col_name))
                elif not actual_table:
                    for st in source_tables:
                        source_fields_set.add((st, col_name))
            
            source_fields = list(source_fields_set)
            
            for i, selection in enumerate(select_stmt.expressions):
                if isinstance(selection, exp.Alias):
                    alias_name = selection.alias
                    if alias_name:
                        cols_in_expr = []
                        for col in selection.find_all(exp.Column):
                            t_alias = col.table or ""
                            c_name = col.name
                            actual_t = aliases.get(t_alias, t_alias)
                            if actual_t and actual_t in from_clause_tables:
                                cols_in_expr.append((actual_t, c_name))
                            elif not actual_t:
                                for st in source_tables:
                                    cols_in_expr.append((st, c_name))
                        if alias_name not in field_dependencies:
                            field_dependencies[alias_name] = []
                        field_dependencies[alias_name].extend(cols_in_expr)
                elif isinstance(selection, exp.Column):
                    col_name = selection.name
                    if col_name not in field_dependencies:
                        field_dependencies[col_name] = []
                    t_alias = selection.table or ""
                    actual_t = aliases.get(t_alias, t_alias)
                    if actual_t and actual_t in from_clause_tables:
                        field_dependencies[col_name].append((actual_t, col_name))
                    elif not actual_t:
                        for st in source_tables:
                            field_dependencies[col_name].append((st, col_name))
            
            if not target_fields:
                for selection in select_stmt.expressions:
                    if isinstance(selection, exp.Alias):
                        target_fields.append(selection.alias)
                    elif isinstance(selection, exp.Column):
                        target_fields.append(selection.name)
        
        if insert_table_name:
            target_table = insert_table_name
        
        return SQLAnalysisResult(
            source_tables=source_tables,
            source_fields=source_fields,
            target_table=target_table,
            target_fields=target_fields,
            field_dependencies=field_dependencies
        )
    
    def _parse_regex(self, sql: str, target_table: str, target_fields: List[str], parse_error: str = None) -> SQLAnalysisResult:
        source_tables = []
        source_fields = []
        field_dependencies = {}
        
        sql_upper = sql.upper()
        sql_clean = re.sub(r'--.*$', '', sql, flags=re.MULTILINE)
        sql_clean = re.sub(r'/\*.*?\*/', '', sql_clean, flags=re.DOTALL)
        
        from_pattern = r'\bFROM\s+([\w.]+)(?:\s+AS\s+(\w+)|\s+(\w+))?'
        join_pattern = r'\bJOIN\s+([\w.]+)(?:\s+AS\s+(\w+)|\s+(\w+))?'
        
        aliases = {}
        for match in re.finditer(from_pattern, sql_clean, re.IGNORECASE):
            table_name = match.group(1)
            alias = match.group(2) or match.group(3) or ""
            if table_name not in source_tables:
                source_tables.append(table_name)
            if alias:
                aliases[alias] = table_name
        
        for match in re.finditer(join_pattern, sql_clean, re.IGNORECASE):
            table_name = match.group(1)
            alias = match.group(2) or match.group(3) or ""
            if table_name not in source_tables:
                source_tables.append(table_name)
            if alias:
                aliases[alias] = table_name
        
        select_match = re.search(r'SELECT\s+(.*?)\s+FROM', sql_clean, re.IGNORECASE | re.DOTALL)
        if select_match:
            select_clause = select_match.group(1)
            col_pattern = r'([\w.]+)\s*(?:AS\s+(\w+))?'
            for col_match in re.finditer(col_pattern, select_clause):
                full_col = col_match.group(1)
                alias = col_match.group(2)
                
                if '.' in full_col:
                    parts = full_col.split('.')
                    table_alias = parts[0]
                    col_name = parts[-1]
                    actual_table = aliases.get(table_alias, table_alias)
                    source_fields.append((actual_table, col_name))
                    
                    if alias:
                        if alias not in field_dependencies:
                            field_dependencies[alias] = []
                        field_dependencies[alias].append((actual_table, col_name))
                elif full_col != '*':
                    col_name = full_col
                    if alias:
                        if alias not in field_dependencies:
                            field_dependencies[alias] = []
                        for st in source_tables:
                            field_dependencies[alias].append((st, col_name))
        
        if not target_table:
            insert_match = re.search(r'INSERT\s+INTO\s+([\w.]+)', sql_clean, re.IGNORECASE)
            if insert_match:
                target_table = insert_match.group(1)
        
        if not target_fields:
            if select_match:
                select_clause = select_match.group(1)
                alias_pattern = r'AS\s+(\w+)'
                for alias_match in re.finditer(alias_pattern, select_clause, re.IGNORECASE):
                    target_fields.append(alias_match.group(1))
        
        return SQLAnalysisResult(
            source_tables=source_tables,
            source_fields=source_fields,
            target_table=target_table,
            target_fields=target_fields,
            field_dependencies=field_dependencies,
            parse_error=parse_error
        )
