"""
冲突合并模块 - 负责检测冲突并执行合并策略
"""

import uuid
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import math

from .models import (
    GeoSample,
    ConflictRecord,
    ConflictType,
    ReviewDecision,
    MergeResult,
)


class ConflictDetector:
    COORDINATE_DRIFT_THRESHOLD = 0.0001
    TIME_OUT_OF_ORDER_THRESHOLD_MINUTES = 5

    def __init__(self, photo_base_dirs: Optional[List[str]] = None):
        self.photo_base_dirs = [Path(d) for d in (photo_base_dirs or [])]
        self.conflicts: Dict[str, ConflictRecord] = {}
        self.detected_types: Dict[ConflictType, int] = defaultdict(int)

    def detect_conflicts(self, samples: List[GeoSample]) -> List[ConflictRecord]:
        self.conflicts = {}
        self.detected_types = defaultdict(int)

        samples_by_id = defaultdict(list)
        for sample in samples:
            samples_by_id[sample.sample_id].append(sample)

        for sample_id, sample_group in samples_by_id.items():
            if len(sample_group) > 1:
                conflict = self._detect_id_collision(sample_id, sample_group)
                if conflict:
                    self._add_conflict(conflict)

        self._detect_coordinate_drift(samples)
        self._detect_time_out_of_order(samples)
        self._detect_photo_missing(samples)
        self._detect_modified_overwrite(samples)
        self._detect_field_mismatch(samples)

        return list(self.conflicts.values())

    def _add_conflict(self, conflict: ConflictRecord):
        if conflict.conflict_id not in self.conflicts:
            self.conflicts[conflict.conflict_id] = conflict
            self.detected_types[conflict.conflict_type] += 1

    def _detect_id_collision(self, sample_id: str, samples: List[GeoSample]) -> Optional[ConflictRecord]:
        hashes = set(s.hash_value for s in samples)
        
        if len(hashes) == 1:
            return ConflictRecord(
                conflict_id=f"id_collision_{sample_id}",
                conflict_type=ConflictType.ID_COLLISION,
                samples=samples,
                description=f"样本编号 {sample_id} 存在 {len(samples)} 条重复记录（内容相同）",
            )
        else:
            return ConflictRecord(
                conflict_id=f"id_collision_{sample_id}",
                conflict_type=ConflictType.ID_COLLISION,
                samples=samples,
                description=f"样本编号 {sample_id} 存在 {len(samples)} 条不同内容的记录（可能存在后改）",
            )

    def _detect_coordinate_drift(self, samples: List[GeoSample]):
        samples_by_id = defaultdict(list)
        for sample in samples:
            samples_by_id[sample.sample_id].append(sample)

        for sample_id, sample_group in samples_by_id.items():
            if len(sample_group) < 2:
                continue

            base_sample = sample_group[0]
            for i, sample in enumerate(sample_group[1:], start=1):
                distance = self._calculate_haversine_distance(
                    base_sample.latitude, base_sample.longitude,
                    sample.latitude, sample.longitude
                )

                if distance > self.COORDINATE_DRIFT_THRESHOLD:
                    conflict_id = f"coord_drift_{sample_id}_{i}"
                    conflict = ConflictRecord(
                        conflict_id=conflict_id,
                        conflict_type=ConflictType.COORDINATE_DRIFT,
                        samples=[base_sample, sample],
                        description=f"样本编号 {sample_id} 经纬度存在漂移：距离约 {distance*1000:.2f} 米",
                    )
                    self._add_conflict(conflict)

    def _detect_time_out_of_order(self, samples: List[GeoSample]):
        samples_by_id = defaultdict(list)
        for sample in samples:
            samples_by_id[sample.sample_id].append(sample)

        for sample_id, sample_group in samples_by_id.items():
            if len(sample_group) < 2:
                continue

            sorted_by_time = sorted(sample_group, key=lambda s: s.sample_time if s.sample_time else datetime.min)
            sorted_by_modify = sorted(
                sample_group, 
                key=lambda s: s.modify_time if s.modify_time else (s.create_time if s.create_time else datetime.min)
            )

            if sorted_by_time != sorted_by_modify:
                conflict_id = f"time_order_{sample_id}"
                conflict = ConflictRecord(
                    conflict_id=conflict_id,
                    conflict_type=ConflictType.TIME_OUT_OF_ORDER,
                    samples=sample_group,
                    description=f"样本编号 {sample_id} 采样时间与修改时间顺序不一致，可能存在后改记录被覆盖风险",
                )
                self._add_conflict(conflict)

    def _detect_photo_missing(self, samples: List[GeoSample]):
        for sample in samples:
            if not sample.photo_paths:
                continue

            missing_photos = []
            for photo_path in sample.photo_paths:
                if not self._photo_exists(photo_path):
                    missing_photos.append(photo_path)

            if missing_photos:
                conflict_id = f"photo_missing_{sample.sample_id}_{uuid.uuid4().hex[:8]}"
                conflict = ConflictRecord(
                    conflict_id=conflict_id,
                    conflict_type=ConflictType.PHOTO_MISSING,
                    samples=[sample],
                    description=f"样本编号 {sample.sample_id} 缺少关联照片：{', '.join(missing_photos)}",
                )
                self._add_conflict(conflict)

    def _detect_modified_overwrite(self, samples: List[GeoSample]):
        samples_by_id = defaultdict(list)
        for sample in samples:
            samples_by_id[sample.sample_id].append(sample)

        for sample_id, sample_group in samples_by_id.items():
            if len(sample_group) < 2:
                continue

            hashes = set()
            for sample in sample_group:
                hashes.add(sample.hash_value)

            if len(hashes) > 1:
                sorted_by_modify = sorted(
                    sample_group,
                    key=lambda s: s.modify_time if s.modify_time else (s.create_time if s.create_time else datetime.min)
                )
                
                latest = sorted_by_modify[-1]
                earliest = sorted_by_modify[0]

                conflict_id = f"modified_overwrite_{sample_id}"
                conflict = ConflictRecord(
                    conflict_id=conflict_id,
                    conflict_type=ConflictType.MODIFIED_OVERWRITE,
                    samples=sample_group,
                    description=f"样本编号 {sample_id} 存在后改记录风险：最新修改 {latest.modify_time if latest.modify_time else '未知'} "
                              f"与最早记录 {earliest.modify_time if earliest.modify_time else '未知'} 内容不同",
                )
                self._add_conflict(conflict)

    def _detect_field_mismatch(self, samples: List[GeoSample]):
        samples_by_id = defaultdict(list)
        for sample in samples:
            samples_by_id[sample.sample_id].append(sample)

        for sample_id, sample_group in samples_by_id.items():
            if len(sample_group) < 2:
                continue

            fields_to_check = ["collector", "rock_type", "description", "depth"]
            
            for field in fields_to_check:
                values = set()
                for sample in sample_group:
                    val = getattr(sample, field, None)
                    values.add(val)

                if len(values) > 1 and None not in values:
                    conflict_id = f"field_mismatch_{sample_id}_{field}"
                    conflict = ConflictRecord(
                        conflict_id=conflict_id,
                        conflict_type=ConflictType.FIELD_MISMATCH,
                        samples=sample_group,
                        description=f"样本编号 {sample_id} 字段 '{field}' 存在不一致：{list(values)}",
                    )
                    self._add_conflict(conflict)

    def _calculate_haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6371.0

        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)

        dlon = lon2_rad - lon1_rad
        dlat = lat2_rad - lat1_rad

        a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        distance = R * c
        return distance

    def _photo_exists(self, photo_path: str) -> bool:
        if Path(photo_path).exists():
            return True

        for base_dir in self.photo_base_dirs:
            full_path = base_dir / photo_path
            if full_path.exists():
                return True

            photo_name = Path(photo_path).name
            for match in base_dir.rglob(photo_name):
                if match.exists():
                    return True

        return False

    def get_conflicts_by_type(self, conflict_type: ConflictType) -> List[ConflictRecord]:
        return [c for c in self.conflicts.values() if c.conflict_type == conflict_type]

    def get_conflict_stats(self) -> Dict[ConflictType, int]:
        return dict(self.detected_types)


