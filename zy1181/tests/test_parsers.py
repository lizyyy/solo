import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from config_diagnostic.parsers.base import (
    ConfigParser,
    ConfigType,
    ConfigSource,
    ParsedConfig,
    ConfigValue,
)
from config_diagnostic.parsers.json_parser import JsonParser
from config_diagnostic.parsers.env_parser import EnvParser
from config_diagnostic.parsers.yaml_parser import YamlParser
from config_diagnostic.parsers.sqlite_parser import SqliteParser


class TestConfigParser:
    """Tests for the base ConfigParser class."""

    def test_detect_sensitive_key(self):
        """Test that sensitive keys are correctly detected."""
        sensitive_keys = [
            "password", "db_password", "api_key", "secret",
            "access_token", "refresh_token", "private_key",
            "aws_secret_access_key", "connection_string",
        ]
        
        non_sensitive_keys = [
            "username", "host", "port", "timeout", "log_level",
            "environment", "debug", "verbose",
        ]
        
        for key in sensitive_keys:
            assert ConfigParser._detect_sensitive_key(key) is True, f"Should detect: {key}"
        
        for key in non_sensitive_keys:
            assert ConfigParser._detect_sensitive_key(key) is False, f"Should not detect: {key}"
    
    def test_is_env_file(self):
        """Test .env file detection."""
        assert ConfigParser._is_env_file(Path(".env")) is True
        assert ConfigParser._is_env_file(Path(".env.local")) is True
        assert ConfigParser._is_env_file(Path("settings.json")) is False
    
    def test_is_json_file(self):
        """Test JSON file detection."""
        assert ConfigParser._is_json_file(Path("settings.json")) is True
        assert ConfigParser._is_json_file(Path("config.jsonc")) is True
        assert ConfigParser._is_json_file(Path(".env")) is False


class TestJsonParser:
    """Tests for JSON parser."""

    def setup_method(self):
        self.parser = JsonParser()
        self.temp_dir = tempfile.mkdtemp()
    
    def test_can_parse(self):
        """Test that JSON files are correctly identified."""
        assert self.parser.can_parse(Path("config.json")) is True
        assert self.parser.can_parse(Path("settings.jsonc")) is True
        assert self.parser.can_parse(Path(".env")) is False
    
    def test_parse_simple_json(self):
        """Test parsing a simple JSON file."""
        json_content = """
        {
            "app": {
                "name": "Test App",
                "version": "1.0.0"
            },
            "server": {
                "port": 8080,
                "debug": false
            }
        }
        """
        
        temp_file = Path(self.temp_dir) / "settings.json"
        temp_file.write_text(json_content)
        
        parsed = self.parser.parse(temp_file)
        
        assert parsed.config_type == ConfigType.JSON
        assert parsed.source_path == str(temp_file)
        
        assert "app.name" in parsed.values
        assert parsed.values["app.name"].value == "Test App"
        
        assert "server.port" in parsed.values
        assert parsed.values["server.port"].value == 8080
        
        assert "server.debug" in parsed.values
        assert parsed.values["server.debug"].value is False
    
    def test_parse_invalid_json(self):
        """Test parsing invalid JSON."""
        invalid_json = "{ invalid json }"
        
        temp_file = Path(self.temp_dir) / "invalid.json"
        temp_file.write_text(invalid_json)
        
        parsed = self.parser.parse(temp_file)
        
        assert len(parsed.errors) > 0


