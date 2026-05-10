"""历史记录模块 - 版本控制，支持撤回、补录、修改的历史追踪"""

import pandas as pd
import os
import json
from datetime import datetime
from typing import Dict, List, Optional
import logging
from .config import DEFAULT_HISTORY_DIR, DEFAULT_TIME_FORMAT

logger = logging.getLogger(__name__)


class HistoryManager:
    """历史管理器 - 追踪数据变化"""

    def __init__(self, history_dir: str = DEFAULT_HISTORY_DIR):
        self.history_dir = history_dir
        self._ensure_dir()
        self.index_file = os.path.join(history_dir, "index.json")
        self._load_index()

    def _ensure_dir(self):
        if not os.path.exists(self.history_dir):
            os.makedirs(self.history_dir)
            logger.info(f"创建历史记录目录: {self.history_dir}")

    def _load_index(self):
        if os.path.exists(self.index_file):
            with open(self.index_file, "r", encoding="utf-8") as f:
                self.index = json.load(f)
        else:
            self.index = {"versions": []}

    def _save_index(self):
        with open(self.index_file, "w", encoding="utf-8") as f:
            json.dump(self.index, f, ensure_ascii=False, indent=2)

    def save_version(self, data: pd.DataFrame, data_type: str,
                     action: str, comment: str = "") -> str:
        """保存数据版本"""
        version_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        version_file = os.path.join(
            self.history_dir,
            f"{data_type}_{version_id}.csv"
        )

        data.to_csv(version_file, index=False)

        version_info = {
            "version_id": version_id,
            "data_type": data_type,
            "action": action,
            "timestamp": datetime.now().strftime(DEFAULT_TIME_FORMAT),
            "file_path": version_file,
            "record_count": len(data),
            "comment": comment
        }

        self.index["versions"].append(version_info)
        self._save_index()

        logger.info(f"保存版本: {version_id} - {action}")
        return version_id

    def get_versions(self, data_type: Optional[str] = None) -> List[Dict]:
        """获取版本列表"""
        if data_type:
            return [v for v in self.index["versions"]
                    if v["data_type"] == data_type]
        return self.index["versions"]

    def load_version(self, version_id: str) -> pd.DataFrame:
        """加载指定版本"""
        for version in self.index["versions"]:
            if version["version_id"] == version_id:
                if os.path.exists(version["file_path"]):
                    return pd.read_csv(version["file_path"])
                else:
                    raise FileNotFoundError(f"版本文件不存在: {version['file_path']}")

        raise ValueError(f"版本不存在: {version_id}")

    def compare_versions(self, version_id1: str,
                         version_id2: str,
                         data_type: str) -> Dict:
        """比较两个版本的差异"""
        df1 = self.load_version(version_id1)
        df2 = self.load_version(version_id2)

        df1 = df1.copy()
        df2 = df2.copy()

        if "timestamp" in df1.columns and "timestamp" in df2.columns:
            df1["_key"] = df1["timestamp"]
            df2["_key"] = df2["timestamp"]
        else:
            df1["_key"] = df1.index
            df2["_key"] = df2.index

        keys1 = set(df1["_key"])
        keys2 = set(df2["_key"])

        added = keys2 - keys1
        removed = keys1 - keys2
        common = keys1 & keys2

        modified = []
        for key in common:
            row1 = df1[df1["_key"] == key].iloc[0]
            row2 = df2[df2["_key"] == key].iloc[0]

            diffs = {}
            for col in df1.columns:
                if col == "_key":
                    continue
                if col not in df2.columns:
                    continue
                val1 = row1[col]
                val2 = row2[col]

                if pd.isna(val1) and pd.isna(val2):
                    continue
                if pd.isna(val1) or pd.isna(val2):
                    diffs[col] = {"old": val1, "new": val2}
                elif val1 != val2:
                    diffs[col] = {"old": val1, "new": val2}

            if diffs:
                modified.append({"key": key, "changes": diffs})

        return {
            "added_count": len(added),
            "removed_count": len(removed),
            "modified_count": len(modified),
            "added_keys": list(added),
            "removed_keys": list(removed),
            "modified": modified
        }

    def get_history_summary(self, data_type: Optional[str] = None) -> str:
        """生成历史记录摘要"""
        versions = self.get_versions(data_type)

        if not versions:
            return "暂无历史记录"

        report = []
        report.append(f"历史记录 (共 {len(versions)} 个版本):")
        report.append("-" * 60)

        for v in reversed(versions[-10:]):
            report.append(
                f"版本: {v['version_id']} - "
                f"动作: {v['action']} - "
                f"记录数: {v['record_count']} - "
                f"时间: {v['timestamp']}"
            )
            if v["comment"]:
                report.append(f"  说明: {v['comment']}")

        return "\n".join(report)
