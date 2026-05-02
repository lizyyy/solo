"""
施工噪声投诉复核台
Streamlit 主应用程序
"""
import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from datetime import datetime, timedelta
import io
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from models import (
    NoiseData, WeatherData, ComplaintData,
    AnalysisResult, AnomalyType, SeverityLevel
)
from utils import (
    ImportValidator, NoiseAnalyzer, AnalysisConfig,
    StateManager, ReviewState, ReportExporter
)


def init_session_state():
    """初始化会话状态"""
    if 'initialized' not in st.session_state:
        st.session_state.initialized = True
        st.session_state.noise_data_dict = {}
        st.session_state.weather_data_dict = {}
        st.session_state.complaint_data = None
        st.session_state.analysis_result = None
        st.session_state.review_state = None
        st.session_state.validation_results = {}
        st.session_state.state_manager = StateManager()
        st.session_state.active_tab = 'import'
        st.session_state.selected_site = None
        st.session_state.selected_complaint = None
        st.session_state.analysis_config = {
            'noise_threshold_daytime': 60.0,
            'noise_threshold_nighttime': 50.0,
            'nighttime_start_hour': 22,
            'nighttime_end_hour': 6,
            'peak_threshold_increase': 15.0,
            'offline_threshold_seconds': 60.0,
            'complaint_analysis_window_before': 10,
            'complaint_analysis_window_after': 5
        }


def render_sidebar():
    """渲染侧边栏"""
    with st.sidebar:
        st.title("🎛️ 施工噪声投诉复核台")
        st.markdown("---")
        
        st.subheader("⚙️ 分析配置")
        
        st.session_state.analysis_config['noise_threshold_daytime'] = st.slider(
            "昼间噪声阈值 (dB)",
            min_value=50.0,
            max_value=75.0,
            value=st.session_state.analysis_config['noise_threshold_daytime'],
            step=1.0
        )
        
        st.session_state.analysis_config['noise_threshold_nighttime'] = st.slider(
            "夜间噪声阈值 (dB)",
            min_value=40.0,
            max_value=65.0,
            value=st.session_state.analysis_config['noise_threshold_nighttime'],
            step=1.0
        )
        
        col1, col2 = st.columns(2)
        with col1:
            st.session_state.analysis_config['nighttime_start_hour'] = st.number_input(
                "夜间开始",
                min_value=18,
                max_value=24,
                value=st.session_state.analysis_config['nighttime_start_hour']
            )
        with col2:
            st.session_state.analysis_config['nighttime_end_hour'] = st.number_input(
                "夜间结束",
                min_value=0,
                max_value=8,
                value=st.session_state.analysis_config['nighttime_end_hour']
            )
        
        st.session_state.analysis_config['peak_threshold_increase'] = st.slider(
            "突增峰值检测阈值 (dB)",
            min_value=5.0,
            max_value=30.0,
            value=st.session_state.analysis_config['peak_threshold_increase'],
            step=1.0
        )
        
        st.markdown("---")
        
        st.subheader("📊 数据状态")
        
        if st.session_state.noise_data_dict:
            st.success(f"噪声数据: {len(st.session_state.noise_data_dict)} 个站点")
            for site_id, data in st.session_state.noise_data_dict.items():
                st.text(f"  • {site_id}: {data.total_records} 条记录")
        else:
            st.info("未加载噪声数据")
        
        if st.session_state.weather_data_dict:
            st.success(f"气象数据: {len(st.session_state.weather_data_dict)} 个站点")
        else:
            st.info("未加载气象数据")
        
        if st.session_state.complaint_data:
            st.success(f"投诉数据: {st.session_state.complaint_data.total_complaints} 条")
        else:
            st.info("未加载投诉数据")
        
        if st.session_state.analysis_result:
            st.markdown("---")
            st.subheader("📈 分析结果")
            stats = st.session_state.analysis_result.statistics
            st.metric("总异常事件", stats.get('total_anomaly_events', 0))
            st.metric("超标窗口", stats.get('total_over_threshold_windows', 0))
            st.metric("突增峰值", stats.get('total_sudden_peaks', 0))
            st.metric("传感器离线", stats.get('total_sensor_offlines', 0))


