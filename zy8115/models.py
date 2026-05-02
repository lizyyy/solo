from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Any, Set
from datetime import datetime


class RiskType(Enum):
    CHANNEL_OVERLAP = "通道重叠"
    TIME_BEFORE_TRACK_START = "时间早于曲目起点"
    MISSING_TRACK_MARKER = "缺失曲目标记"
    MISSING_CUE = "缺失 CUE 标记"
    CHANNEL_CONFLICT = "通道配置冲突"
    UNKNOWN_CHANNEL = "未知通道"
    INVALID_CUE_NUMBER = "无效CUE编号"


class RiskLevel(Enum):
    CRITICAL = "严重"
    HIGH = "高"
    MEDIUM = "中"
    LOW = "低"


@dataclass
class DeviceChannel:
    channel_number: int
    device_name: str
    device_type: str
    scene: str
    description: str = ""
    patch: Optional[int] = None
    
    def __hash__(self):
        return hash((self.channel_number, self.device_name))
    
    def __eq__(self, other):
        if not isinstance(other, DeviceChannel):
            return False
        return (self.channel_number == other.channel_number and 
                self.device_name == other.device_name)


@dataclass
class TrackMarker:
    name: str
    start_time: float
    end_time: float
    duration: float
    cue_points: List[float] = field(default_factory=list)
    description: str = ""
    
    def contains_time(self, time: float) -> bool:
        return self.start_time <= time <= self.end_time


@dataclass
class LightingCue:
    cue_number: str
    scene: str
    description: str
    time: float
    channels: Dict[int, int]
    track_name: Optional[str] = None
    track_time: Optional[float] = None
    notes: str = ""
    fade_in: Optional[float] = None
    fade_out: Optional[float] = None
    
    def __hash__(self):
        return hash(self.cue_number)
    
    def __eq__(self, other):
        if not isinstance(other, LightingCue):
            return False
        return self.cue_number == other.cue_number
    
    def get_effective_channels(self) -> Dict[int, int]:
        return {k: v for k, v in self.channels.items() if v > 0}


@dataclass
class Risk:
    id: str
    risk_type: RiskType
    level: RiskLevel
    title: str
    description: str
    affected_cues: List[str] = field(default_factory=list)
    affected_channels: List[int] = field(default_factory=list)
    affected_tracks: List[str] = field(default_factory=list)
    time_reference: Optional[float] = None
    is_confirmed: bool = False
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    notes: str = ""
    
    def confirm(self, user: str = "System"):
        self.is_confirmed = True
        self.confirmed_by = user
        self.confirmed_at = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "risk_type": self.risk_type.value,
            "level": self.level.value,
            "title": self.title,
            "description": self.description,
            "affected_cues": self.affected_cues,
            "affected_channels": self.affected_channels,
            "affected_tracks": self.affected_tracks,
            "time_reference": self.time_reference,
            "is_confirmed": self.is_confirmed,
            "confirmed_by": self.confirmed_by,
            "confirmed_at": self.confirmed_at.isoformat() if self.confirmed_at else None,
            "notes": self.notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Risk":
        try:
            risk_type = RiskType(data.get("risk_type", ""))
        except ValueError:
            risk_type = RiskType.CHANNEL_CONFLICT
        
        try:
            level = RiskLevel(data.get("level", ""))
        except ValueError:
            level = RiskLevel.MEDIUM
        
        confirmed_at = None
        if data.get("confirmed_at"):
            try:
                confirmed_at = datetime.fromisoformat(data["confirmed_at"])
            except ValueError:
                confirmed_at = None
        
        return cls(
            id=data["id"],
            risk_type=risk_type,
            level=level,
            title=data["title"],
            description=data["description"],
            affected_cues=data.get("affected_cues", []),
            affected_channels=data.get("affected_channels", []),
            affected_tracks=data.get("affected_tracks", []),
            time_reference=data.get("time_reference"),
            is_confirmed=data.get("is_confirmed", False),
            confirmed_by=data.get("confirmed_by"),
            confirmed_at=confirmed_at,
            notes=data.get("notes", "")
        )


@dataclass
class ChannelUsage:
    channel_number: int
    cues: List[str]
    times: List[float]
    conflicts: List[str] = field(default_factory=list)
    
    def has_conflict(self) -> bool:
        return len(self.cues) > 1


