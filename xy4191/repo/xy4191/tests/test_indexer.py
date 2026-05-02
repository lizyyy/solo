import hashlib
from pathlib import Path

import pytest

from release_validator.indexer import FileIndexer, ARTIFACT_TYPES


class TestFileEntry:
    def test_calculate_sha256(self, test_file):
        expected_hash = hashlib.sha256(b"Hello, World!").hexdigest()
        
        actual_hash = FileIndexer._calculate_sha256(test_file)
        
        assert actual_hash == expected_hash
    
    def test_detect_file_type(self):
        test_cases = [
            ("myproject-1.2.3.tar.gz", "tar"),
            ("myproject-1.2.3.zip", "zip"),
            ("checksums.txt", "checksum"),
            ("sbom.json", "sbom"),
            ("licenses.txt", "license"),
            ("CHANGELOG.md", "changelog"),
            ("ci.log", "ci_log"),
            ("artifact.sig", "signature"),
            ("unknown.xyz", "other"),
        ]
        
        for filename, expected_type in test_cases:
            actual_type = FileIndexer._detect_file_type(filename)
            assert actual_type == expected_type, f"Failed for {filename}"
    
    def test_extract_version(self):
        test_cases = [
            ("myproject-1.2.3.tar.gz", "1.2.3"),
            ("app-v2.0.0-beta.zip", "2.0.0-beta"),
            ("release-v0.1.0.tar", "0.1.0"),
            ("noversionhere.txt", None),
        ]
        
        for filename, expected_version in test_cases:
            actual_version = FileIndexer._extract_version(filename)
            assert actual_version == expected_version, f"Failed for {filename}"


class TestFileIndexer:
    def test_init(self, temp_dir):
        indexer = FileIndexer(temp_dir)
        
        assert indexer.base_path == temp_dir
        assert indexer.entries == {}
    
    def test_scan_empty_dir(self, temp_dir):
        indexer = FileIndexer(temp_dir)
        entries = indexer.scan()
        
        assert entries == {}
        assert indexer.get_index_summary()["total_files"] == 0
    
    def test_scan_with_files(self, temp_dir):
        file1 = temp_dir / "test-1.0.0.tar.gz"
        file1.write_text("test content 1")
        
        file2 = temp_dir / "README.md"
        file2.write_text("readme content")
        
        indexer = FileIndexer(temp_dir)
        entries = indexer.scan()
        
        assert len(entries) == 2
        
        summary = indexer.get_index_summary()
        assert summary["total_files"] == 2
        assert "1.0.0" in summary["versions_detected"]
    
    def test_get_by_type(self, temp_dir):
        tar_file = temp_dir / "app-1.0.0.tar.gz"
        tar_file.write_text("tar content")
        
        zip_file = temp_dir / "app-1.0.0.zip"
        zip_file.write_text("zip content")
        
        indexer = FileIndexer(temp_dir)
        indexer.scan()
        
        tar_entries = indexer.get_by_type("tar")
        zip_entries = indexer.get_by_type("zip")
        
        assert len(tar_entries) == 1
        assert len(zip_entries) == 1
    
    def test_get_all_artifacts(self, temp_dir):
        tar_file = temp_dir / "app-1.0.0.tar.gz"
        tar_file.write_text("tar content")
        
        zip_file = temp_dir / "app-1.0.0.zip"
        zip_file.write_text("zip content")
        
        readme = temp_dir / "README.md"
        readme.write_text("readme")
        
        indexer = FileIndexer(temp_dir)
        indexer.scan()
        
        artifacts = indexer.get_all_artifacts()
        
        assert len(artifacts) == 2
