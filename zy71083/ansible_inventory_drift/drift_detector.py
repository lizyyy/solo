from typing import Dict, List, Optional, Set, Tuple
from datetime import datetime

from .models import (
    Host,
    ParsedInventory,
    DriftItem,
    DriftReport,
    DriftType,
    RiskLevel,
)
from .cmdb_parser import LabelNormalizer


class DriftDetector:
    def __init__(self, normalizer: Optional[LabelNormalizer] = None):
        self.normalizer = normalizer or LabelNormalizer()

    def detect(
        self,
        inventory: ParsedInventory,
        cmdb_hosts: Dict[str, Host],
        inventory_path: str,
        cmdb_path: Optional[str] = None,
    ) -> DriftReport:
        report = DriftReport(
            inventory_file=inventory_path,
            cmdb_file=cmdb_path,
            generated_at=datetime.now(),
            total_hosts_inventory=len(inventory.hosts),
            total_hosts_cmdb=len(cmdb_hosts),
        )

        cmdb_hosts_by_name = self._build_cmdb_lookup(cmdb_hosts)

        for inv_host_name, inv_host in inventory.hosts.items():
            cmdb_host = self._find_cmdb_host(inv_host, cmdb_hosts_by_name)

            if inv_host.is_decommissioned:
                self._check_decommissioned(report, inv_host)
                continue

            if cmdb_host is None:
                self._add_drift(
                    report,
                    DriftType.MISSING_IN_CMDB,
                    inv_host_name,
                    RiskLevel.HIGH,
                    inventory_value=inv_host.hostname,
                    cmdb_value=None,
                    description=f"主机 '{inv_host_name}' 在 Inventory 中存在，但在 CMDB 中找不到",
                )
                continue

            self._compare_hosts(report, inv_host, cmdb_host)

        for cmdb_host_name, cmdb_host in cmdb_hosts.items():
            if cmdb_host.is_decommissioned:
                continue
            inv_host = self._find_host_in_inventory(cmdb_host, inventory)
            if inv_host is None:
                self._add_drift(
                    report,
                    DriftType.MISSING_IN_INVENTORY,
                    cmdb_host_name,
                    RiskLevel.MEDIUM,
                    inventory_value=None,
                    cmdb_value=cmdb_host.hostname,
                    description=f"主机 '{cmdb_host_name}' 在 CMDB 中存在，但在 Inventory 中找不到",
                )

        self._check_alias_conflicts(report, inventory)

        report.calculate_summaries()
        report.recommendations = self._generate_recommendations(report)

        return report

    def _build_cmdb_lookup(self, cmdb_hosts: Dict[str, Host]) -> Dict[str, Host]:
        lookup = {}
        for host in cmdb_hosts.values():
            for name in host.get_all_names():
                lookup[name] = host
        return lookup

    def _find_cmdb_host(self, inv_host: Host, cmdb_lookup: Dict[str, Host]) -> Optional[Host]:
        for name in inv_host.get_all_names():
            if name in cmdb_lookup:
                return cmdb_lookup[name]
        return None

    def _find_host_in_inventory(self, cmdb_host: Host, inventory: ParsedInventory) -> Optional[Host]:
        return inventory.get_host_by_any_name(cmdb_host.hostname)

    def _check_decommissioned(self, report: DriftReport, inv_host: Host):
        self._add_drift(
            report,
            DriftType.DECOMMISSIONED_STILL_PRESENT,
            inv_host.hostname,
            RiskLevel.MEDIUM,
            inventory_value=inv_host.hostname,
            cmdb_value=None,
            description=f"主机 '{inv_host.hostname}' 已标记为退役，但仍存在于 Inventory 中",
        )

    def _compare_hosts(self, report: DriftReport, inv_host: Host, cmdb_host: Host):
        if inv_host.hostname.lower() != cmdb_host.hostname.lower():
            self._add_drift(
                report,
                DriftType.HOSTNAME_MISMATCH,
                inv_host.hostname,
                RiskLevel.MEDIUM,
                inventory_value=inv_host.hostname,
                cmdb_value=cmdb_host.hostname,
                description=f"主机名不一致: Inventory 使用 '{inv_host.hostname}'，CMDB 使用 '{cmdb_host.hostname}'",
            )

        self._compare_roles(report, inv_host, cmdb_host)
        self._compare_environment(report, inv_host, cmdb_host)
        self._compare_labels(report, inv_host, cmdb_host)

    def _compare_roles(self, report: DriftReport, inv_host: Host, cmdb_host: Host):
        inv_roles = self.normalizer.normalize_roles(inv_host.roles)
        cmdb_roles = self.normalizer.normalize_roles(cmdb_host.roles)

        if inv_roles and cmdb_roles and inv_roles != cmdb_roles:
            missing_in_inv = cmdb_roles - inv_roles
            missing_in_cmdb = inv_roles - cmdb_roles

            details = {}
            if missing_in_inv:
                details["missing_in_inventory"] = list(missing_in_inv)
            if missing_in_cmdb:
                details["missing_in_cmdb"] = list(missing_in_cmdb)

            risk = RiskLevel.HIGH if self._has_production_env(inv_host, cmdb_host) else RiskLevel.MEDIUM

            self._add_drift(
                report,
                DriftType.ROLE_MISMATCH,
                inv_host.hostname,
                risk,
                inventory_value=sorted(list(inv_roles)),
                cmdb_value=sorted(list(cmdb_roles)),
                description=f"角色标签不一致: Inventory={sorted(list(inv_roles))}, CMDB={sorted(list(cmdb_roles))}",
                details=details,
            )

    def _compare_environment(self, report: DriftReport, inv_host: Host, cmdb_host: Host):
        if not inv_host.environment or not cmdb_host.environment:
            return

        inv_env = self.normalizer.normalize_environment(inv_host.environment)
        cmdb_env = self.normalizer.normalize_environment(cmdb_host.environment)

        if inv_env != cmdb_env:
            self._add_drift(
                report,
                DriftType.ENVIRONMENT_MISMATCH,
                inv_host.hostname,
                RiskLevel.CRITICAL,
                inventory_value=inv_env,
                cmdb_value=cmdb_env,
                description=f"环境标签不一致: Inventory='{inv_env}', CMDB='{cmdb_env}' - 这是高风险问题！",
            )

    def _compare_labels(self, report: DriftReport, inv_host: Host, cmdb_host: Host):
        inv_labels = inv_host.normalized_labels()
        cmdb_labels = cmdb_host.normalized_labels()

        all_keys = set(inv_labels.keys()) | set(cmdb_labels.keys())
        mismatched = {}

        for key in all_keys:
            if key in ["role", "roles", "env", "environment", "hostname", "host", "name", "ip", "ip_address"]:
                continue

            inv_val = inv_labels.get(key)
            cmdb_val = cmdb_labels.get(key)

            if inv_val != cmdb_val:
                mismatched[key] = {
                    "inventory": inv_val,
                    "cmdb": cmdb_val,
                }

        if mismatched:
            self._add_drift(
                report,
                DriftType.LABEL_MISMATCH,
                inv_host.hostname,
                RiskLevel.LOW,
                inventory_value=inv_labels,
                cmdb_value=cmdb_labels,
                description=f"存在 {len(mismatched)} 个标签不一致",
                details={"mismatched_labels": mismatched},
            )

    def _check_alias_conflicts(self, report: DriftReport, inventory: ParsedInventory):
        alias_map: Dict[str, List[str]] = {}

        for host_name, host in inventory.hosts.items():
            for alias in host.aliases:
                alias_lower = alias.lower()
                if alias_lower not in alias_map:
                    alias_map[alias_lower] = []
                alias_map[alias_lower].append(host_name)

        for alias, hosts in alias_map.items():
            if len(hosts) > 1:
                self._add_drift(
                    report,
                    DriftType.ALIAS_CONFLICT,
                    alias,
                    RiskLevel.CRITICAL,
                    inventory_value=hosts,
                    cmdb_value=None,
                    description=f"别名冲突: '{alias}' 被多个主机使用: {', '.join(hosts)}",
                    details={"conflicting_hosts": hosts},
                )

    def _has_production_env(self, *hosts: Host) -> bool:
        for host in hosts:
            if host.environment:
                env = self.normalizer.normalize_environment(host.environment)
                if env == "production":
                    return True
        return False

    def _add_drift(
        self,
        report: DriftReport,
        drift_type: DriftType,
        host: str,
        risk_level: RiskLevel,
        inventory_value=None,
        cmdb_value=None,
        description: str = "",
        details: Optional[Dict] = None,
    ):
        report.drift_items.append(
            DriftItem(
                drift_type=drift_type,
                host=host,
                risk_level=risk_level,
                inventory_value=inventory_value,
                cmdb_value=cmdb_value,
                description=description,
                details=details or {},
            )
        )

    def _generate_recommendations(self, report: DriftReport) -> List[str]:
        recommendations = []

        if RiskLevel.CRITICAL in report.risk_summary:
            recommendations.append(
                f"【紧急】存在 {report.risk_summary[RiskLevel.CRITICAL]} 个严重问题，"
                f"包括环境不一致或别名冲突，请立即处理！"
            )

        if DriftType.ENVIRONMENT_MISMATCH in report.summary:
            recommendations.append(
                "环境标签不一致可能导致运维脚本跑错机器，请核对 Inventory 和 CMDB 的环境配置。"
            )

        if DriftType.ALIAS_CONFLICT in report.summary:
            recommendations.append(
                "主机别名冲突可能导致 Ansible 执行命令时目标主机不明确，请清理重复的 ansible_host 配置。"
            )

        if DriftType.MISSING_IN_CMDB in report.summary:
            recommendations.append(
                f"有 {report.summary[DriftType.MISSING_IN_CMDB]} 台主机未录入 CMDB，"
                f"建议补充 CMDB 记录或从 Inventory 移除退役主机。"
            )

        if DriftType.DECOMMISSIONED_STILL_PRESENT in report.summary:
            recommendations.append(
                f"有 {report.summary[DriftType.DECOMMISSIONED_STILL_PRESENT]} 台已退役主机仍在 Inventory 中，"
                f"建议清理。"
            )

        if DriftType.ROLE_MISMATCH in report.summary:
            recommendations.append(
                f"有 {report.summary[DriftType.ROLE_MISMATCH]} 台主机角色不一致，"
                f"这可能影响运维剧本的执行目标。"
            )

        return recommendations
