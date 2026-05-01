from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
import json
import csv
import tempfile
import shutil

from .config import (
    MaterialMetadata,
    MaterialType,
    FlightLogEntry,
    WaypointPlanEntry,
    DeliveryListItem,
    ProjectConfig,
    NoFlyZone,
)


class SampleDataGenerator:
    def __init__(self) -> None:
        self.base_time = datetime(2024, 5, 1, 9, 0, 0)

    def generate_flight_logs(
        self,
        num_entries: int = 50,
        start_lat: float = 39.9042,
        start_lon: float = 116.4074,
        interval_seconds: int = 5,
    ) -> List[FlightLogEntry]:
        entries: List[FlightLogEntry] = []

        for i in range(num_entries):
            timestamp = self.base_time + timedelta(seconds=i * interval_seconds)

            lat_offset = (i * 0.0001)
            lon_offset = (i * 0.00015)

            entry = FlightLogEntry(
                timestamp=timestamp,
                latitude=start_lat + lat_offset,
                longitude=start_lon + lon_offset,
                altitude_meters=50.0 + (i % 10) * 2,
                velocity_x=5.0,
                velocity_y=3.0,
                velocity_z=0.0,
                gimbal_yaw=90.0 + (i * 5) % 360,
                gimbal_pitch=-45.0 + (i % 5) * 2,
                gimbal_roll=0.0,
                battery_percentage=100.0 - (i * 0.5),
                satellite_count=12,
                flight_mode="WAYPOINT",
                flight_line=1 + (i // 20),
                waypoint_number=1 + (i % 20),
            )
            entries.append(entry)

        return entries

    def generate_waypoint_plan(
        self,
        num_waypoints: int = 10,
        start_lat: float = 39.9042,
        start_lon: float = 116.4074,
        altitude: float = 50.0,
    ) -> List[WaypointPlanEntry]:
        waypoints: List[WaypointPlanEntry] = []

        for i in range(num_waypoints):
            lat_offset = (i * 0.0005)
            lon_offset = (i * 0.00075)

            waypoint = WaypointPlanEntry(
                waypoint_id=i + 1,
                latitude=start_lat + lat_offset,
                longitude=start_lon + lon_offset,
                altitude_meters=altitude,
                gimbal_pitch=-45.0,
                gimbal_yaw=90.0,
                speed_mps=5.0,
                hold_time_seconds=2.0 if i % 2 == 0 else 0.0,
                action_type="photo" if i % 2 == 0 else "video",
                flight_line=1,
            )
            waypoints.append(waypoint)

        return waypoints

    def generate_delivery_list(
        self,
        num_items: int = 5,
        prefix: str = "DJI_",
    ) -> List[DeliveryListItem]:
        items: List[DeliveryListItem] = []

        for i in range(num_items):
            item = DeliveryListItem(
                file_name=f"{prefix}{i+1:04d}.JPG",
                shooting_time=self.base_time + timedelta(minutes=i),
                location=f"区域{i+1}",
                notes=f"航线{i//2 + 1}拍摄",
                is_delivered=True,
                validation_status="pending",
            )
            items.append(item)

        return items

    def generate_sample_config(
        self,
        project_name: str = "测试航拍项目",
    ) -> ProjectConfig:
        config = ProjectConfig(
            project_name=project_name,
            project_id="TEST_PROJ_001",
            time_sync_threshold_seconds=300.0,
            coordinate_deviation_threshold_meters=50.0,
            no_fly_zones=[
                NoFlyZone(
                    name="测试禁飞区",
                    center_lat=39.9100,
                    center_lon=116.4200,
                    radius_meters=500.0,
                ),
            ],
        )
        return config


class SampleProjectCreator:
    def __init__(self) -> None:
        self.generator = SampleDataGenerator()

    def create_sample_project(
        self,
        output_dir: Path,
        project_name: str = "示例航拍项目",
        include_invalid_samples: bool = True,
    ) -> Dict[str, Path]:
        output_dir.mkdir(parents=True, exist_ok=True)

        paths: Dict[str, Path] = {}

        config = self.generator.generate_sample_config(project_name)
        config_path = output_dir / "project_config.json"
        config.save_to_file(config_path)
        paths["config"] = config_path

        photos_dir = output_dir / "photos"
        photos_dir.mkdir()

        for i in range(5):
            photo_path = photos_dir / f"DJI_{i+1:04d}.JPG"
            self._create_dummy_image(photo_path)
            if i == 0:
                paths["photo_1"] = photo_path

        if include_invalid_samples:
            invalid_photo_path = photos_dir / "INVALID_0001.JPG"
            self._create_dummy_image(invalid_photo_path)
            paths["invalid_photo"] = invalid_photo_path

            duplicate_photo_path = photos_dir / "DJI_0001_duplicate.JPG"
            shutil.copy2(paths["photo_1"], duplicate_photo_path)
            paths["duplicate_photo"] = duplicate_photo_path

        logs_dir = output_dir / "logs"
        logs_dir.mkdir()

        flight_logs = self.generator.generate_flight_logs(num_entries=30)
        log_csv_path = logs_dir / "flight_log.csv"
        self._write_flight_log_csv(flight_logs, log_csv_path)
        paths["flight_log"] = log_csv_path

        plans_dir = output_dir / "plans"
        plans_dir.mkdir()

        waypoint_plan = self.generator.generate_waypoint_plan(num_waypoints=10)
        plan_json_path = plans_dir / "waypoint_plan.json"
        self._write_waypoint_plan_json(waypoint_plan, plan_json_path)
        paths["waypoint_plan"] = plan_json_path

        delivery_dir = output_dir / "delivery_lists"
        delivery_dir.mkdir()

        delivery_list = self.generator.generate_delivery_list(num_items=5)
        delivery_csv_path = delivery_dir / "delivery_list.csv"
        self._write_delivery_list_csv(delivery_list, delivery_csv_path)
        paths["delivery_list"] = delivery_csv_path

        output_dir_2 = output_dir / "output"
        output_dir_2.mkdir()
        quarantine_dir = output_dir / "quarantine"
        quarantine_dir.mkdir()
        reports_dir = output_dir / "reports"
        reports_dir.mkdir()
        metadata_dir = output_dir / "metadata"
        metadata_dir.mkdir()

        return paths

    def _create_dummy_image(self, path: Path) -> None:
        from PIL import Image as PILImage

        img = PILImage.new("RGB", (100, 100), color="blue")
        img.save(path)

    def _write_flight_log_csv(
        self,
        entries: List[FlightLogEntry],
        output_path: Path,
    ) -> None:
        fieldnames = [
            "timestamp",
            "latitude",
            "longitude",
            "altitude_meters",
            "velocity_x",
            "velocity_y",
            "velocity_z",
            "gimbal_yaw",
            "gimbal_pitch",
            "gimbal_roll",
            "battery_percentage",
            "satellite_count",
            "flight_mode",
            "flight_line",
            "waypoint_number",
        ]

        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for entry in entries:
                row = {
                    "timestamp": entry.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    "latitude": f"{entry.latitude:.6f}",
                    "longitude": f"{entry.longitude:.6f}",
                    "altitude_meters": f"{entry.altitude_meters:.1f}" if entry.altitude_meters else "",
                    "velocity_x": f"{entry.velocity_x:.1f}" if entry.velocity_x else "",
                    "velocity_y": f"{entry.velocity_y:.1f}" if entry.velocity_y else "",
                    "velocity_z": f"{entry.velocity_z:.1f}" if entry.velocity_z else "",
                    "gimbal_yaw": f"{entry.gimbal_yaw:.1f}" if entry.gimbal_yaw else "",
                    "gimbal_pitch": f"{entry.gimbal_pitch:.1f}" if entry.gimbal_pitch else "",
                    "gimbal_roll": f"{entry.gimbal_roll:.1f}" if entry.gimbal_roll else "",
                    "battery_percentage": f"{entry.battery_percentage:.1f}" if entry.battery_percentage else "",
                    "satellite_count": str(entry.satellite_count) if entry.satellite_count else "",
                    "flight_mode": entry.flight_mode or "",
                    "flight_line": str(entry.flight_line) if entry.flight_line else "",
                    "waypoint_number": str(entry.waypoint_number) if entry.waypoint_number else "",
                }
                writer.writerow(row)

    def _write_waypoint_plan_json(
        self,
        waypoints: List[WaypointPlanEntry],
        output_path: Path,
    ) -> None:
        data: Dict[str, Any] = {
            "mission_name": "示例航线任务",
            "created_at": self.generator.base_time.isoformat(),
            "waypoints": [],
        }

        for wp in waypoints:
            wp_data = {
                "waypoint_id": wp.waypoint_id,
                "latitude": wp.latitude,
                "longitude": wp.longitude,
                "altitude_meters": wp.altitude_meters,
            }
            if wp.gimbal_pitch is not None:
                wp_data["gimbal_pitch"] = wp.gimbal_pitch
            if wp.gimbal_yaw is not None:
                wp_data["gimbal_yaw"] = wp.gimbal_yaw
            if wp.speed_mps is not None:
                wp_data["speed_mps"] = wp.speed_mps
            if wp.hold_time_seconds is not None:
                wp_data["hold_time_seconds"] = wp.hold_time_seconds
            if wp.action_type is not None:
                wp_data["action_type"] = wp.action_type
            if wp.flight_line is not None:
                wp_data["flight_line"] = wp.flight_line

            data["waypoints"].append(wp_data)

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def _write_delivery_list_csv(
        self,
        items: List[DeliveryListItem],
        output_path: Path,
    ) -> None:
        fieldnames = ["文件名", "拍摄时间", "地点", "备注"]

        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for item in items:
                row = {
                    "文件名": item.file_name,
                    "拍摄时间": (
                        item.shooting_time.strftime("%Y-%m-%d %H:%M:%S")
                        if item.shooting_time
                        else ""
                    ),
                    "地点": item.location or "",
                    "备注": item.notes or "",
                }
                writer.writerow(row)


def create_temp_sample_project(
    project_name: str = "临时测试项目",
    include_invalid: bool = True,
) -> Path:
    temp_dir = Path(tempfile.mkdtemp(prefix="aerial_"))
    creator = SampleProjectCreator()
    creator.create_sample_project(temp_dir, project_name, include_invalid)
    return temp_dir


def cleanup_temp_project(temp_dir: Path) -> None:
    if temp_dir.exists():
        shutil.rmtree(temp_dir)
