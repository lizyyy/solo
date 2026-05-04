"""
Parsers for various input file formats.
"""

import csv
import hashlib
import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, TextIO, Tuple

import sqlparse
import yaml

from .models import (
    Column,
    DatabaseType,
    ExplainPlanNode,
    ExplainResult,
    Index,
    IndexPolicy,
    IndexPolicyRule,
    IndexType,
    Schema,
    SlowQuery,
    Table,
    TableStats,
    WriteLoadMetrics,
)


class ParseError(Exception):
    pass


def detect_database_type(sql_content: str) -> DatabaseType:
    mysql_keywords = [
        "AUTO_INCREMENT",
        "ENGINE=",
        "CHARSET=",
        "UNSIGNED",
        "DATETIME(6)",
        "COMMENT '",
    ]
    pg_keywords = [
        "SERIAL",
        "BIGSERIAL",
        "UUID DEFAULT uuid_generate_v4()",
        "TIMESTAMP WITH TIME ZONE",
        "CREATE INDEX CONCURRENTLY",
        "USING gin",
        "USING btree",
    ]
    
    sql_upper = sql_content.upper()
    mysql_score = sum(1 for kw in mysql_keywords if kw.upper() in sql_upper)
    pg_score = sum(1 for kw in pg_keywords if kw.upper() in sql_upper)
    
    if mysql_score > pg_score:
        return DatabaseType.MYSQL
    if pg_score > mysql_score:
        return DatabaseType.POSTGRESQL
    return DatabaseType.MYSQL


def extract_table_name(sql: str) -> Optional[str]:
    create_table_match = re.search(
        r"CREATE\s+(?:TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[`\"]?(\w+)[`\"]?\.)?[`\"]?(\w+)[`\"]?",
        sql,
        re.IGNORECASE,
    )
    if create_table_match:
        schema = create_table_match.group(1)
        table = create_table_match.group(2)
        return table
    return None


def parse_column_definition(col_sql: str, db_type: DatabaseType) -> Optional[Column]:
    col_sql = col_sql.strip()
    if not col_sql or col_sql.startswith("--") or col_sql.startswith("/*"):
        return None
    if col_sql.upper().startswith("PRIMARY KEY") or col_sql.upper().startswith("FOREIGN KEY"):
        return None
    if col_sql.upper().startswith("INDEX") or col_sql.upper().startswith("KEY"):
        return None
    if col_sql.upper().startswith("CONSTRAINT") or col_sql.upper().startswith("UNIQUE"):
        return None
    
    name_match = re.match(r"^[`\"]?(\w+)[`\"]?", col_sql)
    if not name_match:
        return None
    
    name = name_match.group(1)
    remaining = col_sql[name_match.end():].strip()
    
    type_match = re.match(
        r"^([a-zA-Z_]+)(?:\s*\((\d+(?:\s*,\s*\d+)?)\))?(?:\s+unsigned)?(?:\s+zerofill)?",
        remaining,
        re.IGNORECASE,
    )
    if type_match:
        data_type = type_match.group(1).upper()
        if type_match.group(2):
            data_type += f"({type_match.group(2)})"
    else:
        data_type = "UNKNOWN"
    
    is_nullable = "NOT NULL" not in remaining.upper()
    is_primary = False
    
    if "PRIMARY KEY" in remaining.upper():
        is_primary = True
        is_nullable = False
    
    default_match = re.search(
        r"DEFAULT\s+(?:(?:N'([^']*)')|(?:'([^']*)')|(\d+(?:\.\d+)?)|(NULL)|(CURRENT_TIMESTAMP|NOW|NOW\(\)|LOCALTIME|LOCALTIMESTAMP))",
        remaining,
        re.IGNORECASE,
    )
    default = None
    if default_match:
        if default_match.group(1):
            default = default_match.group(1)
        elif default_match.group(2):
            default = default_match.group(2)
        elif default_match.group(3):
            default = default_match.group(3)
        elif default_match.group(4):
            default = "NULL"
        elif default_match.group(5):
            default = default_match.group(5).upper()
    
    return Column(
        name=name,
        data_type=data_type,
        nullable=is_nullable,
        default=default,
        is_primary=is_primary,
    )


