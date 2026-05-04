"""
Sample Data Generator - Generates realistic test data for Index Analyzer.
"""

import csv
import json
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List


SAMPLE_SCHEMA_SQL = """
-- Sample database schema for e-commerce application
-- This schema intentionally contains various index issues for testing

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at DATETIME,
    -- Redundant index: prefix of idx_users_email_status
    INDEX idx_users_email (email),
    -- Composite index that covers the above
    INDEX idx_users_email_status (email, status),
    -- Duplicate of idx_users_username (will be created separately)
    UNIQUE KEY uk_username (username),
    -- Low selectivity column
    INDEX idx_users_status (status),
    -- Unused index (hypothetically)
    INDEX idx_users_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL,
    user_id INT NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    shipping_address_id INT,
    billing_address_id INT,
    payment_method VARCHAR(50),
    payment_status ENUM('pending', 'paid', 'refunded', 'failed') DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    -- Good index
    INDEX idx_orders_user_id (user_id),
    -- Missing index for created_at (used in WHERE clauses)
    -- Missing index for status (used in WHERE clauses)
    INDEX idx_orders_order_number (order_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- Good composite index
    INDEX idx_order_items_order_product (order_id, product_id),
    -- Redundant: prefix of above
    INDEX idx_order_items_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id INT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT DEFAULT 0,
    status ENUM('active', 'inactive', 'out_of_stock') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    -- Good indexes
    UNIQUE KEY uk_sku (sku),
    INDEX idx_products_category (category_id),
    -- Wide index (too many columns)
    INDEX idx_products_wide (name, description, price, stock_quantity, status),
    -- Missing index for price (used in range queries)
    -- Missing index for created_at
    INDEX idx_products_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id INT,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_slug (slug),
    INDEX idx_categories_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Additional indexes outside CREATE TABLE
-- Duplicate of uk_username
CREATE UNIQUE INDEX idx_users_username ON users(username);

-- Another redundant index
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_created_at_status ON users(created_at, status);
"""


def generate_slow_queries() -> List[Dict[str, Any]]:
    """Generate realistic slow query log entries."""
    queries = [
        {
            "query": "SELECT * FROM users WHERE email = 'user@example.com' AND status = 'active'",
            "Query_time": 2.345,
            "Rows_sent": 1,
            "Rows_examined": 15000,
            "timestamp": (datetime.now() - timedelta(hours=1)).isoformat(),
            "frequency": 45,
            "user": "webapp",
            "host": "10.0.0.1",
        },
        {
            "query": "SELECT * FROM orders WHERE user_id = 12345 AND created_at >= '2024-01-01'",
            "Query_time": 5.678,
            "Rows_sent": 23,
            "Rows_examined": 250000,
            "timestamp": (datetime.now() - timedelta(hours=2)).isoformat(),
            "frequency": 120,
            "user": "webapp",
            "host": "10.0.0.2",
        },
        {
            "query": "SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at DESC LIMIT 50",
            "Query_time": 8.901,
            "Rows_sent": 50,
            "Rows_examined": 500000,
            "timestamp": (datetime.now() - timedelta(hours=3)).isoformat(),
            "frequency": 89,
            "user": "admin",
            "host": "10.0.0.3",
        },
        {
            "query": "SELECT * FROM products WHERE category_id = 5 AND price BETWEEN 10 AND 100",
            "Query_time": 3.456,
            "Rows_sent": 156,
            "Rows_examined": 45000,
            "timestamp": (datetime.now() - timedelta(hours=4)).isoformat(),
            "frequency": 234,
            "user": "webapp",
            "host": "10.0.0.1",
        },
        {
            "query": "SELECT p.* FROM products p JOIN order_items oi ON p.id = oi.product_id WHERE oi.order_id = 99999",
            "Query_time": 1.234,
            "Rows_sent": 3,
            "Rows_examined": 5000,
            "timestamp": (datetime.now() - timedelta(hours=5)).isoformat(),
            "frequency": 678,
            "user": "webapp",
            "host": "10.0.0.2",
        },
        {
            "query": "SELECT * FROM users WHERE status = 'active' ORDER BY created_at DESC LIMIT 100",
            "Query_time": 4.567,
            "Rows_sent": 100,
            "Rows_examined": 100000,
            "timestamp": (datetime.now() - timedelta(hours=6)).isoformat(),
            "frequency": 56,
            "user": "batch_job",
            "host": "10.0.0.4",
        },
        {
            "query": "SELECT * FROM products WHERE created_at >= '2024-01-01' AND status = 'active'",
            "Query_time": 6.789,
            "Rows_sent": 342,
            "Rows_examined": 89000,
            "timestamp": (datetime.now() - timedelta(hours=7)).isoformat(),
            "frequency": 78,
            "user": "reporting",
            "host": "10.0.0.5",
        },
        {
            "query": "SELECT o.* FROM orders o WHERE o.payment_status = 'pending' AND o.created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)",
            "Query_time": 12.345,
            "Rows_sent": 89,
            "Rows_examined": 750000,
            "timestamp": (datetime.now() - timedelta(hours=8)).isoformat(),
            "frequency": 12,
            "user": "cron_job",
            "host": "10.0.0.6",
        },
    ]
    return queries


