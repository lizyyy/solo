import streamlit as st
import pandas as pd
from pathlib import Path
from datetime import date
import io

from config import PAGE_CONFIG, DATA_DIR
from persistence import SessionState, DataLoader, PlanManager
from models import RiskLevel
from risk_algorithm import RiskCalculator

st.set_page_config(**PAGE_CONFIG)

if "session" not in st.session_state:
    st.session_state.session = SessionState()

session = st.session_state.session

st.title("📁 数据导入")
st.markdown("---")

tab1, tab2, tab3 = st.tabs(["📊 老人清单", "🏪 避暑站信息", "🌡️ 温度预报"])

with tab1:
    st.subheader("老人清单数据")
    
    col1, col2 = st.columns([1, 1])
    with col1:
        if st.button("📥 加载示例老人数据", use_container_width=True):
            try:
                elderly_file = DATA_DIR / "elderly_sample.csv"
                session.persons = DataLoader.load_elderly_from_csv(elderly_file)
                st.success(f"✅ 成功加载 {len(session.persons)} 位老人数据")
            except Exception as e:
                st.error(f"❌ 加载失败: {str(e)}")
    
    with col2:
        elderly_upload = st.file_uploader("上传老人清单 CSV", type=["csv"], key="elderly_upload")
        if elderly_upload is not None:
            try:
                temp_path = DATA_DIR / "temp_elderly.csv"
                with open(temp_path, "wb") as f:
                    f.write(elderly_upload.getbuffer())
                session.persons = DataLoader.load_elderly_from_csv(temp_path)
                st.success(f"✅ 成功加载 {len(session.persons)} 位老人数据")
            except Exception as e:
                st.error(f"❌ 解析失败: {str(e)}")
    
    if session.persons:
        st.markdown("### 数据预览")
        
        df_data = []
        for p in session.persons:
            df_data.append({
                "ID": p.id,
                "姓名": p.name,
                "年龄": p.age,
                "社区": p.community,
                "健康状况": "、".join(p.health_conditions[:2]) if p.health_conditions else "无",
                "独居": "是" if p.living_alone else "否",
                "行动能力": p.mobility,
                "有空调": "是" if p.has_air_conditioning else "否",
            })
        
        df = pd.DataFrame(df_data)
        st.dataframe(df, use_container_width=True, hide_index=True)
        
        st.markdown(f"**总计**: {len(session.persons)} 位老人")
        
        with st.expander("📋 查看数据统计"):
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                avg_age = sum(p.age for p in session.persons) / len(session.persons)
                st.metric("平均年龄", f"{avg_age:.1f}岁")
            with col2:
                living_alone = sum(1 for p in session.persons if p.living_alone)
                st.metric("独居老人", f"{living_alone}人")
            with col3:
                no_ac = sum(1 for p in session.persons if not p.has_air_conditioning)
                st.metric("无空调", f"{no_ac}人")
            with col4:
                communities = len(set(p.community for p in session.persons))
                st.metric("覆盖社区", f"{communities}个")

with tab2:
    st.subheader("避暑站信息")
    
    col1, col2 = st.columns([1, 1])
    with col1:
        if st.button("📥 加载示例站点数据", use_container_width=True):
            try:
                stations_file = DATA_DIR / "stations_sample.csv"
                session.stations = DataLoader.load_stations_from_csv(stations_file)
                st.success(f"✅ 成功加载 {len(session.stations)} 个避暑站")
            except Exception as e:
                st.error(f"❌ 加载失败: {str(e)}")
    
    with col2:
        stations_upload = st.file_uploader("上传避暑站 CSV", type=["csv"], key="stations_upload")
        if stations_upload is not None:
            try:
                temp_path = DATA_DIR / "temp_stations.csv"
                with open(temp_path, "wb") as f:
                    f.write(stations_upload.getbuffer())
                session.stations = DataLoader.load_stations_from_csv(temp_path)
                st.success(f"✅ 成功加载 {len(session.stations)} 个避暑站")
            except Exception as e:
                st.error(f"❌ 解析失败: {str(e)}")
    
    if session.stations:
        st.markdown("### 数据预览")
        
        df_data = []
        for s in session.stations:
            df_data.append({
                "ID": s.id,
                "名称": s.name,
                "社区": s.community,
                "容量": s.capacity,
                "工作人员": s.staff_count,
                "开放时间": f"{s.opening_time} - {s.closing_time}",
                "设施": "、".join(s.facilities[:3]) if s.facilities else "无",
            })
        
        df = pd.DataFrame(df_data)
        st.dataframe(df, use_container_width=True, hide_index=True)
        
        total_capacity = sum(s.capacity for s in session.stations)
        st.metric("总容量", f"{total_capacity}人")

