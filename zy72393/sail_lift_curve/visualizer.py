import plotly.graph_objects as go
from plotly.subplots import make_subplots
import numpy as np
from typing import List, Optional

from .models import LiftCurveData, EquipmentRecord, ThresholdRecord


def _add_threshold_annotations(fig, indices, record_ids, equipment_ids, values, angles, color, name, symbol):
    if indices:
        x_vals = [angles[i] for i in indices]
        y_vals = [values[i] for i in indices]
        customdata = [
            {
                "record_id": record_ids[i],
                "equipment_id": equipment_ids[i],
                "index": i,
            }
            for i in indices
        ]
        fig.add_trace(go.Scatter(
            x=x_vals,
            y=y_vals,
            mode="markers",
            marker=dict(color=color, size=12, symbol=symbol, line=dict(width=2, color="white")),
            name=name,
            text=[f"记录ID: {record_ids[i]}<br>设备: {equipment_ids[i]}" for i in indices],
            hoverinfo="text",
            customdata=customdata,
        ))


def plot_lift_curve_2d(
    curve_data: LiftCurveData,
    records: Optional[List[EquipmentRecord]] = None,
    threshold_records: Optional[List[ThresholdRecord]] = None,
    title: str = "实验风帆升力曲线",
    output_file: Optional[str] = None,
) -> go.Figure:
    fig = go.Figure()

    angles = np.array(curve_data.angles)
    lift_coeffs = np.array(curve_data.lift_coefficients)
    
    sort_idx = np.argsort(angles)
    angles_sorted = angles[sort_idx]
    lift_sorted = lift_coeffs[sort_idx]

    fig.add_trace(go.Scatter(
        x=angles_sorted,
        y=lift_sorted,
        mode="lines+markers",
        name="升力系数",
        line=dict(color="#1f77b4", width=2),
        marker=dict(color="#1f77b4", size=6),
        hovertemplate="攻角: %{x}°<br>升力系数: %{y:.3f}<extra></extra>",
    ))

    if records:
        normal_indices = [
            i for i, r in enumerate(records)
            if r.status == "正常"
        ]
        if normal_indices:
            x_norm = [angles[i] for i in normal_indices]
            y_norm = [lift_coeffs[i] for i in normal_indices]
            fig.add_trace(go.Scatter(
                x=x_norm,
                y=y_norm,
                mode="markers",
                marker=dict(color="#2ca02c", size=8, symbol="circle"),
                name="正常数据",
                hoverinfo="skip",
                showlegend=True,
            ))

    _add_threshold_annotations(
        fig,
        curve_data.outlier_indices,
        curve_data.record_ids,
        curve_data.equipment_ids,
        lift_coeffs,
        angles,
        "#ff7f0e",
        "超阈值",
        "triangle-up",
    )

    _add_threshold_annotations(
        fig,
        curve_data.hidden_outlier_indices,
        curve_data.record_ids,
        curve_data.equipment_ids,
        lift_coeffs,
        angles,
        "#d62728",
        "被平均值盖掉 ⚠️",
        "diamond",
    )

    if threshold_records:
        for t in threshold_records:
            if t.hidden_by_averaging:
                for i, rid in enumerate(curve_data.record_ids):
                    if rid == t.equipment_record_id:
                        fig.add_annotation(
                            x=angles[i],
                            y=lift_coeffs[i],
                            text=f"偏离{int(t.deviation_percent)}%",
                            showarrow=True,
                            arrowhead=2,
                            arrowsize=1,
                            arrowwidth=2,
                            arrowcolor="#d62728",
                            font=dict(color="#d62728", size=10),
                            ax=40,
                            ay=-30,
                        )
                        break

    fig.update_layout(
        title=dict(
            text=title,
            font=dict(size=18, color="#2c3e50"),
            x=0.5,
        ),
        xaxis_title=dict(text="攻角 (°)", font=dict(size=14)),
        yaxis_title=dict(text="升力系数 Cl", font=dict(size=14)),
        hovermode="closest",
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1,
        ),
        plot_bgcolor="white",
        margin=dict(l=60, r=40, t=80, b=60),
    )

    fig.update_xaxes(showgrid=True, gridcolor="#f0f0f0", zeroline=False)
    fig.update_yaxes(showgrid=True, gridcolor="#f0f0f0", zeroline=False)

    if output_file:
        fig.write_html(output_file, include_plotlyjs="cdn")

    return fig


