import pytest
import tempfile
import os
from datetime import datetime

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.rules import (
    RuleEngine, RiskLevel, ViolationType, Violation,
    HandshakeTimeoutRule, VersionSkipRule, CRCRule,
    InterruptedUpgradeRule, ExcessiveRetriesRule
)
from src.state_machine import UpgradeStateMachine, UpgradeState, UpgradeEvent
from src.log_parser import LogParser, LogEntry, UpgradeEventType
from src.models import Device


class TestRules:
    def setup_method(self):
        self.rule_engine = RuleEngine()
        self.log_parser = LogParser()
        self.sm = UpgradeStateMachine()
    
    def test_rule_engine_initialization(self):
        assert len(self.rule_engine.rules) > 0
    
    def test_crc_rule_detects_failure(self):
        content = """2024-01-15 09:30:00.123 [INFO] 握手
2024-01-15 09:30:00.456 [INFO] VER: 1.2.0
2024-01-15 09:30:01.000 [INFO] 传输完成
2024-01-15 09:30:21.000 [ERROR] CRC校验失败
"""
        entries = self.log_parser.parse_string(content)
        self.sm.process_log_entries(entries)
        
        results = self.rule_engine.run_all(self.sm, entries)
        
        all_violations = self.rule_engine.get_all_violations()
        crc_violations = [v for v in all_violations if v.violation_type == ViolationType.CRC_FAILURE]
        
        assert len(crc_violations) > 0
        assert crc_violations[0].risk_level == RiskLevel.CRITICAL
    
    def test_version_skip_rule_detects_jump(self):
        from src.models import UpgradeAttempt, UpgradeDirection
        
        attempt = UpgradeAttempt(
            attempt_id="test",
            device_id="DEV001",
            source_version="1.0.0",
            target_version="3.0.0",
        )
        
        rule = VersionSkipRule()
        result = rule.check(attempt)
        
        assert not result.passed
        assert len(result.violations) > 0
        assert result.violations[0].violation_type == ViolationType.VERSION_SKIP
    
    def test_version_skip_rule_no_jump(self):
        from src.models import UpgradeAttempt, UpgradeDirection
        
        attempt = UpgradeAttempt(
            attempt_id="test",
            device_id="DEV001",
            source_version="1.0.0",
            target_version="2.0.0",
        )
        
        rule = VersionSkipRule()
        result = rule.check(attempt)
        
        assert result.passed
    
    def test_interrupted_upgrade_rule(self):
        content = """2024-01-15 09:30:00.123 [INFO] 握手
2024-01-15 09:30:00.456 [INFO] VER: 1.2.0
2024-01-15 09:30:05.000 [INFO] 传输进度: 50%
"""
        entries = self.log_parser.parse_string(content)
        self.sm.process_log_entries(entries)
        
        results = self.rule_engine.run_all(self.sm, entries)
        
        all_violations = self.rule_engine.get_all_violations()
        interrupted_violations = [v for v in all_violations 
                                    if v.violation_type == ViolationType.INTERRUPTED_UPGRADE]
        
        assert len(interrupted_violations) > 0
        assert interrupted_violations[0].risk_level == RiskLevel.CRITICAL
    
    def test_excessive_retries_rule(self):
        self.sm.transition(UpgradeEvent.HANDSHAKE_START)
        self.sm.transition(UpgradeEvent.TIMEOUT)
        self.sm.transition(UpgradeEvent.RETRY)
        self.sm.transition(UpgradeEvent.TIMEOUT)
        self.sm.transition(UpgradeEvent.RETRY)
        self.sm.transition(UpgradeEvent.TIMEOUT)
        self.sm.transition(UpgradeEvent.RETRY)
        self.sm.transition(UpgradeEvent.TIMEOUT)
        
        self.sm.context.retry_count = 5
        
        rule = ExcessiveRetriesRule(max_retries=3)
        result = rule.check(self.sm)
        
        assert not result.passed
        assert len(result.violations) > 0
    
    def test_rule_engine_summary(self):
        content = """2024-01-15 09:30:00.123 [INFO] 握手
2024-01-15 09:30:00.456 [INFO] VER: 1.2.0
2024-01-15 09:30:01.000 [INFO] 传输完成
2024-01-15 09:30:21.000 [ERROR] CRC校验失败
"""
        entries = self.log_parser.parse_string(content)
        self.sm.process_log_entries(entries)
        self.rule_engine.run_all(self.sm, entries)
        
        summary = self.rule_engine.get_summary()
        
        assert "total_violations" in summary
        assert "by_risk" in summary
        assert "rules_summary" in summary
    
    def test_has_critical_violations(self):
        content = """2024-01-15 09:30:00.123 [INFO] 握手
2024-01-15 09:30:00.456 [INFO] VER: 1.2.0
2024-01-15 09:30:01.000 [INFO] 传输完成
2024-01-15 09:30:21.000 [ERROR] CRC校验失败
"""
        entries = self.log_parser.parse_string(content)
        self.sm.process_log_entries(entries)
        self.rule_engine.run_all(self.sm, entries)
        
        assert self.rule_engine.has_critical_violations()
    
    def test_no_violations_clean_upgrade(self):
        content = """2024-01-15 09:30:00.123 [INFO] 握手
2024-01-15 09:30:00.456 [INFO] VER: 1.2.0
2024-01-15 09:30:01.000 [INFO] 开始传输
2024-01-15 09:30:01.500 [INFO] 传输完成
2024-01-15 09:30:21.000 [INFO] CRC: A1B2C3D4 - 校验通过
2024-01-15 09:30:21.500 [INFO] 开始烧录
2024-01-15 09:30:40.500 [INFO] 烧录完成，设备重启
2024-01-15 09:30:45.000 [INFO] 升级成功
"""
        entries = self.log_parser.parse_string(content)
        self.sm.process_log_entries(entries)
        self.rule_engine.run_all(self.sm, entries)
        
        all_violations = self.rule_engine.get_all_violations()
        critical = self.rule_engine.get_critical_violations()
        
        assert len(critical) == 0
        assert not self.rule_engine.has_critical_violations()
    
    def test_violation_to_dict(self):
        violation = Violation(
            violation_type=ViolationType.CRC_FAILURE,
            risk_level=RiskLevel.CRITICAL,
            description="CRC校验失败",
            log_line_number=10,
        )
        
        result = violation.to_dict()
        
        assert result["violation_type"] == "CRC_FAILURE"
        assert result["risk_level"] == "CRITICAL"
        assert result["description"] == "CRC校验失败"
        assert result["log_line_number"] == 10
