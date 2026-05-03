import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
import io
import base64
from snow_risk_analyzer import SnowRiskAnalyzer, RiskSeverity

st.set_page_config(
    page_title="雪道开放风险复盘看板",
    page_icon="❄️",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        color: #1f77b4;
        text-align: center;
        margin-bottom: 1rem;
    }
    .sub-header {
        font-size: 1.2rem;
        color: #555;
        text-align: center;
        margin-bottom: 2rem;
    }
    .risk-high {
        background-color: #ffcccc;
        color: #cc0000;
        padding: 0.2rem 0.5rem;
        border-radius: 0.3rem;
        font-weight: bold;
    }
    .risk-medium {
        background-color: #fff2cc;
        color: #cc9900;
        padding: 0.2rem 0.5rem;
        border-radius: 0.3rem;
        font-weight: bold;
    }
    .risk-low {
        background-color: #e5f5e0;
        color: #31a354;
        padding: 0.2rem 0.5rem;
        border-radius: 0.3rem;
        font-weight: bold;
    }
    .metric-card {
        background-color: #f8f9fa;
        border-radius: 0.5rem;
        padding: 1rem;
        text-align: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
</style>
""", unsafe_allow_html=True)

@st.cache_resource
def load_analyzer():
    return SnowRiskAnalyzer("./sample")

def get_severity_color(severity):
    if severity == RiskSeverity.HIGH.value:
        return "#ff4444"
    elif severity == RiskSeverity.MEDIUM.value:
        return "#ffaa00"
    else:
        return "#44aa44"

def get_severity_badge(severity):
    if severity == RiskSeverity.HIGH.value:
        return '<span class="risk-high">🔴 高风险</span>'
    elif severity == RiskSeverity.MEDIUM.value:
        return '<span class="risk-medium">🟡 中风险</span>'
    else:
        return '<span class="risk-low">🟢 低风险</span>'

def create_download_link(df, filename, link_text):
    csv = df.to_csv(index=False, encoding='utf-8-sig')
    b64 = base64.b64encode(csv.encode('utf-8-sig')).decode()
    href = f'<a href="data:file/csv;base64,{b64}" download="{filename}">{link_text}</a>'
    return href

def create_md_download_link(md_content, filename, link_text):
    b64 = base64.b64encode(md_content.encode('utf-8')).decode()
    href = f'<a href="data:file/markdown;base64,{b64}" download="{filename}">{link_text}</a>'
    return href

def main():
    analyzer = load_analyzer()
    
    st.markdown('<h1 class="main-header">❄️ 雪道开放风险复盘看板</h1>', unsafe_allow_html=True)
    st.markdown('<p class="sub-header">滑雪场运营主管早场开园前风险评估工具</p>', unsafe_allow_html=True)

    available_dates = analyzer.get_available_dates()
    available_trails = analyzer.get_available_trails()

    with st.sidebar:
        st.header("📅 筛选条件")
        
        selected_date = st.selectbox(
            "选择日期",
            options=available_dates,
            index=len(available_dates) - 1 if available_dates else 0
        )
        
        selected_trails = st.multiselect(
            "选择雪道 (默认全部)",
            options=available_trails,
            default=available_trails
        )
        
        risk_filter = st.multiselect(
            "风险等级筛选",
            options=[RiskSeverity.HIGH.value, RiskSeverity.MEDIUM.value, RiskSeverity.LOW.value],
            default=[RiskSeverity.HIGH.value, RiskSeverity.MEDIUM.value, RiskSeverity.LOW.value]
        )
        
        st.markdown("---")
        st.header("⚙️ 关于")
        st.info("""
        此工具用于：
        - 分析压雪作业完成度
        - 检查天气影响（风吹雪）
        - 验证巡查记录有效性
        - 检测跨午夜作业异常
        - 识别结冰/裸露问题
        """)

    all_risks = analyzer.analyze_all_trails_for_date(selected_date)
    
    if selected_trails:
        filtered_risks = [r for r in all_risks if r.trail_name in selected_trails]
    else:
        filtered_risks = all_risks
    
    filtered_risks = [r for r in filtered_risks if r.severity in risk_filter]

    high_count = sum(1 for r in filtered_risks if r.severity == RiskSeverity.HIGH.value)
    medium_count = sum(1 for r in filtered_risks if r.severity == RiskSeverity.MEDIUM.value)
    low_count = sum(1 for r in filtered_risks if r.severity == RiskSeverity.LOW.value)

    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.markdown(f"""
        <div class="metric-card">
            <h3>🔴 高风险</h3>
            <p style="font-size: 2rem; color: #ff4444; font-weight: bold;">{high_count}</p>
        </div>
        """, unsafe_allow_html=True)
    
    with col2:
        st.markdown(f"""
        <div class="metric-card">
            <h3>🟡 中风险</h3>
            <p style="font-size: 2rem; color: #ffaa00; font-weight: bold;">{medium_count}</p>
        </div>
        """, unsafe_allow_html=True)
    
    with col3:
        st.markdown(f"""
        <div class="metric-card">
            <h3>🟢 低风险</h3>
            <p style="font-size: 2rem; color: #44aa44; font-weight: bold;">{low_count}</p>
        </div>
        """, unsafe_allow_html=True)
    
    with col4:
        trails_with_risk = len(set(r.trail_name for r in filtered_risks))
        total_trails = len(selected_trails) if selected_trails else len(available_trails)
        st.markdown(f"""
        <div class="metric-card">
            <h3>⚠️ 受影响雪道</h3>
            <p style="font-size: 2rem; color: #1f77b4; font-weight: bold;">{trails_with_risk}/{total_trails}</p>
        </div>
        """, unsafe_allow_html=True)

    tab1, tab2, tab3, tab4 = st.tabs(["📋 风险列表", "📊 趋势分析", "🕐 时间线", "📄 导出报告"])

    with tab1:
        st.header(f"📋 {selected_date} 风险详情")
        
        if filtered_risks:
            risk_data = []
            for risk in filtered_risks:
                risk_data.append({
                    "风险ID": risk.risk_id,
                    "雪道名称": risk.trail_name,
                    "风险类型": risk.risk_type,
                    "严重程度": risk.severity,
                    "描述": risk.description,
                    "缓解措施": risk.mitigation
                })
            
            df_risks = pd.DataFrame(risk_data)
            
            for severity in [RiskSeverity.HIGH.value, RiskSeverity.MEDIUM.value, RiskSeverity.LOW.value]:
                severity_risks = df_risks[df_risks["严重程度"] == severity]
                if not severity_risks.empty:
                    st.subheader(f"{get_severity_badge(severity)} {severity}风险 ({len(severity_risks)}项)")
                    
                    for _, row in severity_risks.iterrows():
                        with st.expander(f"**{row['雪道名称']}** - {row['风险类型']}"):
                            col_a, col_b = st.columns(2)
                            with col_a:
                                st.markdown(f"**描述**: {row['描述']}")
                            with col_b:
                                st.markdown(f"**缓解措施**: {row['缓解措施']}")
        else:
            st.success("🎉 所选条件下无风险项！所有雪道状态良好。")

    with tab2:
        st.header("📊 风险趋势分析")
        
        col_trend1, col_trend2 = st.columns(2)
        
        with col_trend1:
            st.subheader("风险类型分布")
            
            if filtered_risks:
                risk_types = {}
                for risk in filtered_risks:
                    risk_types[risk.risk_type] = risk_types.get(risk.risk_type, 0) + 1
                
                fig_types = px.pie(
                    values=list(risk_types.values()),
                    names=list(risk_types.keys()),
                    title="风险类型占比",
                    color_discrete_sequence=px.colors.qualitative.Set3
                )
                st.plotly_chart(fig_types, use_container_width=True)
            else:
                st.info("无数据可显示")
        
        with col_trend2:
            st.subheader("雪道风险分布")
            
            if filtered_risks:
                trail_risks = {}
                for risk in filtered_risks:
                    if risk.trail_name not in trail_risks:
                        trail_risks[risk.trail_name] = {"高": 0, "中": 0, "低": 0}
                    severity_map = {
                        RiskSeverity.HIGH.value: "高",
                        RiskSeverity.MEDIUM.value: "中",
                        RiskSeverity.LOW.value: "低"
                    }
                    trail_risks[risk.trail_name][severity_map[risk.severity]] += 1
                
                trails = list(trail_risks.keys())
                high_counts = [trail_risks[t]["高"] for t in trails]
                medium_counts = [trail_risks[t]["中"] for t in trails]
                low_counts = [trail_risks[t]["低"] for t in trails]
                
                fig_trails = go.Figure(data=[
                    go.Bar(name='高风险', x=trails, y=high_counts, marker_color='#ff4444'),
                    go.Bar(name='中风险', x=trails, y=medium_counts, marker_color='#ffaa00'),
                    go.Bar(name='低风险', x=trails, y=low_counts, marker_color='#44aa44')
                ])
                fig_trails.update_layout(
                    barmode='stack',
                    title="各雪道风险分布",
                    xaxis_title="雪道名称",
                    yaxis_title="风险数量"
                )
                st.plotly_chart(fig_trails, use_container_width=True)
            else:
                st.info("无数据可显示")
        
        st.subheader("🌡️ 天气趋势")
        weather_df = analyzer.get_weather_for_date(selected_date)
        
        if not weather_df.empty:
            fig_weather = go.Figure()
            
            fig_weather.add_trace(go.Scatter(
                x=weather_df['timestamp'],
                y=weather_df['wind_speed_kmh'],
                name='风速 (km/h)',
                line=dict(color='#ff7f0e', width=2),
                yaxis='y1'
            ))
            
            fig_weather.add_trace(go.Scatter(
                x=weather_df['timestamp'],
                y=weather_df['snowfall_cm'],
                name='降雪量 (cm)',
                line=dict(color='#1f77b4', width=2),
                yaxis='y2'
            ))
            
            fig_weather.add_trace(go.Scatter(
                x=weather_df['timestamp'],
                y=weather_df['temperature_c'],
                name='气温 (°C)',
                line=dict(color='#2ca02c', width=2),
                yaxis='y3'
            ))
            
            fig_weather.update_layout(
                title=f"{selected_date} 天气趋势",
                xaxis=dict(title='时间'),
                yaxis=dict(title='风速 (km/h)', side='left'),
                yaxis2=dict(title='降雪量 (cm)', side='right', overlaying='y'),
                yaxis3=dict(title='气温 (°C)', side='right', overlaying='y', position=0.95),
                legend=dict(orientation='h', yanchor='bottom', y=1.02)
            )
            st.plotly_chart(fig_weather, use_container_width=True)
        else:
            st.info("无天气数据")

    with tab3:
        st.header("🕐 雪道作业时间线")
        
        if selected_trails:
            trail_to_view = st.selectbox(
                "选择要查看时间线的雪道",
                options=selected_trails
            )
            
            if trail_to_view:
                timeline = analyzer.build_timeline(trail_to_view, selected_date)
                
                if timeline:
                    st.subheader(f"{trail_to_view} - {selected_date} 时间线")
                    
                    grooming_events = [e for e in timeline if e['type'] == 'grooming']
                    patrol_events = [e for e in timeline if e['type'] == 'patrol']
                    weather_events = [e for e in timeline if e['type'] == 'weather']
                    
                    if grooming_events:
                        st.markdown("### 🚜 压雪作业")
                        for event in grooming_events:
                            with st.container():
                                col1, col2 = st.columns([1, 3])
                                with col1:
                                    st.markdown(f"**{event['start_time'].strftime('%H:%M')} - {event['end_time'].strftime('%H:%M')}**")
                                with col2:
                                    st.markdown(f"""
                                    **{event['label']}**
                                    - 车辆: {event['vehicle_id']}
                                    - 操作员: {event['operator']}
                                    - 完成度: {event['completion_pct']}%
                                    """)
                    
                    if patrol_events:
                        st.markdown("### 🔍 巡查记录")
                        for event in patrol_events:
                            status_color = "🔴" if event['status'] == "紧急" else ("🟡" if event['status'] == "待处理" else "🟢")
                            with st.container():
                                col1, col2 = st.columns([1, 3])
                                with col1:
                                    st.markdown(f"**{event['timestamp'].strftime('%H:%M')}**")
                                with col2:
                                    st.markdown(f"""
                                    **{status_color} {event['label']}**
                                    - 巡查员: {event['inspector']}
                                    - 状态: {event['status']}
                                    - 问题: {', '.join(event['issues']) if event['issues'] else '无'}
                                    """)
                    
                    if weather_events:
                        st.markdown("### 🌤️ 天气变化")
                        weather_times = [e['timestamp'] for e in weather_events]
                        weather_winds = [e['wind_speed_kmh'] for e in weather_events]
                        weather_snow = [e['snowfall_cm'] for e in weather_events]
                        weather_temp = [e['temperature_c'] for e in weather_events]
                        
                        fig_tl = go.Figure()
                        fig_tl.add_trace(go.Scatter(
                            x=weather_times, y=weather_winds,
                            mode='lines+markers', name='风速 (km/h)',
                            line=dict(color='#ff7f0e')
                        ))
                        fig_tl.add_trace(go.Scatter(
                            x=weather_times, y=weather_snow,
                            mode='lines+markers', name='降雪 (cm)',
                            line=dict(color='#1f77b4')
                        ))
                        fig_tl.update_layout(
                            title="夜间天气变化",
                            xaxis_title="时间",
                            yaxis_title="数值"
                        )
                        st.plotly_chart(fig_tl, use_container_width=True)
                else:
                    st.info(f"{trail_to_view} 在 {selected_date} 无时间线记录")
        else:
            st.warning("请先在侧边栏选择雪道")

    with tab4:
        st.header("📄 导出报告")
        
        col_export1, col_export2 = st.columns(2)
        
        with col_export1:
            st.subheader("📊 导出风险列表 (CSV)")
            
            if filtered_risks:
                risks_df = analyzer.risks_to_dataframe(filtered_risks)
                
                st.dataframe(risks_df[['risk_id', 'trail_name', 'risk_type', 'severity', 'description']])
                
                csv_link = create_download_link(risks_df, f"risk_items_{selected_date}.csv", "📥 下载 risk_items.csv")
                st.markdown(csv_link, unsafe_allow_html=True)
            else:
                st.info("无风险数据可导出")
        
        with col_export2:
            st.subheader("📝 生成开放复盘报告 (Markdown)")
            
            if selected_date:
                review_md = analyzer.generate_open_review(selected_date, all_risks)
                
                st.markdown(review_md)
                
                md_link = create_md_download_link(review_md, f"open_review_{selected_date}.md", "📥 下载 open_review.md")
                st.markdown(md_link, unsafe_allow_html=True)
        
        st.markdown("---")
        st.subheader("📋 报告摘要")
        
        col_sum1, col_sum2, col_sum3 = st.columns(3)
        
        with col_sum1:
            st.metric(
                label="总风险项",
                value=len(filtered_risks),
                delta=f"高风险: {high_count}"
            )
        
        with col_sum2:
            trails_clear = len(selected_trails) - len(set(r.trail_name for r in filtered_risks)) if selected_trails else 0
            st.metric(
                label="可正常开放雪道",
                value=trails_clear,
                delta=f"占比: {trails_clear/len(selected_trails)*100:.0f}%" if selected_trails else "0%"
            )
        
        with col_sum3:
            latest_patrol_time = None
            for r in all_risks:
                if 'patrol_time' in r.details:
                    patrol_time = pd.to_datetime(r.details['patrol_time'])
                    if latest_patrol_time is None or patrol_time > latest_patrol_time:
                        latest_patrol_time = patrol_time
            
            st.metric(
                label="最近巡查时间",
                value=latest_patrol_time.strftime('%H:%M') if latest_patrol_time else "无"
            )

if __name__ == "__main__":
    main()