def plot_lift_curve_3d(
    curve_data: LiftCurveData,
    records: Optional[List[EquipmentRecord]] = None,
    threshold_records: Optional[List[ThresholdRecord]] = None,
    title: str = "实验风帆升力曲线 (3D视图)",
    output_file: Optional[str] = None,
) -> go.Figure:
    fig = go.Figure()

    angles = np.array(curve_data.angles)
    lift_coeffs = np.array(curve_data.lift_coefficients)
    wind_speeds = np.array(curve_data.wind_speeds)

    fig.add_trace(go.Scatter3d(
        x=angles,
        y=wind_speeds,
        z=lift_coeffs,
        mode="lines+markers",
        name="升力系数",
        line=dict(color="#1f77b4", width=3),
        marker=dict(color="#1f77b4", size=4),
        hovertemplate="攻角: %{x}°<br>风速: %{y} m/s<br>升力系数: %{z:.3f}<extra></extra>",
    ))

    if curve_data.hidden_outlier_indices:
        hidden_idx = curve_data.hidden_outlier_indices
        fig.add_trace(go.Scatter3d(
            x=[angles[i] for i in hidden_idx],
            y=[wind_speeds[i] for i in hidden_idx],
            z=[lift_coeffs[i] for i in hidden_idx],
            mode="markers",
            marker=dict(color="#d62728", size=8, symbol="diamond", line=dict(width=2, color="white")),
            name="被平均值盖掉 ⚠️",
            text=[f"记录ID: {curve_data.record_ids[i]}<br>设备: {curve_data.equipment_ids[i]}" for i in hidden_idx],
            hoverinfo="text",
        ))

    if curve_data.outlier_indices:
        out_idx = curve_data.outlier_indices
        fig.add_trace(go.Scatter3d(
            x=[angles[i] for i in out_idx],
            y=[wind_speeds[i] for i in out_idx],
            z=[lift_coeffs[i] for i in out_idx],
            mode="markers",
            marker=dict(color="#ff7f0e", size=8, symbol="triangle-up", line=dict(width=2, color="white")),
            name="超阈值",
            text=[f"记录ID: {curve_data.record_ids[i]}<br>设备: {curve_data.equipment_ids[i]}" for i in out_idx],
            hoverinfo="text",
        ))

    fig.update_layout(
        title=dict(
            text=title,
            font=dict(size=18, color="#2c3e50"),
            x=0.5,
        ),
        scene=dict(
            xaxis_title=dict(text="攻角 (°)", font=dict(size=12)),
            yaxis_title=dict(text="风速 (m/s)", font=dict(size=12)),
            zaxis_title=dict(text="升力系数 Cl", font=dict(size=12)),
            bgcolor="white",
        ),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1,
        ),
        margin=dict(l=40, r=40, t=80, b=40),
    )

    if output_file:
        fig.write_html(output_file, include_plotlyjs="cdn")

    return fig


def generate_summary_chart(
    records: List[EquipmentRecord],
    threshold_records: List[ThresholdRecord],
    output_file: Optional[str] = None,
) -> go.Figure:
    status_counts = {}
    for r in records:
        status = r.status
        status_counts[status] = status_counts.get(status, 0) + 1

    labels = list(status_counts.keys())
    values = list(status_counts.values())
    
    colors = []
    for label in labels:
        if label == "正常":
            colors.append("#2ca02c")
        elif label == "超阈值":
            colors.append("#ff7f0e")
        elif label == "被平均值盖掉":
            colors.append("#d62728")
        elif label == "老岑已确认":
            colors.append("#9467bd")
        else:
            colors.append("#7f7f7f")

    fig = make_subplots(
        rows=1, cols=2,
        specs=[[{"type": "pie"}, {"type": "bar"}]],
        subplot_titles=("数据状态分布", "各状态数量统计"),
    )

    fig.add_trace(go.Pie(
        labels=labels,
        values=values,
        marker=dict(colors=colors),
        textinfo="label+percent",
        hole=0.4,
    ), row=1, col=1)

    fig.add_trace(go.Bar(
        x=labels,
        y=values,
        marker_color=colors,
        text=values,
        textposition="auto",
    ), row=1, col=2)

    fig.update_layout(
        title=dict(
            text="数据质量概览",
            font=dict(size=16, color="#2c3e50"),
            x=0.5,
        ),
        showlegend=False,
        height=400,
    )

    if output_file:
        fig.write_html(output_file, include_plotlyjs="cdn")

    return fig
