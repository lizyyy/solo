from typing import List, Dict, Any, Tuple
from datetime import datetime

from models import (
    ReviewRecord,
    ReviewStatus,
    ReviewIssue,
    AuditLog,
    AuditAction,
    PointCloudLogRecord,
    PhotoPoint,
)
from .data_store import DataStore


class SelfCheckService:
    def __init__(self):
        self.data_store = DataStore()

    def run_self_check(self, batch_id: str, operator: str = "小陶") -> Dict[str, Any]:
        result = {
            "batch_id": batch_id,
            "checked_at": datetime.now().isoformat(),
            "issues": [],
            "summary": {
                "total_points": 0,
                "duplicate_import": False,
                "missing_coordinate_count": 0,
                "supplemented_coordinate_count": 0,
                "safety_violation_count": 0,
                "manually_modified_count": 0,
            }
        }

        pc_log = self.data_store.get_point_cloud_log(batch_id)
        if pc_log and pc_log.is_duplicate:
            result["summary"]["duplicate_import"] = True
            result["issues"].append({
                "type": "duplicate_import",
                "severity": "warning",
                "message": f"检测到重复导入，与批次{pc_log.duplicate_of_batch}重复",
                "duplicate_of_batch": pc_log.duplicate_of_batch
            })

        result["summary"]["total_points"] = len(self.data_store.get_all_review_records(batch_id))

        missing_coords = self.check_missing_coordinates(batch_id, operator)
        result["summary"]["missing_coordinate_count"] = len(missing_coords)
        result["issues"].extend(missing_coords)

        for review in self.data_store.get_all_review_records(batch_id):
            if ReviewIssue.SUPPLEMENTED_COORDINATE in review.issues:
                result["summary"]["supplemented_coordinate_count"] += 1
            if ReviewIssue.SAFETY_RADIUS_VIOLATION in review.issues:
                result["summary"]["safety_violation_count"] += 1
            if ReviewIssue.MANUAL_MODIFICATION in review.issues:
                result["summary"]["manually_modified_count"] += 1

        return result

    def check_missing_coordinates(self, batch_id: str, operator: str = "小陶") -> List[Dict[str, Any]]:
        issues = []
        coord_table = self.data_store.get_coordinate_table(batch_id)
        coord_point_ids = {r.point_id for r in coord_table.records} if coord_table else set()

        photo_points = self.data_store.get_all_photo_points(batch_id)

        for photo_point in photo_points:
            point_id = photo_point.point_id
            if point_id not in coord_point_ids:
                review = self.data_store.get_review_record(batch_id, point_id)
                if not review:
                    pc_log = self.data_store.get_point_cloud_log(batch_id)
                    pc_record = None
                    if pc_log:
                        pc_record = next((r for r in pc_log.records if r.point_id == point_id), None)
                    review = ReviewRecord.create(
                        batch_id=batch_id,
                        point_id=point_id,
                        point_cloud_log_record_id=pc_record.record_id if pc_record else "",
                        photo_point_id=photo_point.point_id,
                        reviewed_by=operator
                    )
                
                if ReviewIssue.PHOTO_HAS_POINT_NO_COORDINATE not in review.issues:
                    review.add_issue(ReviewIssue.PHOTO_HAS_POINT_NO_COORDINATE)
                    review.update_status(ReviewStatus.PHOTO_HAS_POINT_NO_COORDINATE, operator)
                    self.data_store.save_review_record(review)

                    self.data_store.add_audit_log(AuditLog.create(
                        action=AuditAction.DETECT_MISSING_COORDINATE,
                        batch_id=batch_id,
                        point_id=point_id,
                        operator=operator,
                        remark="照片有点位但坐标表缺一行"
                    ))

                pc_log = self.data_store.get_point_cloud_log(batch_id)
                pc_record = None
                if pc_log:
                    pc_record = next((r for r in pc_log.records if r.point_id == point_id), None)

                issues.append({
                    "type": "photo_has_point_no_coordinate",
                    "severity": "error",
                    "point_id": point_id,
                    "photo_id": photo_point.photo_id,
                    "x_in_photo": photo_point.x_in_photo,
                    "y_in_photo": photo_point.y_in_photo,
                    "original_line_number": pc_record.original_line_number if pc_record else None,
                    "point_cloud_coordinates": {
                        "x": pc_record.x,
                        "y": pc_record.y,
                        "z": pc_record.z
                    } if pc_record else None,
                    "message": f"点位{point_id}在照片{photo_point.photo_id}中有标记，但坐标表中缺失",
                    "needs_safety_review": True
                })

        return issues

    def check_duplicate_import(self, batch_id: str) -> Tuple[bool, str]:
        pc_log = self.data_store.get_point_cloud_log(batch_id)
        if not pc_log:
            return False, ""
        return pc_log.is_duplicate, pc_log.duplicate_of_batch or ""

    def check_data_consistency(self, batch_id: str) -> Dict[str, Any]:
        result = {
            "batch_id": batch_id,
            "is_consistent": True,
            "inconsistencies": []
        }

        review_records = self.data_store.get_all_review_records(batch_id)
        for review in review_records:
            detail = self.data_store.get_point_detail(batch_id, review.point_id)

            if detail["point_cloud_log"] and detail["coordinate"]:
                pc = detail["point_cloud_log"]
                coord = detail["coordinate"]
                if abs(pc["x"] - coord["x"]) > 0.001 or abs(pc["y"] - coord["y"]) > 0.001 or abs(pc["z"] - coord["z"]) > 0.001:
                    result["is_consistent"] = False
                    result["inconsistencies"].append({
                        "point_id": review.point_id,
                        "issue": "点云坐标与坐标表不一致",
                        "point_cloud": {"x": pc["x"], "y": pc["y"], "z": pc["z"]},
                        "coordinate": {"x": coord["x"], "y": coord["y"], "z": coord["z"]}
                    })

        return result

    def get_self_check_result(self, batch_id: str) -> Dict[str, Any]:
        return self.run_self_check(batch_id)
