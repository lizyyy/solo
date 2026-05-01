from datetime import datetime
from pathlib import Path
import tempfile
import shutil
import pytest

from aerial_archive_validator.config import (
    ProjectConfig,
    MaterialType,
    ValidationRule,
    NoFlyZone,
    MaterialMetadata,
)
from aerial_archive_validator.exceptions import ConfigurationError


class TestProjectConfig:
    def test_default_config(self):
        config = ProjectConfig(
            project_name="Test Project",
            project_id="TEST-001",
        )

        assert config.project_name == "Test Project"
        assert config.project_id == "TEST-001"
        assert config.version == "1.0.0"
        assert isinstance(config.created_at, datetime)

    def test_directory_structure(self):
        config = ProjectConfig(
            project_name="Test",
            project_id="TEST",
        )

        expected_dirs = [
            "photos", "videos", "logs", "plans",
            "delivery_lists", "output", "quarantine", "reports", "metadata"
        ]

        for dir_name in expected_dirs:
            assert dir_name in config.directories

    def test_material_extensions(self):
        config = ProjectConfig(
            project_name="Test",
            project_id="TEST",
        )

        photo_exts = config.get_extensions_for_type(MaterialType.PHOTO)
        assert ".jpg" in photo_exts
        assert ".jpeg" in photo_exts
        assert ".png" in photo_exts

        video_exts = config.get_extensions_for_type(MaterialType.VIDEO)
        assert ".mp4" in video_exts
        assert ".mov" in video_exts

    def test_validation_rules(self):
        config = ProjectConfig(
            project_name="Test",
            project_id="TEST",
        )

        assert config.is_rule_enabled(ValidationRule.DELIVERY_MISSING)
        assert config.is_rule_enabled(ValidationRule.TIME_MISALIGNMENT)
        assert config.is_rule_enabled(ValidationRule.COORDINATE_DEVIATION)
        assert config.is_rule_enabled(ValidationRule.DUPLICATE_ARCHIVE)
        assert config.is_rule_enabled(ValidationRule.MISSING_METADATA)
        assert config.is_rule_enabled(ValidationRule.NO_FLY_ZONE)

    def test_threshold_validation(self):
        with pytest.raises(ValueError):
            ProjectConfig(
                project_name="Test",
                project_id="TEST",
                time_sync_threshold_seconds=-1.0,
            )

        with pytest.raises(ValueError):
            ProjectConfig(
                project_name="Test",
                project_id="TEST",
                coordinate_deviation_threshold_meters=-50.0,
            )

    def test_no_fly_zone_config(self):
        nfz = NoFlyZone(
            name="Test Zone",
            center_lat=39.9042,
            center_lon=116.4074,
            radius_meters=1000.0,
        )

        assert nfz.name == "Test Zone"
        assert nfz.center_lat == 39.9042
        assert nfz.center_lon == 116.4074
        assert nfz.radius_meters == 1000.0

    def test_json_serialization(self):
        config = ProjectConfig(
            project_name="测试项目",
            project_id="TEST-001",
        )

        json_str = config.to_json()
        assert "测试项目" in json_str
        assert "TEST-001" in json_str

    def test_save_and_load(self):
        temp_dir = tempfile.mkdtemp()
        try:
            config_path = Path(temp_dir) / "config.json"

            original = ProjectConfig(
                project_name="Test Project",
                project_id="TEST-001",
                time_sync_threshold_seconds=600.0,
                coordinate_deviation_threshold_meters=100.0,
            )

            original.save_to_file(config_path)

            loaded = ProjectConfig.load_from_file(config_path)

            assert loaded.project_name == original.project_name
            assert loaded.project_id == original.project_id
            assert loaded.time_sync_threshold_seconds == original.time_sync_threshold_seconds
            assert loaded.coordinate_deviation_threshold_meters == original.coordinate_deviation_threshold_meters

        finally:
            shutil.rmtree(temp_dir)

    def test_load_invalid_config(self):
        temp_dir = tempfile.mkdtemp()
        try:
            invalid_path = Path(temp_dir) / "invalid.json"

            with open(invalid_path, "w") as f:
                f.write("this is not valid json")

            with pytest.raises(ConfigurationError):
                ProjectConfig.load_from_file(invalid_path)

        finally:
            shutil.rmtree(temp_dir)

    def test_load_missing_config(self):
        with pytest.raises(ConfigurationError):
            ProjectConfig.load_from_file(Path("/nonexistent/path/config.json"))


class TestMaterialMetadata:
    def test_valid_geolocation(self):
        metadata = MaterialMetadata(
            file_path="/test/photo.jpg",
            file_name="photo.jpg",
            material_type=MaterialType.PHOTO,
            file_size_bytes=1024,
            hash_sha256="test_hash",
            latitude=39.9042,
            longitude=116.4074,
        )

        assert metadata.is_valid_geolocation() is True
        assert metadata.get_coordinates() == (39.9042, 116.4074)

    def test_invalid_geolocation(self):
        metadata = MaterialMetadata(
            file_path="/test/photo.jpg",
            file_name="photo.jpg",
            material_type=MaterialType.PHOTO,
            file_size_bytes=1024,
            hash_sha256="test_hash",
        )

        assert metadata.is_valid_geolocation() is False
        assert metadata.get_coordinates() is None

    def test_latitude_validation(self):
        with pytest.raises(ValueError):
            MaterialMetadata(
                file_path="/test/photo.jpg",
                file_name="photo.jpg",
                material_type=MaterialType.PHOTO,
                file_size_bytes=1024,
                hash_sha256="test_hash",
                latitude=95.0,
            )

        with pytest.raises(ValueError):
            MaterialMetadata(
                file_path="/test/photo.jpg",
                file_name="photo.jpg",
                material_type=MaterialType.PHOTO,
                file_size_bytes=1024,
                hash_sha256="test_hash",
                latitude=-95.0,
            )

    def test_longitude_validation(self):
        with pytest.raises(ValueError):
            MaterialMetadata(
                file_path="/test/photo.jpg",
                file_name="photo.jpg",
                material_type=MaterialType.PHOTO,
                file_size_bytes=1024,
                hash_sha256="test_hash",
                longitude=185.0,
            )

        with pytest.raises(ValueError):
            MaterialMetadata(
                file_path="/test/photo.jpg",
                file_name="photo.jpg",
                material_type=MaterialType.PHOTO,
                file_size_bytes=1024,
                hash_sha256="test_hash",
                longitude=-185.0,
            )
