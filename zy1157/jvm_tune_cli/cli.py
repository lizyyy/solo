"""
JVM Tuning CLI - Main Entry Point
"""

import os
import sys
import json
from typing import Optional, List, Dict, Any
from pathlib import Path

import click

from .workspace import WorkspaceManager
from .parsers.gc_log_parser import GCLogParser
from .parsers.jfr_parser import JFRSummaryParser
from .parsers.jvm_options_parser import JVMOptionsParser
from .parsers.metrics_parser import PodMetricsParser, TrafficMetricsParser
from .parsers.tuning_policy_parser import TuningPolicyParser
from .engine.analyzer import JVMAnalyzer
from .engine.simulator import GCCollectorSimulator
from .engine.tuner import JVMTuner
from .models.jvm_options import GCCollector


def get_workspace() -> WorkspaceManager:
    return WorkspaceManager()


def echo_success(message: str):
    click.secho(f"✓ {message}", fg='green')


def echo_error(message: str):
    click.secho(f"✗ {message}", fg='red')


def echo_warning(message: str):
    click.secho(f"⚠ {message}", fg='yellow')


def echo_info(message: str):
    click.secho(f"ℹ {message}", fg='cyan')


@click.group()
@click.version_option(version='0.1.0')
@click.pass_context
def cli(ctx):
    """JVM Tuning CLI - Analyze and optimize JVM performance in containerized environments.
    
    This tool helps you analyze GC logs, JFR data, pod metrics, and traffic data
    to identify performance issues and generate tuning recommendations.
    """
    ctx.ensure_object(dict)
    ctx.obj['workspace'] = get_workspace()


@cli.command()
@click.option('--force', '-f', is_flag=True, help='Force re-initialize if workspace exists')
@click.pass_context
def init(ctx, force):
    """Initialize a new JVM tuning workspace.
    
    Creates a .jvm-tune directory in the current working directory to store
    sessions, imported data, analysis results, and reports.
    """
    ws = ctx.obj['workspace']
    
    if ws.is_initialized() and not force:
        echo_warning("Workspace already exists. Use --force to re-initialize.")
        return
    
    if ws.init(force=force):
        echo_success(f"Initialized workspace at {ws.workspace_dir}")
        
        session_id = ws.create_session("default")
        echo_success(f"Created default session: {session_id}")
    else:
        echo_error("Failed to initialize workspace")


@cli.command()
@click.option('--session', '-s', help='Session name (default: current session)')
@click.pass_context
def status(ctx, session):
    """Show current workspace and session status."""
    ws = ctx.obj['workspace']
    
    if not ws.is_initialized():
        echo_warning("Workspace not initialized. Run 'jvm-tune init' first.")
        return
    
    info = ws.get_workspace_info()
    
    click.echo("\n" + "=" * 60)
    click.echo("JVM Tune Workspace Status")
    click.echo("=" * 60)
    
    click.echo(f"\nWorkspace Directory: {info['workspace_dir']}")
    click.echo(f"Created At: {info['metadata'].get('created_at', 'Unknown')}")
    
    current_session = info.get('current_session')
    if current_session:
        click.echo(f"\nCurrent Session: {current_session}")
        
        session_info = info.get('current_session_info', {})
        if session_info:
            imported = session_info.get('imported_files', [])
            click.echo(f"  Imported Files: {len(imported)}")
            for f in imported:
                click.echo(f"    - {f['filename']} ({f['type']})")
            
            analysis = session_info.get('analysis_results', [])
            click.echo(f"  Analysis Results: {len(analysis)}")
            
            tuning = session_info.get('tuning_results', [])
            click.echo(f"  Tuning Results: {len(tuning)}")
    else:
        echo_warning("No active session. Use 'jvm-tune session create' to create one.")
    
    sessions = info['metadata'].get('sessions', [])
    if sessions:
        click.echo(f"\nAll Sessions ({len(sessions)}):")
        for s in sessions:
            marker = " * " if s['id'] == current_session else "   "
            click.echo(f"{marker}{s['id']} (created: {s.get('created_at', 'Unknown')})")


@cli.group()
def session():
    """Manage analysis sessions."""
    pass


@session.command('create')
@click.argument('name', required=False)
@click.pass_context
def session_create(ctx, name):
    """Create a new analysis session.
    
    If no name is provided, a timestamp-based name will be generated.
    """
    ws = ctx.obj['workspace']
    
    if not ws.is_initialized():
        echo_error("Workspace not initialized. Run 'jvm-tune init' first.")
        return
    
    session_id = ws.create_session(name)
    echo_success(f"Created session: {session_id}")


@session.command('list')
@click.pass_context
def session_list(ctx):
    """List all sessions."""
    ws = ctx.obj['workspace']
    
    if not ws.is_initialized():
        echo_error("Workspace not initialized.")
        return
    
    sessions = ws.list_sessions()
    current = ws.get_current_session()
    
    if not sessions:
        echo_info("No sessions found.")
        return
    
    click.echo(f"\nSessions ({len(sessions)}):")
    for s in sessions:
        marker = " * " if s['id'] == current else "   "
        click.echo(f"{marker}{s['id']}")


