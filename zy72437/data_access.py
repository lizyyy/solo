import uuid
from datetime import datetime
from typing import List, Dict, Optional
from models import (
    ClaimRecord,
    WorkflowState,
    RecordSource,
    AuditLog,
    RecordStatus,
    DuplicateType,
)
from service import ClaimRecordService


class UnifiedDataAccess:
    def __init__(self, service: ClaimRecordService):
        self.service = service

    def get_record_detail(self, record_id: str) -> Dict:
        record = self.service.get_record(record_id)
        return self.service._record_to_unified_dict(record)

    def get_record_list(self, status_filter: Optional[RecordStatus] = None) -> List[Dict]:
        records = self.service.get_all_records()
        if status_filter:
            records = [r for r in records if r.status == status_filter]
        return [self.service._record_to_unified_dict(r) for r in records]

    def get_export_data(self, record_ids: Optional[List[str]] = None) -> List[Dict]:
        if record_ids:
            records = [self.service.get_record(rid) for rid in record_ids]
        else:
            records = self.service.get_all_records()
        return [self.service._record_to_unified_dict(r) for r in records]

    def get_state_change_trail(self, record_id: str) -> List[Dict]:
        return self.service.get_state_change_trail(record_id)

    def get_audit_trail(self, record_id: str) -> List[Dict]:
        trail = self.service.get_state_change_trail(record_id)
        for item in trail:
            item["source_text"] = self._get_source_text_value(item["source"])
            item["action_text"] = self._get_action_text(item["action"])
        return trail

    def get_audit_trail_by_source(
        self, record_id: str, source: RecordSource
    ) -> List[Dict]:
        trail = self.get_audit_trail(record_id)
        return [t for t in trail if t["source"] == source.value]

    def get_remark_histories(self, record_id: str) -> List[Dict]:
        record = self.service.get_record(record_id)
        return [
            {
                "history_id": h.history_id,
                "source": h.source.value,
                "source_text": self._get_source_text_value(h.source.value),
                "remark_text": h.remark_text,
                "modified_by": h.modified_by,
                "modified_at": h.modified_at.isoformat(),
                "change_reason": h.change_reason,
            }
            for h in record.remark_histories
        ]

    def _get_source_text_value(self, source_val: str) -> str:
        mapping = {
            "sign_in_photo": "课时签到照片",
            "ticket_export": "票务导出表补录",
            "manual_confirm": "人工确认",
        }
        return mapping.get(source_val, source_val)

    def _get_action_text(self, action: str) -> str:
        mapping = {
            "import_sign_in": "导入课时签到照片",
            "import_ticket": "导入票务导出表",
            "resolve_conflict": "解决冲突",
            "reject_record": "驳回记录",
            "generate_weekly_report": "生成周报",
            "confirm_song_alias": "人工确认歌曲别名",
        }
        return mapping.get(action, action)