def render_import_tab():
    """渲染数据导入标签页"""
    st.header("📥 数据导入")
    st.markdown("---")
    
    tab1, tab2, tab3, tab4 = st.tabs(["噪声数据", "气象数据", "投诉数据", "示例数据"])
    
    with tab1:
        st.subheader("噪声数据导入")
        st.write("支持多站点声级计CSV数据导入")
        
        col1, col2 = st.columns([1, 3])
        
        with col1:
            site_id_noise = st.text_input("站点编号 (可选)", key="noise_site_id")
            expected_interval = st.number_input(
                "预期采样间隔 (秒)", 
                min_value=1, 
                max_value=3600, 
                value=1,
                key="noise_interval"
            )
        
        with col2:
            noise_files = st.file_uploader(
                "上传噪声数据 CSV 文件",
                type=['csv'],
                accept_multiple_files=True,
                key="noise_uploader"
            )
        
        if noise_files:
            validator = ImportValidator()
            
            for uploaded_file in noise_files:
                try:
                    df = pd.read_csv(uploaded_file)
                    
                    actual_site_id = site_id_noise
                    if not actual_site_id and 'site_id' in df.columns:
                        site_ids = df['site_id'].dropna().unique()
                        if len(site_ids) > 0:
                            actual_site_id = str(site_ids[0])
                    
                    if not actual_site_id:
                        actual_site_id = f"SITE-{len(st.session_state.noise_data_dict) + 1:03d}"
                    
                    noise_data, validation_result = validator.validate_noise_dataframe(
                        df, 
                        site_id=actual_site_id,
                        expected_sampling_interval=expected_interval
                    )
                    
                    if noise_data:
                        st.session_state.noise_data_dict[actual_site_id] = noise_data
                        st.session_state.validation_results[f'noise_{actual_site_id}'] = validation_result
                        
                        st.success(f"✅ 成功导入站点 {actual_site_id}")
                        
                        with st.expander(f"站点 {actual_site_id} 数据概览"):
                            stats = noise_data.get_statistics()
                            col_a, col_b, col_c, col_d = st.columns(4)
                            col_a.metric("总记录数", stats.get('total_records', 0))
                            col_b.metric("有效记录", stats.get('valid_records', 0))
                            col_c.metric("缺失记录", stats.get('missing_records', 0))
                            col_d.metric("数据时长", f"{stats.get('start_time', 'N/A')} - {stats.get('end_time', 'N/A')}"[:50])
                        
                        if validation_result.warnings:
                            st.warning(f"⚠️ {len(validation_result.warnings)} 条警告")
                    
                except Exception as e:
                    st.error(f"❌ 导入失败: {str(e)}")
    
    with tab2:
        st.subheader("气象数据导入")
        st.write("支持气象站CSV数据导入")
        
        site_id_weather = st.text_input("站点编号 (可选)", key="weather_site_id")
        
        weather_files = st.file_uploader(
            "上传气象数据 CSV 文件",
            type=['csv'],
            accept_multiple_files=True,
            key="weather_uploader"
        )
        
        if weather_files:
            validator = ImportValidator()
            
            for uploaded_file in weather_files:
                try:
                    df = pd.read_csv(uploaded_file)
                    
                    actual_site_id = site_id_weather
                    if not actual_site_id and 'site_id' in df.columns:
                        site_ids = df['site_id'].dropna().unique()
                        if len(site_ids) > 0:
                            actual_site_id = str(site_ids[0])
                    
                    if not actual_site_id:
                        actual_site_id = f"W-{len(st.session_state.weather_data_dict) + 1:03d}"
                    
                    weather_data, validation_result = validator.validate_weather_dataframe(
                        df,
                        site_id=actual_site_id
                    )
                    
                    if weather_data:
                        st.session_state.weather_data_dict[actual_site_id] = weather_data
                        st.session_state.validation_results[f'weather_{actual_site_id}'] = validation_result
                        
                        st.success(f"✅ 成功导入站点 {actual_site_id}")
                        
                        with st.expander(f"站点 {actual_site_id} 数据概览"):
                            stats = {
                                '总记录数': weather_data.total_records,
                                '有效记录': weather_data.valid_records,
                                '开始时间': weather_data.start_time,
                                '结束时间': weather_data.end_time
                            }
                            st.json(stats)
                    
                except Exception as e:
                    st.error(f"❌ 导入失败: {str(e)}")
    
    with tab3:
        st.subheader("投诉数据导入")
        st.write("支持投诉清单CSV数据导入")
        
        complaint_file = st.file_uploader(
            "上传投诉数据 CSV 文件",
            type=['csv'],
            key="complaint_uploader"
        )
        
        if complaint_file:
            validator = ImportValidator()
            
            try:
                df = pd.read_csv(complaint_file)
                
                complaint_data, validation_result = validator.validate_complaint_dataframe(df)
                
                if complaint_data:
                    st.session_state.complaint_data = complaint_data
                    st.session_state.validation_results['complaints'] = validation_result
                    
                    st.success(f"✅ 成功导入 {complaint_data.total_complaints} 条投诉")
                    
                    with st.expander("投诉数据概览"):
                        stats = complaint_data.get_statistics()
                        col_a, col_b, col_c, col_d = st.columns(4)
                        col_a.metric("总投诉数", stats.get('total_complaints', 0))
                        col_b.metric("待复核", stats.get('pending_count', 0))
                        col_c.metric("已确认", stats.get('confirmed_count', 0))
                        col_d.metric("已驳回", stats.get('dismissed_count', 0))
                        
                        st.subheader("投诉列表")
                        complaint_df = complaint_data.get_dataframe()
                        if not complaint_df.empty:
                            st.dataframe(
                                complaint_df[['complaint_id', 'site_id', 'complaint_type', 
                                            'complaint_content', 'review_status', 'severity']],
                                use_container_width=True
                            )
                
            except Exception as e:
                st.error(f"❌ 导入失败: {str(e)}")
    
    with tab4:
        st.subheader("示例数据加载")
        st.write("快速加载示例数据进行测试")
        
        data_dir = Path(__file__).parent / 'data'
        
        if st.button("🚀 加载所有示例数据", type="primary"):
            validator = ImportValidator()
            
            noise_files = [
                data_dir / 'noise_site_001.csv',
                data_dir / 'noise_site_002.csv'
            ]
            
            for file_path in noise_files:
                if file_path.exists():
                    try:
                        df = pd.read_csv(file_path)
                        noise_data, _ = validator.validate_noise_dataframe(df)
                        if noise_data:
                            st.session_state.noise_data_dict[noise_data.site_id] = noise_data
                            st.success(f"✅ 加载噪声数据: {noise_data.site_id}")
                    except Exception as e:
                        st.error(f"❌ 加载失败: {str(e)}")
            
            weather_files = [
                data_dir / 'weather_site_001.csv',
                data_dir / 'weather_site_002.csv'
            ]
            
            for file_path in weather_files:
                if file_path.exists():
                    try:
                        df = pd.read_csv(file_path)
                        weather_data, _ = validator.validate_weather_dataframe(df)
                        if weather_data:
                            st.session_state.weather_data_dict[weather_data.site_id] = weather_data
                            st.success(f"✅ 加载气象数据: {weather_data.site_id}")
                    except Exception as e:
                        st.error(f"❌ 加载失败: {str(e)}")
            
            complaint_file = data_dir / 'complaints.csv'
            if complaint_file.exists():
                try:
                    df = pd.read_csv(complaint_file)
                    complaint_data, _ = validator.validate_complaint_dataframe(df)
                    if complaint_data:
                        st.session_state.complaint_data = complaint_data
                        st.success(f"✅ 加载投诉数据: {complaint_data.total_complaints} 条")
                except Exception as e:
                    st.error(f"❌ 加载失败: {str(e)}")
            
            st.rerun()
        
        st.markdown("---")
        st.subheader("📋 示例数据说明")
        st.info("""
        **噪声数据:**
        - SITE-001: 包含超标窗口、突增峰值和传感器离线时段
        - SITE-002: 包含超标窗口（无离线）
        
        **气象数据:**
        - SITE-001: 包含强风、降雨事件
        - SITE-002: 正常天气
        
        **投诉数据:**
        - CMPL-2026-001: SITE-001 夜间施工噪声（高危）
        - CMPL-2026-002: SITE-001 突增峰值（严重）
        - CMPL-2026-003: SITE-002 持续噪声（普通）
        """)
    
    st.markdown("---")
    
    col_clear1, col_clear2 = st.columns([1, 4])
    with col_clear1:
        if st.button("🗑️ 清除所有数据", type="secondary"):
            st.session_state.noise_data_dict = {}
            st.session_state.weather_data_dict = {}
            st.session_state.complaint_data = None
            st.session_state.analysis_result = None
            st.session_state.validation_results = {}
            st.rerun()


