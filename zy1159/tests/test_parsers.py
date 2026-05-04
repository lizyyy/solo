"""
Tests for Index Analyzer parsers.
"""

import csv
import json
from io import StringIO

import pytest

from index_analyzer.models import DatabaseType, IndexIssueType, IndexType
from index_analyzer.parsers import (
    detect_database_type,
    extract_indexes_from_create_table,
    extract_tables_from_query,
    extract_where_columns,
    generate_query_id,
    normalize_query,
    parse_column_definition,
    parse_create_index,
    parse_explain_result,
    parse_index_policy,
    parse_schema,
    parse_slow_query_jsonl,
    parse_table_stats_csv,
    parse_write_load_csv,
)


class TestDatabaseTypeDetection:
    def test_detect_mysql_with_auto_increment(self):
        sql = "CREATE TABLE t (id INT AUTO_INCREMENT PRIMARY KEY) ENGINE=InnoDB"
        assert detect_database_type(sql) == DatabaseType.MYSQL
    
    def test_detect_postgres_with_serial(self):
        sql = "CREATE TABLE t (id SERIAL PRIMARY KEY)"
        assert detect_database_type(sql) == DatabaseType.POSTGRESQL
    
    def test_detect_postgres_with_using_btree(self):
        sql = "CREATE INDEX idx ON t USING btree (col)"
        assert detect_database_type(sql) == DatabaseType.POSTGRESQL
    
    def test_default_to_mysql_when_ambiguous(self):
        sql = "CREATE TABLE t (id INT)"
        assert detect_database_type(sql) == DatabaseType.MYSQL


class TestQueryNormalization:
    def test_normalize_string_literals(self):
        query = "SELECT * FROM users WHERE email = 'test@example.com'"
        normalized = normalize_query(query)
        assert "'test@example.com'" not in normalized
        assert "'?'" in normalized
    
    def test_normalize_numeric_literals(self):
        query = "SELECT * FROM orders WHERE id = 12345 AND amount > 100.50"
        normalized = normalize_query(query)
        assert "12345" not in normalized
        assert "100.50" not in normalized
    
    def test_generate_query_id_consistent(self):
        query1 = "SELECT * FROM users WHERE id = 1"
        query2 = "SELECT * FROM users WHERE id = 2"
        id1 = generate_query_id(query1)
        id2 = generate_query_id(query2)
        assert id1 == id2


class TestTableExtraction:
    def test_extract_from_simple_select(self):
        query = "SELECT * FROM users WHERE id = 1"
        tables = extract_tables_from_query(query)
        assert "users" in tables
    
    def test_extract_from_join(self):
        query = "SELECT * FROM users u JOIN orders o ON u.id = o.user_id"
        tables = extract_tables_from_query(query)
        assert "users" in tables
        assert "orders" in tables
    
    def test_extract_from_update(self):
        query = "UPDATE users SET status = 'active' WHERE id = 1"
        tables = extract_tables_from_query(query)
        assert "users" in tables
    
    def test_extract_from_insert(self):
        query = "INSERT INTO orders (user_id, amount) VALUES (1, 100.00)"
        tables = extract_tables_from_query(query)
        assert "orders" in tables
    
    def test_extract_from_delete(self):
        query = "DELETE FROM users WHERE status = 'inactive'"
        tables = extract_tables_from_query(query)
        assert "users" in tables


class TestColumnParsing:
    def test_parse_simple_varchar_column(self):
        col_sql = "email VARCHAR(255) NOT NULL"
        col = parse_column_definition(col_sql, DatabaseType.MYSQL)
        assert col is not None
        assert col.name == "email"
        assert col.data_type == "VARCHAR(255)"
        assert col.nullable == False
    
    def test_parse_int_with_auto_increment(self):
        col_sql = "id INT AUTO_INCREMENT PRIMARY KEY"
        col = parse_column_definition(col_sql, DatabaseType.MYSQL)
        assert col is not None
        assert col.name == "id"
        assert col.is_primary == True
        assert col.nullable == False
    
    def test_parse_column_with_default(self):
        col_sql = "status ENUM('active','inactive') DEFAULT 'active'"
        col = parse_column_definition(col_sql, DatabaseType.MYSQL)
        assert col is not None
        assert col.default == "active"
    
    def test_skip_primary_key_constraint(self):
        col_sql = "PRIMARY KEY (id)"
        col = parse_column_definition(col_sql, DatabaseType.MYSQL)
        assert col is None
    
    def test_skip_index_definition(self):
        col_sql = "INDEX idx_email (email)"
        col = parse_column_definition(col_sql, DatabaseType.MYSQL)
        assert col is None


