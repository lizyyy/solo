import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from .models import PortInspectionRule, RuleVersion, RiskLevel


class RuleManager:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.rules_dir = data_dir / "rules"
        self.rules_dir.mkdir(parents=True, exist_ok=True)
        self._init_default_rules()

    def _init_default_rules(self):
        rule_file = self.rules_dir / "rules_v1.0.0.json"
        if not rule_file.exists():
            default_rule = PortInspectionRule(
                version="v1.0.0",
                port_ranges={
                    "0-1023": RiskLevel.CRITICAL,
                    "1024-49151": RiskLevel.MEDIUM,
                    "49152-65535": RiskLevel.LOW,
                },
                reserved_ports=[22, 80, 443, 3306, 5432, 6379, 27017],
                threshold_connections=100,
                description="初始版本规则：系统端口CRITICAL，注册端口MEDIUM，动态端口LOW"
            )
            self._save_rule(default_rule)

        rule_file_v2 = self.rules_dir / "rules_v2.0.0.json"
        if not rule_file_v2.exists():
            v2_rule = PortInspectionRule(
                version="v2.0.0",
                port_ranges={
                    "0-1023": RiskLevel.HIGH,
                    "1024-49151": RiskLevel.LOW,
                    "49152-65535": RiskLevel.SAFE,
                },
                reserved_ports=[22, 80, 443, 3306, 5432, 6379, 27017, 8080, 8443],
                threshold_connections=50,
                description="v2.0版本：降低系统端口等级为HIGH，注册端口为LOW，新增常用端口"
            )
            self._save_rule(v2_rule)

    def _save_rule(self, rule: PortInspectionRule):
        rule_file = self.rules_dir / f"rules_{rule.version}.json"
        with open(rule_file, 'w', encoding='utf-8') as f:
            json.dump(rule.model_dump(), f, ensure_ascii=False, indent=2, default=str)

    def get_rule(self, version: Optional[str] = None) -> PortInspectionRule:
        if version is None:
            return self.get_latest_rule()
        rule_file = self.rules_dir / f"rules_{version}.json"
        if not rule_file.exists():
            raise ValueError(f"规则版本 {version} 不存在")
        with open(rule_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return PortInspectionRule(**data)

    def get_latest_rule(self) -> PortInspectionRule:
        rule_files = sorted(self.rules_dir.glob("rules_*.json"))
        if not rule_files:
            raise ValueError("没有找到任何规则文件")
        latest_file = rule_files[-1]
        with open(latest_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return PortInspectionRule(**data)

    def list_rule_versions(self) -> List[RuleVersion]:
        versions = []
        for rule_file in sorted(self.rules_dir.glob("rules_*.json")):
            with open(rule_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            versions.append(RuleVersion(
                version=data['version'],
                effective_date=datetime.fromtimestamp(rule_file.stat().st_mtime),
                description=data['description'],
                is_active=True
            ))
        return versions

    def get_port_risk_level(self, port: int, rule_version: Optional[str] = None) -> RiskLevel:
        rule = self.get_rule(rule_version)
        for port_range, risk_level in rule.port_ranges.items():
            start, end = map(int, port_range.split('-'))
            if start <= port <= end:
                if port in rule.reserved_ports:
                    return RiskLevel.CRITICAL
                return risk_level
        return RiskLevel.LOW

    def is_high_connections(self, connection_count: int, rule_version: Optional[str] = None) -> bool:
        rule = self.get_rule(rule_version)
        return connection_count >= rule.threshold_connections