def render_analysis_tab():
    """渲染分析标签页"""
    st.header("🔍 数据分析")
    st.markdown("---")
    
    if not st.session_state.noise_data_dict:
        st.warning("⚠️ 请先导入噪声数据")
        return
    
    col_run1, col_run2 = st.columns([1, 4])
    with col_run1:
        if st.button("▶️ 开始分析", type="primary"):
            with st.spinner("正在分析数据..."):
                config = AnalysisConfig(
                    noise_threshold_daytime=st.session_state.analysis_config['noise_threshold_daytime'],
                    noise_threshold_nighttime=st.session_state.analysis_config['noise_threshold_nighttime'],
                    nighttime_start_hour=st.session_state.analysis_config['nighttime_start_hour'],
                    nighttime_end_hour=st.session_state.analysis_config['nighttime_end_hour'],
                    peak_threshold_increase=st.session_state.analysis_config['peak_threshold_increase'],
                    offline_threshold_seconds=st.session_state.analysis_config['offline_threshold_seconds'],
                    complaint_analysis_window_before=st.session_state.analysis_config['complaint_analysis_window_before'],
                    complaint_analysis_window_after=st.session_state.analysis_config['complaint_analysis_window_after']
                )
                
                analyzer = NoiseAnalyzer(config=config)
                
                result = analyzer.analyze_all(
                    noise_data_dict=st.session_state.noise_data_dict,
                    weather_data_dict=st.session_state.weather_data_dict,
                    complaint_data=st.session_state.complaint_data
                )
                
                st.session_state.analysis_result = result
                
                st.success("✅ 分析完成！")
    
    if not st.session_state.analysis_result:
        st.info("点击「开始分析」按钮执行数据分析")
        return
    
    result = st.session_state.analysis_result
    
    st.subheader("📊 分析概览")
    
    tab_stats, tab_anomalies, tab_evidence = st.tabs(["统计概览", "异常事件", "投诉证据"])
    
    with tab_stats:
        stats = result.statistics
        
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("总异常事件", stats.get('total_anomaly_events', 0))
        col2.metric("超标窗口", stats.get('total_over_threshold_windows', 0))
        col3.metric("突增峰值", stats.get('total_sudden_peaks', 0))
        col4.metric("传感器离线", stats.get('total_sensor_offlines', 0))
        
        st.markdown("---")
        
        st.subheader("各站点统计")
        site_stats = stats.get('site_statistics', {})
        
        if site_stats:
            site_data = []
            for site_id, s in site_stats.items():
                site_data.append({
                    '站点': site_id,
                    '超标窗口': s.get('over_threshold_windows', 0),
                    '突增峰值': s.get('sudden_peaks', 0),
                    '离线次数': s.get('sensor_offlines', 0),
                    '最大超标(dB)': s.get('max_exceedance', '-'),
                    '最大突增(dB)': s.get('max_peak_increase', '-')
                })
            
            st.dataframe(pd.DataFrame(site_data), use_container_width=True)
        
        st.markdown("---")
        
        st.subheader("投诉复核建议")
        rec_stats = stats.get('complaint_recommendations', {})
        if rec_stats:
            col_r1, col_r2, col_r3 = st.columns(3)
            col_r1.metric("建议确认", rec_stats.get('confirmed', 0))
            col_r2.metric("建议驳回", rec_stats.get('dismissed', 0))
            col_r3.metric("建议进一步核查", rec_stats.get('further_review', 0))
    
    with tab_anomalies:
        st.subheader("异常事件列表")
        
        anomaly_type_filter = st.selectbox(
            "筛选异常类型",
            ["全部", "噪声超标", "突增峰值", "传感器离线"],
            key="anomaly_type_filter"
        )
        
        filtered_anomalies = result.anomaly_events
        if anomaly_type_filter == "噪声超标":
            filtered_anomalies = [a for a in result.anomaly_events if a.event_type == AnomalyType.OVER_THRESHOLD]
        elif anomaly_type_filter == "突增峰值":
            filtered_anomalies = [a for a in result.anomaly_events if a.event_type == AnomalyType.SUDDEN_PEAK]
        elif anomaly_type_filter == "传感器离线":
            filtered_anomalies = [a for a in result.anomaly_events if a.event_type == AnomalyType.SENSOR_OFFLINE]
        
        if filtered_anomalies:
            anomaly_data = []
            for a in filtered_anomalies:
                severity_name = {
                    SeverityLevel.LOW: '低',
                    SeverityLevel.MEDIUM: '中',
                    SeverityLevel.HIGH: '高',
                    SeverityLevel.CRITICAL: '严重'
                }.get(a.severity, a.severity.value)
                
                type_name = {
                    AnomalyType.OVER_THRESHOLD: '噪声超标',
                    AnomalyType.SUDDEN_PEAK: '突增峰值',
                    AnomalyType.SENSOR_OFFLINE: '传感器离线',
                    AnomalyType.MISSING_DATA: '数据缺失',
                    AnomalyType.WEATHER_INTERFERENCE: '天气干扰'
                }.get(a.event_type, a.event_type.value)
                
                anomaly_data.append({
                    '事件ID': a.event_id,
                    '类型': type_name,
                    '站点': a.site_id,
                    '开始时间': a.start_time.strftime('%Y-%m-%d %H:%M:%S'),
                    '结束时间': a.end_time.strftime('%H:%M:%S'),
                    '严重程度': severity_name,
                    '描述': a.description,
                    '关联投诉': ', '.join(a.related_complaints) if a.related_complaints else '-'
                })
            
            st.dataframe(pd.DataFrame(anomaly_data), use_container_width=True)
        else:
            st.info("未发现异常事件")
    
    with tab_evidence:
        st.subheader("投诉证据分析")
        
        if not result.complaint_evidences:
            st.info("未加载投诉数据或无投诉证据")
            return
        
        for evidence in result.complaint_evidences:
            with st.expander(f"📋 投诉 {evidence.complaint_id} - {evidence.site_id}"):
                col_e1, col_e2 = st.columns(2)
                
                with col_e1:
                    st.write(f"**投诉时间:** {evidence.complaint_time.strftime('%Y-%m-%d %H:%M:%S')}")
                    st.write(f"**分析窗口:** {evidence.analysis_window_start.strftime('%H:%M:%S')} - {evidence.analysis_window_end.strftime('%H:%M:%S')}")
                
                with col_e2:
                    rec_color = {
                        'confirmed': '🔴 确认超标',
                        'dismissed': '🟢 建议驳回',
                        'further_review': '🟡 进一步核查'
                    }
                    st.write(f"**复核建议:** {rec_color.get(evidence.recommendation, evidence.recommendation)}")
                
                st.markdown("---")
                st.subheader("发现的问题")
                
                issues_found = []
                if evidence.has_exceedance:
                    issues_found.append(f"🔴 噪声超标: {evidence.exceedance_details.get('window_count', 0)}个窗口")
                if evidence.has_sudden_peak:
                    issues_found.append(f"🔴 突增峰值: {evidence.peak_details.get('peak_count', 0)}个峰值")
                if evidence.has_sensor_offline:
                    issues_found.append(f"🟡 传感器离线: {evidence.offline_details.get('offline_count', 0)}个时段")
                if evidence.has_weather_interference:
                    issues_found.append(f"🟡 天气干扰: 存在")
                
                if issues_found:
                    for issue in issues_found:
                        st.write(issue)
                else:
                    st.write("🟢 无明显异常")
                
                st.markdown("---")
                st.write(f"**证据摘要:** {evidence.summary}")


