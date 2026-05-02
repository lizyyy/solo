import json
import tempfile
from datetime import datetime
from pathlib import Path

import pytest

from offline_merger.config.coordinate_config import (
    CoordinateConverter,
    CoordinatePoint,
    CoordinateSystem,
    calculate_haversine_distance,
)
from offline_merger.config.merge_rules import ConflictResolutionStrategy, MergeRules
from offline_merger.config.task_config import (
    SourcePackage,
    TaskConfig,
    create_default_task_config,
    generate_task_id,
    load_task_config,
    save_task_config,
)


class TestTaskConfig:
    def test_generate_task_id(self):
        task_id = generate_task_id()
        assert task_id.startswith("task_")
        assert len(task_id) > 5

    def test_create_default_task_config(self):
        config = create_default_task_config("测试任务")
        assert config.task_name == "测试任务"
        assert config.task_id.startswith("task_")
        assert config.target_coordinate_system == "WGS84"
        assert config.duplicate_distance_threshold_meters == 1.0

    def test_source_package_to_dict(self):
        pkg = SourcePackage(
            name="平板1",
            path="/usb/tablet1",
            device_id="TAB001",
            included=True,
        )
        data = pkg.to_dict()
        assert data["name"] == "平板1"
        assert data["path"] == "/usb/tablet1"
        assert data["device_id"] == "TAB001"
        assert data["included"] is True

    def test_source_package_from_dict(self):
        data = {
            "name": "平板2",
            "path": "/usb/tablet2",
            "device_id": "TAB002",
            "included": False,
        }
        pkg = SourcePackage.from_dict(data)
        assert pkg.name == "平板2"
        assert pkg.path == "/usb/tablet2"
        assert pkg.device_id == "TAB002"
        assert pkg.included is False

    def test_task_config_serialization(self):
        config = create_default_task_config("测试任务")
        config.sources.append(
            SourcePackage(
                name="平板1",
                path="/usb/tablet1",
            )
        )

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            temp_path = f.name

        try:
            save_task_config(config, temp_path)

            loaded = load_task_config(temp_path)

            assert loaded.task_name == config.task_name
            assert loaded.task_id == config.task_id
            assert len(loaded.sources) == 1
            assert loaded.sources[0].name == "平板1"
        finally:
            Path(temp_path).unlink()


class TestCoordinateConfig:
    def test_coordinate_point_creation(self):
        point = CoordinatePoint(lat=39.9042, lon=116.4074)
        assert point.lat == 39.9042
        assert point.lon == 116.4074
        assert point.coordinate_system == CoordinateSystem.WGS84

    def test_coordinate_point_to_tuple(self):
        point = CoordinatePoint(lat=39.9042, lon=116.4074, elevation=43.5)
        tpl = point.to_tuple()
        assert tpl == (39.9042, 116.4074, 43.5)

    def test_coordinate_system_from_string(self):
        cs = CoordinateSystem.from_string("wgs84")
        assert cs == CoordinateSystem.WGS84

        cs = CoordinateSystem.from_string("GCJ02")
        assert cs == CoordinateSystem.GCJ02

        cs = CoordinateSystem.from_string("invalid")
        assert cs == CoordinateSystem.WGS84

    def test_haversine_distance(self):
        point1 = CoordinatePoint(lat=39.9042, lon=116.4074)
        point2 = CoordinatePoint(lat=39.9052, lon=116.4084)

        distance = calculate_haversine_distance(point1, point2)

        assert distance > 0
        assert distance < 200


class TestMergeRules:
    def test_default_merge_rules(self):
        rules = MergeRules.default()
        assert rules.conflict_resolution == ConflictResolutionStrategy.PROMPT
        assert rules.prefer_latest_modified is True
        assert rules.duplicate_distance_threshold_meters == 1.0

    def test_merge_rules_to_dict(self):
        rules = MergeRules(
            conflict_resolution=ConflictResolutionStrategy.KEEP_LATEST,
            duplicate_distance_threshold_meters=2.0,
        )
        data = rules.to_dict()

        assert data["conflict_resolution"] == "keep_latest"
        assert data["duplicate_distance_threshold_meters"] == 2.0

    def test_merge_rules_from_dict(self):
        data = {
            "conflict_resolution": "isolate_conflicts",
            "duplicate_distance_threshold_meters": 3.0,
        }
        rules = MergeRules.from_dict(data)

        assert rules.conflict_resolution == ConflictResolutionStrategy.ISOLATE_CONFLICTS
        assert rules.duplicate_distance_threshold_meters == 3.0
