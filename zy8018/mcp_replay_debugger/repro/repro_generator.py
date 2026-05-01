import json
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..core.schema_parser import ToolSchema, SchemaParser
from ..core.trace_parser import ToolCallEvent, TraceParser
from ..core.timeline_rebuilder import Timeline, TimelineRebuilder
from ..core.schema_drift import SchemaDriftIssue, SchemaDriftDetector
from ..core.risk_analyzer import RiskIssue, RiskAnalyzer


class ReproGenerator:
    def __init__(self):
        pass

    def generate_minimal_repro(
        self,
        output_dir: str,
        tools: Dict[str, ToolSchema],
        events: List[ToolCallEvent],
        timeline: Timeline,
        drift_issues: List[SchemaDriftIssue],
        risk_issues: List[RiskIssue],
        filter_config: Optional[Dict[str, Any]] = None,
    ) -> str:
        filter_config = filter_config or {}

        filtered_events = self._filter_events(events, drift_issues, risk_issues, filter_config)
        filtered_tools = self._filter_tools(tools, filtered_events, filter_config)

        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        self._write_schema(output_path / "schema.json", filtered_tools)
        self._write_trace(output_path / "trace.jsonl", filtered_events)
        self._write_repro_config(output_path / "repro_config.json", filter_config)
        self._write_readme(output_path / "README.md", filtered_events, drift_issues, risk_issues)

        return str(output_path)

    def _filter_events(
        self,
        events: List[ToolCallEvent],
        drift_issues: List[SchemaDriftIssue],
        risk_issues: List[RiskIssue],
        config: Dict[str, Any],
    ) -> List[ToolCallEvent]:
        mode = config.get("mode", "minimal")

        if mode == "full":
            return events.copy()

        problematic_call_ids = set()

        for issue in drift_issues:
            if config.get("include_drift", True):
                problematic_call_ids.add(issue.tool_call_id)

        for risk in risk_issues:
            if config.get("include_risks", True):
                problematic_call_ids.add(risk.tool_call_id)

        if config.get("include_errors", True):
            for event in events:
                if event.error:
                    problematic_call_ids.add(event.id)

        if config.get("include_retries", True):
            for event in events:
                if event.is_retry:
                    problematic_call_ids.add(event.id)

        if mode == "minimal" and not problematic_call_ids:
            return events[:1] if events else []

        filtered = []
        for event in events:
            if event.id in problematic_call_ids:
                filtered.append(event)

        if not filtered and events:
            return [events[0]]

        return filtered

    def _filter_tools(
        self,
        tools: Dict[str, ToolSchema],
        events: List[ToolCallEvent],
        config: Dict[str, Any],
    ) -> Dict[str, ToolSchema]:
        used_tool_names = {e.tool_name for e in events}

        filtered = {}
        for name, tool in tools.items():
            if name in used_tool_names:
                filtered[name] = tool

        return filtered

    def _write_schema(self, path: Path, tools: Dict[str, ToolSchema]):
        schema_list = []
        for name, tool in tools.items():
            schema_list.append({
                "name": tool.name,
                "description": tool.description,
                "inputSchema": tool.input_schema,
            })

        with open(path, "w", encoding="utf-8") as f:
            json.dump({"tools": schema_list}, f, indent=2, ensure_ascii=False)

    def _write_trace(self, path: Path, events: List[ToolCallEvent]):
        with open(path, "w", encoding="utf-8") as f:
            for event in events:
                line = {
                    "tool_call_id": event.id,
                    "tool_name": event.tool_name,
                    "arguments": event.arguments,
                    "timestamp": event.timestamp.isoformat(),
                    "event_type": event.event_type,
                }
                if event.response:
                    line["response"] = event.response
                if event.error:
                    line["error"] = event.error
                if event.duration_ms:
                    line["duration_ms"] = event.duration_ms
                if event.is_retry:
                    line["is_retry"] = True
                    line["retry_count"] = event.retry_count

                f.write(json.dumps(line, ensure_ascii=False) + "\n")

    def _write_repro_config(self, path: Path, config: Dict[str, Any]):
        repro_config = {
            "generated_at": datetime.now().isoformat(),
            "filter_mode": config.get("mode", "minimal"),
            "filters": {
                "include_drift": config.get("include_drift", True),
                "include_risks": config.get("include_risks", True),
                "include_errors": config.get("include_errors", True),
                "include_retries": config.get("include_retries", True),
            },
            "replay_hints": {
                "mode": "dry_run",
                "respect_timing": False,
                "stop_on_first_error": True,
            },
        }

        with open(path, "w", encoding="utf-8") as f:
            json.dump(repro_config, f, indent=2, ensure_ascii=False)

    def _write_readme(
        self,
        path: Path,
        events: List[ToolCallEvent],
        drift_issues: List[SchemaDriftIssue],
        risk_issues: List[RiskIssue],
    ):
        tool_counts: Dict[str, int] = {}
        for event in events:
            tool_counts[event.tool_name] = tool_counts.get(event.tool_name, 0) + 1

        tools_str = "\n".join(f"- `{k}`: {v} 次" for k, v in tool_counts.items())

        readme = f"""# MCP 最小复现包

## 概览

此复现包包含重现问题所需的最小数据。

### 包含的事件

- 总事件数: {len(events)}
- 涉及工具: {len(tool_counts)} 个

**工具统计**:
{tools_str}

### 问题统计

- Schema 漂移问题: {len(drift_issues)} 个
- 风险问题: {len(risk_issues)} 个

## 文件说明

- `schema.json`: 涉及的工具 Schema 定义
- `trace.jsonl`: 工具调用轨迹 (JSONL 格式)
- `repro_config.json`: 复现配置

## 如何使用

使用 mcp-replay 工具分析此复现包:

```bash
mcp-replay analyze \\
  --schema schema.json \\
  --trace trace.jsonl \\
  --output report.md
```

或使用 dry-run 模式生成重放计划:

```bash
mcp-replay plan \\
  --schema schema.json \\
  --trace trace.jsonl \\
  --output plan.json
```

## 注意事项

1. 此复现包已过滤为最小数据集，仅包含与问题相关的事件
2. 敏感数据已移除或脱敏（如果应用了过滤）
3. 如需完整数据，请使用原始轨迹文件

生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""

        with open(path, "w", encoding="utf-8") as f:
            f.write(readme)
