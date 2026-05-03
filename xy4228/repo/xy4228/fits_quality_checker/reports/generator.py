"""报告生成器。

负责生成Markdown、CSV和JSON格式的审计报告。
"""

import os
import json
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple
from pathlib import Path
from collections import defaultdict

import pandas as pd

from fits_quality_checker.models.models import (
    QualityResult,
    AnalysisResult,
    ObservationConfig,
    FileStatus,
    FileType,
)
from fits_quality_checker.storage.persistence import DataStore


class ReportGenerator:
    """报告生成器。

    功能：
    1. 生成Markdown格式的可读报告
    2. 生成CSV格式的表格报告
    3. 生成JSON格式的结构化报告
    4. 生成完整的审计包（包含所有格式）
    """

    def __init__(self, output_dir: Optional[str] = None):
        """初始化报告生成器。

        Args:
            output_dir: 输出目录，如果为None则使用当前目录下的reports目录
        """
        if output_dir is None:
            output_dir = Path.cwd() / "reports"
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_markdown(
        self,
        analysis_result: AnalysisResult,
        config: Optional[ObservationConfig] = None,
        output_filename: Optional[str] = None,
    ) -> Path:
        """生成Markdown格式报告。

        Args:
            analysis_result: 分析结果
            config: 观测配置
            output_filename: 输出文件名

        Returns:
            输出文件路径
        """
        if output_filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_filename = f"quality_report_{timestamp}.md"

        output_path = self.output_dir / output_filename

        # 构建Markdown内容
        content = []

        # 标题
        content.append("# FITS 成像质检报告")
        content.append("")
        content.append(f"**配置名称**: {analysis_result.config_name}")
        content.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        content.append("")

        # 汇总统计
        content.append("## 汇总统计")
        content.append("")
        content.append("| 指标 | 数值 |")
        content.append("|------|------|")
        content.append(f"| 总文件数 | {analysis_result.total_files} |")
        content.append(f"| 光场文件 | {analysis_result.light_files} |")
        content.append(f"| 暗场文件 | {analysis_result.dark_files} |")
        content.append(f"| 平场文件 | {analysis_result.flat_files} |")
        content.append(f"| **保留 (KEEP)** | {analysis_result.keep_count} |")
        content.append(f"| **隔离 (ISOLATE)** | {analysis_result.isolate_count} |")
        content.append(f"| **重拍 (RETRY)** | {analysis_result.retry_count} |")
        content.append("")

        # 详细统计
        if analysis_result.summary:
            content.append("## 质量指标统计")
            content.append("")
            for key, value in analysis_result.summary.items():
                if isinstance(value, (int, float)):
                    content.append(f"- **{key}**: {value:.4f}" if isinstance(value, float) else f"- **{key}**: {value}")
            content.append("")

        # 按状态分组
        content.append("## 按状态分类详情")
        content.append("")

        # 保留文件
        keep_files = [r for r in analysis_result.results if r.status == FileStatus.KEEP]
        if keep_files:
            content.append("### 保留文件 (KEEP)")
            content.append("")
            content.append("| 文件名 | 类型 | 评分 | FWHM | 圆度 | 噪声 |")
            content.append("|--------|------|------|------|------|------|")
            for r in keep_files[:20]:  # 限制显示数量
                fwhm_str = f"{r.metrics.fwhm:.2f}" if r.metrics and r.metrics.fwhm else "-"
                roundness_str = f"{r.metrics.roundness:.3f}" if r.metrics and r.metrics.roundness else "-"
                noise_str = f"{r.metrics.background_noise:.2f}" if r.metrics and r.metrics.background_noise else "-"
                content.append(
                    f"| {r.file_name} | {r.file_type.value} | {r.overall_score:.1f} | "
                    f"{fwhm_str} | {roundness_str} | {noise_str} |"
                )
            if len(keep_files) > 20:
                content.append(f"| ... | ... | ... | ... | ... | ... |")
                content.append(f"| *还有 {len(keep_files) - 20} 个文件* | | | | | |")
            content.append("")

        # 隔离文件
        isolate_files = [r for r in analysis_result.results if r.status == FileStatus.ISOLATE]
        if isolate_files:
            content.append("### 隔离文件 (ISOLATE)")
            content.append("")
            content.append("| 文件名 | 类型 | 评分 | 问题 |")
            content.append("|--------|------|------|------|")
            for r in isolate_files:
                issues = "; ".join(r.issues) if r.issues else "无明确问题"
                content.append(
                    f"| {r.file_name} | {r.file_type.value} | {r.overall_score:.1f} | {issues[:50]}... |"
                    if len(issues) > 50
                    else f"| {r.file_name} | {r.file_type.value} | {r.overall_score:.1f} | {issues} |"
                )
            content.append("")

        # 重拍文件
        retry_files = [r for r in analysis_result.results if r.status == FileStatus.RETRY]
        if retry_files:
            content.append("### 重拍文件 (RETRY)")
            content.append("")
            content.append("| 文件名 | 类型 | 评分 | 问题 |")
            content.append("|--------|------|------|------|")
            for r in retry_files:
                issues = "; ".join(r.issues) if r.issues else "无明确问题"
                content.append(
                    f"| {r.file_name} | {r.file_type.value} | {r.overall_score:.1f} | {issues[:50]}... |"
                    if len(issues) > 50
                    else f"| {r.file_name} | {r.file_type.value} | {r.overall_score:.1f} | {issues} |"
                )
            content.append("")

        # 问题统计
        content.append("## 问题统计")
        content.append("")
        issue_counts = defaultdict(int)
        for r in analysis_result.results:
            for issue in r.issues:
                # 提取问题类型
                if "云" in issue or "透明度" in issue or "噪声" in issue:
                    issue_counts["云/透明度问题"] += 1
                elif "拖线" in issue or "圆度" in issue or "FWHM" in issue:
                    issue_counts["星点拖线/导星问题"] += 1
                elif "温度" in issue:
                    issue_counts["温度不匹配"] += 1
                elif "曝光" in issue:
                    issue_counts["曝光时间不匹配"] += 1
                elif "滤镜" in issue:
                    issue_counts["滤镜不匹配"] += 1
                else:
                    issue_counts["其他问题"] += 1

        if issue_counts:
            content.append("| 问题类型 | 数量 |")
            content.append("|----------|------|")
            for issue_type, count in sorted(issue_counts.items(), key=lambda x: -x[1]):
                content.append(f"| {issue_type} | {count} |")
            content.append("")

        # 建议汇总
        content.append("## 建议汇总")
        content.append("")

        # 按状态给出建议
        if retry_files:
            content.append("### 重拍建议")
            content.append("")
            content.append("以下文件质量较差，建议重拍：")
            content.append("")
            for r in retry_files:
                content.append(f"- **{r.file_name}**:")
                for rec in r.recommendations:
                    content.append(f"  - {rec}")
            content.append("")

        if isolate_files:
            content.append("### 隔离建议")
            content.append("")
            content.append("以下文件存在质量问题，建议隔离并人工检查：")
            content.append("")
            for r in isolate_files:
                content.append(f"- **{r.file_name}**:")
                for rec in r.recommendations:
                    content.append(f"  - {rec}")
            content.append("")

        # 配置信息
        if config:
            content.append("## 观测配置")
            content.append("")
            content.append("| 参数 | 值 |")
            content.append("|------|-----|")
            if config.observer:
                content.append(f"| 观测者 | {config.observer} |")
            if config.telescope:
                content.append(f"| 望远镜 | {config.telescope} |")
            if config.camera:
                content.append(f"| 相机 | {config.camera} |")
            if config.focal_length:
                content.append(f"| 焦距 | {config.focal_length} mm |")
            if config.aperture:
                content.append(f"| 光圈 | {config.aperture} mm |")
            if config.pixel_size:
                content.append(f"| 像素大小 | {config.pixel_size} um |")
            if config.target_name:
                content.append(f"| 目标 | {config.target_name} |")
            if config.expected_temperature is not None:
                content.append(f"| 期望温度 | {config.expected_temperature}°C |")
            content.append(f"| 温度容差 | {config.temperature_tolerance}°C |")
            content.append(f"| FWHM阈值 | {config.fwhm_threshold} 像素 |")
            content.append(f"| 圆度阈值 | {config.roundness_threshold} |")
            content.append(f"| 噪声阈值 | {config.noise_threshold} ADU |")
            content.append("")

            if config.expected_exposures:
                content.append("### 期望曝光次数")
                content.append("")
                content.append("| 滤镜 | 期望次数 |")
                content.append("|------|----------|")
                for flt, count in config.expected_exposures.items():
                    content.append(f"| {flt} | {count} |")
                content.append("")

        # 页脚
        content.append("---")
        content.append("")
        content.append("*报告由 FITS 成像质检台自动生成*")

        # 写入文件
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(content))

        return output_path

    def generate_csv(
        self,
        analysis_result: AnalysisResult,
        output_filename: Optional[str] = None,
    ) -> Path:
        """生成CSV格式报告。

        Args:
            analysis_result: 分析结果
            output_filename: 输出文件名

        Returns:
            输出文件路径
        """
        if output_filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_filename = f"quality_report_{timestamp}.csv"

        output_path = self.output_dir / output_filename

        # 构建数据行
        rows = []
        for result in analysis_result.results:
            row = {
                "文件名": result.file_name,
                "文件路径": result.file_path,
                "文件类型": result.file_type.value if hasattr(result.file_type, "value") else str(result.file_type),
                "质量状态": result.status.value if hasattr(result.status, "value") else str(result.status),
                "综合评分": result.overall_score,
            }

            # 添加指标
            if result.metrics:
                row["FWHM(像素)"] = result.metrics.fwhm
                row["FWHM(角秒)"] = result.metrics.fwhm_arcsec
                row["圆度"] = result.metrics.roundness
                row["背景噪声(ADU)"] = result.metrics.background_noise
                row["星点数量"] = result.metrics.star_count
                row["温度偏差(°C)"] = result.metrics.temperature_deviation

            # 添加元数据
            if result.metadata:
                row["曝光时间(秒)"] = result.metadata.exposure_time
                row["滤镜"] = result.metadata.filter_name
                row["温度(°C)"] = result.metadata.temperature
                row["增益"] = result.metadata.gain
                row["目标"] = result.metadata.object_name
                if result.metadata.observation_time:
                    row["观测时间"] = result.metadata.observation_time.isoformat()

            # 添加问题和建议
            row["问题数量"] = len(result.issues)
            row["问题"] = "; ".join(result.issues) if result.issues else ""
            row["建议数量"] = len(result.recommendations)
            row["建议"] = "; ".join(result.recommendations) if result.recommendations else ""

            rows.append(row)

        # 创建DataFrame并保存
        df = pd.DataFrame(rows)
        df.to_csv(output_path, index=False, encoding="utf-8-sig")

        return output_path

    def generate_json(
        self,
        analysis_result: AnalysisResult,
        config: Optional[ObservationConfig] = None,
        output_filename: Optional[str] = None,
    ) -> Path:
        """生成JSON格式报告。

        Args:
            analysis_result: 分析结果
            config: 观测配置
            output_filename: 输出文件名

        Returns:
            输出文件路径
        """
        if output_filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_filename = f"quality_report_{timestamp}.json"

        output_path = self.output_dir / output_filename

        # 构建完整的JSON数据
        report_data = {
            "report_info": {
                "generated_at": datetime.now().isoformat(),
                "config_name": analysis_result.config_name,
            },
            "summary": {
                "total_files": analysis_result.total_files,
                "light_files": analysis_result.light_files,
                "dark_files": analysis_result.dark_files,
                "flat_files": analysis_result.flat_files,
                "keep_count": analysis_result.keep_count,
                "isolate_count": analysis_result.isolate_count,
                "retry_count": analysis_result.retry_count,
                "unknown_count": analysis_result.unknown_count,
                "stats": analysis_result.summary,
            },
            "results": [],
        }

        # 添加配置信息
        if config:
            report_data["config"] = {
                "config_name": config.config_name,
                "observer": config.observer,
                "telescope": config.telescope,
                "camera": config.camera,
                "focal_length": config.focal_length,
                "aperture": config.aperture,
                "pixel_size": config.pixel_size,
                "target_name": config.target_name,
                "target_ra": config.target_ra,
                "target_dec": config.target_dec,
                "expected_exposures": config.expected_exposures,
                "expected_temperature": config.expected_temperature,
                "temperature_tolerance": config.temperature_tolerance,
                "fwhm_threshold": config.fwhm_threshold,
                "roundness_threshold": config.roundness_threshold,
                "noise_threshold": config.noise_threshold,
            }

        # 添加结果详情
        for result in analysis_result.results:
            result_dict = {
                "file_name": result.file_name,
                "file_path": result.file_path,
                "file_type": result.file_type.value if hasattr(result.file_type, "value") else str(result.file_type),
                "status": result.status.value if hasattr(result.status, "value") else str(result.status),
                "overall_score": result.overall_score,
                "issues": result.issues,
                "recommendations": result.recommendations,
                "evaluated_at": result.evaluated_at.isoformat() if result.evaluated_at else None,
            }

            # 添加指标
            if result.metrics:
                result_dict["metrics"] = {
                    "fwhm": result.metrics.fwhm,
                    "fwhm_arcsec": result.metrics.fwhm_arcsec,
                    "roundness": result.metrics.roundness,
                    "background_noise": result.metrics.background_noise,
                    "star_count": result.metrics.star_count,
                    "median_flux": result.metrics.median_flux,
                    "temperature_deviation": result.metrics.temperature_deviation,
                }

            # 添加元数据
            if result.metadata:
                result_dict["metadata"] = {
                    "exposure_time": result.metadata.exposure_time,
                    "filter_name": result.metadata.filter_name,
                    "temperature": result.metadata.temperature,
                    "gain": result.metadata.gain,
                    "offset": result.metadata.offset,
                    "ra": result.metadata.ra,
                    "dec": result.metadata.dec,
                    "airmass": result.metadata.airmass,
                    "object_name": result.metadata.object_name,
                    "observation_time": (
                        result.metadata.observation_time.isoformat()
                        if result.metadata.observation_time
                        else None
                    ),
                }

            # 添加规则结果
            if result.rule_results:
                result_dict["rule_results"] = [
                    {
                        "rule_name": rr.rule_name,
                        "rule_type": rr.rule_type,
                        "passed": rr.passed,
                        "message": rr.message,
                        "severity": rr.severity,
                        "details": rr.details,
                    }
                    for rr in result.rule_results
                ]

            report_data["results"].append(result_dict)

        # 写入文件
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False, default=str)

        return output_path

    def generate_audit_package(
        self,
        analysis_result: AnalysisResult,
        config: Optional[ObservationConfig] = None,
        base_name: Optional[str] = None,
    ) -> Dict[str, Path]:
        """生成完整的审计包（包含所有格式）。

        Args:
            analysis_result: 分析结果
            config: 观测配置
            base_name: 基础文件名

        Returns:
            各格式文件路径的字典
        """
        if base_name is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            base_name = f"quality_audit_{timestamp}"

        paths = {}

        # 生成Markdown
        paths["markdown"] = self.generate_markdown(
            analysis_result, config, f"{base_name}.md"
        )

        # 生成CSV
        paths["csv"] = self.generate_csv(analysis_result, f"{base_name}.csv")

        # 生成JSON
        paths["json"] = self.generate_json(
            analysis_result, config, f"{base_name}.json"
        )

        return paths

    def generate_summary_text(
        self,
        analysis_result: AnalysisResult,
    ) -> str:
        """生成简要文本摘要。

        Args:
            analysis_result: 分析结果

        Returns:
            摘要文本
        """
        lines = []
        lines.append("=" * 60)
        lines.append("FITS 成像质检报告摘要")
        lines.append("=" * 60)
        lines.append("")
        lines.append(f"配置名称: {analysis_result.config_name}")
        lines.append(f"总文件数: {analysis_result.total_files}")
        lines.append("")
        lines.append("文件类型分布:")
        lines.append(f"  光场 (LIGHT): {analysis_result.light_files}")
        lines.append(f"  暗场 (DARK):  {analysis_result.dark_files}")
        lines.append(f"  平场 (FLAT):   {analysis_result.flat_files}")
        lines.append("")
        lines.append("质量状态分布:")
        lines.append(f"  保留 (KEEP):    {analysis_result.keep_count}")
        lines.append(f"  隔离 (ISOLATE): {analysis_result.isolate_count}")
        lines.append(f"  重拍 (RETRY):   {analysis_result.retry_count}")
        lines.append("")

        # 计算通过率
        total = analysis_result.total_files
        if total > 0:
            keep_rate = (analysis_result.keep_count / total) * 100
            lines.append(f"通过率 (KEEP): {keep_rate:.1f}%")
            lines.append("")

        # 显示有问题的文件
        if analysis_result.isolate_count > 0 or analysis_result.retry_count > 0:
            lines.append("有问题的文件:")
            lines.append("-" * 60)

            if analysis_result.retry_count > 0:
                lines.append(f"[RETRY] 建议重拍 ({analysis_result.retry_count} 个):")
                retry_files = [r for r in analysis_result.results if r.status == FileStatus.RETRY]
                for r in retry_files[:5]:
                    issues = "; ".join(r.issues) if r.issues else "质量问题"
                    lines.append(f"  - {r.file_name}: {issues}")
                if len(retry_files) > 5:
                    lines.append(f"  ... 还有 {len(retry_files) - 5} 个")

            if analysis_result.isolate_count > 0:
                lines.append(f"[ISOLATE] 建议隔离 ({analysis_result.isolate_count} 个):")
                isolate_files = [r for r in analysis_result.results if r.status == FileStatus.ISOLATE]
                for r in isolate_files[:5]:
                    issues = "; ".join(r.issues) if r.issues else "质量问题"
                    lines.append(f"  - {r.file_name}: {issues}")
                if len(isolate_files) > 5:
                    lines.append(f"  ... 还有 {len(isolate_files) - 5} 个")

        lines.append("")
        lines.append("=" * 60)

        return "\n".join(lines)
