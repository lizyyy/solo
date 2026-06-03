from typing import List, Dict, Any
from datetime import datetime
import csv
import io
import hashlib

from models import (
    ReviewRecord,
    ReviewStatus,
    AuditLog,
    AuditAction,
)
from .data_store import DataStore


class ExportService:
    def __init__(self):
        self.data_store = DataStore()

    def export_details(self, batch_id: str, operator: str = "小陶") -> Dict[str, Any]:
        export_data = self._get_export_data(batch_id)

        self.data_store.add_audit_log(AuditLog.create(
            action=AuditAction.EXPORT_DATA,
            batch_id=batch_id,
            operator=operator,
            remark=f"导出明细数据，共{len(export_data['records'])}条记录"
        ))

        return export_data

    def export_to_csv(self, batch_id: str, operator: str = "小陶") -> str:
        export_data = self._get_export_data(batch_id)
        records = export_data["records"]

        output = io.StringIO()
        writer = csv.writer(output)

        header = [
            "批次号", "点位ID", "原始行号", "状态", "问题列表",
            "点云X", "点云Y", "点云Z",
            "坐标X", "坐标Y", "坐标Z", "是否补录坐标",
            "安全半径", "实测距离", "是否满足安全半径",
            "遮挡类型", "遮挡描述",
            "照片ID", "照片中X", "照片中Y",
            "是否人工修改", "修改前X", "修改前Y", "修改前Z",
            "复核人", "复核时间", "安全员", "安全员复核时间", "备注"
        ]
        writer.writerow(header)

        for rec in records:
            pc = rec.get("point_cloud_log") or {}
            coord = rec.get("coordinate") or {}
            safety = rec.get("safety_radius") or {}
            occlusion = rec.get("occlusion") or {}
            photo = rec.get("photo_point")
            review = rec.get("review")

            issues_str = ";".join([i.value for i in review.issues]) if review else ""
            status_str = review.status.value if review else ""

            writer.writerow([
                batch_id,
                rec.get("point_id", ""),
                pc.get("original_line_number", ""),
                status_str,
                issues_str,
                pc.get("x", ""),
                pc.get("y", ""),
                pc.get("z", ""),
                coord.get("x", ""),
                coord.get("y", ""),
                coord.get("z", ""),
                "是" if coord.get("is_supplemented") else "否",
                safety.get("safety_radius", ""),
                safety.get("measured_distance", ""),
                "是" if safety.get("is_within_safety") else "否",
                occlusion.get("occlusion_type", ""),
                occlusion.get("description", ""),
                photo.photo_id if photo else "",
                photo.x_in_photo if photo else "",
                photo.y_in_photo if photo else "",
                "是" if pc.get("is_manually_modified") else "否",
                pc.get("original_x", ""),
                pc.get("original_y", ""),
                pc.get("original_z", ""),
                review.reviewed_by if review else "",
                review.reviewed_at.isoformat() if review and review.reviewed_at else "",
                review.safety_reviewed_by if review else "",
                review.safety_reviewed_at.isoformat() if review and review.safety_reviewed_at else "",
                review.remarks if review else ""
            ])

        self.data_store.add_audit_log(AuditLog.create(
            action=AuditAction.EXPORT_DATA,
            batch_id=batch_id,
            operator=operator,
            remark=f"导出CSV文件，共{len(records)}条记录"
        ))

        return output.getvalue()

    def check_export_consistency(self, batch_id: str, operator: str = "小陶") -> Dict[str, Any]:
        api_data = self._get_export_data(batch_id)
        csv_content = self.export_to_csv(batch_id, operator)

        api_checksum = hashlib.md5(
            str(sorted([str(r) for r in api_data["records"]])).encode("utf-8")
        ).hexdigest()

        csv_lines = csv_content.strip().split("\n")
        csv_data_lines = csv_lines[1:]
        csv_checksum = hashlib.md5(
            str(sorted(csv_data_lines)).encode("utf-8")
        ).hexdigest()

        api_point_ids = {r["point_id"] for r in api_data["records"]}
        csv_point_ids = set()
        for line in csv_data_lines:
            if line.strip():
                parts = line.split(",")
                if len(parts) >= 2:
                    csv_point_ids.add(parts[1].strip())

        missing_in_csv = api_point_ids - csv_point_ids
        missing_in_api = csv_point_ids - api_point_ids

        page_summary = self.data_store.get_batch_summary(batch_id)
        api_summary = api_data["summary"]

        summary_consistent = (
            page_summary["total_points"] == api_summary["total_points"]
        )

        result = {
            "batch_id": batch_id,
            "checked_at": datetime.now().isoformat(),
            "is_consistent": (
                not missing_in_csv
                and not missing_in_api
                and summary_consistent
            ),
            "details": {
                "api_record_count": len(api_point_ids),
                "csv_record_count": len(csv_point_ids),
                "page_total_points": page_summary["total_points"],
                "api_total_points": api_summary["total_points"],
                "missing_in_csv": list(missing_in_csv),
                "missing_in_api": list(missing_in_api),
                "summary_consistent": summary_consistent,
                "api_checksum": api_checksum,
                "csv_checksum": csv_checksum
            }
        }

        self.data_store.add_audit_log(AuditLog.create(
            action=AuditAction.CHECK_EXPORT_CONSISTENCY,
            batch_id=batch_id,
            operator=operator,
            remark=f"导出一致性检查{'通过' if result['is_consistent'] else '不通过'}，"
                   f"API记录数{len(api_point_ids)}，CSV记录数{len(csv_point_ids)}"
        ))

        return result

    def _get_export_data(self, batch_id: str) -> Dict[str, Any]:
        review_records = self.data_store.get_all_review_records(batch_id)

        records = []
        for review in review_records:
            point_detail = self.data_store.get_point_detail(batch_id, review.point_id)
            records.append(point_detail)

        status_counts = {}
        issue_counts = {}
        for rec in records:
            review = rec.get("review")
            if review:
                s = review.status.value
                status_counts[s] = status_counts.get(s, 0) + 1
                for issue in review.issues:
                    i = issue.value
                    issue_counts[i] = issue_counts.get(i, 0) + 1

        return {
            "batch_id": batch_id,
            "exported_at": datetime.now().isoformat(),
            "total_records": len(records),
            "records": records,
            "summary": {
                "total_points": len(records),
                "status_distribution": status_counts,
                "issue_distribution": issue_counts
            }
        }
