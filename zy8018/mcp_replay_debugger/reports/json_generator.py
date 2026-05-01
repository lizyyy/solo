import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..core.schema_parser import ToolSchema
from ..core.trace_parser import ToolCallEvent
from ..core.timeline_rebuilder import Timeline, TimelineEvent
from ..core.schema_drift import SchemaDriftIssue, SchemaDriftDetector
from ..core.risk_analyzer import RiskIssue, RiskAnalyzer


class JsonGenerator:
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
    ) -> Dict[str, Any]:
        report = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "version": "0.1.0",
            },
            "summary": self._generate_summary(
                timeline, drift_issues, risk_issues, tools, events
            ),
            "timeline": self._timeline_to_dict(timeline),
            "drift_issues": self._drift_issues_to_dict(drift_issues),
            "risk_issues": self._risk_issues_to_dict(risk_issues),
            "tools": self._tools_to_dict(tools),
            "events": self._events_to_dict(events),
        }

        if replay_plan:
            report["replay_plan"] = replay_plan

        return report

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
        report = self.generate_full_report(
            timeline, drift_issues, risk_issues, tools, events, replay_plan
        )

        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False, default=str)

        return str(path)

    def _generate_summary(
        self,
        timeline: Timeline,
        drift_issues: List[SchemaDriftIssue],
        risk_issues: List[RiskIssue],
        tools: Dict[str, ToolSchema],
        events: List[ToolCallEvent],
    ) -> Dict[str, Any]:
        drift_detector = SchemaDriftDetector()
        drift_detector.issues = drift_issues
        drift_summary = drift_detector.get_summary()

        risk_analyzer = RiskAnalyzer()
        risk_analyzer.risks = risk_issues
        risk_summary = risk_analyzer.get_summary()

        timeline_summary = timeline.get_summary()

        return {
            "tools": {
                "total_defined": len(tools),
                "tool_names": list(tools.keys()),
            },
            "events": {
                "total": len(events),
                "unique_tool_calls": timeline_summary["unique_tool_calls"],
                "retries": timeline_summary["retry_count"],
                "errors": timeline_summary["error_count"],
            },
            "timeline": {
                "start_time": timeline_summary["start_time"],
                "end_time": timeline_summary["end_time"],
                "total_duration_ms": timeline_summary["total_duration_ms"],
                "parallel_batches": timeline_summary["parallel_batches"],
            },
            "schema_drift": drift_summary,
            "risks": risk_summary,
        }

    def _timeline_to_dict(self, timeline: Timeline) -> Dict[str, Any]:
        return {
            "start_time": timeline.start_time.isoformat(),
            "end_time": timeline.end_time.isoformat(),
            "total_duration_ms": timeline.total_duration_ms,
            "parallel_batches_count": len(timeline.parallel_batches),
            "events": [
                {
                    "tool_call_id": te.event.id,
                    "tool_name": te.event.tool_name,
                    "arguments": te.event.arguments,
                    "timestamp": te.event.timestamp.isoformat(),
                    "relative_time_ms": te.relative_time_ms,
                    "event_type": te.event.event_type,
                    "response": te.event.response,
                    "error": te.event.error,
                    "duration_ms": te.event.duration_ms,
                    "is_retry": te.event.is_retry,
                    "retry_count": te.event.retry_count,
                    "group_id": te.group_id,
                    "sequence_in_group": te.sequence_in_group,
                }
                for te in timeline.events
            ],
        }

    def _drift_issues_to_dict(
        self, issues: List[SchemaDriftIssue]
    ) -> List[Dict[str, Any]]:
        return [
            {
                "tool_name": issue.tool_name,
                "tool_call_id": issue.tool_call_id,
                "issue_type": issue.issue_type,
                "field_path": issue.field_path,
                "message": issue.message,
                "severity": issue.severity,
                "recorded_value": issue.recorded_value,
                "schema_requirement": issue.schema_requirement,
            }
            for issue in issues
        ]

    def _risk_issues_to_dict(self, issues: List[RiskIssue]) -> List[Dict[str, Any]]:
        return [
            {
                "tool_name": issue.tool_name,
                "tool_call_id": issue.tool_call_id,
                "risk_type": issue.risk_type,
                "severity": issue.severity,
                "message": issue.message,
                "details": issue.details,
            }
            for issue in issues
        ]

    def _tools_to_dict(self, tools: Dict[str, ToolSchema]) -> Dict[str, Any]:
        return {
            name: {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.input_schema,
            }
            for name, tool in tools.items()
        }

    def _events_to_dict(self, events: List[ToolCallEvent]) -> List[Dict[str, Any]]:
        return [
            {
                "id": event.id,
                "tool_name": event.tool_name,
                "arguments": event.arguments,
                "timestamp": event.timestamp.isoformat(),
                "event_type": event.event_type,
                "response": event.response,
                "error": event.error,
                "duration_ms": event.duration_ms,
                "is_retry": event.is_retry,
                "retry_count": event.retry_count,
            }
            for event in events
        ]
