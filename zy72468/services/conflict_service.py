from typing import List, Dict, Any, Optional
from models import (
    ConstructionNotice,
    RampRecord,
    ConflictRecord,
    ConflictEvidence,
    ConflictStatus,
    RecordStatus,
    UserRole,
    OperationType,
)
from .data_repository import DataRepository
from .audit_service import AuditService


class ConflictService:
    def __init__(self, repository: DataRepository, audit_service: AuditService):
        self.repo = repository
        self.audit = audit_service

    def detect_conflicts(self, notice_id: str, operator: str) -> List[ConflictRecord]:
        notice = self.repo.get_construction_notice(notice_id)
        if not notice:
            raise ValueError(f"施工告示 {notice_id} 不存在")

        ramps = self.repo.get_ramps_by_notice_id(notice_id)
        conflicts = []

        for ramp in ramps:
            evidences = self._compare_notice_and_ramp(notice, ramp)
            if evidences:
                existing_conflicts = self.repo.get_conflicts_by_notice_id(notice_id)
                existing = next(
                    (c for c in existing_conflicts if c.ramp_record_id == ramp.id),
                    None
                )
                if not existing:
                    conflict = ConflictRecord(
                        created_by=operator,
                        updated_by=operator,
                        construction_notice_id=notice_id,
                        ramp_record_id=ramp.id,
                        evidences=evidences,
                        status=ConflictStatus.PENDING,
                    )
                    self.repo.add_conflict_record(conflict)
                    notice.conflict_ids.append(conflict.id)
                    ramp.conflict_ids.append(conflict.id)
                    notice.status = RecordStatus.CONFLICT_DETECTED
                    notice.touch(operator)
                    ramp.touch(operator)

                    self.audit.log_operation(
                        operation_type=OperationType.DETECT_CONFLICT,
                        operator=operator,
                        operator_role=UserRole.PLANNER,
                        target_entity_type="ConflictRecord",
                        target_entity_id=conflict.id,
                        changes={
                            "evidences": {"old": [], "new": [e.model_dump() for e in evidences]}
                        },
                        reason=f"施工告示 {notice.notice_no} 与坡道记录存在矛盾",
                        impacted_results=[
                            f"施工告示 {notice_id} 状态变更为冲突待处理",
                            f"坡道记录 {ramp.id} 标记为有冲突"
                        ],
                    )
                    conflicts.append(conflict)
                else:
                    conflicts.append(existing)

        return conflicts

    def _compare_notice_and_ramp(
        self, notice: ConstructionNotice, ramp: RampRecord
    ) -> List[ConflictEvidence]:
        evidences = []

        if notice.construction_location != ramp.ramp_location:
            evidences.append(ConflictEvidence(
                created_by="system",
                updated_by="system",
                field_name="location",
                notice_value=notice.construction_location,
                ramp_value=ramp.ramp_location,
                description="施工地点与坡道记录地点不一致",
            ))

        if notice.temporary_detour and ramp.accessible:
            evidences.append(ConflictEvidence(
                created_by="system",
                updated_by="system",
                field_name="accessibility",
                notice_value="施工改道，可能影响通行",
                ramp_value=ramp.accessible,
                description="施工告示标注临时改道，但坡道记录显示无障碍通行",
            ))

        if not notice.temporary_detour and not ramp.accessible:
            evidences.append(ConflictEvidence(
                created_by="system",
                updated_by="system",
                field_name="accessibility",
                notice_value="无临时改道",
                ramp_value="无障碍通行不可用",
                description="施工告示无改道标注，但坡道记录显示无障碍不可用",
            ))

        return evidences

    def get_pending_conflicts(self) -> List[ConflictRecord]:
        return [
            c for c in self.repo.list_conflict_records()
            if c.status == ConflictStatus.PENDING
        ]

    def planner_resolve_conflict(
        self,
        conflict_id: str,
        confirmed: bool,
        planner_note: str,
        operator: str,
    ) -> ConflictRecord:
        conflict = self.repo.get_conflict_record(conflict_id)
        if not conflict:
            raise ValueError(f"冲突记录 {conflict_id} 不存在")

        old_conflict = conflict.model_copy()

        if confirmed:
            conflict.status = ConflictStatus.CONFIRMED_BY_PLANNER
            conflict.planner_decision = "confirmed"
        else:
            conflict.status = ConflictStatus.REJECTED_BY_PLANNER
            conflict.planner_decision = "rejected"

        conflict.planner_note = planner_note
        conflict.resolved_by = operator
        conflict.resolved_at = conflict.updated_at.isoformat()
        conflict.touch(operator)

        notice = self.repo.get_construction_notice(conflict.construction_notice_id)
        ramp = self.repo.get_ramp_record(conflict.ramp_record_id)

        op_type = OperationType.PLANNER_CONFIRM if confirmed else OperationType.PLANNER_REJECT
        changes = self.audit.build_change_dict(old_conflict, conflict, [
            "status", "planner_decision", "planner_note", "resolved_by"
        ])
        self.audit.log_operation(
            operation_type=op_type,
            operator=operator,
            operator_role=UserRole.PLANNER,
            target_entity_type="ConflictRecord",
            target_entity_id=conflict.id,
            changes=changes,
            reason=f"街道规划员小姜{'确认' if confirmed else '驳回'}冲突：{planner_note}",
            impacted_results=[
                f"施工告示 {conflict.construction_notice_id} 冲突已处理",
                f"坡道记录 {conflict.ramp_record_id} 冲突已处理"
            ],
        )

        if notice:
            notice_pending = [
                cid for cid in notice.conflict_ids
                if self.repo.get_conflict_record(cid) and self.repo.get_conflict_record(cid).status == ConflictStatus.PENDING
            ]
            if not notice_pending:
                old_notice = notice.model_copy()
                notice.status = RecordStatus.SUPPLEMENTED
                notice.touch(operator)
                self.audit.log_operation(
                    operation_type=OperationType.PLANNER_CONFIRM if confirmed else OperationType.PLANNER_REJECT,
                    operator=operator,
                    operator_role=UserRole.PLANNER,
                    target_entity_type="ConstructionNotice",
                    target_entity_id=notice.id,
                    changes=self.audit.build_change_dict(old_notice, notice, ["status"]),
                    reason="所有冲突已处理，状态更新",
                    impacted_results=["点位清单可更新"],
                )

        return conflict

    def get_conflict_evidences(self, conflict_id: str) -> List[Dict[str, Any]]:
        conflict = self.repo.get_conflict_record(conflict_id)
        if not conflict:
            raise ValueError(f"冲突记录 {conflict_id} 不存在")

        return [e.model_dump() for e in conflict.evidences]
