from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy.orm import Session
from datetime import datetime
import uuid
import json
from pathlib import Path

from database import engine, Base, get_db
from models import Room, Session as SessionModel, Event, WebSocketConnection
from routers import rooms, sessions, events
from websocket_manager import manager, MessageType

Base.metadata.create_all(bind=engine)

app = FastAPI(title="剧本杀房间调度台", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rooms.router, prefix="/api/rooms", tags=["房间管理"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["场次管理"])
app.include_router(events.router, prefix="/api/events", tags=["事件管理"])

static_path = Path(__file__).parent / "static"
static_path.mkdir(exist_ok=True)
templates_path = Path(__file__).parent / "templates"
templates_path.mkdir(exist_ok=True)

app.mount("/static", StaticFiles(directory=str(static_path)), name="static")

@app.get("/", response_class=HTMLResponse)
async def root():
    index_path = templates_path / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return HTMLResponse(content="<h1>剧本杀房间调度台 API</h1><p>请访问 /docs 查看 API 文档</p>")

@app.get("/front-desk")
async def front_desk():
    front_desk_path = templates_path / "front_desk.html"
    if front_desk_path.exists():
        return FileResponse(str(front_desk_path))
    return {"message": "前台页面未找到，请确保 templates/front_desk.html 存在"}

@app.get("/dm-console")
async def dm_console():
    dm_path = templates_path / "dm_console.html"
    if dm_path.exists():
        return FileResponse(str(dm_path))
    return {"message": "DM 控制台页面未找到，请确保 templates/dm_console.html 存在"}

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str, db: Session = Depends(get_db)):
    try:
        query_params = websocket.query_params
        user_type = query_params.get("user_type", "front_desk")
        user_name = query_params.get("user_name")
        room_id = query_params.get("room_id")
        if room_id:
            room_id = int(room_id)
        
        await manager.connect(
            websocket=websocket,
            client_id=client_id,
            user_type=user_type,
            user_name=user_name,
            room_id=room_id
        )
        
        db_connection = WebSocketConnection(
            client_id=client_id,
            user_type=user_type,
            user_name=user_name,
            room_id=room_id,
            is_active=True
        )
        db.add(db_connection)
        db.commit()
        
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                msg_type = message.get("type")
                
                if msg_type == MessageType.HEARTBEAT.value:
                    manager.update_heartbeat(client_id)
                    db_connection = db.query(WebSocketConnection).filter(
                        WebSocketConnection.client_id == client_id
                    ).first()
                    if db_connection:
                        db_connection.last_heartbeat = datetime.utcnow()
                        db.commit()
                    
                    await manager.send_message(client_id, {
                        "type": MessageType.HEARTBEAT.value,
                        "status": "ok"
                    })
                
                elif msg_type == MessageType.EVENT.value:
                    event_data = message.get("data", {})
                    session_id = event_data.get("session_id")
                    event_type = event_data.get("event_type")
                    content = event_data.get("content")
                    event_metadata = event_data.get("event_metadata") or event_data.get("metadata")
                    
                    if not session_id or not event_type:
                        await manager.send_message(client_id, {
                            "type": "error",
                            "message": "缺少必要参数: session_id 或 event_type"
                        })
                        continue
                    
                    session = db.query(SessionModel).filter(
                        SessionModel.id == session_id
                    ).first()
                    
                    if not session:
                        await manager.send_message(client_id, {
                            "type": "error",
                            "message": f"场次 {session_id} 不存在"
                        })
                        continue
                    
                    db_event = Event(
                        session_id=session_id,
                        event_type=event_type,
                        sender=user_type,
                        content=content,
                        event_metadata=event_metadata
                    )
                    db.add(db_event)
                    
                    if event_type == "start":
                        session.actual_start_time = datetime.utcnow()
                        session.status = "in_progress"
                    elif event_type == "pause":
                        session.status = "paused"
                    elif event_type == "resume":
                        session.status = "in_progress"
                    elif event_type == "end":
                        session.actual_end_time = datetime.utcnow()
                        session.status = "ended"
                    
                    db.commit()
                    db.refresh(db_event)
                    
                    event_response = {
                        "id": db_event.id,
                        "session_id": db_event.session_id,
                        "event_type": db_event.event_type,
                        "sender": db_event.sender,
                        "content": db_event.content,
                        "metadata": db_event.event_metadata,
                        "event_metadata": db_event.event_metadata,
                        "is_acknowledged": db_event.is_acknowledged,
                        "created_at": db_event.created_at.isoformat()
                    }
                    
                    await manager.broadcast_to_room(
                        room_id=session.room_id,
                        message={
                            "type": MessageType.EVENT.value,
                            "data": event_response
                        },
                        exclude_client_id=client_id
                    )
                    
                    await manager.broadcast_to_front_desk({
                        "type": MessageType.EVENT.value,
                        "data": event_response
                    })
                    
                    await manager.broadcast_to_front_desk({
                        "type": MessageType.STATUS_UPDATE.value,
                        "data": {
                            "room_id": session.room_id,
                            "session_id": session.id,
                            "status": session.status
                        }
                    })
                
                elif msg_type == MessageType.ACKNOWLEDGE.value:
                    event_id = message.get("event_id")
                    if event_id:
                        event = db.query(Event).filter(Event.id == event_id).first()
                        if event:
                            event.is_acknowledged = True
                            event.acknowledged_by = user_name or user_type
                            event.acknowledged_at = datetime.utcnow()
                            db.commit()
                            
                            await manager.broadcast_to_all({
                                "type": MessageType.ACKNOWLEDGE.value,
                                "data": {
                                    "event_id": event_id,
                                    "acknowledged_by": event.acknowledged_by,
                                    "acknowledged_at": event.acknowledged_at.isoformat()
                                }
                            })
                
                elif msg_type == MessageType.MISSING_MESSAGES.value:
                    last_timestamp = message.get("last_timestamp")
                    if last_timestamp:
                        await manager.send_missing_messages(client_id, last_timestamp)
                
            except json.JSONDecodeError:
                await manager.send_message(client_id, {
                    "type": "error",
                    "message": "无效的 JSON 格式"
                })
    
    except WebSocketDisconnect:
        await manager.disconnect(client_id)
        
        db_connection = db.query(WebSocketConnection).filter(
            WebSocketConnection.client_id == client_id
        ).first()
        if db_connection:
            db_connection.is_active = False
            db_connection.disconnected_at = datetime.utcnow()
            db.commit()
        
        room_id = manager.get_client_room(client_id)
        if room_id:
            online_count = manager.get_room_online_count(room_id)
            if online_count == 0:
                await manager.broadcast_to_front_desk({
                    "type": "disconnection_notice",
                    "data": {
                        "room_id": room_id,
                        "client_id": client_id,
                        "message": f"房间 {room_id} 的 DM 连接已断开"
                    }
                })

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.get("/api/online-clients")
async def get_online_clients():
    return {"clients": manager.get_online_clients()}
