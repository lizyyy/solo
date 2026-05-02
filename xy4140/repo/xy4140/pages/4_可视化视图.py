import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px

from config import PAGE_CONFIG
from persistence import SessionState
from models import RiskLevel

st.set_page_config(**PAGE_CONFIG)

if "session" not in st.session_state:
    st.session_state.session = SessionState()

session = st.session_state.session

st.title("📊 可视化视图")
st.markdown("---")

if not session.persons or not session.stations:
    st.warning("⚠️ 请先在「数据导入」页面加载数据。")
    st.stop()

tab1, tab2, tab3, tab4 = st.tabs([
    "🗺️ 地理分布", 
    "🔥 风险热力图", 
    "📊 统计图表",
    "⏰ 时间线分析"
])

with tab1:
    st.subheader("老人与站点地理分布")
    
    st.markdown("### 分布概览")
    
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("老人总数", len(session.persons))
    with col2:
        st.metric("避暑站数量", len(session.stations))
    with col3:
        communities = len(set(p.community for p in session.persons))
        st.metric("覆盖社区", communities)
    
    st.markdown("### 交互式地图")
    
    try:
        import folium
        from streamlit_folium import folium_static
        
        all_lats = [p.latitude for p in session.persons] + [s.latitude for s in session.stations]
        all_lons = [p.longitude for p in session.persons] + [s.longitude for s in session.stations]
        
        center_lat = sum(all_lats) / len(all_lats)
        center_lon = sum(all_lons) / len(all_lons)
        
        m = folium.Map(location=[center_lat, center_lon], zoom_start=13)
        
        risk_colors = {
            "低风险": "green",
            "中风险": "orange",
            "高风险": "red",
            "极高风险": "darkred",
        }
        
        for person in session.persons:
            color = risk_colors.get(person.risk_level, "blue")
            
            popup_html = f"""
            <b>{person.name}</b><br>
            年龄: {person.age}岁<br>
            风险等级: {person.risk_level}<br>
            风险分: {person.risk_score:.2f}<br>
            社区: {person.community}<br>
            独居: {'是' if person.living_alone else '否'}<br>
            行动能力: {person.mobility}
            """
            
            folium.CircleMarker(
                location=[person.latitude, person.longitude],
                radius=8,
                popup=folium.Popup(popup_html, max_width=300),
                color=color,
                fill=True,
                fill_color=color,
                fill_opacity=0.7,
                tooltip=f"{person.name} ({person.risk_level})",
            ).add_to(m)
        
        for station in session.stations:
            is_locked = station.id in getattr(session, 'locked_stations', [])
            
            icon_color = "blue" if not is_locked else "gray"
            
            popup_html = f"""
            <b>{station.name}</b><br>
            容量: {station.capacity}人<br>
            工作人员: {station.staff_count}人<br>
            开放时间: {station.opening_time} - {station.closing_time}<br>
            设施: {', '.join(station.facilities) if station.facilities else '无'}<br>
            状态: {'锁定' if is_locked else '开放'}
            """
            
            folium.Marker(
                location=[station.latitude, station.longitude],
                popup=folium.Popup(popup_html, max_width=300),
                icon=folium.Icon(color=icon_color, icon="building", prefix="fa"),
                tooltip=station.name,
            ).add_to(m)
        
        st.markdown("**图例说明**:")
        col1, col2, col3, col4, col5 = st.columns(5)
        with col1:
            st.markdown("🟢 低风险老人")
        with col2:
            st.markdown("🟡 中风险老人")
        with col3:
            st.markdown("🔴 高风险老人")
        with col4:
            st.markdown("⚫ 极高风险老人")
        with col5:
            st.markdown("🏛️ 避暑站")
        
        folium_static(m, width=800, height=500)
        
    except ImportError:
        st.warning("⚠️ 请安装 folium 和 streamlit-folium 以查看地图")
        
        st.markdown("### 位置数据预览")
        df_data = []
        for p in session.persons:
            df_data.append({
                "类型": "老人",
                "名称": p.name,
                "风险等级": p.risk_level,
                "纬度": p.latitude,
                "经度": p.longitude,
                "社区": p.community,
            })
        for s in session.stations:
            df_data.append({
                "类型": "避暑站",
                "名称": s.name,
                "风险等级": "-",
                "纬度": s.latitude,
                "经度": s.longitude,
                "社区": s.community,
            })
        st.dataframe(pd.DataFrame(df_data), use_container_width=True, hide_index=True)

