"""Command Line Interface for Descriptor Inspector."""

import json
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table

from .analyzer import DescriptorAnalyzer
from .exporter import ReportExporter
from .models import DescriptorType, ValidationError
from .storage import StorageManager

console = Console()


@click.group()
@click.version_option(version="0.1.0")
@click.option("--db", default="descriptor_inspector.db", help="Path to SQLite database file.")
@click.pass_context
def main(ctx, db):
    """Descriptor Inspector - Analyze Python descriptor field binding issues."""
    ctx.ensure_object(dict)
    ctx.obj["db_path"] = db
    ctx.obj["storage"] = StorageManager(db)
    ctx.obj["analyzer"] = DescriptorAnalyzer()
    ctx.obj["exporter"] = ReportExporter()


@main.command()
@click.option("--output-dir", default=".", help="Directory to initialize project structure.")
@click.option("--force", is_flag=True, help="Overwrite existing files.")
@click.pass_context
def init(ctx, output_dir, force):
    """Initialize a new descriptor inspection project with sample data."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    data_dir = output_path / "data"
    data_dir.mkdir(exist_ok=True)
    
    snippets_dir = data_dir / "snippets"
    snippets_dir.mkdir(exist_ok=True)
    
    descriptor_cases = """# Descriptor Test Cases
# This file contains test cases for analyzing Python descriptor behavior

cases:
  - id: data_descriptor_01
    name: Data Descriptor with __get__ and __set__
    description: A complete data descriptor implementing both __get__ and __set__
    descriptor_type: data_descriptor
    tags:
      - data_descriptor
      - priority
    code_snippet: |
      class DataDescriptor:
          def __get__(self, instance, owner):
              return instance._value if hasattr(instance, '_value') else None
          
          def __set__(self, instance, value):
              if value < 0:
                  raise ValueError("Value must be non-negative")
              instance._value = value
          
          def __delete__(self, instance):
              del instance._value
      
      class MyClass:
          value = DataDescriptor()
      
      obj = MyClass()
      obj.value = 42
      print(obj.value)
    expected_behavior:
      priority: data_descriptor_priority
      __get__called: true
      __set__called: true
      instance_dict_override: false

  - id: non_data_descriptor_01
    name: Non-Data Descriptor with only __get__
    description: A non-data descriptor that only implements __get__
    descriptor_type: non_data_descriptor
    tags:
      - non_data_descriptor
      - instance_dict
    code_snippet: |
      class NonDataDescriptor:
          def __get__(self, instance, owner):
              if instance is None:
                  return self
              return instance.__dict__.get('value', 'default')
      
      class MyClass:
          value = NonDataDescriptor()
      
      obj = MyClass()
      print(obj.value)
      obj.__dict__['value'] = 'override'
      print(obj.value)
    expected_behavior:
      priority: instance_dict_priority
      __get__called: true
      __set__called: false
      instance_dict_override: true

  - id: property_01
    name: Using @property decorator
    description: A property descriptor created with @property decorator
    descriptor_type: property
    tags:
      - property
      - data_descriptor
    code_snippet: |
      class MyClass:
          def __init__(self):
              self._value = 0
          
          @property
          def value(self):
              return self._value
          
          @value.setter
          def value(self, val):
              if val < 0:
                  raise ValueError("Value must be >= 0")
              self._value = val
      
      obj = MyClass()
      obj.value = 100
      print(obj.value)
    expected_behavior:
      priority: data_descriptor_priority
      __get__called: true
      __set__called: true

  - id: cached_property_01
    name: Using functools.cached_property
    description: A cached_property that stores result in instance __dict__
    descriptor_type: cached_property
    tags:
      - cached_property
      - non_data_descriptor
    code_snippet: |
      from functools import cached_property
      
      class MyClass:
          def __init__(self, data):
              self._data = data
          
          @cached_property
          def processed(self):
              print("Computing...")
              return sum(self._data)
      
      obj = MyClass([1, 2, 3, 4, 5])
      print(obj.processed)
      print(obj.processed)
    expected_behavior:
      priority: instance_dict_priority
      __get__called: true_once
      cached_in_dict: true

  - id: validation_error_01
    name: Descriptor with Validation
    description: A descriptor that raises validation errors
    descriptor_type: data_descriptor
    tags:
      - validation
      - error
    code_snippet: |
      class ValidatedDescriptor:
          def __init__(self, min_value=0, max_value=100):
              self.min = min_value
              self.max = max_value
          
          def __get__(self, instance, owner):
              return instance.__dict__.get(self.name, 0)
          
          def __set__(self, instance, value):
              if not isinstance(value, (int, float)):
                  raise TypeError("Must be numeric")
              if value < self.min or value > self.max:
                  raise ValueError(f"Must be between {self.min} and {self.max}")
              instance.__dict__[self.name] = value
          
          def __set_name__(self, owner, name):
              self.name = name
      
      class MyClass:
          score = ValidatedDescriptor(min_value=0, max_value=100)
      
      obj = MyClass()
      try:
          obj.score = 150
      except ValueError as e:
          print(f"Error: {e}")
    expected_behavior:
      validation_error: true
      __set_name__called: true
