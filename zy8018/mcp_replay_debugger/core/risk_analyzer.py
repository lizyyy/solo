from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set
from collections import defaultdict

from .trace_parser import ToolCallEvent
from .schema_parser import ToolSchema


@dataclass
class RiskIssue:
    tool_name: str
    tool_call_id: str
    risk_type: str
    severity: str
    message: str
    details: Dict[str, Any]


class RiskAnalyzer:
    NON_IDEMPOTENT_KEYWORDS = {
        "create", "delete", "remove", "update", "modify", "insert", "add",
        "send", "post", "execute", "run", "start", "stop", "cancel",
        "approve", "reject", "publish", "deploy", "purchase", "order",
        "charge", "pay", "transfer", "withdraw", "deposit",
        "write", "append", "overwrite",
    }

    IDEMPOTENT_KEYWORDS = {
        "get", "read", "list", "search", "find", "query", "lookup",
        "check", "verify", "validate", "test", "ping", "health",
        "info", "describe", "explain", "help",
        "list_all", "count", "stats", "status",
    }

    RISK_TYPES = {
        "multiple_calls_same_id": "Same tool_call_id appears multiple times",
        "retry_on_non_idempotent": "Retry on potentially non-idempotent tool",
        "error_with_side_effect": "Error occurred but tool may have side effects",
        "parallel_non_idempotent": "Parallel execution of non-idempotent tools",
        "missing_response": "Tool call has no response recorded",
        "time_travel": "Event timestamps out of order",
    }

    def __init__(self):
        self.risks: List[RiskIssue] = []
        self._tool_idempotency_cache: Dict[str, Optional[bool]] = {}

    def analyze(
        self,
        events: List[ToolCallEvent],
        tools: Optional[Dict[str, ToolSchema]] = None,
    ) -> List[RiskIssue]:
        self.risks = []
        self._tool_idempotency_cache = {}

        tools = tools or {}

        self._check_duplicate_tool_call_ids(events)
        self._check_retries_on_non_idempotent(events, tools)
        self._check_errors_with_side_effects(events, tools)
        self._check_missing_responses(events)
        self._check_timestamp_order(events)

        return self.risks

    def _check_duplicate_tool_call_ids(self, events: List[ToolCallEvent]):
        id_counts: Dict[str, List[ToolCallEvent]] = defaultdict(list)
        for event in events:
            id_counts[event.id].append(event)

        for call_id, event_list in id_counts.items():
            if len(event_list) > 1:
                unique_tools = {e.tool_name for e in event_list}
                has_different_tools = len(unique_tools) > 1

                if has_different_tools:
                    self._add_risk(
                        tool_name=event_list[0].tool_name,
                        tool_call_id=call_id,
                        risk_type="multiple_calls_same_id",
                        severity="high",
                        message=f"tool_call_id '{call_id}' used by different tools: {', '.join(unique_tools)}",
                        details={
                            "count": len(event_list),
                            "tools": list(unique_tools),
                            "timestamps": [e.timestamp.isoformat() for e in event_list],
                        },
                    )
                else:
                    request_events = [e for e in event_list if e.event_type == "request" or (e.response is None and e.error is None)]
                    if len(request_events) > 1:
                        self._add_risk(
                            tool_name=event_list[0].tool_name,
                            tool_call_id=call_id,
                            risk_type="multiple_calls_same_id",
                            severity="medium",
                            message=f"tool_call_id '{call_id}' has {len(request_events)} request events (possible retries)",
                            details={
                                "request_count": len(request_events),
                                "total_count": len(event_list),
                                "timestamps": [e.timestamp.isoformat() for e in event_list],
                            },
                        )

    def _check_retries_on_non_idempotent(
        self,
        events: List[ToolCallEvent],
        tools: Dict[str, ToolSchema],
    ):
        for event in events:
            if event.is_retry and not self._is_idempotent(event.tool_name, tools):
                self._add_risk(
                    tool_name=event.tool_name,
                    tool_call_id=event.id,
                    risk_type="retry_on_non_idempotent",
                    severity="high",
                    message=f"Retry {event.retry_count} on potentially non-idempotent tool '{event.tool_name}'",
                    details={
                        "retry_count": event.retry_count,
                        "is_idempotent": False,
                        "original_error": event.error,
                    },
                )

    def _check_errors_with_side_effects(
        self,
        events: List[ToolCallEvent],
        tools: Dict[str, ToolSchema],
    ):
        for event in events:
            if event.error and not self._is_idempotent(event.tool_name, tools):
                self._add_risk(
                    tool_name=event.tool_name,
                    tool_call_id=event.id,
                    risk_type="error_with_side_effect",
                    severity="high",
                    message=f"Error occurred on non-idempotent tool '{event.tool_name}': {event.error}",
                    details={
                        "error": event.error,
                        "response": event.response,
                        "is_idempotent": False,
                    },
                )

    def _check_missing_responses(self, events: List[ToolCallEvent]):
        id_groups: Dict[str, List[ToolCallEvent]] = defaultdict(list)
        for event in events:
            id_groups[event.id].append(event)

        for call_id, event_list in id_groups.items():
            has_response = any(e.response is not None for e in event_list)
            has_error = any(e.error is not None for e in event_list)

            if not has_response and not has_error:
                first_event = event_list[0]
                self._add_risk(
                    tool_name=first_event.tool_name,
                    tool_call_id=call_id,
                    risk_type="missing_response",
                    severity="medium",
                    message=f"Tool call '{first_event.tool_name}' (id: {call_id}) has no response or error recorded",
                    details={
                        "event_count": len(event_list),
                        "first_event_type": first_event.event_type,
                        "first_timestamp": first_event.timestamp.isoformat(),
                    },
                )

    def _check_timestamp_order(self, events: List[ToolCallEvent]):
        sorted_by_id = defaultdict(list)
        for event in events:
            sorted_by_id[event.id].append(event)

        for call_id, event_list in sorted_by_id.items():
            if len(event_list) < 2:
                continue

            sorted_events = sorted(event_list, key=lambda e: e.timestamp)
            for i in range(1, len(sorted_events)):
                prev = sorted_events[i - 1]
                curr = sorted_events[i]

                if prev.timestamp > curr.timestamp:
                    self._add_risk(
                        tool_name=curr.tool_name,
                        tool_call_id=call_id,
                        risk_type="time_travel",
                        severity="medium",
                        message=f"Event timestamps out of order for tool_call_id '{call_id}'",
                        details={
                            "earlier_event": {
                                "timestamp": prev.timestamp.isoformat(),
                                "event_type": prev.event_type,
                            },
                            "later_event": {
                                "timestamp": curr.timestamp.isoformat(),
                                "event_type": curr.event_type,
                            },
                        },
                    )

    def _is_idempotent(
        self,
        tool_name: str,
        tools: Dict[str, ToolSchema],
    ) -> Optional[bool]:
        if tool_name in self._tool_idempotency_cache:
            return self._tool_idempotency_cache[tool_name]

        if tool_name in tools:
            schema = tools[tool_name]
            description = schema.description.lower()
            name_lower = tool_name.lower()

            for keyword in self.IDEMPOTENT_KEYWORDS:
                if keyword in name_lower or keyword in description:
                    self._tool_idempotency_cache[tool_name] = True
                    return True

            for keyword in self.NON_IDEMPOTENT_KEYWORDS:
                if keyword in name_lower or keyword in description:
                    self._tool_idempotency_cache[tool_name] = False
                    return False

        name_lower = tool_name.lower()
        for keyword in self.IDEMPOTENT_KEYWORDS:
            if keyword in name_lower:
                self._tool_idempotency_cache[tool_name] = True
                return True

        for keyword in self.NON_IDEMPOTENT_KEYWORDS:
            if keyword in name_lower:
                self._tool_idempotency_cache[tool_name] = False
                return False

        self._tool_idempotency_cache[tool_name] = None
        return None

    def _add_risk(
        self,
        tool_name: str,
        tool_call_id: str,
        risk_type: str,
        severity: str,
        message: str,
        details: Dict[str, Any],
    ):
        self.risks.append(
            RiskIssue(
                tool_name=tool_name,
                tool_call_id=tool_call_id,
                risk_type=risk_type,
                severity=severity,
                message=message,
                details=details,
            )
        )

    def get_risks_by_severity(self) -> Dict[str, List[RiskIssue]]:
        by_severity = defaultdict(list)
        for risk in self.risks:
            by_severity[risk.severity].append(risk)
        return dict(by_severity)

    def get_risks_by_tool(self) -> Dict[str, List[RiskIssue]]:
        by_tool = defaultdict(list)
        for risk in self.risks:
            by_tool[risk.tool_name].append(risk)
        return dict(by_tool)

    def get_summary(self) -> Dict[str, Any]:
        by_severity = self.get_risks_by_severity()
        by_type = defaultdict(list)
        for risk in self.risks:
            by_type[risk.risk_type].append(risk)

        return {
            "total_risks": len(self.risks),
            "by_severity": {
                "high": len(by_severity.get("high", [])),
                "medium": len(by_severity.get("medium", [])),
                "low": len(by_severity.get("low", [])),
            },
            "by_type": {k: len(v) for k, v in by_type.items()},
        }
