import pandas as pd
from typing import Dict, List, Any, Set
import logging

from .config import Config

logger = logging.getLogger(__name__)


class ServiceScanner:
    def __init__(self, config: Config):
        self.config = config

    def scan_services(self, service_list_df: pd.DataFrame, owners_df: pd.DataFrame, 
                       task_logs_df: pd.DataFrame, key_mapping: Dict[str, List[Dict]]) -> Dict[str, Any]:
        results = {
            "total_services": 0,
            "services_missing_owner": [],
            "services_with_multiple_keys": [],
            "services_with_old_keys": [],
            "inactive_services": [],
            "services_with_task_issues": [],
            "service_details": {}
        }

        if service_list_df is None or service_list_df.empty:
            logger.warning("服务清单数据为空")
            return results

        results["total_services"] = len(service_list_df)

        owner_map = self._build_owner_map(owners_df)

        for _, row in service_list_df.iterrows():
            service_info = self._extract_service_info(row)
            service_name = service_info["name"]

            owner_info = self._check_service_owner(service_info, owner_map)
            if owner_info["missing_owner"]:
                results["services_missing_owner"].append(owner_info)

            key_info = self._check_service_keys(service_name, key_mapping)
            if key_info["old_key_count"] > 0:
                results["services_with_old_keys"].append(key_info)
            if key_info["total_keys"] > 1:
                results["services_with_multiple_keys"].append(key_info)

            status_info = self._check_service_status(service_info)
            if not status_info["is_active"]:
                results["inactive_services"].append(status_info)

            task_info = self._check_task_logs(service_name, task_logs_df)
            if task_info["has_issues"]:
                results["services_with_task_issues"].append(task_info)

            results["service_details"][service_name] = {
                "basic": service_info,
                "owner": owner_info,
                "keys": key_info,
                "status": status_info,
                "tasks": task_info,
                "manual_note": row.get("备注", "")
            }

        return results

    def _extract_service_info(self, row: pd.Series) -> Dict[str, Any]:
        return {
            "name": str(row.get("服务名称", row.get("service_name", row.get("name", "未知服务")))),
            "id": str(row.get("服务ID", row.get("service_id", row.get("id", "")))),
            "type": str(row.get("服务类型", row.get("service_type", row.get("type", "")))),
            "status": str(row.get("服务状态", row.get("status", "运行中"))),
            "env": str(row.get("环境", row.get("env", row.get("environment", "生产")))),
            "owner": str(row.get("负责人", row.get("owner", "")))
        }

    def _build_owner_map(self, owners_df: pd.DataFrame) -> Dict[str, Dict]:
        owner_map = {}
        if owners_df is None or owners_df.empty:
            return owner_map

        for _, row in owners_df.iterrows():
            service_name = str(row.get("服务名称", row.get("service_name", "")))
            owner_map[service_name] = {
                "name": str(row.get("负责人", row.get("owner", ""))),
                "email": str(row.get("邮箱", row.get("email", ""))),
                "phone": str(row.get("电话", row.get("phone", ""))),
                "department": str(row.get("部门", row.get("department", "")))
            }
        return owner_map

    def _check_service_owner(self, service_info: Dict[str, Any], owner_map: Dict[str, Dict]) -> Dict[str, Any]:
        service_name = service_info["name"]
        owner_from_service = service_info.get("owner", "")
        owner_from_owner_map = owner_map.get(service_name, {})

        has_owner = bool(owner_from_service and owner_from_service not in ["", "nan", "未知"])

        owner_details = owner_from_owner_map.get("name", "")
        has_owner_from_map = bool(owner_details and owner_details not in ["", "nan"])

        missing_owner = not (has_owner or has_owner_from_map)

        owner_name = owner_from_service if has_owner else owner_details

        return {
            "service_name": service_name,
            "missing_owner": missing_owner,
            "owner_name": owner_name,
            "owner_email": owner_from_owner_map.get("email", ""),
            "explanation": "该服务未配置负责人，出现问题时无法快速定位对接人，存在运维风险" if missing_owner else "",
            "owner_found_in": "service_list" if has_owner else "owners" if has_owner_from_map else "none"
        }

    def _check_service_keys(self, service_name: str, key_mapping: Dict[str, List[Dict]]) -> Dict[str, Any]:
        keys = key_mapping.get(service_name, [])
        if not keys:
            return {
                "service_name": service_name,
                "total_keys": 0,
                "old_key_count": 0,
                "explanation": "该服务未配置API密钥"
            }

        old_keys = [k for k in keys if k.get("version") and k["version"].lower() < "v2.0"]

        return {
            "service_name": service_name,
            "total_keys": len(keys),
            "old_key_count": len(old_keys),
            "keys": keys,
            "explanation": f"该服务配置了 {len(old_keys)} 个旧版本密钥" if len(old_keys) > 0 else ""
        }

    def _check_service_status(self, service_info: Dict[str, Any]) -> Dict[str, Any]:
        status = service_info.get("status", "")
        is_active = True
        
        inactive_keywords = ["运行中", "active", "启用", "正常", "online"]
        if status and status.lower() not in [k.lower() for k in inactive_keywords]:
            is_active = False

        return {
            "service_name": service_info["name"],
            "status": status,
            "is_active": is_active,
            "explanation": f"服务状态为 {status}，非活跃状态" if not is_active else ""
        }

    def _check_task_logs(self, service_name: str, task_logs_df: pd.DataFrame) -> Dict[str, Any]:
        if task_logs_df is None or task_logs_df.empty:
            return {"service_name": service_name, "has_issues": False, "logs": []}

        service_logs = task_logs_df[
            task_logs_df.apply(
                lambda row: service_name in str(row.values),
                axis=1
            )
        ].copy()

        if service_logs.empty:
            return {"service_name": service_name, "has_issues": False, "logs_count": 0}

        error_logs = service_logs[
            service_logs.apply(
                lambda row: any(
                    keyword in str(row.values).lower()
                    for keyword in ["失败", "error", "fail", "异常", "500", "401", "403"]
                ),
                axis=1
            )
        ]

        has_issues = len(error_logs) > 0

        return {
            "service_name": service_name,
            "has_issues": has_issues,
            "logs_count": len(service_logs),
            "error_count": len(error_logs),
            "explanation": f"发现 {len(error_logs)} 条异常任务日志" if has_issues else "",
            "recent_errors": error_logs.head(5).to_dict('records') if has_issues else []
        }

    def get_missing_owners_report(self, scan_results: Dict[str, Any]) -> pd.DataFrame:
        if not scan_results.get("services_missing_owner"):
            return pd.DataFrame()

        return pd.DataFrame(scan_results["services_missing_owner"])
