"""
导出模块
- Markdown报告导出
- CSV/JSON证据包导出
- 支持图表生成（可选）
"""

import os
import json
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import asdict
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

from .rule_fusion import TripRiskResult, FrameRiskResult, RiskLevel
from .model_inference import TripAnomalyResult, FrameAnomalyResult, AnomalyType
from .feature_engineering import TripFeatures


class Exporter:
    """导出器"""
    
    REPORT_TEMPLATE = """# 轴承振动早筛报告

## 基本信息

| 项目 | 内容 |
|------|------|
| 趟次ID | {trip_id} |
| 分析时间 | {analysis_time} |
| 报告生成时间 | {report_time} |

## 风险评估结果

### 整体风险等级

**{overall_risk}**

整体风险评分: {overall_score:.2f}

检测置信度: {confidence:.1%}

### 风险分布

| 风险等级 | 帧数 | 比例 |
|----------|------|------|
{risk_distribution_table}

## 主要问题

{primary_concern}

## 证据摘要

{evidence_summary}

## 建议

{recommendations}

## 详细异常帧分析

### 高风险帧详情

{high_risk_frames_detail}

### 所有帧风险分布

{all_frames_summary}

## 附录

### 数据校验信息

{validation_info}

### 特征统计摘要

{feature_stats}

---
*本报告由轴承振动早筛员自动生成*
"""
    
    def __init__(self,
                 output_dir: Optional[str] = None,
                 include_charts: bool = True,
                 max_detail_frames: int = 20):
        """
        初始化导出器
        
        参数:
            output_dir: 输出目录
            include_charts: 是否包含图表
            max_detail_frames: 最大详细帧数
        """
        if output_dir is None:
            output_dir = os.path.join(os.getcwd(), "reports")
        
        self.output_dir = Path(output_dir)
        self.include_charts = include_charts
        self.max_detail_frames = max_detail_frames
        
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def export_markdown_report(self,
                                 risk_result: TripRiskResult,
                                 anomaly_result: Optional[TripAnomalyResult] = None,
                                 features: Optional[TripFeatures] = None,
                                 validation_warnings: Optional[List[str]] = None,
                                 trip_id: Optional[str] = None,
                                 filename: Optional[str] = None) -> str:
        """
        导出Markdown报告
        
        参数:
            risk_result: 风险评估结果
            anomaly_result: 异常检测结果
            features: 特征数据
            validation_warnings: 数据校验警告
            trip_id: 趟次ID
            filename: 输出文件名
            
        返回:
            输出文件路径
        """
        actual_trip_id = trip_id or risk_result.trip_id
        
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"report_{actual_trip_id}_{timestamp}.md"
        
        filepath = self.output_dir / filename
        
        report_content = self._generate_markdown_content(
            risk_result, anomaly_result, features, 
            validation_warnings, actual_trip_id
        )
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(report_content)
        
        print(f"报告已导出: {filepath}")
        return str(filepath)
    
    def _generate_markdown_content(self,
                                    risk_result: TripRiskResult,
                                    anomaly_result: Optional[TripAnomalyResult],
                                    features: Optional[TripFeatures],
                                    validation_warnings: Optional[List[str]],
                                    trip_id: str) -> str:
        """
        生成Markdown报告内容
        """
        risk_distribution = self._calculate_risk_distribution(risk_result)
        risk_distribution_table = self._format_risk_distribution_table(risk_distribution)
        
        evidence_summary = self._format_evidence_summary(risk_result)
        recommendations = self._format_recommendations(risk_result)
        
        high_risk_frames_detail = self._format_high_risk_frames(risk_result)
        all_frames_summary = self._format_all_frames_summary(risk_result)
        
        validation_info = self._format_validation_info(validation_warnings, features)
        feature_stats = self._format_feature_stats(features, anomaly_result)
        
        report_content = self.REPORT_TEMPLATE.format(
            trip_id=trip_id,
            analysis_time=risk_result.analysis_time,
            report_time=datetime.now().isoformat(),
            overall_risk=risk_result.overall_risk.value,
            overall_score=risk_result.overall_score,
            confidence=risk_result.confidence,
            risk_distribution_table=risk_distribution_table,
            primary_concern=risk_result.primary_concern or "未检测到明显异常",
            evidence_summary=evidence_summary,
            recommendations=recommendations,
            high_risk_frames_detail=high_risk_frames_detail,
            all_frames_summary=all_frames_summary,
            validation_info=validation_info,
            feature_stats=feature_stats
        )
        
        return report_content
    
    def _calculate_risk_distribution(self, risk_result: TripRiskResult) -> Dict[str, Dict]:
        """
        计算风险分布
        """
        distribution = {
            "红色 - 紧急": {"count": 0, "frames": []},
            "橙色 - 警告": {"count": 0, "frames": []},
            "黄色 - 关注": {"count": 0, "frames": []},
            "绿色 - 正常": {"count": 0, "frames": []}
        }
        
        for fr in risk_result.frame_results:
            level = fr.risk_level.value
            if level in distribution:
                distribution[level]["count"] += 1
                distribution[level]["frames"].append(fr.frame_idx)
        
        return distribution
    
    def _format_risk_distribution_table(self, distribution: Dict[str, Dict]) -> str:
        """
        格式化风险分布表格
        """
        total = sum(d["count"] for d in distribution.values())
        
        lines = []
        for level, data in distribution.items():
            count = data["count"]
            ratio = count / total * 100 if total > 0 else 0
            lines.append(f"| {level} | {count} | {ratio:.1f}% |")
        
        return "\n".join(lines)
    
    def _format_evidence_summary(self, risk_result: TripRiskResult) -> str:
        """
        格式化证据摘要
        """
        if not risk_result.evidence_summary:
            return "无特殊证据"
        
        lines = []
        for i, evidence in enumerate(risk_result.evidence_summary, 1):
            lines.append(f"{i}. {evidence}")
        
        return "\n".join(lines)
    
    def _format_recommendations(self, risk_result: TripRiskResult) -> str:
        """
        格式化建议
        """
        if not risk_result.recommendations:
            return "无特殊建议"
        
        lines = []
        for i, rec in enumerate(risk_result.recommendations, 1):
            lines.append(f"{i}. {rec}")
        
        return "\n".join(lines)
    
    def _format_high_risk_frames(self, risk_result: TripRiskResult) -> str:
        """
        格式化高风险帧详情
        """
        high_risk_frames = [
            fr for fr in risk_result.frame_results
            if fr.risk_level in [RiskLevel.RED, RiskLevel.ORANGE]
        ]
        
        if not high_risk_frames:
            return "无高风险帧"
        
        if len(high_risk_frames) > self.max_detail_frames:
            high_risk_frames = high_risk_frames[:self.max_detail_frames]
            note = f"\n\n*注: 仅显示前 {self.max_detail_frames} 个高风险帧*"
        else:
            note = ""
        
        lines = ["| 帧号 | 时间范围 | 风险等级 | 风险评分 | 主要证据 |",
                 "|------|----------|----------|----------|----------|"]
        
        for fr in high_risk_frames:
            time_range = f"{fr.start_time:.1f}s - {fr.end_time:.1f}s"
            main_evidence = ", ".join([e.description for e in fr.evidence[:2]]) if fr.evidence else "无"
            lines.append(
                f"| {fr.frame_idx} | {time_range} | {fr.risk_level.value} | "
                f"{fr.risk_score:.2f} | {main_evidence[:50]}{'...' if len(main_evidence) > 50 else ''} |"
            )
        
        return "\n".join(lines) + note
    
    def _format_all_frames_summary(self, risk_result: TripRiskResult) -> str:
        """
        格式化所有帧摘要
        """
        if not risk_result.frame_results:
            return "无帧数据"
        
        total_frames = len(risk_result.frame_results)
        
        scores = [fr.risk_score for fr in risk_result.frame_results]
        avg_score = np.mean(scores)
        max_score = np.max(scores)
        min_score = np.min(scores)
        std_score = np.std(scores)
        
        return f"""
- 总帧数: {total_frames}
- 平均风险评分: {avg_score:.2f}
- 最高风险评分: {max_score:.2f}
- 最低风险评分: {min_score:.2f}
- 评分标准差: {std_score:.2f}
"""
    
    def _format_validation_info(self,
                                 validation_warnings: Optional[List[str]],
                                 features: Optional[TripFeatures]) -> str:
        """
        格式化数据校验信息
        """
        lines = []
        
        if features:
            lines.append(f"- 采样率: {features.sampling_rate:.1f} Hz")
            lines.append(f"- 总样本数: {features.total_samples}")
            lines.append(f"- 特征帧数: {len(features.frame_features)}")
            lines.append(f"- 峰值帧数: {len(features.peak_frames)}")
            lines.append(f"- 可疑帧数: {len(features.suspicious_frames)}")
        
        if validation_warnings:
            lines.append("\n数据校验警告:")
            for warning in validation_warnings:
                lines.append(f"- ⚠️ {warning}")
        
        if not lines:
            return "无校验信息"
        
        return "\n".join(lines)
    
    def _format_feature_stats(self,
                               features: Optional[TripFeatures],
                               anomaly_result: Optional[TripAnomalyResult]) -> str:
        """
        格式化特征统计
        """
        lines = []
        
        if features and features.global_features:
            lines.append("### 全局特征统计")
            for key, value in features.global_features.items():
                if isinstance(value, (int, float)):
                    lines.append(f"- {key}: {value:.4f}")
        
        if anomaly_result:
            lines.append("\n### 异常检测统计")
            lines.append(f"- 是否检测到异常: {'是' if anomaly_result.has_anomaly else '否'}")
            lines.append(f"- 异常帧数: {len(anomaly_result.anomaly_frames)}")
            lines.append(f"- 可疑帧数: {len(anomaly_result.suspicious_frames)}")
            lines.append(f"- 检测置信度: {anomaly_result.confidence:.1%}")
        
        if not lines:
            return "无特征统计信息"
        
        return "\n".join(lines)
    
    def export_evidence_package(self,
                                 risk_result: TripRiskResult,
                                 anomaly_result: Optional[TripAnomalyResult] = None,
                                 features: Optional[TripFeatures] = None,
                                 features_df: Optional[pd.DataFrame] = None,
                                 trip_id: Optional[str] = None,
                                 output_format: str = "both") -> Dict[str, str]:
        """
        导出证据包（CSV和/或JSON）
        
        参数:
            risk_result: 风险评估结果
            anomaly_result: 异常检测结果
            features: 特征数据
            features_df: 特征DataFrame
            trip_id: 趟次ID
            output_format: 输出格式: 'csv', 'json', 或 'both'
            
        返回:
            导出文件路径字典
        """
        actual_trip_id = trip_id or risk_result.trip_id
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        output_files = {}
        
        package_data = self._build_evidence_package(
            risk_result, anomaly_result, features, features_df, actual_trip_id
        )
        
        if output_format in ["json", "both"]:
            json_filename = f"evidence_{actual_trip_id}_{timestamp}.json"
            json_filepath = self.output_dir / json_filename
            
            with open(json_filepath, 'w', encoding='utf-8') as f:
                json.dump(package_data, f, ensure_ascii=False, indent=2, default=str)
            
            output_files["json"] = str(json_filepath)
            print(f"JSON证据包已导出: {json_filepath}")
        
        if output_format in ["csv", "both"]:
            csv_files = self._export_csv_package(
                risk_result, anomaly_result, features_df, 
                actual_trip_id, timestamp
            )
            output_files.update(csv_files)
        
        return output_files
    
    def _build_evidence_package(self,
                                 risk_result: TripRiskResult,
                                 anomaly_result: Optional[TripAnomalyResult],
                                 features: Optional[TripFeatures],
                                 features_df: Optional[pd.DataFrame],
                                 trip_id: str) -> Dict:
        """
        构建证据包数据结构
        """
        package = {
            "metadata": {
                "trip_id": trip_id,
                "analysis_time": risk_result.analysis_time,
                "package_generated_time": datetime.now().isoformat(),
                "version": "1.0"
            },
            "risk_assessment": {
                "overall_risk": risk_result.overall_risk.value,
                "overall_score": risk_result.overall_score,
                "confidence": risk_result.confidence,
                "primary_concern": risk_result.primary_concern,
                "review_status": risk_result.review_status
            },
            "frame_results": []
        }
        
        for fr in risk_result.frame_results:
            frame_data = {
                "frame_idx": fr.frame_idx,
                "start_time": fr.start_time,
                "end_time": fr.end_time,
                "risk_level": fr.risk_level.value,
                "risk_score": fr.risk_score,
                "evidence": [
                    {
                        "type": e.evidence_type,
                        "description": e.description,
                        "severity": e.severity
                    }
                    for e in fr.evidence
                ],
                "recommendations": fr.recommendations
            }
            package["frame_results"].append(frame_data)
        
        if anomaly_result:
            package["anomaly_detection"] = {
                "has_anomaly": anomaly_result.has_anomaly,
                "primary_anomaly_type": anomaly_result.primary_anomaly_type.value,
                "global_score": anomaly_result.global_score,
                "confidence": anomaly_result.confidence,
                "anomaly_frames": anomaly_result.anomaly_frames,
                "suspicious_frames": anomaly_result.suspicious_frames
            }
        
        if features:
            package["features"] = {
                "sampling_rate": features.sampling_rate,
                "total_samples": features.total_samples,
                "frame_count": len(features.frame_features),
                "peak_frames": features.peak_frames,
                "suspicious_frames": features.suspicious_frames,
                "global_features": features.global_features
            }
        
        package["evidence_summary"] = risk_result.evidence_summary
        package["recommendations"] = risk_result.recommendations
        
        return package
    
    def _export_csv_package(self,
                            risk_result: TripRiskResult,
                            anomaly_result: Optional[TripAnomalyResult],
                            features_df: Optional[pd.DataFrame],
                            trip_id: str,
                            timestamp: str) -> Dict[str, str]:
        """
        导出CSV格式的证据包
        """
        csv_files = {}
        
        frame_risk_data = []
        for fr in risk_result.frame_results:
            frame_risk_data.append({
                "frame_idx": fr.frame_idx,
                "start_time": fr.start_time,
                "end_time": fr.end_time,
                "risk_level": fr.risk_level.value,
                "risk_score": fr.risk_score,
                "evidence_count": len(fr.evidence),
                "recommendation_count": len(fr.recommendations)
            })
        
        if frame_risk_data:
            df = pd.DataFrame(frame_risk_data)
            filename = f"frame_risk_{trip_id}_{timestamp}.csv"
            filepath = self.output_dir / filename
            df.to_csv(filepath, index=False, encoding='utf-8-sig')
            csv_files["frame_risk_csv"] = str(filepath)
            print(f"帧风险CSV已导出: {filepath}")
        
        if features_df is not None and not features_df.empty:
            filename = f"features_{trip_id}_{timestamp}.csv"
            filepath = self.output_dir / filename
            features_df.to_csv(filepath, index=False, encoding='utf-8-sig')
            csv_files["features_csv"] = str(filepath)
            print(f"特征CSV已导出: {filepath}")
        
        summary_data = {
            "trip_id": [trip_id],
            "analysis_time": [risk_result.analysis_time],
            "overall_risk": [risk_result.overall_risk.value],
            "overall_score": [risk_result.overall_score],
            "confidence": [risk_result.confidence],
            "primary_concern": [risk_result.primary_concern],
            "total_frames": [len(risk_result.frame_results)],
            "evidence_count": [len(risk_result.evidence_summary)],
            "recommendation_count": [len(risk_result.recommendations)]
        }
        
        df_summary = pd.DataFrame(summary_data)
        filename = f"summary_{trip_id}_{timestamp}.csv"
        filepath = self.output_dir / filename
        df_summary.to_csv(filepath, index=False, encoding='utf-8-sig')
        csv_files["summary_csv"] = str(filepath)
        print(f"摘要CSV已导出: {filepath}")
        
        return csv_files
    
    def export_batch_reports(self,
                              results: List[Tuple[str, TripRiskResult, Optional[TripAnomalyResult], Optional[TripFeatures]]],
                              output_format: str = "all") -> Dict[str, List[str]]:
        """
        批量导出报告
        
        参数:
            results: 结果列表，每项为 (trip_id, risk_result, anomaly_result, features)
            output_format: 输出格式: 'all', 'markdown', 'csv', 'json'
            
        返回:
            导出文件路径字典
        """
        exported = {
            "markdown": [],
            "csv": [],
            "json": []
        }
        
        for trip_id, risk_result, anomaly_result, features in results:
            if output_format in ["all", "markdown"]:
                md_path = self.export_markdown_report(
                    risk_result, anomaly_result, features, trip_id=trip_id
                )
                exported["markdown"].append(md_path)
            
            if output_format in ["all", "csv", "json"]:
                files = self.export_evidence_package(
                    risk_result, anomaly_result, features,
                    trip_id=trip_id,
                    output_format="both" if output_format == "all" else output_format
                )
                if "csv" in files:
                    exported["csv"].extend([v for k, v in files.items() if "csv" in k.lower()])
                if "json" in files:
                    exported["json"].append(files["json"])
        
        return exported
    
    def get_export_summary(self) -> Dict:
        """
        获取导出摘要
        
        返回:
            导出摘要信息
        """
        md_files = list(self.output_dir.glob("*.md"))
        csv_files = list(self.output_dir.glob("*.csv"))
        json_files = list(self.output_dir.glob("*.json"))
        
        return {
            "output_directory": str(self.output_dir),
            "markdown_reports": len(md_files),
            "csv_files": len(csv_files),
            "json_files": len(json_files),
            "total_files": len(md_files) + len(csv_files) + len(json_files)
        }
