from typing import List, Dict, Any, Optional
from datetime import date
from models import (
    PointList,
    PointItem,
    ConstructionNotice,
    RampRecord,
    RecordStatus,
    ReviewStatus,
    UserRole,
    OperationType,
)
from .data_repository import DataRepository
from .audit_service import AuditService


class PointService:
    def __init__(self, repository: DataRepository, audit_service: AuditService):
        self.repo = repository
        self.audit = audit_service

    def generate_point_list(
        self,
        operator: str,
        effective_date: Optional[date] = None,
        operator_role: UserRole = UserRole.PLANNER,
    ) -> PointList:
        notices = self.repo.list_construction_notices()
        ramps = self.repo.list_ramp_records()
        latest = self.repo.get_latest_point_list()

        new_version = latest.version + 1 if latest else 1
        effective = effective_date or date.today()

        processed_notice_ids = []
        processed_ramp_ids = []
        items = []

        for notice in notices:
            if notice.status in [RecordStatus.REJECTED, RecordStatus.DRAFT]:
                continue

            if notice.review_status == ReviewStatus.PENDING_RESIDENT_REVIEW:
                self._add_detour_unsynced_item(items, notice)
                processed_notice_ids.append(notice.id)
                continue

            notice_ramps = [r for r in ramps if r.construction_notice_id == notice.id]
            for ramp in notice_ramps:
                item = self._build_point_item(notice, ramp, operator)
                items.append(item)
                processed_notice_ids.append(notice.id)
                processed_ramp_ids.append(ramp.id)

            if not notice_ramps:
                item = self._build_point_item_from_notice(notice, operator)
                items.append(item)
                processed_notice_ids.append(notice.id)

        orphan_ramps = [r for r in ramps if r.id not in processed_ramp_ids]
        for ramp in orphan_ramps:
            item = self._build_point_item_from_ramp(ramp, operator)
            items.append(item)
            processed_ramp_ids.append(ramp.id)

        point_list = PointList(
            created_by=operator,
            updated_by=operator,
            version=new_version,
            effective_date=effective,
            status=RecordStatus.FINALIZED,
            items=items,
            generated_from_notices=processed_notice_ids,
            generated_from_ramps=processed_ramp_ids,
            recalculation_note="点位清单自动生成" if not latest else "补录后重算点位清单",
        )

        self.repo.add_point_list(point_list)

        for nid in processed_notice_ids:
            notice = self.repo.get_construction_notice(nid)
            if notice:
                notice.point_list_updated = True
                notice.touch(operator)

        self.audit.log_operation(
            operation_type=OperationType.UPDATE_POINT_LIST,
            operator=operator,
            operator_role=operator_role,
            target_entity_type="PointList",
            target_entity_id=point_list.id,
            changes={
                "version": {"old": latest.version if latest else 0, "new": new_version},
                "item_count": {"old": len(latest.items) if latest else 0, "new": len(items)},
            },
            reason="点位清单更新" + ("（补录后重算）" if latest else ""),
            impacted_results=[f"涉及 {len(items)} 个点位"],
        )

        return point_list

    def _add_detour_unsynced_item(self, items: List[PointItem], notice: ConstructionNotice):
        item = PointItem(
            created_by="system",
            updated_by="system",
            point_code=f"P-{notice.notice_no}-DETOUR",
            point_name=f"{notice.project_name}（施工改道待居民复核）",
            location=notice.construction_location,
            charging_pile_count=0,
            capacity_status="pending_review",
            queue_status="pending",
            accessible=False,
            affected_by_construction=True,
            construction_notice_ids=[notice.id],
            remark="施工临时改道没有同步到地图，待居民代表复核，暂不纳入正常排队",
        )
        items.append(item)

    def _build_point_item(
        self, notice: ConstructionNotice, ramp: RampRecord, operator: str
    ) -> PointItem:
        accessible = ramp.accessible and not notice.temporary_detour
        capacity = "normal" if accessible else "limited"
        queue = "normal" if accessible else "delayed"

        return PointItem(
            created_by=operator,
            updated_by=operator,
            point_code=f"P-{notice.notice_no}-{ramp.id[:8]}",
            point_name=notice.project_name,
            location=notice.construction_location,
            charging_pile_count=self._estimate_pile_count(notice),
            capacity_status=capacity,
            queue_status=queue,
            accessible=accessible,
            affected_by_construction=notice.temporary_detour,
            construction_notice_ids=[notice.id],
            ramp_record_id=ramp.id,
            remark=notice.remark or ramp.remark,
        )

    def _build_point_item_from_notice(
        self, notice: ConstructionNotice, operator: str
    ) -> PointItem:
        return PointItem(
            created_by=operator,
            updated_by=operator,
            point_code=f"P-{notice.notice_no}",
            point_name=notice.project_name,
            location=notice.construction_location,
            charging_pile_count=self._estimate_pile_count(notice),
            capacity_status="unknown" if not notice.ramp_records_verified else "normal",
            queue_status="pending" if not notice.ramp_records_verified else "normal",
            accessible=not notice.temporary_detour,
            affected_by_construction=notice.temporary_detour,
            construction_notice_ids=[notice.id],
            remark="坡道记录待补录" if not notice.ramp_records_verified else notice.remark,
        )

    def _build_point_item_from_ramp(self, ramp: RampRecord, operator: str) -> PointItem:
        return PointItem(
            created_by=operator,
            updated_by=operator,
            point_code=f"P-RAMP-{ramp.id[:8]}",
            point_name=f"坡道点位-{ramp.ramp_location}",
            location=ramp.ramp_location,
            charging_pile_count=0,
            capacity_status="normal" if ramp.accessible else "limited",
            queue_status="normal",
            accessible=ramp.accessible,
            affected_by_construction=False,
            ramp_record_id=ramp.id,
            remark=ramp.remark or "未关联施工告示",
        )

    def _estimate_pile_count(self, notice: ConstructionNotice) -> int:
        scope = notice.impact_scope.lower()
        if "大型" in scope or "large" in scope:
            return 8
        if "中型" in scope or "medium" in scope:
            return 4
        return 2

    def recalculate_after_supplement(
        self, operator: str, reason: str
    ) -> PointList:
        latest = self.repo.get_latest_point_list()
        old_version = latest.version if latest else 0
        old_count = len(latest.items) if latest else 0

        new_point_list = self.generate_point_list(operator)

        self.audit.log_operation(
            operation_type=OperationType.RECALCULATE,
            operator=operator,
            operator_role=UserRole.PLANNER,
            target_entity_type="PointList",
            target_entity_id=new_point_list.id,
            changes={
                "version": {"old": old_version, "new": new_point_list.version},
                "item_count": {"old": old_count, "new": len(new_point_list.items)},
            },
            reason=f"补录后重算：{reason}",
            impacted_results=[f"重算前 {old_count} 个点位，重算后 {len(new_point_list.items)} 个点位"],
        )

        return new_point_list

    def get_point_list_for_display(self, point_list_id: Optional[str] = None) -> Dict[str, Any]:
        if point_list_id:
            pl = self.repo.get_point_list(point_list_id)
        else:
            pl = self.repo.get_latest_point_list()

        if not pl:
            return {"version": 0, "items": [], "source": "single_source"}

        items_display = []
        for item in pl.items:
            item_dict = item.model_dump()
            notices = [
                self.repo.get_construction_notice(nid)
                for nid in item.construction_notice_ids
            ]
            item_dict["construction_notices"] = [
                {"id": n.id, "notice_no": n.notice_no, "project_name": n.project_name,
                 "temporary_detour": n.temporary_detour, "map_updated": n.map_updated,
                 "review_status": n.review_status}
                for n in notices if n
            ]
            if item.ramp_record_id:
                ramp = self.repo.get_ramp_record(item.ramp_record_id)
                if ramp:
                    item_dict["ramp_record"] = {
                        "id": ramp.id, "location": ramp.ramp_location,
                        "accessible": ramp.accessible, "has_ramp": ramp.has_ramp
                    }
            items_display.append(item_dict)

        return {
            "id": pl.id,
            "version": pl.version,
            "effective_date": pl.effective_date,
            "status": pl.status,
            "items": items_display,
            "recalculation_note": pl.recalculation_note,
            "source": "single_source",
        }

    def export_point_list(self, point_list_id: Optional[str] = None) -> Dict[str, Any]:
        display_data = self.get_point_list_for_display(point_list_id)

        self.audit.log_operation(
            operation_type=OperationType.EXPORT,
            operator="system",
            operator_role=UserRole.SYSTEM,
            target_entity_type="PointList",
            target_entity_id=display_data.get("id", "unknown"),
            changes={},
            reason="导出点位清单明细",
            impacted_results=[f"导出 {len(display_data['items'])} 条记录"],
        )

        return {
            **display_data,
            "export_format": "unified",
            "export_note": "导出数据与页面展示、接口返回使用同一份数据源",
        }
