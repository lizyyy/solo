from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set, Tuple
from collections import defaultdict
import jsonschema
from jsonschema import validate, ValidationError

from .schema_parser import ToolSchema
from .trace_parser import ToolCallEvent


@dataclass
class SchemaDriftIssue:
    tool_name: str
    tool_call_id: str
    issue_type: str
    field_path: str
    message: str
    severity: str
    recorded_value: Any = None
    schema_requirement: Any = None


@dataclass
class FieldMapping:
    old_name: str
    new_name: str
    confidence: float


class SchemaDriftDetector:
    DRIFT_TYPES = {
        "missing_required_field": "Missing required field in schema",
        "extra_unknown_field": "Extra field not in schema",
        "type_mismatch": "Type mismatch between recorded and schema",
        "enum_violation": "Value not in allowed enum",
        "format_violation": "Format validation failed",
        "field_renamed": "Field possibly renamed",
        "constraint_violation": "Constraint violation (min/max, pattern, etc.)",
        "tool_not_found": "Tool not found in current schema",
        "schema_missing": "Schema definition missing",
    }

    SEVERITY = {
        "missing_required_field": "high",
        "type_mismatch": "high",
        "tool_not_found": "high",
        "extra_unknown_field": "medium",
        "enum_violation": "medium",
        "constraint_violation": "medium",
        "format_violation": "medium",
        "field_renamed": "low",
        "schema_missing": "low",
    }

    def __init__(self, field_mappings: Optional[List[FieldMapping]] = None):
        self.field_mappings = field_mappings or []
        self.issues: List[SchemaDriftIssue] = []
        self._name_mapping_cache: Dict[Tuple[str, str], str] = {}

    def detect(
        self,
        tools: Dict[str, ToolSchema],
        events: List[ToolCallEvent],
    ) -> List[SchemaDriftIssue]:
        self.issues = []
        self._name_mapping_cache = {}

        for event in events:
            self._check_event(tools, event)

        return self.issues

    def _check_event(
        self,
        tools: Dict[str, ToolSchema],
        event: ToolCallEvent,
    ):
        tool_name = event.tool_name
        if tool_name not in tools:
            self._add_issue(
                tool_name=tool_name,
                tool_call_id=event.id,
                issue_type="tool_not_found",
                field_path="",
                message=f"Tool '{tool_name}' is not defined in current schema",
                recorded_value=event.arguments,
            )
            return

        tool_schema = tools[tool_name]
        self._validate_arguments(
            tool_name=tool_name,
            tool_call_id=event.id,
            arguments=event.arguments,
            schema=tool_schema.input_schema,
        )

    def _validate_arguments(
        self,
        tool_name: str,
        tool_call_id: str,
        arguments: Dict[str, Any],
        schema: Dict[str, Any],
    ):
        try:
            validate(instance=arguments, schema=schema)
        except ValidationError as e:
            self._process_validation_error(
                tool_name=tool_name,
                tool_call_id=tool_call_id,
                error=e,
                arguments=arguments,
                schema=schema,
            )

        self._check_field_coverage(
            tool_name=tool_name,
            tool_call_id=tool_call_id,
            arguments=arguments,
            schema=schema,
        )

    def _process_validation_error(
        self,
        tool_name: str,
        tool_call_id: str,
        error: ValidationError,
        arguments: Dict[str, Any],
        schema: Dict[str, Any],
    ):
        path = ".".join(str(p) for p in error.path) if error.path else ""

        if error.validator == "required":
            self._handle_missing_required(
                tool_name=tool_name,
                tool_call_id=tool_call_id,
                path=path,
                error=error,
                schema=schema,
            )
        elif error.validator == "type":
            self._handle_type_mismatch(
                tool_name=tool_name,
                tool_call_id=tool_call_id,
                path=path,
                error=error,
                arguments=arguments,
            )
        elif error.validator == "enum":
            self._handle_enum_violation(
                tool_name=tool_name,
                tool_call_id=tool_call_id,
                path=path,
                error=error,
                arguments=arguments,
            )
        elif error.validator == "format":
            self._add_issue(
                tool_name=tool_name,
                tool_call_id=tool_call_id,
                issue_type="format_violation",
                field_path=path,
                message=f"Format validation failed: {error.message}",
                recorded_value=self._get_value_at_path(arguments, error.path),
                schema_requirement=error.validator_value,
            )
        else:
            self._add_issue(
                tool_name=tool_name,
                tool_call_id=tool_call_id,
                issue_type="constraint_violation",
                field_path=path,
                message=f"Constraint '{error.validator}' violated: {error.message}",
                recorded_value=self._get_value_at_path(arguments, error.path),
                schema_requirement=error.validator_value,
            )

    def _handle_missing_required(
        self,
        tool_name: str,
        tool_call_id: str,
        path: str,
        error: ValidationError,
        schema: Dict[str, Any],
    ):
        missing_fields = error.validator_value if isinstance(error.validator_value, list) else []
        
        for field in missing_fields:
            full_path = f"{path}.{field}" if path else field
            self._add_issue(
                tool_name=tool_name,
                tool_call_id=tool_call_id,
                issue_type="missing_required_field",
                field_path=full_path,
                message=f"Missing required field: {full_path}",
                schema_requirement="required",
            )

    def _handle_type_mismatch(
        self,
        tool_name: str,
        tool_call_id: str,
        path: str,
        error: ValidationError,
        arguments: Dict[str, Any],
    ):
        actual_value = self._get_value_at_path(arguments, error.path)
        actual_type = type(actual_value).__name__ if actual_value is not None else "null"
        
        self._add_issue(
            tool_name=tool_name,
            tool_call_id=tool_call_id,
            issue_type="type_mismatch",
            field_path=path,
            message=f"Type mismatch: expected {error.validator_value}, got {actual_type}",
            recorded_value=actual_value,
            schema_requirement=error.validator_value,
        )

    def _handle_enum_violation(
        self,
        tool_name: str,
        tool_call_id: str,
        path: str,
        error: ValidationError,
        arguments: Dict[str, Any],
    ):
        actual_value = self._get_value_at_path(arguments, error.path)
        
        self._add_issue(
            tool_name=tool_name,
            tool_call_id=tool_call_id,
            issue_type="enum_violation",
            field_path=path,
            message=f"Enum violation: value '{actual_value}' not in allowed values",
            recorded_value=actual_value,
            schema_requirement=error.validator_value,
        )

    def _check_field_coverage(
        self,
        tool_name: str,
        tool_call_id: str,
        arguments: Dict[str, Any],
        schema: Dict[str, Any],
    ):
        schema_properties = schema.get("properties", {})
        schema_keys = set(schema_properties.keys())
        arg_keys = set(arguments.keys())

        extra_fields = arg_keys - schema_keys
        for field in extra_fields:
            mapped = self._try_find_renamed_field(field, schema_keys, tool_name)
            if mapped:
                self._add_issue(
                    tool_name=tool_name,
                    tool_call_id=tool_call_id,
                    issue_type="field_renamed",
                    field_path=field,
                    message=f"Field '{field}' may have been renamed to '{mapped}'",
                    recorded_value=arguments[field],
                    schema_requirement=mapped,
                )
            else:
                additional = schema.get("additionalProperties", True)
                if not additional:
                    self._add_issue(
                        tool_name=tool_name,
                        tool_call_id=tool_call_id,
                        issue_type="extra_unknown_field",
                        field_path=field,
                        message=f"Extra field '{field}' not in schema and additionalProperties is false",
                        recorded_value=arguments[field],
                    )

    def _try_find_renamed_field(
        self,
        field_name: str,
        schema_keys: Set[str],
        tool_name: str,
    ) -> Optional[str]:
        cache_key = (tool_name, field_name)
        if cache_key in self._name_mapping_cache:
            return self._name_mapping_cache[cache_key]

        for mapping in self.field_mappings:
            if mapping.old_name == field_name and mapping.new_name in schema_keys:
                self._name_mapping_cache[cache_key] = mapping.new_name
                return mapping.new_name

        import difflib
        for key in schema_keys:
            similarity = difflib.SequenceMatcher(None, field_name, key).ratio()
            if similarity > 0.7:
                self._name_mapping_cache[cache_key] = key
                return key

        self._name_mapping_cache[cache_key] = ""
        return None

    def _get_value_at_path(
        self,
        obj: Any,
        path: List[Any],
    ) -> Any:
        current = obj
        for p in path:
            if isinstance(current, dict):
                current = current.get(p)
            elif isinstance(current, list) and isinstance(p, int):
                if 0 <= p < len(current):
                    current = current[p]
                else:
                    return None
            else:
                return None
        return current

    def _add_issue(
        self,
        tool_name: str,
        tool_call_id: str,
        issue_type: str,
        field_path: str,
        message: str,
        recorded_value: Any = None,
        schema_requirement: Any = None,
    ):
        severity = self.SEVERITY.get(issue_type, "medium")
        
        self.issues.append(
            SchemaDriftIssue(
                tool_name=tool_name,
                tool_call_id=tool_call_id,
                issue_type=issue_type,
                field_path=field_path,
                message=message,
                severity=severity,
                recorded_value=recorded_value,
                schema_requirement=schema_requirement,
            )
        )

    def get_issues_by_tool(self) -> Dict[str, List[SchemaDriftIssue]]:
        by_tool = defaultdict(list)
        for issue in self.issues:
            by_tool[issue.tool_name].append(issue)
        return dict(by_tool)

    def get_issues_by_severity(self) -> Dict[str, List[SchemaDriftIssue]]:
        by_severity = defaultdict(list)
        for issue in self.issues:
            by_severity[issue.severity].append(issue)
        return dict(by_severity)

    def get_summary(self) -> Dict[str, Any]:
        by_tool = self.get_issues_by_tool()
        by_severity = self.get_issues_by_severity()
        by_type = defaultdict(list)
        for issue in self.issues:
            by_type[issue.issue_type].append(issue)

        return {
            "total_issues": len(self.issues),
            "by_tool": {k: len(v) for k, v in by_tool.items()},
            "by_severity": {
                "high": len(by_severity.get("high", [])),
                "medium": len(by_severity.get("medium", [])),
                "low": len(by_severity.get("low", [])),
            },
            "by_type": {k: len(v) for k, v in by_type.items()},
        }
