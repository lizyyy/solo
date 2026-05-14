from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional, Dict, Any
import uuid
import json

from ..models import OAuthSession, CallbackLog, TokenExchange, TimelineEvent
from ..schemas import (
    OAuthSessionCreate, OAuthSessionUpdate,
    CallbackLogCreate, TokenExchangeCreate, TokenExchangeUpdate,
    TimelineEventCreate
)

STATUS_PATHS = ["success", "blocked", "compensation", "review", "pending"]


def generate_state() -> str:
    return f"oauth_{uuid.uuid4().hex[:16]}"


def create_session(db: Session, session_data: OAuthSessionCreate) -> OAuthSession:
    db_session = OAuthSession(**session_data.model_dump())
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    
    add_timeline_event(db, TimelineEventCreate(
        session_id=db_session.id,
        event_type="session_created",
        title="会话创建",
        description="OAuth调试会话已创建",
        data={"state": db_session.state, "client_id": db_session.client_id},
        status="pending",
        path="pending"
    ))
    
    return db_session


def get_session_by_state(db: Session, state: str) -> Optional[OAuthSession]:
    return db.query(OAuthSession).filter(OAuthSession.state == state).first()


def get_session_by_id(db: Session, session_id: int) -> Optional[OAuthSession]:
    return db.query(OAuthSession).filter(OAuthSession.id == session_id).first()


def get_all_sessions(db: Session, skip: int = 0, limit: int = 100) -> List[OAuthSession]:
    return db.query(OAuthSession).order_by(OAuthSession.created_at.desc()).offset(skip).limit(limit).all()


def update_session_status(db: Session, session_id: int, update_data: OAuthSessionUpdate) -> Optional[OAuthSession]:
    db_session = get_session_by_id(db, session_id)
    if db_session:
        for key, value in update_data.model_dump(exclude_unset=True).items():
            setattr(db_session, key, value)
        db_session.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_session)
    return db_session


def create_callback_log(db: Session, callback_data: CallbackLogCreate) -> CallbackLog:
    db_callback = CallbackLog(**callback_data.model_dump())
    db.add(db_callback)
    db.commit()
    db.refresh(db_callback)
    
    session = get_session_by_state(db, callback_data.state)
    if session:
        db_callback.session_id = session.id
        db.commit()
        
        if callback_data.error:
            path = "blocked"
            status = "failed"
            title = "回调被拦截"
        elif callback_data.code:
            path = "success"
            status = "success"
            title = "回调成功"
        else:
            path = "review"
            status = "pending"
            title = "回调需要人工复核"
        
        add_timeline_event(db, TimelineEventCreate(
            session_id=session.id,
            event_type="callback_received",
            title=title,
            description=f"收到OAuth回调，state={callback_data.state}",
            data={"has_code": bool(callback_data.code), "error": callback_data.error},
            status=status,
            path=path
        ))
        
        update_session_status(db, session.id, OAuthSessionUpdate(
            status=status,
            status_path=path,
            error_message=callback_data.error_description
        ))
    
    return db_callback


def get_callbacks_by_session(db: Session, session_id: int) -> List[CallbackLog]:
    return db.query(CallbackLog).filter(CallbackLog.session_id == session_id).order_by(CallbackLog.received_at.desc()).all()


def create_token_exchange(db: Session, exchange_data: TokenExchangeCreate) -> TokenExchange:
    db_exchange = TokenExchange(**exchange_data.model_dump())
    db.add(db_exchange)
    db.commit()
    db.refresh(db_exchange)
    
    session = get_session_by_state(db, exchange_data.state)
    if session:
        db_exchange.session_id = session.id
        db.commit()
        
        add_timeline_event(db, TimelineEventCreate(
            session_id=session.id,
            event_type="token_exchange_started",
            title="Token交换开始",
            description="开始进行Token交换请求",
            data={"grant_type": exchange_data.grant_type},
            status="processing",
            path="pending"
        ))
    
    return db_exchange


def update_token_exchange(db: Session, exchange_id: int, update_data: TokenExchangeUpdate) -> Optional[TokenExchange]:
    db_exchange = db.query(TokenExchange).filter(TokenExchange.id == exchange_id).first()
    if db_exchange:
        for key, value in update_data.model_dump(exclude_unset=True).items():
            setattr(db_exchange, key, value)
        db.commit()
        db.refresh(db_exchange)
        
        if db_exchange.session_id:
            if db_exchange.success:
                path = "success"
                status = "completed"
                title = "Token交换成功"
            elif db_exchange.error:
                path = "compensation"
                status = "failed"
                title = "Token交换失败 - 进入补偿流程"
            else:
                path = "review"
                status = "pending"
                title = "Token交换需要人工复核"
            
            add_timeline_event(db, TimelineEventCreate(
                session_id=db_exchange.session_id,
                event_type="token_exchange_completed",
                title=title,
                description=f"Token交换已完成，状态：{'成功' if db_exchange.success else '失败'}",
                data={"success": db_exchange.success, "error": db_exchange.error},
                status=status,
                path=path
            ))
            
            update_session_status(db, db_exchange.session_id, OAuthSessionUpdate(
                status=status,
                status_path=path,
                error_message=db_exchange.error_description
            ))
    
    return db_exchange


