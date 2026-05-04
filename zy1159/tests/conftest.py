"""
Pytest configuration and fixtures for Index Analyzer tests.
"""

import os
import tempfile
from datetime import datetime

import pytest

from index_analyzer.models import (
    Column,
    DatabaseType,
    Index,
    IndexType,
    InputDataSet,
    Schema,
    SlowQuery,
    Table,
)


@pytest.fixture
def sample_schema() -> Schema:
    """Fixture providing a sample database schema."""
    users_table = Table(
        name="users",
        schema="dbo",
        columns=[
            Column(name="id", data_type="INT", is_primary=True),
            Column(name="email", data_type="VARCHAR(255)", nullable=False),
            Column(name="username", data_type="VARCHAR(100)", nullable=False),
            Column(name="status", data_type="VARCHAR(20)"),
            Column(name="created_at", data_type="DATETIME"),
        ],
        indexes=[
            Index(
                name="PRIMARY",
                columns=["id"],
                index_type=IndexType.BTREE,
                is_primary=True,
                table_name="users",
            ),
            Index(
                name="idx_users_email",
                columns=["email"],
                index_type=IndexType.BTREE,
                table_name="users",
            ),
            Index(
                name="idx_users_email_status",
                columns=["email", "status"],
                index_type=IndexType.BTREE,
                table_name="users",
            ),
            Index(
                name="uk_username",
                columns=["username"],
                index_type=IndexType.BTREE,
                is_unique=True,
                table_name="users",
            ),
            Index(
                name="idx_users_username",
                columns=["username"],
                index_type=IndexType.BTREE,
                is_unique=True,
                table_name="users",
            ),
        ],
    )
    
    orders_table = Table(
        name="orders",
        schema="dbo",
        columns=[
            Column(name="id", data_type="INT", is_primary=True),
            Column(name="user_id", data_type="INT"),
            Column(name="status", data_type="VARCHAR(20)"),
            Column(name="created_at", data_type="DATETIME"),
        ],
        indexes=[
            Index(
                name="PRIMARY",
                columns=["id"],
                index_type=IndexType.BTREE,
                is_primary=True,
                table_name="orders",
            ),
        ],
    )
    
    return Schema(
        database_type=DatabaseType.MYSQL,
        tables={
            "users": users_table,
            "orders": orders_table,
        },
    )


@pytest.fixture
def sample_slow_queries() -> list:
    """Fixture providing sample slow queries."""
    return [
        SlowQuery(
            query_id="q1",
            query="SELECT * FROM users WHERE email = 'user@example.com' AND status = 'active'",
            normalized_query="SELECT * FROM users WHERE email = '?' AND status = '?'",
            db_type=DatabaseType.MYSQL,
            execution_time_ms=2345.0,
            rows_sent=1,
            rows_examined=15000,
            timestamp=datetime.now(),
            frequency=45,
            tables_involved=["users"],
            user="webapp",
            host="10.0.0.1",
        ),
        SlowQuery(
            query_id="q2",
            query="SELECT * FROM orders WHERE user_id = 12345 AND created_at >= '2024-01-01'",
            normalized_query="SELECT * FROM orders WHERE user_id = ? AND created_at >= '?'",
            db_type=DatabaseType.MYSQL,
            execution_time_ms=5678.0,
            rows_sent=23,
            rows_examined=250000,
            timestamp=datetime.now(),
            frequency=120,
            tables_involved=["orders"],
            user="webapp",
            host="10.0.0.2",
        ),
        SlowQuery(
            query_id="q3",
            query="SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at DESC LIMIT 50",
            normalized_query="SELECT * FROM orders WHERE status = '?' ORDER BY created_at DESC LIMIT 50",
            db_type=DatabaseType.MYSQL,
            execution_time_ms=8901.0,
            rows_sent=50,
            rows_examined=500000,
            timestamp=datetime.now(),
            frequency=89,
            tables_involved=["orders"],
            user="admin",
            host="10.0.0.3",
        ),
    ]


@pytest.fixture
def sample_input_dataset(sample_schema, sample_slow_queries) -> InputDataSet:
    """Fixture providing a complete input dataset."""
    return InputDataSet(
        schema=sample_schema,
        slow_queries=sample_slow_queries,
        explain_results=[],
        table_stats=[],
        write_load=[],
        index_policy=None,
    )


@pytest.fixture
def temp_directory():
    """Fixture providing a temporary directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def sample_sql_file(temp_directory):
    """Fixture providing a sample SQL file."""
    sql_content = """
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_users_email (email),
    INDEX idx_users_email_status (email, status),
    UNIQUE KEY uk_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    status VARCHAR(20),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_orders_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_users_username ON users(username);
"""
    file_path = os.path.join(temp_directory, "schema.sql")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(sql_content)
    return file_path


@pytest.fixture
def sample_jsonl_file(temp_directory):
    """Fixture providing a sample JSONL file for slow queries."""
    lines = [
        {
            "query": "SELECT * FROM users WHERE email = 'test@example.com'",
            "Query_time": 2.345,
            "Rows_sent": 1,
            "Rows_examined": 10000,
            "timestamp": "2024-01-01T10:00:00",
            "frequency": 50,
        },
        {
            "query": "SELECT * FROM orders WHERE status = 'pending'",
            "Query_time": 5.678,
            "Rows_sent": 100,
            "Rows_examined": 50000,
            "timestamp": "2024-01-01T11:00:00",
            "frequency": 100,
        },
    ]
    
    file_path = os.path.join(temp_directory, "slow-queries.jsonl")
    with open(file_path, "w", encoding="utf-8") as f:
        for line in lines:
            f.write(__import__('json').dumps(line) + "\n")
    return file_path


@pytest.fixture
def sample_csv_file(temp_directory):
    """Fixture providing a sample CSV file for table stats."""
    csv_content = """table_name,row_count,data_size_bytes,index_size_bytes
users,150000,45000000,28000000
orders,500000,180000000,95000000
products,95000,85000000,42000000
"""
    file_path = os.path.join(temp_directory, "table-stats.csv")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(csv_content)
    return file_path
