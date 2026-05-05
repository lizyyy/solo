import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from config_diagnostic.analyzers.priority import (
    PriorityAnalyzer,
    PriorityResult,
    OverrideInfo,
    SOURCE_PRIORITY,
    PriorityLevel,
)
from config_diagnostic.analyzers.migration import (
    MigrationAnalyzer,
    MigrationResult,
    MigrationRisk,
)
from config_diagnostic.analyzers.defaults import (
    DefaultsAnalyzer,
    DefaultsResult,
    DefaultStatus,
)
from config_diagnostic.parsers.base import (
    ConfigType,
    ConfigSource,
    ParsedConfig,
    ConfigValue,
)


class TestPriorityAnalyzer:
    """Tests for priority analyzer."""

    def setup_method(self):
        self.analyzer = PriorityAnalyzer()
    
    def _create_config_value(self, key: str, value, source: ConfigSource) -> ConfigValue:
        return ConfigValue(
            key=key,
            value=value,
            source=source,
            source_path=f"/test/{source.value}.json",
        )
    
    def _create_parsed_config(self, values: dict, source: ConfigSource) -> ParsedConfig:
        config = ParsedConfig(
            config_type=ConfigType.JSON,
            source_path=f"/test/{source.value}.json",
        )
        
        for key, value in values.items():
            config.values[key] = self._create_config_value(key, value, source)
        
        return config
    
    def test_source_priority_order(self):
        """Test that source priorities are correctly ordered."""
        assert SOURCE_PRIORITY[ConfigSource.DEFAULT] == PriorityLevel.LOWEST
        assert SOURCE_PRIORITY[ConfigSource.GLOBAL_JSON] == PriorityLevel.LOW
        assert SOURCE_PRIORITY[ConfigSource.YAML_CONFIG] == PriorityLevel.MEDIUM
        assert SOURCE_PRIORITY[ConfigSource.SQLITE_DB] == PriorityLevel.HIGH
        assert SOURCE_PRIORITY[ConfigSource.LOCAL_JSON] == PriorityLevel.HIGH
        assert SOURCE_PRIORITY[ConfigSource.ENV_FILE] == PriorityLevel.HIGHEST
    
    def test_analyze_single_config(self):
        """Test analysis with a single configuration."""
        config = self._create_parsed_config(
            {"app.name": "Test App", "server.port": 8080},
            ConfigSource.GLOBAL_JSON
        )
        
        self.analyzer.add_config(config)
        result = self.analyzer.analyze()
        
        assert result.total_configs == 1
        assert result.unique_keys == 2
        assert result.overridden_keys == 0
    
    def test_analyze_multiple_configs_with_overrides(self):
        """Test that higher priority sources override lower ones."""
        global_config = self._create_parsed_config(
            {
                "app.name": "Global App",
                "server.port": 8080,
                "debug": False,
            },
            ConfigSource.GLOBAL_JSON
        )
        
        local_config = self._create_parsed_config(
            {
                "server.port": 9090,
                "debug": True,
            },
            ConfigSource.LOCAL_JSON
        )
        
        env_config = self._create_parsed_config(
            {
                "app.name": "Env App",
                "debug": False,
            },
            ConfigSource.ENV_FILE
        )
        
        self.analyzer.add_config(global_config)
        self.analyzer.add_config(local_config)
        self.analyzer.add_config(env_config)
        
        result = self.analyzer.analyze()
        
        assert result.total_configs == 3
        assert result.unique_keys == 3
        assert result.overridden_keys == 3
        
        assert "app.name" in result.overrides
        assert result.overrides["app.name"].effective_value == "Env App"
        assert result.overrides["app.name"].effective_source == ConfigSource.ENV_FILE
        
        assert "server.port" in result.overrides
        assert result.overrides["server.port"].effective_value == 9090
        assert result.overrides["server.port"].effective_source == ConfigSource.LOCAL_JSON
        
        assert "debug" in result.overrides
        assert result.overrides["debug"].effective_value is False
        assert result.overrides["debug"].effective_source == ConfigSource.ENV_FILE
    
    def test_get_effective_config(self):
        """Test getting the effective merged configuration."""
        global_config = self._create_parsed_config(
            {"a": 1, "b": 2},
            ConfigSource.GLOBAL_JSON
        )
        
        local_config = self._create_parsed_config(
            {"b": 20, "c": 30},
            ConfigSource.LOCAL_JSON
        )
        
        self.analyzer.add_config(global_config)
        self.analyzer.add_config(local_config)
        
        effective = self.analyzer.get_effective_config()
        
        assert effective["a"] == 1
        assert effective["b"] == 20
        assert effective["c"] == 30