@session.command('switch')
@click.argument('session_id')
@click.pass_context
def session_switch(ctx, session_id):
    """Switch to a different session."""
    ws = ctx.obj['workspace']
    
    if not ws.is_initialized():
        echo_error("Workspace not initialized.")
        return
    
    if ws.switch_session(session_id):
        echo_success(f"Switched to session: {session_id}")
    else:
        echo_error(f"Session not found: {session_id}")


@cli.command()
@click.option('--gc-log', '-g', type=click.Path(exists=True), help='GC log file')
@click.option('--jfr-summary', '-j', type=click.Path(exists=True), help='JFR summary JSON file')
@click.option('--pod-metrics', '-p', type=click.Path(exists=True), help='Pod metrics CSV file')
@click.option('--traffic', '-t', type=click.Path(exists=True), help='Traffic metrics CSV file')
@click.option('--jvm-options', '-o', type=click.Path(exists=True), help='JVM options YAML file')
@click.option('--tuning-policies', '-l', type=click.Path(exists=True), help='Tuning policies YAML file')
@click.option('--session', '-s', help='Target session')
@click.pass_context
def import_cmd(ctx, gc_log, jfr_summary, pod_metrics, traffic, jvm_options, tuning_policies, session):
    """Import data files for analysis.
    
    Supported file types:
    - GC log (.log)
    - JFR summary (.json)
    - Pod metrics (.csv)
    - Traffic metrics (.csv)
    - JVM options (.yaml/.yml)
    - Tuning policies (.yaml/.yml)
    """
    ws = ctx.obj['workspace']
    
    if not ws.is_initialized():
        echo_error("Workspace not initialized. Run 'jvm-tune init' first.")
        return
    
    imported_count = 0
    
    if gc_log:
        ws.save_imported_file('gc_log', gc_log, session)
        echo_success(f"Imported GC log: {os.path.basename(gc_log)}")
        imported_count += 1
    
    if jfr_summary:
        ws.save_imported_file('jfr_summary', jfr_summary, session)
        echo_success(f"Imported JFR summary: {os.path.basename(jfr_summary)}")
        imported_count += 1
    
    if pod_metrics:
        ws.save_imported_file('pod_metrics', pod_metrics, session)
        echo_success(f"Imported pod metrics: {os.path.basename(pod_metrics)}")
        imported_count += 1
    
    if traffic:
        ws.save_imported_file('traffic', traffic, session)
        echo_success(f"Imported traffic metrics: {os.path.basename(traffic)}")
        imported_count += 1
    
    if jvm_options:
        ws.save_imported_file('jvm_options', jvm_options, session)
        echo_success(f"Imported JVM options: {os.path.basename(jvm_options)}")
        imported_count += 1
    
    if tuning_policies:
        ws.save_imported_file('tuning_policies', tuning_policies, session)
        echo_success(f"Imported tuning policies: {os.path.basename(tuning_policies)}")
        imported_count += 1
    
    if imported_count == 0:
        echo_warning("No files specified. Use --help to see available options.")
    else:
        echo_success(f"Total: {imported_count} file(s) imported")


