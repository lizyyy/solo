"""
报告导出模块
支持导出Markdown和JSON格式的分析报告
"""

import json
import os
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path

from memprofiler.models import (
    AnalysisResult,
    LeakSuspect,
    CycleReference,
    LeakSeverity,
    IssueType,
)
from memprofiler.utils import format_size


class BaseExporter:
    """基础导出器"""
    
    def __init__(self, analysis_result: AnalysisResult):
        self.result = analysis_result
    
    def _severity_to_emoji(self, severity: LeakSeverity) -> str:
        """严重程度转emoji"""
        mapping = {
            LeakSeverity.CRITICAL: "🔴",
            LeakSeverity.HIGH: "🟠",
            LeakSeverity.MEDIUM: "🟡",
            LeakSeverity.LOW: "🟢",
            LeakSeverity.INFO: "🔵",
        }
        return mapping.get(severity, "⚪")
    
    def _severity_to_text(self, severity: LeakSeverity) -> str:
        """严重程度转中文文本"""
        mapping = {
            LeakSeverity.CRITICAL: "严重",
            LeakSeverity.HIGH: "高",
            LeakSeverity.MEDIUM: "中",
            LeakSeverity.LOW: "低",
            LeakSeverity.INFO: "信息",
        }
        return mapping.get(severity, "未知")
    
    def _issue_type_to_text(self, issue_type: IssueType) -> str:
        """问题类型转中文文本"""
        mapping = {
            IssueType.CYCLE_REFERENCE: "循环引用",
            IssueType.DEL_METHOD: "__del__方法问题",
            IssueType.REF_COUNT_LEAK: "引用计数泄漏",
            IssueType.WEAKREF_INVALID: "弱引用问题",
            IssueType.CACHE_RESIDUE: "缓存容器残留",
            IssueType.LARGE_OBJECT: "大对象",
            IssueType.UNCOLLECTABLE: "不可回收对象",
        }
        return mapping.get(issue_type, "未知问题")


class MarkdownExporter(BaseExporter):
    """Markdown格式导出器"""
    
    def export(self) -> str:
        """导出Markdown格式报告"""
        lines = []
        
        lines.append(self._generate_header())
        lines.append("")
        
        lines.append(self._generate_summary())
        lines.append("")
        
        if self.result.suspects:
            lines.append(self._generate_suspects_section())
            lines.append("")
        
        if self.result.cycles:
            lines.append(self._generate_cycles_section())
            lines.append("")
        
        lines.append(self._generate_footer())
        
        return "\n".join(lines)
    
    def _generate_header(self) -> str:
        """生成报告头部"""
        timestamp = self.result.timestamp.strftime("%Y-%m-%d %H:%M:%S") if self.result.timestamp else "未知"
        
        lines = [
            "# Python内存问题分析报告",
            "",
            f"> 分析ID: {self.result.analysis_id}",
            f"> 分析时间: {timestamp}",
            f"> 分析状态: {self.result.status}",
        ]
        
        if self.result.error_message:
            lines.append(f"> 错误信息: {self.result.error_message}")
        
        return "\n".join(lines)
    
    def _generate_summary(self) -> str:
        """生成摘要部分"""
        summary = self.result.summary or {}
        
        lines = [
            "## 分析摘要",
            "",
        ]
        
        risk_level = summary.get("risk_level", "未知")
        risk_emoji = "🟢"
        if risk_level == "严重":
            risk_emoji = "🔴"
        elif risk_level == "高":
            risk_emoji = "🟠"
        elif risk_level == "中":
            risk_emoji = "🟡"
        
        lines.append(f"**风险等级**: {risk_emoji} {risk_level}")
        lines.append("")
        
        total_suspects = summary.get("total_suspects", 0)
        total_cycles = summary.get("total_cycles", 0)
        
        lines.append(f"- **嫌疑对象总数**: {total_suspects} 个")
        lines.append(f"- **循环引用总数**: {total_cycles} 个")
        lines.append(f"- **分析对象数**: {summary.get('total_objects_analyzed', 0)} 个")
        lines.append(f"- **分析引用数**: {summary.get('total_references_analyzed', 0)} 个")
        lines.append(f"- **嫌疑对象总大小**: {summary.get('total_suspect_size_formatted', '0 B')}")
        lines.append("")
        
        severity_breakdown = summary.get("severity_breakdown", {})
        if severity_breakdown:
            lines.append("### 严重程度分布")
            lines.append("")
            lines.append("| 严重程度 | 数量 |")
            lines.append("|----------|------|")
            
            severity_order = ["critical", "high", "medium", "low", "info"]
            severity_names = {
                "critical": "🔴 严重",
                "high": "🟠 高",
                "medium": "🟡 中",
                "low": "🟢 低",
                "info": "🔵 信息",
            }
            
            for sev in severity_order:
                count = severity_breakdown.get(sev, 0)
                lines.append(f"| {severity_names.get(sev, sev)} | {count} |")
            
            lines.append("")
        
        issue_breakdown = summary.get("issue_type_breakdown", {})
        if issue_breakdown:
            lines.append("### 问题类型分布")
            lines.append("")
            lines.append("| 问题类型 | 数量 |")
            lines.append("|----------|------|")
            
            issue_names = {
                "cycle_reference": "循环引用",
                "del_method": "__del__方法问题",
                "ref_count_leak": "引用计数泄漏",
                "weakref_invalid": "弱引用问题",
                "cache_residue": "缓存容器残留",
                "large_object": "大对象",
                "uncollectable": "不可回收对象",
            }
            
            for issue_type, count in sorted(issue_breakdown.items(), key=lambda x: -x[1]):
                lines.append(f"| {issue_names.get(issue_type, issue_type)} | {count} |")
            
            lines.append("")
        
        return "\n".join(lines)
    
    def _generate_suspects_section(self) -> str:
        """生成嫌疑对象部分"""
        lines = [
            "## 泄漏嫌疑排行",
            "",
            "> 按严重程度和大小排序",
            "",
        ]
        
        for i, suspect in enumerate(self.result.suspects[:20], 1):
            severity_emoji = self._severity_to_emoji(suspect.severity)
            severity_text = self._severity_to_text(suspect.severity)
            issue_text = self._issue_type_to_text(suspect.issue_type)
            
            lines.append(f"### {i}. {severity_emoji} {issue_text} ({severity_text})")
            lines.append("")
            
            lines.append(f"- **对象类型**: {suspect.obj_type}")
            lines.append(f"- **对象ID**: {suspect.obj_id or '未知'}")
            lines.append(f"- **大小**: {format_size(suspect.size)}")
            lines.append("")
            
            if suspect.evidence:
                lines.append("#### 证据")
                lines.append("")
                for ev in suspect.evidence:
                    lines.append(f"- {ev}")
                lines.append("")
            
            if suspect.suggestions:
                lines.append("#### 释放建议")
                lines.append("")
                for sug in suspect.suggestions:
                    lines.append(f"- {sug}")
                lines.append("")
            
            if suspect.reference_chain and len(suspect.reference_chain) > 1:
                lines.append("#### 引用链")
                lines.append("")
                chain_str = " → ".join(suspect.reference_chain[:10])
                if len(suspect.reference_chain) > 10:
                    chain_str += " → ..."
                lines.append(f"`{chain_str}`")
                lines.append("")
        
        if len(self.result.suspects) > 20:
            lines.append(f"> 仅显示前20个嫌疑对象，共 {len(self.result.suspects)} 个")
            lines.append("")
        
        return "\n".join(lines)
    
    def _generate_cycles_section(self) -> str:
        """生成循环引用部分"""
        lines = [
            "## 循环引用详情",
            "",
        ]
        
        for i, cycle in enumerate(self.result.cycles[:10], 1):
            status = "⚠️ 不可回收" if cycle.is_uncollectable else "✅ 可回收"
            has_del_note = " (包含 __del__ 方法)" if cycle.has_del else ""
            
            lines.append(f"### 循环引用 #{i} {status}{has_del_note}")
            lines.append("")
            
            lines.append(f"- **涉及对象数**: {len(cycle.objects)}")
            lines.append(f"- **总大小**: {format_size(cycle.size)}")
            lines.append("")
            
            if cycle.evidence:
                lines.append(f"**说明**: {cycle.evidence}")
                lines.append("")
            
            lines.append("**对象链**:")
            lines.append("")
            lines.append("```")
            chain_str = " → ".join(cycle.objects)
            lines.append(f"{chain_str} → {cycle.objects[0]}")
            lines.append("```")
            lines.append("")
        
        if len(self.result.cycles) > 10:
            lines.append(f"> 仅显示前10个循环引用，共 {len(self.result.cycles)} 个")
            lines.append("")
        
        return "\n".join(lines)
    
    def _generate_footer(self) -> str:
        """生成页脚"""
        lines = [
            "---",
            "",
            "*此报告由 MemProfiler 生成*",
            "",
            "### 快速修复建议",
            "",
            "1. **循环引用**: 使用 `weakref` 模块打破循环",
            "2. **__del__ 方法**: 避免在循环引用对象中使用，改用 `contextlib.closing` 或显式 `close()` 方法",
            "3. **大对象**: 考虑惰性加载或使用弱引用缓存",
            "4. **缓存残留**: 使用 `WeakKeyDictionary` 或 `WeakValueDictionary`",
        ]
        
        return "\n".join(lines)


