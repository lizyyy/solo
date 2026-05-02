import os
import tempfile
from pathlib import Path

import pytest

from field_sync.config import (
    ConflictStrategy,
    SyncConfig,
    find_config,
    get_default_allowed_extensions,
    get_default_ignore_patterns,
)


class TestConflictStrategy:
    def test_default_values(self):
        strategy = ConflictStrategy()
        assert strategy.on_case_conflict == "quarantine"
        assert strategy.on_content_conflict == "quarantine"
        assert strategy.on_mtime_drift == "warn"
        assert strategy.on_renamed_candidate == "ask"
    
    def test_validation_case_conflict(self):
        with pytest.raises(Exception):
            ConflictStrategy(on_case_conflict="invalid")
    
    def test_validation_content_conflict(self):
        with pytest.raises(Exception):
            ConflictStrategy(on_content_conflict="invalid")


class TestSyncConfig:
    def test_creation(self):
        config = SyncConfig(
            left_dir="/tmp/work",
            right_dir="/tmp/backup",
        )
        assert config.left_dir == "/tmp/work"
        assert config.right_dir == "/tmp/backup"
    
    def test_normalize_extensions(self):
        config = SyncConfig(
            left_dir="/tmp/work",
            right_dir="/tmp/backup",
            allowed_extensions=[".JPG", "CSV", ".TXT"],
        )
        assert "jpg" in config.allowed_extensions
        assert "csv" in config.allowed_extensions
        assert "txt" in config.allowed_extensions
    
    def test_is_extension_allowed(self):
        config = SyncConfig(
            left_dir="/tmp/work",
            right_dir="/tmp/backup",
            allowed_extensions=["jpg", "csv"],
        )
        assert config.is_extension_allowed("jpg") is True
        assert config.is_extension_allowed(".JPG") is True
        assert config.is_extension_allowed("csv") is True
        assert config.is_extension_allowed("txt") is False
    
    def test_empty_allowed_extensions(self):
        config = SyncConfig(
            left_dir="/tmp/work",
            right_dir="/tmp/backup",
            allowed_extensions=[],
        )
        assert config.is_extension_allowed("jpg") is True
        assert config.is_extension_allowed("txt") is True
        assert config.is_extension_allowed("anything") is True
    
    def test_save_and_load(self, tmp_path):
        config_path = tmp_path / "config.json"
        
        original = SyncConfig(
            left_dir="/tmp/work",
            right_dir="/tmp/backup",
            ignore_patterns=["*.tmp", "__pycache__"],
            allowed_extensions=["jpg", "csv"],
        )
        original.save(str(config_path))
        
        loaded = SyncConfig.load(str(config_path))
        assert loaded.left_dir == original.left_dir
        assert loaded.right_dir == original.right_dir
        assert loaded.ignore_patterns == original.ignore_patterns
        assert loaded.allowed_extensions == original.allowed_extensions


class TestDefaultPatterns:
    def test_default_ignore_patterns(self):
        patterns = get_default_ignore_patterns()
        assert ".*" in patterns
        assert "__pycache__" in patterns
        assert "*.tmp" in patterns
        assert ".DS_Store" in patterns
    
    def test_default_allowed_extensions(self):
        extensions = get_default_allowed_extensions()
        assert "jpg" in extensions
        assert "csv" in extensions
        assert "kml" in extensions
        assert "shp" in extensions
        assert "pdf" in extensions
        assert "zip" in extensions


class TestFindConfig:
    def test_find_config_in_current_dir(self, tmp_path):
        config_file = tmp_path / ".field-sync.json"
        config_file.write_text('{"left_dir": "/test", "right_dir": "/test2"}')
        
        os.chdir(tmp_path)
        found = find_config(".")
        
        assert found is not None
        assert found.name == ".field-sync.json"
    
    def test_find_config_not_found(self, tmp_path):
        os.chdir(tmp_path)
        found = find_config(".")
        assert found is None
    
    def test_find_config_in_parent_dir(self, tmp_path):
        config_file = tmp_path / ".field-sync.json"
        config_file.write_text('{"left_dir": "/test", "right_dir": "/test2"}')
        
        subdir = tmp_path / "subdir"
        subdir.mkdir()
        
        os.chdir(subdir)
        found = find_config(".")
        
        assert found is not None
        assert found.parent == tmp_path
