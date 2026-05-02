#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据模型模块
定义所有核心数据结构和枚举类型
"""

from dataclasses import dataclass, field
from datetime import time, datetime
from enum import Enum, auto
from typing import List, Optional, Dict, Any
from uuid import uuid4


class RiskLevel(Enum):
    """风险等级"""
    LOW = auto()
    MEDIUM = auto()
    HIGH = auto()
    CRITICAL = auto()


class RiskType(Enum):
    """风险类型"""
    FREQUENCY_CONFLICT = auto()
    INTERMODULATION = auto()
    FORBIDDEN_BAND = auto()
    LOW_BATTERY = auto()
    NO_BACKUP = auto()
    OVERLAP_CHANNEL = auto()


@dataclass
class Microphone:
    """麦克风设备信息"""
    id: str = field(default_factory=lambda: str(uuid4()))
    device_id: str = ""
    actor_name: str = ""
    frequency: float = 0.0
    channel: str = ""
    battery_level: float = 100.0
    backup_frequency: Optional[float] = None
    backup_channel: Optional[str] = None
    is_backup: bool = False
    notes: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "device_id": self.device_id,
            "actor_name": self.actor_name,
            "frequency": self.frequency,
            "channel": self.channel,
            "battery_level": self.battery_level,
            "backup_frequency": self.backup_frequency,
            "backup_channel": self.backup_channel,
            "is_backup": self.is_backup,
            "notes": self.notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Microphone":
        return cls(
            id=data.get("id", str(uuid4())),
            device_id=data.get("device_id", ""),
            actor_name=data.get("actor_name", ""),
            frequency=data.get("frequency", 0.0),
            channel=data.get("channel", ""),
            battery_level=data.get("battery_level", 100.0),
            backup_frequency=data.get("backup_frequency"),
            backup_channel=data.get("backup_channel"),
            is_backup=data.get("is_backup", False),
            notes=data.get("notes", "")
        )


@dataclass
class ScheduleEntry:
    """时间走位表条目"""
    id: str = field(default_factory=lambda: str(uuid4()))
    scene_name: str = ""
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    actor_names: List[str] = field(default_factory=list)
    mic_ids: List[str] = field(default_factory=list)
    notes: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "scene_name": self.scene_name,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "actor_names": self.actor_names,
            "mic_ids": self.mic_ids,
            "notes": self.notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ScheduleEntry":
        start_time = None
        if data.get("start_time"):
            try:
                if isinstance(data["start_time"], str):
                    start_time = time.fromisoformat(data["start_time"])
                else:
                    start_time = data["start_time"]
            except ValueError:
                pass
        
        end_time = None
        if data.get("end_time"):
            try:
                if isinstance(data["end_time"], str):
                    end_time = time.fromisoformat(data["end_time"])
                else:
                    end_time = data["end_time"]
            except ValueError:
                pass
        
        return cls(
            id=data.get("id", str(uuid4())),
            scene_name=data.get("scene_name", ""),
            start_time=start_time,
            end_time=end_time,
            actor_names=data.get("actor_names", []),
            mic_ids=data.get("mic_ids", []),
            notes=data.get("notes", "")
        )


@dataclass
class ForbiddenBand:
    """禁用频段"""
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    start_freq: float = 0.0
    end_freq: float = 0.0
    reason: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "start_freq": self.start_freq,
            "end_freq": self.end_freq,
            "reason": self.reason
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ForbiddenBand":
        return cls(
            id=data.get("id", str(uuid4())),
            name=data.get("name", ""),
            start_freq=data.get("start_freq", 0.0),
            end_freq=data.get("end_freq", 0.0),
            reason=data.get("reason", "")
        )


@dataclass
class ChannelInfo:
    """频道频率信息"""
    id: str = field(default_factory=lambda: str(uuid4()))
    channel_name: str = ""
    center_freq: float = 0.0
    bandwidth: float = 0.2
    is_available: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "channel_name": self.channel_name,
            "center_freq": self.center_freq,
            "bandwidth": self.bandwidth,
            "is_available": self.is_available
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ChannelInfo":
        return cls(
            id=data.get("id", str(uuid4())),
            channel_name=data.get("channel_name", ""),
            center_freq=data.get("center_freq", 0.0),
            bandwidth=data.get("bandwidth", 0.2),
            is_available=data.get("is_available", True)
        )


@dataclass
class RiskItem:
    """风险项"""
    id: str = field(default_factory=lambda: str(uuid4()))
    risk_type: RiskType = RiskType.FREQUENCY_CONFLICT
    level: RiskLevel = RiskLevel.MEDIUM
    affected_mics: List[str] = field(default_factory=list)
    affected_scene: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    description: str = ""
    suggestion: str = ""
    is_resolved: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "risk_type": self.risk_type.name,
            "level": self.level.name,
            "affected_mics": self.affected_mics,
            "affected_scene": self.affected_scene,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "description": self.description,
            "suggestion": self.suggestion,
            "is_resolved": self.is_resolved
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RiskItem":
        risk_type = RiskType.FREQUENCY_CONFLICT
        if data.get("risk_type"):
            try:
                risk_type = RiskType[data["risk_type"]]
            except KeyError:
                pass
        
        level = RiskLevel.MEDIUM
        if data.get("level"):
            try:
                level = RiskLevel[data["level"]]
            except KeyError:
                pass
        
        start_time = None
        if data.get("start_time"):
            try:
                if isinstance(data["start_time"], str):
                    start_time = time.fromisoformat(data["start_time"])
            except ValueError:
                pass
        
        end_time = None
        if data.get("end_time"):
            try:
                if isinstance(data["end_time"], str):
                    end_time = time.fromisoformat(data["end_time"])
            except ValueError:
                pass
        
        return cls(
            id=data.get("id", str(uuid4())),
            risk_type=risk_type,
            level=level,
            affected_mics=data.get("affected_mics", []),
            affected_scene=data.get("affected_scene"),
            start_time=start_time,
            end_time=end_time,
            description=data.get("description", ""),
            suggestion=data.get("suggestion", ""),
            is_resolved=data.get("is_resolved", False)
        )


@dataclass
class RehearsalPlan:
    """完整彩排方案"""
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = "新建彩排方案"
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    microphones: List[Microphone] = field(default_factory=list)
    schedule: List[ScheduleEntry] = field(default_factory=list)
    forbidden_bands: List[ForbiddenBand] = field(default_factory=list)
    channels: List[ChannelInfo] = field(default_factory=list)
    risks: List[RiskItem] = field(default_factory=list)
    
    notes: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "microphones": [m.to_dict() for m in self.microphones],
            "schedule": [s.to_dict() for s in self.schedule],
            "forbidden_bands": [f.to_dict() for f in self.forbidden_bands],
            "channels": [c.to_dict() for c in self.channels],
            "risks": [r.to_dict() for r in self.risks],
            "notes": self.notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RehearsalPlan":
        created_at = datetime.now()
        if data.get("created_at"):
            try:
                if isinstance(data["created_at"], str):
                    created_at = datetime.fromisoformat(data["created_at"])
                else:
                    created_at = data["created_at"]
            except ValueError:
                pass
        
        updated_at = datetime.now()
        if data.get("updated_at"):
            try:
                if isinstance(data["updated_at"], str):
                    updated_at = datetime.fromisoformat(data["updated_at"])
                else:
                    updated_at = data["updated_at"]
            except ValueError:
                pass
        
        return cls(
            id=data.get("id", str(uuid4())),
            name=data.get("name", "新建彩排方案"),
            created_at=created_at,
            updated_at=updated_at,
            microphones=[Microphone.from_dict(m) for m in data.get("microphones", [])],
            schedule=[ScheduleEntry.from_dict(s) for s in data.get("schedule", [])],
            forbidden_bands=[ForbiddenBand.from_dict(f) for f in data.get("forbidden_bands", [])],
            channels=[ChannelInfo.from_dict(c) for c in data.get("channels", [])],
            risks=[RiskItem.from_dict(r) for r in data.get("risks", [])],
            notes=data.get("notes", "")
        )
