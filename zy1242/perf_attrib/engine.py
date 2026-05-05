"""
分析引擎模块 - 识别 CPU 热点、函数调用扇出、重复 I/O、过度分配
"""

import os
from typing import Dict, List, Any, Optional, Tuple
from collections import defaultdict


def analyze_cpu_hotspots(
    functions: List[Dict[str, Any]],
    data_type: str = "cprofile"
) -> List[Dict[str, Any]]:
    """
    分析 CPU 热点函数
    
    Args:
        functions: 函数列表
        data_type: 数据类型 (cprofile 或 pystats)
    
    Returns:
        热点函数列表
    """
    hotspots = []
    
    if not functions:
        return hotspots
    
    if data_type == "cprofile":
        total_time = sum(f.get("tottime", 0) for f in functions)
        total_calls = sum(f.get("ncalls", 0) for f in functions)
        
        for func in functions[:20]:
            tottime = func.get("tottime", 0)
            cumtime = func.get("cumtime", 0)
            ncalls = func.get("ncalls", 0)
            percall_tottime = func.get("percall_tottime", 0)
            
            if total_time > 0:
                time_percentage = (tottime / total_time) * 100
            else:
                time_percentage = 0
            
            score = 0
            severity = "low"
            issues = []
            
            if time_percentage > 20:
                score += 30
                severity = "high"
                issues.append("占用大量 CPU 时间")
            
            if ncalls > 1000 and percall_tottime > 0.001:
                score += 20
                severity = "medium" if severity == "low" else severity
                issues.append("高频调用且单次耗时较长")
            
            if percall_tottime > 0.1:
                score += 25
                severity = "high"
                issues.append("单次调用耗时较长")
            
            if cumtime > 1 and tottime / cumtime < 0.1:
                score += 15
                issues.append("大部分时间在调用子函数（可能是调用链问题）")
            
            if score > 0:
                hotspots.append({
                    "type": "cpu",
                    "filename": func.get("filename", "unknown"),
                    "lineno": func.get("lineno"),
                    "function": func.get("function", "unknown"),
                    "score": score,
                    "severity": severity,
                    "description": " | ".join(issues),
                    "evidence": {
                        "tottime": tottime,
                        "cumtime": cumtime,
                        "ncalls": ncalls,
                        "percall_tottime": percall_tottime,
                        "time_percentage": time_percentage
                    }
                })
    
    elif data_type == "pystats":
        total_samples = sum(f.get("samples", 0) for f in functions)
        
        for func in functions[:20]:
            samples = func.get("samples", 0)
            percentage = func.get("percentage", 0)
            
            if total_samples > 0 and percentage == 0:
                percentage = (samples / total_samples) * 100
            
            score = 0
            severity = "low"
            issues = []
            
            if percentage > 20:
                score += 30
                severity = "high"
                issues.append(f"采样占比 {percentage:.1f}%，为主要 CPU 热点")
            
            if percentage > 10:
                score += 20
                severity = "medium" if severity == "low" else severity
                issues.append("采样占比较高")
            
            if func.get("function", "").startswith("<"):
                score += 10
                issues.append("可能是内置函数或系统调用")
            
            if score > 0:
                hotspots.append({
                    "type": "cpu",
                    "filename": func.get("filename", "unknown"),
                    "lineno": func.get("lineno"),
                    "function": func.get("function", "unknown"),
                    "score": score,
                    "severity": severity,
                    "description": " | ".join(issues),
                    "evidence": {
                        "samples": samples,
                        "percentage": percentage
                    }
                })
    
    hotspots.sort(key=lambda x: x["score"], reverse=True)
    
    return hotspots