class TestEnvParser:
    """Tests for .env parser."""

    def setup_method(self):
        self.parser = EnvParser()
        self.temp_dir = tempfile.mkdtemp()
    
    def test_can_parse(self):
        """Test that .env files are correctly identified."""
        assert self.parser.can_parse(Path(".env")) is True
        assert self.parser.can_parse(Path(".env.local")) is True
        assert self.parser.can_parse(Path("config.json")) is False
    
    def test_parse_simple_env(self):
        """Test parsing a simple .env file."""
        env_content = """
# This is a comment
APP_NAME=My Application
APP_PORT=8080
APP_DEBUG=false
API_KEY=secret123
"""
        
        temp_file = Path(self.temp_dir) / ".env"
        temp_file.write_text(env_content)
        
        parsed = self.parser.parse(temp_file)
        
        assert parsed.config_type == ConfigType.ENV
        assert parsed.source_path == str(temp_file)
        
        assert "APP_NAME" in parsed.values
        assert parsed.values["APP_NAME"].value == "My Application"
        
        assert "APP_PORT" in parsed.values
        assert parsed.values["APP_PORT"].value == 8080
        
        assert "APP_DEBUG" in parsed.values
        assert parsed.values["APP_DEBUG"].value is False
        
        assert "API_KEY" in parsed.values
        assert parsed.values["API_KEY"].is_sensitive is True
    
    def test_parse_quoted_values(self):
        """Test parsing quoted values in .env file."""
        env_content = """
DOUBLE_QUOTED="double quoted value"
SINGLE_QUOTED='single quoted value'
WITH_NEWLINE="line1\\nline2"
"""
        
        temp_file = Path(self.temp_dir) / ".env"
        temp_file.write_text(env_content)
        
        parsed = self.parser.parse(temp_file)
        
        assert parsed.values["DOUBLE_QUOTED"].value == "double quoted value"
        assert parsed.values["SINGLE_QUOTED"].value == "single quoted value"
    
    def test_parse_type_conversion(self):
        """Test automatic type conversion."""
        env_content = """
INT_VALUE=123
FLOAT_VALUE=3.14
BOOL_TRUE=true
BOOL_FALSE=false
NULL_VALUE=null
"""
        
        temp_file = Path(self.temp_dir) / ".env"
        temp_file.write_text(env_content)
        
        parsed = self.parser.parse(temp_file)
        
        assert parsed.values["INT_VALUE"].value == 123
        assert isinstance(parsed.values["INT_VALUE"].value, int)
        
        assert parsed.values["FLOAT_VALUE"].value == 3.14
        assert isinstance(parsed.values["FLOAT_VALUE"].value, float)
        
        assert parsed.values["BOOL_TRUE"].value is True
        assert parsed.values["BOOL_FALSE"].value is False
        assert parsed.values["NULL_VALUE"].value is None


class TestYamlParser:
    """Tests for YAML parser."""

    def setup_method(self):
        self.parser = YamlParser()
        self.temp_dir = tempfile.mkdtemp()
    
    def test_can_parse(self):
        """Test that YAML files are correctly identified."""
        assert self.parser.can_parse(Path("config.yaml")) is True
        assert self.parser.can_parse(Path("settings.yml")) is True
        assert self.parser.can_parse(Path("config.json")) is False
    
    def test_parse_simple_yaml(self):
        """Test parsing a simple YAML file."""
        yaml_content = """
app:
  name: Test App
  version: 1.0.0
  debug: false

server:
  port: 8080
  host: localhost

database:
  host: db.example.com
  port: 5432
  ssl: true
"""
        
        temp_file = Path(self.temp_dir) / "config.yaml"
        temp_file.write_text(yaml_content)
        
        parsed = self.parser.parse(temp_file)
        
        assert parsed.config_type == ConfigType.YAML
        assert parsed.source_path == str(temp_file)
        
        assert "app.name" in parsed.values
        assert parsed.values["app.name"].value == "Test App"
        
        assert "server.port" in parsed.values
        assert parsed.values["server.port"].value == 8080
        
        assert "database.ssl" in parsed.values
        assert parsed.values["database.ssl"].value is True


class TestSqliteParser:
    """Tests for SQLite parser."""

    def setup_method(self):
        self.parser = SqliteParser()
        self.temp_dir = tempfile.mkdtemp()
    
    def test_can_parse(self):
        """Test that SQLite files are correctly identified."""
        import sqlite3
        
        db_path = Path(self.temp_dir) / "test.db"
        
        conn = sqlite3.connect(str(db_path))
        conn.execute("CREATE TABLE test (id INT)")
        conn.commit()
        conn.close()
        
        assert self.parser.can_parse(db_path) is True
        assert self.parser.can_parse(Path("config.json")) is False
    
    def test_parse_sqlite_config_table(self):
        """Test parsing SQLite with a config table."""
        import sqlite3
        
        db_path = Path(self.temp_dir) / "config.db"
        
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE config (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        
        cursor.executemany("""
            INSERT INTO config (key, value) VALUES (?, ?)
        """, [
            ("app.version", "1.0.0"),
            ("feature.enabled", "true"),
            ("cache.ttl", "300"),
        ])
        
        conn.commit()
        conn.close()
        
        parsed = self.parser.parse(db_path)
        
        assert parsed.config_type == ConfigType.SQLITE
        assert parsed.source_path == str(db_path)
        
        assert "app.version" in parsed.values
        assert parsed.values["app.version"].value == "1.0.0"
        
        assert "feature.enabled" in parsed.values
        assert parsed.values["feature.enabled"].value is True
        
        assert "cache.ttl" in parsed.values
        assert parsed.values["cache.ttl"].value == 300
