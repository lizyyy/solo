from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import List, Optional, Dict, Any, Callable

from .log_parser import LogEntry, UpgradeEventType, LogLevel
from .models import Device, FirmwareManifest, UpgradeAttempt, UpgradeDirection, StateTransition
from .state_machine import UpgradeState, UpgradeStateMachine, StateContext


class RiskLevel(Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ViolationType(Enum):
    HANDSHAKE_TIMEOUT = "HANDSHAKE_TIMEOUT"
    VERSION_SKIP = "VERSION_SKIP"
    CRC_FAILURE = "CRC_FAILURE"
    DUPLICATE_FLASH = "DUPLICATE_FLASH"
    ROLLBACK_GAP = "ROLLBACK_GAP"
    INVALID_ROLLBACK_VERSION = "INVALID_ROLLBACK_VERSION"
    INTERRUPTED_UPGRADE = "INTERRUPTED_UPGRADE"
    EXCESSIVE_RETRIES = "EXCESSIVE_RETRIES"
    UNEXPECTED_STATE = "UNEXPECTED_STATE"
    FIRMWARE_MISMATCH = "FIRMWARE_MISMATCH"
    INCOMPLETE_TRANSFER = "INCOMPLETE_TRANSFER"


@dataclass
class Violation:
    violation_type: ViolationType
    risk_level: RiskLevel
    description: str
    log_line_number: int = 0
    timestamp: Optional[datetime] = None
    affected_versions: List[str] = field(default_factory=list)
    retry_count: int = 0
    state_transition: Optional[StateTransition] = None
    raw_log: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "violation_type": self.violation_type.value,
            "risk_level": self.risk_level.value,
            "description": self.description,
            "log_line_number": self.log_line_number,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "affected_versions": self.affected_versions,
            "retry_count": self.retry_count,
            "raw_log": self.raw_log,
        }


@dataclass
class RuleResult:
    rule_name: str
    passed: bool
    violations: List[Violation] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "rule_name": self.rule_name,
            "passed": self.passed,
            "violation_count": len(self.violations),
            "violations": [v.to_dict() for v in self.violations],
            "warnings": self.warnings,
        }


class BaseRule:
    def __init__(self, name: str):
        self.name = name
    
    def check(self, *args, **kwargs) -> RuleResult:
        raise NotImplementedError("Subclasses must implement check method")


class HandshakeTimeoutRule(BaseRule):
    def __init__(self, timeout_seconds: int = 30):
        super().__init__("HandshakeTimeoutRule")
        self.timeout_seconds = timeout_seconds
    
    def check(self, state_machine: UpgradeStateMachine, log_entries: List[LogEntry]) -> RuleResult:
        violations: List[Violation] = []
        
        context = state_machine.context
        
        for i, entry in enumerate(log_entries):
            if entry.event_type == UpgradeEventType.HANDSHAKE:
                next_timeout = None
                for j in range(i + 1, len(log_entries)):
                    next_entry = log_entries[j]
                    if next_entry.event_type in [UpgradeEventType.VERSION_CHECK, UpgradeEventType.TIMEOUT]:
                        if next_entry.event_type == UpgradeEventType.TIMEOUT:
                            next_timeout = next_entry
                        break
                
                if next_timeout:
                    violation = Violation(
                        violation_type=ViolationType.HANDSHAKE_TIMEOUT,
                        risk_level=RiskLevel.HIGH,
                        description=f"握手超时检测到。超过 {self.timeout_seconds} 秒无响应",
                        log_line_number=next_timeout.line_number,
                        timestamp=next_timeout.timestamp,
                        raw_log=next_timeout.raw_line,
                    )
                    violations.append(violation)
        
        if context.current_state == UpgradeState.TIMEOUT:
            for t in context.transitions:
                if t.to_state == UpgradeState.TIMEOUT.value:
                    violation = Violation(
                        violation_type=ViolationType.HANDSHAKE_TIMEOUT,
                        risk_level=RiskLevel.HIGH,
                        description="升级过程中发生超时，可能是握手失败导致",
                        log_line_number=t.log_line_number,
                        timestamp=t.timestamp,
                    )
                    violations.append(violation)
                    break
        
        return RuleResult(
            rule_name=self.name,
            passed=len(violations) == 0,
            violations=violations,
        )


