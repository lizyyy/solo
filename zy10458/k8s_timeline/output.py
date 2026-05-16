import json
import os
from datetime import datetime
from typing import Any, Dict, List
from dataclasses import asdict

from .models import TimelineReport
from .exceptions import OutputError


class OutputGenerator:
    def __init__(self, report: TimelineReport, output_dir: str = '.'):
        self.report = report
        self.output_dir = output_dir
        self._ensure_output_dir()

    def _ensure_output_dir(self):
        try:
            os.makedirs(self.output_dir, exist_ok=True)
        except OSError as e:
            raise OutputError(f"Failed to create output directory: {e}")

    def _datetime_serializer(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat() if obj != datetime.min else None
        raise TypeError(f"Type {type(obj)} not serializable")

    def generate_json(self, filename: str = None) -> str:
        if not filename:
            filename = f"{self.report.deployment_name}_timeline_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        filepath = os.path.join(self.output_dir, filename)

        report_dict = asdict(self.report)

        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(report_dict, f, indent=2, default=self._datetime_serializer, ensure_ascii=False)
        except IOError as e:
            raise OutputError(f"Failed to write JSON output: {e}")

        return filepath

    def generate_markdown(self, filename: str = None) -> str:
        if not filename:
            filename = f"{self.report.deployment_name}_timeline_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"

        filepath = os.path.join(self.output_dir, filename)

        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                self._write_markdown_content(f)
        except IOError as e:
            raise OutputError(f"Failed to write Markdown output: {e}")

        return filepath

    def _write_markdown_content(self, f):
        deployment_name = self.report.deployment_name
        namespace = self.report.namespace

        f.write(f"# Kubernetes 发布时间线报告\n\n")
        f.write(f"**Deployment**: {deployment_name}  \n")
        f.write(f"**Namespace**: {namespace}  \n")
        f.write(f"**时间范围**: {self._format_time(self.report.start_time)} - {self._format_time(self.report.end_time)}  \n\n")

        f.write("## 摘要\n\n")
        self._write_summary_section(f)

        f.write("\n## 关键事件时间线\n\n")
        self._write_timeline_section(f)

        f.write("\n## 镜像变更记录\n\n")
        self._write_image_changes(f)

        f.write("\n## Pod 状态概览\n\n")
        self._write_pods_section(f)

        f.write("\n## ReplicaSet 信息\n\n")
        self._write_replicasets_section(f)

        if self.report.parse_errors:
            f.write("\n## 解析错误记录\n\n")
            self._write_parse_errors(f)

    def _write_summary_section(self, f):
        summary = self.report.summary

        f.write("| 指标 | 数值 |\n")
        f.write("|------|------|\n")
        f.write(f"| 总事件数 | {summary.get('total_events', 0)} |\n")
        f.write(f"| 错误事件 | {summary.get('error_events', 0)} |\n")
        f.write(f"| 警告事件 | {summary.get('warning_events', 0)} |\n")
        f.write(f"| Pod 总数 | {summary.get('pods_count', 0)} |\n")
        f.write(f"| 就绪 Pod | {summary.get('pods_ready', 0)} |\n")
        f.write(f"| 总重启次数 | {summary.get('total_restarts', 0)} |\n")
        f.write(f"| ReplicaSet 数量 | {summary.get('replicasets_count', 0)} |\n")

        if 'deployment' in summary:
            dep = summary['deployment']
            f.write(f"| 期望副本数 | {dep.get('replicas', 0)} |\n")
            f.write(f"| 已更新副本 | {dep.get('updated_replicas', 0)} |\n")
            f.write(f"| 就绪副本 | {dep.get('ready_replicas', 0)} |\n")
            f.write(f"| 可用副本 | {dep.get('available_replicas', 0)} |\n")
            f.write(f"| 更新策略 | {dep.get('strategy', 'N/A')} |\n")

    def _write_timeline_section(self, f):
        if not self.report.events:
            f.write("*无事件记录*\n")
            return

        error_count = 0
        for event in self.report.events:
            ts = self._format_time(event.timestamp)
            severity_icon = '🔴' if event.severity == 'error' else '🟡' if event.severity == 'warning' else '🔵'
            f.write(f"### {severity_icon} {ts} - {event.title}\n\n")
            f.write(f"- **类型**: {event.event_type}\n")
            f.write(f"- **对象**: {event.object_ref}\n")
            f.write(f"- **描述**: {event.description}\n")
            if event.severity == 'error':
                error_count += 1
            f.write("\n")

        if error_count == 0:
            f.write("\n✅ 无错误事件，发布状态良好。\n")

    def _write_image_changes(self, f):
        if self.report.image_changes:
            f.write("| 时间 | 容器 | 原镜像 | 新镜像 | Pod |\n")
            f.write("|------|------|--------|--------|-----|\n")
            for change in self.report.image_changes:
                ts = self._format_time(change.get('timestamp'))
                f.write(f"| {ts} | {change.get('container', '')} | {change.get('from', '')} | {change.get('to', '')} | {change.get('pod', '')} |\n")
        else:
            f.write("*无镜像变更记录*\n")

    def _write_pods_section(self, f):
        if self.report.pods:
            f.write("| Pod 名称 | 状态 | 就绪 | 重启次数 | 启动时间 |\n")
            f.write("|----------|------|------|----------|----------|\n")
            for pod in self.report.pods:
                status_icon = '✅' if pod.ready else '❌'
                f.write(f"| {pod.name} | {pod.phase} | {status_icon} | {pod.restarts} | {self._format_time(pod.start_time)} |\n")
        else:
            f.write("*无 Pod 记录*\n")

    def _write_replicasets_section(self, f):
        if self.report.replicasets:
            f.write("| ReplicaSet 名称 | 副本数 | 就绪 | 可用 | 创建时间 |\n")
            f.write("|---------------|--------|------|------|----------|\n")
            for rs in self.report.replicasets:
                f.write(f"| {rs.name} | {rs.replicas} | {rs.ready_replicas} | {rs.available_replicas} | {self._format_time(rs.creation_timestamp)} |\n")
        else:
            f.write("*无 ReplicaSet 记录*\n")

    def _write_parse_errors(self, f):
        f.write("| 错误信息 | 文件 | 行号 | 原始内容 |\n")
        f.write("|----------|------|------|----------|\n")
        for error in self.report.parse_errors:
            f.write(f"| {error.get('message', '')} | {error.get('file_path', '')} | {error.get('line_number', '')} | `{error.get('raw_line', '')[:50]}` |\n")

    def _format_time(self, dt) -> str:
        if not dt or dt == datetime.min:
            return 'N/A'
        return dt.strftime('%Y-%m-%d %H:%M:%S')

    def generate_console_summary(self) -> str:
        lines = []

        lines.append("\n" + "=" * 80)
        lines.append(f"Kubernetes 发布时间线 - {self.report.deployment_name} ({self.report.namespace})")
        lines.append("=" * 80)

        lines.append(f"\n时间范围: {self._format_time(self.report.start_time)} - {self._format_time(self.report.end_time)}")

        summary = self.report.summary
        lines.append(f"\n  摘要 ")
        lines.append("-" * 40)
        lines.append(f"  总事件数:       {summary.get('total_events', 0)}")
        lines.append(f"  错误事件:       {summary.get('error_events', 0)} 🔴")
        lines.append(f"  Pod 总数:       {summary.get('pods_count', 0)}")
        lines.append(f"  就绪 Pod:       {summary.get('pods_ready', 0)} ✅")
        lines.append(f"  总重启次数:     {summary.get('total_restarts', 0)}")

        if summary.get('error_events', 0) > 0:
            lines.append(f"\n{' 错误事件 ':^80}")
            lines.append("-" * 80)
            error_events = [e for e in self.report.events if e.severity == 'error']
            for event in error_events[:5]:
                lines.append(f"  {self._format_time(event.timestamp)} | {event.title} | {event.object_ref}")
                lines.append(f"    {event.description[:100]}...")

        lines.append(f"\n{' 关键时间线 ':^80}")
        lines.append("-" * 80)
        for event in self.report.events[:10]:
            severity_mark = '🔴' if event.severity == 'error' else '🟡' if event.severity == 'warning' else '🔵'
            lines.append(f"{severity_mark} {self._format_time(event.timestamp)} | {event.title[:30]} | {event.object_ref}")

        if len(self.report.events) > 10:
            lines.append(f"... 还有 {len(self.report.events) - 10} 条更多事件，查看完整报告 ...")

        return "\n".join(lines)

    def generate_all(self, base_filename: str = None) -> Dict[str, str]:
        outputs = {}
        outputs['json'] = self.generate_json(base_filename + '.json' if base_filename else None)
        outputs['markdown'] = self.generate_markdown(base_filename + '.md' if base_filename else None)
        outputs['console'] = self.generate_console_summary()
        return outputs
