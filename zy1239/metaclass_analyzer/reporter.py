"""Report generation for metaclass analysis results."""

import json
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .models import (
    AnalysisResult,
    ClassInfo,
    ConflictInfo,
    Event,
    EventType,
    FieldInfo,
)


class JsonReporter:
    """Generate JSON reports from analysis results."""

    @staticmethod
    def generate(result: AnalysisResult, indent: int = 2) -> str:
        """Generate a JSON report.

        Args:
            result: The analysis result to report.
            indent: JSON indentation level.

        Returns:
            A JSON string representation of the analysis result.
        """
        data: Dict[str, Any] = {
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_classes": len(result.classes),
                "total_events": len(result.timeline),
                "conflicts_found": len(result.conflicts),
                "errors_count": len(result.errors),
                "warnings_count": len(result.warnings),
                "suggestions_count": len(result.suggestions),
            },
            "classes": {},
            "conflicts": [],
            "timeline": [],
            "errors": result.errors,
            "warnings": result.warnings,
            "suggestions": result.suggestions,
        }

        for class_name, class_info in result.classes.items():
            data["classes"][class_name] = JsonReporter._class_to_dict(class_info)

        for conflict in result.conflicts:
            data["conflicts"].append(JsonReporter._conflict_to_dict(conflict))

        for event in result.timeline:
            data["timeline"].append(JsonReporter._event_to_dict(event))

        return json.dumps(data, indent=indent, default=str)

    @staticmethod
    def _class_to_dict(class_info: ClassInfo) -> Dict[str, Any]:
        """Convert ClassInfo to a dictionary."""
        return {
            "name": class_info.name,
            "bases": class_info.bases,
            "metaclass": class_info.metaclass,
            "mro": class_info.mro,
            "fields": [
                {
                    "name": f.name,
                    "value": f.value,
                    "defined_in_class": f.defined_in_class,
                    "order": f.order,
                    "descriptor_type": f.descriptor_type,
                    "set_name_called": f.set_name_called,
                }
                for f in class_info.fields
            ],
            "has_conflict": class_info.has_conflict,
            "conflict_details": class_info.conflict_details,
            "source_file": class_info.source_file,
            "defined_at": class_info.defined_at.isoformat() if class_info.defined_at else None,
            "events_count": len(class_info.events),
        }

    @staticmethod
    def _conflict_to_dict(conflict: ConflictInfo) -> Dict[str, Any]:
        """Convert ConflictInfo to a dictionary."""
        return {
            "class_name": conflict.class_name,
            "bases": conflict.bases,
            "base_metaclasses": conflict.base_metaclasses,
            "suggested_metaclass": conflict.suggested_metaclass,
            "resolution_steps": conflict.resolution_steps,
            "severity": conflict.severity,
        }

    @staticmethod
    def _event_to_dict(event: Event) -> Dict[str, Any]:
        """Convert Event to a dictionary."""
        return {
            "event_type": event.event_type.value,
            "timestamp": event.timestamp.isoformat() if event.timestamp else None,
            "class_name": event.class_name,
            "metaclass_name": event.metaclass_name,
            "details": event.details,
            "order": event.order,
            "success": event.success,
            "error_message": event.error_message,
        }

    @staticmethod
    def save(result: AnalysisResult, file_path: str) -> None:
        """Save a JSON report to a file.

        Args:
            result: The analysis result to report.
            file_path: The path to save the report to.
        """
        content = JsonReporter.generate(result)
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)


