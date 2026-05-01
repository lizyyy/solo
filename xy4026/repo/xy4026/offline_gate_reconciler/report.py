"""报告导出模块"""
import csv
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

from .models import (
    AnomalyType,
    AnomalyRecord,
    ReconciliationResult,
    TicketStatus,
)


class ReportExporter:
    """报告导出器"""
    
    def __init__(self, workspace_dir: Path):
        """
        初始化报告导出器
        
        Args:
            workspace_dir: 工作目录
        """
        self.workspace_dir = workspace_dir
        self.reports_dir = workspace_dir / "output" / "reports"
        self.reports_dir.mkdir(parents=True, exist_ok=True)
    
    def export_markdown_report(
        self,
        result: ReconciliationResult,
        filename: Optional[str] = None,
    ) -> Path:
        """
        导出 Markdown 复盘报告
        
        Args:
            result: 对账结果
            filename: 文件名（不带扩展名），默认使用日期
            
        Returns:
            导出的文件路径
        """
        if filename is None:
            filename = f"report_{result.event_date}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        markdown = self._generate_markdown_report(result)
        target_path = self.reports_dir / f"{filename}.md"
        
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(markdown)
        
        return target_path
    
    def export_anomalies_csv(
        self,
        result: ReconciliationResult,
        filename: Optional[str] = None,
    ) -> Path:
        """
        导出异常清单 CSV
        
        Args:
            result: 对账结果
            filename: 文件名（不带扩展名），默认使用日期
            
        Returns:
            导出的文件路径
        """
        if filename is None:
            filename = f"anomalies_{result.event_date}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        target_path = self.reports_dir / f"{filename}.csv"
        
        # 准备 CSV 数据
        rows = []
        
        # 表头
        headers = [
            "序号",
            "异常类型",
            "票号",
            "时间",
            "入口",
            "设备号",
            "操作员",
            "严重程度",
            "描述",
        ]
        rows.append(headers)
        
        # 按时间排序异常
        sorted_anomalies = sorted(
            result.anomalies,
            key=lambda x: x.timestamp
        )
        
        for idx, anomaly in enumerate(sorted_anomalies, 1):
            row = [
                str(idx),
                self._anomaly_type_to_chinese(anomaly.anomaly_type),
                anomaly.ticket_number,
                anomaly.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                anomaly.entry or "-",
                anomaly.device_id or "-",
                anomaly.operator or "-",
                self._severity_to_chinese(anomaly.severity),
                anomaly.description,
            ]
            rows.append(row)
        
        # 写入 CSV
        with open(target_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerows(rows)
        
        return target_path
    
    def _generate_markdown_report(self, result: ReconciliationResult) -> str:
        """生成 Markdown 报告内容"""
        lines = []
        
        # 标题
        lines.append(f"# 闸口对账复盘报告")
        lines.append("")
        lines.append(f"**展会日期**: {result.event_date}")
        lines.append(f"**对账时间**: {result.reconciliation_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 总览
        lines.append("## 一、总览")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总票数 | {result.total_tickets} |")
        lines.append(f"| 已扫描票数 | {result.tickets_scanned} |")
        lines.append(f"| 当前在场内 | {result.tickets_in_venue} |")
        lines.append(f"| 已退场 | {result.tickets_exited} |")
        lines.append(f"| **异常总数** | **{result.total_anomalies}** |")
        lines.append(f"| 隔离区记录 | {result.quarantined_count} |")
        lines.append(f"| 合并重复扫码 | {result.duplicate_merges} |")
        lines.append("")
        
        # 入场统计
        lines.append("## 二、入场统计")
        lines.append("")
        
        if result.entries_by_gate:
            lines.append("### 按入口分布")
            lines.append("")
            lines.append("| 入口 | 入场人次 | 占比 |")
            lines.append("|------|----------|------|")
            total_entries = sum(result.entries_by_gate.values())
            for gate, count in sorted(result.entries_by_gate.items(), key=lambda x: x[1], reverse=True):
                percentage = (count / total_entries * 100) if total_entries > 0 else 0
                lines.append(f"| {gate} | {count} | {percentage:.1f}% |")
            lines.append("")
        
        if result.entries_by_ticket_type:
            lines.append("### 按票种分布")
            lines.append("")
            lines.append("| 票种 | 入场人次 | 占比 |")
            lines.append("|------|----------|------|")
            total_by_type = sum(result.entries_by_ticket_type.values())
            for ticket_type, count in sorted(result.entries_by_ticket_type.items(), key=lambda x: x[1], reverse=True):
                percentage = (count / total_by_type * 100) if total_by_type > 0 else 0
                lines.append(f"| {ticket_type} | {count} | {percentage:.1f}% |")
            lines.append("")
        
        # 异常分析
        lines.append("## 三、异常分析")
        lines.append("")
        
        if result.anomaly_counts:
            lines.append("### 异常类型分布")
            lines.append("")
            lines.append("| 异常类型 | 数量 | 严重程度 |")
            lines.append("|----------|------|----------|")
            for anomaly_type, count in sorted(result.anomaly_counts.items(), key=lambda x: x[1], reverse=True):
                severity = self._get_anomaly_severity(anomaly_type)
                lines.append(f"| {self._anomaly_type_to_chinese(anomaly_type)} | {count} | {self._severity_to_chinese(severity)} |")
            lines.append("")
        
        # 详细异常列表
        if result.anomalies:
            lines.append("### 详细异常记录")
            lines.append("")
            
            # 按严重程度分组
            critical = [a for a in result.anomalies if a.severity == "critical"]
            errors = [a for a in result.anomalies if a.severity == "error"]
            warnings = [a for a in result.anomalies if a.severity == "warning"]
            
            if critical:
                lines.append("#### 🔴 严重异常")
                lines.append("")
                for anomaly in sorted(critical, key=lambda x: x.timestamp):
                    lines.append(f"- **{anomaly.timestamp.strftime('%H:%M:%S')}** [{anomaly.entry}] {anomaly.ticket_number}: {anomaly.description}")
                    lines.append(f"  - 设备: {anomaly.device_id}, 操作员: {anomaly.operator}")
                lines.append("")
            
            if errors:
                lines.append("#### 🟠 错误异常")
                lines.append("")
                for anomaly in sorted(errors, key=lambda x: x.timestamp):
                    lines.append(f"- **{anomaly.timestamp.strftime('%H:%M:%S')}** [{anomaly.entry}] {anomaly.ticket_number}: {anomaly.description}")
                    lines.append(f"  - 设备: {anomaly.device_id}, 操作员: {anomaly.operator}")
                lines.append("")
            
            if warnings:
                lines.append("#### 🟡 警告异常")
                lines.append("")
                for anomaly in sorted(warnings, key=lambda x: x.timestamp)[:20]:  # 只显示前20个警告
                    lines.append(f"- **{anomaly.timestamp.strftime('%H:%M:%S')}** [{anomaly.entry}] {anomaly.ticket_number}: {anomaly.description}")
                if len(warnings) > 20:
                    lines.append(f"- ... 还有 {len(warnings) - 20} 条警告，请查看完整异常清单 CSV")
                lines.append("")
        
        # 风险提示
        lines.append("## 四、风险提示")
        lines.append("")
        
        risks = []
        
        # 黑名单票
        blacklisted_count = result.anomaly_counts.get(AnomalyType.BLACKLISTED, 0)
        if blacklisted_count > 0:
            risks.append(f"🔴 **黑名单票入场**: {blacklisted_count} 张黑名单票被放行，需立即核查")
        
        # 同时扫码（可能是复制票）
        simultaneous_count = result.anomaly_counts.get(AnomalyType.SIMULTANEOUS_SCAN, 0)
        if simultaneous_count > 0:
            risks.append(f"🔴 **疑似复制票**: {simultaneous_count} 次同一票在不同设备同时扫码，可能存在复制票")
        
        # 未知票
        unknown_count = result.anomaly_counts.get(AnomalyType.UNKNOWN_TICKET, 0)
        if unknown_count > 0:
            risks.append(f"🟠 **未知票入场**: {unknown_count} 张票不在票务名单中，需核查是否为伪造票")
        
        # 错入口
        wrong_entry_count = result.anomaly_counts.get(AnomalyType.WRONG_ENTRY, 0)
        if wrong_entry_count > 0:
            risks.append(f"🟠 **错误入口**: {wrong_entry_count} 次票种与入口不匹配，需加强入口管理")
        
        # 普通票重复入场
        duplicate_count = result.anomaly_counts.get(AnomalyType.DUPLICATE_ENTRY, 0)
        if duplicate_count > 0:
            risks.append(f"🟠 **重复入场**: {duplicate_count} 次普通票重复入场，可能存在漏洞")
        
        if risks:
            for risk in risks:
                lines.append(risk)
                lines.append("")
        else:
            lines.append("✅ 本次对账未发现严重异常。")
            lines.append("")
        
        # 统计详情
        lines.append("## 五、统计详情")
        lines.append("")
        lines.append("```json")
        stats_json = {
            "total_logs_processed": result.stats.get("total_logs_processed", 0),
            "duplicate_scans_merged": result.stats.get("duplicate_scans_merged", 0),
            "failed_rows_quarantined": result.stats.get("failed_rows_quarantined", 0),
            "unknown_tickets_count": result.stats.get("unknown_tickets_count", 0),
        }
        import json
        lines.append(json.dumps(stats_json, indent=2, ensure_ascii=False))
        lines.append("```")
        lines.append("")
        
        # 页脚
        lines.append("---")
        lines.append("")
        lines.append(f"*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        lines.append("")
        lines.append("*离线闸口对账器 v1.0.0*")
        
        return "\n".join(lines)
    
    def _anomaly_type_to_chinese(self, anomaly_type: AnomalyType) -> str:
        """异常类型转中文"""
        mapping = {
            AnomalyType.UNKNOWN_TICKET: "未知票",
            AnomalyType.BLACKLISTED: "黑名单票",
            AnomalyType.WRONG_ENTRY: "错误入口",
            AnomalyType.EXIT_BEFORE_ENTRY: "先退场后入场",
            AnomalyType.DUPLICATE_ENTRY: "重复入场",
            AnomalyType.SIMULTANEOUS_SCAN: "同时扫码（疑似复制票）",
            AnomalyType.BAD_ROW: "日志坏行",
            AnomalyType.INVALID_ACTION_ORDER: "无效动作顺序",
            AnomalyType.REENTRY_NOT_ALLOWED: "二次入场不允许",
        }
        return mapping.get(anomaly_type, anomaly_type.value)
    
    def _severity_to_chinese(self, severity: str) -> str:
        """严重程度转中文"""
        mapping = {
            "critical": "严重",
            "error": "错误",
            "warning": "警告",
        }
        return mapping.get(severity, severity)
    
    def _get_anomaly_severity(self, anomaly_type: AnomalyType) -> str:
        """获取异常类型的默认严重程度"""
        mapping = {
            AnomalyType.BLACKLISTED: "critical",
            AnomalyType.SIMULTANEOUS_SCAN: "critical",
            AnomalyType.UNKNOWN_TICKET: "error",
            AnomalyType.WRONG_ENTRY: "error",
            AnomalyType.EXIT_BEFORE_ENTRY: "error",
            AnomalyType.DUPLICATE_ENTRY: "error",
            AnomalyType.INVALID_ACTION_ORDER: "error",
            AnomalyType.REENTRY_NOT_ALLOWED: "error",
            AnomalyType.BAD_ROW: "warning",
        }
        return mapping.get(anomaly_type, "warning")
