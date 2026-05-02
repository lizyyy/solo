import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px

from config import PAGE_CONFIG
from persistence import SessionState
from models import RiskLevel
from risk_algorithm import RiskCalculator, identify_risk_hotspots

st.set_page_config(**PAGE_CONFIG)

if "session" not in st.session_state:
    st.session_state.session = SessionState()

session = st.session_state.session

st.title("📊 风险分析")
st.markdown("---")

if not session.persons:
    st.warning("⚠️ 请先在「数据导入」页面加载老人数据并创建方案。")
    st.stop()

if not all(p.risk_score > 0 for p in session.persons):
    st.warning("⚠️ 风险分未计算，请重新创建方案。")
    st.stop()

st.subheader("风险概览")

risk_dist = {
    "低风险": 0, "中风险": 0, "高风险": 0, "极高风险": 0
}
for p in session.persons:
    risk_dist[p.risk_level] = risk_dist.get(p.risk_level, 0) + 1

col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("🟢 低风险", risk_dist["低风险"], 
              delta=f"{risk_dist['低风险']/len(session.persons)*100:.1f}%")
with col2:
    st.metric("🟡 中风险", risk_dist["中风险"],
              delta=f"{risk_dist['中风险']/len(session.persons)*100:.1f}%")
with col3:
    st.metric("🟠 高风险", risk_dist["高风险"],
              delta=f"{risk_dist['高风险']/len(session.persons)*100:.1f}%")
with col4:
    st.metric("🔴 极高风险", risk_dist["极高风险"],
              delta=f"{risk_dist['极高风险']/len(session.persons)*100:.1f}%")

st.markdown("---")

tab1, tab2, tab3 = st.tabs(["📋 老人风险列表", "📈 社区风险统计", "🔥 风险热点分析"])

with tab1:
    st.subheader("老人风险详情")
    
    filter_risk = st.multiselect(
        "筛选风险等级",
        ["低风险", "中风险", "高风险", "极高风险"],
        default=["高风险", "极高风险"]
    )
    
    persons_to_show = [p for p in session.persons if p.risk_level in filter_risk] if filter_risk else session.persons
    
    df_data = []
    for p in sorted(persons_to_show, key=lambda x: -x.risk_score):
        health_str = "、".join(p.health_conditions) if p.health_conditions else "无"
        df_data.append({
            "风险分": f"{p.risk_score:.2f}",
            "风险等级": p.risk_level,
            "姓名": p.name,
            "年龄": p.age,
            "社区": p.community,
            "健康状况": health_str,
            "独居": "是" if p.living_alone else "否",
            "行动能力": p.mobility,
            "有空调": "是" if p.has_air_conditioning else "否",
            "探访优先级": p.visit_priority,
        })
    
    df = pd.DataFrame(df_data)
    
    def highlight_risk(s):
        if s["风险等级"] == "极高风险":
            return ["background-color: #dc3545; color: white" for _ in s]
        elif s["风险等级"] == "高风险":
            return ["background-color: #fd7e14; color: white" for _ in s]
        elif s["风险等级"] == "中风险":
            return ["background-color: #ffc107; color: black" for _ in s]
        else:
            return ["background-color: #28a745; color: white" for _ in s]
    
    st.dataframe(
        df.style.apply(highlight_risk, axis=1),
        use_container_width=True,
        hide_index=True
    )
    
    st.markdown(f"**显示 {len(persons_to_show)} 位老人，共 {len(session.persons)} 位**")
    
    if st.checkbox("查看极高风险老人详情"):
        critical_persons = [p for p in session.persons if p.risk_level == "极高风险"]
        if critical_persons:
            for p in critical_persons:
                with st.expander(f"🔴 {p.name} (风险分: {p.risk_score:.2f})", expanded=True):
                    col1, col2 = st.columns([1, 1])
                    with col1:
                        st.markdown(f"**基本信息**")
                        st.write(f"- 年龄: {p.age}岁")
                        st.write(f"- 性别: {p.gender}")
                        st.write(f"- 住址: {p.address}")
                        st.write(f"- 社区: {p.community}")
                    with col2:
                        st.markdown(f"**风险因素**")
                        st.write(f"- 健康状况: {', '.join(p.health_conditions) if p.health_conditions else '无'}")
                        st.write(f"- 独居: {'是' if p.living_alone else '否'}")
                        st.write(f"- 行动能力: {p.mobility}")
                        st.write(f"- 有空调: {'是' if p.has_air_conditioning else '否'}")
                    
                    st.markdown(f"**联系方式**")
                    st.write(f"- 电话: {p.phone}")
                    st.write(f"- 紧急联系人: {p.contact_person} ({p.contact_phone})")
                    
                    if p.notes:
                        st.markdown(f"**备注**: {p.notes}")
        else:
            st.info("暂无极高风险老人")

