from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any


class PhotoStatus(Enum):
    KEEP = "keep"
    REMOVE_DUPLICATE = "remove_duplicate"
    REMOVE_CLOSED_EYES = "remove_closed_eyes"
    REMOVE_LOW_SCORE = "remove_low_score"
    REMOVE_MANUAL = "remove_manual"
    PENDING = "pending"


@dataclass
class FaceInfo:
    face_id: str
    person_name: Optional[str] = None
    is_key_person: bool = False
    confidence: float = 0.0
    bounding_box: tuple = field(default_factory=tuple)
    eyes_open: Optional[bool] = None
    eye_confidence: float = 0.0


@dataclass
class PhotoMetadata:
    file_path: str
    file_name: str
    file_size: int
    capture_time: Optional[datetime] = None
    camera_model: Optional[str] = None
    iso: Optional[int] = None
    aperture: Optional[float] = None
    shutter_speed: Optional[str] = None
    focal_length: Optional[float] = None
    width: int = 0
    height: int = 0


@dataclass
class PhotoRecord:
    photo_id: str
    metadata: PhotoMetadata
    faces: List[FaceInfo] = field(default_factory=list)
    score: float = 0.0
    score_reasons: List[str] = field(default_factory=list)
    status: PhotoStatus = PhotoStatus.PENDING
    status_reason: Optional[str] = None
    duplicate_group_id: Optional[str] = None
    duplicate_rank: int = 0
    user_notes: str = ""
    tags: List[str] = field(default_factory=list)
    perceptual_hash: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "photo_id": self.photo_id,
            "file_path": self.metadata.file_path,
            "file_name": self.metadata.file_name,
            "capture_time": self.metadata.capture_time.isoformat() if self.metadata.capture_time else None,
            "score": self.score,
            "score_reasons": self.score_reasons,
            "status": self.status.value,
            "status_reason": self.status_reason,
            "duplicate_group_id": self.duplicate_group_id,
            "duplicate_rank": self.duplicate_rank,
            "faces_count": len(self.faces),
            "key_persons": [f.person_name for f in self.faces if f.is_key_person],
            "closed_eyes_count": len([f for f in self.faces if f.eyes_open is False]),
            "user_notes": self.user_notes,
            "tags": self.tags,
        }


@dataclass
class DuplicateGroup:
    group_id: str
    photos: List[PhotoRecord] = field(default_factory=list)
    best_photo: Optional[PhotoRecord] = None
    
    def __post_init__(self):
        if self.photos and not self.best_photo:
            self._select_best()
    
    def _select_best(self):
        ranked = sorted(
            self.photos,
            key=lambda p: (p.score, -len(p.faces)),
            reverse=True
        )
        for i, photo in enumerate(ranked):
            photo.duplicate_rank = i
            photo.duplicate_group_id = self.group_id
        self.best_photo = ranked[0] if ranked else None


@dataclass
class CurateResult:
    total_photos: int = 0
    keep_count: int = 0
    remove_count: int = 0
    duplicate_groups: int = 0
    photos_removed_as_duplicate: int = 0
    photos_removed_closed_eyes: int = 0
    photos_removed_low_score: int = 0
    photos_removed_manual: int = 0
    key_persons_found: List[str] = field(default_factory=list)
    key_person_photos: Dict[str, int] = field(default_factory=dict)
    average_score: float = 0.0
    processing_time: float = 0.0
    photo_records: List[PhotoRecord] = field(default_factory=list)
    duplicate_groups_list: List[DuplicateGroup] = field(default_factory=list)
