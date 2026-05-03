import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from pathlib import Path
from datetime import datetime, timedelta
import json
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import SAMPLE_DATA_DIR, SESSION_DIR, EXPORT_DIR, NOISE_THRESHOLDS, TIME_CONFIG
from src.data_parser.complaints import ComplaintsParser
from src.data_parser.permits import PermitsParser
from src.data_parser.monitoring import MonitoringParser
from src.data_parser.grid import GridParser
from src.data_cleaner.time_processor import TimeProcessor
from src.data_cleaner.coordinate_processor import CoordinateProcessor
from src.data_cleaner.missing_handler import MissingHandler
from src.metrics.aggregator import MetricsAggregator
from src.rules.classifier import NoiseSourceClassifier
from src.storage.session_manager import SessionManager
from src.export.exporter import DataExporter
from src.sample_data.generator import SampleDataGenerator

st.set_page_config(
    page_title="夜间噪声投诉溯源台",
    page_icon="🔊",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        color: #1f77b4;
        text-align: center;
        margin-bottom: 1rem;
    }
    .metric-card {
        background-color: #f0f2f6;
        border-radius: 10px;
        padding: 1rem;
        margin: 0.5rem 0;
    }
    .source-tag {
        padding: 0.25rem 0.75rem;
        border-radius: 15px;
        font-size: 0.875rem;
        font-weight: 600;
    }
