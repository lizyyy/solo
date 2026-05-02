import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px

from config import PAGE_CONFIG
from persistence import SessionState, PlanManager
from models import RiskLevel
from dispatch_simulation import (
    CoverageAnalyzer,
    CongestionAnalyzer,
    StationAssigner,
    RouteOptimizer,
)

st.set_page_config(**PAGE_CONFIG)

if "session" not in st.session_state:
    st.session_state.session = SessionState()

session = st.session_state.session

st.title("🎯 调度模拟")
st.markdown("---")

if not session.persons or not session.stations:
    st.warning("⚠️ 请先在「数据导入」页面加载数据并创建方案。")
    st.stop()

coverage_analyzer = CoverageAnalyzer()
congestion_analyzer = CongestionAnalyzer()
station_assigner = StationAssigner(coverage_analyzer)
route_optimizer = RouteOptimizer(coverage_analyzer)

tab1, tab2, tab3, tab4 = st.tabs([
    "🗺️ 覆盖分析", 
    "📈 拥挤预测", 
    "🏪 站点分配", 
    "🚶 探访排班"
])

with tab1:
    st.subheader("站点覆盖分析")
    
    coverage_result = coverage_analyzer.analyze_coverage(session.persons, session.stations)
    
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("已覆盖", coverage_result.covered_count, 
                  delta=f"{coverage_result.coverage_ratio*100:.1f}%")
    with col2:
        st.metric("未覆盖", coverage_result.uncovered_count,
                  delta=f"{(1-coverage_result.coverage_ratio)*100:.1f}%")
    with col3:
        st.metric("覆盖率", f"{coverage_result.coverage_ratio*100:.1f}%")
    
    st.markdown("### 各社区覆盖情况")
    
    df_coverage = []
    for comm, stats in coverage_result.by_community.items():
        total = stats["covered"] + stats["uncovered"]
        ratio = stats["covered"] / total * 100 if total > 0 else 0
        df_coverage.append({
            "社区": comm,
            "已覆盖": stats["covered"],
            "未覆盖": stats["uncovered"],
            "覆盖率(%)": f"{ratio:.1f}",
        })
    
    df_cov = pd.DataFrame(df_coverage)
    st.dataframe(df_cov, use_container_width=True, hide_index=True)
    
    st.markdown("### 覆盖缺口识别")
    
    coverage_gaps = coverage_analyzer.identify_coverage_gaps(session.persons, session.stations)
    session.coverage_gaps = coverage_gaps
    
    if coverage_gaps:
        st.warning(f"⚠️ 识别到 {len(coverage_gaps)} 个覆盖缺口社区")
        
        df_gaps = []
        for gap in coverage_gaps:
            df_gaps.append({
                "社区": gap.area_name,
                "未覆盖人数": gap.uncovered_elderly_count,
                "高风险人数": gap.high_risk_count,
                "最近站点(km)": gap.nearest_station_distance,
                "严重程度": gap.gap_severity,
            })
        
        def highlight_gap(s):
            if s["严重程度"] == "严重":
                return ["background-color: #dc3545; color: white" for _ in s]
            elif s["严重程度"] == "中等":
                return ["background-color: #fd7e14; color: white" for _ in s]
            else:
                return ["background-color: #ffc107; color: black" for _ in s]
        
        st.dataframe(
            pd.DataFrame(df_gaps).style.apply(highlight_gap, axis=1),
            use_container_width=True,
            hide_index=True
        )
        
        st.markdown("""
        **覆盖缺口处理建议**:
        - 🔴 严重缺口: 建议协调临时避暑点或安排专车接送
        - 🟠 中等缺口: 建议增加探访频次或协调周边社区支援
        - 🟡 一般缺口: 可通过电话探访确认状况
        """)
    else:
        st.success("✅ 所有社区均已覆盖")

