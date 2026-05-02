import json
import pytest
from datetime import datetime

from mcp_replay_debugger.core.schema_parser import SchemaParser
from mcp_replay_debugger.core.trace_parser import TraceParser
from mcp_replay_debugger.core.schema_drift import SchemaDriftDetector, SchemaDriftIssue, FieldMapping


class TestSchemaDriftDetector:
    def test_detect_missing_required_field(self):
        schema_data = {
            "tools": [
                {
                    "name": "test_tool",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "required_param": {"type": "string"},
                            "optional_param": {"type": "integer"}
                        },
                        "required": ["required_param"]
                    }
                }
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        trace_lines = [
            json.dumps({
                "tool_call_id": "c1",
                "tool_name": "test_tool",
                "arguments": {"optional_param": 42},
                "timestamp": "2024-01-15T10:00:00.000Z"
            })
        ]

        trace_parser = TraceParser()
        events = trace_parser.parse_lines(trace_lines)

        detector = SchemaDriftDetector()
        issues = detector.detect(tools, events)

        assert len(issues) == 1
        assert issues[0].issue_type == "missing_required_field"
        assert issues[0].field_path == "required_param"
        assert issues[0].severity == "high"

    def test_detect_type_mismatch(self):
        schema_data = {
            "tools": [
                {
                    "name": "test_tool",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "str_param": {"type": "string"},
                            "int_param": {"type": "integer"}
                        }
                    }
                }
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        trace_lines = [
            json.dumps({
                "tool_call_id": "c1",
                "tool_name": "test_tool",
                "arguments": {"str_param": 123, "int_param": "not_an_int"},
                "timestamp": "2024-01-15T10:00:00.000Z"
            })
        ]

        trace_parser = TraceParser()
        events = trace_parser.parse_lines(trace_lines)

        detector = SchemaDriftDetector()
        issues = detector.detect(tools, events)

        type_issues = [i for i in issues if i.issue_type == "type_mismatch"]
        assert len(type_issues) >= 1

    def test_detect_enum_violation(self):
        schema_data = {
            "tools": [
                {
                    "name": "test_tool",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "lang": {"type": "string", "enum": ["python", "go", "rust"]}
                        }
                    }
                }
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        trace_lines = [
            json.dumps({
                "tool_call_id": "c1",
                "tool_name": "test_tool",
                "arguments": {"lang": "invalid_lang"},
                "timestamp": "2024-01-15T10:00:00.000Z"
            })
        ]

        trace_parser = TraceParser()
        events = trace_parser.parse_lines(trace_lines)

        detector = SchemaDriftDetector()
        issues = detector.detect(tools, events)

        enum_issues = [i for i in issues if i.issue_type == "enum_violation"]
        assert len(enum_issues) == 1
        assert enum_issues[0].recorded_value == "invalid_lang"

    def test_detect_constraint_violation(self):
        schema_data = {
            "tools": [
                {
                    "name": "test_tool",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "count": {"type": "integer", "minimum": 1, "maximum": 100}
                        }
                    }
                }
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        trace_lines = [
            json.dumps({
                "tool_call_id": "c1",
                "tool_name": "test_tool",
                "arguments": {"count": 200},
                "timestamp": "2024-01-15T10:00:00.000Z"
            })
        ]

        trace_parser = TraceParser()
        events = trace_parser.parse_lines(trace_lines)

        detector = SchemaDriftDetector()
        issues = detector.detect(tools, events)

        constraint_issues = [i for i in issues if i.issue_type == "constraint_violation"]
        assert len(constraint_issues) == 1

    def test_tool_not_found(self):
        schema_data = {
            "tools": [
                {"name": "existing_tool", "inputSchema": {}}
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        trace_lines = [
            json.dumps({
                "tool_call_id": "c1",
                "tool_name": "nonexistent_tool",
                "arguments": {},
                "timestamp": "2024-01-15T10:00:00.000Z"
            })
        ]

        trace_parser = TraceParser()
        events = trace_parser.parse_lines(trace_lines)

        detector = SchemaDriftDetector()
        issues = detector.detect(tools, events)

        not_found_issues = [i for i in issues if i.issue_type == "tool_not_found"]
        assert len(not_found_issues) == 1
        assert not_found_issues[0].severity == "high"

    def test_no_drift_when_valid(self):
        schema_data = {
            "tools": [
                {
                    "name": "valid_tool",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "param": {"type": "string"}
                        }
                    }
                }
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        trace_lines = [
            json.dumps({
                "tool_call_id": "c1",
                "tool_name": "valid_tool",
                "arguments": {"param": "valid_value"},
                "timestamp": "2024-01-15T10:00:00.000Z"
            })
        ]

        trace_parser = TraceParser()
        events = trace_parser.parse_lines(trace_lines)

        detector = SchemaDriftDetector()
        issues = detector.detect(tools, events)

        assert len(issues) == 0

    def test_get_issues_by_tool(self):
        schema_data = {
            "tools": [
                {"name": "tool1", "inputSchema": {"type": "object", "properties": {}, "required": ["missing"]}},
                {"name": "tool2", "inputSchema": {}}
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        trace_lines = [
            json.dumps({"tool_call_id": "c1", "tool_name": "tool1", "arguments": {}, "timestamp": "2024-01-15T10:00:00.000Z"}),
            json.dumps({"tool_call_id": "c2", "tool_name": "tool2", "arguments": {}, "timestamp": "2024-01-15T10:00:01.000Z"}),
        ]

        trace_parser = TraceParser()
        events = trace_parser.parse_lines(trace_lines)

        detector = SchemaDriftDetector()
        detector.detect(tools, events)

        by_tool = detector.get_issues_by_tool()

        assert "tool1" in by_tool
        assert len(by_tool["tool1"]) == 1

    def test_get_issues_by_severity(self):
        schema_data = {
            "tools": [
                {"name": "tool1", "inputSchema": {"type": "object", "properties": {}, "required": ["missing"]}},
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        trace_lines = [
            json.dumps({"tool_call_id": "c1", "tool_name": "tool1", "arguments": {}, "timestamp": "2024-01-15T10:00:00.000Z"}),
        ]

        trace_parser = TraceParser()
        events = trace_parser.parse_lines(trace_lines)

        detector = SchemaDriftDetector()
        detector.detect(tools, events)

        by_severity = detector.get_issues_by_severity()

        assert "high" in by_severity
        assert len(by_severity["high"]) == 1

    def test_get_summary(self):
        schema_data = {
            "tools": [
                {"name": "tool1", "inputSchema": {"type": "object", "properties": {}, "required": ["missing"]}},
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        trace_lines = [
            json.dumps({"tool_call_id": "c1", "tool_name": "tool1", "arguments": {}, "timestamp": "2024-01-15T10:00:00.000Z"}),
        ]

        trace_parser = TraceParser()
        events = trace_parser.parse_lines(trace_lines)

        detector = SchemaDriftDetector()
        detector.detect(tools, events)

        summary = detector.get_summary()

        assert summary["total_issues"] == 1
        assert summary["by_severity"]["high"] == 1

    def test_extra_field_detection(self):
        schema_data = {
            "tools": [
                {
                    "name": "test_tool",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "allowed": {"type": "string"}
                        },
                        "additionalProperties": False
                    }
                }
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        trace_lines = [
            json.dumps({
                "tool_call_id": "c1",
                "tool_name": "test_tool",
                "arguments": {"allowed": "ok", "extra_field": "not_allowed"},
                "timestamp": "2024-01-15T10:00:00.000Z"
            })
        ]

        trace_parser = TraceParser()
        events = trace_parser.parse_lines(trace_lines)

        detector = SchemaDriftDetector()
        issues = detector.detect(tools, events)

        extra_issues = [i for i in issues if i.issue_type == "extra_unknown_field"]
        assert len(extra_issues) == 1
