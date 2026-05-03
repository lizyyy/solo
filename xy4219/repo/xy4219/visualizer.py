import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from typing import Dict, List, Optional, Tuple
from datetime import date


COLORS = {
    '抖音': '#000000',
    '小红书': '#FF2442',
    '视频号': '#07C160',
    '花费': '#FF6B6B',
    '曝光': '#4ECDC4',
    '点击': '#45B7D1',
    '转化': '#96CEB4',
    'ROI': '#FFEAA7',
    'CPA': '#DFE6E9',
    'CTR': '#A29BFE'
}


class Visualizer:
    def __init__(self):
        self.colors = COLORS
    
    def create_spend_trend_chart(
        self, 
        daily_df: pd.DataFrame,
        title: str = "花费趋势"
    ) -> go.Figure:
        if daily_df.empty:
            return go.Figure()
        
        daily_df = daily_df.copy()
        daily_df['date'] = pd.to_datetime(daily_df['date'])
        
        fig = go.Figure()
        
        platforms = daily_df['platform'].unique()
        
        for platform in platforms:
            platform_data = daily_df[daily_df['platform'] == platform].sort_values('date')
            color = self.colors.get(platform, '#636EFA')
            
            fig.add_trace(go.Scatter(
                x=platform_data['date'],
                y=platform_data['spend'],
                mode='lines+markers',
                name=f"{platform} - 花费",
                line=dict(color=color, width=2),
                marker=dict(size=6),
                hovertemplate='日期: %{x}<br>花费: %{y:.2f}元<extra></extra>'
            ))
        
        fig.update_layout(
            title=title,
            xaxis_title='日期',
            yaxis_title='花费（元）',
            hovermode='x unified',
            showlegend=True,
            height=400,
            margin=dict(l=40, r=40, t=60, b=40)
        )
        
        return fig
    
    def create_impression_click_trend_chart(
        self, 
        daily_df: pd.DataFrame,
        title: str = "曝光与点击趋势"
    ) -> go.Figure:
        if daily_df.empty:
            return go.Figure()
        
        daily_df = daily_df.copy()
        daily_df['date'] = pd.to_datetime(daily_df['date'])
        
        daily_total = daily_df.groupby('date').agg({
            'impression': 'sum',
            'click': 'sum'
        }).reset_index()
        
        fig = make_subplots(specs=[[{"secondary_y": True}]])
        
        fig.add_trace(
            go.Bar(
                x=daily_total['date'],
                y=daily_total['impression'],
                name='曝光量',
                marker_color=self.colors['曝光'],
                opacity=0.7,
                hovertemplate='日期: %{x}<br>曝光: %{y:,.0f}<extra></extra>'
            ),
            secondary_y=False
        )
        
        fig.add_trace(
            go.Scatter(
                x=daily_total['date'],
                y=daily_total['click'],
                mode='lines+markers',
                name='点击量',
                line=dict(color=self.colors['点击'], width=2),
                marker=dict(size=6),
                hovertemplate='日期: %{x}<br>点击: %{y:,.0f}<extra></extra>'
            ),
            secondary_y=True
        )
        
        fig.update_layout(
            title=title,
            xaxis_title='日期',
            hovermode='x unified',
            showlegend=True,
            height=400,
            margin=dict(l=40, r=40, t=60, b=40)
        )
        
        fig.update_yaxes(title_text="曝光量", secondary_y=False)
        fig.update_yaxes(title_text="点击量", secondary_y=True)
        
        return fig
    
    def create_conversion_trend_chart(
        self, 
        daily_df: pd.DataFrame,
        title: str = "转化与ROI趋势"
    ) -> go.Figure:
        if daily_df.empty:
            return go.Figure()
        
        daily_df = daily_df.copy()
        daily_df['date'] = pd.to_datetime(daily_df['date'])
        
        daily_total = daily_df.groupby('date').agg({
            'conversion': 'sum',
            'spend': 'sum',
            'revenue': 'sum'
        }).reset_index()
        
        daily_total['roi'] = daily_total.apply(
            lambda x: x['revenue'] / x['spend'] if x['spend'] > 0 else 0,
            axis=1
        )
        
        fig = make_subplots(specs=[[{"secondary_y": True}]])
        
        fig.add_trace(
            go.Bar(
                x=daily_total['date'],
                y=daily_total['conversion'],
                name='转化数',
                marker_color=self.colors['转化'],
                opacity=0.7,
                hovertemplate='日期: %{x}<br>转化: %{y:,.0f}<extra></extra>'
            ),
            secondary_y=False
        )
        
        fig.add_trace(
            go.Scatter(
                x=daily_total['date'],
                y=daily_total['roi'],
                mode='lines+markers',
                name='ROI',
                line=dict(color=self.colors['ROI'], width=2),
                marker=dict(size=6),
                hovertemplate='日期: %{x}<br>ROI: %{y:.2f}<extra></extra>'
            ),
            secondary_y=True
        )
        
        fig.update_layout(
            title=title,
            xaxis_title='日期',
            hovermode='x unified',
            showlegend=True,
            height=400,
            margin=dict(l=40, r=40, t=60, b=40)
        )
        
        fig.update_yaxes(title_text="转化数", secondary_y=False)
        fig.update_yaxes(title_text="ROI", secondary_y=True)
        
        return fig
    
    def create_platform_comparison_chart(
        self, 
        platform_df: pd.DataFrame,
        title: str = "平台效果对比"
    ) -> go.Figure:
        if platform_df.empty:
            return go.Figure()
        
        fig = make_subplots(
            rows=2, cols=2,
            subplot_titles=('总花费对比', '总曝光对比', '平均ROI对比', '平均CPA对比'),
            horizontal_spacing=0.15,
            vertical_spacing=0.2
        )
        
        platforms = platform_df['platform'].tolist()
        colors = [self.colors.get(p, '#636EFA') for p in platforms]
        
        fig.add_trace(
            go.Bar(
                x=platforms,
                y=platform_df['总花费'],
                name='总花费',
                marker_color=colors,
                text=platform_df['总花费'].round(2),
                textposition='auto',
                hovertemplate='平台: %{x}<br>总花费: %{y:.2f}元<extra></extra>'
            ),
            row=1, col=1
        )
        
        fig.add_trace(
            go.Bar(
                x=platforms,
                y=platform_df['总曝光'],
                name='总曝光',
                marker_color=colors,
                text=platform_df['总曝光'].apply(lambda x: f"{x/10000:.1f}万"),
                textposition='auto',
                hovertemplate='平台: %{x}<br>总曝光: %{y:,.0f}<extra></extra>'
            ),
            row=1, col=2
        )
        
        fig.add_trace(
            go.Bar(
                x=platforms,
                y=platform_df['平均ROI'],
                name='平均ROI',
                marker_color=colors,
                text=platform_df['平均ROI'].round(2),
                textposition='auto',
                hovertemplate='平台: %{x}<br>平均ROI: %{y:.2f}<extra></extra>'
            ),
            row=2, col=1
        )
        
        fig.add_trace(
            go.Bar(
                x=platforms,
                y=platform_df['平均CPA'],
                name='平均CPA',
                marker_color=colors,
                text=platform_df['平均CPA'].round(2),
                textposition='auto',
                hovertemplate='平台: %{x}<br>平均CPA: %{y:.2f}元<extra></extra>'
            ),
            row=2, col=2
        )
        
        fig.update_layout(
            title=title,
            showlegend=False,
            height=600,
            margin=dict(l=40, r=40, t=80, b=40)
        )
        
        return fig
    
    def create_material_performance_chart(
        self, 
        material_df: pd.DataFrame,
        top_n: int = 10,
        title: str = "素材效果排名"
    ) -> go.Figure:
        if material_df.empty:
            return go.Figure()
        
        material_df = material_df.copy()
        
        top_materials = material_df.nlargest(top_n, 'total_spend')
        
        fig = make_subplots(
            rows=1, cols=2,
            subplot_titles=('花费TOP素材', 'ROI表现'),
            horizontal_spacing=0.15
        )
        
        labels = [f"{row['material_id'][:8]}...({row['platform']})" 
                  for _, row in top_materials.iterrows()]
        
        fig.add_trace(
            go.Bar(
                y=labels,
                x=top_materials['total_spend'],
                orientation='h',
                name='总花费',
                marker_color=self.colors['花费'],
                text=top_materials['total_spend'].round(2),
                textposition='auto',
                hovertemplate='素材: %{y}<br>总花费: %{x:.2f}元<extra></extra>'
            ),
            row=1, col=1
        )
        
        roi_sorted = material_df[material_df['total_spend'] > 100].nlargest(top_n, 'avg_roi')
        roi_labels = [f"{row['material_id'][:8]}...({row['platform']})" 
                      for _, row in roi_sorted.iterrows()]
        
        fig.add_trace(
            go.Bar(
                y=roi_labels,
                x=roi_sorted['avg_roi'],
                orientation='h',
                name='平均ROI',
                marker_color=self.colors['ROI'],
                text=roi_sorted['avg_roi'].round(2),
                textposition='auto',
                hovertemplate='素材: %{y}<br>平均ROI: %{x:.2f}<extra></extra>'
            ),
            row=1, col=2
        )
        
        fig.update_layout(
            title=title,
            showlegend=False,
            height=500,
            margin=dict(l=150, r=40, t=60, b=40)
        )
        
        return fig
    
    def create_fatigue_distribution_chart(
        self, 
        material_df: pd.DataFrame,
        title: str = "素材疲劳度分布"
    ) -> go.Figure:
        if material_df.empty:
            return go.Figure()
        
        material_df = material_df.copy()
        
        bins = [0, 20, 40, 60, 80, 100]
        labels = ['0-20% (稳定)', '20-40% (轻度)', '40-60% (中度)', 
                  '60-80% (重度)', '80-100% (衰退)']
        
        material_df['fatigue_category'] = pd.cut(
            material_df['fatigue_score'], 
            bins=bins, 
            labels=labels,
            include_lowest=True
        )
        
        distribution = material_df['fatigue_category'].value_counts().reindex(labels)
        
        colors = ['#96CEB4', '#FFEAA7', '#FFB6B6', '#FF6B6B', '#C0392B']
        
        fig = go.Figure()
        
        fig.add_trace(go.Pie(
            labels=distribution.index,
            values=distribution.values,
            name='素材疲劳度',
            textinfo='label+percent+value',
            textposition='outside',
            marker=dict(colors=colors),
            hovertemplate='疲劳等级: %{label}<br>素材数: %{value}<br>占比: %{percent}<extra></extra>'
        ))
        
        fig.update_layout(
            title=title,
            showlegend=True,
            height=500,
            margin=dict(l=40, r=40, t=60, b=40)
        )
        
        return fig
    
    def create_ctr_cpc_scatter_chart(
        self, 
        material_df: pd.DataFrame,
        title: str = "素材CTR vs CPC分布"
    ) -> go.Figure:
        if material_df.empty:
            return go.Figure()
        
        material_df = material_df.copy()
        
        fig = go.Figure()
        
        platforms = material_df['platform'].unique()
        
        for platform in platforms:
            platform_data = material_df[material_df['platform'] == platform]
            color = self.colors.get(platform, '#636EFA')
            
            fig.add_trace(go.Scatter(
                x=platform_data['avg_ctr'],
                y=platform_data['avg_cpc'],
                mode='markers',
                name=platform,
                marker=dict(
                    size=platform_data['total_spend'] / platform_data['total_spend'].max() * 30 + 5,
                    color=color,
                    opacity=0.7,
                    line=dict(width=1, color='white')
                ),
                text=[f"素材: {mid[:10]}...<br>花费: {spend:.0f}元<br>CTR: {ctr:.2f}%<br>CPC: {cpc:.2f}元"
                      for mid, spend, ctr, cpc in zip(
                          platform_data['material_id'],
                          platform_data['total_spend'],
                          platform_data['avg_ctr'],
                          platform_data['avg_cpc']
                      )],
                hovertemplate='%{text}<extra></extra>'
            ))
        
        fig.update_layout(
            title=title,
            xaxis_title='平均CTR (%)',
            yaxis_title='平均CPC (元)',
            showlegend=True,
            height=500,
            margin=dict(l=40, r=40, t=60, b=40)
        )
        
        return fig
