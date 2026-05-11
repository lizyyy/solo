from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime
import uuid
import re
from collections import Counter

from database import get_db, engine, Base
from models import (
    KnowledgeEntry, KnowledgeVersion, QueryMatch, QueryFeedback, VersionStatus
)
from schemas import (
    KnowledgeEntryCreate, KnowledgeEntryResponse, KnowledgeVersionResponse,
    QueryRequest, QueryResponse, CandidateAnswer, AdoptRequest, RewriteRequest,
    NoAnswerRequest, PublishRequest, ExpireRequest, StatisticsResponse
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="客服知识库命中 API", version="1.0.0")

def calculate_match_score(query: str, version: KnowledgeVersion) -> int:
    score = 0
    query_lower = query.lower()
    
    if version.keywords:
        keywords = [k.strip().lower() for k in version.keywords.split(',')]
        for keyword in keywords:
            if keyword in query_lower:
                score += 30
    
    question_words = set(re.findall(r'\w+', version.question.lower()))
    query_words = set(re.findall(r'\w+', query_lower))
    common_words = question_words & query_words
    score += len(common_words) * 10
    
    return score

@app.post("/api/entries/", response_model=KnowledgeEntryResponse)
def create_entry(data: KnowledgeEntryCreate, db: Session = Depends(get_db)):
    entry = KnowledgeEntry(title=data.title)
    db.add(entry)
    db.flush()
    
    version = KnowledgeVersion(
        entry_id=entry.id,
        version_number=1,
        question=data.question,
        answer=data.answer,
        keywords=data.keywords,
        status=VersionStatus.DRAFT
    )
    db.add(version)
    db.commit()
    db.refresh(entry)
    return entry

@app.get("/api/entries/", response_model=List[KnowledgeEntryResponse])
def list_entries(db: Session = Depends(get_db)):
    entries = db.query(KnowledgeEntry).all()
    return entries

@app.get("/api/entries/{entry_id}", response_model=KnowledgeEntryResponse)
def get_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(KnowledgeEntry).filter(KnowledgeEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="知识条目不存在")
    return entry

@app.post("/api/versions/{version_id}/publish")
def publish_version(data: PublishRequest, db: Session = Depends(get_db)):
    version = db.query(KnowledgeVersion).filter(KnowledgeVersion.id == data.version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
    
    if version.status == VersionStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="该版本已发布")
    
    if version.status == VersionStatus.EXPIRED:
        raise HTTPException(status_code=400, detail="该版本已过期")
    
    old_version = db.query(KnowledgeVersion).filter(
        KnowledgeVersion.entry_id == version.entry_id,
        KnowledgeVersion.status == VersionStatus.PUBLISHED
    ).first()
    
    if old_version:
        old_version.status = VersionStatus.EXPIRED
        old_version.expired_at = datetime.utcnow()
        old_version.expiry_reason = "新版本发布替代"
    
    version.status = VersionStatus.PUBLISHED
    version.published_at = datetime.utcnow()
    
    db.commit()
    return {"message": "版本发布成功", "version_id": version.id}

