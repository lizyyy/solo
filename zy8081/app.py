import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import os

from src.data_parser import parse_all_data
from src.block_statistics import (
    calculate_block_stats,
    get_missing_plots,
    get_duplicate_records,
    get_boundary_rows,
    get_variety_rep_summary,
    summarize_weather_events
)
from src.anomaly_rules import run_all_anomaly_checks
from src.export_module import export_cleaned_yield, export_qc_report

st.set_page_config(
    page_title="田间试验随机区组复核看板",
    page_icon="🌾",
    layout="wide"
)

st.title("🌾 田间试验随机区组复核看板")

with st.sidebar:
    st.header("文件导入")
    
    yield_file = st.file_uploader("上传产量数据 (plot_yield.csv)", type="csv")
    weather_file = st.file_uploader("上传天气数据 (weather.csv)", type="csv")
    design_file = st.file_uploader("上传试验设计 (trial_design.yaml)", type="yaml")
    
    use_sample_data = st.checkbox("使用示例数据", value=True)
    
    st.markdown("---")
    st.header("筛选条件")
    
    selected_blocks = st.multiselect("选择区组", [], [])
    selected_varieties = st.multiselect("选择品种", [], [])
    
    st.markdown("---")
    st.header("导出")
    export_btn = st.button("导出 QC 报告和清洗数据")

if use_sample_data:
    sample_dir = os.path.join(os.path.dirname(__file__), 'sample_data')
    yield_path = os.path.join(sample_dir, 'plot_yield.csv')
    weather_path = os.path.join(sample_dir, 'weather.csv')
    design_path = os.path.join(sample_dir, 'trial_design.yaml')
    
    yield_df, weather_df, design, errors = parse_all_data(yield_path, weather_path, design_path)
    
    if errors:
        st.warning("数据加载警告:")
        for error in errors:
            st.write(f"- {error}")
else:
    if yield_file and weather_file and design_file:
        import tempfile
        
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as f:
            f.write(yield_file.getbuffer())
            yield_path = f.name
        
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as f:
            f.write(weather_file.getbuffer())
            weather_path = f.name
        
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.yaml', delete=False) as f:
            f.write(design_file.getbuffer())
            design_path = f.name
        
        yield_df, weather_df, design, errors = parse_all_data(yield_path, weather_path, design_path)
        
        os.unlink(yield_path)
        os.unlink(weather_path)
        os.unlink(design_path)
        
        if errors:
            st.warning("数据加载警告:")
            for error in errors:
                st.write(f"- {error}")
    else:
        st.info("请上传三个必需文件，或勾选使用示例数据")
        st.stop()

if 'yield_df' not in locals() or yield_df.empty:
    st.error("无法加载数据")
    st.stop()

varieties = sorted(yield_df['variety'].unique())
blocks = sorted(yield_df['block'].unique())

with st.sidebar:
    selected_blocks = st.multiselect("选择区组", blocks, blocks)
    selected_varieties = st.multiselect("选择品种", varieties, varieties)

filtered_df = yield_df[
    (yield_df['block'].isin(selected_blocks)) &
    (yield_df['variety'].isin(selected_varieties))
]

anomalies, weather_shocks = run_all_anomaly_checks(filtered_df, weather_df, design)

summary_col1, summary_col2, summary_col3, summary_col4 = st.columns(4)

with summary_col1:
    st.metric("总地块数", len(filtered_df))

with summary_col2:
    valid_yield = filtered_df['yield_kg'].notna().sum()
    st.metric("有效产量", valid_yield)

with summary_col3:
    missing_yield = filtered_df['yield_kg'].isna().sum()
    st.metric("缺测地块", missing_yield)

with summary_col4:
    st.metric("异常总数", len(anomalies))

tab1, tab2, tab3, tab4, tab5 = st.tabs([
    "产量分布",
    "区组/重复统计",
    "异常检测",
    "天气冲击",
    "数据表格"
])

with tab1:
    st.subheader("产量分布")
    
    col1, col2 = st.columns(2)
    
    with col1:
        fig_box = px.box(filtered_df, x='variety', y='yield_kg', 
                        color='variety', title='品种产量分布')
        st.plotly_chart(fig_box, use_container_width=True)
    
    with col2:
        fig_hist = px.histogram(filtered_df, x='yield_kg', 
                                nbins=20, title='产量直方图')
        st.plotly_chart(fig_hist, use_container_width=True)
    
    fig_block = px.box(filtered_df, x='block', y='yield_kg', 
                       color='block', title='区组产量分布')
    st.plotly_chart(fig_block, use_container_width=True)

