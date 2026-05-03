import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots


def plot_noise_trend(
    decibel_df: pd.DataFrame,
    freq: str = '1H',
    show_threshold: bool = True,
    night_threshold: float = 55.0,
    day_threshold: float = 70.0
) -> Optional[go.Figure]:
    """
    绘制噪声趋势图
    
    参数:
    - decibel_df: 分贝仪数据DataFrame
    - freq: 聚合频率 ('15T', '1H', '1D'等)
    - show_threshold: 是否显示阈值线
    - night_threshold: 夜间阈值
    - day_threshold: 昼间阈值
    
    返回:
    - Plotly Figure对象
    """
    if decibel_df.empty:
        return None
    
    df = decibel_df.copy()
    
    # 确保有时间戳和分贝值
    if 'timestamp' not in df.columns or 'db_value' not in df.columns:
        return None
    
    # 设置时间索引并聚合
    df = df.set_index('timestamp').copy()
    
    # 聚合数据
    agg_df = df.resample(freq).agg({
        'db_value': ['mean', 'max', 'min', 'count'],
        'exceeds_standard': ['sum']
    }).reset_index()
    
    # 展平列名
    agg_df.columns = ['timestamp' if col[0] == 'timestamp' else '_'.join(col).strip('_') 
                     for col in agg_df.columns.values]
    
    # 准备绘图数据
    fig = go.Figure()
    
    # 平均值线
    fig.add_trace(go.Scatter(
        x=agg_df['timestamp'],
        y=agg_df['db_value_mean'],
        mode='lines+markers',
        name='平均分贝',
        line=dict(color='#1f77b4', width=2),
        marker=dict(size=6)
    ))
    
    # 最大值线
    fig.add_trace(go.Scatter(
        x=agg_df['timestamp'],
        y=agg_df['db_value_max'],
        mode='lines',
        name='最大分贝',
        line=dict(color='#ff7f0e', width=1, dash='dash'),
        opacity=0.7
    ))
    
    # 最小值填充区域
    fig.add_trace(go.Scatter(
        x=agg_df['timestamp'],
        y=agg_df['db_value_min'],
        mode='lines',
        name='最小分贝',
        line=dict(color='#ff7f0e', width=1, dash='dash'),
        opacity=0.7,
        fill='tonexty'
    ))
    
    # 添加阈值线
    if show_threshold:
        # 夜间时间段标记
        fig.add_hline(
            y=night_threshold,
            line=dict(color='#d62728', width=2, dash='dot'),
            annotation_text=f'夜间阈值 ({night_threshold}dB)',
            annotation_position='top left'
        )
        
        fig.add_hline(
            y=day_threshold,
            line=dict(color='#9467bd', width=2, dash='dot'),
            annotation_text=f'昼间阈值 ({day_threshold}dB)',
            annotation_position='top right'
        )
    
    # 标记超标时间段
    if 'exceeds_standard_sum' in agg_df.columns:
        exceed_df = agg_df[agg_df['exceeds_standard_sum'] > 0]
        if not exceed_df.empty:
            fig.add_trace(go.Scatter(
                x=exceed_df['timestamp'],
                y=exceed_df['db_value_max'],
                mode='markers',
                name='超标记录',
                marker=dict(color='#d62728', size=10, symbol='circle'),
                opacity=0.8
            ))
    
    # 更新布局
    fig.update_layout(
        title='噪声水平趋势图',
        xaxis_title='时间',
        yaxis_title='分贝值 (dB)',
        legend=dict(orientation='h', yanchor='bottom', y=1.02, xanchor='right', x=1),
        hovermode='x unified',
        height=400
    )
    
    # 添加夜间背景
    fig.update_layout(
        shapes=[
            dict(
                type="rect",
                xref="paper",
                yref="y",
                x0=0,
                y0=0,
                x1=1,
                y1=night_threshold,
                fillcolor="rgba(255, 99, 71, 0.1)",
                layer="below",
                line_width=0,
            )
        ]
    )
    
    return fig