class SampleMerger:
    def __init__(self, conflict_detector: Optional[ConflictDetector] = None):
        self.conflict_detector = conflict_detector or ConflictDetector()
        self.merged_samples: Dict[str, GeoSample] = {}
        self.merge_result = MergeResult()

    def merge(self, samples: List[GeoSample], auto_resolve: bool = False) -> Tuple[List[GeoSample], List[ConflictRecord]]:
        self.merge_result = MergeResult()
        self.merge_result.total_samples = len(samples)

        conflicts = self.conflict_detector.detect_conflicts(samples)
        self.merge_result.conflicts_found = len(conflicts)
        self.merge_result.conflicts_pending = len([c for c in conflicts if not c.is_resolved])

        samples_by_id = self._group_samples_by_id(samples)

        for sample_id, sample_group in samples_by_id.items():
            if len(sample_group) == 1:
                self.merged_samples[sample_id] = sample_group[0]
                self.merge_result.merged_samples += 1
            else:
                if auto_resolve:
                    resolved_sample = self._auto_resolve(sample_id, sample_group)
                    self.merged_samples[sample_id] = resolved_sample
                    self.merge_result.merged_samples += 1
                    self.merge_result.conflicts_resolved += 1
                else:
                    self.merge_result.conflicts_pending += 1

        self.merge_result.final_sample_count = len(self.merged_samples)

        return list(self.merged_samples.values()), conflicts

    def _group_samples_by_id(self, samples: List[GeoSample]) -> Dict[str, List[GeoSample]]:
        samples_by_id = defaultdict(list)
        for sample in samples:
            samples_by_id[sample.sample_id].append(sample)
        return samples_by_id

    def _auto_resolve(self, sample_id: str, samples: List[GeoSample]) -> GeoSample:
        sorted_by_modify = sorted(
            samples,
            key=lambda s: s.modify_time if s.modify_time else (s.create_time if s.create_time else datetime.min),
            reverse=True
        )
        
        latest = sorted_by_modify[0]
        
        merged_sample = GeoSample(
            sample_id=latest.sample_id,
            latitude=latest.latitude,
            longitude=latest.longitude,
            sample_time=latest.sample_time,
            collector=latest.collector,
            photo_paths=[],
            rock_type=latest.rock_type,
            description=latest.description,
            depth=latest.depth,
            hash_value=latest.hash_value,
            package_name=latest.package_name,
            create_time=latest.create_time,
            modify_time=latest.modify_time,
            custom_fields=latest.custom_fields.copy(),
        )

        all_photos = set()
        for sample in samples:
            all_photos.update(sample.photo_paths)
        merged_sample.photo_paths = list(all_photos)

        return merged_sample

    def resolve_conflict(self, conflict: ConflictRecord, decision: ReviewDecision, 
                         selected_sample_index: Optional[int] = None, notes: str = "",
                         resolved_by: str = "") -> Optional[GeoSample]:
        conflict.is_resolved = True
        conflict.decision = decision
        conflict.resolved_at = datetime.now()
        conflict.resolved_by = resolved_by
        conflict.notes = notes

        sample_id = conflict.samples[0].sample_id

        if decision == ReviewDecision.KEEP_FIRST:
            result = conflict.samples[0]
        elif decision == ReviewDecision.KEEP_LAST:
            result = conflict.samples[-1]
        elif decision == ReviewDecision.KEEP_SPECIFIC:
            if selected_sample_index is not None and 0 <= selected_sample_index < len(conflict.samples):
                result = conflict.samples[selected_sample_index]
            else:
                result = conflict.samples[0]
        elif decision == ReviewDecision.CREATE_NEW:
            result = self._create_merged_sample(conflict.samples)
        elif decision == ReviewDecision.MARK_DUPLICATE:
            result = None
        else:
            result = conflict.samples[0]

        if result:
            self.merged_samples[sample_id] = result
            self.merge_result.final_sample_count = len(self.merged_samples)
            self.merge_result.conflicts_resolved += 1
            self.merge_result.conflicts_pending -= 1

        return result

    def _create_merged_sample(self, samples: List[GeoSample]) -> GeoSample:
        sorted_by_modify = sorted(
            samples,
            key=lambda s: s.modify_time if s.modify_time else (s.create_time if s.create_time else datetime.min),
            reverse=True
        )
        
        latest = sorted_by_modify[0]
        
        all_photos = set()
        for sample in samples:
            all_photos.update(sample.photo_paths)

        merged_sample = GeoSample(
            sample_id=latest.sample_id,
            latitude=latest.latitude,
            longitude=latest.longitude,
            sample_time=latest.sample_time,
            collector=latest.collector,
            photo_paths=list(all_photos),
            rock_type=latest.rock_type,
            description=latest.description,
            depth=latest.depth,
            hash_value="",
            package_name="merged",
            create_time=min(s.create_time for s in samples if s.create_time) if any(s.create_time for s in samples) else None,
            modify_time=datetime.now(),
            custom_fields=latest.custom_fields.copy(),
        )

        return merged_sample

    def get_merged_samples(self) -> List[GeoSample]:
        return list(self.merged_samples.values())

    def get_merge_result(self) -> MergeResult:
        return self.merge_result