with tab2:
    st.subheader("区组/重复统计")
    
    block_stats = calculate_block_stats(filtered_df)
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.dataframe(block_stats[['block', 'variety', 'count', 'mean_yield', 'std_yield', 'cv']]
                     .rename(columns={
                         'count': '地块数',
                         'mean_yield': '平均产量(kg)',
                         'std_yield': '标准差',
                         'cv': '变异系数(%)'
                     }),
                     use_container_width=True)
    
    with col2:
        variety_rep = get_variety_rep_summary(filtered_df)
        st.dataframe(variety_rep.pivot(index='variety', columns='rep', values='mean_yield'),
                     use_container_width=True)
    
    st.subheader("缺测地块")
    missing_plots = get_missing_plots(filtered_df, design)
    if not missing_plots.empty:
        st.dataframe(missing_plots, use_container_width=True)
    else:
        st.success("无缺测地块")
    
    st.subheader("重复记录")
    duplicates = get_duplicate_records(filtered_df)
    if not duplicates.empty:
        st.dataframe(duplicates, use_container_width=True)
    else:
        st.success("无重复记录")

with tab3:
    st.subheader("异常检测")
    
    anomaly_counts = anomalies['anomaly_type'].value_counts().reset_index()
    anomaly_counts.columns = ['异常类型', '数量']
    
    type_map = {
        'missing_yield': '产量缺失',
        'boundary_anomaly': '边界行异常',
        'outlier': '产量异常值',
        'duplicate': '重复记录',
        'missing_rep': '缺失重复'
    }
    anomaly_counts['异常类型'] = anomaly_counts['异常类型'].map(type_map)
    
    col1, col2 = st.columns([1, 2])
    
    with col1:
        fig_anomaly = px.bar(anomaly_counts, x='异常类型', y='数量', 
                            title='异常类型统计')
        st.plotly_chart(fig_anomaly, use_container_width=True)
    
    with col2:
        display_anomalies = anomalies.copy()
        display_anomalies['anomaly_type'] = display_anomalies['anomaly_type'].map(type_map)
        st.dataframe(display_anomalies[['plot_id', 'block', 'rep', 'variety', 'yield_kg', 'anomaly_type', 'anomaly_desc']],
                     use_container_width=True)
    
    st.subheader("边界行分析")
    boundary_data = get_boundary_rows(filtered_df, design)
    if not boundary_data.empty:
        fig_boundary = px.box(boundary_data, x='variety', y='yield_kg', 
                             color='variety', title='边界行产量分布')
        st.plotly_chart(fig_boundary, use_container_width=True)
        st.dataframe(boundary_data[['plot_id', 'block', 'rep', 'variety', 'yield_kg', 'notes']],
                     use_container_width=True)
    else:
        st.info("无边界行数据")

with tab4:
    st.subheader("天气冲击事件")
    
    if not weather_shocks.empty:
        st.dataframe(weather_shocks, use_container_width=True)
        
        fig_weather = px.line(weather_df, x='date', y='temperature_max',
                             title='温度趋势')
        fig_weather.add_scatter(x=weather_shocks['date'], 
                                y=weather_shocks['temperature_max'],
                                mode='markers', marker=dict(color='red', size=10),
                                name='天气冲击')
        st.plotly_chart(fig_weather, use_container_width=True)
    else:
        st.info("无天气冲击事件")
    
    st.subheader("完整天气数据")
    st.dataframe(weather_df, use_container_width=True)

with tab5:
    st.subheader("原始产量数据")
    st.dataframe(filtered_df, use_container_width=True)

if export_btn:
    with st.spinner("正在导出..."):
        cleaned_path = export_cleaned_yield(filtered_df, 'cleaned_yield.csv')
        report_path = export_qc_report(filtered_df, weather_df, design, anomalies, weather_shocks, 'qc_report.md')
        
        st.success(f"导出完成！")
        
        with open(cleaned_path, 'rb') as f:
            st.download_button(
                label="下载 cleaned_yield.csv",
                data=f,
                file_name='cleaned_yield.csv',
                mime='text/csv'
            )
        
        with open(report_path, 'rb') as f:
            st.download_button(
                label="下载 qc_report.md",
                data=f,
                file_name='qc_report.md',
                mime='text/markdown'
            )