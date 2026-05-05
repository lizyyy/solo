import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from .models import (
    Project, Issue, IssueType, IssueSeverity,
    Cue, LightScene, AudioFile, ActorSchedule
)


class BaseExporter:
    def export(self, project: Project, output_path: str) -> bool:
        raise NotImplementedError("Subclasses must implement export method")


class MarkdownExporter(BaseExporter):
    def __init__(self):
        self.generated_at = datetime.now()

    def _get_severity_icon(self, severity: IssueSeverity) -> str:
        icons = {
            IssueSeverity.CRITICAL: "🔴",
            IssueSeverity.HIGH: "🟠",
            IssueSeverity.MEDIUM: "🟡",
            IssueSeverity.LOW: "🟢"
        }
        return icons.get(severity, "⚪")

    def _get_severity_text(self, severity: IssueSeverity) -> str:
        texts = {
            IssueSeverity.CRITICAL: "严重",
            IssueSeverity.HIGH: "高",
            IssueSeverity.MEDIUM: "中",
            IssueSeverity.LOW: "低"
        }
        return texts.get(severity, "未知")

    def _get_issue_type_text(self, issue_type: IssueType) -> str:
        texts = {
            IssueType.CUE_MISSING: "Cue 编号缺失",
            IssueType.LIGHT_SCENE_NOT_FOUND: "灯光场景不存在",
            IssueType.AUDIO_FILE_BROKEN: "音频文件断链",
            IssueType.ACTOR_CHANGE_TIME_INSUFFICIENT: "演员换场时间不足"
        }
        return texts.get(issue_type, "未知问题类型")

    def _format_issue(self, issue: Issue, index: int) -> str:
        lines = []
        lines.append(f"### 问题 {index}: {issue.title}")
        lines.append("")
        lines.append(f"- **问题编号**: {issue.issue_id}")
        lines.append(f"- **类型**: {self._get_issue_type_text(issue.issue_type)}")
        lines.append(f"- **严重程度**: {self._get_severity_icon(issue.severity)} {self._get_severity_text(issue.severity)}")
        lines.append(f"- **状态**: {'✅ 已解决' if issue.resolved else '❌ 未解决'}")
        lines.append("")
        lines.append(f"**描述**:")
        lines.append(f"> {issue.description}")
        lines.append("")

        if issue.related_cue_id:
            lines.append(f"- **关联 Cue**: {issue.related_cue_id}")
        if issue.related_actor:
            lines.append(f"- **关联演员**: {issue.related_actor}")
        if issue.related_file:
            lines.append(f"- **关联文件**: {issue.related_file}")
        if issue.time_code and issue.time_code != "N/A":
            lines.append(f"- **时间码**: {issue.time_code}")

        if issue.notes:
            lines.append("")
            lines.append(f"**备注**:")
            for i, note in enumerate(issue.notes, 1):
                lines.append(f"{i}. {note}")

        lines.append("")
        lines.append("---")
        lines.append("")

        return "\n".join(lines)

    def export(self, project: Project, output_path: str) -> bool:
        try:
            lines = []

            lines.append(f"# 舞台监督交接单")
            lines.append(f"## 项目: {project.name}")
            lines.append("")
            lines.append(f"**生成时间**: {self.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
            if project.last_scan_at:
                lines.append(f"**最后扫描时间**: {project.last_scan_at.strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append("")

            total_issues = len(project.issues)
            unresolved = sum(1 for i in project.issues if not i.resolved)
            critical = sum(1 for i in project.issues if i.severity == IssueSeverity.CRITICAL and not i.resolved)
            high = sum(1 for i in project.issues if i.severity == IssueSeverity.HIGH and not i.resolved)

            lines.append("## 问题概览")
            lines.append("")
            lines.append("| 指标 | 数值 |")
            lines.append("|------|------|")
            lines.append(f"| 总问题数 | {total_issues} |")
            lines.append(f"| 未解决 | {unresolved} |")
            lines.append(f"| 🔴 严重 | {critical} |")
            lines.append(f"| 🟠 高 | {high} |")
            lines.append("")

            lines.append("## 问题详情")
            lines.append("")

            unresolved_issues = [i for i in project.issues if not i.resolved]
            resolved_issues = [i for i in project.issues if i.resolved]

            unresolved_issues.sort(key=lambda x: (
                0 if x.severity == IssueSeverity.CRITICAL else
                1 if x.severity == IssueSeverity.HIGH else
                2 if x.severity == IssueSeverity.MEDIUM else 3
            ))

            if unresolved_issues:
                lines.append("### ⚠️ 未解决问题")
                lines.append("")
                for idx, issue in enumerate(unresolved_issues, 1):
                    lines.append(self._format_issue(issue, idx))

            if resolved_issues:
                lines.append("### ✅ 已解决问题")
                lines.append("")
                for idx, issue in enumerate(resolved_issues, 1):
                    lines.append(self._format_issue(issue, idx))

            lines.append("")
            lines.append("---")
            lines.append("")

            lines.append("## 项目数据概览")
            lines.append("")
            lines.append(f"- **Cue 总数**: {len(project.cues)}")
            lines.append(f"- **灯光场景数**: {len(project.light_scenes)}")
            lines.append(f"- **音频文件数**: {len(project.audio_files)}")
            lines.append(f"- **演员场次**: {len(project.actor_schedules)}")
            lines.append("")

            if project.cues:
                lines.append("### Cue 列表")
                lines.append("")
                lines.append("| Cue ID | 类型 | 描述 | 时间 |")
                lines.append("|--------|------|------|------|")
                for cue in project.cues:
                    cue_type_text = {
                        'light': '灯光',
                        'audio': '音频',
                        'video': '视频',
                        'fly': '吊杆',
                        'other': '其他'
                    }.get(cue.cue_type.value, cue.cue_type.value)
                    lines.append(f"| {cue.cue_id} | {cue_type_text} | {cue.description} | {cue.time} |")
                lines.append("")

            content = "\n".join(lines)

            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)

            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(content)

            return True
        except Exception as e:
            print(f"Error exporting Markdown: {e}")
            return False


class JSONExporter(BaseExporter):
    def __init__(self, include_all_data: bool = True):
        self.include_all_data = include_all_data
        self.generated_at = datetime.now()

    def _cue_to_dict(self, cue: Cue) -> Dict[str, Any]:
        return {
            'cue_id': cue.cue_id,
            'description': cue.description,
            'cue_type': cue.cue_type.value,
            'time': cue.time,
            'light_scene_id': cue.light_scene_id,
            'audio_file_id': cue.audio_file_id,
            'notes': cue.notes,
            'metadata': cue.metadata
        }

    def _light_scene_to_dict(self, scene: LightScene) -> Dict[str, Any]:
        return {
            'scene_id': scene.scene_id,
            'name': scene.name,
            'intensity': scene.intensity,
            'color_temperature': scene.color_temperature,
            'channels': scene.channels,
            'notes': scene.notes
        }

    def _audio_file_to_dict(self, audio: AudioFile) -> Dict[str, Any]:
        return {
            'cue_id': audio.cue_id,
            'filename': audio.filename,
            'path': audio.path,
            'duration_seconds': audio.duration_seconds,
            'format': audio.format,
            'exists': audio.exists
        }

    def _actor_schedule_to_dict(self, schedule: ActorSchedule) -> Dict[str, Any]:
        return {
            'actor_name': schedule.actor_name,
            'scene_id': schedule.scene_id,
            'enter_time': schedule.enter_time,
            'exit_time': schedule.exit_time,
            'notes': schedule.notes,
            'costume': schedule.costume,
            'entry_direction': schedule.entry_direction,
            'exit_direction': schedule.exit_direction
        }

    def _issue_to_dict(self, issue: Issue) -> Dict[str, Any]:
        return {
            'issue_id': issue.issue_id,
            'issue_type': issue.issue_type.value,
            'severity': issue.severity.value,
            'title': issue.title,
            'description': issue.description,
            'related_cue_id': issue.related_cue_id,
            'related_actor': issue.related_actor,
            'related_file': issue.related_file,
            'time_code': issue.time_code,
            'notes': issue.notes,
            'resolved': issue.resolved,
            'created_at': issue.created_at.isoformat() if issue.created_at else None,
            'metadata': issue.metadata
        }

    def export(self, project: Project, output_path: str) -> bool:
        try:
            data = {
                'audit_package': {
                    'version': '1.0.0',
                    'generated_at': self.generated_at.isoformat(),
                    'project_id': project.project_id,
                    'project_name': project.name,
                    'project_path': project.path,
                },
                'scan_summary': {
                    'total_issues': len(project.issues),
                    'unresolved_issues': sum(1 for i in project.issues if not i.resolved),
                    'resolved_issues': sum(1 for i in project.issues if i.resolved),
                    'last_scan_at': project.last_scan_at.isoformat() if project.last_scan_at else None
                },
                'issues': [self._issue_to_dict(issue) for issue in project.issues]
            }

            if self.include_all_data:
                data['project_data'] = {
                    'cues': [self._cue_to_dict(cue) for cue in project.cues],
                    'light_scenes': [self._light_scene_to_dict(scene) for scene in project.light_scenes],
                    'audio_files': [self._audio_file_to_dict(audio) for audio in project.audio_files],
                    'actor_schedules': [self._actor_schedule_to_dict(schedule) for schedule in project.actor_schedules]
                }

            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)

            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            return True
        except Exception as e:
            print(f"Error exporting JSON: {e}")
            return False


class ExporterFactory:
    @staticmethod
    def get_exporter(format_type: str) -> BaseExporter:
        format_lower = format_type.lower()
        if format_lower in ['md', 'markdown']:
            return MarkdownExporter()
        elif format_lower in ['json']:
            return JSONExporter()
        else:
            raise ValueError(f"Unsupported export format: {format_type}")

    @staticmethod
    def export_project(project: Project, format_type: str, output_path: str) -> bool:
        exporter = ExporterFactory.get_exporter(format_type)
        return exporter.export(project, output_path)
