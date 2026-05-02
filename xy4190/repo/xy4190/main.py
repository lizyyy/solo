"""温控偏航复盘板 - 疫苗冷链质控数据分析可视化应用"""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import tempfile
import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any

from app.data_parser import DataParser, TemperatureRecord, DoorEvent, CalibrationRecord, BatchRecord
from app.metrics import MetricsCalculator, TemperatureMetrics, DoorMetrics, BatchExposureMetrics
from app.rules_engine import RulesEngine, RuleConfig, AnomalySegment, AnomalyType, AnomalySeverity
from app.state_store import StateStore
from app.import_export import ReportGenerator, AnomalyCSVExporter, AuditPackageExporter
from app.sample_data import SampleDataGenerator, create_sample_data


st.set_page_config(
    page_title="温控偏航复盘板",
    page_icon="🌡️",
    layout="wide",
    initial_sidebar_state="expanded"
)


SEVERITY_COLORS = {
    'low': '#22c55e',
    'medium': '#eab308',
    'high': '#f97316',
    'critical': '#ef4444'
}

SEVERITY_NAMES = {
    'low': '一般',
    'medium': '中等',
    'high': '高危',
    'critical': '严重'
}

ANOMALY_TYPE_NAMES = {
    'over_temperature': '超温',
    'under_temperature': '低温',
    'continuous_overtemp': '连续超温',
    'continuous_undertemp': '连续低温',
    'missing_data': '数据缺失',
    'rapid_change': '温度骤变',
    'door_open_too_long': '长时间开门',
    'sensor_drift': '探头漂移'
}


def init_session_state():
    """初始化会话状态"""
    if 'session_id' not in st.session_state:
        st.session_state.session_id = str(uuid.uuid4())[:8]
    
    if 'parsed_data' not in st.session_state:
        st.session_state.parsed_data = None
    
    if 'analysis_results' not in st.session_state:
        st.session_state.analysis_results = None
    
    if 'anomalies' not in st.session_state:
        st.session_state.anomalies = []
    
    if 'metrics' not in st.session_state:
        st.session_state.metrics = None
    
    if 'rule_config' not in st.session_state:
        st.session_state.rule_config = RuleConfig()
    
    if 'selected_device' not in st.session_state:
        st.session_state.selected_device = None
    
    if 'sample_data_loaded' not in st.session_state:
        st.session_state.sample_data_loaded = False
    
    if 'reviewed_anomalies' not in st.session_state:
        st.session_state.reviewed_anomalies = {}


def load_sample_data():
    """加载示例数据"""
    generator = SampleDataGenerator()
    sample_data = generator.generate_all_sample_data()
    
    parser = DataParser()
    
    with tempfile.TemporaryDirectory() as tmpdir:
        for device_id, df in sample_data['temperature_files'].items():
            file_path = Path(tmpdir) / f"{device_id}.csv"
            df.to_csv(file_path, index=False)
            parser.parse_temperature_csv(str(file_path), device_id=device_id)
        
        door_file = Path(tmpdir) / "door_events.json"
        with open(door_file, 'w', encoding='utf-8') as f:
            import json
            json.dump({'events': sample_data['door_events']}, f)
        parser.parse_door_events_json(str(door_file))
        
        cal_file = Path(tmpdir) / "calibration.json"
        with open(cal_file, 'w', encoding='utf-8') as f:
            import json
            json.dump(sample_data['calibration_records'], f)
        parser.parse_calibration_json(str(cal_file))
        
        batch_file = Path(tmpdir) / "batches.csv"
        sample_data['batch_records'].to_csv(batch_file, index=False)
        parser.parse_batch_csv(str(batch_file))
    
    st.session_state.parsed_data = parser.get_all_data()
    st.session_state.sample_data_loaded = True
    
    run_analysis()


