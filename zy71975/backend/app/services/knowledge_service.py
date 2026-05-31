from typing import Optional, Tuple, List, Dict, Any
from sqlalchemy.orm import Session

from app.repositories.knowledge_repo import knowledge_repo
from app.schemas.knowledge import KnowledgeCreate, KnowledgeUpdate, VersionDiffResponse, VersionMarkResponse
from app.models.knowledge import Knowledge, KnowledgeVersion
from app.models.compare import CompareResult
from app.utils.version_compare import (
    increment_version,
    compare_versions,
    get_diff_details,
    generate_change_description,
    check_question_affected
)
from app.utils.text_compare import extract_keywords
from app.core.exceptions import ValidationException, BusinessException


class KnowledgeService:
    def create_knowledge(self, db: Session, knowledge_in: KnowledgeCreate) -> Knowledge:
        existing = knowledge_repo.get_by_name(db, knowledge_in.name)
        if existing:
            raise BusinessException(
                message=f"Knowledge {knowledge_in.name} already exists",
                user_friendly_message=f"知识库 {knowledge_in.name} 已经存在了哦～"
            )

        if not knowledge_in.keywords:
            keywords = extract_keywords(knowledge_in.content)
            knowledge_in.keywords = ",".join(keywords)

        knowledge = knowledge_repo.create(db, knowledge_in)

        knowledge_repo.create_version(
            db,
            knowledge_id=knowledge.id,
            version=knowledge.version,
            content=knowledge.content,
            keywords=knowledge.keywords,
            change_description="初始版本创建"
        )

        return knowledge

    def update_knowledge(
        self,
        db: Session,
        knowledge_id: int,
        knowledge_in: KnowledgeUpdate,
        auto_increment_version: bool = True
    ) -> Knowledge:
        knowledge = knowledge_repo.get_by_id_or_404(db, knowledge_id, "知识库")

        update_data = knowledge_in.model_dump(exclude_unset=True) if hasattr(knowledge_in, 'model_dump') else knowledge_in.dict(exclude_unset=True)
        change_description = update_data.pop("change_description", None)

        old_content = knowledge.content
        old_version = knowledge.version

        if "content" in update_data and update_data["content"] != old_content:
            if auto_increment_version:
                new_version = increment_version(old_version)
                update_data["version"] = new_version

            if "keywords" not in update_data or not update_data["keywords"]:
                new_keywords = extract_keywords(update_data["content"])
                update_data["keywords"] = ",".join(new_keywords)

            knowledge = knowledge_repo.update(db, knowledge, update_data)

            if not change_description:
                change_description = generate_change_description(
                    old_content, update_data["content"], old_version, knowledge.version
                )

            version = knowledge_repo.create_version(
                db,
                knowledge_id=knowledge.id,
                version=knowledge.version,
                content=knowledge.content,
                keywords=knowledge.keywords,
                change_description=change_description
            )

            self._mark_affected_questions(db, knowledge.id, old_content, knowledge.content, version.id, knowledge.version)
        else:
            knowledge = knowledge_repo.update(db, knowledge, update_data)

        return knowledge

    def _mark_affected_questions(
        self,
        db: Session,
        knowledge_id: int,
        old_content: str,
        new_content: str,
        version_id: int,
        new_version: str
    ) -> int:
        affected_ids = []

        compare_results = db.query(CompareResult).filter(
            CompareResult.knowledge_id == knowledge_id,
            CompareResult.is_deleted == False
        ).all()

        for result in compare_results:
            is_affected = check_question_affected(
                result.question,
                result.meeting_answer or "",
                old_content,
                new_content
            )

            if is_affected:
                result.is_affected_by_version = True
                result.affected_version = new_version
                result.status = "need_review"
                db.add(result)
                affected_ids.append(result.id)

        db.commit()

        if affected_ids:
            knowledge_repo.update_version_affected_questions(
                db, version_id, ",".join(str(id) for id in affected_ids)
            )

        return len(affected_ids)

    def get_knowledge_list(
        self,
        db: Session,
        keyword: Optional[str] = None,
        knowledge_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        page: int = 1,
        page_size: int = 10
    ) -> Tuple[List[Knowledge], int, int]:
        return knowledge_repo.search(db, keyword, knowledge_type, is_active, page, page_size)

    def get_knowledge(self, db: Session, knowledge_id: int) -> Knowledge:
        knowledge = knowledge_repo.get_by_id_or_404(db, knowledge_id, "知识库")
        knowledge.versions = knowledge_repo.get_all_versions(db, knowledge_id)
        return knowledge

    def get_knowledge_versions(self, db: Session, knowledge_id: int) -> List[KnowledgeVersion]:
        knowledge_repo.get_by_id_or_404(db, knowledge_id, "知识库")
        return knowledge_repo.get_all_versions(db, knowledge_id)

    def compare_versions(
        self,
        db: Session,
        knowledge_id: int,
        old_version: Optional[str] = None,
        new_version: Optional[str] = None
    ) -> VersionDiffResponse:
        knowledge = knowledge_repo.get_by_id_or_404(db, knowledge_id, "知识库")
        versions = knowledge_repo.get_all_versions(db, knowledge_id)

        if len(versions) < 2:
            raise BusinessException(
                message="Not enough versions to compare",
                user_friendly_message="版本数量不足，至少需要两个版本才能对比哦～"
            )

        old_ver_obj = None
        new_ver_obj = None

        if old_version and new_version:
            old_ver_obj = knowledge_repo.get_version_by_number(db, knowledge_id, old_version)
            new_ver_obj = knowledge_repo.get_version_by_number(db, knowledge_id, new_version)

            if not old_ver_obj or not new_ver_obj:
                raise BusinessException(
                    message="Specified versions not found",
                    user_friendly_message="找不到指定的版本哦～"
                )
        else:
            old_ver_obj = versions[1]
            new_ver_obj = versions[0]

        diff_details = get_diff_details(old_ver_obj.content, new_ver_obj.content)
        change_description = generate_change_description(
            old_ver_obj.content, new_ver_obj.content, old_ver_obj.version, new_ver_obj.version
        )

        affected_ids = []
        if new_ver_obj.affected_questions:
            affected_ids = [int(id) for id in new_ver_obj.affected_questions.split(",") if id.strip()]

        return VersionDiffResponse(
            knowledge_id=knowledge_id,
            old_version=old_ver_obj.version,
            new_version=new_ver_obj.version,
            diff_content=diff_details["diff_text"],
            change_description=change_description,
            affected_question_count=len(affected_ids),
            affected_question_ids=affected_ids
        )

    def mark_affected_questions(
        self,
        db: Session,
        knowledge_id: int,
        version: Optional[str] = None
    ) -> VersionMarkResponse:
        knowledge = knowledge_repo.get_by_id_or_404(db, knowledge_id, "知识库")
        versions = knowledge_repo.get_all_versions(db, knowledge_id)

        if len(versions) < 2:
            raise BusinessException(
                message="Not enough versions",
                user_friendly_message="版本数量不足哦～"
            )

        if version:
            target_version = knowledge_repo.get_version_by_number(db, knowledge_id, version)
            if not target_version:
                raise BusinessException(
                    message=f"Version {version} not found",
                    user_friendly_message=f"找不到版本 {version} 哦～"
                )

            version_index = next((i for i, v in enumerate(versions) if v.id == target_version.id), -1)
            if version_index >= len(versions) - 1:
                raise BusinessException(
                    message="Cannot mark affected questions for the first version",
                    user_friendly_message="第一个版本无法标记受影响问题哦～"
                )

            prev_version = versions[version_index + 1]
        else:
            target_version = versions[0]
            prev_version = versions[1]

        marked_count = self._mark_affected_questions(
            db,
            knowledge_id,
            prev_version.content,
            target_version.content,
            target_version.id,
            target_version.version
        )

        return VersionMarkResponse(
            knowledge_id=knowledge_id,
            version=target_version.version,
            marked_count=marked_count
        )

    def delete_knowledge(self, db: Session, knowledge_id: int) -> Knowledge:
        return knowledge_repo.soft_delete(db, knowledge_id)

    def toggle_active(self, db: Session, knowledge_id: int) -> Knowledge:
        knowledge = knowledge_repo.get_by_id_or_404(db, knowledge_id, "知识库")
        knowledge.is_active = not knowledge.is_active
        db.add(knowledge)
        db.commit()
        db.refresh(knowledge)
        return knowledge

    def get_active_knowledge(self, db: Session) -> List[Knowledge]:
        return knowledge_repo.get_active_knowledge(db)


knowledge_service = KnowledgeService()