def generate_explain_results() -> List[Dict[str, Any]]:
    """Generate sample EXPLAIN results showing table scans."""
    return [
        {
            "query": "SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at DESC LIMIT 50",
            "Plan": {
                "Node Type": "Sort",
                "Cost": 150000,
                "Plans": [
                    {
                        "Node Type": "Seq Scan",
                        "Relation Name": "orders",
                        "Alias": "orders",
                        "Plan Rows": 50000,
                        "Filter": "(status = 'pending'::text)",
                    }
                ]
            },
            "table_scans": ["orders"],
            "index_uses": [],
        },
        {
            "query": "SELECT * FROM users WHERE status = 'active' ORDER BY created_at DESC",
            "Plan": {
                "Node Type": "Sort",
                "Cost": 85000,
                "Plans": [
                    {
                        "Node Type": "Seq Scan",
                        "Relation Name": "users",
                        "Alias": "users",
                        "Plan Rows": 15000,
                        "Filter": "(status = 'active'::text)",
                    }
                ]
            },
            "table_scans": ["users"],
            "index_uses": [],
        },
        {
            "query": "SELECT * FROM products WHERE category_id = 5 AND price BETWEEN 10 AND 100",
            "Plan": {
                "Node Type": "Index Scan",
                "Relation Name": "products",
                "Index Name": "idx_products_category",
                "Plan Rows": 156,
                "Filter": "((price >= 10.0) AND (price <= 100.0))",
            },
            "table_scans": [],
            "index_uses": [
                {"table": "products", "index": "idx_products_category", "type": "Index Scan", "rows": 156}
            ],
        },
    ]


def generate_table_stats() -> List[Dict[str, Any]]:
    """Generate sample table statistics."""
    return [
        {
            "table_name": "users",
            "row_count": 150000,
            "data_size_bytes": 45000000,
            "index_size_bytes": 28000000,
            "last_analyzed": (datetime.now() - timedelta(days=1)).isoformat(),
            "col_email_cardinality": "148500",
            "col_email_nulls": "0",
            "col_status_cardinality": "3",
            "col_status_nulls": "0",
            "col_created_at_cardinality": "145000",
            "idx_idx_users_email_size": "5200000",
            "idx_idx_users_email_status_size": "6800000",
        },
        {
            "table_name": "orders",
            "row_count": 500000,
            "data_size_bytes": 180000000,
            "index_size_bytes": 95000000,
            "last_analyzed": (datetime.now() - timedelta(days=2)).isoformat(),
            "col_user_id_cardinality": "120000",
            "col_status_cardinality": "5",
            "col_created_at_cardinality": "495000",
            "col_payment_status_cardinality": "4",
            "idx_idx_orders_user_id_size": "25000000",
        },
        {
            "table_name": "order_items",
            "row_count": 1200000,
            "data_size_bytes": 280000000,
            "index_size_bytes": 120000000,
            "last_analyzed": (datetime.now() - timedelta(days=1)).isoformat(),
            "col_order_id_cardinality": "500000",
            "col_product_id_cardinality": "45000",
        },
        {
            "table_name": "products",
            "row_count": 95000,
            "data_size_bytes": 85000000,
            "index_size_bytes": 42000000,
            "last_analyzed": (datetime.now() - timedelta(days=3)).isoformat(),
            "col_category_id_cardinality": "150",
            "col_price_cardinality": "8500",
            "col_status_cardinality": "3",
            "col_created_at_cardinality": "92000",
        },
        {
            "table_name": "categories",
            "row_count": 150,
            "data_size_bytes": 150000,
            "index_size_bytes": 45000,
            "last_analyzed": (datetime.now() - timedelta(days=7)).isoformat(),
        },
    ]


def generate_write_load() -> List[Dict[str, Any]]:
    """Generate sample write load metrics."""
    base_time = datetime.now()
    metrics = []
    
    for i in range(24):
        timestamp = base_time - timedelta(hours=i)
        
        for table in ["users", "orders", "order_items", "products"]:
            if table == "users":
                insert_rate = 120.5 + (i % 3) * 10
                update_rate = 450.2 + (i % 4) * 20
                delete_rate = 5.3
                latency = 2.5 + (i % 5) * 0.5
            elif table == "orders":
                insert_rate = 890.1 + (i % 2) * 100
                update_rate = 1200.5 + (i % 3) * 150
                delete_rate = 0.0
                latency = 4.2 + (i % 4) * 1.0
            elif table == "order_items":
                insert_rate = 2100.3 + (i % 2) * 300
                update_rate = 150.2
                delete_rate = 10.5
                latency = 3.8 + (i % 3) * 0.8
            else:
                insert_rate = 50.1
                update_rate = 800.5 + (i % 5) * 100
                delete_rate = 2.3
                latency = 3.1 + (i % 4) * 0.6
            
            metrics.append({
                "table_name": table,
                "timestamp": timestamp.isoformat(),
                "insert_rate": insert_rate,
                "update_rate": update_rate,
                "delete_rate": delete_rate,
                "total_write_ops": insert_rate + update_rate + delete_rate,
                "avg_write_latency_ms": latency,
            })
    
    return metrics