class TestMigrationAnalyzer:
    """Tests for migration analyzer."""

    def setup_method(self):
        self.analyzer = MigrationAnalyzer()
    
    def _create_config_value(self, key: str, value, source: ConfigSource) -> ConfigValue:
        return ConfigValue(
            key=key,
            value=value,
            source=source,
            source_path="/test/config.json",
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
    
    def test_analyze_needs_two_versions(self):
        """Test that migration analysis needs at least two versions."""
        v1 = self._create_parsed_config({"a": 1})
        self.analyzer.add_version(v1, "v1")
        
        result = self.analyzer.analyze()
        
        assert "error" in result.summary
    
    def test_analyze_added_keys(self):
        """Test detection of added keys between versions."""
        v1 = self._create_parsed_config({"a": 1, "b": 2})
        v2 = self._create_parsed_config({"a": 1, "b": 2, "c": 3})
        
        self.analyzer.add_version(v1, "v1")
        self.analyzer.add_version(v2, "v2")
        
        result = self.analyzer.analyze()
        
        assert "c" in result.added_keys
        assert len(result.added_keys) == 1
    
    def test_analyze_removed_keys(self):
        """Test detection of removed keys between versions."""
        v1 = self._create_parsed_config({"a": 1, "b": 2, "c": 3})
        v2 = self._create_parsed_config({"a": 1, "b": 2})
        
        self.analyzer.add_version(v1, "v1")
        self.analyzer.add_version(v2, "v2")
        
        result = self.analyzer.analyze()
        
        assert "c" in result.removed_keys
        assert len(result.removed_keys) == 1
    
    def test_analyze_modified_keys(self):
        """Test detection of modified keys between versions."""
        v1 = self._create_parsed_config({"a": 1, "b": "old"})
        v2 = self._create_parsed_config({"a": 1, "b": "new"})
        
        self.analyzer.add_version(v1, "v1")
        self.analyzer.add_version(v2, "v2")
        
        result = self.analyzer.analyze()
        
        assert "b" in result.modified_keys
        assert len(result.modified_keys) == 1
    
    def test_assess_risk_high_risk_key(self):
        """Test that high-risk keys are correctly identified."""
        v1 = self._create_parsed_config({"database.password": "old_pass"})
        v2 = self._create_parsed_config({"database.password": "new_pass"})
        
        self.analyzer.add_version(v1, "v1")
        self.analyzer.add_version(v2, "v2")
        
        result = self.analyzer.analyze()
        
        for change in result.changes:
            if change.key == "database.password":
                assert change.risk_level in [MigrationRisk.HIGH, MigrationRisk.CRITICAL]
                break
    
    def test_generate_migration_plan(self):
        """Test migration plan generation."""
        v1 = self._create_parsed_config({"a": 1, "b": 2})
        v2 = self._create_parsed_config({"b": 20, "c": 3})
        
        self.analyzer.add_version(v1, "v1")
        self.analyzer.add_version(v2, "v2")
        
        plan = self.analyzer.generate_migration_plan()
        
        assert "migration_steps" in plan
        assert "verification_steps" in plan
        assert "rollback_plan" in plan


class TestDefaultsAnalyzer:
    """Tests for defaults analyzer."""

    def setup_method(self):
        self.analyzer = DefaultsAnalyzer()
    
    def _create_config_value(self, key: str, value, source: ConfigSource) -> ConfigValue:
        return ConfigValue(
            key=key,
            value=value,
            source=source,
            source_path="/test/config.json",
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
    
    def test_common_defaults_known(self):
        """Test that common defaults are recognized."""
        config = self._create_parsed_config({
            "debug": False,
            "port": 8080,
            "log_level": "INFO",
        })
        
        self.analyzer.add_config(config)
        result = self.analyzer.analyze()
        
        assert result.defaults_info["debug"].status == DefaultStatus.USING_DEFAULT
        assert result.defaults_info["port"].status == DefaultStatus.USING_DEFAULT
        assert result.defaults_info["log_level"].status == DefaultStatus.USING_DEFAULT
    
    def test_explicitly_set_different_from_default(self):
        """Test values different from defaults are marked as explicitly set."""
        config = self._create_parsed_config({
            "debug": True,
            "port": 9000,
            "log_level": "DEBUG",
        })
        
        self.analyzer.add_config(config)
        result = self.analyzer.analyze()
        
        assert result.defaults_info["debug"].status == DefaultStatus.EXPLICITLY_SET
        assert result.defaults_info["port"].status == DefaultStatus.EXPLICITLY_SET
        assert result.defaults_info["log_level"].status == DefaultStatus.EXPLICITLY_SET
    
    def test_custom_defaults(self):
        """Test that custom defaults can be set."""
        config = self._create_parsed_config({
            "custom_key": "custom_value",
        })
        
        self.analyzer.set_custom_defaults({
            "custom_key": "custom_value",
            "another_key": "default_value",
        })
        
        self.analyzer.add_config(config)
        result = self.analyzer.analyze()
        
        assert result.defaults_info["custom_key"].status == DefaultStatus.USING_DEFAULT
    
    def test_missing_no_default(self):
        """Test that keys without known defaults are correctly identified."""
        config = self._create_parsed_config({
            "unknown_key_xyz123": "some_value",
        })
        
        self.analyzer.add_config(config)
        result = self.analyzer.analyze()
        
        assert "unknown_key_xyz123" in result.missing_keys
        assert result.defaults_info["unknown_key_xyz123"].status == DefaultStatus.MISSING_NO_DEFAULT
    
    def test_suggest_defaults(self):
        """Test default suggestions for keys."""
        suggestions = self.analyzer.suggest_defaults("server.port")
        
        assert len(suggestions) > 0
        
        for suggestion in suggestions:
            if suggestion["key"] == "port":
                assert suggestion["suggested_value"] == 8080
                break
    
    def test_get_using_default_keys(self):
        """Test getting list of keys using default values."""
        config = self._create_parsed_config({
            "debug": False,
            "port": 8080,
            "log_level": "DEBUG",
        })
        
        self.analyzer.add_config(config)
        
        using_default = self.analyzer.get_using_default_keys()
        
        assert "debug" in using_default
        assert "port" in using_default
        assert "log_level" not in using_default