def extract_indexes_from_create_table(sql: str, table_name: str, db_type: DatabaseType) -> List[Index]:
    indexes = []
    
    pk_constraint_match = re.search(
        r"PRIMARY\s+KEY\s*\(([^)]+)\)",
        sql,
        re.IGNORECASE | re.MULTILINE,
    )
    if pk_constraint_match:
        cols = [c.strip().strip("`\"") for c in pk_constraint_match.group(1).split(",")]
        indexes.append(
            Index(
                name="PRIMARY",
                columns=cols,
                index_type=IndexType.BTREE,
                is_primary=True,
                is_unique=True,
                table_name=table_name,
            )
        )
    
    unique_patterns = [
        r"UNIQUE\s+(?:INDEX|KEY)?\s*(?:[`\"]?(\w+)[`\"]?)?\s*\(([^)]+)\)",
        r"CONSTRAINT\s+[`\"]?(\w+)[`\"]?\s+UNIQUE\s+(?:INDEX|KEY)?\s*\(([^)]+)\)",
    ]
    
    for pattern in unique_patterns:
        for match in re.finditer(pattern, sql, re.IGNORECASE | re.MULTILINE):
            name = match.group(1) or f"uk_{table_name}"
            cols = [c.strip().strip("`\"") for c in match.group(2).split(",")]
            indexes.append(
                Index(
                    name=name,
                    columns=cols,
                    index_type=IndexType.BTREE,
                    is_primary=False,
                    is_unique=True,
                    table_name=table_name,
                )
            )
    
    index_patterns = [
        r"(?:INDEX|KEY)\s+(?:[`\"]?(\w+)[`\"]?)?\s*\(([^)]+)\)",
    ]
    
    for pattern in index_patterns:
        for match in re.finditer(pattern, sql, re.IGNORECASE | re.MULTILINE):
            match_str = match.group(0).upper()
            if "UNIQUE" in match_str or "PRIMARY" in match_str or "FOREIGN" in match_str:
                continue
            
            name = match.group(1) or f"idx_{table_name}"
            cols = [c.strip().strip("`\"") for c in match.group(2).split(",")]
            
            exists = any(idx.name == name for idx in indexes)
            if not exists:
                indexes.append(
                    Index(
                        name=name,
                        columns=cols,
                        index_type=IndexType.BTREE,
                        is_primary=False,
                        is_unique=False,
                        table_name=table_name,
                    )
                )
    
    return indexes


def parse_create_index(sql: str, db_type: DatabaseType) -> Optional[Index]:
    create_index_match = re.search(
        r"CREATE\s+(?:UNIQUE\s+)?(?:INDEX|KEY)\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?[`\"]?(\w+)[`\"]?\s+ON\s+(?:[`\"]?(\w+)[`\"]?\.)?[`\"]?(\w+)[`\"]?",
        sql,
        re.IGNORECASE,
    )
    
    if not create_index_match:
        return None
    
    index_name = create_index_match.group(1)
    table_schema = create_index_match.group(2)
    table_name = create_index_match.group(3)
    
    cols_match = re.search(r"\(\s*([^)]+)\s*\)", sql)
    cols = []
    if cols_match:
        cols = [c.strip().strip("`\"") for c in cols_match.group(1).split(",")]
    
    is_unique = "UNIQUE" in sql.upper()
    
    index_type = IndexType.BTREE
    using_match = re.search(r"USING\s+(btree|hash|gin|gist|fulltext|spatial)", sql, re.IGNORECASE)
    if using_match:
        type_map = {
            "btree": IndexType.BTREE,
            "hash": IndexType.HASH,
            "gin": IndexType.GIN,
            "gist": IndexType.GIST,
            "fulltext": IndexType.FULLTEXT,
            "spatial": IndexType.SPATIAL,
        }
        index_type = type_map.get(using_match.group(1).lower(), IndexType.BTREE)
    
    return Index(
        name=index_name,
        columns=cols,
        index_type=index_type,
        is_unique=is_unique,
        is_primary=False,
        table_name=table_name,
    )


