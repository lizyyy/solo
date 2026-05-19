import os
import re
from typing import List, Dict, Set, Tuple
import yaml
from .models import EvidenceResult, EvidenceStatus, SourceType, ServiceEntry, SourceLocation


class AlertChecker:
    def __init__(self, alert_dirs: List[str] = None):
        self.alert_dirs = [os.path.abspath(d) for d in (alert_dirs or [])]
        self._alert_cache: Dict[str, Set[str]] = {}
        self._alert_locations: Dict[str, List[SourceLocation]] = {}

    def load_alerts(self) -> Tuple[Dict[str, Set[str]], Dict[str, List[SourceLocation]]]:
        if self._alert_cache:
            return self._alert_cache, self._alert_locations

        alert_rule_names: Set[str] = set()
        alert_locations: Dict[str, List[SourceLocation]] = {}

        for alert_dir in self.alert_dirs:
            if not os.path.exists(alert_dir):
                continue

            for root, _, files in os.walk(alert_dir):
                for file in files:
                    if file.endswith((".yaml", ".yml")):
                        file_path = os.path.join(root, file)
                        self._parse_alert_file(file_path, alert_rule_names, alert_locations)

        self._alert_cache = {"rules": alert_rule_names}
        self._alert_locations = alert_locations
        return self._alert_cache, self._alert_locations

    def _parse_alert_file(
        self,
        file_path: str,
        alert_rule_names: Set[str],
        alert_locations: Dict[str, List[SourceLocation]],
    ) -> None:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                data = yaml.safe_load(content)
        except Exception:
            return

        if not isinstance(data, dict):
            return

        groups = data.get("groups", [])
        if not isinstance(groups, list):
            return

        for group in groups:
            if not isinstance(group, dict):
                continue
            rules = group.get("rules", [])
            if not isinstance(rules, list):
                continue

            for rule in rules:
                if not isinstance(rule, dict):
                    continue
                alert_name = rule.get("alert", "")
                if alert_name:
                    alert_rule_names.add(alert_name)
                    if alert_name not in alert_locations:
                        alert_locations[alert_name] = []
                    alert_locations[alert_name].append(
                        SourceLocation(file_path=file_path, raw_content=str(rule))
                    )

    def check_alerts(self, service_entry: ServiceEntry) -> EvidenceResult:
        if not service_entry.alert_rules:
            return EvidenceResult(
                source_type=SourceType.ALERT,
                status=EvidenceStatus.UNKNOWN,
                message="No alert rules configured",
                details={"service_name": service_entry.service_name},
            )

        _, alert_locations = self.load_alerts()
        matched_rules: List[str] = []
        missing_rules: List[str] = []

        for rule_name in service_entry.alert_rules:
            normalized_name = rule_name.strip()
            if normalized_name in alert_locations:
                matched_rules.append(normalized_name)
            else:
                found = False
                for existing_name in alert_locations:
                    if self._fuzzy_match(normalized_name, existing_name):
                        matched_rules.append(f"{rule_name} -> {existing_name}")
                        found = True
                        break
                if not found:
                    missing_rules.append(rule_name)

        if missing_rules:
            return EvidenceResult(
                source_type=SourceType.ALERT,
                status=EvidenceStatus.DEAD,
                message=f"Missing {len(missing_rules)} alert rule(s): {', '.join(missing_rules)}",
                details={
                    "service_name": service_entry.service_name,
                    "configured_rules": service_entry.alert_rules,
                    "matched_rules": matched_rules,
                    "missing_rules": missing_rules,
                },
            )

        if matched_rules:
            return EvidenceResult(
                source_type=SourceType.ALERT,
                status=EvidenceStatus.ALIVE,
                message=f"All {len(matched_rules)} alert rule(s) found",
                details={
                    "service_name": service_entry.service_name,
                    "configured_rules": service_entry.alert_rules,
                    "matched_rules": matched_rules,
                },
            )

        return EvidenceResult(
            source_type=SourceType.ALERT,
            status=EvidenceStatus.UNKNOWN,
            message="No alert rules could be verified",
            details={
                "service_name": service_entry.service_name,
                "configured_rules": service_entry.alert_rules,
            },
        )

    def _fuzzy_match(self, rule_name: str, existing_name: str) -> bool:
        rule_lower = rule_name.lower()
        existing_lower = existing_name.lower()

        if rule_lower in existing_lower or existing_lower in rule_lower:
            return True

        rule_parts = re.split(r"[_-]", rule_lower)
        existing_parts = re.split(r"[_-]", existing_lower)

        overlap = len(set(rule_parts) & set(existing_parts))
        total = len(set(rule_parts) | set(existing_parts))

        return total > 0 and overlap / total >= 0.5

    def get_rule_locations(self, rule_name: str) -> List[SourceLocation]:
        _, alert_locations = self.load_alerts()
        return alert_locations.get(rule_name, [])
