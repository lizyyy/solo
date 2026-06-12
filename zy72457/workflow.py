import uuid
import pandas as pd
from typing import List, Optional, Dict, Any
from datetime import datetime

from models import (
    NightSamplingPoint,
    ImportBatch,
    ServiceRadiusResult,
    PointStatus,
    AbnormalType,
    AuditLog,
)
from storage import store
from self_check import SelfChecker


class WorkflowService:
    @staticmethod
    def step1_import_night_sampling_points(
        file_path: str, operator: str
    ) -> ImportBatch:
        batch_id = f"batch_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"

        df = pd.read_excel(file_path)
        df = df.fillna("")
        points = []

        for idx, row in df.iterrows():
            point_id = f"pt_{uuid.uuid4().hex[:12]}"
            raw_note = str(row.get("施工备注", "")).strip()
            construction_note = raw_note if raw_note else None
            point = NightSamplingPoint(
                id=point_id,
                original_row_number=idx + 2,
                name=str(row.get("点位名称", "")).strip(),
                address=str(row.get("地址", "")).strip(),
                longitude=float(row.get("经度", 0) or 0),
                latitude=float(row.get("纬度", 0) or 0),
                service_radius=float(row.get("服务半径", 500) or 500),
                complaint_id=None,
                status=PointStatus.PENDING_REVIEW,
                import_batch_id=batch_id,
                construction_note=construction_note,
            )

            original_radius = point.service_radius
            calculated_radius = SelfChecker._calculate_radius(point, original_radius)
            point.service_radius = calculated_radius
            result = ServiceRadiusResult(
                point_id=point_id,
                point_name=point.name,
                original_radius=original_radius,
                calculated_radius=calculated_radius,
                final_radius=calculated_radius,
            )

            SelfChecker.check_construction_not_synced(point)

            point.audit_logs.append(
                AuditLog(
                    operator=operator,
                    action="导入点位",
                    after=point.model_dump(),
                    remark=f"Excel原始行号: {idx + 2}",
                )
            )

            points.append(point)
            store.add_point(point)
            store.add_radius_result(result)

        batch = ImportBatch(
            batch_id=batch_id,
            file_name=file_path.split("/")[-1],
            operator=operator,
            total_count=len(points),
            point_ids=[p.id for p in points],
        )
        store.add_batch(batch)

        SelfChecker.check_duplicate_import(batch_id)

        return batch

    @staticmethod
    def step2_add_complaint_id(
        point_id: str, complaint_id: str, operator: str
    ) -> NightSamplingPoint:
        point = store.get_point(point_id)
        if not point:
            raise ValueError(f"点位{point_id}不存在")

        old_complaint = point.complaint_id
        point = store.update_point(
            point_id,
            complaint_id=complaint_id,
            operator=operator,
            action="补充投诉编号",
            remark=f"投诉编号从 {old_complaint} 更新为 {complaint_id}",
        )

        SelfChecker.recalculate_radius_after_supplement(point_id, operator)

        if point.status == PointStatus.PENDING_REVIEW:
            point.status = PointStatus.PENDING_REVIEW

        return point

    @staticmethod
    def step3_update_point_list(
        point_id: str, operator: str, **updates
    ) -> NightSamplingPoint:
        point = store.get_point(point_id)
        if not point:
            raise ValueError(f"点位{point_id}不存在")

        if "construction_note" in updates:
            updates["is_manual_modified"] = True

        point = store.update_point(
            point_id,
            **updates,
            operator=operator,
            action="点位清单更新",
            remark="更新点位信息",
        )

        if "construction_note" in updates:
            SelfChecker.check_construction_not_synced(point)

        SelfChecker.recalculate_radius_after_supplement(point_id, operator)

        return point

    @staticmethod
    def mark_resident_reviewed(
        point_id: str, operator: str, is_approved: bool, remark: str = ""
    ) -> NightSamplingPoint:
        point = store.get_point(point_id)
        if not point:
            raise ValueError(f"点位{point_id}不存在")

        if point.status != PointStatus.RESIDENT_REVIEW:
            raise ValueError(f"点位{point_id}当前状态不是待居民代表复核")

        if is_approved:
            new_status = PointStatus.NORMAL
            action = "居民代表复核通过"
            point.abnormal_types = [
                t for t in point.abnormal_types if t != AbnormalType.CONSTRUCTION_NOT_SYNCED
            ]
        else:
            new_status = PointStatus.CONSTRUCTION_DETOUR
            action = "居民代表复核不通过"

        point = store.update_point(
            point_id,
            status=new_status,
            operator=operator,
            action=action,
            remark=remark or "居民代表复核完成",
        )

        SelfChecker.recalculate_radius_after_supplement(point_id, operator, mark_abnormal=False)

        return point

    @staticmethod
    def get_points_for_resident_review() -> List[NightSamplingPoint]:
        return store.get_points_by_status(PointStatus.RESIDENT_REVIEW)

    @staticmethod
    def update_construction_note(
        point_id: str,
        new_note: str,
        operator: str,
        change_reason: str,
    ) -> NightSamplingPoint:
        point = store.get_point(point_id)
        if not point:
            raise ValueError(f"点位{point_id}不存在")

        old_note = point.construction_note or ""

        point = store.update_point(
            point_id,
            construction_note=new_note or None,
            is_manual_modified=True,
            operator=operator,
            action="修改施工备注",
            remark=f"改前: {old_note} | 改后: {new_note} | 原因: {change_reason}",
        )

        had_construction_issue = AbnormalType.CONSTRUCTION_NOT_SYNCED in point.abnormal_types
        now_has_issue = SelfChecker.check_construction_not_synced(point)

        if had_construction_issue and not now_has_issue:
            point.abnormal_types = [
                t for t in point.abnormal_types if t != AbnormalType.CONSTRUCTION_NOT_SYNCED
            ]
            if point.status == PointStatus.RESIDENT_REVIEW:
                point.status = PointStatus.PENDING_REVIEW

        if not had_construction_issue and now_has_issue:
            point.status = PointStatus.RESIDENT_REVIEW

        SelfChecker.recalculate_radius_after_supplement(
            point_id, operator, mark_abnormal=False
        )

        return point

    @staticmethod
    def get_construction_note_history(point_id: str) -> List[Dict[str, Any]]:
        point = store.get_point(point_id)
        if not point:
            return []

        history = []
        for log in point.audit_logs:
            before_note = log.before.get("construction_note") if log.before else None
            after_note = log.after.get("construction_note") if log.after else None
            if before_note != after_note or log.action in ["导入点位", "修改施工备注", "点位清单更新"]:
                history.append({
                    "timestamp": log.timestamp.isoformat(),
                    "operator": log.operator,
                    "action": log.action,
                    "construction_note_before": before_note or "",
                    "construction_note_after": after_note or "",
                    "remark": log.remark or "",
                    "status_before": log.before.get("status") if log.before else "",
                    "status_after": log.after.get("status") if log.after else "",
                })
        return history