def analyze_function_fanout(
    functions: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    分析函数调用扇出
    
    Args:
        functions: 函数列表
    
    Returns:
        调用扇出分析结果
    """
    result = {
        "total_functions": len(functions),
        "high_fanout_functions": [],
        "deep_call_chains": [],
        "deep_chain_count": 0,
        "recommendations": []
    }
    
    func_to_callers = defaultdict(list)
    func_to_callees = defaultdict(list)
    
    for func in functions:
        func_name = func.get("function", "unknown")
        callers = func.get("callers", [])
        
        for caller in callers:
            if isinstance(caller, tuple):
                caller_name = caller[2] if len(caller) > 2 else str(caller)
            else:
                caller_name = str(caller)
            
            func_to_callers[func_name].append(caller_name)
            func_to_callees[caller_name].append(func_name)
    
    for func_name, callees in func_to_callees.items():
        fanout = len(set(callees))
        
        if fanout > 10:
            func_data = next((f for f in functions if f.get("function") == func_name), None)
            
            result["high_fanout_functions"].append({
                "function": func_name,
                "filename": func_data.get("filename", "unknown") if func_data else "unknown",
                "lineno": func_data.get("lineno") if func_data else None,
                "fanout_count": fanout,
                "callees": list(set(callees))[:10]
            })
    
    visited = set()
    call_chains = []
    
    def dfs(func_name, chain, depth):
        if depth > 10 or func_name in visited:
            if len(chain) > 5:
                call_chains.append(chain.copy())
            return
        
        visited.add(func_name)
        chain.append(func_name)
        
        callee_set = set(func_to_callees.get(func_name, []))
        if not callee_set:
            if len(chain) > 5:
                call_chains.append(chain.copy())
        else:
            for callee in callee_set:
                dfs(callee, chain, depth + 1)
        
        chain.pop()
        visited.remove(func_name)
    
    entry_points = []
    all_funcs = set(f.get("function", "unknown") for f in functions)
    for func_name in all_funcs:
        if not func_to_callers.get(func_name):
            entry_points.append(func_name)
    
    for entry in entry_points[:10]:
        dfs(entry, [], 0)
    
    unique_chains = []
    seen = set()
    for chain in call_chains:
        key = tuple(chain)
        if key not in seen:
            seen.add(key)
            unique_chains.append(chain)
    
    result["deep_call_chains"] = unique_chains
    result["deep_chain_count"] = len(unique_chains)
    
    if result["high_fanout_functions"]:
        result["recommendations"].append(
            f"检测到 {len(result['high_fanout_functions'])} 个高扇出函数，考虑使用 Facade 模式减少直接依赖"
        )
    
    if result["deep_chain_count"] > 0:
        result["recommendations"].append(
            f"检测到 {result['deep_chain_count']} 个深度大于 5 的调用链，考虑重构减少调用层级"
        )
    
    return result


def analyze_io_patterns(
    functions: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    分析 I/O 模式，识别重复 I/O
    
    Args:
        functions: 函数列表
    
    Returns:
        I/O 模式分析结果
    """
    io_functions = []
    io_keywords = [
        "open", "read", "write", "close", "seek",
        "load", "save", "readlines", "writelines",
        "pickle", "json.load", "json.dump",
        "csv.reader", "csv.writer",
        "requests", "urllib", "urlopen",
        "socket", "connect", "recv", "send"
    ]
    
    io_builtins = [
        "{built-in method io.open}",
        "{built-in method builtins.open}",
        "{method 'read' of '_io.TextIOWrapper' objects}",
        "{method 'write' of '_io.TextIOWrapper' objects}",
    ]
    
    for func in functions:
        func_name = func.get("function", "")
        filename = func.get("filename", "")
        
        is_io_function = False
        
        for keyword in io_keywords:
            if keyword in func_name.lower() or keyword in filename.lower():
                is_io_function = True
                break
        
        for builtin in io_builtins:
            if builtin in func_name:
                is_io_function = True
                break
        
        if is_io_function:
            io_functions.append(func)
    
    patterns = []
    
    for func in io_functions:
        ncalls = func.get("ncalls", 0)
        tottime = func.get("tottime", 0)
        cumtime = func.get("cumtime", 0)
        
        score = 0
        is_issue = False
        severity = "low"
        issues = []
        
        if ncalls > 100:
            score += 30
            is_issue = True
            severity = "high"
            issues.append(f"高频率 I/O 调用: {ncalls} 次")
        
        if ncalls > 50:
            score += 20
            is_issue = True
            severity = "medium" if severity == "low" else severity
            issues.append(f"较高频率 I/O 调用: {ncalls} 次")
        
        if cumtime > 0.5:
            score += 25
            is_issue = True
            severity = "high"
            issues.append(f"I/O 累计耗时较长: {cumtime:.3f} 秒")
        
        patterns.append({
            "function": func.get("function", "unknown"),
            "filename": func.get("filename", "unknown"),
            "lineno": func.get("lineno"),
            "ncalls": ncalls,
            "tottime": tottime,
            "cumtime": cumtime,
            "score": score,
            "is_issue": is_issue,
            "severity": severity,
            "description": " | ".join(issues) if issues else "正常 I/O 操作"
        })
    
    patterns.sort(key=lambda x: x["score"], reverse=True)
    
    return patterns


def analyze_memory_patterns(
    functions: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    分析内存模式，识别过度分配
    
    Args:
        functions: 函数列表
    
    Returns:
        内存模式分析结果
    """
    memory_functions = []
    memory_keywords = [
        "list", "dict", "set", "tuple",
        "append", "extend", "insert",
        "copy", "deepcopy",
        "array", "numpy", "ndarray",
        "DataFrame", "Series",
        "allocate", "malloc", "new",
        "__init__", "__new__"
    ]
    
    list_operations = [
        "{method 'append' of 'list' objects}",
        "{method 'extend' of 'list' objects}",
        "{method 'insert' of 'list' objects}",
    ]
    
    for func in functions:
        func_name = func.get("function", "")
        filename = func.get("filename", "")
        
        is_memory_function = False
        
        for keyword in memory_keywords:
            if keyword in func_name.lower() or keyword in filename.lower():
                is_memory_function = True
                break
        
        for op in list_operations:
            if op in func_name:
                is_memory_function = True
                break
        
        if is_memory_function:
            memory_functions.append(func)
    
    patterns = []
    
    for func in memory_functions:
        ncalls = func.get("ncalls", 0)
        tottime = func.get("tottime", 0)
        cumtime = func.get("cumtime", 0)
        percall_tottime = func.get("percall_tottime", 0)
        
        score = 0
        is_issue = False
        severity = "low"
        issues = []
        
        if ncalls > 10000 and percall_tottime > 0.0001:
            score += 30
            is_issue = True
            severity = "high"
            issues.append(f"高频内存操作: {ncalls} 次，可能存在过度分配")
        
        if ncalls > 1000:
            score += 20
            is_issue = True
            severity = "medium" if severity == "low" else severity
            issues.append(f"较多内存操作: {ncalls} 次")
        
        func_name = func.get("function", "")
        if "append" in func_name.lower() and ncalls > 100:
            score += 15
            is_issue = True
            issues.append("频繁使用 list.append，考虑预分配或生成器")
        
        if "copy" in func_name.lower():
            score += 10
            issues.append("存在复制操作，考虑是否必要")
        
        patterns.append({
            "function": func.get("function", "unknown"),
            "filename": func.get("filename", "unknown"),
            "lineno": func.get("lineno"),
            "ncalls": ncalls,
            "tottime": tottime,
            "cumtime": cumtime,
            "score": score,
            "is_issue": is_issue,
            "severity": severity,
            "description": " | ".join(issues) if issues else "正常内存操作"
        })
    
    patterns.sort(key=lambda x: x["score"], reverse=True)
    
    return patterns


def detect_regressions(
    current_analysis: Dict[str, Any],
    baseline_id: int,
    db_path: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    检测回归（与基线分析对比）
    
    Args:
        current_analysis: 当前分析结果
        baseline_id: 基线分析 ID
        db_path: 数据库路径
    
    Returns:
        回归检测结果
    """
    from perf_attrib.database import get_session, FunctionProfile, SampleProfile, BenchmarkResult, Analysis
    
    regressions = []
    
    session = get_session(db_path=db_path)
    
    try:
        baseline = session.query(Analysis).filter(Analysis.id == baseline_id).first()
        if not baseline:
            return regressions
        
        current_type = current_analysis.get("type", "cprofile")
        
        if current_type == "cprofile":
            baseline_funcs = session.query(FunctionProfile).filter(
                FunctionProfile.analysis_id == baseline_id
            ).all()
            
            baseline_map = {
                f.function: {
                    "cumtime": f.cumtime,
                    "tottime": f.tottime,
                    "ncalls": f.ncalls
                }
                for f in baseline_funcs
            }
            
            current_hotspots = current_analysis.get("hotspots", [])
            
            for hotspot in current_hotspots:
                func_name = hotspot.get("function", "")
                
                if func_name in baseline_map:
                    baseline_data = baseline_map[func_name]
                    
                    evidence = hotspot.get("evidence", {})
                    current_cumtime = evidence.get("cumtime", 0)
                    baseline_cumtime = baseline_data.get("cumtime", 0)
                    
                    if baseline_cumtime > 0 and current_cumtime > baseline_cumtime:
                        change_percent = ((current_cumtime - baseline_cumtime) / baseline_cumtime) * 100
                        
                        if change_percent > 10:
                            regressions.append({
                                "function": func_name,
                                "filename": hotspot.get("filename", "unknown"),
                                "lineno": hotspot.get("lineno"),
                                "type": "performance_regression",
                                "baseline_cumtime": baseline_cumtime,
                                "current_cumtime": current_cumtime,
                                "change": change_percent,
                                "change_str": f"+{change_percent:.1f}%",
                                "severity": "high" if change_percent > 50 else "medium"
                            })
        
        elif current_type in ["benchmark", "timeit"]:
            baseline_benches = session.query(BenchmarkResult).filter(
                BenchmarkResult.analysis_id == baseline_id
            ).all()
            
            baseline_map = {
                b.name: {
                    "mean_time": b.mean_time,
                    "median_time": b.median_time
                }
                for b in baseline_benches
            }
            
            current_results = current_analysis.get("summary", {}).get("results", [])
            
            for result in current_results:
                name = result.get("name", "")
                
                if name in baseline_map:
                    baseline_data = baseline_map[name]
                    
                    current_mean = result.get("mean_time", 0)
                    baseline_mean = baseline_data.get("mean_time", 0)
                    
                    if baseline_mean > 0 and current_mean > baseline_mean:
                        change_percent = ((current_mean - baseline_mean) / baseline_mean) * 100
                        
                        if change_percent > 10:
                            regressions.append({
                                "function": name,
                                "type": "benchmark_regression",
                                "baseline_time": baseline_mean,
                                "current_time": current_mean,
                                "change": change_percent,
                                "change_str": f"+{change_percent:.1f}%",
                                "severity": "high" if change_percent > 50 else "medium"
                            })
        
        return regressions
        
    finally:
        session.close()