with tab2:
    st.subheader("社区风险统计")
    
    communities = sorted(set(p.community for p in session.persons))
    
    community_stats = {}
    for comm in communities:
        comm_persons = [p for p in session.persons if p.community == comm]
        risk_counts = {
            "低风险": 0, "中风险": 0, "高风险": 0, "极高风险": 0
        }
        total_risk = 0
        for p in comm_persons:
            risk_counts[p.risk_level] = risk_counts.get(p.risk_level, 0) + 1
            total_risk += p.risk_score
        
        community_stats[comm] = {
            "total": len(comm_persons),
            "risk_counts": risk_counts,
            "avg_risk": total_risk / len(comm_persons) if comm_persons else 0,
            "high_risk_ratio": (risk_counts["高风险"] + risk_counts["极高风险"]) / len(comm_persons) if comm_persons else 0,
        }
    
    fig_data = []
    for comm, stats in community_stats.items():
        fig_data.append({
            "社区": comm,
            "低风险": stats["risk_counts"]["低风险"],
            "中风险": stats["risk_counts"]["中风险"],
            "高风险": stats["risk_counts"]["高风险"],
            "极高风险": stats["risk_counts"]["极高风险"],
            "高风险比例": stats["high_risk_ratio"] * 100,
        })
    
    df_comm = pd.DataFrame(fig_data)
    
    st.markdown("### 各社区风险分布")
    
    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=df_comm["社区"], y=df_comm["低风险"],
        name="低风险", marker_color="#28a745"
    ))
    fig.add_trace(go.Bar(
        x=df_comm["社区"], y=df_comm["中风险"],
        name="中风险", marker_color="#ffc107"
    ))
    fig.add_trace(go.Bar(
        x=df_comm["社区"], y=df_comm["高风险"],
        name="高风险", marker_color="#fd7e14"
    ))
    fig.add_trace(go.Bar(
        x=df_comm["社区"], y=df_comm["极高风险"],
        name="极高风险", marker_color="#dc3545"
    ))
    
    fig.update_layout(
        barmode="stack",
        xaxis_title="社区",
        yaxis_title="人数",
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        height=400,
    )
    st.plotly_chart(fig, use_container_width=True)
    
    st.markdown("### 各社区高风险比例")
    
    fig2 = px.bar(
        df_comm, x="社区", y="高风险比例",
        color="高风险比例",
        color_continuous_scale=["#28a745", "#ffc107", "#fd7e14", "#dc3545"],
        labels={"高风险比例": "高风险比例 (%)"},
    )
    fig2.update_layout(height=350)
    st.plotly_chart(fig2, use_container_width=True)
    
    st.markdown("### 详细统计")
    st.dataframe(df_comm, use_container_width=True, hide_index=True)

with tab3:
    st.subheader("风险热点分析")
    
    if session.stations:
        hotspots = identify_risk_hotspots(session.persons, session.stations)
        session.hotspots = hotspots
        
        if hotspots:
            st.markdown(f"**识别到 {len(hotspots)} 个风险热点区域**")
            
            high_severity = [h for h in hotspots if h["severity"] == "高"]
            medium_severity = [h for h in hotspots if h["severity"] == "中"]
            
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("🔴 高严重程度", len(high_severity))
            with col2:
                st.metric("🟡 中严重程度", len(medium_severity))
            with col3:
                st.metric("🟢 低严重程度", len(hotspots) - len(high_severity) - len(medium_severity))
            
            st.markdown("### 热点详情")
            
            df_hotspots = []
            for h in hotspots:
                df_hotspots.append({
                    "严重程度": h["severity"],
                    "中心纬度": f"{h['center_lat']:.4f}",
                    "中心经度": f"{h['center_lon']:.4f}",
                    "老人总数": h["total_count"],
                    "高/极高风险": h["high_risk_total"],
                    "平均风险分": f"{h['avg_risk_score']:.2f}",
                    "最近站点(km)": h["nearest_station_km"],
                })
            
            df_h = pd.DataFrame(df_hotspots)
            
            def highlight_severity(s):
                if s["严重程度"] == "高":
                    return ["background-color: #dc3545; color: white" for _ in s]
                elif s["严重程度"] == "中":
                    return ["background-color: #fd7e14; color: white" for _ in s]
                else:
                    return ["background-color: #28a745; color: white" for _ in s]
            
            st.dataframe(
                df_h.style.apply(highlight_severity, axis=1),
                use_container_width=True,
                hide_index=True
            )
            
            st.markdown("""
            **热点分析说明**:
            - 热点区域基于老人地理位置聚类识别
            - 严重程度取决于该区域高/极高风险老人数量
            - 最近站点距离帮助识别覆盖缺口
            """)
        else:
            st.info("未识别到风险热点区域")
    else:
        st.warning("请先加载站点数据以进行热点分析")

st.markdown("---")

st.subheader("风险因素权重配置")

with st.expander("调整风险计算权重", expanded=False):
    st.markdown("当前权重配置（可在 config.py 中永久修改）:")
    
    from config import WEIGHTS_CONFIG
    
    col1, col2 = st.columns([1, 1])
    with col1:
        new_age = st.slider("年龄因素", 0.0, 0.5, WEIGHTS_CONFIG["age"], 0.05)
        new_health = st.slider("健康状况", 0.0, 0.5, WEIGHTS_CONFIG["health"], 0.05)
    with col2:
        new_living = st.slider("独居因素", 0.0, 0.5, WEIGHTS_CONFIG["living_alone"], 0.05)
        new_mobility = st.slider("行动能力", 0.0, 0.5, WEIGHTS_CONFIG["mobility"], 0.05)
    new_heat = st.slider("高温暴露", 0.0, 0.5, WEIGHTS_CONFIG["heat_exposure"], 0.05)
    
    total = new_age + new_health + new_living + new_mobility + new_heat
    st.info(f"权重总和: {total:.2f} (建议为 1.0)")
    
    if st.button("重新计算风险分"):
        temp_weights = {
            "age": new_age,
            "health": new_health,
            "living_alone": new_living,
            "mobility": new_mobility,
            "heat_exposure": new_heat,
        }
        
        from risk_algorithm import RiskCalculator
        from config import RISK_CONFIG
        
        class TempRiskCalculator(RiskCalculator):
            def __init__(self):
                super().__init__()
                self.weights = temp_weights
        
        risk_calc = TempRiskCalculator()
        for person in session.persons:
            risk_calc.update_person_risk(person, session.forecast)
        
        st.success("✅ 风险分已重新计算")
        st.rerun()
