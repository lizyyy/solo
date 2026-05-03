"""
归并模块
负责合并多个巡检包中的重复缺陷标注：
- 按管段分组缺陷
- 识别同一缺陷的多次标注（里程桩号相近、类型相同）
- 合并缺陷信息，保留所有证据来源
"""

from typing import Dict, List, Any, Optional, Tuple, Set
from dataclasses import dataclass, field
from collections import defaultdict
import math

from .parser import InspectionPackage


@dataclass
class MergedDefect:
    """
    合并后的缺陷数据结构
    包含所有来源的信息
    """
    merged_id: str
    defect_type: str
    primary_mileage: float
    pipe_segment: str
    
    # 合并后的信息
    severity: Optional[str] = None
    description: str = ""
    
    # 来源信息
    sources: List[Dict[str, Any]] = field(default_factory=list)
    source_packages: Set[str] = field(default_factory=set)
    
    # 里程范围
    min_mileage: float = 0.0
    max_mileage: float = 0.0
    
    # 时间范围
    earliest_timestamp: Optional[float] = None
    latest_timestamp: Optional[float] = None
    
    # 原始缺陷数据
    raw_defects: List[Dict[str, Any]] = field(default_factory=list)
    
    def __post_init__(self):
        if self.min_mileage == 0.0 and self.max_mileage == 0.0:
            self.min_mileage = self.primary_mileage
            self.max_mileage = self.primary_mileage
    
    def add_source(self, defect: Dict[str, Any], package_name: str):
        """
        添加一个新的缺陷来源
        """
        self.raw_defects.append(defect)
        self.source_packages.add(package_name)
        
        # 构建来源信息
        source_info = {
            "package_name": package_name,
            "defect_id": defect.get("defect_id"),
            "mileage": defect.get("mileage"),
            "timestamp": defect.get("timestamp"),
            "severity": defect.get("severity"),
            "source": defect.get("source"),
        }
        self.sources.append(source_info)
        
        # 更新里程范围
        mileage = defect.get("mileage")
        if mileage is not None and isinstance(mileage, (int, float)):
            self.min_mileage = min(self.min_mileage, mileage)
            self.max_mileage = max(self.max_mileage, mileage)
        
        # 更新时间范围
        timestamp = defect.get("timestamp")
        if timestamp is not None and isinstance(timestamp, (int, float)):
            if self.earliest_timestamp is None or timestamp < self.earliest_timestamp:
                self.earliest_timestamp = timestamp
            if self.latest_timestamp is None or timestamp > self.latest_timestamp:
                self.latest_timestamp = timestamp
        
        # 合并描述
        desc = defect.get("description", "")
        if desc and desc not in self.description:
            if self.description:
                self.description += " | " + desc
            else:
                self.description = desc
        
        # 合并严重程度（取最严重的）
        severity = defect.get("severity")
        if severity:
            if self.severity is None:
                self.severity = severity
            else:
                # 比较严重程度，取更严重的
                severity_order = {"critical": 3, "high": 2, "medium": 1, "low": 0, 
                                  "严重": 3, "高": 2, "中": 1, "低": 0}
                current_level = severity_order.get(str(self.severity).lower(), 1)
                new_level = severity_order.get(str(severity).lower(), 1)
                if new_level > current_level:
                    self.severity = severity
    
    def get_source_count(self) -> int:
        """获取来源数量"""
        return len(self.sources)
    
    def get_package_count(self) -> int:
        """获取涉及的巡检包数量"""
        return len(self.source_packages)
    
    def get_mileage_range(self) -> Tuple[float, float]:
        """获取里程范围"""
        return (self.min_mileage, self.max_mileage)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "merged_id": self.merged_id,
            "defect_type": self.defect_type,
            "primary_mileage": self.primary_mileage,
            "pipe_segment": self.pipe_segment,
            "severity": self.severity,
            "description": self.description,
            "source_count": self.get_source_count(),
            "package_count": self.get_package_count(),
            "source_packages": list(self.source_packages),
            "sources": self.sources,
            "mileage_range": {
                "min": self.min_mileage,
                "max": self.max_mileage,
                "span": self.max_mileage - self.min_mileage
            },
            "time_range": {
                "earliest": self.earliest_timestamp,
                "latest": self.latest_timestamp
            },
            "raw_defects_count": len(self.raw_defects)
        }


@dataclass
class MergeResult:
    """
    归并结果
    """
    total_defects_before: int = 0
    total_defects_after: int = 0
    merged_defects: List[MergedDefect] = field(default_factory=list)
    unique_defects: List[Dict[str, Any]] = field(default_factory=list)
    by_segment: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    statistics: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def reduction_rate(self) -> float:
        """去重率百分比"""
        if self.total_defects_before > 0:
            return (self.total_defects_before - self.total_defects_after) / self.total_defects_before * 100
        return 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_defects_before": self.total_defects_before,
            "total_defects_after": self.total_defects_after,
            "merged_count": len(self.merged_defects),
            "unique_count": len(self.unique_defects),
            "reduction_rate": (
                (self.total_defects_before - self.total_defects_after) / self.total_defects_before * 100
                if self.total_defects_before > 0 else 0
            ),
            "by_segment": self.by_segment,
            "statistics": self.statistics,
            "merged_defects": [d.to_dict() for d in self.merged_defects]
        }


