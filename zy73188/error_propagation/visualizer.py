"""可视化模块 - 生成误差传播图表"""

import os
import json
from typing import List, Dict, Any
from datetime import datetime

from .models import PropagationResult, MeasurementVariable


class ChartVisualizer:
    """图表生成器 - 文本模式的图表（不依赖外部库）"""
    
    def __init__(self, output_dir: str = "./output"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def generate_uncertainty_budget_chart(
        self,
        result: PropagationResult,
        width: int = 60,
    ) -> str:
        """生成不确定度贡献条形图（文本模式）"""
        lines = []
        lines.append("=" * 70)
        lines.append(f"📊 不确定度贡献分析 - {result.formula.name}")
        lines.append("=" * 70)
        lines.append("")
        
        if not result.uncertainty_contributions:
            lines.append("  [已挂起] 无不确定度贡献数据")
            lines.append("")
            return "\n".join(lines)
        
        contributions = sorted(
            result.uncertainty_contributions.items(),
            key=lambda x: x[1],
            reverse=True,
        )
        
        max_pct = max(pct for _, pct in contributions) if contributions else 100
        
        lines.append(f"  公式: {result.formula.expression}")
        lines.append(f"  结果: {result.result_value:.4f} ± {result.result_uncertainty:.4f} {result.result_unit}")
        lines.append(f"  相对不确定度: {result.relative_uncertainty * 100:.2f}%")
        lines.append("")
        lines.append("  不确定度来源贡献:")
        lines.append("")
        
        for var, pct in contributions:
            bar_len = int(pct / max_pct * (width - 20))
            bar = "█" * bar_len + "░" * (width - 20 - bar_len)
            
            var_info = next((v for v in result.variables if v.symbol == var), None)
            var_name = var_info.name if var_info else var
            
            lines.append(f"    {var_name:<12} [{bar}] {pct:6.2f}%")
        
        lines.append("")
        lines.append(f"  主要贡献来源: {result.dominant_contribution}")
        lines.append("")
        
        return "\n".join(lines)
    
    def generate_propagation_flow_chart(
        self,
        result: PropagationResult,
    ) -> str:
        """生成误差传播流程图（文本模式）"""
        lines = []
        lines.append("=" * 70)
        lines.append(f"🔄 误差传播流程 - {result.formula.name}")
        lines.append("=" * 70)
        lines.append("")
        
        lines.append("  输入变量 (测量值 ± 不确定度):")
        lines.append("")
        for var in result.variables:
            pd = result.partial_derivatives.get(var.symbol, 0)
            lines.append(f"    {var.symbol} = {var.value} ± {var.uncertainty} {var.unit}")
            lines.append(f"      ↓ 偏导数 ∂f/∂{var.symbol} = {pd:.4f}")
            lines.append(f"      ↓ 贡献项 = ({pd:.4f} × {var.uncertainty})² = {(pd * var.uncertainty) ** 2:.6f}")
            lines.append("")
        
        lines.append("  ↓↓↓ 方差合成")
        lines.append("")
        lines.append(f"  合成方差 u_c² = Σ(贡献项) = {result.result_uncertainty ** 2:.6f}")
        lines.append(f"  合成不确定度 u_c = √u_c² = {result.result_uncertainty:.6f}")
        lines.append("")
        lines.append(f"  最终结果: f = {result.result_value:.4f} ± {result.result_uncertainty:.4f} {result.result_unit}")
        lines.append("")
        
        return "\n".join(lines)
    
    def generate_samples_quality_chart(
        self,
        variables: List[MeasurementVariable],
        width: int = 50,
    ) -> str:
        """生成样本质量分布图"""
        lines = []
        lines.append("=" * 70)
        lines.append("📈 样本质量分析")
        lines.append("=" * 70)
        lines.append("")
        
        normal = [v for v in variables if not v.is_boundary and not v.is_duplicate]
        boundary = [v for v in variables if v.is_boundary]
        duplicate = [v for v in variables if v.is_duplicate]
        
        total = len(variables)
        normal_pct = len(normal) / total * 100 if total > 0 else 0
        boundary_pct = len(boundary) / total * 100 if total > 0 else 0
        duplicate_pct = len(duplicate) / total * 100 if total > 0 else 0
        
        lines.append("  样本质量分布:")
        lines.append("")
        
        normal_bar = "█" * int(normal_pct / 2)
        boundary_bar = "▓" * int(boundary_pct / 2)
        duplicate_bar = "▒" * int(duplicate_pct / 2)
        
        lines.append(f"    ✅ 正常   [{normal_bar:<50}] {normal_pct:5.1f}% ({len(normal)}/{total})")
        lines.append(f"    ⚠️ 边界   [{boundary_bar:<50}] {boundary_pct:5.1f}% ({len(boundary)}/{total})")
        lines.append(f"    🔄 重复   [{duplicate_bar:<50}] {duplicate_pct:5.1f}% ({len(duplicate)}/{total})")
        lines.append("")
        
        lines.append("  各样本相对不确定度:")
        lines.append("")
        
        max_ru = max(v.relative_uncertainty for v in variables if v.relative_uncertainty != float('inf'))
        max_ru_display = min(max_ru * 100, 100) if max_ru != float('inf') else 100
        
        for var in sorted(variables, key=lambda x: -x.relative_uncertainty):
            ru = var.relative_uncertainty * 100
            if ru == float('inf'):
                ru_display = 100
                ru_str = "∞%"
            else:
                ru_display = min(ru, 100)
                ru_str = f"{ru:.1f}%"
            
            bar_len = int(ru_display / max_ru_display * (width - 20))
            bar = "█" * bar_len + "░" * (width - 20 - bar_len)
            
            status = ""
            if var.is_boundary:
                status = " ⚠️边界"
            elif var.is_duplicate:
                status = " 🔄重复"
            
            threshold_mark = ""
            if ru > 50:
                threshold_mark = " ← 超过50%阈值!"
            
            lines.append(f"    {var.name:<12} [{bar}] {ru_str:>7}{status}{threshold_mark}")
        
        lines.append("")
        lines.append("  图例:")
        lines.append("    ✅ 正常样本 | ⚠️ 边界样本(相对不确定度>50%) | 🔄 重复样本")
        lines.append("")
        
        return "\n".join(lines)
    
    def generate_data_traceability_chart(
        self,
        variables: List[MeasurementVariable],
    ) -> str:
        """生成数据可追溯性图表"""
        lines = []
        lines.append("=" * 70)
        lines.append("🔗 数据溯源图")
        lines.append("=" * 70)
        lines.append("")
        
        for i, var in enumerate(variables, 1):
            status_icon = "✅" if var.evidence_status.value == "confirmed" else "⏳" if var.evidence_status.value == "pending" else "❓"
            
            lines.append(f"  [{i}] {status_icon} {var.name} ({var.symbol})")
            lines.append(f"      │")
            lines.append(f"      ├─ 数值: {var.value} ± {var.uncertainty} {var.unit}")
            lines.append(f"      ├─ 测量方法: {var.description or '未说明'}")
            lines.append(f"      ├─ 证据来源: {var.evidence_source or '未指定'}")
            if var.evidence_notes:
                lines.append(f"      ├─ 备注: {var.evidence_notes}")
            lines.append(f"      ├─ 相对不确定度: {var.relative_uncertainty * 100:.2f}%")
            lines.append(f"      ├─ 证据状态: {var.evidence_status.value}")
            lines.append(f"      └─ 样本ID: {var.sample_id}")
            lines.append("")
        
        return "\n".join(lines)
    
    def save_all_charts(
        self,
        variables: List[MeasurementVariable],
        results: List[PropagationResult],
    ) -> List[str]:
        """保存所有图表到文件"""
        saved_files = []
        
        quality_chart = self.generate_samples_quality_chart(variables)
        quality_path = os.path.join(
            self.output_dir,
            f"样本质量图_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        )
        with open(quality_path, "w", encoding="utf-8") as f:
            f.write(quality_chart)
        saved_files.append(quality_path)
        
        trace_chart = self.generate_data_traceability_chart(variables)
        trace_path = os.path.join(
            self.output_dir,
            f"数据溯源图_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        )
        with open(trace_path, "w", encoding="utf-8") as f:
            f.write(trace_chart)
        saved_files.append(trace_path)
        
        for result in results:
            budget_chart = self.generate_uncertainty_budget_chart(result)
            budget_path = os.path.join(
                self.output_dir,
                f"不确定度贡献_{result.formula.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            )
            with open(budget_path, "w", encoding="utf-8") as f:
                f.write(budget_chart)
            saved_files.append(budget_path)
            
            flow_chart = self.generate_propagation_flow_chart(result)
            flow_path = os.path.join(
                self.output_dir,
                f"误差传播流程_{result.formula.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            )
            with open(flow_path, "w", encoding="utf-8") as f:
                f.write(flow_chart)
            saved_files.append(flow_path)
        
        return saved_files
