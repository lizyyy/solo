import os
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from podcast_checker.config import settings
from podcast_checker.models import (
    DatabaseManager,
    init_db,
    Episode,
    EpisodeCheckResult,
    CheckStatus,
    ReviewNote,
)


def get_db() -> DatabaseManager:
    db_path = os.environ.get("PODCAST_CHECKER_DB")
    if db_path:
        return init_db(Path(db_path))
    return init_db()


app = FastAPI(
    title="播客上线前核对工具 API",
    description="本地 HTTP 接口，用于查询单集信息、添加复核备注等",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class EpisodeResponse(BaseModel):
    episode_number: int
    title: str
    publish_date: Optional[date] = None
    audio_file: Optional[str] = None
    duration_seconds: Optional[int] = None
    sponsors: List[str] = Field(default_factory=list)
    music_tracks: List[str] = Field(default_factory=list)
    cover_file: Optional[str] = None
    description: Optional[str] = None
    
    class Config:
        from_attributes = True


class IssueResponse(BaseModel):
    issue_type: str
    severity: str
    message: str
    details: Optional[Dict[str, Any]] = None
    affected_field: Optional[str] = None


class CheckResultResponse(BaseModel):
    episode_number: int
    title: str
    overall_status: str
    loudness_status: str
    ad_status: str
    music_status: str
    cover_status: str
    issues: List[IssueResponse]
    checked_at: Optional[datetime] = None
    can_publish: bool
    review_notes: List["ReviewNoteResponse"] = Field(default_factory=list)


class ReviewNoteResponse(BaseModel):
    id: Optional[int] = None
    episode_number: int
    note: str
    reviewer: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class CreateReviewNoteRequest(BaseModel):
    note: str = Field(..., min_length=1, max_length=2000)
    reviewer: Optional[str] = Field(None, max_length=100)


class UpdateReviewNoteRequest(BaseModel):
    note: str = Field(..., min_length=1, max_length=2000)


class StatisticsResponse(BaseModel):
    total_episodes: int
    status_counts: Dict[str, int]
    total_review_notes: int
    can_publish_count: int
    pass_count: int
    fail_count: int
    warning_count: int


class EpisodeListResponse(BaseModel):
    items: List[EpisodeResponse]
    total: int


class CheckResultListResponse(BaseModel):
    items: List[CheckResultResponse]
    total: int


CheckResultResponse.model_rebuild()


def model_to_response(obj: Any) -> Any:
    if hasattr(obj, "model_dump"):
        data = obj.model_dump()
        for key, value in data.items():
            if hasattr(value, "value"):
                data[key] = value.value
            elif isinstance(value, list):
                data[key] = [model_to_response(item) for item in value]
            elif isinstance(value, dict):
                data[key] = {k: model_to_response(v) for k, v in value.items()}
        return data
    elif hasattr(obj, "value"):
        return obj.value
    return obj


@app.get("/", tags=["基础"])
async def root():
    return {
        "name": "播客上线前核对工具 API",
        "version": "0.1.0",
        "docs": "/docs",
        "endpoints": [
            "/episodes",
            "/checks",
            "/statistics",
        ],
    }


@app.get("/health", tags=["基础"])
async def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.get("/episodes", tags=["剧集"], response_model=EpisodeListResponse)
async def list_episodes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: DatabaseManager = Depends(get_db),
):
    episodes = db.get_all_episodes()
    total = len(episodes)
    items = episodes[skip : skip + limit]
    return EpisodeListResponse(
        items=[EpisodeResponse.model_validate(e) for e in items],
        total=total,
    )


@app.get("/episodes/{episode_number}", tags=["剧集"], response_model=EpisodeResponse)
async def get_episode(
    episode_number: int,
    db: DatabaseManager = Depends(get_db),
):
    episode = db.get_episode(episode_number)
    if not episode:
        raise HTTPException(status_code=404, detail=f"未找到第 {episode_number} 集")
    return EpisodeResponse.model_validate(episode)


