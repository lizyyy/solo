from typing import List, Dict, Any, Optional
from data_models import RoyaltyRecord, RecordStatus
from core_engine import RoyaltyEngine
import json
import csv
from io import StringIO


class UnifiedDataLayer:
    def __init__(self, engine: RoyaltyEngine):
        self.engine = engine

    def get_record(self, record_id: str, include_audit: bool = True) -> Optional[Dict[str, Any]]:
        if record_id in self.engine.records:
            return self.engine.records[record_id].to_dict(include_audit=include_audit)
        return None

    def get_all_records(self, status_filter: Optional[RecordStatus] = None,
                       include_audit: bool = False) -> List[Dict[str, Any]]:
        records = self.engine.records.values()
        if status_filter:
            records = [r for r in records if r.status == status_filter]
        return [r.to_dict(include_audit=include_audit) for r in records]

    def get_page_view(self, page: int = 1, page_size: int = 20,
                      status_filter: Optional[RecordStatus] = None) -> Dict[str, Any]:
        all_data = self.get_all_records(status_filter=status_filter)
        total = len(all_data)
        start = (page - 1) * page_size
        end = start + page_size
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "data": all_data[start:end],
            "source": "unified_data_source"
        }

    def get_api_response(self, record_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        if record_ids:
            data = [self.get_record(rid, include_audit=False) for rid in record_ids if rid in self.engine.records]
        else:
            data = self.get_all_records(include_audit=False)
        return {
            "code": 0,
            "message": "success",
            "data": data,
            "source": "unified_data_source",
            "timestamp": __import__("datetime").datetime.now().isoformat()
        }

    def export_csv(self, status_filter: Optional[RecordStatus] = None) -> str:
        records = self.get_all_records(status_filter=status_filter, include_audit=False)
        if not records:
            return ""
        output = StringIO()
        fieldnames = [
            "record_id", "source_row", "musician_name", "song_title",
            "authorized_cities", "play_count", "verified_count",
            "royalty_amount", "contract_note", "status", "import_batch"
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for r in records:
            row = {k: r.get(k, "") for k in fieldnames}
            row["authorized_cities"] = "、".join(r.get("authorized_cities", []))
            writer.writerow(row)
        return output.getvalue()

    def export_json(self, status_filter: Optional[RecordStatus] = None) -> str:
        data = {
            "source": "unified_data_source",
            "export_time": __import__("datetime").datetime.now().isoformat(),
            "records": self.get_all_records(status_filter=status_filter, include_audit=True)
        }
        return json.dumps(data, ensure_ascii=False, indent=2)

    def get_audit_trail(self, record_id: str) -> List[Dict[str, Any]]:
        if record_id not in self.engine.records:
            return []
        record = self.engine.records[record_id]
        trail = []
        for log in record.audit_logs:
            trail.append({
                "log_id": log.log_id,
                "timestamp": log.timestamp.isoformat(),
                "operator": log.operator,
                "change_type": log.change_type.value,
                "field_name": log.field_name,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "note": log.note,
                "source_row": record.source_row
            })
        return trail

    def get_full_audit_report(self) -> Dict[str, Any]:
        report = {
            "summary": {
                "total_records": len(self.engine.records),
                "total_batches": len(self.engine.batches),
                "total_audit_logs": sum(len(r.audit_logs) for r in self.engine.records.values())
            },
            "record_audit_index": [
                {
                    "record_id": rid,
                    "source_row": r.source_row,
                    "musician": r.musician_name,
                    "song": r.song_title,
                    "status": r.status.value,
                    "audit_count": len(r.audit_logs),
                    "last_updated": r.updated_at.isoformat()
                }
                for rid, r in self.engine.records.items()
            ]
        }
        return report
