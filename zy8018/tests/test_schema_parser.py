import json
import pytest
from pathlib import Path
from datetime import datetime

from mcp_replay_debugger.core.schema_parser import SchemaParser, ToolSchema


class TestSchemaParser:
    def test_parse_json_schema(self):
        schema_data = {
            "tools": [
                {
                    "name": "test_tool",
                    "description": "A test tool",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "param1": {"type": "string", "description": "First param"}
                        },
                        "required": ["param1"]
                    }
                }
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        assert len(tools) == 1
        assert "test_tool" in tools

        tool = tools["test_tool"]
        assert tool.name == "test_tool"
        assert tool.description == "A test tool"
        assert "param1" in tool.input_schema["properties"]
        assert "param1" in tool.input_schema["required"]

    def test_parse_list_format(self):
        schema_data = [
            {
                "name": "tool1",
                "description": "First tool",
                "inputSchema": {"type": "object", "properties": {}}
            },
            {
                "name": "tool2",
                "description": "Second tool",
                "inputSchema": {"type": "object", "properties": {}}
            }
        ]

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        assert len(tools) == 2
        assert "tool1" in tools
        assert "tool2" in tools

    def test_parse_single_tool(self):
        schema_data = {
            "name": "single_tool",
            "description": "Single tool",
            "inputSchema": {"type": "object", "properties": {}}
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        assert len(tools) == 1
        assert "single_tool" in tools

    def test_parse_with_alternative_keys(self):
        schema_data = {
            "tools": [
                {
                    "tool_name": "alt_key_tool",
                    "description": "Using alternative key",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "p1": {"type": "string"}
                        }
                    }
                }
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        assert len(tools) == 1
        assert "alt_key_tool" in tools

    def test_get_tool_names(self):
        schema_data = {
            "tools": [
                {"name": "tool_a", "description": "", "inputSchema": {}},
                {"name": "tool_b", "description": "", "inputSchema": {}},
            ]
        }

        parser = SchemaParser()
        parser.parse(schema_data)
        names = parser.get_tool_names()

        assert len(names) == 2
        assert "tool_a" in names
        assert "tool_b" in names

    def test_get_tool(self):
        schema_data = {
            "tools": [
                {"name": "find_me", "description": "Test", "inputSchema": {}}
            ]
        }

        parser = SchemaParser()
        parser.parse(schema_data)

        tool = parser.get_tool("find_me")
        assert tool is not None
        assert tool.name == "find_me"

        assert parser.get_tool("not_found") is None

    def test_parse_file_from_json(self, tmp_path):
        schema_file = tmp_path / "schema.json"
        schema_data = {
            "tools": [
                {
                    "name": "file_tool",
                    "description": "From file",
                    "inputSchema": {"type": "object", "properties": {}}
                }
            ]
        }
        schema_file.write_text(json.dumps(schema_data))

        parser = SchemaParser()
        tools = parser.parse_file(str(schema_file))

        assert len(tools) == 1
        assert "file_tool" in tools

    def test_parse_file_from_yaml(self, tmp_path):
        schema_file = tmp_path / "schema.yaml"
        yaml_content = """
tools:
  - name: yaml_tool
    description: From YAML
    inputSchema:
      type: object
      properties: {}
"""
        schema_file.write_text(yaml_content)

        parser = SchemaParser()
        tools = parser.parse_file(str(schema_file))

        assert len(tools) == 1
        assert "yaml_tool" in tools

    def test_invalid_name_returns_none(self):
        schema_data = {
            "tools": [
                {
                    "description": "No name field",
                    "inputSchema": {}
                }
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        assert len(tools) == 0

    def test_empty_input_schema(self):
        schema_data = {
            "tools": [
                {
                    "name": "no_schema",
                    "description": "No input schema",
                }
            ]
        }

        parser = SchemaParser()
        tools = parser.parse(schema_data)

        assert len(tools) == 1
        tool = tools["no_schema"]
        assert tool.input_schema["type"] == "object"
        assert tool.input_schema["properties"] == {}
