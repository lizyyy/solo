import pandas as pd
from datetime import datetime

def generate_summary(matched_df, anomalies_df, headway_df, missing_df):
    summary = {
        '统计日期': datetime.now().strftime('%Y-%m-%d'),
        '计划班次总数': len(matched_df['班次号'].unique()) + len(missing_df),
        '实际到站班次': len(matched_df['班次号'].unique()),
        '匹配率': round(len(matched_df['班次号'].unique()) / (len(matched_df['班次号'].unique()) + len(missing_df)) * 100, 2),
        '平均到站偏差(分钟)': round(matched_df['到站偏差(分钟)'].mean(), 1),
        '平均发车间隔(分钟)': round(headway_df['发车间隔(分钟)'].mean(), 1),
        '异常总数': len(anomalies_df),
        '串车数量': len(anomalies_df[anomalies_df['异常类型'] == '串车']),
        '大间隔数量': len(anomalies_df[anomalies_df['异常类型'] == '大间隔']),
        '漏发数量': len(anomalies_df[anomalies_df['异常类型'] == '漏发']),
        '到站偏差数量': len(anomalies_df[anomalies_df['异常类型'] == '到站偏差']),
        '跨午夜数量': len(anomalies_df[anomalies_df['异常类型'] == '跨午夜数据'])
    }
    return summary

def generate_markdown_report(summary, anomalies_df, matched_df, headway_df):
    md = f"""# 公交调度复盘报告

---

## 📊 概览统计

| 指标 | 数值 |
|------|------|
| 统计日期 | {summary['统计日期']} |
| 计划班次总数 | {summary['计划班次总数']} |
| 实际到站班次 | {summary['实际到站班次']} |
| 匹配率 | {summary['匹配率']}% |
| 平均到站偏差 | {summary['平均到站偏差(分钟)']} 分钟 |
| 平均发车间隔 | {summary['平均发车间隔(分钟)']} 分钟 |
| 异常总数 | {summary['异常总数']} |

---

## 🚨 异常分类统计

| 异常类型 | 数量 |
|----------|------|
| 串车 | {summary['串车数量']} |
| 大间隔 | {summary['大间隔数量']} |
| 漏发 | {summary['漏发数量']} |
| 到站偏差 | {summary['到站偏差数量']} |
| 跨午夜数据 | {summary['跨午夜数量']} |

---

## 📝 异常详情

### 串车异常
{format_anomaly_section(anomalies_df[anomalies_df['异常类型'] == '串车'])}

### 大间隔异常
{format_anomaly_section(anomalies_df[anomalies_df['异常类型'] == '大间隔'])}

### 漏发异常
{format_anomaly_section(anomalies_df[anomalies_df['异常类型'] == '漏发'])}

### 到站偏差异常
{format_anomaly_section(anomalies_df[anomalies_df['异常类型'] == '到站偏差'])}

### 跨午夜数据
{format_anomaly_section(anomalies_df[anomalies_df['异常类型'] == '跨午夜数据'])}

---

## 📈 发车间隔统计

### 发车间隔分布
| 站点 | 平均间隔(分钟) | 最小间隔(分钟) | 最大间隔(分钟) |
|------|---------------|---------------|---------------|
{format_headway_section(headway_df)}

---

## 📋 匹配详情摘要

共匹配 {len(matched_df)} 条到站记录，覆盖 {len(matched_df['班次号'].unique())} 个班次。

---

*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
    return md

def format_anomaly_section(df):
    if len(df) == 0:
        return "无异常记录"
    
    result = "\n| 线路 | 方向 | 站点 | 班次号 | 异常描述 | 可能原因 |\n|------|------|------|--------|----------|----------|\n"
    
    for _, row in df.iterrows():
        line = row.get('线路编号', '-')
        direction = row.get('方向', '-')
        station = row.get('站点名称', '-')
        trip = row.get('班次号', '-')
        desc = row.get('异常描述', '-')
        cause = row.get('可能原因', '-')
        
        result += f"| {line} | {direction} | {station} | {trip} | {desc} | {cause} |\n"
    
    return result

def format_headway_section(df):
    if len(df) == 0:
        return "无数据"
    
    grouped = df.groupby(['站点名称']).agg(
        avg_headway=('发车间隔(分钟)', 'mean'),
        min_headway=('发车间隔(分钟)', 'min'),
        max_headway=('发车间隔(分钟)', 'max')
    ).reset_index()
    
    result = ""
    for _, row in grouped.iterrows():
        result += f"| {row['站点名称']} | {round(row['avg_headway'], 1)} | {round(row['min_headway'], 1)} | {round(row['max_headway'], 1)} |\n"
    
    return result

def export_to_csv(df, filename):
    df.to_csv(filename, index=False, encoding='utf-8-sig')

def export_anomalies_to_csv(anomalies_df, filename):
    export_to_csv(anomalies_df, filename)

def export_matched_to_csv(matched_df, filename):
    export_to_csv(matched_df, filename)

def export_summary_to_csv(summary, filename):
    df = pd.DataFrame([summary])
    export_to_csv(df, filename)