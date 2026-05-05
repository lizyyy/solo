"""报告导出器：Markdown 和 JSON 格式"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from .models import (
    AnalysisSession,
    Issue,
    IssueSeverity,
    MagicMethodCall,
    MagicMethodType,
)


class MarkdownExporter:
    """Markdown 格式报告导出器"""
    
    @staticmethod
    def export(
        session: AnalysisSession,
        output_path: Optional[Union[str, Path]] = None,
        include_calls: bool = True,
    ) -> str:
        """导出 Markdown 报告"""
        lines = []
        
        # 标题
        lines.append(f"# 魔术方法分析报告 - {session.session_id}")
        lines.append("")
        
        # 基本信息
        lines.append("## 基本信息")
        lines.append("")
        lines.append(f"- **会话 ID**: {session.session_id}")
        lines.append(f"- **开始时间**: {session.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        if session.end_time:
            lines.append(f"- **结束时间**: {session.end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"- **源文件**: {', '.join(session.source_files) if session.source_files else '无'}")
        lines.append(f"- **方法调用次数**: {len(session.method_calls)}")
        lines.append(f"- **发现问题数**: {len(session.issues)}")
        lines.append("")
        
        # 问题汇总
        if session.issues:
            lines.append("## 问题汇总")
            lines.append("")
            
            # 按严重程度分类
            critical_issues = [i for i in session.issues if i.severity == IssueSeverity.CRITICAL]
            warning_issues = [i for i in session.issues if i.severity == IssueSeverity.WARNING]
            info_issues = [i for i in session.issues if i.severity == IssueSeverity.INFO]
            
            lines.append(f"- **严重问题**: {len(critical_issues)} 个")
            lines.append(f"- **警告**: {len(warning_issues)} 个")
            lines.append(f"- **提示**: {len(info_issues)} 个")
            lines.append("")
            
            # 详细问题列表
            if critical_issues:
                lines.append("### 严重问题")
                lines.append("")
                for idx, issue in enumerate(critical_issues, 1):
                    lines.append(f"#### {idx}. {issue.title}")
                    lines.append("")
                    lines.append(f"**类型**: {issue.issue_type.value}")
                    lines.append(f"**位置**: {issue.location}")
                    lines.append("")
                    lines.append("**描述**:")
                    lines.append("")
                    lines.append(f"> {issue.description}")
                    lines.append("")
                    if issue.suggestion:
                        lines.append("**建议**:")
                        lines.append("")
                        lines.append(f"> {issue.suggestion}")
                    lines.append("")
            
            if warning_issues:
                lines.append("### 警告")
                lines.append("")
                for idx, issue in enumerate(warning_issues, 1):
                    lines.append(f"#### {idx}. {issue.title}")
                    lines.append("")
                    lines.append(f"**类型**: {issue.issue_type.value}")
                    lines.append(f"**位置**: {issue.location}")
                    lines.append("")
                    lines.append("**描述**:")
                    lines.append("")
                    lines.append(f"> {issue.description}")
                    lines.append("")
                    if issue.suggestion:
                        lines.append("**建议**:")
                        lines.append("")
                        lines.append(f"> {issue.suggestion}")
                    lines.append("")
            
            if info_issues:
                lines.append("### 提示")
                lines.append("")
                for idx, issue in enumerate(info_issues, 1):
                    lines.append(f"#### {idx}. {issue.title}")
                    lines.append("")
                    lines.append(f"**类型**: {issue.issue_type.value}")
                    lines.append(f"**位置**: {issue.location}")
                    lines.append("")
                    lines.append("**描述**:")
                    lines.append("")
                    lines.append(f"> {issue.description}")
                    lines.append("")
        
        # 方法调用序列
        if include_calls and session.method_calls:
            lines.append("## 方法调用序列")
            lines.append("")
            
            # 按目标对象分组
            from collections import defaultdict
            calls_by_target = defaultdict(list)
            for call in session.method_calls:
                calls_by_target[call.target].append(call)
            
            for target, calls in calls_by_target.items():
                lines.append(f"### 对象: {target}")
                lines.append("")
                lines.append("| 序号 | 方法 | 时间 | 调用者 | 参数 | 结果 | 异常 |")
                lines.append("|------|------|------|--------|------|------|------|")
                
                for idx, call in enumerate(sorted(calls, key=lambda x: x.timestamp), 1):
                    args_str = str(call.args)[:30] if call.args else "-"
                    result_str = str(call.result)[:30] if call.result is not None else "-"
                    exception_str = "是" if call.exception else "-"
                    
                    lines.append(
                        f"| {idx} | {call.method_type.value} | "
                        f"{call.timestamp.strftime('%H:%M:%S.%f')[:-3]} | "
                        f"{call.caller} | {args_str} | {result_str} | {exception_str} |"
                    )
                lines.append("")
        
        # 方法调用统计
        lines.append("## 方法调用统计")
        lines.append("")
        
        from collections import Counter
        method_counts = Counter(c.method_type.value for c in session.method_calls)
        
        lines.append("| 方法 | 调用次数 |")
        lines.append("|------|----------|")
        for method, count in sorted(method_counts.items(), key=lambda x: -x[1]):
            lines.append(f"| {method} | {count} |")
        lines.append("")
        
        # 生成时间
        lines.append("---")
        lines.append("")
        lines.append(f"报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        content = "\n".join(lines)
        
        if output_path:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(content, encoding="utf-8")
        
        return content


class JSONExporter:
    """JSON 格式报告导出器"""
    
    @staticmethod
    def export(
        session: AnalysisSession,
        output_path: Optional[Union[str, Path]] = None,
        indent: int = 2,
    ) -> str:
        """导出 JSON 报告"""
        data = {
            "session_id": session.session_id,
            "start_time": session.start_time.isoformat(),
            "end_time": session.end_time.isoformat() if session.end_time else None,
            "source_files": session.source_files,
            "metadata": session.metadata,
            "summary": {
                "method_calls_count": len(session.method_calls),
                "issues_count": len(session.issues),
                "issues_by_severity": JSONExporter._count_issues_by_severity(session.issues),
                "issues_by_type": JSONExporter._count_issues_by_type(session.issues),
            },
            "issues": [
                {
                    "type": issue.issue_type.value,
                    "severity": issue.severity.value,
                    "title": issue.title,
                    "description": issue.description,
                    "location": issue.location,
                    "suggestion": issue.suggestion,
                    "metadata": issue.metadata,
                }
                for issue in session.issues
            ],
            "method_calls": [
                call.to_dict() for call in session.method_calls
            ],
            "generated_at": datetime.now().isoformat(),
        }
        
        content = json.dumps(data, ensure_ascii=False, indent=indent)
        
        if output_path:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(content, encoding="utf-8")
        
        return content
    
    @staticmethod
    def _count_issues_by_severity(issues: List[Issue]) -> Dict[str, int]:
        """按严重程度统计问题"""
        from collections import Counter
        return Counter(issue.severity.value for issue in issues)
    
    @staticmethod
    def _count_issues_by_type(issues: List[Issue]) -> Dict[str, int]:
        """按类型统计问题"""
        from collections import Counter
        return Counter(issue.issue_type.value for issue in issues)


class ComparisonExporter:
    """会话比较报告导出器"""
    
    @staticmethod
    def compare(
        session1: AnalysisSession,
        session2: AnalysisSession,
        output_path: Optional[Union[str, Path]] = None,
    ) -> str:
        """比较两个分析会话"""
        lines = []
        
        lines.append("# 会话比较报告")
        lines.append("")
        
        lines.append("## 基本信息")
        lines.append("")
        lines.append("| 属性 | 会话 1 | 会话 2 |")
        lines.append("|------|--------|--------|")
        lines.append(f"| 会话 ID | {session1.session_id} | {session2.session_id} |")
        lines.append(f"| 开始时间 | {session1.start_time.strftime('%Y-%m-%d %H:%M:%S')} | {session2.start_time.strftime('%Y-%m-%d %H:%M:%S')} |")
        lines.append(f"| 源文件 | {', '.join(session1.source_files) or '-'} | {', '.join(session2.source_files) or '-'} |")
        lines.append(f"| 方法调用数 | {len(session1.method_calls)} | {len(session2.method_calls)} |")
        lines.append(f"| 问题数 | {len(session1.issues)} | {len(session2.issues)} |")
        lines.append("")
        
        # 方法差异
        lines.append("## 方法调用差异")
        lines.append("")
        
        from collections import Counter
        methods1 = Counter(c.method_type.value for c in session1.method_calls)
        methods2 = Counter(c.method_type.value for c in session2.method_calls)
        
        all_methods = set(methods1.keys()) | set(methods2.keys())
        
        lines.append("| 方法 | 会话 1 次数 | 会话 2 次数 | 差异 |")
        lines.append("|------|-------------|-------------|------|")
        for method in sorted(all_methods):
            c1 = methods1.get(method, 0)
            c2 = methods2.get(method, 0)
            diff = c2 - c1
            diff_str = f"+{diff}" if diff > 0 else str(diff)
            lines.append(f"| {method} | {c1} | {c2} | {diff_str} |")
        lines.append("")
        
        # 问题差异
        lines.append("## 问题差异")
        lines.append("")
        
        critical1 = sum(1 for i in session1.issues if i.severity == IssueSeverity.CRITICAL)
        critical2 = sum(1 for i in session2.issues if i.severity == IssueSeverity.CRITICAL)
        warning1 = sum(1 for i in session1.issues if i.severity == IssueSeverity.WARNING)
        warning2 = sum(1 for i in session2.issues if i.severity == IssueSeverity.WARNING)
        
        lines.append("| 严重程度 | 会话 1 | 会话 2 | 变化 |")
        lines.append("|----------|--------|--------|------|")
        lines.append(f"| 严重 | {critical1} | {critical2} | {critical2 - critical1:+d} |")
        lines.append(f"| 警告 | {warning1} | {warning2} | {warning2 - warning1:+d} |")
        lines.append("")
        
        # 生成时间
        lines.append("---")
        lines.append("")
        lines.append(f"报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        content = "\n".join(lines)
        
        if output_path:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(content, encoding="utf-8")
        
        return content
