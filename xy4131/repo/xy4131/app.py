import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from pathlib import Path
from datetime import datetime, timedelta
import tempfile
import os

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config.settings import Settings
from core.parser import DataParser
from core.normalizer import DataNormalizer
from core.analyzer import RiskAnalyzer
from core.session import SessionManager
from core.exporter import ReportExporter
from examples.sample_generator import SampleDataGenerator
from utils.helpers import format_datetime, parse_slot_id


st.set_page_config(
    page_title="岸电插拔复盘台",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        font-weight: bold;
        color: #1f77b4;
        margin-bottom: 0.5rem;
    }
    .sub-header {
        font-size: 1.2rem;
        color: #555;
        margin-bottom: 1rem;
    }
    .risk-card {
        padding: 1rem;
        border-radius: 0.5rem;
        margin-bottom: 1rem;
    }
    .risk-high {
        background-color: #ffebee;
        border-left: 4px solid #f44336;
    }
    .risk-medium {
        background-color: #fff3e0;
        border-left: 4px solid #ff9800;
    }
    .risk-low {
        background-color: #e3f2fd;
        border-left: 4px solid #2196f3;
    }
</style>
""", unsafe_allow_html=True)


def initialize_session_state():
    if 'parser' not in st.session_state:
        st.session_state.parser = DataParser()
    if 'normalizer' not in st.session_state:
        st.session_state.normalizer = None
    if 'analyzer' not in st.session_state:
        st.session_state.analyzer = None
    if 'session_manager' not in st.session_state:
        st.session_state.session_manager = SessionManager()
    if 'exporter' not in st.session_state:
        st.session_state.exporter = ReportExporter()
    if 'data_loaded' not in st.session_state:
        st.session_state.data_loaded = False
    if 'risks' not in st.session_state:
        st.session_state.risks = pd.DataFrame()
    if 'risk_summary' not in st.session_state:
        st.session_state.risk_summary = {}
    if 'current_session' not in st.session_state:
        st.session_state.current_session = None
    if 'normalized_data' not in st.session_state:
        st.session_state.normalized_data = {}


initialize_session_state()


def load_sample_data():
    generator = SampleDataGenerator()
    sample_data = generator.generate_all(container_count=25, include_risks=True)
    
    parser = DataParser()
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
        sample_data['power_records'].to_csv(f, index=False, encoding='utf-8-sig')
        power_file = f.name
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
        sample_data['movement_logs'].to_csv(f, index=False, encoding='utf-8-sig')
        movement_file = f.name
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
        sample_data['gate_records'].to_csv(f, index=False, encoding='utf-8-sig')
        gate_file = f.name
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
        sample_data['alarm_events'].to_csv(f, index=False, encoding='utf-8-sig')
        alarm_file = f.name
    
    try:
        parser.parse_power_records(power_file)
        parser.parse_movement_logs(movement_file)
        parser.parse_gate_records(gate_file)
        parser.parse_alarm_events(alarm_file)
        
        st.session_state.parser = parser
        
        normalizer = DataNormalizer(parser.get_all_data())
        normalizer.normalize_all()
        st.session_state.normalizer = normalizer
        st.session_state.normalized_data = normalizer.get_all_normalized_data()
        
        analyzer = RiskAnalyzer(normalizer.get_all_normalized_data(), normalizer.container_states)
        risks = analyzer.analyze_all()
        st.session_state.analyzer = analyzer
        st.session_state.risks = risks
        st.session_state.risk_summary = analyzer.get_risk_summary()
        
        st.session_state.data_loaded = True
        
        session = st.session_state.session_manager.create_session("示例数据复盘会话")
        st.session_state.current_session = session
        
    finally:
        os.unlink(power_file)
        os.unlink(movement_file)
        os.unlink(gate_file)
        os.unlink(alarm_file)


def sidebar_navigation():
    st.sidebar.markdown("## ⚡ 岸电插拔复盘台")
    st.sidebar.markdown("---")
    
    pages = {
        "📊 数据导入": "data_import",
        "🎯 风险概览": "risk_overview",
        "📈 可视化分析": "visualization",
        "📋 事件明细": "event_details",
        "💾 会话管理": "session_management",
        "📄 报告导出": "report_export",
    }
    
    selected_page = st.sidebar.radio("导航", list(pages.keys()))
    st.sidebar.markdown("---")
    
    if st.sidebar.button("加载示例数据", use_container_width=True):
        with st.spinner("正在生成示例数据..."):
            load_sample_data()
        st.success("示例数据加载完成！")
    
    return pages[selected_page]


def page_data_import():
    st.markdown('<div class="main-header">📊 数据导入</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">导入冷藏箱插电记录、堆位移动日志、闸口进出时间和报警事件</div>', unsafe_allow_html=True)
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("### 冷藏箱插电记录")
        power_file = st.file_uploader("上传插电记录 CSV", type=['csv'], key="power")
        
        st.markdown("### 堆位移动日志")
        movement_file = st.file_uploader("上传移动日志 CSV", type=['csv'], key="movement")
    
    with col2:
        st.markdown("### 闸口进出记录")
        gate_file = st.file_uploader("上传闸口记录 CSV", type=['csv'], key="gate")
        
        st.markdown("### 报警事件")
        alarm_file = st.file_uploader("上传报警事件 CSV", type=['csv'], key="alarm")
    
    if st.button("开始解析数据", type="primary", use_container_width=True):
        if not any([power_file, movement_file, gate_file, alarm_file]):
            st.error("请至少上传一个数据文件")
            return
        
        with st.spinner("正在解析数据..."):
            parser = DataParser()
            
            if power_file:
                with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as f:
                    f.write(power_file.getvalue())
                    power_path = f.name
                try:
                    parser.parse_power_records(power_path)
                finally:
                    os.unlink(power_path)
            
            if movement_file:
                with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as f:
                    f.write(movement_file.getvalue())
                    movement_path = f.name
                try:
                    parser.parse_movement_logs(movement_path)
                finally:
                    os.unlink(movement_path)
            
            if gate_file:
                with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as f:
                    f.write(gate_file.getvalue())
                    gate_path = f.name
                try:
                    parser.parse_gate_records(gate_path)
                finally:
                    os.unlink(gate_path)
            
            if alarm_file:
                with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as f:
                    f.write(alarm_file.getvalue())
                    alarm_path = f.name
                try:
                    parser.parse_alarm_events(alarm_path)
                finally:
                    os.unlink(alarm_path)
            
            st.session_state.parser = parser
            
            with st.spinner("正在归一化数据..."):
                normalizer = DataNormalizer(parser.get_all_data())
                normalizer.normalize_all()
                st.session_state.normalizer = normalizer
                st.session_state.normalized_data = normalizer.get_all_normalized_data()
            
            with st.spinner("正在分析风险..."):
                analyzer = RiskAnalyzer(normalizer.get_all_normalized_data(), normalizer.container_states)
                risks = analyzer.analyze_all()
                st.session_state.analyzer = analyzer
                st.session_state.risks = risks
                st.session_state.risk_summary = analyzer.get_risk_summary()
                
                st.session_state.data_loaded = True
                
                session = st.session_state.session_manager.create_session(f"复盘会话 - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
                st.session_state.current_session = session
            
            st.success("数据解析完成！")
    
    if st.session_state.data_loaded:
        st.markdown("---")
        st.markdown("### 已加载数据统计")
        
        col1, col2, col3, col4 = st.columns(4)
        
        raw_data = st.session_state.parser.get_all_data()
        
        with col1:
            pr_count = len(raw_data.get('power_records', pd.DataFrame()))
            st.metric("插电记录", f"{pr_count} 条")
        
        with col2:
            ml_count = len(raw_data.get('movement_logs', pd.DataFrame()))
            st.metric("移动日志", f"{ml_count} 条")
        
        with col3:
            gr_count = len(raw_data.get('gate_records', pd.DataFrame()))
            st.metric("闸口记录", f"{gr_count} 条")
        
        with col4:
            ae_count = len(raw_data.get('alarm_events', pd.DataFrame()))
            st.metric("报警事件", f"{ae_count} 条")


def page_risk_overview():
    st.markdown('<div class="main-header">🎯 风险概览</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">查看断电超时、插座冲突、移动未复插、报警未闭环等风险</div>', unsafe_allow_html=True)
    
    if not st.session_state.data_loaded:
        st.warning("请先导入数据")
        return
    
    risk_summary = st.session_state.risk_summary
    risks = st.session_state.risks
    
    st.markdown("### 风险统计")
    
    col1, col2, col3, col4, col5 = st.columns(5)
    
    with col1:
        st.metric("总风险数", risk_summary.get('total_risks', 0))
    
    by_severity = risk_summary.get('by_severity', {})
    with col2:
        st.metric("🔴 紧急", by_severity.get('紧急', 0))
    
    with col3:
        st.metric("🟠 重要", by_severity.get('重要', 0))
    
    with col4:
        st.metric("🔵 一般", by_severity.get('一般', 0))
    
    with col5:
        st.metric("🟢 提示", by_severity.get('提示', 0))
    
    st.markdown("---")
    st.markdown("### 风险类型分布")
    
    by_type = risk_summary.get('by_type', {})
    if by_type:
        fig = px.pie(
            values=list(by_type.values()),
            names=list(by_type.keys()),
            title="风险类型分布",
            color_discrete_sequence=px.colors.qualitative.Set3
        )
        st.plotly_chart(fig, use_container_width=True)
    
    st.markdown("---")
    st.markdown("### 风险详情")
    
    if risks.empty:
        st.info("暂无识别到的风险")
    else:
        risk_types = ['全部'] + sorted(risks['risk_type'].unique().tolist())
        selected_type = st.selectbox("筛选风险类型", risk_types)
        
        display_risks = risks
        if selected_type != '全部':
            display_risks = risks[risks['risk_type'] == selected_type]
        
        display_df = display_risks.copy()
        if 'risk_time' in display_df.columns:
            display_df['risk_time'] = display_df['risk_time'].apply(
                lambda x: format_datetime(x) if pd.notna(x) else ''
            )
        
        st.dataframe(
            display_df[['risk_id', 'risk_type', 'severity', 'container_no', 
                       'slot_id', 'risk_time', 'duration_minutes', 'description']],
            use_container_width=True,
            hide_index=True
        )


def page_visualization():
    st.markdown('<div class="main-header">📈 可视化分析</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">堆场热力图、箱号时间线和事件趋势分析</div>', unsafe_allow_html=True)
    
    if not st.session_state.data_loaded:
        st.warning("请先导入数据")
        return
    
    tab1, tab2, tab3 = st.tabs(["堆场热力图", "箱号时间线", "事件趋势"])
    
    with tab1:
        st.markdown("### 堆场热力图")
        st.markdown("显示各区块的风险分布和通电状态")
        
        normalized_data = st.session_state.normalized_data
        yard_inventory = normalized_data.get('yard_inventory', pd.DataFrame())
        risks = st.session_state.risks
        
        col1, col2 = st.columns([1, 3])
        
        with col1:
            if not yard_inventory.empty:
                st.markdown("#### 堆场库存统计")
                total_containers = len(yard_inventory)
                powered = len(yard_inventory[yard_inventory['is_powered'] == True])
                unpowered = total_containers - powered
                
                st.metric("在港箱数", total_containers)
                st.metric("通电中", powered)
                st.metric("待通电", unpowered)
                
                risk_count = len(risks)
                st.metric("风险箱数", min(risk_count, total_containers))
            else:
                st.info("暂无堆场库存数据")
        
        with col2:
            if not yard_inventory.empty:
                yard_inventory['block'] = yard_inventory['slot_id'].str.split('-').str[0]
                
                block_stats = yard_inventory.groupby('block').agg({
                    'container_no': 'count',
                    'is_powered': 'sum'
                }).reset_index()
                block_stats.columns = ['block', 'total', 'powered']
                block_stats['unpowered'] = block_stats['total'] - block_stats['powered']
                
                block_risk_counts = {}
                if not risks.empty:
                    risks['block'] = risks['slot_id'].str.split('-').str[0]
                    block_risk_counts = risks.groupby('block').size().to_dict()
                
                block_stats['risks'] = block_stats['block'].map(block_risk_counts).fillna(0)
                
                fig = px.bar(
                    block_stats,
                    x='block',
                    y=['powered', 'unpowered', 'risks'],
                    title="各区块箱数分布",
                    labels={'value': '箱数', 'variable': '状态'},
                    barmode='group',
                    color_discrete_map={
                        'powered': '#2ecc71',
                        'unpowered': '#f39c12',
                        'risks': '#e74c3c'
                    }
                )
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info("暂无堆场数据可显示")
    
    with tab2:
        st.markdown("### 箱号时间线")
        st.markdown("查看单个集装箱的完整事件时间线")
        
        containers = st.session_state.parser.get_container_list()
        
        if containers:
            selected_container = st.selectbox("选择集装箱号", containers)
            
            if selected_container and st.session_state.normalizer:
                container_timeline = st.session_state.normalizer.get_container_timeline(selected_container)
                
                if not container_timeline.empty:
                    timeline_display = container_timeline.copy()
                    timeline_display['time'] = timeline_display['time'].apply(
                        lambda x: format_datetime(x) if pd.notna(x) else ''
                    )
                    
                    type_colors = {
                        'plug_in': '#2ecc71',
                        'unplug': '#e74c3c',
                        'movement': '#3498db',
                        'alarm': '#f39c12',
                    }
                    
                    st.markdown(f"#### 集装箱 {selected_container} 事件时间线")
                    
                    events_list = []
                    for _, row in container_timeline.iterrows():
                        event_type = row['type']
                        time_str = format_datetime(row['time'])
                        slot = row.get('slot_id', '') or ''
                        
                        if event_type == 'plug_in':
                            desc = f"⚡ 插电 - 堆位: {slot}"
                        elif event_type == 'unplug':
                            desc = f"🔌 断电 - 堆位: {slot}"
                        elif event_type == 'movement':
                            from_slot = row.get('from_slot', '') or '闸口'
                            to_slot = row.get('to_slot', '') or '闸口'
                            move_type = row.get('move_type', '移箱')
                            desc = f"🚛 {move_type} - 从 {from_slot} 到 {to_slot}"
                        elif event_type == 'alarm':
                            alarm_type = row.get('alarm_type', '')
                            alarm_level = row.get('alarm_level', '')
                            status = row.get('status', '')
                            desc = f"⚠️ 报警 - {alarm_type} ({alarm_level}) [{status}]"
                        else:
                            desc = f"事件: {event_type}"
                        
                        events_list.append({
                            '时间': time_str,
                            '事件': desc,
                            '堆位': slot
                        })
                    
                    events_df = pd.DataFrame(events_list)
                    st.dataframe(events_df, use_container_width=True, hide_index=True)
                    
                    container_risks = st.session_state.risks[
                        st.session_state.risks['container_no'].str.contains(selected_container, na=False)
                    ]
                    if not container_risks.empty:
                        st.markdown(f"#### 相关风险")
                        container_risks_display = container_risks.copy()
                        container_risks_display['risk_time'] = container_risks_display['risk_time'].apply(
                            lambda x: format_datetime(x) if pd.notna(x) else ''
                        )
                        st.dataframe(
                            container_risks_display[['risk_id', 'risk_type', 'severity', 
                                                    'risk_time', 'description']],
                            use_container_width=True,
                            hide_index=True
                        )
                else:
                    st.info("该集装箱暂无事件记录")
        else:
            st.info("暂无集装箱数据")
    
    with tab3:
        st.markdown("### 事件趋势")
        st.markdown("按时间查看事件分布趋势")
        
        normalized_data = st.session_state.normalized_data
        timeline = normalized_data.get('timeline', pd.DataFrame())
        
        if not timeline.empty:
            timeline['date'] = timeline['event_time'].dt.date
            
            event_counts = timeline.groupby(['date', 'event_type']).size().reset_index(name='count')
            
            fig = px.line(
                event_counts,
                x='date',
                y='count',
                color='event_type',
                title="事件趋势分析",
                markers=True
            )
            st.plotly_chart(fig, use_container_width=True)
            
            st.markdown("#### 事件类型统计")
            event_type_counts = timeline['event_type'].value_counts().reset_index()
            event_type_counts.columns = ['事件类型', '数量']
            st.dataframe(event_type_counts, use_container_width=True, hide_index=True)
        else:
            st.info("暂无时间线数据")


def page_event_details():
    st.markdown('<div class="main-header">📋 事件明细</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">查看插电记录、移动日志、闸口记录和报警事件的详细数据</div>', unsafe_allow_html=True)
    
    if not st.session_state.data_loaded:
        st.warning("请先导入数据")
        return
    
    tab1, tab2, tab3, tab4 = st.tabs([
        "插电记录", "移动日志", "闸口记录", "报警事件"
    ])
    
    normalized_data = st.session_state.normalized_data
    
    with tab1:
        st.markdown("### 冷藏箱插电记录")
        pr = normalized_data.get('power_records', pd.DataFrame())
        
        if pr.empty:
            st.info("暂无插电记录数据")
        else:
            display_pr = pr.copy()
            for col in ['plug_in_time', 'unplug_time']:
                if col in display_pr.columns:
                    display_pr[col] = display_pr[col].apply(
                        lambda x: format_datetime(x) if pd.notna(x) else ''
                    )
            
            search_container = st.text_input("搜索集装箱号", key="pr_search")
            if search_container:
                display_pr = display_pr[
                    display_pr['container_no'].str.contains(search_container, case=False, na=False)
                ]
            
            st.dataframe(
                display_pr[['container_no', 'plug_in_time', 'unplug_time', 
                           'slot_id', 'outlet_id', 'duration_hours', 'is_active']],
                use_container_width=True,
                hide_index=True
            )
    
    with tab2:
        st.markdown("### 堆位移动日志")
        ml = normalized_data.get('movement_logs', pd.DataFrame())
        
        if ml.empty:
            st.info("暂无移动日志数据")
        else:
            display_ml = ml.copy()
            if 'move_time' in display_ml.columns:
                display_ml['move_time'] = display_ml['move_time'].apply(
                    lambda x: format_datetime(x) if pd.notna(x) else ''
                )
            
            search_container = st.text_input("搜索集装箱号", key="ml_search")
            if search_container:
                display_ml = display_ml[
                    display_ml['container_no'].str.contains(search_container, case=False, na=False)
                ]
            
            st.dataframe(
                display_ml[['container_no', 'move_time', 'move_type', 
                           'from_slot', 'to_slot', 'equipment_id', 'operator']],
                use_container_width=True,
                hide_index=True
            )
    
    with tab3:
        st.markdown("### 闸口进出记录")
        gr = normalized_data.get('gate_records', pd.DataFrame())
        
        if gr.empty:
            st.info("暂无闸口记录数据")
        else:
            display_gr = gr.copy()
            for col in ['gate_in_time', 'gate_out_time']:
                if col in display_gr.columns:
                    display_gr[col] = display_gr[col].apply(
                        lambda x: format_datetime(x) if pd.notna(x) else ''
                    )
            
            search_container = st.text_input("搜索集装箱号", key="gr_search")
            if search_container:
                display_gr = display_gr[
                    display_gr['container_no'].str.contains(search_container, case=False, na=False)
                ]
            
            st.dataframe(
                display_gr[['container_no', 'gate_in_time', 'gate_out_time', 
                           'transport_mode', 'vehicle_no', 'stay_duration_hours', 'is_in_yard']],
                use_container_width=True,
                hide_index=True
            )
    
    with tab4:
        st.markdown("### 报警事件")
        ae = normalized_data.get('alarm_events', pd.DataFrame())
        
        if ae.empty:
            st.info("暂无报警事件数据")
        else:
            display_ae = ae.copy()
            for col in ['alarm_time', 'resolve_time']:
                if col in display_ae.columns:
                    display_ae[col] = display_ae[col].apply(
                        lambda x: format_datetime(x) if pd.notna(x) else ''
                    )
            
            status_filter = st.multiselect(
                "筛选状态",
                options=display_ae['status'].unique().tolist(),
                default=display_ae['status'].unique().tolist()
            )
            if status_filter:
                display_ae = display_ae[display_ae['status'].isin(status_filter)]
            
            search_container = st.text_input("搜索集装箱号", key="ae_search")
            if search_container:
                display_ae = display_ae[
                    display_ae['container_no'].str.contains(search_container, case=False, na=False)
                ]
            
            st.dataframe(
                display_ae[['container_no', 'alarm_time', 'alarm_type', 'alarm_level',
                           'alarm_desc', 'slot_id', 'status', 'resolve_time', 'resolved_by']],
                use_container_width=True,
                hide_index=True
            )


def page_session_management():
    st.markdown('<div class="main-header">💾 会话管理</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">保存、加载和管理复盘会话</div>', unsafe_allow_html=True)
    
    session_manager = st.session_state.session_manager
    
    col1, col2 = st.columns([1, 2])
    
    with col1:
        st.markdown("### 新建会话")
        session_name = st.text_input("会话名称", value=f"复盘会话 - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        
        if st.button("创建新会话", type="primary"):
            session = session_manager.create_session(session_name)
            st.session_state.current_session = session
            st.success(f"已创建会话: {session_name}")
        
        if st.session_state.current_session:
            st.markdown("---")
            st.markdown("### 当前会话")
            st.write(f"**名称**: {st.session_state.current_session.get('name', '')}")
            st.write(f"**ID**: {st.session_state.current_session.get('session_id', '')}")
            st.write(f"**创建时间**: {format_datetime(st.session_state.current_session.get('created_at'))}")
            
            if st.session_state.data_loaded:
                if st.button("保存当前数据到会话"):
                    with st.spinner("正在保存会话..."):
                        session_manager.save_session(
                            session_data=st.session_state.current_session,
                            normalized_data=st.session_state.normalized_data,
                            risks=st.session_state.risks,
                            risk_summary=st.session_state.risk_summary
                        )
                    st.success("会话已保存！")
            
            st.markdown("#### 会话备注")
            session_notes = st.text_area(
                "添加复盘备注",
                value=st.session_state.current_session.get('notes', ''),
                height=150
            )
            if st.button("保存备注"):
                session_manager.update_session_notes(
                    st.session_state.current_session['session_id'],
                    session_notes
                )
                st.session_state.current_session['notes'] = session_notes
                st.success("备注已保存！")
    
    with col2:
        st.markdown("### 历史会话")
        
        sessions = session_manager.list_sessions()
        
        if not sessions:
            st.info("暂无历史会话")
        else:
            for session in sessions:
                col_a, col_b, col_c = st.columns([3, 1, 1])
                
                with col_a:
                    st.write(f"**{session.get('name', '未命名')}**")
                    st.caption(
                        f"ID: {session.get('session_id', '')} | "
                        f"更新: {session.get('updated_at', '')[:19] if session.get('updated_at') else ''} | "
                        f"风险: {session.get('total_risks', 0)}个"
                    )
                
                with col_b:
                    if st.button("加载", key=f"load_{session['session_id']}"):
                        with st.spinner("正在加载会话..."):
                            loaded_session = session_manager.load_session(session['session_id'])
                            st.session_state.current_session = loaded_session
                            
                            if 'normalized_data' in loaded_session:
                                st.session_state.normalized_data = loaded_session['normalized_data']
                                st.session_state.data_loaded = True
                                
                                if 'risks' in loaded_session:
                                    st.session_state.risks = pd.DataFrame(loaded_session['risks'])
                                if 'risk_summary' in loaded_session:
                                    st.session_state.risk_summary = loaded_session['risk_summary']
                            
                            st.success("会话已加载！")
                
                with col_c:
                    if st.button("删除", key=f"del_{session['session_id']}"):
                        session_manager.delete_session(session['session_id'])
                        st.rerun()
                
                st.markdown("---")


def page_report_export():
    st.markdown('<div class="main-header">📄 报告导出</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">导出复盘报告，支持 Markdown、CSV、JSON 格式</div>', unsafe_allow_html=True)
    
    if not st.session_state.data_loaded:
        st.warning("请先导入数据或加载会话")
        return
    
    exporter = st.session_state.exporter
    
    st.markdown("### 导出选项")
    
    col1, col2 = st.columns(2)
    
    with col1:
        export_format = st.radio(
            "选择导出格式",
            ["Markdown 报告", "CSV 数据", "JSON 格式"],
            horizontal=True
        )
    
    with col2:
        filename_prefix = st.text_input(
            "文件名前缀",
            value=f"岸电复盘_{datetime.now().strftime('%Y%m%d')}"
        )
        
        include_raw_data = st.checkbox("包含原始数据", value=True)
    
    st.markdown("---")
    
    if st.button("生成报告", type="primary", use_container_width=True):
        with st.spinner("正在生成报告..."):
            try:
                if export_format == "Markdown 报告":
                    filepath = exporter.export_markdown(
                        risks=st.session_state.risks,
                        risk_summary=st.session_state.risk_summary,
                        normalized_data=st.session_state.normalized_data if include_raw_data else None,
                        session_info=st.session_state.current_session,
                        filename=f"{filename_prefix}.md"
                    )
                    st.success(f"Markdown 报告已生成: {filepath}")
                    
                    with open(filepath, 'r', encoding='utf-8') as f:
                        md_content = f.read()
                    
                    st.download_button(
                        label="下载 Markdown 报告",
                        data=md_content,
                        file_name=f"{filename_prefix}.md",
                        mime="text/markdown"
                    )
                    
                    with st.expander("预览报告"):
                        st.markdown(md_content)
                
                elif export_format == "CSV 数据":
                    files = exporter.export_csv(
                        risks=st.session_state.risks,
                        risk_summary=st.session_state.risk_summary,
                        normalized_data=st.session_state.normalized_data if include_raw_data else None,
                        filename_prefix=filename_prefix
                    )
                    
                    st.success(f"已生成 {len(files)} 个 CSV 文件:")
                    for f in files:
                        st.write(f"- {f}")
                
                elif export_format == "JSON 格式":
                    filepath = exporter.export_json(
                        risks=st.session_state.risks,
                        risk_summary=st.session_state.risk_summary,
                        normalized_data=st.session_state.normalized_data if include_raw_data else None,
                        session_info=st.session_state.current_session,
                        filename=f"{filename_prefix}.json"
                    )
                    st.success(f"JSON 文件已生成: {filepath}")
                    
                    with open(filepath, 'r', encoding='utf-8') as f:
                        json_content = f.read()
                    
                    st.download_button(
                        label="下载 JSON 文件",
                        data=json_content,
                        file_name=f"{filename_prefix}.json",
                        mime="application/json"
                    )
            
            except Exception as e:
                st.error(f"导出失败: {str(e)}")
    
    st.markdown("---")
    st.markdown("### 导出历史")
    
    export_history = exporter.get_export_history()
    
    if not export_history:
        st.info("暂无导出历史")
    else:
        history_df = pd.DataFrame(export_history)
        history_df['modified_time'] = history_df['modified_time'].apply(
            lambda x: format_datetime(x) if pd.notna(x) else ''
        )
        history_df['size_kb'] = (history_df['size'] / 1024).round(2)
        
        st.dataframe(
            history_df[['name', 'size_kb', 'modified_time', 'extension']],
            use_container_width=True,
            hide_index=True,
            column_config={
                'name': '文件名',
                'size_kb': '大小 (KB)',
                'modified_time': '修改时间',
                'extension': '格式'
            }
        )


def main():
    page = sidebar_navigation()
    
    if page == "data_import":
        page_data_import()
    elif page == "risk_overview":
        page_risk_overview()
    elif page == "visualization":
        page_visualization()
    elif page == "event_details":
        page_event_details()
    elif page == "session_management":
        page_session_management()
    elif page == "report_export":
        page_report_export()


if __name__ == "__main__":
    main()
