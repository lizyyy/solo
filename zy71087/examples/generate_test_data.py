#!/usr/bin/env python3
"""生成测试用的 Parquet 文件，用于演示 schema 演进功能"""

import os
from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq


def generate_v1_data(output_dir: Path):
    """生成 v1 版本的测试数据"""
    v1_dir = output_dir / "v1"
    v1_dir.mkdir(parents=True, exist_ok=True)

    df = pd.DataFrame({
        "id": [1, 2, 3, 4, 5],
        "name": ["Alice", "Bob", "Charlie", "David", "Eve"],
        "age": [25, 30, 35, 40, 45],
        "score": pd.Series([85.5, 92.3, 78.9, 95.1, 88.7], dtype="float32"),
        "active": [True, False, True, True, False],
        "created_at": pd.to_datetime(["2023-01-01", "2023-01-02", "2023-01-03", "2023-01-04", "2023-01-05"]),
    })

    table = pa.Table.from_pandas(df)
    pq.write_table(table, v1_dir / "data.parquet")
    print(f"生成 v1 数据: {v1_dir / 'data.parquet'}")

    pq.write_table(table, v1_dir / "data_snapshot.parquet")
    return v1_dir


def generate_v2_data(output_dir: Path):
    """生成 v2 版本的测试数据（包含各种 schema 变更）"""
    v2_dir = output_dir / "v2"
    v2_dir.mkdir(parents=True, exist_ok=True)

    schema = pa.schema([
        pa.field("id", pa.int64(), nullable=False),
        pa.field("name", pa.string(), nullable=True),
        pa.field("full_name", pa.string(), nullable=True),
        pa.field("age", pa.int64(), nullable=True),
        pa.field("score", pa.float64(), nullable=True),
        pa.field("active", pa.bool_(), nullable=True),
        pa.field("email", pa.string(), nullable=True),
        pa.field("created_at", pa.timestamp("ms"), nullable=True),
        pa.field("address", pa.struct([
            pa.field("city", pa.string()),
            pa.field("country", pa.string()),
        ]), nullable=True),
    ])

    data = {
        "id": [1, 2, 3, 4, 5],
        "name": ["Alice", "Bob", "Charlie", "David", "Eve"],
        "full_name": ["Alice Smith", "Bob Johnson", "Charlie Brown", "David Lee", "Eve Adams"],
        "age": [25, 30, 35, 40, 45],
        "score": [85.5, 92.3, 78.9, 95.1, 88.7],
        "active": [True, False, True, True, False],
        "email": ["alice@example.com", "bob@example.com", "charlie@example.com", "david@example.com", "eve@example.com"],
        "created_at": pd.to_datetime(["2023-01-01", "2023-01-02", "2023-01-03", "2023-01-04", "2023-01-05"]),
        "address": [
            {"city": "New York", "country": "USA"},
            {"city": "London", "country": "UK"},
            {"city": "Paris", "country": "France"},
            {"city": "Tokyo", "country": "Japan"},
            {"city": "Sydney", "country": "Australia"},
        ],
    }

    df = pd.DataFrame(data)
    table = pa.Table.from_pandas(df, schema=schema)
    pq.write_table(table, v2_dir / "data.parquet")
    print(f"生成 v2 数据: {v2_dir / 'data.parquet'}")

    return v2_dir


def generate_v3_data(output_dir: Path):
    """生成 v3 版本的测试数据（包含破坏性变更）"""
    v3_dir = output_dir / "v3"
    v3_dir.mkdir(parents=True, exist_ok=True)

    df = pd.DataFrame({
        "id": [1, 2, 3, 4, 5],
        "name": ["Alice", "Bob", "Charlie", "David", "Eve"],
        "age": ["25", "30", "35", "40", "45"],
        "active": [True, False, True, True, False],
    })

    table = pa.Table.from_pandas(df)
    pq.write_table(table, v3_dir / "data.parquet")
    print(f"生成 v3 数据: {v3_dir / 'data.parquet'}")

    return v3_dir


def generate_partitioned_data(output_dir: Path):
    """生成分区的测试数据"""
    base_dir = output_dir / "partitioned"
    base_dir.mkdir(parents=True, exist_ok=True)

    for date in ["2023-01-01", "2023-01-02", "2023-01-03"]:
        for category in ["A", "B"]:
            partition_dir = base_dir / f"dt={date}" / f"category={category}"
            partition_dir.mkdir(parents=True, exist_ok=True)

            df = pd.DataFrame({
                "id": list(range(1, 11)),
                "value": [x * 1.5 for x in range(1, 11)],
            })

            pq.write_table(pa.Table.from_pandas(df), partition_dir / "data.parquet")

    print(f"生成分区数据: {base_dir}")
    return base_dir


def generate_decimal_data(output_dir: Path):
    """生成 decimal 精度变化的测试数据"""
    dec_dir = output_dir / "decimal"
    dec_dir.mkdir(parents=True, exist_ok=True)
    from decimal import Decimal

    schema1 = pa.schema([
        pa.field("id", pa.int64()),
        pa.field("amount", pa.decimal128(10, 2)),
    ])
    data1 = pa.table({
        "id": [1, 2, 3],
        "amount": pa.array([Decimal("100.50"), Decimal("200.75"), Decimal("300.25")], type=pa.decimal128(10, 2)),
    })
    pq.write_table(data1, dec_dir / "v1_decimal.parquet")

    schema2 = pa.schema([
        pa.field("id", pa.int64()),
        pa.field("amount", pa.decimal128(18, 4)),
    ])
    data2 = pa.table({
        "id": [1, 2, 3],
        "amount": pa.array([Decimal("100.5000"), Decimal("200.7500"), Decimal("300.2500")], type=pa.decimal128(18, 4)),
    })
    pq.write_table(data2, dec_dir / "v2_decimal.parquet")

    print(f"生成 decimal 测试数据: {dec_dir}")
    return dec_dir


def main():
    output_dir = Path(__file__).parent / "test_data"
    output_dir.mkdir(parents=True, exist_ok=True)

    print("开始生成测试数据...")
    print()

    generate_v1_data(output_dir)
    generate_v2_data(output_dir)
    generate_v3_data(output_dir)
    generate_partitioned_data(output_dir)
    generate_decimal_data(output_dir)

    print()
    print(f"所有测试数据已生成到: {output_dir}")


if __name__ == "__main__":
    main()
