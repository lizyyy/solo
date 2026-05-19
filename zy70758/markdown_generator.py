from datetime import datetime
from typing import List, Dict, Any
import json


class MarkdownReportGenerator:
    def __init__(self):
        pass

    def generate_full_report(self, release_info: Dict[str, Any], events: List[Dict[str, Any]],
                             pods: List[Dict[str, Any]], analysis: Dict[str, Any],
                             image_comparison: Dict[str, Any]) -> str:
        sections = []

        sections.append(self._generate_header(release_info))
        sections.append(self._generate_summary(release_info, analysis))
        sections.append(self._generate_image_comparison(image_comparison))
        sections.append(self._generate_timeline(events, pods))
        sections.append(self._generate_pod_status(pods))
        sections.append(self._generate_events_detail(events))
        sections.append(self._generate_recommendations(analysis))
        sections.append(self._generate_footer())

        return '\n\n'.join(sections)

    def _generate_header(self, release_info: Dict[str, Any]) -> str:
        deployment = release_info.get('deployment_name', 'Unknown')
        namespace = release_info.get('namespace', 'default')
        release_time = release_info.get('release_time', datetime.utcnow())

        if isinstance(release_time, str):
            try:
                release_time = datetime.fromisoformat(release_time.replace('Z', '+00:00'))
            except:
                release_time = datetime.utcnow()

        time_str = release_time.strftime('%Y-%m-%d %H:%M:%S UTC')

        return f"""# K8s 发布失败时间线分析报告

## 基本信息

| 项目 | 信息 |
|------|------|
| Deployment | `{deployment}` |
| Namespace | `{namespace}` |
| 发布时间 | {time_str} |
| 报告生成时间 | {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')} |
"""

    def _generate_summary(self, release_info: Dict[str, Any], analysis: Dict[str, Any]) -> str:
        root_cause = analysis.get('root_cause', 'Unknown')
        confidence = analysis.get('confidence', 'low')
        confidence_badge = self._get_confidence_badge(confidence)

        result = release_info.get('result', 'unknown')
        status_badge = self._get_status_badge(result)

        return f"""## 失败分析摘要

| 项目 | 结果 |
|------|------|
| 发布状态 | {status_badge} |
| 根因判断 | **{root_cause}** |
| 置信度 | {confidence_badge} |

> **关键结论**: {self._get_conclusion_text(root_cause)}
"""

    def _get_confidence_badge(self, confidence: str) -> str:
        badge_map = {
            'high': '🔴 **高** - 有充分证据支持判断',
            'medium': '🟡 **中** - 有一定证据支持判断',
            'low': '🟢 **低** - 证据不足，建议人工复核'
        }
        return badge_map.get(confidence.lower(), badge_map['low'])

    def _get_status_badge(self, result: str) -> str:
        badge_map = {
            'success': '✅ 成功',
            'failed': '❌ 失败',
            'partial': '⚠️ 部分失败',
            'unknown': '❓ 未知'
        }
        return badge_map.get(result.lower(), badge_map['unknown'])

    def _get_conclusion_text(self, root_cause: str) -> str:
        conclusion_map = {
            'ImagePullBackOff': '镜像拉取失败，通常是由于镜像不存在、凭证问题或网络问题导致。',
            'CrashLoopBackOff': '容器启动后崩溃并不断重启，通常是应用内部错误导致。',
            'ReadinessProbeFailed': '就绪探针检查失败，应用可能无法正常提供服务。',
            'LivenessProbeFailed': '存活探针检查失败，应用可能已经僵死或无响应。',
            'InsufficientResources': '资源不足，节点没有足够的CPU或内存来调度Pod。',
            'FailedScheduling': '调度失败，Pod无法被调度到任何节点上。',
            'ConfigError': '配置错误，可能是ConfigMap或Secret配置有问题。',
            'RBACError': 'RBAC权限错误，服务账号没有足够的权限。',
            'NetworkError': '网络错误，可能是网络策略或DNS问题。',
            'Unknown': '无法自动判断失败原因，需要人工排查。'
        }
        return conclusion_map.get(root_cause, '需要进一步人工排查以确定根因。')

    def _generate_image_comparison(self, image_comparison: Dict[str, Any]) -> str:
        if not image_comparison:
            return ""

        old_image = image_comparison.get('old_image', 'N/A')
        new_image = image_comparison.get('new_image', 'N/A')
        changed = image_comparison.get('image_changed', False)
        tag_changed = image_comparison.get('tag_changed', False)
        repo_changed = image_comparison.get('repository_changed', False)

        status_icon = '✅' if not changed else '⚠️' if tag_changed else '❌'

        return f"""## 镜像版本对比

{status_icon} **镜像变更状态**: {'无变更' if not changed else '已变更'}

| 维度 | 旧版本 | 新版本 | 变更 |
|------|--------|--------|------|
| 完整镜像 | `{old_image}` | `{new_image}` | {'✅' if old_image == new_image else '❌'} |
| 镜像仓库 | `{image_comparison.get('old_repository', 'N/A')}` | `{image_comparison.get('new_repository', 'N/A')}` | {'✅' if not repo_changed else '❌'} |
| 镜像标签 | `{image_comparison.get('old_tag', 'N/A')}` | `{image_comparison.get('new_tag', 'N/A')}` | {'✅' if not tag_changed else '❌'} |

**注意**: 如果镜像发生变更，请确认新镜像的正确性和可访问性。
"""

    def _generate_timeline(self, events: List[Dict[str, Any]], pods: List[Dict[str, Any]]) -> str:
        from timeline_analyzer import TimelineAnalyzer

        analyzer = TimelineAnalyzer()
        timeline_items = analyzer.build_timeline(events, pods)

        lines = ["## 事件时间线\n"]

        if not timeline_items:
            lines.append("> 暂无时间线数据\n")
            return '\n'.join(lines)

        for idx, item in enumerate(timeline_items[:20], 1):
            item_type = item['type']
            data = item['data']
            time = item['time']

            if isinstance(time, datetime):
                time_str = time.strftime('%H:%M:%S')
            else:
                time_str = str(time)

            if item_type == 'event':
                event_type = data.get('type', 'Normal')
                reason = data.get('reason', '')
                message = data.get('message', '')[:80]
                obj_name = data.get('involved_object_name', '')

                icon = '⚠️' if event_type in ['Warning', 'Error'] else 'ℹ️'
                lines.append(f"{idx}. **[{time_str}]** {icon} **{reason}** - *{obj_name}*")
                lines.append(f"   {message}")
                lines.append("")
            elif item_type == 'pod':
                pod_name = data.get('pod_name', 'unknown')
                status = data.get('status', 'unknown')
                icon = '🟢' if status == 'Running' else '🔴' if status in ['Failed', 'Error'] else '🟡'
                lines.append(f"{idx}. **[{time_str}]** {icon} Pod状态变化 - *{pod_name}* → **{status}**")
                lines.append("")

        if len(timeline_items) > 20:
            lines.append(f"> 仅显示最近20条事件，共{len(timeline_items)}条")

        return '\n'.join(lines)

    def _generate_pod_status(self, pods: List[Dict[str, Any]]) -> str:
        if not pods:
            return "## Pod状态\n\n> 暂无Pod数据\n"

        lines = ["## Pod状态详情\n"]
        lines.append("| Pod名称 | 状态 | 就绪 | 重启次数 | 运行时长 | 节点 |")
        lines.append("|----------|------|------|----------|----------|------|")

        for pod in pods:
            name = pod.get('pod_name', 'N/A')
            status = pod.get('status', 'N/A')
            ready = pod.get('ready', 'N/A')
            restarts = pod.get('restarts', 0)
            age = pod.get('age', 'N/A')
            node = pod.get('node', 'N/A')

            status_icon = '🟢' if status == 'Running' else '🔴' if status in ['Failed', 'Error', 'ImagePullBackOff', 'CrashLoopBackOff'] else '🟡'

            lines.append(f"| {name} | {status_icon} {status} | {ready} | {restarts} | {age} | {node} |")

        lines.append("\n### 异常Pod说明")
        abnormal_count = sum(1 for p in pods if p.get('status') not in ['Running', 'Succeeded'])
        if abnormal_count > 0:
            lines.append(f"**发现 {abnormal_count} 个异常Pod，请重点关注以下Pod:**")
            lines.append("")
            for pod in pods:
                if pod.get('status') not in ['Running', 'Succeeded']:
                    lines.append(f"- `{pod.get('pod_name')}` - 状态: **{pod.get('status')}**")
        else:
            lines.append("✅ 所有Pod状态正常")

        return '\n'.join(lines)

    def _generate_events_detail(self, events: List[Dict[str, Any]]) -> str:
        from timeline_analyzer import TimelineAnalyzer

        analyzer = TimelineAnalyzer()
        warning_events = analyzer.filter_warning_events(events)
        sorted_events = analyzer.sort_events_by_time(warning_events)

        lines = ["## 关键事件详情\n"]

        if not sorted_events:
            lines.append("> 无警告或错误事件\n")
            return '\n'.join(lines)

        lines.append(f"共发现 **{len(warning_events)}** 个警告/错误事件:\n")

        for idx, event in enumerate(sorted_events[:15], 1):
            event_time = event.get('event_time', datetime.utcnow())
            if isinstance(event_time, datetime):
                time_str = event_time.strftime('%Y-%m-%d %H:%M:%S')
            else:
                time_str = str(event_time)

            event_type = event.get('type', 'Normal')
            reason = event.get('reason', '')
            message = event.get('message', '')
            obj_kind = event.get('involved_object_kind', '')
            obj_name = event.get('involved_object_name', '')
            source = event.get('source_component', '')
            count = event.get('count', 1)

            icon = '🔴' if event_type == 'Error' else '🟡'

            lines.append(f"### {idx}. {icon} {reason}")
            lines.append("")
            lines.append(f"- **时间**: {time_str}")
            lines.append(f"- **对象类型**: {obj_kind}")
            lines.append(f"- **对象名称**: `{obj_name}`")
            lines.append(f"- **来源**: {source}")
            lines.append(f"- **发生次数**: {count}")
            lines.append("")
            lines.append(f"**消息**: {message}")
            lines.append("")

        if len(sorted_events) > 15:
            lines.append(f"> 仅显示前15条关键事件")

        return '\n'.join(lines)

    def _generate_recommendations(self, analysis: Dict[str, Any]) -> str:
        suggestions = analysis.get('suggested_actions', [])
        root_cause = analysis.get('root_cause', 'Unknown')

        lines = ["## 排查建议\n"]
        lines.append(f"根据根因分析 **{root_cause}**，建议按以下步骤排查:\n")

        for idx, suggestion in enumerate(suggestions, 1):
            lines.append(f"{idx}. {suggestion}")

        lines.append("")
        lines.append("### 通用排查命令")
        lines.append("")
        lines.append("```bash")
        lines.append("# 查看Pod详细信息")
        lines.append("kubectl describe pod <pod-name> -n <namespace>")
        lines.append("")
        lines.append("# 查看Pod日志")
        lines.append("kubectl logs <pod-name> -n <namespace>")
        lines.append("kubectl logs <pod-name> -n <namespace> --previous  # 查看上一个崩溃容器的日志")
        lines.append("")
        lines.append("# 查看Deployment状态")
        lines.append("kubectl describe deployment <deployment-name> -n <namespace>")
        lines.append("")
        lines.append("# 查看ReplicaSet状态")
        lines.append("kubectl get rs -n <namespace>")
        lines.append("")
        lines.append("# 查看所有事件")
        lines.append("kubectl get events -n <namespace> --sort-by='.lastTimestamp'")
        lines.append("```")

        return '\n'.join(lines)

    def _generate_footer(self) -> str:
        return """---

## 注意事项

1. **本报告基于自动化分析生成，仅作为排障参考，不能替代人工判断**
2. **关键故障请结合实际场景和日志综合判断**
3. **生产环境操作请务必谨慎，建议先在测试环境验证**

---
*报告由 K8s 发布失败时间线分析系统自动生成*
"""

    def generate_summary_report(self, release_info: Dict[str, Any], analysis: Dict[str, Any]) -> str:
        deployment = release_info.get('deployment_name', 'Unknown')
        namespace = release_info.get('namespace', 'default')
        root_cause = analysis.get('root_cause', 'Unknown')
        confidence = analysis.get('confidence', 'low')

        return f"""# K8s 发布失败摘要

**Deployment**: `{deployment}` (Namespace: `{namespace}`)

| 项目 | 结果 |
|------|------|
| 根因 | **{root_cause}** |
| 置信度 | {confidence} |

## 快速排查建议

{chr(10).join(f'- {s}' for s in analysis.get('suggested_actions', [])[:3])}
"""
