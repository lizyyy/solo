import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional
from .models import ScreeningSession, SampleRecord, ModelOutput, ManualCorrection, ReviewNote


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def datetime_decoder(dct):
    for key, value in dct.items():
        if isinstance(value, str) and ("time" in key or "at" in key):
            try:
                dct[key] = datetime.fromisoformat(value)
            except (ValueError, TypeError):
                pass
    return dct


class Storage:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        self.sessions_dir = self.data_dir / "sessions"
        self.sessions_dir.mkdir(exist_ok=True)
        self.exports_dir = self.data_dir / "exports"
        self.exports_dir.mkdir(exist_ok=True)

    def save_session(self, session: ScreeningSession) -> None:
        session_path = self.sessions_dir / f"{session.session_id}.json"
        data = {
            "session_id": session.session_id,
            "created_at": session.created_at,
            "run_commands": session.run_commands,
            "samples": {}
        }
        for sample_id, sample in session.samples.items():
            data["samples"][sample_id] = {
                "sample_id": sample.sample_id,
                "first_import_time": sample.first_import_time,
                "status": sample.status,
                "next_action": sample.next_action.value if sample.next_action else None,
                "missing_materials": sample.missing_materials,
                "keep_reason": sample.keep_reason,
                "version_conflict": sample.version_conflict,
                "latest_model_version": sample.latest_model_version,
                "rerun_count": sample.rerun_count,
                "model_outputs": [
                    {
                        "sample_id": o.sample_id,
                        "model_version": o.model_version,
                        "conclusion": o.conclusion,
                        "confidence": o.confidence,
                        "output_time": o.output_time,
                        "raw_fragment": o.raw_fragment
                    } for o in sample.model_outputs
                ],
                "manual_corrections": [
                    {
                        "sample_id": c.sample_id,
                        "corrected_by": c.corrected_by,
                        "corrected_conclusion": c.corrected_conclusion,
                        "correction_time": c.correction_time,
                        "reason": c.reason,
                        "source": c.source
                    } for c in sample.manual_corrections
                ],
                "review_notes": [
                    {
                        "sample_id": n.sample_id,
                        "reviewer": n.reviewer,
                        "note": n.note,
                        "note_time": n.note_time,
                        "tag": n.tag
                    } for n in sample.review_notes
                ]
            }
        with open(session_path, "w", encoding="utf-8") as f:
            json.dump(data, f, cls=DateTimeEncoder, ensure_ascii=False, indent=2)

    def load_session(self, session_id: str) -> Optional[ScreeningSession]:
        session_path = self.sessions_dir / f"{session_id}.json"
        if not session_path.exists():
            return None
        with open(session_path, "r", encoding="utf-8") as f:
            data = json.load(f, object_hook=datetime_decoder)
        from .models import SampleStatus, NextAction
        session = ScreeningSession(
            session_id=data["session_id"],
            created_at=data["created_at"],
            run_commands=data.get("run_commands", [])
        )
        for sample_id, s_data in data["samples"].items():
            sample = SampleRecord(
                sample_id=s_data["sample_id"],
                first_import_time=s_data["first_import_time"],
                status=SampleStatus(s_data["status"]),
                next_action=NextAction(s_data["next_action"]) if s_data.get("next_action") else None,
                missing_materials=s_data.get("missing_materials", []),
                keep_reason=s_data.get("keep_reason"),
                version_conflict=s_data.get("version_conflict", False),
                latest_model_version=s_data.get("latest_model_version"),
                rerun_count=s_data.get("rerun_count", 0)
            )
            sample.model_outputs = [ModelOutput(**o) for o in s_data["model_outputs"]]
            sample.manual_corrections = [ManualCorrection(**c) for c in s_data["manual_corrections"]]
            sample.review_notes = [ReviewNote(**n) for n in s_data["review_notes"]]
            session.samples[sample_id] = sample
        return session

    def list_sessions(self) -> list:
        sessions = []
        for path in self.sessions_dir.glob("*.json"):
            sessions.append(path.stem)
        return sorted(sessions)

    def save_export(self, session_id: str, filename: str, content: str) -> str:
        export_path = self.exports_dir / session_id
        export_path.mkdir(exist_ok=True)
        file_path = export_path / filename
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        return str(file_path)
