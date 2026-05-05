from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
import json

from database import get_db
from models import AuditSession, RedisKey, UsageEvent, AnalysisResult
from schemas import SessionCreate, SessionResponse, ImportResponse, RedisKeyResponse, UsageEventResponse
from import_service import DataImportService
from config import get_settings


router = APIRouter(prefix="/import", tags=["Import"])

settings = get_settings()
import_service = DataImportService(settings.upload_dir)


@router.post("/session", response_model=SessionResponse, status_code=201)
async def create_session(
    session_data: SessionCreate,
    db: AsyncSession = Depends(get_db)
):
    new_session = AuditSession(
        session_name=session_data.session_name,
        description=session_data.description,
        status="pending"
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return new_session


@router.get("/session/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditSession).where(AuditSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return session


@router.get("/sessions", response_model=List[SessionResponse])
async def list_sessions(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditSession)
        .order_by(AuditSession.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    sessions = result.scalars().all()
    return list(sessions)


@router.post("/keys/{session_id}", response_model=ImportResponse)
async def import_keys(
    session_id: int,
    file: UploadFile = File(..., description="CSV file with Redis keys data"),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditSession).where(AuditSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be CSV format")
    
    try:
        filepath = await import_service.save_uploaded_file(file, session_id, "keys")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    try:
        keys_data = await import_service.parse_keys_csv(filepath)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse CSV: {str(e)}")
    
    if not keys_data:
        raise HTTPException(status_code=400, detail="No valid keys found in the file")
    
    for key_data in keys_data:
        redis_key = RedisKey(
            session_id=session_id,
            key_name=key_data["key_name"],
            data_type=key_data["data_type"],
            ttl=key_data["ttl"],
            memory_bytes=key_data["memory_bytes"],
            value_size=key_data["value_size"],
            field_count=key_data["field_count"],
            list_length=key_data["list_length"],
            set_cardinality=key_data["set_cardinality"],
            zset_cardinality=key_data["zset_cardinality"],
            stream_length=key_data["stream_length"],
            tags=key_data["tags"],
            description=key_data["description"],
        )
        db.add(redis_key)
    
    session.keys_file = filepath
    if session.status == "pending":
        session.status = "imported"
    
    await db.commit()
    
    return ImportResponse(
        session_id=session_id,
        status="success",
        message=f"Successfully imported {len(keys_data)} keys",
        keys_imported=len(keys_data),
        events_imported=None,
        rules_loaded=None
    )


@router.post("/events/{session_id}", response_model=ImportResponse)
async def import_events(
    session_id: int,
    file: UploadFile = File(..., description="JSONL file with usage events"),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditSession).where(AuditSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    if not file.filename.endswith('.jsonl') and not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="File must be JSONL or JSON format")
    
    try:
        filepath = await import_service.save_uploaded_file(file, session_id, "events")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    try:
        events_data = await import_service.parse_events_jsonl(filepath)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse JSONL: {str(e)}")
    
    if not events_data:
        raise HTTPException(status_code=400, detail="No valid events found in the file")
    
    for event_data in events_data:
        usage_event = UsageEvent(
            session_id=session_id,
            timestamp=event_data["timestamp"],
            key_name=event_data["key_name"],
            command=event_data["command"],
            read_write=event_data["read_write"],
            latency_ms=event_data["latency_ms"],
            client_id=event_data["client_id"],
            database=event_data["database"],
            tags=event_data["tags"],
        )
        db.add(usage_event)
    
    session.events_file = filepath
    
    await db.commit()
    
    return ImportResponse(
        session_id=session_id,
        status="success",
        message=f"Successfully imported {len(events_data)} events",
        keys_imported=None,
        events_imported=len(events_data),
        rules_loaded=None
    )


@router.post("/rules/{session_id}", response_model=ImportResponse)
async def import_rules(
    session_id: int,
    file: UploadFile = File(..., description="YAML file with structure rules"),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditSession).where(AuditSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    if not file.filename.endswith('.yaml') and not file.filename.endswith('.yml'):
        raise HTTPException(status_code=400, detail="File must be YAML format")
    
    try:
        filepath = await import_service.save_uploaded_file(file, session_id, "rules")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    try:
        rules_data = await import_service.parse_rules_yaml(filepath)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse YAML: {str(e)}")
    
    session.rules_file = filepath
    
    await db.commit()
    
    return ImportResponse(
        session_id=session_id,
        status="success",
        message=f"Successfully loaded {len(rules_data)} custom rules" if rules_data else "Loaded rules file",
        keys_imported=None,
        events_imported=None,
        rules_loaded=True
    )


@router.get("/keys/{session_id}", response_model=List[RedisKeyResponse])
async def list_session_keys(
    session_id: int,
    limit: int = 100,
    offset: int = 0,
    data_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditSession).where(AuditSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    query = select(RedisKey).where(RedisKey.session_id == session_id)
    if data_type:
        query = query.where(RedisKey.data_type == data_type.lower())
    
    query = query.order_by(RedisKey.key_name).limit(limit).offset(offset)
    
    result = await db.execute(query)
    keys = result.scalars().all()
    return list(keys)


@router.get("/events/{session_id}", response_model=List[UsageEventResponse])
async def list_session_events(
    session_id: int,
    limit: int = 100,
    offset: int = 0,
    key_name: Optional[str] = None,
    command: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditSession).where(AuditSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    query = select(UsageEvent).where(UsageEvent.session_id == session_id)
    if key_name:
        query = query.where(UsageEvent.key_name.like(f"%{key_name}%"))
    if command:
        query = query.where(UsageEvent.command == command.upper())
    
    query = query.order_by(UsageEvent.timestamp.desc()).limit(limit).offset(offset)
    
    result = await db.execute(query)
    events = result.scalars().all()
    return list(events)


@router.delete("/session/{session_id}", status_code=204)
async def delete_session(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditSession).where(AuditSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    await db.delete(session)
    await db.commit()
    
    return None
