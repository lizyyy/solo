import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from typing import Dict, List, Optional, Tuple
import plotly.express as px
import numpy as np


class Visualizer:
    def __init__(self):
        self.color_map = {
            '抖音': '#FE2C55',
            '小红书': '#FF2442',
            '视频号': '#07C160'
        }
        self.template = 'plotly_white'

    def create_spend_trend_chart(self, daily_df: pd.DataFrame) -> go.Figure:
        if daily_df.empty:
            return go.Figure()
        
        fig = go.Figure()
        
        for platform in daily_df['platform'].unique():
            platform_data = daily_df[daily_df['platform'] == platform].sort_values('date')
            fig.add_trace(go.Scatter(
                x=platform_data['date'],
                y=platform_data['spend'],
                mode='lines+markers',
                name=platform,
                line=dict(color=self.color_map.get(platform, '#636EFA'), width=2),
                marker=dict(size=8)
            ))
        
        fig.update_layout(
            title='花费趋势',
            xaxis_title='日期',
            yaxis_title='花费 (元)',
            template=self.template,
            hovermode='x unified',
            legend=dict(orientation='h', yanchor='bottom', y=1.02, xanchor='right', x=1)
        )
        
        return fig

    def create_conversion_trend_chart(self, daily_df: pd.DataFrame) -> go.Figure:
        if daily_df.empty:
            return go.Figure()
        
        fig = go.Figure()
        
        for platform in daily_df['platform'].unique():
            platform_data = daily_df[daily_df['platform'] == platform].sort_values('date')
            fig.add_trace(go.Scatter(
                x=platform_data['date'],
                y=platform_data['conversion'],
                mode='lines+markers',
                name=platform,
                line=dict(color=self.color_map.get(platform, '#636EFA'), width=2),
                marker=dict(size=8)
            ))
        
        fig.update_layout(
            title='转化趋势',
            xaxis_title='日期',
            yaxis_title='转化数',
            template=self.template,
            hovermode='x unified',
            legend=dict(orientation='h', yanchor='bottom', y=1.02, xanchor='right', x=1)
        )
        
        return fig

    def create_roi_trend_chart(self, daily_df: pd.DataFrame) -> go.Figure:
        if daily_df.empty:
            return go.Figure()
        
        fig = go.Figure()
        
        for platform in daily_df['platform'].unique():
            platform_data = daily_df[daily_df['platform'] == platform].sort_values('date')
            fig.add_trace(go.Scatter(
                x=platform_data['date'],
                y=platform_data['roi'],
                mode='lines+markers',
                name=platform,
                line=dict(color=self.color_map.get(platform, '#636EFA'), width=2),
                marker=dict(size=8)
            ))
        
        fig.add_hline(y=1.0, line_dash='dash', line_color='red', annotation_text='ROI=1.0 盈亏线')
        
        fig.update_layout(
            title='ROI趋势',
            xaxis_title='日期',
            yaxis_title='ROI',
            template=self.template,
            hovermode='x unified',
            legend=dict(orientation='h', yanchor='bottom', y=1.02, xanchor='right', x=1)
        )
        
        return fig

    def create_cpa_trend_chart(self, daily_df: pd.DataFrame) -> go.Figure:
        if daily_df.empty:
            return go.Figure()
        
        fig = go.Figure()
        
        for platform in daily_df['platform'].unique():
            platform_data = daily_df[daily_df['platform'] == platform].sort_values('date')
            fig.add_trace(go.Scatter(
                x=platform_data['date'],
                y=platform_data['cpa'],
                mode='lines+markers',
                name=platform,
                line=dict(color=self.color_map.get(platform, '#636EFA'), width=2),
                marker=dict(size=8)
            ))
        
        fig.update_layout(
            title='CPA趋势',
            xaxis_title='日期',
            yaxis_title='CPA (元)',
            template=self.template,
            hovermode='x unified',
            legend=dict(orientation='h', yanchor='bottom', y=1.02, xanchor='right', x=1)
        )
        
        return fig

    def create_ctr_cpc_chart(self, daily_df: pd.DataFrame) -> go.Figure:
        if daily_df.empty:
            return go.Figure()
        
        fig = make_subplots(specs=[[{"secondary_y": True}]])
        
        for platform in daily_df['platform'].unique():
            platform_data = daily_df[daily_df['platform'] == platform].sort_values('date')
            
            fig.add_trace(
                go.Scatter(
                    x=platform_data['date'],
                    y=platform_data['ctr'],
                    mode='lines+markers',
                    name=f'{platform} - CTR',
                    line=dict(color=self.color_map.get(platform, '#636EFA'), width=2),
                    marker=dict(size=6)
                ),
                secondary_y=False,
            )
            
            fig.add_trace(
                go.Scatter(
                    x=platform_data['date'],
                    y=platform_data['cpc'],
                    mode='lines+markers',
                    name=f'{platform} - CPC',
                    line=dict(color=self.color_map.get(platform, '#636EFA'), width=2, dash='dot'),
                    marker=dict(size=6)
                ),
                secondary_y=True,
            )
        
        fig.update_layout(
            title='CTR & CPC趋势',
            xaxis_title='日期',
            template=self.template,
            hovermode='x unified',
            legend=dict(orientation='h', yanchor='bottom', y=1.02, xanchor='right', x=1)
        )
        
        fig.update_yaxes(title_text='CTR (%)', secondary_y=False)
        fig.update_yaxes(title_text='CPC (元)', secondary_y=True)
        
        return fig

    def create_platform_comparison_chart(self, daily_df: pd.DataFrame) -> go.Figure:
        if daily_df.empty:
            return go.Figure()
        
        platform_summary = daily_df.groupby('platform').agg({
            'spend': 'sum',
            'impression': 'sum',
            'click': 'sum',
            'conversion': 'sum',
            'revenue': 'sum'
        }).reset_index()
        
        platform_summary['roi'] = np.where(
            platform_summary['spend'] > 0,
            (platform_summary['revenue'] / platform_summary['spend']).round(2),
            0
        )
        platform_summary['ctr'] = np.where(
            platform_summary['impression'] > 0,
            (platform_summary['click'] / platform_summary['impression'] * 100).round(2),
            0
        )
        platform_summary['cpa'] = np.where(
            platform_summary['conversion'] > 0,
            (platform_summary['spend'] / platform_summary['conversion']).round(2),
            0
        )
        
        fig = make_subplots(
            rows=2, cols=2,
            subplot_titles=('总花费', '总转化', 'ROI对比', 'CPA对比'),
            specs=[
                [{"type": "bar"}, {"type": "bar"}],
                [{"type": "bar"}, {"type": "bar"}]
            ]
        )
        
        colors = [self.color_map.get(p, '#636EFA') for p in platform_summary['platform']]
        
        fig.add_trace(
            go.Bar(x=platform_summary['platform'], y=platform_summary['spend'],
                   marker_color=colors, name='总花费', text=platform_summary['spend'].round(2)),
            row=1, col=1
        )
        
        fig.add_trace(
            go.Bar(x=platform_summary['platform'], y=platform_summary['conversion'],
                   marker_color=colors, name='总转化', text=platform_summary['conversion']),
            row=1, col=2
        )
        
        fig.add_trace(
            go.Bar(x=platform_summary['platform'], y=platform_summary['roi'],
                   marker_color=colors, name='ROI', text=platform_summary['roi']),
            row=2, col=1
        )
        
        fig.add_trace(
            go.Bar(x=platform_summary['platform'], y=platform_summary['cpa'],
                   marker_color=colors, name='CPA', text=platform_summary['cpa']),
            row=2, col=2
        )
        
        fig.update_layout(
            title='平台对比汇总',
            template=self.template,
            height=600,
            showlegend=False
        )
        
        return fig

    def create_material_ranking_chart(self, material_df: pd.DataFrame, metric: str = 'total_spend', top_n: int = 10) -> go.Figure:
        if material_df.empty:
            return go.Figure()
        
        metric_labels = {
            'total_spend': '总花费',
            'total_conversion': '总转化',
            'avg_roi': '平均ROI',
            'fatigue_score': '疲劳度得分'
        }
        
        sorted_df = material_df.nlargest(top_n, metric).copy()
        sorted_df['label'] = sorted_df['material_id'] + ' (' + sorted_df['platform'] + ')'
        
        colors = [self.color_map.get(p, '#636EFA') for p in sorted_df['platform']]
        
        fig = go.Figure()
        
        fig.add_trace(go.Bar(
            x=sorted_df[metric],
            y=sorted_df['label'],
            orientation='h',
            marker_color=colors,
            text=sorted_df[metric].round(2),
            textposition='auto'
        ))
        
        fig.update_layout(
            title=f"素材排名 - {metric_labels.get(metric, metric)}",
            xaxis_title=metric_labels.get(metric, metric),
            yaxis_title='素材ID (平台)',
            template=self.template,
            yaxis=dict(autorange='reversed'),
            height=500
        )
        
        return fig

    def create_fatigue_analysis_chart(self, material_df: pd.DataFrame) -> go.Figure:
        if material_df.empty or 'fatigue_score' not in material_df.columns:
            return go.Figure()
        
        fig = go.Figure()
        
        colors = []
        for _, row in material_df.iterrows():
            if row.get('is_fatigued', False):
                colors.append('#EF553B')
            elif row.get('fatigue_score', 0) > 15:
                colors.append('#FECA57')
            else:
                colors.append('#636EFA')
        
        material_df['label'] = material_df['material_id'] + ' (' + material_df['platform'] + ')'
        
        fig.add_trace(go.Scatter(
            x=material_df['days_active'],
            y=material_df['fatigue_score'],
            mode='markers',
            marker=dict(
                size=12,
                color=colors,
                line=dict(width=2, color='DarkSlateGrey')
            ),
            text=material_df['label'],
            hovertemplate=
            '<b>%{text}</b><br>' +
            '投放天数: %{x}<br>' +
            '疲劳度得分: %{y}<br>' +
            '<extra></extra>'
        ))
        
        fig.add_hline(y=30, line_dash='dash', line_color='red', annotation_text='疲劳阈值 (30)')
        fig.add_hline(y=15, line_dash='dot', line_color='orange', annotation_text='关注阈值 (15)')
        
        fig.update_layout(
            title='素材疲劳度分析',
            xaxis_title='投放天数',
            yaxis_title='疲劳度得分',
            template=self.template,
            height=500
        )
        
        return fig

    def create_spend_vs_roi_scatter(self, material_df: pd.DataFrame) -> go.Figure:
        if material_df.empty:
            return go.Figure()
        
        material_df['label'] = material_df['material_id'] + ' (' + material_df['platform'] + ')'
        
        fig = px.scatter(
            material_df,
            x='total_spend',
            y='avg_roi',
            color='platform',
            size='total_conversion',
            hover_name='label',
            color_discrete_map=self.color_map,
            title='花费 vs ROI 散点图',
            labels={
                'total_spend': '总花费 (元)',
                'avg_roi': '平均ROI',
                'total_conversion': '总转化'
            }
        )
        
        fig.add_hline(y=1.0, line_dash='dash', line_color='red', annotation_text='ROI=1.0')
        
        fig.update_layout(
            template=self.template,
            height=500,
            legend=dict(orientation='h', yanchor='bottom', y=1.02, xanchor='right', x=1)
        )
        
        return fig

    def create_daily_metrics_chart(self, daily_df: pd.DataFrame) -> go.Figure:
        if daily_df.empty:
            return go.Figure()
        
        fig = make_subplots(
            rows=3, cols=2,
            subplot_titles=('花费', '转化', 'ROI', 'CTR', 'CPA', 'CPC'),
            specs=[
                [{"secondary_y": False}, {"secondary_y": False}],
                [{"secondary_y": False}, {"secondary_y": False}],
                [{"secondary_y": False}, {"secondary_y": False}]
            ]
        )
        
        for platform in daily_df['platform'].unique():
            platform_data = daily_df[daily_df['platform'] == platform].sort_values('date')
            color = self.color_map.get(platform, '#636EFA')
            
            fig.add_trace(
                go.Scatter(x=platform_data['date'], y=platform_data['spend'],
                          mode='lines+markers', name=platform,
                          line=dict(color=color, width=2), showlegend=True),
                row=1, col=1
            )
            
            fig.add_trace(
                go.Scatter(x=platform_data['date'], y=platform_data['conversion'],
                          mode='lines+markers', name=platform,
                          line=dict(color=color, width=2), showlegend=False),
                row=1, col=2
            )
            
            fig.add_trace(
                go.Scatter(x=platform_data['date'], y=platform_data['roi'],
                          mode='lines+markers', name=platform,
                          line=dict(color=color, width=2), showlegend=False),
                row=2, col=1
            )
            
            fig.add_trace(
                go.Scatter(x=platform_data['date'], y=platform_data['ctr'],
                          mode='lines+markers', name=platform,
                          line=dict(color=color, width=2), showlegend=False),
                row=2, col=2
            )
            
            fig.add_trace(
                go.Scatter(x=platform_data['date'], y=platform_data['cpa'],
                          mode='lines+markers', name=platform,
                          line=dict(color=color, width=2), showlegend=False),
                row=3, col=1
            )
            
            fig.add_trace(
                go.Scatter(x=platform_data['date'], y=platform_data['cpc'],
                          mode='lines+markers', name=platform,
                          line=dict(color=color, width=2), showlegend=False),
                row=3, col=2
            )
        
        fig.update_layout(
            title='每日指标汇总',
            template=self.template,
            height=800,
            showlegend=True,
            legend=dict(orientation='h', yanchor='bottom', y=1.02, xanchor='center', x=0.5)
        )
        
        return fig
