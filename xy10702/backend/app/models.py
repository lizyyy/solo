from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, Float, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class OAuthSession(Base):
    __tablename__ = "oauth_sessions"

    id = Column(Integer, primary_key=True, index=True)
    state = Column(String, unique=True, index=True)
    client_id = Column(String)
    redirect_uri = Column(String)
    scope = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status = Column(String, default="pending")
    status_path = Column(String, default="pending")
    metadata = Column(JSON, default=dict)
    error_message = Column(Text)

    callbacks = relationship("CallbackLog", back_populates="session")
    token_exchanges = relationship("TokenExchange", back_populates="session")
    timeline_events = relationship("TimelineEvent", back_populates="session")


class CallbackLog(Base):
    __tablename__ = "callback_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("oauth_sessions.id"))
    state = Column(String, index=True)
    code = Column(String)
    error = Column(String)
    error_description = Column(Text)
    query_params = Column(JSON)
    headers = Column(JSON)
    received_at = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String)
    user_agent = Column(String)

    session = relationship("OAuthSession", back_populates="callbacks")


class TokenExchange(Base):
    __tablename__ = "token_exchanges"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("oauth_sessions.id"))
    state = Column(String, index=True)
    code = Column(String)
    grant_type = Column(String)
    request_params = Column(JSON)
    response_data = Column(JSON)
    status_code = Column(Integer)
    access_token = Column(String)
    refresh_token = Column(String)
    expires_in = Column(Integer)
    token_type = Column(String)
    scope = Column(String)
    error = Column(String)
    error_description = Column(Text)
    requested_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    success = Column(Boolean, default=False)

    session = relationship("OAuthSession", back_populates="token_exchanges")


class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("oauth_sessions.id"))
    event_type = Column(String)
    title = Column(String)
    description = Column(Text)
    data = Column(JSON)
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String)
    path = Column(String)

    session = relationship("OAuthSession", back_populates="timeline_events")


class ExportRecord(Base):
    __tablename__ = "export_records"

    id = Column(Integer, primary_key=True, index=True)
    export_type = Column(String)
    format = Column(String)
    filename = Column(String)
    file_path = Column(String)
    filters = Column(JSON)
    record_count = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String)
