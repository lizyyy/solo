import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List
from pydantic.json import pydantic_encoder
from .models import (
    AuditSession, IngestedFile, SamplePosition, ScanLogEntry,
    TemperatureReading, TransferForm, ValidationIssue, ReviewEntry
)


class SessionStorage:
    def __init__(self, storage_dir: Path):
        self.storage_dir = storage_dir
        self.sessions_dir = storage_dir / "sessions"
        self.reviews_dir = storage_dir / "reviews"
        self._ensure_dirs()
    
    def _ensure_dirs(self) -> None:
        self.sessions_dir.mkdir(parents=True, exist_ok=True)
        self.reviews_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_session_id(self) -> str:
        return f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    
    def create_session(self) -> AuditSession:
        session_id = self.generate_session_id()
        session = AuditSession(session_id=session_id)
        return session
    
    def save_session(self, session: AuditSession) -> Path:
        session_path = self.sessions_dir / f"{session.session_id}.json"
        
        session_data = {
            "session_id": session.session_id,
            "created_at": session.created_at.isoformat(),
            "ingested_files": [
                {
                    "file_type": f.file_type.value,
                    "original_path": f.original_path,
                    "file_name": f.file_name,
                    "file_hash": f.file_hash,
                    "ingest_time": f.ingest_time.isoformat(),
                    "metadata": f.metadata,
                    "row_count": f.row_count
                }
                for f in session.ingested_files
            ],
            "sample_positions": [
                {
                    "barcode": p.barcode,
                    "box_id": p.box_id,
                    "row": p.row,
                    "col": p.col,
                    "position_str": p.position_str,
                    "batch_id": p.batch_id,
                    "sample_type": p.sample_type
                }
                for p in session.sample_positions
            ],
            "scan_logs": [
                {
                    "barcode": s.barcode,
                    "scan_time": s.scan_time.isoformat(),
                    "scanner_id": s.scanner_id,
                    "location": s.location,
                    "box_id": s.box_id
                }
                for s in session.scan_logs
            ],
            "temperature_readings": [
                {
                    "timestamp": t.timestamp.isoformat(),
                    "temperature": t.temperature,
                    "freezer_id": t.freezer_id,
                    "probe_id": t.probe_id,
                    "is_alert": t.is_alert,
                    "alert_marked": t.alert_marked
                }
                for t in session.temperature_readings
            ],
            "transfer_form": None if not session.transfer_form else {
                "transfer_id": session.transfer_form.transfer_id,
                "transfer_date": session.transfer_form.transfer_date.isoformat(),
                "sender_name": session.transfer_form.sender_name,
                "sender_signature": session.transfer_form.sender_signature,
                "sender_sign_date": (
                    session.transfer_form.sender_sign_date.isoformat()
                    if session.transfer_form.sender_sign_date else None
                ),
                "receiver_name": session.transfer_form.receiver_name,
                "receiver_signature": session.transfer_form.receiver_signature,
                "receiver_sign_date": (
                    session.transfer_form.receiver_sign_date.isoformat()
                    if session.transfer_form.receiver_sign_date else None
                ),
                "box_ids": session.transfer_form.box_ids,
                "notes": session.transfer_form.notes
            },
            "validation_issues": [
                {
                    "rule": i.rule.value,
                    "severity": i.severity.value,
                    "message": i.message,
                    "affected_samples": i.affected_samples,
                    "details": i.details,
                    "timestamp": i.timestamp.isoformat()
                }
                for i in session.validation_issues
            ],
            "review_entries": [
                {
                    "review_id": r.review_id,
                    "timestamp": r.timestamp.isoformat(),
                    "reviewer_name": r.reviewer_name,
                    "issue_reference": r.issue_reference,
                    "action_taken": r.action_taken,
                    "comments": r.comments,
                    "resolution_status": r.resolution_status,
                    "session_id": r.session_id
                }
                for r in session.review_entries
            ],
            "metadata": session.metadata
        }
        
        with open(session_path, 'w', encoding='utf-8') as f:
            json.dump(session_data, f, ensure_ascii=False, indent=2, default=pydantic_encoder)
        
        return session_path
    
    def load_session(self, session_id: str) -> Optional[AuditSession]:
        session_path = self.sessions_dir / f"{session_id}.json"
        if not session_path.exists():
            return None
        
        with open(session_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return self._dict_to_session(data)
    
    def _dict_to_session(self, data: Dict[str, Any]) -> AuditSession:
        from .models import (
            FileType, ValidationRule, ValidationSeverity
        )
        from datetime import datetime
        
        transfer_form = None
        if data.get("transfer_form"):
            tf = data["transfer_form"]
            transfer_form = TransferForm(
                transfer_id=tf["transfer_id"],
                transfer_date=datetime.fromisoformat(tf["transfer_date"]),
                sender_name=tf["sender_name"],
                sender_signature=tf.get("sender_signature"),
                sender_sign_date=(
                    datetime.fromisoformat(tf["sender_sign_date"])
                    if tf.get("sender_sign_date") else None
                ),
                receiver_name=tf["receiver_name"],
                receiver_signature=tf.get("receiver_signature"),
                receiver_sign_date=(
                    datetime.fromisoformat(tf["receiver_sign_date"])
                    if tf.get("receiver_sign_date") else None
                ),
                box_ids=tf.get("box_ids", []),
                notes=tf.get("notes")
            )
        
        return AuditSession(
            session_id=data["session_id"],
            created_at=datetime.fromisoformat(data["created_at"]),
            ingested_files=[
                IngestedFile(
                    file_type=FileType(f["file_type"]),
                    original_path=f["original_path"],
                    file_name=f["file_name"],
                    file_hash=f["file_hash"],
                    ingest_time=datetime.fromisoformat(f["ingest_time"]),
                    metadata=f.get("metadata", {}),
                    row_count=f.get("row_count", 0)
                )
                for f in data.get("ingested_files", [])
            ],
            sample_positions=[
                SamplePosition(
                    barcode=p["barcode"],
                    box_id=p["box_id"],
                    row=p["row"],
                    col=p["col"],
                    position_str=p["position_str"],
                    batch_id=p.get("batch_id"),
                    sample_type=p.get("sample_type")
                )
                for p in data.get("sample_positions", [])
            ],
            scan_logs=[
                ScanLogEntry(
                    barcode=s["barcode"],
                    scan_time=datetime.fromisoformat(s["scan_time"]),
                    scanner_id=s.get("scanner_id"),
                    location=s.get("location"),
                    box_id=s.get("box_id")
                )
                for s in data.get("scan_logs", [])
            ],
            temperature_readings=[
                TemperatureReading(
                    timestamp=datetime.fromisoformat(t["timestamp"]),
                    temperature=t["temperature"],
                    freezer_id=t["freezer_id"],
                    probe_id=t.get("probe_id"),
                    is_alert=t.get("is_alert", False),
                    alert_marked=t.get("alert_marked", False)
                )
                for t in data.get("temperature_readings", [])
            ],
            transfer_form=transfer_form,
            validation_issues=[
                ValidationIssue(
                    rule=ValidationRule(i["rule"]),
                    severity=ValidationSeverity(i["severity"]),
                    message=i["message"],
                    affected_samples=i.get("affected_samples", []),
                    details=i.get("details", {}),
                    timestamp=datetime.fromisoformat(i["timestamp"])
                )
                for i in data.get("validation_issues", [])
            ],
            review_entries=[
                ReviewEntry(
                    review_id=r["review_id"],
                    timestamp=datetime.fromisoformat(r["timestamp"]),
                    reviewer_name=r["reviewer_name"],
                    issue_reference=r.get("issue_reference"),
                    action_taken=r["action_taken"],
                    comments=r.get("comments"),
                    resolution_status=r["resolution_status"],
                    session_id=r["session_id"]
                )
                for r in data.get("review_entries", [])
            ],
            metadata=data.get("metadata", {})
        )
    
    def list_sessions(self) -> List[str]:
        session_ids = []
        for f in self.sessions_dir.glob("session_*.json"):
            session_ids.append(f.stem)
        return sorted(session_ids, reverse=True)
    
    def add_review(self, session: AuditSession, review: ReviewEntry) -> AuditSession:
        session.review_entries.append(review)
        self.save_session(session)
        return session
