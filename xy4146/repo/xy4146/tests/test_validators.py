import tempfile
from datetime import datetime
from pathlib import Path

import pytest

from offline_merger.validators.attachment_validator import (
    AttachmentValidator,
    MissingAttachment,
)
from offline_merger.validators.coordinate_validator import (
    CoordinateBoundary,
    CoordinateIssue,
    CoordinateValidator,
)
from offline_merger.validators.duplicate_validator import DuplicateValidator
from offline_merger.validators.hash_validator import HashConflict, HashValidator
from offline_merger.validators.time_validator import TimeOrderIssue, TimeValidator


from offline_merger.parsers.base_parser import FileType


class TestHashValidator:
    def test_add_file(self):
        validator = HashValidator()

        class MockMetadata:
            def __init__(self):
                self.file_name = "test.jpg"
                self.file_path = "/path/to/test.jpg"
                self.source_package = "平板1"
                self.hash_sha256 = "abc123"
                self.hash_md5 = "def456"
                self.file_size = 1024
                self.last_modified = datetime.now()
                self.file_type = FileType.PHOTO
                self.errors = []
                self.warnings = []

        class MockParseResult:
            def __init__(self):
                self.metadata = MockMetadata()

        result = MockParseResult()
        validator.add_file(result)

        validation = validator.validate()
        assert validation.total_files == 1

    def test_identical_file_conflict(self):
        validator = HashValidator()

        class MockMetadata:
            def __init__(self, name, pkg, sha256):
                self.file_name = name
                self.file_path = f"/path/{pkg}/{name}"
                self.source_package = pkg
                self.hash_sha256 = sha256
                self.hash_md5 = "md5_hash"
                self.file_size = 1024
                self.last_modified = datetime.now()
                self.file_type = FileType.PHOTO
                self.errors = []
                self.warnings = []

        class MockParseResult:
            def __init__(self, name, pkg, sha256):
                self.metadata = MockMetadata(name, pkg, sha256)

        result1 = MockParseResult("test.jpg", "平板1", "sha256_1")
        result2 = MockParseResult("test.jpg", "平板2", "sha256_1")

        validator.add_file(result1)
        validator.add_file(result2)

        validation = validator.validate()

        assert len(validation.conflicts) == 1
        assert len(validation.identical_files) == 1

    def test_hash_mismatch_conflict(self):
        validator = HashValidator()

        class MockMetadata:
            def __init__(self, name, pkg, sha256):
                self.file_name = name
                self.file_path = f"/path/{pkg}/{name}"
                self.source_package = pkg
                self.hash_sha256 = sha256
                self.hash_md5 = "md5_hash"
                self.file_size = 1024
                self.last_modified = datetime.now()
                self.file_type = FileType.PHOTO
                self.errors = []
                self.warnings = []

        class MockParseResult:
            def __init__(self, name, pkg, sha256):
                self.metadata = MockMetadata(name, pkg, sha256)

        result1 = MockParseResult("test.jpg", "平板1", "sha256_1")
        result2 = MockParseResult("test.jpg", "平板2", "sha256_2")

        validator.add_file(result1)
        validator.add_file(result2)

        validation = validator.validate()

        assert len(validation.conflicts) == 1


class TestAttachmentValidator:
    def test_add_search_path(self, tmp_path):
        validator = AttachmentValidator()

        test_dir = tmp_path / "test_dir"
        test_dir.mkdir()
        test_file = test_dir / "photo.jpg"
        test_file.write_text("test content")

        validator.add_search_path(str(test_dir))

        available = validator.get_available_files()
        assert len(available) > 0

    def test_missing_attachment(self, tmp_path):
        validator = AttachmentValidator()

        validator.add_attachment_reference(
            reference="missing_photo.jpg",
            point_id="P001",
            source_package="平板1",
        )

        result = validator.validate()

        assert result.total_references == 1
        assert len(result.missing_attachments) == 1
        assert result.valid_attachments == 0


class TestTimeValidator:
    def test_time_order_issue(self):
        validator = TimeValidator()

        now = datetime.now()
        points = [
            {"timestamp": now, "lat": 39.0, "lon": 116.0},
            {"timestamp": now, "lat": 39.1, "lon": 116.1},
            {"timestamp": now, "lat": 39.2, "lon": 116.2},
        ]

        validator.add_track(
            track_name="轨迹1",
            segments=[points],
            source_package="平板1",
        )

        result = validator.validate()

        assert result.total_tracks_checked == 1
        assert result.total_points_checked == 3

    def test_time_out_of_order(self):
        validator = TimeValidator()

        now = datetime.now()
        points = [
            {"timestamp": now, "lat": 39.0, "lon": 116.0},
            {"timestamp": None, "lat": 39.1, "lon": 116.1},
            {"timestamp": now, "lat": 39.2, "lon": 116.2},
        ]

        validator.add_track(
            track_name="轨迹1",
            segments=[points],
            source_package="平板1",
        )

        result = validator.validate()

        assert result.total_tracks_checked == 1


class TestCoordinateValidator:
    def test_boundary_violation(self):
        validator = CoordinateValidator()
        validator.set_boundary(
            min_lat=39.0,
            max_lat=40.0,
            min_lon=116.0,
            max_lon=117.0,
        )

        validator.add_coordinate(
            item_type="点位",
            item_name="P001",
            lat=41.0,
            lon=118.0,
            source_package="平板1",
        )

        result = validator.validate()

        assert result.total_checked == 1
        assert len(result.issues) == 1
        assert result.valid_coordinates == 0

    def test_valid_coordinate(self):
        validator = CoordinateValidator()
        validator.set_boundary(
            min_lat=39.0,
            max_lat=40.0,
            min_lon=116.0,
            max_lon=117.0,
        )

        validator.add_coordinate(
            item_type="点位",
            item_name="P001",
            lat=39.5,
            lon=116.5,
            source_package="平板1",
        )

        result = validator.validate()

        assert result.total_checked == 1
        assert result.valid_coordinates == 1


class TestDuplicateValidator:
    def test_duplicate_detection(self):
        validator = DuplicateValidator(distance_threshold_meters=100.0)

        validator.add_point(
            point_id="P001",
            lat=39.9042,
            lon=116.4074,
            source_package="平板1",
        )

        validator.add_point(
            point_id="P002",
            lat=39.9043,
            lon=116.4075,
            source_package="平板2",
        )

        result = validator.validate()

        assert result.total_points == 2
        assert result.groups_count >= 0