def parse_schema(sql_content: str, db_type: Optional[DatabaseType] = None) -> Schema:
    if not db_type:
        db_type = detect_database_type(sql_content)
    
    tables: Dict[str, Table] = {}
    
    statements = sqlparse.split(sql_content)
    
    for stmt in statements:
        stmt = stmt.strip()
        if not stmt:
            continue
        
        stmt_upper = stmt.upper()
        
        if "CREATE TABLE" in stmt_upper and "CREATE TABLESPACE" not in stmt_upper:
            table_name = extract_table_name(stmt)
            if not table_name:
                continue
            
            columns = []
            col_defs_match = re.search(r"\(([\s\S]+)\)", stmt)
            if col_defs_match:
                col_defs_str = col_defs_match.group(1)
                col_defs = split_column_definitions(col_defs_str)
                
                for col_def in col_defs:
                    col = parse_column_definition(col_def, db_type)
                    if col:
                        columns.append(col)
            
            table = Table(
                name=table_name,
                schema="public" if db_type == DatabaseType.POSTGRESQL else "dbo",
                columns=columns,
                indexes=[],
            )
            
            inline_indexes = extract_indexes_from_create_table(stmt, table_name, db_type)
            table.indexes = inline_indexes
            
            tables[table_name] = table
        
        elif "CREATE INDEX" in stmt_upper or "CREATE UNIQUE INDEX" in stmt_upper:
            idx = parse_create_index(stmt, db_type)
            if idx:
                if idx.table_name in tables:
                    exists = any(i.name == idx.name for i in tables[idx.table_name].indexes)
                    if not exists:
                        tables[idx.table_name].indexes.append(idx)
    
    return Schema(
        database_type=db_type,
        tables=tables,
        raw_sql=sql_content,
    )


def split_column_definitions(text: str) -> List[str]:
    defs = []
    current = ""
    paren_level = 0
    
    for char in text:
        if char == "(":
            paren_level += 1
            current += char
        elif char == ")":
            paren_level -= 1
            current += char
        elif char == "," and paren_level == 0:
            if current.strip():
                defs.append(current.strip())
            current = ""
        else:
            current += char
    
    if current.strip():
        defs.append(current.strip())
    
    return defs