class VersionSkipRule(BaseRule):
    def __init__(self, allowed_versions: Optional[List[str]] = None):
        super().__init__("VersionSkipRule")
        self.allowed_versions = allowed_versions or []
    
    def check(self, upgrade_attempt: UpgradeAttempt, 
              manifest: Optional[FirmwareManifest] = None,
              device: Optional[Device] = None) -> RuleResult:
        violations: List[Violation] = []
        
        source = upgrade_attempt.source_version
        target = upgrade_attempt.target_version
        
        if not source or not target:
            return RuleResult(
                rule_name=self.name,
                passed=True,
                warnings=["无法检测版本信息，跳过版本跳级检查"],
            )
        
        if self._is_version_skip(source, target):
            violation = Violation(
                violation_type=ViolationType.VERSION_SKIP,
                risk_level=RiskLevel.MEDIUM,
                description=f"检测到版本跳级: {source} -> {target}。建议逐版本升级以避免兼容性问题",
                affected_versions=[source, target],
            )
            violations.append(violation)
        
        if upgrade_attempt.direction == UpgradeDirection.DOWNGRADE:
            if manifest and not manifest.rollback_allowed:
                violation = Violation(
                    violation_type=ViolationType.INVALID_ROLLBACK_VERSION,
                    risk_level=RiskLevel.CRITICAL,
                    description=f"固件版本 {target} 不允许回滚操作",
                    affected_versions=[target],
                )
                violations.append(violation)
        
        return RuleResult(
            rule_name=self.name,
            passed=len(violations) == 0,
            violations=violations,
        )
    
    def _is_version_skip(self, source: str, target: str) -> bool:
        source_parts = self._parse_version(source)
        target_parts = self._parse_version(target)
        
        if not source_parts or not target_parts:
            return False
        
        for i in range(min(len(source_parts), len(target_parts))):
            diff = abs(target_parts[i] - source_parts[i])
            if diff > 1:
                return True
            if diff == 1:
                break
        
        return False
    
    def _parse_version(self, version: str) -> List[int]:
        try:
            return [int(p) for p in version.split('.') if p.isdigit()]
        except (ValueError, AttributeError):
            return []


class CRCRule(BaseRule):
    def __init__(self):
        super().__init__("CRCRule")
    
    def check(self, state_machine: UpgradeStateMachine, 
              log_entries: List[LogEntry],
              expected_crc: Optional[str] = None) -> RuleResult:
        violations: List[Violation] = []
        
        crc_fail_entries = [e for e in log_entries if e.event_type == UpgradeEventType.CRC_FAIL]
        
        for entry in crc_fail_entries:
            violation = Violation(
                violation_type=ViolationType.CRC_FAILURE,
                risk_level=RiskLevel.CRITICAL,
                description="CRC校验失败！固件完整性受损，存在刷写风险",
                log_line_number=entry.line_number,
                timestamp=entry.timestamp,
                raw_log=entry.raw_line,
            )
            violations.append(violation)
        
        if not state_machine.context.crc_verified and \
           state_machine.context.current_state not in [UpgradeState.IDLE, UpgradeState.HANDSHAKING]:
            has_crc_check = any(e.event_type == UpgradeEventType.CRC_CHECK for e in log_entries)
            if has_crc_check:
                violation = Violation(
                    violation_type=ViolationType.CRC_FAILURE,
                    risk_level=RiskLevel.HIGH,
                    description="CRC校验未通过或未执行，固件完整性未确认",
                )
                violations.append(violation)
        
        if expected_crc and state_machine.context.detected_crc:
            if state_machine.context.detected_crc.lower() != expected_crc.lower():
                violation = Violation(
                    violation_type=ViolationType.FIRMWARE_MISMATCH,
                    risk_level=RiskLevel.CRITICAL,
                    description=f"CRC不匹配！期望: {expected_crc}, 实际: {state_machine.context.detected_crc}",
                )
                violations.append(violation)
        
        return RuleResult(
            rule_name=self.name,
            passed=len(violations) == 0,
            violations=violations,
        )


