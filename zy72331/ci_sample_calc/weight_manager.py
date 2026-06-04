"""评分权重表导入和管理模块"""

import csv
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from .models import WeightRule, WeightTable


class WeightTableManager:
    """评分权重表管理器"""

    def __init__(self):
        self.tables: Dict[str, WeightTable] = {}
        self.active_table_id: Optional[str] = None

    def import_from_csv(self, file_path: str, name: str, version: str) -> WeightTable:
        """从 CSV 文件导入评分权重表"""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"评分权重表文件不存在: {file_path}")

        rules: List[WeightRule] = []
        with open(path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rule = WeightRule(
                    score_range=row["score_range"],
                    weight=float(row["weight"]),
                    threshold=float(row["threshold"]),
                    description=row.get("description", ""),
                )
                rules.append(rule)

        table = WeightTable(
            table_id=f"WT-{uuid.uuid4().hex[:8]}",
            name=name,
            version=version,
            rules=rules,
            effective_date=datetime.now(),
        )
        self.tables[table.table_id] = table
        return table

    def import_from_json(self, file_path: str) -> WeightTable:
        """从 JSON 文件导入评分权重表"""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"评分权重表文件不存在: {file_path}")

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        rules = [
            WeightRule(
                score_range=r["score_range"],
                weight=r["weight"],
                threshold=r["threshold"],
                description=r.get("description", ""),
            )
            for r in data.get("rules", [])
        ]

        table = WeightTable(
            table_id=data.get("table_id", f"WT-{uuid.uuid4().hex[:8]}"),
            name=data.get("name", "评分权重表"),
            version=data.get("version", "v1"),
            rules=rules,
            effective_date=datetime.fromisoformat(data["effective_date"])
            if "effective_date" in data
            else datetime.now(),
        )
        self.tables[table.table_id] = table
        return table

    def create_from_dict(self, data: Dict[str, Any]) -> WeightTable:
        """从字典创建评分权重表"""
        rules = [
            WeightRule(
                score_range=r["score_range"],
                weight=r["weight"],
                threshold=r["threshold"],
                description=r.get("description", ""),
            )
            for r in data.get("rules", [])
        ]

        table = WeightTable(
            table_id=f"WT-{uuid.uuid4().hex[:8]}",
            name=data.get("name", "评分权重表"),
            version=data.get("version", "v1"),
            rules=rules,
            effective_date=datetime.now(),
        )
        self.tables[table.table_id] = table
        return table

    def activate_table(self, table_id: str) -> bool:
        """激活指定的评分权重表"""
        if table_id not in self.tables:
            return False

        for table in self.tables.values():
            table.is_active = False

        self.tables[table_id].is_active = True
        self.active_table_id = table_id
        return True

    def get_active_table(self) -> Optional[WeightTable]:
        """获取当前激活的评分权重表"""
        if self.active_table_id:
            return self.tables.get(self.active_table_id)
        return None

    def get_table(self, table_id: str) -> Optional[WeightTable]:
        """获取指定的评分权重表"""
        return self.tables.get(table_id)

    def list_tables(self) -> List[WeightTable]:
        """列出所有评分权重表"""
        return list(self.tables.values())

    def export_to_json(self, table_id: str, file_path: str) -> bool:
        """导出评分权重表到 JSON 文件"""
        table = self.tables.get(table_id)
        if not table:
            return False

        data = {
            "table_id": table.table_id,
            "name": table.name,
            "version": table.version,
            "effective_date": table.effective_date.isoformat(),
            "rules": [
                {
                    "score_range": r.score_range,
                    "weight": r.weight,
                    "threshold": r.threshold,
                    "description": r.description,
                }
                for r in table.rules
            ],
        }

        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
