from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..core.database import get_db
from ..models import Resume, ParseResult, ResumeStatus, ReviewRecord
from ..schemas import (
    ResumeListResponse, ResumeDetailResponse, ResumeUpdate,
    ParseResultResponse, ParseDiffResponse, ReviewRecordCreate,
    ReviewRecordResponse
)
from ..services.parse_service import ParseService
from ..services.match_service import MatchService
import os
import uuid

router = APIRouter(prefix="/api/resumes", tags=["resumes"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload", response_model=ResumeListResponse)
async def upload_resume(file: UploadFile = File(...), db: Session = Depends(get_db)):
    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    import hashlib
    file_hash = hashlib.md5(content).hexdigest()
    
    resume = Resume(
        filename=file.filename,
        file_path=file_path,
        file_hash=file_hash,
        status=ResumeStatus.PENDING_PARSE
    )
    
    db.add(resume)
    db.commit()
    db.refresh(resume)
    
    return resume


@router.get("/", response_model=List[ResumeListResponse])
def list_resumes(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Resume)
    
    if status:
        query = query.filter(Resume.status == status)
    
    resumes = query.order_by(Resume.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for resume in resumes:
        latest_parse = db.query(ParseResult).filter(
            ParseResult.resume_id == resume.id
        ).order_by(ParseResult.version.desc()).first()
        
        resume_dict = {
            "id": resume.id,
            "filename": resume.filename,
            "status": resume.status,
            "match_score": resume.match_score,
            "matched_job_name": resume.matched_job.name if resume.matched_job else None,
            "latest_parse_name": latest_parse.name if latest_parse else None,
            "created_at": resume.created_at,
            "updated_at": resume.updated_at
        }
        result.append(resume_dict)
    
    return result


@router.get("/{resume_id}", response_model=ResumeDetailResponse)
def get_resume_detail(resume_id: int, db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")
    
    parse_history = db.query(ParseResult).filter(
        ParseResult.resume_id == resume_id
    ).order_by(ParseResult.version.desc()).all()
    
    review_records = db.query(ReviewRecord).filter(
        ReviewRecord.resume_id == resume_id
    ).order_by(ReviewRecord.review_time.desc()).all()
    
    return {
        "id": resume.id,
        "filename": resume.filename,
        "file_path": resume.file_path,
        "status": resume.status,
        "match_score": resume.match_score,
        "matched_job": resume.matched_job,
        "latest_parse": parse_history[0] if parse_history else None,
        "parse_history": parse_history,
        "review_records": review_records,
        "created_at": resume.created_at,
        "updated_at": resume.updated_at
    }


@router.post("/{resume_id}/parse", response_model=ParseResultResponse)
def parse_resume(resume_id: int, db: Session = Depends(get_db)):
    try:
        parse_result = ParseService.parse_resume(db, resume_id)
        return parse_result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{resume_id}/match")
def match_resume(resume_id: int, job_id: Optional[int] = None, db: Session = Depends(get_db)):
    try:
        if job_id:
            score = MatchService.match_resume_to_job(db, resume_id, job_id)
            return {"match_score": score, "job_id": job_id}
        else:
            result = MatchService.auto_match_resume(db, resume_id)
            return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{resume_id}/recalculate-match")
def recalculate_match(resume_id: int, db: Session = Depends(get_db)):
    score = ParseService.recalculate_match_score(db, resume_id)
    return {"match_score": score}


@router.put("/{resume_id}", response_model=ResumeDetailResponse)
def update_resume(resume_id: int, update_data: ResumeUpdate, db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")
    
    update_dict = update_data.dict(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(resume, key, value)
    
    db.commit()
    db.refresh(resume)
    return get_resume_detail(resume_id, db)


@router.get("/{resume_id}/diff", response_model=ParseDiffResponse)
def get_parse_diff(resume_id: int, version1: Optional[int] = None, version2: Optional[int] = None, db: Session = Depends(get_db)):
    return ParseService.compare_parse_versions(db, resume_id, version1, version2)


@router.post("/{resume_id}/review", response_model=ReviewRecordResponse)
def review_resume(resume_id: int, review_data: ReviewRecordCreate, db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")
    
    if review_data.changes_made:
        parse_data = review_data.changes_made.get("parse_data", {})
        if parse_data:
            ParseService.manual_parse(db, resume_id, parse_data, review_data.reviewer)
    
    review_record = ReviewRecord(
        resume_id=resume_id,
        reviewer=review_data.reviewer,
        review_comment=review_data.review_comment,
        changes_made=review_data.changes_made
    )
    
    db.add(review_record)
    db.commit()
    db.refresh(review_record)
    
    return review_record
