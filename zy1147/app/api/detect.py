import time
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.core import ContentDetector, TextProcessor
from app.models import DetectionHistory, HitRecord, SensitiveWord, Synonym, Whitelist, ContextRule
from app.schemas import (
    DetectionRequest, BatchDetectionRequest,
    DetectionResponse, DetectionHitResponse, SegmentResponse,
    BatchDetectionResponse, SuccessResponse
)

router = APIRouter()

_detector: ContentDetector = None
_initialized = False


async def get_detector() -> ContentDetector:
    global _detector, _initialized
    if _detector is None:
        _detector = ContentDetector()
    if not _initialized:
        _initialized = True
    return _detector


async def reload_lexicon_cache(db: AsyncSession, detector: ContentDetector):
    result = await db.execute(select(SensitiveWord).where(SensitiveWord.is_active == True))
    sensitive_words = result.scalars().all()
    
    sensitive_words_list = []
    for sw in sensitive_words:
        sensitive_words_list.append({
            'id': sw.id,
            'word': sw.word,
            'normalized_word': sw.normalized_word,
            'category': sw.category,
            'severity': sw.severity,
            'description': sw.description,
            'suggestion': sw.suggestion,
            'pinyin': sw.pinyin,
            'is_regex': sw.is_regex
        })
    
    result = await db.execute(select(Synonym).where(Synonym.is_active == True))
    synonyms = result.scalars().all()
    synonyms_list = [
        {'normalized_synonym': s.normalized_synonym, 'sensitive_word_id': s.sensitive_word_id}
        for s in synonyms
    ]
    
    result = await db.execute(select(Whitelist).where(Whitelist.is_active == True))
    whitelist = result.scalars().all()
    whitelist_list = [
        {'normalized_term': w.normalized_term}
        for w in whitelist
    ]
    
    result = await db.execute(select(ContextRule).where(ContextRule.is_active == True))
    context_rules = result.scalars().all()
    context_rules_list = [
        {
            'rule_name': r.rule_name,
            'trigger_words': r.trigger_words,
            'context_words': r.context_words,
            'exemption_words': r.exemption_words,
            'rule_type': r.rule_type
        }
        for r in context_rules
    ]
    
    detector.load_lexicon(
        sensitive_words=sensitive_words_list,
        synonyms=synonyms_list,
        whitelist=whitelist_list,
        context_rules=context_rules_list,
        version="1.0.0"
    )


@router.post("/text", response_model=DetectionResponse)
async def detect_text(
    request: Request,
    detection_request: DetectionRequest,
    db: AsyncSession = Depends(get_db),
    detector: ContentDetector = Depends(get_detector)
):
    if not detection_request.text or not detection_request.text.strip():
        raise HTTPException(status_code=400, detail="文本不能为空")
    
    text = detection_request.text.strip()
    
    if not _initialized or not detector._sensitive_words_cache:
        await reload_lexicon_cache(db, detector)
    
    result = detector.detect(text)
    
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    
    history = DetectionHistory(
        request_id=result.request_id,
        original_text=result.original_text,
        normalized_text=result.normalized_text,
        segments=result.segments,
        is_sensitive=result.is_sensitive,
        highest_severity=result.highest_severity,
        total_hits=result.total_hits,
        processing_time_ms=result.processing_time_ms,
        client_ip=client_ip,
        user_agent=user_agent,
        review_status="pending" if result.is_sensitive else "passed",
        lexicon_version=result.lexicon_version
    )
    db.add(history)
    await db.flush()
    
    for hit in result.hits:
        hit_record = HitRecord(
            detection_id=history.id,
            sensitive_word_id=hit.sensitive_word_id,
            hit_word=hit.hit_word,
            matched_word=hit.matched_word,
            start_position=hit.start_position,
            end_position=hit.end_position,
            match_type=hit.match_type,
            category=hit.category,
            severity=hit.severity,
            description=hit.description,
            suggestion=hit.suggestion,
            context_before=hit.context_before,
            context_after=hit.context_after
        )
        db.add(hit_record)
    
    await db.commit()
    
    return DetectionResponse(
        request_id=result.request_id,
        original_text=result.original_text,
        normalized_text=result.normalized_text,
        segments=[SegmentResponse(**seg) for seg in result.segments],
        is_sensitive=result.is_sensitive,
        highest_severity=result.highest_severity,
        total_hits=result.total_hits,
        hits=[
            DetectionHitResponse(
                hit_word=h.hit_word,
                matched_word=h.matched_word,
                start_position=h.start_position,
                end_position=h.end_position,
                match_type=h.match_type,
                category=h.category,
                severity=h.severity,
                description=h.description,
                suggestion=h.suggestion,
                context_before=h.context_before,
                context_after=h.context_after,
                confidence=h.confidence,
                sensitive_word_id=h.sensitive_word_id
            )
            for h in result.hits
        ],
        processing_time_ms=result.processing_time_ms,
        lexicon_version=result.lexicon_version
    )


