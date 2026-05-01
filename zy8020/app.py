import streamlit as st
import pandas as pd
import tempfile
import os

from services.validation import load_schedule, load_gps, load_events
from services.matching import add_date_to_schedule, match_schedule_with_gps, calculate_headways, identify_missing_trips
from services.anomaly_detection import run_all_detection
from services.report import generate_summary, generate_markdown_report, export_anomalies_to_csv, export_matched_to_csv, export_summary_to_csv

st.set_page_config(page_title="公交调度复盘工具", layout="wide")

st.title("🚌 公交调度复盘工具")

with st.sidebar:
    st.header("参数设置")
    
    reference_date = st.date_input("参考日期", value=pd.to_datetime('2024-01-15'))
    
    st.subheader("异常检测阈值")
    bunching_threshold = st.number_input("串车阈值(分钟)", min_value=1, max_value=10, value=3)
    large_threshold = st.number_input("大间隔阈值(分钟)", min_value=10, max_value=60, value=20)
    deviation_threshold = st.number_input("到站偏差阈值(分钟)", min_value=1, max_value=30, value=5)
    
    normal_headway_min = st.number_input("正常间隔下限(分钟)", min_value=1, max_value=30, value=8)
    normal_headway_max = st.number_input("正常间隔上限(分钟)", min_value=1, max_value=60, value=12)

col1, col2, col3 = st.columns(3)

with col1:
    st.subheader("📅 计划时刻表")
    schedule_file = st.file_uploader("上传计划时刻表 CSV", type="csv")
    use_sample_schedule = st.checkbox("使用样例数据", key="schedule_sample")

with col2:
    st.subheader("📍 GPS到站记录")
    gps_file = st.file_uploader("上传GPS到站记录 CSV", type="csv")
    use_sample_gps = st.checkbox("使用样例数据", key="gps_sample")

with col3:
    st.subheader("🔧 车辆事件")
    events_file = st.file_uploader("上传车辆事件 JSON", type="json")
    use_sample_events = st.checkbox("使用样例数据", key="events_sample")

schedule_df = None
gps_df = None
events_data = None
schedule_errors = []
gps_errors = []
events_errors = []

if schedule_file:
    schedule_df, schedule_errors = load_schedule(schedule_file)
elif use_sample_schedule:
    sample_path = os.path.join(os.path.dirname(__file__), 'data', 'sample_schedule.csv')
    schedule_df, schedule_errors = load_schedule(sample_path)

if gps_file:
    gps_df, gps_errors = load_gps(gps_file)
elif use_sample_gps:
    sample_path = os.path.join(os.path.dirname(__file__), 'data', 'sample_gps.csv')
    gps_df, gps_errors = load_gps(sample_path)

if events_file:
    events_data, events_errors = load_events(events_file)
elif use_sample_events:
    sample_path = os.path.join(os.path.dirname(__file__), 'data', 'sample_events.json')
    events_data, events_errors = load_events(sample_path)

if schedule_errors:
    st.error("计划时刻表校验错误:")
    for error in schedule_errors:
        st.write(f"- {error}")

if gps_errors:
    st.error("GPS到站记录校验错误:")
    for error in gps_errors:
        st.write(f"- {error}")

if events_errors:
    st.error("车辆事件校验错误:")
    for error in events_errors:
        st.write(f"- {error}")

if schedule_df is not None and gps_df is not None:
    st.subheader("🔍 数据匹配与计算")
    
    with st.spinner("正在匹配计划与实际数据..."):
        schedule_with_date = add_date_to_schedule(schedule_df, reference_date.strftime('%Y-%m-%d'))
        matched_df = match_schedule_with_gps(schedule_with_date, gps_df)
        headway_df = calculate_headways(matched_df)
        missing_df = identify_missing_trips(schedule_with_date, matched_df)
        
        config = {
            'bunching_threshold': bunching_threshold,
            'large_threshold': large_threshold,
            'deviation_threshold': deviation_threshold,
            'normal_headway_range': (normal_headway_min, normal_headway_max)
        }
        
        anomalies_df = run_all_detection(matched_df, headway_df, missing_df, events_data, config)
    
    st.success("匹配完成!")
    
    tab1, tab2, tab3, tab4 = st.tabs(["概览统计", "异常详情", "匹配数据", "发车间隔"])
    
    with tab1:
        summary = generate_summary(matched_df, anomalies_df, headway_df, missing_df)
        
        st.markdown("### 📊 统计概览")
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("计划班次", summary['计划班次总数'])
        col2.metric("实际到站", summary['实际到站班次'])
        col3.metric("匹配率", f"{summary['匹配率']}%")
        col4.metric("异常总数", summary['异常总数'])
        
        st.markdown("### 📈 详细统计")
        st.dataframe(pd.DataFrame([summary]).T.rename(columns={0: '数值'}))
    
    with tab2:
        st.markdown("### 🚨 异常列表")
        anomaly_counts = anomalies_df['异常类型'].value_counts()
        st.bar_chart(anomaly_counts)
        
        st.markdown("### 异常详情表格")
        st.dataframe(anomalies_df[['线路编号', '方向', '站点名称', '班次号', '异常类型', '异常描述', '可能原因']])
    
    with tab3:
        st.markdown("### ✅ 匹配结果")
        st.dataframe(matched_df[['线路编号', '方向', '站点名称', '班次号', '计划到站时间', '实际到站时间', '到站偏差(分钟)', '车辆编号']])
    
    with tab4:
        st.markdown("### ⏱️ 发车间隔")
        st.dataframe(headway_df[['线路编号', '方向', '站点名称', '前一班次号', '当前班次号', '发车间隔(分钟)']])
    
    st.subheader("📥 导出报告")
    
    col_export1, col_export2, col_export3 = st.columns(3)
    
    with col_export1:
        md_report = generate_markdown_report(summary, anomalies_df, matched_df, headway_df)
        st.download_button(
            label="下载 Markdown 报告",
            data=md_report,
            file_name=f"公交调度复盘报告_{reference_date.strftime('%Y%m%d')}.md",
            mime="text/markdown"
        )
    
    with col_export2:
        anomalies_csv = anomalies_df.to_csv(index=False, encoding='utf-8-sig')
        st.download_button(
            label="下载异常数据 CSV",
            data=anomalies_csv,
            file_name=f"异常数据_{reference_date.strftime('%Y%m%d')}.csv",
            mime="text/csv"
        )
    
    with col_export3:
        matched_csv = matched_df.to_csv(index=False, encoding='utf-8-sig')
        st.download_button(
            label="下载匹配数据 CSV",
            data=matched_csv,
            file_name=f"匹配数据_{reference_date.strftime('%Y%m%d')}.csv",
            mime="text/csv"
        )