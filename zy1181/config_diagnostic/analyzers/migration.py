from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

try:
    from deepdiff import DeepDiff
    HAS_DEEPDIFF = True
except ImportError:
    HAS_DEEPDIFF = False

from ..parsers.base import ConfigType, ParsedConfig


class MigrationRisk(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class ConfigVersion:
    version_identifier: str
    config_type: ConfigType
    source_path: str
    keys: List[str]
    values: Dict[str, Any]


@dataclass
class MigrationChange:
    key: str
    change_type: str
    old_value: Any
    new_value: Any
    old_source: str
    new_source: str
    risk_level: MigrationRisk
    description: str


@dataclass
class RollbackRisk:
    key: str
    risk_description: str
    impact: str
    mitigation: str
    risk_level: MigrationRisk


@dataclass
class MigrationResult:
    versions: List[ConfigVersion] = field(default_factory=list)
    changes: List[MigrationChange] = field(default_factory=list)
    rollback_risks: List[RollbackRisk] = field(default_factory=list)
    added_keys: List[str] = field(default_factory=list)
    removed_keys: List[str] = field(default_factory=list)
    modified_keys: List[str] = field(default_factory=list)
    type_changes: List[Dict[str, Any]] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)


class MigrationAnalyzer:
    def __init__(self):
        self._versions: List[Tuple[ConfigVersion, ParsedConfig]] = []
    
    def add_version(self, config: ParsedConfig, version_identifier: Optional[str] = None) -> None:
        if version_identifier is None:
            version_identifier = f"v{len(self._versions) + 1}"
        
        version = ConfigVersion(
            version_identifier=version_identifier,
            config_type=config.config_type,
            source_path=config.source_path,
            keys=list(config.values.keys()),
            values={k: v.value for k, v in config.values.items()},
        )
        
        self._versions.append((version, config))
    
    def analyze(self) -> MigrationResult:
        result = MigrationResult()
        result.versions = [v[0] for v in self._versions]
        
        if len(self._versions) < 2:
            result.summary = {"error": "Need at least 2 versions for migration analysis"}
            return result
        
        for i in range(len(self._versions) - 1):
            old_version, old_config = self._versions[i]
            new_version, new_config = self._versions[i + 1]
            
            changes = self._compare_versions(
                old_version, old_config,
                new_version, new_config
            )
            
            result.changes.extend(changes)
        
        self._analyze_key_changes(result)
        self._analyze_rollback_risks(result)
        self._generate_summary(result)
        
        return result
    
    def _compare_versions(
        self,
        old_version: ConfigVersion,
        old_config: ParsedConfig,
        new_version: ConfigVersion,
        new_config: ParsedConfig
    ) -> List[MigrationChange]:
        changes: List[MigrationChange] = []
        
        old_keys = set(old_version.values.keys())
        new_keys = set(new_version.values.keys())
        
        added = new_keys - old_keys
        removed = old_keys - new_keys
        common = old_keys & new_keys
        
        for key in added:
            new_val = new_version.values[key]
            changes.append(MigrationChange(
                key=key,
                change_type="added",
                old_value=None,
                new_value=new_val,
                old_source="",
                new_source=new_version.source_path,
                risk_level=self._assess_risk("added", key, None, new_val),
                description=f"Key '{key}' added with value: {new_val}",
            ))
        
        for key in removed:
            old_val = old_version.values[key]
            changes.append(MigrationChange(
                key=key,
                change_type="removed",
                old_value=old_val,
                new_value=None,
                old_source=old_version.source_path,
                new_source="",
                risk_level=self._assess_risk("removed", key, old_val, None),
                description=f"Key '{key}' removed (was: {old_val})",
            ))
        
        for key in common:
            old_val = old_version.values[key]
            new_val = new_version.values[key]
            
            if old_val != new_val:
                change_type = "modified"
                if type(old_val) != type(new_val):
                    change_type = "type_changed"
                
                changes.append(MigrationChange(
                    key=key,
                    change_type=change_type,
                    old_value=old_val,
                    new_value=new_val,
                    old_source=old_version.source_path,
                    new_source=new_version.source_path,
                    risk_level=self._assess_risk(change_type, key, old_val, new_val),
                    description=f"Key '{key}' changed from {old_val} to {new_val}",
                ))
                
                if type(old_val) != type(new_val):
                    type_change = {
                        "key": key,
                        "old_type": type(old_val).__name__,
                        "new_type": type(new_val).__name__,
                        "old_value": old_val,
                        "new_value": new_val,
                    }
        
        return changes
    
    def _assess_risk(
        self,
        change_type: str,
        key: str,
        old_value: Any,
        new_value: Any
    ) -> MigrationRisk:
        key_lower = key.lower()
        
        high_risk_patterns = [
            "password", "secret", "token", "api_key", "connection",
            "database", "db_", "redis", "mongo", "mysql", "postgres",
            "host", "port", "url", "endpoint", "enabled", "disabled",
            "debug", "production", "prod", "environment", "env",
        ]
        
        is_high_risk_key = any(pattern in key_lower for pattern in high_risk_patterns)
        
        if change_type == "removed":
            if is_high_risk_key:
                return MigrationRisk.CRITICAL
            return MigrationRisk.HIGH
        
        if change_type == "type_changed":
            if is_high_risk_key:
                return MigrationRisk.CRITICAL
            return MigrationRisk.HIGH
        
        if change_type == "modified":
            if is_high_risk_key:
                if self._is_significant_change(old_value, new_value):
                    return MigrationRisk.HIGH
                return MigrationRisk.MEDIUM
            return MigrationRisk.LOW
        
        if change_type == "added":
            if is_high_risk_key:
                return MigrationRisk.MEDIUM
            return MigrationRisk.LOW
        
        return MigrationRisk.LOW
    
    def _is_significant_change(self, old_value: Any, new_value: Any) -> bool:
        if old_value != new_value:
            return True
        
        return False
    
    def _analyze_key_changes(self, result: MigrationResult) -> None:
        for change in result.changes:
            if change.change_type == "added":
                result.added_keys.append(change.key)
            elif change.change_type == "removed":
                result.removed_keys.append(change.key)
            elif change.change_type in ["modified", "type_changed"]:
                result.modified_keys.append(change.key)
    
    def _analyze_rollback_risks(self, result: MigrationResult) -> None:
        for change in result.changes:
            if change.risk_level in [MigrationRisk.HIGH, MigrationRisk.CRITICAL]:
                risk = self._create_rollback_risk(change)
                result.rollback_risks.append(risk)
    
    def _create_rollback_risk(self, change: MigrationChange) -> RollbackRisk:
        impact = ""
        mitigation = ""
        
        if change.change_type == "removed":
            impact = f"Removing '{change.key}' may break backward compatibility. " \
                     f"Systems expecting this key will fail or behave unexpectedly."
            mitigation = f"Consider deprecating instead of removing immediately. " \
                        f"Provide a migration path and documentation."
        
        elif change.change_type == "type_changed":
            impact = f"Type change for '{change.key}' from {type(change.old_value).__name__} " \
                     f"to {type(change.new_value).__name__} may cause parsing errors."
            mitigation = f"Ensure all consuming systems can handle the new type. " \
                        f"Consider maintaining backward compatibility with type coercion."
        
        elif change.change_type == "modified":
            impact = f"Value change for high-risk key '{change.key}' may affect " \
                     f"system behavior or security."
            mitigation = f"Verify the change is intentional. Test in staging first. " \
                        f"Consider feature flags for gradual rollout."
        
        return RollbackRisk(
            key=change.key,
            risk_description=change.description,
            impact=impact,
            mitigation=mitigation,
            risk_level=change.risk_level,
        )
    
    def _generate_summary(self, result: MigrationResult) -> None:
        critical_count = sum(1 for c in result.changes if c.risk_level == MigrationRisk.CRITICAL)
        high_count = sum(1 for c in result.changes if c.risk_level == MigrationRisk.HIGH)
        medium_count = sum(1 for c in result.changes if c.risk_level == MigrationRisk.MEDIUM)
        low_count = sum(1 for c in result.changes if c.risk_level == MigrationRisk.LOW)
        
        result.summary = {
            "total_changes": len(result.changes),
            "added_keys": len(result.added_keys),
            "removed_keys": len(result.removed_keys),
            "modified_keys": len(result.modified_keys),
            "risk_distribution": {
                "critical": critical_count,
                "high": high_count,
                "medium": medium_count,
                "low": low_count,
            },
            "rollback_risk_count": len(result.rollback_risks),
            "versions_compared": len(result.versions),
        }
    
    def generate_migration_plan(self) -> Dict[str, Any]:
        if len(self._versions) < 2:
            return {"error": "Need at least 2 versions for migration plan"}
        
        result = self.analyze()
        
        plan = {
            "migration_steps": [],
            "verification_steps": [],
            "rollback_plan": [],
            "summary": result.summary,
        }
        
        step_num = 1
        
        for change in result.changes:
            if change.change_type == "added":
                plan["migration_steps"].append({
                    "step": step_num,
                    "action": f"Add new configuration key: {change.key}",
                    "details": f"Value: {change.new_value}",
                    "risk": change.risk_level.value,
                })
                step_num += 1
            
            elif change.change_type == "removed":
                plan["migration_steps"].append({
                    "step": step_num,
                    "action": f"Remove deprecated key: {change.key}",
                    "details": f"Previous value: {change.old_value}",
                    "risk": change.risk_level.value,
                })
                step_num += 1
            
            elif change.change_type in ["modified", "type_changed"]:
                plan["migration_steps"].append({
                    "step": step_num,
                    "action": f"Update key: {change.key}",
                    "details": f"From {change.old_value} to {change.new_value}",
                    "risk": change.risk_level.value,
                })
                step_num += 1
        
        plan["verification_steps"] = [
            {
                "step": 1,
                "action": "Validate all added keys are accessible",
                "keys": result.added_keys,
            },
            {
                "step": 2,
                "action": "Verify modified keys work correctly",
                "keys": result.modified_keys,
            },
            {
                "step": 3,
                "action": "Ensure removed keys no longer cause errors",
                "keys": result.removed_keys,
            },
        ]
        
        if result.rollback_risks:
            plan["rollback_plan"] = [
                {
                    "key": risk.key,
                    "action": f"Revert: {risk.risk_description}",
                    "mitigation": risk.mitigation,
                }
                for risk in result.rollback_risks
            ]
        
        return plan
