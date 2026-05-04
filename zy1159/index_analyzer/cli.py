"""
Index Analyzer CLI - Command-line interface for database index analysis.
"""

import json
import os
import sys
from datetime import datetime
from typing import List, Optional

import click

from .analyzer import IndexAnalyzer
from .exporter import ReportExporter
from .models import (
    AnalysisResult,
    CandidateIndex,
    DatabaseType,
    IndexPolicy,
    IndexType,
    InputDataSet,
    ReportFormat,
)
from .parsers import (
    parse_explain_result,
    parse_index_policy,
    parse_schema,
    parse_slow_query_jsonl,
    parse_table_stats_csv,
    parse_write_load_csv,
)
from .simulator import IndexSimulator


@click.group()
@click.version_option()
@click.option(
    "--schema",
    "-s",
    type=click.Path(exists=True, file_okay=True, dir_okay=False),
    help="Path to schema.sql file",
)
@click.option(
    "--slow-queries",
    "-q",
    type=click.Path(exists=True, file_okay=True, dir_okay=False),
    help="Path to slow-queries.jsonl file",
)
@click.option(
    "--explain",
    "-e",
    type=click.Path(exists=True, file_okay=True, dir_okay=False),
    help="Path to explain-before.json file",
)
@click.option(
    "--table-stats",
    "-t",
    type=click.Path(exists=True, file_okay=True, dir_okay=False),
    help="Path to table-stats.csv file",
)
@click.option(
    "--write-load",
    "-w",
    type=click.Path(exists=True, file_okay=True, dir_okay=False),
    help="Path to write-load.csv file",
)
@click.option(
    "--index-policy",
    "-p",
    type=click.Path(exists=True, file_okay=True, dir_okay=False),
    help="Path to index-policy.yaml file",
)
@click.option(
    "--db-type",
    type=click.Choice(["mysql", "postgres"]),
    default="mysql",
    help="Database type (mysql or postgres)",
)
@click.pass_context
def main(
    ctx,
    schema,
    slow_queries,
    explain,
    table_stats,
    write_load,
    index_policy,
    db_type,
):
    """MySQL/PostgreSQL Index Analysis CLI - Analyze, suggest, and simulate index optimizations."""
    ctx.ensure_object(dict)
    ctx.obj["input_paths"] = {
        "schema": schema,
        "slow_queries": slow_queries,
        "explain": explain,
        "table_stats": table_stats,
        "write_load": write_load,
        "index_policy": index_policy,
    }
    ctx.obj["db_type"] = DatabaseType(db_type)


def load_dataset(ctx: click.Context) -> InputDataSet:
    paths = ctx.obj["input_paths"]
    db_type = ctx.obj.get("db_type", DatabaseType.MYSQL)
    
    dataset = InputDataSet()
    
    if paths["schema"]:
        with open(paths["schema"], "r", encoding="utf-8") as f:
            schema_content = f.read()
            dataset.schema = parse_schema(schema_content, db_type)
    
    if paths["slow_queries"]:
        with open(paths["slow_queries"], "r", encoding="utf-8") as f:
            dataset.slow_queries = parse_slow_query_jsonl(f)
    
    if paths["explain"]:
        with open(paths["explain"], "r", encoding="utf-8") as f:
            explain_content = f.read()
            dataset.explain_results = parse_explain_result(explain_content)
    
    if paths["table_stats"]:
        with open(paths["table_stats"], "r", encoding="utf-8") as f:
            dataset.table_stats = parse_table_stats_csv(f)
    
    if paths["write_load"]:
        with open(paths["write_load"], "r", encoding="utf-8") as f:
            dataset.write_load = parse_write_load_csv(f)
    
    if paths["index_policy"]:
        with open(paths["index_policy"], "r", encoding="utf-8") as f:
            policy_content = f.read()
            dataset.index_policy = parse_index_policy(policy_content)
    
    return dataset


