#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
海草床调查异常预警 - 历史记录与版本追踪模块
补录后结论变化时，能看到旧材料、新备注和改判原因
"""

import os
import json
import csv
import shutil
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from .seagrass_alert import SeagrassAlert, ERROR_MESSAGES


class HistoryTracker:
    """历史记录追踪器"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.history_dir = config["history_dir"]
        self.input_dir = config["input_dir"]
        os.makedirs(self.history_dir, exist_ok=True)

    def _get_case_dir(self, case_id: str) -> str:
        """获取案例历史目录"""
        case_dir = os.path.join(self.history_dir, case_id)
        os.makedirs(case_dir, exist_ok=True)
        return case_dir

    def _get_version_dir(self, case_id: str, version: int) -> str:
        """获取指定版本目录"""
        case_dir = self._get_case_dir(case_id)
        version_dir = os.path.join(case_dir, f"v{version:03d}")
        os.makedirs(version_dir, exist_ok=True)
        return version_dir

    def get_latest_version(self, case_id: str) -> int:
        """获取案例最新版本号"""
        case_dir = self._get_case_dir(case_id)
        versions = []
        for item in os.listdir(case_dir):
            if item.startswith("v") and item[1:].isdigit():
                versions.append(int(item[1:]))
        return max(versions) if versions else 0

    def list_versions(self, case_id: str) -> List[Dict[str, Any]]:
        """列出案例所有版本"""
        case_dir = self._get_case_dir(case_id)
        versions = []
        for item in sorted(os.listdir(case_dir)):
            if item.startswith("v") and item[1:].isdigit():
                version_num = int(item[1:])
                version_dir = os.path.join(case_dir, item)
                meta_file = os.path.join(version_dir, "metadata.json")
                if os.path.exists(meta_file):
                    with open(meta_file, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                    versions.append(
                        {
                            "version": version_num,
                            "timestamp": meta.get("timestamp", ""),
                            "operator": meta.get("operator", ""),
                            "conclusion": meta.get("conclusion", ""),
                            "change_reason": meta.get("change_reason", ""),
                        }
                    )
        return versions

    def save_version(
        self,
        case_id: str,
        alert_results: List[Dict[str, Any]],
        summary: Dict[str, Any],
        operator: str,
        conclusion: str,
        change_reason: str = "",
        new_notes: List[str] = None,
    ) -> Tuple[int, str]:
        """
        保存新版本
        保存旧材料、新备注和改判原因
        """
        new_notes = new_notes or []
        version = self.get_latest_version(case_id) + 1
        version_dir = self._get_version_dir(case_id, version)

        try:
            data_backup_dir = os.path.join(version_dir, "source_data")
            os.makedirs(data_backup_dir, exist_ok=True)
            if os.path.exists(self.input_dir):
                for item in os.listdir(self.input_dir):
                    src = os.path.join(self.input_dir, item)
                    dst = os.path.join(data_backup_dir, item)
                    if os.path.isfile(src):
                        shutil.copy2(src, dst)
                    elif os.path.isdir(src):
                        shutil.copytree(src, dst, dirs_exist_ok=True)

            results_csv = os.path.join(version_dir, "alert_results.csv")
            with open(results_csv, "w", encoding="utf-8-sig", newline="") as f:
                if alert_results:
                    writer = csv.DictWriter(
                        f, fieldnames=list(alert_results[0].keys())
                    )
                    writer.writeheader()
                    writer.writerows(alert_results)

            summary_json = os.path.join(version_dir, "summary.json")
            with open(summary_json, "w", encoding="utf-8") as f:
                json.dump(summary, f, ensure_ascii=False, indent=2)

            if new_notes:
                notes_file = os.path.join(version_dir, "new_notes.txt")
                with open(notes_file, "w", encoding="utf-8") as f:
                    for note in new_notes:
                        f.write(f"{note}\n")

            metadata = {
                "version": version,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "operator": operator,
                "conclusion": conclusion,
                "change_reason": change_reason,
                "has_new_notes": len(new_notes) > 0,
                "anomaly_count": summary.get("anomaly_count", 0),
                "total_records": summary.get("total_records", 0),
            }
            meta_file = os.path.join(version_dir, "metadata.json")
            with open(meta_file, "w", encoding="utf-8") as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)

            case_index = os.path.join(self._get_case_dir(case_id), "index.json")
            index_data = {
                "case_id": case_id,
                "latest_version": version,
                "versions": self.list_versions(case_id),
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }
            if os.path.exists(case_index):
                with open(case_index, "r", encoding="utf-8") as f:
                    old_index = json.load(f)
                index_data["created_at"] = old_index.get("created_at", index_data["created_at"])
            with open(case_index, "w", encoding="utf-8") as f:
                json.dump(index_data, f, ensure_ascii=False, indent=2)

            return version, version_dir

        except Exception as e:
            raise IOError(
                ERROR_MESSAGES["HISTORY_SAVE_FAILED"].format(detail=str(e))
            )

    def load_version(
        self, case_id: str, version: int
    ) -> Optional[Dict[str, Any]]:
        """加载指定版本的完整数据"""
        version_dir = self._get_version_dir(case_id, version)
        if not os.path.exists(version_dir):
            return None

        result = {"version": version, "version_dir": version_dir}

        meta_file = os.path.join(version_dir, "metadata.json")
        if os.path.exists(meta_file):
            with open(meta_file, "r", encoding="utf-8") as f:
                result["metadata"] = json.load(f)

        summary_file = os.path.join(version_dir, "summary.json")
        if os.path.exists(summary_file):
            with open(summary_file, "r", encoding="utf-8") as f:
                result["summary"] = json.load(f)

        results_csv = os.path.join(version_dir, "alert_results.csv")
        if os.path.exists(results_csv):
            with open(results_csv, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                result["alert_results"] = list(reader)

        notes_file = os.path.join(version_dir, "new_notes.txt")
        if os.path.exists(notes_file):
            with open(notes_file, "r", encoding="utf-8") as f:
                result["new_notes"] = [line.strip() for line in f if line.strip()]

        data_dir = os.path.join(version_dir, "source_data")
        if os.path.exists(data_dir):
            result["source_files"] = os.listdir(data_dir)

        return result

    def compare_versions(
        self, case_id: str, version_old: int, version_new: int
    ) -> Dict[str, Any]:
        """比较两个版本的差异，分析改判原因"""
        v1 = self.load_version(case_id, version_old)
        v2 = self.load_version(case_id, version_new)

        if not v1 or not v2:
            return {"error": "版本不存在"}

        comparison = {
            "case_id": case_id,
            "version_old": version_old,
            "version_new": version_new,
            "conclusion_old": v1["metadata"].get("conclusion", ""),
            "conclusion_new": v2["metadata"].get("conclusion", ""),
            "change_reason": v2["metadata"].get("change_reason", ""),
            "anomaly_count_old": v1.get("summary", {}).get("anomaly_count", 0),
            "anomaly_count_new": v2.get("summary", {}).get("anomaly_count", 0),
            "new_notes": v2.get("new_notes", []),
            "new_source_files": [],
            "changed_results": [],
        }

        files_old = set(v1.get("source_files", []))
        files_new = set(v2.get("source_files", []))
        comparison["new_source_files"] = list(files_new - files_old)

        results_old = {
            r["record_id"]: r for r in v1.get("alert_results", [])
        }
        results_new = {
            r["record_id"]: r for r in v2.get("alert_results", [])
        }

        for rid, rnew in results_new.items():
            if rid in results_old:
                rold = results_old[rid]
                if rold.get("is_anomaly") != rnew.get("is_anomaly") or rold.get(
                    "anomaly_type"
                ) != rnew.get("anomaly_type"):
                    comparison["changed_results"].append(
                        {
                            "record_id": rid,
                            "is_anomaly_old": rold.get("is_anomaly"),
                            "is_anomaly_new": rnew.get("is_anomaly"),
                            "anomaly_type_old": rold.get("anomaly_type"),
                            "anomaly_type_new": rnew.get("anomaly_type"),
                            "metric_name": rnew.get("metric_name"),
                            "metric_value": rnew.get("metric_value"),
                            "notes": rnew.get("notes", ""),
                        }
                    )
            else:
                comparison["changed_results"].append(
                    {
                        "record_id": rid,
                        "is_anomaly_old": None,
                        "is_anomaly_new": rnew.get("is_anomaly"),
                        "anomaly_type_old": None,
                        "anomaly_type_new": rnew.get("anomaly_type"),
                        "metric_name": rnew.get("metric_name"),
                        "metric_value": rnew.get("metric_value"),
                        "notes": rnew.get("notes", ""),
                        "is_new_record": True,
                    }
                )

        return comparison

    def list_all_cases(self) -> List[Dict[str, Any]]:
        """列出所有案例"""
        cases = []
        if not os.path.exists(self.history_dir):
            return cases
        for item in sorted(os.listdir(self.history_dir)):
            case_dir = os.path.join(self.history_dir, item)
            if os.path.isdir(case_dir):
                index_file = os.path.join(case_dir, "index.json")
                if os.path.exists(index_file):
                    with open(index_file, "r", encoding="utf-8") as f:
                        case_info = json.load(f)
                    cases.append(case_info)
        return cases