def render_visualization_tab():
    """渲染可视化标签页"""
    st.header("📈 数据可视化")
    st.markdown("---")
    
    if not st.session_state.noise_data_dict:
        st.warning("⚠️ 请先导入噪声数据")
        return
    
    sites = list(st.session_state.noise_data_dict.keys())
    
    col_sel1, col_sel2 = st.columns(2)
    
    with col_sel1:
        selected_site = st.selectbox("选择站点", sites, key="viz_site_selector")
    
    with col_sel2:
        chart_type = st.radio(
            "图表类型",
            ["时间轴图", "站点对比", "异常标记"],
            horizontal=True,
            key="viz_chart_type"
        )
    
    if chart_type == "时间轴图":
        render_timeline_chart(selected_site)
    elif chart_type == "站点对比":
        render_site_comparison(sites)
    elif chart_type == "异常标记":
        render_anomaly_markers(selected_site)


def render_timeline_chart(site_id: str):
    """渲染时间轴图"""
    st.subheader(f"📊 站点 {site_id} 噪声时间轴")
    
    noise_data = st.session_state.noise_data_dict.get(site_id)
    if not noise_data:
        return
    
    df = noise_data.get_dataframe()
    if df.empty:
        st.warning("无数据可显示")
        return
    
    fig = go.Figure()
    
    fig.add_trace(go.Scatter(
        x=df.index,
        y=df['laeq'],
        mode='lines',
        name='LAeq (等效声级)',
        line=dict(color='#1f77b4', width=1)
    ))
    
    if 'lmax' in df.columns:
        valid_lmax = df['lmax'].dropna()
        if len(valid_lmax) > 0:
            fig.add_trace(go.Scatter(
                x=df.index,
                y=df['lmax'],
                mode='lines',
                name='Lmax (最大声级)',
                line=dict(color='#ff7f0e', width=1, dash='dash')
            ))
    
    config = st.session_state.analysis_config
    is_night = lambda h: config['nighttime_start_hour'] <= h or h < config['nighttime_end_hour']
    
    threshold_series = []
    for idx in df.index:
        hour = idx.hour if hasattr(idx, 'hour') else idx.to_pydatetime().hour
        if is_night(hour):
            threshold_series.append(config['noise_threshold_nighttime'])
        else:
            threshold_series.append(config['noise_threshold_daytime'])
    
    fig.add_trace(go.Scatter(
        x=df.index,
        y=threshold_series,
        mode='lines',
        name='阈值',
        line=dict(color='#d62728', width=2, dash='dot')
    ))
    
    if st.session_state.analysis_result:
        result = st.session_state.analysis_result
        
        site_windows = [w for w in result.over_threshold_windows if w.site_id == site_id]
        for window in site_windows:
            fig.add_vrect(
                x0=window.start_time,
                x1=window.end_time,
                fillcolor="red",
                opacity=0.2,
                layer="below",
                line_width=0
            )
        
        site_peaks = [p for p in result.sudden_peaks if p.site_id == site_id]
        for peak in site_peaks:
            fig.add_vline(
                x=peak.timestamp,
                line_width=2,
                line_dash="dash",
                line_color="orange",
                annotation_text=f"峰值 +{peak.increase_amount:.0f}dB",
                annotation_position="top right"
            )
    
    fig.update_layout(
        title=f'站点 {site_id} 噪声监测数据',
        xaxis_title='时间',
        yaxis_title='声级 (dB)',
        height=500,
        hovermode='x unified'
    )
    
    st.plotly_chart(fig, use_container_width=True)
    
    weather_data = st.session_state.weather_data_dict.get(site_id)
    if weather_data:
        st.subheader(f"🌡️ 站点 {site_id} 气象数据")
        
        weather_df = weather_data.get_dataframe()
        
        if not weather_df.empty:
            fig_weather = make_subplots(rows=2, cols=1, shared_xaxes=True)
            
            if 'wind_speed' in weather_df.columns:
                fig_weather.add_trace(
                    go.Scatter(x=weather_df.index, y=weather_df['wind_speed'], name='风速 (m/s)'),
                    row=1, col=1
                )
            
            if 'rainfall' in weather_df.columns:
                fig_weather.add_trace(
                    go.Scatter(x=weather_df.index, y=weather_df['rainfall'], name='降雨 (mm)'),
                    row=2, col=1
                )
            
            fig_weather.update_layout(height=400, title_text='气象数据')
            st.plotly_chart(fig_weather, use_container_width=True)