with tab2:
    st.subheader("时段拥挤度预测")
    
    congestions = congestion_analyzer.estimate_hourly_demand(
        session.persons, session.stations, session.forecast
    )
    session.congestions = congestions
    
    peak_stats = congestion_analyzer.get_station_peak_congestion(congestions)
    
    st.markdown("### 各站点峰值拥挤情况")
    
    df_peak = []
    for station in session.stations:
        peak = peak_stats.get(station.id, {})
        df_peak.append({
            "站点名称": station.name,
            "容量": station.capacity,
            "峰值时段": f"{peak.get('peak_hour', 0)}:00",
            "最大拥挤率": f"{peak.get('max_capacity_ratio', 0)*100:.1f}%",
            "拥挤等级": peak.get('peak_congestion_level', '未知'),
        })
    
    def highlight_congestion(s):
        if s["拥挤等级"] in ["拥挤", "爆满"]:
            return ["background-color: #dc3545; color: white" for _ in s]
        elif s["拥挤等级"] == "较拥挤":
            return ["background-color: #fd7e14; color: white" for _ in s]
        else:
            return ["background-color: #28a745; color: white" for _ in s]
    
    st.dataframe(
        pd.DataFrame(df_peak).style.apply(highlight_congestion, axis=1),
        use_container_width=True,
        hide_index=True
    )
    
    st.markdown("### 逐小时拥挤度热力图")
    
    selected_station = st.selectbox(
        "选择站点查看详情",
        [s.name for s in session.stations]
    )
    
    station = next((s for s in session.stations if s.name == selected_station), None)
    if station and station.id in congestions:
        hourly_data = congestions[station.id]
        
        hours = [h.hour for h in hourly_data]
        people = [h.estimated_people for h in hourly_data]
        levels = [h.congestion_level for h in hourly_data]
        
        fig = go.Figure()
        
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
        
        fig.add_trace(go.Bar(
            x=hours, y=people,
            marker_color=colors,
            text=levels,
            textposition="auto",
        ))
        
        fig.add_hline(y=station.capacity, line_dash="dash", line_color="red",
                      annotation_text=f"容量上限 ({station.capacity}人)")
        
        fig.update_layout(
            xaxis_title="时间 (时)",
            yaxis_title="预计人数",
            height=400,
        )
        st.plotly_chart(fig, use_container_width=True)
        
        st.markdown("**拥挤等级说明**:")
        col1, col2, col3, col4, col5 = st.columns(5)
        with col1:
            st.markdown("<div style='background-color:#28a745;padding:5px;border-radius:3px;text-align:center;color:white;'>宽松</div>", unsafe_allow_html=True)
        with col2:
            st.markdown("<div style='background-color:#ffc107;padding:5px;border-radius:3px;text-align:center;color:black;'>较拥挤</div>", unsafe_allow_html=True)
        with col3:
            st.markdown("<div style='background-color:#fd7e14;padding:5px;border-radius:3px;text-align:center;color:white;'>拥挤</div>", unsafe_allow_html=True)
        with col4:
            st.markdown("<div style='background-color:#dc3545;padding:5px;border-radius:3px;text-align:center;color:white;'>爆满</div>", unsafe_allow_html=True)
        with col5:
            st.markdown("<div style='background-color:#6c757d;padding:5px;border-radius:3px;text-align:center;color:white;'>关闭</div>", unsafe_allow_html=True)

with tab3:
    st.subheader("站点分配")
    
    st.markdown("### 分配设置")
    
    col1, col2 = st.columns([1, 1])
    with col1:
        prefer_risk = st.checkbox("优先按风险等级分配", value=True)
    with col2:
        consider_mobility = st.checkbox("考虑行动能力", value=True)
    
    st.markdown("### 锁定站点（手动排除）")
    
    locked_stations = st.multiselect(
        "选择要锁定的站点（不计入分配）",
        [s.name for s in session.stations],
        default=[]
    )
    
    locked_station_ids = [
        s.id for s in session.stations if s.name in locked_stations
    ]
    session.locked_stations = locked_station_ids
    
    if st.button("执行站点分配", type="primary", use_container_width=True):
        try:
            assignments = station_assigner.assign_stations(
                session.persons,
                session.stations,
                locked_stations=locked_station_ids,
            )
            
            session.station_assignments = assignments
            
            if session.current_plan:
                session.current_plan.station_assignments = {
                    a.elderly_id: a.station_id for a in assignments
                }
                session.current_plan.locked_stations = locked_station_ids
            
            st.success(f"✅ 成功分配 {len(assignments)} 位老人")
        except Exception as e:
            st.error(f"❌ 分配失败: {str(e)}")
    
    if session.station_assignments:
        st.markdown("### 分配结果")
        
        station_counts: Dict[str, int] = {}
        for assignment in session.station_assignments:
            station_counts[assignment.station_id] = station_counts.get(assignment.station_id, 0) + 1
        
        df_assign_summary = []
        for station in session.stations:
            count = station_counts.get(station.id, 0)
            usage = count / station.capacity * 100 if station.capacity > 0 else 0
            df_assign_summary.append({
                "站点名称": station.name,
                "容量": station.capacity,
                "分配人数": count,
                "使用率(%)": f"{usage:.1f}",
                "状态": "锁定" if station.id in locked_station_ids else "正常",
            })
        
        st.dataframe(pd.DataFrame(df_assign_summary), use_container_width=True, hide_index=True)
        
        st.markdown("### 详细分配列表")
        
        person_map = {p.id: p for p in session.persons}
        station_map = {s.id: s for s in session.stations}
        
        df_assign_detail = []
        for assignment in session.station_assignments:
            person = person_map.get(assignment.elderly_id)
            station = station_map.get(assignment.station_id)
            
            if person and station:
                df_assign_detail.append({
                    "老人姓名": person.name,
                    "风险等级": person.risk_level,
                    "分配站点": station.name,
                    "步行时间(分)": assignment.walking_time,
                    "公交时间(分)": assignment.bus_time,
                    "距离(km)": assignment.distance_km,
                    "分配原因": assignment.assignment_reason,
                })
        
        st.dataframe(pd.DataFrame(df_assign_detail), use_container_width=True, hide_index=True)

