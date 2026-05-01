import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import logging
from collections import defaultdict

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class MatchResult:
    matched_count: int
    unmatched_sensor: List[Dict]
    unmatched_manual: List[Dict]
    merged_records: pd.DataFrame
    match_details: List[Dict] = field(default_factory=list)
    confidence_scores: Dict[str, float] = field(default_factory=dict)


@dataclass
class DuplicateGroup:
    group_id: str
    records: List[Dict]
    primary_index: int
    merge_suggestion: str
    distance_threshold: float


class DataMatcher:
    EARTH_RADIUS_KM = 6371.0
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.duplicate_distance_threshold = self.config.get(
            "RULE_CONFIG", {}
        ).get("duplicate_distance_meters", 10) / 1000.0
        
        self.time_window_hours = self.config.get(
            "RULE_CONFIG", {}
        ).get("abnormal_sound_hours", 2)
    
    def haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        if pd.isna(lat1) or pd.isna(lon1) or pd.isna(lat2) or pd.isna(lon2):
            return float('inf')
        
        lat1_rad = np.radians(lat1)
        lon1_rad = np.radians(lon1)
        lat2_rad = np.radians(lat2)
        lon2_rad = np.radians(lon2)
        
        d_lat = lat2_rad - lat1_rad
        d_lon = lon2_rad - lon1_rad
        
        a = np.sin(d_lat / 2.0) ** 2 + \
            np.cos(lat1_rad) * np.cos(lat2_rad) * \
            np.sin(d_lon / 2.0) ** 2
        
        c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
        
        return self.EARTH_RADIUS_KM * c
    
    def match_sensor_manual(
        self,
        sensor_df: pd.DataFrame,
        manual_df: pd.DataFrame,
        distance_threshold_km: Optional[float] = None
    ) -> MatchResult:
        distance_threshold_km = distance_threshold_km or self.duplicate_distance_threshold
        
        if sensor_df.empty:
            return MatchResult(
                matched_count=0,
                unmatched_sensor=[],
                unmatched_manual=manual_df.to_dict('records'),
                merged_records=pd.DataFrame()
            )
        
        if manual_df.empty:
            return MatchResult(
                matched_count=0,
                unmatched_sensor=sensor_df.to_dict('records'),
                unmatched_manual=[],
                merged_records=pd.DataFrame()
            )
        
        matched_records = []
        unmatched_sensor = []
        unmatched_manual = []
        match_details = []
        confidence_scores = {}
        
        sensor_matched = set()
        manual_matched = set()
        
        sensor_records = sensor_df.to_dict('records')
        manual_records = manual_df.to_dict('records')
        
        for s_idx, sensor in enumerate(sensor_records):
            best_match = None
            best_distance = float('inf')
            best_confidence = 0.0
            best_m_idx = -1
            
            s_norm_id = sensor.get('normalized_id', '')
            s_lat = sensor.get('纬度', 0)
            s_lon = sensor.get('经度', 0)
            s_time = sensor.get('记录时间', None)
            
            for m_idx, manual in enumerate(manual_records):
                if m_idx in manual_matched:
                    continue
                
                m_norm_id = manual.get('normalized_id', '')
                m_lat = manual.get('纬度', 0)
                m_lon = manual.get('经度', 0)
                m_time = manual.get('巡检时间', None)
                
                id_match = (s_norm_id and m_norm_id and s_norm_id == m_norm_id)
                
                distance = self.haversine_distance(s_lat, s_lon, m_lat, m_lon)
                
                time_match = True
                if s_time is not None and m_time is not None and pd.notna(s_time) and pd.notna(m_time):
                    time_diff = abs((s_time - m_time).total_seconds() / 3600.0)
                    time_match = time_diff <= self.time_window_hours * 2
                
                if id_match:
                    confidence = 0.95
                elif distance <= distance_threshold_km:
                    confidence = 0.85 if time_match else 0.6
                else:
                    confidence = 0.0
                
                if confidence > 0.5 and distance < best_distance:
                    best_match = manual
                    best_distance = distance
                    best_confidence = confidence
                    best_m_idx = m_idx
            
            if best_match is not None and best_confidence >= 0.6:
                merged = self._merge_records(sensor, best_match, best_confidence, best_distance)
                matched_records.append(merged)
                
                sensor_matched.add(s_idx)
                manual_matched.add(best_m_idx)
                
                match_key = f"{s_idx}-{best_m_idx}"
                confidence_scores[match_key] = best_confidence
                
                match_details.append({
                    "sensor_index": s_idx,
                    "manual_index": best_m_idx,
                    "sensor_id": sensor.get('井盖编号', ''),
                    "manual_id": best_match.get('井盖编号', ''),
                    "normalized_id": s_norm_id,
                    "distance_km": best_distance,
                    "confidence": best_confidence,
                    "match_type": "id_match" if s_norm_id == best_match.get('normalized_id', '') else "location_match"
                })
        
        for s_idx, sensor in enumerate(sensor_records):
            if s_idx not in sensor_matched:
                unmatched_sensor.append(sensor)
        
        for m_idx, manual in enumerate(manual_records):
            if m_idx not in manual_matched:
                unmatched_manual.append(manual)
        
        return MatchResult(
            matched_count=len(matched_records),
            unmatched_sensor=unmatched_sensor,
            unmatched_manual=unmatched_manual,
            merged_records=pd.DataFrame(matched_records),
            match_details=match_details,
            confidence_scores=confidence_scores
        )
    
    def find_duplicates(
        self,
        df: pd.DataFrame,
        id_column: str = 'normalized_id',
        distance_threshold_km: Optional[float] = None
    ) -> List[DuplicateGroup]:
        if df.empty:
            return []
        
        distance_threshold_km = distance_threshold_km or self.duplicate_distance_threshold
        
        groups = defaultdict(list)
        records = df.to_dict('records')
        
        for idx, record in enumerate(records):
            norm_id = record.get(id_column, '')
            groups[norm_id].append((idx, record))
        
        duplicate_groups = []
        group_counter = 0
        
        for norm_id, idx_records in groups.items():
            if len(idx_records) <= 1:
                continue
            
            indices = [i for i, _ in idx_records]
            records_list = [r for _, r in idx_records]
            
            primary_idx = self._select_primary(records_list)
            
            distances = []
            for i, r in enumerate(records_list):
                if i != primary_idx:
                    dist = self.haversine_distance(
                        records_list[primary_idx].get('纬度', 0),
                        records_list[primary_idx].get('经度', 0),
                        r.get('纬度', 0),
                        r.get('经度', 0)
                    )
                    distances.append(dist)
            
            max_dist = max(distances) if distances else 0
            
            if max_dist <= distance_threshold_km:
                group_counter += 1
                duplicate_groups.append(DuplicateGroup(
                    group_id=f"DUPLICATE_GROUP_{group_counter:04d}",
                    records=records_list,
                    primary_index=indices[primary_idx],
                    merge_suggestion=self._generate_merge_suggestion(records_list, primary_idx),
                    distance_threshold=distance_threshold_km * 1000
                ))
        
        ungrouped = []
        for idx, record in enumerate(records):
            in_group = False
            for group in duplicate_groups:
                for r in group.records:
                    if r.get('井盖编号', '') == record.get('井盖编号', '') and \
                       abs(r.get('纬度', 0) - record.get('纬度', 0)) < 0.0001:
                        in_group = True
                        break
            if not in_group:
                ungrouped.append((idx, record))
        
        for i in range(len(ungrouped)):
            idx1, r1 = ungrouped[i]
            for j in range(i + 1, len(ungrouped)):
                idx2, r2 = ungrouped[j]
                
                dist = self.haversine_distance(
                    r1.get('纬度', 0), r1.get('经度', 0),
                    r2.get('纬度', 0), r2.get('经度', 0)
                )
                
                if dist <= distance_threshold_km:
                    group_counter += 1
                    records_list = [r1, r2]
                    primary_idx = 0 if self._is_better_record(r1, r2) else 1
                    
                    duplicate_groups.append(DuplicateGroup(
                        group_id=f"DUPLICATE_GROUP_{group_counter:04d}",
                        records=records_list,
                        primary_index=idx1 if primary_idx == 0 else idx2,
                        merge_suggestion=self._generate_merge_suggestion(records_list, primary_idx),
                        distance_threshold=distance_threshold_km * 1000
                    ))
        
        return duplicate_groups
    
    def merge_duplicates(
        self,
        group: DuplicateGroup,
        keep_primary: bool = True
    ) -> Dict:
        if not group.records:
            return {}
        
        if keep_primary:
            primary = group.records[group.primary_index] if group.primary_index < len(group.records) else group.records[0]
        else:
            primary = self._select_best_merged(group.records)
        
        merged = primary.copy()
        
        all_sound_counts = []
        all_vibrations = []
        all_times = []
        all_has_sound = []
        all_water_depths = []
        
        for record in group.records:
            if '异响次数' in record and pd.notna(record['异响次数']):
                all_sound_counts.append(record['异响次数'])
            if '振动强度' in record and pd.notna(record['振动强度']):
                all_vibrations.append(record['振动强度'])
            if '记录时间' in record and pd.notna(record['记录时间']):
                all_times.append(record['记录时间'])
            if '巡检时间' in record and pd.notna(record['巡检时间']):
                all_times.append(record['巡检时间'])
            if 'has_abnormal_sound' in record:
                all_has_sound.append(record['has_abnormal_sound'])
            if '积水深度' in record and pd.notna(record['积水深度']):
                all_water_depths.append(record['积水深度'])
        
        if all_sound_counts:
            merged['merged_异响次数总和'] = sum(all_sound_counts)
            merged['merged_异响次数最大值'] = max(all_sound_counts)
        
        if all_vibrations:
            merged['merged_振动强度平均'] = np.mean(all_vibrations)
        
        if all_times:
            merged['merged_最早时间'] = min(all_times)
            merged['merged_最晚时间'] = max(all_times)
        
        if all_has_sound:
            merged['merged_确认有异响'] = any(all_has_sound)
        
        if all_water_depths:
            merged['merged_最大积水深度'] = max(all_water_depths)
        
        merged['merged_来源记录数'] = len(group.records)
        merged['merged_group_id'] = group.group_id
        merged['merged_井盖编号列表'] = [r.get('井盖编号', '') for r in group.records]
        
        return merged
    
    def _merge_records(
        self,
        sensor: Dict,
        manual: Dict,
        confidence: float,
        distance: float
    ) -> Dict:
        merged = {}
        
        for key, value in sensor.items():
            merged[f"sensor_{key}"] = value
        
        for key, value in manual.items():
            merged[f"manual_{key}"] = value
        
        merged['match_confidence'] = confidence
        merged['match_distance_km'] = distance
        
        merged['井盖编号'] = sensor.get('井盖编号', manual.get('井盖编号', ''))
        merged['normalized_id'] = sensor.get('normalized_id', manual.get('normalized_id', ''))
        merged['纬度'] = sensor.get('纬度', manual.get('纬度', 0))
        merged['经度'] = sensor.get('经度', manual.get('经度', 0))
        
        sensor_time = sensor.get('记录时间')
        manual_time = manual.get('巡检时间')
        
        if sensor_time is not None and pd.notna(sensor_time):
            merged['事件时间'] = sensor_time
        elif manual_time is not None and pd.notna(manual_time):
            merged['事件时间'] = manual_time
        else:
            merged['事件时间'] = pd.NaT
        
        merged['异响次数'] = sensor.get('异响次数', 0)
        merged['振动强度'] = sensor.get('振动强度', 0)
        merged['has_abnormal_sound'] = manual.get('has_abnormal_sound', False)
        merged['积水深度'] = manual.get('积水深度', 0)
        merged['巡检员'] = manual.get('巡检员', '')
        merged['状态'] = manual.get('状态', '')
        
        merged['街区'] = sensor.get('街区', manual.get('街区', '未知'))
        
        return merged
    
    def _select_primary(self, records: List[Dict]) -> int:
        best_idx = 0
        best_score = -1
        
        for idx, record in enumerate(records):
            score = 0
            
            if record.get('异响次数', 0) > 0:
                score += 10
            if record.get('振动强度', 0) > 0:
                    score += 5
            if record.get('has_abnormal_sound', False):
                score += 15
            if record.get('巡检员'):
                score += 3
            if record.get('状态'):
                score += 2
            
            time_val = record.get('记录时间') or record.get('巡检时间')
            if time_val is not None and pd.notna(time_val):
                score += 8
            
            if score > best_score:
                best_score = score
                best_idx = idx
        
        return best_idx
    
    def _is_better_record(self, r1: Dict, r2: Dict) -> bool:
        score1 = 0
        score2 = 0
        
        if r1.get('异响次数', 0) > 0:
            score1 += 10
        if r2.get('异响次数', 0) > 0:
            score2 += 10
        
        if r1.get('has_abnormal_sound', False):
            score1 += 15
        if r2.get('has_abnormal_sound', False):
            score2 += 15
        
        time1 = r1.get('记录时间') or r1.get('巡检时间')
        time2 = r2.get('记录时间') or r2.get('巡检时间')
        
        if time1 is not None and pd.notna(time1):
            score1 += 8
        if time2 is not None and pd.notna(time2):
            score2 += 8
        
        return score1 >= score2
    
    def _select_best_merged(self, records: List[Dict]) -> Dict:
        best_record = records[0]
        for record in records[1:]:
            if self._is_better_record(record, best_record):
                best_record = record
        return best_record
    
    def _generate_merge_suggestion(self, records: List[Dict], primary_idx: int) -> str:
        if not records:
            return "无记录可合并"
        
        primary = records[primary_idx]
        suggestions = []
        
        suggestions.append(f"主记录: {} - 编号: {}".format(
            primary_idx + 1,
            primary.get('井盖编号', '未知')
        ))
        
        for idx, record in enumerate(records):
            if idx == primary_idx:
                continue
            
            distance = self.haversine_distance(
                primary.get('纬度', 0), primary.get('经度', 0),
                record.get('纬度', 0), record.get('经度', 0)
            )
            
            suggestions.append(f"待合并记录 {}: 编号={}, 距离={:.1f}米".format(
                idx + 1,
                record.get('井盖编号', '未知'),
                distance * 1000
            ))
        
        return "\n".join(suggestions)