"""

    events_jsonl = """{"id": 1, "timestamp": "2026-05-05T10:00:00", "event_type": "__get__", "descriptor_name": "DataDescriptor", "instance_type": "MyClass", "owner_class": "MyClass", "value": 42, "context": {"line": 20}}
{"id": 2, "timestamp": "2026-05-05T10:00:01", "event_type": "__set__", "descriptor_name": "DataDescriptor", "instance_type": "MyClass", "owner_class": "MyClass", "value": 42, "context": {"line": 19}}
{"id": 3, "timestamp": "2026-05-05T10:00:02", "event_type": "validation_error", "descriptor_name": "ValidatedDescriptor", "instance_type": "MyClass", "owner_class": "MyClass", "exception": "ValueError: Must be between 0 and 100", "context": {"line": 35}}
{"id": 4, "timestamp": "2026-05-05T10:00:03", "event_type": "__set_name__", "descriptor_name": "ValidatedDescriptor", "instance_type": "None", "owner_class": "MyClass", "value": "score", "context": {"line": 28}}
{"id": 5, "timestamp": "2026-05-05T10:00:04", "event_type": "instance_dict_access", "descriptor_name": "__dict__", "instance_type": "MyClass", "owner_class": "MyClass", "value": {"value": "override"}, "context": {"line": 15}}
"""

    snippet1 = """class DataDescriptor:
    def __get__(self, instance, owner):
        return instance._value if hasattr(instance, '_value') else None
    
    def __set__(self, instance, value):
        if value < 0:
            raise ValueError("Value must be non-negative")
        instance._value = value
    
    def __delete__(self, instance):
        del instance._value

class MyClass:
    value = DataDescriptor()

obj = MyClass()
obj.value = 42
print(obj.value)
"""

    snippet2 = """from functools import cached_property

class MyClass:
    def __init__(self, data):
        self._data = data
    
    @cached_property
    def processed(self):
        print("Computing...")
        return sum(self._data)