def run_analysis():
    """运行完整分析"""
    if st.session_state.parsed_data is None:
        st.error("请先导入数据")
        return
    
    config = st.session_state.rule_config
    rules_engine = RulesEngine(config)
    metrics_calc = MetricsCalculator()
    
    rules_results = rules_engine.run_all_checks(
        st.session_state.parsed_data,
        apply_calibration=True
    )
    
    anomalies = rules_results['anomalies']
    
    metrics = metrics_calc.calculate_all_metrics(
        st.session_state.parsed_data,
        anomalies
    )
    
    device_ids = list(st.session_state.parsed_data.get('temperature_records', {}).keys())
    anomaly_counts = {}
    for device_id in device_ids:
        count = sum(1 for a in anomalies if a.device_id == device_id)
        anomaly_counts[device_id] = count
    
    device_ranking = metrics_calc.rank_devices(
        metrics['temperature_metrics'],
        metrics['door_metrics'],
        anomaly_counts
    )
    
    st.session_state.analysis_results = {
        'anomalies': anomalies,
        'metrics': metrics,
        'device_ranking': device_ranking,
        'config': config,
        'calibration_offsets': rules_results.get('calibration_offsets', {})
    }
    
    st.session_state.anomalies = anomalies
    st.session_state.metrics = metrics
    
    if device_ids:
        st.session_state.selected_device = device_ids[0]


def upload_data_files():
    """上传数据文件"""
    st.markdown("### 📁 数据导入")
    
    tab1, tab2 = st.tabs(["文件上传", "示例数据"])
    
    with tab1:
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.markdown("**温度记录 (CSV)**")
            temp_files = st.file_uploader(
                "选择温度CSV文件",
                type=['csv'],
                accept_multiple_files=True,
                key="temp_upload"
            )
        
        with col2:
            st.markdown("**开门事件 (JSON)**")
            door_file = st.file_uploader(
                "选择开门事件JSON文件",
                type=['json'],
                key="door_upload"
            )
        
        with col3:
            st.markdown("**校准证书 (JSON)**")
            cal_file = st.file_uploader(
                "选择校准证书JSON文件",
                type=['json'],
                key="cal_upload"
            )
        
        with col4:
            st.markdown("**运输批次 (CSV)**")
            batch_file = st.file_uploader(
                "选择运输批次CSV文件",
                type=['csv'],
                key="batch_upload"
            )
        
        if st.button("开始导入", type="primary"):
            parser = DataParser()
            
            with tempfile.TemporaryDirectory() as tmpdir:
                if temp_files:
                    for i, uploaded_file in enumerate(temp_files):
                        file_path = Path(tmpdir) / f"temp_{i}.csv"
                        with open(file_path, 'wb') as f:
                            f.write(uploaded_file.getbuffer())
                        try:
                            parser.parse_temperature_csv(str(file_path))
                        except Exception as e:
                            st.error(f"解析温度文件 {uploaded_file.name} 失败: {e}")
                
                if door_file:
                    file_path = Path(tmpdir) / "door.json"
                    with open(file_path, 'wb') as f:
                        f.write(door_file.getbuffer())
                    try:
                        parser.parse_door_events_json(str(file_path))
                    except Exception as e:
                        st.error(f"解析开门事件失败: {e}")
                
                if cal_file:
                    file_path = Path(tmpdir) / "cal.json"
                    with open(file_path, 'wb') as f:
                        f.write(cal_file.getbuffer())
                    try:
                        parser.parse_calibration_json(str(file_path))
                    except Exception as e:
                        st.error(f"解析校准证书失败: {e}")
                
                if batch_file:
                    file_path = Path(tmpdir) / "batch.csv"
                    with open(file_path, 'wb') as f:
                        f.write(batch_file.getbuffer())
                    try:
                        parser.parse_batch_csv(str(file_path))
                    except Exception as e:
                        st.error(f"解析运输批次失败: {e}")
            
            parsed = parser.get_all_data()
            if parsed.get('temperature_records'):
                st.session_state.parsed_data = parsed
                st.session_state.sample_data_loaded = False
                st.success(f"成功导入数据: {len(parsed['temperature_records'])} 台设备, {len(parsed.get('door_events', []))} 个开门事件")
            else:
                st.warning("未导入任何温度记录数据")
    
    with tab2:
        st.markdown("""
        **快速测试示例数据**
        
        点击下方按钮加载预设的示例数据，包含：
        - 3台冰箱的24小时温度记录（含异常）
        - 开门事件记录
        - 校准证书
        - 运输批次记录
        """)
        
        if st.button("加载示例数据", type="secondary"):
            load_sample_data()
            st.success("示例数据已加载！")


