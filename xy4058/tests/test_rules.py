from datetime import datetime, timedelta
from pathlib import Path
import tempfile
import shutil
import pytest

from aerial_archive_validator.config import (
    ProjectConfig,
    MaterialType,
    ValidationRule,
    MaterialMetadata,
)
from aerial_archive_validator.rules import (
    ValidationEngine,
    DuplicateArchiveRule,
    DeliveryMissingRule,
    MissingMetadataRule,
)
from aerial_archive_validator.log_alignment import LogAligner


class TestValidationRules:
    @pytest.fixture
    def config(self):
        return ProjectConfig(
            project_name="Test",
            project_id="TEST",
        )

    @pytest.fixture
    def log_aligner(self, config):
        return LogAligner(config)

    @pytest.fixture
    def sample_metadata(self):
        return MaterialMetadata(
            file_path="/test/DJI_0001.JPG",
            file_name="DJI_0001.JPG",
            material_type=MaterialType.PHOTO,
            file_size_bytes=1024,
            hash_sha256="test_hash_001",
            latitude=39.9042,
            longitude=116.4074,
            capture_time=datetime(2024, 5, 1, 9, 0, 0),
            device_model="DJI Mini 3 Pro",
        )

    def test_duplicate_archive_rule(self, config, log_aligner, sample_metadata):
        rule = DuplicateArchiveRule(config)

        result1 = rule.validate(sample_metadata, log_aligner)
        assert result1.is_valid is True

        duplicate = MaterialMetadata(
            file_path="/test/DJI_0002.JPG",
            file_name="DJI_0002.JPG",
            material_type=MaterialType.PHOTO,
            file_size_bytes=1024,
            hash_sha256="test_hash_001",
        )

        result2 = rule.validate(duplicate, log_aligner)
        assert result2.is_valid is False
        assert result2.severity == "error"

    def test_duplicate_filename_rule(self, config, log_aligner, sample_metadata):
        rule = DuplicateArchiveRule(config)

        result1 = rule.validate(sample_metadata, log_aligner)
        assert result1.is_valid is True

        same_name = MaterialMetadata(
            file_path="/test/another/DJI_0001.JPG",
            file_name="DJI_0001.JPG",
            material_type=MaterialType.PHOTO,
            file_size_bytes=2048,
            hash_sha256="different_hash",
        )

        result2 = rule.validate(same_name, log_aligner)
        assert result2.is_valid is False
        assert result2.severity == "warning"

    def test_delivery_missing_rule_enabled(self, config, log_aligner, sample_metadata):
        config.enabled_rules = [ValidationRule.DELIVERY_MISSING]

        rule = DeliveryMissingRule(config)
        assert rule.is_enabled() is True

    def test_delivery_missing_rule_disabled(self, config, log_aligner, sample_metadata):
        config.enabled_rules = [ValidationRule.TIME_MISALIGNMENT]

        rule = DeliveryMissingRule(config)
        assert rule.is_enabled() is False

    def test_missing_metadata_rule_valid(self, config, log_aligner, sample_metadata):
        config.metadata_required_fields = [
            "latitude",
            "longitude",
            "capture_time",
            "device_model",
        ]

        rule = MissingMetadataRule(config)
        result = rule.validate(sample_metadata, log_aligner)

        assert result.is_valid is True

    def test_missing_metadata_rule_invalid(self, config, log_aligner):
        config.metadata_required_fields = [
            "latitude",
            "longitude",
            "capture_time",
        ]

        incomplete = MaterialMetadata(
            file_path="/test/test.jpg",
            file_name="test.jpg",
            material_type=MaterialType.PHOTO,
            file_size_bytes=1024,
            hash_sha256="test_hash",
        )

        rule = MissingMetadataRule(config)
        result = rule.validate(incomplete, log_aligner)

        assert result.is_valid is False
        assert "missing_fields" in result.details

    def test_validation_engine_creation(self, config, log_aligner):
        engine = ValidationEngine(config, log_aligner)
        assert engine is not None

    def test_duplicate_rule_reset(self, config, log_aligner, sample_metadata):
        engine = ValidationEngine(config, log_aligner)

        result1 = engine.validate_material(sample_metadata)

        engine.reset_duplicate_checker()

        result2 = engine.validate_material(sample_metadata)

        for r in result2:
            if r.rule_name == ValidationRule.DUPLICATE_ARCHIVE:
                assert r.is_valid is True


class TestQuarantineManager:
    def test_quarantine_directory_creation(self):
        from aerial_archive_validator.rules import QuarantineManager

        temp_dir = Path(tempfile.mkdtemp())
        try:
            quarantine_dir = temp_dir / "quarantine"

            assert not quarantine_dir.exists()

            qm = QuarantineManager(quarantine_dir)

            assert quarantine_dir.exists()
            assert quarantine_dir.is_dir()

        finally:
            shutil.rmtree(temp_dir)

    def test_list_quarantined_empty(self):
        from aerial_archive_validator.rules import QuarantineManager

        temp_dir = Path(tempfile.mkdtemp())
        try:
            quarantine_dir = temp_dir / "quarantine"
            qm = QuarantineManager(quarantine_dir)

            quarantined = qm.list_quarantined()
            assert quarantined == []

        finally:
            shutil.rmtree(temp_dir)