class JsonExporter(BaseExporter):
    """JSON格式导出器"""
    
    def export(self, indent: int = 2) -> str:
        """导出JSON格式报告"""
        report = {
            "metadata": {
                "analysis_id": self.result.analysis_id,
                "timestamp": self.result.timestamp.isoformat() if self.result.timestamp else None,
                "status": self.result.status,
                "error_message": self.result.error_message,
                "generator": "MemProfiler",
                "version": "0.1.0",
            },
            "summary": self.result.summary or {},
            "suspects": [],
            "cycles": [],
        }
        
        for suspect in self.result.suspects:
            report["suspects"].append({
                "suspect_id": suspect.suspect_id,
                "obj_id": suspect.obj_id,
                "obj_type": suspect.obj_type,
                "issue_type": suspect.issue_type.value,
                "issue_type_name": self._issue_type_to_text(suspect.issue_type),
                "severity": suspect.severity.value,
                "severity_name": self._severity_to_text(suspect.severity),
                "size": suspect.size,
                "size_formatted": format_size(suspect.size),
                "evidence": suspect.evidence,
                "suggestions": suspect.suggestions,
                "reference_chain": suspect.reference_chain,
            })
        
        for cycle in self.result.cycles:
            report["cycles"].append({
                "cycle_id": cycle.cycle_id,
                "objects": cycle.objects,
                "object_count": len(cycle.objects),
                "size": cycle.size,
                "size_formatted": format_size(cycle.size),
                "has_del": cycle.has_del,
                "is_uncollectable": cycle.is_uncollectable,
                "evidence": cycle.evidence,
            })
        
        return json.dumps(report, ensure_ascii=False, indent=indent)


def export_to_file(result: AnalysisResult, output_path: str, 
                   format: str = "markdown") -> str:
    """导出到文件"""
    if format == "json":
        exporter = JsonExporter(result)
        content = exporter.export()
    else:
        exporter = MarkdownExporter(result)
        content = exporter.export()
    
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)
    
    return output_path
