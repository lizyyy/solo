from __future__ import annotations

import json
import os
import pickle
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
import pandas as pd

from .models import ResampleSession, ResampleRecord, RecordStatus


class DataStore:
    def __init__(self, base_dir: str = "./data"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.sessions_dir = self.base_dir / "sessions"
        self.sessions_dir.mkdir(exist_ok=True)
        self.exports_dir = self.base_dir / "exports"
        self.exports_dir.mkdir(exist_ok=True)

    def _get_session_path(self, session_id: str) -> Path:
        return self.sessions_dir / f"{session_id}.json"

    def save_session(self, session: ResampleSession) -> None:
        session_path = self._get_session_path(session.session_id)
        with open(session_path, "w", encoding="utf-8") as f:
            json.dump(session.model_dump(mode="json"), f, ensure_ascii=False, indent=2)

    def load_session(self, session_id: str) -> ResampleSession:
        session_path = self._get_session_path(session_id)
        if not session_path.exists():
            raise FileNotFoundError(f"Session {session_id} not found")
        with open(session_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return ResampleSession.model_validate(data)

    def list_sessions(self) -> List[Dict[str, Any]]:
        sessions = []
        for f in self.sessions_dir.glob("*.json"):
            try:
                with open(f, "r", encoding="utf-8") as fp:
                    data = json.load(fp)
                sessions.append({
                    "session_id": data["session_id"],
                    "created_at": data["created_at"],
                    "created_by": data["created_by"],
                    "record_count": len(data["records"]),
                })
            except Exception:
                continue
        return sorted(sessions, key=lambda x: x["created_at"], reverse=True)

    def get_session_summary(self, session_id: str) -> Dict[str, Any]:
        session = self.load_session(session_id)
        status_counts = {}
        for rec in session.records:
            status = rec.current_status.value
            status_counts[status] = status_counts.get(status, 0) + 1

        suspicious = [
            rec for rec in session.records
            if rec.snapshot.used_default_score and rec.snapshot.has_missing_features
        ]

        return {
            "session_id": session.session_id,
            "created_at": session.created_at.isoformat() if isinstance(session.created_at, datetime) else session.created_at,
            "created_by": session.created_by,
            "total_records": len(session.records),
            "status_distribution": status_counts,
            "suspicious_default_score_count": len(suspicious),
            "summary_stats": session.summary_stats,
        }

    def export_records_to_dataframe(
        self,
        session_id: str,
        status_filter: Optional[List[RecordStatus]] = None,
        include_audit: bool = False,
    ) -> pd.DataFrame:
        session = self.load_session(session_id)
        records = session.records

        if status_filter:
            records = [r for r in records if r.current_status in status_filter]

        rows = []
        for rec in records:
            row = {
                "record_id": rec.record_id,
                "snapshot_id": rec.snapshot.snapshot_id,
                "original_line_number": rec.snapshot.original_line_number,
                "current_status": rec.current_status.value,
                "model_score": rec.snapshot.model_score,
                "true_label": rec.snapshot.true_label,
                "has_missing_features": rec.snapshot.has_missing_features,
                "missing_features": ",".join(rec.snapshot.missing_features),
                "used_default_score": rec.snapshot.used_default_score,
                "default_score_reason": rec.snapshot.default_score_reason,
                "final_weight": rec.final_weight,
                "ayue_review_note": rec.ayue_review_note,
                "explanation_summary": rec.explanation_summary,
                "manual_edits": json.dumps(rec.manual_edits, ensure_ascii=False),
                "audit_log_count": len(rec.audit_log),
            }
            for k, v in rec.snapshot.raw_data.items():
                row[f"raw_{k}"] = v
            rows.append(row)

        return pd.DataFrame(rows)

    def export_to_csv(
        self,
        session_id: str,
        output_path: Optional[str] = None,
        status_filter: Optional[List[RecordStatus]] = None,
    ) -> str:
        df = self.export_records_to_dataframe(session_id, status_filter)
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = str(self.exports_dir / f"resample_{session_id}_{timestamp}.csv")
        df.to_csv(output_path, index=False, encoding="utf-8-sig")
        return output_path

    def get_record_detail(self, session_id: str, record_id: str) -> Optional[ResampleRecord]:
        session = self.load_session(session_id)
        for rec in session.records:
            if rec.record_id == record_id:
                return rec
        return None

    def update_record(self, session_id: str, record: ResampleRecord) -> None:
        session = self.load_session(session_id)
        for i, rec in enumerate(session.records):
            if rec.record_id == record.record_id:
                session.records[i] = record
                break
        self.save_session(session)
