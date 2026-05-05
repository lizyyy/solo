"""
analyzer 模块 - 核心分析逻辑
支持读取多种性能数据格式并进行分析
"""

import os
import re
import json
import pstats
import marshal
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

from perf_attrib.errors import FileFormatError, MissingDataError, AnalysisNotFoundError
from perf_attrib.database import (
    get_session, Analysis, FunctionProfile, SampleProfile, 
    BenchmarkResult, IOCall, MemoryAllocation, Hotspot, 
    Suggestion, SourceSnippet
)
from perf_attrib.engine import (
    analyze_cpu_hotspots, analyze_function_fanout, 
    analyze_io_patterns, analyze_memory_patterns,
    detect_regressions
)


def detect_data_type(file_path: str) -> str:
    """
    根据文件内容自动检测数据类型
    
    Args:
        file_path: 文件路径
    
    Returns:
        数据类型: cprofile, pystats, benchmark, timeit
    """
    if file_path.endswith('.prof'):
        try:
            p = pstats.Stats(file_path)
            return "cprofile"
        except Exception:
            pass
    
    if file_path.endswith('.json'):
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            if "benchmarks" in data and "stats" in data.get("benchmarks", [{}])[0]:
                return "benchmark"
            
            if "samples" in data or "by_function" in data:
                return "pystats"
            
            if "sampler" in data.get("metadata", {}):
                return "pystats"
            
        except (json.JSONDecodeError, IndexError):
            pass
    
    if file_path.endswith('.txt'):
        try:
            with open(file_path, 'r') as f:
                content = f.read()
            
            if "Ordered by:" in content and "ncalls  tottime" in content:
                return "cprofile"
            
            if "loops, best of" in content or "msec per loop" in content:
                return "timeit"
                
        except Exception:
            pass
    
    try:
        with open(file_path, 'rb') as f:
            try:
                magic = marshal.load(f)
                return "cprofile"
            except Exception:
                pass
    except Exception:
        pass
    
    return "cprofile"


