from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from datetime import datetime

from app.repositories.base import BaseRepository
from app.models.knowledge import Knowledge, KnowledgeVersion
from app.schemas.knowledge import KnowledgeCreate, KnowledgeUpdate


class KnowledgeRepository(BaseRepository[Knowledge, KnowledgeCreate, KnowledgeUpdate]):
    def __init__(self):
        super().__init__(Knowledge)

    def get_by_name(self, db: Session, name: str) -> Optional[Knowledge]:
        return db.query(Knowledge).filter(
            Knowledge.name == name,
            Knowledge.is_deleted == False
        ).first()

    def search(
        self,
        db: Session,
        keyword: Optional[str] = None,
        knowledge_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        page: int = 1,
        page_size: int = 10
    ) -> Tuple[List[Knowledge], int, int]:
        query = db.query(Knowledge).filter(Knowledge.is_deleted == False)

        if keyword:
            query = query.filter(
                (Knowledge.name.contains(keyword)) |
                (Knowledge.content.contains(keyword)) |
                (Knowledge.keywords.contains(keyword))
            )

        if knowledge_type:
            query = query.filter(Knowledge.knowledge_type == knowledge_type)

        if is_active is not None:
            query = query.filter(Knowledge.is_active == is_active)

        query = query.order_by(Knowledge.updated_at.desc())

        total = query.count()
        skip = (page - 1) * page_size
        items = query.offset(skip).limit(page_size).all()
        total_pages = (total + page_size - 1) // page_size

        return items, total, total_pages

    def create_version(
        self,
        db: Session,
        knowledge_id: int,
        version: str,
        content: str,
        keywords: Optional[str] = None,
        change_description: Optional[str] = None,
        affected_questions: Optional[str] = None
    ) -> KnowledgeVersion:
        version_obj = KnowledgeVersion(
            knowledge_id=knowledge_id,
            version=version,
            content=content,
            keywords=keywords,
            change_description=change_description,
            affected_questions=affected_questions
        )
        db.add(version_obj)
        db.commit()
        db.refresh(version_obj)
        return version_obj

    def get_latest_version(self, db: Session, knowledge_id: int) -> Optional[KnowledgeVersion]:
        return db.query(KnowledgeVersion).filter(
            KnowledgeVersion.knowledge_id == knowledge_id,
            KnowledgeVersion.is_deleted == False
        ).order_by(KnowledgeVersion.created_at.desc()).first()

    def get_version_by_number(self, db: Session, knowledge_id: int, version: str) -> Optional[KnowledgeVersion]:
        return db.query(KnowledgeVersion).filter(
            KnowledgeVersion.knowledge_id == knowledge_id,
            KnowledgeVersion.version == version,
            KnowledgeVersion.is_deleted == False
        ).first()

    def get_all_versions(self, db: Session, knowledge_id: int) -> List[KnowledgeVersion]:
        return db.query(KnowledgeVersion).filter(
            KnowledgeVersion.knowledge_id == knowledge_id,
            KnowledgeVersion.is_deleted == False
        ).order_by(KnowledgeVersion.created_at.desc()).all()

    def update_version_affected_questions(
        self,
        db: Session,
        version_id: int,
        affected_questions: str
    ) -> KnowledgeVersion:
        version = db.query(KnowledgeVersion).filter(
            KnowledgeVersion.id == version_id,
            KnowledgeVersion.is_deleted == False
        ).first()

        if not version:
            from app.core.exceptions import ResourceNotFoundException
            raise ResourceNotFoundException(
                resource="知识库版本",
                resource_id=version_id
            )

        version.affected_questions = affected_questions
        db.add(version)
        db.commit()
        db.refresh(version)
        return version

    def get_active_knowledge(self, db: Session) -> List[Knowledge]:
        return db.query(Knowledge).filter(
            Knowledge.is_active == True,
            Knowledge.is_deleted == False
        ).all()


knowledge_repo = KnowledgeRepository()
