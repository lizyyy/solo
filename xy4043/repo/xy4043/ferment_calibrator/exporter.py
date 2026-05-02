"""
报告导出模块 - 导出Markdown实验复盘、CSV指标表和JSON审计包
"""
import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional


class ReportExporter:
    """报告导出器"""
    
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def export_markdown_report(
        self,
        batch_data: Dict[str, Any],
        filename: Optional[str] = None
    ) -> str:
        """
        导出Markdown实验复盘报告
        
        Args:
            batch_data: 批次数据（包含校准、阶段、指标、风险、复核等信息）
            filename: 输出文件名（可选）
            
        Returns:
            输出文件路径
        """
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            batch_id = batch_data.get("batch_id", "unknown")
            filename = f"{batch_id}_report_{timestamp}.md"
        
        filepath = self.output_dir / filename
        
        content = self._generate_markdown_content(batch_data)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return str(filepath)
    
    def _generate_markdown_content(self, batch_data: Dict[str, Any]) -> str:
        """生成Markdown内容"""
        lines = []
        
        batch_id = batch_data.get("batch_id", "未知批次")
        strain = batch_data.get("strain", "未知菌株")
        lines.append(f"# 发酵实验复盘报告 - {batch_id}")
        lines.append("")
        lines.append(f"**菌株**: {strain}")
        lines.append(f"**报告生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 1. 实验概览")
        lines.append("")
        
        summary = batch_data.get("import_summary", {})
        if summary:
            lines.append(f"- **处理文件数**: {summary.get('files_processed', 0)}")
            lines.append(f"- **有效记录数**: {summary.get('total_valid_records', 0)}")
            lines.append(f"- **隔离记录数**: {summary.get('total_quarantined', 0)}")
            
            time_range = summary.get("time_range", {})
            if time_range.get("start"):
                lines.append(f"- **实验开始时间**: {time_range.get('start')}")
            if time_range.get("end"):
                lines.append(f"- **实验结束时间**: {time_range.get('end')}")
        
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 2. 生长指标")
        lines.append("")
        
        metrics = batch_data.get("metrics", {})
        growth_metrics = metrics.get("growth_metrics", {})
        
        if growth_metrics:
            lines.append("| 指标 | 值 |")
            lines.append("|------|-----|")
            lines.append(f"| 最大生长速率 | {growth_metrics.get('max_growth_rate', 'N/A')} h⁻¹ |")
            lines.append(f"| 倍增时间 | {growth_metrics.get('doubling_time_hours', 'N/A')} 小时 |")
            lines.append(f"| 滞后期时长 | {growth_metrics.get('lag_phase_duration_hours', 'N/A')} 小时 |")
            lines.append(f"| 最终OD600 | {growth_metrics.get('final_od600', 'N/A')} |")
            lines.append(f"| OD600增长量 | {growth_metrics.get('od600_increase', 'N/A')} |")
            lines.append(f"| 实验总时长 | {growth_metrics.get('total_duration_hours', 'N/A')} 小时 |")
        
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 3. 阶段切分")
        lines.append("")
        
        phase_result = batch_data.get("phase_result", {})
        phase_summary = phase_result.get("phase_summary", {})
        
        if phase_summary:
            lines.append(f"- **总实验时长**: {phase_summary.get('total_duration_hours', 'N/A')} 小时")
            lines.append(f"- **补料事件数**: {phase_summary.get('feed_count', 0)}")
            lines.append("")
            
            phase_durations = phase_summary.get("phase_durations", {})
            if phase_durations:
                lines.append("### 各阶段时长分布")
                lines.append("")
                lines.append("| 阶段 | 出现次数 | 总时长(小时) |")
                lines.append("|------|----------|--------------|")
                for phase, data in phase_durations.items():
                    phase_name = self._translate_phase(phase)
                    lines.append(f"| {phase_name} | {data.get('count', 0)} | {data.get('total_hours', 0)} |")
        
        segments = phase_result.get("segments", [])
        if segments:
            lines.append("")
            lines.append("### 详细阶段列表")
            lines.append("")
            lines.append("| 序号 | 阶段 | 开始时间 | 结束时间 | 时长(小时) | 备注 |")
            lines.append("|------|------|----------|----------|------------|------|")
            
            for i, seg in enumerate(segments, 1):
                phase_name = self._translate_phase(seg.get("phase", "unknown"))
                feed_info = ""
                if seg.get("feed_event"):
                    feed = seg["feed_event"]
                    feed_info = f"补料 {feed.get('amount', 0)} mL"
                lines.append(f"| {i} | {phase_name} | {seg.get('start_time', '')[:19]} | {seg.get('end_time', '')[:19]} | {seg.get('duration_hours', 0)} | {feed_info} |")
        
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 4. 补料分析")
        lines.append("")
        
        feed_metrics = metrics.get("feed_metrics", [])
        if feed_metrics:
            lines.append("| 序号 | 补料时间 | 补料量(mL) | 补料前pH | 补料后pH | pH变化 | 补料前DO | 补料后DO | DO变化 |")
            lines.append("|------|----------|------------|----------|----------|--------|----------|----------|--------|")
            
            for i, fm in enumerate(feed_metrics, 1):
                ph_change = fm.get("ph_change", 0) or 0
                do_change = fm.get("do_change", 0) or 0
                lines.append(
                    f"| {i} | {fm.get('feed_time', '')[:19]} | {fm.get('feed_amount', 0)} | "
                    f"{fm.get('ph_before_feed', 'N/A')} | {fm.get('ph_after_feed', 'N/A')} | "
                    f"{ph_change:+.4f} | {fm.get('do_before_feed', 'N/A')} | "
                    f"{fm.get('do_after_feed', 'N/A')} | {do_change:+.2f} |"
                )
        else:
            lines.append("*无补料事件记录*")
        
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 5. 风险检测")
        lines.append("")
        
        risk_result = batch_data.get("risk_result", {})
        risk_summary = risk_result.get("summary", {})
        
        if risk_summary:
            total_risks = risk_summary.get("total_risks", 0)
            lines.append(f"**总风险数**: {total_risks}")
            lines.append("")
            
            by_severity = risk_summary.get("by_severity", {})
            if by_severity:
                lines.append("### 按严重程度分布")
                lines.append("")
                for severity, count in by_severity.items():
                    severity_name = self._translate_severity(severity)
                    lines.append(f"- **{severity_name}**: {count} 个")
        
        risks = risk_result.get("risks", [])
        if risks:
            lines.append("")
            lines.append("### 风险详情")
            lines.append("")
            
            for risk in risks:
                severity_emoji = self._severity_to_emoji(risk.get("severity", "medium"))
                status = risk.get("review_status", "pending")
                status_text = self._translate_review_status(status)
                
                lines.append(f"#### {severity_emoji} [{status_text}] {risk.get('description', '')}")
                lines.append("")
                lines.append(f"- **风险类型**: {self._translate_risk_type(risk.get('risk_type', 'unknown'))}")
                lines.append(f"- **置信度**: {risk.get('confidence', 0):.1%}")
                lines.append(f"- **检测时间**: {risk.get('detected_time', '')[:19]}")
                
                if risk.get("start_time"):
                    lines.append(f"- **开始时间**: {risk.get('start_time', '')[:19]}")
                if risk.get("end_time"):
                    lines.append(f"- **结束时间**: {risk.get('end_time', '')[:19]}")
                
                evidence = risk.get("evidence")
                if evidence:
                    lines.append(f"- **证据**: {json.dumps(evidence, ensure_ascii=False)}")
                
                review_comment = risk.get("review_comment")
                if review_comment:
                    lines.append(f"- **复核意见**: {review_comment}")
                
                lines.append("")
        
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 6. 人工复核记录")
        lines.append("")
        
        overall_review = batch_data.get("overall_review")
        if overall_review:
            lines.append(f"- **复核人**: {overall_review.get('reviewer', '未知')}")
            lines.append(f"- **复核时间**: {overall_review.get('review_time', '')[:19]}")
            lines.append(f"- **总体意见**: {overall_review.get('comment', '无')}")
        else:
            lines.append("*无总体复核记录*")
        
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 7. 附录")
        lines.append("")
        lines.append("### 配置摘要")
        lines.append("")
        
        config = batch_data.get("config", {})
        if config:
            lines.append("#### 传感器校准参数")
            lines.append("")
            sensor_calib = config.get("sensor_calibration", {})
            for sensor, params in sensor_calib.items():
                sensor_name = self._translate_sensor(sensor)
                lines.append(f"**{sensor_name}**:")
                for key, value in params.items():
                    lines.append(f"- {key}: {value}")
                lines.append("")
            
            lines.append("#### 异常阈值")
            lines.append("")
            thresholds = config.get("anomaly_thresholds", {})
            for param, values in thresholds.items():
                param_name = self._translate_parameter(param)
                lines.append(f"**{param_name}**: {values}")
        
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("*报告由发酵曲线校准器自动生成*")
        
        return "\n".join(lines)
    
    def _translate_phase(self, phase: str) -> str:
        """翻译阶段名称"""
        translations = {
            "lag": "滞后期",
            "exponential": "指数生长期",
            "stationary": "稳定期",
            "decline": "衰退期",
            "feed": "补料期",
            "unknown": "未知"
        }
        return translations.get(phase, phase)
    
    def _translate_severity(self, severity: str) -> str:
        """翻译严重程度"""
        translations = {
            "critical": "严重",
            "high": "高",
            "medium": "中",
            "low": "低"
        }
        return translations.get(severity, severity)
    
    def _translate_risk_type(self, risk_type: str) -> str:
        """翻译风险类型"""
        translations = {
            "contamination": "污染风险",
            "sensor_misalignment": "传感器失准",
            "feed_missing": "补料记录缺失",
            "abnormal_ph": "pH异常",
            "abnormal_temperature": "温度异常",
            "abnormal_do": "溶氧异常",
            "rapid_ph_change": "快速pH变化"
        }
        return translations.get(risk_type, risk_type)
    
    def _translate_review_status(self, status: str) -> str:
        """翻译复核状态"""
        translations = {
            "pending": "待复核",
            "confirmed": "已确认",
            "dismissed": "已驳回"
        }
        return translations.get(status, status)
    
    def _translate_sensor(self, sensor: str) -> str:
        """翻译传感器名称"""
        translations = {
            "ph": "pH传感器",
            "temperature": "温度传感器",
            "dissolved_oxygen": "溶氧传感器"
        }
        return translations.get(sensor, sensor)
    
    def _translate_parameter(self, param: str) -> str:
        """翻译参数名称"""
        translations = {
            "ph": "pH",
            "temperature": "温度",
            "dissolved_oxygen": "溶氧",
            "od600": "OD600",
            "stirring_speed": "搅拌转速"
        }
        return translations.get(param, param)
    
    def _severity_to_emoji(self, severity: str) -> str:
        """严重程度转表情符号"""
        emojis = {
            "critical": "🔴",
            "high": "🟠",
            "medium": "🟡",
            "low": "🟢"
        }
        return emojis.get(severity, "⚪")
    
    def export_csv_metrics(
        self,
        batch_data: Dict[str, Any],
        filename: Optional[str] = None
    ) -> str:
        """
        导出CSV指标表
        
        Args:
            batch_data: 批次数据
            filename: 输出文件名（可选）
            
        Returns:
            输出文件路径
        """
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            batch_id = batch_data.get("batch_id", "unknown")
            filename = f"{batch_id}_metrics_{timestamp}.csv"
        
        filepath = self.output_dir / filename
        
        metrics = batch_data.get("metrics", {})
        growth_metrics = metrics.get("growth_metrics", {})
        
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow(["批次信息"])
            writer.writerow(["批次ID", batch_data.get("batch_id", "")])
            writer.writerow(["菌株", batch_data.get("strain", "")])
            writer.writerow([])
            
            writer.writerow(["生长指标"])
            writer.writerow(["指标名称", "值", "单位"])
            writer.writerow(["最大生长速率", growth_metrics.get("max_growth_rate", ""), "h⁻¹"])
            writer.writerow(["倍增时间", growth_metrics.get("doubling_time_hours", ""), "小时"])
            writer.writerow(["滞后期时长", growth_metrics.get("lag_phase_duration_hours", ""), "小时"])
            writer.writerow(["最终OD600", growth_metrics.get("final_od600", ""), ""])
            writer.writerow(["OD600增长量", growth_metrics.get("od600_increase", ""), ""])
            writer.writerow(["实验总时长", growth_metrics.get("total_duration_hours", ""), "小时"])
            writer.writerow([])
            
            feed_metrics = metrics.get("feed_metrics", [])
            if feed_metrics:
                writer.writerow(["补料记录"])
                writer.writerow(["序号", "补料时间", "补料量(mL)", "补料前pH", "补料后pH", "pH变化", "补料前DO", "补料后DO", "DO变化"])
                
                for i, fm in enumerate(feed_metrics, 1):
                    writer.writerow([
                        i,
                        fm.get("feed_time", "")[:19],
                        fm.get("feed_amount", 0),
                        fm.get("ph_before_feed", ""),
                        fm.get("ph_after_feed", ""),
                        fm.get("ph_change", ""),
                        fm.get("do_before_feed", ""),
                        fm.get("do_after_feed", ""),
                        fm.get("do_change", "")
                    ])
                writer.writerow([])
            
            phase_result = batch_data.get("phase_result", {})
            segments = phase_result.get("segments", [])
            if segments:
                writer.writerow(["阶段切分"])
                writer.writerow(["序号", "阶段", "开始时间", "结束时间", "时长(小时)", "补料量(mL)"])
                
                for i, seg in enumerate(segments, 1):
                    phase_name = self._translate_phase(seg.get("phase", "unknown"))
                    feed_amount = seg.get("feed_event", {}).get("amount", "") if seg.get("feed_event") else ""
                    writer.writerow([
                        i,
                        phase_name,
                        seg.get("start_time", "")[:19],
                        seg.get("end_time", "")[:19],
                        seg.get("duration_hours", 0),
                        feed_amount
                    ])
                writer.writerow([])
            
            risk_result = batch_data.get("risk_result", {})
            risks = risk_result.get("risks", [])
            if risks:
                writer.writerow(["风险记录"])
                writer.writerow(["序号", "风险类型", "严重程度", "描述", "置信度", "复核状态"])
                
                for i, risk in enumerate(risks, 1):
                    writer.writerow([
                        i,
                        self._translate_risk_type(risk.get("risk_type", "")),
                        self._translate_severity(risk.get("severity", "")),
                        risk.get("description", ""),
                        f"{risk.get('confidence', 0):.1%}",
                        self._translate_review_status(risk.get("review_status", "pending"))
                    ])
        
        return str(filepath)
    
    def export_json_audit(
        self,
        batch_data: Dict[str, Any],
        filename: Optional[str] = None
    ) -> str:
        """
        导出JSON审计包
        
        包含配置、风险、人工复核记录等完整信息
        
        Args:
            batch_data: 批次数据
            filename: 输出文件名（可选）
            
        Returns:
            输出文件路径
        """
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            batch_id = batch_data.get("batch_id", "unknown")
            filename = f"{batch_id}_audit_{timestamp}.json"
        
        filepath = self.output_dir / filename
        
        audit_package = {
            "audit_version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "batch_id": batch_data.get("batch_id", ""),
            "strain": batch_data.get("strain", ""),
            
            "import_summary": batch_data.get("import_summary", {}),
            
            "configuration": {
                "sensor_calibration": batch_data.get("config", {}).get("sensor_calibration", {}),
                "anomaly_thresholds": batch_data.get("config", {}).get("anomaly_thresholds", {}),
                "risk_rules": batch_data.get("config", {}).get("risk_rules", {})
            },
            
            "calibration_summary": {
                "sensor_calibration_applied": True,
                "od_alignment_performed": True
            },
            
            "phase_analysis": batch_data.get("phase_result", {}),
            
            "metrics": batch_data.get("metrics", {}),
            
            "risk_analysis": {
                "risks": batch_data.get("risk_result", {}).get("risks", []),
                "summary": batch_data.get("risk_result", {}).get("summary", {})
            },
            
            "review_records": {
                "overall_review": batch_data.get("overall_review"),
                "risk_reviews": [
                    {
                        "risk_id": r.get("risk_id"),
                        "review_status": r.get("review_status"),
                        "review_comment": r.get("review_comment"),
                        "reviewer": r.get("reviewer"),
                        "review_time": r.get("review_time")
                    }
                    for r in batch_data.get("risk_result", {}).get("risks", [])
                    if r.get("review_status") != "pending"
                ]
            },
            
            "quarantine_summary": {
                "total_quarantined": batch_data.get("import_summary", {}).get("total_quarantined", 0),
                "quarantine_file": batch_data.get("quarantine_file")
            }
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(audit_package, f, indent=2, ensure_ascii=False, default=str)
        
        return str(filepath)
    
    def export_all(
        self,
        batch_data: Dict[str, Any],
        base_filename: Optional[str] = None
    ) -> Dict[str, str]:
        """
        导出所有格式的报告
        
        Args:
            batch_data: 批次数据
            base_filename: 基础文件名（可选）
            
        Returns:
            格式到文件路径的映射
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        batch_id = batch_data.get("batch_id", "unknown")
        
        if base_filename:
            base = base_filename
        else:
            base = f"{batch_id}_{timestamp}"
        
        paths = {}
        
        paths["markdown"] = self.export_markdown_report(
            batch_data,
            filename=f"{base}_report.md"
        )
        
        paths["csv"] = self.export_csv_metrics(
            batch_data,
            filename=f"{base}_metrics.csv"
        )
        
        paths["json"] = self.export_json_audit(
            batch_data,
            filename=f"{base}_audit.json"
        )
        
        return paths
