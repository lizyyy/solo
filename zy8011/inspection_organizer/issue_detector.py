"""
问题检测模块
负责检测缺拍、重复、时间偏差、点位错配等问题
"""
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from .config import PhotoMetadata, Issue, ISSUE_TYPES, ISSUE_SEVERITY
from .rule_manager import RuleManager


class IssueDetector:
    """问题检测器"""
    
    def __init__(self, rule_manager: RuleManager):
        self.rule_manager = rule_manager
        self.issues: List[Issue] = []
        
        # 用于追踪的辅助数据结构
        self.photos_by_store: Dict[str, List[PhotoMetadata]] = defaultdict(list)
        self.photos_by_store_checkpoint: Dict[Tuple[str, str], List[PhotoMetadata]] = defaultdict(list)
        self.photos_by_hash: Dict[str, List[PhotoMetadata]] = defaultdict(list)
        self.processed_stores: Set[str] = set()
    
    def register_photo(self, metadata: PhotoMetadata):
        """注册照片到检测器"""
        # 按门店分组
        if metadata.determined_store_code:
            self.photos_by_store[metadata.determined_store_code].append(metadata)
        
        # 按门店+点位分组
        if metadata.determined_store_code and metadata.determined_checkpoint:
            key = (metadata.determined_store_code, metadata.determined_checkpoint)
            self.photos_by_store_checkpoint[key].append(metadata)
        
        # 按哈希分组（用于检测重复）
        if metadata.file_hash:
            self.photos_by_hash[metadata.file_hash].append(metadata)
    
    def detect_all_issues(self) -> List[Issue]:
        """检测所有问题"""
        self.issues = []
        
        # 1. 检测重复照片
        self._detect_duplicates()
        
        # 2. 检测缺拍
        self._detect_missing_photos()
        
        # 3. 检测时间偏差
        self._detect_time_deviation()
        
        # 4. 检测点位错配
        self._detect_checkpoint_mismatch()
        
        # 5. 检测EXIF缺失
        self._detect_no_exif()
        
        # 6. 检测未知门店和点位
        self._detect_unknown_store_and_checkpoint()
        
        return self.issues
    
    def _detect_duplicates(self):
        """检测重复照片"""
        for file_hash, photos in self.photos_by_hash.items():
            if len(photos) > 1:
                # 有重复，第一个作为原始，其他作为重复
                original = photos[0]
                for duplicate in photos[1:]:
                    # 标记为重复
                    duplicate.is_duplicate = True
                    duplicate.duplicate_of = original.original_path
                    
                    issue = Issue(
                        issue_type="duplicate_photo",
                        severity="warning",
                        photo_metadata=duplicate,
                        message=f"照片与 {original.filename} 重复",
                        store_code=duplicate.determined_store_code,
                        checkpoint=duplicate.determined_checkpoint,
                        details={
                            "original_path": original.original_path,
                            "duplicate_path": duplicate.original_path,
                            "file_hash": file_hash,
                        }
                    )
                    self.issues.append(issue)
    
    def _detect_missing_photos(self):
        """检测缺拍"""
        # 获取所有涉及的门店
        all_stores = set(self.rule_manager.get_all_store_codes())
        all_stores.update(self.photos_by_store.keys())
        
        for store_code in all_stores:
            # 获取该门店的必检点位
            required_checkpoints = self.rule_manager.get_required_checkpoints(store_code)
            
            # 检查每个必检点位是否有照片
            for checkpoint in required_checkpoints:
                key = (store_code, checkpoint)
                if key not in self.photos_by_store_checkpoint:
                    # 没有找到该点位的照片
                    issue = Issue(
                        issue_type="missing_photo",
                        severity="critical",
                        photo_metadata=None,
                        message=f"门店 {store_code} 点位 {checkpoint} 缺拍",
                        store_code=store_code,
                        checkpoint=checkpoint,
                        details={
                            "store_code": store_code,
                            "checkpoint": checkpoint,
                            "required": True,
                        }
                    )
                    self.issues.append(issue)
    
    def _detect_time_deviation(self):
        """检测时间偏差"""
        for store_code, photos in self.photos_by_store.items():
            for metadata in photos:
                if not metadata.determined_time:
                    continue
                
                # 检查时间是否在窗口内
                is_in_window = self.rule_manager.is_time_in_window(
                    store_code, metadata.determined_time
                )
                
                if not is_in_window:
                    # 计算偏差
                    deviation = self.rule_manager.get_time_deviation_minutes(
                        store_code, metadata.determined_time
                    )
                    
                    if deviation is not None:
                        if deviation < 0:
                            deviation_desc = f"早于规定时间 {-deviation} 分钟"
                        else:
                            deviation_desc = f"晚于规定时间 {deviation} 分钟"
                        
                        # 根据偏差程度确定严重程度
                        severity = "warning"
                        if abs(deviation) > 60:  # 超过1小时
                            severity = "critical"
                        elif abs(deviation) > 30:  # 超过30分钟
                            severity = "warning"
                        else:
                            severity = "info"
                        
                        issue = Issue(
                            issue_type="time_deviation",
                            severity=severity,
                            photo_metadata=metadata,
                            message=f"时间偏差: {deviation_desc}",
                            store_code=store_code,
                            checkpoint=metadata.determined_checkpoint,
                            details={
                                "photo_time": metadata.determined_time,
                                "deviation_minutes": deviation,
                                "time_window": self.rule_manager.get_store_rule(store_code).time_window if self.rule_manager.get_store_rule(store_code) else None,
                            }
                        )
                        self.issues.append(issue)
    
    def _detect_checkpoint_mismatch(self):
        """检测点位错配"""
        # 这里的点位错配指的是：照片的点位不在该门店的巡检点位列表中
        for (store_code, checkpoint), photos in self.photos_by_store_checkpoint.items():
            # 获取该门店的所有合法点位
            valid_checkpoints = self.rule_manager.get_checkpoints_for_store(store_code)
            
            if valid_checkpoints and checkpoint not in valid_checkpoints:
                # 点位不在合法列表中
                for metadata in photos:
                    issue = Issue(
                        issue_type="checkpoint_mismatch",
                        severity="warning",
                        photo_metadata=metadata,
                        message=f"点位 '{checkpoint}' 不在门店 {store_code} 的巡检点位列表中",
                        store_code=store_code,
                        checkpoint=checkpoint,
                        details={
                            "detected_checkpoint": checkpoint,
                            "valid_checkpoints": valid_checkpoints,
                        }
                    )
                    self.issues.append(issue)
    
    def _detect_no_exif(self):
        """检测EXIF缺失"""
        # 遍历所有照片
        all_photos = []
        for photos in self.photos_by_store.values():
            all_photos.extend(photos)
        
        for metadata in all_photos:
            if not metadata.exif_time:
                # EXIF时间缺失，但可能从文件名获取了时间
                if metadata.filename_time:
                    # 从文件名获取了时间，标记为警告
                    issue = Issue(
                        issue_type="no_exif",
                        severity="info",
                        photo_metadata=metadata,
                        message=f"EXIF时间缺失，已从文件名推断时间: {metadata.filename_time}",
                        store_code=metadata.determined_store_code,
                        checkpoint=metadata.determined_checkpoint,
                        details={
                            "filename_time": metadata.filename_time,
                            "exif_time": None,
                        }
                    )
                else:
                    # 完全没有时间信息
                    issue = Issue(
                        issue_type="no_exif",
                        severity="warning",
                        photo_metadata=metadata,
                        message="EXIF时间缺失，且无法从文件名推断时间",
                        store_code=metadata.determined_store_code,
                        checkpoint=metadata.determined_checkpoint,
                        details={
                            "filename_time": None,
                            "exif_time": None,
                        }
                    )
                self.issues.append(issue)
    
    def _detect_unknown_store_and_checkpoint(self):
        """检测未知门店和点位"""
        all_photos = []
        for photos in self.photos_by_store.values():
            all_photos.extend(photos)
        
        valid_stores = set(self.rule_manager.get_all_store_codes())
        
        for metadata in all_photos:
            # 检测未知门店
            if metadata.determined_store_code:
                if metadata.determined_store_code not in valid_stores and metadata.determined_store_code != "UNKNOWN":
                    issue = Issue(
                        issue_type="unknown_store",
                        severity="warning",
                        photo_metadata=metadata,
                        message=f"未知门店编码: {metadata.determined_store_code}",
                        store_code=metadata.determined_store_code,
                        checkpoint=metadata.determined_checkpoint,
                        details={
                            "detected_store": metadata.determined_store_code,
                            "valid_stores": list(valid_stores),
                        }
                    )
                    self.issues.append(issue)
            else:
                # 没有门店编码
                issue = Issue(
                    issue_type="unknown_store",
                    severity="warning",
                    photo_metadata=metadata,
                    message="无法确定门店编码",
                    store_code=None,
                    checkpoint=metadata.determined_checkpoint,
                    details={
                        "filename": metadata.filename,
                    }
                )
                self.issues.append(issue)
            
            # 检测未知点位
            if not metadata.determined_checkpoint or metadata.determined_checkpoint == "UNKNOWN":
                issue = Issue(
                    issue_type="unknown_checkpoint",
                    severity="warning",
                    photo_metadata=metadata,
                    message="无法确定点位",
                    store_code=metadata.determined_store_code,
                    checkpoint=None,
                    details={
                        "filename": metadata.filename,
                    }
                )
                self.issues.append(issue)
    
    def get_issues_by_type(self) -> Dict[str, List[Issue]]:
        """按问题类型分组"""
        issues_by_type = defaultdict(list)
        for issue in self.issues:
            issues_by_type[issue.issue_type].append(issue)
        return dict(issues_by_type)
    
    def get_issues_by_store(self) -> Dict[str, List[Issue]]:
        """按门店分组"""
        issues_by_store = defaultdict(list)
        for issue in self.issues:
            store = issue.store_code or "UNKNOWN"
            issues_by_store[store].append(issue)
        return dict(issues_by_store)
    
    def get_issues_by_severity(self) -> Dict[str, List[Issue]]:
        """按严重程度分组"""
        issues_by_severity = defaultdict(list)
        for issue in self.issues:
            issues_by_severity[issue.severity].append(issue)
        return dict(issues_by_severity)
    
    def get_statistics(self) -> Dict:
        """获取问题统计"""
        stats = {
            "total_issues": len(self.issues),
            "by_type": {},
            "by_store": {},
            "by_severity": {},
        }
        
        # 按类型统计
        issues_by_type = self.get_issues_by_type()
        for issue_type, issues in issues_by_type.items():
            stats["by_type"][issue_type] = {
                "count": len(issues),
                "description": ISSUE_TYPES.get(issue_type, issue_type),
            }
        
        # 按门店统计
        issues_by_store = self.get_issues_by_store()
        for store, issues in issues_by_store.items():
            stats["by_store"][store] = len(issues)
        
        # 按严重程度统计
        issues_by_severity = self.get_issues_by_severity()
        for severity, issues in issues_by_severity.items():
            stats["by_severity"][severity] = {
                "count": len(issues),
                "description": ISSUE_SEVERITY.get(severity, severity),
            }
        
        return stats
