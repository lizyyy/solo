from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List
from datetime import datetime, timedelta
import re

from database import engine, get_db, Base
from models import (
    User, ArticleVersion, Feedback, RevisionDraft,
    UserRole, ArticleStatus, FeedbackType
)
from schemas import (
    UserCreate, User as UserSchema,
    ArticleVersionCreate, ArticleVersionUpdate, ArticleVersion as ArticleVersionSchema,
    FeedbackCreate, Feedback as FeedbackSchema,
    RevisionDraftCreate, RevisionDraft as RevisionDraftSchema,
    FeedbackTrendResponse, FeedbackTrendItem
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="知识库反馈闭环API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FORBIDDEN_KEYWORDS = ["敏感词1", "敏感词2", "违规内容", "垃圾信息", "广告"]
MIN_CONTENT_LENGTH = 50
MAX_CONTENT_LENGTH = 10000


def validate_content(content: str) -> tuple[bool, str]:
    """内容审核规则"""
    if len(content) < MIN_CONTENT_LENGTH:
        return False, f"内容长度不足，最少需要{MIN_CONTENT_LENGTH}字符"
    
    if len(content) > MAX_CONTENT_LENGTH:
        return False, f"内容长度超过限制，最多允许{MAX_CONTENT_LENGTH}字符"
    
    for keyword in FORBIDDEN_KEYWORDS:
        if keyword in content:
            return False, f"内容包含违禁关键词: {keyword}"
    
    if re.search(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', content):
        return False, "内容不允许包含外部链接"
    
    return True, ""


def get_current_user(x_user_id: int = Header(None), db: Session = Depends(get_db)):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="未提供用户ID")
    
    user = db.query(User).filter(User.id == x_user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user


def require_roles(allowed_roles: List[UserRole]):
    def role_dependency(user: User = Depends(get_current_user)):
        if user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail=f"权限不足，需要角色: {', '.join([r.value for r in allowed_roles])}")
        return user
    return role_dependency


@app.post("/api/users/", response_model=UserSchema)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="用户名已存在")
    db_user = User(username=user.username, role=user.role)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@app.get("/api/users/", response_model=List[UserSchema])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).all()


@app.post("/api/articles/", response_model=ArticleVersionSchema)
def create_article(
    article: ArticleVersionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles([UserRole.ANALYST, UserRole.ADMIN]))
):
    db_article = ArticleVersion(
        article_id=article.article_id,
        version=article.version,
        title=article.title,
        original_content=article.original_content,
        created_by=user.id,
        status=ArticleStatus.DRAFT
    )
    db.add(db_article)
    db.commit()
    db.refresh(db_article)
    return db_article


@app.get("/api/articles/", response_model=List[ArticleVersionSchema])
def list_articles(
    article_id: str = None,
    status: ArticleStatus = None,
    db: Session = Depends(get_db)
):
    query = db.query(ArticleVersion)
    if article_id:
        query = query.filter(ArticleVersion.article_id == article_id)
    if status:
        query = query.filter(ArticleVersion.status == status)
    return query.order_by(ArticleVersion.created_at.desc()).all()


@app.get("/api/articles/{article_version_id}", response_model=ArticleVersionSchema)
def get_article(article_version_id: int, db: Session = Depends(get_db)):
    article = db.query(ArticleVersion).filter(ArticleVersion.id == article_version_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="文章版本不存在")
    return article


@app.put("/api/articles/{article_version_id}", response_model=ArticleVersionSchema)
def update_article(
    article_version_id: int,
    update: ArticleVersionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles([UserRole.PROCESSOR, UserRole.ADMIN]))
):
    article = db.query(ArticleVersion).filter(ArticleVersion.id == article_version_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="文章版本不存在")
    
    if update.processed_content:
        is_valid, reason = validate_content(update.processed_content)
        if not is_valid:
            article.status = ArticleStatus.BLOCKED
            article.block_reason = reason
            article.processor_id = user.id
            db.commit()
            db.refresh(article)
            return article
    
    if update.processed_content:
        article.processed_content = update.processed_content
    if update.status:
        article.status = update.status
    if update.block_reason:
        article.block_reason = update.block_reason
    article.processor_id = user.id
    
    if update.status == ArticleStatus.PUBLISHED:
        article.published_at = datetime.now()
    
    db.commit()
    db.refresh(article)
    return article


@app.post("/api/articles/{article_version_id}/rollback", response_model=ArticleVersionSchema)
def rollback_article(
    article_version_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles([UserRole.ADMIN]))
):
    article = db.query(ArticleVersion).filter(ArticleVersion.id == article_version_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="文章版本不存在")
    
    article.status = ArticleStatus.ROLLBACKED
    article.block_reason = "管理员回滚"
    db.commit()
    db.refresh(article)
    return article


