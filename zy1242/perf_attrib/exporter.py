"""
exporter 模块 - 导出分析报告为 Markdown/JSON
"""

import json
import os
from typing import Dict, List, Any, Optional
from datetime import datetime

from perf_attrib.errors import AnalysisNotFoundError, ExportError
from perf_attrib.database import (
    get_session, Analysis, FunctionProfile, SampleProfile, 
    BenchmarkResult, Hotspot, Suggestion, SourceSnippet
)


def export_analysis(
    analysis_id: int,
    export_format: str = "markdown",
    output_path: Optional[str] = None,
    include_code: bool = True,
    include_suggestions: bool = True,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    导出分析报告
    
    Args:
        analysis_id: 分析记录 ID
        export_format: 导出格式: markdown, json
        output_path: 输出文件路径
        include_code: 是否包含源码片段
        include_suggestions: 是否包含优化建议
        db_path: 数据库路径
    
    Returns:
        导出结果字典
    """
    session = get_session(db_path=db_path)
    
    try:
        analysis = session.query(Analysis).filter(Analysis.id == analysis_id).first()
        
        if not analysis:
            raise AnalysisNotFoundError(analysis_id=analysis_id)
        
        data = _collect_export_data(
            session, analysis, include_code, include_suggestions
        )
        
        if export_format == "json":
            content = _generate_json_report(data)
        elif export_format == "markdown":
            content = _generate_markdown_report(data)
        else:
            raise ExportError(
                message=f"不支持的导出格式: {export_format}",
                export_format=export_format
            )
        
        final_output_path = None
        if output_path:
            try:
                with open(output_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                final_output_path = output_path
            except IOError as e:
                raise ExportError(
                    message=f"写入文件失败: {str(e)}",
                    export_format=export_format,
                    output_path=output_path
                )
        
        return {
            "analysis_id": analysis_id,
            "format": export_format,
            "output_path": final_output_path,
            "content": content
        }
        
    except AnalysisNotFoundError:
        raise
    except ExportError:
        raise
    except Exception as e:
        raise ExportError(
            message=f"导出失败: {str(e)}",
            export_format=export_format,
            output_path=output_path
        )
    finally:
        session.close()


def _collect_export_data(
    session,
    analysis: Analysis,
    include_code: bool,
    include_suggestions: bool
) -> Dict[str, Any]:
    """
    收集导出数据
    """
    data = {
        "metadata": {
            "id": analysis.id,
            "name": analysis.name,
            "timestamp": analysis.timestamp.isoformat() if analysis.timestamp else None,
            "version": analysis.version,
            "command": analysis.command,
            "notes": analysis.notes,
            "exported_at": datetime.now().isoformat()
        },
        "summary": {},
        "hotspots": [],
        "suggestions": [],
        "source_snippets": [],
        "function_profiles": [],
        "benchmark_results": [],
        "sample_profiles": []
    }
    
    func_profiles = session.query(FunctionProfile).filter(
        FunctionProfile.analysis_id == analysis.id
    ).order_by(FunctionProfile.cumtime.desc()).all()
    
    if func_profiles:
        data["summary"]["total_functions"] = len(func_profiles)
        data["summary"]["total_calls"] = sum(fp.ncalls for fp in func_profiles)
        data["summary"]["total_time"] = sum(fp.tottime for fp in func_profiles)
        
        for fp in func_profiles[:20]:
            data["function_profiles"].append({
                "filename": fp.filename,
                "lineno": fp.lineno,
                "function": fp.function,
                "ncalls": fp.ncalls,
                "tottime": fp.tottime,
                "percall_tottime": fp.percall_tottime,
                "cumtime": fp.cumtime,
                "percall_cumtime": fp.percall_cumtime
            })
    
    sample_profiles = session.query(SampleProfile).filter(
        SampleProfile.analysis_id == analysis.id
    ).order_by(SampleProfile.percentage.desc()).all()
    
    if sample_profiles:
        data["summary"]["total_samples"] = sum(sp.samples for sp in sample_profiles)
        
        for sp in sample_profiles[:20]:
            data["sample_profiles"].append({
                "filename": sp.filename,
                "lineno": sp.lineno,
                "function": sp.function,
                "samples": sp.samples,
                "percentage": sp.percentage,
                "sample_type": sp.sample_type
            })
    
    bench_results = session.query(BenchmarkResult).filter(
        BenchmarkResult.analysis_id == analysis.id
    ).order_by(BenchmarkResult.mean_time.desc()).all()
    
    if bench_results:
        data["summary"]["total_benchmarks"] = len(bench_results)
        
        for br in bench_results:
            data["benchmark_results"].append({
                "name": br.name,
                "source": br.source,
                "min_time": br.min_time,
                "max_time": br.max_time,
                "mean_time": br.mean_time,
                "median_time": br.median_time,
                "std_time": br.std_time,
                "iterations": br.iterations,
                "rounds": br.rounds
            })
    
    hotspots = session.query(Hotspot).filter(
        Hotspot.analysis_id == analysis.id
    ).order_by(Hotspot.score.desc()).all()
    
    for hs in hotspots:
        data["hotspots"].append({
            "type": hs.hotspot_type,
            "filename": hs.filename,
            "lineno": hs.lineno,
            "function": hs.function,
            "score": hs.score,
            "severity": hs.severity,
            "description": hs.description
        })
    
    if include_suggestions:
        suggestions = session.query(Suggestion).filter(
            Suggestion.analysis_id == analysis.id
        ).all()
        
        for sg in suggestions:
            data["suggestions"].append({
                "category": sg.category,
                "priority": sg.priority,
                "title": sg.title,
                "description": sg.description,
                "before_code": sg.before_code,
                "after_code": sg.after_code,
                "expected_improvement": sg.expected_improvement
            })
    
    if include_code:
        snippets = session.query(SourceSnippet).filter(
            SourceSnippet.analysis_id == analysis.id
        ).all()
        
        for ss in snippets:
            data["source_snippets"].append({
                "filename": ss.filename,
                "start_line": ss.start_line,
                "end_line": ss.end_line,
                "code": ss.code,
                "highlight_lines": ss.highlight_lines
            })
    
    return data


def _generate_json_report(data: Dict[str, Any]) -> str:
    """
    生成 JSON 报告
    """
    return json.dumps(data, indent=2, ensure_ascii=False)


def _generate_markdown_report(data: Dict[str, Any]) -> str:
    """
    生成 Markdown 报告
    """
    metadata = data["metadata"]
    summary = data["summary"]
    
    lines = []
    
    lines.append(f"# 性能分析报告: {metadata['name'] or '未命名'}")
    lines.append("")
    
    lines.append("## 元数据")
    lines.append("")
    lines.append("| 字段 | 值 |")
    lines.append("|------|-----|")
    lines.append(f"| 分析 ID | {metadata['id']} |")
    lines.append(f"| 名称 | {metadata['name'] or '-'} |")
    lines.append(f"| 时间 | {metadata['timestamp'] or '-'} |")
    lines.append(f"| 版本 | {metadata['version'] or '-'} |")
    lines.append(f"| 命令 | {metadata['command'] or '-'} |")
    if metadata['notes']:
        lines.append(f"| 备注 | {metadata['notes']} |")
    lines.append("")
    
    if summary:
        lines.append("## 概览")
        lines.append("")
        
        if "total_functions" in summary:
            lines.append(f"- **总函数数**: {summary['total_functions']}")
        if "total_calls" in summary:
            lines.append(f"- **总调用次数**: {summary['total_calls']}")
        if "total_time" in summary:
            lines.append(f"- **总耗时**: {summary['total_time']:.4f} 秒")
        if "total_benchmarks" in summary:
            lines.append(f"- **Benchmark 数量**: {summary['total_benchmarks']}")
        lines.append("")
    
    if data["hotspots"]:
        lines.append("## 🔥 热点函数")
        lines.append("")
        lines.append("| 排名 | 函数 | 类型 | 评分 | 严重程度 | 描述 |")
        lines.append("|------|------|------|------|----------|------|")
        
        for i, hs in enumerate(data["hotspots"][:10], 1):
            severity_emoji = "🔴" if hs["severity"] == "high" else "🟡" if hs["severity"] == "medium" else "🟢"
            lines.append(
                f"| {i} | {hs['function']} | {hs['type']} | {hs['score']:.1f} | "
                f"{severity_emoji} {hs['severity']} | {hs['description'] or '-'} |"
            )
        lines.append("")
    
    if data["function_profiles"]:
        lines.append("## 📊 函数性能 (Top 10)")
        lines.append("")
        lines.append("| 函数 | 调用次数 | 自耗时 (秒) | 累计耗时 (秒) | 单次耗时 (秒) |")
        lines.append("|------|----------|-------------|---------------|---------------|")
        
        for fp in data["function_profiles"][:10]:
            lines.append(
                f"| {fp['function']} | {fp['ncalls']:,} | {fp['tottime']:.4f} | "
                f"{fp['cumtime']:.4f} | {fp['percall_tottime']:.6f} |"
            )
        lines.append("")
    
    if data["sample_profiles"]:
        lines.append("## 📈 采样分析 (Top 10)")
        lines.append("")
        lines.append("| 函数 | 采样数 | 占比 | 类型 |")
        lines.append("|------|--------|------|------|")
        
        for sp in data["sample_profiles"][:10]:
            lines.append(
                f"| {sp['function']} | {sp['samples']:,} | {sp['percentage']:.1f}% | {sp['sample_type']} |"
            )
        lines.append("")
    
    if data["benchmark_results"]:
        lines.append("## ⏱️ Benchmark 结果")
        lines.append("")
        lines.append("| 名称 | 最小值 (秒) | 最大值 (秒) | 平均值 (秒) | 中位数 (秒) | 标准差 |")
        lines.append("|------|-------------|-------------|-------------|-------------|--------|")
        
        for br in data["benchmark_results"]:
            lines.append(
                f"| {br['name']} | {br['min_time'] or '-':.6f} | {br['max_time'] or '-':.6f} | "
                f"{br['mean_time'] or '-':.6f} | {br['median_time'] or '-':.6f} | {br['std_time'] or '-':.6f} |"
            )
        lines.append("")
    
    if data["suggestions"]:
        lines.append("## 💡 优化建议")
        lines.append("")
        
        for i, sg in enumerate(data["suggestions"], 1):
            priority_emoji = "🔴" if sg["priority"] == "high" else "🟡" if sg["priority"] == "medium" else "🟢"
            
            lines.append(f"### {i}. {priority_emoji} [{sg['category']}] {sg['title']}")
            lines.append("")
            lines.append(f"**优先级**: {sg['priority']}")
            lines.append("")
            lines.append(sg['description'])
            lines.append("")
            
            if sg.get("before_code") or sg.get("after_code"):
                lines.append("#### 代码示例")
                lines.append("")
                
                if sg.get("before_code"):
                    lines.append("**优化前:**")
                    lines.append("")
                    lines.append("```python")
                    lines.append(sg["before_code"].strip())
                    lines.append("```")
                    lines.append("")
                
                if sg.get("after_code"):
                    lines.append("**优化后:**")
                    lines.append("")
                    lines.append("```python")
                    lines.append(sg["after_code"].strip())
                    lines.append("```")
                    lines.append("")
            
            if sg.get("expected_improvement"):
                lines.append(f"**预期改进**: {sg['expected_improvement']}")
                lines.append("")
    
    if data["source_snippets"]:
        lines.append("## 📝 源码片段")
        lines.append("")
        
        for i, ss in enumerate(data["source_snippets"], 1):
            lines.append(f"### {i}. {ss['filename']}")
            lines.append(f"*行 {ss['start_line']} - {ss['end_line']}*")
            lines.append("")
            lines.append("```python")
            
            code_lines = ss["code"].rstrip().split("\n")
            highlight_lines = ss.get("highlight_lines") or []
            
            for line_num, line in enumerate(code_lines, 1):
                if line_num in highlight_lines:
                    lines.append(f"> {line}")
                else:
                    lines.append(line)
            
            lines.append("```")
            lines.append("")
    
    lines.append("---")
    lines.append("")
    lines.append(f"*报告生成时间: {metadata['exported_at']}*")
    lines.append("")
    
    return "\n".join(lines)


def export_comparison(
    comparison_data: Dict[str, Any],
    export_format: str = "markdown",
    output_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    导出对比报告
    
    Args:
        comparison_data: 对比数据
        export_format: 导出格式
        output_path: 输出路径
    
    Returns:
        导出结果
    """
    if export_format == "json":
        content = json.dumps(comparison_data, indent=2, ensure_ascii=False)
    elif export_format == "markdown":
        content = _generate_comparison_markdown(comparison_data)
    else:
        raise ExportError(
            message=f"不支持的导出格式: {export_format}",
            export_format=export_format
        )
    
    final_output_path = None
    if output_path:
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
            final_output_path = output_path
        except IOError as e:
            raise ExportError(
                message=f"写入文件失败: {str(e)}",
                export_format=export_format,
                output_path=output_path
            )
    
    return {
        "format": export_format,
        "output_path": final_output_path,
        "content": content
    }


def _generate_comparison_markdown(data: Dict[str, Any]) -> str:
    """
    生成对比 Markdown 报告
    """
    lines = []
    
    lines.append(f"# 性能对比报告: {data['name']}")
    lines.append("")
    
    lines.append("## 对比信息")
    lines.append("")
    lines.append("| 分析 | ID | 名称 | 时间 |")
    lines.append("|------|----|------|------|")
    lines.append(
        f"| 基准 (A) | {data['analysis_1']['id']} | {data['analysis_1']['name'] or '-'} | "
        f"{data['analysis_1']['timestamp'] or '-'} |"
    )
    lines.append(
        f"| 目标 (B) | {data['analysis_2']['id']} | {data['analysis_2']['name'] or '-'} | "
        f"{data['analysis_2']['timestamp'] or '-'} |"
    )
    lines.append("")
    
    summary = data.get("summary", {})
    if summary:
        lines.append("## 📊 总体变化")
        lines.append("")
        
        if "total_time_change" in summary:
            change = summary["total_time_change"]
            change_str = summary.get("total_time_change_str", f"{change:.1f}%")
            emoji = "✅" if change < 0 else "⚠️" if change > 0 else "➖"
            lines.append(f"- **总耗时变化**: {emoji} {change_str}")
        
        if "calls_change" in summary:
            change = summary["calls_change"]
            change_str = summary.get("calls_change_str", f"{change:.1f}%")
            emoji = "✅" if change < 0 else "⚠️" if change > 0 else "➖"
            lines.append(f"- **调用次数变化**: {emoji} {change_str}")
        
        lines.append("")
    
    improvements = data.get("improvements", [])
    if improvements:
        lines.append(f"## ✅ 改进 ({len(improvements)} 项)")
        lines.append("")
        lines.append("| 函数 | 类型 | 变化 | 改进幅度 |")
        lines.append("|------|------|------|----------|")
        
        for imp in improvements[:15]:
            lines.append(
                f"| {imp['function']} | {imp['type']} | {imp['change_str']} | "
                f"{imp.get('improvement', 0):.1f}% |"
            )
        lines.append("")
    
    regressions = data.get("regressions", [])
    if regressions:
        lines.append(f"## ⚠️ 回归 ({len(regressions)} 项)")
        lines.append("")
        lines.append("| 函数 | 类型 | 变化 | 回归幅度 |")
        lines.append("|------|------|------|----------|")
        
        for reg in regressions[:15]:
            lines.append(
                f"| {reg['function']} | {reg['type']} | {reg['change_str']} | "
                f"{reg.get('regression', 0):.1f}% |"
            )
        lines.append("")
    
    unchanged = data.get("unchanged", [])
    if unchanged:
        lines.append(f"## ➖ 无显著变化 ({len(unchanged)} 项)")
        lines.append("")
    
    lines.append("---")
    lines.append("")
    lines.append(f"*报告生成时间: {data['timestamp']}*")
    lines.append("")
    
    return "\n".join(lines)
