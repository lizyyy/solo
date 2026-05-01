import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .config import SyncConfig
from .conflict import get_conflict_type_description
from .models import (
    ConflictType,
    FileInfo,
    Manifest,
    OperationType,
    PlanStatus,
    SyncPlan,
    generate_timestamp_id,
)


class Reporter:
    def __init__(self, config: SyncConfig):
        self.config = config
        self.report_dir = Path(config.log_dir) / "reports"
        self.report_dir.mkdir(parents=True, exist_ok=True)
    
    def _format_file_size(self, size: int) -> str:
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024.0:
                return f"{size:.2f} {unit}"
            size /= 1024.0
        return f"{size:.2f} PB"
    
    def _format_timestamp(self, timestamp: float) -> str:
        return datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')
    
    def _get_operation_description(self, op_type: OperationType) -> str:
        descriptions = {
            OperationType.COPY_LEFT_TO_RIGHT: "从左侧复制到右侧",
            OperationType.COPY_RIGHT_TO_LEFT: "从右侧复制到左侧",
            OperationType.DELETE_LEFT: "删除左侧文件",
            OperationType.DELETE_RIGHT: "删除右侧文件",
            OperationType.RENAME_LEFT: "重命名左侧文件",
            OperationType.RENAME_RIGHT: "重命名右侧文件",
            OperationType.SKIP: "跳过",
        }
        return descriptions.get(op_type, str(op_type))
    
    def generate_scan_report(
        self,
        left_manifest: Manifest,
        right_manifest: Manifest,
        left_manifest_path: str = "",
        right_manifest_path: str = "",
    ) -> Dict[str, Any]:
        left_files = list(left_manifest.files.values())
        right_files = list(right_manifest.files.values())
        
        left_size = sum(f.size for f in left_files)
        right_size = sum(f.size for f in right_files)
        
        left_paths = set(left_manifest.files.keys())
        right_paths = set(right_manifest.files.keys())
        
        common_paths = left_paths & right_paths
        left_only = left_paths - right_paths
        right_only = right_paths - left_paths
        
        common_with_same_hash = 0
        common_with_diff_hash = 0
        
        for path in common_paths:
            left_file = left_manifest.files[path]
            right_file = right_manifest.files[path]
            if left_file.sha256 == right_file.sha256:
                common_with_same_hash += 1
            else:
                common_with_diff_hash += 1
        
        return {
            "report_type": "scan",
            "generated_at": time.time(),
            "generated_at_str": self._format_timestamp(time.time()),
            "left": {
                "manifest_path": left_manifest_path,
                "root_dir": left_manifest.root_dir,
                "file_count": len(left_files),
                "total_size": left_size,
                "total_size_formatted": self._format_file_size(left_size),
                "only_in_left": len(left_only),
            },
            "right": {
                "manifest_path": right_manifest_path,
                "root_dir": right_manifest.root_dir,
                "file_count": len(right_files),
                "total_size": right_size,
                "total_size_formatted": self._format_file_size(right_size),
                "only_in_right": len(right_only),
            },
            "comparison": {
                "common_paths": len(common_paths),
                "same_content": common_with_same_hash,
                "different_content": common_with_diff_hash,
            },
        }
    
    def generate_plan_report(self, plan: SyncPlan) -> Dict[str, Any]:
        operations_by_type: Dict[str, int] = {}
        for op in plan.operations:
            op_type = op.operation_type.value
            operations_by_type[op_type] = operations_by_type.get(op_type, 0) + 1
        
        conflicts_by_type: Dict[str, int] = {}
        for conf in plan.conflicts:
            conf_type = conf.conflict_type.value
            conflicts_by_type[conf_type] = conflicts_by_type.get(conf_type, 0) + 1
        
        total_copy_size = sum(
            op.size for op in plan.operations
            if op.operation_type in [OperationType.COPY_LEFT_TO_RIGHT, OperationType.COPY_RIGHT_TO_LEFT]
        )
        
        return {
            "report_type": "plan",
            "generated_at": time.time(),
            "generated_at_str": self._format_timestamp(time.time()),
            "status": plan.status.value,
            "has_conflicts": plan.has_conflicts(),
            "statistics": plan.statistics,
            "operations": {
                "total": len(plan.operations),
                "by_type": operations_by_type,
                "total_copy_size": total_copy_size,
                "total_copy_size_formatted": self._format_file_size(total_copy_size),
            },
            "conflicts": {
                "total": len(plan.conflicts),
                "by_type": conflicts_by_type,
                "items": [
                    {
                        "type": c.conflict_type.value,
                        "type_description": get_conflict_type_description(c.conflict_type),
                        "left_path": c.left_file.relative_path if c.left_file else None,
                        "right_path": c.right_file.relative_path if c.right_file else None,
                        "suggestion": c.suggestion,
                        "details": c.details,
                    }
                    for c in plan.conflicts
                ],
            },
        }
    
    def export_markdown(
        self,
        report_data: Dict[str, Any],
        output_path: Optional[str] = None,
    ) -> str:
        timestamp_id = generate_timestamp_id()
        if output_path is None:
            output_path = str(self.report_dir / f"report_{timestamp_id}.md")
        
        lines = []
        lines.append("# 外业资料同步报告")
        lines.append("")
        lines.append(f"**生成时间**: {report_data.get('generated_at_str', '未知')}")
        lines.append(f"**报告类型**: {report_data.get('report_type', 'unknown')}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        if report_data.get('report_type') == 'scan':
            lines.append("## 扫描结果概览")
            lines.append("")
            
            left = report_data.get('left', {})
            right = report_data.get('right', {})
            comparison = report_data.get('comparison', {})
            
            lines.append("### 左侧目录（工作区）")
            lines.append(f"- **根目录**: {left.get('root_dir', '未知')}")
            lines.append(f"- **文件数量**: {left.get('file_count', 0)}")
            lines.append(f"- **总大小**: {left.get('total_size_formatted', '0 B')}")
            lines.append(f"- **仅左侧存在**: {left.get('only_in_left', 0)} 个文件")
            lines.append("")
            
            lines.append("### 右侧目录（备份区）")
            lines.append(f"- **根目录**: {right.get('root_dir', '未知')}")
            lines.append(f"- **文件数量**: {right.get('file_count', 0)}")
            lines.append(f"- **总大小**: {right.get('total_size_formatted', '0 B')}")
            lines.append(f"- **仅右侧存在**: {right.get('only_in_right', 0)} 个文件")
            lines.append("")
            
            lines.append("### 对比结果")
            lines.append(f"- **共同路径**: {comparison.get('common_paths', 0)}")
            lines.append(f"- **内容相同**: {comparison.get('same_content', 0)}")
            lines.append(f"- **内容不同**: {comparison.get('different_content', 0)}")
            lines.append("")
        
        elif report_data.get('report_type') == 'plan':
            lines.append("## 同步计划概览")
            lines.append("")
            
            lines.append(f"**状态**: {report_data.get('status', 'unknown')}")
            lines.append(f"**是否存在冲突**: {'是' if report_data.get('has_conflicts') else '否'}")
            lines.append("")
            
            operations = report_data.get('operations', {})
            lines.append("### 操作统计")
            lines.append(f"- **总操作数**: {operations.get('total', 0)}")
            lines.append(f"- **待复制总大小**: {operations.get('total_copy_size_formatted', '0 B')}")
            lines.append("")
            
            by_type = operations.get('by_type', {})
            if by_type:
                lines.append("**按类型分类**:")
                lines.append("")
                for op_type, count in by_type.items():
                    lines.append(f"- `{op_type}`: {count} 个")
                lines.append("")
            
            conflicts = report_data.get('conflicts', {})
            if conflicts.get('total', 0) > 0:
                lines.append("### 冲突详情")
                lines.append(f"- **总冲突数**: {conflicts.get('total', 0)}")
                lines.append("")
                
                by_conflict_type = conflicts.get('by_type', {})
                if by_conflict_type:
                    lines.append("**按冲突类型分类**:")
                    lines.append("")
                    for conf_type, count in by_conflict_type.items():
                        lines.append(f"- `{conf_type}`: {count} 个")
                    lines.append("")
                
                items = conflicts.get('items', [])
                if items:
                    lines.append("**冲突列表**:")
                    lines.append("")
                    for idx, item in enumerate(items, 1):
                        lines.append(f"#### 冲突 {idx}")
                        lines.append(f"- **类型**: {item.get('type', 'unknown')}")
                        lines.append(f"- **描述**: {item.get('type_description', '')}")
                        if item.get('left_path'):
                            lines.append(f"- **左侧路径**: {item['left_path']}")
                        if item.get('right_path'):
                            lines.append(f"- **右侧路径**: {item['right_path']}")
                        if item.get('suggestion'):
                            lines.append(f"- **建议**: {item['suggestion']}")
                        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此报告由外业资料双向同步预演器生成*")
        
        markdown_content = "\n".join(lines)
        
        output_path_obj = Path(output_path)
        output_path_obj.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        
        return output_path
    
    def export_json(
        self,
        report_data: Dict[str, Any],
        output_path: Optional[str] = None,
    ) -> str:
        timestamp_id = generate_timestamp_id()
        if output_path is None:
            output_path = str(self.report_dir / f"report_{timestamp_id}.json")
        
        output_path_obj = Path(output_path)
        output_path_obj.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False, default=str)
        
        return output_path
