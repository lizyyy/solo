from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging

from eeg_aligner.models import (
    ProjectData,
    CheckResult,
    AlignmentResult,
    IssueSeverity,
    IssueType,
)

logger = logging.getLogger(__name__)


class MarkdownExporter:
    def __init__(self):
        self.lines: List[str] = []

    def export(self, project_data: ProjectData, output_path: Path) -> Path:
        logger.info(f"Exporting Markdown report to {output_path}")
        self.lines = []
        
        self._add_header(project_data)
        self._add_summary(project_data)
        
        if project_data.alignment_result:
            self._add_alignment_section(project_data.alignment_result)
        
        if project_data.check_result:
            self._add_check_section(project_data.check_result)
        
        self._add_event_summary(project_data)
        self._add_sleep_stage_summary(project_data)
        self._add_footer()
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(self.lines))
        
        logger.info(f"Markdown report saved to {output_path}")
        return output_path

    def _add_header(self, project_data: ProjectData):
        self.lines.extend([
            "# 脑电事件码对齐审计报告",
            "",
            f"**项目ID**: {project_data.project_id}",
            f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"**数据更新时间**: {project_data.updated_at.strftime('%Y-%m-%d %H:%M:%S') if project_data.updated_at else 'N/A'}",
            "",
            "---",
            "",
        ])

    def _add_summary(self, project_data: ProjectData):
        check = project_data.check_result
        
        self.lines.extend([
            "## 数据概览",
            "",
            "| 指标 | 数值 |",
            "|------|------|",
            f"| EEG通道数 | {len(project_data.eeg_summaries)} |",
            f"| 事件总数 | {len(project_data.events)} |",
            f"| 有效事件数 | {check.valid_events if check else len(project_data.events)} |",
            f"| 睡眠分期数 | {len(project_data.sleep_stages)} |",
            f"| 时钟校准数 | {len(project_data.clock_calibrations)} |",
            "",
        ])
        
        if check:
            self.lines.extend([
                "### 问题统计",
                "",
                "| 严重级别 | 数量 |",
                "|----------|------|",
                f"| 🔴 严重 (Critical) | {check.critical_issue_count} |",
                f"| 🟡 警告 (Warning) | {check.warning_issue_count} |",
                f"| 🔵 信息 (Info) | {check.info_issue_count} |",
                "",
            ])

    def _add_alignment_section(self, alignment: AlignmentResult):
        self.lines.extend([
            "## 时钟对齐结果",
            "",
            f"**对齐方法**: {alignment.alignment_method}",
            "",
            f"- **估计漂移**: {alignment.drift_estimate_ms:.2f} ms",
            f"- **置信度**: {alignment.drift_confidence:.0%}",
            f"- **已对齐事件数**: {alignment.aligned_events_count}",
            "",
        ])
        
        if alignment.sync_points:
            self.lines.extend([
                "### 同步点详情",
                "",
                "| 序号 | 刺激时间 | EEG时间 | 测量漂移 | 来源 |",
                "|------|----------|---------|----------|------|",
            ])
            
            for i, point in enumerate(alignment.sync_points[:10], 1):
                stim_time = point.get("stimulus_time", "N/A")
                if isinstance(stim_time, datetime):
                    stim_time = stim_time.strftime("%H:%M:%S.%f")[:-3]
                elif isinstance(stim_time, str):
                    try:
                        stim_time = datetime.fromisoformat(stim_time).strftime("%H:%M:%S.%f")[:-3]
                    except ValueError:
                        pass
                
                eeg_time = point.get("eeg_time", "N/A")
                if isinstance(eeg_time, datetime):
                    eeg_time = eeg_time.strftime("%H:%M:%S.%f")[:-3]
                elif isinstance(eeg_time, str):
                    try:
                        eeg_time = datetime.fromisoformat(eeg_time).strftime("%H:%M:%S.%f")[:-3]
                    except ValueError:
                        pass
                
                drift = point.get("measured_drift_ms", 0)
                source = point.get("source", "N/A")
                
                self.lines.append(
                    f"| {i} | {stim_time} | {eeg_time} | {drift:.2f} ms | {source} |"
                )
            
            if len(alignment.sync_points) > 10:
                self.lines.append(f"\n*... 还有 {len(alignment.sync_points) - 10} 个同步点未显示*")
            
            self.lines.append("")
        
        if alignment.issues:
            self.lines.extend([
                "### 对齐问题",
                "",
            ])
            for issue in alignment.issues[:20]:
                icon = self._get_severity_icon(issue.severity)
                self.lines.append(f"- {icon} {issue.message}")
            if len(alignment.issues) > 20:
                self.lines.append(f"\n*... 还有 {len(alignment.issues) - 20} 个问题未显示*")
            self.lines.append("")

    def _add_check_section(self, check: CheckResult):
        self.lines.extend([
            "## 数据检查结果",
            "",
        ])
        
        if check.missing_codes:
            self.lines.extend([
                "### 🔴 缺失的事件码",
                "",
                f"以下期望的事件码未在数据中找到: {', '.join(map(str, check.missing_codes))}",
                "",
            ])
        
        if check.duplicate_codes:
            self.lines.extend([
                "### 🟡 重复的事件码",
                "",
                f"以下事件码在极短时间内重复出现: {', '.join(map(str, check.duplicate_codes))}",
                "",
            ])
        
        if check.stage_conflicts:
            self.lines.extend([
                "### 🟡 睡眠分期冲突",
                "",
            ])
            for conflict in check.stage_conflicts[:10]:
                epoch = conflict.get("epoch_number", "N/A")
                stage = conflict.get("epoch_stage", "N/A")
                event_code = conflict.get("event_code", "N/A")
                self.lines.append(f"- 事件 {event_code} 在第 {epoch} 期 ({stage}) 中触发")
            if len(check.stage_conflicts) > 10:
                self.lines.append(f"\n*... 还有 {len(check.stage_conflicts) - 10} 个冲突未显示*")
            self.lines.append("")
        
        if check.artifact_overlaps:
            self.lines.extend([
                "### 🔴 伪迹重叠",
                "",
            ])
            for overlap in check.artifact_overlaps[:10]:
                event_code = overlap.get("overlapping_event_code", "N/A")
                ratio = overlap.get("overlap_ratio", 0)
                self.lines.append(f"- 事件 {event_code} 与伪迹重叠 {ratio:.0%}")
            if len(check.artifact_overlaps) > 10:
                self.lines.append(f"\n*... 还有 {len(check.artifact_overlaps) - 10} 个重叠未显示*")
            self.lines.append("")
        
        if check.issues:
            self.lines.extend([
                "### 详细问题列表",
                "",
            ])
            
            critical = [i for i in check.issues if i.severity == IssueSeverity.CRITICAL]
            warning = [i for i in check.issues if i.severity == IssueSeverity.WARNING]
            info = [i for i in check.issues if i.severity == IssueSeverity.INFO]
            
            if critical:
                self.lines.append("#### 🔴 严重问题")
                self.lines.append("")
                for issue in critical[:15]:
                    self.lines.append(f"- {issue.message}")
                    if issue.suggestion:
                        self.lines.append(f"  - 建议: {issue.suggestion}")
                self.lines.append("")
            
            if warning:
                self.lines.append("#### 🟡 警告问题")
                self.lines.append("")
                for issue in warning[:15]:
                    self.lines.append(f"- {issue.message}")
                    if issue.suggestion:
                        self.lines.append(f"  - 建议: {issue.suggestion}")
                self.lines.append("")
            
            if info:
                self.lines.append("#### 🔵 信息提示")
                self.lines.append("")
                for issue in info[:10]:
                    self.lines.append(f"- {issue.message}")
                self.lines.append("")

    def _add_event_summary(self, project_data: ProjectData):
        if not project_data.events:
            return
        
        self.lines.extend([
            "## 事件类型统计",
            "",
        ])
        
        code_counts: Dict[int, int] = {}
        for event in project_data.events:
            code_counts[event.event_code] = code_counts.get(event.event_code, 0) + 1
        
        self.lines.extend([
            "| 事件码 | 出现次数 |",
            "|--------|----------|",
        ])
        
        for code in sorted(code_counts.keys()):
            self.lines.append(f"| {code} | {code_counts[code]} |")
        
        self.lines.append("")

    def _add_sleep_stage_summary(self, project_data: ProjectData):
        if not project_data.sleep_stages:
            return
        
        self.lines.extend([
            "## 睡眠分期统计",
            "",
        ])
        
        stage_counts: Dict[str, int] = {}
        for stage in project_data.sleep_stages:
            stage_val = stage.stage.value if hasattr(stage.stage, 'value') else str(stage.stage)
            stage_counts[stage_val] = stage_counts.get(stage_val, 0) + 1
        
        stage_names = {
            "W": "清醒 (Wake)",
            "N1": "N1期",
            "N2": "N2期",
            "N3": "N3期",
            "R": "REM期",
            "M": "运动 (Movement)",
            "?": "未知",
        }
        
        self.lines.extend([
            "| 分期 | 名称 | 数量 | 占比 |",
            "|------|------|------|------|",
        ])
        
        total = len(project_data.sleep_stages)
        for stage_val in sorted(stage_counts.keys()):
            count = stage_counts[stage_val]
            name = stage_names.get(stage_val, stage_val)
            percentage = (count / total) * 100 if total > 0 else 0
            self.lines.append(f"| {stage_val} | {name} | {count} | {percentage:.1f}% |")
        
        self.lines.append("")

    def _add_footer(self):
        self.lines.extend([
            "---",
            "",
            "*本报告由「脑电事件码对齐员」自动生成*",
            "",
            "> **提示**: ",
            "> - 红色标记的严重问题需要立即处理",
            "> - 黄色警告建议仔细检查",
            "> - 蓝色信息仅供参考",
            "",
        ])

    def _get_severity_icon(self, severity: IssueSeverity) -> str:
        icon_map = {
            IssueSeverity.CRITICAL: "🔴",
            IssueSeverity.WARNING: "🟡",
            IssueSeverity.INFO: "🔵",
        }
        return icon_map.get(severity, "⚪")