def render_site_comparison(sites: List[str]):
    """渲染站点对比图"""
    st.subheader("📊 多站点噪声对比")
    
    if len(sites) < 2:
        st.info("需要至少2个站点数据才能进行对比")
        return
    
    selected_sites = st.multiselect(
        "选择要对比的站点",
        sites,
        default=sites[:min(2, len(sites))]
    )
    
    if not selected_sites:
        return
    
    fig = go.Figure()
    
    colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd']
    
    for idx, site_id in enumerate(selected_sites):
        noise_data = st.session_state.noise_data_dict.get(site_id)
        if not noise_data:
            continue
        
        df = noise_data.get_dataframe()
        if df.empty:
            continue
        
        color = colors[idx % len(colors)]
        
        fig.add_trace(go.Scatter(
            x=df.index,
            y=df['laeq'],
            mode='lines',
            name=f'{site_id} - LAeq',
            line=dict(color=color, width=1)
        ))
    
    fig.update_layout(
        title='多站点噪声对比',
        xaxis_title='时间',
        yaxis_title='声级 (dB)',
        height=500,
        hovermode='x unified'
    )
    
    st.plotly_chart(fig, use_container_width=True)
    
    if st.session_state.analysis_result:
        st.subheader("📋 站点异常统计对比")
        
        stats = st.session_state.analysis_result.statistics
        site_stats = stats.get('site_statistics', {})
        
        if site_stats:
            comparison_data = []
            for site_id in selected_sites:
                s = site_stats.get(site_id, {})
                comparison_data.append({
                    '站点': site_id,
                    '超标窗口': s.get('over_threshold_windows', 0),
                    '突增峰值': s.get('sudden_peaks', 0),
                    '离线次数': s.get('sensor_offlines', 0)
                })
            
            comparison_df = pd.DataFrame(comparison_data)
            st.dataframe(comparison_df, use_container_width=True)