def analyze_file(
    input_file: str,
    data_type: str,
    name: Optional[str] = None,
    notes: Optional[str] = None,
    source_path: Optional[str] = None,
    baseline_id: Optional[int] = None,
    save_to_db: bool = True,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    分析性能数据文件
    
    Args:
        input_file: 输入文件路径
        data_type: 数据类型
        name: 分析名称
        notes: 分析备注
        source_path: 源码路径
        baseline_id: 基线分析 ID
        save_to_db: 是否保存到数据库
        db_path: 数据库路径
    
    Returns:
        分析结果字典
    """
    if data_type == "cprofile":
        raw_data = parse_cprofile(input_file)
    elif data_type == "pystats":
        raw_data = parse_pystats(input_file)
    elif data_type == "benchmark":
        raw_data = parse_benchmark(input_file)
    elif data_type == "timeit":
        raw_data = parse_timeit(input_file)
    else:
        raise FileFormatError(
            message=f"不支持的数据类型: {data_type}",
            file_path=input_file,
            file_type=data_type
        )
    
    analysis_result = run_analysis_pipeline(
        raw_data=raw_data,
        data_type=data_type,
        source_path=source_path,
        baseline_id=baseline_id,
        db_path=db_path
    )
    
    if save_to_db:
        analysis_id = save_analysis_to_db(
            raw_data=raw_data,
            analysis_result=analysis_result,
            name=name or f"分析_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            notes=notes,
            data_type=data_type,
            db_path=db_path
        )
        analysis_result["analysis_id"] = analysis_id
    
    return analysis_result


def parse_cprofile(file_path: str) -> Dict[str, Any]:
    """
    解析 cProfile/pstats 文件
    
    Args:
        file_path: 文件路径（二进制或文本格式）
    
    Returns:
        解析后的数据字典
    """
    is_binary = False
    try:
        with open(file_path, 'rb') as f:
            try:
                marshal.load(f)
                is_binary = True
            except Exception:
                pass
    except Exception:
        pass
    
    if is_binary:
        return _parse_binary_cprofile(file_path)
    else:
        return _parse_text_cprofile(file_path)


def _parse_binary_cprofile(file_path: str) -> Dict[str, Any]:
    """
    解析二进制 cProfile 文件
    """
    try:
        stats = pstats.Stats(file_path)
        
        functions = []
        total_time = 0.0
        total_calls = 0
        
        for func, (cc, nc, tt, ct, callers) in stats.stats.items():
            filename, lineno, function_name = func
            
            filename = str(filename) if filename else "unknown"
            lineno = int(lineno) if lineno else 0
            function_name = str(function_name) if function_name else "unknown"
            
            functions.append({
                "filename": filename,
                "lineno": lineno,
                "function": function_name,
                "ncalls": nc,
                "tottime": tt,
                "percall_tottime": tt / nc if nc > 0 else 0,
                "cumtime": ct,
                "percall_cumtime": ct / nc if nc > 0 else 0,
                "callers": list(callers.keys())
            })
            
            total_time += tt
            total_calls += nc
        
        functions.sort(key=lambda x: x["cumtime"], reverse=True)
        
        return {
            "type": "cprofile",
            "total_functions": len(functions),
            "total_calls": total_calls,
            "total_time": total_time,
            "functions": functions,
            "top_functions": functions[:20]
        }
        
    except Exception as e:
        raise FileFormatError(
            message=f"无法解析 cProfile 二进制文件: {str(e)}",
            file_path=file_path,
            file_type="cprofile"
        )


def _parse_text_cprofile(file_path: str) -> Dict[str, Any]:
    """
    解析文本格式的 cProfile 输出
    """
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        header_match = re.search(
            r'(\d+)\s+function calls?\s+\((\d+)\s+primitive calls?\)\s+in\s+([\d.]+)\s+seconds',
            content
        )
        
        total_calls = 0
        primitive_calls = 0
        total_time = 0.0
        
        if header_match:
            total_calls = int(header_match.group(1))
            primitive_calls = int(header_match.group(2))
            total_time = float(header_match.group(3))
        
        functions = []
        
        lines = content.split('\n')
        in_stats = False
        
        for line in lines:
            if 'ncalls  tottime  percall  cumtime  percall' in line:
                in_stats = True
                continue
            
            if not in_stats:
                continue
            
            line = line.strip()
            if not line or line.startswith('Ordered by:'):
                continue
            
            parts = line.split()
            if len(parts) < 6:
                continue
            
            try:
                ncalls_str = parts[0]
                if '/' in ncalls_str:
                    ncalls = int(ncalls_str.split('/')[0])
                else:
                    ncalls = int(ncalls_str)
                
                tottime = float(parts[1])
                percall_tottime = float(parts[2])
                cumtime = float(parts[3])
                percall_cumtime = float(parts[4])
                
                func_info = ' '.join(parts[5:])
                
                filename = "unknown"
                lineno = 0
                function_name = func_info
                
                match = re.match(r'(.+):(\d+)\((.+)\)', func_info)
                if match:
                    filename = match.group(1)
                    lineno = int(match.group(2))
                    function_name = match.group(3)
                else:
                    match = re.match(r'(\{.+\})', func_info)
                    if match:
                        function_name = match.group(1)
                        filename = "builtin"
                
                functions.append({
                    "filename": filename,
                    "lineno": lineno,
                    "function": function_name,
                    "ncalls": ncalls,
                    "tottime": tottime,
                    "percall_tottime": percall_tottime,
                    "cumtime": cumtime,
                    "percall_cumtime": percall_cumtime,
                    "callers": []
                })
                
            except (ValueError, IndexError):
                continue
        
        functions.sort(key=lambda x: x["cumtime"], reverse=True)
        
        return {
            "type": "cprofile",
            "total_functions": len(functions),
            "total_calls": total_calls or sum(f["ncalls"] for f in functions),
            "primitive_calls": primitive_calls,
            "total_time": total_time or sum(f["tottime"] for f in functions),
            "functions": functions,
            "top_functions": functions[:20]
        }
        
    except Exception as e:
        raise FileFormatError(
            message=f"无法解析 cProfile 文本文件: {str(e)}",
            file_path=file_path,
            file_type="cprofile"
        )


def parse_pystats(file_path: str) -> Dict[str, Any]:
    """
    解析 py-spy JSON 输出
    
    Args:
        file_path: JSON 文件路径
    
    Returns:
        解析后的数据字典
    """
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
        
        metadata = data.get("metadata", {})
        samples = data.get("samples", [])
        by_function = data.get("by_function", [])
        
        functions = []
        
        if by_function:
            for func_data in by_function:
                functions.append({
                    "filename": func_data.get("file", "unknown"),
                    "lineno": func_data.get("line", 0),
                    "function": func_data.get("function", "unknown"),
                    "samples": func_data.get("count", 0),
                    "percentage": func_data.get("percentage", 0.0),
                    "sample_type": "cpu"
                })
        else:
            function_stats = {}
            for sample in samples:
                frames = sample.get("frames", [])
                count = sample.get("count", 1)
                
                if frames:
                    top_frame = frames[0]
                    func_key = (
                        top_frame.get("file", "unknown"),
                        top_frame.get("line", 0),
                        top_frame.get("function", "unknown")
                    )
                    
                    if func_key not in function_stats:
                        function_stats[func_key] = {
                            "filename": func_key[0],
                            "lineno": func_key[1],
                            "function": func_key[2],
                            "samples": 0,
                            "percentage": 0.0,
                            "sample_type": "cpu"
                        }
                    
                    function_stats[func_key]["samples"] += count
            
            total_samples = sum(fs["samples"] for fs in function_stats.values())
            for fs in function_stats.values():
                if total_samples > 0:
                    fs["percentage"] = (fs["samples"] / total_samples) * 100
                functions.append(fs)
        
        functions.sort(key=lambda x: x["samples"], reverse=True)
        
        return {
            "type": "pystats",
            "duration_seconds": metadata.get("duration_seconds", 0),
            "total_samples": metadata.get("sample_count", sum(f["samples"] for f in functions)),
            "functions": functions,
            "top_functions": functions[:20]
        }
        
    except json.JSONDecodeError as e:
        raise FileFormatError(
            message=f"py-spy JSON 解析失败: {str(e)}",
            file_path=file_path,
            file_type="pystats"
        )
    except Exception as e:
        raise FileFormatError(
            message=f"无法解析 py-spy 文件: {str(e)}",
            file_path=file_path,
            file_type="pystats"
        )


def parse_benchmark(file_path: str) -> Dict[str, Any]:
    """
    解析 pytest-benchmark JSON 结果
    
    Args:
        file_path: JSON 文件路径
    
    Returns:
        解析后的数据字典
    """
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
        
        benchmarks = data.get("benchmarks", [])
        machine_info = data.get("machine_info", {})
        commit_info = data.get("commit_info", {})
        
        results = []
        for bench in benchmarks:
            stats = bench.get("stats", {})
            results.append({
                "name": bench.get("name", "unknown"),
                "fullname": bench.get("fullname", ""),
                "params": bench.get("params"),
                "min_time": stats.get("min", 0),
                "max_time": stats.get("max", 0),
                "mean_time": stats.get("mean", 0),
                "median_time": stats.get("median", 0),
                "std_time": stats.get("stddev", 0),
                "iterations": stats.get("iterations", 1),
                "rounds": stats.get("rounds", 1),
                "total_time": stats.get("total", 0)
            })
        
        results.sort(key=lambda x: x["mean_time"], reverse=True)
        
        return {
            "type": "benchmark",
            "machine_info": machine_info,
            "commit_info": commit_info,
            "total_benchmarks": len(results),
            "results": results
        }
        
    except json.JSONDecodeError as e:
        raise FileFormatError(
            message=f"benchmark JSON 解析失败: {str(e)}",
            file_path=file_path,
            file_type="benchmark"
        )
    except Exception as e:
        raise FileFormatError(
            message=f"无法解析 benchmark 文件: {str(e)}",
            file_path=file_path,
            file_type="benchmark"
        )


def parse_timeit(file_path: str) -> Dict[str, Any]:
    """
    解析 timeit 输出
    
    Args:
        file_path: 文本文件路径
    
    Returns:
        解析后的数据字典
    """
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        results = []
        
        loops_match = re.search(r'(\d+)\s+loops?,\s+best\s+of\s+(\d+):\s+([\d.]+)\s+msec\s+per\s+loop', content)
        if loops_match:
            loops = int(loops_match.group(1))
            rounds = int(loops_match.group(2))
            msec_per_loop = float(loops_match.group(3))
            
            results.append({
                "name": "timeit_result",
                "fullname": "timeit_benchmark",
                "params": None,
                "min_time": msec_per_loop / 1000,
                "max_time": msec_per_loop / 1000,
                "mean_time": msec_per_loop / 1000,
                "median_time": msec_per_loop / 1000,
                "std_time": 0,
                "iterations": loops,
                "rounds": rounds,
                "total_time": (msec_per_loop / 1000) * loops
            })
        
        is_cprofile_text = 'ncalls  tottime' in content and 'Ordered by:' in content
        if is_cprofile_text:
            cprofile_data = _parse_text_cprofile(file_path)
            return cprofile_data
        
        return {
            "type": "timeit",
            "total_benchmarks": len(results),
            "results": results
        }
        
    except Exception as e:
        raise FileFormatError(
            message=f"无法解析 timeit 文件: {str(e)}",
            file_path=file_path,
            file_type="timeit"
        )


def run_analysis_pipeline(
    raw_data: Dict[str, Any],
    data_type: str,
    source_path: Optional[str] = None,
    baseline_id: Optional[int] = None,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    运行完整的分析管道
    
    Args:
        raw_data: 解析后的原始数据
        data_type: 数据类型
        source_path: 源码路径
        baseline_id: 基线分析 ID
        db_path: 数据库路径
    
    Returns:
        完整分析结果
    """
    result = {
        "type": data_type,
        "summary": {},
        "hotspots": [],
        "suggestions": [],
        "regressions": [],
        "io_patterns": [],
        "memory_patterns": [],
        "fanout_analysis": {}
    }
    
    if data_type in ["cprofile", "pystats"]:
        functions = raw_data.get("functions", [])
        
        result["summary"] = {
            "total_functions": raw_data.get("total_functions", len(functions)),
            "total_calls": raw_data.get("total_calls", sum(f.get("ncalls", 0) for f in functions)),
            "total_time": raw_data.get("total_time", sum(f.get("tottime", 0) for f in functions))
        }
        
        cpu_hotspots = analyze_cpu_hotspots(functions, data_type)
        result["hotspots"].extend(cpu_hotspots)
        
        fanout_result = analyze_function_fanout(functions)
        result["fanout_analysis"] = fanout_result
        
        io_patterns = analyze_io_patterns(functions)
        result["io_patterns"] = io_patterns
        for pattern in io_patterns:
            if pattern.get("is_issue", False):
                result["hotspots"].append({
                    "type": "io",
                    "function": pattern.get("function"),
                    "filename": pattern.get("filename"),
                    "lineno": pattern.get("lineno"),
                    "score": pattern.get("score", 0),
                    "severity": pattern.get("severity", "medium"),
                    "description": pattern.get("description")
                })
        
        memory_patterns = analyze_memory_patterns(functions)
        result["memory_patterns"] = memory_patterns
        for pattern in memory_patterns:
            if pattern.get("is_issue", False):
                result["hotspots"].append({
                    "type": "memory",
                    "function": pattern.get("function"),
                    "filename": pattern.get("filename"),
                    "lineno": pattern.get("lineno"),
                    "score": pattern.get("score", 0),
                    "severity": pattern.get("severity", "medium"),
                    "description": pattern.get("description")
                })
    
    elif data_type in ["benchmark", "timeit"]:
        results = raw_data.get("results", [])
        
        result["summary"] = {
            "total_benchmarks": len(results),
            "slowest": results[0]["name"] if results else None,
            "fastest": results[-1]["name"] if results else None
        }
        
        for bench in results[:5]:
            if bench.get("mean_time", 0) > 0.1:
                result["hotspots"].append({
                    "type": "benchmark",
                    "function": bench.get("name"),
                    "filename": bench.get("fullname", ""),
                    "lineno": 0,
                    "score": bench.get("mean_time", 0) * 10,
                    "severity": "high" if bench.get("mean_time", 0) > 1.0 else "medium",
                    "description": f"Benchmark 耗时 {bench.get('mean_time', 0):.4f} 秒"
                })
    
    result["hotspots"].sort(key=lambda x: x.get("score", 0), reverse=True)
    
    result["suggestions"] = _generate_suggestions(result)
    
    if baseline_id and db_path:
        regressions = detect_regressions(result, baseline_id, db_path)
        result["regressions"] = regressions
    
    if source_path:
        result["source_snippets"] = _extract_source_snippets(result["hotspots"], source_path)
    
    return result


def _generate_suggestions(analysis_result: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    根据分析结果生成优化建议
    """
    suggestions = []
    seen_suggestions = set()
    
    for hotspot in analysis_result["hotspots"][:5]:
        suggestion_key = (hotspot["type"], hotspot["function"])
        if suggestion_key in seen_suggestions:
            continue
        seen_suggestions.add(suggestion_key)
        
        if hotspot["type"] == "cpu":
            suggestion = _create_cpu_suggestion(hotspot)
            if suggestion:
                suggestions.append(suggestion)
        
        elif hotspot["type"] == "io":
            suggestion = _create_io_suggestion(hotspot)
            if suggestion:
                suggestions.append(suggestion)
        
        elif hotspot["type"] == "memory":
            suggestion = _create_memory_suggestion(hotspot)
            if suggestion:
                suggestions.append(suggestion)
    
    fanout = analysis_result.get("fanout_analysis", {})
    if fanout.get("deep_chain_count", 0) > 0:
        suggestions.append({
            "category": "architecture",
            "priority": "medium",
            "title": "深调用链优化",
            "description": f"检测到 {fanout['deep_chain_count']} 个深度大于 5 的调用链，建议减少调用层级或使用缓存。",
            "expected_improvement": "减少函数调用开销，提高代码可读性"
        })
    
    return suggestions


def _create_cpu_suggestion(hotspot: Dict) -> Optional[Dict]:
    """
    创建 CPU 优化建议
    """
    func_name = hotspot.get("function", "")
    
    suggestions = {
        "slow_calculation": {
            "title": "优化循环计算",
            "description": "使用向量化计算（NumPy）或算法优化来减少时间复杂度。",
            "before_code": """
def slow_calculation(n):
    result = 0
    for i in range(n):
        for j in range(n):
            result += i * j
    return result
""",
            "after_code": """
import numpy as np

def fast_calculation(n):
    arr = np.arange(n)
    return np.sum(arr[:, None] * arr[None, :])
""",
            "expected_improvement": "减少时间复杂度或使用向量化加速"
        },
        "default": {
            "title": f"优化函数: {func_name}",
            "description": f"该函数消耗大量 CPU 时间，建议使用 cProfile 更详细分析或考虑算法优化。",
            "expected_improvement": "根据具体场景选择优化策略"
        }
    }
    
    for key, suggestion in suggestions.items():
        if key in func_name.lower() or key == "default":
            return {
                "category": "cpu",
                "priority": hotspot.get("severity", "medium"),
                "title": suggestion["title"],
                "description": suggestion["description"],
                "before_code": suggestion.get("before_code"),
                "after_code": suggestion.get("after_code"),
                "expected_improvement": suggestion.get("expected_improvement")
            }
    
    return None


def _create_io_suggestion(hotspot: Dict) -> Optional[Dict]:
    """
    创建 I/O 优化建议
    """
    return {
        "category": "io",
        "priority": hotspot.get("severity", "medium"),
        "title": "减少重复 I/O 操作",
        "description": "检测到重复的文件读写操作，建议使用缓存或批量处理。",
        "before_code": """
for i in range(100):
    with open("file.txt", "r") as f:
        content = f.read()
    process(content)
""",
        "after_code": """
with open("file.txt", "r") as f:
    content = f.read()

for i in range(100):
    process(content)
""",
        "expected_improvement": "减少 I/O 操作次数，显著提升性能"
    }


def _create_memory_suggestion(hotspot: Dict) -> Optional[Dict]:
    """
    创建内存优化建议
    """
    return {
        "category": "memory",
        "priority": hotspot.get("severity", "medium"),
        "title": "优化内存分配",
        "description": "检测到过度的内存分配，建议使用生成器或预分配数组。",
        "before_code": """
big_list = []
for i in range(10000):
    temp_list = list(range(i))
    big_list.extend(temp_list)
""",
        "after_code": """
import itertools

def generate_items():
    for i in range(10000):
        yield from range(i)

for item in generate_items():
    process(item)
""",
        "expected_improvement": "减少内存峰值，避免不必要的内存分配"
    }


def _extract_source_snippets(hotspots: List[Dict], source_path: str) -> List[Dict]:
    """
    提取相关源码片段
    """
    snippets = []
    
    for hotspot in hotspots[:5]:
        filename = hotspot.get("filename", "")
        
        if not filename or filename == "unknown" or filename == "builtin":
            continue
        
        full_path = os.path.join(source_path, os.path.basename(filename))
        if not os.path.exists(full_path):
            full_path = filename
        
        if os.path.exists(full_path):
            try:
                with open(full_path, 'r') as f:
                    lines = f.readlines()
                
                lineno = hotspot.get("lineno", 1)
                start_line = max(1, lineno - 5)
                end_line = min(len(lines), lineno + 10)
                
                code = ''.join(lines[start_line - 1:end_line])
                highlight_lines = list(range(lineno - start_line + 1, lineno - start_line + 2)) if start_line <= lineno <= end_line else []
                
                snippets.append({
                    "filename": filename,
                    "start_line": start_line,
                    "end_line": end_line,
                    "code": code,
                    "highlight_lines": highlight_lines
                })
                
            except Exception:
                continue
    
    return snippets


def save_analysis_to_db(
    raw_data: Dict[str, Any],
    analysis_result: Dict[str, Any],
    name: str,
    notes: Optional[str],
    data_type: str,
    db_path: Optional[str] = None
) -> int:
    """
    保存分析结果到数据库
    
    Args:
        raw_data: 原始解析数据
        analysis_result: 分析结果
        name: 分析名称
        notes: 备注
        data_type: 数据类型
        db_path: 数据库路径
    
    Returns:
        分析记录 ID
    """
    session = get_session(db_path=db_path)
    
    try:
        analysis = Analysis(
            name=name,
            version=raw_data.get("commit_info", {}).get("id") if "commit_info" in raw_data else None,
            command=f"analyze --type {data_type}",
            notes=notes
        )
        session.add(analysis)
        session.flush()
        
        if data_type in ["cprofile", "pystats"]:
            functions = raw_data.get("functions", [])
            
            if data_type == "cprofile":
                for func in functions[:100]:
                    fp = FunctionProfile(
                        analysis_id=analysis.id,
                        filename=func.get("filename", "unknown"),
                        lineno=func.get("lineno"),
                        function=func.get("function", "unknown"),
                        ncalls=func.get("ncalls", 0),
                        tottime=func.get("tottime", 0),
                        percall_tottime=func.get("percall_tottime", 0),
                        cumtime=func.get("cumtime", 0),
                        percall_cumtime=func.get("percall_cumtime", 0)
                    )
                    session.add(fp)
            
            if data_type == "pystats":
                for func in functions[:100]:
                    sp = SampleProfile(
                        analysis_id=analysis.id,
                        filename=func.get("filename", "unknown"),
                        lineno=func.get("lineno"),
                        function=func.get("function", "unknown"),
                        samples=func.get("samples", 0),
                        percentage=func.get("percentage", 0),
                        sample_type=func.get("sample_type", "cpu")
                    )
                    session.add(sp)
        
        if data_type in ["benchmark", "timeit"]:
            for bench in raw_data.get("results", []):
                br = BenchmarkResult(
                    analysis_id=analysis.id,
                    name=bench.get("name", "unknown"),
                    source=data_type,
                    min_time=bench.get("min_time"),
                    max_time=bench.get("max_time"),
                    mean_time=bench.get("mean_time"),
                    median_time=bench.get("median_time"),
                    std_time=bench.get("std_time"),
                    iterations=bench.get("iterations"),
                    rounds=bench.get("rounds")
                )
                session.add(br)
        
        for hotspot in analysis_result.get("hotspots", []):
            hs = Hotspot(
                analysis_id=analysis.id,
                hotspot_type=hotspot.get("type", "unknown"),
                filename=hotspot.get("filename", "unknown"),
                lineno=hotspot.get("lineno"),
                function=hotspot.get("function", "unknown"),
                score=hotspot.get("score", 0),
                severity=hotspot.get("severity", "medium"),
                description=hotspot.get("description")
            )
            session.add(hs)
        
        for suggestion in analysis_result.get("suggestions", []):
            sg = Suggestion(
                analysis_id=analysis.id,
                category=suggestion.get("category", "general"),
                priority=suggestion.get("priority", "medium"),
                title=suggestion.get("title", ""),
                description=suggestion.get("description", ""),
                before_code=suggestion.get("before_code"),
                after_code=suggestion.get("after_code"),
                expected_improvement=suggestion.get("expected_improvement")
            )
            session.add(sg)
        
        for snippet in analysis_result.get("source_snippets", []):
            ss = SourceSnippet(
                analysis_id=analysis.id,
                filename=snippet.get("filename", ""),
                start_line=snippet.get("start_line", 1),
                end_line=snippet.get("end_line", 1),
                code=snippet.get("code", ""),
                highlight_lines=snippet.get("highlight_lines")
            )
            session.add(ss)
        
        session.commit()
        return analysis.id
        
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


def get_analysis_details(
    analysis_id: int,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    从数据库获取分析详情
    
    Args:
        analysis_id: 分析记录 ID
        db_path: 数据库路径
    
    Returns:
        分析详情字典
    """
    session = get_session(db_path=db_path)
    
    try:
        analysis = session.query(Analysis).filter(Analysis.id == analysis_id).first()
        
        if not analysis:
            raise AnalysisNotFoundError(analysis_id=analysis_id)
        
        result = {
            "name": analysis.name,
            "timestamp": analysis.timestamp.isoformat() if analysis.timestamp else None,
            "version": analysis.version,
            "command": analysis.command,
            "notes": analysis.notes,
            "summary": {},
            "hotspots": [],
            "suggestions": [],
            "source_snippets": []
        }
        
        function_profiles = session.query(FunctionProfile).filter(
            FunctionProfile.analysis_id == analysis_id
        ).order_by(FunctionProfile.cumtime.desc()).all()
        
        if function_profiles:
            result["summary"] = {
                "total_functions": len(function_profiles),
                "total_calls": sum(fp.ncalls for fp in function_profiles),
                "total_time": sum(fp.tottime for fp in function_profiles)
            }
        
        hotspots = session.query(Hotspot).filter(
            Hotspot.analysis_id == analysis_id
        ).order_by(Hotspot.score.desc()).all()
        
        for hs in hotspots:
            result["hotspots"].append({
                "type": hs.hotspot_type,
                "filename": hs.filename,
                "lineno": hs.lineno,
                "function": hs.function,
                "score": hs.score,
                "severity": hs.severity,
                "description": hs.description
            })
        
        suggestions = session.query(Suggestion).filter(
            Suggestion.analysis_id == analysis_id
        ).all()
        
        for sg in suggestions:
            result["suggestions"].append({
                "category": sg.category,
                "priority": sg.priority,
                "title": sg.title,
                "description": sg.description,
                "before_code": sg.before_code,
                "after_code": sg.after_code,
                "expected_improvement": sg.expected_improvement
            })
        
        snippets = session.query(SourceSnippet).filter(
            SourceSnippet.analysis_id == analysis_id
        ).all()
        
        for ss in snippets:
            result["source_snippets"].append({
                "filename": ss.filename,
                "start_line": ss.start_line,
                "end_line": ss.end_line,
                "code": ss.code,
                "highlight_lines": ss.highlight_lines
            })
        
        return result
        
    finally:
        session.close()