def configure_rules():
    """规则配置面板"""
    st.markdown("### ⚙️ 规则配置")
    
    config = st.session_state.rule_config
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("#### 温度阈值")
        config.upper_temp_threshold = st.number_input(
            "温度上限 (°C)",
            value=config.upper_temp_threshold,
            min_value=-50.0,
            max_value=50.0,
            step=0.5,
            key="upper_threshold"
        )
        
        config.lower_temp_threshold = st.number_input(
            "温度下限 (°C)",
            value=config.lower_temp_threshold,
            min_value=-50.0,
            max_value=50.0,
            step=0.5,
            key="lower_threshold"
        )
        
        st.markdown("#### 数据质量规则")
        config.missing_data_threshold_minutes = st.number_input(
            "数据缺失判定阈值 (分钟)",
            value=config.missing_data_threshold_minutes,
            min_value=5,
            max_value=120,
            step=5,
            key="missing_threshold"
        )
        
        config.rapid_change_threshold = st.number_input(
            "温度骤变阈值 (°C)",
            value=config.rapid_change_threshold,
            min_value=0.5,
            max_value=10.0,
            step=0.5,
            key="rapid_threshold"
        )
    
    with col2:
        st.markdown("#### 连续异常窗口")
        config.continuous_overtemp_window_minutes = st.number_input(
            "连续超温判定窗口 (分钟)",
            value=config.continuous_overtemp_window_minutes,
            min_value=5,
            max_value=120,
            step=5,
            key="continuous_overtemp"
        )
        
        config.continuous_undertemp_window_minutes = st.number_input(
            "连续低温判定窗口 (分钟)",
            value=config.continuous_undertemp_window_minutes,
            min_value=5,
            max_value=120,
            step=5,
            key="continuous_undertemp"
        )
        
        st.markdown("#### 开门规则")
        config.long_door_opening_seconds = st.number_input(
            "长时间开门判定阈值 (秒)",
            value=config.long_door_opening_seconds,
            min_value=30,
            max_value=600,
            step=10,
            key="long_door"
        )
        
        st.markdown("#### 探头漂移")
        config.sensor_drift_threshold = st.number_input(
            "探头漂移阈值 (°C)",
            value=config.sensor_drift_threshold,
            min_value=0.1,
            max_value=2.0,
            step=0.1,
            key="drift_threshold"
        )
    
    st.session_state.rule_config = config