def create_analysis_result(
    dataset: InputDataSet,
    issues,
    candidates,
) -> AnalysisResult:
    db_type = dataset.schema.database_type if dataset.schema else DatabaseType.MYSQL
    
    tables_analyzed = len(dataset.schema.tables) if dataset.schema else 0
    queries_analyzed = len(dataset.slow_queries)
    
    critical = sum(1 for i in issues if i.severity == "critical")
    high = sum(1 for i in issues if i.severity == "high")
    medium = sum(1 for i in issues if i.severity == "medium")
    low = sum(1 for i in issues if i.severity == "low")
    
    recommendations = []
    if critical > 0:
        recommendations.append(f"优先处理 {critical} 个 Critical 级别的问题")
    if high > 0:
        recommendations.append(f"尽快修复 {high} 个 High 级别的问题")
    if candidates:
        top_candidates = candidates[:3]
        recommendations.append(
            f"考虑添加以下高收益索引: {', '.join(c.index_name for c in top_candidates)}"
        )
    
    summary = {
        "by_severity": {
            "critical": critical,
            "high": high,
            "medium": medium,
            "low": low,
        },
        "by_type": {},
        "top_candidates": [
            {
                "index_name": c.index_name,
                "table_name": c.table_name,
                "net_score": c.net_score,
            }
            for c in candidates[:5]
        ],
    }
    
    return AnalysisResult(
        schema_name="imported_schema",
        database_type=db_type,
        timestamp=datetime.now(),
        tables_analyzed=tables_analyzed,
        queries_analyzed=queries_analyzed,
        issues=issues,
        candidate_indexes=candidates,
        summary=summary,
        recommendations=recommendations,
    )


@main.command()
@click.option(
    "--output",
    "-o",
    type=click.Path(writable=True),
    help="Output file path (optional, prints to stdout if not specified)",
)
@click.option(
    "--format",
    "-f",
    type=click.Choice(["json", "csv", "markdown"]),
    default="markdown",
    help="Output format",
)
@click.option(
    "--min-severity",
    type=click.Choice(["critical", "high", "medium", "low"]),
    default="low",
    help="Minimum severity to report",
)
@click.pass_context
def analyze(ctx, output, format, min_severity):
    """Analyze database indexes for missing, redundant, and inefficient indexes.
    
    This command analyzes the schema, slow queries, explain plans, table stats,
    and write load to identify index issues.
    
    Example:
      index-analyzer -s schema.sql -q slow.jsonl -e explain.json analyze
    """
    dataset = load_dataset(ctx)
    
    if not dataset.schema:
        click.echo("Error: Schema file is required for analysis", err=True)
        sys.exit(1)
    
    policy = dataset.index_policy
    min_selectivity = policy.min_selectivity_for_index if policy else 0.1
    max_indexes = policy.max_indexes_per_table if policy else 10
    
    analyzer = IndexAnalyzer(
        dataset=dataset,
        min_selectivity=min_selectivity,
        max_indexes_per_table=max_indexes,
    )
    
    issues, candidates = analyzer.analyze()
    
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    min_level = severity_order[min_severity]
    issues = [i for i in issues if severity_order.get(i.severity, 99) <= min_level]
    
    result = create_analysis_result(dataset, issues, candidates)
    
    exporter = ReportExporter()
    report_format = ReportFormat(format)
    content = exporter.export(result, report_format)
    
    if output:
        with open(output, "w", encoding="utf-8") as f:
            f.write(content)
        click.echo(f"Report written to: {output}")
    else:
        click.echo(content)


