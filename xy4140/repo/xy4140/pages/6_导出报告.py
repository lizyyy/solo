import streamlit as st
import pandas as pd
from datetime import date
from pathlib import Path

from config import PAGE_CONFIG, OUTPUT_DIR
from persistence import SessionState
from models import RiskLevel
from exporter import MarkdownExporter

st.set_page_config(**PAGE_CONFIG)

if "session" not in st.session_state:
    st.session_state.session = SessionState()

session = st.session_state.session

st.title("📋 导出报告")
st.markdown("---")

if not session.current_plan or not session.persons:
    st.warning("⚠️ 请先创建方案并加载数据")
    st.stop()

exporter = MarkdownExporter()

tab1, tab2, tab3 = st.tabs(["📄 预览报告", "💾 导出 Markdown", "📊 数据导出"])

with tab1:
    st.subheader("报告预览")
    
    st.markdown("### 报告内容预览")
    
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        include_risk = st.checkbox("风险分析", value=True)
    with col2:
        include_coverage = st.checkbox("覆盖分析", value=True)
    with col3:
        include_congestion = st.checkbox("拥挤预测", value=True)
    with col4:
        include_schedule = st.checkbox("探访排班", value=True)
    
    try:
        congestions = getattr(session, 'congestions', None)
        coverage_gaps = getattr(session, 'coverage_gaps', None)
        hotspots = getattr(session, 'hotspots', None)
        
        markdown_content = exporter.generate_action_list(
            plan=session.current_plan,
            persons=session.persons,
            stations=session.stations,
            forecast=session.forecast,
            coverage_gaps=coverage_gaps,
            congestions=congestions,
            hotspots=hotspots,
        )
        
        st.markdown("---")
        st.markdown("### 报告预览（前 2000 字符）")
        st.code(markdown_content[:2000] + "\n...\n(内容已截断，请导出查看完整报告)", language="markdown")
        
        st.markdown("---")
        st.markdown("### 报告统计")
        
        risk_dist = {
            "低风险": 0, "中风险": 0, "高风险": 0, "极高风险": 0
        }
        for p in session.persons:
            risk_dist[p.risk_level] = risk_dist.get(p.risk_level, 0) + 1
        
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("方案名称", session.current_plan.name)
        with col2:
            st.metric("生成时间", date.today().strftime("%Y-%m-%d"))
        with col3:
            st.metric("老人总数", len(session.persons))
        with col4:
            critical_count = sum(1 for p in session.persons if p.risk_level == "极高风险")
            st.metric("极高风险", critical_count)
        
        if session.current_plan.visit_schedules:
            st.markdown("#### 探访排班统计")
            staff_counts = {}
            for schedule in session.current_plan.visit_schedules:
                staff_counts[schedule.assigned_staff] = staff_counts.get(schedule.assigned_staff, 0) + 1
            
            df_schedule = pd.DataFrame([
                {"网格员": staff, "探访次数": count}
                for staff, count in staff_counts.items()
            ])
            st.dataframe(df_schedule, use_container_width=True, hide_index=True)
        
    except Exception as e:
        st.error(f"❌ 生成预览失败: {str(e)}")

with tab2:
    st.subheader("导出 Markdown 报告")
    
    st.markdown("### 导出设置")
    
    col1, col2 = st.columns([1, 1])
    with col1:
        default_filename = f"高温避暑调度方案_{date.today().strftime('%Y%m%d')}"
        filename = st.text_input("文件名", value=default_filename)
    with col2:
        include_notes = st.checkbox("包含详细备注", value=True)
    
    st.markdown("---")
    
    if st.button("📄 生成并下载报告", type="primary", use_container_width=True):
        try:
            congestions = getattr(session, 'congestions', None)
            coverage_gaps = getattr(session, 'coverage_gaps', None)
            hotspots = getattr(session, 'hotspots', None)
            
            file_path = exporter.export_action_list(
                filename=filename,
                plan=session.current_plan,
                persons=session.persons,
                stations=session.stations,
                forecast=session.forecast,
                coverage_gaps=coverage_gaps,
                congestions=congestions,
                hotspots=hotspots,
            )
            
            st.success(f"✅ 报告已保存至: {file_path}")
            
            with open(file_path, "r", encoding="utf-8") as f:
                file_content = f.read()
            
            st.download_button(
                label="📥 下载 Markdown 文件",
                data=file_content,
                file_name=f"{filename}.md",
                mime="text/markdown",
            )
            
        except Exception as e:
            st.error(f"❌ 导出失败: {str(e)}")
    
    st.markdown("---")
    
    st.markdown("### 已导出的报告")
    
    exported_files = list(OUTPUT_DIR.glob("*.md"))
    
    if exported_files:
        df_files = []
        for file in sorted(exported_files, key=lambda x: x.stat().st_mtime, reverse=True):
            stat = file.stat()
            df_files.append({
                "文件名": file.name,
                "大小(KB)": round(stat.st_size / 1024, 1),
                "修改时间": str(date.fromtimestamp(stat.st_mtime)),
                "路径": str(file),
            })
        
        st.dataframe(pd.DataFrame(df_files), use_container_width=True, hide_index=True)
    else:
        st.info("暂无已导出的报告")

