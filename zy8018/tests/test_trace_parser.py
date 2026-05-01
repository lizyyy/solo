import json
import pytest
from datetime import datetime

from mcp_replay_debugger.core.trace_parser import TraceParser, ToolCallEvent


class TestTraceParser:
    def test_parse_basic_event(self):
        lines = [
            json.dumps({
                "tool_call_id": "call_001",
                "tool_name": "search_code",
                "arguments": {"query": "test"},
                "timestamp": "2024-01-15T10:00:00.000Z",
                "event_type": "request"
            })
        ]

        parser = TraceParser()
        events = parser.parse_lines(lines)

        assert len(events) == 1
        event = events[0]
        assert event.id == "call_001"
        assert event.tool_name == "search_code"
        assert event.arguments == {"query": "test"}
        assert event.event_type == "request"

    def test_parse_multiple_events(self):
        lines = [
            json.dumps({"tool_call_id": "c1", "tool_name": "t1", "arguments": {}, "timestamp": "2024-01-15T10:00:00.000Z"}),
            json.dumps({"tool_call_id": "c2", "tool_name": "t2", "arguments": {}, "timestamp": "2024-01-15T10:00:01.000Z"}),
        ]

        parser = TraceParser()
        events = parser.parse_lines(lines)

        assert len(events) == 2

    def test_parse_with_response(self):
        lines = [
            json.dumps({
                "tool_call_id": "call_001",
                "tool_name": "read_file",
                "arguments": {"path": "/tmp/test.txt"},
                "timestamp": "2024-01-15T10:00:00.000Z",
                "event_type": "response",
                "response": {"content": "hello", "lines": 1}
            })
        ]

        parser = TraceParser()
        events = parser.parse_lines(lines)

        assert len(events) == 1
        assert events[0].response == {"content": "hello", "lines": 1}

    def test_parse_with_error(self):
        lines = [
            json.dumps({
                "tool_call_id": "call_001",
                "tool_name": "read_file",
                "arguments": {"path": "/nonexistent"},
                "timestamp": "2024-01-15T10:00:00.000Z",
                "error": "File not found"
            })
        ]

        parser = TraceParser()
        events = parser.parse_lines(lines)

        assert len(events) == 1
        assert events[0].error == "File not found"

    def test_alternative_key_names(self):
        lines = [
            json.dumps({
                "id": "alt_id",
                "function": "alt_function",
                "params": {"a": 1},
                "ts": "2024-01-15T10:00:00.000Z",
            })
        ]

        parser = TraceParser()
        events = parser.parse_lines(lines)

        assert len(events) == 1
        assert events[0].id == "alt_id"
        assert events[0].tool_name == "alt_function"
        assert events[0].arguments == {"a": 1}

    def test_tool_call_nested_format(self):
        lines = [
            json.dumps({
                "tool_call": {
                    "id": "nested_id",
                    "name": "nested_tool",
                    "arguments": {"nested": True}
                },
                "timestamp": "2024-01-15T10:00:00.000Z"
            })
        ]

        parser = TraceParser()
        events = parser.parse_lines(lines)

        assert len(events) == 1
        assert events[0].id == "nested_id"
        assert events[0].tool_name == "nested_tool"
        assert events[0].arguments == {"nested": True}

    def test_json_string_arguments(self):
        lines = [
            json.dumps({
                "tool_call_id": "c1",
                "tool_name": "t1",
                "arguments": '{"key": "value"}',
                "timestamp": "2024-01-15T10:00:00.000Z"
            })
        ]

        parser = TraceParser()
        events = parser.parse_lines(lines)

        assert len(events) == 1
        assert events[0].arguments == {"key": "value"}

    def test_unix_timestamp(self):
        lines = [
            json.dumps({
                "tool_call_id": "c1",
                "tool_name": "t1",
                "arguments": {},
                "timestamp": 1705312800
            })
        ]

        parser = TraceParser()
        events = parser.parse_lines(lines)

        assert len(events) == 1
        assert isinstance(events[0].timestamp, datetime)

    def test_unix_timestamp_ms(self):
        lines = [
            json.dumps({
                "tool_call_id": "c1",
                "tool_name": "t1",
                "arguments": {},
                "timestamp": 1705312800000
            })
        ]

        parser = TraceParser()
        events = parser.parse_lines(lines)

        assert len(events) == 1

    def test_missing_tool_call_id_returns_none(self):
        lines = [
            json.dumps({
                "tool_name": "t1",
                "arguments": {},
                "timestamp": "2024-01-15T10:00:00.000Z"
            })
        ]

        parser = TraceParser()
        events = parser.parse_lines(lines)

        assert len(events) == 0

    def test_empty_lines_ignored(self):
        lines = [
            "",
            json.dumps({"tool_call_id": "c1", "tool_name": "t1", "arguments": {}, "timestamp": "2024-01-15T10:00:00.000Z"}),
            "   ",
        ]

        parser = TraceParser()
        events = parser.parse_lines(lines)

        assert len(events) == 1

    def test_invalid_json_captures_error(self):
        lines = [
            '{"tool_call_id": "c1", "invalid json',
            json.dumps({"tool_call_id": "c2", "tool_name": "t2", "arguments": {}, "timestamp": "2024-01-15T10:00:00.000Z"}),
        ]

        parser = TraceParser()
        events = parser.parse_lines(lines)

        assert len(events) == 1
        assert len(parser.get_parse_errors()) == 1

    def test_get_events_by_tool_call_id(self):
        lines = [
            json.dumps({"tool_call_id": "c1", "tool_name": "t1", "arguments": {}, "timestamp": "2024-01-15T10:00:00.000Z"}),
            json.dumps({"tool_call_id": "c1", "tool_name": "t1", "arguments": {}, "timestamp": "2024-01-15T10:00:01.000Z"}),
            json.dumps({"tool_call_id": "c2", "tool_name": "t2", "arguments": {}, "timestamp": "2024-01-15T10:00:02.000Z"}),
        ]

        parser = TraceParser()
        parser.parse_lines(lines)

        c1_events = parser.get_events_by_tool_call_id("c1")
        assert len(c1_events) == 2

        c2_events = parser.get_events_by_tool_call_id("c2")
        assert len(c2_events) == 1

    def test_get_sorted_events(self):
        lines = [
            json.dumps({"tool_call_id": "c3", "tool_name": "t3", "arguments": {}, "timestamp": "2024-01-15T10:00:02.000Z"}),
            json.dumps({"tool_call_id": "c1", "tool_name": "t1", "arguments": {}, "timestamp": "2024-01-15T10:00:00.000Z"}),
            json.dumps({"tool_call_id": "c2", "tool_name": "t2", "arguments": {}, "timestamp": "2024-01-15T10:00:01.000Z"}),
        ]

        parser = TraceParser()
        parser.parse_lines(lines)

        sorted_events = parser.get_sorted_events()

        assert sorted_events[0].id == "c1"
        assert sorted_events[1].id == "c2"
        assert sorted_events[2].id == "c3"

    def test_parse_file(self, tmp_path):
        trace_file = tmp_path / "trace.jsonl"
        trace_file.write_text(
            json.dumps({"tool_call_id": "c1", "tool_name": "t1", "arguments": {}, "timestamp": "2024-01-15T10:00:00.000Z"}) + "\n"
        )

        parser = TraceParser()
        events = parser.parse_file(str(trace_file))

        assert len(events) == 1