</style>
""", unsafe_allow_html=True)


def init_session_state():
    """初始化会话状态"""
    if 'session_manager' not in st.session_state:
        st.session_state.session_manager = SessionManager()
    
    if 'current_session' not in st.session_state:
        st.session_state.current_session = None
    
    if 'data_loaded' not in st.session_state:
        st.session_state.data_loaded = False
    
    if 'complaints_df' not in st.session_state:
        st.session_state.complaints_df = pd.DataFrame()
    
    if 'permits_df' not in st.session_state:
        st.session_state.permits_df = pd.DataFrame()
    
    if 'monitoring_df' not in st.session_state:
        st.session_state.monitoring_df = pd.DataFrame()
    
    if 'grids_df' not in st.session_state:
        st.session_state.grids_df = pd.DataFrame()
    
    if 'analysis_results' not in st.session_state:
        st.session_state.analysis_results = {}
    
    if 'classified_complaints' not in st.session_state:
        st.session_state.classified_complaints = pd.DataFrame()
    
    if 'hotspots_df' not in st.session_state:
        st.session_state.hotspots_df = pd.DataFrame()


def load_sample_data():
    """加载示例数据"""
    st.info("正在生成示例数据...")
    
    generator = SampleDataGenerator()
    samples = generator.generate_all_samples(save_to_files=True)
    
    st.session_state.complaints_df = samples['complaints']
    st.session_state.permits_df = samples['permits']
    st.session_state.monitoring_df = samples['monitoring']
    st.session_state.grids_df = samples['grids']
    st.session_state.data_loaded = True
    
    st.success(f"示例数据加载完成！")
    st.info(f"- 投诉记录: {len(st.session_state.complaints_df)} 条")
    st.info(f"- 施工备案: {len(st.session_state.permits_df)} 条")
    st.info(f"- 噪声监测: {len(st.session_state.monitoring_df)} 条")
    st.info(f"- 街区网格: {len(st.session_state.grids_df)} 个")


def run_analysis():
    """执行数据分析"""
    if not st.session_state.data_loaded:
        st.warning("请先加载数据")
        return
    
    with st.spinner("正在执行数据分析..."):
        aggregator = MetricsAggregator()
        classifier = NoiseSourceClassifier()
        
        noise_metrics = aggregator.compute_noise_metrics(
            st.session_state.monitoring_df
        )
        
        complaint_density = aggregator.compute_complaint_density(
            st.session_state.complaints_df,
            st.session_state.grids_df
        )
        
        permit_coverage = aggregator.compute_permit_coverage(
            st.session_state.monitoring_df,
            st.session_state.permits_df
        )
        
        st.session_state.classified_complaints = classifier.classify_dataframe(
            st.session_state.complaints_df,
            permits_df=st.session_state.permits_df
        )
        
        st.session_state.hotspots_df = aggregator.compute_hotspot_metrics(
            st.session_state.complaints_df,
            st.session_state.monitoring_df
        )
        
        suspicious_sources = []
        if not st.session_state.classified_complaints.empty:
            for _, row in st.session_state.classified_complaints.iterrows():
                details = row.get('classification_details', {})
                if details and 'primary_source' in details:
                    suspicious_sources.append(details['primary_source'])
        
        st.session_state.analysis_results = {
            'noise_metrics': noise_metrics,
            'complaint_density': complaint_density,
            'permit_coverage': permit_coverage,
            'suspicious_sources': suspicious_sources,
            'analysis_time': datetime.now().isoformat()
        }
        
        st.success("数据分析完成！")


def render_data_import():
    """渲染数据导入页面"""
    st.markdown("<h1 class='main-header'>📂 数据导入</h1>", unsafe_allow_html=True)
    
    col1, col2 = st.columns([1, 1])
    
    with col1:
        st.subheader("快速开始：使用示例数据")
        if st.button("🔄 加载示例数据", use_container_width=True, type="primary"):
            load_sample_data()
    
    with col2:
        st.subheader("导入自定义数据")
        st.info("支持格式：CSV (投诉、监测), JSON (备案、网格)")
        
        complaints_file = st.file_uploader("居民投诉数据 (CSV)", type=['csv'])
        permits_file = st.file_uploader("施工备案数据 (JSON)", type=['json'])
        monitoring_file = st.file_uploader("噪声监测数据 (CSV/Excel)", type=['csv', 'xlsx', 'xls'])
        grids_file = st.file_uploader("街区网格数据 (JSON/GeoJSON)", type=['json', 'geojson'])
        
        if st.button("📥 导入数据", use_container_width=True):
            with st.spinner("正在导入数据..."):
                try:
                    if complaints_file:
                        parser = ComplaintsParser()
                        st.session_state.complaints_df = parser.parse(Path(complaints_file.name))
                    
                    if permits_file:
                        parser = PermitsParser()
                        st.session_state.permits_df = parser.parse(Path(permits_file.name))
                    
                    if monitoring_file:
                        parser = MonitoringParser()
                        st.session_state.monitoring_df = parser.parse(Path(monitoring_file.name))
                    
                    if grids_file:
                        parser = GridParser()
                        st.session_state.grids_df = parser.parse(Path(grids_file.name))
                    
                    st.session_state.data_loaded = True
                    st.success("数据导入完成！")
                except Exception as e:
                    st.error(f"导入失败: {e}")
    
    if st.session_state.data_loaded:
        st.markdown("---")
        st.subheader("📊 数据概览")
        
        tab1, tab2, tab3, tab4 = st.tabs(["居民投诉", "施工备案", "噪声监测", "街区网格"])
        
        with tab1:
            if not st.session_state.complaints_df.empty:
                st.dataframe(st.session_state.complaints_df.head(10), use_container_width=True)
                st.metric("总投诉数", len(st.session_state.complaints_df))
        
        with tab2:
            if not st.session_state.permits_df.empty:
                st.dataframe(st.session_state.permits_df.head(10), use_container_width=True)
                st.metric("有效备案数", len(st.session_state.permits_df))
        
        with tab3:
            if not st.session_state.monitoring_df.empty:
                st.dataframe(st.session_state.monitoring_df.head(10), use_container_width=True)
                st.metric("监测记录数", len(st.session_state.monitoring_df))
        
        with tab4:
            if not st.session_state.grids_df.empty:
                st.dataframe(st.session_state.grids_df.head(10), use_container_width=True)
                st.metric("网格数量", len(st.session_state.grids_df))


def render_overview():
    """渲染总览页面"""
    st.markdown("<h1 class='main-header'>📊 数据分析概览</h1>", unsafe_allow_html=True)
    
    if not st.session_state.analysis_results:
        st.warning("请先执行数据分析")
        if st.button("▶️ 开始分析", type="primary"):
            run_analysis()
            st.rerun()
        return
    
    results = st.session_state.analysis_results
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        noise_metrics = results.get('noise_metrics', {})
        overall = noise_metrics.get('overall', {})
        st.metric("平均噪声", f"{overall.get('mean_db', 0):.1f} dB")
    
    with col2:
        complaint_density = results.get('complaint_density', {})
        st.metric("总投诉数", complaint_density.get('total_complaints', 0))
    
    with col3:
        permit_coverage = results.get('permit_coverage', {})
        coverage = permit_coverage.get('coverage_ratio', 0) * 100
        st.metric("备案覆盖率", f"{coverage:.1f}%")
    
    with col4:
        hotspots_count = len(st.session_state.hotspots_df) if not st.session_state.hotspots_df.empty else 0
        st.metric("热区数量", hotspots_count)
    
    st.markdown("---")
    
    tab1, tab2, tab3 = st.tabs(["📈 时间趋势", "🌍 空间分布", "🔍 噪声源分析"])
    
    with tab1:
        st.subheader("噪声趋势图")
        
        if not st.session_state.monitoring_df.empty:
            time_processor = TimeProcessor()
            aggregator = MetricsAggregator()
            
            hourly_stats = aggregator.aggregate_by_time(
                st.session_state.monitoring_df,
                'monitor_time',
                ['db_level', 'db_peak'],
                freq='H'
            )
            
            if not hourly_stats.empty:
                fig = go.Figure()
                
                fig.add_trace(go.Scatter(
                    x=hourly_stats['monitor_time'],
                    y=hourly_stats['db_level_mean'],
                    mode='lines',
                    name='平均噪声',
                    line=dict(color='#1f77b4')
                ))
                
                fig.add_trace(go.Scatter(
                    x=hourly_stats['monitor_time'],
                    y=hourly_stats['db_peak_max'],
                    mode='lines',
                    name='峰值噪声',
                    line=dict(color='#ff7f0e')
                ))
                
                fig.add_hline(
                    y=NOISE_THRESHOLDS.get('residential_night', 55),
                    line_dash="dash",
                    line_color="red",
                    annotation_text="夜间阈值 (55dB)"
                )
                
                fig.update_layout(
                    title="24小时噪声变化趋势",
                    xaxis_title="时间",
                    yaxis_title="分贝 (dB)",
                    hovermode="x unified"
                )
                
                st.plotly_chart(fig, use_container_width=True)
        
        if not st.session_state.complaints_df.empty:
            st.subheader("投诉时间分布")
            
            complaints_df = st.session_state.complaints_df.copy()
            complaints_df['hour'] = complaints_df['complaint_time'].dt.hour
            
            hourly_complaints = complaints_df.groupby('hour').size().reset_index(name='count')
            
            fig = px.bar(
                hourly_complaints,
                x='hour',
                y='count',
                title="投诉时段分布",
                color='count',
                color_continuous_scale='Viridis'
            )
            
            fig.update_layout(
                xaxis_title="小时 (0-23)",
                yaxis_title="投诉数量"
            )
            
            st.plotly_chart(fig, use_container_width=True)
    
    with tab2:
        st.subheader("热区排行")
        
        if not st.session_state.hotspots_df.empty:
            hotspots_display = st.session_state.hotspots_df[
                ['hotspot_rank', 'grid_id', 'complaint_count', 'max_db', 'hotspot_score']
            ].head(10)
            
            st.dataframe(hotspots_display, use_container_width=True, hide_index=True)
            
            fig = px.bar(
                hotspots_display,
                x='grid_id',
                y='hotspot_score',
                color='hotspot_score',
                color_continuous_scale='Reds',
                title="热区得分排名"
            )
            
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("暂无热区数据")
    
    with tab3:
        st.subheader("可疑噪声源分布")
        
        if not st.session_state.classified_complaints.empty:
            source_counts = st.session_state.classified_complaints['noise_source_name'].value_counts()
            
            fig = px.pie(
                values=source_counts.values,
                names=source_counts.index,
                title="噪声源类型分布",
                color_discrete_map={
                    "短时施工": "#FF6B6B",
                    "酒吧散场": "#4ECDC4",
                    "道路施工": "#FFA07A",
                    "交通噪声": "#9B59B6",
                    "未知噪声": "#95A5A6"
                }
            )
            
            st.plotly_chart(fig, use_container_width=True)
            
            st.subheader("分类详情")
            
            display_df = st.session_state.classified_complaints[
                ['complaint_id', 'complaint_time', 'description', 
                 'noise_source_name', 'classification_confidence']
            ].head(20)
            
            st.dataframe(display_df, use_container_width=True)


def render_verification():
    """渲染核实标记页面"""
    st.markdown("<h1 class='main-header'>✅ 人工核实与标记</h1>", unsafe_allow_html=True)
    
    if not st.session_state.classified_complaints.empty:
        st.subheader("投诉列表（可标记）")
        
        display_df = st.session_state.classified_complaints.copy()
        display_df = display_df[[
            'complaint_id', 'complaint_time', 'description',
            'noise_source_name', 'classification_confidence', 'grid_id'
        ]]
        
        st.dataframe(display_df, use_container_width=True)
        
        st.markdown("---")
        st.subheader("添加标记")
        
        col1, col2 = st.columns(2)
        
        with col1:
            complaint_id = st.selectbox(
                "选择投诉ID",
                options=display_df['complaint_id'].tolist()
            )
            
            tag_type = st.selectbox(
                "标记类型",
                options=['complaint', 'monitor', 'grid', 'source']
            )
            
            tag_value = st.selectbox(
                "标记值",
                options=['已核实-短时施工', '已核实-酒吧散场', '已核实-道路施工', 
                         '已核实-交通噪声', '待进一步核实', '已排除-误报']
            )
        
        with col2:
            verification_result = st.selectbox(
                "核实结果",
                options=['confirmed', 'pending', 'rejected', 'unknown'],
                format_func=lambda x: {
                    'confirmed': '已确认',
                    'pending': '待核实',
                    'rejected': '已排除',
                    'unknown': '未知'
                }.get(x, x)
            )
            
            verifier = st.text_input("核实人姓名")
            notes = st.text_area("备注信息")
        
        if st.button("📝 保存标记", type="primary"):
            if st.session_state.session_manager.current_session_id:
                tag = st.session_state.session_manager.add_user_tag(
                    tag_type=tag_type,
                    target_id=complaint_id,
                    tag_value=tag_value,
                    notes=notes
                )
                
                verification = st.session_state.session_manager.add_verification(
                    event_id=complaint_id,
                    verification_result=verification_result,
                    verifier=verifier,
                    notes=notes
                )
                
                st.success(f"标记已保存！标记ID: {tag['tag_id']}")
            else:
                st.warning("请先创建或加载一个会话")
        
        st.markdown("---")
        st.subheader("已保存的标记")
        
        current_info = st.session_state.session_manager.get_current_session_info()
        if current_info:
            st.info(f"当前会话: {current_info['session_name']}")
            st.info(f"标记数量: {current_info['tag_count']}")
            st.info(f"核实记录: {current_info['verification_count']}")


def render_export():
    """渲染导出页面"""
    st.markdown("<h1 class='main-header'>📤 数据导出</h1>", unsafe_allow_html=True)
    
    exporter = DataExporter()
    
    st.subheader("导出选项")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.markdown("### 📄 Markdown简报")
        st.info("包含完整的分析结果、热区排行和核实记录")
        
        if st.button("生成简报", key="md_export"):
            if st.session_state.current_session:
                try:
                    output_path = exporter.generate_markdown_report(
                        st.session_state.session_manager.current_session_data,
                        st.session_state.analysis_results
                    )
                    st.success(f"简报已生成: {output_path}")
                    
                    with open(output_path, 'r', encoding='utf-8') as f:
                        st.download_button(
                            "下载简报",
                            f.read(),
                            file_name=output_path.name,
                            mime="text/markdown"
                        )
                except Exception as e:
                    st.error(f"生成失败: {e}")
            else:
                st.warning("请先完成数据分析")
    
    with col2:
        st.markdown("### 📊 CSV热区表")
        st.info("导出热区排名和相关指标")
        
        if st.button("导出热区", key="csv_export"):
            if not st.session_state.hotspots_df.empty:
                try:
                    output_path = exporter.export_hotspots_csv(st.session_state.hotspots_df)
                    st.success(f"热区表已导出: {output_path}")
                    
                    csv_data = st.session_state.hotspots_df.to_csv(index=False, encoding='utf-8-sig')
                    st.download_button(
                        "下载CSV",
                        csv_data,
                        file_name=output_path.name,
                        mime="text/csv"
                    )
                except Exception as e:
                    st.error(f"导出失败: {e}")
            else:
                st.warning("暂无热区数据")
    
    with col3:
        st.markdown("### 📦 JSON审计包")
        st.info("完整的审计数据，包含所有分析和标记")
        
        if st.button("打包审计", key="json_export"):
            if st.session_state.current_session:
                try:
                    output_path = exporter.export_audit_package(
                        st.session_state.session_manager.current_session_data,
                        st.session_state.analysis_results
                    )
                    st.success(f"审计包已导出: {output_path}")
                    
                    with open(output_path, 'r', encoding='utf-8') as f:
                        st.download_button(
                            "下载审计包",
                            f.read(),
                            file_name=output_path.name,
                            mime="application/json"
                        )
                except Exception as e:
                    st.error(f"打包失败: {e}")
            else:
                st.warning("请先完成数据分析")
    
    st.markdown("---")
    st.subheader("导出历史")
    
    export_stats = exporter.get_export_stats()
    st.metric("总导出次数", export_stats.get('total_exports', 0))


def render_session_management():
    """渲染会话管理页面"""
    st.markdown("<h1 class='main-header'>💾 会话管理</h1>", unsafe_allow_html=True)
    
    session_manager = st.session_state.session_manager
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("创建新会话")
        session_name = st.text_input("会话名称", value=f"分析_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        session_desc = st.text_area("会话描述")
        
        if st.button("🆕 创建会话", type="primary"):
            session_id = session_manager.create_session(session_name, session_desc)
            st.session_state.current_session = session_id
            st.success(f"会话已创建: {session_id}")
    
    with col2:
        st.subheader("加载历史会话")
        sessions = session_manager.list_sessions()
        
        if sessions:
            session_options = {s['session_id']: f"{s['session_name']} ({s['created_at'][:10]})" for s in sessions}
            
            selected_session = st.selectbox(
                "选择会话",
                options=list(session_options.keys()),
                format_func=lambda x: session_options[x]
            )
            
            col_load, col_delete = st.columns(2)
            
            with col_load:
                if st.button("📂 加载会话"):
                    if session_manager.load_session(selected_session):
                        st.session_state.current_session = selected_session
                        st.success(f"会话已加载: {selected_session}")
                    else:
                        st.error("加载失败")
            
            with col_delete:
                if st.button("🗑️ 删除会话"):
                    if session_manager.delete_session(selected_session):
                        st.success("会话已删除")
                        st.rerun()
        else:
            st.info("暂无历史会话")
    
    st.markdown("---")
    st.subheader("当前会话信息")
    
    current_info = session_manager.get_current_session_info()
    if current_info:
        st.json(current_info, expanded=True)
    else:
        st.info("当前没有活动的会话")


def main():
    """主函数"""
    init_session_state()
    
    st.sidebar.title("🔊 夜间噪声投诉溯源台")
    st.sidebar.markdown("---")
    
    page = st.sidebar.radio(
        "导航",
        options=["数据导入", "分析概览", "人工核实", "数据导出", "会话管理"],
        index=0
    )
    
    st.sidebar.markdown("---")
    
    if st.sidebar.button("⚙️ 执行分析", type="secondary"):
        run_analysis()
    
    st.sidebar.markdown("---")
    st.sidebar.info("版本: 1.0.0")
    st.sidebar.info(f"工作目录: {Path.cwd()}")
    
    if page == "数据导入":
        render_data_import()
    elif page == "分析概览":
        render_overview()
    elif page == "人工核实":
        render_verification()
    elif page == "数据导出":
        render_export()
    elif page == "会话管理":
        render_session_management()


if __name__ == "__main__":
    main()