@router.post("/batch", response_model=BatchDetectionResponse)
async def detect_batch(
    request: Request,
    batch_request: BatchDetectionRequest,
    db: AsyncSession = Depends(get_db),
    detector: ContentDetector = Depends(get_detector)
):
    if not batch_request.texts:
        raise HTTPException(status_code=400, detail="文本列表不能为空")
    
    if not _initialized or not detector._sensitive_words_cache:
        await reload_lexicon_cache(db, detector)
    
    start_time = time.time()
    
    results = []
    sensitive_count = 0
    
    for text in batch_request.texts:
        if not text or not text.strip():
            continue
        
        result = detector.detect(text.strip())
        results.append(result)
        
        if result.is_sensitive:
            sensitive_count += 1
        
        client_ip = request.client.host if request.client else None
        
        history = DetectionHistory(
            request_id=result.request_id,
            original_text=result.original_text,
            normalized_text=result.normalized_text,
            segments=result.segments,
            is_sensitive=result.is_sensitive,
            highest_severity=result.highest_severity,
            total_hits=result.total_hits,
            processing_time_ms=result.processing_time_ms,
            client_ip=client_ip,
            review_status="pending" if result.is_sensitive else "passed",
            lexicon_version=result.lexicon_version
        )
        db.add(history)
        await db.flush()
        
        for hit in result.hits:
            hit_record = HitRecord(
                detection_id=history.id,
                sensitive_word_id=hit.sensitive_word_id,
                hit_word=hit.hit_word,
                matched_word=hit.matched_word,
                start_position=hit.start_position,
                end_position=hit.end_position,
                match_type=hit.match_type,
                category=hit.category,
                severity=hit.severity,
                description=hit.description,
                suggestion=hit.suggestion,
                context_before=hit.context_before,
                context_after=hit.context_after
            )
            db.add(hit_record)
    
    await db.commit()
    
    total_time = int((time.time() - start_time) * 1000)
    
    return BatchDetectionResponse(
        results=[
            DetectionResponse(
                request_id=r.request_id,
                original_text=r.original_text,
                normalized_text=r.normalized_text,
                segments=[SegmentResponse(**seg) for seg in r.segments],
                is_sensitive=r.is_sensitive,
                highest_severity=r.highest_severity,
                total_hits=r.total_hits,
                hits=[
                    DetectionHitResponse(
                        hit_word=h.hit_word,
                        matched_word=h.matched_word,
                        start_position=h.start_position,
                        end_position=h.end_position,
                        match_type=h.match_type,
                        category=h.category,
                        severity=h.severity,
                        description=h.description,
                        suggestion=h.suggestion,
                        context_before=h.context_before,
                        context_after=h.context_after,
                        confidence=h.confidence,
                        sensitive_word_id=h.sensitive_word_id
                    )
                    for h in r.hits
                ],
                processing_time_ms=r.processing_time_ms,
                lexicon_version=r.lexicon_version
            )
            for r in results
        ],
        total_count=len(results),
        sensitive_count=sensitive_count,
        processing_time_ms=total_time
    )


@router.post("/reload", response_model=SuccessResponse)
async def reload_lexicon(
    db: AsyncSession = Depends(get_db),
    detector: ContentDetector = Depends(get_detector)
):
    await reload_lexicon_cache(db, detector)
    stats = detector.get_lexicon_stats()
    
    return SuccessResponse(
        message="词库重新加载成功",
        data={
            "stats": stats
        }
    )


@router.get("/stats", response_model=SuccessResponse)
async def get_detector_stats(
    detector: ContentDetector = Depends(get_detector)
):
    stats = detector.get_lexicon_stats()
    
    return SuccessResponse(
        message="获取统计信息成功",
        data={
            "stats": stats
        }
    )