@app.get("/checks", tags=["检查结果"], response_model=CheckResultListResponse)
async def list_check_results(
    status: Optional[str] = Query(None, description="按状态过滤: pass, warning, fail, pending"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: DatabaseManager = Depends(get_db),
):
    results = db.get_all_check_results()
    
    for result in results:
        result.review_notes = db.get_review_notes(result.episode_number)
    
    if status:
        try:
            status_enum = CheckStatus(status.lower())
            results = [r for r in results if r.overall_status == status_enum]
        except ValueError:
            raise HTTPException(status_code=400, detail=f"无效的状态值: {status}")
    
    total = len(results)
    items = results[skip : skip + limit]
    
    response_items = []
    for item in items:
        data = model_to_response(item)
        data["can_publish"] = item.can_publish
        response_items.append(CheckResultResponse(**data))
    
    return CheckResultListResponse(
        items=response_items,
        total=total,
    )


@app.get("/checks/{episode_number}", tags=["检查结果"], response_model=CheckResultResponse)
async def get_check_result(
    episode_number: int,
    db: DatabaseManager = Depends(get_db),
):
    result = db.get_check_result(episode_number)
    if not result:
        raise HTTPException(status_code=404, detail=f"未找到第 {episode_number} 集的检查结果")
    
    result.review_notes = db.get_review_notes(episode_number)
    
    data = model_to_response(result)
    data["can_publish"] = result.can_publish
    return CheckResultResponse(**data)


@app.get("/statistics", tags=["统计"], response_model=StatisticsResponse)
async def get_statistics(
    db: DatabaseManager = Depends(get_db),
):
    stats = db.get_statistics()
    results = db.get_all_check_results()
    
    can_publish_count = sum(1 for r in results if r.can_publish)
    pass_count = sum(1 for r in results if r.overall_status == CheckStatus.PASS)
    fail_count = sum(1 for r in results if r.overall_status == CheckStatus.FAIL)
    warning_count = sum(1 for r in results if r.overall_status == CheckStatus.WARNING)
    
    return StatisticsResponse(
        total_episodes=stats["total_episodes"],
        status_counts=stats.get("status_counts", {}),
        total_review_notes=stats["total_review_notes"],
        can_publish_count=can_publish_count,
        pass_count=pass_count,
        fail_count=fail_count,
        warning_count=warning_count,
    )


@app.get("/notes", tags=["复核备注"], response_model=List[ReviewNoteResponse])
async def list_review_notes(
    episode_number: Optional[int] = Query(None, description="按集号过滤"),
    db: DatabaseManager = Depends(get_db),
):
    if episode_number:
        notes = db.get_review_notes(episode_number)
    else:
        notes = []
        for ep in db.get_all_episodes():
            notes.extend(db.get_review_notes(ep.episode_number))
    
    return [ReviewNoteResponse.model_validate(n) for n in notes]


@app.post("/notes/{episode_number}", tags=["复核备注"], response_model=ReviewNoteResponse)
async def create_review_note(
    episode_number: int,
    request: CreateReviewNoteRequest,
    db: DatabaseManager = Depends(get_db),
):
    episode = db.get_episode(episode_number)
    if not episode:
        raise HTTPException(status_code=404, detail=f"未找到第 {episode_number} 集")
    
    note_id = db.add_review_note(
        episode_number=episode_number,
        note=request.note,
        reviewer=request.reviewer,
    )
    
    notes = db.get_review_notes(episode_number)
    for note in notes:
        if note.id == note_id:
            return ReviewNoteResponse.model_validate(note)
    
    raise HTTPException(status_code=500, detail="创建备注失败")


@app.put("/notes/{note_id}", tags=["复核备注"], response_model=ReviewNoteResponse)
async def update_review_note(
    note_id: int,
    request: UpdateReviewNoteRequest,
    db: DatabaseManager = Depends(get_db),
):
    success = db.update_review_note(note_id, request.note)
    if not success:
        raise HTTPException(status_code=404, detail=f"未找到备注 ID: {note_id}")
    
    for ep in db.get_all_episodes():
        notes = db.get_review_notes(ep.episode_number)
        for note in notes:
            if note.id == note_id:
                return ReviewNoteResponse.model_validate(note)
    
    raise HTTPException(status_code=404, detail=f"未找到备注 ID: {note_id}")


@app.get("/publishable", tags=["发布"], response_model=CheckResultListResponse)
async def get_publishable(
    db: DatabaseManager = Depends(get_db),
):
    results = db.get_all_check_results()
    
    for result in results:
        result.review_notes = db.get_review_notes(result.episode_number)
    
    publishable = [r for r in results if r.can_publish]
    
    response_items = []
    for item in publishable:
        data = model_to_response(item)
        data["can_publish"] = item.can_publish
        response_items.append(CheckResultResponse(**data))
    
    return CheckResultListResponse(
        items=response_items,
        total=len(publishable),
    )
