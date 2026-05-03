"""
报告导出模块
生成 audit_report.md 审计报告
"""

import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from .rule_validator import (
    ValidationResult, ValidationIssue, Severity, IssueType
)
from .data_parser import CameraConfig


class ReportGenerator:
    """报告生成器"""
    
    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        self.preview_dir = os.path.join(output_dir, "previews")
        self.diff_dir = os.path.join(output_dir, "diffs")
    
    def generate_audit_report(self, 
                               validation_result: ValidationResult,
                               cameras: Dict[str, CameraConfig],
                               generated_images: Optional[Dict[str, Dict[str, str]]] = None) -> str:
        """
        生成审计报告
        
        Args:
            validation_result: 校验结果
            cameras: 相机配置字典
            generated_images: 生成的图片路径映射 {camera_id: {"preview": path, "diff": path}}
        
        Returns:
            报告文件路径
        """
        generated_images = generated_images or {}
        report_path = os.path.join(self.output_dir, "audit_report.md")
        
        # 生成报告内容
        content = self._generate_report_content(
            validation_result, cameras, generated_images
        )
        
        # 确保输出目录存在
        os.makedirs(self.output_dir, exist_ok=True)
        
        # 写入报告
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return report_path
    
    def _generate_report_content(self,
                                  validation_result: ValidationResult,
                                  cameras: Dict[str, CameraConfig],
                                  generated_images: Dict[str, Dict[str, str]]) -> str:
        """生成报告内容"""
        lines = []
        
        # 标题
        lines.append("# 相机隐私遮罩配置审计报告")
        lines.append("")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 整体状态
        summary = validation_result.summary
        overall_status = summary.get('overall_status', 'unknown')
        status_icon = "✅" if overall_status == "pass" else "❌"
        
        lines.append(f"## 整体状态: {status_icon} {overall_status.upper()}")
        lines.append("")
        
        # 统计摘要
        lines.append("### 统计摘要")
        lines.append("")
        lines.append(f"| 指标 | 数值 |")
        lines.append(f"|------|------|")
        lines.append(f"| 总相机数 | {summary.get('total_cameras', 0)} |")
        lines.append(f"| 有效配置 | {summary.get('valid_cameras', 0)} |")
        lines.append(f"| 无效配置 | {summary.get('invalid_cameras', 0)} |")
        lines.append("")
        
        # 问题统计
        issue_counts = summary.get('issue_counts', {})
        lines.append("### 问题统计")
        lines.append("")
        lines.append(f"| 严重程度 | 数量 |")
        lines.append(f"|----------|------|")
        lines.append(f"| 🔴 严重 (Critical) | {issue_counts.get('critical', 0)} |")
        lines.append(f"| 🟡 警告 (Warning) | {issue_counts.get('warning', 0)} |")
        lines.append(f"| ℹ️ 信息 (Info) | {issue_counts.get('info', 0)} |")
        lines.append("")
        
        # 遮罩变更统计
        mask_changes = summary.get('mask_changes', {})
        if any(mask_changes.values()):
            lines.append("### 遮罩变更统计")
            lines.append("")
            lines.append(f"| 变更类型 | 数量 |")
            lines.append(f"|----------|------|")
            lines.append(f"| ➕ 新增遮罩 | {mask_changes.get('total_added', 0)} |")
            lines.append(f"| ➖ 移除遮罩 | {mask_changes.get('total_removed', 0)} |")
            lines.append(f"| 🔄 修改遮罩 | {mask_changes.get('total_modified', 0)} |")
            lines.append("")
        
        # 问题类型分布
        issue_type_counts = summary.get('issue_type_counts', {})
        if issue_type_counts:
            lines.append("### 问题类型分布")
            lines.append("")
            for issue_type, count in sorted(issue_type_counts.items(), key=lambda x: -x[1]):
                type_name = self._format_issue_type(issue_type)
                lines.append(f"- **{type_name}**: {count} 处")
            lines.append("")
        
        # 分隔线
        lines.append("---")
        lines.append("")
        
        # 每台相机的详细报告
        lines.append("## 详细报告")
        lines.append("")
        
        for camera_id, cam_result in validation_result.all_results.items():
            camera = cameras.get(camera_id)
            cam_images = generated_images.get(camera_id, {})
            
            lines.append(f"### 📷 相机: {camera_id}")
            lines.append("")
            
            # 相机信息
            if camera:
                lines.append(f"**位置**: {camera.location}")
                lines.append(f"**分辨率**: {camera.width} x {camera.height}")
                lines.append(f"**覆盖工位**: {', '.join(camera.stations)}")
                lines.append("")
            
            # 配置状态
            cam_status = "✅ 有效" if cam_result.is_valid else "❌ 无效"
            lines.append(f"**配置状态**: {cam_status}")
            lines.append("")
            
            # 图片预览
            if cam_images:
                lines.append("#### 预览图片")
                lines.append("")
                
                if cam_images.get('preview'):
                    preview_rel = self._get_relative_path(cam_images['preview'])
                    lines.append(f"**遮罩预览**:")
                    lines.append("")
                    lines.append(f"![遮罩预览]({preview_rel})")
                    lines.append("")
                
                if cam_images.get('diff'):
                    diff_rel = self._get_relative_path(cam_images['diff'])
                    lines.append(f"**变更对比**:")
                    lines.append("")
                    lines.append(f"![变更对比]({diff_rel})")
                    lines.append("")
            
            # 问题列表
            if cam_result.issues:
                lines.append("#### 发现的问题")
                lines.append("")
                
                # 按严重程度分组
                critical_issues = [i for i in cam_result.issues if i.severity == Severity.CRITICAL]
                warning_issues = [i for i in cam_result.issues if i.severity == Severity.WARNING]
                info_issues = [i for i in cam_result.issues if i.severity == Severity.INFO]
                
                for issue_group, group_name in [
                    (critical_issues, "🔴 严重问题"),
                    (warning_issues, "🟡 警告"),
                    (info_issues, "ℹ️ 信息")
                ]:
                    if issue_group:
                        lines.append(f"**{group_name}**:")
                        lines.append("")
                        
                        for issue in issue_group:
                            type_name = self._format_issue_type(issue.issue_type.value)
                            lines.append(f"1. **{type_name}**")
                            lines.append(f"   - 描述: {issue.description}")
                            
                            if issue.details:
                                details_str = self._format_details(issue.details)
                                lines.append(f"   - 详情: {details_str}")
                            
                            lines.append("")
            else:
                lines.append("*未发现问题*")
                lines.append("")
            
            # 遮罩变更详情
            mask_diff = cam_result.mask_diff
            if mask_diff and (mask_diff.get('added') or mask_diff.get('removed') or mask_diff.get('modified')):
                lines.append("#### 遮罩变更详情")
                lines.append("")
                
                if mask_diff.get('added'):
                    lines.append("**➕ 新增遮罩**:")
                    for mask in mask_diff['added']:
                        station = mask.get('station', 'unknown')
                        lines.append(f"- `{station}`: ({mask.get('x_min')}, {mask.get('y_min')}) - ({mask.get('x_max')}, {mask.get('y_max')})")
                    lines.append("")
                
                if mask_diff.get('removed'):
                    lines.append("**➖ 移除遮罩**:")
                    for mask in mask_diff['removed']:
                        station = mask.get('station', 'unknown')
                        lines.append(f"- `{station}`: ({mask.get('x_min')}, {mask.get('y_min')}) - ({mask.get('x_max')}, {mask.get('y_max')})")
                    lines.append("")
                
                if mask_diff.get('modified'):
                    lines.append("**🔄 修改遮罩**:")
                    for mod in mask_diff['modified']:
                        station = mod.get('station', 'unknown')
                        old = mod.get('old', {})
                        new = mod.get('new', {})
                        lines.append(f"- `{station}`:")
                        lines.append(f"  - 旧: ({old.get('x_min')}, {old.get('y_min')}) - ({old.get('x_max')}, {old.get('y_max')})")
                        lines.append(f"  - 新: ({new.get('x_min')}, {new.get('y_min')}) - ({new.get('x_max')}, {new.get('y_max')})")
                    lines.append("")
            
            # 分隔线
            lines.append("---")
            lines.append("")
        
        # 附录
        lines.append("## 附录")
        lines.append("")
        lines.append("### 问题类型说明")
        lines.append("")
        lines.append("| 类型 | 说明 | 严重程度 |")
        lines.append("|------|------|----------|")
        lines.append("| `mask_out_of_bounds` | 遮罩坐标越界，超出 [0, 1] 范围 | 严重 |")
        lines.append("| `resolution_mismatch` | 配置分辨率与实际图片不匹配 | 警告 |")
        lines.append("| `key_station_unmasked` | 关键工位未配置遮罩规则 | 警告 |")
        lines.append("| `mask_removed` | 遮罩被移除（可能是回滚） | 警告 |")
        lines.append("| `mask_added` | 新增遮罩 | 信息 |")
        lines.append("| `mask_modified` | 遮罩被修改 | 信息 |")
        lines.append("")
        
        lines.append("### 图例说明")
        lines.append("")
        lines.append("| 颜色 | 含义 |")
        lines.append("|------|------|")
        lines.append("| 🔴 红色 | 隐私遮罩 / 移除的遮罩 |")
        lines.append("| 🟢 绿色 | 新增的遮罩 |")
        lines.append("| 🟠 橙色 | 修改的遮罩（新位置） |")
        lines.append("| 虚线 | 修改的遮罩（旧位置） |")
        lines.append("")
        
        return "\n".join(lines)
    
    def _format_issue_type(self, issue_type: str) -> str:
        """格式化问题类型名称"""
        type_names = {
            "mask_out_of_bounds": "遮罩越界",
            "key_station_unmasked": "关键工位未遮",
            "old_config_rollback": "旧配置回滚",
            "resolution_mismatch": "分辨率不匹配",
            "mask_added": "新增遮罩",
            "mask_removed": "移除遮罩",
            "mask_modified": "修改遮罩",
        }
        return type_names.get(issue_type, issue_type)
    
    def _format_details(self, details: Dict[str, Any]) -> str:
        """格式化详情信息"""
        if not details:
            return "无"
        
        # 过滤掉不需要显示的字段
        filtered = {}
        for key, value in details.items():
            if isinstance(value, (str, int, float, bool)):
                filtered[key] = value
        
        if not filtered:
            return "无"
        
        return "; ".join(f"{k}: {v}" for k, v in filtered.items())
    
    def _get_relative_path(self, full_path: str) -> str:
        """获取相对于报告目录的路径"""
        try:
            full_path_obj = Path(full_path)
            output_dir_obj = Path(self.output_dir)
            return str(full_path_obj.relative_to(output_dir_obj.parent))
        except ValueError:
            # 如果无法计算相对路径，直接返回文件名
            return Path(full_path).name
