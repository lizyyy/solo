from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os

from ..database import get_db
from ..schemas import (
    OAuthSessionCreate, OAuthSessionUpdate, OAuthSessionResponse,
    CallbackLogCreate, CallbackLogResponse,
    TokenExchangeCreate, TokenExchangeUpdate, TokenExchangeResponse,
    TimelineEventResponse, SessionDetailResponse,
    ExportRequest, ExportRecordResponse, StatsResponse,
    DiffCompareRequest, DiffResponse, RecalculateRequest
)
from ..services.oauth_service import (
    create_session, get_session_by_state, get_session_by_id, get_all_sessions,
    update_session_status, create_callback_log, get_callbacks_by_session,
    create_token_exchange, update_token_exchange, get_token_exchanges_by_session,
    get_timeline_by_session, recalculate_session_status, get_statistics, generate_state
)
from ..services.export_service import (
    export_sessions, export_callbacks, export_token_exchanges,
    export_timeline, export_full_report, get_export_records, get_export_file_path
)

router = APIRouter()


@router.post("/sessions", response_model=OAuthSessionResponse)
def create_new_session(session_data: OAuthSessionCreate, db: Session = Depends(get_db)):
    if not session_data.state:
        session_data.state = generate_state()
    return create_session(db, session_data)


@router.get("/sessions", response_model=List[OAuthSessionResponse])
def list_sessions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return get_all_sessions(db, skip, limit)