@cli.command()
@click.option('--session', '-s', help='Session to analyze')
@click.option('--slo-pause', type=int, default=200, help='SLO: Max pause time in ms (default: 200)')
@click.option('--slo-overhead', type=float, default=10.0, help='SLO: Max GC overhead % (default: 10)')
@click.option('--save/--no-save', default=True, help='Save analysis result')
@click.pass_context
def analyze(ctx, session, slo_pause, slo_overhead, save):
    """Analyze imported data to identify performance issues.
    
    Performs comprehensive analysis including:
    - GC pause distribution and statistics
    - Heap usage patterns
    - Container memory headroom
    - Traffic correlation
    - Risk factor identification
    - Parameter conflict detection
    """
    ws = ctx.obj['workspace']
    
    if not ws.is_initialized():
        echo_error("Workspace not initialized. Run 'jvm-tune init' first.")
        return
    
    imported_files = ws.get_imported_files(session)
    
    if not imported_files:
        echo_error("No imported files found. Run 'jvm-tune import' first.")
        return
    
    analyzer = JVMAnalyzer()
    analyzer.set_slo_config({
        'max_pause_ms': slo_pause,
        'max_gc_overhead_percent': slo_overhead
    })
    
    gc_events = []
    pod_metrics = []
    traffic_metrics = []
    jvm_options = None
    
    for f in imported_files:
        file_type = f['type']
        file_path = f['imported_path']
        
        if file_type == 'gc_log':
            echo_info(f"Parsing GC log: {f['filename']}")
            parser = GCLogParser()
            events = parser.parse_file(file_path)
            gc_events.extend(events)
            echo_info(f"  Found {len(events)} GC events")
        
        elif file_type == 'jfr_summary':
            echo_info(f"Parsing JFR summary: {f['filename']}")
            parser = JFRSummaryParser()
            events = parser.parse_file(file_path)
            gc_events.extend(events)
            echo_info(f"  Found {len(events)} events from JFR")
        
        elif file_type == 'pod_metrics':
            echo_info(f"Parsing pod metrics: {f['filename']}")
            parser = PodMetricsParser()
            metrics = parser.parse_file(file_path)
            pod_metrics.extend(metrics)
            echo_info(f"  Found {len(metrics)} metrics entries")
        
        elif file_type == 'traffic':
            echo_info(f"Parsing traffic metrics: {f['filename']}")
            parser = TrafficMetricsParser()
            metrics = parser.parse_file(file_path)
            traffic_metrics.extend(metrics)
            echo_info(f"  Found {len(metrics)} traffic entries")
        
        elif file_type == 'jvm_options':
            echo_info(f"Parsing JVM options: {f['filename']}")
            parser = JVMOptionsParser()
            jvm_options = parser.parse_file(file_path)
            echo_info(f"  GC Collector: {jvm_options.gc_collector.value}")
            echo_info(f"  Heap: {jvm_options.xmx_bytes // (1024**3)}GB")
    
    if gc_events:
        analyzer.set_gc_events(gc_events)
    
    if pod_metrics:
        analyzer.set_pod_metrics(pod_metrics)
    
    if traffic_metrics:
        analyzer.set_traffic_metrics(traffic_metrics)
    
    if jvm_options:
        analyzer.set_jvm_options(jvm_options)
    
    echo_info("Running analysis...")
    result = analyzer.analyze()
    
    click.echo("\n" + "=" * 60)
    click.echo("Analysis Results")
    click.echo("=" * 60)
    
    summary = result.summary
    click.echo(f"\nOverall Health: {summary['overall_health']}")
    
    risk_summary = summary['risk_summary']
    click.echo(f"\nRisk Summary:")
    if risk_summary.get('critical', 0) > 0:
        click.secho(f"  Critical: {risk_summary['critical']}", fg='red')
    if risk_summary.get('high', 0) > 0:
        click.secho(f"  High: {risk_summary['high']}", fg='yellow')
    if risk_summary.get('medium', 0) > 0:
        click.secho(f"  Medium: {risk_summary['medium']}", fg='cyan')
    if risk_summary.get('low', 0) > 0:
        click.echo(f"  Low: {risk_summary['low']}")
    
    gc_summary = summary['gc_summary']
    click.echo(f"\nGC Summary:")
    click.echo(f"  Total GC Events: {gc_summary['total_gc_count']}")
    click.echo(f"  Full GC Count: {gc_summary['full_gc_count']}")
    click.echo(f"  Max Pause: {gc_summary['max_pause_ms']}ms")
    click.echo(f"  GC Overhead: {gc_summary['gc_overhead_percent']}%")
    
    memory_summary = summary['memory_summary']
    click.echo(f"\nMemory Summary:")
    click.echo(f"  Heap Max: {memory_summary['heap_max_gb']}GB")
    click.echo(f"  Container Limit: {memory_summary['container_limit_gb']}GB")
    click.echo(f"  OOM Risk: {memory_summary['oom_risk_percent']}%")
    
    if result.risk_factors:
        click.echo(f"\nTop Risk Factors:")
        for risk in result.risk_factors[:5]:
            level_color = {
                'Critical': 'red',
                'High': 'yellow',
                'Medium': 'cyan',
                'Low': 'green'
            }.get(risk.level.value, 'white')
            click.secho(f"  [{risk.level.value}] {risk.title}", fg=level_color)
            click.echo(f"      {risk.description}")
    
    actions = summary.get('recommended_actions', [])
    if actions:
        click.echo(f"\nRecommended Actions:")
        for i, action in enumerate(actions, 1):
            click.echo(f"  {i}. {action}")
    
    if save:
        result_dict = result.to_dict()
        saved_path = ws.save_analysis_result(result_dict, session)
        echo_success(f"\nAnalysis saved to: {saved_path}")
    
    return result