def render_anomaly_markers(site_id: str):
    """渲染异常标记图"""
    st.subheader(f"🔍 站点 {site_id} 异常事件标记")
    
    if not st.session_state.analysis_result:
        st.info("请先执行数据分析")
        return
    
    result = st.session_state.analysis_result
    noise_data = st.session_state.noise_data_dict.get(site_id)
    
    if not noise_data:
        return
    
    df = noise_data.get_dataframe()
    if df.empty:
        return
    
    fig = go.Figure()
    
    fig.add_trace(go.Scatter(
        x=df.index,
        y=df['laeq'],
        mode='lines',
        name='LAeq',
        line=dict(color='#1f77b4', width=1)
    ))
    
    site_windows = [w for w in result.over_threshold_windows if w.site_id == site_id]
    for window in site_windows:
        fig.add_vrect(
            x0=window.start_time,
            x1=window.end_time,
            fillcolor="red",
            opacity=0.3,
            layer="below",
            line_width=0,
            annotation_text=f"超标 {window.max_value:.0f}dB",
            annotation_position="top left"
        )
    
    site_peaks = [p for p in result.sudden_peaks if p.site_id == site_id]
    for peak in site_peaks:
        fig.add_trace(go.Scatter(
            x=[peak.timestamp],
            y=[peak.peak_value],
            mode='markers',
            name=f'峰值 +{peak.increase_amount:.0f}dB',
            marker=dict(size=12, color='orange', symbol='star')
        ))
    
    site_offlines = [o for o in result.sensor_offline_periods if o.site_id == site_id]
    for offline in site_offlines:
        fig.add_vrect(
            x0=offline.start_time,
            x1=offline.end_time,
            fillcolor="gray",
            opacity=0.4,
            layer="below",
            line_width=0,
            annotation_text=f"离线 {offline.duration_minutes:.0f}分钟",
            annotation_position="bottom left"
        )
    
    fig.update_layout(
        title=f'站点 {site_id} 异常事件标记',
        xaxis_title='时间',
        yaxis_title='声级 (dB)',
        height=600,
        hovermode='x unified'
    )
    
    st.plotly_chart(fig, use_container_width=True)
    
    st.markdown("---")
    st.subheader("📋 异常事件详情")
    
    tab_windows, tab_peaks, tab_offlines = st.tabs(["超标窗口", "突增峰值", "离线时段"])
    
    with tab_windows:
        if site_windows:
            window_data = []
            for w in site_windows:
                window_data.append({
                    '窗口ID': w.window_id,
                    '开始时间': w.start_time.strftime('%Y-%m-%d %H:%M:%S'),
                    '结束时间': w.end_time.strftime('%H:%M:%S'),
                    '时长(分钟)': f"{w.duration_minutes:.1f}",
                    '阈值(dB)': f"{w.threshold:.1f}",
                    '最大值(dB)': f"{w.max_value:.1f}",
                    '平均值(dB)': f"{w.mean_value:.1f}",
                    '关联投诉': ', '.join(w.related_complaints) if w.related_complaints else '-'
                })
            st.dataframe(pd.DataFrame(window_data), use_container_width=True)
        else:
            st.info("该站点无超标窗口")
    
    with tab_peaks:
        if site_peaks:
            peak_data = []
            for p in site_peaks:
                peak_data.append({
                    '峰值ID': p.peak_id,
                    '时间': p.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                    '峰值(dB)': f"{p.peak_value:.1f}",
                    '基线(dB)': f"{p.baseline_value:.1f}",
                    '突增量(dB)': f"{p.increase_amount:.1f}",
                    '持续时间(秒)': f"{p.duration_seconds:.1f}"
                })
            st.dataframe(pd.DataFrame(peak_data), use_container_width=True)
        else:
            st.info("该站点无突增峰值")
    
    with tab_offlines:
        if site_offlines:
            offline_data = []
            for o in site_offlines:
                offline_data.append({
                    '时段ID': o.period_id,
                    '开始时间': o.start_time.strftime('%Y-%m-%d %H:%M:%S'),
                    '结束时间': o.end_time.strftime('%H:%M:%S'),
                    '时长(分钟)': f"{o.duration_minutes:.1f}",
                    '缺失采样数': o.missing_count
                })
            st.dataframe(pd.DataFrame(offline_data), use_container_width=True)
        else:
            st.info("该站点无传感器离线时段")


