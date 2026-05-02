import streamlit as st
from pathlib import Path
from datetime import date

from config import PAGE_CONFIG, DATA_DIR
from persistence import SessionState, DataLoader, PlanManager
from models import RiskLevel

st.set_page_config(**PAGE_CONFIG)

if "session" not in st.session_state:
    st.session_state.session = SessionState()

session = st.session_state.session

st.title("🌡️ 高温避暑站调度沙盘")
st.markdown("---")

st.markdown("""
## 欢迎使用高温避暑站调度沙盘

本系统专为城市社区网格员设计，用于热浪期间的避暑站调度和老人探访安排。

### 主要功能
- 📊 **风险评估**: 根据老人年龄、健康状况、体感温度等计算个人风险分
- 🗺️ **覆盖分析**: 识别站点覆盖缺口和高风险热点区域
- 📈 **拥挤预测**: 预测各时段站点拥挤程度
- 🚶 **路线优化**: 智能生成探访排班甘特图
- 💾 **方案管理**: 保存和加载调度方案
- 📋 **导出报告**: 生成 Markdown 格式行动清单

### 快速开始
1. 从左侧菜单进入「数据导入」页面
2. 加载示例数据或上传您的 CSV/JSON 文件
3. 依次进行风险分析、调度模拟
4. 查看可视化结果并导出行动清单
""")

st.markdown("---")

with st.expander("📁 示例数据说明", expanded=False):
    st.markdown("""
    系统提供以下示例数据：
    
    - **elderly_sample.csv**: 20位老人信息，包含不同风险等级
    - **stations_sample.csv**: 5个避暑站，分布在不同社区
    - **forecast_sample.json**: 逐小时体感温度预报（橙色预警级别）
    
    您可以直接使用这些数据体验系统功能。
    """)

with st.expander("⚠️ 风险等级说明", expanded=False):
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.markdown(f"<div style='background-color:#28a745;padding:10px;border-radius:5px;text-align:center;color:white;'>🟢 低风险</div>", unsafe_allow_html=True)
        st.caption("风险分 < 0.25")
    with col2:
        st.markdown(f"<div style='background-color:#ffc107;padding:10px;border-radius:5px;text-align:center;color:black;'>🟡 中风险</div>", unsafe_allow_html=True)
        st.caption("风险分 0.25 - 0.50")
    with col3:
        st.markdown(f"<div style='background-color:#fd7e14;padding:10px;border-radius:5px;text-align:center;color:white;'>🟠 高风险</div>", unsafe_allow_html=True)
        st.caption("风险分 0.50 - 0.75")
    with col4:
        st.markdown(f"<div style='background-color:#dc3545;padding:10px;border-radius:5px;text-align:center;color:white;'>🔴 极高风险</div>", unsafe_allow_html=True)
        st.caption("风险分 ≥ 0.75")

st.markdown("---")

if st.button("🚀 快速开始 - 加载示例数据", type="primary", use_container_width=True):
    try:
        elderly_file = DATA_DIR / "elderly_sample.csv"
        stations_file = DATA_DIR / "stations_sample.csv"
        forecast_file = DATA_DIR / "forecast_sample.json"

        session.persons = DataLoader.load_elderly_from_csv(elderly_file)
        session.stations = DataLoader.load_stations_from_csv(stations_file)
        session.forecast = DataLoader.load_forecast_from_json(forecast_file)

        from risk_algorithm import RiskCalculator
        risk_calc = RiskCalculator()
        
        for person in session.persons:
            risk_calc.update_person_risk(person, session.forecast)

        plan_manager = PlanManager()
        session.current_plan = plan_manager.create_new_plan(
            name="示例调度方案",
            district="阳光区",
            forecast_date=date.today(),
            persons=session.persons,
            stations=session.stations,
        )

        st.success("✅ 示例数据加载成功！请从左侧菜单继续操作。")
        st.rerun()
    except Exception as e:
        st.error(f"❌ 加载示例数据失败: {str(e)}")

st.markdown("---")
st.caption("高温避暑站调度沙盘 v1.0 | 为城市社区网格员提供热浪应对决策支持")
