import pandas as pd
from typing import Dict, List, Any, Set
from datetime import datetime
import logging

from .config import Config

logger = logging.getLogger(__name__)


class AlertManager:
    def __init__(self, config: Config):
        self.config = config
        self.alert_rules = config.get("api_key_rotation.alert_rules", {})

    def collect_and_deduplicate_alerts(self, key_check_results: Dict[str, Any],
                                        service_scan_results: Dict[str, Any],
                                        callback_validation_results: Dict[str, Any]) -> Dict[str, Any]:
        all_alerts = []

        all_alerts.extend(self._extract_key_alerts(key_check_results))
        all_alerts.extend(self._extract_service_alerts(service_scan_results))
        all_alerts.extend(self._extract_callback_alerts(callback_validation_results))

        deduplicated_alerts = self._deduplicate_alerts(all_alerts)

        categorized_alerts = self._categorize_alerts(deduplicated_alerts)

        return {
            "total_alerts": len(deduplicated_alerts),
            "deduplicated_alerts": deduplicated_alerts,
            "categorized_alerts": categorized_alerts,
            "summary": self._generate_alert_summary(categorized_alerts)
        }

    def _extract_key_alerts(self, key_check_results: Dict[str, Any]) -> List[Dict[str, Any]]:
        alerts = []

        for item in key_check_results.get("deprecated_keys_in_use", []):
            alerts.append({
                "alert_id": self._generate_alert_id("deprecated_key", item.get("key_id", "")),
                "alert_type": "deprecated_key_enabled",
                "severity": self._get_severity("deprecated_key_enabled"),
                "service_name": item.get("service_name", ""),
                "key_id": item.get("key_id", ""),
                "version": item.get("version", ""),
                "message": item.get("explanation", "旧密钥版本仍在使用中"),
                "manual_note": item.get("manual_note", ""),
                "timestamp": datetime.now().isoformat(),
                "source": "key_version_check"
            })

        for item in key_check_results.get("expiring_soon", []):
            alerts.append({
                "alert_id": self._generate_alert_id("expiring_key", item.get("key_id", "")),
                "alert_type": "key_expiring_soon",
                "severity": self._get_severity("key_expiring_soon"),
                "service_name": item.get("service_name", ""),
                "key_id": item.get("key_id", ""),
                "version": item.get("version", ""),
                "message": item.get("explanation", "密钥即将过期"),
                "manual_note": item.get("manual_note", ""),
                "timestamp": datetime.now().isoformat(),
                "source": "key_version_check"
            })

        for item in key_check_results.get("expired_keys", []):
            alerts.append({
                "alert_id": self._generate_alert_id("expired_key", item.get("key_id", "")),
                "alert_type": "key_expired",
                "severity": "critical",
                "service_name": item.get("service_name", ""),
                "key_id": item.get("key_id", ""),
                "version": item.get("version", ""),
                "message": item.get("explanation", "密钥已过期"),
                "manual_note": item.get("manual_note", ""),
                "timestamp": datetime.now().isoformat(),
                "source": "key_version_check"
            })

        return alerts

    def _extract_service_alerts(self, service_scan_results: Dict[str, Any]) -> List[Dict[str, Any]]:
        alerts = []

        for item in service_scan_results.get("services_missing_owner", []):
            alerts.append({
                "alert_id": self._generate_alert_id("missing_owner", item.get("service_name", "")),
                "alert_type": "missing_owner",
                "severity": self._get_severity("missing_owner"),
                "service_name": item.get("service_name", ""),
                "message": item.get("explanation", "服务缺少负责人"),
                "manual_note": "",
                "timestamp": datetime.now().isoformat(),
                "source": "service_scan"
            })

        for item in service_scan_results.get("services_with_old_keys", []):
            if item.get("old_key_count", 0) > 0:
                alerts.append({
                    "alert_id": self._generate_alert_id("service_old_keys", item.get("service_name", "")),
                    "alert_type": "service_has_old_keys",
                    "severity": "high",
                    "service_name": item.get("service_name", ""),
                    "old_key_count": item.get("old_key_count", 0),
                    "message": item.get("explanation", f"服务使用了 {item.get('old_key_count', 0)} 个旧版本密钥"),
                    "manual_note": "",
                    "timestamp": datetime.now().isoformat(),
                    "source": "service_scan"
                })

        for item in service_scan_results.get("services_with_task_issues", []):
            alerts.append({
                "alert_id": self._generate_alert_id("task_issues", item.get("service_name", "")),
                "alert_type": "task_execution_issues",
                "severity": "medium",
                "service_name": item.get("service_name", ""),
                "error_count": item.get("error_count", 0),
                "message": item.get("explanation", "任务执行存在异常"),
                "manual_note": "",
                "timestamp": datetime.now().isoformat(),
                "source": "service_scan"
            })

        return alerts

    def _extract_callback_alerts(self, callback_validation_results: Dict[str, Any]) -> List[Dict[str, Any]]:
        alerts = []

        for item in callback_validation_results.get("signature_failures", []):
            alerts.append({
                "alert_id": self._generate_alert_id("callback_signature", item.get("callback_id", "")),
                "alert_type": "callback_signature_failure",
                "severity": self._get_severity("callback_signature_failure"),
                "service_name": item.get("service_name", ""),
                "callback_id": item.get("callback_id", ""),
                "url": item.get("url", ""),
                "message": item.get("explanation", "回调签名验证失败"),
                "manual_note": "",
                "timestamp": datetime.now().isoformat(),
                "source": "callback_validation"
            })

        for item in callback_validation_results.get("url_format_errors", []):
            alerts.append({
                "alert_id": self._generate_alert_id("callback_url_format", item.get("callback_id", "")),
                "alert_type": "callback_url_invalid",
                "severity": "medium",
                "service_name": item.get("service_name", ""),
                "callback_id": item.get("callback_id", ""),
                "url": item.get("url", ""),
                "message": item.get("explanation", "回调地址格式错误"),
                "manual_note": "",
                "timestamp": datetime.now().isoformat(),
                "source": "callback_validation"
            })

        return alerts

    def _deduplicate_alerts(self, alerts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        seen_alert_ids: Set[str] = set()
        deduplicated = []

        for alert in sorted(alerts, key=lambda x: self._severity_order(x.get("severity", "low"))):
            alert_id = alert.get("alert_id", "")
            if alert_id and alert_id not in seen_alert_ids:
                seen_alert_ids.add(alert_id)
                alert["dedup_status"] = "new"
                deduplicated.append(alert)
            elif alert_id in seen_alert_ids:
                pass

        return deduplicated

    def _severity_order(self, severity: str) -> int:
        order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "warning": 4}
        return order.get(severity.lower(), 99)

    def _categorize_alerts(self, alerts: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        categorized = {
            "critical": [],
            "high": [],
            "medium": [],
            "low": [],
            "warning": []
        }

        for alert in alerts:
            severity = alert.get("severity", "low").lower()
            if severity in categorized:
                categorized[severity].append(alert)

        return categorized

    def _generate_alert_summary(self, categorized_alerts: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        summary = {}
        for severity, alerts in categorized_alerts.items():
            summary[severity] = len(alerts)
        summary["total"] = sum(len(alerts) for alerts in categorized_alerts.values())
        return summary

    def _generate_alert_id(self, alert_type: str, identifier: str) -> str:
        return f"{alert_type}_{identifier}"

    def _get_severity(self, alert_type: str) -> str:
        rule = self.alert_rules.get(alert_type, {})
        return rule.get("severity", "medium")

    def get_alerts_dataframe(self, alert_results: Dict[str, Any]) -> pd.DataFrame:
        alerts = alert_results.get("deduplicated_alerts", [])
        if not alerts:
            return pd.DataFrame()

        return pd.DataFrame(alerts)

    def get_high_priority_alerts(self, alert_results: Dict[str, Any]) -> List[Dict[str, Any]]:
        categorized = alert_results.get("categorized_alerts", {})
        return categorized.get("critical", []) + categorized.get("high", [])
