import csv
from pathlib import Path
from typing import List, Optional, TextIO

from .models import (
    Fixture, PatchEntry, ValidationResult, ValidationIssue,
    PlanResult, PlanAction, ProjectData, Severity
)


class Exporter:
    @staticmethod
    def export_fixtures_to_csv(fixtures: List[Fixture], file_path: str) -> None:
        path = Path(file_path)
        
        with open(path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                'ID', '名称', '制造商', '型号', '模式',
                '位置', '宇宙', '起始地址', '通道数', '备注'
            ])
            
            for fxt in fixtures:
                writer.writerow([
                    fxt.id,
                    fxt.name or '',
                    fxt.manufacturer,
                    fxt.model,
                    fxt.mode,
                    fxt.position or '',
                    fxt.universe,
                    fxt.start_address,
                    fxt.custom_channel_count or (fxt.end_address - fxt.start_address + 1),
                    fxt.note or ''
                ])

    @staticmethod
    def export_patch_to_csv(patch_entries: List[PatchEntry], file_path: str) -> None:
        path = Path(file_path)
        
        with open(path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                'ID', '宇宙', '起始地址', '灯具ID', '灯具名称',
                '模式', '通道数', '位置', '备注'
            ])
            
            for entry in patch_entries:
                writer.writerow([
                    entry.id,
                    entry.universe,
                    entry.start_address,
                    entry.fixture_id or '',
                    entry.fixture_name or '',
                    entry.mode or '',
                    entry.channel_count,
                    entry.position or '',
                    entry.note or ''
                ])

    @staticmethod
    def export_validation_to_markdown(result: ValidationResult, file_path: str,
                                        project_name: str = "DMX Patch Project") -> None:
        path = Path(file_path)
        
        lines = [
            f"# DMX Patch 校验报告 - {project_name}",
            "",
            f"**生成时间**: {result.timestamp.strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "## 摘要",
            "",
            f"| 类别 | 数量 |",
            f"|------|------|",
            f"| 严重错误 | {result.critical_count} |",
            f"| 警告 | {result.warning_count} |",
            f"| 信息 | {result.info_count} |",
            f"| **总计** | **{result.total_issues}** |",
            ""
        ]
        
        if result.critical_count > 0:
            lines.extend([
                "## 严重错误 (Critical)",
                ""
            ])
            critical_issues = [i for i in result.issues if i.severity == Severity.CRITICAL]
            for idx, issue in enumerate(critical_issues, 1):
                lines.extend([
                    f"### {idx}. [{issue.category}] {issue.message}",
                    "",
                    f"- **受影响项目**: {', '.join(issue.affected_items) if issue.affected_items else '无'}",
                ])
                if issue.suggestion:
                    lines.append(f"- **建议**: {issue.suggestion}")
                lines.append("")
        
        if result.warning_count > 0:
            lines.extend([
                "## 警告 (Warning)",
                ""
            ])
            warning_issues = [i for i in result.issues if i.severity == Severity.WARNING]
            for idx, issue in enumerate(warning_issues, 1):
                lines.extend([
                    f"### {idx}. [{issue.category}] {issue.message}",
                    "",
                    f"- **受影响项目**: {', '.join(issue.affected_items) if issue.affected_items else '无'}",
                ])
                if issue.suggestion:
                    lines.append(f"- **建议**: {issue.suggestion}")
                lines.append("")
        
        if result.info_count > 0:
            lines.extend([
                "## 信息 (Info)",
                ""
            ])
            info_issues = [i for i in result.issues if i.severity == Severity.INFO]
            for idx, issue in enumerate(info_issues, 1):
                lines.extend([
                    f"### {idx}. [{issue.category}] {issue.message}",
                    "",
                    f"- **受影响项目**: {', '.join(issue.affected_items) if issue.affected_items else '无'}",
                ])
                if issue.suggestion:
                    lines.append(f"- **建议**: {issue.suggestion}")
                lines.append("")
        
        lines.extend([
            "---",
            "",
            "*此报告由 DMX 地址补丁校验员自动生成*"
        ])
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

    @staticmethod
    def export_plan_to_markdown(plan: PlanResult, file_path: str,
                                 project_name: str = "DMX Patch Project") -> None:
        path = Path(file_path)
        
        lines = [
            f"# DMX Patch 重排规划 - {project_name}",
            "",
            f"**生成时间**: {plan.timestamp.strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "## 摘要",
            "",
            plan.summary,
            ""
        ]
        
        if plan.estimated_address_usage:
            lines.extend([
                "## 预估地址使用情况",
                "",
                "| 宇宙 | 已使用通道 |",
                "|------|------------|"
            ])
            for universe in sorted(plan.estimated_address_usage.keys()):
                used = plan.estimated_address_usage[universe]
                lines.append(f"| {universe} | {used}/512 ({used*100//512}%) |")
            lines.append("")
        
        if plan.actions:
            lines.extend([
                "## 执行动作",
                "",
                "按优先级排序执行：",
                ""
            ])
            
            sorted_actions = sorted(plan.actions, key=lambda a: a.priority)
            for idx, action in enumerate(sorted_actions, 1):
                lines.extend([
                    f"### 动作 {idx} (优先级: {action.priority})",
                    "",
                    f"- **类型**: {action.action_type.value}",
                    f"- **目标**: {action.target_id}",
                    f"- **描述**: {action.description}",
                ])
                if action.from_universe and action.from_address:
                    lines.append(f"- **从**: 宇宙 {action.from_universe} @ 地址 {action.from_address}")
                if action.to_universe and action.to_address:
                    lines.append(f"- **到**: 宇宙 {action.to_universe} @ 地址 {action.to_address}")
                if action.old_mode and action.new_mode:
                    lines.append(f"- **模式变更**: {action.old_mode} → {action.new_mode}")
                lines.append("")
        
        if plan.warnings:
            lines.extend([
                "## 警告",
                ""
            ])
            for idx, warning in enumerate(plan.warnings, 1):
                lines.append(f"{idx}. {warning}")
            lines.append("")
        
        lines.extend([
            "---",
            "",
            "*此规划由 DMX 地址补丁校验员自动生成*"
        ])
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

    @staticmethod
    def export_project_summary_to_markdown(project: ProjectData, file_path: str) -> None:
        path = Path(file_path)
        
        lines = [
            f"# {project.config.project_name} - 项目概览",
            "",
            f"**创建时间**: {project.config.created_at.strftime('%Y-%m-%d %H:%M:%S')}",
            f"**最后修改**: {project.config.modified_at.strftime('%Y-%m-%d %H:%M:%S')}",
            f"**配置宇宙数**: {project.config.universe_count}",
            ""
        ]
        
        lines.extend([
            "## 灯具清单",
            "",
            f"总计: {len(project.fixtures)} 个灯具",
            ""
        ])
        
        if project.fixtures:
            lines.extend([
                "| ID | 制造商/型号 | 模式 | 位置 | 地址 |",
                "|----|------------|------|------|------|"
            ])
            for f in sorted(project.fixtures, key=lambda x: (x.universe, x.start_address)):
                lines.append(
                    f"| {f.id} | {f.manufacturer} {f.model} | {f.mode} | {f.position or '-'} | "
                    f"U{f.universe}@{f.start_address} |"
                )
            lines.append("")
        
        lines.extend([
            "## Patch 表",
            "",
            f"总计: {len(project.patch_entries)} 个条目",
            ""
        ])
        
        if project.patch_entries:
            lines.extend([
                "| ID | 地址 | 灯具ID | 通道数 | 位置 |",
                "|----|------|--------|--------|------|"
            ])
            for p in sorted(project.patch_entries, key=lambda x: (x.universe, x.start_address)):
                lines.append(
                    f"| {p.id} | U{p.universe}@{p.start_address} | {p.fixture_id or '-'} | "
                    f"{p.channel_count} | {p.position or '-'} |"
                )
            lines.append("")
        
        lines.extend([
            "## 历史记录",
            "",
            f"总计: {len(project.history)} 条记录",
            ""
        ])
        
        if project.history:
            recent = sorted(project.history, key=lambda h: h.timestamp, reverse=True)[:10]
            for idx, record in enumerate(recent, 1):
                lines.append(
                    f"{idx}. **[{record.action.upper()}]** {record.description} "
                    f"({record.timestamp.strftime('%Y-%m-%d %H:%M')})"
                )
            lines.append("")
        
        lines.extend([
            "---",
            "",
            "*此概览由 DMX 地址补丁校验员自动生成*"
        ])
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
