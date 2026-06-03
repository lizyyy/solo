from typing import List, Tuple, Optional
import hashlib
import csv
import io

from models import (
    PointCloudLog,
    PointCloudLogRecord,
    CoordinateTable,
    CoordinateRecord,
    PhotoPoint,
    ReviewRecord,
    AuditLog,
    AuditAction,
    ReviewStatus,
    ReviewIssue,
)
from .data_store import DataStore


class ImportService:
    def __init__(self):
        self.data_store = DataStore()

    def import_point_cloud_log(self, file_name: str, file_content: str,
                               imported_by: str = "小陶") -> Tuple[PointCloudLog, bool, str]:
        pc_log = PointCloudLog.create(file_name, imported_by)

        lines = file_content.strip().split("\n")
        for line_num, line in enumerate(lines, start=1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split(",")
            if len(parts) >= 4:
                point_id = parts[0].strip()
                try:
                    x = float(parts[1].strip())
                    y = float(parts[2].strip())
                    z = float(parts[3].strip())
                except (ValueError, IndexError):
                    continue
                record = PointCloudLogRecord.create(
                    original_line_number=line_num,
                    point_id=point_id,
                    x=x, y=y, z=z,
                    raw_data=line,
                    import_batch_id=pc_log.batch_id
                )
                pc_log.records.append(record)

        pc_log.checksum = self._calculate_checksum(file_content)
        is_duplicate, duplicate_of_batch = self._check_duplicate_import(pc_log.checksum, pc_log.records)
        pc_log.is_duplicate = is_duplicate
        pc_log.duplicate_of_batch = duplicate_of_batch

        self.data_store.save_point_cloud_log(pc_log)

        self.data_store.add_audit_log(AuditLog.create(
            action=AuditAction.IMPORT_POINT_CLOUD,
            batch_id=pc_log.batch_id,
            operator=imported_by,
            remark=f"导入点云抽稀日志，共{len(pc_log.records)}条记录"
        ))

        if is_duplicate:
            self.data_store.add_audit_log(AuditLog.create(
                action=AuditAction.DETECT_DUPLICATE,
                batch_id=pc_log.batch_id,
                operator=imported_by,
                remark=f"检测到重复导入，与批次{duplicate_of_batch}重复"
            ))

        return pc_log, is_duplicate, duplicate_of_batch or ""

    def import_coordinate_table(self, batch_id: str, file_name: str,
                                file_content: str,
                                imported_by: str = "小陶") -> CoordinateTable:
        coord_table = CoordinateTable.create(file_name, batch_id, imported_by)

        lines = file_content.strip().split("\n")
        for line_num, line in enumerate(lines, start=1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split(",")
            if len(parts) >= 4:
                point_id = parts[0].strip()
                try:
                    x = float(parts[1].strip())
                    y = float(parts[2].strip())
                    z = float(parts[3].strip())
                except (ValueError, IndexError):
                    continue
                record = CoordinateRecord.create(
                    original_line_number=line_num,
                    point_id=point_id,
                    x=x, y=y, z=z,
                    raw_data=line
                )
                coord_table.records.append(record)

        self.data_store.save_coordinate_table(coord_table)

        self.data_store.add_audit_log(AuditLog.create(
            action=AuditAction.IMPORT_COORDINATE,
            batch_id=batch_id,
            operator=imported_by,
            remark=f"导入坐标表，共{len(coord_table.records)}条记录"
        ))

        return coord_table

    def import_photo_points(self, batch_id: str, photo_points_data: List[dict],
                            imported_by: str = "小陶") -> List[PhotoPoint]:
        photo_points = []
        for data in photo_points_data:
            pp = PhotoPoint.create(
                point_id=data["point_id"],
                photo_id=data["photo_id"],
                x_in_photo=float(data["x_in_photo"]),
                y_in_photo=float(data["y_in_photo"]),
                marked_by=imported_by
            )
            self.data_store.save_photo_point(batch_id, pp)
            photo_points.append(pp)
        return photo_points

    def initialize_review_records(self, batch_id: str, operator: str = "小陶") -> List[ReviewRecord]:
        pc_log = self.data_store.get_point_cloud_log(batch_id)
        if not pc_log:
            raise ValueError(f"批次{batch_id}的点云抽稀日志不存在")

        review_records = []
        for pc_record in pc_log.records:
            photo_point = self.data_store.get_photo_point(batch_id, pc_record.point_id)
            if not photo_point:
                continue

            review = ReviewRecord.create(
                batch_id=batch_id,
                point_id=pc_record.point_id,
                point_cloud_log_record_id=pc_record.record_id,
                photo_point_id="",
                reviewed_by=operator
            )
            review.photo_point_id = photo_point.point_id
            self.data_store.save_review_record(review)
            review_records.append(review)

        return review_records

    def _calculate_checksum(self, content: str) -> str:
        return hashlib.md5(content.encode("utf-8")).hexdigest()

    def _check_duplicate_import(self, checksum: str, records: List[PointCloudLogRecord]
                                ) -> Tuple[bool, Optional[str]]:
        point_ids = {r.point_id for r in records}
        point_count = len(records)

        for existing_log in self.data_store.get_all_point_cloud_logs():
            if existing_log.checksum == checksum:
                return True, existing_log.batch_id
            existing_point_ids = {r.point_id for r in existing_log.records}
            if len(existing_log.records) == point_count and existing_point_ids == point_ids:
                return True, existing_log.batch_id

        return False, None
