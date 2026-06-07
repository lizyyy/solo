import uuid
from datetime import datetime
from typing import List, Dict, Optional
from models import (
    ClaimRecord,
    WorkflowState,
    RecordSource,
    AuditLog,
    RecordStatus,
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

    def get_audit_trail(self, record_id: str) -> List[Dict]:
        record = self.service.get_record(record_id)
        return [
            {
                "log_id": log.log_id,
                "source": log.source.value,
                "source_text": self._get_source_text(log.source),
                "action": log.action,
                "action_text": self._get_action_text(log.action),
                "old_value": log.old_value,
                "new_value": log.new_value,
                "operator": log.operator,
                "timestamp": log.timestamp.isoformat(),
                "remark": log.remark,
            }
            for log in record.audit_logs
        ]

    def get_audit_trail_by_source(
        self, record_id: str, source: RecordSource
    ) -> List[Dict]:
        trail = self.get_audit_trail(record_id)
        return [t for t in trail if t["source"] == source.value]

    def _get_source_text(self, source: RecordSource) -> str:
        mapping = {
            RecordSource.SIGN_IN_PHOTO: "课时签到照片",
            RecordSource.TICKET_EXPORT: "票务导出表补录",
            RecordSource.MANUAL_CONFIRM: "人工确认",
        }
        return mapping.get(source, source.value)

    def _get_action_text(self, action: str) -> str:
        mapping = {
            "import_sign_in": "导入课时签到照片",
            "import_ticket": "导入票务导出表",
            "resolve_conflict": "解决冲突",
            "reject_record": "驳回记录",
            "generate_weekly_report": "生成周报",
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
        records = self.record_service.import_sign_in_photos(data_list, operator)
        workflow.current_records = [r.record_id for r in records]
        workflow.sign_in_photo_imported = True
        workflow.step = 2
        workflow.updated_at = datetime.now()

        return {
            "workflow_id": workflow.workflow_id,
            "step": workflow.step,
            "step_name": "第二步：补录票务导出表",
            "imported_count": len(records),
            "records": [self.data_access.get_record_detail(r.record_id) for r in records],
            "note": "同一首歌有现场名和版权名的记录标记为待复核，不归为正常",
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
        for record_id, ticket_data in ticket_mapping.items():
            if record_id in workflow.current_records:
                record = self.record_service.import_ticket_export(
                    record_id, ticket_data, operator
                )
                if record.conflicts:
                    conflicts_summary.append(
                        {
                            "record_id": record_id,
                            "conflicts": [
                                {
                                    "field": c.field_name,
                                    "sign_in_value": c.sign_in_value,
                                    "ticket_value": c.ticket_value,
                                    "description": c.description,
                                }
                                for c in record.conflicts
                            ],
                        }
                    )

        workflow.ticket_export_complemented = True
        workflow.step = 3
        workflow.updated_at = datetime.now()

        return {
            "workflow_id": workflow.workflow_id,
            "step": workflow.step,
            "step_name": "第三步：人工复核并生成周报",
            "conflicts_found": len(conflicts_summary),
            "conflicts_summary": conflicts_summary,
            "records": [
                self.data_access.get_record_detail(rid)
                for rid in workflow.current_records
            ],
            "note": "请音乐老师复核冲突记录，确认或驳回后生成周报",
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
                        f"记录 {record.record_id} 仍有未解决的冲突，请先处理"
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

        return {
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_records": total,
                "confirmed": confirmed,
                "normal": normal,
                "rejected": rejected,
                "pending_review": pending,
                "with_song_alias": with_alias,
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