class DuplicateFlashRule(BaseRule):
    def __init__(self):
        super().__init__("DuplicateFlashRule")
    
    def check(self, device: Device) -> RuleResult:
        violations: List[Violation] = []
        
        if len(device.upgrade_history) <= 1:
            return RuleResult(rule_name=self.name, passed=True)
        
        version_attempts: Dict[str, List[UpgradeAttempt]] = {}
        for attempt in device.upgrade_history:
            target = attempt.target_version
            if target:
                if target not in version_attempts:
                    version_attempts[target] = []
                version_attempts[target].append(attempt)
        
        for version, attempts in version_attempts.items():
            if len(attempts) > 1:
                successful = [a for a in attempts if a.success]
                if len(successful) > 1:
                    violation = Violation(
                        violation_type=ViolationType.DUPLICATE_FLASH,
                        risk_level=RiskLevel.MEDIUM,
                        description=f"版本 {version} 被重复刷写 {len(successful)} 次成功",
                        affected_versions=[version],
                    )
                    violations.append(violation)
        
        return RuleResult(
            rule_name=self.name,
            passed=len(violations) == 0,
            violations=violations,
        )


class RollbackGapRule(BaseRule):
    def __init__(self):
        super().__init__("RollbackGapRule")
    
    def check(self, device: Device, upgrade_attempt: UpgradeAttempt) -> RuleResult:
        violations: List[Violation] = []
        
        if upgrade_attempt.direction != UpgradeDirection.ROLLBACK:
            return RuleResult(rule_name=self.name, passed=True)
        
        source = upgrade_attempt.source_version
        target = upgrade_attempt.target_version
        
        if not source or not target:
            return RuleResult(
                rule_name=self.name,
                passed=True,
                warnings=["无法检测版本信息，跳过回滚缺口检查"],
            )
        
        source_parts = self._parse_version(source)
        target_parts = self._parse_version(target)
        
        if source_parts and target_parts:
            if source_parts[0] < target_parts[0]:
                violation = Violation(
                    violation_type=ViolationType.ROLLBACK_GAP,
                    risk_level=RiskLevel.HIGH,
                    description=f"检测到回滚缺口: 尝试从 {source} 回滚到 {target}，但目标版本更高",
                    affected_versions=[source, target],
                )
                violations.append(violation)
            
            major_diff = source_parts[0] - target_parts[0]
            if major_diff > 1:
                violation = Violation(
                    violation_type=ViolationType.ROLLBACK_GAP,
                    risk_level=RiskLevel.HIGH,
                    description=f"跨大版本回滚: {source} -> {target}。建议验证兼容性",
                    affected_versions=[source, target],
                )
                violations.append(violation)
        
        if not upgrade_attempt.success:
            violation = Violation(
                violation_type=ViolationType.ROLLBACK_GAP,
                risk_level=RiskLevel.CRITICAL,
                description=f"回滚操作失败！设备可能处于不一致状态",
                affected_versions=[source, target],
            )
            violations.append(violation)
        
        return RuleResult(
            rule_name=self.name,
            passed=len(violations) == 0,
            violations=violations,
        )
    
    def _parse_version(self, version: str) -> List[int]:
        try:
            return [int(p) for p in version.split('.') if p.isdigit()]
        except (ValueError, AttributeError):
            return []


class InterruptedUpgradeRule(BaseRule):
    def __init__(self):
        super().__init__("InterruptedUpgradeRule")
    
    def check(self, state_machine: UpgradeStateMachine) -> RuleResult:
        violations: List[Violation] = []
        context = state_machine.context
        
        if context.current_state == UpgradeState.INTERRUPTED:
            last_progress = context.last_progress
            violation = Violation(
                violation_type=ViolationType.INTERRUPTED_UPGRADE,
                risk_level=RiskLevel.CRITICAL,
                description=f"升级被中断！最后进度: {last_progress}%。设备可能需要恢复操作",
                retry_count=context.retry_count,
            )
            violations.append(violation)
        
        error_entries = [e for e in context.log_entries if e.level in [LogLevel.ERROR, LogLevel.CRITICAL]]
        for entry in error_entries:
            if "power" in entry.message.lower() or "断电" in entry.message:
                violation = Violation(
                    violation_type=ViolationType.INTERRUPTED_UPGRADE,
                    risk_level=RiskLevel.CRITICAL,
                    description=f"检测到断电事件: {entry.message}",
                    log_line_number=entry.line_number,
                    timestamp=entry.timestamp,
                    raw_log=entry.raw_line,
                )
                violations.append(violation)
        
        return RuleResult(
            rule_name=self.name,
            passed=len(violations) == 0,
            violations=violations,
        )


