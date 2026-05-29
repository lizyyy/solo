import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any
import logging

from .config import Config

logger = logging.getLogger(__name__)


class KeyVersionChecker:
    def __init__(self, config: Config):
        self.config = config
        self.current_version = config.get("api_key_rotation.current_key_version", "v1.0")
        self.key_expiry_days = config.get("api_key_rotation.key_expiry_days", 30)
        self.warning_days = config.get("api_key_rotation.warning_days_before_expiry", 7)

    def check_key_versions(self, key_versions_df: pd.DataFrame, service_list_df: pd.DataFrame) -> Dict[str, Any]:
        if key_versions_df is None or key_versions_df.empty:
            logger.warning("密钥版本数据为空")
            return {"errors": ["密钥版本数据为空"]}

        if service_list_df is None or service_list_df.empty:
            logger.warning("服务清单数据为空")
            return {"errors": ["服务清单数据为空"]}

        results = {
            "current_version": self.current_version,
            "total_keys": len(key_versions_df),
            "deprecated_keys_in_use": [],
            "expiring_soon": [],
            "expired_keys": [],
            "key_versions_summary": {},
            "service_key_mapping": {}
        }

        for _, row in key_versions_df.iterrows():
            key_info = self._extract_key_info(row)
            
            if key_info["version"] not in results["key_versions_summary"]:
                results["key_versions_summary"][key_info["version"]] = 0
            results["key_versions_summary"][key_info["version"]] += 1

            if self._is_deprecated_version(key_info["version"]):
                if key_info.get("is_enabled", True):
                    deprecated_record = {
                        "key_id": key_info["key_id"],
                        "version": key_info["version"],
                        "service_name": key_info.get("service_name", "未知"),
                        "enabled": key_info.get("is_enabled", True),
                        "create_time": key_info.get("create_time", ""),
                        "explanation": f"密钥版本 {key_info['version']} 已过时，当前最新版本为 {self.current_version}，但该密钥仍处于启用状态",
                        "manual_note": row.get("备注", "")
                    }
                    results["deprecated_keys_in_use"].append(deprecated_record)

            expiry_check = self._check_key_expiry(key_info)
            if expiry_check["status"] == "expiring_soon":
                key_info["explanation"] = expiry_check["explanation"]
                key_info["manual_note"] = row.get("备注", "")
                results["expiring_soon"].append(key_info)
            elif expiry_check["status"] == "expired":
                key_info["explanation"] = expiry_check["explanation"]
                key_info["manual_note"] = row.get("备注", "")
                results["expired_keys"].append(key_info)

        results["service_key_mapping"] = self._map_services_to_keys(key_versions_df, service_list_df)
        
        return results

    def _extract_key_info(self, row: pd.Series) -> Dict[str, Any]:
        key_id = str(row.get("密钥ID", row.get("key_id", row.get("id", ""))))
        version = str(row.get("密钥版本", row.get("version", row.get("key_version", "v1.0"))))
        service_name = str(row.get("服务名称", row.get("service_name", row.get("service", ""))))
        create_time = str(row.get("创建时间", row.get("create_time", row.get("created_at", ""))))
        
        is_enabled = True
        enabled_val = row.get("是否启用", row.get("enabled", row.get("status", "是")))
        if isinstance(enabled_val, str):
            is_enabled = enabled_val.lower() in ["是", "true", "启用", "enabled", "active", "1"]
        
        return {
            "key_id": key_id,
            "version": version,
            "service_name": service_name,
            "create_time": create_time,
            "is_enabled": is_enabled
        }

    def _is_deprecated_version(self, version: str) -> bool:
        def parse_version(v):
            v = v.lower().lstrip('v')
            parts = v.split('.')
            return tuple(int(p) if p.isdigit() else 0 for p in parts)
        
        try:
            current = parse_version(self.current_version)
            check = parse_version(version)
            return check < current
        except:
            return version != self.current_version

    def _check_key_expiry(self, key_info: Dict[str, Any]) -> Dict[str, str]:
        create_time_str = key_info.get("create_time", "")
        
        if not create_time_str or create_time_str in ["", "nan", "NaT"]:
            return {"status": "unknown", "explanation": "无法确定密钥创建时间"}
        
        try:
            if 'T' in create_time_str:
                create_time = datetime.fromisoformat(create_time_str.replace('Z', '+00:00'))
            else:
                for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d"]:
                    try:
                        create_time = datetime.strptime(create_time_str, fmt)
                        break
                    except ValueError:
                        continue
                else:
                    return {"status": "unknown", "explanation": f"无法解析时间格式: {create_time_str}"}
            
            expiry_time = create_time + timedelta(days=self.key_expiry_days)
            now = datetime.now()
            days_to_expiry = (expiry_time - now).days
            
            if days_to_expiry < 0:
                return {
                    "status": "expired",
                    "explanation": f"密钥已过期 {abs(days_to_expiry)} 天（过期时间：{expiry_time.strftime('%Y-%m-%d')}）"
                }
            elif days_to_expiry <= self.warning_days:
                return {
                    "status": "expiring_soon",
                    "explanation": f"密钥将在 {days_to_expiry} 天后过期（过期时间：{expiry_time.strftime('%Y-%m-%d')}）"
                }
            
            return {"status": "valid", "explanation": "密钥在有效期内"}
        except Exception as e:
            return {"status": "error", "explanation": f"检查过期时间时出错: {str(e)}"}

    def _map_services_to_keys(self, key_versions_df: pd.DataFrame, service_list_df: pd.DataFrame) -> Dict[str, List[Dict]]:
        mapping = {}
        
        service_names = service_list_df["服务名称"].tolist() if "服务名称" in service_list_df.columns else []
        
        for _, row in key_versions_df.iterrows():
            service_name = str(row.get("服务名称", row.get("service_name", "未知")))
            if service_name not in mapping:
                mapping[service_name] = []
            
            mapping[service_name].append({
                "key_id": str(row.get("密钥ID", row.get("key_id", ""))),
                "version": str(row.get("密钥版本", row.get("version", ""))),
                "enabled": str(row.get("是否启用", row.get("enabled", "是")))
            })
        
        return mapping

    def get_deprecated_keys_report(self, check_results: Dict[str, Any]) -> pd.DataFrame:
        if not check_results.get("deprecated_keys_in_use"):
            return pd.DataFrame()
        
        return pd.DataFrame(check_results["deprecated_keys_in_use"])
