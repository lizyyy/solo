"""版本管理模块：负责版本的创建、查询、对比、人工改判记录管理"""
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
from .data_loader import DataLoader


class VersionManager:
    def __init__(self, base_dir: str):
        self.base_dir = base_dir
        self.versions_dir = os.path.join(base_dir, "data", "versions")
        self.loader = DataLoader(base_dir)

    def get_version(self, version_id: str) -> Optional[Dict[str, Any]]:
        """获取指定版本的完整信息"""
        version = self.loader.load_version(version_id)
        if not version:
            return None
        return version

    def list_versions(self) -> List[Dict[str, Any]]:
        """列出所有版本的摘要信息"""
        version_ids = self.loader.list_versions()
        versions = []
        for vid in version_ids:
            v = self.loader.load_version(vid)
            if v:
                versions.append({
                    "version_id": v["version_id"],
                    "release_date": v["release_date"],
                    "release_by": v["release_by"],
                    "status": v["status"],
                    "metrics": v.get("metrics", {}),
                    "manual_review_count": len(v.get("manual_reviews", [])),
                    "thresholds": v.get("thresholds", {})
                })
        return versions

    def get_manual_reviews(self, version_id: str) -> List[Dict[str, Any]]:
        """获取指定版本的所有人工改判记录"""
        version = self.loader.load_version(version_id)
        if not version:
            return []
        return version.get("manual_reviews", [])

    def get_sources(self, version_id: str) -> List[Dict[str, Any]]:
        """获取指定版本的所有来源信息"""
        version = self.loader.load_version(version_id)
        if not version:
            return []
        return version.get("sources", [])

    def get_thresholds(self, version_id: str) -> Optional[Dict[str, float]]:
        """获取指定版本的阈值配置"""
        version = self.loader.load_version(version_id)
        if not version:
            return None
        return version.get("thresholds")

    def get_prompt_content(self, version_id: str) -> Optional[str]:
        """获取指定版本的提示词内容"""
        version = self.loader.load_version(version_id)
        if not version:
            return None
        return version.get("prompt_content")

    def compare_versions(self, version1: str, version2: str) -> Dict[str, Any]:
        """对比两个版本的差异"""
        v1 = self.loader.load_version(version1)
        v2 = self.loader.load_version(version2)
        if not v1 or not v2:
            return {"error": "版本不存在"}

        differences = {
            "version1": version1,
            "version2": version2,
            "prompt_diff": self._diff_text(v1.get("prompt_content", ""), v2.get("prompt_content", "")),
            "threshold_diff": self._diff_thresholds(v1.get("thresholds", {}), v2.get("thresholds", {})),
            "metrics_diff": self._diff_metrics(v1.get("metrics", {}), v2.get("metrics", {})),
            "manual_review_diff": self._diff_manual_reviews(v1.get("manual_reviews", []), v2.get("manual_reviews", []))
        }
        return differences

    def _diff_text(self, text1: str, text2: str) -> Dict[str, Any]:
        """对比文本差异"""
        lines1 = set(text1.split("\n"))
        lines2 = set(text2.split("\n"))
        return {
            "only_in_v1": sorted(lines1 - lines2),
            "only_in_v2": sorted(lines2 - lines1),
            "changed": text1 != text2
        }

    def _diff_thresholds(self, t1: Dict[str, float], t2: Dict[str, float]) -> Dict[str, Any]:
        """对比阈值差异"""
        diff = {}
        keys = set(t1.keys()) | set(t2.keys())
        for key in keys:
            v1 = t1.get(key)
            v2 = t2.get(key)
            if v1 != v2:
                diff[key] = {"old": v1, "new": v2}
        return diff

    def _diff_metrics(self, m1: Dict[str, float], m2: Dict[str, float]) -> Dict[str, Any]:
        """对比指标差异"""
        diff = {}
        keys = set(m1.keys()) | set(m2.keys())
        for key in keys:
            v1 = m1.get(key)
            v2 = m2.get(key)
            if v1 != v2:
                diff[key] = {"old": v1, "new": v2, "delta": (v2 if v2 else 0) - (v1 if v1 else 0)}
        return diff

    def _diff_manual_reviews(self, r1: List[Dict[str, Any]], r2: List[Dict[str, Any]]) -> Dict[str, Any]:
        """对比人工改判差异"""
        ids1 = {r["case_id"] for r in r1}
        ids2 = {r["case_id"] for r in r2}
        return {
            "only_in_v1": sorted(ids1 - ids2),
            "only_in_v2": sorted(ids2 - ids1),
            "count_change": len(r2) - len(r1)
        }

    def add_manual_review(self, version_id: str, review: Dict[str, Any]) -> bool:
        """添加人工改判记录"""
        version = self.loader.load_version(version_id)
        if not version:
            return False

        review["review_date"] = review.get("review_date", datetime.now().strftime("%Y-%m-%d"))
        version["manual_reviews"].append(review)

        version_file = os.path.join(self.versions_dir, f"{version_id}.json")
        with open(version_file, "w", encoding="utf-8") as f:
            json.dump(version, f, ensure_ascii=False, indent=2)
        return True