@app.post("/api/versions/{version_id}/expire")
def expire_version(data: ExpireRequest, db: Session = Depends(get_db)):
    version = db.query(KnowledgeVersion).filter(KnowledgeVersion.id == data.version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
    
    if version.status == VersionStatus.EXPIRED:
        raise HTTPException(status_code=400, detail="该版本已过期")
    
    version.status = VersionStatus.EXPIRED
    version.expired_at = datetime.utcnow()
    version.expiry_reason = data.reason or "手动标记过期"
    
    db.commit()
    return {"message": "版本已标记为过期", "version_id": version.id}

@app.post("/api/query", response_model=QueryResponse)
def query_knowledge(data: QueryRequest, db: Session = Depends(get_db)):
    query_id = data.query_id or str(uuid.uuid4())
    
    published_versions = db.query(KnowledgeVersion).filter(
        KnowledgeVersion.status == VersionStatus.PUBLISHED
    ).all()
    
    candidates = []
    for version in published_versions:
        score = calculate_match_score(data.query, version)
        if score > 0:
            candidates.append({
                "entry_id": version.entry_id,
                "version_id": version.id,
                "question": version.question,
                "answer": version.answer,
                "match_score": score
            })
    
    candidates.sort(key=lambda x: x["match_score"], reverse=True)
    candidates = candidates[:3]
    
    for cand in candidates:
        existing_match = db.query(QueryMatch).filter(
            QueryMatch.query_id == query_id,
            QueryMatch.version_id == cand["version_id"]
        ).first()
        
        if not existing_match:
            match_record = QueryMatch(
                query_text=data.query,
                query_id=query_id,
                version_id=cand["version_id"],
                match_score=cand["match_score"]
            )
            db.add(match_record)
    
    db.commit()
    
    return QueryResponse(
        query_id=query_id,
        query_text=data.query,
        candidates=[CandidateAnswer(**cand) for cand in candidates],
        has_answer=len(candidates) > 0
    )

@app.post("/api/adopt")
def adopt_answer(data: AdoptRequest, db: Session = Depends(get_db)):
    match = db.query(QueryMatch).filter(
        QueryMatch.query_id == data.query_id,
        QueryMatch.version_id == data.version_id
    ).first()
    
    if not match:
        raise HTTPException(status_code=404, detail="未找到对应的匹配记录")
    
    match.is_adopted = True
    match.is_rewritten = False
    match.rewritten_answer = None
    
    db.commit()
    return {"message": "答案已采用", "query_id": data.query_id, "version_id": data.version_id}

@app.post("/api/rewrite")
def rewrite_answer(data: RewriteRequest, db: Session = Depends(get_db)):
    match = db.query(QueryMatch).filter(
        QueryMatch.query_id == data.query_id,
        QueryMatch.version_id == data.version_id
    ).first()
    
    if not match:
        raise HTTPException(status_code=404, detail="未找到对应的匹配记录")
    
    match.is_adopted = True
    match.is_rewritten = True
    match.rewritten_answer = data.rewritten_answer
    
    db.commit()
    return {
        "message": "答案已改写",
        "query_id": data.query_id,
        "version_id": data.version_id,
        "original_version_id": data.version_id
    }

@app.post("/api/no-answer")
def submit_no_answer(data: NoAnswerRequest, db: Session = Depends(get_db)):
    existing = db.query(QueryFeedback).filter(
        QueryFeedback.query_id == data.query_id
    ).first()
    
    if existing:
        return {"message": "该问题已反馈过", "query_id": data.query_id}
    
    feedback = QueryFeedback(
        query_text=data.query,
        query_id=data.query_id,
        is_no_answer=True,
        feedback_text=data.feedback
    )
    db.add(feedback)
    db.commit()
    
    return {"message": "无答案反馈已记录", "query_id": data.query_id}

@app.get("/api/statistics", response_model=StatisticsResponse)
def get_statistics(db: Session = Depends(get_db)):
    total_queries = db.query(
        func.count(QueryMatch.id)
    ).scalar()
    
    total_matches = db.query(
        func.count(QueryMatch.id)
    ).filter(
        QueryMatch.match_score > 0
    ).scalar()
    
    total_adopted = db.query(
        func.count(QueryMatch.id)
    ).filter(
        QueryMatch.is_adopted == True
    ).scalar()
    
    total_rewritten = db.query(
        func.count(QueryMatch.id)
    ).filter(
        QueryMatch.is_rewritten == True
    ).scalar()
    
    no_answer_queries = db.query(QueryFeedback).all()
    
    pending_update_entries = []
    high_rewrite_entries = db.query(
        KnowledgeVersion.entry_id,
        func.count(QueryMatch.id).label('rewrite_count')
    ).join(
        QueryMatch, QueryMatch.version_id == KnowledgeVersion.id
    ).filter(
        QueryMatch.is_rewritten == True
    ).group_by(
        KnowledgeVersion.entry_id
    ).having(
        func.count(QueryMatch.id) >= 3
    ).all()
    
    pending_update_entries = [entry[0] for entry in high_rewrite_entries]
    
    uncovered_texts = [f.query_text for f in no_answer_queries]
    counter = Counter(uncovered_texts)
    common_uncovered = [item[0] for item in counter.most_common(5)]
    
    adoption_rate = (total_adopted / total_queries) * 100 if total_queries > 0 else 0.0
    rewrite_rate = (total_rewritten / total_adopted) * 100 if total_adopted > 0 else 0.0
    hit_rate = (total_matches / total_queries) * 100 if total_queries > 0 else 0.0
    
    return StatisticsResponse(
        total_queries=total_queries,
        total_matches=total_matches,
        adoption_rate=adoption_rate,
        rewrite_rate=rewrite_rate,
        hit_rate=hit_rate,
        pending_update_entries=pending_update_entries,
        common_uncovered_queries=common_uncovered
    )
