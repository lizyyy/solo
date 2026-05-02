from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..core.schema_parser import ToolSchema
from ..core.trace_parser import ToolCallEvent
from ..core.timeline_rebuilder import Timeline, TimelineEvent
from ..core.schema_drift import SchemaDriftIssue, SchemaDriftDetector
from ..core.risk_analyzer import RiskIssue, RiskAnalyzer


class MarkdownGenerator:
    def __init__(self):
        pass

    def generate_full_report(
        self,
        timeline: Timeline,
        drift_issues: List[SchemaDriftIssue],
        risk_issues: List[RiskIssue],
        tools: Dict[str, ToolSchema],
        events: List[ToolCallEvent],
        replay_plan: Optional[Dict[str, Any]] = None,
    ) -> str:
        drift_detector = SchemaDriftDetector()
        drift_detector.issues = drift_issues
        drift_summary = drift_detector.get_summary()

        risk_analyzer = RiskAnalyzer()
        risk_analyzer.risks = risk_issues
        risk_summary = risk_analyzer.get_summary()

        timeline_summary = timeline.get_summary()

        sections = [
            self._generate_header(),
            self._generate_summary_section(
                timeline_summary, drift_summary, risk_summary, tools, events
            ),
            self._generate_schema_drift_section(drift_issues, drift_summary),
            self._generate_risk_section(risk_issues, risk_summary),
            self._generate_timeline_section(timeline),
            self._generate_tools_section(tools),
        ]

        if replay_plan:
            sections.append(self._generate_replay_plan_section(replay_plan))

        return "\n\n".join(sections)

    def generate_file(
        self,
        output_path: str,
        timeline: Timeline,
        drift_issues: List[SchemaDriftIssue],
        risk_issues: List[RiskIssue],
        tools: Dict[str, ToolSchema],
        events: List[ToolCallEvent],
        replay_plan: Optional[Dict[str, Any]] = None,
    ) -> str:
        content = self.generate_full_report(
            timeline, drift_issues, risk_issues, tools, events, replay_plan
        )

        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

        return str(path)

    def _generate_header(self) -> str:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return f"""# MCP 工具调用重放分析报告

> 生成时间: {now}
> 工具版本: 0.1.0

---
"""

    def _generate_summary_section(
        self,
        timeline_summary: Dict[str, Any],
        drift_summary: Dict[str, Any],
        risk_summary: Dict[str, Any],
        tools: Dict[str, ToolSchema],
        events: List[ToolCallEvent],
    ) -> str:
        sections = []
        sections.append("## 总览\n")

        tool_usage = timeline_summary.get("tool_usage", {})
        tool_lines = [f"  - **{k}**: {v} 次" for k, v in tool_usage.items()]
        tool_list_str = "\n".join(tool_lines) if tool_lines else "  *无*"

        sections.append(f"""### 基本统计

| 指标 | 数值 |
|------|------|
| 定义的工具数 | {len(tools)} |
| 总事件数 | {timeline_summary['total_events']} |
| 唯一工具调用 | {timeline_summary['unique_tool_calls']} |
| 重试次数 | {timeline_summary['retry_count']} |
| 错误次数 | {timeline_summary['error_count']} |
| 总时长 | {timeline_summary['total_duration_ms']:.2f} ms |
| 并行批次 | {timeline_summary['parallel_batches']} |

### 工具使用情况

{tool_list_str}
""")

        drift_high = drift_summary["by_severity"]["high"]
        drift_med = drift_summary["by_severity"]["medium"]
        drift_low = drift_summary["by_severity"]["low"]

        risk_high = risk_summary["by_severity"]["high"]
        risk_med = risk_summary["by_severity"]["medium"]
        risk_low = risk_summary["by_severity"]["low"]

        sections.append(f"""### 问题概览

#### Schema 漂移

| 严重级别 | 数量 |
|----------|------|
| 🔴 高 | {drift_high} |
| 🟡 中 | {drift_med} |
| 🟢 低 | {drift_low} |

#### 风险分析

| 严重级别 | 数量 |
|----------|------|
| 🔴 高 | {risk_high} |
| 🟡 中 | {risk_med} |
| 🟢 低 | {risk_low} |
""")

        return "\n".join(sections)

    def _generate_schema_drift_section(
        self,
        issues: List[SchemaDriftIssue],
        summary: Dict[str, Any],
    ) -> str:
        if not issues:
            return """## Schema 漂移分析

✅ **未检测到 Schema 漂移问题**
"""

        sections = ["## Schema 漂移分析\n"]

        by_severity: Dict[str, List[SchemaDriftIssue]] = {
            "high": [], "medium": [], "low": []
        }
        for issue in issues:
            by_severity[issue.severity].append(issue)

        severity_order = [("high", "🔴 高严重性"), ("medium", "🟡 中严重性"), ("low", "🟢 低严重性")]

        for severity_key, label in severity_order:
            severity_issues = by_severity.get(severity_key, [])
            if not severity_issues:
                continue

            sections.append(f"### {label} ({len(severity_issues)} 个)\n")

            for issue in severity_issues:
                field_info = f"字段: `{issue.field_path}`" if issue.field_path else ""
                sections.append(f"""#### {issue.tool_name} - {issue.issue_type}

- **工具调用 ID**: `{issue.tool_call_id}`
- **问题类型**: `{issue.issue_type}`
""")
                if field_info:
                    sections.append(f"- **{field_info}**")
                sections.append(f"- **消息**: {issue.message}")

                if issue.recorded_value is not None:
                    import json
                    sections.append(f"- **记录值**: `{json.dumps(issue.recorded_value, ensure_ascii=False)}`")

                if issue.schema_requirement is not None:
                    import json
                    sections.append(f"- **Schema 要求**: `{json.dumps(issue.schema_requirement, ensure_ascii=False)}`")

                sections.append("")

        return "\n".join(sections)

    def _generate_risk_section(
        self,
        issues: List[RiskIssue],
        summary: Dict[str, Any],
    ) -> str:
        if not issues:
            return """## 风险分析

✅ **未检测到潜在风险**
"""

        sections = ["## 风险分析\n"]

        by_severity: Dict[str, List[RiskIssue]] = {
            "high": [], "medium": [], "low": []
        }
        for issue in issues:
            by_severity[issue.severity].append(issue)

        severity_order = [("high", "🔴 高风险"), ("medium", "🟡 中风险"), ("low", "🟢 低风险")]

        for severity_key, label in severity_order:
            severity_issues = by_severity.get(severity_key, [])
            if not severity_issues:
                continue

            sections.append(f"### {label} ({len(severity_issues)} 个)\n")

            for issue in severity_issues:
                sections.append(f"""#### {issue.tool_name} - {issue.risk_type}

- **工具调用 ID**: `{issue.tool_call_id}`
- **风险类型**: `{issue.risk_type}`
- **消息**: {issue.message}
""")
                if issue.details:
                    import json
                    details_str = json.dumps(issue.details, indent=2, ensure_ascii=False)
                    sections.append(f"**详情**:\n```json\n{details_str}\n```\n")

        return "\n".join(sections)

    def _generate_timeline_section(self, timeline: Timeline) -> str:
        sections = ["## 时间线分析\n"]

        sections.append(f"""### 时间信息

- **开始时间**: {timeline.start_time.isoformat()}
- **结束时间**: {timeline.end_time.isoformat()}
- **总时长**: {timeline.total_duration_ms:.2f} ms
- **并行批次**: {len(timeline.parallel_batches)}
""")

        sections.append("### 事件序列\n")

        for batch_idx, batch in enumerate(timeline.parallel_batches, 1):
            is_parallel = len(batch) > 1
            parallel_label = " [并行]" if is_parallel else ""
            sections.append(f"#### 批次 {batch_idx}{parallel_label}\n")

            for te in batch:
                event = te.event
                status_icon = "✅" if event.event_type == "response" else ("❌" if event.error else "⏳")
                retry_label = f" [重试 #{event.retry_count}]" if event.is_retry else ""

                sections.append(f"""{status_icon} **{event.tool_name}** `{event.id}`{retry_label}
  - 相对时间: {te.relative_time_ms:.2f} ms
  - 类型: {event.event_type}
""")
                if event.error:
                    sections.append(f"  - ❌ 错误: {event.error}")
                sections.append("")

        return "\n".join(sections)

    def _generate_tools_section(self, tools: Dict[str, ToolSchema]) -> str:
        if not tools:
            return """## 工具定义

*未定义任何工具*
"""

        sections = ["## 工具定义\n"]

        for name, tool in tools.items():
            sections.append(f"### {name}\n")
            sections.append(f"**描述**: {tool.description or '*无*'}\n")

            props = tool.input_schema.get("properties", {})
            required = tool.input_schema.get("required", [])

            if props:
                sections.append("**参数**:\n")
                sections.append("| 参数名 | 类型 | 必填 | 说明 |")
                sections.append("|---------|------|------|------|")

                for prop_name, prop_schema in props.items():
                    prop_type = prop_schema.get("type", "any")
                    is_required = "是" if prop_name in required else "否"
                    description = prop_schema.get("description", "*无*")
                    sections.append(f"| `{prop_name}` | `{prop_type}` | {is_required} | {description} |")

            sections.append("")

        return "\n".join(sections)

    def _generate_replay_plan_section(self, plan: Dict[str, Any]) -> str:
        sections = ["## 重放计划\n"]

        sections.append(f"""### 配置

- **模式**: {plan.get('mode', 'dry_run')}
- **总步骤**: {plan.get('total_steps', 0)}
- **总批次**: {plan.get('total_batches', 0)}
- **遵循时间**: {'是' if plan.get('respect_timing', True) else '否'}
- **包含重试**: {'是' if plan.get('include_retries', True) else '否'}
""")

        batches = plan.get("steps", [])
        if batches:
            sections.append("### 执行计划\n")

            for batch in batches:
                batch_num = batch.get("batch", 0)
                is_parallel = batch.get("is_parallel", False)
                events = batch.get("events", [])

                parallel_label = " (并行执行)" if is_parallel else ""
                sections.append(f"#### 批次 {batch_num}{parallel_label}\n")

                for event in events:
                    step = event.get("step", 0)
                    tool_name = event.get("tool_name", "unknown")
                    call_id = event.get("tool_call_id", "")
                    is_retry = event.get("is_retry", False)
                    retry_count = event.get("retry_count", 0)

                    retry_label = f" [重试 #{retry_count}]" if is_retry else ""
                    sections.append(f"**步骤 {step}**: `{tool_name}` `{call_id}`{retry_label}")

                    args = event.get("arguments", {})
                    if args:
                        import json
                        args_str = json.dumps(args, indent=2, ensure_ascii=False)
                        sections.append(f"  参数:\n```json\n{args_str}\n```\n")

                    expected_error = event.get("expected_error")
                    if expected_error:
                        sections.append(f"  ⚠️ 预期错误: {expected_error}")

                sections.append("")

        return "\n".join(sections)