class MarkdownReporter:
    """Generate Markdown reports from analysis results."""

    @staticmethod
    def generate(result: AnalysisResult, title: str = "Metaclass Analysis Report") -> str:
        """Generate a Markdown report.

        Args:
            result: The analysis result to report.
            title: The title of the report.

        Returns:
            A Markdown string representation of the analysis result.
        """
        lines = []

        lines.append(f"# {title}")
        lines.append("")
        lines.append(f"**Generated at:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("## Summary")
        lines.append("")
        lines.append("| Metric | Count |")
        lines.append("|--------|-------|")
        lines.append(f"| Total Classes | {len(result.classes)} |")
        lines.append(f"| Total Events | {len(result.timeline)} |")
        lines.append(f"| Conflicts Found | {len(result.conflicts)} |")
        lines.append(f"| Errors | {len(result.errors)} |")
        lines.append(f"| Warnings | {len(result.warnings)} |")
        lines.append(f"| Suggestions | {len(result.suggestions)} |")
        lines.append("")

        if result.conflicts:
            lines.append("## Conflicts")
            lines.append("")
            for i, conflict in enumerate(result.conflicts, 1):
                lines.append(f"### {i}. {conflict.class_name}")
                lines.append("")
                lines.append(f"- **Severity:** {conflict.severity.upper()}")
                lines.append(f"- **Base Classes:** {', '.join(conflict.bases)}")
                lines.append("")
                lines.append("#### Metaclass Information:")
                lines.append("")
                for base, meta in conflict.base_metaclasses.items():
                    lines.append(f"- `{base}` → `{meta}`")
                lines.append("")
                if conflict.suggested_metaclass:
                    lines.append(f"**Suggested Metaclass:** `{conflict.suggested_metaclass}`")
                    lines.append("")
                lines.append("#### Resolution Steps:")
                lines.append("")
                for step in conflict.resolution_steps:
                    lines.append(f"1. {step}")
                lines.append("")

        if result.errors:
            lines.append("## Errors")
            lines.append("")
            for error in result.errors:
                lines.append(f"- [ERROR] {error}")
            lines.append("")

        if result.warnings:
            lines.append("## Warnings")
            lines.append("")
            for warning in result.warnings:
                lines.append(f"- [WARNING] {warning}")
            lines.append("")

        if result.suggestions:
            lines.append("## Suggestions")
            lines.append("")
            for suggestion in result.suggestions:
                lines.append(f"- {suggestion}")
            lines.append("")

        lines.append("## Class Analysis")
        lines.append("")
        for class_name, class_info in result.classes.items():
            lines.append(f"### {class_name}")
            lines.append("")
            lines.append(f"- **Metaclass:** `{class_info.metaclass}`")
            lines.append(f"- **Bases:** {', '.join(class_info.bases) if class_info.bases else 'None'}")
            lines.append(f"- **MRO:** `{' → '.join(class_info.mro)}`")
            if class_info.source_file:
                lines.append(f"- **Source:** `{class_info.source_file}`")
            if class_info.has_conflict:
                lines.append(f"- **Has Conflict:** YES")
                if class_info.conflict_details:
                    lines.append(f"  - Details: {class_info.conflict_details}")
            lines.append("")

            if class_info.fields:
                lines.append("#### Fields")
                lines.append("")
                lines.append("| Name | Order | Value | Descriptor | __set_name__ Called |")
                lines.append("|------|-------|-------|------------|---------------------|")
                for field in sorted(class_info.fields, key=lambda f: f.order):
                    desc = f"`{field.descriptor_type}`" if field.descriptor_type else "No"
                    set_name = "Yes" if field.set_name_called else "No"
                    value = str(field.value) if field.value is not None else "None"
                    lines.append(f"| `{field.name}` | {field.order} | {value} | {desc} | {set_name} |")
                lines.append("")

            if class_info.events:
                lines.append("#### Event Timeline")
                lines.append("")
                lines.append("| Order | Event Type | Success | Details |")
                lines.append("|-------|------------|---------|---------|")
                for event in sorted(class_info.events, key=lambda e: (e.timestamp, e.order)):
                    success = "✅" if event.success else "❌"
                    details = ", ".join(f"{k}: {v}" for k, v in event.details.items()) if event.details else "-"
                    lines.append(f"| {event.order} | `{event.event_type.value}` | {success} | {details} |")
                lines.append("")

        lines.append("## Global Event Timeline")
        lines.append("")
        lines.append("| Time | Class | Event Type | Success | Details |")
        lines.append("|------|-------|------------|---------|---------|")
        for event in sorted(result.timeline, key=lambda e: (e.timestamp, e.order)):
            time_str = event.timestamp.strftime('%H:%M:%S.%f')[:-3] if event.timestamp else "-"
            success = "✅" if event.success else "❌"
            details = ", ".join(f"{k}: {v}" for k, v in event.details.items()) if event.details else "-"
            lines.append(f"| {time_str} | `{event.class_name}` | `{event.event_type.value}` | {success} | {details} |")
        lines.append("")

        lines.append("## Metaclass Mechanism Reference")
        lines.append("")
        lines.append("### Class Creation Flow")
        lines.append("")
        lines.append("1. **`__prepare__`**: Called before the class body is executed")
        lines.append("   - Returns a mapping object (usually `dict` or `OrderedDict`)")
        lines.append("   - The returned mapping is used as the initial namespace")
        lines.append("")
        lines.append("2. **Metaclass Selection**: Python determines which metaclass to use")
        lines.append("   - Explicit `metaclass=` argument takes precedence")
        lines.append("   - Otherwise, uses the metaclass of the first base class")
        lines.append("   - Falls back to `type` if no bases or metaclass specified")
        lines.append("")
        lines.append("3. **`__new__`**: Creates the class object")
        lines.append("   - Receives: metaclass, class name, bases, namespace")
        lines.append("   - Returns the newly created class object")
        lines.append("")
        lines.append("4. **`__init__`**: Initializes the class object")
        lines.append("   - Receives: class object, class name, bases, namespace")
        lines.append("   - Called after `__new__` has created the class")
        lines.append("")
        lines.append("5. **`__set_name__`**: Called on descriptors")
        lines.append("   - Called for each descriptor in the class namespace")
        lines.append("   - Receives: descriptor instance, owner class, attribute name")
        lines.append("")
        lines.append("6. **`__init_subclass__`**: Called on base classes")
        lines.append("   - Called for each base class that defines it")
        lines.append("   - Useful for subclass registration and customization")
        lines.append("")
        lines.append("### Metaclass Conflict Resolution")
        lines.append("")
        lines.append("When multiple inheritance causes a metaclass conflict:")
        lines.append("")
        lines.append("1. Identify all base class metaclasses")
        lines.append("2. Create a new metaclass that inherits from ALL base metaclasses")
        lines.append("3. Apply the combined metaclass explicitly using `metaclass=` argument")
        lines.append("4. Ensure the MRO of the combined metaclass is valid")
        lines.append("")

        return "\n".join(lines)

    @staticmethod
    def save(result: AnalysisResult, file_path: str, title: str = "Metaclass Analysis Report") -> None:
        """Save a Markdown report to a file.

        Args:
            result: The analysis result to report.
            file_path: The path to save the report to.
            title: The title of the report.
        """
        content = MarkdownReporter.generate(result, title)
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
