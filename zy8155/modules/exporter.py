import csv
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from pathlib import Path

from .data_parser import DataParser, KilnBatch, TemperaturePoint
from .rule_engine import Issue, RiskType


class Exporter:
    def __init__(self, data_parser: DataParser, issues: List[Issue] = None):
        self.data_parser = data_parser
        self.issues = issues or []

    def _datetime_to_str(self, dt: Optional[datetime]) -> str:
        return dt.strftime("%Y-%m-%d %H:%M:%S") if dt else ""

    def _risktype_to_chinese(self, rt: RiskType) -> str:
        mapping = {
            RiskType.HEATING_RATE_EXCEED: "升温速率超限",
            RiskType.INSUFFICIENT_HOLDING: "保温不足",
            RiskType.PROBE_DISCONNECTION: "探头断采",
            RiskType.MIDNIGHT_ALIGNMENT_ERROR: "跨午夜批次归属错位"
        }
        return mapping.get(rt, rt.value)

    def _severity_to_chinese(self, severity: str) -> str:
        mapping = {"high": "高", "medium": "中", "low": "低"}
        return mapping.get(severity, severity)

    def export_issues_csv(self, filepath: str, issues: List[Issue] = None) -> bool:
        issues_to_export = issues or self.issues
        
        try:
            with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    "问题ID", "批次ID", "风险类型", "发生时间", 
                    "严重程度", "描述", "详情",
                    "确认人", "确认时间", "是否误报", "备注"
                ])
                
                for issue in issues_to_export:
                    details_str = ""
                    if issue.details:
                        details_parts = []
                        for key, value in issue.details.items():
                            if isinstance(value, (int, float)):
                                details_parts.append(f"{key}: {value:.2f}" if isinstance(value, float) else f"{key}: {value}")
                            else:
                                details_parts.append(f"{key}: {value}")
                        details_str = "; ".join(details_parts)
                    
                    writer.writerow([
                        issue.issue_id,
                        issue.batch_id,
                        self._risktype_to_chinese(issue.risk_type),
                        self._datetime_to_str(issue.timestamp),
                        self._severity_to_chinese(issue.severity),
                        issue.description,
                        details_str,
                        issue.confirmed_by or "",
                        self._datetime_to_str(issue.confirmed_at),
                        "是" if issue.is_false_positive else "否",
                        issue.notes or ""
                    ])
            
            return True
        except Exception as e:
            print(f"导出CSV失败: {e}")
            return False

    def _calculate_batch_stats(self, batch: KilnBatch, temp_points: List[TemperaturePoint]) -> Dict[str, Any]:
        if not temp_points:
            return {}
        
        valid_points = [p for p in temp_points if p.is_valid]
        if not valid_points:
            return {}
        
        temps = [p.temperature for p in valid_points]
        start_time = batch.start_time
        end_time = batch.end_time if batch.end_time else valid_points[-1].timestamp
        
        total_duration = (end_time - start_time).total_seconds() / 3600
        
        heating_phases = []
        holding_phases = []
        cooling_phases = []
        
        for i in range(1, len(valid_points)):
            prev = valid_points[i-1]
            curr = valid_points[i]
            
            temp_diff = curr.temperature - prev.temperature
            time_diff_hours = (curr.timestamp - prev.timestamp).total_seconds() / 3600
            
            if time_diff_hours <= 0:
                continue
            
            rate = temp_diff / time_diff_hours
            
            if abs(temp_diff) < 10:
                holding_phases.append({
                    "start": prev.timestamp,
                    "end": curr.timestamp,
                    "temp": (prev.temperature + curr.temperature) / 2,
                    "duration_hours": time_diff_hours
                })
            elif rate > 50:
                heating_phases.append({
                    "start": prev.timestamp,
                    "end": curr.timestamp,
                    "rate": rate,
                    "start_temp": prev.temperature,
                    "end_temp": curr.temperature
                })
            elif rate < -50:
                cooling_phases.append({
                    "start": prev.timestamp,
                    "end": curr.timestamp,
                    "rate": rate,
                    "start_temp": prev.temperature,
                    "end_temp": curr.temperature
                })
        
        return {
            "max_temp": max(temps),
            "min_temp": min(temps),
            "avg_temp": sum(temps) / len(temps),
            "total_duration_hours": total_duration,
            "heating_count": len(heating_phases),
            "holding_count": len(holding_phases),
            "cooling_count": len(cooling_phases),
            "total_holding_hours": sum(p["duration_hours"] for p in holding_phases) if holding_phases else 0
        }

    def _generate_batch_section(self, batch: KilnBatch, batch_issues: List[Issue], 
                                  temp_points: List[TemperaturePoint]) -> str:
        lines = []
        
        lines.append(f"## 批次 {batch.batch_id}")
        lines.append("")
        
        lines.append("### 基本信息")
        lines.append("")
        lines.append(f"- **窑炉ID**: {batch.kiln_id}")
        lines.append(f"- **配方名称**: {batch.recipe_name}")
        lines.append(f"- **开始时间**: {self._datetime_to_str(batch.start_time)}")
        lines.append(f"- **结束时间**: {self._datetime_to_str(batch.end_time)}")
        lines.append(f"- **目标温度**: {batch.target_temp}°C")
        lines.append(f"- **状态**: {batch.status}")
        lines.append(f"- **操作员**: {batch.operator or '未记录'}")
        lines.append("")
        
        if temp_points:
            stats = self._calculate_batch_stats(batch, temp_points)
            if stats:
                lines.append("### 烧成统计")
                lines.append("")
                lines.append(f"- **最高温度**: {stats.get('max_temp', 0):.1f}°C")
                lines.append(f"- **最低温度**: {stats.get('min_temp', 0):.1f}°C")
                lines.append(f"- **平均温度**: {stats.get('avg_temp', 0):.1f}°C")
                lines.append(f"- **总时长**: {stats.get('total_duration_hours', 0):.1f} 小时")
                lines.append(f"- **保温总时长**: {stats.get('total_holding_hours', 0):.1f} 小时")
                lines.append("")
        
        if batch_issues:
            lines.append("### 检测到的问题")
            lines.append("")
            
            high_count = sum(1 for i in batch_issues if i.severity == "high")
            medium_count = sum(1 for i in batch_issues if i.severity == "medium")
            confirmed_count = sum(1 for i in batch_issues if i.confirmed_at is not None)
            false_positive_count = sum(1 for i in batch_issues if i.is_false_positive)
            
            lines.append(f"- **高风险**: {high_count} 个")
            lines.append(f"- **中风险**: {medium_count} 个")
            lines.append(f"- **已确认**: {confirmed_count} 个")
            lines.append(f"- **误报**: {false_positive_count} 个")
            lines.append("")
            
            lines.append("| 问题ID | 风险类型 | 严重程度 | 发生时间 | 描述 | 状态 |")
            lines.append("|--------|----------|----------|----------|------|------|")
            
            for issue in sorted(batch_issues, key=lambda x: {"high": 0, "medium": 1, "low": 2}.get(x.severity, 3)):
                status = "已确认" if issue.confirmed_at else "待确认"
                if issue.is_false_positive:
                    status = "误报"
                
                lines.append(
                    f"| {issue.issue_id} | "
                    f"{self._risktype_to_chinese(issue.risk_type)} | "
                    f"{self._severity_to_chinese(issue.severity)} | "
                    f"{self._datetime_to_str(issue.timestamp)} | "
                    f"{issue.description} | "
                    f"{status} |"
                )
            lines.append("")
            
            lines.append("#### 问题详情")
            lines.append("")
            for issue in sorted(batch_issues, key=lambda x: {"high": 0, "medium": 1, "low": 2}.get(x.severity, 3)):
                lines.append(f"##### {issue.issue_id} - {self._risktype_to_chinese(issue.risk_type)}")
                lines.append("")
                lines.append(f"- **严重程度**: {self._severity_to_chinese(issue.severity)}")
                lines.append(f"- **发生时间**: {self._datetime_to_str(issue.timestamp)}")
                lines.append(f"- **描述**: {issue.description}")
                lines.append("")
                
                if issue.details:
                    lines.append("**详细信息**:")
                    lines.append("")
                    lines.append("```json")
                    import json
                    lines.append(json.dumps(issue.details, ensure_ascii=False, indent=2))
                    lines.append("```")
                    lines.append("")
                
                if issue.confirmed_at:
                    lines.append("**确认信息**:")
                    lines.append("")
                    lines.append(f"- **确认人**: {issue.confirmed_by or '未知'}")
                    lines.append(f"- **确认时间**: {self._datetime_to_str(issue.confirmed_at)}")
                    lines.append(f"- **是否误报**: {'是' if issue.is_false_positive else '否'}")
                    if issue.notes:
                        lines.append(f"- **备注**: {issue.notes}")
                    lines.append("")
        
        operator_notes = self.data_parser.operator_notes.get(batch.batch_id, [])
        if operator_notes:
            lines.append("### 操作员记录")
            lines.append("")
            for note in operator_notes:
                lines.append(f"- **{self._datetime_to_str(note.timestamp)}** ({note.author or '未知'}): {note.content}")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        
        return "\n".join(lines)

    def export_firing_review_md(self, filepath: str, issues: List[Issue] = None,
                                  selected_batches: List[str] = None) -> bool:
        issues_to_review = issues or self.issues
        
        batches_by_id = {}
        for issue in issues_to_review:
            if issue.batch_id not in batches_by_id:
                batches_by_id[issue.batch_id] = []
            batches_by_id[issue.batch_id].append(issue)
        
        batches_to_include = selected_batches or list(batches_by_id.keys())
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write("# 陶瓷窑炉烧成曲线复查报告\n")
                f.write("\n")
                f.write(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write("\n")
                
                total_issues = len(issues_to_review)
                high_issues = sum(1 for i in issues_to_review if i.severity == "high")
                medium_issues = sum(1 for i in issues_to_review if i.severity == "medium")
                confirmed_issues = sum(1 for i in issues_to_review if i.confirmed_at is not None)
                false_positives = sum(1 for i in issues_to_review if i.is_false_positive)
                
                f.write("## 概览\n")
                f.write("\n")
                f.write(f"- **涉及批次**: {len(batches_to_include)} 个\n")
                f.write(f"- **问题总数**: {total_issues} 个\n")
                f.write(f"  - 高风险: {high_issues} 个\n")
                f.write(f"  - 中风险: {medium_issues} 个\n")
                f.write(f"- **已确认**: {confirmed_issues} 个\n")
                f.write(f"- **误报**: {false_positives} 个\n")
                f.write("\n")
                
                risk_summary = {}
                for issue in issues_to_review:
                    rt = self._risktype_to_chinese(issue.risk_type)
                    if rt not in risk_summary:
                        risk_summary[rt] = {"count": 0, "high": 0, "medium": 0}
                    risk_summary[rt]["count"] += 1
                    if issue.severity == "high":
                        risk_summary[rt]["high"] += 1
                    elif issue.severity == "medium":
                        risk_summary[rt]["medium"] += 1
                
                if risk_summary:
                    f.write("## 风险类型统计\n")
                    f.write("\n")
                    f.write("| 风险类型 | 总数 | 高风险 | 中风险 |\n")
                    f.write("|----------|------|--------|--------|\n")
                    for rt, stats in sorted(risk_summary.items(), key=lambda x: x[1]["count"], reverse=True):
                        f.write(f"| {rt} | {stats['count']} | {stats['high']} | {stats['medium']} |\n")
                    f.write("\n")
                
                f.write("## 批次详情\n")
                f.write("\n")
                
                for batch_id in sorted(batches_to_include):
                    if batch_id in self.data_parser.batches:
                        batch = self.data_parser.batches[batch_id]
                        batch_issues = batches_by_id.get(batch_id, [])
                        temp_points = self.data_parser.get_batch_temperature_data(batch_id)
                        
                        f.write(self._generate_batch_section(batch, batch_issues, temp_points))
                
                f.write("## 附录\n")
                f.write("\n")
                f.write("### 风险类型说明\n")
                f.write("\n")
                f.write("1. **升温速率超限**: 实际升温速率超过配方规定的最大允许速率\n")
                f.write("2. **保温不足**: 保温阶段持续时间不足，或未达到目标保温温度\n")
                f.write("3. **探头断采**: 温度探头数据采集中断，或无效数据点过多\n")
                f.write("4. **跨午夜批次归属错位**: 跨午夜的批次可能被错误归属到前一天\n")
                f.write("\n")
                f.write("---\n")
                f.write("\n")
                f.write("*本报告由窑炉烧成曲线复查系统自动生成*\n")
            
            return True
        except Exception as e:
            print(f"导出Markdown报告失败: {e}")
            return False

    def export_batch_summary_csv(self, filepath: str) -> bool:
        try:
            with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    "批次ID", "窑炉ID", "配方", "开始时间", "结束时间",
                    "目标温度", "问题数量", "高风险", "中风险", "已确认", "状态"
                ])
                
                for batch_id, batch in self.data_parser.batches.items():
                    batch_issues = [i for i in self.issues if i.batch_id == batch_id]
                    high_count = sum(1 for i in batch_issues if i.severity == "high")
                    medium_count = sum(1 for i in batch_issues if i.severity == "medium")
                    confirmed_count = sum(1 for i in batch_issues if i.confirmed_at)
                    
                    overall_status = "正常"
                    if high_count > 0:
                        overall_status = "需关注"
                    elif medium_count > 0:
                        overall_status = "有警告"
                    
                    writer.writerow([
                        batch_id,
                        batch.kiln_id,
                        batch.recipe_name,
                        self._datetime_to_str(batch.start_time),
                        self._datetime_to_str(batch.end_time),
                        batch.target_temp,
                        len(batch_issues),
                        high_count,
                        medium_count,
                        confirmed_count,
                        overall_status
                    ])
            
            return True
        except Exception as e:
            print(f"导出批次摘要CSV失败: {e}")
            return False