@cli.command()
@click.option('--session', '-s', help='Session to use for tuning')
@click.option('--save/--no-save', default=True, help='Save tuning result')
@click.pass_context
def tune(ctx, session, save):
    """Generate JVM tuning recommendations.
    
    Uses the latest analysis results to generate specific tuning recommendations
    including:
    - GC collector selection
    - Heap size adjustments
    - Region size optimization
    - Container memory reserve
    - Advanced parameter tuning
    """
    ws = ctx.obj['workspace']
    
    if not ws.is_initialized():
        echo_error("Workspace not initialized.")
        return
    
    analysis_data = ws.get_latest_analysis(session)
    
    if not analysis_data:
        echo_error("No analysis found. Run 'jvm-tune analyze' first.")
        return
    
    imported_files = ws.get_imported_files(session)
    
    jvm_options = None
    tuning_policy_data = None
    
    for f in imported_files:
        if f['type'] == 'jvm_options':
            parser = JVMOptionsParser()
            jvm_options = parser.parse_file(f['imported_path'])
        elif f['type'] == 'tuning_policies':
            parser = TuningPolicyParser()
            tuning_policy_data = parser.parse_file(f['imported_path'])
    
    if not jvm_options:
        echo_warning("No JVM options found. Using defaults.")
        from .models.jvm_options import JVMOptions
        jvm_options = JVMOptions()
    
    tuner = JVMTuner()
    
    container_limit = analysis_data.get('container_stats', {}).get('memory_limit_bytes', 0)
    
    analysis_result = None
    try:
        from .models.analysis import AnalysisResult, GCPauseStatistics, HeapStatistics, ContainerStatistics
        
        pause_dict = analysis_data.get('pause_stats', {})
        heap_dict = analysis_data.get('heap_stats', {})
        container_dict = analysis_data.get('container_stats', {})
        
        pause_stats = GCPauseStatistics(
            total_gc_count=pause_dict.get('total_gc_count', 0),
            total_pause_ms=pause_dict.get('total_pause_ms', 0),
            total_runtime_ms=pause_dict.get('total_runtime_ms', 0),
            pause_ms_p50=pause_dict.get('pause_ms_p50', 0),
            pause_ms_p95=pause_dict.get('pause_ms_p95', 0),
            pause_ms_p99=pause_dict.get('pause_ms_p99', 0),
            pause_ms_max=pause_dict.get('pause_ms_max', 0),
            pause_ms_mean=pause_dict.get('pause_ms_mean', 0),
            throughput_percent=pause_dict.get('throughput_percent', 100),
            gc_overhead_percent=pause_dict.get('gc_overhead_percent', 0),
            young_gc_count=pause_dict.get('young_gc_count', 0),
            young_gc_total_ms=pause_dict.get('young_gc_total_ms', 0),
            full_gc_count=pause_dict.get('full_gc_count', 0),
            full_gc_total_ms=pause_dict.get('full_gc_total_ms', 0),
            mixed_gc_count=pause_dict.get('mixed_gc_count', 0),
            mixed_gc_total_ms=pause_dict.get('mixed_gc_total_ms', 0),
            humongous_allocation_count=pause_dict.get('humongous_allocation_count', 0),
            promotion_failure_count=pause_dict.get('promotion_failure_count', 0)
        )
        
        heap_stats = HeapStatistics(
            heap_max_bytes=int(heap_dict.get('heap_max_gb', 0) * (1024**3)) if heap_dict.get('heap_max_gb') else 0,
            heap_peak_bytes=int(heap_dict.get('heap_peak_gb', 0) * (1024**3)) if heap_dict.get('heap_peak_gb') else 0,
            heap_avg_bytes=int(heap_dict.get('heap_avg_gb', 0) * (1024**3)) if heap_dict.get('heap_avg_gb') else 0,
            heap_usage_percent_p50=heap_dict.get('heap_usage_percent_p50', 0),
            heap_usage_percent_p95=heap_dict.get('heap_usage_percent_p95', 0),
            heap_usage_percent_p99=heap_dict.get('heap_usage_percent_p99', 0),
            young_gen_peak_bytes=int(heap_dict.get('young_gen_peak_gb', 0) * (1024**3)) if heap_dict.get('young_gen_peak_gb') else 0,
            old_gen_peak_bytes=int(heap_dict.get('old_gen_peak_gb', 0) * (1024**3)) if heap_dict.get('old_gen_peak_gb') else 0,
            avg_reclaimed_per_gc_bytes=int(heap_dict.get('avg_reclaimed_per_gc_mb', 0) * (1024**2)) if heap_dict.get('avg_reclaimed_per_gc_mb') else 0,
            avg_reclaimed_per_gc_percent=heap_dict.get('avg_reclaimed_per_gc_percent', 0)
        )
        
        container_stats = ContainerStatistics(
            memory_limit_bytes=int(container_dict.get('memory_limit_gb', 0) * (1024**3)) if container_dict.get('memory_limit_gb') else 0,
            memory_peak_bytes=int(container_dict.get('memory_peak_gb', 0) * (1024**3)) if container_dict.get('memory_peak_gb') else 0,
            memory_avg_bytes=int(container_dict.get('memory_avg_gb', 0) * (1024**3)) if container_dict.get('memory_avg_gb') else 0,
            memory_headroom_min_bytes=int(container_dict.get('memory_headroom_min_mb', 0) * (1024**2)) if container_dict.get('memory_headroom_min_mb') else 0,
            memory_headroom_avg_bytes=int(container_dict.get('memory_headroom_avg_mb', 0) * (1024**2)) if container_dict.get('memory_headroom_avg_mb') else 0,
            oom_kill_risk_percent=container_dict.get('oom_kill_risk_percent', 0),
            jvm_heap_vs_container_ratio=container_dict.get('jvm_heap_vs_container_ratio', 0)
        )
        
        from datetime import datetime
        analysis_result = AnalysisResult(
            timestamp=datetime.now(),
            pause_stats=pause_stats,
            heap_stats=heap_stats,
            container_stats=container_stats,
            summary=analysis_data.get('summary', {})
        )
    except Exception as e:
        logger = __import__('logging').getLogger(__name__)
        logger.warning(f"Could not reconstruct AnalysisResult: {e}")
    
    tuner.set_base_data(
        options=jvm_options,
        analysis=analysis_result,
        container_memory_limit=container_limit
    )
    
    echo_info("Generating tuning recommendations...")
    tuning_result = tuner.tune()
    
    click.echo("\n" + "=" * 60)
    click.echo("Tuning Recommendations")
    click.echo("=" * 60)
    
    summary = tuning_result.summary
    click.echo(f"\nOverall Status: {summary['overall_status']}")
    
    rec_summary = summary.get('recommendation_summary', {})
    click.echo(f"\nRecommendations:")
    if rec_summary.get('critical', 0) > 0:
        click.secho(f"  Critical: {rec_summary['critical']}", fg='red')
    if rec_summary.get('high', 0) > 0:
        click.secho(f"  High: {rec_summary['high']}", fg='yellow')
    if rec_summary.get('medium', 0) > 0:
        click.secho(f"  Medium: {rec_summary['medium']}", fg='cyan')
    
    if tuning_result.recommendations:
        click.echo(f"\nDetailed Recommendations:")
        for rec in tuning_result.recommendations:
            level_color = {
                'Critical': 'red',
                'High': 'yellow',
                'Medium': 'cyan',
                'Low': 'green'
            }.get(rec.risk_level.value, 'white')
            
            click.secho(f"\n  [{rec.risk_level.value}] {rec.title}", fg=level_color)
            click.echo(f"      Description: {rec.description}")
            click.echo(f"      Root Cause: {rec.root_cause}")
            click.echo(f"      Impact: {rec.impact}")
            click.echo(f"      Current: {rec.current_config}")
            click.echo(f"      Recommended: {rec.recommended_config}")
            
            if rec.parameters:
                click.echo(f"      Parameters:")
                for p in rec.parameters:
                    change_marker = " [CHANGE]" if p.needs_change else ""
                    click.echo(f"        - {p.name}: {p.current_value} -> {p.recommended_value}{change_marker}")
    
    container_reserve = tuning_result.container_memory_reserve_recommendation
    if container_reserve:
        click.echo(f"\nContainer Memory Reserve Recommendation:")
        click.echo(f"  Container Limit: {container_reserve['container_limit_gb']}GB")
        click.echo(f"  Current Heap: {container_reserve['current_heap_gb']}GB ({container_reserve['current_reserve_percent']}% reserve)")
        click.echo(f"  Recommended Heap: {container_reserve['recommended_heap_gb']}GB ({100 - container_reserve['max_heap_ratio']*100:.0f}% reserve)")
        click.echo(f"  Minimum Reserve: {container_reserve['min_reserve_percent']}%")
    
    click.echo(f"\nRecommended JVM Options:")
    rec_opts = tuning_result.recommended_jvm_options
    if rec_opts:
        click.echo(f"  GC Collector: {rec_opts.get('gc_collector', 'Unknown')}")
        click.echo(f"  Heap: {rec_opts.get('xmx_gb', 0)}GB")
        if rec_opts.get('max_gc_pause_millis'):
            click.echo(f"  Max Pause: {rec_opts['max_gc_pause_millis']}ms")
    
    if save:
        result_dict = tuning_result.to_dict()
        saved_path = ws.save_tuning_result(result_dict, session)
        echo_success(f"\nTuning result saved to: {saved_path}")
    
    return tuning_result