def show_dashboard():
    """显示总览仪表盘"""
    if st.session_state.analysis_results is None:
        st.info("请先导入数据并运行分析")
        return
    
    results = st.session_state.analysis_results
    anomalies = results['anomalies']
    metrics = results['metrics']
    device_ranking = results['device_ranking']
    
    st.markdown("### 📊 分析总览")
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        total_anomalies = len(anomalies)
        st.metric(
            "异常事件总数",
            total_anomalies,
            delta=None
        )
    
    with col2:
        critical_count = sum(1 for a in anomalies 
                            if (isinstance(a.severity, AnomalySeverity) and a.severity == AnomalySeverity.CRITICAL) or
                               (isinstance(a.severity, str) and a.severity == 'critical'))
        high_count = sum(1 for a in anomalies 
                        if (isinstance(a.severity, AnomalySeverity) and a.severity == AnomalySeverity.HIGH) or
                           (isinstance(a.severity, str) and a.severity == 'high'))
        
        st.metric(
            "高危/严重异常",
            f"{critical_count + high_count}",
            delta=f"严重:{critical_count} 高危:{high_count}"
        )
    
    with col3:
        device_count = len(metrics.get('temperature_metrics', {}))
        st.metric(
            "监控设备数",
            device_count
        )
    
    with col4:
        reviewed_count = sum(1 for a in anomalies if a.reviewed)
        st.metric(
            "已复核异常",
            f"{reviewed_count}/{len(anomalies)}",
            delta=f"完成率: {reviewed_count/len(anomalies)*100:.1f}%" if anomalies else "0%"
        )
    
    st.markdown("---")
    
    tab1, tab2, tab3 = st.tabs(["设备排行", "异常统计", "批次风险"])
    
    with tab1:
        st.markdown("#### 设备综合评分排行")
        if not device_ranking.empty:
            display_cols = ['rank', 'device_id', 'score', 'issues_count', 'issues', 'anomaly_count']
            rename_cols = {
                'rank': '排名',
                'device_id': '设备ID',
                'score': '评分',
                'issues_count': '问题数',
                'issues': '问题描述',
                'anomaly_count': '异常数'
            }
            
            display_df = device_ranking[display_cols].rename(columns=rename_cols)
            st.dataframe(display_df, use_container_width=True)
    
    with tab2:
        st.markdown("#### 异常类型分布")
        
        anomaly_stats = {}
        for a in anomalies:
            atype = a.anomaly_type.value if isinstance(a.anomaly_type, AnomalyType) else str(a.anomaly_type)
            severity = a.severity.value if isinstance(a.severity, AnomalySeverity) else str(a.severity)
            
            if atype not in anomaly_stats:
                anomaly_stats[atype] = {'low': 0, 'medium': 0, 'high': 0, 'critical': 0, 'total': 0}
            
            anomaly_stats[atype][severity] += 1
            anomaly_stats[atype]['total'] += 1
        
        if anomaly_stats:
            stats_rows = []
            for atype, stats in anomaly_stats.items():
                stats_rows.append({
                    '异常类型': ANOMALY_TYPE_NAMES.get(atype, atype),
                    '一般': stats['low'],
                    '中等': stats['medium'],
                    '高危': stats['high'],
                    '严重': stats['critical'],
                    '合计': stats['total']
                })
            
            stats_df = pd.DataFrame(stats_rows)
            st.dataframe(stats_df, use_container_width=True)
    
    with tab3:
        st.markdown("#### 批次暴露风险")
        batch_metrics = metrics.get('batch_metrics', {})
        
        if batch_metrics:
            batch_rows = []
            for batch_id, bm in batch_metrics.items():
                batch_rows.append({
                    '批次号': batch_id,
                    '产品名称': bm.product_name if isinstance(bm, BatchExposureMetrics) else bm.get('product_name', ''),
                    '设备ID': bm.device_id if isinstance(bm, BatchExposureMetrics) else bm.get('device_id', ''),
                    '总时长(分钟)': round((bm.total_exposure_duration_seconds if isinstance(bm, BatchExposureMetrics) else bm.get('total_exposure_duration_seconds', 0)) / 60, 1),
                    '开门暴露(分钟)': round((bm.exposure_during_open_doors_seconds if isinstance(bm, BatchExposureMetrics) else bm.get('exposure_during_open_doors_seconds', 0)) / 60, 1),
                    '异常暴露(分钟)': round((bm.exposure_during_temperature_anomalies_seconds if isinstance(bm, BatchExposureMetrics) else bm.get('exposure_during_temperature_anomalies_seconds', 0)) / 60, 1),
                    '风险等级': bm.risk_level.upper() if isinstance(bm, BatchExposureMetrics) else bm.get('risk_level', 'normal').upper()
                })
            
            batch_df = pd.DataFrame(batch_rows)
            st.dataframe(batch_df, use_container_width=True)