@main.command()
@click.option(
    "--output",
    "-o",
    type=click.Path(writable=True),
    help="Output file path",
)
@click.option(
    "--format",
    "-f",
    type=click.Choice(["json", "csv", "markdown"]),
    default="markdown",
    help="Output format",
)
@click.option(
    "--top-n",
    "-n",
    type=int,
    default=10,
    help="Number of top candidates to show",
)
@click.option(
    "--min-net-score",
    type=float,
    default=0.0,
    help="Minimum net score for candidates",
)
@click.pass_context
def suggest(ctx, output, format, top_n, min_net_score):
    """Suggest candidate indexes based on query patterns.
    
    This command analyzes slow queries and suggests new indexes that could
    improve performance, considering the write cost impact.
    
    Example:
      index-analyzer -s schema.sql -q slow.jsonl suggest --top-n 5
    """
    dataset = load_dataset(ctx)
    
    if not dataset.schema:
        click.echo("Error: Schema file is required", err=True)
        sys.exit(1)
    
    analyzer = IndexAnalyzer(dataset=dataset)
    _, candidates = analyzer.analyze()
    
    candidates = [c for c in candidates if c.net_score >= min_net_score]
    candidates = candidates[:top_n]
    
    exporter = ReportExporter()
    report_format = ReportFormat(format)
    content = exporter.export_candidates_only(candidates, report_format)
    
    if output:
        with open(output, "w", encoding="utf-8") as f:
            f.write(content)
        click.echo(f"Suggestions written to: {output}")
    else:
        click.echo(content)


@main.command()
@click.option(
    "--index",
    "-i",
    "indexes",
    multiple=True,
    help="Candidate index to simulate (format: table:col1,col2)",
)
@click.option(
    "--operation",
    "-o",
    type=click.Choice(["add", "drop"]),
    default="add",
    help="Operation to simulate (add or drop index)",
)
@click.option(
    "--format",
    "-f",
    type=click.Choice(["json", "markdown"]),
    default="markdown",
    help="Output format",
)
@click.pass_context
def simulate(ctx, indexes, operation, format):
    """Simulate the impact of adding or dropping an index.
    
    This command estimates the query performance improvement and write cost
    increase of adding a new index, or the performance regression and write
    savings of dropping an existing index.
    
    Index format: table_name:column1,column2,column3
    
    Example:
      index-analyzer -s schema.sql -q slow.jsonl -w write-load.csv simulate -i users:email,status
    """
    dataset = load_dataset(ctx)
    
    if not dataset.schema:
        click.echo("Error: Schema file is required", err=True)
        sys.exit(1)
    
    candidates = []
    
    for idx_spec in indexes:
        try:
            table_part, cols_part = idx_spec.split(":")
            table_name = table_part.strip()
            columns = [c.strip() for c in cols_part.split(",")]
            
            if table_name not in dataset.schema.tables:
                click.echo(f"Warning: Table '{table_name}' not found in schema", err=True)
                continue
            
            table = dataset.schema.tables[table_name]
            invalid_cols = [c for c in columns if not any(col.name == c for col in table.columns)]
            if invalid_cols:
                click.echo(f"Warning: Columns {invalid_cols} not found in table '{table_name}'", err=True)
                continue
            
            candidate = CandidateIndex(
                index_name=f"idx_{table_name}_{'_'.join(columns)}",
                table_name=table_name,
                columns=columns,
                index_type=IndexType.BTREE,
            )
            candidates.append(candidate)
            
        except ValueError:
            click.echo(
                f"Error: Invalid index format '{idx_spec}'. "
                f"Use format: table:col1,col2",
                err=True
            )
            sys.exit(1)
    
    if not candidates:
        click.echo("Error: No valid indexes to simulate", err=True)
        sys.exit(1)
    
    simulator = IndexSimulator(dataset=dataset)
    results = []
    
    for candidate in candidates:
        result = simulator.simulate_candidate(candidate, operation)
        results.append(result)
        
        click.echo(f"\n{'='*60}")
        click.echo(f"Simulation for: {candidate.index_name}")
        click.echo(f"{'='*60}")
        click.echo(f"Table: {candidate.table_name}")
        click.echo(f"Columns: {', '.join(candidate.columns)}")
        click.echo(f"Operation: {operation}")
        click.echo("")
        
        if result.query_improvements:
            click.echo(f"Queries affected: {len(result.query_improvements)}")
            for q in result.query_improvements[:5]:
                click.echo(
                    f"  - Query {q['query_id']}: {q['improvement_pct']:+.1f}% "
                    f"({q['original_execution_time_ms']:.0f}ms -> {q['estimated_execution_time_ms']:.0f}ms)"
                )
            if len(result.query_improvements) > 5:
                click.echo(f"  ... and {len(result.query_improvements) - 5} more")
        else:
            click.echo("No queries affected by this index change")
        
        click.echo("")
        click.echo("Write Cost Analysis:")
        write_analysis = result.write_cost_analysis
        if operation == "add":
            click.echo(f"  Estimated write cost increase: {write_analysis.get('estimated_increase_pct', 0):.1f}%")
        else:
            click.echo(f"  Estimated write cost savings: {write_analysis.get('estimated_savings_pct', 0):.1f}%")
        
        risk = write_analysis.get("risk_level", write_analysis.get("benefit_level", "unknown"))
        click.echo(f"  Risk/Benefit Level: {risk}")
        
        click.echo("")
        click.echo(f"Overall Score Change: {result.overall_score_change:+.2f}")
    
    if format == "json":
        output_data = {
            "timestamp": datetime.now().isoformat(),
            "operation": operation,
            "simulations": [r.model_dump(mode="json") for r in results],
        }
        click.echo("\n" + json.dumps(output_data, indent=2, ensure_ascii=False))


