from __future__ import annotations
from collections import Counter
from datetime import datetime
from typing import Optional

from .models import (
    Conversation, KnowledgeItem, HitResult, HitType, ReviewStatus,
    ConversationSource,
)
from .errors import get_error


class AnalysisWarning:
    def __init__(self, conversation_id: str, code: str, **kwargs):
        self.conversation_id = conversation_id
        self.message = get_error(code, **kwargs)
        self.code = code


class AnalysisResult:
    def __init__(self):
        self.hits: list = []
        self.warnings: list = []
        self.stats = {
            "total": 0,
            "exact": 0,
            "partial": 0,
            "miss": 0,
            "duplicate": 0,
            "boundary": 0,
            "pending_review": 0,
            "low_confidence": 0,
        }

    def _recalc_stats(self):
        self.stats = {
            "total": len(self.hits),
            "exact": 0, "partial": 0, "miss": 0,
            "duplicate": 0, "boundary": 0,
            "pending_review": 0, "low_confidence": 0,
        }
        for h in self.hits:
            self.stats[h.hit_type.value] += 1
            if h.status == ReviewStatus.PENDING_REVIEW:
                self.stats["pending_review"] += 1
            if h.confidence < 0.6:
                self.stats["low_confidence"] += 1


class Analyzer:
    CONFIDENCE_THRESHOLD_EXACT = 0.8
    CONFIDENCE_THRESHOLD_PARTIAL = 0.5
    CONFIDENCE_THRESHOLD_LOW = 0.3

    def __init__(self, knowledge_items: list, previous_overrides: Optional[dict] = None):
        self.knowledge_items = knowledge_items
        self.kb_by_id = {kb.id: kb for kb in knowledge_items}
        self.kb_index = self._build_index()
        self.previous_overrides = previous_overrides or {}

    def _build_index(self) -> dict:
        index = {}
        for kb in self.knowledge_items:
            if not kb.active:
                continue
            for kw in kb.keywords:
                kw_lower = kw.lower().strip()
                if kw_lower:
                    index.setdefault(kw_lower, []).append(kb.id)
            title_words = [w.strip().lower() for w in kb.title.split() if len(w.strip()) > 1]
            for w in title_words:
                index.setdefault(w, []).append(kb.id)
        return index

    def analyze(self, conversations: list) -> AnalysisResult:
        result = AnalysisResult()

        if not self.knowledge_items:
            result.warnings.append(AnalysisWarning("", "NO_ACTIVE_KB"))

        active_kb = [kb for kb in self.knowledge_items if kb.active]
        if not active_kb and self.knowledge_items:
            result.warnings.append(AnalysisWarning("", "NO_ACTIVE_KB"))

        for conv in conversations:
            hit = self._analyze_single(conv, result)
            if hit:
                result.hits.append(hit)

        result._recalc_stats()
        return result

    def _analyze_single(self, conv: Conversation, result: AnalysisResult) -> Optional[HitResult]:
        if conv.source == ConversationSource.MISSING_KB:
            return self._handle_missing_kb(conv, result)
        if conv.source == ConversationSource.DUPLICATE_OVERRIDE:
            return self._handle_duplicate_override(conv, result)
        if conv.source == ConversationSource.BOUNDARY:
            return self._handle_boundary(conv, result)

        text = self._extract_text(conv)
        if not text.strip():
            result.warnings.append(
                AnalysisWarning(conv.id, "MISSING_FIELD", field="对话内容")
            )
            return HitResult(
                conversation_id=conv.id,
                knowledge_id=None,
                hit_type=HitType.MISS,
                confidence=0.0,
                detail="对话内容为空，无法分析",
            )

        matches = self._match_knowledge(text)

        if not matches:
            result.warnings.append(
                AnalysisWarning(conv.id, "MISSING_KB_FOR_CONV")
            )
            return HitResult(
                conversation_id=conv.id,
                knowledge_id=None,
                hit_type=HitType.MISS,
                confidence=0.0,
                detail=get_error("MISSING_KB_FOR_CONV"),
            )

        best_kb_id, best_score, matched_keywords = matches[0]

        if len(matches) > 1 and matches[0][1] - matches[1][1] < 0.15:
            result.warnings.append(
                AnalysisWarning(conv.id, "MULTIPLE_MATCH", count=len(matches))
            )
            hit_type = HitType.BOUNDARY
            detail = get_error("MULTIPLE_MATCH", count=len(matches))
        elif best_score >= self.CONFIDENCE_THRESHOLD_EXACT:
            hit_type = HitType.EXACT
            detail = "精确匹配"
        elif best_score >= self.CONFIDENCE_THRESHOLD_PARTIAL:
            hit_type = HitType.PARTIAL
            detail = "部分匹配，建议人工确认"
        else:
            hit_type = HitType.MISS
            detail = "匹配度太低，可能是知识库缺少相关内容"
            result.warnings.append(
                AnalysisWarning(conv.id, "MISSING_KB_FOR_CONV")
            )

        if best_score < 0.6 and hit_type != HitType.MISS:
            result.warnings.append(
                AnalysisWarning(conv.id, "LOW_CONFIDENCE", confidence=best_score)
            )

        status = ReviewStatus.PENDING_REVIEW
        if hit_type == HitType.EXACT and best_score >= 0.9:
            status = ReviewStatus.AUTO

        if conv.manual_label:
            status = ReviewStatus.PENDING_REVIEW

        override_info = self.previous_overrides.get(conv.id)
        override_history = []
        if override_info:
            override_history.append(override_info)

        return HitResult(
            conversation_id=conv.id,
            knowledge_id=best_kb_id,
            hit_type=hit_type,
            confidence=best_score,
            status=status,
            matched_keywords=matched_keywords,
            detail=detail,
            override_history=override_history,
        )

    def _handle_missing_kb(self, conv: Conversation, result: AnalysisResult) -> HitResult:
        result.warnings.append(AnalysisWarning(conv.id, "MISSING_KB_FOR_CONV"))
        override_history = []
        override_info = self.previous_overrides.get(conv.id)
        if override_info:
            override_history.append(override_info)

        return HitResult(
            conversation_id=conv.id,
            knowledge_id=None,
            hit_type=HitType.MISS,
            confidence=0.0,
            status=ReviewStatus.PENDING_REVIEW,
            detail=get_error("MISSING_KB_FOR_CONV"),
            override_history=override_history,
        )

    def _handle_duplicate_override(self, conv: Conversation, result: AnalysisResult) -> HitResult:
        override_info = self.previous_overrides.get(conv.id)
        override_history = []
        if override_info:
            override_history.append(override_info)
            result.warnings.append(
                AnalysisWarning(
                    conv.id, "DUPLICATE_OVERRIDE",
                    prev_reviewer=override_info.get("reviewer", "未知"),
                    prev_time=override_info.get("time", "未知时间"),
                )
            )

        text = self._extract_text(conv)
        matches = self._match_knowledge(text) if text.strip() else []

        if matches:
            best_kb_id, best_score, matched_keywords = matches[0]
        else:
            best_kb_id = None
            best_score = 0.0
            matched_keywords = []

        return HitResult(
            conversation_id=conv.id,
            knowledge_id=best_kb_id,
            hit_type=HitType.DUPLICATE,
            confidence=best_score,
            status=ReviewStatus.PENDING_REVIEW,
            matched_keywords=matched_keywords,
            detail=get_error("DUPLICATE_OVERRIDE",
                             prev_reviewer=override_info.get("reviewer", "未知") if override_info else "未知",
                             prev_time=override_info.get("time", "未知时间") if override_info else "未知时间"),
            override_history=override_history,
        )

    def _handle_boundary(self, conv: Conversation, result: AnalysisResult) -> HitResult:
        result.warnings.append(AnalysisWarning(conv.id, "BOUNDARY_AMBIGUOUS"))

        text = self._extract_text(conv)
        matches = self._match_knowledge(text) if text.strip() else []

        if matches:
            best_kb_id, best_score, matched_keywords = matches[0]
            if len(matches) > 1:
                result.warnings.append(
                    AnalysisWarning(conv.id, "MULTIPLE_MATCH", count=len(matches))
                )
        else:
            best_kb_id = None
            best_score = 0.0
            matched_keywords = []

        override_history = []
        override_info = self.previous_overrides.get(conv.id)
        if override_info:
            override_history.append(override_info)

        return HitResult(
            conversation_id=conv.id,
            knowledge_id=best_kb_id,
            hit_type=HitType.BOUNDARY,
            confidence=best_score,
            status=ReviewStatus.PENDING_REVIEW,
            matched_keywords=matched_keywords,
            detail=get_error("BOUNDARY_AMBIGUOUS"),
            override_history=override_history,
        )

    def _extract_text(self, conv: Conversation) -> str:
        parts = []
        for msg in conv.messages:
            parts.append(msg.content)
        return " ".join(parts)

    def _match_knowledge(self, text: str) -> list:
        if not text.strip():
            return []

        text_lower = text.lower()
        word_set = set(text_lower.split())

        scores: dict = {}
        matched_keywords_map: dict = {}

        for kw, kb_ids in self.kb_index.items():
            if kw in text_lower or kw in word_set:
                for kb_id in kb_ids:
                    scores[kb_id] = scores.get(kb_id, 0) + 1
                    matched_keywords_map.setdefault(kb_id, []).append(kw)

        if not scores:
            for kb in self.knowledge_items:
                if not kb.active:
                    continue
                content_lower = kb.content.lower()
                overlap = sum(1 for w in word_set if w in content_lower and len(w) > 1)
                if overlap > 0:
                    scores[kb.id] = overlap * 0.3
                    matched_keywords_map[kb.id] = [w for w in word_set if w in content_lower and len(w) > 1][:5]

        total_keywords = sum(len(kb.keywords) for kb in self.knowledge_items if kb.active)
        results = []
        for kb_id, raw_score in scores.items():
            kb = self.kb_by_id.get(kb_id)
            if not kb or not kb.active:
                continue
            kb_keyword_count = max(len(kb.keywords), 1)
            confidence = min(raw_score / kb_keyword_count, 1.0)
            if total_keywords > 0:
                confidence = confidence * 0.7 + (raw_score / max(total_keywords, 1)) * 0.3
            confidence = min(confidence, 1.0)
            results.append((kb_id, confidence, matched_keywords_map.get(kb_id, [])))

        results.sort(key=lambda x: x[1], reverse=True)
        return results
