import json
import os
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Any
from uuid import uuid4

from models import (
    WorkSession,
    PackageEvidence,
    FileEntry,
    ServiceNote,
    ClaimApplication,
    ValidationIssue,
    ReviewNote,
    FileCategory,
    IssueSeverity,
    IssueType,
    ReviewStatus,
)


class SessionStorageError(Exception):
    pass


class SessionSerializer:
    @staticmethod
    def datetime_to_str(dt: datetime) -> Optional[str]:
        return dt.isoformat() if dt else None
    
    @staticmethod
    def str_to_datetime(s: str) -> Optional[datetime]:
        if not s:
            return None
        try:
            return datetime.fromisoformat(s)
        except ValueError:
            return None
    
    @staticmethod
    def decimal_to_str(d: Decimal) -> str:
        return str(d)
    
    @staticmethod
    def str_to_decimal(s: str) -> Decimal:
        if not s:
            return Decimal("0")
        return Decimal(str(s))
    
    @staticmethod
    def file_category_to_str(fc: FileCategory) -> Optional[str]:
        return fc.value if fc else None
    
    @staticmethod
    def str_to_file_category(s: str) -> FileCategory:
        if not s:
            return FileCategory.UNKNOWN
        try:
            return FileCategory(s)
        except ValueError:
            return FileCategory.UNKNOWN
    
    @staticmethod
    def file_entry_to_dict(file: FileEntry) -> Dict[str, Any]:
        return {
            "file_id": file.file_id,
            "file_path": file.file_path,
            "filename": file.filename,
            "file_size": file.file_size,
            "extension": file.extension,
            "category": SessionSerializer.file_category_to_str(file.category),
            "waybill_number": file.waybill_number,
            "created_at": SessionSerializer.datetime_to_str(file.created_at),
            "modified_at": SessionSerializer.datetime_to_str(file.modified_at),
            "exif_timestamp": SessionSerializer.datetime_to_str(file.exif_timestamp),
            "metadata": file.metadata,
        }
    
    @staticmethod
    def dict_to_file_entry(data: Dict[str, Any]) -> FileEntry:
        return FileEntry(
            file_id=data["file_id"],
            file_path=data["file_path"],
            filename=data["filename"],
            file_size=data.get("file_size", 0),
            extension=data.get("extension", ""),
            category=SessionSerializer.str_to_file_category(data.get("category")),
            waybill_number=data.get("waybill_number"),
            created_at=SessionSerializer.str_to_datetime(data.get("created_at")),
            modified_at=SessionSerializer.str_to_datetime(data.get("modified_at")),
            exif_timestamp=SessionSerializer.str_to_datetime(data.get("exif_timestamp")),
            metadata=data.get("metadata", {}),
        )
    
    @staticmethod
    def service_note_to_dict(note: ServiceNote) -> Dict[str, Any]:
        return {
            "note_id": note.note_id,
            "waybill_number": note.waybill_number,
            "content": note.content,
            "operator": note.operator,
            "timestamp": SessionSerializer.datetime_to_str(note.timestamp),
            "source_file": note.source_file,
            "metadata": note.metadata,
        }
    
    @staticmethod
    def dict_to_service_note(data: Dict[str, Any]) -> ServiceNote:
        return ServiceNote(
            note_id=data["note_id"],
            waybill_number=data["waybill_number"],
            content=data["content"],
            operator=data.get("operator", ""),
            timestamp=SessionSerializer.str_to_datetime(data.get("timestamp")),
            source_file=data.get("source_file", ""),
            metadata=data.get("metadata", {}),
        )
    
    @staticmethod
    def claim_application_to_dict(claim: ClaimApplication) -> Dict[str, Any]:
        return {
            "claim_id": claim.claim_id,
            "waybill_number": claim.waybill_number,
            "claim_amount": SessionSerializer.decimal_to_str(claim.claim_amount),
            "claim_reason": claim.claim_reason,
            "applicant": claim.applicant,
            "apply_time": SessionSerializer.datetime_to_str(claim.apply_time),
            "expected_amount": SessionSerializer.decimal_to_str(claim.expected_amount),
            "approved_amount": SessionSerializer.decimal_to_str(claim.approved_amount) if claim.approved_amount else None,
            "source_file": claim.source_file,
            "status": claim.status,
            "metadata": claim.metadata,
        }
    
    @staticmethod
    def dict_to_claim_application(data: Dict[str, Any]) -> ClaimApplication:
        approved_amount = None
        if data.get("approved_amount") is not None:
            approved_amount = SessionSerializer.str_to_decimal(data["approved_amount"])
        
        return ClaimApplication(
            claim_id=data["claim_id"],
            waybill_number=data["waybill_number"],
            claim_amount=SessionSerializer.str_to_decimal(data.get("claim_amount", "0")),
            claim_reason=data.get("claim_reason", ""),
            applicant=data.get("applicant", ""),
            apply_time=SessionSerializer.str_to_datetime(data.get("apply_time")),
            expected_amount=SessionSerializer.str_to_decimal(data.get("expected_amount", "0")),
            approved_amount=approved_amount,
            source_file=data.get("source_file", ""),
            status=data.get("status", "pending"),
            metadata=data.get("metadata", {}),
        )
    
    @staticmethod
    def validation_issue_to_dict(issue: ValidationIssue) -> Dict[str, Any]:
        return {
            "issue_id": issue.issue_id,
            "issue_type": issue.issue_type.value if issue.issue_type else None,
            "severity": issue.severity.value if issue.severity else None,
            "message": issue.message,
            "waybill_number": issue.waybill_number,
            "affected_files": issue.affected_files,
            "affected_notes": issue.affected_notes,
            "review_status": issue.review_status.value if issue.review_status else None,
            "review_note_ids": [n.note_id for n in issue.review_notes],
            "metadata": issue.metadata,
        }
    
    @staticmethod
    def dict_to_validation_issue(data: Dict[str, Any]) -> ValidationIssue:
        issue_type = None
        if data.get("issue_type"):
            try:
                issue_type = IssueType(data["issue_type"])
            except ValueError:
                pass
        
        severity = None
        if data.get("severity"):
            try:
                severity = IssueSeverity(data["severity"])
            except ValueError:
                pass
        
        review_status = None
        if data.get("review_status"):
            try:
                review_status = ReviewStatus(data["review_status"])
            except ValueError:
                pass
        
        return ValidationIssue(
            issue_id=data["issue_id"],
            issue_type=issue_type,
            severity=severity,
            message=data["message"],
            waybill_number=data.get("waybill_number", ""),
            affected_files=data.get("affected_files", []),
            affected_notes=data.get("affected_notes", []),
            review_status=review_status or ReviewStatus.PENDING,
            review_notes=[],
            metadata=data.get("metadata", {}),
        )
    
    @staticmethod
    def review_note_to_dict(note: ReviewNote) -> Dict[str, Any]:
        return {
            "note_id": note.note_id,
            "issue_id": note.issue_id,
            "waybill_number": note.waybill_number,
            "author": note.author,
            "content": note.content,
            "timestamp": SessionSerializer.datetime_to_str(note.timestamp),
            "status_change": note.status_change.value if note.status_change else None,
            "metadata": note.metadata,
        }
    
    @staticmethod
    def dict_to_review_note(data: Dict[str, Any]) -> ReviewNote:
        status_change = None
        if data.get("status_change"):
            try:
                status_change = ReviewStatus(data["status_change"])
            except ValueError:
                pass
        
        return ReviewNote(
            note_id=data["note_id"],
            issue_id=data.get("issue_id", ""),
            waybill_number=data.get("waybill_number", ""),
            author=data["author"],
            content=data["content"],
            timestamp=SessionSerializer.str_to_datetime(data.get("timestamp")) or datetime.now(),
            status_change=status_change,
            metadata=data.get("metadata", {}),
        )
    
    @staticmethod
    def package_evidence_to_dict(package: PackageEvidence) -> Dict[str, Any]:
        return {
            "waybill_number": package.waybill_number,
            "photos": [SessionSerializer.file_entry_to_dict(p) for p in package.photos],
            "waybill_photos": [SessionSerializer.file_entry_to_dict(p) for p in package.waybill_photos],
            "package_photos": [SessionSerializer.file_entry_to_dict(p) for p in package.package_photos],
            "damage_photos": [SessionSerializer.file_entry_to_dict(p) for p in package.damage_photos],
            "service_notes": [SessionSerializer.service_note_to_dict(n) for n in package.service_notes],
            "claim_applications": [SessionSerializer.claim_application_to_dict(c) for c in package.claim_applications],
            "issue_ids": [i.issue_id for i in package.issues],
            "review_note_ids": [n.note_id for n in package.review_notes],
            "metadata": package.metadata,
        }
    
    @staticmethod
    def dict_to_package_evidence(data: Dict[str, Any]) -> PackageEvidence:
        package = PackageEvidence(
            waybill_number=data["waybill_number"],
            photos=[SessionSerializer.dict_to_file_entry(p) for p in data.get("photos", [])],
            waybill_photos=[SessionSerializer.dict_to_file_entry(p) for p in data.get("waybill_photos", [])],
            package_photos=[SessionSerializer.dict_to_file_entry(p) for p in data.get("package_photos", [])],
            damage_photos=[SessionSerializer.dict_to_file_entry(p) for p in data.get("damage_photos", [])],
            service_notes=[SessionSerializer.dict_to_service_note(n) for n in data.get("service_notes", [])],
            claim_applications=[SessionSerializer.dict_to_claim_application(c) for c in data.get("claim_applications", [])],
            issues=[],
            review_notes=[],
            metadata=data.get("metadata", {}),
        )
        return package
    
    @staticmethod
    def work_session_to_dict(session: WorkSession) -> Dict[str, Any]:
        data = {
            "session_id": session.session_id,
            "name": session.name,
            "description": session.description,
            "created_at": SessionSerializer.datetime_to_str(session.created_at),
            "updated_at": SessionSerializer.datetime_to_str(session.updated_at),
            "scanned_directory": session.scanned_directory,
            "metadata": session.metadata,
            
            "files": {},
            "packages": {},
            "issues": {},
            "review_notes": {},
        }
        
        for file_id, file in session.files.items():
            data["files"][file_id] = SessionSerializer.file_entry_to_dict(file)
        
        for waybill_number, package in session.packages.items():
            data["packages"][waybill_number] = SessionSerializer.package_evidence_to_dict(package)
        
        for issue_id, issue in session.issues.items():
            data["issues"][issue_id] = SessionSerializer.validation_issue_to_dict(issue)
        
        for note_id, note in session.review_notes.items():
            data["review_notes"][note_id] = SessionSerializer.review_note_to_dict(note)
        
        return data
    
    @staticmethod
    def dict_to_work_session(data: Dict[str, Any]) -> WorkSession:
        session = WorkSession(
            session_id=data["session_id"],
            name=data["name"],
            description=data.get("description", ""),
            scanned_directory=data.get("scanned_directory", ""),
            metadata=data.get("metadata", {}),
        )
        
        if data.get("created_at"):
            session.created_at = SessionSerializer.str_to_datetime(data["created_at"])
        if data.get("updated_at"):
            session.updated_at = SessionSerializer.str_to_datetime(data["updated_at"])
        
        for file_id, file_data in data.get("files", {}).items():
            session.files[file_id] = SessionSerializer.dict_to_file_entry(file_data)
        
        all_review_notes = {}
        for note_id, note_data in data.get("review_notes", {}).items():
            note = SessionSerializer.dict_to_review_note(note_data)
            all_review_notes[note_id] = note
            session.review_notes[note_id] = note
        
        all_issues = {}
        for issue_id, issue_data in data.get("issues", {}).items():
            issue = SessionSerializer.dict_to_validation_issue(issue_data)
            for note_id in issue_data.get("review_note_ids", []):
                if note_id in all_review_notes:
                    issue.review_notes.append(all_review_notes[note_id])
            all_issues[issue_id] = issue
            session.issues[issue_id] = issue
        
        for waybill_number, package_data in data.get("packages", {}).items():
            package = SessionSerializer.dict_to_package_evidence(package_data)
            for issue_id in package_data.get("issue_ids", []):
                if issue_id in all_issues:
                    package.issues.append(all_issues[issue_id])
            for note_id in package_data.get("review_note_ids", []):
                if note_id in all_review_notes:
                    package.review_notes.append(all_review_notes[note_id])
            session.packages[waybill_number] = package
        
        return session