class TestIndexExtraction:
    def test_extract_primary_key_from_create_table(self):
        sql = "CREATE TABLE t (id INT, PRIMARY KEY (id))"
        indexes = extract_indexes_from_create_table(sql, "t", DatabaseType.MYSQL)
        assert len(indexes) == 1
        assert indexes[0].is_primary == True
        assert indexes[0].columns == ["id"]
    
    def test_extract_unique_index(self):
        sql = "CREATE TABLE t (email VARCHAR(255), UNIQUE KEY uk_email (email))"
        indexes = extract_indexes_from_create_table(sql, "t", DatabaseType.MYSQL)
        assert len(indexes) == 1
        assert indexes[0].is_unique == True
        assert indexes[0].name == "uk_email"
    
    def test_extract_normal_index(self):
        sql = "CREATE TABLE t (status VARCHAR(20), INDEX idx_status (status))"
        indexes = extract_indexes_from_create_table(sql, "t", DatabaseType.MYSQL)
        assert len(indexes) == 1
        assert indexes[0].is_primary == False
        assert indexes[0].is_unique == False
    
    def test_parse_create_index_statement(self):
        sql = "CREATE INDEX idx_users_email ON users (email, status)"
        idx = parse_create_index(sql, DatabaseType.MYSQL)
        assert idx is not None
        assert idx.name == "idx_users_email"
        assert idx.table_name == "users"
        assert idx.columns == ["email", "status"]
    
    def test_parse_create_unique_index(self):
        sql = "CREATE UNIQUE INDEX uk_username ON users (username)"
        idx = parse_create_index(sql, DatabaseType.MYSQL)
        assert idx is not None
        assert idx.is_unique == True
    
    def test_parse_create_index_with_using(self):
        sql = "CREATE INDEX idx ON t USING gin (data)"
        idx = parse_create_index(sql, DatabaseType.POSTGRESQL)
        assert idx is not None
        assert idx.index_type == IndexType.GIN


class TestSchemaParsing:
    def test_parse_simple_create_table(self):
        sql = """
        CREATE TABLE users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            username VARCHAR(100) NOT NULL,
            INDEX idx_email (email)
        ) ENGINE=InnoDB;
        """
        schema = parse_schema(sql, DatabaseType.MYSQL)
        assert "users" in schema.tables
        assert len(schema.tables["users"].columns) == 3
        assert len(schema.tables["users"].indexes) == 2
    
    def test_parse_multiple_tables(self):
        sql = """
        CREATE TABLE users (id INT PRIMARY KEY);
        CREATE TABLE orders (id INT PRIMARY KEY, user_id INT);
        CREATE INDEX idx_orders_user ON orders(user_id);
        """
        schema = parse_schema(sql, DatabaseType.MYSQL)
        assert len(schema.tables) == 2
        assert "users" in schema.tables
        assert "orders" in schema.tables


class TestSlowQueryParsing:
    def test_parse_valid_jsonl(self):
        jsonl_content = json.dumps({
            "query": "SELECT * FROM users WHERE id = 1",
            "Query_time": 2.345,
            "Rows_sent": 1,
            "Rows_examined": 100,
            "timestamp": "2024-01-01T10:00:00",
        }) + "\n"
        
        queries = parse_slow_query_jsonl(StringIO(jsonl_content))
        assert len(queries) == 1
        assert queries[0].execution_time_ms > 0
    
    def test_skip_invalid_json_lines(self):
        content = '{"valid": true}\nthis is not json\n{"also_valid": true}\n'
        queries = parse_slow_query_jsonl(StringIO(content))
        assert len(queries) >= 1


class TestExplainParsing:
    def test_parse_postgres_explain_json(self):
        json_content = json.dumps({
            "query": "SELECT * FROM users WHERE status = 'active'",
            "Plan": {
                "Node Type": "Seq Scan",
                "Relation Name": "users",
                "Plan Rows": 1000,
            }
        })
        
        results = parse_explain_result(json_content)
        assert len(results) == 1
        assert results[0].query == "SELECT * FROM users WHERE status = 'active'"
    
    def test_parse_list_of_explains(self):
        json_content = json.dumps([
            {"query": "SELECT 1", "Plan": {"Node Type": "Result"}},
            {"query": "SELECT 2", "Plan": {"Node Type": "Result"}},
        ])
        
        results = parse_explain_result(json_content)
        assert len(results) == 2


class TestTableStatsParsing:
    def test_parse_csv_with_basic_columns(self):
        csv_content = """table_name,row_count,data_size_bytes,index_size_bytes
users,150000,45000000,28000000
orders,500000,180000000,95000000
"""
        stats = parse_table_stats_csv(StringIO(csv_content))
        assert len(stats) == 2
        assert stats[0].table_name == "users"
        assert stats[0].row_count == 150000
    
    def test_parse_column_stats(self):
        csv_content = """table_name,row_count,col_email_cardinality,col_status_cardinality
users,150000,148500,3
"""
        stats = parse_table_stats_csv(StringIO(csv_content))
        assert len(stats) == 1
        assert "email" in stats[0].column_stats
        assert "status" in stats[0].column_stats


class TestWriteLoadParsing:
    def test_parse_write_load_csv(self):
        csv_content = """table_name,timestamp,insert_rate,update_rate,delete_rate,total_write_ops,avg_write_latency_ms
users,2024-01-01T10:00:00,120.5,450.2,5.3,576.0,2.5
orders,2024-01-01T10:00:00,890.1,1200.5,0.0,2090.6,4.2
"""
        metrics = parse_write_load_csv(StringIO(csv_content))
        assert len(metrics) == 2
        assert metrics[0].table_name == "users"
        assert metrics[0].insert_rate == 120.5
        assert metrics[0].total_write_ops == 576.0


class TestIndexPolicyParsing:
    def test_parse_valid_yaml_policy(self):
        yaml_content = """
policy_name: production
database_type: mysql
max_indexes_per_table: 10
max_columns_per_index: 5
rules:
  - rule_id: R001
    rule_type: missing_index
    description: Test rule
    severity: high
    enabled: true
"""
        policy = parse_index_policy(yaml_content)
        assert policy.policy_name == "production"
        assert policy.database_type == DatabaseType.MYSQL
        assert len(policy.rules) == 1
    
    def test_handle_invalid_yaml(self):
        invalid_yaml = "this is: not valid: yaml: :::"
        policy = parse_index_policy(invalid_yaml)
        assert policy is not None
        assert policy.policy_name == "default"