@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
def get_session_detail(session_id: int, db: Session = Depends(get_db)):
    session = get_session_by_id(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话未找到")
    
    callbacks = get_callbacks_by_session(db, session_id)
    token_exchanges = get_token_exchanges_by_session(db, session_id)
    timeline = get_timeline_by_session(db, session_id)
    
    return {
        **session.__dict__,
        "callbacks": callbacks,
        "token_exchanges": token_exchanges,
        "timeline_events": timeline
    }


@router.get("/sessions/state/{state}", response_model=SessionDetailResponse)
def get_session_by_state_param(state: str, db: Session = Depends(get_db)):
    session = get_session_by_state(db, state)
    if not session:
        raise HTTPException(status_code=404, detail="会话未找到")
    
    callbacks = get_callbacks_by_session(db, session.id)
    token_exchanges = get_token_exchanges_by_session(db, session.id)
    timeline = get_timeline_by_session(db, session.id)
    
    return {
        **session.__dict__,
        "callbacks": callbacks,
        "token_exchanges": token_exchanges,
        "timeline_events": timeline
    }


@router.patch("/sessions/{session_id}", response_model=OAuthSessionResponse)
def update_session(session_id: int, update_data: OAuthSessionUpdate, db: Session = Depends(get_db)):
    session = update_session_status(db, session_id, update_data)
    if not session:
        raise HTTPException(status_code=404, detail="会话未找到")
    return session


@router.post("/callback")
async def receive_callback(request: Request, db: Session = Depends(get_db)):
    query_params = dict(request.query_params)
    headers = dict(request.headers)
    
    state = query_params.get("state", "")
    code = query_params.get("code")
    error = query_params.get("error")
    error_description = query_params.get("error_description")
    
    callback_data = CallbackLogCreate(
        state=state,
        code=code,
        error=error,
        error_description=error_description,
        query_params=query_params,
        headers=headers,
        ip_address=request.client.host if request.client else None,
        user_agent=headers.get("user-agent")
    )
    
    callback = create_callback_log(db, callback_data)
    
    return {
        "status": "received",
        "callback_id": callback.id,
        "state": state,
        "message": "回调已记录"
    }


@router.get("/callbacks/session/{session_id}", response_model=List[CallbackLogResponse])
def list_session_callbacks(session_id: int, db: Session = Depends(get_db)):
    return get_callbacks_by_session(db, session_id)


@router.post("/token-exchange", response_model=TokenExchangeResponse)
def start_token_exchange(exchange_data: TokenExchangeCreate, db: Session = Depends(get_db)):
    return create_token_exchange(db, exchange_data)


@router.patch("/token-exchange/{exchange_id}", response_model=TokenExchangeResponse)
def complete_token_exchange(exchange_id: int, update_data: TokenExchangeUpdate, db: Session = Depends(get_db)):
    exchange = update_token_exchange(db, exchange_id, update_data)
    if not exchange:
        raise HTTPException(status_code=404, detail="Token交换记录未找到")
    return exchange


@router.get("/token-exchange/session/{session_id}", response_model=List[TokenExchangeResponse])
def list_session_token_exchanges(session_id: int, db: Session = Depends(get_db)):
    return get_token_exchanges_by_session(db, session_id)


@router.get("/timeline/session/{session_id}", response_model=List[TimelineEventResponse])
def get_session_timeline(session_id: int, db: Session = Depends(get_db)):
    return get_timeline_by_session(db, session_id)


@router.post("/recalculate", response_model=SessionDetailResponse)
def recalculate_session(request: RecalculateRequest, db: Session = Depends(get_db)):
    session = recalculate_session_status(db, request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话未找到")
    
    callbacks = get_callbacks_by_session(db, request.session_id)
    token_exchanges = get_token_exchanges_by_session(db, request.session_id)
    timeline = get_timeline_by_session(db, request.session_id)
    
    return {
        **session.__dict__,
        "callbacks": callbacks,
        "token_exchanges": token_exchanges,
        "timeline_events": timeline
    }


@router.post("/diff", response_model=DiffResponse)
def compare_sessions(diff_request: DiffCompareRequest, db: Session = Depends(get_db)):
    session1 = get_session_by_id(db, diff_request.session_id_1)
    session2 = get_session_by_id(db, diff_request.session_id_2)
    
    if not session1 or not session2:
        raise HTTPException(status_code=404, detail="会话未找到")
    
    callbacks1 = get_callbacks_by_session(db, diff_request.session_id_1)
    callbacks2 = get_callbacks_by_session(db, diff_request.session_id_2)
    token1 = get_token_exchanges_by_session(db, diff_request.session_id_1)
    token2 = get_token_exchanges_by_session(db, diff_request.session_id_2)
    timeline1 = get_timeline_by_session(db, diff_request.session_id_1)
    timeline2 = get_timeline_by_session(db, diff_request.session_id_2)
    
    differences = {
        "session": {
            "status": (session1.status, session2.status),
            "status_path": (session1.status_path, session2.status_path),
            "has_error": (bool(session1.error_message), bool(session2.error_message))
        },
        "callbacks": {
            "count": (len(callbacks1), len(callbacks2)),
            "has_success": (any(cb.code for cb in callbacks1), any(cb.code for cb in callbacks2)),
            "has_error": (any(cb.error for cb in callbacks1), any(cb.error for cb in callbacks2))
        },
        "token_exchange": {
            "count": (len(token1), len(token2)),
            "success_count": (sum(1 for t in token1 if t.success), sum(1 for t in token2 if t.success))
        }
    }
    
    return {
        "session1": {
            **session1.__dict__,
            "callbacks": callbacks1,
            "token_exchanges": token1,
            "timeline_events": timeline1
        },
        "session2": {
            **session2.__dict__,
            "callbacks": callbacks2,
            "token_exchanges": token2,
            "timeline_events": timeline2
        },
        "differences": differences
    }


@router.post("/export", response_model=ExportRecordResponse)
def create_export(export_request: ExportRequest, db: Session = Depends(get_db)):
    export_type = export_request.export_type
    
    if export_type == "sessions":
        return export_sessions(db, export_request)
    elif export_type == "callbacks":
        return export_callbacks(db, export_request)
    elif export_type == "token_exchanges":
        return export_token_exchanges(db, export_request)
    elif export_type == "timeline":
        return export_timeline(db, export_request)
    elif export_type == "full_report":
        return export_full_report(db, export_request)
    else:
        raise HTTPException(status_code=400, detail="不支持的导出类型")


@router.get("/exports", response_model=List[ExportRecordResponse])
def list_exports(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return get_export_records(db, skip, limit)


@router.get("/exports/{export_id}/download")
def download_export(export_id: int, db: Session = Depends(get_db)):
    file_path = get_export_file_path(export_id, db)
    if not file_path:
        raise HTTPException(status_code=404, detail="导出文件未找到")
    
    filename = os.path.basename(file_path)
    return FileResponse(file_path, filename=filename)


@router.get("/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    return get_statistics(db)
