import streamlit as st
import pandas as pd
import numpy as np
import json
from datetime import datetime
from typing import Dict, Optional, List, Any
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from core.models import (
    ProjectData, RoomTopology, Room, Valve, FanCurve,
    PressureCalculationResult, OptimizationResult
)
from core.calculator import PressureCalculator
from core.optimizer import ValveOptimizer
from core.exporter import Exporter
from sample_data import create_sample_project, create_sample_with_issues

st.set_page_config(
    page_title="无尘洁净室压差风量试算工具",
    page_icon="🏭",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        color: #1f77b4;
        text-align: center;
        margin-bottom: 2rem;
    }
    .metric-card {
        background-color: #f0f2f6;
        border-radius: 10px;
        padding: 1rem;
        margin: 0.5rem 0;
    }
    .status-ok {
        color: #28a745;
        font-weight: bold;
    }
    .status-warning {
        color: #ffc107;
        font-weight: bold;
    }
    .status-error {
        color: #dc3545;
        font-weight: bold;
    }
</style>
""", unsafe_allow_html=True)


def initialize_session_state():
    if 'project_data' not in st.session_state:
        st.session_state.project_data = None
    if 'optimization_results' not in st.session_state:
        st.session_state.optimization_results = None
    if 'calculation_results' not in st.session_state:
        st.session_state.calculation_results = None
    if 'manual_corrections' not in st.session_state:
        st.session_state.manual_corrections = {}
    if 'current_tab' not in st.session_state:
        st.session_state.current_tab = "数据导入"


initialize_session_state()


def load_sample_data(with_issues: bool = False):
    if with_issues:
        st.session_state.project_data = create_sample_with_issues()
    else:
        st.session_state.project_data = create_sample_project()
    st.session_state.optimization_results = None
    st.session_state.calculation_results = None
    st.session_state.manual_corrections = {}


def import_json_data(uploaded_file):
    try:
        content = uploaded_file.read().decode('utf-8')
        data = json.loads(content)
        
        from core.models import (
            Room, Valve, FanCurve, FanCurvePoint, AccessLog, 
            ParticleCount, Adjacency, RoomTopology, ProjectData
        )
        from datetime import datetime
        
        topology_data = data.get('topology', {})
        
        rooms = {}
        for room_id, room_dict in topology_data.get('rooms', {}).items():
            rooms[room_id] = Room(**room_dict)
        
        supply_valves = {}
        for valve_id, valve_dict in topology_data.get('supply_valves', {}).items():
            supply_valves[valve_id] = Valve(**valve_dict)
        
        return_valves = {}
        for valve_id, valve_dict in topology_data.get('return_valves', {}).items():
            return_valves[valve_id] = Valve(**valve_dict)
        
        adjacencies = []
        for adj_dict in topology_data.get('adjacencies', []):
            adjacencies.append(Adjacency(**adj_dict))
        
        fan_curves = {}
        for fan_id, fan_dict in topology_data.get('fan_curves', {}).items():
            curve_points = []
            for point_dict in fan_dict.get('curve_points', []):
                curve_points.append(FanCurvePoint(**point_dict))
            fan_dict['curve_points'] = curve_points
            fan_curves[fan_id] = FanCurve(**fan_dict)
        
        access_logs = []
        for log_dict in topology_data.get('access_logs', []):
            if 'timestamp' in log_dict and isinstance(log_dict['timestamp'], str):
                log_dict['timestamp'] = datetime.fromisoformat(log_dict['timestamp'])
            access_logs.append(AccessLog(**log_dict))
        
        particle_counts = []
        for pc_dict in topology_data.get('particle_counts', []):
            if 'timestamp' in pc_dict and isinstance(pc_dict['timestamp'], str):
                pc_dict['timestamp'] = datetime.fromisoformat(pc_dict['timestamp'])
            particle_counts.append(ParticleCount(**pc_dict))
        
        topology = RoomTopology(
            rooms=rooms,
            adjacencies=adjacencies,
            supply_valves=supply_valves,
            return_valves=return_valves,
            fan_curves=fan_curves,
            access_logs=access_logs,
            particle_counts=particle_counts
        )
        
        project = ProjectData(
            project_name=data.get('project_name', '导入项目'),
            project_id=data.get('project_id', 'IMPORTED'),
            topology=topology
        )
        
        st.session_state.project_data = project
        st.session_state.optimization_results = None
        st.session_state.calculation_results = None
        st.session_state.manual_corrections = {}
        return True, "数据导入成功！"
        
    except Exception as e:
        return False, f"导入失败: {str(e)}"


def run_calculation():
    if not st.session_state.project_data:
        st.error("请先加载或导入数据")
        return
    
    calculator = PressureCalculator(st.session_state.project_data.topology)
    results = calculator.calculate()
    st.session_state.calculation_results = results
    return results


def run_optimization():
    if not st.session_state.project_data:
        st.error("请先加载或导入数据")
        return
    
    optimizer = ValveOptimizer(st.session_state.project_data.topology)
    opt_result = optimizer.optimize()
    
    if st.session_state.manual_corrections:
        opt_result.manual_corrections = st.session_state.manual_corrections
    
    st.session_state.optimization_results = opt_result
    st.session_state.project_data.optimization_results = opt_result
    return opt_result


def apply_manual_correction(room_id: str, supply_adj: Optional[float], return_adj: Optional[float], notes: str):
    if not st.session_state.project_data:
        return
    
    optimizer = ValveOptimizer(st.session_state.project_data.topology)
    correction = optimizer.apply_manual_correction(
        room_id=room_id,
        supply_valve_adjustment=supply_adj,
        return_valve_adjustment=return_adj,
        notes=notes
    )
    
    if correction["applied"]:
        st.session_state.manual_corrections[room_id] = {
            "supply_valve_adjustment": supply_adj,
            "return_valve_adjustment": return_adj,
            "notes": notes,
            "applied_at": datetime.now().isoformat()
        }
        st.session_state.optimization_results = None
        st.session_state.calculation_results = None
        return True
    return False


st.markdown("<h1 class='main-header'>🏭 无尘洁净室压差风量试算工具</h1>", unsafe_allow_html=True)

tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
    "📥 数据导入",
    "🏠 系统概览",
    "📊 计算分析",
    "🔧 调阀建议",
    "✏️ 人工修正",
    "📤 导出报告"
])

with tab1:
    st.header("数据导入")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("加载示例数据")
        if st.button("加载正常示例数据", use_container_width=True, type="primary"):
            load_sample_data(with_issues=False)
            st.success("正常示例数据已加载！")
        
        if st.button("加载带问题示例数据", use_container_width=True):
            load_sample_data(with_issues=True)
            st.warning("带问题示例数据已加载，可用于测试调阀建议功能！")
    
    with col2:
        st.subheader("导入JSON数据")
        uploaded_file = st.file_uploader("选择JSON文件", type=["json"])
        if uploaded_file is not None:
            if st.button("导入数据", use_container_width=True):
                success, message = import_json_data(uploaded_file)
                if success:
                    st.success(message)
                else:
                    st.error(message)
    
    if st.session_state.project_data:
        st.markdown("---")
        st.subheader("当前项目信息")
        proj = st.session_state.project_data
        col_info1, col_info2, col_info3 = st.columns(3)
        
        with col_info1:
            st.metric("项目名称", proj.project_name)
        with col_info2:
            st.metric("项目编号", proj.project_id)
        with col_info3:
            st.metric("房间数量", len(proj.topology.rooms))
        
        with st.expander("查看项目JSON"):
            st.json(Exporter.to_json(proj.topology))

with tab2:
    st.header("系统概览")
    
    if not st.session_state.project_data:
        st.info("请先在「数据导入」页面加载数据")
    else:
        topology = st.session_state.project_data.topology
        
        st.subheader("房间列表")
        rooms_data = []
        for room_id, room in topology.rooms.items():
            rooms_data.append({
                "房间ID": room_id,
                "房间名称": room.name,
                "体积 (m³)": room.volume,
                "目标压差 (Pa)": room.target_pressure,
                "目标换气次数 (次/小时)": room.target_air_change_rate or "-",
                "洁净度等级": room.cleanliness_class or "-",
                "房间类型": room.room_type
            })
        st.dataframe(pd.DataFrame(rooms_data), use_container_width=True, hide_index=True)
        
        st.markdown("---")
        st.subheader("阀门设置")
        
        col_valve1, col_valve2 = st.columns(2)
        
        with col_valve1:
            st.markdown("#### 送风阀")
            supply_valve_data = []
            for valve_id, valve in topology.supply_valves.items():
                supply_valve_data.append({
                    "阀门ID": valve_id,
                    "房间ID": valve.room_id,
                    "当前开度 (%)": valve.current_opening,
                    "额定风量 (m³/h)": valve.rated_flow
                })
            st.dataframe(pd.DataFrame(supply_valve_data), use_container_width=True, hide_index=True)
        
        with col_valve2:
            st.markdown("#### 回风阀")
            return_valve_data = []
            for valve_id, valve in topology.return_valves.items():
                return_valve_data.append({
                    "阀门ID": valve_id,
                    "房间ID": valve.room_id,
                    "当前开度 (%)": valve.current_opening,
                    "额定风量 (m³/h)": valve.rated_flow
                })
            st.dataframe(pd.DataFrame(return_valve_data), use_container_width=True, hide_index=True)
        
        st.markdown("---")
        st.subheader("房间压差梯度")
        
        adjacency_data = []
        for adj in topology.adjacencies:
            room_a = topology.rooms.get(adj.room_a)
            room_b = topology.rooms.get(adj.room_b)
            direction = f"{room_a.name if room_a else adj.room_a} → {room_b.name if room_b else adj.room_b}" if adj.pressure_direction == 'a_to_b' else f"{room_b.name if room_b else adj.room_b} → {room_a.name if room_a else adj.room_a}"
            adjacency_data.append({
                "房间A": room_a.name if room_a else adj.room_a,
                "房间B": room_b.name if room_b else adj.room_b,
                "压差方向": direction,
                "要求压差 (Pa)": adj.required_differential,
                "门面积 (m²)": adj.door_area or "-"
            })
        st.dataframe(pd.DataFrame(adjacency_data), use_container_width=True, hide_index=True)
        
        st.markdown("---")
        st.subheader("门禁开门记录")
        if topology.access_logs:
            access_data = []
            for log in topology.access_logs:
                room = topology.rooms.get(log.room_id)
                access_data.append({
                    "记录ID": log.id,
                    "房间": room.name if room else log.room_id,
                    "时间": log.timestamp.strftime("%Y-%m-%d %H:%M:%S") if log.timestamp else "-",
                    "门ID": log.door_id,
                    "开门时长 (秒)": log.duration,
                    "开门时压差 (Pa)": log.pressure_difference_during_open or "-"
                })
            st.dataframe(pd.DataFrame(access_data), use_container_width=True, hide_index=True)
        else:
            st.info("暂无门禁记录")
        
        st.markdown("---")
        st.subheader("粒子计数记录")
        if topology.particle_counts:
            particle_data = []
            for pc in topology.particle_counts:
                room = topology.rooms.get(pc.room_id)
                status = "✅ 合格" if pc.is_pass else "❌ 不合格" if pc.is_pass is not None else "-"
                particle_data.append({
                    "记录ID": pc.id,
                    "房间": room.name if room else pc.room_id,
                    "时间": pc.timestamp.strftime("%Y-%m-%d %H:%M:%S") if pc.timestamp else "-",
                    "粒径 (μm)": pc.particle_size,
                    "浓度 (个/m³)": pc.concentration,
                    "限值 (个/m³)": pc.limit_value or "-",
                    "状态": status
                })
            st.dataframe(pd.DataFrame(particle_data), use_container_width=True, hide_index=True)
        else:
            st.info("暂无粒子计数记录")
        
        st.markdown("---")
        st.subheader("风机曲线")
        for fan_id, fan in topology.fan_curves.items():
            with st.expander(f"{fan.name} ({fan_id})"):
                col_f1, col_f2, col_f3 = st.columns(3)
                with col_f1:
                    st.metric("当前频率", f"{fan.current_frequency} Hz")
                with col_f2:
                    st.metric("频率范围", f"{fan.min_frequency} - {fan.max_frequency} Hz")
                with col_f3:
                    st.metric("设计静压", f"{fan.design_static_pressure or '-'} Pa")
                
                if fan.curve_points:
                    curve_data = []
                    for point in fan.curve_points:
                        curve_data.append({
                            "风量 (m³/h)": point.flow_rate,
                            "静压 (Pa)": point.static_pressure,
                            "效率 (%)": point.efficiency or "-",
                            "功率 (kW)": point.power or "-"
                        })
                    st.dataframe(pd.DataFrame(curve_data), use_container_width=True, hide_index=True)
                    
                    fig = go.Figure()
                    flows = [p.flow_rate for p in fan.curve_points]
                    pressures = [p.static_pressure for p in fan.curve_points]
                    fig.add_trace(go.Scatter(
                        x=flows, y=pressures,
                        mode='lines+markers',
                        name='静压曲线',
                        line=dict(color='#1f77b4', width=2),
                        marker=dict(size=8)
                    ))
                    fig.update_layout(
                        title=f"{fan.name} - 风量静压曲线",
                        xaxis_title="风量 (m³/h)",
                        yaxis_title="静压 (Pa)",
                        height=400
                    )
                    st.plotly_chart(fig, use_container_width=True)

with tab3:
    st.header("计算分析")
    
    if not st.session_state.project_data:
        st.info("请先在「数据导入」页面加载数据")
    else:
        col_calc_btn, _ = st.columns([1, 3])
        with col_calc_btn:
            if st.button("运行计算", use_container_width=True, type="primary"):
                run_calculation()
                st.success("计算完成！")
        
        if st.session_state.calculation_results:
            results = st.session_state.calculation_results
            topology = st.session_state.project_data.topology
            
            st.markdown("---")
            st.subheader("计算结果概览")
            
            summary_data = []
            for room_id, result in results.items():
                room = topology.rooms.get(room_id)
                room_name = room.name if room else room_id
                
                pressure_status = "✅" if result.is_pressure_ok else "❌"
                ach_status = "✅" if result.is_air_change_ok else "❌"
                overall_status = "✅" if (result.is_pressure_ok and result.is_air_change_ok) else "❌"
                
                summary_data.append({
                    "状态": overall_status,
                    "房间ID": room_id,
                    "房间名称": room_name,
                    "计算压差 (Pa)": round(result.calculated_pressure, 1),
                    "目标压差 (Pa)": result.target_pressure,
                    "压差偏差 (Pa)": round(result.pressure_deviation, 1),
                    "压差状态": pressure_status,
                    "送风量 (m³/h)": round(result.supply_airflow or 0, 1),
                    "回风量 (m³/h)": round(result.return_airflow or 0, 1),
                    "换气次数 (次/小时)": round(result.air_change_rate or 0, 1),
                    "目标换气次数": result.target_air_change_rate or "-",
                    "换气状态": ach_status
                })
            
            st.dataframe(pd.DataFrame(summary_data), use_container_width=True, hide_index=True)
            
            st.markdown("---")
            st.subheader("压差与风量可视化")
            
            col_viz1, col_viz2 = st.columns(2)
            
            with col_viz1:
                room_ids = list(results.keys())
                room_names = [topology.rooms.get(rid, {}).name or rid for rid in room_ids]
                
                calc_pressures = [results[rid].calculated_pressure for rid in room_ids]
                target_pressures = [results[rid].target_pressure for rid in room_ids]
                
                fig_pressure = go.Figure()
                fig_pressure.add_trace(go.Bar(
                    x=room_names, y=calc_pressures,
                    name='计算压差',
                    marker_color='#1f77b4'
                ))
                fig_pressure.add_trace(go.Bar(
                    x=room_names, y=target_pressures,
                    name='目标压差',
                    marker_color='#2ca02c',
                    opacity=0.6
                ))
                fig_pressure.update_layout(
                    title="各房间压差对比",
                    xaxis_title="房间",
                    yaxis_title="压差 (Pa)",
                    barmode='group',
                    height=400
                )
                st.plotly_chart(fig_pressure, use_container_width=True)
            
            with col_viz2:
                supply_flows = [results[rid].supply_airflow or 0 for rid in room_ids]
                return_flows = [results[rid].return_airflow or 0 for rid in room_ids]
                exhaust_flows = [results[rid].exhaust_airflow or 0 for rid in room_ids]
                
                fig_flow = go.Figure()
                fig_flow.add_trace(go.Bar(
                    x=room_names, y=supply_flows,
                    name='送风量',
                    marker_color='#1f77b4'
                ))
                fig_flow.add_trace(go.Bar(
                    x=room_names, y=return_flows,
                    name='回风量',
                    marker_color='#ff7f0e'
                ))
                fig_flow.add_trace(go.Bar(
                    x=room_names, y=exhaust_flows,
                    name='排风量',
                    marker_color='#d62728'
                ))
                fig_flow.update_layout(
                    title="各房间风量分布",
                    xaxis_title="房间",
                    yaxis_title="风量 (m³/h)",
                    barmode='group',
                    height=400
                )
                st.plotly_chart(fig_flow, use_container_width=True)
            
            st.markdown("---")
            st.subheader("各房间详细计算结果")
            
            for room_id, result in results.items():
                room = topology.rooms.get(room_id)
                room_name = room.name if room else room_id
                
                with st.expander(f"{room_name} ({room_id})"):
                    col_detail1, col_detail2, col_detail3 = st.columns(3)
                    
                    with col_detail1:
                        st.metric("计算压差", f"{result.calculated_pressure:.1f} Pa", 
                                  delta=f"{result.pressure_deviation:+.1f} Pa")
                        st.metric("送风量", f"{result.supply_airflow or 0:.1f} m³/h")
                    
                    with col_detail2:
                        st.metric("目标压差", f"{result.target_pressure:.1f} Pa")
                        st.metric("回风量", f"{result.return_airflow or 0:.1f} m³/h")
                    
                    with col_detail3:
                        pressure_ok = "✅ 合格" if result.is_pressure_ok else "❌ 不合格"
                        st.metric("压差状态", pressure_ok)
                        st.metric("排风量", f"{result.exhaust_airflow or 0:.1f} m³/h")
                    
                    if result.air_change_rate is not None:
                        st.markdown("##### 换气次数")
                        col_ach1, col_ach2, col_ach3 = st.columns(3)
                        with col_ach1:
                            st.metric("当前换气次数", f"{result.air_change_rate:.1f} 次/小时")
                        with col_ach2:
                            st.metric("目标换气次数", f"{result.target_air_change_rate or '-'} 次/小时")
                        with col_ach3:
                            ach_ok = "✅ 合格" if result.is_air_change_ok else "❌ 不合格"
                            st.metric("状态", ach_ok)
                    
                    st.markdown("##### 泄漏风量")
                    st.metric("泄漏风量", f"{result.leakage_flow or 0:.1f} m³/h")
                    
                    if result.issues:
                        st.markdown("##### ⚠️ 问题清单")
                        for issue in result.issues:
                            st.warning(issue)

with tab4:
    st.header("调阀建议")
    
    if not st.session_state.project_data:
        st.info("请先在「数据导入」页面加载数据")
    else:
        col_opt_btn, _ = st.columns([1, 3])
        with col_opt_btn:
            if st.button("运行优化分析", use_container_width=True, type="primary"):
                run_optimization()
                st.success("优化分析完成！")
        
        if st.session_state.optimization_results:
            opt_result = st.session_state.optimization_results
            topology = st.session_state.project_data.topology
            
            st.markdown("---")
            st.subheader("问题汇总")
            
            col_sum1, col_sum2, col_sum3, col_sum4 = st.columns(4)
            
            with col_sum1:
                st.metric("总问题数", opt_result.total_issues,
                          delta_color="inverse")
            
            with col_sum2:
                st.metric("压差问题房间", len(opt_result.pressure_issues),
                          delta_color="inverse")
                if opt_result.pressure_issues:
                    with st.expander("详情"):
                        for room in opt_result.pressure_issues:
                            st.write(f"- {room}")
            
            with col_sum3:
                st.metric("换气问题房间", len(opt_result.air_change_issues),
                          delta_color="inverse")
                if opt_result.air_change_issues:
                    with st.expander("详情"):
                        for room in opt_result.air_change_issues:
                            st.write(f"- {room}")
            
            with col_sum4:
                st.metric("开门扰动房间", len(opt_result.door_disturbance_issues),
                          delta_color="inverse")
                if opt_result.door_disturbance_issues:
                    with st.expander("详情"):
                        for room in opt_result.door_disturbance_issues:
                            st.write(f"- {room}")
            
            if opt_result.remarks:
                st.markdown("---")
                st.subheader("📋 分析备注")
                for remark in opt_result.remarks:
                    st.info(remark)
            
            st.markdown("---")
            st.subheader("🔧 阀门调节建议")
            
            if opt_result.valve_adjustments:
                adj_data = []
                for valve_id, adjustment in opt_result.valve_adjustments.items():
                    room_id = valve_id[2:] if len(valve_id) > 2 else ""
                    room = topology.rooms.get(room_id)
                    room_name = room.name if room else room_id
                    valve_type = "送风阀" if valve_id.startswith("S_") else "回风阀"
                    direction = "增大" if adjustment > 0 else "减小"
                    
                    current_opening = None
                    if valve_id in topology.supply_valves:
                        current_opening = topology.supply_valves[valve_id].current_opening
                    elif valve_id in topology.return_valves:
                        current_opening = topology.return_valves[valve_id].current_opening
                    
                    new_opening = (current_opening + adjustment) if current_opening is not None else None
                    
                    adj_data.append({
                        "阀门ID": valve_id,
                        "阀门类型": valve_type,
                        "房间": room_name,
                        "当前开度 (%)": current_opening or "-",
                        "调节量 (%)": f"{adjustment:+.1f}",
                        "调节方向": direction,
                        "调节后开度 (%)": round(new_opening, 1) if new_opening else "-"
                    })
                
                st.dataframe(pd.DataFrame(adj_data), use_container_width=True, hide_index=True)
                
                st.markdown("---")
                st.subheader("各房间优化详情")
                
                for room_id, result in opt_result.room_results.items():
                    room = topology.rooms.get(room_id)
                    room_name = room.name if room else room_id
                    
                    has_adj = (result.supply_valve_adjustment is not None or 
                              result.return_valve_adjustment is not None)
                    
                    expander_title = f"{room_name} ({room_id})"
                    if has_adj:
                        expander_title += " 🔧 需要调节"
                    
                    with st.expander(expander_title):
                        col_opt1, col_opt2, col_opt3 = st.columns(3)
                        
                        with col_opt1:
                            pressure_ok = "✅" if result.is_pressure_ok else "❌"
                            st.metric("压差", f"{result.calculated_pressure:.1f} Pa",
                                      delta=f"{result.pressure_deviation:+.1f} Pa")
                            st.write(f"状态: {pressure_ok}")
                        
                        with col_opt2:
                            if result.air_change_rate is not None:
                                ach_ok = "✅" if result.is_air_change_ok else "❌"
                                st.metric("换气次数", f"{result.air_change_rate:.1f} 次/小时")
                                st.write(f"状态: {ach_ok}")
                        
                        with col_opt3:
                            if has_adj:
                                st.markdown("**调节建议:**")
                                if result.supply_valve_adjustment is not None:
                                    direction = "增大" if result.supply_valve_adjustment > 0 else "减小"
                                    st.write(f"- 送风阀: {direction} {abs(result.supply_valve_adjustment):.1f}%")
                                if result.return_valve_adjustment is not None:
                                    direction = "增大" if result.return_valve_adjustment > 0 else "减小"
                                    st.write(f"- 回风阀: {direction} {abs(result.return_valve_adjustment):.1f}%")
                        
                        if result.issues:
                            st.markdown("**问题记录:**")
                            for issue in result.issues:
                                st.text(f"• {issue}")
            else:
                st.success("🎉 系统状态良好，无需调节阀门！")
            
            if opt_result.manual_corrections:
                st.markdown("---")
                st.subheader("📝 人工修正记录")
                for room_id, correction in opt_result.manual_corrections.items():
                    room = topology.rooms.get(room_id)
                    room_name = room.name if room else room_id
                    with st.expander(f"{room_name} ({room_id})"):
                        if correction.get("supply_valve_adjustment"):
                            adj = correction["supply_valve_adjustment"]
                            direction = "增大" if adj > 0 else "减小"
                            st.write(f"- 送风阀: {direction} {abs(adj):.1f}%")
                        if correction.get("return_valve_adjustment"):
                            adj = correction["return_valve_adjustment"]
                            direction = "增大" if adj > 0 else "减小"
                            st.write(f"- 回风阀: {direction} {abs(adj):.1f}%")
                        if correction.get("notes"):
                            st.write(f"- 备注: {correction['notes']}")

with tab5:
    st.header("人工修正")
    
    if not st.session_state.project_data:
        st.info("请先在「数据导入」页面加载数据")
    else:
        topology = st.session_state.project_data.topology
        
        st.markdown("""
        在此页面您可以手动调整阀门开度，用于：
        - 微调计算结果
        - 记录现场实际调整
        - 测试不同阀门开度的影响
        """)
        
        st.markdown("---")
        
        room_options = [f"{room.name} ({room_id})" 
                       for room_id, room in topology.rooms.items()]
        room_id_map = {f"{room.name} ({room_id})": room_id 
                      for room_id, room in topology.rooms.items()}
        
        selected_room_label = st.selectbox("选择房间", room_options)
        selected_room_id = room_id_map[selected_room_label]
        selected_room = topology.rooms.get(selected_room_id)
        
        st.markdown(f"#### 当前房间: {selected_room.name if selected_room else selected_room_id}")
        
        col_adj1, col_adj2 = st.columns(2)
        
        with col_adj1:
            st.markdown("##### 送风阀调整")
            supply_valve = topology.supply_valves.get(f"S_{selected_room_id}")
            if supply_valve:
                st.info(f"当前开度: {supply_valve.current_opening}%")
                supply_adj = st.slider(
                    "送风阀调节量 (%)",
                    min_value=-20.0,
                    max_value=20.0,
                    value=0.0,
                    step=1.0,
                    key=f"supply_adj_{selected_room_id}"
                )
                new_supply_opening = supply_valve.current_opening + supply_adj
                st.write(f"调整后开度: {new_supply_opening:.1f}%")
            else:
                st.warning("该房间无送风阀")
                supply_adj = None
        
        with col_adj2:
            st.markdown("##### 回风阀调整")
            return_valve = topology.return_valves.get(f"R_{selected_room_id}")
            if return_valve:
                st.info(f"当前开度: {return_valve.current_opening}%")
                return_adj = st.slider(
                    "回风阀调节量 (%)",
                    min_value=-20.0,
                    max_value=20.0,
                    value=0.0,
                    step=1.0,
                    key=f"return_adj_{selected_room_id}"
                )
                new_return_opening = return_valve.current_opening + return_adj
                st.write(f"调整后开度: {new_return_opening:.1f}%")
            else:
                st.warning("该房间无回风阀")
                return_adj = None
        
        st.markdown("##### 调整备注")
        notes = st.text_area(
            "输入调整说明（可选）",
            placeholder="例如：现场实测压差偏低，已手动增大送风阀...",
            key=f"notes_{selected_room_id}"
        )
        
        col_apply, col_clear = st.columns(2)
        
        with col_apply:
            if st.button("应用调整", use_container_width=True, type="primary"):
                if supply_adj is None and return_adj is None:
                    st.error("该房间无可调整的阀门")
                elif abs(supply_adj or 0) < 0.1 and abs(return_adj or 0) < 0.1:
                    st.warning("请先选择调整量")
                else:
                    success = apply_manual_correction(
                        room_id=selected_room_id,
                        supply_adj=supply_adj if abs(supply_adj or 0) > 0.1 else None,
                        return_adj=return_adj if abs(return_adj or 0) > 0.1 else None,
                        notes=notes
                    )
                    if success:
                        st.success("调整已应用！请重新运行计算和优化。")
                    else:
                        st.error("调整应用失败")
        
        with col_clear:
            if st.button("重置所有修正", use_container_width=True):
                st.session_state.manual_corrections = {}
                st.session_state.project_data = create_sample_project()
                st.session_state.optimization_results = None
                st.session_state.calculation_results = None
                st.warning("已重置所有修正，请重新加载数据")
        
        if st.session_state.manual_corrections:
            st.markdown("---")
            st.subheader("已应用的修正记录")
            for room_id, correction in st.session_state.manual_corrections.items():
                room = topology.rooms.get(room_id)
                room_name = room.name if room else room_id
                
                st.markdown(f"**{room_name} ({room_id})**")
                adj_parts = []
                if correction.get("supply_valve_adjustment"):
                    adj = correction["supply_valve_adjustment"]
                    adj_parts.append(f"送风阀 {adj:+.1f}%")
                if correction.get("return_valve_adjustment"):
                    adj = correction["return_valve_adjustment"]
                    adj_parts.append(f"回风阀 {adj:+.1f}%")
                
                st.write(f"调整: {', '.join(adj_parts)}")
                if correction.get("notes"):
                    st.write(f"备注: {correction['notes']}")
                st.markdown("---")

with tab6:
    st.header("导出报告")
    
    if not st.session_state.project_data:
        st.info("请先在「数据导入」页面加载数据")
    elif not st.session_state.optimization_results:
        st.warning("请先在「调阀建议」页面运行优化分析，生成完整的报告")
    else:
        proj = st.session_state.project_data
        opt_result = st.session_state.optimization_results
        
        st.markdown("---")
        st.subheader("生成报告")
        
        col_exp1, col_exp2 = st.columns(2)
        
        markdown_report = Exporter.generate_markdown_debug_report(
            project_data=proj,
            opt_result=opt_result,
            topology=proj.topology
        )
        
        json_details = Exporter.generate_calculation_details_json(
            project_data=proj,
            opt_result=opt_result,
            topology=proj.topology
        )
        
        with col_exp1:
            st.markdown("#### 📄 Markdown 调试单")
            st.markdown("""
            导出完整的调试报告，包含：
            - 系统概览
            - 问题汇总
            - 各房间详细计算结果
            - 阀门调节汇总
            - 人工修正记录
            """)
            
            st.download_button(
                label="下载 Markdown 报告",
                data=markdown_report,
                file_name=f"洁净室调试报告_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md",
                mime="text/markdown",
                use_container_width=True
            )
            
            with st.expander("预览报告内容"):
                st.markdown(markdown_report)
        
        with col_exp2:
            st.markdown("#### 📊 JSON 计算明细")
            st.markdown("""
            导出完整的计算数据，包含：
            - 所有计算结果
            - 阀门设置和调节建议
            - 原始数据（门禁记录、粒子计数）
            - 可用于后续分析和存档
            """)
            
            st.download_button(
                label="下载 JSON 明细",
                data=json_details,
                file_name=f"洁净室计算明细_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                mime="application/json",
                use_container_width=True
            )
            
            with st.expander("预览 JSON 内容"):
                st.json(json.loads(json_details))
        
        st.markdown("---")
        st.subheader("📁 导出项目数据")
        
        project_json = Exporter.to_json(proj)
        
        st.markdown("""
        导出完整的项目数据，可后续导入继续工作。
        包含所有设置、阀门开度、记录等。
        """)
        
        st.download_button(
            label="导出完整项目数据",
            data=project_json,
            file_name=f"洁净室项目_{proj.project_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
            mime="application/json",
            use_container_width=True
        )
        
        st.markdown("---")
        st.subheader("✅ 报告信息汇总")
        
        col_info1, col_info2, col_info3 = st.columns(3)
        
        with col_info1:
            st.metric("项目名称", proj.project_name)
        
        with col_info2:
            st.metric("报告生成时间", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        
        with col_info3:
            status_icon = "✅" if opt_result.total_issues == 0 else "⚠️"
            st.metric("系统状态", f"{status_icon} {opt_result.total_issues} 个问题")

st.markdown("---")
st.markdown("""
<div style='text-align: center; color: #888;'>
    <p>🏭 无尘洁净室压差风量试算工具 v1.0</p>
    <p>用于辅助洁净室调试工程师进行压差风量分析和阀门调节</p>
</div>
""", unsafe_allow_html=True)