@cli.command()
@click.option('--session', '-s', help='Session to use')
@click.option('--heap-sizes', '-H', default='0.8,1.0,1.25,1.5,2.0', 
              help='Heap size multipliers (default: 0.8,1.0,1.25,1.5,2.0)')
@click.option('--collectors', '-c', default='G1,ZGC,Shenandoah,Parallel',
              help='GC collectors to compare (default: G1,ZGC,Shenandoah,Parallel)')
@click.option('--max-pause', '-p', type=int, default=200, help='Target max pause (default: 200)')
@click.option('--save/--no-save', default=True, help='Save comparison result')
@click.pass_context
def compare(ctx, session, heap_sizes, collectors, max_pause, save):
    """Compare different GC configurations.
    
    Simulates how different GC collectors and heap sizes would perform
    based on the current analysis data.
    """
    ws = ctx.obj['workspace']
    
    if not ws.is_initialized():
        echo_error("Workspace not initialized.")
        return
    
    analysis_data = ws.get_latest_analysis(session)
    if not analysis_data:
        echo_error("No analysis found. Run 'jvm-tune analyze' first.")
        return
    
    imported_files = ws.get_imported_files(session)
    
    jvm_options = None
    for f in imported_files:
        if f['type'] == 'jvm_options':
            parser = JVMOptionsParser()
            jvm_options = parser.parse_file(f['imported_path'])
            break
    
    if not jvm_options:
        from .models.jvm_options import JVMOptions
        jvm_options = JVMOptions()
    
    heap_multipliers = [float(m.strip()) for m in heap_sizes.split(',')]
    collector_list = [c.strip().upper() for c in collectors.split(',')]
    
    base_heap = analysis_data.get('memory_summary', {}).get('heap_max_gb', 4)
    base_heap_bytes = int(base_heap * (1024**3))
    
    simulator = GCCollectorSimulator()
    
    click.echo("\n" + "=" * 60)
    click.echo("GC Configuration Comparison")
    click.echo("=" * 60)
    click.echo(f"\nBase Heap Size: {base_heap}GB")
    click.echo(f"Target Max Pause: {max_pause}ms")
    click.echo(f"Heap Multipliers: {heap_multipliers}")
    click.echo(f"Collectors: {collector_list}")
    
    all_results = []
    
    for collector in collector_list:
        click.echo(f"\n--- {collector} GC ---")
        
        for mult in heap_multipliers:
            heap_bytes = int(base_heap_bytes * mult)
            heap_gb = round(heap_bytes / (1024**3), 2)
            
            try:
                if collector == 'G1':
                    result = simulator.simulate_g1(heap_bytes, max_pause_millis=max_pause)
                elif collector == 'ZGC':
                    result = simulator.simulate_zgc(heap_bytes, max_pause_millis=max_pause)
                elif collector == 'SHENANDOAH':
                    result = simulator.simulate_shenandoah(heap_bytes, max_pause_millis=max_pause)
                elif collector == 'PARALLEL':
                    result = simulator.simulate_parallel(heap_bytes)
                else:
                    continue
                
                result.parameters['heap_multiplier'] = mult
                all_results.append(result)
                
                slo_status = "SLO VIOLATION" if result.is_slo_violation_expected else "OK"
                slo_color = 'red' if result.is_slo_violation_expected else 'green'
                
                click.echo(f"\n  Heap: {heap_gb}GB ({mult}x)")
                click.echo(f"    P50: {result.simulated_pause_ms_p50:.2f}ms")
                click.echo(f"    P95: {result.simulated_pause_ms_p95:.2f}ms")
                click.echo(f"    P99: {result.simulated_pause_ms_p99:.2f}ms")
                click.echo(f"    Max: {result.simulated_max_pause_ms:.2f}ms")
                click.echo(f"    Throughput: {result.simulated_throughput:.2f}%")
                click.echo(f"    Heap Usage: {result.simulated_heap_usage_percent:.2f}%")
                click.echo(f"    Full GC Expected: {result.expected_full_gc_count}")
                click.secho(f"    SLO Status: {slo_status}", fg=slo_color)
                
            except Exception as e:
                click.echo(f"    Error simulating {collector} with {heap_gb}GB: {e}")
    
    click.echo("\n" + "=" * 60)
    click.echo("Summary: Best Configuration")
    click.echo("=" * 60)
    
    if all_results:
        valid_results = [r for r in all_results if not r.is_slo_violation_expected]
        
        if valid_results:
            best_by_pause = sorted(valid_results, key=lambda r: r.simulated_max_pause_ms)[0]
            best_by_throughput = sorted(valid_results, key=lambda r: r.simulated_throughput, reverse=True)[0]
            
            click.echo(f"\nBest by Pause Time:")
            click.echo(f"  {best_by_pause.scenario_name}")
            click.echo(f"  Max Pause: {best_by_pause.simulated_max_pause_ms:.2f}ms")
            click.echo(f"  Throughput: {best_by_pause.simulated_throughput:.2f}%")
            
            click.echo(f"\nBest by Throughput:")
            click.echo(f"  {best_by_throughput.scenario_name}")
            click.echo(f"  Throughput: {best_by_throughput.simulated_throughput:.2f}%")
            click.echo(f"  Max Pause: {best_by_throughput.simulated_max_pause_ms:.2f}ms")
        else:
            echo_warning("No configurations meet SLO requirements. Consider increasing heap size.")
    
    if save and all_results:
        comparison_data = {
            "base_heap_gb": base_heap,
            "target_max_pause_ms": max_pause,
            "heap_multipliers": heap_multipliers,
            "collectors": collector_list,
            "results": [r.to_dict() for r in all_results]
        }
        saved_path = ws.save_comparison_result(comparison_data, session)
        echo_success(f"\nComparison saved to: {saved_path}")