def render_review_tab():
    """渲染复核标签页"""
    st.header("✅ 人工复核")
    st.markdown("---")
    
    if not st.session_state.complaint_data or not st.session_state.analysis_result:
        st.warning("⚠️ 请先导入投诉数据并执行分析")
        return
    
    result = st.session_state.analysis_result
    complaints = st.session_state.complaint_data.records
    
    if not st.session_state.review_state:
        st.session_state.review_state = ReviewState(
            state_id=f"REV-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            created_at=datetime.now(),
            updated_at=datetime.now(),
            noise_data_sites=list(st.session_state.noise_data_dict.keys()),
            weather_data_sites=list(st.session_state.weather_data_dict.keys())
        )
    
    review_state = st.session_state.review_state
    
    col_filter1, col_filter2 = st.columns(2)
    
    with col_filter1:
        status_filter = st.selectbox(
            "筛选复核状态",
            ["全部", "待复核", "复核中", "已确认", "已驳回", "存疑"],
            key="review_status_filter"
        )
    
    with col_filter2:
        site_filter = st.selectbox(
            "筛选站点",
            ["全部"] + list(st.session_state.noise_data_dict.keys()),
            key="review_site_filter"
        )
    
    filtered_complaints = complaints
    
    if status_filter != "全部":
        status_map = {
            "待复核": "pending",
            "复核中": "reviewing",
            "已确认": "confirmed",
            "已驳回": "dismissed",
            "存疑": "uncertain"
        }
        target_status = status_map.get(status_filter)
        if target_status:
            filtered_complaints = [
                c for c in filtered_complaints 
                if review_state.get_complaint_review(c.complaint_id) and 
                review_state.get_complaint_review(c.complaint_id).get('status') == target_status
            ]
    
    if site_filter != "全部":
        filtered_complaints = [c for c in filtered_complaints if c.site_id == site_filter]
    
    if not filtered_complaints:
        st.info("没有符合筛选条件的投诉")
        return
    
    for complaint in filtered_complaints:
        evidence = result.get_evidence_for_complaint(complaint.complaint_id)
        existing_review = review_state.get_complaint_review(complaint.complaint_id)
        
        status_badge = {
            'pending': '⏳ 待复核',
            'reviewing': '🔄 复核中',
            'confirmed': '✅ 已确认',
            'dismissed': '❌ 已驳回',
            'uncertain': '❓ 存疑'
        }
        
        current_status = existing_review.get('status', 'pending') if existing_review else 'pending'
        
        with st.expander(
            f"📋 {complaint.complaint_id} - {complaint.site_id} | {status_badge.get(current_status, current_status)}",
            expanded=True
        ):
            col_info1, col_info2 = st.columns(2)
            
            with col_info1:
                st.write(f"**投诉时间:** {complaint.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
                st.write(f"**投诉人:** {complaint.complainant_name or '匿名'}")
                st.write(f"**严重程度:** {complaint.severity}")
            
            with col_info2:
                st.write(f"**关联站点:** {complaint.site_id}")
                st.write(f"**投诉类型:** {complaint.complaint_type}")
                if complaint.expected_noise_source:
                    st.write(f"**投诉人认为的噪声源:** {complaint.expected_noise_source}")
            
            st.markdown("---")
            st.subheader("📝 投诉内容")
            st.info(complaint.complaint_content or "无详细描述")
            
            if evidence:
                st.markdown("---")
                st.subheader("🔍 分析证据")
                
                col_ev1, col_ev2, col_ev3, col_ev4 = st.columns(4)
                col_ev1.metric("噪声超标", "是" if evidence.has_exceedance else "否")
                col_ev2.metric("突增峰值", "是" if evidence.has_sudden_peak else "否")
                col_ev3.metric("传感器离线", "是" if evidence.has_sensor_offline else "否")
                col_ev4.metric("天气干扰", "是" if evidence.has_weather_interference else "否")
                
                st.write(f"**证据摘要:** {evidence.summary}")
                
                rec_text = {
                    'confirmed': '🔴 建议确认 - 存在明确的噪声超标证据',
                    'dismissed': '🟢 建议驳回 - 未发现明显噪声异常或存在天气干扰',
                    'further_review': '🟡 建议进一步核查 - 存在离线时段或天气干扰，需现场核实'
                }
                st.write(f"**系统建议:** {rec_text.get(evidence.recommendation, evidence.recommendation)}")
            
            st.markdown("---")
            st.subheader("✅ 复核操作")
            
            col_rev1, col_rev2 = st.columns(2)
            
            with col_rev1:
                new_status = st.selectbox(
                    "复核状态",
                    ["pending", "reviewing", "confirmed", "dismissed", "uncertain"],
                    format_func=lambda x: status_badge.get(x, x),
                    index=["pending", "reviewing", "confirmed", "dismissed", "uncertain"].index(current_status),
                    key=f"status_{complaint.complaint_id}"
                )
            
            with col_rev2:
                reviewer = st.text_input(
                    "复核人",
                    value=existing_review.get('reviewer_name', '') if existing_review else '',
                    key=f"reviewer_{complaint.complaint_id}"
                )
            
            review_notes = st.text_area(
                "复核备注",
                value=existing_review.get('notes', '') if existing_review else '',
                height=100,
                key=f"notes_{complaint.complaint_id}"
            )
            
            col_btn1, col_btn2, col_btn3 = st.columns([1, 1, 3])
            
            with col_btn1:
                if st.button("💾 保存", key=f"save_{complaint.complaint_id}"):
                    review_state.update_complaint_review(
                        complaint_id=complaint.complaint_id,
                        status=new_status,
                        notes=review_notes,
                        reviewer_name=reviewer if reviewer else None,
                        is_verified=new_status in ['confirmed', 'dismissed'],
                        evidence_summary=evidence.summary if evidence else ''
                    )
                    st.success("✅ 复核状态已保存")
            
            with col_btn2:
                if st.button("📊 查看详情", key=f"detail_{complaint.complaint_id}"):
                    st.session_state.selected_complaint = complaint.complaint_id
    
    st.markdown("---")
    
    col_save1, col_save2 = st.columns([1, 4])
    
    with col_save1:
        if st.button("💾 保存整个复核状态", type="primary"):
            try:
                file_path = st.session_state.state_manager.save_state(review_state)
                st.success(f"✅ 复核状态已保存到: {file_path}")
            except Exception as e:
                st.error(f"❌ 保存失败: {str(e)}")


def render_export_tab():
    """渲染导出标签页"""
    st.header("📤 报告导出")
    st.markdown("---")
    
    if not st.session_state.analysis_result:
        st.warning("⚠️ 请先执行数据分析")
        return
    
    result = st.session_state.analysis_result
    review_state = st.session_state.review_state
    
    exporter = ReportExporter()
    
    tab_md, tab_csv, tab_json = st.tabs(["Markdown报告", "CSV事件表", "JSON审计包"])
    
    with tab_md:
        st.subheader("📄 Markdown复核报告")
        
        include_evidence = st.checkbox("包含详细证据", value=True, key="md_include_evidence")
        
        if st.button("📄 生成报告", type="primary", key="generate_md"):
            with st.spinner("正在生成报告..."):
                markdown_content = exporter.generate_markdown_report(
                    analysis_result=result,
                    review_state=review_state,
                    include_evidence=include_evidence
                )
                
                st.download_button(
                    label="📥 下载 Markdown 报告",
                    data=markdown_content,
                    file_name=f"noise_review_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md",
                    mime="text/markdown",
                    key="download_md"
                )
                
                with st.expander("预览报告"):
                    st.markdown(markdown_content)
    
    with tab_csv:
        st.subheader("📊 CSV异常事件表")
        
        if st.button("📊 导出事件表", type="primary", key="generate_csv"):
            with st.spinner("正在导出..."):
                csv_content = exporter.export_events_to_csv(result)
                
                st.download_button(
                    label="📥 下载 CSV 事件表",
                    data=csv_content,
                    file_name=f"anomaly_events_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                    mime="text/csv",
                    key="download_csv"
                )
                
                with st.expander("预览数据"):
                    from io import StringIO
                    preview_df = pd.read_csv(StringIO(csv_content))
                    st.dataframe(preview_df, use_container_width=True)
    
    with tab_json:
        st.subheader("📦 JSON审计包")
        
        include_review = st.checkbox("包含复核状态", value=True, key="json_include_review")
        
        if st.button("📦 导出审计包", type="primary", key="generate_json"):
            with st.spinner("正在导出..."):
                json_content = exporter.export_audit_package(
                    analysis_result=result,
                    review_state=review_state if include_review else None
                )
                
                st.download_button(
                    label="📥 下载 JSON 审计包",
                    data=json_content,
                    file_name=f"audit_package_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                    mime="application/json",
                    key="download_json"
                )
                
                with st.expander("预览数据"):
                    st.json(json.loads(json_content))
    
    st.markdown("---")
    st.subheader("💾 复核状态管理")
    
    saved_states = st.session_state.state_manager.list_saved_states()
    
    if saved_states:
        st.write(f"已保存 {len(saved_states)} 个复核状态:")
        
        for state_info in saved_states[:5]:
            col_s1, col_s2, col_s3 = st.columns([2, 2, 1])
            with col_s1:
                st.write(f"**{state_info['state_id']}**")
            with col_s2:
                st.write(f"更新时间: {state_info['updated_at']}")
            with col_s3:
                if st.button("加载", key=f"load_{state_info['state_id']}"):
                    loaded_state = st.session_state.state_manager.load_state(state_info['state_id'])
                    if loaded_state:
                        st.session_state.review_state = loaded_state
                        st.success("✅ 状态已加载")
                        st.rerun()
    else:
        st.info("暂无保存的复核状态")


def main():
    """主函数"""
    st.set_page_config(
        page_title="施工噪声投诉复核台",
        page_icon="🔊",
        layout="wide",
        initial_sidebar_state="expanded"
    )
    
    init_session_state()
    
    render_sidebar()
    
    tab_names = [
        "📥 数据导入",
        "🔍 数据分析",
        "📈 数据可视化",
        "✅ 人工复核",
        "📤 报告导出"
    ]
    
    active_tab = st.tabs(tab_names)
    
    with active_tab[0]:
        render_import_tab()
    
    with active_tab[1]:
        render_analysis_tab()
    
    with active_tab[2]:
        render_visualization_tab()
    
    with active_tab[3]:
        render_review_tab()
    
    with active_tab[4]:
        render_export_tab()


if __name__ == '__main__':
    main()
