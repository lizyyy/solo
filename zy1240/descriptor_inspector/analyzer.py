"""Descriptor behavior analyzer."""

import ast
import json
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .models import (
    AnalysisResult,
    ComparisonResult,
    DescriptorCase,
    DescriptorType,
    Event,
    EventType,
    ValidationError,
)


class DescriptorAnalyzer:
    """Analyzer for Python descriptor behavior."""

    DATA_DESCRIPTOR_METHODS = {"__get__", "__set__", "__delete__"}
    NON_DATA_DESCRIPTOR_METHODS = {"__get__"}

    def __init__(self):
        self.validation_errors: List[ValidationError] = []

    def analyze_code_snippet(self, snippet: str, case_id: str) -> AnalysisResult:
        """Analyze a Python code snippet to determine descriptor behavior."""
        self.validation_errors.clear()
        
        try:
            tree = ast.parse(snippet)
        except SyntaxError as e:
            self.validation_errors.append(
                ValidationError(
                    file_path=f"{case_id}.py",
                    line_number=e.lineno or 1,
                    error_type="SyntaxError",
                    message=str(e),
                    suggestion="Check for syntax errors in the code snippet.",
                    context=e.text,
                )
            )
            return self._create_error_result(case_id, "Syntax error in code snippet")

        descriptor_info = self._extract_descriptor_info(tree, snippet)
        events = self._extract_events(tree, snippet)
        
        return AnalysisResult(
            case_id=case_id,
            descriptor_type=descriptor_info["type"],
            events=events,
            priority_observed=descriptor_info["priority"],
            instance_dict_coverage=descriptor_info["instance_dict_coverage"],
            get_called=descriptor_info["get_called"],
            set_called=descriptor_info["set_called"],
            delete_called=descriptor_info["delete_called"],
            set_name_called=descriptor_info["set_name_called"],
            validation_errors=[e.message for e in self.validation_errors],
            property_vs_cached_diff=descriptor_info.get("property_diff"),
            metadata={
                "descriptor_name": descriptor_info.get("name"),
                "class_name": descriptor_info.get("class_name"),
                "method_count": descriptor_info.get("method_count", 0),
            },
        )

    def _extract_descriptor_info(self, tree: ast.AST, snippet: str) -> Dict[str, Any]:
        """Extract descriptor information from AST."""
        info = {
            "type": DescriptorType.NOT_A_DESCRIPTOR,
            "priority": "unknown",
            "instance_dict_coverage": False,
            "get_called": False,
            "set_called": False,
            "delete_called": False,
            "set_name_called": False,
            "name": None,
            "class_name": None,
            "method_count": 0,
        }

        methods_found = set()

        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                info["class_name"] = node.name
                
                for item in node.body:
                    if isinstance(item, ast.FunctionDef):
                        method_name = item.name
                        if method_name in self.DATA_DESCRIPTOR_METHODS:
                            methods_found.add(method_name)
                            
                            if method_name == "__get__":
                                info["get_called"] = True
                            elif method_name == "__set__":
                                info["set_called"] = True
                            elif method_name == "__delete__":
                                info["delete_called"] = True
                        
                        if method_name == "__set_name__":
                            info["set_name_called"] = True

        info["method_count"] = len(methods_found)

        if "__set__" in methods_found or "__delete__" in methods_found:
            info["type"] = DescriptorType.DATA_DESCRIPTOR
            info["priority"] = "data_descriptor_priority"
        elif "__get__" in methods_found:
            info["type"] = DescriptorType.NON_DATA_DESCRIPTOR
            info["priority"] = "instance_dict_priority"

        if "property" in snippet or "@property" in snippet:
            info["type"] = DescriptorType.PROPERTY
            info["priority"] = "data_descriptor_priority"
            info["get_called"] = True

        if "cached_property" in snippet:
            info["type"] = DescriptorType.CACHED_PROPERTY
            info["priority"] = "instance_dict_priority"
            info["get_called"] = True
            info["property_diff"] = (
                "cached_property stores result in instance __dict__ after first access; "
                "subsequent accesses bypass __get__ unless instance dict is cleared."
            )

        if "__dict__" in snippet:
            info["instance_dict_coverage"] = True

        return info

    def _extract_events(self, tree: ast.AST, snippet: str) -> List[Event]:
        """Extract events from code snippet."""
        events = []
        event_id = 0

        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Attribute):
                    attr_name = node.func.attr
                    if attr_name in {"__get__", "__set__", "__delete__", "__set_name__"}:
                        events.append(
                            Event(
                                id=event_id,
                                timestamp=datetime.now(),
                                event_type=EventType(attr_name),
                                descriptor_name=attr_name,
                                instance_type="unknown",
                                owner_class="unknown",
                                context={"line": node.lineno},
                            )
                        )
                        event_id += 1

            if isinstance(node, ast.Attribute):
                if node.attr == "__dict__":
                    events.append(
                        Event(
                            id=event_id,
                            timestamp=datetime.now(),
                            event_type=EventType.INSTANCE_DICT_ACCESS,
                            descriptor_name="__dict__",
                            instance_type="unknown",
                            owner_class="unknown",
                            context={"line": node.lineno},
                        )
                    )
                    event_id += 1

        if "raise" in snippet.lower() or "ValueError" in snippet or "ValidationError" in snippet:
            events.append(
                Event(
                    id=event_id,
                    timestamp=datetime.now(),
                    event_type=EventType.VALIDATION_ERROR,
                    descriptor_name="validation",
                    instance_type="unknown",
                    owner_class="unknown",
                    exception="ValidationError detected in code",
                    context={},
                )
            )
            event_id += 1

        return events

    def compare_results(
        self, result1: AnalysisResult, result2: AnalysisResult
    ) -> ComparisonResult:
        """Compare two analysis results."""
        differences = []
        similarities = []
        insights = []

        if result1.descriptor_type != result2.descriptor_type:
            differences.append({
                "field": "descriptor_type",
                "case1": result1.descriptor_type.value,
                "case2": result2.descriptor_type.value,
                "description": "Different descriptor types",
            })
            insights.append(
                f"Descriptor types differ: {result1.descriptor_type.value} vs {result2.descriptor_type.value}"
            )
        else:
            similarities.append({
                "field": "descriptor_type",
                "value": result1.descriptor_type.value,
                "description": "Same descriptor type",
            })

        if result1.priority_observed != result2.priority_observed:
            differences.append({
                "field": "priority",
                "case1": result1.priority_observed,
                "case2": result2.priority_observed,
                "description": "Different priority behavior",
            })
            insights.append(
                f"Priority behavior differs: {result1.priority_observed} vs {result2.priority_observed}"
            )
        else:
            similarities.append({
                "field": "priority",
                "value": result1.priority_observed,
                "description": "Same priority behavior",
            })

        bool_fields = [
            ("instance_dict_coverage", "Instance dict coverage"),
            ("get_called", "__get__ called"),
            ("set_called", "__set__ called"),
            ("delete_called", "__delete__ called"),
            ("set_name_called", "__set_name__ called"),
        ]

        for field_name, description in bool_fields:
            val1 = getattr(result1, field_name)
            val2 = getattr(result2, field_name)
            if val1 != val2:
                differences.append({
                    "field": field_name,
                    "case1": val1,
                    "case2": val2,
                    "description": description,
                })
                insights.append(f"{description}: {val1} vs {val2}")
            else:
                similarities.append({
                    "field": field_name,
                    "value": val1,
                    "description": description,
                })

        return ComparisonResult(
            case1_id=result1.case_id,
            case2_id=result2.case_id,
            differences=differences,
            similarities=similarities,
            key_insights=insights,
        )

    def _create_error_result(self, case_id: str, error_message: str) -> AnalysisResult:
        """Create an error result."""
        return AnalysisResult(
            case_id=case_id,
            descriptor_type=DescriptorType.NOT_A_DESCRIPTOR,
            events=[],
            priority_observed="error",
            instance_dict_coverage=False,
            get_called=False,
            set_called=False,
            delete_called=False,
            set_name_called=False,
            validation_errors=[error_message],
            metadata={"error": True},
        )

    def parse_descriptor_cases(self, yaml_content: str) -> List[DescriptorCase]:
        """Parse descriptor cases from YAML content."""
        import yaml

        try:
            data = yaml.safe_load(yaml_content)
        except yaml.YAMLError as e:
            self.validation_errors.append(
                ValidationError(
                    file_path="descriptor-cases.yaml",
                    line_number=1,
                    error_type="YAMLError",
                    message=str(e),
                    suggestion="Check YAML syntax and formatting.",
                )
            )
            return []

        cases = []
        if not data or "cases" not in data:
            return cases

        for i, case_data in enumerate(data["cases"]):
            try:
                desc_type = DescriptorType(case_data.get("descriptor_type", "not_a_descriptor"))
            except ValueError:
                desc_type = DescriptorType.NOT_A_DESCRIPTOR
                self.validation_errors.append(
                    ValidationError(
                        file_path="descriptor-cases.yaml",
                        line_number=i + 1,
                        error_type="InvalidDescriptorType",
                        message=f"Invalid descriptor type: {case_data.get('descriptor_type')}",
                        suggestion=f"Use one of: {', '.join(t.value for t in DescriptorType)}",
                    )
                )

            cases.append(
                DescriptorCase(
                    id=case_data.get("id", f"case_{i}"),
                    name=case_data.get("name", "Unnamed Case"),
                    description=case_data.get("description", ""),
                    descriptor_type=desc_type,
                    code_snippet=case_data.get("code_snippet", ""),
                    expected_behavior=case_data.get("expected_behavior", {}),
                    tags=case_data.get("tags", []),
                )
            )

        return cases

    def parse_events_jsonl(self, jsonl_content: str) -> List[Event]:
        """Parse events from JSONL content."""
        events = []
        lines = jsonl_content.strip().split("\n")

        for line_num, line in enumerate(lines, 1):
            if not line.strip():
                continue

            try:
                data = json.loads(line)
            except json.JSONDecodeError as e:
                self.validation_errors.append(
                    ValidationError(
                        file_path="events.jsonl",
                        line_number=line_num,
                        error_type="JSONDecodeError",
                        message=str(e),
                        suggestion="Ensure each line is valid JSON.",
                        context=line[:100],
                    )
                )
                continue

            try:
                event_type = EventType(data.get("event_type", "__get__"))
            except ValueError:
                event_type = EventType.GET
                self.validation_errors.append(
                    ValidationError(
                        file_path="events.jsonl",
                        line_number=line_num,
                        error_type="InvalidEventType",
                        message=f"Invalid event type: {data.get('event_type')}",
                        suggestion=f"Use one of: {', '.join(t.value for t in EventType)}",
                    )
                )

            events.append(
                Event(
                    id=data.get("id", line_num),
                    timestamp=datetime.fromisoformat(data["timestamp"])
                    if "timestamp" in data
                    else datetime.now(),
                    event_type=event_type,
                    descriptor_name=data.get("descriptor_name", "unknown"),
                    instance_type=data.get("instance_type", "unknown"),
                    owner_class=data.get("owner_class", "unknown"),
                    value=data.get("value"),
                    exception=data.get("exception"),
                    call_stack=data.get("call_stack"),
                    context=data.get("context", {}),
                )
            )

        return events