class SessionStore:
    def __init__(self, storage_dir: str):
        self.storage_dir = storage_dir
        os.makedirs(self.storage_dir, exist_ok=True)
    
    def _get_session_file(self, session_id: str) -> str:
        return os.path.join(self.storage_dir, f"{session_id}.json")
    
    def _get_index_file(self) -> str:
        return os.path.join(self.storage_dir, "index.json")
    
    def _load_index(self) -> List[Dict[str, Any]]:
        index_file = self._get_index_file()
        if not os.path.exists(index_file):
            return []
        try:
            with open(index_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []
    
    def _save_index(self, index: List[Dict[str, Any]]):
        index_file = self._get_index_file()
        try:
            with open(index_file, 'w', encoding='utf-8') as f:
                json.dump(index, f, ensure_ascii=False, indent=2)
        except IOError as e:
            raise SessionStorageError(f"保存索引失败: {str(e)}")
    
    def create_session(self, name: str, description: str = "") -> WorkSession:
        session_id = f"session_{uuid4().hex[:8]}"
        session = WorkSession(
            session_id=session_id,
            name=name,
            description=description,
        )
        
        self.save_session(session)
        return session
    
    def save_session(self, session: WorkSession):
        session.updated_at = datetime.now()
        
        try:
            data = SessionSerializer.work_session_to_dict(session)
            session_file = self._get_session_file(session.session_id)
            
            with open(session_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            index = self._load_index()
            
            existing_index = None
            for i, entry in enumerate(index):
                if entry.get("session_id") == session.session_id:
                    existing_index = i
                    break
            
            index_entry = {
                "session_id": session.session_id,
                "name": session.name,
                "description": session.description,
                "created_at": SessionSerializer.datetime_to_str(session.created_at),
                "updated_at": SessionSerializer.datetime_to_str(session.updated_at),
                "scanned_directory": session.scanned_directory,
                "package_count": len(session.packages),
                "file_count": len(session.files),
                "issue_count": len(session.issues),
                "critical_count": sum(1 for i in session.issues.values() if i.severity == IssueSeverity.CRITICAL),
            }
            
            if existing_index is not None:
                index[existing_index] = index_entry
            else:
                index.append(index_entry)
            
            self._save_index(index)
            
        except IOError as e:
            raise SessionStorageError(f"保存会话失败: {str(e)}")
    
    def load_session(self, session_id: str) -> Optional[WorkSession]:
        session_file = self._get_session_file(session_id)
        
        if not os.path.exists(session_file):
            return None
        
        try:
            with open(session_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return SessionSerializer.dict_to_work_session(data)
        except (json.JSONDecodeError, IOError, KeyError) as e:
            raise SessionStorageError(f"加载会话失败: {str(e)}")
    
    def delete_session(self, session_id: str) -> bool:
        session_file = self._get_session_file(session_id)
        
        if not os.path.exists(session_file):
            return False
        
        try:
            os.remove(session_file)
            
            index = self._load_index()
            index = [entry for entry in index if entry.get("session_id") != session_id]
            self._save_index(index)
            
            return True
        except IOError as e:
            raise SessionStorageError(f"删除会话失败: {str(e)}")
    
    def list_sessions(self) -> List[Dict[str, Any]]:
        return self._load_index()
    
    def session_exists(self, session_id: str) -> bool:
        session_file = self._get_session_file(session_id)
        return os.path.exists(session_file)
    
    def add_review_note(
        self,
        session: WorkSession,
        content: str,
        author: str,
        issue_id: str = "",
        waybill_number: str = "",
        status_change: ReviewStatus = None
    ) -> ReviewNote:
        note_id = f"note_{uuid4().hex[:12]}"
        
        note = ReviewNote(
            note_id=note_id,
            issue_id=issue_id,
            waybill_number=waybill_number,
            author=author,
            content=content,
            status_change=status_change,
        )
        
        session.review_notes[note_id] = note
        
        if issue_id and issue_id in session.issues:
            session.issues[issue_id].review_notes.append(note)
            if status_change:
                session.issues[issue_id].review_status = status_change
        
        if waybill_number and waybill_number in session.packages:
            session.packages[waybill_number].review_notes.append(note)
        
        return note
