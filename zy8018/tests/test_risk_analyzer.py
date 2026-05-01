import json
import pytest
from datetime import datetime

from mcp_replay_debugger.core.schema_parser import SchemaParser
from mcp_replay_debugger.core.trace_parser import TraceParser
from mcp_replay_debugger.core.risk_analyzer import RiskAnalyzer, RiskIssue


class TestRiskAnalyzer:
    def test_detect_duplicate_tool_call_ids(self):
        schema_data = {
            "tools": [
                {"name": "test_tool", "description": "A test tool", "inputSchema": {}}
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        trace_lines = [
            json.dumps({"tool_call_id": "dup_id", "tool_name": "test_tool", "arguments": {}, "timestamp": "2024-01-15T10:00:00.000Z"}),
            json.dumps({"tool_call_id": "dup_id", "tool_name": "test_tool", "arguments": {}, "timestamp": "2024-01-15T10:00:01.000Z"}),
            json.dumps({"tool_call_id": "unique_id", "tool_name": "test_tool", "arguments": {}, "timestamp": "2024-01-15T10:00:02.000Z"}),
        ]

        trace_parser = TraceParser()
        events = trace_parser.parse_lines(trace_lines)

        analyzer = RiskAnalyzer()
        risks = analyzer.analyze(events, tools)

        duplicate_risks = [r for r in risks if r.risk_type == "multiple_calls_same_id"]
        assert len(duplicate_risks) == 1
        assert duplicate_risks[0].tool_call_id == "dup_id"

    def test_detect_different_tools_same_id(self):
        schema_data = {
            "tools": [
                {"name": "tool1", "description": "", "inputSchema": {}},
                {"name": "tool2", "description": "", "inputSchema": {}},
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        trace_lines = [
            json.dumps({"tool_call_id": "same_id", "tool_name": "tool1", "arguments": {}, "timestamp": "2024-01-15T10:00:00.000Z"}),
            json.dumps({"tool_call_id": "same_id", "tool_name": "tool2", "arguments": {}, "timestamp": "2024-01-15T10:00:01.000Z"}),
        ]

        trace_parser = TraceParser()
        events = trace_parser.parse_lines(trace_lines)

        analyzer = RiskAnalyzer()
        risks = analyzer.analyze(events, tools)

        duplicate_risks = [r for r in risks if r.risk_type == "multiple_calls_same_id"]
        assert len(duplicate_risks) == 1
        assert duplicate_risks[0].severity == "high"

    def test_retry_on_non_idempotent_tool(self):
        schema_data = {
            "tools": [
                {
                    "name": "create_user",
                    "description": "Create a new user (non-idempotent)",
                    "inputSchema": {}
                },
                {
                    "name": "get_user",
                    "description": "Get user info (idempotent)",
                    "inputSchema": {}
                },
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        trace_lines = [
            json.dumps({"tool_call_id": "c1", "tool_name": "create_user", "arguments": {}, "timestamp": "2024-01-15T10:00:00.000Z", "event_type": "request"}),
            json.dumps({"tool_call_id": "c1", "tool_name": "create_user", "arguments": {}, "timestamp": "2024-01-15T10:00:00.500Z", "event_type": "error", "error": "Timeout"}),
            json.dumps({"tool_call_id": "c1", "tool_name": "create_user", "arguments": {}, "timestamp": "2024-01-15T10:00:01.000Z", "event_type": "request"}),
            json.dumps({"tool_call_id": "c1", "tool_name": "create_user", "arguments": {}, "timestamp": "2024-01-15T10:00:01.500Z", "event_type": "response", "response": {}}),
        ]

        trace_parser = TraceParser()
        events = trace_parser.parse_lines(trace_lines)

        analyzer = RiskAnalyzer()
        risks = analyzer.analyze(events, tools)

        retry_risks = [r for r in risks if r.risk_type == "retry_on_non_idempotent"]
        assert len(retry_risks) >= 1

    def test_idempotent_tool_retries_not_risky(self):
        schema_data = {
            "tools": [
                {
                    "name": "get_user_info",
                    "description": "Get user information - safe to retry",
                    "inputSchema": {}
                },
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        trace_lines = [
            json.dumps({"tool_call_id": "c1", "tool_name": "get_user_info", "arguments": {}, "timestamp": "2024-01-15T10:00:00.000Z"}),
            json.dumps({"tool_call_id": "c1", "tool_name": "get_user_info", "arguments": {}, "timestamp": "2024-01-15T10:00:01.000Z"}),
        ]

        trace_parser = TraceParser()
        events = trace_parser.parse_lines(trace_lines)

        analyzer = RiskAnalyzer()
        risks = analyzer.analyze(events, tools)

        retry_risks = [r for r in risks if r.risk_type == "retry_on_non_idempotent"]
        assert len(retry_risks) == 0

    def test_error_on_non_idempotent_tool(self):
        schema_data = {
            "tools": [
                {
                    "name": "delete_file",
                    "description": "Delete a file",
                    "inputSchema": {}
                },
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        trace_lines = [
            json.dumps({
                "tool_call_id": "c1",
                "tool_name": "delete_file",
                "arguments": {},
                "timestamp": "2024-01-15T10:00:00.000Z",
                "error": "Network error during deletion"
            }),
        ]

        trace_parser = TraceParser()
        events = trace_parser.parse_lines(trace_lines)

        analyzer = RiskAnalyzer()
        risks = analyzer.analyze(events, tools)

        error_risks = [r for r in risks if r.risk_type == "error_with_side_effect"]
        assert len(error_risks) == 1

    def test_missing_response(self):
        schema_data = {
            "tools": [
                {"name": "test_tool", "description": "", "inputSchema": {}}
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        trace_lines = [
            json.dumps({
                "tool_call_id": "c1",
                "tool_name": "test_tool",
                "arguments": {},
                "timestamp": "2024-01-15T10:00:00.000Z",
                "event_type": "request"
            }),
        ]

        trace_parser = TraceParser()
        events = trace_parser.parse_lines(trace_lines)

        analyzer = RiskAnalyzer()
        risks = analyzer.analyze(events, tools)

        missing_risks = [r for r in risks if r.risk_type == "missing_response"]
        assert len(missing_risks) == 1

    def test_get_risks_by_severity(self):
        schema_data = {
            "tools": [
                {"name": "tool1", "description": "Create something", "inputSchema": {}}
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        trace_lines = [
            json.dumps({"tool_call_id": "c1", "tool_name": "tool1", "arguments": {}, "timestamp": "2024-01-15T10:00:00.000Z"}),
            json.dumps({"tool_call_id": "c1", "tool_name": "tool1", "arguments": {}, "timestamp": "2024-01-15T10:00:01.000Z"}),
        ]

        trace_parser = TraceParser()
        events = trace_parser.parse_lines(trace_lines)

        analyzer = RiskAnalyzer()
        analyzer.analyze(events, tools)

        by_severity = analyzer.get_risks_by_severity()
        assert len(by_severity) > 0

    def test_get_summary(self):
        schema_data = {
            "tools": [
                {"name": "tool1", "description": "Create", "inputSchema": {}}
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        trace_lines = [
            json.dumps({"tool_call_id": "c1", "tool_name": "tool1", "arguments": {}, "timestamp": "2024-01-15T10:00:00.000Z"}),
            json.dumps({"tool_call_id": "c1", "tool_name": "tool1", "arguments": {}, "timestamp": "2024-01-15T10:00:01.000Z"}),
        ]

        trace_parser = TraceParser()
        events = trace_parser.parse_lines(trace_lines)

        analyzer = RiskAnalyzer()
        analyzer.analyze(events, tools)

        summary = analyzer.get_summary()

        assert summary["total_risks"] > 0

    def test_no_risks_when_valid(self):
        schema_data = {
            "tools": [
                {"name": "read_file", "description": "Read a file", "inputSchema": {}}
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        trace_lines = [
            json.dumps({
                "tool_call_id": "c1",
                "tool_name": "read_file",
                "arguments": {},
                "timestamp": "2024-01-15T10:00:00.000Z",
                "event_type": "request"
            }),
            json.dumps({
                "tool_call_id": "c1",
                "tool_name": "read_file",
                "arguments": {},
                "timestamp": "2024-01-15T10:00:00.100Z",
                "event_type": "response",
                "response": {}
            }),
        ]

        trace_parser = TraceParser()
        events = trace_parser.parse_lines(trace_lines)

        analyzer = RiskAnalyzer()
        risks = analyzer.analyze(events, tools)

        assert len(risks) == 0
