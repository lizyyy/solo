from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from models import TranslationMemory, MemoryReport, EntryStatus, ConflictType
from schemas import TranslationEntryCreate, StatusUpdateRequest, ManualFixRequest
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple

class TranslationMemoryService:
    def __init__(self, db: Session):
        self.db = db
    
    def _find_exact_duplicate(self, entry_data: TranslationEntryCreate) -> Optional[TranslationMemory]:
        return self.db.query(TranslationMemory).filter(
            and_(
                TranslationMemory.entry_key == entry_data.entry_key,
                TranslationMemory.source_language == entry_data.source_language,
                TranslationMemory.target_language == entry_data.target_language,
                TranslationMemory.version_batch == entry_data.version_batch,
                TranslationMemory.source_text == entry_data.source_text,
                TranslationMemory.target_text == entry_data.target_text
            )
        ).first()
    
    def _find_same_key_batch(self, entry_data: TranslationEntryCreate) -> List[TranslationMemory]:
        return self.db.query(TranslationMemory).filter(
            and_(
                TranslationMemory.entry_key == entry_data.entry_key,
                TranslationMemory.source_language == entry_data.source_language,
                TranslationMemory.target_language == entry_data.target_language,
                TranslationMemory.version_batch == entry_data.version_batch
            )
        ).order_by(TranslationMemory.version_number.desc()).all()
    
    def _get_next_version_number(self, entry_key: str, source_lang: str, target_lang: str, batch: str) -> int:
        existing = self.db.query(TranslationMemory).filter(
            and_(
                TranslationMemory.entry_key == entry_key,
                TranslationMemory.source_language == source_lang,
                TranslationMemory.target_language == target_lang,
                TranslationMemory.version_batch == batch
            )
        ).order_by(TranslationMemory.version_number.desc()).first()
        return existing.version_number + 1 if existing else 1
    
    def _detect_conflicts(self, entry_data: TranslationEntryCreate) -> Tuple[ConflictType, str, Dict[str, Any]]:
        same_batch_entries = self._find_same_key_batch(entry_data)
        
        if not same_batch_entries:
            return ConflictType.NONE, "No conflict detected", {}
        
        latest = same_batch_entries[0]
        
        if latest.source_text == entry_data.source_text and latest.target_text == entry_data.target_text:
            return ConflictType.DUPLICATE_VERSION, "Exact same entry already exists in this batch", {
                "existing_version": latest.version_number,
                "existing_id": latest.id
            }
        
        if latest.source_text != entry_data.source_text:
            return ConflictType.SOURCE_CHANGED, "Source text has changed from previous version", {
                "previous_source": latest.source_text,
                "new_source": entry_data.source_text,
                "existing_version": latest.version_number
            }
        
        if latest.target_text != entry_data.target_text and latest.source_text == entry_data.source_text:
            return ConflictType.TARGET_CONFLICT, "Target text differs for same source text", {
                "previous_target": latest.target_text,
                "new_target": entry_data.target_text,
                "existing_version": latest.version_number
            }
        
        return ConflictType.HISTORY_MISMATCH, "History mismatch detected", {
            "latest_version": latest.version_number
        }
    
    def _create_report(self, entry_id: int, report_type: str, conflict_type: ConflictType,
                      original_input: Dict[str, Any], processing_result: Dict[str, Any],
                      conclusion: str, severity: str = "info") -> MemoryReport:
        report = MemoryReport(
            entry_id=entry_id,
            report_type=report_type,
            conflict_type=conflict_type,
            original_input=original_input,
            processing_result=processing_result,
            conclusion=conclusion,
            severity=severity
        )
        self.db.add(report)
        return report
    
    def create_entry(self, entry_data: TranslationEntryCreate) -> Tuple[TranslationMemory, bool]:
        exact_dup = self._find_exact_duplicate(entry_data)
        if exact_dup:
            self._create_report(
                exact_dup.id,
                "duplicate_submission",
                ConflictType.DUPLICATE_VERSION,
                entry_data.dict(),
                {"action": "skipped", "existing_entry_id": exact_dup.id},
                "Duplicate submission detected, entry creation skipped",
                "warning"
            )
            self.db.commit()
            return exact_dup, True
        
        conflict_type, conclusion, details = self._detect_conflicts(entry_data)
        version_number = self._get_next_version_number(
            entry_data.entry_key,
            entry_data.source_language,
            entry_data.target_language,
            entry_data.version_batch
        )
        
        status = EntryStatus.PENDING if conflict_type == ConflictType.NONE else EntryStatus.NEEDS_REVIEW
        
        new_entry = TranslationMemory(
            entry_key=entry_data.entry_key,
            source_language=entry_data.source_language,
            target_language=entry_data.target_language,
            source_text=entry_data.source_text,
            target_text=entry_data.target_text,
            version_batch=entry_data.version_batch,
            version_number=version_number,
            status=status,
            created_by=entry_data.created_by,
            metadata_=entry_data.metadata
        )
        
        self.db.add(new_entry)
        self.db.flush()
        
        self._create_report(
            new_entry.id,
            "entry_creation",
            conflict_type,
            entry_data.dict(),
            {
                "action": "created",
                "version_number": version_number,
                "status": status.value,
                **details
            },
            conclusion,
            "warning" if conflict_type != ConflictType.NONE else "info"
        )
        
        self.db.commit()
        self.db.refresh(new_entry)
        return new_entry, False
    
    def get_entries(self, entry_key: Optional[str] = None, source_language: Optional[str] = None,
                   target_language: Optional[str] = None, version_batch: Optional[str] = None,
                   status: Optional[EntryStatus] = None, skip: int = 0, limit: int = 100) -> List[TranslationMemory]:
        query = self.db.query(TranslationMemory)
        
        if entry_key:
            query = query.filter(TranslationMemory.entry_key.contains(entry_key))
        if source_language:
            query = query.filter(TranslationMemory.source_language == source_language)
        if target_language:
            query = query.filter(TranslationMemory.target_language == target_language)
        if version_batch:
            query = query.filter(TranslationMemory.version_batch == version_batch)
        if status:
            query = query.filter(TranslationMemory.status == status)
        
        return query.order_by(TranslationMemory.created_at.desc()).offset(skip).limit(limit).all()
    
    def get_entry_by_id(self, entry_id: int) -> Optional[TranslationMemory]:
        return self.db.query(TranslationMemory).filter(TranslationMemory.id == entry_id).first()
    
    def update_status(self, entry_id: int, request: StatusUpdateRequest) -> Optional[TranslationMemory]:
        entry = self.get_entry_by_id(entry_id)
        if not entry:
            return None
        
        old_status = entry.status
        entry.status = request.new_status
        
        if request.new_status == EntryStatus.ROLLED_BACK and request.rollback_reason:
            entry.rollback_reason = request.rollback_reason
        
        entry.updated_at = datetime.utcnow()
        
        self._create_report(
            entry_id,
            "status_update",
            ConflictType.NONE,
            {"old_status": old_status.value, "new_status": request.new_status.value, **request.dict()},
            {"action": "status_updated", "success": True},
            f"Status changed from {old_status.value} to {request.new_status.value}",
            "info"
        )
        
        self.db.commit()
        self.db.refresh(entry)
        return entry
    
    def manual_fix(self, entry_id: int, request: ManualFixRequest) -> Optional[TranslationMemory]:
        entry = self.get_entry_by_id(entry_id)
        if not entry:
            return None
        
        old_source = entry.source_text
        old_target = entry.target_text
        changes = {}
        
        if request.new_source_text is not None:
            changes["source_text"] = {"old": old_source, "new": request.new_source_text}
            entry.source_text = request.new_source_text
        
        if request.new_target_text is not None:
            changes["target_text"] = {"old": old_target, "new": request.new_target_text}
            entry.target_text = request.new_target_text
        
        entry.status = EntryStatus.MANUALLY_FIXED
        entry.updated_at = datetime.utcnow()
        
        self._create_report(
            entry_id,
            "manual_fix",
            ConflictType.NONE,
            {"old_source": old_source, "old_target": old_target, **request.dict()},
            {"action": "manually_fixed", "changes": changes, "success": True},
            f"Manual fix applied: {request.fix_notes}",
            "info"
        )
        
        self.db.commit()
        self.db.refresh(entry)
        return entry
    
    def get_reports(self, entry_id: Optional[int] = None, report_type: Optional[str] = None,
                   conflict_type: Optional[ConflictType] = None, skip: int = 0, limit: int = 100) -> List[MemoryReport]:
        query = self.db.query(MemoryReport)
        
        if entry_id:
            query = query.filter(MemoryReport.entry_id == entry_id)
        if report_type:
            query = query.filter(MemoryReport.report_type == report_type)
        if conflict_type:
            query = query.filter(MemoryReport.conflict_type == conflict_type)
        
        return query.order_by(MemoryReport.detected_at.desc()).offset(skip).limit(limit).all()
    
    def export_data(self, version_batch: Optional[str] = None, source_language: Optional[str] = None,
                   target_language: Optional[str] = None, status: Optional[EntryStatus] = None,
                   include_reports: bool = True) -> Tuple[List[TranslationMemory], List[MemoryReport]]:
        entries = self.get_entries(
            entry_key=None,
            source_language=source_language,
            target_language=target_language,
            version_batch=version_batch,
            status=status,
            skip=0,
            limit=10000
        )
        
        reports = []
        if include_reports and entries:
            entry_ids = [e.id for e in entries]
            reports = self.db.query(MemoryReport).filter(MemoryReport.entry_id.in_(entry_ids)).all()
        
        return entries, reports