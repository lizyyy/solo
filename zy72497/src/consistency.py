import json
import csv
from typing import List, Dict, Any
from pathlib import Path
from io import StringIO

from .engine import ClearanceEngine
from .models import ProcessingStatus, AbnormalType, EvidenceSource


class SingleSourceOfTruth:
    def __init__(self, engine: ClearanceEngine):
        self.engine = engine

    def _get_consolidated_data(self) -> List[Dict[str, Any]]:
        return self.engine.export_consolidated()

    def _build_evidence_chain(self, record) -> Dict[str, Any]:
        complaint = record.complaint
        photo_evidence = []
        for p in record.photos:
            photo_evidence.append({
                "photo_id": p.photo_id,
                "scene_description": p.scene_description,
                "reviewed_by": p.reviewed_by,
                "reviewed_at": p.reviewed_at.isoformat(),
            })
        manual_changes_detail = []
        for c in complaint.manual_changes:
            manual_changes_detail.append(c)
        status_history = []
        for log in record.audit_logs:
            entry = {
                "timestamp": log.timestamp.isoformat(),
                "action": log.action,
                "operator": log.operator,
                "source": log.source.value,
            }
            if log.details:
                entry["details"] = log.details
            if log.snapshot_before:
                entry["snapshot_before"] = log.snapshot_before
            if log.snapshot_after:
                entry["snapshot_after"] = log.snapshot_after
            status_history.append(entry)
        return {
            "original_row_number": complaint.original_row_number,
            "raw_data": complaint.raw_data,
            "imported_by": complaint.imported_by,
            "manual_changes": manual_changes_detail,
            "photo_evidence": photo_evidence,
            "status_history": status_history,
        }

    def for_api(self, complaint_id: str = None) -> Any:
        if complaint_id:
            record = self.engine.get_record(complaint_id)
            if not record:
                return None
            base = record.to_dict()
            base["evidence_chain"] = self._build_evidence_chain(record)
            return base
        result = []
        for r in self.engine.get_all_records():
            base = r.to_dict()
            base["evidence_chain"] = self._build_evidence_chain(r)
            result.append(base)
        return result

    def for_page_display(self, status_filter: ProcessingStatus = None) -> List[Dict[str, Any]]:
        records = self.engine.get_all_records()
        if status_filter:
            records = [r for r in records if r.current_status == status_filter]
        result = []
        for r in records:
            result.append({
                "complaint_id": r.complaint_id,
                "location": r.complaint.location,
                "complaint_content": r.complaint.complaint_content,
                "current_status": r.current_status.value,
                "abnormal_type": r.abnormal_type.value if r.abnormal_type else None,
                "abnormal_note": r.abnormal_note,
                "original_row_number": r.complaint.original_row_number,
                "photo_count": len(r.photos),
                "photo_descriptions": [p.scene_description for p in r.photos],
                "manual_changes_count": len(r.complaint.manual_changes),
                "manual_changes_summary": [
                    f"{c['field']}: {c['old_value']} → {c['new_value']}"
                    for c in r.complaint.manual_changes
                ],
                "updated_at": r.updated_at.isoformat(),
                "confirmed_by": r.confirmed_by,
            })
        return result

    def for_export_csv(self, output_path: str = None) -> str:
        records = self._get_consolidated_data()
        fieldnames = [
            "complaint_id",
            "original_row_number",
            "location",
            "complaint_content",
            "current_status",
            "abnormal_type",
            "abnormal_note",
            "photo_count",
            "photo_descriptions",
            "confirmed_by",
            "confirmed_at",
            "created_at",
            "updated_at",
            "imported_by",
            "manual_changes_count",
            "manual_changes_detail",
            "raw_data",
            "status_history_count",
        ]

        output = StringIO() if not output_path else open(output_path, "w", encoding="utf-8-sig", newline="")
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()

        for r in records:
            manual_changes = r["complaint"].get("manual_changes", [])
            photo_descs = "; ".join(p.get("scene_description", "") for p in r.get("photos", []))
            changes_detail = "; ".join(
                f"{c['field']}:{c['old_value']}->{c['new_value']}(by {c.get('operator','?')})"
                for c in manual_changes
            )
            writer.writerow({
                "complaint_id": r["complaint_id"],
                "original_row_number": r["complaint"]["original_row_number"],
                "location": r["complaint"]["location"],
                "complaint_content": r["complaint"]["complaint_content"],
                "current_status": r["current_status"],
                "abnormal_type": r["abnormal_type"],
                "abnormal_note": r["abnormal_note"],
                "photo_count": len(r["photos"]),
                "photo_descriptions": photo_descs,
                "confirmed_by": r["confirmed_by"],
                "confirmed_at": r["confirmed_at"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
                "imported_by": r["complaint"]["imported_by"],
                "manual_changes_count": len(manual_changes),
                "manual_changes_detail": changes_detail,
                "raw_data": json.dumps(r["complaint"]["raw_data"], ensure_ascii=False),
                "status_history_count": len(r.get("audit_logs", [])),
            })

        if not output_path:
            return output.getvalue()
        output.close()
        return output_path

    def for_export_json(self, output_path: str = None) -> str:
        all_records = self.engine.get_all_records()
        enriched = []
        for r in all_records:
            base = r.to_dict()
            base["evidence_chain"] = self._build_evidence_chain(r)
            enriched.append(base)
        if output_path:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(enriched, f, ensure_ascii=False, indent=2)
            return output_path
        return json.dumps(enriched, ensure_ascii=False, indent=2)

    def for_summary(self) -> Dict[str, Any]:
        records = self.engine.get_all_records()
        status_counts = {}
        abnormal_counts = {}
        abnormal_records = []
        for r in records:
            status = r.current_status.value
            status_counts[status] = status_counts.get(status, 0) + 1
            if r.abnormal_type:
                ab = r.abnormal_type.value
                abnormal_counts[ab] = abnormal_counts.get(ab, 0) + 1
                abnormal_records.append({
                    "complaint_id": r.complaint_id,
                    "location": r.complaint.location,
                    "abnormal_type": ab,
                    "abnormal_note": r.abnormal_note,
                    "current_status": r.current_status.value,
                    "original_row_number": r.complaint.original_row_number,
                    "photo_descriptions": [p.scene_description for p in r.photos],
                    "manual_changes": r.complaint.manual_changes,
                    "trigger_evidence": r.complaint.raw_data,
                })
        pending_records = []
        for r in self.engine.get_records_by_status(ProcessingStatus.PENDING_REVIEW):
            pending_records.append({
                "complaint_id": r.complaint_id,
                "location": r.complaint.location,
                "abnormal_type": r.abnormal_type.value if r.abnormal_type else None,
                "abnormal_note": r.abnormal_note,
                "original_row_number": r.complaint.original_row_number,
                "trigger_complaint": r.complaint.complaint_content,
                "photo_descriptions": [p.scene_description for p in r.photos],
            })
        return {
            "total_records": len(records),
            "status_breakdown": status_counts,
            "abnormal_breakdown": abnormal_counts,
            "pending_review_count": len(pending_records),
            "abnormal_records_with_evidence": abnormal_records,
            "pending_review_records_with_evidence": pending_records,
        }

    def for_audit_trace(self, complaint_id: str) -> Dict[str, Any]:
        return self.engine.get_trace_by_source(complaint_id)
