import json
import uuid
from pathlib import Path
from datetime import datetime
from typing import Tuple, Optional, Dict, Any, List
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import DatabaseManager
from .data_schema import (
    KnowledgeArticleInput,
    ConversationInput,
    BotRecommendationInput,
    AgentCitationInput,
    UserFeedbackInput,
    ImportBatch,
    ImportResult,
)
from .models import (
    KnowledgeArticle,
    Conversation,
    ConversationMessage,
    BotRecommendation,
    AgentCitation,
    UserFeedback,
    HitEvent,
    ManualCorrection,
)


class DataImporter:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def import_from_file(self, file_path: str) -> ImportResult:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        batch = ImportBatch(**data)
        return self.import_batch(batch, source_file=path.name)

    def import_batch(
        self, batch: ImportBatch, source_file: Optional[str] = None
    ) -> ImportResult:
        total = (
            len(batch.articles)
            + len(batch.conversations)
            + len(batch.recommendations)
            + len(batch.citations)
            + len(batch.feedbacks)
        )

        import_id = self.db.create_import_record("batch", source_file)
        errors: List[str] = []
        success_count = 0
        skipped_count = 0
        failed_count = 0

        try:
            with self.db.session() as session:
                for article in batch.articles:
                    try:
                        result = self._import_article(session, article)
                        if result == "created":
                            success_count += 1
                        elif result == "skipped":
                            skipped_count += 1
                    except Exception as e:
                        failed_count += 1
                        errors.append(f"Article {article.article_id}: {str(e)}")

                for conv in batch.conversations:
                    try:
                        result = self._import_conversation(session, conv)
                        if result == "created":
                            success_count += 1
                        elif result == "skipped":
                            skipped_count += 1
                    except Exception as e:
                        failed_count += 1
                        errors.append(f"Conversation {conv.conversation_id}: {str(e)}")

                for rec in batch.recommendations:
                    try:
                        result = self._import_recommendation(session, rec)
                        if result == "created":
                            success_count += 1
                        elif result == "skipped":
                            skipped_count += 1
                    except Exception as e:
                        failed_count += 1
                        errors.append(f"Recommendation {rec.recommendation_id}: {str(e)}")

                for cite in batch.citations:
                    try:
                        result = self._import_citation(session, cite)
                        if result == "created":
                            success_count += 1
                        elif result == "skipped":
                            skipped_count += 1
                    except Exception as e:
                        failed_count += 1
                        errors.append(f"Citation {cite.citation_id}: {str(e)}")

                for fb in batch.feedbacks:
                    try:
                        result = self._import_feedback(session, fb)
                        if result == "created":
                            success_count += 1
                        elif result == "skipped":
                            skipped_count += 1
                    except Exception as e:
                        failed_count += 1
                        errors.append(f"Feedback {fb.feedback_id}: {str(e)}")

        except Exception as e:
            self.db.update_import_record(
                import_id,
                "failed",
                total,
                success_count,
                skipped_count,
                failed_count,
                str(e),
            )
            raise

        status = "completed" if failed_count == 0 else "partial"
        self.db.update_import_record(
            import_id,
            status,
            total,
            success_count,
            skipped_count,
            failed_count,
            "; ".join(errors) if errors else None,
        )

        return ImportResult(
            total=total,
            success=success_count,
            skipped=skipped_count,
            failed=failed_count,
            errors=errors,
        )

    def _import_article(
        self, session: Session, article: KnowledgeArticleInput
    ) -> str:
        existing = (
            session.query(KnowledgeArticle)
            .filter_by(article_id=article.article_id, version=article.version)
            .first()
        )
        if existing:
            return "skipped"

        db_article = KnowledgeArticle(
            article_id=article.article_id,
            version=article.version,
            title=article.title,
            content=article.content,
            category=article.category,
            tags=article.tags,
            is_active=article.is_active,
        )
        session.add(db_article)
        session.flush()
        return "created"

    def _import_conversation(
        self, session: Session, conv: ConversationInput
    ) -> str:
        existing = (
            session.query(Conversation)
            .filter_by(conversation_id=conv.conversation_id)
            .first()
        )
        if existing:
            return "skipped"

        db_conv = Conversation(
            conversation_id=conv.conversation_id,
            user_id=conv.user_id,
            agent_id=conv.agent_id,
            started_at=conv.started_at,
            ended_at=conv.ended_at,
            channel=conv.channel,
            summary=conv.summary,
        )
        session.add(db_conv)
        session.flush()

        for msg in conv.messages:
            db_msg = ConversationMessage(
                conversation_id=conv.conversation_id,
                message_id=msg.message_id,
                sender_type=msg.sender_type,
                sender_id=msg.sender_id,
                content=msg.content,
                timestamp=msg.timestamp,
            )
            session.add(db_msg)

        return "created"

    def _import_recommendation(
        self, session: Session, rec: BotRecommendationInput
    ) -> str:
        existing = (
            session.query(BotRecommendation)
            .filter_by(recommendation_id=rec.recommendation_id)
            .first()
        )
        if existing:
            return "skipped"

        version = rec.article_version or self._get_latest_version(
            session, rec.article_id
        )

        db_rec = BotRecommendation(
            recommendation_id=rec.recommendation_id,
            conversation_id=rec.conversation_id,
            message_id=rec.message_id,
            article_id=rec.article_id,
            article_version=version,
            rank=rec.rank,
            score=rec.score,
            recommended_at=rec.recommended_at,
        )
        session.add(db_rec)
        return "created"

    def _import_citation(
        self, session: Session, cite: AgentCitationInput
    ) -> str:
        existing = (
            session.query(AgentCitation)
            .filter_by(citation_id=cite.citation_id)
            .first()
        )
        if existing:
            return "skipped"

        version = cite.article_version or self._get_latest_version(
            session, cite.article_id
        )

        db_cite = AgentCitation(
            citation_id=cite.citation_id,
            conversation_id=cite.conversation_id,
            message_id=cite.message_id,
            article_id=cite.article_id,
            article_version=version,
            cited_text=cite.cited_text,
            is_copy=cite.is_copy,
            is_rewritten=cite.is_rewritten,
            cited_at=cite.cited_at,
        )
        session.add(db_cite)
        return "created"

    def _import_feedback(
        self, session: Session, fb: UserFeedbackInput
    ) -> str:
        existing = (
            session.query(UserFeedback)
            .filter_by(feedback_id=fb.feedback_id)
            .first()
        )
        if existing:
            return "skipped"

        db_fb = UserFeedback(
            feedback_id=fb.feedback_id,
            conversation_id=fb.conversation_id,
            message_id=fb.message_id,
            article_id=fb.article_id,
            rating=fb.rating,
            comment=fb.comment,
            is_helpful=fb.is_helpful,
            resolved=fb.resolved,
            feedback_at=fb.feedback_at,
        )
        session.add(db_fb)
        return "created"

    def _get_latest_version(self, session: Session, article_id: str) -> int:
        latest = (
            session.query(KnowledgeArticle)
            .filter_by(article_id=article_id)
            .order_by(KnowledgeArticle.version.desc())
            .first()
        )
        return latest.version if latest else 1
