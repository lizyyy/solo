"""数据加载器 - 加载各种输入文件。"""

import csv
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import yaml
import pandas as pd

from .models import (
    MigrationFile,
    ReleaseWindow,
    TableStats,
)
from .ddl_parser import DDLParser


class DataLoader:
    """数据加载器。"""

    def __init__(self, ddl_parser: Optional[DDLParser] = None) -> None:
        self._ddl_parser = ddl_parser or DDLParser()
        self._version_pattern = re.compile(r"^(\d{4,})")

    def load_migrations(self, migrations_dir: str | Path) -> list[MigrationFile]:
        """加载迁移目录中的所有迁移文件。

        Args:
            migrations_dir: 迁移目录路径

        Returns:
            迁移文件列表，按版本排序
        """
        migrations_dir = Path(migrations_dir)

        if not migrations_dir.exists():
            raise FileNotFoundError(f"迁移目录不存在: {migrations_dir}")

        if not migrations_dir.is_dir():
            raise NotADirectoryError(f"路径不是目录: {migrations_dir}")

        migration_files: list[MigrationFile] = []

        sql_files = sorted(migrations_dir.glob("*.sql"))

        for file_path in sql_files:
            if file_path.name.startswith("."):
                continue

            content = file_path.read_text(encoding="utf-8")

            version = self._extract_version(file_path.name)
            operations = self._ddl_parser.parse(content)

            migration_file = MigrationFile(
                filename=file_path.name,
                filepath=str(file_path),
                version=version,
                operations=operations,
                raw_content=content,
            )
            migration_files.append(migration_file)

        migration_files.sort(key=lambda m: m.version)

        return migration_files

    def load_schema(self, schema_path: str | Path) -> str:
        """加载 schema.sql 文件。

        Args:
            schema_path: schema.sql 路径

        Returns:
            schema 文件内容
        """
        schema_path = Path(schema_path)

        if not schema_path.exists():
            raise FileNotFoundError(f"Schema 文件不存在: {schema_path}")

        return schema_path.read_text(encoding="utf-8")

    def load_table_stats(self, csv_path: str | Path) -> dict[str, TableStats]:
        """加载表统计信息 CSV。

        CSV 格式预期:
        - schema_name: schema 名称
        - table_name: 表名
        - row_count: 行数
        - size_bytes: 大小（字节）
        - n_live_tup: 存活元组数量
        - n_dead_tup: 死元组数量
        - last_vacuum: 最后 vacuum 时间 (可选)
        - last_analyze: 最后 analyze 时间 (可选)

        Args:
            csv_path: CSV 文件路径

        Returns:
            表名到 TableStats 的映射
        """
        csv_path = Path(csv_path)

        if not csv_path.exists():
            raise FileNotFoundError(f"表统计文件不存在: {csv_path}")

        table_stats: dict[str, TableStats] = {}

        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                schema_name = row.get("schema_name", "public")
                table_name = row.get("table_name", "")

                if not table_name:
                    continue

                key = f"{schema_name}.{table_name}".lower()

                try:
                    row_count = int(row.get("row_count", 0))
                except (ValueError, TypeError):
                    row_count = 0

                try:
                    size_bytes = int(row.get("size_bytes", 0))
                except (ValueError, TypeError):
                    size_bytes = 0

                try:
                    n_live_tup = int(row.get("n_live_tup", 0))
                except (ValueError, TypeError):
                    n_live_tup = 0

                try:
                    n_dead_tup = int(row.get("n_dead_tup", 0))
                except (ValueError, TypeError):
                    n_dead_tup = 0

                last_vacuum = None
                if row.get("last_vacuum"):
                    try:
                        last_vacuum = datetime.fromisoformat(
                            row["last_vacuum"].replace("Z", "+00:00")
                        )
                    except (ValueError, TypeError):
                        pass

                last_analyze = None
                if row.get("last_analyze"):
                    try:
                        last_analyze = datetime.fromisoformat(
                            row["last_analyze"].replace("Z", "+00:00")
                        )
                    except (ValueError, TypeError):
                        pass

                table_stats[key] = TableStats(
                    schema_name=schema_name,
                    table_name=table_name,
                    row_count=row_count,
                    size_bytes=size_bytes,
                    n_live_tup=n_live_tup,
                    n_dead_tup=n_dead_tup,
                    last_vacuum=last_vacuum,
                    last_analyze=last_analyze,
                )

        return table_stats

    def load_release_window(self, yaml_path: str | Path) -> ReleaseWindow:
        """加载发布窗口配置 YAML。

        YAML 格式预期:
        environment: production
        allowed_days:
          - Monday
          - Tuesday
          - Wednesday
          - Thursday
          - Friday
        allowed_hours:
          - 2
          - 3
          - 4
        max_duration_minutes: 120
        high_risk_requires_approval: true
        maintenance_window_start: "02:00"
        maintenance_window_end: "06:00"

        Args:
            yaml_path: YAML 文件路径

        Returns:
            ReleaseWindow 对象
        """
        yaml_path = Path(yaml_path)

        if not yaml_path.exists():
            raise FileNotFoundError(f"发布窗口配置文件不存在: {yaml_path}")

        with open(yaml_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}

        return ReleaseWindow(
            environment=data.get("environment", "unknown"),
            allowed_days=data.get("allowed_days", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]),
            allowed_hours=data.get("allowed_hours", [2, 3, 4, 5]),
            max_duration_minutes=int(data.get("max_duration_minutes", 120)),
            high_risk_requires_approval=bool(data.get("high_risk_requires_approval", True)),
            maintenance_window_start=data.get("maintenance_window_start"),
            maintenance_window_end=data.get("maintenance_window_end"),
        )

    def load_pg_stat_activity(
        self, filepath: str | Path
    ) -> list[dict[str, Any]]:
        """加载 pg_stat_activity 示例数据。

        支持 JSON、YAML 或 CSV 格式。

        Args:
            filepath: 文件路径

        Returns:
            pg_stat_activity 数据列表
        """
        filepath = Path(filepath)

        if not filepath.exists():
            raise FileNotFoundError(f"pg_stat_activity 文件不存在: {filepath}")

        suffix = filepath.suffix.lower()

        if suffix == ".json":
            import json
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict):
                    return [data]
                else:
                    return []

        elif suffix in (".yaml", ".yml"):
            with open(filepath, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or []
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict):
                    return [data]
                else:
                    return []

        elif suffix == ".csv":
            with open(filepath, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                return list(reader)

        else:
            raise ValueError(f"不支持的文件格式: {suffix}")

    def _extract_version(self, filename: str) -> str:
        """从文件名中提取版本号。"""
        match = self._version_pattern.match(filename)
        if match:
            return match.group(1)

        name_without_ext = os.path.splitext(filename)[0]
        return name_without_ext

    def load_all(
        self,
        migrations_dir: Optional[str | Path] = None,
        schema_path: Optional[str | Path] = None,
        table_stats_path: Optional[str | Path] = None,
        release_window_path: Optional[str | Path] = None,
        pg_stat_activity_path: Optional[str | Path] = None,
    ) -> dict[str, Any]:
        """加载所有可用的数据文件。

        Args:
            migrations_dir: 迁移目录
            schema_path: schema.sql 路径
            table_stats_path: 表统计 CSV 路径
            release_window_path: 发布窗口 YAML 路径
            pg_stat_activity_path: pg_stat_activity 数据路径

        Returns:
            包含所有加载数据的字典
        """
        result: dict[str, Any] = {
            "migrations": [],
            "schema": None,
            "table_stats": {},
            "release_window": None,
            "pg_stat_activity": [],
        }

        if migrations_dir:
            try:
                result["migrations"] = self.load_migrations(migrations_dir)
            except FileNotFoundError:
                pass

        if schema_path:
            try:
                result["schema"] = self.load_schema(schema_path)
            except FileNotFoundError:
                pass

        if table_stats_path:
            try:
                result["table_stats"] = self.load_table_stats(table_stats_path)
            except FileNotFoundError:
                pass

        if release_window_path:
            try:
                result["release_window"] = self.load_release_window(release_window_path)
            except FileNotFoundError:
                pass

        if pg_stat_activity_path:
            try:
                result["pg_stat_activity"] = self.load_pg_stat_activity(pg_stat_activity_path)
            except FileNotFoundError:
                pass

        return result
