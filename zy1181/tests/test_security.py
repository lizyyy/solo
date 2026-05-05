import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from config_diagnostic.security.analyzer import (
    SecurityAnalyzer,
    SecurityResult,
    SecurityFinding,
    FindingSeverity,
    FindingType,
)
from config_diagnostic.parsers.base import (
    ConfigType,
    ConfigSource,
    ParsedConfig,
    ConfigValue,
)


class TestSecurityAnalyzer:
    """Tests for security analyzer."""

    def setup_method(self):
        self.analyzer = SecurityAnalyzer()
    
    def _create_config_value(self, key: str, value, source: ConfigSource, line: int = None) -> ConfigValue:
        return ConfigValue(
            key=key,
            value=value,
            source=source,
            source_path="/test/config.json",
            line_number=line,
        )
    
    def _create_parsed_config(self, values: dict) -> ParsedConfig:
        config = ParsedConfig(
            config_type=ConfigType.JSON,
            source_path="/test/config.json",
        )
        
        for key, value in values.items():
            config.values[key] = self._create_config_value(
                key, value, ConfigSource.GLOBAL_JSON
            )
        
        return config
    
    def test_check_sensitive_plaintext(self):
        """Test detection of plaintext sensitive fields."""
        config = self._create_parsed_config({
            "database.password": "my_secret_password",
            "api_key": "sk-1234567890abcdef",
            "normal_key": "normal_value",
        })
        
        self.analyzer.add_config(config)
        result = self.analyzer.analyze()
        
        sensitive_findings = [
            f for f in result.findings 
            if f.finding_type == FindingType.SENSITIVE_PLAINTEXT
        ]
        
        assert len(sensitive_findings) >= 2
    
    def test_check_invalid_enum(self):
        """Test detection of invalid enum values."""
        config = self._create_parsed_config({
            "environment": "invalid_env",
            "log_level": "VERBOSE",
            "mode": "custom_mode",
        })
        
        self.analyzer.add_config(config)
        result = self.analyzer.analyze()
        
        enum_findings = [
            f for f in result.findings 
            if f.finding_type == FindingType.INVALID_ENUM
        ]
        
        assert len(enum_findings) >= 1
    
    def test_valid_enum_values(self):
        """Test that valid enum values don't trigger findings."""
        config = self._create_parsed_config({
            "environment": "production",
            "log_level": "INFO",
            "env": "development",
        })
        
        self.analyzer.add_config(config)
        result = self.analyzer.analyze()
        
        enum_findings = [
            f for f in result.findings 
            if f.finding_type == FindingType.INVALID_ENUM
        ]
        
        assert len(enum_findings) == 0
    
    def test_check_weak_password(self):
        """Test detection of weak passwords."""
        config = self._create_parsed_config({
            "admin.password": "password",
            "db_password": "123456",
            "root_pwd": "admin",
            "strong_password": "My$tr0ngP@ssw0rd!123",
        })
        
        self.analyzer.add_config(config)
        result = self.analyzer.analyze()
        
        weak_password_findings = [
            f for f in result.findings 
            if f.finding_type == FindingType.WEAK_PASSWORD
        ]
        
        assert len(weak_password_findings) >= 3
    
    def test_check_hardcoded_secret(self):
        """Test detection of hardcoded secrets."""
        config = self._create_parsed_config({
            "openai_key": "sk-abcdefghijklmnopqrstuvwxyz123456",
            "stripe_secret": "sk_live_abcdefghijklmnopqrst",
            "aws_key": "AKIAIOSFODNN7EXAMPLE",
        })
        
        self.analyzer.add_config(config)
        result = self.analyzer.analyze()
        
        hardcoded_findings = [
            f for f in result.findings 
            if f.finding_type == FindingType.HARDCODED_SECRET
        ]
        
        assert len(hardcoded_findings) >= 1
    
    def test_check_insecure_default_debug(self):
        """Test detection of insecure debug mode."""
        config = self._create_parsed_config({
            "app.debug": True,
            "debug_mode": True,
        })
        
        self.analyzer.add_config(config)
        result = self.analyzer.analyze()
        
        insecure_findings = [
            f for f in result.findings 
            if f.finding_type == FindingType.INSECURE_DEFAULT
        ]
        
        assert len(insecure_findings) >= 1
    
    def test_check_insecure_default_ssl_disabled(self):
        """Test detection of disabled SSL/TLS."""
        config = self._create_parsed_config({
            "ssl.enabled": False,
            "tls_mode": "disable",
        })
        
        self.analyzer.add_config(config)
        result = self.analyzer.analyze()
        
        insecure_findings = [
            f for f in result.findings 
            if f.finding_type == FindingType.INSECURE_DEFAULT
        ]
        
        assert len(insecure_findings) >= 1
    
    def test_check_empty_secret(self):
        """Test detection of empty secret values."""
        config = self._create_parsed_config({
            "redis.password": "",
            "api_secret": "   ",
            "db_password": "",
        })
        
        self.analyzer.add_config(config)
        result = self.analyzer.analyze()
        
        empty_secret_findings = [
            f for f in result.findings 
            if f.finding_type == FindingType.EMPTY_SECRET
        ]
        
        assert len(empty_secret_findings) >= 1
    
    def test_placeholder_not_detected(self):
        """Test that placeholder values are not flagged as sensitive."""
        config = self._create_parsed_config({
            "db_password": "${DB_PASSWORD}",
            "api_key": "your_api_key_here",
            "secret": "***",
        })
        
        self.analyzer.add_config(config)
        result = self.analyzer.analyze()
        
        sensitive_findings = [
            f for f in result.findings 
            if f.finding_type == FindingType.SENSITIVE_PLAINTEXT
        ]
        
        assert len(sensitive_findings) == 0
    
    def test_severity_counts(self):
        """Test that severity counts are correctly calculated."""
        config = self._create_parsed_config({
            "password": "password",
            "debug": True,
        })
        
        self.analyzer.add_config(config)
        result = self.analyzer.analyze()
        
        assert result.total_findings > 0
        assert result.critical_count + result.high_count + result.medium_count + result.low_count == result.total_findings
    
    def test_custom_enums(self):
        """Test that custom enums can be set and validated."""
        self.analyzer.set_custom_enums({
            "custom_env": ["local", "dev", "staging", "prod"],
            "feature_flag": ["enabled", "disabled", "beta"],
        })
        
        config = self._create_parsed_config({
            "custom_env": "invalid_value",
            "feature_flag": "testing",
        })
        
        self.analyzer.add_config(config)
        result = self.analyzer.analyze()
        
        enum_findings = [
            f for f in result.findings 
            if f.finding_type == FindingType.INVALID_ENUM
        ]
        
        assert len(enum_findings) == 2
    
    def test_multiple_configs(self):
        """Test analysis with multiple configuration files."""
        config1 = self._create_parsed_config({
            "password": "weak_password",
            "debug": False,
        })
        
        config2 = self._create_parsed_config({
            "api_key": "sk-12345",
            "debug": True,
        })
        
        self.analyzer.add_config(config1)
        self.analyzer.add_config(config2)
        
        result = self.analyzer.analyze()
        
        assert result.total_findings > 0
    
    def test_finding_fields(self):
        """Test that findings have all required fields."""
        config = self._create_parsed_config({
            "db.password": "password123",
        })
        
        self.analyzer.add_config(config)
        result = self.analyzer.analyze()
        
        for finding in result.findings:
            assert finding.finding_type is not None
            assert finding.severity is not None
            assert finding.key is not None
            assert finding.description is not None
            assert finding.suggestion is not None