def normalize_query(query: str) -> str:
    normalized = re.sub(r"'[^']*'", "'?", query)
    normalized = re.sub(r"\b\d+\b", "?", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def generate_query_id(query: str) -> str:
    normalized = normalize_query(query)
    return hashlib.md5(normalized.encode()).hexdigest()[:12]


def parse_slow_query_jsonl(file: TextIO) -> List[SlowQuery]:
    queries = []
    db_type = DatabaseType.MYSQL
    
    for line in file:
        line = line.strip()
        if not line:
            continue
        
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            continue
        
        query = data.get("query", data.get("sql", data.get("Query_time", "")))
        if not query or not isinstance(query, str):
            continue
        
        normalized = normalize_query(query)
        query_id = generate_query_id(query)
        
        exec_time = float(data.get("Query_time", data.get("duration", data.get("execution_time_ms", 0))))
        exec_time_ms = exec_time if exec_time > 100 else exec_time * 1000
        
        timestamp = None
        ts = data.get("timestamp", data.get("start_time", None))
        if ts:
            if isinstance(ts, str):
                try:
                    timestamp = datetime.fromisoformat(ts)
                except ValueError:
                    try:
                        timestamp = datetime.strptime(ts, "%Y-%m-%d %H:%M:%S")
                    except ValueError:
                        pass
            elif isinstance(ts, (int, float)):
                timestamp = datetime.fromtimestamp(ts)
        
        rows_sent = data.get("Rows_sent", data.get("rows_sent", None))
        rows_examined = data.get("Rows_examined", data.get("rows_examined", None))
        frequency = int(data.get("frequency", data.get("count", 1)))
        user = data.get("user", data.get("User", None))
        host = data.get("host", data.get("Host", None))
        
        tables = extract_tables_from_query(query)
        
        queries.append(
            SlowQuery(
                query_id=query_id,
                query=query,
                normalized_query=normalized,
                db_type=db_type,
                execution_time_ms=exec_time_ms,
                rows_sent=rows_sent,
                rows_examined=rows_examined,
                timestamp=timestamp,
                frequency=frequency,
                tables_involved=tables,
                user=user,
                host=host,
            )
        )
    
    return queries


def extract_tables_from_query(query: str) -> List[str]:
    tables = []
    
    patterns = [
        r"FROM\s+(?:\w+\.)?([a-zA-Z_][a-zA-Z0-9_]*)",
        r"JOIN\s+(?:\w+\.)?([a-zA-Z_][a-zA-Z0-9_]*)",
        r"UPDATE\s+(?:\w+\.)?([a-zA-Z_][a-zA-Z0-9_]*)",
        r"INSERT\s+INTO\s+(?:\w+\.)?([a-zA-Z_][a-zA-Z0-9_]*)",
        r"DELETE\s+FROM\s+(?:\w+\.)?([a-zA-Z_][a-zA-Z0-9_]*)",
    ]
    
    for pattern in patterns:
        for match in re.finditer(pattern, query, re.IGNORECASE):
            table = match.group(1)
            if table not in tables and table.upper() not in ["SELECT", "WHERE", "AND", "OR", "NULL", "TRUE", "FALSE"]:
                tables.append(table)
    
    return tables


def extract_where_columns(query: str) -> List[str]:
    columns: List[str] = []
    
    where_match = re.search(r"\bWHERE\b(.*?)(?:\b(?:GROUP|ORDER|LIMIT|HAVING|UNION)\b|$)", 
                           query, re.IGNORECASE | re.DOTALL)
    if not where_match:
        return columns
    
    where_clause = where_match.group(1)
    
    patterns = [
        r"(\w+)\s*(?:=|>|<|>=|<=|<>|!=|LIKE|IN|BETWEEN)\s",
        r"(\w+)\s+IS\s+(?:NOT\s+)?NULL",
    ]
    
    for pattern in patterns:
        for match in re.finditer(pattern, where_clause, re.IGNORECASE):
            col = match.group(1)
            if col.upper() not in ["AND", "OR", "NOT", "NULL", "TRUE", "FALSE", "SELECT", "WHERE"]:
                if col not in columns:
                    columns.append(col)
    
    return columns


def parse_explain_result(json_content: str) -> List[ExplainResult]:
    results = []
    
    try:
        data = json.loads(json_content)
    except json.JSONDecodeError:
        lines = [l.strip() for l in json_content.strip().split("\n") if l.strip()]
        objects = []
        for line in lines:
            if line.startswith("{"):
                objects.append(line)
        
        for obj_str in objects:
            try:
                obj = json.loads(obj_str)
                results.append(parse_single_explain(obj))
            except json.JSONDecodeError:
                continue
        return results
    
    if isinstance(data, list):
        for item in data:
            results.append(parse_single_explain(item))
    else:
        results.append(parse_single_explain(data))
    
    return results


def parse_single_explain(data: Dict[str, Any]) -> ExplainResult:
    query = data.get("query", data.get("sql", ""))
    normalized = normalize_query(query)
    
    plan_nodes: List[ExplainPlanNode] = []
    table_scans: List[str] = []
    index_uses: List[Dict[str, Any]] = []
    
    if "Plan" in data:
        root_plan = data["Plan"]
        plan_nodes = flatten_explain_plan(root_plan, 0)
    elif isinstance(data, list):
        for i, item in enumerate(data):
            node = parse_explain_row(item, i)
            if node:
                plan_nodes.append(node)
    
    for node in plan_nodes:
        if node.access_type in ["ALL", "ALL "] or (node.extra and "Using filesort" in node.extra):
            if node.table_name and node.table_name not in table_scans:
                table_scans.append(node.table_name)
        
        if node.key_used and node.key_used != "NULL":
            index_uses.append({
                "table": node.table_name,
                "index": node.key_used,
                "type": node.access_type,
                "rows": node.rows,
            })
    
    total_cost = data.get("Total Cost", data.get("total_cost", None))
    
    db_type = DatabaseType.MYSQL
    if "Plan" in data and "CTE Scan" in str(data):
        db_type = DatabaseType.POSTGRESQL
    
    return ExplainResult(
        query=query,
        normalized_query=normalized,
        plan=plan_nodes,
        total_cost=total_cost,
        database_type=db_type,
        table_scans=table_scans,
        index_uses=index_uses,
    )


def flatten_explain_plan(plan: Dict[str, Any], node_id: int) -> List[ExplainPlanNode]:
    nodes = []
    
    filtered_value = None
    filter_condition = None
    
    if "filtered" in plan:
        filtered_value = plan.get("filtered")
    
    filter_str = plan.get("Filter", None)
    if filter_str and isinstance(filter_str, str):
        filter_condition = filter_str
    elif filter_str is not None and not isinstance(filter_str, (int, float)):
        filter_condition = str(filter_str)
    
    node = ExplainPlanNode(
        id=node_id,
        select_type=plan.get("Node Type", plan.get("select_type", "SIMPLE")),
        table_name=plan.get("Relation Name", plan.get("table", "")),
        access_type=plan.get("Node Type", plan.get("type", "UNKNOWN")),
        possible_keys=[],
        key_used=plan.get("Index Name", plan.get("key", None)),
        rows=plan.get("Plan Rows", plan.get("rows", None)),
        filtered=filtered_value,
        filter_condition=filter_condition,
        extra=str(plan.get("Extra", plan.get("Filter", "") if filter_condition is None else "")),
        children=[],
    )
    
    possible = plan.get("possible_keys", [])
    if isinstance(possible, str):
        node.possible_keys = [k.strip() for k in possible.split(",")]
    elif isinstance(possible, list):
        node.possible_keys = possible
    
    nodes.append(node)
    
    if "Plans" in plan:
        for i, sub_plan in enumerate(plan["Plans"]):
            sub_nodes = flatten_explain_plan(sub_plan, node_id + i + 1)
            nodes.extend(sub_nodes)
    
    return nodes


def parse_explain_row(row: Dict[str, Any], idx: int) -> Optional[ExplainPlanNode]:
    if not isinstance(row, dict):
        return None
    
    table = row.get("table", row.get("Table", ""))
    if not table:
        return None
    
    access_type = row.get("type", row.get("Type", "ALL"))
    key = row.get("key", row.get("Key", None))
    key_len = row.get("key_len", row.get("key_len", None))
    ref = row.get("ref", row.get("Ref", []))
    rows = row.get("rows", row.get("Rows", None))
    extra = row.get("Extra", row.get("extra", None))
    
    if isinstance(ref, str):
        ref = [r.strip() for r in ref.split(",")]
    
    return ExplainPlanNode(
        id=idx,
        select_type=row.get("select_type", "SIMPLE"),
        table_name=table,
        access_type=access_type,
        possible_keys=[],
        key_used=key,
        key_len=key_len,
        ref=ref if isinstance(ref, list) else [],
        rows=rows,
        extra=extra,
        children=[],
    )


def parse_table_stats_csv(file: TextIO) -> List[TableStats]:
    stats_list = []
    reader = csv.DictReader(file)
    
    for row in reader:
        table_name = row.get("table_name", row.get("table", ""))
        if not table_name:
            continue
        
        row_count = int(row.get("row_count", row.get("rows", row.get("count", 0))))
        data_size = int(row.get("data_size_bytes", row.get("data_size", row.get("size", 0))))
        index_size = int(row.get("index_size_bytes", row.get("index_size", 0)))
        
        last_analyzed = None
        ts = row.get("last_analyzed", row.get("analyzed_at", None))
        if ts:
            try:
                last_analyzed = datetime.fromisoformat(ts)
            except ValueError:
                pass
        
        col_stats = {}
        idx_stats = {}
        
        for key, value in row.items():
            if key.startswith("col_"):
                parts = key.split("_", 2)
                if len(parts) >= 3:
                    col_name = parts[1]
                    stat_name = parts[2]
                    if col_name not in col_stats:
                        col_stats[col_name] = {}
                    col_stats[col_name][stat_name] = value
            elif key.startswith("idx_"):
                parts = key.split("_", 2)
                if len(parts) >= 3:
                    idx_name = parts[1]
                    stat_name = parts[2]
                    if idx_name not in idx_stats:
                        idx_stats[idx_name] = {}
                    idx_stats[idx_name][stat_name] = value
        
        stats_list.append(
            TableStats(
                table_name=table_name,
                row_count=row_count,
                data_size_bytes=data_size,
                index_size_bytes=index_size,
                last_analyzed=last_analyzed,
                column_stats=col_stats,
                index_stats=idx_stats,
            )
        )
    
    return stats_list


def parse_write_load_csv(file: TextIO) -> List[WriteLoadMetrics]:
    metrics_list = []
    reader = csv.DictReader(file)
    
    for row in reader:
        table_name = row.get("table_name", row.get("table", ""))
        if not table_name:
            continue
        
        ts_str = row.get("timestamp", row.get("time", row.get("datetime", "")))
        try:
            if ts_str:
                timestamp = datetime.fromisoformat(ts_str)
            else:
                timestamp = datetime.now()
        except ValueError:
            timestamp = datetime.now()
        
        insert_rate = float(row.get("insert_rate", row.get("inserts", 0)))
        update_rate = float(row.get("update_rate", row.get("updates", 0)))
        delete_rate = float(row.get("delete_rate", row.get("deletes", 0)))
        total_ops = float(row.get("total_write_ops", insert_rate + update_rate + delete_rate))
        latency = float(row.get("avg_write_latency_ms", row.get("latency_ms", 0)))
        
        metrics_list.append(
            WriteLoadMetrics(
                table_name=table_name,
                timestamp=timestamp,
                insert_rate=insert_rate,
                update_rate=update_rate,
                delete_rate=delete_rate,
                total_write_ops=total_ops,
                avg_write_latency_ms=latency,
            )
        )
    
    return metrics_list


def parse_index_policy(yaml_content: str) -> IndexPolicy:
    try:
        data = yaml.safe_load(yaml_content)
    except yaml.YAMLError:
        data = {}
    
    if not data:
        return IndexPolicy(
            policy_name="default",
            database_type=DatabaseType.MYSQL,
            rules=[],
        )
    
    db_type_str = data.get("database_type", data.get("db_type", "mysql")).lower()
    db_type = DatabaseType(db_type_str) if db_type_str in ["mysql", "postgres"] else DatabaseType.MYSQL
    
    rules_data = data.get("rules", [])
    rules = []
    
    for rule_data in rules_data:
        rule = IndexPolicyRule(
            rule_id=rule_data.get("rule_id", rule_data.get("id", "")),
            rule_type=rule_data.get("rule_type", rule_data.get("type", "")),
            description=rule_data.get("description", ""),
            severity=rule_data.get("severity", "info"),
            conditions=rule_data.get("conditions", {}),
            actions=rule_data.get("actions", []),
            enabled=rule_data.get("enabled", True),
        )
        rules.append(rule)
    
    return IndexPolicy(
        policy_name=data.get("policy_name", data.get("name", "default")),
        database_type=db_type,
        rules=rules,
        max_indexes_per_table=data.get("max_indexes_per_table", 10),
        max_columns_per_index=data.get("max_columns_per_index", 5),
        min_selectivity_for_index=data.get("min_selectivity_for_index", 0.1),
        write_cost_threshold=data.get("write_cost_threshold", 0.3),
    )