def get_token_exchanges_by_session(db: Session, session_id: int) -> List[TokenExchange]:
    return db.query(TokenExchange).filter(TokenExchange.session_id == session_id).order_by(TokenExchange.requested_at.desc()).all()


def add_timeline_event(db: Session, event_data: TimelineEventCreate) -> TimelineEvent:
    db_event = TimelineEvent(**event_data.model_dump())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


def get_timeline_by_session(db: Session, session_id: int) -> List[TimelineEvent]:
    return db.query(TimelineEvent).filter(TimelineEvent.session_id == session_id).order_by(TimelineEvent.timestamp.asc()).all()


def recalculate_session_status(db: Session, session_id: int) -> Optional[OAuthSession]:
    session = get_session_by_id(db, session_id)
    if not session:
        return None
    
    callbacks = get_callbacks_by_session(db, session_id)
    token_exchanges = get_token_exchanges_by_session(db, session_id)
    
    has_error_callback = any(cb.error for cb in callbacks)
    has_success_callback = any(cb.code for cb in callbacks)
    has_successful_token = any(te.success for te in token_exchanges)
    has_failed_token = any(te.error for te in token_exchanges)
    
    db.query(TimelineEvent).filter(TimelineEvent.session_id == session_id).delete()
    db.commit()
    
    add_timeline_event(db, TimelineEventCreate(
        session_id=session.id,
        event_type="session_created",
        title="会话创建",
        description="OAuth调试会话已创建",
        data={"state": session.state, "client_id": session.client_id},
        status="pending",
        path="pending"
    ))
    
    for cb in callbacks:
        if cb.error:
            path = "blocked"
            status = "failed"
            title = "回调被拦截"
        elif cb.code:
            path = "success"
            status = "success"
            title = "回调成功"
        else:
            path = "review"
            status = "pending"
            title = "回调需要人工复核"
        
        add_timeline_event(db, TimelineEventCreate(
            session_id=session.id,
            event_type="callback_received",
            title=title,
            description=f"收到OAuth回调，state={cb.state}",
            data={"has_code": bool(cb.code), "error": cb.error},
            status=status,
            path=path
        ))
    
    for te in token_exchanges:
        add_timeline_event(db, TimelineEventCreate(
            session_id=session.id,
            event_type="token_exchange_started",
            title="Token交换开始",
            description="开始进行Token交换请求",
            data={"grant_type": te.grant_type},
            status="processing",
            path="pending"
        ))
        
        if te.success:
            path = "success"
            status = "completed"
            title = "Token交换成功"
        elif te.error:
            path = "compensation"
            status = "failed"
            title = "Token交换失败 - 进入补偿流程"
        else:
            path = "review"
            status = "pending"
            title = "Token交换需要人工复核"
        
        add_timeline_event(db, TimelineEventCreate(
            session_id=session.id,
            event_type="token_exchange_completed",
            title=title,
            description=f"Token交换已完成",
            data={"success": te.success, "error": te.error},
            status=status,
            path=path
        ))
    
    if has_successful_token:
        final_status = "completed"
        final_path = "success"
    elif has_failed_token:
        final_status = "failed"
        final_path = "compensation"
    elif has_error_callback:
        final_status = "failed"
        final_path = "blocked"
    elif has_success_callback:
        final_status = "callback_received"
        final_path = "success"
    else:
        final_status = "pending"
        final_path = "review"
    
    session.status = final_status
    session.status_path = final_path
    session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    
    return session


def get_statistics(db: Session) -> Dict[str, Any]:
    total = db.query(OAuthSession).count()
    success = db.query(OAuthSession).filter(OAuthSession.status_path == "success").count()
    blocked = db.query(OAuthSession).filter(OAuthSession.status_path == "blocked").count()
    compensation = db.query(OAuthSession).filter(OAuthSession.status_path == "compensation").count()
    review = db.query(OAuthSession).filter(OAuthSession.status_path == "review").count()
    pending = db.query(OAuthSession).filter(OAuthSession.status_path == "pending").count()
    
    success_rate = (success / total * 100) if total > 0 else 0
    
    return {
        "total_sessions": total,
        "success_count": success,
        "blocked_count": blocked,
        "compensation_count": compensation,
        "review_count": review,
        "pending_count": pending,
        "success_rate": round(success_rate, 2),
        "avg_duration_seconds": None
    }
