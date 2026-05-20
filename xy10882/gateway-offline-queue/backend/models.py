from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class GatewayDevice(Base):
    __tablename__ = "gateway_devices"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    status = Column(String, default="online")
    last_heartbeat = Column(DateTime, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now())
    offline_window_id = Column(Integer, ForeignKey("offline_windows.id"), nullable=True)
    
    commands = relationship("ControlCommand", back_populates="device")
    offline_windows = relationship("OfflineWindow", back_populates="device", foreign_keys="OfflineWindow.device_id")
    receipts = relationship("ReceiptRecord", back_populates="device")


class OfflineWindow(Base):
    __tablename__ = "offline_windows"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("gateway_devices.id"), nullable=False)
    start_time = Column(DateTime, server_default=func.now())
    end_time = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    command_count = Column(Integer, default=0)
    
    device = relationship("GatewayDevice", back_populates="offline_windows", foreign_keys=[device_id])
    commands = relationship("ControlCommand", back_populates="offline_window")


class ControlCommand(Base):
    __tablename__ = "control_commands"

    id = Column(Integer, primary_key=True, index=True)
    command_id = Column(String, unique=True, index=True, nullable=False)
    device_id = Column(Integer, ForeignKey("gateway_devices.id"), nullable=False)
    offline_window_id = Column(Integer, ForeignKey("offline_windows.id"), nullable=True)
    command_type = Column(String, nullable=False)
    payload = Column(Text, nullable=False)
    priority = Column(Integer, default=0)
    sequence = Column(Integer, default=0)
    status = Column(String, default="pending")
    expire_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    executed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    
    device = relationship("GatewayDevice", back_populates="commands")
    offline_window = relationship("OfflineWindow", back_populates="commands")
    receipt = relationship("ReceiptRecord", back_populates="command", uselist=False)
    history = relationship("CommandHistory", back_populates="command")


class CommandHistory(Base):
    __tablename__ = "command_history"

    id = Column(Integer, primary_key=True, index=True)
    command_id = Column(Integer, ForeignKey("control_commands.id"), nullable=False)
    old_status = Column(String)
    new_status = Column(String, nullable=False)
    timestamp = Column(DateTime, server_default=func.now())
    description = Column(String)
    
    command = relationship("ControlCommand", back_populates="history")


class ReceiptRecord(Base):
    __tablename__ = "receipt_records"

    id = Column(Integer, primary_key=True, index=True)
    command_id = Column(Integer, ForeignKey("control_commands.id"), nullable=False)
    device_id = Column(Integer, ForeignKey("gateway_devices.id"), nullable=False)
    receipt_code = Column(String)
    receipt_data = Column(Text)
    received_at = Column(DateTime, server_default=func.now())
    is_success = Column(Boolean, default=True)
    
    command = relationship("ControlCommand", back_populates="receipt")
    device = relationship("GatewayDevice", back_populates="receipts")
