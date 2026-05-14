from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db, init_db, WSSession, SubscriptionReport
from datetime import datetime, timedelta
import uuid
import json
from typing import Optional, List

app = FastAPI(title="WebSocket订阅监控系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CHANNEL_PERMISSIONS = {
    "trade": ["admin", "trader"],
    "market_data": ["admin", "trader", "viewer"],
    "notifications": ["admin", "trader", "viewer"],
    "system": ["admin"]
}

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]

    async def send_personal_message(self, message: dict, session_id: str):
        if session_id in self.active_connections:
            await self.active_connections[session_id].send_json(message)

manager = ConnectionManager()

class SessionCreate(BaseModel):
    client_id: str
    channel: str
    owner: str
    permissions: Optional[str] = ""

class SessionResponse(BaseModel):
    id: str
    client_id: str
    channel: str
    owner: str
    connected_at: datetime
    heartbeat_status: str
    message_backlog: int
    is_active: bool
    permissions: str
    reconnect_count: int

    class Config:
        from_attributes = True

class ReportResponse(BaseModel):
    id: int
    session_id: str
    client_id: str
    channel: str
    owner: str
    event_type: str
    timestamp: datetime
    details: str
    heartbeat_status: str

    class Config:
        from_attributes = True

def check_channel_permission(channel: str, owner: str) -> bool:
    if channel not in CHANNEL_PERMISSIONS:
        return False
    return True

def validate_session(db: Session, session_id: str):
    session = db.query(WSSession).filter(WSSession.id == session_id).first()
    if not session:
        return None, "Session not found"
    
    if not session.is_active:
        return None, "Session is inactive"
    
    time_since_heartbeat = datetime.utcnow() - session.last_heartbeat
    if time_since_heartbeat > timedelta(seconds=30):
        session.heartbeat_status = "timeout"
        session.is_active = False
        db.commit()
        return None, "Heartbeat timeout"
    
    if session.message_backlog > 1000:
        session.heartbeat_status = "overloaded"
        db.commit()
        return None, "Message backlog exceeded"
    
    return session, None

@app.on_event("startup")
async def startup_event():
    init_db()

@app.get("/", response_class=HTMLResponse)
async def get_index():
    with open("index.html", "r") as f:
        return f.read()

@app.post("/api/sessions", response_model=SessionResponse)
def create_session(session_data: SessionCreate, db: Session = Depends(get_db)):
    if not check_channel_permission(session_data.channel, session_data.owner):
        raise HTTPException(status_code=403, detail="Permission denied for this channel")
    
    existing = db.query(WSSession).filter(
        WSSession.client_id == session_data.client_id,
        WSSession.channel == session_data.channel,
        WSSession.is_active == True
    ).first()
    
    if existing:
        raise HTTPException(status_code=409, detail="Active session already exists for this client and channel")
    
    session_id = str(uuid.uuid4())
    db_session = WSSession(
        id=session_id,
        client_id=session_data.client_id,
        channel=session_data.channel,
        owner=session_data.owner,
        permissions=session_data.permissions or ",".join(CHANNEL_PERMISSIONS.get(session_data.channel, []))
    )
    db.add(db_session)
    
    report = SubscriptionReport(
        session_id=session_id,
        client_id=session_data.client_id,
        channel=session_data.channel,
        owner=session_data.owner,
        event_type="connect",
        details=f"Session created for channel {session_data.channel}",
        heartbeat_status="active"
    )
    db.add(report)
    db.commit()
    db.refresh(db_session)
    return db_session

