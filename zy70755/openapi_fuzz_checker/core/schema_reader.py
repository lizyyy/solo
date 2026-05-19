import yaml
import json
from pathlib import Path
from typing import Dict, Any, List, Optional
from prance import ResolvingParser
from ..utils.logger import get_logger

logger = get_logger(__name__)


class OpenAPISchemaReader:
    def __init__(self, openapi_path: str):
        self.openapi_path = openapi_path
        self.spec: Dict[str, Any] = {}
        self.components: Dict[str, Any] = {}
        self.schemas: Dict[str, Any] = {}
        self._load_and_resolve()

    def _load_and_resolve(self) -> None:
        try:
            parser = ResolvingParser(self.openapi_path, strict=False)
            self.spec = parser.specification
            self.components = self.spec.get("components", {})
            self.schemas = self.components.get("schemas", {})
            logger.info(f"成功加载OpenAPI规范: {self.openapi_path}")
            logger.info(f"找到 {len(self.schemas)} 个Schema定义")
        except Exception as e:
            logger.error(f"加载OpenAPI规范失败: {e}")
            raise

    def get_schema_by_name(self, schema_name: str) -> Optional[Dict[str, Any]]:
        return self.schemas.get(schema_name)

    def get_all_schemas(self) -> Dict[str, Any]:
        return self.schemas

    def get_request_body_schema(
        self, path: str, method: str
    ) -> Optional[Dict[str, Any]]:
        path_item = self.spec.get("paths", {}).get(path, {})
        operation = path_item.get(method.lower(), {})
        request_body = operation.get("requestBody", {})
        content = request_body.get("content", {})

        for content_type, content_schema in content.items():
            if "schema" in content_schema:
                return self._resolve_refs(content_schema["schema"])
        return None

    def get_response_schema(
        self, path: str, method: str, status_code: str = "200"
    ) -> Optional[Dict[str, Any]]:
        path_item = self.spec.get("paths", {}).get(path, {})
        operation = path_item.get(method.lower(), {})
        responses = operation.get("responses", {})
        response = responses.get(status_code, {})
        content = response.get("content", {})

        for content_type, content_schema in content.items():
            if "schema" in content_schema:
                return self._resolve_refs(content_schema["schema"])
        return None

    def _resolve_refs(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        if "$ref" in schema:
            ref_path = schema["$ref"]
            parts = ref_path.split("/")
            if len(parts) >= 4 and parts[0] == "#":
                current = self.spec
                for part in parts[1:]:
                    current = current.get(part, {})
                return current
        return schema

    def extract_example_from_schema(self, schema: Dict[str, Any]) -> Any:
        if "example" in schema:
            return schema["example"]
        if "examples" in schema and isinstance(schema["examples"], dict):
            for key, val in schema["examples"].items():
                if isinstance(val, dict) and "value" in val:
                    return val["value"]
                return val
        return self._generate_default_example(schema)

    def _generate_default_example(self, schema: Dict[str, Any]) -> Any:
        schema_type = schema.get("type", "object")

        if schema_type == "object":
            result = {}
            properties = schema.get("properties", {})
            required = schema.get("required", [])
            for prop_name, prop_schema in properties.items():
                if prop_name in required or "example" in prop_schema:
                    result[prop_name] = self.extract_example_from_schema(prop_schema)
            return result

        elif schema_type == "array":
            item_schema = schema.get("items", {})
            return [self.extract_example_from_schema(item_schema)]

        elif schema_type == "string":
            if "enum" in schema:
                return schema["enum"][0]
            format_type = schema.get("format", "")
            if format_type == "email":
                return "user@example.com"
            if format_type == "date":
                return "2024-01-01"
            if format_type == "date-time":
                return "2024-01-01T12:00:00Z"
            if format_type == "uuid":
                return "550e8400-e29b-41d4-a716-446655440000"
            return "string"

        elif schema_type == "integer":
            return schema.get("minimum", 0) if "minimum" in schema else 1

        elif schema_type == "number":
            return schema.get("minimum", 0.0) if "minimum" in schema else 1.0

        elif schema_type == "boolean":
            return True

        elif schema_type == "null":
            return None

        return None

    def list_all_endpoints(self) -> List[Dict[str, str]]:
        endpoints = []
        for path, path_item in self.spec.get("paths", {}).items():
            for method in path_item.keys():
                if method.upper() in [
                    "GET",
                    "POST",
                    "PUT",
                    "DELETE",
                    "PATCH",
                    "HEAD",
                    "OPTIONS",
                ]:
                    endpoints.append({"path": path, "method": method.upper()})
        return endpoints
