from typing import List, Optional, Dict, Any
from datetime import date
from models import (
    ConstructionNotice,
    ConstructionNoticeImport,
    RampRecord,
    RampRecordSupplement,
    RecordStatus,
    UserRole,
    OperationType,
)
from .data_repository import DataRepository
from .audit_service import AuditService


class ImportService:
    def __init__(self, repository: DataRepository, audit_service: AuditService):
        self.repo = repository
        self.audit = audit_service

    def import_construction_notice(
        self,
        import_data: Dict[str, Any],
        operator: str,
        operator_role: UserRole = UserRole.PLANNER,
    ) -> ConstructionNotice:
        existing = self.repo.get_construction_notice_by_no(import_data.get("notice_no", ""))
        if existing:
            raise ValueError(f"施工告示编号 {import_data.get('notice_no')} 已存在，请勿重复导入")

        import_data["created_by"] = operator
        import_data["updated_by"] = operator
        notice_import = ConstructionNoticeImport(**import_data)
        notice = ConstructionNotice(**notice_import.model_dump())

        if notice.temporary_detour and not notice.map_updated:
            notice.mark_detour_unsynced(operator)

        self.repo.add_construction_notice(notice)

        changes = self.audit.build_change_dict(None, notice, [
            "notice_no", "project_name", "construction_location", "temporary_detour",
            "map_updated", "status", "review_status"
        ])
        self.audit.log_operation(
            operation_type=OperationType.IMPORT_NOTICE,
            operator=operator,
            operator_role=operator_role,
            target_entity_type="ConstructionNotice",
            target_entity_id=notice.id,
            changes=changes,
            reason="施工告示第一次导入",
            impacted_results=["点位清单待更新"],
        )

        return notice

    def batch_import_construction_notices(
        self,
        import_data_list: List[Dict[str, Any]],
        operator: str,
        import_batch_no: str,
        operator_role: UserRole = UserRole.PLANNER,
    ) -> Dict[str, Any]:
        new_records: List[ConstructionNotice] = []
        history_duplicates: List[Dict[str, Any]] = []
        current_batch_duplicates: List[Dict[str, Any]] = []
        current_batch_nos: set = set()

        for data in import_data_list:
            notice_no = data.get("notice_no", "")

            if notice_no in current_batch_nos:
                current_batch_duplicates.append({
                    "notice_no": notice_no,
                    "row_data": data,
                    "duplicate_type": "current_batch",
                    "description": f"本次导入批次内重复：{notice_no}"
                })
                continue
            current_batch_nos.add(notice_no)

            existing = self.repo.get_construction_notice_by_no(notice_no)
            if existing:
                history_duplicates.append({
                    "notice_no": notice_no,
                    "existing_id": existing.id,
                    "existing_batch_no": existing.import_batch_no,
                    "row_data": data,
                    "duplicate_type": "history",
                    "description": f"历史批次已存在：{notice_no}（批次 {existing.import_batch_no}）"
                })
                continue

            try:
                data["import_batch_no"] = import_batch_no
                result = self.import_construction_notice(data, operator, operator_role)
                new_records.append(result)
            except Exception as e:
                current_batch_duplicates.append({
                    "notice_no": notice_no,
                    "row_data": data,
                    "duplicate_type": "error",
                    "error": str(e),
                    "description": f"导入出错：{str(e)}"
                })

        return {
            "import_batch_no": import_batch_no,
            "total_input": len(import_data_list),
            "new_records": [n.model_dump() for n in new_records],
            "new_count": len(new_records),
            "history_duplicates": history_duplicates,
            "history_duplicate_count": len(history_duplicates),
            "current_batch_duplicates": current_batch_duplicates,
            "current_batch_duplicate_count": len(current_batch_duplicates),
            "summary": f"导入完成：新增 {len(new_records)} 条，历史重复 {len(history_duplicates)} 条，本次重复 {len(current_batch_duplicates)} 条"
        }

    def supplement_ramp_record(
        self,
        ramp_data: Dict[str, Any],
        operator: str,
        operator_role: UserRole = UserRole.PLANNER,
    ) -> RampRecord:
        ramp_data["created_by"] = operator
        ramp_data["updated_by"] = operator
        ramp_supplement = RampRecordSupplement(**ramp_data)
        ramp = RampRecord(**ramp_supplement.model_dump())

        if ramp.construction_notice_id:
            notice = self.repo.get_construction_notice(ramp.construction_notice_id)
            if notice:
                notice.ramp_records_verified = True
                notice.touch(operator)
                ramp.matched_notice = True

        self.repo.add_ramp_record(ramp)

        changes = self.audit.build_change_dict(None, ramp, [
            "ramp_location", "has_ramp", "accessible", "construction_notice_id"
        ])
        self.audit.log_operation(
            operation_type=OperationType.SUPPLEMENT_RAMP,
            operator=operator,
            operator_role=operator_role,
            target_entity_type="RampRecord",
            target_entity_id=ramp.id,
            changes=changes,
            reason="街道规划员补看无障碍坡道记录",
            impacted_results=[f"施工告示 {ramp.construction_notice_id} 坡道记录已更新"] if ramp.construction_notice_id else [],
        )

        return ramp

    def mark_detour_unsynced(
        self,
        notice_id: str,
        operator: str,
        operator_role: UserRole = UserRole.PLANNER,
    ) -> ConstructionNotice:
        notice = self.repo.get_construction_notice(notice_id)
        if not notice:
            raise ValueError(f"施工告示 {notice_id} 不存在")

        old_notice = notice.model_copy()
        notice.mark_detour_unsynced(operator)

        changes = self.audit.build_change_dict(old_notice, notice, [
            "map_updated", "review_status", "status"
        ])
        self.audit.log_operation(
            operation_type=OperationType.MARK_DETOUR_UNSYNCED,
            operator=operator,
            operator_role=operator_role,
            target_entity_type="ConstructionNotice",
            target_entity_id=notice.id,
            changes=changes,
            reason="检测到施工临时改道没有同步到地图，留给居民代表复核",
            impacted_results=["点位清单暂不更新，待居民代表复核"],
        )

        return notice

    def get_detour_unsynced_notices(self) -> List[ConstructionNotice]:
        return [
            n for n in self.repo.list_construction_notices()
            if n.temporary_detour and not n.map_updated
        ]

    def resident_review_detour(
        self,
        notice_id: str,
        approved: bool,
        review_note: str,
        operator: str,
        operator_role: UserRole = UserRole.RESIDENT_REP,
    ) -> ConstructionNotice:
        from models import ReviewStatus, RecordStatus

        notice = self.repo.get_construction_notice(notice_id)
        if not notice:
            raise ValueError(f"施工告示 {notice_id} 不存在")

        old_notice = notice.model_copy()

        if approved:
            notice.review_status = ReviewStatus.APPROVED_BY_RESIDENT
            notice.status = RecordStatus.CONFIRMED
            notice.map_updated = True
        else:
            notice.review_status = ReviewStatus.REJECTED_BY_RESIDENT
            notice.status = RecordStatus.REJECTED

        notice.resident_review_note = review_note
        notice.touch(operator)

        changes = self.audit.build_change_dict(old_notice, notice, [
            "review_status", "status", "map_updated", "resident_review_note"
        ])
        op_type = OperationType.RESIDENT_APPROVE if approved else OperationType.RESIDENT_REJECT
        self.audit.log_operation(
            operation_type=op_type,
            operator=operator,
            operator_role=operator_role,
            target_entity_type="ConstructionNotice",
            target_entity_id=notice.id,
            changes=changes,
            reason=f"居民代表复核施工改道未同步问题：{'通过' if approved else '驳回'}",
            impacted_results=["点位清单可更新" if approved else "点位清单暂不更新"],
        )

        return notice