class ExcessiveRetriesRule(BaseRule):
    def __init__(self, max_retries: int = 3):
        super().__init__("ExcessiveRetriesRule")
        self.max_retries = max_retries
    
    def check(self, state_machine: UpgradeStateMachine) -> RuleResult:
        violations: List[Violation] = []
        context = state_machine.context
        
        if context.retry_count > self.max_retries:
            violation = Violation(
                violation_type=ViolationType.EXCESSIVE_RETRIES,
                risk_level=RiskLevel.MEDIUM,
                description=f"重试次数过多: {context.retry_count} 次（超过阈值 {self.max_retries}）",
                retry_count=context.retry_count,
            )
            violations.append(violation)
        
        return RuleResult(
            rule_name=self.name,
            passed=len(violations) == 0,
            violations=violations,
        )


class RuleEngine:
    def __init__(self):
        self.rules: List[BaseRule] = [
            HandshakeTimeoutRule(),
            VersionSkipRule(),
            CRCRule(),
            DuplicateFlashRule(),
            RollbackGapRule(),
            InterruptedUpgradeRule(),
            ExcessiveRetriesRule(),
        ]
        self.results: List[RuleResult] = []
    
    def add_rule(self, rule: BaseRule):
        self.rules.append(rule)
    
    def run_all(self, 
                state_machine: UpgradeStateMachine,
                log_entries: List[LogEntry],
                device: Optional[Device] = None,
                manifest: Optional[FirmwareManifest] = None,
                expected_crc: Optional[str] = None) -> List[RuleResult]:
        self.results = []
        upgrade_attempt = state_machine.get_upgrade_attempt("temp", "temp")
        
        for rule in self.rules:
            if isinstance(rule, HandshakeTimeoutRule):
                result = rule.check(state_machine, log_entries)
            elif isinstance(rule, VersionSkipRule):
                result = rule.check(upgrade_attempt, manifest, device)
            elif isinstance(rule, CRCRule):
                result = rule.check(state_machine, log_entries, expected_crc)
            elif isinstance(rule, DuplicateFlashRule):
                if device:
                    result = rule.check(device)
                else:
                    result = RuleResult(rule_name=rule.name, passed=True, 
                                       warnings=["无设备信息，跳过重复刷写检查"])
            elif isinstance(rule, RollbackGapRule):
                if device:
                    result = rule.check(device, upgrade_attempt)
                else:
                    result = RuleResult(rule_name=rule.name, passed=True,
                                       warnings=["无设备信息，跳过回滚缺口检查"])
            elif isinstance(rule, InterruptedUpgradeRule):
                result = rule.check(state_machine)
            elif isinstance(rule, ExcessiveRetriesRule):
                result = rule.check(state_machine)
            else:
                result = RuleResult(rule_name=rule.name, passed=True)
            
            self.results.append(result)
        
        return self.results
    
    def get_all_violations(self) -> List[Violation]:
        violations = []
        for result in self.results:
            violations.extend(result.violations)
        return violations
    
    def get_violations_by_risk(self, risk_level: RiskLevel) -> List[Violation]:
        return [v for v in self.get_all_violations() if v.risk_level == risk_level]
    
    def get_critical_violations(self) -> List[Violation]:
        return self.get_violations_by_risk(RiskLevel.CRITICAL)
    
    def has_critical_violations(self) -> bool:
        return len(self.get_critical_violations()) > 0
    
    def get_summary(self) -> Dict[str, Any]:
        all_violations = self.get_all_violations()
        critical = len(self.get_violations_by_risk(RiskLevel.CRITICAL))
        high = len(self.get_violations_by_risk(RiskLevel.HIGH))
        medium = len(self.get_violations_by_risk(RiskLevel.MEDIUM))
        low = len(self.get_violations_by_risk(RiskLevel.LOW))
        
        passed_rules = sum(1 for r in self.results if r.passed)
        failed_rules = len(self.results) - passed_rules
        
        return {
            "total_violations": len(all_violations),
            "by_risk": {
                "critical": critical,
                "high": high,
                "medium": medium,
                "low": low,
            },
            "rules_summary": {
                "total": len(self.results),
                "passed": passed_rules,
                "failed": failed_rules,
            },
            "has_critical_issues": critical > 0,
            "overall_status": "PASSED" if critical == 0 and high == 0 else "NEEDS_ATTENTION",
        }