with tab2:
    st.subheader("风险热力分析")
    
    st.markdown("### 各社区风险热力")
    
    communities = sorted(set(p.community for p in session.persons))
    
    community_risk = {}
    for comm in communities:
        comm_persons = [p for p in session.persons if p.community == comm]
        total_risk = sum(p.risk_score for p in comm_persons)
        avg_risk = total_risk / len(comm_persons) if comm_persons else 0
        
        risk_counts = {
            "低风险": 0, "中风险": 0, "高风险": 0, "极高风险": 0
        }
        for p in comm_persons:
            risk_counts[p.risk_level] = risk_counts.get(p.risk_level, 0) + 1
        
        community_risk[comm] = {
            "avg_risk": avg_risk,
            "count": len(comm_persons),
            "risk_counts": risk_counts,
        }
    
    df_heat = pd.DataFrame([
        {
            "社区": comm,
            "平均风险分": round(data["avg_risk"], 3),
            "老人数量": data["count"],
            "低风险": data["risk_counts"]["低风险"],
            "中风险": data["risk_counts"]["中风险"],
            "高风险": data["risk_counts"]["高风险"],
            "极高风险": data["risk_counts"]["极高风险"],
        }
        for comm, data in community_risk.items()
    ])
    
    df_heat_sorted = df_heat.sort_values("平均风险分", ascending=False)
    
    st.dataframe(
        df_heat_sorted.style.background_gradient(
            subset=["平均风险分"],
            cmap="RdYlGn_r",
        ),
        use_container_width=True,
        hide_index=True,
    )
    
    st.markdown("### 风险热力图")
    
    fig = px.density_heatmap(
        df_heat_sorted,
        x="社区",
        y="平均风险分",
        z="老人数量",
        color_continuous_scale="RdYlGn_r",
        title="各社区平均风险分热力图",
    )
    fig.update_layout(height=400)
    st.plotly_chart(fig, use_container_width=True)
    
    st.markdown("### 个人风险分布")
    
    risk_scores = [p.risk_score for p in session.persons]
    
    fig = go.Figure()
    fig.add_trace(go.Histogram(
        x=risk_scores,
        nbinsx=20,
        marker_color="#fd7e14",
        name="风险分分布",
    ))
    fig.add_vline(x=0.25, line_dash="dash", line_color="#ffc107", annotation_text="中风险阈值")
    fig.add_vline(x=0.50, line_dash="dash", line_color="#fd7e14", annotation_text="高风险阈值")
    fig.add_vline(x=0.75, line_dash="dash", line_color="#dc3545", annotation_text="极高风险阈值")
    
    fig.update_layout(
        xaxis_title="风险分",
        yaxis_title="人数",
        height=350,
    )
    st.plotly_chart(fig, use_container_width=True)