def plot_complaint_distribution(
    complaints_df: pd.DataFrame,
    group_by: str = 'community'
) -> Optional[go.Figure]:
    """
    绘制投诉分布图
    
    参数:
    - complaints_df: 投诉数据DataFrame
    - group_by: 分组字段 ('community', 'noise_source', 'hour')
    
    返回:
    - Plotly Figure对象
    """
    if complaints_df.empty:
        return None
    
    df = complaints_df.copy()
    
    # 确保必要的列存在
    if 'complaint_id' not in df.columns:
        return None
    
    # 根据分组字段处理
    if group_by == 'community':
        if 'community' not in df.columns:
            return None
        title = '各小区投诉分布'
        x_label = '小区'
    elif group_by == 'noise_source':
        if 'noise_source' not in df.columns:
            return None
        title = '噪声源投诉分布'
        x_label = '噪声源类型'
    elif group_by == 'hour':
        if 'hour' not in df.columns:
            return None
        title = '投诉时间分布'
        x_label = '小时'
        # 确保所有小时都显示
        all_hours = pd.DataFrame({'hour': range(24)})
        hour_counts = df['hour'].value_counts().reset_index()
        hour_counts.columns = ['hour', 'count']
        merged = pd.merge(all_hours, hour_counts, on='hour', how='left').fillna(0)
        fig = px.bar(
            merged,
            x='hour',
            y='count',
            title=title,
            labels={'hour': x_label, 'count': '投诉数量'},
            color='count',
            color_continuous_scale='Viridis'
        )
        fig.update_layout(height=400, xaxis=dict(tickmode='linear', tick0=0, dtick=2))
        return fig
    else:
        return None
    
    # 统计数量
    count_df = df[group_by].value_counts().reset_index()
    count_df.columns = [group_by, 'count']
    
    # 绘制柱状图
    fig = px.bar(
        count_df,
        x=group_by,
        y='count',
        title=title,
        labels={group_by: x_label, 'count': '投诉数量'},
        color='count',
        color_continuous_scale='Blues',
        text='count'
    )
    
    # 更新布局
    fig.update_layout(
        height=400,
        xaxis_tickangle=-45,
        xaxis_title=x_label,
        yaxis_title='投诉数量'
    )
    
    fig.update_traces(textposition='outside')
    
    return fig


def plot_response_time_distribution(
    response_df: pd.DataFrame
) -> Optional[go.Figure]:
    """
    绘制响应时间分布图
    
    参数:
    - response_df: 包含响应时间的DataFrame
    
    返回:
    - Plotly Figure对象
    """
    if response_df.empty or 'response_time_minutes' not in response_df.columns:
        return None
    
    df = response_df.copy()
    
    # 过滤掉空值
    df = df[df['response_time_minutes'].notna()]
    
    if df.empty:
        return None
    
    # 创建分类
    def categorize_response(minutes):
        if minutes < 15:
            return '快速响应 (<15分钟)'
        elif minutes < 30:
            return '正常响应 (15-30分钟)'
        elif minutes < 60:
            return '较慢响应 (30-60分钟)'
        else:
            return '延迟响应 (>60分钟)'
    
    df['response_category'] = df['response_time_minutes'].apply(categorize_response)
    
    # 创建子图
    fig = make_subplots(
        rows=1, cols=2,
        subplot_titles=('响应时间分类分布', '响应时间散点图'),
        specs=[[{"type": "pie"}, {"type": "box"}]]
    )
    
    # 饼图
    category_counts = df['response_category'].value_counts().reset_index()
    category_counts.columns = ['category', 'count']
    
    colors = ['#2ca02c', '#1f77b4', '#ff7f0e', '#d62728']
    fig.add_trace(
        go.Pie(
            labels=category_counts['category'],
            values=category_counts['count'],
            name='响应分类',
            marker=dict(colors=colors),
            textinfo='percent+label'
        ),
        row=1, col=1
    )
    
    # 箱线图
    fig.add_trace(
        go.Box(
            y=df['response_time_minutes'],
            name='响应时间',
            marker_color='#1f77b4',
            boxmean=True
        ),
        row=1, col=2
    )
    
    # 更新布局
    fig.update_layout(
        title='执法响应时间分析',
        height=400,
        showlegend=False
    )
    
    fig.update_yaxes(title_text='分钟', row=1, col=2)
    
    return fig