with tab4:
    st.subheader("探访排班优化")
    
    st.markdown("### 排班设置")
    
    col1, col2 = st.columns([1, 1])
    with col1:
        staff_count = st.number_input("网格员人数", min_value=1, max_value=10, value=3)
        start_time = st.selectbox(
            "开始时间",
            ["08:00", "08:30", "09:00", "09:30", "10:00"],
            index=2
        )
    with col2:
        visit_duration = st.number_input("单次探访时间(分钟)", min_value=10, max_value=60, value=20)
        travel_speed = st.slider("出行速度(分钟/公里)", min_value=2, max_value=10, value=5)
    
    staff_list = [f"网格员{chr(65+i)}" for i in range(staff_count)]
    st.markdown(f"**排班人员**: {', '.join(staff_list)}")
    
    if st.button("生成探访排班", type="primary", use_container_width=True):
        try:
            schedules = route_optimizer.create_visit_schedules(
                session.persons,
                staff_list,
                start_time=start_time,
                visit_duration_minutes=visit_duration,
                travel_minutes_per_km=travel_speed,
            )
            
            session.visit_schedules = schedules
            
            if session.current_plan:
                session.current_plan.visit_schedules = schedules
            
            st.success(f"✅ 成功生成 {len(schedules)} 个探访安排")
        except Exception as e:
            st.error(f"❌ 排班失败: {str(e)}")
    
    if session.visit_schedules:
        st.markdown("### 排班甘特图")
        
        schedules_by_staff: Dict[str, List] = {}
        for schedule in session.visit_schedules:
            if schedule.assigned_staff not in schedules_by_staff:
                schedules_by_staff[schedule.assigned_staff] = []
            schedules_by_staff[schedule.assigned_staff].append(schedule)
        
        fig = go.Figure()
        
        colors = px.colors.qualitative.Set3
        color_idx = 0
        
        staff_order = sorted(schedules_by_staff.keys())
        
        for y_idx, staff in enumerate(staff_order):
            staff_schedules = sorted(schedules_by_staff[staff], key=lambda x: x.scheduled_time)
            
            for schedule in staff_schedules:
                person = next((p for p in session.persons if p.id == schedule.elderly_id), None)
                name = person.name if person else "未知"
                
                start_hour = int(schedule.scheduled_time.split(":")[0])
                start_min = int(schedule.scheduled_time.split(":")[1])
                start_decimal = start_hour + start_min / 60
                end_decimal = start_decimal + visit_duration / 60
                
                risk_color = "#28a745"
                if person:
                    if person.risk_level == "极高风险":
                        risk_color = "#dc3545"
                    elif person.risk_level == "高风险":
                        risk_color = "#fd7e14"
                    elif person.risk_level == "中风险":
                        risk_color = "#ffc107"
                
                fig.add_trace(go.Bar(
                    y=[y_idx],
                    x=[end_decimal - start_decimal],
                    base=[start_decimal],
                    orientation="h",
                    name=name,
                    text=f"{name} ({schedule.visit_type})",
                    textposition="auto",
                    marker_color=risk_color,
                    showlegend=False,
                ))
        
        fig.update_layout(
            yaxis=dict(
                tickmode="array",
                tickvals=list(range(len(staff_order))),
                ticktext=staff_order,
                title="网格员",
            ),
            xaxis=dict(
                title="时间",
                tickmode="array",
                tickvals=list(range(8, 20)),
                ticktext=[f"{h:02d}:00" for h in range(8, 20)],
            ),
            height=400,
            barmode="stack",
        )
        
        st.plotly_chart(fig, use_container_width=True)
        
        st.markdown("### 详细排班表")
        
        person_map = {p.id: p for p in session.persons}
        
        df_schedule = []
        for schedule in sorted(session.visit_schedules, key=lambda x: (x.assigned_staff, x.scheduled_time)):
            person = person_map.get(schedule.elderly_id)
            df_schedule.append({
                "网格员": schedule.assigned_staff,
                "时间": schedule.scheduled_time,
                "老人姓名": person.name if person else "未知",
                "社区": person.community if person else "未知",
                "风险等级": person.risk_level if person else "未知",
                "探访类型": schedule.visit_type,
                "状态": schedule.status,
            })
        
        def highlight_risk_row(s):
            if s["风险等级"] == "极高风险":
                return ["background-color: #dc3545; color: white" for _ in s]
            elif s["风险等级"] == "高风险":
                return ["background-color: #fd7e14; color: white" for _ in s]
            elif s["风险等级"] == "中风险":
                return ["background-color: #ffc107; color: black" for _ in s]
            else:
                return ["background-color: #28a745; color: white" for _ in s]
        
        st.dataframe(
            pd.DataFrame(df_schedule).style.apply(highlight_risk_row, axis=1),
            use_container_width=True,
            hide_index=True
        )

st.markdown("---")

if session.current_plan:
    if st.button("💾 保存当前方案", type="primary", use_container_width=True):
        try:
            plan_manager = PlanManager()
            plan_manager.save_plan(
                session.current_plan,
                session.persons,
                session.stations,
                session.forecast,
            )
            st.success("✅ 方案已保存")
        except Exception as e:
            st.error(f"❌ 保存失败: {str(e)}")
