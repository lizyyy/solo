"""Markdown报告生成器"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional

from ..models import (
    AuditPackage,
    TransportConfig,
    RouteBook,
    BoxInfo,
    Issue,
    IssueType,
    IssueSeverity,
    ReviewRecord,
    ReviewStatus,
    ReviewConclusion,
)


SEVERITY_ICONS = {
    IssueSeverity.CRITICAL: "🔴",
    IssueSeverity.HIGH: "🟠",
    IssueSeverity.MEDIUM: "🟡",
    IssueSeverity.LOW: "🟢",
}

SEVERITY_LABELS = {
    IssueSeverity.CRITICAL: "严重",
    IssueSeverity.HIGH: "高",
    IssueSeverity.MEDIUM: "中",
    IssueSeverity.LOW: "低",
}

ISSUE_TYPE_LABELS = {
    IssueType.SHOCK_PEAK: "冲击峰值",
    IssueType.TEMPERATURE_OVER: "温度过高",
    IssueType.TEMPERATURE_UNDER: "温度过低",
    IssueType.HUMIDITY_OVER: "湿度过高",
    IssueType.HUMIDITY_UNDER: "湿度过低",
    IssueType.OPENBOX_MISMATCH: "开箱时段不一致",
    IssueType.MISSING_PHOTO: "照片缺失",
    IssueType.MISSING_EVIDENCE: "证据缺失",
    IssueType.MISSING_SAMPLE: "缺采样",
}


class MarkdownReportGenerator:
    """Markdown报告生成器"""
    
    def __init__(self):
        pass
    
    def generate(self, audit: AuditPackage, output_path: str | Path) -> Path:
        """
        生成Markdown报告
        
        Args:
            audit: 审计包
            output_path: 输出路径
            
        Returns:
            生成的文件路径
        """
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        content = self._build_report(audit)
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
        
        return output_path
    
    def _build_report(self, audit: AuditPackage) -> str:
        """构建报告内容"""
        sections = []
        
        sections.append(self._build_header(audit))
        sections.append(self._build_summary(audit))
        sections.append(self._build_shipment_info(audit))
        sections.append(self._build_route_info(audit))
        sections.append(self._build_box_info(audit))
        sections.append(self._build_issues_by_severity(audit))
        sections.append(self._build_issues_detail(audit))
        sections.append(self._build_reviews(audit))
        sections.append(self._build_footer(audit))
        
        return "\n\n---\n\n".join(sections)
    
    def _build_header(self, audit: AuditPackage) -> str:
        """构建报告头部"""
        lines = [
            "# 展品运输到馆复核报告",
            "",
            f"> 运输批次: **{audit.metadata.shipment_id}**",
            f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
        ]
        
        if audit.metadata.operator:
            lines.append(f"> 操作人员: {audit.metadata.operator}")
        
        return "\n".join(lines)
    
    def _build_summary(self, audit: AuditPackage) -> str:
        """构建问题摘要"""
        critical = sum(1 for i in audit.issues if i.severity == IssueSeverity.CRITICAL)
        high = sum(1 for i in audit.issues if i.severity == IssueSeverity.HIGH)
        medium = sum(1 for i in audit.issues if i.severity == IssueSeverity.MEDIUM)
        low = sum(1 for i in audit.issues if i.severity == IssueSeverity.LOW)
        total = len(audit.issues)
        
        lines = [
            "## 问题摘要",
            "",
            "| 严重程度 | 数量 | 图标 |",
            "|---------|------|------|",
            f"| 严重 | {critical} | 🔴 |",
            f"| 高 | {high} | 🟠 |",
            f"| 中 | {medium} | 🟡 |",
            f"| 低 | {low} | 🟢 |",
            f"| **总计** | **{total}** | - |",
            "",
        ]
        
        if total == 0:
            lines.append("✅ **未检测到任何问题，运输状况良好**")
        elif critical == 0:
            lines.append("⚠️ 检测到问题，但无严重级别问题")
        else:
            lines.append("🚨 **检测到严重级别问题，请立即复核**")
        
        return "\n".join(lines)
    
    def _build_shipment_info(self, audit: AuditPackage) -> str:
        """构建运输信息"""
        if not audit.config:
            return "## 运输信息\n\n*暂无运输配置信息*"
        
        config = audit.config
        
        lines = [
            "## 运输信息",
            "",
            "| 项目 | 内容 |",
            "|------|------|",
            f"| 批次编号 | {config.shipment_id} |",
            f"| 批次名称 | {config.shipment_name} |",
            f"| 始发地 | {config.origin} |",
            f"| 目的地 | {config.destination} |",
            f"| 承运方 | {config.carrier} |",
            f"| 运输方式 | {config.transport_mode} |",
            "",
            "### 阈值设置",
            "",
            "| 项目 | 阈值 |",
            "|------|------|",
            f"| 冲击阈值 | {config.thresholds.shock_threshold_g}g |",
            f"| 温度范围 | {config.thresholds.temp_min_celsius}°C - {config.thresholds.temp_max_celsius}°C |",
            f"| 湿度范围 | {config.thresholds.humidity_min_pct}% - {config.thresholds.humidity_max_pct}% |",
            f"| 采样间隔 | {config.thresholds.sample_interval_seconds}秒 |",
        ]
        
        return "\n".join(lines)
    
    def _build_route_info(self, audit: AuditPackage) -> str:
        """构建路书信息"""
        if not audit.route_book:
            return "## 路书信息\n\n*暂无路书信息*"
        
        route = audit.route_book
        
        lines = [
            "## 路书信息",
            "",
            f"**路书编号**: {route.route_id}",
            f"**始发地**: {route.origin}",
            f"**目的地**: {route.destination}",
            "",
            "### 路书节点",
            "",
            "| 序号 | 地点 | 阶段 | 计划时间 |",
            "|------|------|------|----------|",
        ]
        
        for node in route.nodes:
            phase_label = {
                "departure": "出发",
                "transit": "运输",
                "stopover": "经停",
                "arrival": "到达",
                "checkpoint": "检查点",
            }.get(node.phase.value, node.phase.value)
            
            time_range = f"{node.planned_start_time} 至 {node.planned_end_time}"
            
            lines.append(f"| {node.node_order} | {node.location} | {phase_label} | {time_range} |")
        
        return "\n".join(lines)
    
    def _build_box_info(self, audit: AuditPackage) -> str:
        """构建展箱信息"""
        if not audit.boxes:
            return "## 展箱信息\n\n*暂无展箱信息*"
        
        lines = [
            "## 展箱信息",
            "",
            "| 箱号 | 名称 | 传感器 | 展品数量 |",
            "|------|------|--------|----------|",
        ]
        
        for box in audit.boxes:
            sensor_count = len(box.sensor_ids)
            content_count = len(box.contents)
            box_name = box.box_name or "-"
            
            lines.append(f"| {box.box_id} | {box_name} | {sensor_count}个 | {content_count}件 |")
        
        return "\n".join(lines)
    
    def _build_issues_by_severity(self, audit: AuditPackage) -> str:
        """按严重程度分类的问题"""
        if not audit.issues:
            return ""
        
        lines = [
            "## 问题分类统计",
            "",
        ]
        
        by_type: dict[IssueType, list[Issue]] = {}
        for issue in audit.issues:
            if issue.issue_type not in by_type:
                by_type[issue.issue_type] = []
            by_type[issue.issue_type].append(issue)
        
        if by_type:
            lines.append("| 问题类型 | 数量 |")
            lines.append("|---------|------|")
            
            for issue_type, issues in sorted(by_type.items(), key=lambda x: -len(x[1])):
                type_label = ISSUE_TYPE_LABELS.get(issue_type, issue_type.value)
                lines.append(f"| {type_label} | {len(issues)} |")
        
        return "\n".join(lines)
    
    def _build_issues_detail(self, audit: AuditPackage) -> str:
        """构建问题详情"""
        if not audit.issues:
            return "## 问题详情\n\n*未检测到任何问题*"
        
        lines = [
            "## 问题详情",
            "",
        ]
        
        sorted_issues = sorted(
            audit.issues,
            key=lambda i: [
                IssueSeverity.CRITICAL,
                IssueSeverity.HIGH,
                IssueSeverity.MEDIUM,
                IssueSeverity.LOW,
            ].index(i.severity)
        )
        
        for i, issue in enumerate(sorted_issues, 1):
            icon = SEVERITY_ICONS.get(issue.severity, "")
            severity_label = SEVERITY_LABELS.get(issue.severity, issue.severity.value)
            type_label = ISSUE_TYPE_LABELS.get(issue.issue_type, issue.issue_type.value)
            
            lines.append(f"### {icon} 问题 {i}: {type_label} ({severity_label})")
            lines.append("")
            lines.append(f"**问题ID**: {issue.issue_id}")
            lines.append(f"**描述**: {issue.description}")
            
            if issue.box_id:
                lines.append(f"**展箱编号**: {issue.box_id}")
            if issue.sensor_id:
                lines.append(f"**传感器编号**: {issue.sensor_id}")
            if issue.route_node_id:
                lines.append(f"**路书节点**: {issue.route_node_id}")
            if issue.start_time:
                lines.append(f"**开始时间**: {issue.start_time}")
            if issue.end_time:
                lines.append(f"**结束时间**: {issue.end_time}")
            
            lines.append(f"**检测时间**: {issue.detected_at}")
            
            if issue.notes:
                lines.append(f"**备注**: {issue.notes}")
            
            lines.append("")
        
        return "\n".join(lines)
    
    def _build_reviews(self, audit: AuditPackage) -> str:
        """构建复核记录"""
        if not audit.reviews:
            return "## 复核记录\n\n*暂无复核记录*"
        
        lines = [
            "## 复核记录",
            "",
            "| 复核ID | 问题ID | 复核人 | 状态 | 结论 | 复核时间 |",
            "|--------|--------|--------|------|------|----------|",
        ]
        
        status_labels = {
            ReviewStatus.PENDING: "待处理",
            ReviewStatus.UNDER_REVIEW: "复核中",
            ReviewStatus.APPROVED: "已通过",
            ReviewStatus.REJECTED: "已拒绝",
            ReviewStatus.NEEDS_CLARIFICATION: "需澄清",
        }
        
        conclusion_labels = {
            ReviewConclusion.ACCEPTABLE: "可接受",
            ReviewConclusion.ACCEPTABLE_WITH_COMMENTS: "有条件接受",
            ReviewConclusion.UNACCEPTABLE: "不可接受",
            ReviewConclusion.REQUIRES_FURTHER_INVESTIGATION: "需进一步调查",
        }
        
        for review in audit.reviews:
            status_label = status_labels.get(review.status, review.status.value)
            conclusion_label = conclusion_labels.get(review.conclusion, "-") if review.conclusion else "-"
            
            lines.append(
                f"| {review.review_id} | {review.issue_id} | {review.reviewer} | "
                f"{status_label} | {conclusion_label} | {review.review_time} |"
            )
        
        return "\n".join(lines)
    
    def _build_footer(self, audit: AuditPackage) -> str:
        """构建报告页脚"""
        lines = [
            "## 报告附注",
            "",
            "> 本报告由「展箱震动温湿度复核员」工具自动生成",
            f"> 工具版本: {audit.metadata.tool_version}",
            f"> 会话ID: {audit.metadata.session_id}",
            "",
        ]
        
        if audit.metadata.created_at:
            lines.append(f"> 会话创建时间: {audit.metadata.created_at}")
        if audit.metadata.updated_at:
            lines.append(f"> 会话更新时间: {audit.metadata.updated_at}")
        
        return "\n".join(lines)


def generate_markdown_report(audit: AuditPackage, output_path: str | Path) -> Path:
    """便捷函数：生成Markdown报告"""
    generator = MarkdownReportGenerator()
    return generator.generate(audit, output_path)
