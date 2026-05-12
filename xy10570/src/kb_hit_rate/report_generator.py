from typing import Dict, List, Optional
from collections import defaultdict
from datetime import datetime

from .database import DatabaseManager
from .hit_calculator import HitCalculator
from .models import KnowledgeArticle, ManualCorrection, HitEvent


class ReportGenerator:
    def __init__(self, db: DatabaseManager, calculator: HitCalculator):
        self.db = db
        self.calculator = calculator

    def generate_overview(self) -> Dict:
        all_stats = self.calculator.get_article_stats()

        if not all_stats:
            return {"has_data": False}

        total_hits = sum(s["total_hits"] for s in all_stats)
        total_unique_convs = sum(s["unique_conversations"] for s in all_stats)
        total_helpful = sum(s["helpful_count"] for s in all_stats)
        total_not_helpful = sum(s["not_helpful_count"] for s in all_stats)
        total_feedback = total_helpful + total_not_helpful
        overall_conversion = (total_helpful / total_feedback * 100) if total_feedback > 0 else None

        with self.db.session() as session:
            article_count = session.query(KnowledgeArticle).count()
            hit_count = session.query(HitEvent).count()
            correction_count = session.query(ManualCorrection).count()

        high_hit = sorted(all_stats, key=lambda x: x["total_hits"], reverse=True)[:5]
        low_conversion = sorted(
            [s for s in all_stats if s["conversion_rate_pct"] is not None],
            key=lambda x: x["conversion_rate_pct"],
        )[:5]
        needs_rewrite = [s for s in all_stats if s["needs_rewrite"]]

        by_category = defaultdict(lambda: {"hits": 0, "helpful": 0, "not_helpful": 0, "articles": set()})
        for s in all_stats:
            cat = s["category"] or "未分类"
            by_category[cat]["hits"] += s["total_hits"]
            by_category[cat]["helpful"] += s["helpful_count"]
            by_category[cat]["not_helpful"] += s["not_helpful_count"]
            by_category[cat]["articles"].add(s["article_id"])

        category_summary = []
        for cat, data in by_category.items():
            fb = data["helpful"] + data["not_helpful"]
            conv = (data["helpful"] / fb * 100) if fb > 0 else None
            category_summary.append({
                "category": cat,
                "article_count": len(data["articles"]),
                "total_hits": data["hits"],
                "conversion_rate_pct": round(conv, 1) if conv is not None else None,
            })
        category_summary.sort(key=lambda x: x["total_hits"], reverse=True)

        return {
            "has_data": True,
            "summary": {
                "total_articles": article_count,
                "total_hits": total_hits,
                "unique_conversations": total_unique_convs,
                "total_feedback": total_feedback,
                "overall_conversion_rate_pct": round(overall_conversion, 1) if overall_conversion is not None else None,
                "manual_corrections": correction_count,
                "hit_events_recorded": hit_count,
            },
            "high_hit_articles": high_hit,
            "low_conversion_articles": low_conversion,
            "needs_rewrite_articles": needs_rewrite,
            "by_category": category_summary,
            "generated_at": datetime.utcnow().isoformat(),
        }

    def get_article_detail(self, article_id: str) -> Dict:
        stats = self.calculator.get_article_stats(article_id)
        if not stats:
            return {"found": False}

        version_history = []
        correction_history = []
        hit_samples = []
        total_hits = 0

        with self.db.session() as session:
            versions = (
                session.query(KnowledgeArticle)
                .filter_by(article_id=article_id)
                .order_by(KnowledgeArticle.version.desc())
                .all()
            )
            for v in versions:
                version_history.append({
                    "version": v.version,
                    "title": v.title,
                    "content_preview": v.content[:200] + "..." if len(v.content) > 200 else v.content,
                    "is_active": v.is_active,
                    "updated_at": v.updated_at.isoformat() if v.updated_at else None,
                })

            corrections = (
                session.query(ManualCorrection)
                .filter_by(target_type="article", target_id=article_id)
                .order_by(ManualCorrection.created_at.desc())
                .all()
            )
            for c in corrections:
                correction_history.append({
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                    "operator": c.operator,
                    "reason": c.reason,
                    "before": c.before_value,
                    "after": c.after_value,
                })

            hits = (
                session.query(HitEvent)
                .filter_by(article_id=article_id)
                .order_by(HitEvent.occurred_at.desc())
                .limit(20)
                .all()
            )
            total_hits = session.query(HitEvent).filter_by(article_id=article_id).count()
            for h in hits:
                hit_samples.append({
                    "conversation_id": h.conversation_id,
                    "hit_type": h.hit_type,
                    "source": h.source,
                    "article_version": h.article_version,
                    "is_helpful": h.is_helpful,
                    "resolved": h.resolved,
                    "rating": h.rating,
                    "occurred_at": h.occurred_at.isoformat() if h.occurred_at else None,
                })

        return {
            "found": True,
            "article_id": article_id,
            "current_version": stats[0] if stats else None,
            "all_versions": stats,
            "version_history": version_history,
            "manual_corrections": correction_history,
            "recent_hits": hit_samples,
            "total_hits_count": total_hits,
        }

    def get_version_diff(self, article_id: str, v1: int, v2: int) -> Dict:
        art1_data = None
        art2_data = None

        with self.db.session() as session:
            art1 = (
                session.query(KnowledgeArticle)
                .filter_by(article_id=article_id, version=v1)
                .first()
            )
            art2 = (
                session.query(KnowledgeArticle)
                .filter_by(article_id=article_id, version=v2)
                .first()
            )

            if art1:
                art1_data = {
                    "title": art1.title,
                    "content": art1.content,
                    "category": art1.category,
                    "is_active": art1.is_active,
                }
            if art2:
                art2_data = {
                    "title": art2.title,
                    "content": art2.content,
                    "category": art2.category,
                    "is_active": art2.is_active,
                }

        if not art1_data or not art2_data:
            return {"found": False}

        diff = {
            "title": {
                "v1": art1_data["title"],
                "v2": art2_data["title"],
                "changed": art1_data["title"] != art2_data["title"],
            },
            "content": {
                "v1_preview": art1_data["content"][:300] + "..." if len(art1_data["content"]) > 300 else art1_data["content"],
                "v2_preview": art2_data["content"][:300] + "..." if len(art2_data["content"]) > 300 else art2_data["content"],
                "changed": art1_data["content"] != art2_data["content"],
            },
            "category": {
                "v1": art1_data["category"],
                "v2": art2_data["category"],
                "changed": art1_data["category"] != art2_data["category"],
            },
            "is_active": {
                "v1": art1_data["is_active"],
                "v2": art2_data["is_active"],
                "changed": art1_data["is_active"] != art2_data["is_active"],
            },
        }

        return {
            "found": True,
            "article_id": article_id,
            "v1": v1,
            "v2": v2,
            "diff": diff,
        }