@cli.command()
@click.option('--session', '-s', help='Session to export from')
@click.option('--format', '-f', 'fmt', type=click.Choice(['markdown', 'json', 'csv']), 
              default='markdown', help='Output format (default: markdown)')
@click.option('--output', '-o', type=click.Path(), help='Output file path')
@click.option('--include-analysis/--no-analysis', default=True, help='Include analysis')
@click.option('--include-tuning/--no-tuning', default=True, help='Include tuning')
@click.option('--include-comparison/--no-comparison', default=True, help='Include comparison')
@click.pass_context
def export(ctx, session, fmt, output, include_analysis, include_tuning, include_comparison):
    """Export analysis and tuning reports.
    
    Supported formats:
    - markdown: Human-readable report
    - json: Structured data for further processing
    - csv: Tabular data for spreadsheets
    """
    ws = ctx.obj['workspace']
    
    if not ws.is_initialized():
        echo_error("Workspace not initialized.")
        return
    
    analysis_data = None
    tuning_data = None
    comparison_data = None
    
    if include_analysis:
        analysis_data = ws.get_latest_analysis(session)
        if analysis_data:
            echo_info(f"Found analysis result")
    
    if include_tuning:
        tuning_data = ws.get_latest_tuning(session)
        if tuning_data:
            echo_info(f"Found tuning result")
    
    session_dir = ws.get_session_dir(session)
    if session_dir and include_comparison:
        comparisons_dir = session_dir / "comparisons"
        if comparisons_dir.exists():
            json_files = sorted(comparisons_dir.glob("comparison_*.json"), reverse=True)
            if json_files:
                import json
                with open(json_files[0], 'r', encoding='utf-8') as f:
                    comparison_data = json.load(f)
                echo_info(f"Found comparison result")
    
    if not any([analysis_data, tuning_data, comparison_data]):
        echo_error("No data to export. Run 'analyze', 'tune', or 'compare' first.")
        return
    
    if fmt == 'json':
        export_content = _export_json(analysis_data, tuning_data, comparison_data)
        default_ext = '.json'
    elif fmt == 'csv':
        export_content = _export_csv(analysis_data, tuning_data, comparison_data)
        default_ext = '.csv'
    else:
        export_content = _export_markdown(analysis_data, tuning_data, comparison_data)
        default_ext = '.md'
    
    if output:
        output_path = Path(output)
    else:
        timestamp = __import__('datetime').datetime.now().strftime('%Y%m%d_%H%M%S')
        output_path = Path(f"jvm_tune_report_{timestamp}{default_ext}")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(export_content)
    
    echo_success(f"Report exported to: {output_path}")


