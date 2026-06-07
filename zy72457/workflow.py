import uuid
import pandas as pd
from typing import List, Optional
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
        points = []

        for idx, row in df.iterrows():
            point_id = f"pt_{uuid.uuid4().hex[:12]}"
            point = NightSamplingPoint(
                id=point_id,
                original_row_number=idx + 2,
                name=str(row.get("点位名称", "")),
                address=str(row.get("地址", "")),
                longitude=float(row.get("经度", 0)),
                latitude=float(row.get("纬度", 0)),
                service_radius=float(row.get("服务半径", 500)),
                complaint_id=None,
                status=PointStatus.PENDING_REVIEW,
                import_batch_id=batch_id,
                construction_note=str(row.get("施工备注", "")) or None,
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
