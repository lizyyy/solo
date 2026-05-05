"""Report exporter for descriptor inspection results."""

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
    ValidationError,
)


class ReportExporter:
    """Exporter for analysis reports in Markdown and JSON formats."""

    def __init__(self):
        self.generated_at = datetime.now()

    def export_json(self, data: Dict[str, Any], output_path: str) -> None:
        """Export data to JSON file."""
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output, "w", encoding="utf-8") as f:
            json.dump(self._prepare_for_json(data), f, indent=2, ensure_ascii=False, default=str)

    def export_markdown(
        self,
        cases: List[DescriptorCase],
        analyses: List[AnalysisResult],
        comparisons: List[ComparisonResult],
        output_path: str,
        title: str = "Descriptor Inspection Report",
    ) -> None:
        """Export analysis results to Markdown report."""
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        
        markdown = self._generate_markdown_report(cases, analyses, comparisons, title)
        
        with open(output, "w", encoding="utf-8") as f:
            f.write(markdown)

    def _generate_markdown_report(
        self,
        cases: List[DescriptorCase],
        analyses: List[AnalysisResult],
        comparisons: List[ComparisonResult],
        title: str,
    ) -> str:
        """Generate Markdown report content."""
        lines = []
        
        lines.append(f"# {title}")
        lines.append("")
        lines.append(f"**Generated at:** {self.generated_at.isoformat()}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## Table of Contents")
        lines.append("")
        lines.append("1. [Summary](#summary)")
        lines.append("2. [Descriptor Cases](#descriptor-cases)")
        lines.append("3. [Analysis Results](#analysis-results)")
        lines.append("4. [Comparisons](#comparisons)")
        lines.append("5. [Key Insights](#key-insights)")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## Summary")
        lines.append("")
        lines.append(f"- **Total Cases:** {len(cases)}")
        lines.append(f"- **Total Analyses:** {len(analyses)}")
        lines.append(f"- **Total Comparisons:** {len(comparisons)}")
        lines.append("")
        
        type_counts = {}
        for case in cases:
            desc_type = case.descriptor_type.value
            type_counts[desc_type] = type_counts.get(desc_type, 0) + 1
        
        if type_counts:
            lines.append("### Descriptor Type Distribution")
            lines.append("")
            lines.append("| Type | Count |")
            lines.append("|------|-------|")
            for desc_type, count in sorted(type_counts.items()):
                lines.append(f"| {desc_type} | {count} |")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append("## Descriptor Cases")
        lines.append("")
        
        for case in cases:
            lines.append(f"### Case: {case.name} (`{case.id}`)")
            lines.append("")
            lines.append(f"**Type:** {case.descriptor_type.value}")
            lines.append(f"**Description:** {case.description}")
            lines.append("")
            
            if case.tags:
                lines.append(f"**Tags:** {', '.join(case.tags)}")
                lines.append("")
            
            if case.code_snippet:
                lines.append("**Code Snippet:**")
                lines.append("")
                lines.append("```python")
                lines.append(case.code_snippet)
                lines.append("```")
                lines.append("")
            
            if case.expected_behavior:
                lines.append("**Expected Behavior:**")
                lines.append("")
                for key, value in case.expected_behavior.items():
                    lines.append(f"- `{key}`: {value}")
                lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append("## Analysis Results")
        lines.append("")
        
        for analysis in analyses:
            case_name = "Unknown"
            for case in cases:
                if case.id == analysis.case_id:
                    case_name = case.name
                    break
            
            lines.append(f"### Analysis: {case_name} (`{analysis.case_id}`)")
            lines.append("")
            lines.append(f"**Analyzed at:** {analysis.analyzed_at.isoformat()}")
            lines.append(f"**Descriptor Type:** {analysis.descriptor_type.value}")
            lines.append(f"**Priority Observed:** {analysis.priority_observed}")
            lines.append("")
            
            lines.append("**Behavior Summary:**")
            lines.append("")
            lines.append("| Behavior | Value |")
            lines.append("|----------|-------|")
            lines.append(f"| Instance Dict Coverage | {analysis.instance_dict_coverage} |")
            lines.append(f"| `__get__` Called | {analysis.get_called} |")
            lines.append(f"| `__set__` Called | {analysis.set_called} |")
            lines.append(f"| `__delete__` Called | {analysis.delete_called} |")
            lines.append(f"| `__set_name__` Called | {analysis.set_name_called} |")
            lines.append("")
            
            if analysis.validation_errors:
                lines.append("**Validation Errors:**")
                lines.append("")
                for error in analysis.validation_errors:
                    lines.append(f"- {error}")
                lines.append("")
            
            if analysis.property_vs_cached_diff:
                lines.append("**Property vs cached_property Difference:**")
                lines.append("")
                lines.append(f"> {analysis.property_vs_cached_diff}")
                lines.append("")
            
            if analysis.events:
                lines.append("**Events Captured:**")
                lines.append("")
                lines.append("| ID | Type | Descriptor | Timestamp |")
                lines.append("|----|------|------------|-----------|")
                for event in analysis.events:
                    lines.append(
                        f"| {event.id} | {event.event_type.value} | {event.descriptor_name} | {event.timestamp.strftime('%H:%M:%S')} |"
                    )
                lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append("## Comparisons")
        lines.append("")
        
        for comparison in comparisons:
            case1_name = comparison.case1_id
            case2_name = comparison.case2_id
            for case in cases:
                if case.id == comparison.case1_id:
                    case1_name = case.name
                if case.id == comparison.case2_id:
                    case2_name = case.name
            
            lines.append(f"### Comparison: {case1_name} vs {case2_name}")
            lines.append("")
            lines.append(f"**Compared at:** {comparison.compared_at.isoformat()}")
            lines.append("")
            
            if comparison.key_insights:
                lines.append("**Key Insights:**")
                lines.append("")
                for insight in comparison.key_insights:
                    lines.append(f"- {insight}")
                lines.append("")
            
            if comparison.differences:
                lines.append("**Differences:**")
                lines.append("")
                lines.append("| Field | Case 1 | Case 2 | Description |")
                lines.append("|-------|--------|--------|-------------|")
                for diff in comparison.differences:
                    lines.append(
                        f"| {diff.get('field', 'N/A')} | {diff.get('case1', 'N/A')} | {diff.get('case2', 'N/A')} | {diff.get('description', '')} |"
                    )
                lines.append("")
            
            if comparison.similarities:
                lines.append("**Similarities:**")
                lines.append("")
                lines.append("| Field | Value | Description |")
                lines.append("|-------|-------|-------------|")
                for sim in comparison.similarities:
                    lines.append(
                        f"| {sim.get('field', 'N/A')} | {sim.get('value', 'N/A')} | {sim.get('description', '')} |"
                    )
                lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append("## Key Insights")
        lines.append("")
        
        insights = self._extract_key_insights(cases, analyses, comparisons)
        
        if insights:
            for insight in insights:
                lines.append(f"- {insight}")
        else:
            lines.append("No key insights extracted.")
        
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append(f"*Report generated by Descriptor Inspector v1.0*")
        
        return "\n".join(lines)

    def _extract_key_insights(
        self,
        cases: List[DescriptorCase],
        analyses: List[AnalysisResult],
        comparisons: List[ComparisonResult],
    ) -> List[str]:
        """Extract key insights from analysis data."""
        insights = []
        
        data_descriptors = [a for a in analyses if a.descriptor_type == DescriptorType.DATA_DESCRIPTOR]
        non_data_descriptors = [a for a in analyses if a.descriptor_type == DescriptorType.NON_DATA_DESCRIPTOR]
        
        if data_descriptors:
            insights.append(
                f"Data descriptors ({len(data_descriptors)} cases) have higher priority than instance __dict__."
            )
        
        if non_data_descriptors:
            insights.append(
                f"Non-data descriptors ({len(non_data_descriptors)} cases) can be overridden by instance __dict__."
            )
        
        properties = [a for a in analyses if a.descriptor_type == DescriptorType.PROPERTY]
        cached_properties = [a for a in analyses if a.descriptor_type == DescriptorType.CACHED_PROPERTY]
        
        if properties and cached_properties:
            insights.append(
                "property is a data descriptor (high priority), while cached_property is a non-data descriptor (can be overridden)."
            )
        
        validation_errors = [a for a in analyses if a.validation_errors]
        if validation_errors:
            insights.append(
                f"Detected {len(validation_errors)} analyses with validation errors or issues."
            )
        
        set_name_called = [a for a in analyses if a.set_name_called]
        if set_name_called:
            insights.append(
                f"{len(set_name_called)} cases use __set_name__ for automatic field registration."
            )
        
        return insights

    def _prepare_for_json(self, data: Any) -> Any:
        """Prepare data for JSON serialization."""
        if isinstance(data, dict):
            return {k: self._prepare_for_json(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [self._prepare_for_json(item) for item in data]
        elif isinstance(data, (datetime, DescriptorType, EventType)):
            return str(data)
        elif hasattr(data, "__dataclass_fields__"):
            return self._prepare_for_json(asdict(data))
        return data

    def create_analysis_summary(
        self,
        cases: List[DescriptorCase],
        analyses: List[AnalysisResult],
        comparisons: List[ComparisonResult],
    ) -> Dict[str, Any]:
        """Create a comprehensive summary for export."""
        return {
            "report_info": {
                "generated_at": self.generated_at,
                "version": "1.0",
            },
            "summary": {
                "total_cases": len(cases),
                "total_analyses": len(analyses),
                "total_comparisons": len(comparisons),
            },
            "descriptor_cases": [self._prepare_for_json(case) for case in cases],
            "analysis_results": [self._prepare_for_json(analysis) for analysis in analyses],
            "comparison_results": [self._prepare_for_json(comp) for comp in comparisons],
            "key_insights": self._extract_key_insights(cases, analyses, comparisons),
        }
