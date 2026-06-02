"""数据加载模块：负责加载版本、评测日志、标注表、阈值备注等数据"""
import json
import csv
import os
from typing import Dict, List, Optional, Any


class DataLoader:
    def __init__(self, base_dir: str):
        self.base_dir = base_dir
        self.versions_dir = os.path.join(base_dir, "data", "versions")
        self.eval_dir = os.path.join(base_dir, "data", "eval_logs")
        self.annotation_dir = os.path.join(base_dir, "data", "annotations")
        self.threshold_dir = os.path.join(base_dir, "data", "threshold_notes")

    def load_version(self, version_id: str) -> Optional[Dict[str, Any]]:
        """加载指定版本的配置文件"""
        version_file = os.path.join(self.versions_dir, f"{version_id}.json")
        if not os.path.exists(version_file):
            return None
        with open(version_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def list_versions(self) -> List[str]:
        """列出所有可用版本"""
        if not os.path.exists(self.versions_dir):
            return []
        versions = []
        for f in os.listdir(self.versions_dir):
            if f.endswith(".json"):
                versions.append(f.replace(".json", ""))
        return sorted(versions, reverse=True)

    def load_eval_log(self, filename: str) -> Optional[Dict[str, Any]]:
        """加载评测日志"""
        eval_file = os.path.join(self.eval_dir, filename)
        if not os.path.exists(eval_file):
            return None
        with open(eval_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def load_annotations(self, filename: str) -> List[Dict[str, Any]]:
        """加载标注表"""
        annotation_file = os.path.join(self.annotation_dir, filename)
        if not os.path.exists(annotation_file):
            return []
        annotations = []
        with open(annotation_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                annotations.append(row)
        return annotations

    def load_threshold_note(self, filename: str) -> Optional[str]:
        """加载阈值备注"""
        threshold_file = os.path.join(self.threshold_dir, filename)
        if not os.path.exists(threshold_file):
            return None
        with open(threshold_file, "r", encoding="utf-8") as f:
            return f.read()

    def get_annotation_cases(self, filename: str) -> Dict[str, List[Dict[str, Any]]]:
        """获取标注表中按case_id分组的记录（用于检测重复项）"""
        annotations = self.load_annotations(filename)
        case_groups: Dict[str, List[Dict[str, Any]]] = {}
        for idx, row in enumerate(annotations, start=2):
            row["line_number"] = idx
            case_id = row.get("case_id", "").strip()
            if case_id not in case_groups:
                case_groups[case_id] = []
            case_groups[case_id].append(row)
        return case_groups

    def get_eval_cases(self, filename: str) -> Dict[str, Dict[str, Any]]:
        """获取评测日志中按case_id分组的记录"""
        eval_log = self.load_eval_log(filename)
        if not eval_log:
            return {}
        cases = {}
        for case in eval_log.get("cases", []):
            cases[case["case_id"]] = case
        return cases