class WorkflowService:
    def __init__(self, record_service: ClaimRecordService):
        self.record_service = record_service
        self.workflows: Dict[str, WorkflowState] = {}
        self.data_access = UnifiedDataAccess(record_service)

    def _generate_id(self) -> str:
        return str(uuid.uuid4())

    def create_workflow(self) -> WorkflowState:
        workflow = WorkflowState(
            workflow_id=self._generate_id(),
            step=1,
        )
        self.workflows[workflow.workflow_id] = workflow
        return workflow

    def step1_import_sign_in_photos(
        self,
        workflow_id: str,
        data_list: List[Dict],
        operator: Optional[str] = None,
    ) -> Dict:
        workflow = self.workflows[workflow_id]
        import_result = self.record_service.import_sign_in_photos(data_list, operator)
        records = import_result["records"]
        workflow.current_records = [r.record_id for r in records]
        workflow.sign_in_photo_imported = True
        workflow.step = 2
        workflow.updated_at = datetime.now()

        summary = import_result["summary"]
        alias_records = [
            {
                "record_id": r.record_id,
                "student": r.student,
                "song_live_name": r.song_live_name,
                "song_copyright_name": r.song_copyright_name,
                "status": r.status.value,
                "duplicate_type": r.duplicate_type.value if r.duplicate_type else None,
            }
            for r in records
            if r.song_live_name
            and r.song_copyright_name
            and r.song_live_name != r.song_copyright_name
        ]

        return {
            "workflow_id": workflow.workflow_id,
            "step": workflow.step,
            "step_name": "第二步：补录票务导出表",
            "import_summary": summary,
            "duplicate_breakdown": {
                "new": summary["new_count"],
                "current_batch_duplicates": import_result["current_batch_duplicates"],
                "historical_duplicates": import_result["historical_duplicates"],
            },
            "song_alias_records_pending_review": alias_records,
            "records": [
                self.data_access.get_record_detail(r.record_id) for r in records
            ],
            "note": (
                "重要提示："
                f"{summary['song_alias_needs_review_count']} 条记录存在歌曲现场名/版权名不一致，"
                "已保留为待复核状态，不归为正常，留给许老师人工确认。"
            ),
        }

    def step2_complement_ticket_export(
        self,
        workflow_id: str,
        ticket_mapping: Dict[str, Dict],
        operator: Optional[str] = None,
    ) -> Dict:
        workflow = self.workflows[workflow_id]
        if not workflow.sign_in_photo_imported:
            raise ValueError("请先完成第一步：导入课时签到照片")

        conflicts_summary = []
        status_transitions = []
        still_pending_alias = []

        for record_id, ticket_data in ticket_mapping.items():
            if record_id in workflow.current_records:
                record_old = self.record_service.get_record(record_id)
                old_status = record_old.status.value
                record = self.record_service.import_ticket_export(
                    record_id, ticket_data, operator
                )
                new_status = record.status.value

                record_detail = self.data_access.get_record_detail(record_id)
                status_transitions.append(
                    {
                        "record_id": record_id,
                        "student": record.student,
                        "old_status": old_status,
                        "new_status": new_status,
                        "has_song_alias": record_detail["has_song_alias"],
                    }
                )

                if record.conflicts:
                    conflicts_summary.append(
                        {
                            "record_id": record_id,
                            "student": record.student,
                            "conflicts": [
                                {
                                    "conflict_id": c.conflict_id,
                                    "field": c.field_name,
                                    "sign_in_value": c.sign_in_value,
                                    "ticket_value": c.ticket_value,
                                    "description": c.description,
                                }
                                for c in record.conflicts
                            ],
                        }
                    )

                if (
                    record_detail["has_song_alias"]
                    and record.status == RecordStatus.PENDING_REVIEW
                ):
                    still_pending_alias.append(
                        {
                            "record_id": record_id,
                            "student": record.student,
                            "song_live_name": record.song_live_name,
                            "song_copyright_name": record.song_copyright_name,
                            "reason": "即使票务补录后仍保留待复核，需许老师确认现场名和版权名处理方式",
                        }
                    )

        workflow.ticket_export_complemented = True
        workflow.step = 3
        workflow.updated_at = datetime.now()

        return {
            "workflow_id": workflow.workflow_id,
            "step": workflow.step,
            "step_name": "第三步：人工复核并生成周报",
            "status_transitions": status_transitions,
            "conflicts_found": len(conflicts_summary),
            "conflicts_summary": conflicts_summary,
            "still_pending_song_alias_review": still_pending_alias,
            "records": [
                self.data_access.get_record_detail(rid)
                for rid in workflow.current_records
            ],
            "note": (
                f"共处理 {len(ticket_mapping)} 条票务补录。"
                f"{len(conflicts_summary)} 条有冲突已列证据。"
                f"{len(still_pending_alias)} 条仍有歌曲别名留待复核。"
                "请许老师确认或驳回后生成周报。"
            ),
        }

    def manually_confirm_song_alias(
        self,
        record_id: str,
        operator: str,
        confirm_live_name_as_official: bool,
        decision_note: str,
    ) -> Dict:
        record = self.record_service.get_record(record_id)
        old_record = self.record_service._record_to_dict(record)
        old_status = record.status.value

        if not (
            record.song_live_name
            and record.song_copyright_name
            and record.song_live_name != record.song_copyright_name
        ):
            return {
                "record_id": record_id,
                "error": "该记录不存在歌曲别名待确认",
            }

        if confirm_live_name_as_official:
            record.song_copyright_name = record.song_live_name
            final_name = record.song_live_name
            decision = "确认以现场名为最终名称，版权名同步为现场名"
        else:
            record.song_live_name = record.song_copyright_name
            final_name = record.song_copyright_name
            decision = "确认以版权名为最终名称，现场名同步为版权名"

        record.status = RecordStatus.CONFIRMED
        record.calculation_meta = self.record_service.param_version
        record.calculation_meta = __import__("models").CalculationMeta(
            param_version=self.record_service.param_version,
            decision_reason=(
                f"人工确认别名处理: {decision}。"
                f"原因: {decision_note}。操作人: {operator}。"
                f"最终歌曲名: '{final_name}'。"
            ),
        )
        record.updated_at = datetime.now()

        from models import CalculationMeta
        record.calculation_meta = CalculationMeta(
            param_version=self.record_service.param_version,
            decision_reason=(
                f"人工确认别名处理: {decision}。"
                f"原因: {decision_note}。操作人: {operator}。"
                f"最终歌曲名: '{final_name}'。"
            ),
        )

        self.record_service._add_audit_log(
            record,
            RecordSource.MANUAL_CONFIRM,
            "confirm_song_alias",
            old_value=old_record,
            new_value=self.record_service._record_to_dict(record),
            operator=operator,
            remark=(
                f"人工确认歌曲别名: {decision}。"
                f"状态变化: [{old_status} -> {record.status.value}]。"
                f"原因: {decision_note}"
            ),
        )

        self.record_service._add_remark_history(
            record,
            RecordSource.MANUAL_CONFIRM,
            f"别名确认说明: {decision_note}",
            modified_by=operator,
            change_reason=decision,
        )

        return {
            "record_id": record_id,
            "student": record.student,
            "old_status": old_status,
            "new_status": record.status.value,
            "final_song_name": final_name,
            "decision": decision,
            "note": decision_note,
            "detail": self.data_access.get_record_detail(record_id),
        }

    def step3_generate_weekly_report(
        self,
        workflow_id: str,
        operator: Optional[str] = None,
    ) -> Dict:
        workflow = self.workflows[workflow_id]
        if not workflow.ticket_export_complemented:
            raise ValueError("请先完成第二步：补录票务导出表")

        records = [
            self.record_service.get_record(rid) for rid in workflow.current_records
        ]

        for record in records:
            if record.status == RecordStatus.CONFLICT:
                unresolved = [c for c in record.conflicts if not c.resolved]
                if unresolved:
                    raise ValueError(
                        f"记录 {record.record_id} ({record.student}) 仍有未解决的冲突，请先处理"
                    )

        still_pending_alias = [
            r
            for r in records
            if r.status == RecordStatus.PENDING_REVIEW
            and r.song_live_name
            and r.song_copyright_name
            and r.song_live_name != r.song_copyright_name
        ]
        if still_pending_alias:
            raise ValueError(
                f"仍有 {len(still_pending_alias)} 条歌曲别名记录待许老师复核，"
                "请先对以下记录逐一确认后再生成周报: "
                + ", ".join(
                    f"{r.student}({r.record_id[:8]})"
                    for r in still_pending_alias
                )
            )

        for record in records:
            record.weekly_report_generated = True
            record.updated_at = datetime.now()
            self._add_report_audit_log(record, operator)

        workflow.weekly_report_updated = True
        workflow.step = 4
        workflow.updated_at = datetime.now()

        report_data = self._build_weekly_report(records)

        return {
            "workflow_id": workflow.workflow_id,
            "step": workflow.step,
            "step_name": "已完成",
            "weekly_report": report_data,
            "records": [
                self.data_access.get_record_detail(rid)
                for rid in workflow.current_records
            ],
        }

    def _add_report_audit_log(self, record: ClaimRecord, operator: Optional[str]):
        log = AuditLog(
            log_id=self._generate_id(),
            record_id=record.record_id,
            source=RecordSource.MANUAL_CONFIRM,
            action="generate_weekly_report",
            old_value={"weekly_report_generated": False},
            new_value={"weekly_report_generated": True},
            operator=operator,
            remark="生成店长周报",
        )
        record.audit_logs.append(log)

    def _build_weekly_report(self, records: List[ClaimRecord]) -> Dict:
        total = len(records)
        confirmed = sum(1 for r in records if r.status == RecordStatus.CONFIRMED)
        normal = sum(1 for r in records if r.status == RecordStatus.NORMAL)
        rejected = sum(1 for r in records if r.status == RecordStatus.REJECTED)
        pending = sum(1 for r in records if r.status == RecordStatus.PENDING_REVIEW)
        with_alias = sum(
            1
            for r in records
            if r.song_live_name
            and r.song_copyright_name
            and r.song_live_name != r.song_copyright_name
        )
        duplicate_mark = {
            "new": sum(
                1 for r in records
                if r.duplicate_type == DuplicateType.NEW
            ),
            "current_batch_duplicate": sum(
                1 for r in records
                if r.duplicate_type == DuplicateType.CURRENT_BATCH_DUPLICATE
            ),
            "historical_duplicate": sum(
                1 for r in records
                if r.duplicate_type == DuplicateType.HISTORICAL_DUPLICATE
            ),
        }

        return {
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_records": total,
                "confirmed": confirmed,
                "normal": normal,
                "rejected": rejected,
                "pending_review": pending,
                "with_song_alias": with_alias,
                "duplicate_breakdown": duplicate_mark,
            },
            "details": [self.record_service._record_to_unified_dict(r) for r in records],
        }

    def get_workflow_status(self, workflow_id: str) -> Dict:
        workflow = self.workflows[workflow_id]
        return {
            "workflow_id": workflow.workflow_id,
            "step": workflow.step,
            "step_names": {
                1: "导入课时签到照片",
                2: "补录票务导出表",
                3: "人工复核并生成周报",
                4: "已完成",
            },
            "sign_in_photo_imported": workflow.sign_in_photo_imported,
            "ticket_export_complemented": workflow.ticket_export_complemented,
            "weekly_report_updated": workflow.weekly_report_updated,
            "record_count": len(workflow.current_records),
            "created_at": workflow.created_at.isoformat(),
            "updated_at": workflow.updated_at.isoformat(),
        }