def generate_index_policy() -> Dict[str, Any]:
    """Generate sample index policy configuration."""
    return {
        "policy_name": "production_optimization",
        "database_type": "mysql",
        "max_indexes_per_table": 10,
        "max_columns_per_index": 5,
        "min_selectivity_for_index": 0.1,
        "write_cost_threshold": 0.3,
        "rules": [
            {
                "rule_id": "R001",
                "rule_type": "missing_index",
                "description": "Flag columns used in WHERE clauses without indexes",
                "severity": "high",
                "conditions": {
                    "min_query_count": 5,
                    "min_execution_time_ms": 500
                },
                "actions": ["suggest_index"],
                "enabled": True,
            },
            {
                "rule_id": "R002",
                "rule_type": "redundant_index",
                "description": "Detect indexes that are prefixes of other indexes",
                "severity": "medium",
                "conditions": {},
                "actions": ["suggest_drop"],
                "enabled": True,
            },
            {
                "rule_id": "R003",
                "rule_type": "unused_index",
                "description": "Flag indexes not used in analyzed queries",
                "severity": "low",
                "conditions": {
                    "min_age_days": 30
                },
                "actions": ["suggest_review"],
                "enabled": True,
            },
            {
                "rule_id": "R004",
                "rule_type": "low_selectivity",
                "description": "Flag indexes on low-cardinality columns",
                "severity": "low",
                "conditions": {
                    "max_selectivity": 0.05
                },
                "actions": ["suggest_rewrite"],
                "enabled": True,
            },
        ],
    }


def generate_sample_files(output_dir: str, include_errors: bool = False):
    """Generate all sample data files."""
    os.makedirs(output_dir, exist_ok=True)
    
    schema_path = os.path.join(output_dir, "schema.sql")
    with open(schema_path, "w", encoding="utf-8") as f:
        f.write(SAMPLE_SCHEMA_SQL)
    
    slow_queries_path = os.path.join(output_dir, "slow-queries.jsonl")
    with open(slow_queries_path, "w", encoding="utf-8") as f:
        for query in generate_slow_queries():
            f.write(json.dumps(query, ensure_ascii=False) + "\n")
    
    explain_path = os.path.join(output_dir, "explain-before.json")
    with open(explain_path, "w", encoding="utf-8") as f:
        json.dump(generate_explain_results(), f, indent=2, ensure_ascii=False)
    
    table_stats_path = os.path.join(output_dir, "table-stats.csv")
    table_stats = generate_table_stats()
    with open(table_stats_path, "w", encoding="utf-8", newline="") as f:
        if table_stats:
            all_fields = set()
            for row in table_stats:
                all_fields.update(row.keys())
            fieldnames = sorted(all_fields)
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(table_stats)
    
    write_load_path = os.path.join(output_dir, "write-load.csv")
    write_load = generate_write_load()
    with open(write_load_path, "w", encoding="utf-8", newline="") as f:
        if write_load:
            writer = csv.DictWriter(f, fieldnames=write_load[0].keys())
            writer.writeheader()
            writer.writerows(write_load)
    
    policy_path = os.path.join(output_dir, "index-policy.yaml")
    policy = generate_index_policy()
    import yaml
    with open(policy_path, "w", encoding="utf-8") as f:
        yaml.dump(policy, f, default_flow_style=False, allow_unicode=True)
    
    if include_errors:
        invalid_schema_path = os.path.join(output_dir, "schema-invalid.sql")
        with open(invalid_schema_path, "w", encoding="utf-8") as f:
            f.write("CREATE TABLE invalid (this is not valid sql syntax;;;\n")
        
        malformed_jsonl_path = os.path.join(output_dir, "slow-queries-malformed.jsonl")
        with open(malformed_jsonl_path, "w", encoding="utf-8") as f:
            f.write('{"valid": "json"}\n')
            f.write("this is not json\n")
            f.write('{"partial": "json}\n')
        
        missing_cols_csv_path = os.path.join(output_dir, "table-stats-missing.csv")
        with open(missing_cols_csv_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["wrong", "columns", "here"])
            writer.writerow(["val1", "val2", "val3"])