class DefectMerger:
    """
    缺陷归并器
    负责合并多个巡检包中的重复缺陷标注
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        
        # 默认配置
        self.mileage_tolerance = self.config.get("mileage_tolerance", 2.0)  # 里程匹配容差（米）
        self.min_sources_for_merge = self.config.get("min_sources_for_merge", 2)  # 合并所需最小来源数
        
        # 管段配置
        self.segment_field = self.config.get("segment_field", "pipe_segment")
        
        # 缺陷类型映射（用于归一化类型名称）
        self.type_normalization = self.config.get("type_normalization", {
            "裂缝": "crack",
            "裂纹": "crack",
            "crack": "crack",
            "漏水": "leak",
            "渗漏": "leak",
            "leak": "leak",
            "腐蚀": "corrosion",
            "锈蚀": "corrosion",
            "corrosion": "corrosion",
            "变形": "deformation",
            "形变": "deformation",
            "deformation": "deformation",
            "堵塞": "blockage",
            "阻塞": "blockage",
            "blockage": "blockage",
        })
    
    def merge_packages(self, packages: List[InspectionPackage]) -> MergeResult:
        """
        合并多个巡检包中的缺陷
        """
        result = MergeResult()
        
        # 收集所有缺陷
        all_defects = []
        for package in packages:
            for defect in package.defect_annotations:
                defect_with_source = defect.copy()
                defect_with_source["_package_name"] = package.package_name
                all_defects.append(defect_with_source)
        
        result.total_defects_before = len(all_defects)
        
        if not all_defects:
            result.total_defects_after = 0
            return result
        
        # 按管段分组
        defects_by_segment = self._group_by_segment(all_defects)
        
        # 处理每个管段
        merged_defects = []
        unique_defects = []
        
        for segment, segment_defects in defects_by_segment.items():
            # 在管段内按类型分组
            defects_by_type = self._group_by_type(segment_defects)
            
            segment_result = {
                "total_before": len(segment_defects),
                "merged": [],
                "unique": []
            }
            
            for defect_type, type_defects in defects_by_type.items():
                # 查找相似缺陷并合并
                clusters = self._find_similar_defects(type_defects)
                
                for cluster in clusters:
                    if len(cluster) >= self.min_sources_for_merge:
                        # 合并这些缺陷
                        merged = self._merge_cluster(cluster, segment, defect_type)
                        merged_defects.append(merged)
                        segment_result["merged"].append(merged.merged_id)
                    else:
                        # 单个缺陷，作为唯一缺陷
                        for defect in cluster:
                            unique_defects.append(defect)
                            segment_result["unique"].append(defect.get("defect_id", "unknown"))
            
            segment_result["total_after"] = (
                len([m for m in merged_defects if m.pipe_segment == segment]) +
                len([u for u in unique_defects if u.get("pipe_segment") == segment or 
                     u.get("_pipe_segment") == segment])
            )
            result.by_segment[segment] = segment_result
        
        result.merged_defects = merged_defects
        result.unique_defects = unique_defects
        result.total_defects_after = len(merged_defects) + len(unique_defects)
        
        # 生成统计信息
        result.statistics = self._generate_statistics(all_defects, merged_defects, unique_defects)
        
        return result
    
    def _group_by_segment(self, defects: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """
        按管段分组缺陷
        """
        grouped = defaultdict(list)
        unknown_segment = []
        
        for defect in defects:
            segment = defect.get(self.segment_field)
            
            if segment is None:
                # 尝试从里程推断管段（如果没有显式的管段字段）
                mileage = defect.get("mileage")
                if mileage is not None and isinstance(mileage, (int, float)):
                    # 基于里程的简单管段划分（每100米一个管段）
                    segment_id = int(mileage // 100)
                    segment = f"segment_{segment_id:03d}"
                else:
                    unknown_segment.append(defect)
                    continue
            
            # 标准化管段名称
            segment_key = str(segment).strip().lower()
            defect["_pipe_segment"] = segment_key
            grouped[segment_key].append(defect)
        
        # 处理未知管段
        if unknown_segment:
            for defect in unknown_segment:
                defect["_pipe_segment"] = "unknown"
            grouped["unknown"] = unknown_segment
        
        return dict(grouped)
    
    def _group_by_type(self, defects: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """
        按缺陷类型分组
        """
        grouped = defaultdict(list)
        unknown_type = []
        
        for defect in defects:
            defect_type = defect.get("defect_type", defect.get("type"))
            
            if defect_type is None:
                unknown_type.append(defect)
                continue
            
            # 归一化缺陷类型
            type_key = str(defect_type).strip().lower()
            normalized_type = self.type_normalization.get(type_key, type_key)
            
            defect["_normalized_type"] = normalized_type
            grouped[normalized_type].append(defect)
        
        # 处理未知类型
        if unknown_type:
            for defect in unknown_type:
                defect["_normalized_type"] = "unknown"
            grouped["unknown"] = unknown_type
        
        return dict(grouped)
    
    def _find_similar_defects(self, defects: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
        """
        查找相似的缺陷（基于里程桩号）
        使用聚类算法将相近里程的缺陷归为一组
        """
        if not defects:
            return []
        
        # 筛选出有有效里程的缺陷
        defects_with_mileage = []
        defects_without_mileage = []
        
        for defect in defects:
            mileage = defect.get("mileage")
            if mileage is not None and isinstance(mileage, (int, float)):
                defects_with_mileage.append({"defect": defect, "mileage": mileage})
            else:
                defects_without_mileage.append([defect])
        
        if not defects_with_mileage:
            return defects_without_mileage
        
        # 按里程排序
        sorted_defects = sorted(defects_with_mileage, key=lambda x: x["mileage"])
        
        # 使用贪心聚类：按顺序合并在容差范围内的缺陷
        clusters = []
        if sorted_defects:
            current_cluster = [sorted_defects[0]["defect"]]
            current_mileage = sorted_defects[0]["mileage"]
            
            for item in sorted_defects[1:]:
                defect = item["defect"]
                mileage = item["mileage"]
                
                # 检查是否与当前聚类的中心在容差范围内
                # 使用简单的距离检查（也可以用DBSCAN等更复杂的算法）
                if abs(mileage - current_mileage) <= self.mileage_tolerance:
                    current_cluster.append(defect)
                    # 更新聚类中心为平均里程
                    current_mileage = sum(
                        d.get("mileage", 0) for d in current_cluster 
                        if isinstance(d.get("mileage"), (int, float))
                    ) / len(current_cluster)
                else:
                    clusters.append(current_cluster)
                    current_cluster = [defect]
                    current_mileage = mileage
            
            # 添加最后一个聚类
            if current_cluster:
                clusters.append(current_cluster)
        
        # 添加没有里程的缺陷（每个单独成簇）
        clusters.extend(defects_without_mileage)
        
        return clusters
    
    def _merge_cluster(self, cluster: List[Dict[str, Any]], segment: str, defect_type: str) -> MergedDefect:
        """
        合并一个缺陷聚类
        """
        # 选择主里程（加权平均或中位数）
        mileages = []
        for defect in cluster:
            mileage = defect.get("mileage")
            if mileage is not None and isinstance(mileage, (int, float)):
                mileages.append(mileage)
        
        if mileages:
            # 使用中位数作为主里程，更稳健
            sorted_mileages = sorted(mileages)
            n = len(sorted_mileages)
            if n % 2 == 1:
                primary_mileage = sorted_mileages[n // 2]
            else:
                primary_mileage = (sorted_mileages[n // 2 - 1] + sorted_mileages[n // 2]) / 2
        else:
            primary_mileage = 0.0
        
        # 生成合并ID
        merged_id = f"merged_{segment}_{defect_type}_{int(primary_mileage)}"
        
        # 创建合并缺陷对象
        merged = MergedDefect(
            merged_id=merged_id,
            defect_type=defect_type,
            primary_mileage=primary_mileage,
            pipe_segment=segment
        )
        
        # 添加所有来源
        for defect in cluster:
            package_name = defect.get("_package_name", "unknown")
            merged.add_source(defect, package_name)
        
        return merged
    
    def _generate_statistics(
        self, 
        all_defects: List[Dict[str, Any]], 
        merged_defects: List[MergedDefect],
        unique_defects: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        生成归并统计信息
        """
        stats = {
            "by_type": defaultdict(lambda: {"original": 0, "merged": 0, "unique": 0}),
            "by_severity": defaultdict(lambda: {"original": 0, "merged": 0}),
            "multi_source_merged": 0,
        }
        
        # 统计原始缺陷
        for defect in all_defects:
            defect_type = defect.get("_normalized_type", "unknown")
            stats["by_type"][defect_type]["original"] += 1
            
            severity = defect.get("severity", "unknown")
            if severity:
                stats["by_severity"][str(severity).lower()]["original"] += 1
        
        # 统计合并后的缺陷
        for merged in merged_defects:
            defect_type = merged.defect_type
            stats["by_type"][defect_type]["merged"] += 1
            
            severity = merged.severity or "unknown"
            stats["by_severity"][str(severity).lower()]["merged"] += 1
            
            if merged.get_package_count() > 1:
                stats["multi_source_merged"] += 1
        
        # 统计唯一缺陷
        for defect in unique_defects:
            defect_type = defect.get("_normalized_type", "unknown")
            stats["by_type"][defect_type]["unique"] += 1
        
        # 转换为普通字典
        stats["by_type"] = dict(stats["by_type"])
        stats["by_severity"] = dict(stats["by_severity"])
        
        return stats
