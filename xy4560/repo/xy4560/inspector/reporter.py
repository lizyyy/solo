"""报告导出器 - 导出 Markdown 验收报告和 JSON 明细"""

import json
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field


@dataclass
class ReportConfig:
    """报告配置"""
    
    include_success_details: bool = True
    include_command_output: bool = True
    max_output_lines: int = 50
    include_suggestions: bool = True


class ReportExporter:
    """报告导出器"""
    
    def __init__(self, db_manager):
        self.db = db_manager
        self.config = ReportConfig()
    
    def export_markdown(self, run_id: int, output_path: str = None) -> str:
        """导出 Markdown 报告"""
        summary = self.db.get_run_summary(run_id)
        if not summary:
            return "# 报告错误\n\n未找到运行记录。"
        
        run_info = summary.get("run", {})
        commands_info = summary.get("commands", {})
        issues_info = summary.get("issues", {})
        
        md = self._generate_header(run_info)
        md += self._generate_summary(run_info, commands_info, issues_info)
        md += self._generate_issues_section(issues_info)
        md += self._generate_commands_section(summary)
        md += self._generate_footer()
        
        if output_path:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(md)
        
        return md
    
    def export_json(self, run_id: int, output_path: str = None) -> str:
        """导出 JSON 明细"""
        json_str = self.db.export_to_json(run_id)
        
        if output_path:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(json_str)
        
        return json_str
    
    def _generate_header(self, run_info: Dict) -> str:
        """生成报告头部"""
        project_dir = run_info.get("project_dir", "")
        run_time = run_info.get("run_time", "")
        
        if run_time:
            try:
                dt = datetime.fromisoformat(run_time)
                formatted_time = dt.strftime("%Y-%m-%d %H:%M:%S")
            except ValueError:
                formatted_time = run_time
        else:
            formatted_time = "未知"
        
        status = run_info.get("status", "unknown")
        status_icon = {
            "completed": "✅",
            "failed": "❌",
            "running": "⏳",
            "partial": "⚠️"
        }.get(status, "❓")
        
        return f"""# 交付验收巡检报告

**项目目录**: `{project_dir}`

**检查时间**: {formatted_time}

**状态**: {status_icon} {status.upper()}

---

"""
    
    def _generate_summary(
        self, 
        run_info: Dict, 
        commands_info: Dict, 
        issues_info: Dict
    ) -> str:
        """生成摘要部分"""
        total_commands = commands_info.get("total", 0)
        by_result = commands_info.get("by_result", {})
        
        success = by_result.get("success", 0)
        failed = by_result.get("failed", 0)
        blocked = by_result.get("blocked", 0)
        
        total_issues = issues_info.get("total", 0)
        false_positives = run_info.get("false_positives_marked", 0)
        
        by_severity = issues_info.get("by_severity", {})
        critical = by_severity.get("critical", 0)
        high = by_severity.get("high", 0)
        medium = by_severity.get("medium", 0)
        low = by_severity.get("low", 0)
        
        duration = run_info.get("duration", 0)
        duration_str = f"{duration:.2f} 秒" if duration < 60 else f"{duration/60:.2f} 分钟"
        
        pass_rate = (success / total_commands * 100) if total_commands > 0 else 0
        
        md = """## 📊 检查摘要

### 命令执行情况

| 统计项 | 数量 |
|--------|------|
| 总命令数 | {total_commands} |
| ✅ 成功 | {success} |
| ❌ 失败 | {failed} |
| 🚫 被阻止 | {blocked} |
| 📈 通过率 | {pass_rate:.1f}% |
| ⏱️ 总耗时 | {duration_str} |

### 问题发现情况

| 严重程度 | 数量 |
|----------|------|
| 🔥 严重 | {critical} |
| 🔴 高 | {high} |
| 🟡 中 | {medium} |
| 🟢 低 | {low} |
| 📋 总计 | {total_issues} |
| ✅ 已标记误报 | {false_positives} |

""".format(
            total_commands=total_commands,
            success=success,
            failed=failed,
            blocked=blocked,
            pass_rate=pass_rate,
            duration_str=duration_str,
            critical=critical,
            high=high,
            medium=medium,
            low=low,
            total_issues=total_issues,
            false_positives=false_positives
        )
        
        by_category = issues_info.get("by_category", {})
        if by_category:
            md += "\n### 问题分类\n\n"
            md += "| 分类 | 数量 |\n"
            md += "|------|------|\n"
            for category, count in sorted(by_category.items(), key=lambda x: x[1], reverse=True):
                md += f"| {category} | {count} |\n"
            md += "\n"
        
        return md + "---\n\n"
    
    def _generate_issues_section(self, issues_info: Dict) -> str:
        """生成问题详情部分"""
        issues_list = issues_info.get("list", [])
        
        if not issues_list:
            return """## 🎯 问题详情

**🎉 未发现任何问题！所有检查项均通过。**

---

"""
        
        md = "## 🎯 问题详情\n\n"
        
        severity_icons = {
            "critical": "🔥",
            "high": "🔴",
            "medium": "🟡",
            "low": "🟢"
        }
        
        grouped = {}
        for issue in issues_list:
            category = issue.get("category", "其他")
            if category not in grouped:
                grouped[category] = []
            grouped[category].append(issue)
        
        for category, issues in grouped.items():
            md += f"### {category}\n\n"
            
            for i, issue in enumerate(issues, 1):
                severity = issue.get("severity", "medium")
                icon = severity_icons.get(severity, "⚠️")
                
                issue_type = issue.get("issue_type", "unknown")
                description = issue.get("description", "")
                command = issue.get("command", "")
                expected = issue.get("expected", "")
                actual = issue.get("actual", "")
                suggestion = issue.get("suggestion", "")
                
                md += f"**{i}. {icon} [{severity.upper()}] {issue_type}**\n\n"
                
                if description:
                    md += f"{description}\n\n"
                
                if command:
                    md += f"**命令**: `{command}`\n\n"
                
                if expected:
                    md += f"**期望**: {expected}\n\n"
                
                if actual:
                    md += f"**实际**: {actual}\n\n"
                
                if self.config.include_suggestions and suggestion:
                    md += f"💡 **建议**: {suggestion}\n\n"
                
                md += "---\n\n"
        
        return md
    
    def _generate_commands_section(self, summary: Dict) -> str:
        """生成命令执行详情部分"""
        run_id = summary.get("run", {}).get("id")
        if not run_id:
            return ""
        
        commands = self.db.get_command_records(run_id)
        if not commands:
            return ""
        
        md = "## 📜 命令执行记录\n\n"
        
        result_icons = {
            "success": "✅",
            "failed": "❌",
            "blocked": "🚫",
            "timeout": "⏰",
            "skipped": "⏭️"
        }
        
        for i, cmd in enumerate(commands, 1):
            command = cmd.get("command", "")
            result = cmd.get("execution_result", "unknown")
            icon = result_icons.get(result, "❓")
            
            exit_code = cmd.get("exit_code")
            duration = cmd.get("duration", 0)
            new_ports = cmd.get("new_ports", [])
            new_files = cmd.get("new_files", [])
            key_output = cmd.get("key_output", [])
            
            md += f"### {i}. {icon} `{command}`\n\n"
            
            md += f"**结果**: {result.upper()}"
            if exit_code is not None:
                md += f" (退出码: {exit_code})"
            md += f" | **耗时**: {duration:.2f}s\n\n"
            
            if new_ports:
                md += f"🌐 **新开启端口**: {', '.join(map(str, new_ports))}\n\n"
            
            if new_files:
                md += f"📁 **新生成文件**: \n"
                for f in new_files:
                    md += f"  - `{f}`\n"
                md += "\n"
            
            if self.config.include_command_output and key_output:
                md += "📝 **关键输出**:\n"
                md += "```\n"
                for line in key_output[:self.config.max_output_lines]:
                    md += f"{line}\n"
                if len(key_output) > self.config.max_output_lines:
                    md += f"... (省略 {len(key_output) - self.config.max_output_lines} 行)\n"
                md += "```\n\n"
            
            md += "---\n\n"
        
        return md
    
    def _generate_footer(self) -> str:
        """生成报告页脚"""
        from inspector import __version__
        
        return f"""## 📋 报告信息

本报告由 **delivery-inspector v{__version__}** 自动生成。

**提示**: 
- 如发现误报，请使用 `delivery-inspector mark-false-positive` 命令标记
- 完整数据可查看同目录下的 JSON 明细文件

---

*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
    
    def generate_comparison_report(
        self, 
        run_ids: List[int], 
        output_path: str = None
    ) -> str:
        """生成多次运行的对比报告"""
        if len(run_ids) < 2:
            return "# 对比报告\n\n需要至少两个运行记录才能生成对比报告。"
        
        md = "# 多次检查对比报告\n\n"
        
        summaries = []
        for run_id in run_ids:
            summary = self.db.get_run_summary(run_id)
            if summary:
                summaries.append(summary)
        
        if len(summaries) < 2:
            return "# 对比报告\n\n无法获取足够的运行记录。"
        
        md += "| 运行ID | 时间 | 状态 | 命令数 | 成功 | 失败 | 问题数 |\n"
        md += "|--------|------|------|--------|------|------|--------|\n"
        
        for summary in summaries:
            run = summary.get("run", {})
            commands = summary.get("commands", {})
            issues = summary.get("issues", {})
            
            run_time = run.get("run_time", "")
            try:
                dt = datetime.fromisoformat(run_time)
                time_str = dt.strftime("%m-%d %H:%M")
            except ValueError:
                time_str = run_time
            
            md += f"| {run.get('id')} | {time_str} | {run.get('status')} | "
            md += f"{commands.get('total')} | {commands.get('by_result', {}).get('success', 0)} | "
            md += f"{commands.get('by_result', {}).get('failed', 0)} | {issues.get('total')} |\n"
        
        md += "\n---\n\n"
        
        if output_path:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(md)
        
        return md
