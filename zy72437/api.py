import csv
import io
import json
from typing import List, Optional, Dict
from models import RecordStatus, RecordSource
from service import ClaimRecordService
from data_access import UnifiedDataAccess, WorkflowService


class ExportService:
    def __init__(self, data_access: UnifiedDataAccess):
        self.data_access = data_access

    def export_to_csv(self, record_ids: Optional[List[str]] = None) -> str:
        data = self.data_access.get_export_data(record_ids)

        output = io.StringIO()
        fieldnames = [
            "record_id",
            "lesson_date",
            "teacher",
            "student",
            "song_live_name",
            "song_copyright_name",
            "attendance_count",
            "raw_remark",
            "ticket_remark",
            "duplicate_type",
            "duplicate_type_text",
            "has_song_alias",
            "status",
            "status_text",
            "has_conflicts",
            "conflict_count",
            "ticket_imported",
            "weekly_report_generated",
            "param_version",
            "decision_reason",
        ]

        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()

        for row in data:
            calc_meta = row.get("calculation_meta", {})
            writer.writerow(
                {
                    "record_id": row.get("record_id", ""),
                    "lesson_date": row.get("lesson_date", ""),
                    "teacher": row.get("teacher", ""),
                    "student": row.get("student", ""),
                    "song_live_name": row.get("song_live_name", ""),
                    "song_copyright_name": row.get("song_copyright_name", ""),
                    "attendance_count": row.get("attendance_count", ""),
                    "raw_remark": row.get("raw_remark", ""),
                    "ticket_remark": row.get("ticket_remark", ""),
                    "duplicate_type": row.get("duplicate_type", ""),
                    "duplicate_type_text": row.get("duplicate_type_text", ""),
                    "has_song_alias": row.get("has_song_alias", ""),
                    "status": row.get("status", ""),
                    "status_text": row.get("status_text", ""),
                    "has_conflicts": row.get("has_conflicts", ""),
                    "conflict_count": row.get("conflict_count", ""),
                    "ticket_imported": row.get("ticket_imported", ""),
                    "weekly_report_generated": row.get("weekly_report_generated", ""),
                    "param_version": calc_meta.get("param_version", ""),
                    "decision_reason": calc_meta.get("decision_reason", ""),
                }
            )

        return output.getvalue()

    def export_conflicts_to_csv(self, record_ids: Optional[List[str]] = None) -> str:
        data = self.data_access.get_export_data(record_ids)

        output = io.StringIO()
        fieldnames = [
            "record_id",
            "lesson_date",
            "teacher",
            "student",
            "conflict_id",
            "conflict_type",
            "field_name",
            "sign_in_value",
            "ticket_value",
            "description",
            "resolved",
            "resolution",
        ]

        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()

        for row in data:
            for conflict in row.get("conflicts", []):
                writer.writerow(
                    {
                        "record_id": row.get("record_id", ""),
                        "lesson_date": row.get("lesson_date", ""),
                        "teacher": row.get("teacher", ""),
                        "student": row.get("student", ""),
                        "conflict_id": conflict.get("conflict_id", ""),
                        "conflict_type": conflict.get("conflict_type", ""),
                        "field_name": conflict.get("field_name", ""),
                        "sign_in_value": conflict.get("sign_in_value", ""),
                        "ticket_value": conflict.get("ticket_value", ""),
                        "description": conflict.get("description", ""),
                        "resolved": conflict.get("resolved", ""),
                        "resolution": conflict.get("resolution", ""),
                    }
                )

        return output.getvalue()

    def export_audit_trail_to_csv(self, record_id: str) -> str:
        trail = self.data_access.get_audit_trail(record_id)

        output = io.StringIO()
        fieldnames = [
            "log_id",
            "source",
            "source_text",
            "action",
            "action_text",
            "operator",
            "timestamp",
            "remark",
            "old_value",
            "new_value",
        ]

        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()

        for row in trail:
            writer.writerow(
                {
                    "log_id": row.get("log_id", ""),
                    "source": row.get("source", ""),
                    "source_text": row.get("source_text", ""),
                    "action": row.get("action", ""),
                    "action_text": row.get("action_text", ""),
                    "operator": row.get("operator", ""),
                    "timestamp": row.get("timestamp", ""),
                    "remark": row.get("remark", ""),
                    "old_value": json.dumps(row.get("old_value"), ensure_ascii=False)
                    if row.get("old_value")
                    else "",
                    "new_value": json.dumps(row.get("new_value"), ensure_ascii=False)
                    if row.get("new_value")
                    else "",
                }
            )

        return output.getvalue()