@main.command()
@click.option(
    "--index",
    "-i",
    "indexes",
    multiple=True,
    help="Candidate indexes to compare (format: table:col1,col2)",
)
@click.option(
    "--format",
    "-f",
    type=click.Choice(["json", "markdown"]),
    default="markdown",
    help="Output format",
)
@click.pass_context
def compare(ctx, indexes, format):
    """Compare multiple candidate indexes side by side.
    
    This command simulates multiple candidate indexes and compares their
    expected performance benefits and write costs, recommending the best option.
    
    Example:
      index-analyzer -s schema.sql -q slow.jsonl compare -i users:email -i users:status,created_at
    """
    dataset = load_dataset(ctx)
    
    if not dataset.schema:
        click.echo("Error: Schema file is required", err=True)
        sys.exit(1)
    
    if len(indexes) < 2:
        click.echo("Error: At least 2 indexes required for comparison", err=True)
        click.echo("Use -i option multiple times to specify indexes to compare")
        sys.exit(1)
    
    candidates = []
    for idx_spec in indexes:
        try:
            table_part, cols_part = idx_spec.split(":")
            table_name = table_part.strip()
            columns = [c.strip() for c in cols_part.split(",")]
            
            if table_name not in dataset.schema.tables:
                click.echo(f"Warning: Table '{table_name}' not found in schema", err=True)
                continue
            
            candidate = CandidateIndex(
                index_name=f"idx_{table_name}_{'_'.join(columns)}",
                table_name=table_name,
                columns=columns,
                index_type=IndexType.BTREE,
            )
            candidates.append(candidate)
            
        except ValueError:
            click.echo(
                f"Error: Invalid index format '{idx_spec}'. "
                f"Use format: table:col1,col2",
                err=True
            )
            sys.exit(1)
    
    if len(candidates) < 2:
        click.echo("Error: Need at least 2 valid indexes to compare", err=True)
        sys.exit(1)
    
    simulator = IndexSimulator(dataset=dataset)
    comparison = simulator.compare_indexes(candidates)
    
    if format == "json":
        click.echo(json.dumps(comparison, indent=2, ensure_ascii=False))
    else:
        click.echo("\n" + "=" * 80)
        click.echo("Index Comparison Results")
        click.echo("=" * 80)
        
        click.echo("\n| # | Index | Table | Columns | Net Score | Queries | Write Cost % | Risk |")
        click.echo("|---|-------|-------|---------|-----------|---------|--------------|------|")
        
        for i, result in enumerate(comparison["results"], 1):
            risk = result.get("risk_level", "unknown")
            click.echo(
                f"| {i} | `{result['index_name']}` | `{result['table_name']}` | "
                f"`{', '.join(result['columns'])}` | {result['net_score']:.1f} | "
                f"{result['queries_covered']} | {result['write_cost_increase_pct']:.1f}% | {risk} |"
            )
        
        if comparison.get("recommendation"):
            rec = comparison["recommendation"]
            click.echo("\n" + "=" * 80)
            click.echo("RECOMMENDATION")
            click.echo("=" * 80)
            click.echo(f"\nRecommended Index: `{rec['recommended_index']}`")
            click.echo(f"Reason: {rec['reason']}")
            
            details = rec.get("details", {})
            click.echo(f"\nDetails:")
            click.echo(f"  - Net Score: {details.get('net_score', 0):.1f}")
            click.echo(f"  - Queries Covered: {details.get('queries_covered', 0)}")
            click.echo(f"  - Write Cost Risk: {details.get('write_cost_risk', 'unknown')}")


