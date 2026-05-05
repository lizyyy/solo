#!/usr/bin/env python3
"""analyze 命令：分析项目中的迭代器坑点。"""

import sys
from pathlib import Path
from typing import List

from ..core.analyzer import FullAnalyzer
from ..core.database import Database
from ..core.models import AnalysisResult, Finding, Severity
from ..core.parser import EventParser, PipelineParser, PythonParser, ParseError


def analyze_command(args) -> int:
    """执行 analyze 命令。"""
    db_path = Path(args.db)
    pipelines_path = Path(args.pipelines)
    events_path = Path(args.events)
    snippets_dir = Path(args.snippets)

    print(f"分析配置:")
    print(f"  数据库: {db_path}")
    print(f"  pipelines.yaml: {pipelines_path}")
    print(f"  events.jsonl: {events_path}")
    print(f"  snippets 目录: {snippets_dir}")
    print()

    try:
        result = perform_analysis(
            pipelines_path=pipelines_path,
            events_path=events_path,
            snippets_dir=snippets_dir,
            name=args.name,
            verbose=args.verbose,
        )
    except ParseError as e:
        print(f"\n❌ 解析错误: {e.message}")
        if e.file_path:
            print(f"   文件: {e.file_path}")
        if e.line:
            print(f"   行号: {e.line}")
        print("\n提示: 请检查文件格式是否正确，或使用 'pitfall init' 创建示例项目")
        return 1
    except FileNotFoundError as e:
        print(f"\n❌ 文件不存在: {e}")
        print("\n提示: 请确保文件路径正确，或先运行 'pitfall init' 创建示例项目")
        return 1
    except Exception as e:
        if args.verbose:
            import traceback
            traceback.print_exc()
        print(f"\n❌ 分析失败: {e}")
        return 1

    print("\n💾 保存分析结果到数据库...")
    db = Database(db_path)
    analysis_id = db.save_analysis(result)

    print(f"\n✅ 分析完成！")
    print(f"   分析 ID: {analysis_id}")
    if result.name:
        print(f"   名称: {result.name}")

    summary = result.summary
    print(f"\n📊 摘要:")
    print(f"   总问题数: {summary.get('total_findings', 0)}")
    print(f"   分析文件: {summary.get('files_analyzed', 0)} 个")

    findings_by_severity = summary.get('findings_by_severity', {})
    if findings_by_severity:
        print(f"\n   按严重程度分布:")
        for severity in [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO]:
            count = findings_by_severity.get(severity.value, 0)
            if count > 0:
                emoji = get_severity_emoji(severity)
                print(f"   {emoji} {severity.value.upper()}: {count}")

    print("\n💡 下一步:")
    print(f"   - 查看详细报告: pitfall export --analysis-id {analysis_id}")
    print(f"   - 对比两次分析: pitfall compare <id1> <id2>")

    return 0


def perform_analysis(
    pipelines_path: Path,
    events_path: Path,
    snippets_dir: Path,
    name: str = None,
    verbose: bool = False,
) -> AnalysisResult:
    """执行完整分析。"""
    result = AnalysisResult(name=name)

    if pipelines_path.exists():
        if verbose:
            print(f"📄 解析 pipelines.yaml...")
        pipeline_parser = PipelineParser()
        result.pipelines = pipeline_parser.parse(pipelines_path)
        if verbose:
            print(f"   找到 {len(result.pipelines)} 个流水线")
    else:
        if verbose:
            print(f"⚠️  pipelines.yaml 不存在，跳过")

    if events_path.exists():
        if verbose:
            print(f"📄 解析 events.jsonl...")
        event_parser = EventParser()
        result.events = event_parser.parse(events_path)
        if verbose:
            print(f"   找到 {len(result.events)} 个事件")
    else:
        if verbose:
            print(f"⚠️  events.jsonl 不存在，跳过")

    if snippets_dir.exists() and snippets_dir.is_dir():
        if verbose:
            print(f"📁 分析 snippets 目录...")

        python_parser = PythonParser()
        analyzer = FullAnalyzer()

        py_files = sorted(snippets_dir.glob("*.py"))
        for py_file in py_files:
            if verbose:
                print(f"   分析 {py_file.name}...")

            try:
                parsed = python_parser.parse_file(py_file)
                snippet = analyzer.analyze_code_snippet(parsed)
                result.code_snippets.append(snippet)

                if verbose and snippet.findings:
                    for finding in snippet.findings:
                        emoji = get_severity_emoji(finding.severity)
                        line_info = f" 第{finding.location.line_number}行" if finding.location and finding.location.line_number else ""
                        print(f"      {emoji} {finding.title}{line_info}")
            except ParseError as e:
                print(f"   ⚠️  跳过 {py_file.name}: {e.message}")
                continue

        if verbose:
            print(f"   分析了 {len(result.code_snippets)} 个 Python 文件")
    else:
        if verbose:
            print(f"⚠️  snippets 目录不存在，跳过")

    result.compute_summary()
    return result


def get_severity_emoji(severity: Severity) -> str:
    """获取严重程度对应的 emoji。"""
    mapping = {
        Severity.CRITICAL: "🔴",
        Severity.HIGH: "🟠",
        Severity.MEDIUM: "🟡",
        Severity.LOW: "🟢",
        Severity.INFO: "ℹ️",
    }
    return mapping.get(severity, "❓")
