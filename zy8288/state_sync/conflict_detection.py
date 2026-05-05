import pandas as pd
from typing import Dict, List, Any, Optional, Tuple
from enum import Enum
from dataclasses import dataclass

from .state_storage import WorkspaceState


class ConflictType(str, Enum):
    """冲突类型枚举"""
    FILE_CONTENT_CHANGED = "file_content_changed"
    SCHEMA_MISMATCH = "schema_mismatch"
    ROW_COUNT_MISMATCH = "row_count_mismatch"
    STATE_CORRUPTED = "state_corrupted"
    NO_CONFLICT = "no_conflict"


@dataclass
class ConflictInfo:
    """冲突信息"""
    conflict_type: ConflictType
    message: str
    details: Dict[str, Any]
    severity: str  # "error", "warning", "info"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "conflict_type": self.conflict_type.value,
            "message": self.message,
            "details": self.details,
            "severity": self.severity,
        }


class ConflictDetector:
    """冲突检测器"""
    
    def __init__(self):
        self.conflicts: List[ConflictInfo] = []
    
    def detect_all(
        self,
        original_df: Optional[pd.DataFrame],
        current_df: Optional[pd.DataFrame],
        saved_state: Optional[WorkspaceState],
        current_fingerprint: Optional[str] = None,
        saved_fingerprint: Optional[str] = None,
    ) -> List[ConflictInfo]:
        """
        检测所有可能的冲突
        
        Args:
            original_df: 原始数据 DataFrame（从状态文件推断的结构）
            current_df: 当前加载的数据 DataFrame
            saved_state: 保存的工作区状态
            current_fingerprint: 当前文件的指纹
            saved_fingerprint: 保存状态对应的文件指纹
            
        Returns:
            冲突信息列表
        """
        self.conflicts = []
        
        if saved_state is None:
            return self.conflicts
        
        if current_fingerprint and saved_fingerprint:
            if current_fingerprint != saved_fingerprint:
                self._detect_fingerprint_conflict(
                    current_fingerprint, saved_fingerprint
                )
        
        if current_df is not None:
            if saved_state.row_annotations:
                self._detect_row_count_conflict(
                    current_df, saved_state.row_annotations
                )
            
            if saved_state.field_mappings:
                self._detect_schema_conflict(
                    current_df, saved_state.field_mappings
                )
        
        return self.conflicts
    
    def _detect_fingerprint_conflict(
        self,
        current_fingerprint: str,
        saved_fingerprint: str
    ):
        """检测文件指纹冲突（文件内容变化）"""
        self.conflicts.append(ConflictInfo(
            conflict_type=ConflictType.FILE_CONTENT_CHANGED,
            message="文件内容已变化，保存的状态可能不匹配当前文件",
            details={
                "current_fingerprint": current_fingerprint,
                "saved_fingerprint": saved_fingerprint,
            },
            severity="warning",
        ))
    
    def _detect_row_count_conflict(
        self,
        current_df: pd.DataFrame,
        row_annotations: List[Any]
    ):
        """检测行数冲突"""
        current_row_count = len(current_df)
        
        annotated_row_indices = {
            ann.row_index for ann in row_annotations
            if hasattr(ann, 'row_index')
        }
        
        if annotated_row_indices:
            max_annotated_row = max(annotated_row_indices)
            if max_annotated_row >= current_row_count:
                self.conflicts.append(ConflictInfo(
                    conflict_type=ConflictType.ROW_COUNT_MISMATCH,
                    message=f"当前数据行数 ({current_row_count}) 少于标注的最大行号 ({max_annotated_row})",
                    details={
                        "current_row_count": current_row_count,
                        "max_annotated_row": max_annotated_row,
                    },
                    severity="error",
                ))
    
    def _detect_schema_conflict(
        self,
        current_df: pd.DataFrame,
        field_mappings: List[Any]
    ):
        """检测字段结构冲突"""
        current_columns = set(current_df.columns.tolist())
        
        mapped_original_fields = set()
        for mapping in field_mappings:
            if hasattr(mapping, 'original_field') and mapping.enabled:
                mapped_original_fields.add(mapping.original_field)
        
        missing_fields = mapped_original_fields - current_columns
        if missing_fields:
            self.conflicts.append(ConflictInfo(
                conflict_type=ConflictType.SCHEMA_MISMATCH,
                message=f"部分映射的字段在当前数据中不存在: {', '.join(missing_fields)}",
                details={
                    "missing_fields": list(missing_fields),
                    "current_columns": list(current_columns),
                },
                severity="error",
            ))
    
    def check_data_compatibility(
        self,
        saved_state: WorkspaceState,
        current_df: pd.DataFrame
    ) -> Tuple[bool, List[str]]:
        """
        检查保存的状态与当前数据的兼容性
        
        Returns:
            (是否兼容, 兼容性问题列表)
        """
        issues = []
        
        if saved_state.row_annotations:
            current_row_count = len(current_df)
            for annotation in saved_state.row_annotations:
                if annotation.row_index >= current_row_count:
                    issues.append(
                        f"行标注索引 {annotation.row_index} 超出当前数据范围 ({current_row_count} 行)"
                    )
                    break
        
        if saved_state.field_mappings:
            current_columns = set(current_df.columns.tolist())
            for mapping in saved_state.field_mappings:
                if mapping.enabled and mapping.original_field not in current_columns:
                    issues.append(
                        f"映射的字段 '{mapping.original_field}' 在当前数据中不存在"
                    )
        
        if saved_state.filter_conditions:
            current_columns = set(current_df.columns.tolist())
            for condition in saved_state.filter_conditions:
                if condition.enabled and condition.field not in current_columns:
                    issues.append(
                        f"筛选条件引用的字段 '{condition.field}' 在当前数据中不存在"
                    )
        
        return (len(issues) == 0, issues)
