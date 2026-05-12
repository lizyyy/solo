import uuid
from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple
from collections import defaultdict
from sqlalchemy.orm import Session

from .database import DatabaseManager
from .models import (
    KnowledgeArticle,
    Conversation,
    BotRecommendation,
    AgentCitation,
    UserFeedback,
    HitEvent,
)


class HitCalculator:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def calculate_hits(self) -> Dict[str, int]:
        stats = {
            "recommendations_processed": 0,
            "citations_processed": 0,
            "hits_created": 0,
            "duplicates_skipped": 0,
        }

        with self.db.session() as session:
            feedback_map = self._build_feedback_map(session)

            recs = session.query(BotRecommendation).all()
            for rec in recs:
                hit_id = self._make_hit_id(
                    "recommendation", rec.conversation_id, rec.article_id, rec.article_version or 1
                )
                existing = session.query(HitEvent).filter_by(event_id=hit_id).first()
                if existing:
                    stats["duplicates_skipped"] += 1
                    continue

                feedback = feedback_map.get((rec.conversation_id, rec.article_id))
                hit = HitEvent(
                    event_id=hit_id,
                    conversation_id=rec.conversation_id,
                    article_id=rec.article_id,
                    article_version=rec.article_version or self._get_version(session, rec.article_id),
                    hit_type="recommended",
                    source="bot",
                    rating=feedback.get("rating") if feedback else None,
                    is_helpful=feedback.get("is_helpful") if feedback else None,
                    resolved=feedback.get("resolved") if feedback else None,
                    occurred_at=rec.recommended_at,
                )
                session.add(hit)
                stats["hits_created"] += 1
                stats["recommendations_processed"] += 1

            cites = session.query(AgentCitation).all()
            for cite in cites:
                hit_id = self._make_hit_id(
                    "citation", cite.conversation_id, cite.article_id, cite.article_version or 1
                )
                existing = session.query(HitEvent).filter_by(event_id=hit_id).first()
                if existing:
                    stats["duplicates_skipped"] += 1
                    continue

                feedback = feedback_map.get((cite.conversation_id, cite.article_id))
                hit_type = "cited_copy" if cite.is_copy else "cited_rewritten" if cite.is_rewritten else "cited"
                hit = HitEvent(
                    event_id=hit_id,
                    conversation_id=cite.conversation_id,
                    article_id=cite.article_id,
                    article_version=cite.article_version or self._get_version(session, cite.article_id),
                    hit_type=hit_type,
                    source="agent",
                    rating=feedback.get("rating") if feedback else None,
                    is_helpful=feedback.get("is_helpful") if feedback else None,
                    resolved=feedback.get("resolved") if feedback else None,
                    occurred_at=cite.cited_at,
                )
                session.add(hit)
                stats["hits_created"] += 1
                stats["citations_processed"] += 1

        self.db.log("info", f"Hit calculation complete", stats)
        return stats

    def _build_feedback_map(
        self, session: Session
    ) -> Dict[Tuple[str, Optional[str]], Dict]:
        feedbacks = session.query(UserFeedback).all()
        fb_map: Dict[Tuple[str, Optional[str]], Dict] = {}

        for fb in feedbacks:
            key = (fb.conversation_id, fb.article_id)
            fb_map[key] = {
                "rating": fb.rating,
                "is_helpful": fb.is_helpful,
                "resolved": fb.resolved,
            }

        return fb_map

    def _make_hit_id(
        self, source: str, conv_id: str, article_id: str, version: int
    ) -> str:
        return f"hit-{source}-{conv_id}-{article_id}-v{version}"

    def _get_version(self, session: Session, article_id: str) -> int:
        latest = (
            session.query(KnowledgeArticle)
            .filter_by(article_id=article_id)
            .order_by(KnowledgeArticle.version.desc())
            .first()
        )
        return latest.version if latest else 1

    def get_article_stats(self, article_id: Optional[str] = None) -> List[Dict]:
        results = []
        with self.db.session() as session:
            query = session.query(KnowledgeArticle)
            if article_id:
                query = query.filter_by(article_id=article_id)
            articles = query.order_by(KnowledgeArticle.article_id, KnowledgeArticle.version.desc()).all()

            for article in articles:
                stats = self._calc_article_stats(session, article)
                results.append({
                    "article_id": article.article_id,
                    "version": article.version,
                    "title": article.title,
                    "category": article.category,
                    "is_active": article.is_active,
                    **stats,
                })

        return results

    def _calc_article_stats(self, session: Session, article: KnowledgeArticle) -> Dict:
        hits = (
            session.query(HitEvent)
            .filter_by(article_id=article.article_id, article_version=article.version)
            .all()
        )

        unique_convs: Set[str] = set()
        bot_hits = 0
        agent_hits = 0
        copied_hits = 0
        rewritten_hits = 0
        helpful_count = 0
        not_helpful_count = 0
        resolved_count = 0
        unresolved_count = 0
        ratings: List[int] = []

        for hit in hits:
            unique_convs.add(hit.conversation_id)
            if hit.source == "bot":
                bot_hits += 1
            else:
                agent_hits += 1
            if hit.hit_type == "cited_copy":
                copied_hits += 1
            if hit.hit_type == "cited_rewritten":
                rewritten_hits += 1

            if hit.is_helpful is True:
                helpful_count += 1
            elif hit.is_helpful is False:
                not_helpful_count += 1
            if hit.resolved is True:
                resolved_count += 1
            elif hit.resolved is False:
                unresolved_count += 1
            if hit.rating is not None:
                ratings.append(hit.rating)

        total_feedback = helpful_count + not_helpful_count
        conversion_rate = (helpful_count / total_feedback * 100) if total_feedback > 0 else None
        avg_rating = (sum(ratings) / len(ratings)) if ratings else None

        return {
            "total_hits": len(hits),
            "unique_conversations": len(unique_convs),
            "bot_recommendations": bot_hits,
            "agent_citations": agent_hits,
            "copied_directly": copied_hits,
            "rewritten": rewritten_hits,
            "helpful_count": helpful_count,
            "not_helpful_count": not_helpful_count,
            "conversion_rate_pct": round(conversion_rate, 1) if conversion_rate is not None else None,
            "resolved_count": resolved_count,
            "unresolved_count": unresolved_count,
            "average_rating": round(avg_rating, 2) if avg_rating is not None else None,
            "needs_rewrite": self._needs_rewrite(hits),
        }

    def _needs_rewrite(self, hits: List[HitEvent]) -> bool:
        if not hits:
            return False

        feedback_count = sum(1 for h in hits if h.is_helpful is not None)
        if feedback_count == 0:
            return False

        not_helpful = sum(1 for h in hits if h.is_helpful is False)
        rate = not_helpful / feedback_count

        return rate >= 0.4 and feedback_count >= 3
