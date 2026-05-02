import pandas as pd
import numpy as np
from pathlib import Path
from typing import List, Dict
import plotly.graph_objects as go
from plotly.subplots import make_subplots


def export_alerts(alerts: List[Dict], output_path: Path):
    df = pd.DataFrame(alerts)
    df.to_csv(output_path, index=False)


def export_report(features_df: pd.DataFrame, alerts: List[Dict], output_path: Path):
    total_trips = len(features_df)
    high_alerts = len([a for a in alerts if a["severity"] == "high"])
    medium_alerts = len([a for a in alerts if a["severity"] == "medium"])
    
    with open(output_path, "w") as f:
        f.write("# 电梯维保质量报告\n\n")
        f.write(f"- **总行程数**: {total_trips}\n")
        f.write(f"- **高风险告警**: {high_alerts}\n")
        f.write(f"- **中风险告警**: {medium_alerts}\n\n")
        
        f.write("## 告警详情\n\n")
        if alerts:
            for alert in alerts:
                f.write(f"### {alert['trip_id']}\n")
                f.write(f"- 楼层: {alert['start_floor']} → {alert['end_floor']}\n")
                f.write(f"- 方向: {alert['direction']}\n")
                f.write(f"- 指标: {alert['metric']}\n")
                f.write(f"- 值: {alert['value']:.3f} (阈值: {alert['threshold']})\n")
                f.write(f"- 风险等级: {alert['severity']}\n\n")
        else:
            f.write("无告警\n\n")
        
        f.write("## 特征统计\n\n")
        f.write("| 指标 | 均值 | 中位数 | 最大值 |\n")
        f.write("|------|------|--------|--------|\n")
        metrics = ["peak_ax", "peak_ay", "peak_az", "rms_ax", "rms_ay", "rms_az", 
                  "jerk_ax", "stop_deviation", "door_jitter"]
        for metric in metrics:
            if metric in features_df.columns:
                mean_val = features_df[metric].mean()
                median_val = features_df[metric].median()
                max_val = features_df[metric].max()
                f.write(f"| {metric} | {mean_val:.3f} | {median_val:.3f} | {max_val:.3f} |\n")
        f.write("\n")


def export_trend_plot(features_df: pd.DataFrame, trips: List[Dict], output_path: Path):
    fig = make_subplots(
        rows=3, cols=2,
        subplot_titles=("Peak Acceleration", "RMS Acceleration", 
                       "Jerk", "Stop Deviation", "Door Jitter", "Duration"),
        specs=[[{"secondary_y": False}, {"secondary_y": False}],
               [{"secondary_y": False}, {"secondary_y": False}],
               [{"secondary_y": False}, {"secondary_y": False}]]
    )
    
    trip_ids = features_df["trip_id"].tolist()
    
    fig.add_trace(go.Scatter(x=trip_ids, y=features_df["peak_ax"], name="peak_ax", mode="lines+markers"), row=1, col=1)
    fig.add_trace(go.Scatter(x=trip_ids, y=features_df["peak_ay"], name="peak_ay", mode="lines+markers"), row=1, col=1)
    fig.add_trace(go.Scatter(x=trip_ids, y=features_df["peak_az"], name="peak_az", mode="lines+markers"), row=1, col=1)
    
    fig.add_trace(go.Scatter(x=trip_ids, y=features_df["rms_ax"], name="rms_ax", mode="lines+markers"), row=1, col=2)
    fig.add_trace(go.Scatter(x=trip_ids, y=features_df["rms_ay"], name="rms_ay", mode="lines+markers"), row=1, col=2)
    fig.add_trace(go.Scatter(x=trip_ids, y=features_df["rms_az"], name="rms_az", mode="lines+markers"), row=1, col=2)
    
    fig.add_trace(go.Scatter(x=trip_ids, y=features_df["jerk_ax"], name="jerk_ax", mode="lines+markers"), row=2, col=1)
    
    fig.add_trace(go.Scatter(x=trip_ids, y=features_df["stop_deviation"], name="stop_deviation", mode="lines+markers"), row=2, col=2)
    
    fig.add_trace(go.Scatter(x=trip_ids, y=features_df["door_jitter"], name="door_jitter", mode="lines+markers"), row=3, col=1)
    
    fig.add_trace(go.Scatter(x=trip_ids, y=features_df["duration"], name="duration", mode="lines+markers"), row=3, col=2)
    
    fig.update_layout(height=900, title_text="电梯运行质量趋势图")
    fig.write_html(output_path)