def show_temperature_timeline():
    """显示温度时间轴"""
    if st.session_state.analysis_results is None:
        st.info("请先导入数据并运行分析")
        return
    
    parsed_data = st.session_state.parsed_data
    results = st.session_state.analysis_results
    anomalies = results['anomalies']
    config = st.session_state.rule_config
    
    device_ids = list(parsed_data.get('temperature_records', {}).keys())
    
    if not device_ids:
        st.warning("没有可用的设备数据")
        return
    
    st.markdown("### 🌡️ 温度时间轴")
    
    col1, col2 = st.columns([1, 3])
    
    with col1:
        selected_device = st.selectbox(
            "选择设备",
            device_ids,
            index=device_ids.index(st.session_state.selected_device) if st.session_state.selected_device in device_ids else 0,
            key="timeline_device"
        )
        st.session_state.selected_device = selected_device
    
    record = parsed_data['temperature_records'][selected_device]
    device_anomalies = [a for a in anomalies if a.device_id == selected_device]
    
    door_events = parsed_data.get('door_events', [])
    device_door_events = [e for e in door_events if e.device_id == selected_device]
    
    fig = go.Figure()
    
    fig.add_trace(go.Scatter(
        x=record.timestamps,
        y=record.temperatures,
        mode='lines',
        name='温度',
        line=dict(color='#3b82f6', width=1.5)
    ))
    
    fig.add_hline(
        y=config.upper_temp_threshold,
        line_dash="dash",
        line_color=SEVERITY_COLORS['high'],
        annotation_text=f"上限 {config.upper_temp_threshold}°C",
        annotation_position="top right"
    )
    
    fig.add_hline(
        y=config.lower_temp_threshold,
        line_dash="dash",
        line_color=SEVERITY_COLORS['high'],
        annotation_text=f"下限 {config.lower_temp_threshold}°C",
        annotation_position="bottom right"
    )
    
    for anomaly in device_anomalies:
        atype = anomaly.anomaly_type.value if isinstance(anomaly.anomaly_type, AnomalyType) else str(anomaly.anomaly_type)
        severity = anomaly.severity.value if isinstance(anomaly.severity, AnomalySeverity) else str(anomaly.severity)
        
        if atype in ['over_temperature', 'under_temperature', 'continuous_overtemp', 'continuous_undertemp']:
            if anomaly.start_time and anomaly.end_time:
                color = SEVERITY_COLORS.get(severity, SEVERITY_COLORS['low'])
                
                fig.add_vrect(
                    x0=anomaly.start_time,
                    x1=anomaly.end_time,
                    fillcolor=color,
                    opacity=0.2,
                    layer="below",
                    line_width=0,
                    annotation_text=f"{ANOMALY_TYPE_NAMES.get(atype, atype)}",
                    annotation_position="top left"
                )
    
    for event in device_door_events:
        if event.open_time:
            end_time = event.close_time or (event.open_time + timedelta(seconds=event.duration_seconds or 60))
            
            fig.add_vrect(
                x0=event.open_time,
                x1=end_time,
                fillcolor='#8b5cf6',
                opacity=0.3,
                layer="below",
                line_width=1,
                line_color='#7c3aed',
                annotation_text="开门",
                annotation_position="bottom left"
            )
    
    fig.update_layout(
        title=f"设备 {selected_device} 温度时间轴",
        xaxis_title="时间",
        yaxis_title="温度 (°C)",
        height=500,
        showlegend=True,
        hovermode="x unified"
    )
    
    st.plotly_chart(fig, use_container_width=True)
    
    st.markdown("---")
    st.markdown("#### 📋 该设备异常列表")
    
    if device_anomalies:
        anomaly_rows = []
        for a in device_anomalies:
            atype = a.anomaly_type.value if isinstance(a.anomaly_type, AnomalyType) else str(a.anomaly_type)
            severity = a.severity.value if isinstance(a.severity, AnomalySeverity) else str(a.severity)
            
            anomaly_rows.append({
                '异常ID': a.anomaly_id,
                '类型': ANOMALY_TYPE_NAMES.get(atype, atype),
                '严重程度': SEVERITY_NAMES.get(severity, severity),
                '开始时间': a.start_time.strftime('%Y-%m-%d %H:%M') if a.start_time else '',
                '结束时间': a.end_time.strftime('%Y-%m-%d %H:%M') if a.end_time else '',
                '持续(分钟)': round(a.duration_seconds / 60, 1),
                '描述': a.description,
                '已复核': '是' if a.reviewed else '否'
            })
        
        anomaly_df = pd.DataFrame(anomaly_rows)
        st.dataframe(anomaly_df, use_container_width=True)
    else:
        st.info("该设备无异常")


