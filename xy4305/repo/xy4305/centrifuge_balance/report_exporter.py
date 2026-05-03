"""Markdown报告导出模块"""

from typing import Dict, List, Optional
from datetime import datetime

from .models import Rotor, TubeType, BalanceResult, BalanceConfig


class MarkdownExporter:
    """Markdown报告导出器"""
    
    def __init__(self, config: Optional[BalanceConfig] = None):
        self.config = config or BalanceConfig()
    
    def export_report(
        self,
        result: BalanceResult,
        rotor: Rotor,
        tube_types: Dict[str, TubeType],
        file_path: str
    ) -> List[str]:
        """
        导出Markdown格式报告
        
        Args:
            result: 配平计算结果
            rotor: 转子信息
            tube_types: 管型字典
            file_path: 输出文件路径
        
        Returns:
            错误信息列表（空表示成功）
        """
        errors = []
        
        try:
            content = self._generate_report_content(result, rotor, tube_types)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
        
        except Exception as e:
            errors.append(f"导出报告时出错: {str(e)}")
        
        return errors
    
    def _generate_report_content(
        self,
        result: BalanceResult,
        rotor: Rotor,
        tube_types: Dict[str, TubeType]
    ) -> str:
        """生成报告内容"""
        lines = []
        
        lines.append("# 离心机转子配平报告")
        lines.append("")
        lines.append(f"**生成时间**: {result.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 基本信息")
        lines.append("")
        lines.append("| 项目 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 转子ID | {rotor.id} |")
        lines.append(f"| 转子名称 | {rotor.name} |")
        lines.append(f"| 孔位数 | {rotor.hole_count} |")
        lines.append(f"| 半径 | {rotor.radius_cm} cm |")
        lines.append(f"| 最大转速 | {rotor.max_rpm} RPM |")
        lines.append(f"| 本次转速 | {result.run_rpm} RPM |")
        lines.append(f"| 累计使用次数 | {rotor.usage_count} |")
        if rotor.last_used:
            lines.append(f"| 上次使用 | {rotor.last_used.strftime('%Y-%m-%d %H:%M')} |")
        lines.append("")
        
        lines.append("## 配平状态")
        lines.append("")
        
        if result.is_balanced:
            lines.append("### ✅ 已配平")
        else:
            lines.append("### ❌ 未配平")
        
        lines.append("")
        lines.append(f"- **最大质量不平衡**: {result.max_mass_imbalance_g:.4f} g")
        lines.append(f"  - 阈值: {self.config.mass_imbalance_threshold_g} g")
        if result.max_mass_imbalance_g > self.config.mass_imbalance_threshold_g:
            lines.append("  - ⚠️ **超过阈值**")
        lines.append(f"- **最大力矩不平衡**: {result.max_moment_imbalance_gcm:.4f} g·cm")
        lines.append(f"  - 阈值: {self.config.moment_imbalance_threshold_gcm} g·cm")
        if result.max_moment_imbalance_gcm > self.config.moment_imbalance_threshold_gcm:
            lines.append("  - ⚠️ **超过阈值**")
        lines.append("")
        
        lines.append("## 孔位详细信息")
        lines.append("")
        lines.append("| 孔位 | 管型 | 体积(ml) | 密度(g/ml) | 总质量(g) | 质量矩(g·cm) | 标签 |")
        lines.append("|------|------|----------|------------|-----------|--------------|------|")
        
        for hr in sorted(result.hole_results, key=lambda x: x.hole_position):
            tube_type = tube_types.get(hr.tube_type_id)
            tube_name = tube_type.name if tube_type else hr.tube_type_id
            lines.append(
                f"| {hr.hole_position} "
                f"| {tube_name} "
                f"| {hr.sample_volume_ml:.2f} "
                f"| {hr.sample_density_gml:.3f} "
                f"| {hr.total_mass_g:.4f} "
                f"| {hr.mass_moment_gcm:.4f} "
                f"| {hr.label or '-'} |"
            )
        lines.append("")
        
        if result.imbalance_infos:
            lines.append("## 对称孔位不平衡分析")
            lines.append("")
            lines.append("| 孔位对 | 孔位1质量(g) | 孔位2质量(g) | 质量差(g) | 较重孔位 | 孔位1力矩 | 孔位2力矩 | 力矩差 |")
            lines.append("|--------|--------------|--------------|-----------|----------|-----------|-----------|--------|")
            
            for ii in result.imbalance_infos:
                exceeds_threshold = ii.mass_difference_g > self.config.mass_imbalance_threshold_g
                indicator = " ⚠️" if exceeds_threshold else ""
                lines.append(
                    f"| ({ii.hole1_position}, {ii.hole2_position}) "
                    f"| {ii.hole1_mass_g:.4f} "
                    f"| {ii.hole2_mass_g:.4f} "
                    f"| {ii.mass_difference_g:.4f}{indicator} "
                    f"| {ii.mass_direction} "
                    f"| {ii.hole1_moment_gcm:.4f} "
                    f"| {ii.hole2_moment_gcm:.4f} "
                    f"| {ii.moment_difference_gcm:.4f} |"
                )
            lines.append("")
        
        if result.adjustment_suggestions:
            lines.append("## 调整建议")
            lines.append("")
            
            priority_map = {
                "high": "🔴 高优先级",
                "medium": "🟡 中优先级",
                "low": "🟢 低优先级"
            }
            
            for i, suggestion in enumerate(result.adjustment_suggestions, 1):
                priority_label = priority_map.get(suggestion.priority, "未知")
                lines.append(f"### {i}. {suggestion.suggestion_type} ({priority_label})")
                lines.append("")
                lines.append(suggestion.description)
                lines.append("")
                
                if suggestion.hole_position or suggestion.target_hole:
                    lines.append("**涉及孔位**:")
                    if suggestion.hole_position:
                        lines.append(f"- 孔位 {suggestion.hole_position}")
                    if suggestion.target_hole:
                        lines.append(f"- 目标孔位 {suggestion.target_hole}")
                    if suggestion.adjustment_ml:
                        lines.append(f"**建议调整量**: {suggestion.adjustment_ml:.2f} ml")
                    lines.append("")
        
        if result.validation_errors:
            lines.append("## ⚠️ 校验错误")
            lines.append("")
            
            for i, error in enumerate(result.validation_errors, 1):
                lines.append(f"### {i}. {error.error_type}")
                lines.append("")
                lines.append(f"**错误信息**: {error.message}")
                if error.details:
                    lines.append("")
                    lines.append("**详细信息**:")
                    for key, value in error.details.items():
                        lines.append(f"- {key}: {value}")
                lines.append("")
        
        if result.notes:
            lines.append("## 备注")
            lines.append("")
            lines.append(result.notes)
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此报告由离心机转子配平助手自动生成*")
        
        return "\n".join(lines)
    
    def export_history_comparison_report(
        self,
        history_records: List[Dict],
        file_path: str
    ) -> List[str]:
        """
        导出历史记录对比报告
        
        Args:
            history_records: 历史记录列表
            file_path: 输出文件路径
        
        Returns:
            错误信息列表
        """
        errors = []
        
        try:
            lines = []
            
            lines.append("# 历史配平记录对比报告")
            lines.append("")
            lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append("")
            
            if not history_records:
                lines.append("## 暂无历史记录")
                lines.append("")
                lines.append("数据目录中没有找到历史配平记录。")
            else:
                lines.append("## 记录概览")
                lines.append("")
                lines.append("| 序号 | 记录ID | 时间 | 转子ID | 配平状态 | 最大质量差(g) |")
                lines.append("|------|--------|------|--------|----------|---------------|")
                
                for i, record in enumerate(history_records, 1):
                    status_icon = "✅ 已配平" if record.get("is_balanced") else "❌ 未配平"
                    timestamp = record.get("timestamp", "")
                    try:
                        dt = datetime.fromisoformat(timestamp)
                        timestamp_str = dt.strftime("%m-%d %H:%M")
                    except (ValueError, TypeError):
                        timestamp_str = timestamp
                    
                    mass_diff = record.get("max_mass_imbalance_g", 0)
                    lines.append(
                        f"| {i} "
                        f"| {record.get('id', '-')} "
                        f"| {timestamp_str} "
                        f"| {record.get('rotor_id', '-')} "
                        f"| {status_icon} "
                        f"| {mass_diff:.4f} |"
                    )
                
                lines.append("")
                
                balanced_count = sum(1 for r in history_records if r.get("is_balanced"))
                total_count = len(history_records)
                
                lines.append("## 统计信息")
                lines.append("")
                lines.append(f"- **总记录数**: {total_count}")
                lines.append(f"- **已配平记录**: {balanced_count}")
                lines.append(f"- **未配平记录**: {total_count - balanced_count}")
                if total_count > 0:
                    lines.append(f"- **配平成功率**: {balanced_count / total_count * 100:.1f}%")
                lines.append("")
            
            lines.append("---")
            lines.append("")
            lines.append("*此报告由离心机转子配平助手自动生成*")
            
            content = "\n".join(lines)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
        
        except Exception as e:
            errors.append(f"导出对比报告时出错: {str(e)}")
        
        return errors
