from fastapi import WebSocket
from typing import Dict, List, Optional
from datetime import datetime
import json
from enum import Enum

class MessageType(Enum):
    EVENT = "event"
    STATUS_UPDATE = "status_update"
    NOTIFICATION = "notification"
    HEARTBEAT = "heartbeat"
    ACKNOWLEDGE = "acknowledge"
    CONNECTION_ACK = "connection_ack"
    MISSING_MESSAGES = "missing_messages"

class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.client_info: Dict[str, dict] = {}
        self.message_history: Dict[str, List[dict]] = {}
        self.max_history_size = 100

    async def connect(self, websocket: WebSocket, client_id: str, user_type: str, user_name: str = None, room_id: int = None):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.client_info[client_id] = {
            "user_type": user_type,
            "user_name": user_name,
            "room_id": room_id,
            "connected_at": datetime.utcnow().isoformat(),
            "last_heartbeat": datetime.utcnow().isoformat()
        }
        
        if client_id not in self.message_history:
            self.message_history[client_id] = []
        
        await self.send_message(client_id, {
            "type": MessageType.CONNECTION_ACK.value,
            "client_id": client_id,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return client_id

    async def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.client_info:
            self.client_info[client_id]["is_active"] = False
            self.client_info[client_id]["disconnected_at"] = datetime.utcnow().isoformat()

    async def send_message(self, client_id: str, message: dict):
        if client_id in self.active_connections:
            try:
                message_with_timestamp = {
                    **message,
                    "timestamp": datetime.utcnow().isoformat()
                }
                await self.active_connections[client_id].send_json(message_with_timestamp)
                
                if client_id in self.message_history:
                    self.message_history[client_id].append(message_with_timestamp)
                    if len(self.message_history[client_id]) > self.max_history_size:
                        self.message_history[client_id] = self.message_history[client_id][-self.max_history_size:]
                
                return True
            except Exception:
                await self.disconnect(client_id)
                return False
        return False

    async def broadcast_to_room(self, room_id: int, message: dict, exclude_client_id: str = None):
        sent_count = 0
        for client_id, info in self.client_info.items():
            if info.get("room_id") == room_id and client_id != exclude_client_id:
                if await self.send_message(client_id, message):
                    sent_count += 1
        return sent_count

    async def broadcast_to_front_desk(self, message: dict):
        sent_count = 0
        for client_id, info in self.client_info.items():
            if info.get("user_type") == "front_desk":
                if await self.send_message(client_id, message):
                    sent_count += 1
        return sent_count

    async def broadcast_to_all(self, message: dict):
        sent_count = 0
        for client_id in list(self.active_connections.keys()):
            if await self.send_message(client_id, message):
                sent_count += 1
        return sent_count

    def get_online_clients(self) -> List[dict]:
        clients = []
        for client_id, info in self.client_info.items():
            if client_id in self.active_connections:
                clients.append({
                    "client_id": client_id,
                    **info
                })
        return clients

    def get_room_online_count(self, room_id: int) -> int:
        count = 0
        for client_id, info in self.client_info.items():
            if info.get("room_id") == room_id and client_id in self.active_connections:
                count += 1
        return count

    def get_missing_messages(self, client_id: str, last_received_timestamp: str) -> List[dict]:
        if client_id not in self.message_history:
            return []
        
        try:
            last_time = datetime.fromisoformat(last_received_timestamp)
            missing = []
            for msg in self.message_history[client_id]:
                msg_time = datetime.fromisoformat(msg["timestamp"])
                if msg_time > last_time:
                    missing.append(msg)
            return missing
        except Exception:
            return []

    async def send_missing_messages(self, client_id: str, last_received_timestamp: str):
        missing_messages = self.get_missing_messages(client_id, last_received_timestamp)
        if missing_messages:
            await self.send_message(client_id, {
                "type": MessageType.MISSING_MESSAGES.value,
                "messages": missing_messages,
                "count": len(missing_messages)
            })
        return len(missing_messages)

    def update_heartbeat(self, client_id: str):
        if client_id in self.client_info:
            self.client_info[client_id]["last_heartbeat"] = datetime.utcnow().isoformat()

    def get_client_room(self, client_id: str) -> Optional[int]:
        if client_id in self.client_info:
            return self.client_info[client_id].get("room_id")
        return None

manager = WebSocketManager()
