from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models import Document, VersionRecord, Discrepancy, Attachment
from app.schemas import DocumentUpdate
from app.core.comparer import DISCREPANCY_CATEGORIES


class VersionManager:
    def __init__(self, db: Session):
        self.db = db

    def create_new_version(self, doc: Document, update_data: DocumentUpdate,
                           change_reason: str = None, operator: str = None) -> Document:
        old_content = {
            "content": doc.content,
            "raw_text": doc.raw_text,
            "remarks": doc.remarks,
        }

        new_content = {
            "content": update_data.content if update_data.content is not None else doc.content,
            "raw_text": update_data.raw_text if update_data.raw_text is not None else doc.raw_text,
            "remarks": update_data.remarks if update_data.remarks is not None else doc.remarks,
        }

        new_doc = Document(
            lc_id=doc.lc_id,
            document_type=doc.document_type,
            document_number=doc.document_number,
            version=doc.version + 1,
            is_active=True,
            content=new_content["content"],
            raw_text=new_content["raw_text"],
            remarks=new_content["remarks"],
            submitted_by=update_data.submitted_by if update_data.submitted_by else doc.submitted_by,
        )

        doc.is_active = False

        version_record = VersionRecord(
            related_type="DOCUMENT",
            related_id=new_doc.id,
            version=new_doc.version,
            action="UPDATE",
            old_content=old_content,
            new_content=new_content,
            change_reason=change_reason,
            operator=operator,
        )

        self.db.add(new_doc)
        self.db.add(version_record)
        self.db.flush()

        return new_doc

    def check_duplicate_document(self, lc_id: int, document_type: str, document_number: str,
                                 exclude_id: int = None) -> Optional[Document]:
        query = self.db.query(Document).filter(
            Document.lc_id == lc_id,
            Document.document_type == document_type,
            Document.document_number == document_number,
            Document.is_active == True,
        )

        if exclude_id:
            query = query.filter(Document.id != exclude_id)

        return query.first()

    def deactivate_old_versions(self, lc_id: int, document_type: str, document_number: str) -> List[Document]:
        old_docs = self.db.query(Document).filter(
            Document.lc_id == lc_id,
            Document.document_type == document_type,
            Document.document_number == document_number,
            Document.is_active == True,
        ).all()

        for doc in old_docs:
            doc.is_active = False

            version_record = VersionRecord(
                related_type="DOCUMENT",
                related_id=doc.id,
                version=doc.version,
                action="DEACTIVATE",
                old_content={"is_active": True},
                new_content={"is_active": False},
                change_reason="New version uploaded, marking old version as inactive",
                operator="system",
            )
            self.db.add(version_record)

        return old_docs

    def get_version_history(self, related_type: str, related_id: int) -> List[VersionRecord]:
        return self.db.query(VersionRecord).filter(
            VersionRecord.related_type == related_type,
            VersionRecord.related_id == related_id,
        ).order_by(VersionRecord.version.desc()).all()

    def record_discrepancy_change(self, discrepancy: Discrepancy, old_data: Dict[str, Any],
                                  new_data: Dict[str, Any], action: str,
                                  change_reason: str = None, operator: str = None) -> VersionRecord:
        version_record = VersionRecord(
            related_type="DISCREPANCY",
            related_id=discrepancy.id,
            version=discrepancy.id,
            action=action,
            old_content=old_data,
            new_content=new_data,
            change_reason=change_reason,
            operator=operator,
        )

        self.db.add(version_record)
        self.db.flush()

        return version_record

    def record_status_change(self, lc_id: int, old_status: str, new_status: str,
                             remarks: str = None, operator: str = None) -> VersionRecord:
        version_record = VersionRecord(
            related_type="LC",
            related_id=lc_id,
            version=1,
            action="STATUS_CHANGE",
            old_content={"status": old_status},
            new_content={"status": new_status, "remarks": remarks},
            change_reason=remarks,
            operator=operator,
        )

        self.db.add(version_record)
        self.db.flush()

        return version_record
