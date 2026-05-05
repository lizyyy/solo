"""报告导出模块"""

import json
from typing import Dict, Any, List
from datetime import datetime


def export_to_markdown(analysis: Dict[str, Any]) -> str:
    """将分析结果导出为 Markdown 格式"""
    
    raw_data = analysis.get("raw_data", analysis)
    
    lines = []
    
    # 标题
    lines.append("# 并发方案分析报告")
    lines.append("")
    
    # 元数据
    lines.append("## 基本信息")
    lines.append("")
    lines.append(f"- **分析 ID**: {analysis.get('id', 'N/A')}")
    lines.append(f"- **分析时间**: {analysis.get('timestamp', datetime.now().isoformat())}")
    lines.append(f"- **计划文件**: {raw_data.get('plan_file', 'N/A')}")
    lines.append(f"- **运行记录数**: {raw_data.get('run_count', 0)}")
    lines.append(f"- **代码片段数**: {raw_data.get('snippet_count', 0)}")
    lines.append("")
    
    # 摘要
    lines.append("## 分析摘要")
    lines.append("")
    lines.append(f"> {raw_data.get('summary', 'N/A')}")
    lines.append("")
    
    # 并发类型
    lines.append("## 并发类型")
    lines.append("")
    concurrency_type = raw_data.get('concurrency_type', 'unknown')
    type_description = {
        "threading": "多线程 - 适合 I/O 密集型任务，受 GIL 限制",
        "multiprocessing": "多进程 - 适合 CPU 密集型任务，可利用多核 CPU",
        "asyncio": "asyncio - 单线程异步，适合高并发 I/O 场景",
        "mixed": "混合型 - 同时使用多种并发方式",
        "unknown": "未知 - 无法确定并发类型"
    }
    lines.append(f"**当前类型**: `{concurrency_type}`")
    lines.append("")
    lines.append(type_description.get(concurrency_type, "未知类型"))
    lines.append("")
    
    # CPU/I/O 占比
    lines.append("## 任务特性分析")
    lines.append("")
    cpu_percent = raw_data.get('cpu_percent', 0)
    io_percent = raw_data.get('io_percent', 0)
    
    lines.append(f"### CPU 占比: {cpu_percent * 100:.1f}%")
    lines.append(f"### I/O 占比: {io_percent * 100:.1f}%")
    lines.append("")
    
    if cpu_percent > 0.7:
        lines.append("**推荐**: 任务偏向 CPU 密集型，建议使用 `multiprocessing`。")
    elif io_percent > 0.7:
        lines.append("**推荐**: 任务偏向 I/O 密集型，建议使用 `threading` 或 `asyncio`。")
    else:
        lines.append("**推荐**: 任务为混合型，建议根据主要任务特性选择并发方案。")
    lines.append("")
    
    # 风险评估
    lines.append("## 风险评估")
    lines.append("")
    
    risk_score = raw_data.get('risk_score', 0)
    if risk_score == 0:
        risk_level = "无风险"
        risk_color = "green"
    elif risk_score < 50:
        risk_level = "低风险"
        risk_color = "yellow"
    elif risk_score < 100:
        risk_level = "中等风险"
        risk_color = "orange"
    else:
        risk_level = "高风险"
        risk_color = "red"
    
    lines.append(f"**风险分数**: {risk_score}")
    lines.append(f"**风险等级**: {risk_level}")
    lines.append("")
    
    # 详细风险列表
    risks = raw_data.get("risks", [])
    if risks:
        # 按严重程度分组
        critical_risks = [r for r in risks if hasattr(r, 'level') and r.level.value == "critical"]
        high_risks = [r for r in risks if hasattr(r, 'level') and r.level.value == "high"]
        medium_risks = [r for r in risks if hasattr(r, 'level') and r.level.value == "medium"]
        low_risks = [r for r in risks if hasattr(r, 'level') and r.level.value == "low"]
        
        # 严重风险
        if critical_risks:
            lines.append("### 🔥 严重风险")
            lines.append("")
            for i, risk in enumerate(critical_risks, 1):
                lines.append(f"#### {i}. {risk.message}")
                lines.append("")
                lines.append(f"**类别**: {risk.category}")
                lines.append(f"**建议**: {risk.suggestion}")
                lines.append("")
        
        # 高风险
        if high_risks:
            lines.append("### ❌ 高风险")
            lines.append("")
            for i, risk in enumerate(high_risks, 1):
                lines.append(f"#### {i}. {risk.message}")
                lines.append("")
                lines.append(f"**类别**: {risk.category}")
                lines.append(f"**建议**: {risk.suggestion}")
                lines.append("")
        
        # 中等风险
        if medium_risks:
            lines.append("### ⚠️ 中等风险")
            lines.append("")
            for i, risk in enumerate(medium_risks, 1):
                lines.append(f"#### {i}. {risk.message}")
                lines.append("")
                lines.append(f"**类别**: {risk.category}")
                lines.append(f"**建议**: {risk.suggestion}")
                lines.append("")
        
        # 低风险
        if low_risks:
            lines.append("### ℹ️ 低风险")
            lines.append("")
            for i, risk in enumerate(low_risks, 1):
                lines.append(f"#### {i}. {risk.message}")
                lines.append("")
                lines.append(f"**类别**: {risk.category}")
                lines.append(f"**建议**: {risk.suggestion}")
                lines.append("")
    else:
        lines.append("✓ 未检测到风险。")
        lines.append("")
    
    # 指标详情
    metrics = raw_data.get("metrics", [])
    if metrics:
        lines.append("## 关键指标")
        lines.append("")
        lines.append("| 指标名称 | 值 | 单位 |")
        lines.append("|----------|-----|------|")
        for m in metrics:
            lines.append(f"| {m.get('name', 'N/A')} | {m.get('value', 'N/A')} | {m.get('unit', 'N/A')} |")
        lines.append("")
    
    # 代码片段分析
    snippets = raw_data.get("snippets_analysis", [])
    if snippets:
        lines.append("## 代码片段分析")
        lines.append("")
        lines.append("| 文件名 | 并发类型 | CPU 占比 | I/O 占比 | 检测到的模式 |")
        lines.append("|--------|----------|----------|----------|--------------|")
        
        for snippet in snippets:
            ctype = snippet.get("concurrency_type", "unknown")
            # 处理 Enum 或字符串形式
            if hasattr(ctype, "value"):
                ctype = ctype.value
            elif isinstance(ctype, str) and "." in ctype:
                # 处理类似 "ConcurrencyType.MULTIPROCESSING" 的字符串
                ctype = ctype.split(".")[-1].lower()
            cpu_pct = snippet.get("cpu_intensity", 0) * 100
            io_pct = snippet.get("io_intensity", 0) * 100
            patterns = ", ".join(snippet.get("patterns", [])) or "无"
            
            lines.append(f"| {snippet.get('file_name', 'N/A')} | {ctype} | {cpu_pct:.1f}% | {io_pct:.1f}% | {patterns} |")
        lines.append("")
    
    # 运行记录分析
    runs = raw_data.get("runs_analysis", [])
    if runs:
        lines.append("## 运行记录分析")
        lines.append("")
        lines.append(f"共 {len(runs)} 条运行记录。")
        lines.append("")
        
        # 统计信息
        if runs:
            avg_cpu = sum(r.get("cpu_usage", 0) for r in runs) / len(runs)
            avg_io = sum(r.get("io_usage", 0) for r in runs) / len(runs)
            avg_time = sum(r.get("total_time_sec", 0) for r in runs) / len(runs)
            
            lines.append("### 统计摘要")
            lines.append("")
            lines.append(f"- **平均 CPU 使用率**: {avg_cpu:.1f}%")
            lines.append(f"- **平均 I/O 使用率**: {avg_io:.1f}%")
            lines.append(f"- **平均执行时间**: {avg_time:.2f} 秒")
            lines.append("")
    
    # 推荐
    lines.append("## 推荐方案")
    lines.append("")
    
    recommendations = _generate_recommendations(raw_data)
    for i, rec in enumerate(recommendations, 1):
        lines.append(f"{i}. {rec}")
        lines.append("")
    
    lines.append("---")
    lines.append("")
    lines.append(f"*报告生成时间: {datetime.now().isoformat()}*")
    
    return "\n".join(lines)


