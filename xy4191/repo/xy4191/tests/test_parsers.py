from pathlib import Path

import pytest

from release_validator.parsers import (
    ChecksumParser,
    SBOMParser,
    LicenseParser,
    ChangelogParser,
    CILogParser,
)


class TestChecksumParser:
    def test_parse_sha256(self, temp_dir):
        checksum_file = temp_dir / "checksums.txt"
        checksum_content = """# This is a comment
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  empty.txt
5d41402abc4b2a76b9719d911017c592  *hello.txt
"""
        checksum_file.write_text(checksum_content)
        
        parser = ChecksumParser()
        entries = parser.parse(checksum_file)
        
        assert len(entries) == 2
        assert entries[0].filename == "empty.txt"
        assert entries[0].algorithm == "sha256"
        assert entries[1].filename == "hello.txt"
    
    def test_get_for_file(self, temp_dir):
        checksum_file = temp_dir / "checksums.txt"
        checksum_content = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  test.txt"
        checksum_file.write_text(checksum_content)
        
        parser = ChecksumParser()
        parser.parse(checksum_file)
        
        entry = parser.get_for_file("test.txt")
        assert entry is not None
        assert entry.hash_value == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"


class TestSBOMParser:
    def test_parse_cyclonedx(self, temp_dir):
        sbom_file = temp_dir / "sbom.json"
        sbom_content = """{
            "bomFormat": "CycloneDX",
            "specVersion": "1.4",
            "components": [
                {
                    "name": "requests",
                    "version": "2.31.0",
                    "licenses": [{"license": {"id": "Apache-2.0"}}]
                }
            ]
        }"""
        sbom_file.write_text(sbom_content)
        
        parser = SBOMParser()
        components = parser.parse(sbom_file)
        
        assert len(components) == 1
        assert components[0].name == "requests"
        assert components[0].version == "2.31.0"
        assert "Apache-2.0" in components[0].licenses
    
    def test_parse_spdx(self, temp_dir):
        sbom_file = temp_dir / "spdx.json"
        sbom_content = """{
            "spdxVersion": "SPDX-2.3",
            "packages": [
                {
                    "name": "urllib3",
                    "versionInfo": "2.0.7",
                    "licenseConcluded": "MIT"
                }
            ]
        }"""
        sbom_file.write_text(sbom_content)
        
        parser = SBOMParser()
        components = parser.parse(sbom_file)
        
        assert len(components) == 1
        assert components[0].name == "urllib3"
        assert components[0].version == "2.0.7"
        assert "MIT" in components[0].licenses
    
    def test_get_licenses_summary(self, temp_dir):
        sbom_file = temp_dir / "sbom.json"
        sbom_content = """{
            "bomFormat": "CycloneDX",
            "specVersion": "1.4",
            "components": [
                {"name": "a", "licenses": [{"license": {"id": "MIT"}}]},
                {"name": "b", "licenses": [{"license": {"id": "MIT"}}]},
                {"name": "c", "licenses": [{"license": {"id": "Apache-2.0"}}]}
            ]
        }"""
        sbom_file.write_text(sbom_content)
        
        parser = SBOMParser()
        parser.parse(sbom_file)
        
        summary = parser.get_licenses_summary()
        assert summary["MIT"] == 2
        assert summary["Apache-2.0"] == 1


class TestChangelogParser:
    def test_parse_markdown(self, temp_dir):
        changelog_file = temp_dir / "CHANGELOG.md"
        changelog_content = """# Changelog

## [1.2.3] - 2024-01-15

### Added
- New feature 1
- New feature 2

## [1.2.2] - 2023-12-20

### Fixed
- Bug fix
"""
        changelog_file.write_text(changelog_content)
        
        parser = ChangelogParser()
        entries = parser.parse(changelog_file)
        
        assert len(entries) == 2
        assert entries[0].version == "1.2.3"
        assert entries[1].version == "1.2.2"
        assert parser.latest_version == "1.2.3"
    
    def test_has_version(self, temp_dir):
        changelog_file = temp_dir / "CHANGELOG.md"
        changelog_file.write_text("# Changelog\n\n## [1.2.3] - 2024-01-15\n")
        
        parser = ChangelogParser()
        parser.parse(changelog_file)
        
        assert parser.has_version("1.2.3") is True
        assert parser.has_version("9.9.9") is False


class TestCILogParser:
    def test_parse_errors(self, temp_dir):
        log_file = temp_dir / "ci.log"
        log_content = """2024-01-15T10:00:00Z INFO Starting
2024-01-15T10:05:00Z ERROR Build failed
2024-01-15T10:06:00Z WARNING Warning message
2024-01-15T10:07:00Z INFO Done
"""
        log_file.write_text(log_content)
        
        parser = CILogParser()
        parser.parse(log_file)
        
        assert len(parser.errors) == 1
        assert len(parser.warnings) == 1
        assert parser.has_errors() is True
    
    def test_no_errors(self, temp_dir):
        log_file = temp_dir / "ci.log"
        log_file.write_text("2024-01-15T10:00:00Z INFO All good\nINFO Success\n")
        
        parser = CILogParser()
        parser.parse(log_file)
        
        assert len(parser.errors) == 0
        assert parser.has_errors() is False
