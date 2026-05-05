from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True, nullable=False)
    capacity = Column(Integer, default=6)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    sessions = relationship("Session", back_populates="room")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    script_name = Column(String(100), nullable=False)
    dm_name = Column(String(50), nullable=False)
    player_count = Column(Integer, default=0)
    scheduled_time = Column(DateTime, nullable=False)
    actual_start_time = Column(DateTime, nullable=True)
    actual_end_time = Column(DateTime, nullable=True)
    status = Column(String(20), default="scheduled")  # scheduled, in_progress, paused, ended
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    room = relationship("Room", back_populates="sessions")
    events = relationship("Event", back_populates="session")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    event_type = Column(String(50), nullable=False)  # start, pause, resume, help, change_props, end, notification
    sender = Column(String(50), nullable=False)  # dm, front_desk, system
    content = Column(Text, nullable=True)
    event_metadata = Column(JSON, nullable=True)
    is_acknowledged = Column(Boolean, default=False)
    acknowledged_by = Column(String(50), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    session = relationship("Session", back_populates="events")


class WebSocketConnection(Base):
    __tablename__ = "websocket_connections"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(String(100), unique=True, index=True, nullable=False)
    user_type = Column(String(20), nullable=False)  # dm, front_desk
    user_name = Column(String(50), nullable=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    connected_at = Column(DateTime, default=datetime.utcnow)
    disconnected_at = Column(DateTime, nullable=True)
    last_heartbeat = Column(DateTime, default=datetime.utcnow)
