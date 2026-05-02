import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import plotly.express as px


class RoastVisualizer:
    COLORS = {
        'bean_temp': '#E63946',
        'env_temp': '#457B9D',
        'ror': '#2A9D8F',
        'ror_smoothed': '#264653',
        'power': '#F4A261',
        'damper': '#E9C46A',
        'comparison': ['#E63946', '#457B9D', '#2A9D8F', '#F4A261']
    }

    EVENT_MARKERS = {
        'charge': {'symbol': 'circle', 'color': '#6A0572', 'name': '入豆', 'size': 12},
        'turning_point': {'symbol': 'triangle-up', 'color': '#1A936F', 'name': '回温点', 'size': 12},
        'yellow': {'symbol': 'diamond', 'color': '#F4D03F', 'name': '黄点', 'size': 12},
        'first_crack_start': {'symbol': 'star', 'color': '#E74C3C', 'name': '一爆开始', 'size': 14},
        'first_crack_end': {'symbol': 'star-open', 'color': '#C0392B', 'name': '一爆结束', 'size': 14},
        'second_crack_start': {'symbol': 'hexagram', 'color': '#8E44AD', 'name': '二爆开始', 'size': 14},
        'second_crack_end': {'symbol': 'hexagram-open', 'color': '#6C3483', 'name': '二爆结束', 'size': 14},
        'drop': {'symbol': 'square', 'color': '#2C3E50', 'name': '下豆', 'size': 12}
    }

    def __init__(self):
        self.event_names = {
            'charge': '入豆',
            'turning_point': '回温点',
            'yellow': '黄点',
            'first_crack_start': '一爆开始',
            'first_crack_end': '一爆结束',
            'second_crack_start': '二爆开始',
            'second_crack_end': '二爆结束',
            'drop': '下豆'
        }

    def create_roast_curve(self, df: pd.DataFrame, events: Dict = None, 
                            title: str = "烘焙曲线", show_ror: bool = True) -> go.Figure:
        if events is None:
            events = {}

        valid_data = df[df['time_seconds'].notna()].copy()
        if len(valid_data) == 0:
            fig = go.Figure()
            fig.add_annotation(text="无有效数据", xref="paper", yref="paper", x=0.5, y=0.5, showarrow=False)
            return fig

        if show_ror and 'ror_smoothed' in df.columns:
            fig = make_subplots(
                rows=2, cols=1,
                shared_xaxes=True,
                vertical_spacing=0.05,
                row_heights=[0.7, 0.3],
                subplot_titles=("温度曲线", "RoR (升温率)")
            )
        else:
            fig = make_subplots(rows=1, cols=1)

        time_min = valid_data['time_seconds'].min()
        time_max = valid_data['time_seconds'].max()
        time_range = time_max - time_min

        if 'bean_temp' in valid_data.columns:
            bean_temp_data = valid_data[valid_data['bean_temp'].notna()]
            if len(bean_temp_data) > 0:
                fig.add_trace(
                    go.Scatter(
                        x=bean_temp_data['time_seconds'],
                        y=bean_temp_data['bean_temp'],
                        mode='lines',
                        name='豆温 (BT)',
                        line=dict(color=self.COLORS['bean_temp'], width=2.5),
                        hovertemplate='时间: %{x:.1f}s<br>豆温: %{y:.1f}°C<extra></extra>'
                    ),
                    row=1, col=1
                )

        if 'env_temp' in valid_data.columns:
            env_temp_data = valid_data[valid_data['env_temp'].notna()]
            if len(env_temp_data) > 0:
                fig.add_trace(
                    go.Scatter(
                        x=env_temp_data['time_seconds'],
                        y=env_temp_data['env_temp'],
                        mode='lines',
                        name='环境温 (ET)',
                        line=dict(color=self.COLORS['env_temp'], width=2, dash='dash'),
                        hovertemplate='时间: %{x:.1f}s<br>环境温: %{y:.1f}°C<extra></extra>'
                    ),
                    row=1, col=1
                )

        if show_ror and 'ror_smoothed' in valid_data.columns:
            ror_data = valid_data[valid_data['ror_smoothed'].notna()]
            if len(ror_data) > 0:
                fig.add_trace(
                    go.Scatter(
                        x=ror_data['time_seconds'],
                        y=ror_data['ror_smoothed'],
                        mode='lines',
                        name='RoR (平滑)',
                        line=dict(color=self.COLORS['ror_smoothed'], width=2),
                        hovertemplate='时间: %{x:.1f}s<br>RoR: %{y:.1f}°C/min<extra></extra>'
                    ),
                    row=2, col=1
                )

                if 'ror' in valid_data.columns:
                    raw_ror_data = valid_data[valid_data['ror'].notna()]
                    if len(raw_ror_data) > 0:
                        fig.add_trace(
                            go.Scatter(
                                x=raw_ror_data['time_seconds'],
                                y=raw_ror_data['ror'],
                                mode='lines',
                                name='RoR (原始)',
                                line=dict(color=self.COLORS['ror'], width=1, dash='dot'),
                                opacity=0.6,
                                hovertemplate='时间: %{x:.1f}s<br>RoR: %{y:.1f}°C/min<extra></extra>'
                            ),
                            row=2, col=1
                        )

        for event_key, event_data in events.items():
            if event_key in self.EVENT_MARKERS:
                marker_info = self.EVENT_MARKERS[event_key]
                event_time = event_data.get('time')
                event_temp = event_data.get('temp')

                if event_time is not None:
                    if event_temp is not None:
                        fig.add_trace(
                            go.Scatter(
                                x=[event_time],
                                y=[event_temp],
                                mode='markers+text',
                                name=marker_info['name'],
                                marker=dict(
                                    symbol=marker_info['symbol'],
                                    color=marker_info['color'],
                                    size=marker_info['size'],
                                    line=dict(color='white', width=2)
                                ),
                                text=marker_info['name'],
                                textposition='top center',
                                hovertemplate=f"{marker_info['name']}<br>时间: {event_time:.1f}s<br>温度: {event_temp:.1f}°C<extra></extra>",
                                showlegend=False
                            ),
                            row=1, col=1
                        )

                    fig.add_vline(
                        x=event_time,
                        line=dict(color=marker_info['color'], width=1.5, dash='dash'),
                        annotation_text=marker_info['name'],
                        annotation_position='top left',
                        row='all'
                    )

        fig.update_layout(
            title={
                'text': title,
                'y': 0.95,
                'x': 0.5,
                'xanchor': 'center',
                'yanchor': 'top'
            },
            hovermode='x unified',
            legend=dict(
                orientation='h',
                yanchor='bottom',
                y=1.02,
                xanchor='right',
                x=1
            ),
            template='plotly_white',
            height=700
        )

        fig.update_xaxes(
            title_text='时间 (秒)',
            tickformat='.0f',
            gridcolor='rgba(0,0,0,0.1)',
            row=1, col=1
        )

        fig.update_yaxes(
            title_text='温度 (°C)',
            gridcolor='rgba(0,0,0,0.1)',
            row=1, col=1
        )

        if show_ror and 'ror_smoothed' in df.columns:
            fig.update_xaxes(
                title_text='时间 (秒)',
                tickformat='.0f',
                gridcolor='rgba(0,0,0,0.1)',
                row=2, col=1
            )
            fig.update_yaxes(
                title_text='RoR (°C/min)',
                gridcolor='rgba(0,0,0,0.1)',
                row=2, col=1
            )

        return fig

    def create_comparison_plot(self, roast_data_list: List[Dict], 
                                title: str = "多锅对比",
                                show_ror: bool = True) -> go.Figure:
        if len(roast_data_list) == 0:
            fig = go.Figure()
            fig.add_annotation(text="无对比数据", xref="paper", yref="paper", x=0.5, y=0.5, showarrow=False)
            return fig

        if show_ror:
            fig = make_subplots(
                rows=2, cols=1,
                shared_xaxes=True,
                vertical_spacing=0.05,
                row_heights=[0.6, 0.4],
                subplot_titles=("温度曲线对比", "RoR 对比")
            )
        else:
            fig = make_subplots(rows=1, cols=1)

        for idx, roast_data in enumerate(roast_data_list):
            df = roast_data.get('df', pd.DataFrame())
            name = roast_data.get('name', f'Roast {idx + 1}')
            events = roast_data.get('events', {})
            color = self.COLORS['comparison'][idx % len(self.COLORS['comparison'])]

            valid_data = df[df['time_seconds'].notna() & df['bean_temp'].notna()].copy()
            if len(valid_data) == 0:
                continue

            valid_data = valid_data.sort_values('time_seconds')
            time_origin = valid_data['time_seconds'].iloc[0]
            valid_data['time_normalized'] = valid_data['time_seconds'] - time_origin

            fig.add_trace(
                go.Scatter(
                    x=valid_data['time_normalized'],
                    y=valid_data['bean_temp'],
                    mode='lines',
                    name=f'{name} - 豆温',
                    line=dict(color=color, width=2.5),
                    hovertemplate=f'{name}<br>时间: %{{x:.1f}}s<br>豆温: %{{y:.1f}}°C<extra></extra>'
                ),
                row=1, col=1
            )

            if show_ror and 'ror_smoothed' in valid_data.columns:
                ror_data = valid_data[valid_data['ror_smoothed'].notna()]
                if len(ror_data) > 0:
                    fig.add_trace(
                        go.Scatter(
                            x=ror_data['time_normalized'],
                            y=ror_data['ror_smoothed'],
                            mode='lines',
                            name=f'{name} - RoR',
                            line=dict(color=color, width=2, dash='dot'),
                            hovertemplate=f'{name}<br>时间: %{{x:.1f}}s<br>RoR: %{{y:.1f}}°C/min<extra></extra>'
                        ),
                        row=2, col=1
                    )

            fc_start = events.get('first_crack_start')
            if fc_start:
                fc_time = fc_start.get('time')
                if fc_time is not None:
                    fc_time_norm = fc_time - time_origin
                    fig.add_vline(
                        x=fc_time_norm,
                        line=dict(color=color, width=2, dash='dash'),
                        annotation_text=f'{name} 一爆',
                        annotation_position='top',
                        row='all'
                    )

            drop = events.get('drop')
            if drop:
                drop_time = drop.get('time')
                if drop_time is not None:
                    drop_time_norm = drop_time - time_origin
                    fig.add_vline(
                        x=drop_time_norm,
                        line=dict(color=color, width=2),
                        annotation_text=f'{name} 下豆',
                        annotation_position='bottom',
                        row='all'
                    )

        fig.update_layout(
            title={
                'text': title,
                'y': 0.95,
                'x': 0.5,
                'xanchor': 'center',
                'yanchor': 'top'
            },
            hovermode='x unified',
            legend=dict(
                orientation='h',
                yanchor='bottom',
                y=1.02,
                xanchor='right',
                x=1
            ),
            template='plotly_white',
            height=700
        )

        fig.update_xaxes(
            title_text='相对时间 (秒)',
            tickformat='.0f',
            gridcolor='rgba(0,0,0,0.1)',
            row=1, col=1
        )

        fig.update_yaxes(
            title_text='温度 (°C)',
            gridcolor='rgba(0,0,0,0.1)',
            row=1, col=1
        )

        if show_ror:
            fig.update_xaxes(
                title_text='相对时间 (秒)',
                tickformat='.0f',
                gridcolor='rgba(0,0,0,0.1)',
                row=2, col=1
            )
            fig.update_yaxes(
                title_text='RoR (°C/min)',
                gridcolor='rgba(0,0,0,0.1)',
                row=2, col=1
            )

        return fig

    def create_phase_comparison_chart(self, metrics_list: List[Dict],
                                        title: str = "关键阶段对比") -> go.Figure:
        phases_data = []

        for idx, metrics in enumerate(metrics_list):
            name = metrics.get('name', f'Roast {idx + 1}')
            phases = metrics.get('phases', {})

            for phase_key, phase_data in phases.items():
                if phase_data.duration is not None:
                    phases_data.append({
                        'roast': name,
                        'phase': phase_data.name,
                        'duration': phase_data.duration,
                        'temp_change': phase_data.temp_change
                    })

        if not phases_data:
            fig = go.Figure()
            fig.add_annotation(text="无阶段数据", xref="paper", yref="paper", x=0.5, y=0.5, showarrow=False)
            return fig

        df_phases = pd.DataFrame(phases_data)

        fig = make_subplots(
            rows=1, cols=2,
            subplot_titles=("阶段耗时", "阶段温升")
        )

        for roast_name in df_phases['roast'].unique():
            roast_data = df_phases[df_phases['roast'] == roast_name]

            fig.add_trace(
                go.Bar(
                    x=roast_data['phase'],
                    y=roast_data['duration'],
                    name=f'{roast_name} - 耗时',
                    text=[self._format_duration(d) for d in roast_data['duration']],
                    textposition='auto',
                ),
                row=1, col=1
            )

        for roast_name in df_phases['roast'].unique():
            roast_data = df_phases[df_phases['roast'] == roast_name]

            fig.add_trace(
                go.Bar(
                    x=roast_data['phase'],
                    y=roast_data['temp_change'],
                    name=f'{roast_name} - 温升',
                    text=[f'{tc:+.1f}°C' for tc in roast_data['temp_change']],
                    textposition='auto',
                ),
                row=1, col=2
            )

        fig.update_layout(
            title=title,
            barmode='group',
            template='plotly_white',
            height=500,
            legend=dict(
                orientation='h',
                yanchor='bottom',
                y=1.02,
                xanchor='right',
                x=1
            )
        )

        fig.update_yaxes(title_text='时间 (秒)', row=1, col=1)
        fig.update_yaxes(title_text='温度变化 (°C)', row=1, col=2)

        return fig

    def create_ror_variability_chart(self, df_list: List[Dict],
                                      title: str = "RoR 抖动分析") -> go.Figure:
        variability_data = []

        for idx, roast_data in enumerate(df_list):
            df = roast_data.get('df', pd.DataFrame())
            name = roast_data.get('name', f'Roast {idx + 1}')

            if 'ror_smoothed' not in df.columns:
                continue

            ror_data = df['ror_smoothed'].dropna()
            if len(ror_data) < 5:
                continue

            ror_diff = ror_data.diff().dropna()

            variability_data.append({
                'roast': name,
                'mean_ror': ror_data.mean(),
                'std_ror': ror_data.std(),
                'mean_change': ror_diff.abs().mean(),
                'max_change': ror_diff.abs().max(),
                'cv': (ror_data.std() / ror_data.mean() * 100) if ror_data.mean() != 0 else 0
            })

        if not variability_data:
            fig = go.Figure()
            fig.add_annotation(text="无有效 RoR 数据", xref="paper", yref="paper", x=0.5, y=0.5, showarrow=False)
            return fig

        df_var = pd.DataFrame(variability_data)

        fig = make_subplots(
            rows=2, cols=2,
            subplot_titles=("平均 RoR", "RoR 标准差", "平均波动幅度", "变异系数 (CV)")
        )

        fig.add_trace(
            go.Bar(
                x=df_var['roast'],
                y=df_var['mean_ror'],
                text=[f'{v:.1f}°C/min' for v in df_var['mean_ror']],
                textposition='auto',
                marker_color=self.COLORS['ror_smoothed']
            ),
            row=1, col=1
        )

        fig.add_trace(
            go.Bar(
                x=df_var['roast'],
                y=df_var['std_ror'],
                text=[f'{v:.2f}' for v in df_var['std_ror']],
                textposition='auto',
                marker_color=self.COLORS['bean_temp']
            ),
            row=1, col=2
        )

        fig.add_trace(
            go.Bar(
                x=df_var['roast'],
                y=df_var['mean_change'],
                text=[f'{v:.2f}°C/min' for v in df_var['mean_change']],
                textposition='auto',
                marker_color=self.COLORS['env_temp']
            ),
            row=2, col=1
        )

        fig.add_trace(
            go.Bar(
                x=df_var['roast'],
                y=df_var['cv'],
                text=[f'{v:.1f}%' for v in df_var['cv']],
                textposition='auto',
                marker_color=self.COLORS['power']
            ),
            row=2, col=2
        )

        fig.update_layout(
            title=title,
            template='plotly_white',
            height=600,
            showlegend=False
        )

        fig.update_yaxes(title_text='°C/min', row=1, col=1)
        fig.update_yaxes(title_text='标准差', row=1, col=2)
        fig.update_yaxes(title_text='°C/min', row=2, col=1)
        fig.update_yaxes(title_text='%', row=2, col=2)

        return fig

    def _format_duration(self, seconds: float) -> str:
        if seconds is None:
            return "N/A"
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes}:{secs:02d}"