with tab3:
    st.subheader("统计图表分析")
    
    col1, col2 = st.columns([1, 1])
    
    with col1:
        st.markdown("### 风险等级分布")
        
        risk_dist = {
            "低风险": 0, "中风险": 0, "高风险": 0, "极高风险": 0
        }
        for p in session.persons:
            risk_dist[p.risk_level] = risk_dist.get(p.risk_level, 0) + 1
        
        labels = list(risk_dist.keys())
        values = list(risk_dist.values())
        colors = ["#28a745", "#ffc107", "#fd7e14", "#dc3545"]
        
        fig = go.Figure(data=[go.Pie(
            labels=labels,
            values=values,
            marker_colors=colors,
            textinfo="label+percent",
            hole=0.4,
        )])
        fig.update_layout(height=350)
        st.plotly_chart(fig, use_container_width=True)
    
    with col2:
        st.markdown("### 各社区老人数量")
        
        comm_counts = {}
        for p in session.persons:
            comm_counts[p.community] = comm_counts.get(p.community, 0) + 1
        
        comms = sorted(comm_counts.keys())
        counts = [comm_counts[c] for c in comms]
        
        fig = go.Figure(data=[go.Bar(
            x=comms,
            y=counts,
            marker_color="#1f77b4",
            text=counts,
            textposition="auto",
        )])
        fig.update_layout(
            xaxis_title="社区",
            yaxis_title="老人数量",
            height=350,
        )
        st.plotly_chart(fig, use_container_width=True)
    
    st.markdown("---")
    
    col1, col2 = st.columns([1, 1])
    
    with col1:
        st.markdown("### 年龄分布")
        
        ages = [p.age for p in session.persons]
        
        fig = go.Figure(data=[go.Histogram(
            x=ages,
            nbinsx=15,
            marker_color="#9467bd",
            name="年龄分布",
        )])
        fig.update_layout(
            xaxis_title="年龄",
            yaxis_title="人数",
            height=350,
        )
        st.plotly_chart(fig, use_container_width=True)
    
    with col2:
        st.markdown("### 健康状况统计")
        
        all_conditions = []
        for p in session.persons:
            all_conditions.extend(p.health_conditions)
        
        from collections import Counter
        condition_counts = Counter(all_conditions)
        
        if condition_counts:
            top_conditions = condition_counts.most_common(8)
            labels = [c[0] for c in top_conditions]
            counts = [c[1] for c in top_conditions]
            
            fig = go.Figure(data=[go.Bar(
                x=counts,
                y=labels,
                orientation="h",
                marker_color="#2ca02c",
            )])
            fig.update_layout(
                xaxis_title="人数",
                yaxis_title="健康状况",
                height=350,
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("暂无健康状况数据")
    
    st.markdown("---")
    
    st.markdown("### 独居与非独居对比")
    
    living_alone_dist = {
        "独居": {
            "低风险": 0, "中风险": 0, "高风险": 0, "极高风险": 0
        },
        "非独居": {
            "低风险": 0, "中风险": 0, "高风险": 0, "极高风险": 0
        }
    }
    
    for p in session.persons:
        key = "独居" if p.living_alone else "非独居"
        living_alone_dist[key][p.risk_level] += 1
    
    fig = go.Figure()
    
    risk_order = ["低风险", "中风险", "高风险", "极高风险"]
    colors = ["#28a745", "#ffc107", "#fd7e14", "#dc3545"]
    
    for i, risk in enumerate(risk_order):
        fig.add_trace(go.Bar(
            x=["独居", "非独居"],
            y=[
                living_alone_dist["独居"][risk],
                living_alone_dist["非独居"][risk]
            ],
            name=risk,
            marker_color=colors[i],
        ))
    
    fig.update_layout(
        barmode="stack",
        xaxis_title="居住状况",
        yaxis_title="人数",
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        height=400,
    )
    st.plotly_chart(fig, use_container_width=True)

with tab4:
    st.subheader("时间线分析")
    
    if not session.forecast:
        st.warning("⚠️ 请先加载温度预报数据")
    else:
        st.markdown("### 体感温度时间线")
        
        hours = [hf.hour for hf in session.forecast.hourly_forecasts]
        temps = [hf.temperature for hf in session.forecast.hourly_forecasts]
        feels_like = [hf.feels_like for hf in session.forecast.hourly_forecasts]
        humidity = [hf.humidity for hf in session.forecast.hourly_forecasts]
        
        fig = go.Figure()
        
        fig.add_trace(go.Scatter(
            x=hours, y=temps,
            mode='lines+markers',
            name='实际温度',
            line=dict(color='#1f77b4', width=2),
        ))
        fig.add_trace(go.Scatter(
            x=hours, y=feels_like,
            mode='lines+markers',
            name='体感温度',
            line=dict(color='#ff7f0e', width=2),
            fill='tonexty',
        ))
        
        fig.add_hrect(
            y0=35, y1=38,
            fillcolor="#ffc107", opacity=0.2,
            layer="below", line_width=0,
            annotation_text="高温预警区",
        )
        fig.add_hrect(
            y0=38, y1=50,
            fillcolor="#dc3545", opacity=0.2,
            layer="below", line_width=0,
            annotation_text="危险区",
        )
        
        fig.update_layout(
            xaxis_title="时间 (时)",
            yaxis_title="温度 (°C)",
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
            height=400,
        )
        st.plotly_chart(fig, use_container_width=True)
        
        st.markdown("### 湿度变化")
        
        fig = go.Figure(data=[go.Scatter(
            x=hours, y=humidity,
            mode='lines+markers',
            fill='tozeroy',
            line=dict(color='#9467bd', width=2),
        )])
        fig.update_layout(
            xaxis_title="时间 (时)",
            yaxis_title="湿度 (%)",
            height=300,
        )
        st.plotly_chart(fig, use_container_width=True)
        
        if session.congestions:
            st.markdown("### 站点拥挤度时间线")
            
            station_names = [s.name for s in session.stations]
            selected_station = st.selectbox("选择站点", station_names)
            
            station = next((s for s in session.stations if s.name == selected_station), None)
            if station and station.id in session.congestions:
                hourly_data = session.congestions[station.id]
                
                hours_cong = [h.hour for h in hourly_data]
                people = [h.estimated_people for h in hourly_data]
                levels = [h.congestion_level for h in hourly_data]
                
                colors = []
                for level in levels:
                    if level == "关闭":
                        colors.append("#6c757d")
                    elif level == "宽松":
                        colors.append("#28a745")
                    elif level == "较拥挤":
                        colors.append("#ffc107")
                    elif level == "拥挤":
                        colors.append("#fd7e14")
                    else:
                        colors.append("#dc3545")
                
                fig = go.Figure()
                fig.add_trace(go.Bar(
                    x=hours_cong, y=people,
                    marker_color=colors,
                    text=levels,
                    textposition="auto",
                ))
                fig.add_hline(y=station.capacity, line_dash="dash", line_color="red",
                              annotation_text=f"容量上限 ({station.capacity}人)")
                
                fig.update_layout(
                    xaxis_title="时间 (时)",
                    yaxis_title="预计人数",
                    height=350,
                )
                st.plotly_chart(fig, use_container_width=True)