@dataclass
class ReviewProject:
    name: str
    lighting_cues: List[LightingCue] = field(default_factory=list)
    track_markers: List[TrackMarker] = field(default_factory=list)
    device_channels: List[DeviceChannel] = field(default_factory=list)
    risks: List[Risk] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: Optional[datetime] = None
    
    def get_scenes(self) -> Set[str]:
        scenes = set()
        for cue in self.lighting_cues:
            if cue.scene:
                scenes.add(cue.scene)
        for channel in self.device_channels:
            if channel.scene:
                scenes.add(channel.scene)
        return scenes
    
    def get_devices(self) -> Set[str]:
        return {c.device_name for c in self.device_channels}
    
    def get_tracks(self) -> Set[str]:
        return {t.name for t in self.track_markers}
    
    def get_risks_by_type(self, risk_type: RiskType) -> List[Risk]:
        return [r for r in self.risks if r.risk_type == risk_type]
    
    def get_risks_by_level(self, level: RiskLevel) -> List[Risk]:
        return [r for r in self.risks if r.level == level]
    
    def get_unconfirmed_risks(self) -> List[Risk]:
        return [r for r in self.risks if not r.is_confirmed]
    
    def get_confirmed_risks(self) -> List[Risk]:
        return [r for r in self.risks if r.is_confirmed]
    
    def get_channel_usage(self) -> Dict[int, ChannelUsage]:
        usage = {}
        for cue in self.lighting_cues:
            for channel in cue.channels.keys():
                if channel not in usage:
                    usage[channel] = ChannelUsage(
                        channel_number=channel,
                        cues=[],
                        times=[]
                    )
                usage[channel].cues.append(cue.cue_number)
                usage[channel].times.append(cue.time)
        
        for channel_num, channel_usage in usage.items():
            if len(channel_usage.cues) > 1:
                channel_usage.conflicts = channel_usage.cues.copy()
        
        return usage
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "lighting_cues": [
                {
                    "cue_number": c.cue_number,
                    "scene": c.scene,
                    "description": c.description,
                    "time": c.time,
                    "channels": c.channels,
                    "track_name": c.track_name,
                    "track_time": c.track_time,
                    "notes": c.notes,
                    "fade_in": c.fade_in,
                    "fade_out": c.fade_out
                }
                for c in self.lighting_cues
            ],
            "track_markers": [
                {
                    "name": t.name,
                    "start_time": t.start_time,
                    "end_time": t.end_time,
                    "duration": t.duration,
                    "cue_points": t.cue_points,
                    "description": t.description
                }
                for t in self.track_markers
            ],
            "device_channels": [
                {
                    "channel_number": c.channel_number,
                    "device_name": c.device_name,
                    "device_type": c.device_type,
                    "scene": c.scene,
                    "description": c.description,
                    "patch": c.patch
                }
                for c in self.device_channels
            ],
            "risks": [r.to_dict() for r in self.risks],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ReviewProject":
        created_at = None
        if data.get("created_at"):
            try:
                created_at = datetime.fromisoformat(data["created_at"])
            except ValueError:
                created_at = datetime.now()
        
        updated_at = None
        if data.get("updated_at"):
            try:
                updated_at = datetime.fromisoformat(data["updated_at"])
            except ValueError:
                updated_at = None
        
        project = cls(
            name=data["name"],
            created_at=created_at or datetime.now(),
            updated_at=updated_at
        )
        
        for cue_data in data.get("lighting_cues", []):
            project.lighting_cues.append(LightingCue(
                cue_number=cue_data["cue_number"],
                scene=cue_data["scene"],
                description=cue_data["description"],
                time=cue_data["time"],
                channels=cue_data["channels"],
                track_name=cue_data.get("track_name"),
                track_time=cue_data.get("track_time"),
                notes=cue_data.get("notes", ""),
                fade_in=cue_data.get("fade_in"),
                fade_out=cue_data.get("fade_out")
            ))
        
        for track_data in data.get("track_markers", []):
            project.track_markers.append(TrackMarker(
                name=track_data["name"],
                start_time=track_data["start_time"],
                end_time=track_data["end_time"],
                duration=track_data["duration"],
                cue_points=track_data.get("cue_points", []),
                description=track_data.get("description", "")
            ))
        
        for channel_data in data.get("device_channels", []):
            project.device_channels.append(DeviceChannel(
                channel_number=channel_data["channel_number"],
                device_name=channel_data["device_name"],
                device_type=channel_data["device_type"],
                scene=channel_data["scene"],
                description=channel_data.get("description", ""),
                patch=channel_data.get("patch")
            ))
        
        for risk_data in data.get("risks", []):
            project.risks.append(Risk.from_dict(risk_data))
        
        return project