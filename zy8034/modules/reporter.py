import pandas as pd
from datetime import datetime
from typing import Dict, List
from .rule_calculator import get_summary_stats, detect_carousel_conflicts, calculate_reassignment_impact


def generate_markdown_report(
    metrics_df: pd.DataFrame,
    conflicts: List[Dict],
    reassignments: List[Dict],
    date_filter: str,
    terminal_filter: str
) -> str:
    stats = get_summary_stats(metrics_df)
    
    report = f"""# 机场行李转盘拥堵复盘报告

**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 筛选条件
- **日期**: {date_filter}
- **航站楼**: {terminal_filter}

---

## 总体统计

| 指标 | 数值 |
|------|------|
| 总航班数 | {stats['total_flights']} |
| 首件延迟航班数 | {stats['flights_with_first_delay']} |
| 末件超时航班数 | {stats['flights_with_last_overtime']} |
| 首件扫描缺失 | {stats['flights_missing_first']} |
| 末件扫描缺失 | {stats['flights_missing_last']} |
| 有人工干预航班数 | {stats['flights_with_intervention']} |
| 平均首件延迟(分钟) | {stats['avg_first_delay_minutes']} |
| 平均末件超时(分钟) | {stats['avg_last_overtime_minutes']} |

---

## 航班详情

| 航班号 | 航站楼 | 转盘 | 预计首件 | 实际首件 | 首件延迟(分) | 预计末件 | 实际末件 | 末件超时(分) | 行李数 | 干预 |
|--------|--------|------|----------|----------|--------------|----------|----------|--------------|--------|------|
"""
    
    for _, flight in metrics_df.iterrows():
        exp_first = flight['expected_first_bag'].strftime('%H:%M') if pd.notna(flight['expected_first_bag']) else '-'
        act_first = flight['actual_first_bag'].strftime('%H:%M') if pd.notna(flight['actual_first_bag']) else '-'
        exp_last = flight['expected_last_bag'].strftime('%H:%M') if pd.notna(flight['expected_last_bag']) else '-'
        act_last = flight['actual_last_bag'].strftime('%H:%M') if pd.notna(flight['actual_last_bag']) else '-'
        
        first_delay = flight['first_delay_minutes'] if pd.notna(flight['first_delay_minutes']) else '-'
        last_overtime = flight['last_overtime_minutes'] if pd.notna(flight['last_overtime_minutes']) else '-'
        
        intervention = '是' if flight['has_intervention'] else '否'
        
        report += f"| {flight['flight_num']} | {flight['terminal']} | {flight['carousel'] or '-'} | {exp_first} | {act_first} | {first_delay} | {exp_last} | {act_last} | {last_overtime} | {flight['bag_count']} | {intervention} |\n"
    
    if conflicts:
        report += """
---

## 转盘容量冲突

"""
        for conflict in conflicts:
            report += f"- **转盘 {conflict['carousel']}**: {conflict['flight1']} 和 {conflict['flight2']} 冲突 {conflict['overlap_minutes']} 分钟\n"
    
    if reassignments:
        report += """
---

## 改派影响

"""
        for reassignment in reassignments:
            report += f"- **航班 {reassignment['flight_num']}**: 从 {reassignment['original_carousel']} 改派到 {reassignment['new_carousel']}, 原因: {reassignment['reason']}\n"
    
    report += "\n---\n*本报告由行李转盘复盘系统自动生成*"
    
    return report


def generate_csv_report(metrics_df: pd.DataFrame) -> str:
    export_cols = [
        'flight_num', 'arrival_date', 'terminal', 'carousel',
        'expected_first_bag', 'actual_first_bag', 'first_delay_minutes', 'first_missing',
        'expected_last_bag', 'actual_last_bag', 'last_overtime_minutes', 'last_missing',
        'bag_count', 'has_intervention', 'intervention_type'
    ]
    
    export_df = metrics_df[export_cols].copy()
    
    for col in ['expected_first_bag', 'actual_first_bag', 'expected_last_bag', 'actual_last_bag']:
        if col in export_df.columns:
            export_df[col] = export_df[col].dt.strftime('%Y-%m-%d %H:%M:%S')
    
    return export_df.to_csv(index=False, encoding='utf-8-sig')
