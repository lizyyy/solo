import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from typing import Dict, List, Optional, Tuple
from pricing_config import PricingConfig


class DataVisualizer:
    """数据可视化模块"""
    
    # 峰平谷时段的颜色配置
    COLORS = {
        '峰': '#FF6B6B',
        '平': '#4ECDC4',
        '谷': '#45B7D1',
        '默认': '#95A5A6'
    }
    
    def __init__(self, pricing_config: PricingConfig = None):
        self.pricing_config = pricing_config or PricingConfig()
    
    def set_pricing_config(self, pricing_config: PricingConfig):
        """设置电价配置"""
        self.pricing_config = pricing_config
    
    def _add_time_slot_annotation(self, fig, df: pd.DataFrame, row: int = 1, col: int = 1):
        """添加峰平谷时段的背景标注"""
        # 获取各时段的小时列表
        slot_hours = {}
        for name, slot in self.pricing_config.get_all_time_slots().items():
            slot_hours[name] = slot.get_hours_list()
        
        # 按小时排序
        all_hours = sorted(df['小时'].unique())
        
        # 为每个时段添加背景色
        for name, hours in slot_hours.items():
            # 找到连续的时段块
            if not hours:
                continue
            
            hours = sorted(hours)
            color = self.COLORS.get(name, self.COLORS['默认'])
            
            # 处理跨天的情况
            if hours[0] > hours[-1]:
                # 分为两段：从开始到23，和从0到结束
                segment1 = [h for h in hours if h >= hours[0]]
                segment2 = [h for h in hours if h <= hours[-1]]
                
                for segment in [segment1, segment2]:
                    if segment:
                        self._add_segment_annotation(fig, segment, color, name, row, col)
            else:
                self._add_segment_annotation(fig, hours, color, name, row, col)
    
    def _add_segment_annotation(self, fig, hours: List[int], color: str, name: str, row: int, col: int):
        """为连续的时段添加背景标注"""
        if not hours:
            return
        
        # 找到连续的时段块
        segments = []
        current_segment = [hours[0]]
        
        for h in hours[1:]:
            if h == current_segment[-1] + 1:
                current_segment.append(h)
            else:
                segments.append(current_segment)
                current_segment = [h]
        segments.append(current_segment)
        
        for segment in segments:
            start_h = segment[0]
            end_h = segment[-1]
            
            # 添加矩形背景
            fig.add_shape(
                type="rect",
                x0=start_h - 0.5,
                x1=end_h + 0.5,
                y0=0,
                y1=1,
                fillcolor=color,
                opacity=0.1,
                layer="below",
                line=dict(width=0),
                row=row,
                col=col
            )
    
    def create_daily_consumption_chart(self, df: pd.DataFrame) -> go.Figure:
        """
        创建按天的用电量图表
        
        Args:
            df: 包含日期、小时、用电量(kWh)的数据框
            
        Returns:
            Plotly图表对象
        """
        if df.empty:
            return go.Figure()
        
        # 按日期汇总用电量
        daily_data = df.groupby('日期')['用电量(kWh)'].sum().reset_index()
        daily_data.columns = ['日期', '日用电量(kWh)']
        
        # 转换日期格式
        daily_data['日期'] = pd.to_datetime(daily_data['日期'])
        
        # 创建图表
        fig = px.bar(
            daily_data,
            x='日期',
            y='日用电量(kWh)',
            title='每日用电量趋势',
            labels={'日期': '日期', '日用电量(kWh)': '用电量 (kWh)'},
            color_discrete_sequence=['#3498DB']
        )
        
        # 添加平均线
        avg_consumption = daily_data['日用电量(kWh)'].mean()
        fig.add_hline(
            y=avg_consumption,
            line_dash="dash",
            line_color="#E74C3C",
            annotation_text=f"平均: {avg_consumption:.2f} kWh",
            annotation_position="top right"
        )
        
        # 更新布局
        fig.update_layout(
            xaxis_title='日期',
            yaxis_title='用电量 (kWh)',
            hovermode='x unified'
        )
        
        return fig
    
    def create_hourly_consumption_chart(self, df: pd.DataFrame, 
                                         selected_dates: List = None) -> go.Figure:
        """
        创建按小时的用电量图表（24小时分布）
        
        Args:
            df: 包含日期、小时、用电量(kWh)的数据框
            selected_dates: 可选的日期筛选列表
            
        Returns:
            Plotly图表对象
        """
        if df.empty:
            return go.Figure()
        
        # 筛选数据
        if selected_dates:
            df = df[df['日期'].isin(selected_dates)]
        
        # 按小时计算平均用电量
        hourly_data = df.groupby('小时')['用电量(kWh)'].agg(['mean', 'std']).reset_index()
        hourly_data.columns = ['小时', '平均用电量(kWh)', '标准差']
        
        # 创建图表
        fig = go.Figure()
        
        # 添加柱状图
        fig.add_trace(
            go.Bar(
                x=hourly_data['小时'],
                y=hourly_data['平均用电量(kWh)'],
                name='平均用电量',
                marker_color='#3498DB',
                error_y=dict(
                    type='data',
                    array=hourly_data['标准差'],
                    visible=True
                )
            )
        )
        
        # 添加峰平谷时段背景
        self._add_time_slot_annotation(fig, df)
        
        # 更新布局
        fig.update_layout(
            title='24小时用电分布（平均值）',
            xaxis_title='小时',
            yaxis_title='用电量 (kWh)',
            xaxis=dict(
                tickmode='linear',
                tick0=0,
                dtick=1
            ),
            hovermode='x unified'
        )
        
        return fig
    
    def create_time_slot_comparison_chart(self, df: pd.DataFrame) -> go.Figure:
        """
        创建峰平谷时段用电量对比图表
        
        Args:
            df: 包含日期、小时、用电量(kWh)的数据框
            
        Returns:
            Plotly图表对象
        """
        if df.empty:
            return go.Figure()
        
        # 为每条记录添加时段标签和电价
        df_with_slots = self._add_time_slot_info(df.copy())
        
        # 按时段汇总
        slot_summary = df_with_slots.groupby('时段').agg({
            '用电量(kWh)': 'sum',
            '电费': 'sum'
        }).reset_index()
        
        # 计算占比
        total_consumption = slot_summary['用电量(kWh)'].sum()
        total_cost = slot_summary['电费'].sum()
        
        slot_summary['用电量占比'] = slot_summary['用电量(kWh)'] / total_consumption * 100
        slot_summary['电费占比'] = slot_summary['电费'] / total_cost * 100
        
        # 按用电量排序
        slot_summary = slot_summary.sort_values('用电量(kWh)', ascending=False)
        
        # 创建子图
        fig = make_subplots(
            rows=1, cols=2,
            subplot_titles=('用电量分布', '电费分布'),
            specs=[[{'type': 'domain'}, {'type': 'domain'}]]
        )
        
        # 用电量饼图
        fig.add_trace(
            go.Pie(
                labels=slot_summary['时段'],
                values=slot_summary['用电量(kWh)'],
                name='用电量',
                textinfo='label+percent',
                marker_colors=[self.COLORS.get(s, self.COLORS['默认']) for s in slot_summary['时段']],
                hovertemplate='%{label}: %{value:.2f} kWh<br>占比: %{percent}'
            ),
            row=1, col=1
        )
        
        # 电费饼图
        fig.add_trace(
            go.Pie(
                labels=slot_summary['时段'],
                values=slot_summary['电费'],
                name='电费',
                textinfo='label+percent',
                marker_colors=[self.COLORS.get(s, self.COLORS['默认']) for s in slot_summary['时段']],
                hovertemplate='%{label}: %{value:.2f} 元<br>占比: %{percent}'
            ),
            row=1, col=2
        )
        
        fig.update_layout(
            title='峰平谷时段用电与电费对比'
        )
        
        return fig
    
    def create_heatmap_chart(self, df: pd.DataFrame) -> go.Figure:
        """
        创建用电热力图（日期x小时）
        
        Args:
            df: 包含日期、小时、用电量(kWh)的数据框
            
        Returns:
            Plotly图表对象
        """
        if df.empty:
            return go.Figure()
        
        # 创建透视表
        pivot_data = df.pivot(
            index='日期',
            columns='小时',
            values='用电量(kWh)'
        )
        
        # 排序
        pivot_data = pivot_data.sort_index(ascending=False)
        
        # 创建热力图
        fig = go.Figure(
            data=go.Heatmap(
                z=pivot_data.values,
                x=pivot_data.columns,
                y=[str(d) for d in pivot_data.index],
                colorscale='RdYlGn_r',  # 反向：红色高，绿色低
                hoverongaps=False,
                colorbar=dict(
                    title='用电量 (kWh)',
                    titleside='right'
                )
            )
        )
        
        fig.update_layout(
            title='用电热力图（日期 x 小时）',
            xaxis_title='小时',
            yaxis_title='日期',
            xaxis=dict(
                tickmode='linear',
                tick0=0,
                dtick=1
            )
        )
        
        return fig
    
    def create_cost_breakdown_chart(self, df: pd.DataFrame) -> go.Figure:
        """
        创建费用明细图表
        
        Args:
            df: 包含日期、小时、用电量(kWh)的数据框
            
        Returns:
            Plotly图表对象
        """
        if df.empty:
            return go.Figure()
        
        # 为每条记录添加时段标签和电价
        df_with_slots = self._add_time_slot_info(df.copy())
        
        # 按日期和时段汇总
        daily_slot_summary = df_with_slots.groupby(['日期', '时段']).agg({
            '用电量(kWh)': 'sum',
            '电费': 'sum'
        }).reset_index()
        
        # 转换日期格式
        daily_slot_summary['日期'] = pd.to_datetime(daily_slot_summary['日期'])
        
        # 创建堆叠柱状图
        fig = px.bar(
            daily_slot_summary,
            x='日期',
            y='电费',
            color='时段',
            title='每日电费明细（按时段）',
            labels={'日期': '日期', '电费': '电费 (元)', '时段': '时段'},
            color_discrete_map=self.COLORS
        )
        
        fig.update_layout(
            barmode='stack',
            xaxis_title='日期',
            yaxis_title='电费 (元)',
            hovermode='x unified'
        )
        
        return fig
    
    def create_anomaly_detection_chart(self, df: pd.DataFrame, 
                                         threshold_std: float = 2.0) -> go.Figure:
        """
        创建异常检测图表，标记高用电量时段
        
        Args:
            df: 包含日期、小时、用电量(kWh)的数据框
            threshold_std: 异常阈值（标准差倍数）
            
        Returns:
            Plotly图表对象
        """
        if df.empty:
            return go.Figure()
        
        # 计算统计值
        mean_consumption = df['用电量(kWh)'].mean()
        std_consumption = df['用电量(kWh)'].std()
        threshold = mean_consumption + threshold_std * std_consumption
        
        # 标记异常
        df_with_anomaly = df.copy()
        df_with_anomaly['异常'] = df_with_anomaly['用电量(kWh)'] > threshold
        df_with_anomaly['颜色'] = df_with_anomaly['异常'].apply(
            lambda x: '#E74C3C' if x else '#3498DB'
        )
        
        # 创建时间序列图表
        fig = go.Figure()
        
        # 正常数据
        normal_data = df_with_anomaly[~df_with_anomaly['异常']]
        fig.add_trace(
            go.Scatter(
                x=normal_data.apply(lambda r: f"{r['日期']} {r['小时']}:00", axis=1),
                y=normal_data['用电量(kWh)'],
                mode='markers',
                name='正常',
                marker=dict(color='#3498DB')
            )
        )
        
        # 异常数据
        anomaly_data = df_with_anomaly[df_with_anomaly['异常']]
        if not anomaly_data.empty:
            fig.add_trace(
                go.Scatter(
                    x=anomaly_data.apply(lambda r: f"{r['日期']} {r['小时']}:00", axis=1),
                    y=anomaly_data['用电量(kWh)'],
                    mode='markers',
                    name='异常高用电',
                    marker=dict(color='#E74C3C', size=10, symbol='circle')
                )
            )
        
        # 添加阈值线
        fig.add_hline(
            y=threshold,
            line_dash="dash",
            line_color="#E74C3C",
            annotation_text=f"异常阈值: {threshold:.2f} kWh (平均值 + {threshold_std}σ)",
            annotation_position="top right"
        )
        
        fig.update_layout(
            title='异常高用电时段检测',
            xaxis_title='时间',
            yaxis_title='用电量 (kWh)',
            hovermode='closest'
        )
        
        return fig
    
    def _add_time_slot_info(self, df: pd.DataFrame) -> pd.DataFrame:
        """为数据框添加时段信息和电费计算"""
        # 添加时段和电价
        def get_slot_info(hour):
            price, slot_name = self.pricing_config.get_price_for_hour(hour)
            return pd.Series([slot_name or '未分类', price or 0])
        
        df[['时段', '电价(元/kWh)']] = df['小时'].apply(get_slot_info)
        
        # 计算电费
        df['电费'] = df['用电量(kWh)'] * df['电价(元/kWh)']
        
        return df
    
    def get_summary_statistics(self, df: pd.DataFrame) -> Dict:
        """获取汇总统计信息"""
        if df.empty:
            return {}
        
        df_with_slots = self._add_time_slot_info(df.copy())
        
        # 总体统计
        total_consumption = df['用电量(kWh)'].sum()
        total_cost = df_with_slots['电费'].sum()
        avg_daily_consumption = df.groupby('日期')['用电量(kWh)'].sum().mean()
        
        # 按时段统计
        slot_stats = df_with_slots.groupby('时段').agg({
            '用电量(kWh)': ['sum', 'mean'],
            '电费': 'sum'
        }).round(2)
        
        # 异常统计
        mean_consumption = df['用电量(kWh)'].mean()
        std_consumption = df['用电量(kWh)'].std()
        high_threshold = mean_consumption + 2 * std_consumption
        high_consumption_count = len(df[df['用电量(kWh)'] > high_threshold])
        
        return {
            '总用电量(kWh)': round(total_consumption, 2),
            '总电费(元)': round(total_cost, 2),
            '平均日用电量(kWh)': round(avg_daily_consumption, 2),
            '时段统计': slot_stats.to_dict(),
            '异常高用电时段数': high_consumption_count,
            '用电平均值(kWh)': round(mean_consumption, 2),
            '用电标准差(kWh)': round(std_consumption, 2)
        }
