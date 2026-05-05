"""
comparison 模块 - 对比两次分析结果
"""

from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

from perf_attrib.errors import AnalysisNotFoundError, InvalidComparisonError
from perf_attrib.database import (
    get_session, Analysis, FunctionProfile, SampleProfile, 
    BenchmarkResult, Hotspot, Comparison
)


def compare_analyses(
    analysis_id_1: int,
    analysis_id_2: int,
    name: Optional[str] = None,
    notes: Optional[str] = None,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    对比两次分析结果
    
    Args:
        analysis_id_1: 第一个分析 ID（基准）
        analysis_id_2: 第二个分析 ID（目标）
        name: 对比名称
        notes: 对比备注
        db_path: 数据库路径
    
    Returns:
        对比结果字典
    """
    session = get_session(db_path=db_path)
    
    try:
        analysis1 = session.query(Analysis).filter(Analysis.id == analysis_id_1).first()
        analysis2 = session.query(Analysis).filter(Analysis.id == analysis_id_2).first()
        
        if not analysis1:
            raise AnalysisNotFoundError(analysis_id=analysis_id_1)
        if not analysis2:
            raise AnalysisNotFoundError(analysis_id=analysis_id_2)
        
        result = {
            "name": name or f"对比: {analysis1.name} vs {analysis2.name}",
            "analysis_1": {
                "id": analysis1.id,
                "name": analysis1.name,
                "timestamp": analysis1.timestamp.isoformat() if analysis1.timestamp else None,
                "version": analysis1.version
            },
            "analysis_2": {
                "id": analysis2.id,
                "name": analysis2.name,
                "timestamp": analysis2.timestamp.isoformat() if analysis2.timestamp else None,
                "version": analysis2.version
            },
            "timestamp": datetime.now().isoformat(),
            "summary": {},
            "improvements": [],
            "regressions": [],
            "unchanged": [],
            "hotspot_comparison": []
        }
        
        funcs1 = session.query(FunctionProfile).filter(
            FunctionProfile.analysis_id == analysis_id_1
        ).all()
        funcs2 = session.query(FunctionProfile).filter(
            FunctionProfile.analysis_id == analysis_id_2
        ).all()
        
        if funcs1 and funcs2:
            func_comparison = _compare_function_profiles(funcs1, funcs2)
            result["summary"].update(func_comparison["summary"])
            result["improvements"].extend(func_comparison["improvements"])
            result["regressions"].extend(func_comparison["regressions"])
            result["unchanged"].extend(func_comparison["unchanged"])
        
        benches1 = session.query(BenchmarkResult).filter(
            BenchmarkResult.analysis_id == analysis_id_1
        ).all()
        benches2 = session.query(BenchmarkResult).filter(
            BenchmarkResult.analysis_id == analysis_id_2
        ).all()
        
        if benches1 and benches2:
            bench_comparison = _compare_benchmark_results(benches1, benches2)
            result["summary"].update(bench_comparison["summary"])
            result["improvements"].extend(bench_comparison["improvements"])
            result["regressions"].extend(bench_comparison["regressions"])
        
        hotspots1 = session.query(Hotspot).filter(
            Hotspot.analysis_id == analysis_id_1
        ).order_by(Hotspot.score.desc()).all()
        hotspots2 = session.query(Hotspot).filter(
            Hotspot.analysis_id == analysis_id_2
        ).order_by(Hotspot.score.desc()).all()
        
        if hotspots1 and hotspots2:
            hotspot_comp = _compare_hotspots(hotspots1, hotspots2)
            result["hotspot_comparison"] = hotspot_comp
        
        comparison = Comparison(
            analysis_id_1=analysis_id_1,
            analysis_id_2=analysis_id_2,
            name=name,
            notes=notes,
            summary={
                "total_improvements": len(result["improvements"]),
                "total_regressions": len(result["regressions"]),
                "total_unchanged": len(result["unchanged"]),
                **result["summary"]
            },
            regressions=[{"function": r.get("function"), "change": r.get("change_str")} 
                        for r in result["regressions"]],
            improvements=[{"function": i.get("function"), "change": i.get("change_str")}
                         for i in result["improvements"]]
        )
        session.add(comparison)
        session.commit()
        
        return result
        
    except AnalysisNotFoundError:
        raise
    except Exception as e:
        raise InvalidComparisonError(
            message=f"对比失败: {str(e)}",
            reason="数据库查询错误或数据不一致"
        )
    finally:
        session.close()


def _compare_function_profiles(
    funcs1: List[FunctionProfile],
    funcs2: List[FunctionProfile]
) -> Dict[str, Any]:
    """
    对比函数性能数据
    """
    result = {
        "summary": {},
        "improvements": [],
        "regressions": [],
        "unchanged": []
    }
    
    func_map1 = {f.function: f for f in funcs1}
    func_map2 = {f.function: f for f in funcs2}
    
    all_funcs = set(func_map1.keys()).union(set(func_map2.keys()))
    
    total_time1 = sum(f.cumtime for f in funcs1)
    total_time2 = sum(f.cumtime for f in funcs2)
    
    if total_time1 > 0:
        time_change = ((total_time2 - total_time1) / total_time1) * 100
        result["summary"]["total_time_change"] = time_change
        result["summary"]["total_time_change_str"] = (
            f"+{time_change:.1f}%" if time_change >= 0 else f"{time_change:.1f}%"
        )
    
    total_calls1 = sum(f.ncalls for f in funcs1)
    total_calls2 = sum(f.ncalls for f in funcs2)
    
    if total_calls1 > 0:
        calls_change = ((total_calls2 - total_calls1) / total_calls1) * 100
        result["summary"]["calls_change"] = calls_change
        result["summary"]["calls_change_str"] = (
            f"+{calls_change:.1f}%" if calls_change >= 0 else f"{calls_change:.1f}%"
        )
    
    for func_name in all_funcs:
        f1 = func_map1.get(func_name)
        f2 = func_map2.get(func_name)
        
        if f1 and f2:
            baseline_time = f1.cumtime
            current_time = f2.cumtime
            
            if baseline_time > 0:
                change = ((current_time - baseline_time) / baseline_time) * 100
                
                if change < -10:
                    result["improvements"].append({
                        "function": func_name,
                        "filename": f2.filename,
                        "baseline_time": baseline_time,
                        "current_time": current_time,
                        "change": change,
                        "change_str": f"{change:.1f}%",
                        "improvement": abs(change),
                        "type": "function_performance"
                    })
                elif change > 10:
                    result["regressions"].append({
                        "function": func_name,
                        "filename": f2.filename,
                        "baseline_time": baseline_time,
                        "current_time": current_time,
                        "change": change,
                        "change_str": f"+{change:.1f}%",
                        "regression": change,
                        "type": "function_performance"
                    })
                else:
                    result["unchanged"].append({
                        "function": func_name,
                        "filename": f2.filename,
                        "baseline_time": baseline_time,
                        "current_time": current_time,
                        "change": change,
                        "type": "function_performance"
                    })
        elif f1 and not f2:
            result["improvements"].append({
                "function": func_name,
                "filename": f1.filename,
                "baseline_time": f1.cumtime,
                "current_time": 0,
                "change": -100,
                "change_str": "-100%",
                "improvement": 100,
                "type": "function_removed",
                "note": "该函数不再被调用或已被移除"
            })
        elif not f1 and f2:
            result["regressions"].append({
                "function": func_name,
                "filename": f2.filename,
                "baseline_time": 0,
                "current_time": f2.cumtime,
                "change": float('inf'),
                "change_str": "新增",
                "regression": 0,
                "type": "function_added",
                "note": "该函数是新增的或首次被调用"
            })
    
    result["improvements"].sort(key=lambda x: x["improvement"], reverse=True)
    result["regressions"].sort(key=lambda x: x["regression"], reverse=True)
    
    return result


def _compare_benchmark_results(
    benches1: List[BenchmarkResult],
    benches2: List[BenchmarkResult]
) -> Dict[str, Any]:
    """
    对比 Benchmark 结果
    """
    result = {
        "summary": {},
        "improvements": [],
        "regressions": []
    }
    
    bench_map1 = {b.name: b for b in benches1}
    bench_map2 = {b.name: b for b in benches2}
    
    all_names = set(bench_map1.keys()).union(set(bench_map2.keys()))
    
    for name in all_names:
        b1 = bench_map1.get(name)
        b2 = bench_map2.get(name)
        
        if b1 and b2:
            baseline_mean = b1.mean_time or 0
            current_mean = b2.mean_time or 0
            
            if baseline_mean > 0:
                change = ((current_mean - baseline_mean) / baseline_mean) * 100
                
                if change < -10:
                    result["improvements"].append({
                        "function": name,
                        "baseline_time": baseline_mean,
                        "current_time": current_mean,
                        "change": change,
                        "change_str": f"{change:.1f}%",
                        "improvement": abs(change),
                        "type": "benchmark"
                    })
                elif change > 10:
                    result["regressions"].append({
                        "function": name,
                        "baseline_time": baseline_mean,
                        "current_time": current_mean,
                        "change": change,
                        "change_str": f"+{change:.1f}%",
                        "regression": change,
                        "type": "benchmark"
                    })
    
    result["improvements"].sort(key=lambda x: x["improvement"], reverse=True)
    result["regressions"].sort(key=lambda x: x["regression"], reverse=True)
    
    return result


def _compare_hotspots(
    hotspots1: List[Hotspot],
    hotspots2: List[Hotspot]
) -> List[Dict[str, Any]]:
    """
    对比热点函数
    """
    result = []
    
    hotspot_map1 = {(h.function, h.hotspot_type): h for h in hotspots1}
    hotspot_map2 = {(h.function, h.hotspot_type): h for h in hotspots2}
    
    all_keys = set(hotspot_map1.keys()).union(set(hotspot_map2.keys()))
    
    for key in all_keys:
        h1 = hotspot_map1.get(key)
        h2 = hotspot_map2.get(key)
        
        comp = {
            "function": key[0],
            "type": key[1],
            "status": "unchanged"
        }
        
        if h1 and h2:
            score_change = h2.score - h1.score
            comp["baseline_score"] = h1.score
            comp["current_score"] = h2.score
            comp["score_change"] = score_change
            
            if h2.severity == "high" and h1.severity != "high":
                comp["status"] = "worsened"
            elif h2.severity in ["low", "medium"] and h1.severity == "high":
                comp["status"] = "improved"
            
        elif h1 and not h2:
            comp["baseline_score"] = h1.score
            comp["current_score"] = 0
            comp["status"] = "fixed"
            comp["note"] = "该热点已修复"
        
        elif not h1 and h2:
            comp["baseline_score"] = 0
            comp["current_score"] = h2.score
            comp["status"] = "new"
            comp["note"] = "这是一个新的热点"
        
        result.append(comp)
    
    return result