@app.post("/api/articles/{article_version_id}/retry", response_model=ArticleVersionSchema)
def retry_article(
    article_version_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles([UserRole.PROCESSOR, UserRole.ADMIN]))
):
    article = db.query(ArticleVersion).filter(ArticleVersion.id == article_version_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="文章版本不存在")
    
    if article.status != ArticleStatus.BLOCKED:
        raise HTTPException(status_code=400, detail="只有被拦截的文章才能重试")
    
    article.status = ArticleStatus.PENDING_REVIEW
    article.block_reason = None
    article.processor_id = user.id
    db.commit()
    db.refresh(article)
    return article


@app.post("/api/feedbacks/", response_model=FeedbackSchema)
def create_feedback(feedback: FeedbackCreate, db: Session = Depends(get_db)):
    article = db.query(ArticleVersion).filter(ArticleVersion.id == feedback.article_version_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="文章版本不存在")
    
    db_feedback = Feedback(
        article_version_id=feedback.article_version_id,
        user_comment=feedback.user_comment,
        feedback_type=feedback.feedback_type,
        rating=feedback.rating
    )
    db.add(db_feedback)
    db.commit()
    db.refresh(db_feedback)
    return db_feedback


@app.get("/api/articles/{article_version_id}/feedbacks/", response_model=List[FeedbackSchema])
def list_article_feedbacks(article_version_id: int, db: Session = Depends(get_db)):
    return db.query(Feedback).filter(Feedback.article_version_id == article_version_id).order_by(Feedback.created_at.desc()).all()


@app.get("/api/articles/{article_id}/feedback-trend", response_model=FeedbackTrendResponse)
def get_feedback_trend(article_id: str, days: int = 7, db: Session = Depends(get_db)):
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    article_versions = db.query(ArticleVersion.id).filter(ArticleVersion.article_id == article_id).subquery()
    
    trends = []
    for i in range(days):
        current_date = start_date + timedelta(days=i)
        next_date = current_date + timedelta(days=1)
        
        day_feedbacks = db.query(Feedback).filter(
            and_(
                Feedback.article_version_id.in_(article_versions),
                Feedback.created_at >= current_date,
                Feedback.created_at < next_date
            )
        ).all()
        
        positive = sum(1 for f in day_feedbacks if f.feedback_type == FeedbackType.POSITIVE)
        neutral = sum(1 for f in day_feedbacks if f.feedback_type == FeedbackType.NEUTRAL)
        negative = sum(1 for f in day_feedbacks if f.feedback_type == FeedbackType.NEGATIVE)
        
        trends.append(FeedbackTrendItem(
            date=current_date.strftime("%Y-%m-%d"),
            positive=positive,
            neutral=neutral,
            negative=negative
        ))
    
    return FeedbackTrendResponse(article_id=article_id, trends=trends)


@app.post("/api/revision-drafts/", response_model=RevisionDraftSchema)
def create_revision_draft(
    draft: RevisionDraftCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles([UserRole.PROCESSOR, UserRole.ADMIN]))
):
    article = db.query(ArticleVersion).filter(ArticleVersion.id == draft.article_version_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="文章版本不存在")
    
    is_valid, reason = validate_content(draft.content)
    is_dirty = 0 if is_valid else 1
    
    db_draft = RevisionDraft(
        article_version_id=draft.article_version_id,
        content=draft.content,
        is_dirty=is_dirty,
        block_reason=reason if not is_valid else None,
        created_by=user.id
    )
    db.add(db_draft)
    db.commit()
    db.refresh(db_draft)
    
    if is_dirty:
        article.status = ArticleStatus.BLOCKED
        article.block_reason = reason
        db.commit()
    
    return db_draft


@app.get("/api/revision-drafts/", response_model=List[RevisionDraftSchema])
def list_revision_drafts(
    article_version_id: int = None,
    is_dirty: int = None,
    db: Session = Depends(get_db)
):
    query = db.query(RevisionDraft)
    if article_version_id:
        query = query.filter(RevisionDraft.article_version_id == article_version_id)
    if is_dirty is not None:
        query = query.filter(RevisionDraft.is_dirty == is_dirty)
    return query.order_by(RevisionDraft.created_at.desc()).all()


@app.get("/api/stats/")
def get_stats(db: Session = Depends(get_db)):
    return {
        "total_articles": db.query(ArticleVersion).count(),
        "total_feedbacks": db.query(Feedback).count(),
        "blocked_articles": db.query(ArticleVersion).filter(ArticleVersion.status == ArticleStatus.BLOCKED).count(),
        "published_articles": db.query(ArticleVersion).filter(ArticleVersion.status == ArticleStatus.PUBLISHED).count(),
        "dirty_drafts": db.query(RevisionDraft).filter(RevisionDraft.is_dirty == 1).count()
    }
