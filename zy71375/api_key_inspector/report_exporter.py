import pandas as pd
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any
import logging
import hashlib

from .config import Config

logger = logging.getLogger(__name__)


class ReportExporter:
    def __init__(self, config: Config):
        self.config = config
        self.report_dir = config.get_report_dir()
        self.diff_dir = config.get_diff_dir()
        self.output_formats = config.get("api_key_rotation.output.format", ["xlsx", "json"])

        self.report_dir.mkdir(parents=True, exist_ok=True)
        self.diff_dir.mkdir(parents=True, exist_ok=True)

    def generate_run_id(self) -> str:
        return datetime.now().strftime("%Y%m%d_%H%M%S")

    def export_full_report(self, inspection_results: Dict[str, Any], run_id: str = None) -> Dict[str, str]:
        if run_id is None:
            run_id = self.generate_run_id()

        exported_files = {}

        if "xlsx" in self.output_formats:
            xlsx_path = self._export_to_excel(inspection_results, run_id)
            exported_files["xlsx"] = str(xlsx_path)

        if "json" in self.output_formats:
            json_path = self._export_to_json(inspection_results, run_id)
            exported_files["json"] = str(json_path)

        self._save_run_snapshot(inspection_results, run_id)

        logger.info(f"报告已导出，Run ID: {run_id}")
        return exported_files

    def _export_to_excel(self, inspection_results: Dict[str, Any], run_id: str) -> Path:
        file_path = self.report_dir / f"inspection_report_{run_id}.xlsx"

        with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
            summary_df = self._create_summary_sheet(inspection_results)
            summary_df.to_excel(writer, sheet_name="巡检摘要", index=False)

            deprecated_keys = inspection_results.get("key_check_results", {}).get("deprecated_keys_in_use", [])
            if deprecated_keys:
                pd.DataFrame(deprecated_keys).to_excel(writer, sheet_name="旧密钥仍启用", index=False)

            missing_owners = inspection_results.get("service_scan_results", {}).get("services_missing_owner", [])
            if missing_owners:
                pd.DataFrame(missing_owners).to_excel(writer, sheet_name="缺少负责人", index=False)

            callback_failures = inspection_results.get("callback_validation_results", {}).get("signature_failures", [])
            if callback_failures:
                pd.DataFrame(callback_failures).to_excel(writer, sheet_name="回调签名失败", index=False)

            all_alerts = inspection_results.get("alert_results", {}).get("deduplicated_alerts", [])
            if all_alerts:
                pd.DataFrame(all_alerts).to_excel(writer, sheet_name="告警列表", index=False)

            critical_high_alerts = inspection_results.get("alert_results", {}).get("categorized_alerts", {}).get("critical", [])
            critical_high_alerts.extend(
                inspection_results.get("alert_results", {}).get("categorized_alerts", {}).get("high", [])
            )
            if critical_high_alerts:
                pd.DataFrame(critical_high_alerts).to_excel(writer, sheet_name="高优先级告警", index=False)

        return file_path

    def _create_summary_sheet(self, inspection_results: Dict[str, Any]) -> pd.DataFrame:
        key_check = inspection_results.get("key_check_results", {})
        service_scan = inspection_results.get("service_scan_results", {})
        callback_validation = inspection_results.get("callback_validation_results", {})
        alert_results = inspection_results.get("alert_results", {})

        summary_data = [
            {"检查项": "总服务数", "数量": service_scan.get("total_services", 0), "说明": ""},
            {"检查项": "总密钥数", "数量": key_check.get("total_keys", 0), "说明": ""},
            {"检查项": "总回调数", "数量": callback_validation.get("total_callbacks", 0), "说明": ""},
            {"检查项": "旧密钥仍启用", "数量": len(key_check.get("deprecated_keys_in_use", [])), "说明": "高危：需立即处理"},
            {"检查项": "服务缺少负责人", "数量": len(service_scan.get("services_missing_owner", [])), "说明": "中危：需尽快补充"},
            {"检查项": "回调签名失败", "数量": len(callback_validation.get("signature_failures", [])), "说明": "高危：影响第三方对接"},
            {"检查项": "严重告警数", "数量": alert_results.get("summary", {}).get("critical", 0), "说明": ""},
            {"检查项": "高级告警数", "数量": alert_results.get("summary", {}).get("high", 0), "说明": ""},
            {"检查项": "中级告警数", "数量": alert_results.get("summary", {}).get("medium", 0), "说明": ""},
            {"检查项": "告警总数", "数量": alert_results.get("summary", {}).get("total", 0), "说明": ""},
            {"检查项": "巡检时间", "数量": "", "说明": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
        ]

        return pd.DataFrame(summary_data)

    def _export_to_json(self, inspection_results: Dict[str, Any], run_id: str) -> Path:
        file_path = self.report_dir / f"inspection_report_{run_id}.json"

        export_results = {k: v for k, v in inspection_results.items() if k != "raw_data"}

        export_data = {
            "run_id": run_id,
            "export_time": datetime.now().isoformat(),
            "inspection_results": export_results
        }

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2, default=str)

        return file_path

    def _save_run_snapshot(self, inspection_results: Dict[str, Any], run_id: str) -> Path:
        snapshot_path = self.diff_dir / f"snapshot_{run_id}.json"

        snapshot = {
            "run_id": run_id,
            "timestamp": datetime.now().isoformat(),
            "deprecated_keys": [
                k.get("key_id") for k in inspection_results.get("key_check_results", {}).get("deprecated_keys_in_use", [])
            ],
            "missing_owners": [
                s.get("service_name") for s in inspection_results.get("service_scan_results", {}).get("services_missing_owner", [])
            ],
            "callback_failures": [
                c.get("callback_id") for c in inspection_results.get("callback_validation_results", {}).get("signature_failures", [])
            ],
            "alert_ids": [
                a.get("alert_id") for a in inspection_results.get("alert_results", {}).get("deduplicated_alerts", [])
            ],
            "full_data": inspection_results
        }

        with open(snapshot_path, 'w', encoding='utf-8') as f:
            json.dump(snapshot, f, ensure_ascii=False, indent=2, default=str)

        return snapshot_path

    def compare_runs(self, run_id1: str, run_id2: str) -> Dict[str, Any]:
        snapshot1 = self._load_snapshot(run_id1)
        snapshot2 = self._load_snapshot(run_id2)

        if not snapshot1 or not snapshot2:
            return {"error": "无法加载快照失败"}

        diff = {
            "run_id_old": run_id1,
            "run_id_new": run_id2,
            "deprecated_keys_diff": self._compare_lists(
                snapshot1.get("deprecated_keys", []),
                snapshot2.get("deprecated_keys", []),
                "旧密钥"
            ),
            "missing_owners_diff": self._compare_lists(
                snapshot1.get("missing_owners", []),
                snapshot2.get("missing_owners", []),
                "缺少负责人"
            ),
            "callback_failures_diff": self._compare_lists(
                snapshot1.get("callback_failures", []),
                snapshot2.get("callback_failures", []),
                "回调签名失败"
            ),
            "alerts_diff": self._compare_lists(
                snapshot1.get("alert_ids", []),
                snapshot2.get("alert_ids", []),
                "告警"
            )
        }

        diff_path = self.diff_dir / f"diff_{run_id1}_vs_{run_id2}.json"
        with open(diff_path, 'w', encoding='utf-8') as f:
            json.dump(diff, f, ensure_ascii=False, indent=2)

        diff["diff_file"] = str(diff_path)
        return diff

    def _compare_lists(self, list_old: List[str], list_new: List[str], item_name: str) -> Dict[str, Any]:
        set_old = set(list_old)
        set_new = set(list_new)

        return {
            "name": item_name,
            "removed": list(set_old - set_new),
            "added": list(set_new - set_old),
            "unchanged": list(set_old & set_new),
            "count_old": len(list_old),
            "count_new": len(list_new),
            "change": len(list_new) - len(list_old)
        }

    def _load_snapshot(self, run_id: str) -> Dict[str, Any]:
        snapshot_path = self.diff_dir / f"snapshot_{run_id}.json"
        if snapshot_path.exists():
            with open(snapshot_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None

    def list_available_runs(self) -> List[str]:
        snapshots = list(self.diff_dir.glob("snapshot_*.json"))
        run_ids = [s.stem.replace("snapshot_", "") for s in snapshots]
        return sorted(run_ids, reverse=True)

    def get_latest_run_id(self) -> str:
        runs = self.list_available_runs()
        return runs[0] if runs else None

    def format_diff_report(self, diff_result: Dict[str, Any]) -> str:
        report_lines = []
        report_lines.append("=" * 60)
        report_lines.append("差异对比报告")
        report_lines.append(f"旧运行: {diff_result.get('run_id_old')}")
        report_lines.append(f"新运行: {diff_result.get('run_id_new')}")
        report_lines.append("=" * 60)

        for key in ["deprecated_keys_diff", "missing_owners_diff", "callback_failures_diff", "alerts_diff"]:
            diff = diff_result.get(key, {})
            if diff:
                name = diff.get("name", "")
                report_lines.append(f"\n【{name}】")
                report_lines.append(f"  数量变化: {diff.get('count_old')} -> {diff.get('count_new')} (变化: {diff.get('change'):+d})")

                if diff.get("added"):
                    report_lines.append(f"  新增: {len(diff.get('added'))} 项")
                    for item in diff.get("added")[:5]:
                        report_lines.append(f"    + {item}")
                    if len(diff.get("added")) > 5:
                        report_lines.append(f"    ... 还有 {len(diff.get('added')) - 5} 项")

                if diff.get("removed"):
                    report_lines.append(f"  修复: {len(diff.get('removed'))} 项")
                    for item in diff.get("removed")[:5]:
                        report_lines.append(f"    - {item}")
                    if len(diff.get("removed")) > 5:
                        report_lines.append(f"    ... 还有 {len(diff.get('removed')) - 5} 项")

        return "\n".join(report_lines)
