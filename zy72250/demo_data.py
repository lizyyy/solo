from datetime import datetime
from models import PointCloudLog, SafetyRadiusEntry, CoordRow


class DemoData:
    @staticmethod
    def get_success_case() -> dict:
        photo_id = "PHOTO-001-顺利"
        logs = [
            PointCloudLog(
                log_id="LOG-001",
                photo_id=photo_id,
                point_index=1,
                timestamp=datetime(2024, 6, 1, 10, 0, 0),
                raw_coords=(10.5, 20.3, 1.8),
                confidence=0.95,
                notes="货架A柱"
            ),
            PointCloudLog(
                log_id="LOG-002",
                photo_id=photo_id,
                point_index=2,
                timestamp=datetime(2024, 6, 1, 10, 0, 1),
                raw_coords=(15.2, 25.1, 2.1),
                confidence=0.92,
                notes="消防栓"
            )
        ]
        coords = [
            CoordRow(
                photo_id=photo_id,
                point_index=1,
                x=10.5, y=20.3, z=1.8,
                coord_source="auto"
            ),
            CoordRow(
                photo_id=photo_id,
                point_index=2,
                x=15.2, y=25.1, z=2.1,
                coord_source="auto"
            )
        ]
        safety = [
            SafetyRadiusEntry(
                point_id=f"{photo_id}_p1",
                photo_id=photo_id,
                point_index=1,
                radius_meters=1.5,
                obstacle_type="货架",
                measured_date="2024-05-28",
                source="original",
                is_old_caliber=False
            ),
            SafetyRadiusEntry(
                point_id=f"{photo_id}_p2",
                photo_id=photo_id,
                point_index=2,
                radius_meters=1.0,
                obstacle_type="消防设施",
                measured_date="2024-05-28",
                source="original",
                is_old_caliber=False
            )
        ]
        return {
            "photo_id": photo_id,
            "point_cloud_logs": logs,
            "coord_rows": coords,
            "safety_radius_entries": safety,
            "description": "顺利完成案例：所有点位数据完整，无缺失"
        }

    @staticmethod
    def get_missing_coord_case() -> dict:
        photo_id = "PHOTO-002-缺行"
        logs = [
            PointCloudLog(
                log_id="LOG-003",
                photo_id=photo_id,
                point_index=1,
                timestamp=datetime(2024, 6, 1, 11, 0, 0),
                raw_coords=(8.7, 15.2, 2.0),
                confidence=0.90,
                notes="堆垛机支架"
            ),
            PointCloudLog(
                log_id="LOG-004",
                photo_id=photo_id,
                point_index=2,
                timestamp=datetime(2024, 6, 1, 11, 0, 2),
                raw_coords=None,
                confidence=0.0,
                notes="紧急出口指示灯"
            ),
            PointCloudLog(
                log_id="LOG-005",
                photo_id=photo_id,
                point_index=3,
                timestamp=datetime(2024, 6, 1, 11, 0, 3),
                raw_coords=(12.1, 18.5, 1.6),
                confidence=0.88,
                notes="托盘堆高"
            )
        ]
        coords = [
            CoordRow(
                photo_id=photo_id,
                point_index=1,
                x=8.7, y=15.2, z=2.0,
                coord_source="auto"
            ),
            CoordRow(
                photo_id=photo_id,
                point_index=3,
                x=12.1, y=18.5, z=1.6,
                coord_source="auto"
            )
        ]
        safety = [
            SafetyRadiusEntry(
                point_id=f"{photo_id}_p1",
                photo_id=photo_id,
                point_index=1,
                radius_meters=2.0,
                obstacle_type="机械设备",
                measured_date="2024-05-28",
                source="original"
            ),
            SafetyRadiusEntry(
                point_id=f"{photo_id}_p3",
                photo_id=photo_id,
                point_index=3,
                radius_meters=2.5,
                obstacle_type="货物堆垛",
                measured_date="2024-05-28",
                source="original"
            )
        ]
        return {
            "photo_id": photo_id,
            "point_cloud_logs": logs,
            "coord_rows": coords,
            "safety_radius_entries": safety,
            "description": "照片有点位但坐标表缺行案例：点位#2需要安全员复核"
        }

    @staticmethod
    def get_supplemented_case() -> dict:
        photo_id = "PHOTO-003-补录"
        logs = [
            PointCloudLog(
                log_id="LOG-006",
                photo_id=photo_id,
                point_index=1,
                timestamp=datetime(2024, 6, 1, 14, 0, 0),
                raw_coords=(5.5, 10.2, 1.9),
                confidence=0.93,
                notes="充电区入口"
            ),
            PointCloudLog(
                log_id="LOG-007",
                photo_id=photo_id,
                point_index=2,
                timestamp=datetime(2024, 6, 1, 14, 0, 1),
                raw_coords=None,
                confidence=0.0,
                notes="旧货架立柱"
            ),
            PointCloudLog(
                log_id="LOG-008",
                photo_id=photo_id,
                point_index=3,
                timestamp=datetime(2024, 6, 1, 14, 0, 2),
                raw_coords=(7.8, 12.5, 2.2),
                confidence=0.91,
                notes="装卸平台"
            )
        ]
        coords = [
            CoordRow(
                photo_id=photo_id,
                point_index=1,
                x=5.5, y=10.2, z=1.9,
                coord_source="auto"
            ),
            CoordRow(
                photo_id=photo_id,
                point_index=3,
                x=7.8, y=12.5, z=2.2,
                coord_source="auto"
            )
        ]
        safety = [
            SafetyRadiusEntry(
                point_id=f"{photo_id}_p1",
                photo_id=photo_id,
                point_index=1,
                radius_meters=1.8,
                obstacle_type="充电区",
                measured_date="2024-05-15",
                source="original"
            ),
            SafetyRadiusEntry(
                point_id=f"{photo_id}_p2",
                photo_id=photo_id,
                point_index=2,
                radius_meters=2.8,
                obstacle_type="旧货架",
                measured_date="2024-03-20",
                source="legacy",
                is_old_caliber=True
            ),
            SafetyRadiusEntry(
                point_id=f"{photo_id}_p3",
                photo_id=photo_id,
                point_index=3,
                radius_meters=1.2,
                obstacle_type="装卸区",
                measured_date="2024-05-15",
                source="original"
            )
        ]
        return {
            "photo_id": photo_id,
            "point_cloud_logs": logs,
            "coord_rows": coords,
            "safety_radius_entries": safety,
            "description": "旧口径补录案例：点位#2从安全半径表补录（安全半径表一晚到）"
        }

    @staticmethod
    def get_all_demo_cases() -> list:
        return [
            DemoData.get_success_case(),
            DemoData.get_missing_coord_case(),
            DemoData.get_supplemented_case()
        ]
