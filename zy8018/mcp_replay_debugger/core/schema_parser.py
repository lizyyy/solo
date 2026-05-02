import json
import yaml
from pathlib import Path
from typing import Any, Dict, List, Optional
from dataclasses import dataclass


@dataclass
class ToolSchema:
    name: str
    description: str
    input_schema: Dict[str, Any]
    raw_schema: Dict[str, Any]


class SchemaParser:
    def __init__(self):
        self.tools: Dict[str, ToolSchema] = {}
        self.raw_schemas: List[Dict[str, Any]] = []

    def parse_file(self, file_path: str) -> Dict[str, ToolSchema]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Schema file not found: {file_path}")

        with open(path, "r", encoding="utf-8") as f:
            content = f.read()

        if path.suffix in (".yaml", ".yml"):
            data = yaml.safe_load(content)
        else:
            data = json.loads(content)

        return self.parse(data)

    def parse(self, schema_data: Dict[str, Any]) -> Dict[str, ToolSchema]:
        self.raw_schemas = []
        self.tools = {}

        if "tools" in schema_data:
            tools_list = schema_data["tools"]
        elif isinstance(schema_data, list):
            tools_list = schema_data
        else:
            tools_list = [schema_data]

        for tool_def in tools_list:
            self.raw_schemas.append(tool_def)
            tool = self._parse_tool_definition(tool_def)
            if tool:
                self.tools[tool.name] = tool

        return self.tools

    def _parse_tool_definition(self, tool_def: Dict[str, Any]) -> Optional[ToolSchema]:
        if not isinstance(tool_def, dict):
            return None

        name = tool_def.get("name") or tool_def.get("tool_name")
        if not name:
            return None

        description = tool_def.get("description", "")

        input_schema = tool_def.get("inputSchema") or tool_def.get("input_schema") or tool_def.get("parameters") or {}
        
        if not isinstance(input_schema, dict):
            input_schema = {}

        if "properties" not in input_schema:
            input_schema["properties"] = {}
        if "type" not in input_schema:
            input_schema["type"] = "object"

        return ToolSchema(
            name=name,
            description=description,
            input_schema=input_schema,
            raw_schema=tool_def,
        )

    def get_tool(self, tool_name: str) -> Optional[ToolSchema]:
        return self.tools.get(tool_name)

    def get_all_tools(self) -> Dict[str, ToolSchema]:
        return self.tools.copy()

    def get_tool_names(self) -> List[str]:
        return list(self.tools.keys())
