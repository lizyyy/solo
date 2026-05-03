"""
规则校验模块
检查遮罩越界、关键工位未遮、旧配置回滚、分辨率不匹配等问题
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any, Tuple

from .data_parser import (
    CameraConfig, MaskRule, FrameImage, OldMaskConfig
)


class Severity(Enum):
    """问题严重程度"""
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class IssueType(Enum):
    """问题类型"""
    MASK_OUT_OF_BOUNDS = "mask_out_of_bounds"
    KEY_STATION_UNMASKED = "key_station_unmasked"
    OLD_CONFIG_ROLLBACK = "old_config_rollback"
    RESOLUTION_MISMATCH = "resolution_mismatch"
    MASK_ADDED = "mask_added"
    MASK_REMOVED = "mask_removed"
    MASK_MODIFIED = "mask_modified"


@dataclass
class ValidationIssue:
    """校验问题"""
    issue_type: IssueType
    severity: Severity
    camera_id: str
    description: str
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_type": self.issue_type.value,
            "severity": self.severity.value,
            "camera_id": self.camera_id,
            "description": self.description,
            "details": self.details
        }


@dataclass
class CameraValidationResult:
    """单台相机校验结果"""
    camera_id: str
    issues: List[ValidationIssue] = field(default_factory=list)
    mask_diff: Dict[str, Any] = field(default_factory=dict)
    is_valid: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "camera_id": self.camera_id,
            "issues": [issue.to_dict() for issue in self.issues],
            "mask_diff": self.mask_diff,
            "is_valid": self.is_valid
        }


@dataclass
class ValidationResult:
    """整体校验结果"""
    all_results: Dict[str, CameraValidationResult] = field(default_factory=dict)
    summary: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def all_issues(self) -> List[ValidationIssue]:
        issues = []
        for result in self.all_results.values():
            issues.extend(result.issues)
        return issues
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "all_results": {
                cam_id: result.to_dict() 
                for cam_id, result in self.all_results.items()
            },
            "summary": self.summary
        }


class RuleValidator:
    """规则校验器"""
    
    def __init__(self, cameras: Dict[str, CameraConfig], 
                 mask_rules: Dict[str, MaskRule],
                 frames: Dict[str, FrameImage],
                 old_configs: Optional[Dict[str, OldMaskConfig]] = None):
        self.cameras = cameras
        self.mask_rules = mask_rules
        self.frames = frames
        self.old_configs = old_configs or {}
    
    def validate_all(self) -> ValidationResult:
        """执行所有校验"""
        result = ValidationResult()
        
        for camera_id, camera in self.cameras.items():
            cam_result = self._validate_camera(camera)
            result.all_results[camera_id] = cam_result
        
        result.summary = self._generate_summary(result)
        return result
    
    def _validate_camera(self, camera: CameraConfig) -> CameraValidationResult:
        """校验单台相机"""
        result = CameraValidationResult(camera_id=camera.camera_id)
        
        # 1. 检查分辨率匹配
        self._check_resolution_mismatch(camera, result)
        
        # 2. 检查遮罩越界
        self._check_mask_out_of_bounds(camera, result)
        
        # 3. 检查关键工位遮罩
        self._check_key_stations_masked(camera, result)
        
        # 4. 检查新旧配置差异
        if camera.camera_id in self.old_configs:
            self._check_old_config_rollback(camera, result)
        
        # 标记是否有严重问题
        result.is_valid = all(
            issue.severity != Severity.CRITICAL 
            for issue in result.issues
        )
        
        return result
    
    def _check_resolution_mismatch(self, camera: CameraConfig, 
                                     result: CameraValidationResult):
        """检查分辨率不匹配"""
        if camera.camera_id not in self.frames:
            return
        
        frame = self.frames[camera.camera_id]
        
        if (camera.width != frame.width) or (camera.height != frame.height):
            issue = ValidationIssue(
                issue_type=IssueType.RESOLUTION_MISMATCH,
                severity=Severity.WARNING,
                camera_id=camera.camera_id,
                description=f"配置分辨率 ({camera.width}x{camera.height}) 与实际图片分辨率 ({frame.width}x{frame.height}) 不匹配",
                details={
                    "configured_width": camera.width,
                    "configured_height": camera.height,
                    "actual_width": frame.width,
                    "actual_height": frame.height
                }
            )
            result.issues.append(issue)
    
    def _check_mask_out_of_bounds(self, camera: CameraConfig, 
                                   result: CameraValidationResult):
        """检查遮罩越界"""
        for station in camera.stations:
            if station not in self.mask_rules:
                continue
            
            rule = self.mask_rules[station]
            
            # 检查归一化坐标是否越界 [0, 1]
            out_of_bounds = []
            if rule.x_min < 0 or rule.x_min > 1:
                out_of_bounds.append(f"x_min={rule.x_min}")
            if rule.x_max < 0 or rule.x_max > 1:
                out_of_bounds.append(f"x_max={rule.x_max}")
            if rule.y_min < 0 or rule.y_min > 1:
                out_of_bounds.append(f"y_min={rule.y_min}")
            if rule.y_max < 0 or rule.y_max > 1:
                out_of_bounds.append(f"y_max={rule.y_max}")
            
            # 检查 x_max > x_min, y_max > y_min
            if rule.x_max <= rule.x_min:
                out_of_bounds.append(f"x_max({rule.x_max}) <= x_min({rule.x_min})")
            if rule.y_max <= rule.y_min:
                out_of_bounds.append(f"y_max({rule.y_max}) <= y_min({rule.y_min})")
            
            if out_of_bounds:
                issue = ValidationIssue(
                    issue_type=IssueType.MASK_OUT_OF_BOUNDS,
                    severity=Severity.CRITICAL,
                    camera_id=camera.camera_id,
                    description=f"工位 {station} 的遮罩坐标越界: {', '.join(out_of_bounds)}",
                    details={
                        "station": station,
                        "rule": rule.to_dict(),
                        "out_of_bounds": out_of_bounds
                    }
                )
                result.issues.append(issue)
    
    def _check_key_stations_masked(self, camera: CameraConfig, 
                                     result: CameraValidationResult):
        """检查关键工位是否有遮罩规则"""
        # 假设所有在 mask_rules 中的工位都是关键工位
        # 检查相机覆盖的工位是否都有对应的遮罩规则
        
        for station in camera.stations:
            if station not in self.mask_rules:
                issue = ValidationIssue(
                    issue_type=IssueType.KEY_STATION_UNMASKED,
                    severity=Severity.WARNING,
                    camera_id=camera.camera_id,
                    description=f"工位 {station} 没有配置遮罩规则",
                    details={
                        "station": station,
                        "camera_stations": camera.stations
                    }
                )
                result.issues.append(issue)
    
    def _check_old_config_rollback(self, camera: CameraConfig, 
                                     result: CameraValidationResult):
        """检查旧配置回滚/变更"""
        old_config = self.old_configs[camera.camera_id]
        
        # 获取当前遮罩列表（从规则转换）
        current_masks = self._rules_to_masks(camera)
        old_masks = old_config.masks
        
        # 计算差异
        diff = self._calculate_mask_diff(current_masks, old_masks)
        result.mask_diff = diff
        
        # 为每个差异生成问题
        if diff.get('added'):
            for mask in diff['added']:
                issue = ValidationIssue(
                    issue_type=IssueType.MASK_ADDED,
                    severity=Severity.INFO,
                    camera_id=camera.camera_id,
                    description=f"新增遮罩: {mask.get('station', 'unknown')}",
                    details={
                        "action": "added",
                        "mask": mask
                    }
                )
                result.issues.append(issue)
        
        if diff.get('removed'):
            for mask in diff['removed']:
                issue = ValidationIssue(
                    issue_type=IssueType.MASK_REMOVED,
                    severity=Severity.WARNING,
                    camera_id=camera.camera_id,
                    description=f"移除遮罩（可能是回滚）: {mask.get('station', 'unknown')}",
                    details={
                        "action": "removed",
                        "mask": mask
                    }
                )
                result.issues.append(issue)
        
        if diff.get('modified'):
            for mod in diff['modified']:
                issue = ValidationIssue(
                    issue_type=IssueType.MASK_MODIFIED,
                    severity=Severity.INFO,
                    camera_id=camera.camera_id,
                    description=f"修改遮罩: {mod.get('station', 'unknown')}",
                    details={
                        "action": "modified",
                        "old_mask": mod.get('old'),
                        "new_mask": mod.get('new')
                    }
                )
                result.issues.append(issue)
    
    def _rules_to_masks(self, camera: CameraConfig) -> List[Dict[str, Any]]:
        """将遮罩规则转换为遮罩列表"""
        masks = []
        for station in camera.stations:
            if station in self.mask_rules:
                rule = self.mask_rules[station]
                masks.append({
                    "station": station,
                    "mask_type": rule.mask_type,
                    "x_min": rule.x_min,
                    "x_max": rule.x_max,
                    "y_min": rule.y_min,
                    "y_max": rule.y_max
                })
        return masks
    
    def _calculate_mask_diff(self, current_masks: List[Dict[str, Any]], 
                              old_masks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """计算遮罩差异"""
        # 按 station 分组
        current_by_station = {m.get('station'): m for m in current_masks if m.get('station')}
        old_by_station = {m.get('station'): m for m in old_masks if m.get('station')}
        
        all_stations = set(current_by_station.keys()) | set(old_by_station.keys())
        
        added = []
        removed = []
        modified = []
        
        for station in all_stations:
            current = current_by_station.get(station)
            old = old_by_station.get(station)
            
            if current and not old:
                added.append(current)
            elif old and not current:
                removed.append(old)
            elif current and old:
                # 比较是否修改
                if self._mask_changed(current, old):
                    modified.append({
                        "station": station,
                        "old": old,
                        "new": current
                    })
        
        return {
            "added": added,
            "removed": removed,
            "modified": modified,
            "total_added": len(added),
            "total_removed": len(removed),
            "total_modified": len(modified)
        }
    
    def _mask_changed(self, mask1: Dict[str, Any], mask2: Dict[str, Any]) -> bool:
        """检查遮罩是否有变化"""
        keys_to_compare = ['x_min', 'x_max', 'y_min', 'y_max', 'mask_type']
        for key in keys_to_compare:
            val1 = mask1.get(key)
            val2 = mask2.get(key)
            if val1 != val2:
                # 对于浮点数，允许微小误差
                if isinstance(val1, float) and isinstance(val2, float):
                    if abs(val1 - val2) > 1e-6:
                        return True
                else:
                    return True
        return False
    
    def _generate_summary(self, result: ValidationResult) -> Dict[str, Any]:
        """生成校验摘要"""
        total_cameras = len(result.all_results)
        valid_cameras = sum(1 for r in result.all_results.values() if r.is_valid)
        
        issue_counts = {
            "critical": 0,
            "warning": 0,
            "info": 0
        }
        
        issue_type_counts = {}
        
        for issue in result.all_issues:
            issue_counts[issue.severity.value] += 1
            issue_type = issue.issue_type.value
            issue_type_counts[issue_type] = issue_type_counts.get(issue_type, 0) + 1
        
        # 计算变更统计
        mask_changes = {
            "total_added": 0,
            "total_removed": 0,
            "total_modified": 0
        }
        
        for cam_result in result.all_results.values():
            diff = cam_result.mask_diff
            mask_changes["total_added"] += diff.get("total_added", 0)
            mask_changes["total_removed"] += diff.get("total_removed", 0)
            mask_changes["total_modified"] += diff.get("total_modified", 0)
        
        return {
            "total_cameras": total_cameras,
            "valid_cameras": valid_cameras,
            "invalid_cameras": total_cameras - valid_cameras,
            "issue_counts": issue_counts,
            "issue_type_counts": issue_type_counts,
            "mask_changes": mask_changes,
            "overall_status": "pass" if valid_cameras == total_cameras else "fail"
        }
