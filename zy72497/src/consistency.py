import json
import csv
from typing import List, Dict, Any
from pathlib import Path
from io import StringIO

from .engine import ClearanceEngine
from .models import ProcessingStatus, AbnormalType


class SingleSourceOfTruth:
    def __init__(self, engine: ClearanceEngine):
        self.engine = engine

    def _get_consolidated_data(self) -> List[Dict[str, Any]]:
        return self.engine.export_consolidated()

    def for_api(self, complaint_id: str = None) -> Any:
        if complaint_id:
            record = self.engine.get_record(complaint_id)
            return record.to_dict() if record else None
        return self._get_consolidated_data()

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
            "confirmed_by",
            "confirmed_at",
            "created_at",
            "updated_at",
            "imported_by",
            "manual_changes_count",
        ]

        output = StringIO() if not output_path else open(output_path, "w", encoding="utf-8-sig", newline="")
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()

        for r in records:
            writer.writerow({
                "complaint_id": r["complaint_id"],
                "original_row_number": r["complaint"]["original_row_number"],
                "location": r["complaint"]["location"],
                "complaint_content": r["complaint"]["complaint_content"],
                "current_status": r["current_status"],
                "abnormal_type": r["abnormal_type"],
                "abnormal_note": r["abnormal_note"],
                "photo_count": len(r["photos"]),
                "confirmed_by": r["confirmed_by"],
                "confirmed_at": r["confirmed_at"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
                "imported_by": r["complaint"]["imported_by"],
                "manual_changes_count": len(r["complaint"]["manual_changes"]),
            })

        if not output_path:
            return output.getvalue()
        output.close()
        return output_path

    def for_export_json(self, output_path: str = None) -> str:
        data = self._get_consolidated_data()
        if output_path:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return output_path
        return json.dumps(data, ensure_ascii=False, indent=2)

    def for_summary(self) -> Dict[str, Any]:
        records = self.engine.get_all_records()
        status_counts = {}
        abnormal_counts = {}
        for r in records:
            status = r.current_status.value
            status_counts[status] = status_counts.get(status, 0) + 1
            if r.abnormal_type:
                ab = r.abnormal_type.value
                abnormal_counts[ab] = abnormal_counts.get(ab, 0) + 1
        return {
            "total_records": len(records),
            "status_breakdown": status_counts,
            "abnormal_breakdown": abnormal_counts,
            "pending_review_count": len(self.engine.get_records_by_status(ProcessingStatus.PENDING_REVIEW)),
        }

    def for_audit_trace(self, complaint_id: str) -> Dict[str, Any]:
        return self.engine.get_trace_by_source(complaint_id)
