from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import List, Optional, Dict, Any


class CueType(Enum):
    LIGHT = "light"
    AUDIO = "audio"
    VIDEO = "video"
    FLY = "fly"
    OTHER = "other"


class IssueType(Enum):
    CUE_MISSING = "cue_missing"
    LIGHT_SCENE_NOT_FOUND = "light_scene_not_found"
    AUDIO_FILE_BROKEN = "audio_file_broken"
    ACTOR_CHANGE_TIME_INSUFFICIENT = "actor_change_time_insufficient"


class IssueSeverity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class Cue:
    cue_id: str
    description: str
    cue_type: CueType
    time: str
    light_scene_id: Optional[str] = None
    audio_file_id: Optional[str] = None
    notes: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LightScene:
    scene_id: str
    name: str
    intensity: int
    color_temperature: Optional[int] = None
    channels: Dict[str, int] = field(default_factory=dict)
    notes: Optional[str] = None


@dataclass
class AudioFile:
    cue_id: str
    filename: str
    path: str
    duration_seconds: Optional[float] = None
    format: Optional[str] = None
    exists: bool = True


@dataclass
class ActorSchedule:
    actor_name: str
    scene_id: str
    enter_time: str
    exit_time: str
    notes: Optional[str] = None
    costume: Optional[str] = None
    entry_direction: Optional[str] = None
    exit_direction: Optional[str] = None


@dataclass
class Issue:
    issue_id: str
    issue_type: IssueType
    severity: IssueSeverity
    title: str
    description: str
    related_cue_id: Optional[str] = None
    related_actor: Optional[str] = None
    related_file: Optional[str] = None
    time_code: Optional[str] = None
    notes: List[str] = field(default_factory=list)
    resolved: bool = False
    created_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def add_note(self, note: str):
        self.notes.append(note)

    def resolve(self):
        self.resolved = True


@dataclass
class Project:
    project_id: str
    name: str
    path: str
    created_at: datetime = field(default_factory=datetime.now)
    last_scan_at: Optional[datetime] = None
    cues: List[Cue] = field(default_factory=list)
    light_scenes: List[LightScene] = field(default_factory=list)
    audio_files: List[AudioFile] = field(default_factory=list)
    actor_schedules: List[ActorSchedule] = field(default_factory=list)
    issues: List[Issue] = field(default_factory=list)

    def get_cue_by_id(self, cue_id: str) -> Optional[Cue]:
        for cue in self.cues:
            if cue.cue_id == cue_id:
                return cue
        return None

    def get_light_scene_by_id(self, scene_id: str) -> Optional[LightScene]:
        for scene in self.light_scenes:
            if scene.scene_id == scene_id:
                return scene
        return None

    def get_audio_file_by_cue_id(self, cue_id: str) -> Optional[AudioFile]:
        for audio_file in self.audio_files:
            if audio_file.cue_id == cue_id:
                return audio_file
        return None

    def get_issues_by_type(self, issue_type: IssueType) -> List[Issue]:
        return [issue for issue in self.issues if issue.issue_type == issue_type]

    def get_unresolved_issues(self) -> List[Issue]:
        return [issue for issue in self.issues if not issue.resolved]

    def get_issue_by_id(self, issue_id: str) -> Optional[Issue]:
        for issue in self.issues:
            if issue.issue_id == issue_id:
                return issue
        return None
