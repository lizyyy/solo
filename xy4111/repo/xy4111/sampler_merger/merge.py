from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from copy import deepcopy

from sampler_merger.config import Sample
from sampler_merger.ingest import IngestManager
from sampler_merger.normalizers import CoordinateNormalizer, TimeNormalizer, haversine_distance, time_difference_seconds
from sampler_merger.conflict_rules import ConflictDetector


class MergeManager:
    """合并管理器 - 负责将多源数据合并为统一样点库"""
    
    def __init__(self, config: Dict, project_dir: Path):
        """
        初始化合并管理器
        
        Args:
            config: 项目配置
            project_dir: 项目目录路径
        """
        self.config = config
        self.project_dir = project_dir
        
        # 初始化归一化器
        target_timezone = config.get("timezone", "UTC")
        target_coord_system = config.get("coordinate_system", "WGS84")
        
        self.coord_normalizer = CoordinateNormalizer(target_coord_system)
        self.time_normalizer = TimeNormalizer(target_timezone)
    
    def merge(
        self,
        strategy: str = "merge_all",
        time_tolerance: float = 300.0,
        distance_tolerance: float = 50.0,
    ) -> Dict[str, Any]:
        """
        执行合并操作
        
        Args:
            strategy: 合并策略
                - "merge_all": 全部合并，标记冲突
                - "keep_both": 保留全部，自动重命名冲突ID
                - "first_wins": 保留第一个出现的
                - "last_wins": 保留最后一个出现的
            time_tolerance: 时间匹配容差（秒）
            distance_tolerance: 坐标匹配容差（米）
        
        Returns:
            合并结果字典
        """
        # 获取所有已导入的样点
        ingest_manager = IngestManager(self.config, self.project_dir)
        all_samples = ingest_manager.get_ingested_samples()
        
        if not all_samples:
            return {
                "merged_at": datetime.now().isoformat(),
                "strategy": strategy,
                "total_samples": 0,
                "samples": [],
                "conflicts": [],
                "stats": {
                    "total_ingested": 0,
                    "total_merged": 0,
                    "conflict_count": 0,
                },
            }
        
        # 归一化所有样点的坐标和时间
        normalized_samples = self._normalize_samples(all_samples)
        
        # 检测冲突
        conflict_detector = ConflictDetector(
            time_tolerance=time_tolerance,
            distance_tolerance=distance_tolerance,
        )
        conflicts = conflict_detector.detect_all(normalized_samples)
        
        # 根据策略处理
        merged_samples, resolved_conflicts = self._apply_strategy(
            normalized_samples,
            conflicts,
            strategy
        )
        
        # 构建结果
        result = {
            "merged_at": datetime.now().isoformat(),
            "strategy": strategy,
            "time_tolerance_seconds": time_tolerance,
            "distance_tolerance_meters": distance_tolerance,
            "total_samples": len(merged_samples),
            "samples": [s.to_dict() for s in merged_samples],
            "conflicts": self._flatten_conflicts(conflicts),
            "resolved_conflicts": resolved_conflicts,
            "stats": {
                "total_ingested": len(all_samples),
                "total_normalized": len(normalized_samples),
                "total_merged": len(merged_samples),
                "id_conflicts": len(conflicts.get("id_conflicts", [])),
                "coordinate_anomalies": len(conflicts.get("coordinate_anomalies", [])),
                "time_issues": len(conflicts.get("time_order_issues", [])),
                "missing_attachments": len(conflicts.get("missing_attachments", [])),
                "potential_duplicates": len(conflicts.get("potential_duplicates", [])),
            },
        }
        
        return result
    
    def _normalize_samples(self, samples: List[Sample]) -> List[Sample]:
        """
        归一化样点的坐标和时间
        
        Args:
            samples: 原样点列表
        
        Returns:
            归一化后的样点列表
        """
        normalized = []
        
        for sample in samples:
            # 创建副本
            normalized_sample = deepcopy(sample)
            
            # 归一化坐标
            if normalized_sample.has_valid_coordinates():
                # 从元数据中检测源坐标系
                source_system = "WGS84"
                coord_meta = normalized_sample.metadata.get('coordinate_system', '').upper()
                if 'GCJ' in coord_meta or '火星' in coord_meta:
                    source_system = "GCJ02"
                elif 'BD' in coord_meta or '百度' in coord_meta:
                    source_system = "BD09"
                
                # 执行转换
                new_lat, new_lon = self.coord_normalizer.normalize(
                    normalized_sample.latitude,
                    normalized_sample.longitude,
                    source_system
                )
                
                # 记录转换信息
                normalized_sample.metadata['_original_coordinates'] = {
                    'latitude': normalized_sample.latitude,
                    'longitude': normalized_sample.longitude,
                    'system': source_system,
                }
                
                normalized_sample.latitude = new_lat
                normalized_sample.longitude = new_lon
            
            # 归一化时间
            if normalized_sample.timestamp:
                # 从元数据检测源时区
                source_tz = normalized_sample.metadata.get('timezone')
                
                original_ts = normalized_sample.timestamp
                normalized_ts = self.time_normalizer.normalize(
                    normalized_sample.timestamp,
                    source_tz
                )
                
                # 记录转换信息
                normalized_sample.metadata['_original_timestamp'] = original_ts.isoformat()
                if original_ts.tzinfo:
                    normalized_sample.metadata['_original_timezone'] = str(original_ts.tzinfo)
                
                normalized_sample.timestamp = normalized_ts
            
            normalized.append(normalized_sample)
        
        return normalized
    
    def _apply_strategy(
        self,
        samples: List[Sample],
        conflicts: Dict,
        strategy: str
    ) -> Tuple[List[Sample], List[Dict]]:
        """
        根据策略处理冲突
        
        Args:
            samples: 样点列表
            conflicts: 冲突信息
            strategy: 合并策略
        
        Returns:
            (合并后的样点列表, 已解决的冲突列表)
        """
        resolved = []
        
        if strategy == "merge_all":
            # 全部保留，不做任何修改
            return samples, resolved
        
        elif strategy == "keep_both":
            # 重命名冲突的ID
            id_conflicts = conflicts.get("id_conflicts", [])
            id_mapping = {}  # 原始索引 -> 新ID
            
            for conflict in id_conflicts:
                base_id = conflict["sample_id"]
                items = conflict["items"]
                
                for idx, item in enumerate(items):
                    original_index = item["index"]
                    if idx == 0:
                        # 第一个保持原名
                        new_id = base_id
                    else:
                        # 后续的重命名
                        new_id = f"{base_id}_{idx+1}"
                    
                    id_mapping[original_index] = new_id
                
                resolved.append({
                    "conflict_id": conflict["conflict_id"],
                    "strategy": "keep_both",
                    "original_id": base_id,
                    "new_ids": [id_mapping[item["index"]] for item in items],
                    "resolved_at": datetime.now().isoformat(),
                })
            
            # 应用重命名
            merged = []
            for idx, sample in enumerate(samples):
                if idx in id_mapping:
                    new_sample = deepcopy(sample)
                    new_sample.sample_id = id_mapping[idx]
                    new_sample.metadata['_original_id'] = sample.sample_id
                    merged.append(new_sample)
                else:
                    merged.append(sample)
            
            return merged, resolved
        
        elif strategy == "first_wins":
            # 只保留每个ID的第一个出现
            seen_ids = set()
            merged = []
            
            id_conflicts = conflicts.get("id_conflicts", [])
            handled_conflicts = set()
            
            for idx, sample in enumerate(samples):
                if sample.sample_id not in seen_ids:
                    seen_ids.add(sample.sample_id)
                    merged.append(sample)
                else:
                    # 记录被跳过的
                    for conflict in id_conflicts:
                        if conflict["sample_id"] == sample.sample_id:
                            if conflict["conflict_id"] not in handled_conflicts:
                                handled_conflicts.add(conflict["conflict_id"])
                                resolved.append({
                                    "conflict_id": conflict["conflict_id"],
                                    "strategy": "first_wins",
                                    "kept_id": sample.sample_id,
                                    "skipped_count": len(conflict["items"]) - 1,
                                    "resolved_at": datetime.now().isoformat(),
                                })
            
            return merged, resolved
        
        elif strategy == "last_wins":
            # 只保留每个ID的最后一个出现
            id_to_last_idx = {}
            
            for idx, sample in enumerate(samples):
                id_to_last_idx[sample.sample_id] = idx
            
            merged = []
            handled_conflicts = set()
            id_conflicts = conflicts.get("id_conflicts", [])
            
            for idx, sample in enumerate(samples):
                if id_to_last_idx.get(sample.sample_id) == idx:
                    merged.append(sample)
                else:
                    # 记录被跳过的
                    for conflict in id_conflicts:
                        if conflict["sample_id"] == sample.sample_id:
                            if conflict["conflict_id"] not in handled_conflicts:
                                handled_conflicts.add(conflict["conflict_id"])
                                resolved.append({
                                    "conflict_id": conflict["conflict_id"],
                                    "strategy": "last_wins",
                                    "kept_index": id_to_last_idx[sample.sample_id],
                                    "skipped_count": len(conflict["items"]) - 1,
                                    "resolved_at": datetime.now().isoformat(),
                                })
            
            return merged, resolved
        
        # 默认：全部保留
        return samples, resolved
    
    def _flatten_conflicts(self, conflicts: Dict) -> List[Dict]:
        """将冲突字典展平为列表"""
        all_conflicts = []
        
        for key, items in conflicts.items():
            if isinstance(items, list):
                all_conflicts.extend(items)
        
        return all_conflicts