def show_anomaly_review():
    """异常复核面板"""
    if st.session_state.analysis_results is None:
        st.info("请先导入数据并运行分析")
        return
    
    anomalies = st.session_state.anomalies
    
    if not anomalies:
        st.info("暂无异常需要复核")
        return
    
    st.markdown("### ✅ 异常复核")
    
    col1, col2 = st.columns([1, 2])
    
    with col1:
        severity_filter = st.multiselect(
            "严重程度筛选",
            options=['critical', 'high', 'medium', 'low'],
            default=['critical', 'high', 'medium', 'low'],
            format_func=lambda x: SEVERITY_NAMES.get(x, x)
        )
        
        reviewed_filter = st.radio(
            "复核状态",
            options=["全部", "未复核", "已复核"],
            horizontal=True
        )
    
    filtered_anomalies = anomalies
    
    if severity_filter:
        filtered_anomalies = [
            a for a in filtered_anomalies
            if (isinstance(a.severity, AnomalySeverity) and a.severity.value in severity_filter) or
               (isinstance(a.severity, str) and a.severity in severity_filter)
        ]
    
    if reviewed_filter == "未复核":
        filtered_anomalies = [a for a in filtered_anomalies if not a.reviewed]
    elif reviewed_filter == "已复核":
        filtered_anomalies = [a for a in filtered_anomalies if a.reviewed]
    
    if filtered_anomalies:
        st.markdown(f"**共 {len(filtered_anomalies)} 条异常**")
        
        selected_idx = st.selectbox(
            "选择异常",
            range(len(filtered_anomalies)),
            format_func=lambda i: f"{filtered_anomalies[i].anomaly_id} - {ANOMALY_TYPE_NAMES.get(filtered_anomalies[i].anomaly_type.value if isinstance(filtered_anomalies[i].anomaly_type, AnomalyType) else str(filtered_anomalies[i].anomaly_type), '未知')}"
        )
        
        anomaly = filtered_anomalies[selected_idx]
        
        with col2:
            atype = anomaly.anomaly_type.value if isinstance(anomaly.anomaly_type, AnomalyType) else str(anomaly.anomaly_type)
            severity = anomaly.severity.value if isinstance(anomaly.severity, AnomalySeverity) else str(anomaly.severity)
            
            st.markdown(f"#### 异常详情: {anomaly.anomaly_id}")
            
            info_col1, info_col2 = st.columns(2)
            
            with info_col1:
                st.write(f"**设备ID**: {anomaly.device_id}")
                st.write(f"**异常类型**: {ANOMALY_TYPE_NAMES.get(atype, atype)}")
                st.write(f"**严重程度**: :{SEVERITY_COLORS.get(severity, 'gray')}[{SEVERITY_NAMES.get(severity, severity)}]")
            
            with info_col2:
                if anomaly.start_time:
                    st.write(f"**开始时间**: {anomaly.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
                if anomaly.end_time:
                    st.write(f"**结束时间**: {anomaly.end_time.strftime('%Y-%m-%d %H:%M:%S')}")
                st.write(f"**持续时间**: {anomaly.duration_seconds / 60:.1f} 分钟")
            
            if anomaly.min_value is not None:
                st.write(f"**温度范围**: {anomaly.min_value:.2f}°C ~ {anomaly.max_value:.2f}°C (平均: {anomaly.mean_value:.2f}°C)")
            
            st.write(f"**描述**: {anomaly.description}")
            
            if anomaly.batch_overlaps:
                st.write(f"**重叠批次**: {', '.join(anomaly.batch_overlaps)}")
            
            st.markdown("---")
            
            if anomaly.reviewed:
                st.success(f"✅ 已复核")
                st.write(f"**复核原因**: {anomaly.review_reason}")
                if anomaly.review_notes:
                    st.write(f"**复核备注**: {anomaly.review_notes}")
                if anomaly.reviewed_by:
                    st.write(f"**复核人**: {anomaly.reviewed_by}")
                if anomaly.reviewed_at:
                    st.write(f"**复核时间**: {anomaly.reviewed_at.strftime('%Y-%m-%d %H:%M:%S')}")
            else:
                st.markdown("#### 人工复核")
                
                review_reason = st.selectbox(
                    "复核原因",
                    options=[
                        "正常操作（如取放货）",
                        "设备维护",
                        "校准操作",
                        "数据异常（误报）",
                        "真实异常",
                        "探头漂移",
                        "其他"
                    ],
                    key=f"reason_{anomaly.anomaly_id}"
                )
                
                review_notes = st.text_area(
                    "复核备注",
                    placeholder="请输入详细说明...",
                    key=f"notes_{anomaly.anomaly_id}"
                )
                
                reviewed_by = st.text_input(
                    "复核人",
                    placeholder="请输入复核人姓名",
                    key=f"reviewer_{anomaly.anomaly_id}"
                )
                
                if st.button("确认复核", type="primary", key=f"submit_{anomaly.anomaly_id}"):
                    rules_engine = RulesEngine()
                    rules_engine.review_anomaly(
                        anomaly,
                        reason=review_reason,
                        notes=review_notes,
                        reviewed_by=reviewed_by
                    )
                    
                    state_store = StateStore()
                    state_store.save_review(
                        anomaly.anomaly_id,
                        {
                            'review_reason': review_reason,
                            'review_notes': review_notes,
                            'reviewed_by': reviewed_by,
                            'anomaly_snapshot': anomaly.to_dict()
                        },
                        session_id=st.session_state.session_id
                    )
                    
                    st.success("复核已保存！")
                    st.rerun()
    else:
        st.info("没有符合筛选条件的异常")


def show_export_panel():
    """导出面板"""
    if st.session_state.analysis_results is None:
        st.info("请先导入数据并运行分析")
        return
    
    st.markdown("### 📤 数据导出")
    
    results = st.session_state.analysis_results
    anomalies = results['anomalies']
    metrics = results['metrics']
    config = results['config']
    
    tab1, tab2, tab3 = st.tabs(["Markdown报告", "CSV异常清单", "JSON审计包"])
    
    with tab1:
        st.markdown("#### 生成复盘报告")
        
        col1, col2 = st.columns(2)
        
        with col1:
            include_anomalies = st.checkbox("包含异常详情", value=True)
            include_metrics = st.checkbox("包含指标统计", value=True)
        
        with col2:
            include_batches = st.checkbox("包含批次风险", value=True)
            include_reviews = st.checkbox("包含复核记录", value=True)
        
        if st.button("生成Markdown报告", type="primary"):
            state_store = StateStore()
            reviews = state_store.get_reviews()
            
            analysis_data = {
                'temperature_metrics': metrics.get('temperature_metrics', {}),
                'door_metrics': metrics.get('door_metrics', {}),
                'batch_metrics': metrics.get('batch_metrics', {}),
                'anomalies': anomalies,
                'door_events': st.session_state.parsed_data.get('door_events', []),
                'reviews': reviews,
                'config': {
                    'upper_temp_threshold': config.upper_temp_threshold,
                    'lower_temp_threshold': config.lower_temp_threshold,
                    'continuous_overtemp_window_minutes': config.continuous_overtemp_window_minutes,
                    'continuous_undertemp_window_minutes': config.continuous_undertemp_window_minutes,
                    'missing_data_threshold_minutes': config.missing_data_threshold_minutes,
                    'rapid_change_threshold': config.rapid_change_threshold,
                    'long_door_opening_seconds': config.long_door_opening_seconds
                }
            }
            
            report_gen = ReportGenerator()
            report_content = report_gen.generate_markdown_report(
                analysis_data,
                include_anomalies=include_anomalies,
                include_metrics=include_metrics,
                include_batches=include_batches,
                include_reviews=include_reviews
            )
            
            st.download_button(
                label="下载Markdown报告",
                data=report_content,
                file_name=f"温控复盘报告_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md",
                mime="text/markdown"
            )
            
            with st.expander("预览报告"):
                st.markdown(report_content)
    
    with tab2:
        st.markdown("#### 导出异常清单")
        
        include_reviews = st.checkbox("包含复核信息", value=True, key="csv_reviews")
        
        if st.button("生成CSV文件", type="secondary"):
            exporter = AnomalyCSVExporter()
            df = exporter.export_to_dataframe(anomalies, include_reviews=include_reviews)
            
            csv_data = df.to_csv(index=False, encoding='utf-8-sig')
            
            st.download_button(
                label="下载异常清单CSV",
                data=csv_data,
                file_name=f"异常清单_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                mime="text/csv"
            )
            
            st.dataframe(df, use_container_width=True)
    
    with tab3:
        st.markdown("#### 导出审计包")
        
        include_raw = st.checkbox("包含原始数据", value=False)
        
        if st.button("生成审计包", type="secondary"):
            state_store = StateStore()
            reviews = state_store.get_reviews()
            
            analysis_data = {
                'temperature_metrics': metrics.get('temperature_metrics', {}),
                'door_metrics': metrics.get('door_metrics', {}),
                'batch_metrics': metrics.get('batch_metrics', {}),
                'anomalies': anomalies,
                'door_events': st.session_state.parsed_data.get('door_events', []),
                'reviews': reviews,
                'config': config
            }
            
            exporter = AuditPackageExporter()
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as tmp:
                output_path = exporter.export_audit_package(
                    analysis_data,
                    tmp.name,
                    include_raw_data=include_raw
                )
                
                with open(output_path, 'r', encoding='utf-8') as f:
                    json_content = f.read()
                
                st.download_button(
                    label="下载JSON审计包",
                    data=json_content,
                    file_name=f"审计包_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                    mime="application/json"
                )
                
                st.info("审计包包含：分析摘要、异常详情、指标统计、规则配置、复核记录")


def main():
    """主应用"""
    init_session_state()
    
    st.title("🌡️ 温控偏航复盘板")
    st.markdown("**疫苗冷链质控数据分析可视化应用**")
    
    with st.sidebar:
        st.markdown("## 导航")
        
        page = st.radio(
            "选择功能",
            options=[
                "📁 数据导入",
                "⚙️ 规则配置",
                "📊 分析总览",
                "🌡️ 温度时间轴",
                "✅ 异常复核",
                "📤 数据导出"
            ]
        )
        
        st.markdown("---")
        
        if st.session_state.parsed_data:
            device_count = len(st.session_state.parsed_data.get('temperature_records', {}))
            anomaly_count = len(st.session_state.anomalies)
            st.markdown(f"""
            **当前会话状态**
            - 设备数: {device_count}
            - 异常数: {anomaly_count}
            - 会话ID: {st.session_state.session_id}
            """)
            
            if st.button("运行分析", type="primary"):
                run_analysis()
                st.success("分析完成！")
    
    if page == "📁 数据导入":
        upload_data_files()
    
    elif page == "⚙️ 规则配置":
        configure_rules()
    
    elif page == "📊 分析总览":
        show_dashboard()
    
    elif page == "🌡️ 温度时间轴":
        show_temperature_timeline()
    
    elif page == "✅ 异常复核":
        show_anomaly_review()
    
    elif page == "📤 数据导出":
        show_export_panel()
    
    st.markdown("---")
    st.markdown(
        "<div style='text-align: center; color: #6b7280; font-size: 0.875rem;'>"
        "温控偏航复盘板 v1.0 - 疫苗冷链质控数据分析工具"
        "</div>",
        unsafe_allow_html=True
    )


if __name__ == "__main__":
    main()
