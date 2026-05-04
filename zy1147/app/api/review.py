from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.core.text_processor import TextProcessor
from app.models import DetectionHistory, HitRecord, ReviewRecord, Whitelist, SensitiveWord
from app.schemas import (
    ReviewRequest, ReviewResponse,
    FalsePositiveRequest, ConfirmSensitiveRequest,
    SuccessResponse
)

router = APIRouter()
text_processor = TextProcessor()


@router.post("/submit", response_model=ReviewResponse)
async def submit_review(
    review_data: ReviewRequest,
    db: AsyncSession = Depends(get_db)
):
    history_result = await db.execute(
        select(DetectionHistory).where(DetectionHistory.id == review_data.detection_id)
    )
    history = history_result.scalar_one_or_none()
    
    if not history:
        raise HTTPException(status_code=404, detail="检测记录不存在")
    
    hit_record = None
    if review_data.hit_record_id:
        hit_result = await db.execute(
            select(HitRecord).where(HitRecord.id == review_data.hit_record_id)
        )
        hit_record = hit_result.scalar_one_or_none()
    
    review = ReviewRecord(
        detection_id=review_data.detection_id,
        hit_record_id=review_data.hit_record_id,
        review_type="manual",
        review_result=review_data.review_result,
        reviewer=review_data.reviewer,
        comment=review_data.comment
    )
    
    if review_data.review_result == "false_positive":
        history.review_status = "false_positive"
        
        if hit_record:
            hit_record.is_false_positive = True
            hit_record.false_positive_reason = review_data.comment
        
        if review_data.add_to_whitelist and hit_record:
            term = hit_record.hit_word
            normalized_term = text_processor.normalize(term)
            
            existing = await db.execute(
                select(Whitelist).where(Whitelist.normalized_term == normalized_term)
            )
            if not existing.scalar_one_or_none():
                whitelist_item = Whitelist(
                    term=term,
                    normalized_term=normalized_term,
                    reason=review_data.comment or "人工复核标记为误报"
                )
                db.add(whitelist_item)
                review.added_to_whitelist = True
                review.whitelist_term = term
    
    elif review_data.review_result == "confirmed":
        history.review_status = "confirmed"
        
        if review_data.add_to_sensitive_words and hit_record:
            word = hit_record.hit_word
            normalized_word = text_processor.normalize(word)
            pinyin = text_processor.to_pinyin(normalized_word)
            
            existing = await db.execute(
                select(SensitiveWord).where(SensitiveWord.normalized_word == normalized_word)
            )
            if not existing.scalar_one_or_none():
                new_word = SensitiveWord(
                    word=word,
                    normalized_word=normalized_word,
                    pinyin=pinyin,
                    category=hit_record.category,
                    severity=hit_record.severity,
                    description=review_data.comment or "人工复核确认添加"
                )
                db.add(new_word)
                review.added_to_sensitive_words = True
                review.sensitive_word = word
    
    elif review_data.review_result == "needs_review":
        history.review_status = "needs_review"
    
    history.reviewed_by = review_data.reviewer
    history.reviewed_at = datetime.utcnow()
    
    db.add(review)
    await db.commit()
    await db.refresh(review)
    
    return ReviewResponse.model_validate(review)


@router.post("/false-positive", response_model=SuccessResponse)
async def mark_false_positive(
    request: FalsePositiveRequest,
    db: AsyncSession = Depends(get_db)
):
    history_result = await db.execute(
        select(DetectionHistory).where(DetectionHistory.id == request.detection_id)
    )
    history = history_result.scalar_one_or_none()
    
    if not history:
        raise HTTPException(status_code=404, detail="检测记录不存在")
    
    hit_record = None
    if request.hit_record_id:
        hit_result = await db.execute(
            select(HitRecord).where(HitRecord.id == request.hit_record_id)
        )
        hit_record = hit_result.scalar_one_or_none()
    
    history.review_status = "false_positive"
    history.reviewed_by = request.reviewer
    history.reviewed_at = datetime.utcnow()
    
    if hit_record:
        hit_record.is_false_positive = True
        hit_record.false_positive_reason = request.reason
    
    if request.add_to_whitelist and hit_record:
        term = hit_record.hit_word
        normalized_term = text_processor.normalize(term)
        
        existing = await db.execute(
            select(Whitelist).where(Whitelist.normalized_term == normalized_term)
        )
        if not existing.scalar_one_or_none():
            whitelist_item = Whitelist(
                term=term,
                normalized_term=normalized_term,
                reason=request.reason
            )
            db.add(whitelist_item)
    
    review = ReviewRecord(
        detection_id=request.detection_id,
        hit_record_id=request.hit_record_id,
        review_type="false_positive",
        review_result="false_positive",
        reviewer=request.reviewer,
        comment=request.reason,
        added_to_whitelist=request.add_to_whitelist,
        whitelist_term=hit_record.hit_word if hit_record and request.add_to_whitelist else None
    )
    db.add(review)
    
    await db.commit()
    
    return SuccessResponse(
        message="标记误报成功",
        data={
            "added_to_whitelist": request.add_to_whitelist
        }
    )


@router.post("/confirm-sensitive", response_model=SuccessResponse)
async def confirm_sensitive(
    request: ConfirmSensitiveRequest,
    db: AsyncSession = Depends(get_db)
):
    history_result = await db.execute(
        select(DetectionHistory).where(DetectionHistory.id == request.detection_id)
    )
    history = history_result.scalar_one_or_none()
    
    if not history:
        raise HTTPException(status_code=404, detail="检测记录不存在")
    
    history.review_status = "confirmed"
    history.reviewed_by = request.reviewer
    history.reviewed_at = datetime.utcnow()
    
    added_word = None
    if request.add_to_sensitive_words:
        word = request.new_sensitive_word
        if not word and request.hit_record_id:
            hit_result = await db.execute(
                select(HitRecord).where(HitRecord.id == request.hit_record_id)
            )
            hit_record = hit_result.scalar_one_or_none()
            if hit_record:
                word = hit_record.hit_word
        
        if word:
            normalized_word = text_processor.normalize(word)
            pinyin = text_processor.to_pinyin(normalized_word)
            
            existing = await db.execute(
                select(SensitiveWord).where(SensitiveWord.normalized_word == normalized_word)
            )
            if not existing.scalar_one_or_none():
                new_word = SensitiveWord(
                    word=word,
                    normalized_word=normalized_word,
                    pinyin=pinyin,
                    category=history.highest_severity or "other",
                    severity="medium"
                )
                db.add(new_word)
                added_word = word
    
    review = ReviewRecord(
        detection_id=request.detection_id,
        hit_record_id=request.hit_record_id,
        review_type="confirmation",
        review_result="confirmed",
        reviewer=request.reviewer,
        comment=request.comment,
        added_to_sensitive_words=request.add_to_sensitive_words,
        sensitive_word=added_word
    )
    db.add(review)
    
    await db.commit()
    
    return SuccessResponse(
        message="确认敏感内容成功",
        data={
            "added_to_lexicon": added_word is not None,
            "new_word": added_word
        }
    )


@router.get("/list", response_model=list)
async def list_reviews(
    detection_id: Optional[int] = None,
    review_result: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(ReviewRecord)
    
    if detection_id:
        query = query.where(ReviewRecord.detection_id == detection_id)
    if review_result:
        query = query.where(ReviewRecord.review_result == review_result)
    
    query = query.order_by(ReviewRecord.created_at.desc())
    
    result = await db.execute(query)
    reviews = result.scalars().all()
    
    return [ReviewResponse.model_validate(r) for r in reviews]
