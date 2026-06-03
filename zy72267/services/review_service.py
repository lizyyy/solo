from typing import List, Dict, Any, Optional
from datetime import datetime

from models import (
    ReviewRecord,
    ReviewStatus,
    ReviewIssue,
    CoordinateRecord,
    SafetyRadiusTable,
    SafetyRadiusRecord,
    OcclusionList,
    OcclusionRecord,
    OcclusionType,
    AuditLog,
    AuditAction,
    PointCloudLogRecord,
)
from .data_store import DataStore


class ReviewService:
    def __init__(self):
        self.data_store = DataStore()

    def supplement_coordinate(self, batch_id: str, point_id: str,
                              x: float, y: float, z: float,
                              operator: str = "小陶") -> Dict[str, Any]:
        coord_table = self.data_store.get_coordinate_table(batch_id)
        if not coord_table:
            coord_table = CoordinateTable.create(
                file_name="补录坐标表",
                batch_id=batch_id,
                imported_by=operator
            )

        existing = next((r for r in coord_table.records if r.point_id == point_id), None)
        if existing:
            raise ValueError(f"点位{point_id}的坐标已存在，无法重复补录")

        new_coord = CoordinateRecord.create_supplemented(
            point_id=point_id, x=x, y=y, z=z,
            supplemented_by=operator
        )
        coord_table.records.append(new_coord)
        self.data_store.save_coordinate_table(coord_table)

        review = self.data_store.get_review_record(batch_id, point_id)
        if review:
            review.coordinate_record_id = new_coord.record_id
            review.add_issue(ReviewIssue.SUPPLEMENTED_COORDINATE)
            review.remove_issue(ReviewIssue.PHOTO_HAS_POINT_NO_COORDINATE)
            review.update_status(ReviewStatus.COORDINATE_SUPPLEMENTED, operator)
            self.data_store.save_review_record(review)

        self.data_store.add_audit_log(AuditLog.create(
            action=AuditAction.SUPPLEMENT_COORDINATE,
            batch_id=batch_id,
            point_id=point_id,
            operator=operator,
            new_value=f"x={x}, y={y}, z={z}",
            remark="补录缺失的坐标"
        ))

        self.recalculate(batch_id, point_id, operator)

        return self.data_store.get_point_detail(batch_id, point_id)

    def check_safety_radius(self, batch_id: str, safety_data: List[Dict[str, Any]],
                            operator: str = "小陶") -> SafetyRadiusTable:
        building_name = safety_data[0].get("building_name", "未命名建筑") if safety_data else "未命名建筑"
        safety_table = SafetyRadiusTable.create(batch_id, building_name, operator)

        for data in safety_data:
            record = SafetyRadiusRecord.create(
                point_id=data["point_id"],
                building_name=building_name,
                safety_radius=float(data["safety_radius"]),
                measured_distance=float(data["measured_distance"]),
                checked_by=operator
            )
            safety_table.records.append(record)

            review = self.data_store.get_review_record(batch_id, data["point_id"])
            if not review:
                review = ReviewRecord.create(
                    batch_id=batch_id,
                    point_id=data["point_id"],
                    point_cloud_log_record_id="",
                    photo_point_id="",
                    reviewed_by=operator
                )
            review.safety_radius_record_id = record.record_id
            if not record.is_within_safety:
                review.add_issue(ReviewIssue.SAFETY_RADIUS_VIOLATION)
            review.update_status(ReviewStatus.SAFETY_CHECKED, operator)
            self.data_store.save_review_record(review)

        self.data_store.save_safety_radius_table(safety_table)

        self.data_store.add_audit_log(AuditLog.create(
            action=AuditAction.CHECK_SAFETY_RADIUS,
            batch_id=batch_id,
            operator=operator,
            remark=f"核对{building_name}安全半径，共{len(safety_data)}条记录"
        ))

        return safety_table

    def update_occlusion_list(self, batch_id: str, occlusion_data: List[Dict[str, Any]],
                              operator: str = "小陶") -> OcclusionList:
        occlusion_list = OcclusionList.create(batch_id, operator)

        for data in occlusion_data:
            oc_type = OcclusionType(data.get("occlusion_type", "天际线遮挡"))
            record = OcclusionRecord.create(
                point_id=data["point_id"],
                occlusion_type=oc_type,
                description=data.get("description", ""),
                created_by=operator
            )
            if data.get("is_confirmed", False):
                record.is_confirmed = True
                record.confirmed_by = operator
                record.confirmed_at = datetime.now()
            occlusion_list.records.append(record)

            review = self.data_store.get_review_record(batch_id, data["point_id"])
            if not review:
                review = ReviewRecord.create(
                    batch_id=batch_id,
                    point_id=data["point_id"],
                    point_cloud_log_record_id="",
                    photo_point_id="",
                    reviewed_by=operator
                )
            review.occlusion_record_id = record.record_id
            if review.status in [ReviewStatus.SAFETY_CHECKED, ReviewStatus.COORDINATE_SUPPLEMENTED]:
                review.update_status(ReviewStatus.OCCLUSION_UPDATED, operator)
            self.data_store.save_review_record(review)

        self.data_store.save_occlusion_list(occlusion_list)

        self.data_store.add_audit_log(AuditLog.create(
            action=AuditAction.UPDATE_OCCLUSION,
            batch_id=batch_id,
            operator=operator,
            remark=f"更新遮挡点清单，共{len(occlusion_data)}条记录"
        ))

        return occlusion_list

    def recalculate(self, batch_id: str, point_id: Optional[str] = None,
                    operator: str = "小陶") -> Dict[str, Any]:
        self.data_store.add_audit_log(AuditLog.create(
            action=AuditAction.RECALCULATE,
            batch_id=batch_id,
            point_id=point_id,
            operator=operator,
            remark="补录后重新计算"
        ))

        result = {
            "batch_id": batch_id,
            "recalculated_at": datetime.now().isoformat(),
            "recalculated_points": []
        }

        review_records = self.data_store.get_all_review_records(batch_id)
        if point_id:
            review_records = [r for r in review_records if r.point_id == point_id]

        for review in review_records:
            point_detail = self.data_store.get_point_detail(batch_id, review.point_id)
            coord = point_detail.get("coordinate")
            if coord and review.status == ReviewStatus.PHOTO_HAS_POINT_NO_COORDINATE:
                if coord.get("is_supplemented"):
                    review.update_status(ReviewStatus.COORDINATE_SUPPLEMENTED, operator)
                    review.add_issue(ReviewIssue.SUPPLEMENTED_COORDINATE)
                    review.remove_issue(ReviewIssue.PHOTO_HAS_POINT_NO_COORDINATE)
                    self.data_store.save_review_record(review)

            safety = point_detail.get("safety_radius")
            if safety:
                if not safety.get("is_within_safety", True):
                    review.add_issue(ReviewIssue.SAFETY_RADIUS_VIOLATION)
                else:
                    review.remove_issue(ReviewIssue.SAFETY_RADIUS_VIOLATION)
                self.data_store.save_review_record(review)

            result["recalculated_points"].append({
                "point_id": review.point_id,
                "status": review.status.value,
                "issues": [i.value for i in review.issues]
            })

        return result

    def submit_for_safety_review(self, batch_id: str, point_id: str,
                                 operator: str = "小陶") -> Dict[str, Any]:
        review = self.data_store.get_review_record(batch_id, point_id)
        if not review:
            review = ReviewRecord.create(
                batch_id=batch_id,
                point_id=point_id,
                point_cloud_log_record_id="",
                photo_point_id="",
                reviewed_by=operator
            )

        review.update_status(ReviewStatus.SAFETY_REVIEW_PENDING, operator)
        self.data_store.save_review_record(review)

        self.data_store.add_audit_log(AuditLog.create(
            action=AuditAction.SUBMIT_FOR_REVIEW,
            batch_id=batch_id,
            point_id=point_id,
            operator=operator,
            remark="提交安全员复核"
        ))

        return self.data_store.get_point_detail(batch_id, point_id)

    def safety_review(self, batch_id: str, point_id: str, is_approved: bool,
                      remarks: str = "", operator: str = "安全员") -> Dict[str, Any]:
        review = self.data_store.get_review_record(batch_id, point_id)
        if not review:
            raise ValueError(f"点位{point_id}不存在")

        if review.status != ReviewStatus.SAFETY_REVIEW_PENDING:
            if ReviewIssue.PHOTO_HAS_POINT_NO_COORDINATE in review.issues:
                pass
            else:
                raise ValueError(f"点位{point_id}当前状态为{review.status.value}，不需要安全员复核")

        if is_approved:
            review.update_status(ReviewStatus.NORMAL, operator)
            audit_action = AuditAction.SAFETY_REVIEW_APPROVE
            remark = "安全员复核通过，状态改为正常"
        else:
            review.update_status(ReviewStatus.ABNORMAL, operator)
            audit_action = AuditAction.SAFETY_REVIEW_REJECT
            remark = "安全员复核不通过，状态改为异常"

        review.remarks = remarks
        self.data_store.save_review_record(review)

        self.data_store.add_audit_log(AuditLog.create(
            action=audit_action,
            batch_id=batch_id,
            point_id=point_id,
            operator=operator,
            remark=f"{remark}。备注：{remarks}"
        ))

        return self.data_store.get_point_detail(batch_id, point_id)

    def manually_modify_point_cloud(self, batch_id: str, point_id: str,
                                    new_x: float, new_y: float, new_z: float,
                                    reason: str, operator: str = "小陶") -> Dict[str, Any]:
        pc_log = self.data_store.get_point_cloud_log(batch_id)
        if not pc_log:
            raise ValueError(f"批次{batch_id}不存在")

        pc_record = next((r for r in pc_log.records if r.point_id == point_id), None)
        if not pc_record:
            raise ValueError(f"点位{point_id}在点云日志中不存在")

        old_value = f"x={pc_record.x}, y={pc_record.y}, z={pc_record.z}"
        new_value = f"x={new_x}, y={new_y}, z={new_z}"

        pc_record.original_x = pc_record.x
        pc_record.original_y = pc_record.y
        pc_record.original_z = pc_record.z
        pc_record.x = new_x
        pc_record.y = new_y
        pc_record.z = new_z
        pc_record.is_manually_modified = True
        pc_record.updated_at = datetime.now()

        self.data_store.save_point_cloud_log(pc_log)

        review = self.data_store.get_review_record(batch_id, point_id)
        if not review:
            review = ReviewRecord.create(
                batch_id=batch_id,
                point_id=point_id,
                point_cloud_log_record_id=pc_record.record_id if pc_record else "",
                photo_point_id="",
                reviewed_by=operator
            )
        review.add_issue(ReviewIssue.MANUAL_MODIFICATION)
        self.data_store.save_review_record(review)

        self.data_store.add_audit_log(AuditLog.create(
            action=AuditAction.MANUAL_MODIFY,
            batch_id=batch_id,
            point_id=point_id,
            operator=operator,
            original_value=old_value,
            new_value=new_value,
            original_line_number=pc_record.original_line_number,
            remark=f"人工修改点云坐标。原因：{reason}"
        ))

        self.recalculate(batch_id, point_id, operator)

        return self.data_store.get_point_detail(batch_id, point_id)

    def get_review_workflow_status(self, batch_id: str) -> Dict[str, Any]:
        review_records = self.data_store.get_all_review_records(batch_id)
        total = len(review_records)

        status_counts = {}
        for r in review_records:
            s = r.status.value
            status_counts[s] = status_counts.get(s, 0) + 1

        pc_log = self.data_store.get_point_cloud_log(batch_id)
        coord_table = self.data_store.get_coordinate_table(batch_id)
        safety_table = self.data_store.get_safety_radius_table(batch_id)
        occlusion_list = self.data_store.get_occlusion_list(batch_id)

        return {
            "batch_id": batch_id,
            "total_points": total,
            "step1_import_done": pc_log is not None and len(pc_log.records) > 0,
            "step2_safety_check_done": safety_table is not None and len(safety_table.records) > 0,
            "step3_occlusion_update_done": occlusion_list is not None and len(occlusion_list.records) > 0,
            "pending_safety_review_count": status_counts.get("待安全员复核", 0)
                                                                  + status_counts.get("照片有标记但坐标表缺行", 0),
            "status_distribution": status_counts,
            "workflow_steps": [
                {
                    "name": "第一步：导入点云抽稀日志",
                    "status": "已完成" if pc_log and len(pc_log.records) > 0 else "未开始",
                    "count": len(pc_log.records) if pc_log else 0
                },
                {
                    "name": "第二步：补看安全半径表",
                    "status": "已完成" if safety_table and len(safety_table.records) > 0 else "未开始",
                    "count": len(safety_table.records) if safety_table else 0
                },
                {
                    "name": "第三步：更新遮挡点清单",
                    "status": "已完成" if occlusion_list and len(occlusion_list.records) > 0 else "未开始",
                    "count": len(occlusion_list.records) if occlusion_list else 0
                }
            ]
        }