def _generate_recommendations(raw_data: Dict) -> List[str]:
    """生成推荐列表"""
    recommendations = []
    
    concurrency_type = raw_data.get('concurrency_type', 'unknown')
    cpu_percent = raw_data.get('cpu_percent', 0)
    io_percent = raw_data.get('io_percent', 0)
    risk_score = raw_data.get('risk_score', 0)
    
    # 基于任务特性的推荐
    if cpu_percent > 0.7:
        if concurrency_type != "multiprocessing":
            recommendations.append(
                "**切换到多进程**: 任务主要是 CPU 密集型，当前使用的并发类型 "
                f"`{concurrency_type}` 可能不是最优选择。建议使用 `multiprocessing` 来充分利用多核 CPU。"
            )
    elif io_percent > 0.7:
        if concurrency_type == "multiprocessing":
            recommendations.append(
                "**考虑切换到多线程或 asyncio**: 任务主要是 I/O 密集型，多进程的启动和 IPC 成本较高。"
                "建议使用 `threading` 或 `asyncio`。"
            )
        elif concurrency_type == "threading":
            recommendations.append(
                "**当前方案适合 I/O 密集型**: `threading` 是适合 I/O 密集型任务的选择。"
                "如果需要更高的并发量，可以考虑切换到 `asyncio`。"
            )
    
    # 基于风险的推荐
    if risk_score >= 100:
        recommendations.append(
            "**高风险警告**: 当前方案存在严重风险，建议优先修复所有检测到的问题。"
            "请关注 '严重风险' 和 '高风险' 部分的详细建议。"
        )
    elif risk_score >= 50:
        recommendations.append(
            "**中等风险**: 当前方案存在一些需要关注的问题。"
            "建议逐步修复中等风险以上的问题。"
        )
    
    # 通用推荐
    recommendations.append(
        "**持续监控**: 建议定期运行 `concurrency-checker analyze` 来监控并发方案的健康状态。"
        "使用 `--save` 参数保存分析结果，便于后续对比和复盘。"
    )
    
    recommendations.append(
        "**方案对比**: 在做重大变更前，建议使用 `concurrency-checker compare` 对比不同方案的优劣，"
        "或使用 `concurrency-checker export` 生成详细报告供团队评审。"
    )
    
    return recommendations


