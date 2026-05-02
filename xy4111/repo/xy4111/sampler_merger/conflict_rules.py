from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

from sampler_merger.config import Sample
from sampler_merger.normalizers import haversine_distance, time_difference_seconds


class ConflictDetector:
    """冲突检测器"""
    
    def __init__(
        self,
        time_tolerance: float = 300.0,
        distance_tolerance: float = 50.0,
        coordinate_anomaly_threshold: float = 1000.0
    ):
        """
        初始化冲突检测器
        
        Args:
            time_tolerance: 时间匹配容差（秒）
            distance_tolerance: 坐标匹配容差（米）
            coordinate_anomaly_threshold: 坐标异常阈值（米，两点间距离超过此值视为异常漂移）
        """
        self.time_tolerance = time_tolerance
        self.distance_tolerance = distance_tolerance
        self.coordinate_anomaly_threshold = coordinate_anomaly_threshold
    
    def detect_all(self, samples: List[Sample]) -> Dict[str, List[Dict]]:
        """
        检测所有类型的冲突
        
        Returns:
            包含各类冲突的字典:
            {
                "id_conflicts": [...],
                "time_conflicts": [...],
                "coordinate_conflicts": [...],
                "coordinate_anomalies": [...],
                "missing_attachments": [...],
                "time_order_issues": [...],
            }
        """
        results = {
            "id_conflicts": self.detect_id_conflicts(samples),
            "time_conflicts": [],  # 通过合并逻辑处理
            "coordinate_conflicts": [],  # 通过合并逻辑处理
            "coordinate_anomalies": self.detect_coordinate_anomalies(samples),
            "missing_attachments": self.detect_missing_attachments(samples),
            "time_order_issues": self.detect_time_order_issues(samples),
            "potential_duplicates": self.detect_potential_duplicates(samples),
        }
        
        return results
    
    def detect_id_conflicts(self, samples: List[Sample]) -> List[Dict]:
        """
        检测样点ID冲突
        
        两个或多个样点具有相同的ID
        """
        id_groups = defaultdict(list)
        
        for idx, sample in enumerate(samples):
            id_groups[sample.sample_id].append({
                "index": idx,
                "sample": sample,
                "source_file": sample.source_file,
                "source_type": sample.source_type,
            })
        
        conflicts = []
        for sample_id, group in id_groups.items():
            if len(group) > 1:
                # 计算这些样点之间的差异
                issues = []
                for i, item1 in enumerate(group):
                    for j, item2 in enumerate(group[i+1:], i+1):
                        diff = self._compare_samples(item1["sample"], item2["sample"])
                        issues.append({
                            "pair": (i, j),
                            "differences": diff,
                        })
                
                conflicts.append({
                    "conflict_id": f"id_{sample_id}",
                    "type": "id_conflict",
                    "sample_id": sample_id,
                    "count": len(group),
                    "items": [
                        {
                            "index": g["index"],
                            "source_file": g["source_file"],
                            "source_type": g["source_type"],
                            "latitude": g["sample"].latitude,
                            "longitude": g["sample"].longitude,
                            "timestamp": g["sample"].timestamp.isoformat() if g["sample"].timestamp else None,
                        }
                        for g in group
                    ],
                    "issues": issues,
                    "description": f"样点ID '{sample_id}' 在 {len(group)} 个来源中重复出现",
                })
        
        return conflicts
    
    def detect_coordinate_anomalies(self, samples: List[Sample]) -> List[Dict]:
        """
        检测坐标异常（漂移）
        
        条件：
        1. 坐标超出有效范围
        2. 同一ID的样点坐标距离过大
        3. 连续样点之间距离异常（相对于时间差）
        """
        anomalies = []
        
        # 1. 检查坐标是否在有效范围内
        for idx, sample in enumerate(samples):
            if sample.latitude is not None and sample.longitude is not None:
                if not (-90 <= sample.latitude <= 90 and -180 <= sample.longitude <= 180):
                    anomalies.append({
                        "conflict_id": f"coord_range_{idx}",
                        "type": "coordinate_out_of_range",
                        "sample_index": idx,
                        "sample_id": sample.sample_id,
                        "latitude": sample.latitude,
                        "longitude": sample.longitude,
                        "source_file": sample.source_file,
                        "description": f"坐标值超出有效范围: ({sample.latitude}, {sample.longitude})",
                    })
        
        # 2. 检查同一ID的样点坐标距离
        id_groups = defaultdict(list)
        for idx, sample in enumerate(samples):
            if sample.has_valid_coordinates():
                id_groups[sample.sample_id].append({
                    "index": idx,
                    "sample": sample,
                })
        
        for sample_id, group in id_groups.items():
            if len(group) > 1:
                for i, item1 in enumerate(group):
                    for j, item2 in enumerate(group[i+1:], i+1):
                        s1, s2 = item1["sample"], item2["sample"]
                        if s1.has_valid_coordinates() and s2.has_valid_coordinates():
                            dist = haversine_distance(
                                s1.latitude, s1.longitude,
                                s2.latitude, s2.longitude
                            )
                            if dist > self.coordinate_anomaly_threshold:
                                anomalies.append({
                                    "conflict_id": f"coord_drift_{sample_id}_{i}_{j}",
                                    "type": "coordinate_drift",
                                    "sample_id": sample_id,
                                    "sample_indices": (item1["index"], item2["index"]),
                                    "coordinates": [
                                        (s1.latitude, s1.longitude),
                                        (s2.latitude, s2.longitude),
                                    ],
                                    "distance_meters": dist,
                                    "threshold_meters": self.coordinate_anomaly_threshold,
                                    "source_files": [s1.source_file, s2.source_file],
                                    "description": f"同一ID '{sample_id}' 的两个样点坐标相距 {dist:.2f} 米，超过阈值 {self.coordinate_anomaly_threshold} 米",
                                })
        
        return anomalies
    
    def detect_missing_attachments(self, samples: List[Sample]) -> List[Dict]:
        """
        检测缺少附件的样点
        
        条件：
        1. 样点引用了附件但文件不存在
        2. 某些样点类型预期应该有附件但实际没有
        """
        issues = []
        
        for idx, sample in enumerate(samples):
            # 检查引用的附件是否存在
            for att_idx, attachment in enumerate(sample.attachments):
                import os
                if isinstance(attachment, str) and not os.path.exists(attachment):
                    issues.append({
                        "conflict_id": f"missing_att_{idx}_{att_idx}",
                        "type": "missing_attachment",
                        "sample_index": idx,
                        "sample_id": sample.sample_id,
                        "attachment_path": attachment,
                        "source_file": sample.source_file,
                        "description": f"样点 '{sample.sample_id}' 引用的附件不存在: {attachment}",
                    })
        
        return issues
    
    def detect_time_order_issues(self, samples: List[Sample]) -> List[Dict]:
        """
        检测时间倒序问题
        
        条件：
        1. 同一来源的样点按时间顺序应该递增
        2. 时间戳为None或解析失败
        """
        issues = []
        
        # 按来源分组
        source_groups = defaultdict(list)
        for idx, sample in enumerate(samples):
            source_groups[sample.source_file].append({
                "index": idx,
                "sample": sample,
            })
        
        for source_file, group in source_groups.items():
            # 按原始顺序检查时间
            valid_samples = [
                g for g in group 
                if g["sample"].timestamp is not None
            ]
            
            # 检查是否有缺失的时间戳
            for g in group:
                if g["sample"].timestamp is None:
                    issues.append({
                        "conflict_id": f"time_missing_{g['index']}",
                        "type": "missing_timestamp",
                        "sample_index": g["index"],
                        "sample_id": g["sample"].sample_id,
                        "source_file": source_file,
                        "description": f"样点 '{g['sample'].sample_id}' 缺少或无法解析时间戳",
                    })
            
            # 检查时间顺序
            if len(valid_samples) >= 2:
                for i in range(1, len(valid_samples)):
                    prev = valid_samples[i-1]
                    curr = valid_samples[i]
                    
                    if curr["sample"].timestamp < prev["sample"].timestamp:
                        time_diff = (prev["sample"].timestamp - curr["sample"].timestamp).total_seconds()
                        issues.append({
                            "conflict_id": f"time_order_{source_file}_{i}",
                            "type": "time_out_of_order",
                            "source_file": source_file,
                            "sample_indices": (prev["index"], curr["index"]),
                            "sample_ids": (prev["sample"].sample_id, curr["sample"].sample_id),
                            "timestamps": (
                                prev["sample"].timestamp.isoformat(),
                                curr["sample"].timestamp.isoformat(),
                            ),
                            "time_difference_seconds": time_diff,
                            "description": f"时间倒序: 样点 '{curr['sample'].sample_id}' 时间早于前一样点 '{prev['sample'].sample_id}'，相差 {time_diff} 秒",
                        })
        
        return issues
    
    def detect_potential_duplicates(self, samples: List[Sample]) -> List[Dict]:
        """
        检测潜在重复样点（即使ID不同）
        
        条件：
        1. 坐标接近且时间接近
        2. 来自不同文件但描述相同
        """
        duplicates = []
        
        for i, s1 in enumerate(samples):
            for j, s2 in enumerate(samples[i+1:], i+1):
                is_duplicate = False
                reasons = []
                
                # 检查坐标和时间
                has_coords = s1.has_valid_coordinates() and s2.has_valid_coordinates()
                has_times = s1.timestamp is not None and s2.timestamp is not None
                
                if has_coords and has_times:
                    dist = haversine_distance(
                        s1.latitude, s1.longitude,
                        s2.latitude, s2.longitude
                    )
                    time_diff = time_difference_seconds(s1.timestamp, s2.timestamp)
                    
                    if dist < self.distance_tolerance and time_diff < self.time_tolerance:
                        is_duplicate = True
                        reasons.append(f"坐标距离 {dist:.2f} 米，时间差 {time_diff:.0f} 秒")
                
                # 检查元数据描述
                desc1 = s1.metadata.get('description', '').lower().strip()
                desc2 = s2.metadata.get('description', '').lower().strip()
                if desc1 and desc1 == desc2 and len(desc1) > 10:
                    is_duplicate = True
                    reasons.append(f"描述相同: '{desc1[:50]}...'")
                
                if is_duplicate:
                    duplicates.append({
                        "conflict_id": f"dup_{i}_{j}",
                        "type": "potential_duplicate",
                        "sample_indices": (i, j),
                        "sample_ids": (s1.sample_id, s2.sample_id),
                        "source_files": (s1.source_file, s2.source_file),
                        "reasons": reasons,
                        "description": f"潜在重复样点: '{s1.sample_id}' 和 '{s2.sample_id}'，原因: {'; '.join(reasons)}",
                    })
        
        return duplicates
    
    def _compare_samples(self, s1: Sample, s2: Sample) -> Dict[str, Any]:
        """
        比较两个样点的差异
        
        Returns:
            包含差异信息的字典
        """
        differences = {}
        
        # 比较坐标
        if s1.has_valid_coordinates() and s2.has_valid_coordinates():
            dist = haversine_distance(
                s1.latitude, s1.longitude,
                s2.latitude, s2.longitude
            )
            if dist > 0:
                differences["coordinate_distance_meters"] = dist
                differences["coordinates"] = [
                    (s1.latitude, s1.longitude),
                    (s2.latitude, s2.longitude),
                ]
        
        # 比较时间
        if s1.timestamp and s2.timestamp:
            time_diff = time_difference_seconds(s1.timestamp, s2.timestamp)
            if time_diff > 0:
                differences["time_difference_seconds"] = time_diff
                differences["timestamps"] = [
                    s1.timestamp.isoformat(),
                    s2.timestamp.isoformat(),
                ]
        
        # 比较元数据
        keys1 = set(s1.metadata.keys())
        keys2 = set(s2.metadata.keys())
        
        all_keys = keys1.union(keys2)
        meta_diffs = {}
        
        for key in all_keys:
            v1 = s1.metadata.get(key)
            v2 = s2.metadata.get(key)
            if v1 != v2:
                meta_diffs[key] = {"source_1": v1, "source_2": v2}
        
        if meta_diffs:
            differences["metadata"] = meta_diffs
        
        # 比较附件
        atts1 = set(s1.attachments)
        atts2 = set(s2.attachments)
        if atts1 != atts2:
            differences["attachments"] = {
                "only_in_1": list(atts1 - atts2),
                "only_in_2": list(atts2 - atts1),
            }
        
        return differences