@main.command()
@click.option(
    "--output",
    "-o",
    type=click.Path(writable=True),
    required=True,
    help="Output file path",
)
@click.option(
    "--format",
    "-f",
    type=click.Choice(["json", "csv", "markdown"]),
    default="markdown",
    help="Output format",
)
@click.option(
    "--include-simulations",
    is_flag=True,
    help="Include simulation results in the report",
)
@click.pass_context
def export(ctx, output, format, include_simulations):
    """Export full analysis report in various formats.
    
    This command runs a complete analysis and exports the results to a file.
    Use this for generating reports for documentation or sharing.
    
    Example:
      index-analyzer -s schema.sql -q slow.jsonl -e explain.json export -o report.md -f markdown
    """
    dataset = load_dataset(ctx)
    
    if not dataset.schema:
        click.echo("Error: Schema file is required", err=True)
        sys.exit(1)
    
    analyzer = IndexAnalyzer(dataset=dataset)
    issues, candidates = analyzer.analyze()
    
    result = create_analysis_result(dataset, issues, candidates)
    
    simulation_results = None
    if include_simulations and candidates:
        simulator = IndexSimulator(dataset=dataset)
        simulation_results = []
        for candidate in candidates[:5]:
            sim_result = simulator.simulate_candidate(candidate, "add")
            simulation_results.append(sim_result)
    
    exporter = ReportExporter()
    report_format = ReportFormat(format)
    content = exporter.export(result, report_format, simulation_results)
    
    with open(output, "w", encoding="utf-8") as f:
        f.write(content)
    
    click.echo(f"Report exported to: {output}")
    click.echo(f"Format: {format}")
    click.echo(f"Issues found: {len(issues)}")
    click.echo(f"Candidates suggested: {len(candidates)}")


@main.command()
@click.option(
    "--output-dir",
    "-o",
    type=click.Path(writable=True, file_okay=False, dir_okay=True),
    default="./sample_data",
    help="Output directory for sample files",
)
@click.option(
    "--with-errors",
    is_flag=True,
    help="Include error/anomaly samples for testing",
)
def seed(output_dir, with_errors):
    """Generate sample/seed data files for testing.
    
    This command creates sample input files with realistic data patterns.
    Use this to get started quickly or to test the tool.
    
    Example:
      index-analyzer seed -o ./data --with-errors
    """
    from .sample_data import generate_sample_files
    
    generate_sample_files(output_dir, include_errors=with_errors)
    
    click.echo(f"Sample files generated in: {output_dir}")
    click.echo("")
    click.echo("Files created:")
    click.echo("  - schema.sql: Sample database schema")
    click.echo("  - slow-queries.jsonl: Sample slow query log")
    click.echo("  - explain-before.json: Sample EXPLAIN results")
    click.echo("  - table-stats.csv: Sample table statistics")
    click.echo("  - write-load.csv: Sample write load metrics")
    click.echo("  - index-policy.yaml: Sample index policy")
    
    if with_errors:
        click.echo("")
        click.echo("Error samples also created (for testing):")
        click.echo("  - schema-invalid.sql: Invalid SQL syntax")
        click.echo("  - slow-queries-malformed.jsonl: Invalid JSON lines")
        click.echo("  - table-stats-missing.csv: Missing required columns")
    
    click.echo("")
    click.echo("Try running:")
    click.echo(f"  index-analyzer -s {output_dir}/schema.sql -q {output_dir}/slow-queries.jsonl analyze")


if __name__ == "__main__":
    main()
