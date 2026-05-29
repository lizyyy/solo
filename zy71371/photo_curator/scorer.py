from typing import List, Optional
from collections import defaultdict

from .models import PhotoRecord, PhotoStatus, FaceInfo


class PhotoScorer:
    def __init__(
        self,
        min_score: float = 50.0,
        reject_closed_eyes: bool = True,
        closed_eyes_threshold: int = 1,
        key_person_bonus: float = 20.0,
        face_count_bonus: float = 5.0,
        resolution_bonus: bool = True
    ):
        self.min_score = min_score
        self.reject_closed_eyes = reject_closed_eyes
        self.closed_eyes_threshold = closed_eyes_threshold
        self.key_person_bonus = key_person_bonus
        self.face_count_bonus = face_count_bonus
        self.resolution_bonus = resolution_bonus
    
    def score_photo(self, photo: PhotoRecord) -> PhotoRecord:
        score = 50.0
        reasons = []
        
        if self.reject_closed_eyes:
            closed_eyes_count = len([f for f in photo.faces if f.eyes_open is False])
            if closed_eyes_count >= self.closed_eyes_threshold:
                photo.status = PhotoStatus.REMOVE_CLOSED_EYES
                photo.status_reason = f"检测到 {closed_eyes_count} 张闭眼人脸"
                photo.score = 0.0
                photo.score_reasons = [f"闭眼检测失败: {closed_eyes_count} 人闭眼"]
                return photo
        
        key_person_count = len([f for f in photo.faces if f.is_key_person])
        if key_person_count > 0:
            score += key_person_count * self.key_person_bonus
            reasons.append(f"包含 {key_person_count} 位重点人物 (+{key_person_count * self.key_person_bonus})")
        
        if photo.faces:
            face_count = len(photo.faces)
            score += min(face_count, 5) * self.face_count_bonus
            reasons.append(f"包含 {face_count} 张人脸 (+{min(face_count, 5) * self.face_count_bonus})")
        
        if self.resolution_bonus and photo.metadata.width > 0:
            resolution = photo.metadata.width * photo.metadata.height
            if resolution >= 20_000_000:
                score += 10
                reasons.append("高分辨率 (+10)")
            elif resolution >= 10_000_000:
                score += 5
                reasons.append("中高分辨率 (+5)")
        
        if photo.metadata.file_size > 5 * 1024 * 1024:
            score += 3
            reasons.append("文件大小正常 (+3)")
        
        photo.score = min(score, 100.0)
        photo.score_reasons = reasons
        
        if photo.score < self.min_score and photo.status == PhotoStatus.PENDING:
            photo.status = PhotoStatus.REMOVE_LOW_SCORE
            photo.status_reason = f"评分 {photo.score:.1f} 低于阈值 {self.min_score}"
        
        return photo
    
    def batch_score(self, photos: List[PhotoRecord]) -> List[PhotoRecord]:
        print(f"正在为 {len(photos)} 张图片评分...")
        return [self.score_photo(p) for p in photos]


class PhotoFilter:
    def __init__(self):
        pass
    
    def filter_by_status(self, photos: List[PhotoRecord], status: PhotoStatus) -> List[PhotoRecord]:
        return [p for p in photos if p.status == status]
    
    def filter_by_key_person(self, photos: List[PhotoRecord], person_name: str) -> List[PhotoRecord]:
        return [p for p in photos if any(f.person_name == person_name and f.is_key_person for f in p.faces)]
    
    def filter_by_score_range(self, photos: List[PhotoRecord], min_score: float, max_score: float = 100.0) -> List[PhotoRecord]:
        return [p for p in photos if min_score <= p.score <= max_score]
    
    def filter_by_has_faces(self, photos: List[PhotoRecord], min_faces: int = 1) -> List[PhotoRecord]:
        return [p for p in photos if len(p.faces) >= min_faces]
    
    def filter_by_closed_eyes(self, photos: List[PhotoRecord], has_closed_eyes: bool = True) -> List[PhotoRecord]:
        if has_closed_eyes:
            return [p for p in photos if any(f.eyes_open is False for f in p.faces)]
        else:
            return [p for p in photos if all(f.eyes_open is True for f in p.faces)]
    
    def filter_by_duplicate_group(self, photos: List[PhotoRecord], group_id: str) -> List[PhotoRecord]:
        return [p for p in photos if p.duplicate_group_id == group_id]
    
    def get_keep_photos(self, photos: List[PhotoRecord]) -> List[PhotoRecord]:
        return [p for p in photos if p.status == PhotoStatus.KEEP or (p.status == PhotoStatus.PENDING and p.score >= 50)]
    
    def get_remove_photos(self, photos: List[PhotoRecord]) -> List[PhotoRecord]:
        return [p for p in photos if p.status not in [PhotoStatus.KEEP, PhotoStatus.PENDING]]
    
    def get_duplicate_photos(self, photos: List[PhotoRecord]) -> List[PhotoRecord]:
        return [p for p in photos if p.duplicate_group_id is not None]
    
    def get_key_person_summary(self, photos: List[PhotoRecord]) -> dict:
        person_counts = defaultdict(int)
        for photo in photos:
            for face in photo.faces:
                if face.is_key_person and face.person_name:
                    person_counts[face.person_name] += 1
        return dict(person_counts)