def _export_json(analysis, tuning, comparison) -> str:
    from datetime import datetime
    
    export_data = {
        "exported_at": datetime.now().isoformat(),
        "version": "0.1.0"
    }
    
    if analysis:
        export_data["analysis"] = analysis
    
    if tuning:
        export_data["tuning"] = tuning
    
    if comparison:
        export_data["comparison"] = comparison
    
    return json.dumps(export_data, indent=2, default=str)


def _export_csv(analysis, tuning, comparison) -> str:
    import csv
    import io
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(["JVM Tune Report", "Generated at", __import__('datetime').datetime.now().isoformat()])
    writer.writerow([])
    
    if analysis:
        writer.writerow(["=== Analysis Summary ==="])
        writer.writerow(["Metric", "Value"])
        
        summary = analysis.get('summary', {})
        writer.writerow(["Overall Health", summary.get('overall_health', 'N/A')])
        
        gc_summary = summary.get('gc_summary', {})
        writer.writerow(["Total GC Count", gc_summary.get('total_gc_count', 0)])
        writer.writerow(["Full GC Count", gc_summary.get('full_gc_count', 0)])
        writer.writerow(["Max Pause (ms)", gc_summary.get('max_pause_ms', 0)])
        writer.writerow(["GC Overhead (%)", gc_summary.get('gc_overhead_percent', 0)])
        
        risk_summary = summary.get('risk_summary', {})
        writer.writerow(["Critical Risks", risk_summary.get('critical', 0)])
        writer.writerow(["High Risks", risk_summary.get('high', 0)])
        writer.writerow(["Medium Risks", risk_summary.get('medium', 0)])
        
        writer.writerow([])
        writer.writerow(["=== Risk Factors ==="])
        writer.writerow(["Level", "Title", "Description", "Count"])
        
        risks = analysis.get('risk_factors', [])
        for risk in risks:
            writer.writerow([
                risk.get('level', 'N/A'),
                risk.get('title', 'N/A'),
                risk.get('description', 'N/A'),
                risk.get('count', 0)
            ])
    
    if tuning:
        writer.writerow([])
        writer.writerow(["=== Tuning Recommendations ==="])
        writer.writerow(["Priority", "Risk Level", "Title", "Current", "Recommended"])
        
        recs = tuning.get('recommendations', [])
        for rec in recs:
            writer.writerow([
                rec.get('priority', 0),
                rec.get('risk_level', 'N/A'),
                rec.get('title', 'N/A'),
                rec.get('current_config', 'N/A'),
                rec.get('recommended_config', 'N/A')
            ])
    
    return output.getvalue()