obj = MyClass([1, 2, 3, 4, 5])
print(obj.processed)
print(obj.processed)
"""

    files = {
        data_dir / "descriptor-cases.yaml": descriptor_cases,
        data_dir / "events.jsonl": events_jsonl,
        snippets_dir / "data_descriptor.py": snippet1,
        snippets_dir / "cached_property_example.py": snippet2,
    }

    for file_path, content in files.items():
        if file_path.exists() and not force:
            console.print(f"[yellow]Skipping {file_path} (already exists, use --force to overwrite)[/yellow]")
            continue
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        console.print(f"[green]Created: {file_path}[/green]")

    console.print("")
    console.print("[bold green]Project initialized successfully![/bold green]")
    console.print("")
    console.print("Next steps:")
    console.print(f"  1. Review the sample data in {data_dir}")
    console.print("  2. Run 'descriptor-inspector analyze' to analyze the cases")
    console.print("  3. Run 'descriptor-inspector compare' to compare behaviors")
    console.print("  4. Run 'descriptor-inspector export' to generate reports")


@main.command()
@click.option("--cases", default="data/descriptor-cases.yaml", help="Path to descriptor cases YAML file.")
@click.option("--events", default="data/events.jsonl", help="Path to events JSONL file.")
@click.option("--snippets", default="data/snippets", help="Directory containing code snippets.")
@click.option("--case-id", help="Analyze only a specific case ID.")
@click.option("--verbose", "-v", is_flag=True, help="Show detailed output.")
@click.pass_context
def analyze(ctx, cases, events, snippets, case_id, verbose):
    """Analyze descriptor cases and code snippets."""
    storage = ctx.obj["storage"]
    analyzer = ctx.obj["analyzer"]
    
    cases_path = Path(cases)
    events_path = Path(events)
    snippets_path = Path(snippets)
    
    if cases_path.exists():
        console.print(f"[cyan]Loading descriptor cases from {cases_path}...[/cyan]")
        with open(cases_path, "r", encoding="utf-8") as f:
            yaml_content = f.read()
        
        descriptor_cases = analyzer.parse_descriptor_cases(yaml_content)
        
        if analyzer.validation_errors:
            _show_validation_errors(analyzer.validation_errors)
        
        if case_id:
            descriptor_cases = [c for c in descriptor_cases if c.id == case_id]
            if not descriptor_cases:
                console.print(f"[red]Case ID '{case_id}' not found.[/red]")
                return
        
        for case in descriptor_cases:
            storage.save_descriptor_case(case)
            console.print(f"  [green]Loaded case: {case.id} - {case.name}[/green]")
            
            if case.code_snippet:
                result = analyzer.analyze_code_snippet(case.code_snippet, case.id)
                storage.save_analysis_result(result)
                
                if verbose:
                    _show_analysis_result(result)
        
        console.print(f"[green]Loaded {len(descriptor_cases)} descriptor cases.[/green]")
    else:
        console.print(f"[yellow]Cases file not found: {cases_path}[/yellow]")
    
    if events_path.exists():
        console.print(f"[cyan]Loading events from {events_path}...[/cyan]")
        with open(events_path, "r", encoding="utf-8") as f:
            jsonl_content = f.read()
        
        events_list = analyzer.parse_events_jsonl(jsonl_content)
        
        if analyzer.validation_errors:
            _show_validation_errors(analyzer.validation_errors)
        
        for event in events_list:
            storage.save_event(event)
        
        console.print(f"[green]Loaded {len(events_list)} events.[/green]")
    else:
        console.print(f"[yellow]Events file not found: {events_path}[/yellow]")
    
    if snippets_path.exists() and snippets_path.is_dir():
        console.print(f"[cyan]Analyzing code snippets in {snippets_path}...[/cyan]")
        
        for snippet_file in snippets_path.glob("*.py"):
            with open(snippet_file, "r", encoding="utf-8") as f:
                code = f.read()
            
            case_id = snippet_file.stem
            result = analyzer.analyze_code_snippet(code, case_id)
            
            storage.save_analysis_result(result)
            console.print(f"  [green]Analyzed: {snippet_file.name}[/green]")
            
            if verbose:
                _show_analysis_result(result)
    else:
        console.print(f"[yellow]Snippets directory not found: {snippets_path}[/yellow]")
    
    stats = storage.get_statistics()
    console.print("")
    console.print("[bold]Analysis Summary:[/bold]")
    console.print(f"  Total Cases: {stats['case_count']}")
    console.print(f"  Total Events: {stats['event_count']}")
    console.print(f"  Total Analyses: {stats['analysis_count']}")


@main.command()
@click.argument("case1_id")
@click.argument("case2_id")
@click.option("--save", is_flag=True, help="Save comparison result to database.")
@click.option("--verbose", "-v", is_flag=True, help="Show detailed output.")
@click.pass_context
def compare(ctx, case1_id, case2_id, save, verbose):
    """Compare two descriptor cases."""
    storage = ctx.obj["storage"]
    analyzer = ctx.obj["analyzer"]
    
    result1 = storage.get_latest_analysis_for_case(case1_id)
    result2 = storage.get_latest_analysis_for_case(case2_id)
    
    if not result1:
        console.print(f"[red]No analysis found for case: {case1_id}[/red]")
        return
    
    if not result2:
        console.print(f"[red]No analysis found for case: {case2_id}[/red]")
        return
    
    comparison = analyzer.compare_results(result1, result2)
    
    if save:
        comparison_id = storage.save_comparison_result(comparison)
        console.print(f"[green]Comparison saved with ID: {comparison_id}[/green]")
    
    _show_comparison_result(comparison, verbose)


@main.command()
@click.option("--format", "-f", type=click.Choice(["markdown", "json", "both"]), default="both", help="Output format.")
@click.option("--output", "-o", default="reports", help="Output directory.")
@click.option("--case-id", multiple=True, help="Include specific case IDs (can be used multiple times).")
@click.option("--title", default="Descriptor Inspection Report", help="Report title.")
@click.pass_context
def export(ctx, format, output, case_id, title):
    """Export analysis results to Markdown or JSON reports."""
    storage = ctx.obj["storage"]
    exporter = ctx.obj["exporter"]
    
    output_path = Path(output)
    output_path.mkdir(parents=True, exist_ok=True)
    
    cases = storage.get_all_descriptor_cases()
    
    if case_id:
        cases = [c for c in cases if c.id in case_id]
        if not cases:
            console.print(f"[red]No matching cases found for IDs: {case_id}[/red]")
            return
    
    analyses = []
    for case in cases:
        analysis = storage.get_latest_analysis_for_case(case.id)
        if analysis:
            analyses.append(analysis)
    
    comparisons = []
    for i, case1 in enumerate(cases):
        for case2 in cases[i+1:]:
            comps = storage.get_comparisons_between(case1.id, case2.id)
            comparisons.extend(comps)
    
    summary = exporter.create_analysis_summary(cases, analyses, comparisons)
    
    if format in ["json", "both"]:
        json_path = output_path / "report.json"
        exporter.export_json(summary, str(json_path))
        console.print(f"[green]JSON report exported to: {json_path}[/green]")
    
    if format in ["markdown", "both"]:
        md_path = output_path / "report.md"
        exporter.export_markdown(cases, analyses, comparisons, str(md_path), title)
        console.print(f"[green]Markdown report exported to: {md_path}[/green]")
    
    console.print("")
    console.print("[bold]Export Summary:[/bold]")
    console.print(f"  Cases included: {len(cases)}")
    console.print(f"  Analyses included: {len(analyses)}")
    console.print(f"  Comparisons included: {len(comparisons)}")


@main.command()
@click.option("--case-id", help="Show details for a specific case.")
@click.option("--analysis-id", type=int, help="Show details for a specific analysis.")
@click.option("--comparison-id", type=int, help="Show details for a specific comparison.")
@click.pass_context
def show(ctx, case_id, analysis_id, comparison_id):
    """Show detailed information about cases, analyses, or comparisons."""
    storage = ctx.obj["storage"]
    
    if case_id:
        case = storage.get_descriptor_case(case_id)
        if case:
            _show_case_detail(case)
            analysis = storage.get_latest_analysis_for_case(case_id)
            if analysis:
                console.print("")
                console.print("[bold]Latest Analysis:[/bold]")
                _show_analysis_result(analysis, verbose=True)
        else:
            console.print(f"[red]Case not found: {case_id}[/red]")
    
    elif analysis_id:
        analysis = storage.get_analysis_result(analysis_id)
        if analysis:
            _show_analysis_result(analysis, verbose=True)
        else:
            console.print(f"[red]Analysis not found: {analysis_id}[/red]")
    
    elif comparison_id:
        comparison = storage.get_comparison_result(comparison_id)
        if comparison:
            _show_comparison_result(comparison, verbose=True)
        else:
            console.print(f"[red]Comparison not found: {comparison_id}[/red]")
    
    else:
        stats = storage.get_statistics()
        cases = storage.get_all_descriptor_cases()
        
        console.print("[bold]Database Statistics:[/bold]")
        console.print(f"  Total Cases: {stats['case_count']}")
        console.print(f"  Total Events: {stats['event_count']}")
        console.print(f"  Total Analyses: {stats['analysis_count']}")
        console.print(f"  Total Comparisons: {stats['comparison_count']}")
        console.print("")
        
        if stats["type_distribution"]:
            console.print("[bold]Descriptor Type Distribution:[/bold]")
            for desc_type, count in stats["type_distribution"].items():
                console.print(f"  {desc_type}: {count}")
            console.print("")
        
        if cases:
            console.print("[bold]Available Cases:[/bold]")
            table = Table(show_header=True)
            table.add_column("ID", style="cyan")
            table.add_column("Name", style="green")
            table.add_column("Type", style="yellow")
            table.add_column("Tags", style="magenta")
            
            for case in cases:
                table.add_row(
                    case.id,
                    case.name,
                    case.descriptor_type.value,
                    ", ".join(case.tags) if case.tags else "-",
                )
            
            console.print(table)


def _show_validation_errors(errors: list) -> None:
    """Display validation errors to the user."""
    console.print("")
    console.print("[bold red]Validation Errors:[/bold red]")
    console.print("")
    
    for error in errors:
        console.print(f"  [red]File: {error.file_path}:{error.line_number}[/red]")
        console.print(f"  [red]Type: {error.error_type}[/red]")
        console.print(f"  [red]Message: {error.message}[/red]")
        if error.suggestion:
            console.print(f"  [yellow]Suggestion: {error.suggestion}[/yellow]")
        if error.context:
            console.print(f"  [dim]Context: {error.context}[/dim]")
        console.print("")


def _show_analysis_result(result, verbose: bool = False) -> None:
    """Display analysis result."""
    console.print("")
    console.print(f"[bold]Analysis Result: {result.case_id}[/bold]")
    console.print(f"  Descriptor Type: {result.descriptor_type.value}")
    console.print(f"  Priority: {result.priority_observed}")
    console.print(f"  Analyzed at: {result.analyzed_at}")
    
    if verbose:
        console.print("")
        console.print("[bold]Behavior Details:[/bold]")
        console.print(f"  Instance Dict Coverage: {result.instance_dict_coverage}")
        console.print(f"  __get__ Called: {result.get_called}")
        console.print(f"  __set__ Called: {result.set_called}")
        console.print(f"  __delete__ Called: {result.delete_called}")
        console.print(f"  __set_name__ Called: {result.set_name_called}")
        
        if result.validation_errors:
            console.print("")
            console.print("[bold red]Validation Errors:[/bold red]")
            for error in result.validation_errors:
                console.print(f"  - {error}")
        
        if result.property_vs_cached_diff:
            console.print("")
            console.print("[bold]Property vs cached_property:[/bold]")
            console.print(f"  {result.property_vs_cached_diff}")
        
        if result.events:
            console.print("")
            console.print("[bold]Events:[/bold]")
            table = Table(show_header=True)
            table.add_column("ID")
            table.add_column("Type")
            table.add_column("Descriptor")
            table.add_column("Exception")
            
            for event in result.events:
                table.add_row(
                    str(event.id),
                    event.event_type.value,
                    event.descriptor_name,
                    event.exception or "-",
                )
            
            console.print(table)


def _show_comparison_result(comparison, verbose: bool = False) -> None:
    """Display comparison result."""
    console.print("")
    console.print(f"[bold]Comparison: {comparison.case1_id} vs {comparison.case2_id}[/bold]")
    console.print(f"  Compared at: {comparison.compared_at}")
    
    if comparison.key_insights:
        console.print("")
        console.print("[bold cyan]Key Insights:[/bold cyan]")
        for insight in comparison.key_insights:
            console.print(f"  - {insight}")
    
    if comparison.differences:
        console.print("")
        console.print("[bold red]Differences:[/bold red]")
        
        table = Table(show_header=True)
        table.add_column("Field")
        table.add_column(f"Case 1 ({comparison.case1_id})")
        table.add_column(f"Case 2 ({comparison.case2_id})")
        
        for diff in comparison.differences:
            table.add_row(
                diff.get("field", "N/A"),
                str(diff.get("case1", "N/A")),
                str(diff.get("case2", "N/A")),
            )
        
        console.print(table)
    
    if verbose and comparison.similarities:
        console.print("")
        console.print("[bold green]Similarities:[/bold green]")
        
        table = Table(show_header=True)
        table.add_column("Field")
        table.add_column("Value")
        
        for sim in comparison.similarities:
            table.add_row(
                sim.get("field", "N/A"),
                str(sim.get("value", "N/A")),
            )
        
        console.print(table)


def _show_case_detail(case) -> None:
    """Display detailed case information."""
    console.print("")
    console.print(f"[bold]Case: {case.name} ({case.id})[/bold]")
    console.print(f"  Type: {case.descriptor_type.value}")
    console.print(f"  Description: {case.description}")
    
    if case.tags:
        console.print(f"  Tags: {', '.join(case.tags)}")
    
    if case.code_snippet:
        console.print("")
        console.print("[bold]Code Snippet:[/bold]")
        console.print("")
        for line in case.code_snippet.split("\n"):
            console.print(f"  {line}")
    
    if case.expected_behavior:
        console.print("")
        console.print("[bold]Expected Behavior:[/bold]")
        for key, value in case.expected_behavior.items():
            console.print(f"  {key}: {value}")


if __name__ == "__main__":
    main()