with tab3:
    st.subheader("逐小时体感温度预报")
    
    col1, col2 = st.columns([1, 1])
    with col1:
        if st.button("📥 加载示例预报数据", use_container_width=True):
            try:
                forecast_file = DATA_DIR / "forecast_sample.json"
                session.forecast = DataLoader.load_forecast_from_json(forecast_file)
                st.success(f"✅ 成功加载 {session.forecast.forecast_date} 的预报数据")
            except Exception as e:
                st.error(f"❌ 加载失败: {str(e)}")
    
    with col2:
        forecast_upload = st.file_uploader("上传预报 JSON", type=["json"], key="forecast_upload")
        if forecast_upload is not None:
            try:
                temp_path = DATA_DIR / "temp_forecast.json"
                with open(temp_path, "wb") as f:
                    f.write(forecast_upload.getbuffer())
                session.forecast = DataLoader.load_forecast_from_json(temp_path)
                st.success(f"✅ 成功加载 {session.forecast.forecast_date} 的预报数据")
            except Exception as e:
                st.error(f"❌ 解析失败: {str(e)}")
    
    if session.forecast:
        st.markdown("### 预报概览")
        
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("预报日期", str(session.forecast.forecast_date))
        with col2:
            st.metric("最高气温", f"{session.forecast.max_temperature}°C")
        with col3:
            st.metric("最低气温", f"{session.forecast.min_temperature}°C")
        with col4:
            st.metric("预警级别", session.forecast.heat_warning_level)
        
        st.markdown("### 逐小时体感温度")
        
        import plotly.graph_objects as go
        
        hours = [hf.hour for hf in session.forecast.hourly_forecasts]
        temps = [hf.temperature for hf in session.forecast.hourly_forecasts]
        feels_like = [hf.feels_like for hf in session.forecast.hourly_forecasts]
        
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=hours, y=temps, mode='lines+markers',
            name='实际温度', line=dict(color='#1f77b4', width=2)
        ))
        fig.add_trace(go.Scatter(
            x=hours, y=feels_like, mode='lines+markers',
            name='体感温度', line=dict(color='#ff7f0e', width=2)
        ))
        fig.add_hline(y=35, line_dash="dash", line_color="red", 
                      annotation_text="高温阈值 (35°C)")
        fig.add_hline(y=38, line_dash="dot", line_color="darkred",
                      annotation_text="危险阈值 (38°C)")
        
        fig.update_layout(
            xaxis_title="时间 (时)",
            yaxis_title="温度 (°C)",
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
            height=400,
        )
        st.plotly_chart(fig, use_container_width=True)

st.markdown("---")

if session.persons and session.stations:
    st.subheader("🚀 创建调度方案")
    
    col1, col2 = st.columns([1, 1])
    with col1:
        plan_name = st.text_input("方案名称", value=f"热浪调度方案_{date.today().strftime('%Y%m%d')}")
    with col2:
        district = st.text_input("覆盖区域", value=session.persons[0].district if session.persons else "")
    
    forecast_date = session.forecast.forecast_date if session.forecast else date.today()
    
    if st.button("✅ 创建新方案并计算风险", type="primary", use_container_width=True):
        try:
            risk_calc = RiskCalculator()
            
            progress_bar = st.progress(0)
            status_text = st.empty()
            
            total = len(session.persons)
            for i, person in enumerate(session.persons):
                risk_calc.update_person_risk(person, session.forecast)
                progress = (i + 1) / total
                progress_bar.progress(progress)
                status_text.text(f"正在计算风险: {i+1}/{total}")
            
            plan_manager = PlanManager()
            session.current_plan = plan_manager.create_new_plan(
                name=plan_name,
                district=district,
                forecast_date=forecast_date,
                persons=session.persons,
                stations=session.stations,
            )
            
            st.success("✅ 方案创建成功！风险评估完成。")
            st.balloons()
            
        except Exception as e:
            st.error(f"❌ 创建方案失败: {str(e)}")

if session.current_plan:
    st.markdown("---")
    st.subheader("📋 当前方案")
    
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("方案名称", session.current_plan.name)
    with col2:
        st.metric("覆盖区域", session.current_plan.district)
    with col3:
        st.metric("预报日期", str(session.current_plan.forecast_date))
    with col4:
        st.metric("老人数量", len(session.current_plan.elderly_ids))
    
    if session.persons:
        risk_dist = {
            "低风险": 0, "中风险": 0, "高风险": 0, "极高风险": 0
        }
        for p in session.persons:
            risk_dist[p.risk_level] = risk_dist.get(p.risk_level, 0) + 1
        
        st.markdown("### 风险分布")
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("🟢 低风险", risk_dist["低风险"])
        with col2:
            st.metric("🟡 中风险", risk_dist["中风险"])
        with col3:
            st.metric("🟠 高风险", risk_dist["高风险"])
        with col4:
            st.metric("🔴 极高风险", risk_dist["极高风险"])

st.markdown("---")
if st.button("🗑️ 清空所有数据", use_container_width=True):
    session.clear()
    st.rerun()
