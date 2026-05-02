import streamlit as st
import pandas as pd
from datetime import date

from config import PAGE_CONFIG
from persistence import SessionState, PlanManager
from models import RiskLevel

st.set_page_config(**PAGE_CONFIG)

if "session" not in st.session_state:
    st.session_state.session = SessionState()

session = st.session_state.session

st.title("💾 方案管理")
st.markdown("---")

plan_manager = PlanManager()

tab1, tab2, tab3 = st.tabs(["📋 已保存方案", "💾 保存当前方案", "🗑️ 方案管理"])

with tab1:
    st.subheader("已保存的方案")
    
    saved_plans = plan_manager.list_plans()
    
    if not saved_plans:
        st.info("暂无已保存的方案")
    else:
        st.markdown(f"**共 {len(saved_plans)} 个已保存的方案**")
        
        for plan in saved_plans:
            with st.expander(f"📋 {plan['name']} ({plan['district']})", expanded=False):
                col1, col2, col3, col4 = st.columns(4)
                with col1:
                    st.metric("方案名称", plan['name'])
                with col2:
                    st.metric("覆盖区域", plan['district'])
                with col3:
                    st.metric("预报日期", plan['forecast_date'][:10] if plan['forecast_date'] else "-")
                with col4:
                    st.metric("老人数量", plan['elderly_count'])
                
                st.markdown(f"**创建时间**: {plan['created_at'][:19] if plan['created_at'] else '-'}")
                st.markdown(f"**保存时间**: {plan['saved_at'][:19] if plan['saved_at'] else '-'}")
                
                col_btn1, col_btn2, col_btn3 = st.columns([1, 1, 1])
                with col_btn1:
                    if st.button("📥 加载此方案", key=f"load_{plan['id']}"):
                        try:
                            loaded = plan_manager.load_plan(plan['id'])
                            session.current_plan = loaded['plan']
                            session.persons = loaded['persons']
                            session.stations = loaded['stations']
                            session.forecast = loaded['forecast']
                            st.success("✅ 方案加载成功！")
                            st.rerun()
                        except Exception as e:
                            st.error(f"❌ 加载失败: {str(e)}")
                with col_btn2:
                    if st.button("🗑️ 删除此方案", key=f"del_{plan['id']}"):
                        try:
                            plan_manager.delete_plan(plan['id'])
                            st.success("✅ 方案已删除")
                            st.rerun()
                        except Exception as e:
                            st.error(f"❌ 删除失败: {str(e)}")

with tab2:
    st.subheader("保存当前方案")
    
    if not session.current_plan or not session.persons:
        st.warning("⚠️ 请先创建方案并加载数据")
    else:
        st.markdown("### 当前方案信息")
        
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("方案名称", session.current_plan.name)
        with col2:
            st.metric("覆盖区域", session.current_plan.district)
        with col3:
            st.metric("预报日期", str(session.current_plan.forecast_date))
        with col4:
            st.metric("老人数量", len(session.current_plan.elderly_ids))
        
        st.markdown("### 数据摘要")
        
        if session.persons:
            risk_dist = {
                "低风险": 0, "中风险": 0, "高风险": 0, "极高风险": 0
            }
            for p in session.persons:
                risk_dist[p.risk_level] = risk_dist.get(p.risk_level, 0) + 1
            
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.metric("🟢 低风险", risk_dist["低风险"])
            with col2:
                st.metric("🟡 中风险", risk_dist["中风险"])
            with col3:
                st.metric("🟠 高风险", risk_dist["高风险"])
            with col4:
                st.metric("🔴 极高风险", risk_dist["极高风险"])
        
        st.markdown("### 方案详情")
        
        if session.current_plan.station_assignments:
            st.markdown(f"- **站点分配**: {len(session.current_plan.station_assignments)} 位老人已分配")
        else:
            st.markdown("- **站点分配**: 尚未执行")
        
        if session.current_plan.visit_schedules:
            st.markdown(f"- **探访排班**: {len(session.current_plan.visit_schedules)} 个安排已生成")
        else:
            st.markdown("- **探访排班**: 尚未执行")
        
        if session.current_plan.locked_stations:
            locked_names = [
                s.name for s in session.stations 
                if s.id in session.current_plan.locked_stations
            ]
            st.markdown(f"- **锁定站点**: {', '.join(locked_names)}")
        else:
            st.markdown("- **锁定站点**: 无")
        
        st.markdown("---")
        
        new_name = st.text_input(
            "修改方案名称（可选）",
            value=session.current_plan.name
        )
        
        notes = st.text_area("方案备注（可选）")
        
        if st.button("💾 保存方案", type="primary", use_container_width=True):
            try:
                if new_name:
                    session.current_plan.name = new_name
                if notes:
                    session.current_plan.notes = notes
                
                plan_manager.save_plan(
                    session.current_plan,
                    session.persons,
                    session.stations,
                    session.forecast,
                )
                st.success("✅ 方案保存成功！")
            except Exception as e:
                st.error(f"❌ 保存失败: {str(e)}")

with tab3:
    st.subheader("方案批量管理")
    
    saved_plans = plan_manager.list_plans()
    
    if not saved_plans:
        st.info("暂无已保存的方案")
    else:
        st.markdown("### 方案列表")
        
        df_data = []
        for plan in saved_plans:
            df_data.append({
                "方案名称": plan['name'],
                "覆盖区域": plan['district'],
                "预报日期": plan['forecast_date'][:10] if plan['forecast_date'] else "-",
                "老人数量": plan['elderly_count'],
                "保存时间": plan['saved_at'][:19] if plan['saved_at'] else "-",
                "ID": plan['id'],
            })
        
        df = pd.DataFrame(df_data)
        st.dataframe(df.drop(columns=["ID"]), use_container_width=True, hide_index=True)
        
        st.markdown("---")
        
        st.warning("⚠️ 危险操作 - 请谨慎使用")
        
        col1, col2 = st.columns([1, 1])
        
        with col1:
            if st.button("🗑️ 删除所有方案", type="secondary"):
                st.session_state.confirm_delete_all = True
        
        if st.session_state.get('confirm_delete_all', False):
            st.error("⚠️ 确定要删除所有已保存的方案吗？此操作不可恢复！")
            col_confirm1, col_confirm2 = st.columns([1, 1])
            with col_confirm1:
                if st.button("✅ 确认删除", type="primary"):
                    for plan in saved_plans:
                        plan_manager.delete_plan(plan['id'])
                    st.session_state.confirm_delete_all = False
                    st.success("✅ 所有方案已删除")
                    st.rerun()
            with col_confirm2:
                if st.button("❌ 取消"):
                    st.session_state.confirm_delete_all = False
                    st.rerun()

st.markdown("---")

st.subheader("当前会话状态")

col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("老人数据", f"{len(session.persons)} 条" if session.persons else "无")
with col2:
    st.metric("站点数据", f"{len(session.stations)} 条" if session.stations else "无")
with col3:
    st.metric("预报数据", "已加载" if session.forecast else "无")
with col4:
    st.metric("当前方案", session.current_plan.name if session.current_plan else "无")

if st.button("🗑️ 清空当前会话", use_container_width=True):
    session.clear()
    st.success("✅ 会话已清空")
    st.rerun()
