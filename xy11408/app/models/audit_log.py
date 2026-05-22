from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class HttpLog(Base):
    __tablename__ = "http_logs"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(50), unique=True)
    method = Column(String(10))
    url = Column(String(500))
    path = Column(String(200))
    query_params = Column(Text)
    request_body = Column(Text)
    request_headers = Column(Text)

    status_code = Column(Integer)
    response_body = Column(Text)
    response_headers = Column(Text)

    user_id = Column(Integer, ForeignKey("users.id"))
    client_ip = Column(String(50))
    user_agent = Column(String(500))

    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    duration_ms = Column(Integer)

    has_error = Column(Integer, default=0)
    error_message = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="http_logs")


class CommandLog(Base):
    __tablename__ = "command_logs"

    id = Column(Integer, primary_key=True, index=True)
    command_name = Column(String(100), nullable=False)
    command_script = Column(Text, nullable=False)
    arguments = Column(Text)

    operator_id = Column(Integer, ForeignKey("users.id"))
    executed_at = Column(DateTime(timezone=True), server_default=func.now())
    duration_ms = Column(Integer)

    exit_code = Column(Integer)
    stdout = Column(Text)
    stderr = Column(Text)

    success = Column(Integer, default=1)
    notes = Column(Text)

    operator = relationship("User", back_populates="command_logs")