class ConflictResolver:
    """冲突解决器"""
    
    STRATEGIES = [
        "keep_first",      # 保留第一个
        "keep_last",       # 保留最后一个
        "keep_both",       # 全部保留（重命名）
        "merge_fields",    # 合并字段
        "custom",          # 自定义
    ]
    
    def resolve_id_conflict(
        self,
        conflict: Dict,
        strategy: str,
        custom_id: Optional[str] = None
    ) -> Dict:
        """
        解决ID冲突
        
        Args:
            conflict: 冲突信息
            strategy: 解决策略
            custom_id: 自定义新ID（用于keep_both策略）
        
        Returns:
            解决结果
        """
        items = conflict.get("items", [])
        
        if strategy == "keep_first":
            return {
                "resolved": True,
                "strategy": "keep_first",
                "kept_index": items[0]["index"] if items else None,
                "renamed_samples": [],
            }
        
        elif strategy == "keep_last":
            return {
                "resolved": True,
                "strategy": "keep_last",
                "kept_index": items[-1]["index"] if items else None,
                "renamed_samples": [],
            }
        
        elif strategy == "keep_both":
            # 重命名冲突的样点
            base_id = conflict["sample_id"]
            renamed = []
            
            for idx, item in enumerate(items):
                if idx == 0:
                    # 第一个保持原名
                    continue
                new_id = f"{base_id}_{idx+1}"
                renamed.append({
                    "old_index": item["index"],
                    "old_id": base_id,
                    "new_id": new_id,
                })
            
            return {
                "resolved": True,
                "strategy": "keep_both",
                "renamed_samples": renamed,
            }
        
        elif strategy == "custom" and custom_id:
            # 自定义新ID
            renamed = []
            for item in items:
                renamed.append({
                    "old_index": item["index"],
                    "old_id": conflict["sample_id"],
                    "new_id": custom_id,
                })
            
            return {
                "resolved": True,
                "strategy": "custom",
                "custom_id": custom_id,
                "renamed_samples": renamed,
            }
        
        return {
            "resolved": False,
            "strategy": strategy,
            "error": f"不支持的策略或参数缺失: {strategy}",
        }
