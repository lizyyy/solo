from __future__ import annotations
from datetime import datetime
from typing import Optional

from .models import HitResult, HitType, ReviewStatus, ReviewSession
from .errors import get_error


class Reviewer:
    def __init__(self, operator: str = "unknown"):
        self.operator = operator
        self._sessions: dict = {}

    def create_session(self, session_id: Optional[str] = None) -> ReviewSession:
        if not session_id:
            session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        session = ReviewSession(
            id=session_id,
            created_at=datetime.now(),
            operator=self.operator,
        )
        self._sessions[session_id] = session
        return session

    def review_hit(
        self,
        hit: HitResult,
        action: str,
        note: str = "",
        new_knowledge_id: Optional[str] = None,
        new_hit_type: Optional[HitType] = None,
        session_id: Optional[str] = None,
    ) -> HitResult:
        if action not in ("confirm", "override", "skip"):
            raise ValueError(f"不支持的操作类型「{action}」，可选：confirm（确认）、override（改判）、skip（跳过）")

        if action == "confirm":
            return self._confirm(hit, note, session_id)
        elif action == "override":
            return self._override(hit, note, new_knowledge_id, new_hit_type, session_id)
        else:
            return hit

    def _confirm(self, hit: HitResult, note: str, session_id: Optional[str]) -> HitResult:
        override_entry = None
        if hit.status == ReviewStatus.OVERRIDDEN and hit.override_history:
            override_entry = hit.override_history[-1]

        hit.status = ReviewStatus.CONFIRMED
        hit.reviewer_note = note
        hit.reviewed_by = self.operator
        hit.reviewed_at = datetime.now()

        if override_entry:
            hit.detail = f"已确认改判结果。原判断：{override_entry.get('original_hit_type', '未知')}"

        self._update_session(session_id, reviewed=True)
        return hit

    def _override(
        self,
        hit: HitResult,
        note: str,
        new_knowledge_id: Optional[str],
        new_hit_type: Optional[HitType],
        session_id: Optional[str],
    ) -> HitResult:
        original_record = {
            "original_hit_type": hit.hit_type.value,
            "original_knowledge_id": hit.knowledge_id,
            "original_confidence": hit.confidence,
            "original_detail": hit.detail,
            "reviewer": self.operator,
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "note": note,
        }

        if hit.override_history:
            prev = hit.override_history[-1]
            if prev.get("reviewer") and prev.get("time"):
                original_record["previous_override"] = (
                    f"{prev['reviewer']} 于 {prev['time']} 已改判"
                )

        hit.override_history.append(original_record)

        if new_hit_type is not None:
            hit.hit_type = new_hit_type
        if new_knowledge_id is not None:
            hit.knowledge_id = new_knowledge_id

        hit.status = ReviewStatus.OVERRIDDEN
        hit.reviewer_note = note
        hit.reviewed_by = self.operator
        hit.reviewed_at = datetime.now()

        override_desc = f"已改判为「{hit.hit_type.value}」"
        if new_knowledge_id:
            override_desc += f"，关联知识 {new_knowledge_id}"
        if note:
            override_desc += f"。备注：{note}"
        hit.detail = override_desc

        self._update_session(session_id, reviewed=True)
        return hit

    def batch_review(self, hits: list, action: str, note: str = "", session_id: Optional[str] = None) -> list:
        results = []
        for hit in hits:
            if hit.status == ReviewStatus.CONFIRMED and action != "override":
                continue
            result = self.review_hit(hit, action, note, session_id=session_id)
            results.append(result)
        return results

    def get_pending_hits(self, hits: list) -> list:
        return [h for h in hits if h.status == ReviewStatus.PENDING_REVIEW]

    def get_overridden_hits(self, hits: list) -> list:
        return [h for h in hits if h.status == ReviewStatus.OVERRIDDEN]

    def _update_session(self, session_id: Optional[str], reviewed: bool = True):
        if session_id and session_id in self._sessions:
            session = self._sessions[session_id]
            if reviewed:
                session.reviewed_count += 1
            session.pending_count = max(0, session.pending_count - (1 if reviewed else 0))

    def get_session(self, session_id: str) -> Optional[ReviewSession]:
        return self._sessions.get(session_id)

    def get_all_sessions(self) -> list:
        return list(self._sessions.values())

    @staticmethod
    def hits_to_dicts(hits: list) -> list:
        result = []
        for h in hits:
            d = {
                "conversation_id": h.conversation_id,
                "knowledge_id": h.knowledge_id,
                "hit_type": h.hit_type.value,
                "confidence": round(h.confidence, 4),
                "status": h.status.value,
                "reviewer_note": h.reviewer_note,
                "reviewed_by": h.reviewed_by,
                "reviewed_at": h.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if h.reviewed_at else "",
                "matched_keywords": h.matched_keywords,
                "detail": h.detail,
                "override_history": h.override_history,
            }
            result.append(d)
        return result

    @staticmethod
    def dicts_to_hits(dicts: list) -> list:
        hits = []
        for d in dicts:
            hit = HitResult(
                conversation_id=d["conversation_id"],
                knowledge_id=d.get("knowledge_id"),
                hit_type=HitType(d.get("hit_type", "miss")),
                confidence=d.get("confidence", 0.0),
                status=ReviewStatus(d.get("status", "pending_review")),
                reviewer_note=d.get("reviewer_note", ""),
                reviewed_by=d.get("reviewed_by", ""),
                reviewed_at=datetime.strptime(d["reviewed_at"], "%Y-%m-%d %H:%M:%S") if d.get("reviewed_at") else None,
                matched_keywords=d.get("matched_keywords", []),
                detail=d.get("detail", ""),
                override_history=d.get("override_history", []),
            )
            hits.append(hit)
        return hits