def export_to_json(analysis: Dict[str, Any], indent: int = 2) -> str:
    """将分析结果导出为 JSON 格式"""
    
    # 处理 Risk 对象，转换为字典
    def convert_to_serializable(obj):
        if hasattr(obj, '__dict__'):
            return {k: convert_to_serializable(v) for k, v in obj.__dict__.items()}
        elif isinstance(obj, (list, tuple)):
            return [convert_to_serializable(item) for item in obj]
        elif hasattr(obj, 'value'):
            return obj.value
        return obj
    
    raw_data = analysis.get("raw_data", analysis)
    processed_data = convert_to_serializable(raw_data)
    
    # 添加元数据
    output = {
        "metadata": {
            "analysis_id": analysis.get("id"),
            "timestamp": analysis.get("timestamp", datetime.now().isoformat()),
            "export_time": datetime.now().isoformat(),
            "version": "0.1.0"
        },
        "analysis": processed_data
    }
    
    return json.dumps(output, ensure_ascii=False, indent=indent, default=str)


def export_comparison_to_markdown(comparison: Dict) -> str:
    """将对比结果导出为 Markdown 格式"""
    lines = []
    
    lines.append("# 并发方案对比报告")
    lines.append("")
    
    # 元数据
    lines.append("## 基本信息")
    lines.append("")
    lines.append(f"- **方案 1 ID**: {comparison.get('analysis1_id', 'N/A')}")
    lines.append(f"- **方案 1 时间**: {comparison.get('analysis1_timestamp', 'N/A')}")
    lines.append(f"- **方案 2 ID**: {comparison.get('analysis2_id', 'N/A')}")
    lines.append(f"- **方案 2 时间**: {comparison.get('analysis2_timestamp', 'N/A')}")
    lines.append("")
    
    # 推荐
    if comparison.get("recommendation"):
        lines.append("## 推荐结论")
        lines.append("")
        lines.append(f"> {comparison['recommendation']}")
        lines.append("")
    
    # 改进点
    improvements = comparison.get("improvements", [])
    if improvements:
        lines.append("## ✅ 改进点")
        lines.append("")
        lines.append("| 指标 | 方案 1 | 方案 2 | 改进幅度 |")
        lines.append("|------|--------|--------|----------|")
        for imp in improvements:
            lines.append(f"| {imp.get('metric', 'N/A')} | {imp.get('from', 'N/A')} | {imp.get('to', 'N/A')} | +{imp.get('improvement', 0)} |")
        lines.append("")
    
    # 退步点
    regressions = comparison.get("regressions", [])
    if regressions:
        lines.append("## ❌ 退步点")
        lines.append("")
        lines.append("| 指标 | 方案 1 | 方案 2 | 退步幅度 |")
        lines.append("|------|--------|--------|----------|")
        for reg in regressions:
            lines.append(f"| {reg.get('metric', 'N/A')} | {reg.get('from', 'N/A')} | {reg.get('to', 'N/A')} | -{reg.get('regression', 0)} |")
        lines.append("")
    
    # 差异点
    differences = comparison.get("differences", [])
    if differences:
        lines.append("## 📊 差异点")
        lines.append("")
        lines.append("| 指标 | 方案 1 | 方案 2 | 变化 |")
        lines.append("|------|--------|--------|------|")
        for diff in differences:
            val1 = diff.get("value1", "N/A")
            val2 = diff.get("value2", "N/A")
            change = diff.get("change", "")
            if change != "":
                change = f"+{change}" if change > 0 else str(change)
            lines.append(f"| {diff.get('metric', 'N/A')} | {val1} | {val2} | {change} |")
        lines.append("")
    
    lines.append("---")
    lines.append("")
    lines.append(f"*报告生成时间: {datetime.now().isoformat()}*")
    
    return "\n".join(lines)