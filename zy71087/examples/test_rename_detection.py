#!/usr/bin/env python3
"""验证重命名检测和兼容性判断修复的端到端测试"""

import os
from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq


def create_rename_test_data(output_dir: Path):
    """创建用于测试重命名检测的 Parquet 文件"""
    test_dir = output_dir / "rename_test"
    test_dir.mkdir(parents=True, exist_ok=True)

    schema_old = pa.schema([
        pa.field("id", pa.int64()),
        pa.field("user_name", pa.string()),
        pa.field("email_address", pa.string()),
    ])
    df_old = pd.DataFrame({
        "id": [1, 2, 3],
        "user_name": ["alice", "bob", "charlie"],
        "email_address": ["a@test.com", "b@test.com", "c@test.com"],
    })
    pq.write_table(pa.Table.from_pandas(df_old, schema=schema_old), test_dir / "old.parquet")

    schema_new = pa.schema([
        pa.field("id", pa.int64()),
        pa.field("username", pa.string()),
        pa.field("email", pa.string()),
    ])
    df_new = pd.DataFrame({
        "id": [1, 2, 3],
        "username": ["alice", "bob", "charlie"],
        "email": ["a@test.com", "b@test.com", "c@test.com"],
    })
    pq.write_table(pa.Table.from_pandas(df_new, schema=schema_new), test_dir / "new.parquet")

    print(f"创建重命名测试数据: {test_dir}")
    return test_dir


def create_compatibility_test_data(output_dir: Path):
    """创建用于测试兼容性判断的 Parquet 文件"""
    test_dir = output_dir / "compatibility_test"
    test_dir.mkdir(parents=True, exist_ok=True)

    schema_old = pa.schema([
        pa.field("id", pa.int64()),
        pa.field("value", pa.string()),
        pa.field("to_remove", pa.int32()),
    ])
    df_old = pd.DataFrame({
        "id": [1, 2, 3],
        "value": ["a", "b", "c"],
        "to_remove": [10, 20, 30],
    })
    pq.write_table(pa.Table.from_pandas(df_old, schema=schema_old), test_dir / "old.parquet")

    schema_new = pa.schema([
        pa.field("id", pa.int64(), nullable=False),
        pa.field("value", pa.int64()),
    ])
    df_new = pd.DataFrame({
        "id": [1, 2, 3],
        "value": [1, 2, 3],
    })
    pq.write_table(pa.Table.from_pandas(df_new, schema=schema_new), test_dir / "new.parquet")

    print(f"创建兼容性测试数据: {test_dir}")
    return test_dir


def main():
    output_dir = Path(__file__).parent / "test_data"
    output_dir.mkdir(parents=True, exist_ok=True)

    print("创建测试数据用于验证修复...")
    print()

    create_rename_test_data(output_dir)
    create_compatibility_test_data(output_dir)

    print()
    print("测试数据创建完成！")
    print()
    print("运行以下命令验证修复:")
    print()
    print("1. 验证重命名检测:")
    print("   python3 -m parquet_schema_evolution.cli compare \\")
    print("     -O examples/test_data/rename_test/old.parquet \\")
    print("     -N examples/test_data/rename_test/new.parquet \\")
    print("     -t rename_test --overwrite")
    print()
    print("2. 验证仅字段删除允许时其他破坏性变更仍为不兼容:")
    print("   python3 -m parquet_schema_evolution.cli compare \\")
    print("     -O examples/test_data/compatibility_test/old.parquet \\")
    print("     -N examples/test_data/compatibility_test/new.parquet \\")
    print("     -t compat_test --allow-removal --overwrite")
    print()


if __name__ == "__main__":
    main()