with tab3:
    st.subheader("数据导出")
    
    st.markdown("### 导出老人数据")
    
    if session.persons:
        df_persons = []
        for p in session.persons:
            df_persons.append({
                "ID": p.id,
                "姓名": p.name,
                "年龄": p.age,
                "性别": p.gender,
                "社区": p.community,
                "风险分": round(p.risk_score, 3),
                "风险等级": p.risk_level,
                "健康状况": "、".join(p.health_conditions) if p.health_conditions else "无",
                "独居": "是" if p.living_alone else "否",
                "行动能力": p.mobility,
                "有空调": "是" if p.has_air_conditioning else "否",
                "探访优先级": p.visit_priority,
            })
        
        df_p = pd.DataFrame(df_persons)
        
        st.dataframe(df_p, use_container_width=True, hide_index=True)
        
        csv_persons = df_p.to_csv(index=False).encode('utf-8-sig')
        
        st.download_button(
            label="📥 下载老人数据 CSV",
            data=csv_persons,
            file_name=f"老人风险数据_{date.today().strftime('%Y%m%d')}.csv",
            mime="text/csv",
        )
    
    st.markdown("---")
    
    st.markdown("### 导出站点数据")
    
    if session.stations:
        df_stations = []
        for s in session.stations:
            df_stations.append({
                "ID": s.id,
                "名称": s.name,
                "社区": s.community,
                "容量": s.capacity,
                "工作人员": s.staff_count,
                "开放时间": f"{s.opening_time} - {s.closing_time}",
                "设施": "、".join(s.facilities) if s.facilities else "无",
                "状态": s.status,
            })
        
        df_s = pd.DataFrame(df_stations)
        
        st.dataframe(df_s, use_container_width=True, hide_index=True)
        
        csv_stations = df_s.to_csv(index=False).encode('utf-8-sig')
        
        st.download_button(
            label="📥 下载站点数据 CSV",
            data=csv_stations,
            file_name=f"避暑站数据_{date.today().strftime('%Y%m%d')}.csv",
            mime="text/csv",
        )
    
    st.markdown("---")
    
    st.markdown("### 导出探访排班")
    
    if session.current_plan and session.current_plan.visit_schedules:
        df_schedules = []
        person_map = {p.id: p for p in session.persons}
        
        for schedule in session.current_plan.visit_schedules:
            person = person_map.get(schedule.elderly_id)
            df_schedules.append({
                "网格员": schedule.assigned_staff,
                "时间": schedule.scheduled_time,
                "老人姓名": person.name if person else "未知",
                "社区": person.community if person else "未知",
                "风险等级": person.risk_level if person else "未知",
                "探访类型": schedule.visit_type,
                "状态": schedule.status,
            })
        
        df_sch = pd.DataFrame(df_schedules)
        
        st.dataframe(df_sch, use_container_width=True, hide_index=True)
        
        csv_schedules = df_sch.to_csv(index=False).encode('utf-8-sig')
        
        st.download_button(
            label="📥 下载排班表 CSV",
            data=csv_schedules,
            file_name=f"探访排班表_{date.today().strftime('%Y%m%d')}.csv",
            mime="text/csv",
        )
    else:
        st.info("暂无探访排班数据，请先在「调度模拟」页面生成排班")