def plot_violation_summary(
    violations_df: pd.DataFrame
) -> Optional[go.Figure]:
    """
    绘制违规摘要图
    
    参数:
    - violations_df: 违规数据DataFrame
    
    返回:
    - Plotly Figure对象
    """
    if violations_df.empty:
        return None
    
    df = violations_df.copy()
    
    # 确保必要的列存在
    required_cols = ['violation_type', 'severity']
    for col in required_cols:
        if col not in df.columns:
            return None
    
    # 创建子图
    fig = make_subplots(
        rows=1, cols=2,
        subplot_titles=('违规类型分布', '严重程度分布'),
        specs=[[{"type": "bar"}, {"type": "pie"}]]
    )
    
    # 违规类型分布
    type_counts = df['violation_type'].value_counts().reset_index()
    type_counts.columns = ['violation_type', 'count']
    
    fig.add_trace(
        go.Bar(
            x=type_counts['violation_type'],
            y=type_counts['count'],
            name='违规类型',
            marker_color='#1f77b4',
            text=type_counts['count']
        ),
        row=1, col=1
    )
    
    # 严重程度分布
    severity_counts = df['severity'].value_counts().reset_index()
    severity_counts.columns = ['severity', 'count']
    
    severity_colors = {
        'high': '#d62728',
        'medium': '#ff7f0e',
        'low': '#2ca02c'
    }
    
    fig.add_trace(
        go.Pie(
            labels=severity_counts['severity'],
            values=severity_counts['count'],
            name='严重程度',
            marker=dict(colors=[severity_colors.get(s, '#9467bd') for s in severity_counts['severity']]),
            textinfo='percent+label'
        ),
        row=1, col=2
    )
    
    # 更新布局
    fig.update_layout(
        title='违规情况摘要',
        height=400,
        showlegend=False
    )
    
    fig.update_xaxes(tickangle=-30, row=1, col=1)
    fig.update_yaxes(title_text='数量', row=1, col=1)
    
    return fig


def plot_hourly_heatmap(
    decibel_df: pd.DataFrame
) -> Optional[go.Figure]:
    """
    绘制小时热力图，展示各时段噪声水平
    
    参数:
    - decibel_df: 分贝仪数据DataFrame
    
    返回:
    - Plotly Figure对象
    """
    if decibel_df.empty:
        return None
    
    df = decibel_df.copy()
    
    # 确保必要的列存在
    required_cols = ['timestamp', 'db_value']
    for col in required_cols:
        if col not in df.columns:
            return None
    
    # 提取星期几和小时
    df['day_of_week'] = df['timestamp'].dt.day_name()
    df['hour'] = df['timestamp'].dt.hour
    
    # 按星期和小时聚合
    pivot_df = df.pivot_table(
        index='day_of_week',
        columns='hour',
        values='db_value',
        aggfunc='mean'
    )
    
    # 重排星期顺序
    day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    day_order_cn = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    day_mapping = dict(zip(day_order, day_order_cn))
    
    # 确保所有天都存在
    for day in day_order:
        if day not in pivot_df.index:
            pivot_df.loc[day] = np.nan
    
    pivot_df = pivot_df.reindex(day_order)
    pivot_df.index = pivot_df.index.map(day_mapping)
    
    # 绘制热力图
    fig = go.Figure(data=go.Heatmap(
        z=pivot_df.values,
        x=pivot_df.columns,
        y=pivot_df.index,
        colorscale='RdYlGn_r',
        colorbar=dict(title='平均分贝'),
        hoverongaps=False
    ))
    
    # 添加阈值线
    fig.add_hline(y=0.5, line=dict(color='white', width=2), opacity=0.3)
    
    # 更新布局
    fig.update_layout(
        title='噪声水平时段热力图',
        xaxis_title='小时',
        yaxis_title='星期',
        height=400,
        xaxis=dict(tickmode='linear', tick0=0, dtick=2)
    )
    
    return fig


def plot_comparison_chart(
    data_dict: Dict[str, pd.DataFrame],
    value_col: str,
    title: str
) -> Optional[go.Figure]:
    """
    绘制多数据对比图
    
    参数:
    - data_dict: 字典，键为系列名称，值为DataFrame
    - value_col: 值列名
    - title: 图表标题
    
    返回:
    - Plotly Figure对象
    """
    if not data_dict:
        return None
    
    fig = go.Figure()
    
    colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd']
    
    for i, (name, df) in enumerate(data_dict.items()):
        if df.empty or value_col not in df.columns:
            continue
        
        if 'timestamp' in df.columns:
            fig.add_trace(go.Scatter(
                x=df['timestamp'],
                y=df[value_col],
                mode='lines',
                name=name,
                line=dict(color=colors[i % len(colors)], width=2)
            ))
    
    fig.update_layout(
        title=title,
        xaxis_title='时间',
        yaxis_title=value_col,
        height=400,
        legend=dict(orientation='h', yanchor='bottom', y=1.02, xanchor='right', x=1)
    )
    
    return fig