def _export_markdown(analysis, tuning, comparison) -> str:
    from datetime import datetime
    
    lines = []
    lines.append("# JVM Tuning Analysis Report")
    lines.append(f"\nGenerated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("\n---")
    
    if analysis:
        summary = analysis.get('summary', {})
        
        lines.append("\n## 1. Executive Summary")
        lines.append(f"\n**Overall Health:** {summary.get('overall_health', 'N/A')}")
        
        risk_summary = summary.get('risk_summary', {})
        lines.append(f"\n**Risk Summary:**")
        lines.append(f"- Critical: {risk_summary.get('critical', 0)}")
        lines.append(f"- High: {risk_summary.get('high', 0)}")
        lines.append(f"- Medium: {risk_summary.get('medium', 0)}")
        lines.append(f"- Low: {risk_summary.get('low', 0)}")
        
        gc_summary = summary.get('gc_summary', {})
        mem_summary = summary.get('memory_summary', {})
        
        lines.append("\n**GC Summary:**")
        lines.append(f"- Total GC Events: {gc_summary.get('total_gc_count', 0)}")
        lines.append(f"- Full GC Count: {gc_summary.get('full_gc_count', 0)}")
        lines.append(f"- Max Pause: {gc_summary.get('max_pause_ms', 0)}ms")
        lines.append(f"- GC Overhead: {gc_summary.get('gc_overhead_percent', 0)}%")
        
        lines.append("\n**Memory Summary:**")
        lines.append(f"- Heap Max: {mem_summary.get('heap_max_gb', 0)}GB")
        lines.append(f"- Container Limit: {mem_summary.get('container_limit_gb', 0)}GB")
        lines.append(f"- OOM Risk: {mem_summary.get('oom_risk_percent', 0)}%")
        
        actions = summary.get('recommended_actions', [])
        if actions:
            lines.append("\n**Recommended Actions:**")
            for i, action in enumerate(actions, 1):
                lines.append(f"{i}. {action}")
        
        risks = analysis.get('risk_factors', [])
        if risks:
            lines.append("\n## 2. Risk Factors")
            
            for risk in risks:
                level = risk.get('level', 'N/A')
                level_md = f"**{level}**"
                if level == 'Critical':
                    level_md = f"🔴 **{level}**"
                elif level == 'High':
                    level_md = f"🟡 **{level}**"
                elif level == 'Medium':
                    level_md = f"🔵 **{level}**"
                
                lines.append(f"\n### {level_md}: {risk.get('title', 'N/A')}")
                lines.append(f"\n- **Description:** {risk.get('description', 'N/A')}")
                lines.append(f"- **Evidence:** {risk.get('evidence', 'N/A')}")
                lines.append(f"- **Count:** {risk.get('count', 0)}")
        
        param_conflicts = analysis.get('parameter_conflicts', [])
        if param_conflicts:
            lines.append("\n## 3. Parameter Conflicts")
            for conflict in param_conflicts:
                lines.append(f"\n- **{conflict.get('parameter1', 'N/A')}** vs **{conflict.get('parameter2', 'N/A')}**")
                lines.append(f"  - Conflict: {conflict.get('conflict', 'N/A')}")
                lines.append(f"  - Recommendation: {conflict.get('recommendation', 'N/A')}")
    
    if tuning:
        lines.append("\n## 4. Tuning Recommendations")
        
        tuning_summary = tuning.get('summary', {})
        lines.append(f"\n**Overall Status:** {tuning_summary.get('overall_status', 'N/A')}")
        
        recs = tuning.get('recommendations', [])
        if recs:
            lines.append("\n### Detailed Recommendations")
            
            for rec in recs:
                level = rec.get('risk_level', 'N/A')
                priority = rec.get('priority', 0)
                
                level_icon = "🔴" if level == 'Critical' else "🟡" if level == 'High' else "🔵"
                
                lines.append(f"\n#### {level_icon} [P{priority}] {rec.get('title', 'N/A')}")
                lines.append(f"\n- **Risk Level:** {level}")
                lines.append(f"- **Description:** {rec.get('description', 'N/A')}")
                lines.append(f"- **Root Cause:** {rec.get('root_cause', 'N/A')}")
                lines.append(f"- **Impact:** {rec.get('impact', 'N/A')}")
                lines.append(f"- **Current Config:** {rec.get('current_config', 'N/A')}")
                lines.append(f"- **Recommended Config:** {rec.get('recommended_config', 'N/A')}")
                
                params = rec.get('parameters', [])
                if params:
                    lines.append(f"\n  **Parameters:**")
                    for p in params:
                        change = " [CHANGE]" if p.get('needs_change') else ""
                        lines.append(f"  - {p.get('name', 'N/A')}: {p.get('current_value')} → {p.get('recommended_value')}{change}")
        
        container_reserve = tuning.get('container_memory_reserve_recommendation')
        if container_reserve:
            lines.append("\n### Container Memory Reserve")
            lines.append(f"\n- **Container Limit:** {container_reserve.get('container_limit_gb', 0)}GB")
            lines.append(f"- **Current Heap:** {container_reserve.get('current_heap_gb', 0)}GB")
            lines.append(f"- **Current Reserve:** {container_reserve.get('current_reserve_percent', 0)}%")
            lines.append(f"- **Recommended Heap:** {container_reserve.get('recommended_heap_gb', 0)}GB")
            lines.append(f"- **Minimum Reserve:** {container_reserve.get('min_reserve_percent', 0)}%")
        
        rec_opts = tuning.get('recommended_jvm_options', {})
        if rec_opts:
            lines.append("\n### Recommended JVM Options")
            lines.append(f"\n```")
            lines.append(f"-XX:+Use{rec_opts.get('gc_collector', 'G1')}GC")
            if rec_opts.get('xmx_gb'):
                lines.append(f"-Xms{rec_opts['xmx_gb']}g -Xmx{rec_opts['xmx_gb']}g")
            if rec_opts.get('max_gc_pause_millis'):
                lines.append(f"-XX:MaxGCPauseMillis={rec_opts['max_gc_pause_millis']}")
            if rec_opts.get('g1_heap_region_size_mb'):
                lines.append(f"-XX:G1HeapRegionSize={rec_opts['g1_heap_region_size_mb']}m")
            lines.append(f"```")
    
    if comparison:
        lines.append("\n## 5. GC Configuration Comparison")
        
        lines.append(f"\n- **Base Heap:** {comparison.get('base_heap_gb', 0)}GB")
        lines.append(f"- **Target Max Pause:** {comparison.get('target_max_pause_ms', 200)}ms")
        
        results = comparison.get('results', [])
        if results:
            lines.append("\n| Collector | Heap (GB) | P50 (ms) | P99 (ms) | Max (ms) | Throughput (%) | SLO |")
            lines.append("|-----------|-----------|----------|----------|----------|----------------|-----|")
            
            for r in results:
                slo_status = "❌" if r.get('is_slo_violation_expected') else "✓"
                params = r.get('parameters', {})
                heap_gb = params.get('heap_size_gb', r.get('parameters', {}).get('heap_size_gb', 0))
                
                lines.append(
                    f"| {r.get('target_gc_collector', 'N/A')} | "
                    f"{heap_gb} | "
                    f"{r.get('simulated_pause_ms_p50', 0):.2f} | "
                    f"{r.get('simulated_pause_ms_p99', 0):.2f} | "
                    f"{r.get('simulated_max_pause_ms', 0):.2f} | "
                    f"{r.get('simulated_throughput', 0):.2f} | "
                    f"{slo_status} |"
                )
    
    lines.append("\n---")
    lines.append(f"\n*Report generated by JVM Tune CLI v0.1.0*")
    
    return '\n'.join(lines)


def main():
    cli()


if __name__ == '__main__':
    main()
