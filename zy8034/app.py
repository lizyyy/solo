import streamlit as st
import pandas as pd
import plotly.express as px
from modules.data_parser import parse_flights, parse_bag_scans, parse_carousel_allocations, parse_interventions
from modules.rule_calculator import calculate_flight_metrics, detect_carousel_conflicts, calculate_reassignment_impact, get_summary_stats
from modules.reporter import generate_markdown_report, generate_csv_report

st.set_page_config(page_title="机场行李转盘拥堵复盘看板", layout="wide")

st.title("🛎️ 机场行李转盘拥堵复盘看板")
st.subheader("行李保障主管 - 早高峰后复盘工具")

st.sidebar.header("数据文件上传")

flights_file = st.sidebar.file_uploader("航班计划 CSV", type=["csv"])
bag_scans_file = st.sidebar.file_uploader("行李扫描 CSV", type=["csv"])
carousel_file = st.sidebar.file_uploader("转盘分配 JSON", type=["json"])
interventions_file = st.sidebar.file_uploader("人工干预 YAML", type=["yaml"])

use_sample_data = st.sidebar.checkbox("使用示例数据", value=True)

if use_sample_data:
    flights_path = "sample_data/flights.csv"
    bag_scans_path = "sample_data/bag_scans.csv"
    carousel_path = "sample_data/carousel_allocations.json"
    interventions_path = "sample_data/interventions.yaml"
    
    flights_df = parse_flights(flights_path)
    bag_scans_df = parse_bag_scans(bag_scans_path)
    carousel_allocations = parse_carousel_allocations(carousel_path)
    interventions = parse_interventions(interventions_path)
else:
    if all([flights_file, bag_scans_file, carousel_file, interventions_file]):
        flights_df = parse_flights(flights_file)
        bag_scans_df = parse_bag_scans(bag_scans_file)
        carousel_allocations = parse_carousel_allocations(carousel_file)
        interventions = parse_interventions(interventions_file)
    else:
        st.warning("请上传所有数据文件或勾选使用示例数据")
        st.stop()

metrics_df = calculate_flight_metrics(flights_df, bag_scans_df, carousel_allocations, interventions)

st.sidebar.header("筛选条件")

available_dates = sorted(metrics_df['arrival_date'].unique())
selected_date = st.sidebar.selectbox("选择日期", available_dates, index=0)

available_terminals = ['全部'] + sorted(metrics_df['terminal'].unique())
selected_terminal = st.sidebar.selectbox("选择航站楼", available_terminals, index=0)

available_carousels = ['全部'] + sorted(metrics_df['carousel'].dropna().unique())
selected_carousel = st.sidebar.selectbox("选择转盘", available_carousels, index=0)

filtered_df = metrics_df[metrics_df['arrival_date'] == selected_date].copy()

if selected_terminal != '全部':
    filtered_df = filtered_df[filtered_df['terminal'] == selected_terminal]

if selected_carousel != '全部':
    filtered_df = filtered_df[filtered_df['carousel'] == selected_carousel]

conflicts = detect_carousel_conflicts(filtered_df)
reassignments = calculate_reassignment_impact(filtered_df, interventions)
stats = get_summary_stats(filtered_df)

col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("总航班数", stats['total_flights'])
with col2:
    st.metric("首件延迟航班", stats['flights_with_first_delay'])
with col3:
    st.metric("末件超时航班", stats['flights_with_last_overtime'])
with col4:
    st.metric("人工干预航班", stats['flights_with_intervention'])

st.markdown("---")

tab1, tab2, tab3 = st.tabs(["航班详情", "冲突分析", "改派影响"])

with tab1:
    st.subheader("航班详细数据")
    
    display_cols = [
        'flight_num', 'terminal', 'carousel',
        'expected_first_bag', 'actual_first_bag', 'first_delay_minutes',
        'expected_last_bag', 'actual_last_bag', 'last_overtime_minutes',
        'bag_count', 'has_intervention'
    ]
    
    display_df = filtered_df[display_cols].copy()
    display_df = display_df.sort_values('arrival_datetime')
    
    st.dataframe(display_df, use_container_width=True)
    
    st.subheader("延迟分布")
    delay_df = filtered_df[filtered_df['first_delay_minutes'] > 0][['flight_num', 'first_delay_minutes']]
    if not delay_df.empty:
        fig = px.bar(delay_df, x='flight_num', y='first_delay_minutes',
                     title='各航班首件延迟情况',
                     labels={'first_delay_minutes': '延迟分钟数', 'flight_num': '航班号'})
        st.plotly_chart(fig, use_container_width=True)

with tab2:
    st.subheader("转盘容量冲突")
    if conflicts:
        for conflict in conflicts:
            st.warning(f"⚠️ 转盘 {conflict['carousel']}: {conflict['flight1']} 和 {conflict['flight2']} 冲突 {conflict['overlap_minutes']} 分钟")
    else:
        st.success("✅ 未检测到转盘容量冲突")

with tab3:
    st.subheader("改派影响分析")
    if reassignments:
        for reassignment in reassignments:
            st.info(f"🔄 航班 {reassignment['flight_num']}: 从 {reassignment['original_carousel']} 改派到 {reassignment['new_carousel']}")
            st.caption(f"原因: {reassignment['reason']}")
    else:
        st.info("无改派记录")

st.markdown("---")
st.subheader("导出报告")

col_a, col_b = st.columns(2)

with col_a:
    if st.button("生成 Markdown 报告"):
        md_report = generate_markdown_report(
            filtered_df, conflicts, reassignments,
            selected_date, selected_terminal
        )
        st.download_button(
            label="下载 Markdown 报告",
            data=md_report,
            file_name=f"baggage_review_{selected_date}.md",
            mime="text/markdown"
        )

with col_b:
    if st.button("生成 CSV 报告"):
        csv_report = generate_csv_report(filtered_df)
        st.download_button(
            label="下载 CSV 报告",
            data=csv_report,
            file_name=f"baggage_review_{selected_date}.csv",
            mime="text/csv"
        )
