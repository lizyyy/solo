import csv
from typing import Dict, List, Any
from datetime import datetime

from .models import DefectSegment, Violation, SampledPoint, TrackSection


def indicator_name(indicator: str) -> str:
    """指标中文名称映射"""
    names = {
        'track_gauge': '轨距',
        'level': '水平',
        'alignment': '轨向',
        'profile': '高低'
    }
    return names.get(indicator, indicator)


def export_issues_csv(
    defects: List[DefectSegment],
    output_path: str
):
    """
    导出病害段列表到 CSV 文件
    """
    with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            '优先级', '等级', '起始里程(km)', '结束里程(km)', '长度(m)',
            '涉及指标', '区间类型', '总扣分', '最大单级扣分'
        ])
        
        for defect in defects:
            indicator_names = [indicator_name(i) for i in defect.indicators]
            writer.writerow([
                defect.priority,
                defect.level,
                f"{defect.start_mileage:.3f}",
                f"{defect.end_mileage:.3f}",
                f"{defect.length * 1000:.1f}",
                ','.join(indicator_names),
                defect.section_type,
                defect.total_score,
                defect.max_score
            ])


def export_report_md(
    defects: List[DefectSegment],
    violations: List[Violation],
    sampled_points: List[SampledPoint],
    sections: List[TrackSection],
    output_path: str,
    analysis_time: datetime = None
):
    """
    导出详细分析报告到 Markdown 文件
    """
    if analysis_time is None:
        analysis_time = datetime.now()
    
    total_mileage = 0
    if sections:
        total_mileage = sections[-1].end_km - sections[0].start_km
    
    stats = calculate_statistics(defects, violations, sampled_points)
    
    report = f"""# 轨检车数据复核报告

## 基本信息

| 项目 | 内容 |
|------|------|
| 分析时间 | {analysis_time.strftime('%Y-%m-%d %H:%M:%S')} |
| 检测里程范围 | {sampled_points[0].mileage:.3f}km - {sampled_points[-1].mileage:.3f}km |
| 总里程 | {total_mileage:.2f}km |
| 采样点数量 | {len(sampled_points)} 个 |

---

## 统计摘要

### 超限统计

| 指标 | 超限点数 | 占比 |
|------|---------|------|
"""
    
    for indicator, count in stats['violations_by_indicator'].items():
        pct = count / len(sampled_points) * 100 if sampled_points else 0
        report += f"| {indicator_name(indicator)} | {count} | {pct:.2f}% |\n"
    
    report += """
### 病害段统计

| 优先级 | 数量 | 总长度(m) |
|--------|------|-----------|
"""
    
    for priority, count in stats['defects_by_priority'].items():
        total_length = stats['length_by_priority'].get(priority, 0)
        report += f"| {priority} | {count} | {total_length:.1f} |\n"
    
    report += f"""
### 扣分汇总

| 项目 | 分数 |
|------|------|
| 总扣分数 | {stats['total_score']} 分 |
| 平均每公里扣分 | {stats['total_score'] / total_mileage:.1f} 分/km |

---

## 病害段详细列表

按维修优先级排序：

"""
    
    if not defects:
        report += "**无超限病害段**\n"
    else:
        for i, defect in enumerate(defects, 1):
            indicator_names = [indicator_name(ind) for ind in defect.indicators]
            report += f"""
### 病害段 #{i}

| 属性 | 值 |
|------|-----|
| 优先级 | {defect.priority} |
| 等级 | {defect.level} |
| 里程范围 | {defect.start_mileage:.3f}km - {defect.end_mileage:.3f}km |
| 长度 | {defect.length * 1000:.1f}m |
| 涉及指标 | {', '.join(indicator_names)} |
| 区间类型 | {defect.section_type} |
| 总扣分 | {defect.total_score} 分 |
| 最大单级扣分 | {defect.max_score} 分 |

"""
    
    report += """
---

## 维修建议

"""
    
    priority_defects = [d for d in defects if d.priority == '紧急']
    if priority_defects:
        report += f"""
### 紧急处理

发现 {len(priority_defects)} 个紧急病害段，建议立即安排维修：

"""
        for defect in priority_defects:
            indicator_names = [indicator_name(ind) for ind in defect.indicators]
            report += f"- {defect.start_mileage:.3f}km - {defect.end_mileage:.3f}km ({', '.join(indicator_names)}，扣分{defect.total_score}分)\n"
    
    high_defects = [d for d in defects if d.priority == '高']
    if high_defects:
        report += f"""
### 优先处理

发现 {len(high_defects)} 个高优先级病害段，建议本周内安排维修：

"""
        for defect in high_defects:
            indicator_names = [indicator_name(ind) for ind in defect.indicators]
            report += f"- {defect.start_mileage:.3f}km - {defect.end_mileage:.3f}km ({', '.join(indicator_names)}，扣分{defect.total_score}分)\n"
    
    report += """
---

*报告由轨检车数据复核工具自动生成*
"""
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(report)


def calculate_statistics(
    defects: List[DefectSegment],
    violations: List[Violation],
    sampled_points: List[SampledPoint]
) -> Dict[str, Any]:
    """计算统计数据"""
    from collections import defaultdict
    
    violations_by_indicator = defaultdict(int)
    for v in violations:
        violations_by_indicator[v.indicator] += 1
    
    defects_by_priority = defaultdict(int)
    length_by_priority = defaultdict(float)
    total_score = 0
    
    for d in defects:
        defects_by_priority[d.priority] += 1
        length_by_priority[d.priority] += d.length * 1000
        total_score += d.total_score
    
    return {
        'violations_by_indicator': dict(violations_by_indicator),
        'defects_by_priority': dict(defects_by_priority),
        'length_by_priority': dict(length_by_priority),
        'total_score': total_score
    }