@app.get("/api/sessions", response_model=List[SessionResponse])
def list_sessions(
    owner: Optional[str] = None,
    channel: Optional[str] = None,
    heartbeat_status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(WSSession)
    if owner:
        query = query.filter(WSSession.owner.contains(owner))
    if channel:
        query = query.filter(WSSession.channel.contains(channel))
    if heartbeat_status:
        query = query.filter(WSSession.heartbeat_status == heartbeat_status)
    return query.order_by(WSSession.connected_at.desc()).all()

@app.post("/api/sessions/{session_id}/heartbeat")
def heartbeat(session_id: str, db: Session = Depends(get_db)):
    session = db.query(WSSession).filter(WSSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.last_heartbeat = datetime.utcnow()
    session.heartbeat_status = "active"
    session.message_backlog = max(0, session.message_backlog - 10)
    db.commit()
    
    report = SubscriptionReport(
        session_id=session_id,
        client_id=session.client_id,
        channel=session.channel,
        owner=session.owner,
        event_type="heartbeat",
        details="Heartbeat received",
        heartbeat_status="active"
    )
    db.add(report)
    db.commit()
    
    return {"status": "ok", "message_backlog": session.message_backlog}

@app.post("/api/sessions/{session_id}/disconnect")
def disconnect_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(WSSession).filter(WSSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.is_active = False
    session.disconnected_at = datetime.utcnow()
    session.heartbeat_status = "disconnected"
    db.commit()
    
    report = SubscriptionReport(
        session_id=session_id,
        client_id=session.client_id,
        channel=session.channel,
        owner=session.owner,
        event_type="disconnect",
        details="Session disconnected",
        heartbeat_status="disconnected"
    )
    db.add(report)
    db.commit()
    
    return {"status": "ok"}

@app.post("/api/sessions/{session_id}/reconnect")
def reconnect_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(WSSession).filter(WSSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.is_active = True
    session.disconnected_at = None
    session.heartbeat_status = "active"
    session.reconnect_count += 1
    session.last_heartbeat = datetime.utcnow()
    db.commit()
    
    report = SubscriptionReport(
        session_id=session_id,
        client_id=session.client_id,
        channel=session.channel,
        owner=session.owner,
        event_type="reconnect",
        details=f"Session reconnected, count: {session.reconnect_count}",
        heartbeat_status="active"
    )
    db.add(report)
    db.commit()
    
    return {"status": "ok", "reconnect_count": session.reconnect_count}

@app.get("/api/reports", response_model=List[ReportResponse])
def list_reports(
    owner: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    heartbeat_status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(SubscriptionReport)
    if owner:
        query = query.filter(SubscriptionReport.owner.contains(owner))
    if start_time:
        query = query.filter(SubscriptionReport.timestamp >= start_time)
    if end_time:
        query = query.filter(SubscriptionReport.timestamp <= end_time)
    if heartbeat_status:
        query = query.filter(SubscriptionReport.heartbeat_status == heartbeat_status)
    return query.order_by(SubscriptionReport.timestamp.desc()).all()

@app.get("/api/reports/export")
def export_reports(
    group_by: str = Query("owner", description="owner|time|heartbeat"),
    db: Session = Depends(get_db)
):
    reports = db.query(SubscriptionReport).order_by(SubscriptionReport.timestamp.desc()).all()
    
    grouped = {}
    for report in reports:
        if group_by == "owner":
            key = report.owner or "unknown"
        elif group_by == "time":
            key = report.timestamp.strftime("%Y-%m-%d")
        elif group_by == "heartbeat":
            key = report.heartbeat_status
        else:
            key = "all"
        
        if key not in grouped:
            grouped[key] = []
        grouped[key].append({
            "id": report.id,
            "session_id": report.session_id,
            "client_id": report.client_id,
            "channel": report.channel,
            "event_type": report.event_type,
            "timestamp": report.timestamp.isoformat(),
            "details": report.details
        })
    
    return {
        "group_by": group_by,
        "total_count": len(reports),
        "groups": grouped
    }

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, db: Session = Depends(get_db)):
    session = db.query(WSSession).filter(WSSession.id == session_id).first()
    if not session or not session.is_active:
        await websocket.close(code=1008, reason="Invalid session")
        return
    
    await manager.connect(websocket, session_id)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "heartbeat":
                session.last_heartbeat = datetime.utcnow()
                session.heartbeat_status = "active"
                db.commit()
                await manager.send_personal_message({"type": "heartbeat_ack", "timestamp": datetime.utcnow().isoformat()}, session_id)
            
            elif data.get("type") == "message":
                session.message_backlog += 1
                db.commit()
                await manager.send_personal_message({"type": "message_ack", "backlog": session.message_backlog}, session_id)
    
    except WebSocketDisconnect:
        manager.disconnect(session_id)
        session.is_active = False
        session.disconnected_at = datetime.utcnow()
        session.heartbeat_status = "disconnected"
        db.commit()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)