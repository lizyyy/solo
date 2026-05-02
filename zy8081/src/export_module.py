import pandas as pd
import os
from typing import Dict, Any
from datetime import datetime

def export_cleaned_yield(yield_df: pd.DataFrame, output_path: str = 'cleaned_yield.csv') -> str:
    cleaned_df = yield_df.drop_duplicates('plot_id').copy()
    
    plot_counts = yield_df['plot_id'].value_counts()
    duplicate_plots = plot_counts[plot_counts > 1].index.tolist()
    if duplicate_plots:
        cleaned_df['duplicate_flag'] = cleaned_df['plot_id'].isin(duplicate_plots)
    else:
        cleaned_df['duplicate_flag'] = False
    
    cleaned_df['cleaned_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    cleaned_df.to_csv(output_path, index=False, encoding='utf-8-sig')
    return output_path

def export_qc_report(
    yield_df: pd.DataFrame,
    weather_df: pd.DataFrame,
    design: Dict[str, Any],
    anomalies: pd.DataFrame,
    weather_shocks: pd.DataFrame,
    output_path: str = 'qc_report.md'
) -> str:
    report_lines = []
    
    report_lines.append(f"# 田间试验质量控制报告")
    report_lines.append("")
    report_lines.append(f"## 试验信息")
    report_lines.append(f"- **试验名称**: {design.get('trial_name', '未知')}")
    report_lines.append(f"- **试验地点**: {design.get('location', '未知')}")
    report_lines.append(f"- **试验年份**: {design.get('year', '未知')}")
    report_lines.append(f"- **设计类型**: {design.get('design_type', '未知')}")
    report_lines.append(f"- **区组数量**: {design.get('total_blocks', 0)}")
    report_lines.append(f"- **重复次数**: {design.get('total_reps', 0)}")
    report_lines.append(f"- **品种数量**: {len(design.get('varieties', []))}")
    report_lines.append(f"- **生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report_lines.append("")
    
    report_lines.append(f"## 数据概况")
    report_lines.append(f"- **总地块数**: {len(yield_df)}")
    report_lines.append(f"- **有效产量记录**: {yield_df['yield_kg'].notna().sum()}")
    report_lines.append(f"- **缺测地块数**: {yield_df['yield_kg'].isna().sum()}")
    report_lines.append(f"- **重复记录数**: {len(yield_df) - len(yield_df.drop_duplicates('plot_id'))}")
    report_lines.append("")
    
    report_lines.append(f"## 异常统计")
    anomaly_counts = anomalies['anomaly_type'].value_counts().to_dict()
    anomaly_type_map = {
        'missing_yield': '产量缺失',
        'boundary_anomaly': '边界行异常',
        'outlier': '产量异常值',
        'duplicate': '重复记录',
        'missing_rep': '缺失重复'
    }
    
    for key, count in anomaly_counts.items():
        report_lines.append(f"- **{anomaly_type_map.get(key, key)}**: {count} 条")
    report_lines.append("")
    
    report_lines.append(f"## 详细异常列表")
    if not anomalies.empty:
        report_lines.append("| 地块ID | 区组 | 重复 | 品种 | 异常类型 | 描述 |")
        report_lines.append("|--------|------|------|------|----------|------|")
        
        for _, row in anomalies.iterrows():
            plot_id = row.get('plot_id', '-')
            block = row.get('block', '-')
            rep = row.get('rep', '-')
            variety = row.get('variety', '-')
            anomaly_type = anomaly_type_map.get(row.get('anomaly_type', ''), row.get('anomaly_type', ''))
            desc = row.get('anomaly_desc', '')
            
            report_lines.append(f"| {plot_id} | {block} | {rep} | {variety} | {anomaly_type} | {desc} |")
    else:
        report_lines.append("无异常记录")
    report_lines.append("")
    
    report_lines.append(f"## 天气冲击事件")
    if not weather_shocks.empty:
        report_lines.append("| 日期 | 事件类型 | 最高温(°C) | 最低温(°C) | 降雨量(mm) | 风速(km/h) |")
        report_lines.append("|------|----------|------------|------------|------------|------------|")
        
        for _, row in weather_shocks.iterrows():
            date = row['date'].strftime('%Y-%m-%d') if hasattr(row['date'], 'strftime') else str(row['date'])
            shock_type = row.get('shock_type', '')
            temp_max = row.get('temperature_max', '-')
            temp_min = row.get('temperature_min', '-')
            rainfall = row.get('rainfall_mm', '-')
            wind = row.get('wind_speed_kph', '-')
            
            report_lines.append(f"| {date} | {shock_type} | {temp_max} | {temp_min} | {rainfall} | {wind} |")
    else:
        report_lines.append("无天气冲击事件")
    report_lines.append("")
    
    report_lines.append(f"## 区组统计摘要")
    block_stats = yield_df.groupby('block').agg(
        count=('plot_id', 'count'),
        mean_yield=('yield_kg', 'mean'),
        missing=('yield_kg', lambda x: x.isna().sum())
    ).reset_index()
    
    report_lines.append("| 区组 | 地块数 | 平均产量(kg) | 缺测数 |")
    report_lines.append("|------|--------|--------------|--------|")
    
    for _, row in block_stats.iterrows():
        report_lines.append(f"| {row['block']} | {row['count']} | {row['mean_yield']:.2f} | {row['missing']} |")
    report_lines.append("")
    
    report_lines.append(f"## 品种统计摘要")
    variety_stats = yield_df.groupby('variety').agg(
        count=('plot_id', 'count'),
        mean_yield=('yield_kg', 'mean'),
        std_yield=('yield_kg', 'std')
    ).reset_index()
    
    report_lines.append("| 品种 | 地块数 | 平均产量(kg) | 标准差 |")
    report_lines.append("|------|--------|--------------|--------|")
    
    for _, row in variety_stats.iterrows():
        report_lines.append(f"| {row['variety']} | {row['count']} | {row['mean_yield']:.2f} | {row['std_yield']:.2f} |")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(report_lines))
    
    return output_path

def export_all(
    yield_df: pd.DataFrame,
    weather_df: pd.DataFrame,
    design: Dict[str, Any],
    anomalies: pd.DataFrame,
    weather_shocks: pd.DataFrame,
    output_dir: str = '.'
) -> Dict[str, str]:
    os.makedirs(output_dir, exist_ok=True)
    
    yield_path = os.path.join(output_dir, 'cleaned_yield.csv')
    report_path = os.path.join(output_dir, 'qc_report.md')
    
    export_cleaned_yield(yield_df, yield_path)
    export_qc_report(yield_df, weather_df, design, anomalies, weather_shocks, report_path)
    
    return {
        'cleaned_yield': yield_path,
        'qc_report': report_path
    }