class APIHandler:
    def __init__(self):
        self.record_service = ClaimRecordService()
        self.data_access = UnifiedDataAccess(self.record_service)
        self.workflow_service = WorkflowService(self.record_service)
        self.export_service = ExportService(self.data_access)

    def create_workflow(self) -> Dict:
        workflow = self.workflow_service.create_workflow()
        return {"workflow_id": workflow.workflow_id, "step": 1}

    def workflow_step1(self, workflow_id: str, data: Dict) -> Dict:
        return self.workflow_service.step1_import_sign_in_photos(
            workflow_id, data.get("records", []), data.get("operator")
        )

    def workflow_step2(self, workflow_id: str, data: Dict) -> Dict:
        return self.workflow_service.step2_complement_ticket_export(
            workflow_id, data.get("ticket_mapping", {}), data.get("operator")
        )

    def workflow_step3(self, workflow_id: str, data: Dict) -> Dict:
        return self.workflow_service.step3_generate_weekly_report(
            workflow_id, data.get("operator")
        )

    def resolve_conflict(self, record_id: str, data: Dict) -> Dict:
        record = self.record_service.resolve_conflict(
            record_id=record_id,
            conflict_id=data["conflict_id"],
            resolution=data["resolution"],
            operator=data["operator"],
            use_sign_in_value=data.get("use_sign_in_value", True),
        )
        return self.data_access.get_record_detail(record.record_id)

    def reject_record(self, record_id: str, data: Dict) -> Dict:
        record = self.record_service.reject_record(
            record_id=record_id,
            reason=data["reason"],
            operator=data["operator"],
        )
        return self.data_access.get_record_detail(record.record_id)

    def confirm_song_alias(self, record_id: str, data: Dict) -> Dict:
        return self.workflow_service.manually_confirm_song_alias(
            record_id=record_id,
            operator=data["operator"],
            confirm_live_name_as_official=data.get("confirm_live_name_as_official", True),
            decision_note=data["decision_note"],
        )

    def get_state_change_trail(self, record_id: str) -> Dict:
        trail = self.data_access.get_state_change_trail(record_id)
        return {
            "record_id": record_id,
            "count": len(trail),
            "trail": trail,
        }

    def get_remark_histories(self, record_id: str) -> Dict:
        histories = self.data_access.get_remark_histories(record_id)
        return {
            "record_id": record_id,
            "count": len(histories),
            "remark_histories": histories,
        }

    def get_record(self, record_id: str) -> Dict:
        return self.data_access.get_record_detail(record_id)

    def list_records(self, status: Optional[str] = None) -> Dict:
        status_filter = RecordStatus(status) if status else None
        records = self.data_access.get_record_list(status_filter)
        return {"count": len(records), "records": records}

    def get_audit_trail(self, record_id: str, source: Optional[str] = None) -> Dict:
        if source:
            trail = self.data_access.get_audit_trail_by_source(
                record_id, RecordSource(source)
            )
        else:
            trail = self.data_access.get_audit_trail(record_id)
        return {"record_id": record_id, "count": len(trail), "audit_trail": trail}

    def run_self_check(self, record_id: Optional[str] = None) -> Dict:
        results = self.record_service.run_self_check(record_id)
        return {
            "check_count": len(results),
            "passed_count": sum(1 for r in results if r.passed),
            "failed_count": sum(1 for r in results if not r.passed),
            "results": [
                {
                    "check_id": r.check_id,
                    "check_type": r.check_type.value,
                    "passed": r.passed,
                    "message": r.message,
                    "details": r.details,
                    "checked_at": r.checked_at.isoformat(),
                }
                for r in results
            ],
        }

    def export_records_csv(self, record_ids: Optional[List[str]] = None) -> str:
        return self.export_service.export_to_csv(record_ids)

    def export_conflicts_csv(self, record_ids: Optional[List[str]] = None) -> str:
        return self.export_service.export_conflicts_to_csv(record_ids)

    def export_audit_csv(self, record_id: str) -> str:
        return self.export_service.export_audit_trail_to_csv(record_id)

    def get_workflow_status(self, workflow_id: str) -> Dict:
        return self.workflow_service.get_workflow_status(workflow_id)
