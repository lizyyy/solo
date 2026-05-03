"""报告导出模块 - Markdown、CSV、JSON格式"""

import csv
import json
import os
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path

from .models import (
    ExperimentConfig,
    DataQuality,
)


def generate_markdown_report(
    config: ExperimentConfig,
    fitted_data: Optional[Dict[str, Any]] = None,
    buffer_data: Optional[Dict[str, Any]] = None,
) -> str:
    """
    生成Markdown格式的实验报告
    
    Args:
        config: 实验配置
        fitted_data: 拟合结果数据
        buffer_data: 缓冲液配方数据
    
    Returns:
        Markdown格式字符串
    """
    lines = []
    
    lines.append("# 酸碱滴定实验报告")
    lines.append("")
    lines.append(f"> 报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"> 实验名称: {config.experiment_name}")
    if config.analyst:
        lines.append(f"> 分析人员: {config.analyst}")
    lines.append("")
    
    lines.append("## 1. 实验配置")
    lines.append("")
    lines.append("### 1.1 分析参数")
    lines.append("")
    lines.append("| 参数 | 值 |")
    lines.append("|------|-----|")
    lines.append(f"| 平滑窗口大小 | {config.analysis_params.smoothing_window} |")
    lines.append(f"| 平滑多项式阶数 | {config.analysis_params.smoothing_polyorder} |")
    lines.append(f"| 等当点检测方法 | {config.analysis_params.equivalence_point_method} |")
    lines.append(f"| 导数检测阈值 | {config.analysis_params.derivative_threshold} |")
    lines.append(f"| 离群点检测方法 | {config.analysis_params.outlier_method} |")
    lines.append(f"| IQR因子 | {config.analysis_params.outlier_iqr_factor} |")
    lines.append(f"| 空白校正 | {'启用' if config.analysis_params.blank_correction_enabled else '禁用'} |")
    lines.append("")
    
    lines.append("### 1.2 可用缓冲体系")
    lines.append("")
    for name, system in config.buffer_systems.items():
        lines.append(f"#### {name}: {system.name}")
        lines.append(f"- 有效pH范围: {system.effective_ph_range[0]} - {system.effective_ph_range[1]}")
        lines.append(f"- 描述: {system.description}")
        lines.append(f"- 酸组分: {system.acid.name} ({system.acid.formula}, {system.acid.concentration} {system.acid.concentration_unit})")
        lines.append(f"- 碱组分: {system.base.name} ({system.base.formula}, {system.base.concentration} {system.base.concentration_unit})")
        lines.append("")
    
    if fitted_data:
        lines.append("## 2. 滴定分析结果")
        lines.append("")
        
        results = fitted_data.get('results', [])
        params = fitted_data.get('parameters', {})
        
        lines.append(f"### 2.1 分析概况")
        lines.append("")
        lines.append(f"- 分析样品数: {len(results)}")
        lines.append(f"- 拟合时间: {fitted_data.get('fit_time', 'N/A')}")
        if params.get('blank_sample'):
            lines.append(f"- 空白样品: {params.get('blank_sample')}")
            lines.append(f"- 空白校正: {'已应用' if params.get('blank_correction_enabled') else '未应用'}")
        lines.append("")
        
        lines.append("### 2.2 详细结果")
        lines.append("")
        
        for i, result in enumerate(results, 1):
            sample_id = result.get('sample_id', f'Unknown_{i}')
            quality = result.get('quality', 'unknown')
            outlier_count = result.get('outlier_count', 0)
            
            quality_emoji = "✅" if quality == "good" else "⚠️" if quality == "suspect" else "❌"
            
            lines.append(f"#### {i}. 样品: {sample_id} {quality_emoji}")
            lines.append("")
            lines.append(f"- 数据质量: {quality}")
            lines.append(f"- 离群点数量: {outlier_count}")
            
            primary_ep = result.get('primary_equivalence')
            if primary_ep:
                lines.append(f"- **主要等当点**:")
                lines.append(f"  - 体积: {primary_ep.get('volume', 0):.4f} mL")
                lines.append(f"  - pH: {primary_ep.get('ph', 0):.2f}")
                lines.append(f"  - 检测方法: {primary_ep.get('method', 'N/A')}")
                lines.append(f"  - 置信度: {primary_ep.get('confidence', 0):.1%}")
            
            all_eps = result.get('equivalence_points', [])
            if len(all_eps) > 1:
                lines.append(f"- **其他等当点** ({len(all_eps) - 1}个):")
                for j, ep in enumerate(all_eps):
                    if ep == primary_ep:
                        continue
                    lines.append(f"  - 体积: {ep.get('volume', 0):.4f} mL, pH: {ep.get('ph', 0):.2f}")
            
            warnings = result.get('warnings', [])
            if warnings:
                lines.append(f"- **警告**:")
                for warning in warnings:
                    lines.append(f"  - ⚠️  {warning}")
            
            stats = result.get('statistics', {})
            if stats:
                lines.append(f"- **统计信息**:")
                lines.append(f"  - 总数据点: {stats.get('total_points', 'N/A')}")
                lines.append(f"  - 有效数据点: {stats.get('valid_points', 'N/A')}")
                if stats.get('ph_mean') is not None:
                    lines.append(f"  - pH均值: {stats.get('ph_mean', 0):.3f} ± {stats.get('ph_std', 0):.3f}")
                lines.append(f"  - pH范围: {stats.get('ph_min', 0):.2f} - {stats.get('ph_max', 0):.2f}")
            
            lines.append("")
        
        if len(results) > 1:
            lines.append("### 2.3 汇总统计")
            lines.append("")
            
            ep_volumes = []
            for result in results:
                ep = result.get('primary_equivalence')
                if ep:
                    ep_volumes.append(ep.get('volume', 0))
            
            if ep_volumes:
                import numpy as np
                lines.append(f"- 等当点体积统计:")
                lines.append(f"  - 均值: {np.mean(ep_volumes):.4f} mL")
                lines.append(f"  - 标准差: {np.std(ep_volumes):.4f} mL")
                lines.append(f"  - 中位数: {np.median(ep_volumes):.4f} mL")
                lines.append(f"  - 范围: {min(ep_volumes):.4f} - {max(ep_volumes):.4f} mL")
                lines.append(f"  - RSD: {(np.std(ep_volumes) / np.mean(ep_volumes) * 100) if np.mean(ep_volumes) > 0 else 0:.2f}%")
            lines.append("")
    
    if buffer_data:
        lines.append("## 3. 缓冲液配方")
        lines.append("")
        
        recipe = buffer_data.get('recipe', {})
        system_info = buffer_data.get('system_info', {})
        
        lines.append("### 3.1 配方概况")
        lines.append("")
        lines.append(f"- 目标pH: {buffer_data.get('target_ph', 'N/A')}")
        lines.append(f"- 目标体积: {buffer_data.get('target_volume', 'N/A')} mL")
        lines.append(f"- 温度: {buffer_data.get('temperature', 'N/A')}°C")
        lines.append(f"- 缓冲体系: {buffer_data.get('system_name', 'N/A')}")
        lines.append(f"- 计算时间: {buffer_data.get('calculation_time', 'N/A')}")
        lines.append("")
        
        lines.append("### 3.2 详细配方")
        lines.append("")
        lines.append("| 组分 | 体积 (mL) | 质量 (g) |")
        lines.append("|------|-----------|----------|")
        
        acid_vol = recipe.get('acid_volume', 0)
        acid_mass = recipe.get('acid_mass')
        base_vol = recipe.get('base_volume', 0)
        base_mass = recipe.get('base_mass')
        
        acid_name = system_info.get('acid', {}).get('name', '酸')
        base_name = system_info.get('base', {}).get('name', '碱')
        
        acid_mass_str = f"{acid_mass:.4f}" if acid_mass else "N/A"
        base_mass_str = f"{base_mass:.4f}" if base_mass else "N/A"
        
        lines.append(f"| {acid_name} | {acid_vol:.2f} | {acid_mass_str} |")
        lines.append(f"| {base_name} | {base_vol:.2f} | {base_mass_str} |")
        lines.append(f"| **去离子水** | 定容至 {buffer_data.get('target_volume', 0):.1f} | - |")
        lines.append("")
        
        lines.append("### 3.3 理论参数")
        lines.append("")
        lines.append(f"- 理论pH: {recipe.get('theoretical_ph', 0):.3f}")
        lines.append(f"- pH偏差: {recipe.get('ph_deviation', 0):.4f}")
        lines.append(f"- 缓冲容量: {recipe.get('buffer_capacity', 0):.6f} mol/(L·pH)")
        lines.append("")
        
        warnings = recipe.get('warnings', [])
        if warnings:
            lines.append("### 3.4 注意事项")
            lines.append("")
            for warning in warnings:
                lines.append(f"- ⚠️  {warning}")
            lines.append("")
        
        instructions = buffer_data.get('instructions', [])
        if instructions:
            lines.append("### 3.5 操作步骤")
            lines.append("")
            for i, instruction in enumerate(instructions, 1):
                lines.append(f"{i}. {instruction}")
            lines.append("")
    
    lines.append("## 4. 质量评估")
    lines.append("")
    
    all_warnings = []
    quality_status = "PASS"
    
    if fitted_data:
        for result in fitted_data.get('results', []):
            warnings = result.get('warnings', [])
            quality = result.get('quality', 'good')
            if quality != 'good':
                quality_status = "WARNING"
            all_warnings.extend([(result.get('sample_id'), w) for w in warnings])
    
    if buffer_data:
        warnings = buffer_data.get('recipe', {}).get('warnings', [])
        if warnings:
            quality_status = "WARNING"
            all_warnings.extend([('Buffer', w) for w in warnings])
    
    lines.append(f"- **总体质量状态**: {quality_status}")
    lines.append("")
    
    if all_warnings:
        lines.append("### 4.1 问题汇总")
        lines.append("")
        for sample_id, warning in all_warnings:
            lines.append(f"- [{sample_id}] {warning}")
        lines.append("")
    
    lines.append("---")
    lines.append("")
    lines.append(f"*本报告由 titration-tool 自动生成*")
    lines.append(f"*工具版本: 0.1.0*")
    
    return "\n".join(lines)


def generate_csv_summary(
    fitted_data: Optional[Dict[str, Any]] = None,
    buffer_data: Optional[Dict[str, Any]] = None,
) -> List[List[str]]:
    """
    生成CSV格式的结果汇总表
    
    Args:
        fitted_data: 拟合结果数据
        buffer_data: 缓冲液配方数据
    
    Returns:
        CSV行列表（每行是字段列表）
    """
    rows = []
    
    if fitted_data:
        rows.append(["=== 滴定分析结果 ==="])
        rows.append(["样品编号", "数据质量", "等当点体积(mL)", "等当点pH", "离群点数量", "总数据点", "有效数据点", "pH均值", "pH标准差"])
        
        results = fitted_data.get('results', [])
        for result in results:
            sample_id = result.get('sample_id', 'Unknown')
            quality = result.get('quality', 'unknown')
            
            ep_vol = ""
            ep_ph = ""
            primary_ep = result.get('primary_equivalence')
            if primary_ep:
                ep_vol = f"{primary_ep.get('volume', 0):.4f}"
                ep_ph = f"{primary_ep.get('ph', 0):.2f}"
            
            outlier_count = str(result.get('outlier_count', 0))
            
            stats = result.get('statistics', {})
            total_points = str(stats.get('total_points', ''))
            valid_points = str(stats.get('valid_points', ''))
            ph_mean = f"{stats.get('ph_mean', 0):.3f}" if stats.get('ph_mean') is not None else ""
            ph_std = f"{stats.get('ph_std', 0):.3f}" if stats.get('ph_std') is not None else ""
            
            rows.append([sample_id, quality, ep_vol, ep_ph, outlier_count, total_points, valid_points, ph_mean, ph_std])
        
        rows.append([])
        
        if len(results) > 1:
            ep_volumes = []
            for result in results:
                ep = result.get('primary_equivalence')
                if ep:
                    ep_volumes.append(ep.get('volume', 0))
            
            if ep_volumes:
                import numpy as np
                rows.append(["=== 统计汇总 ==="])
                rows.append(["统计项", "等当点体积(mL)"])
                rows.append(["均值", f"{np.mean(ep_volumes):.4f}"])
                rows.append(["标准差", f"{np.std(ep_volumes):.4f}"])
                rows.append(["RSD (%)", f"{(np.std(ep_volumes) / np.mean(ep_volumes) * 100) if np.mean(ep_volumes) > 0 else 0:.2f}"])
                rows.append(["最小值", f"{min(ep_volumes):.4f}"])
                rows.append(["最大值", f"{max(ep_volumes):.4f}"])
                rows.append(["中位数", f"{np.median(ep_volumes):.4f}"])
                rows.append([])
    
    if buffer_data:
        rows.append(["=== 缓冲液配方 ==="])
        
        recipe = buffer_data.get('recipe', {})
        system_info = buffer_data.get('system_info', {})
        
        rows.append(["参数", "值"])
        rows.append(["目标pH", str(buffer_data.get('target_ph', ''))])
        rows.append(["目标体积(mL)", str(buffer_data.get('target_volume', ''))])
        rows.append(["温度(°C)", str(buffer_data.get('temperature', ''))])
        rows.append(["缓冲体系", buffer_data.get('system_name', '')])
        rows.append([])
        
        rows.append(["组分", "体积(mL)", "浓度(mol/L)"])
        acid_name = system_info.get('acid', {}).get('name', '酸')
        acid_conc = system_info.get('acid', {}).get('concentration', '')
        base_name = system_info.get('base', {}).get('name', '碱')
        base_conc = system_info.get('base', {}).get('concentration', '')
        
        rows.append([acid_name, f"{recipe.get('acid_volume', 0):.2f}", str(acid_conc)])
        rows.append([base_name, f"{recipe.get('base_volume', 0):.2f}", str(base_conc)])
        rows.append(["去离子水", f"定容至 {buffer_data.get('target_volume', 0):.1f}", "-"])
        rows.append([])
        
        rows.append(["=== 理论参数 ==="])
        rows.append(["参数", "值"])
        rows.append(["理论pH", f"{recipe.get('theoretical_ph', 0):.3f}"])
        rows.append(["pH偏差", f"{recipe.get('ph_deviation', 0):.4f}"])
        rows.append(["缓冲容量(mol/(L·pH))", f"{recipe.get('buffer_capacity', 0):.6f}"])
        
        warnings = recipe.get('warnings', [])
        if warnings:
            rows.append([])
            rows.append(["=== 注意事项 ==="])
            for warning in warnings:
                rows.append([warning])
    
    return rows


def generate_audit_trail(
    config: ExperimentConfig,
    fitted_data: Optional[Dict[str, Any]] = None,
    buffer_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    生成JSON格式的审计数据包
    
    Args:
        config: 实验配置
        fitted_data: 拟合结果数据
        buffer_data: 缓冲液配方数据
    
    Returns:
        审计数据字典
    """
    audit = {
        "audit_id": str(uuid.uuid4()),
        "generated_at": datetime.now().isoformat(),
        "tool_version": "0.1.0",
        "software": "titration-tool",
    }
    
    audit["experiment_config"] = {
        "experiment_name": config.experiment_name,
        "created_at": config.created_at.isoformat() if hasattr(config, 'created_at') else None,
        "analyst": config.analyst,
        "analysis_params": {
            "smoothing_window": config.analysis_params.smoothing_window,
            "smoothing_polyorder": config.analysis_params.smoothing_polyorder,
            "equivalence_point_method": config.analysis_params.equivalence_point_method,
            "derivative_threshold": config.analysis_params.derivative_threshold,
            "outlier_method": config.analysis_params.outlier_method,
            "outlier_iqr_factor": config.analysis_params.outlier_iqr_factor,
            "blank_correction_enabled": config.analysis_params.blank_correction_enabled,
        },
        "buffer_systems": [
            {
                "name": name,
                "display_name": system.name,
                "effective_ph_range": list(system.effective_ph_range),
                "description": system.description,
                "acid": {
                    "name": system.acid.name,
                    "formula": system.acid.formula,
                    "concentration": system.acid.concentration,
                    "pka": system.acid.pka,
                },
                "base": {
                    "name": system.base.name,
                    "formula": system.base.formula,
                    "concentration": system.base.concentration,
                    "pka": system.base.pka,
                },
            }
            for name, system in config.buffer_systems.items()
        ],
    }
    
    if fitted_data:
        audit["titration_analysis"] = fitted_data
    
    if buffer_data:
        audit["buffer_recipe"] = buffer_data
    
    quality_checks = {
        "total_samples": 0,
        "quality_good": 0,
        "quality_suspect": 0,
        "quality_bad": 0,
        "total_outliers": 0,
        "total_warnings": 0,
    }
    
    if fitted_data:
        for result in fitted_data.get('results', []):
            quality_checks["total_samples"] += 1
            quality = result.get('quality', 'good')
            if quality == 'good':
                quality_checks["quality_good"] += 1
            elif quality == 'suspect':
                quality_checks["quality_suspect"] += 1
            else:
                quality_checks["quality_bad"] += 1
            
            quality_checks["total_outliers"] += result.get('outlier_count', 0)
            quality_checks["total_warnings"] += len(result.get('warnings', []))
    
    if buffer_data:
        quality_checks["total_warnings"] += len(buffer_data.get('recipe', {}).get('warnings', []))
    
    audit["quality_assessment"] = {
        "checks": quality_checks,
        "overall_status": "PASS" if (quality_checks["quality_bad"] == 0 and quality_checks["total_warnings"] == 0) 
                      else "WARNING" if quality_checks["quality_bad"] == 0 
                      else "FAIL"
    }
    
    return audit


def generate_report(
    config: ExperimentConfig,
    fitted_data: Optional[Dict[str, Any]] = None,
    buffer_data: Optional[Dict[str, Any]] = None,
    output_dir: str = "./report",
    generate_plots: bool = False,
) -> Dict[str, str]:
    """
    生成完整的报告（Markdown + CSV + JSON）
    
    Args:
        config: 实验配置
        fitted_data: 拟合结果数据
        buffer_data: 缓冲液配方数据
        output_dir: 输出目录
        generate_plots: 是否生成图表（需要matplotlib）
    
    Returns:
        生成的文件路径字典
    """
    os.makedirs(output_dir, exist_ok=True)
    
    files = {}
    
    md_content = generate_markdown_report(config, fitted_data, buffer_data)
    md_path = os.path.join(output_dir, "experiment_report.md")
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(md_content)
    files["markdown_report"] = md_path
    
    csv_rows = generate_csv_summary(fitted_data, buffer_data)
    csv_path = os.path.join(output_dir, "results_summary.csv")
    with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerows(csv_rows)
    files["csv_summary"] = csv_path
    
    audit_data = generate_audit_trail(config, fitted_data, buffer_data)
    audit_path = os.path.join(output_dir, "audit_trail.json")
    with open(audit_path, 'w', encoding='utf-8') as f:
        json.dump(audit_data, f, ensure_ascii=False, indent=2)
    files["audit_trail"] = audit_path
    
    if generate_plots:
        try:
            plot_path = generate_titration_plots(fitted_data, output_dir)
            if plot_path:
                files["titration_plots"] = plot_path
        except Exception as e:
            print(f"警告: 无法生成图表: {e}")
    
    return files


def generate_titration_plots(
    fitted_data: Optional[Dict[str, Any]],
    output_dir: str,
) -> Optional[str]:
    """
    生成滴定曲线图（需要matplotlib）
    
    Args:
        fitted_data: 拟合结果数据
        output_dir: 输出目录
    
    Returns:
        图表文件路径（如果生成）
    """
    if not fitted_data:
        return None
    
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        import numpy as np
    except ImportError:
        print("警告: matplotlib未安装，无法生成图表")
        return None
    
    results = fitted_data.get('results', [])
    if not results:
        return None
    
    n_samples = len(results)
    fig, axes = plt.subplots(n_samples, 2, figsize=(12, 4 * n_samples))
    if n_samples == 1:
        axes = [axes]
    
    for i, (ax_row, result) in enumerate(zip(axes, results)):
        sample_id = result.get('sample_id', f'Sample_{i+1}')
        
        ax1, ax2 = ax_row
        
        original_points = result.get('smoothed_points', [])
        if original_points:
            volumes = [p.get('volume', 0) for p in original_points]
            ph_values = [p.get('ph', 0) for p in original_points]
            
            ax1.plot(volumes, ph_values, 'b-', label='滴定曲线', linewidth=1.5)
            
            primary_ep = result.get('primary_equivalence')
            if primary_ep:
                ax1.axvline(x=primary_ep.get('volume'), color='r', linestyle='--', 
                           label=f'等当点 (V={primary_ep.get("volume"):.2f}mL)')
                ax1.plot(primary_ep.get('volume'), primary_ep.get('ph'), 'ro', markersize=8)
            
            outliers = result.get('outliers', [])
            if outliers and len(original_points) > max(outliers, default=0):
                outlier_volumes = [original_points[idx].get('volume', 0) for idx in outliers if idx < len(original_points)]
                outlier_phs = [original_points[idx].get('ph', 0) for idx in outliers if idx < len(original_points)]
                ax1.scatter(outlier_volumes, outlier_phs, color='orange', s=50, zorder=5, label='离群点')
            
            ax1.set_xlabel('体积 (mL)')
            ax1.set_ylabel('pH')
            ax1.set_title(f'{sample_id} - 滴定曲线')
            ax1.legend()
            ax1.grid(True, alpha=0.3)
        
        if original_points and len(original_points) >= 3:
            volumes = np.array([p.get('volume', 0) for p in original_points])
            ph_values = np.array([p.get('ph', 0) for p in original_points])
            
            dy = np.gradient(ph_values, volumes)
            
            ax2.plot(volumes, dy, 'g-', label='一阶导数', linewidth=1.5)
            ax2.set_xlabel('体积 (mL)')
            ax2.set_ylabel('dpH/dV')
            ax2.set_title(f'{sample_id} - 一阶导数')
            ax2.legend()
            ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    plot_path = os.path.join(output_dir, "titration_curves.png")
    plt.savefig(plot_path, dpi=150, bbox_inches='tight')
    plt.close()
    
    return plot_path
