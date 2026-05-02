"""微震事件复核工具 - Streamlit 主应用"""

import os
import sys
import tempfile
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from io import StringIO

import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import plotly.graph_objects as go
from plotly.subplots import make_subplots

# 导入本地模块
from config import (
    DEFAULT_STA_WINDOW,
    DEFAULT_LTA_WINDOW,
    DEFAULT_STA_LTA_THRESHOLD,
    DEFAULT_THRESHOLD_MULTIPLIER,
    MIN_STATIONS_FOR_LOCATION,
    DEFAULT_OUTPUT_DIR
)
from data_loader import DataLoader, Station, Waveform, VelocityModel
from validator import DataValidator, ValidationResult, quick_validate
from picker import PWavePicker, PickResult, auto_pick
from locator import EventLocator, LocationResult, locate_event

# 页面配置
st.set_page_config(
    page_title="微震事件复核工具",
    page_icon="🌋",
    layout="wide",
    initial_sidebar_state="expanded"
)

# 自定义CSS
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        color: #2c3e50;
        text-align: center;
        margin-bottom: 2rem;
    }
    .section-header {
        font-size: 1.5rem;
        color: #34495e;
        margin-top: 1.5rem;
        margin-bottom: 1rem;
        border-bottom: 2px solid #3498db;
        padding-bottom: 0.5rem;
    }
    .status-box {
        padding: 1rem;
        border-radius: 0.5rem;
        margin-bottom: 1rem;
    }
    .status-success {
        background-color: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
    }
    .status-warning {
        background-color: #fff3cd;
        color: #856404;
        border: 1px solid #ffeaa7;
    }
    .status-error {
        background-color: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
    }
    .metric-card {
        background-color: #f8f9fa;
        padding: 1rem;
        border-radius: 0.5rem;
        text-align: center;
        border: 1px solid #dee2e6;
    }
    .metric-value {
        font-size: 1.8rem;
        font-weight: bold;
        color: #2c3e50;
    }
    .metric-label {
        font-size: 0.9rem;
        color: #7f8c8d;
    }
</style>
""", unsafe_allow_html=True)


class MicroseismicReviewApp:
    """微震事件复核应用类"""
    
    def __init__(self):
        """初始化应用状态"""
        # 初始化 session_state
        if 'data_loaded' not in st.session_state:
            st.session_state.data_loaded = False
        
        if 'stations' not in st.session_state:
            st.session_state.stations = {}
        
        if 'waveforms' not in st.session_state:
            st.session_state.waveforms = {}
        
        if 'velocity_model' not in st.session_state:
            st.session_state.velocity_model = None
        
        if 'validation_result' not in st.session_state:
            st.session_state.validation_result = None
        
        if 'pick_results' not in st.session_state:
            st.session_state.pick_results = {}
        
        if 'location_result' not in st.session_state:
            st.session_state.location_result = None
        
        if 'pick_method' not in st.session_state:
            st.session_state.pick_method = 'sta_lta'
        
        if 'selected_station' not in st.session_state:
            st.session_state.selected_station = None
        
        if 'events_data' not in st.session_state:
            st.session_state.events_data = []
        
        if 'review_comments' not in st.session_state:
            st.session_state.review_comments = []
        
        if 'load_errors' not in st.session_state:
            st.session_state.load_errors = []
        
        if 'load_warnings' not in st.session_state:
            st.session_state.load_warnings = []
    
    def _clear_data(self):
        """清除所有数据"""
        st.session_state.data_loaded = False
        st.session_state.stations = {}
        st.session_state.waveforms = {}
        st.session_state.velocity_model = None
        st.session_state.validation_result = None
        st.session_state.pick_results = {}
        st.session_state.location_result = None
        st.session_state.events_data = []
        st.session_state.review_comments = []
        st.session_state.load_errors = []
        st.session_state.load_warnings = []
    
    def run(self):
        """运行应用"""
        # 标题
        st.markdown('<h1 class="main-header">🌋 微震事件复核工具</h1>', unsafe_allow_html=True)
        
        # 侧边栏
        self._render_sidebar()
        
        # 主内容区
        tabs = st.tabs([
            "📁 数据导入",
            "✅ 数据校验",
            "🔍 P波拾取",
            "📍 事件定位",
            "📊 波形查看",
            "📤 导出结果"
        ])
        
        with tabs[0]:
            self._render_data_import()
        
        with tabs[1]:
            self._render_data_validation()
        
        with tabs[2]:
            self._render_picking()
        
        with tabs[3]:
            self._render_location()
        
        with tabs[4]:
            self._render_waveform_viewer()
        
        with tabs[5]:
            self._render_export()
    
    def _render_sidebar(self):
        """渲染侧边栏"""
        st.sidebar.title("⚙️ 工具设置")
        
        # 数据状态
        st.sidebar.subheader("数据状态")
        if st.session_state.data_loaded:
            st.sidebar.success("✅ 数据已加载")
            n_stations = len(st.session_state.stations)
            n_waveforms = len(st.session_state.waveforms)
            st.sidebar.metric("台站数", n_stations)
            st.sidebar.metric("波形数", n_waveforms)
        else:
            st.sidebar.warning("⚠️ 未加载数据")
        
        # 拾取方法设置
        st.sidebar.subheader("拾取方法")
        pick_method = st.sidebar.radio(
            "选择拾取方法",
            ["STA/LTA 方法", "阈值方法"],
            index=0 if st.session_state.pick_method == 'sta_lta' else 1
        )
        st.session_state.pick_method = 'sta_lta' if pick_method == "STA/LTA 方法" else 'threshold'
        
        # STA/LTA 参数
        if st.session_state.pick_method == 'sta_lta':
            st.sidebar.subheader("STA/LTA 参数")
            st.session_state.sta_window = st.sidebar.slider(
                "STA 窗口 (秒)",
                min_value=0.01,
                max_value=0.5,
                value=DEFAULT_STA_WINDOW,
                step=0.01
            )
            st.session_state.lta_window = st.sidebar.slider(
                "LTA 窗口 (秒)",
                min_value=0.1,
                max_value=2.0,
                value=DEFAULT_LTA_WINDOW,
                step=0.1
            )
            st.session_state.sta_lta_threshold = st.sidebar.slider(
                "触发阈值",
                min_value=1.0,
                max_value=10.0,
                value=DEFAULT_STA_LTA_THRESHOLD,
                step=0.5
            )
        else:
            # 阈值方法参数
            st.sidebar.subheader("阈值方法参数")
            st.session_state.threshold_multiplier = st.sidebar.slider(
                "阈值倍数 (噪声水平 ×)",
                min_value=1.0,
                max_value=10.0,
                value=DEFAULT_THRESHOLD_MULTIPLIER,
                step=0.5
            )
        
        # 清除数据按钮
        if st.sidebar.button("🗑️ 清除所有数据"):
            self._clear_data()
            st.sidebar.success("数据已清除")
            st.rerun()
    
    def _render_data_import(self):
        """渲染数据导入页面"""
        st.markdown('<h2 class="section-header">📁 数据导入</h2>', unsafe_allow_html=True)
        
        # 数据格式说明
        with st.expander("📋 数据格式说明", expanded=False):
            st.markdown("""
            ### 所需数据文件
            
            **1. 台站文件 (stations.csv)**
            - 必需列: `station_id`, `x`, `y`, `z`
            - 可选列: `sampling_rate`, `channel`
            
            **2. 波形数据目录 (waveforms/)**
            - 每个台站一个CSV文件
            - 文件名格式: `{station_id}.csv` 或 `{station_id}_{timestamp}.csv`
            - 数据列: 包含时间列和振幅/速度列
            
            **3. 速度模型 (velocity_model.yaml) - 可选**
            ```yaml
            p_velocity: 5000.0  # P波速度 (m/s)
            s_velocity: 2890.0  # S波速度 (m/s)
            # 或分层模型:
            layers:
              - depth: 0
                vp: 5000
                vs: 2890
              - depth: 500
                vp: 5500
                vs: 3180
            ```
            """)
        
        # 文件上传区域
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.subheader("📌 台站文件")
            stations_file = st.file_uploader(
                "上传 stations.csv",
                type=['csv'],
                key="stations_upload"
            )
        
        with col2:
            st.subheader("🌊 波形数据")
            waveform_files = st.file_uploader(
                "上传波形CSV文件 (可多选)",
                type=['csv'],
                accept_multiple_files=True,
                key="waveforms_upload"
            )
        
        with col3:
            st.subheader("⚡ 速度模型")
            velocity_file = st.file_uploader(
                "上传 velocity_model.yaml (可选)",
                type=['yaml', 'yml'],
                key="velocity_upload"
            )
        
        # 示例数据选项
        st.subheader("📚 使用示例数据")
        use_sample = st.button("加载示例数据", type="secondary")
        
        if use_sample:
            self._load_sample_data()
            st.success("示例数据已加载！")
            st.rerun()
        
        # 加载按钮
        st.divider()
        load_button = st.button("🚀 加载上传的数据", type="primary", use_container_width=True)
        
        if load_button:
            if stations_file is None:
                st.error("请先上传台站文件 (stations.csv)")
            elif not waveform_files:
                st.error("请至少上传一个波形文件")
            else:
                self._load_uploaded_data(stations_file, waveform_files, velocity_file)
        
        # 显示当前数据状态
        if st.session_state.data_loaded:
            st.divider()
            self._display_data_summary()
    
    def _load_sample_data(self):
        """加载示例数据"""
        # 创建临时目录
        with tempfile.TemporaryDirectory() as tmp_dir:
            # 创建台站数据
            stations_data = """station_id,x,y,z,sampling_rate,channel
STA001,0,0,0,1000,Z
STA002,500,0,0,1000,Z
STA003,0,500,0,1000,Z
STA004,500,500,0,1000,Z
STA005,250,250,-200,1000,Z
"""
            stations_path = os.path.join(tmp_dir, "stations.csv")
            with open(stations_path, 'w') as f:
                f.write(stations_data)
            
            # 创建波形数据目录
            waveforms_dir = os.path.join(tmp_dir, "waveforms")
            os.makedirs(waveforms_dir)
            
            # 生成模拟波形数据
            np.random.seed(42)
            sampling_rate = 1000.0
            dt = 1.0 / sampling_rate
            duration = 2.0  # 秒
            n_samples = int(duration * sampling_rate)
            
            # 假设事件位置
            event_x, event_y, event_z = 250, 250, -500
            velocity = 5000.0  # m/s
            
            # 台站位置
            stations_info = {
                'STA001': (0, 0, 0),
                'STA002': (500, 0, 0),
                'STA003': (0, 500, 0),
                'STA004': (500, 500, 0),
                'STA005': (250, 250, -200)
            }
            
            # 为每个台站生成波形
            for station_id, (x, y, z) in stations_info.items():
                # 计算距离和走时
                distance = np.sqrt(
                    (event_x - x)**2 + 
                    (event_y - y)**2 + 
                    (event_z - z)**2
                )
                travel_time = distance / velocity
                
                # 生成时间轴
                t = np.arange(n_samples) * dt
                
                # 生成噪声
                noise = np.random.normal(0, 0.1, n_samples)
                
                # 生成P波信号（Ricker小波）
                f0 = 50.0  # 主频
                t0 = travel_time
                a = (np.pi * f0 * (t - t0))**2
                ricker = (1 - 2 * a) * np.exp(-a)
                
                # 调整振幅（距离衰减）
                amplitude = 1.0 / (distance + 1) * 10
                signal = ricker * amplitude
                
                # 组合信号和噪声
                data = noise + signal
                
                # 保存为CSV
                df = pd.DataFrame({
                    'time': t,
                    'velocity': data
                })
                waveform_path = os.path.join(waveforms_dir, f"{station_id}.csv")
                df.to_csv(waveform_path, index=False)
            
            # 创建速度模型
            velocity_data = """p_velocity: 5000.0
s_velocity: 2890.0
"""
            velocity_path = os.path.join(tmp_dir, "velocity_model.yaml")
            with open(velocity_path, 'w') as f:
                f.write(velocity_data)
            
            # 加载数据
            loader = DataLoader(
                stations_path=stations_path,
                waveforms_dir=waveforms_dir,
                velocity_model_path=velocity_path
            )
            loader.load_all()
            
            # 保存到 session_state
            st.session_state.stations = loader.stations
            st.session_state.waveforms = loader.waveforms
            st.session_state.velocity_model = loader.velocity_model
            st.session_state.load_errors = loader.load_errors
            st.session_state.load_warnings = loader.load_warnings
            st.session_state.data_loaded = True
            
            # 执行校验
            validator = DataValidator()
            st.session_state.validation_result = validator.validate_all(
                st.session_state.stations,
                st.session_state.waveforms,
                st.session_state.velocity_model
            )
    
    def _load_uploaded_data(self, stations_file, waveform_files, velocity_file):
        """加载上传的数据"""
        with tempfile.TemporaryDirectory() as tmp_dir:
            # 保存台站文件
            stations_path = os.path.join(tmp_dir, "stations.csv")
            with open(stations_path, 'wb') as f:
                f.write(stations_file.getvalue())
            
            # 保存波形文件
            waveforms_dir = os.path.join(tmp_dir, "waveforms")
            os.makedirs(waveforms_dir)
            
            for wf_file in waveform_files:
                wf_path = os.path.join(waveforms_dir, wf_file.name)
                with open(wf_path, 'wb') as f:
                    f.write(wf_file.getvalue())
            
            # 保存速度模型文件（如果有）
            velocity_path = None
            if velocity_file:
                velocity_path = os.path.join(tmp_dir, "velocity_model.yaml")
                with open(velocity_path, 'wb') as f:
                    f.write(velocity_file.getvalue())
            
            # 加载数据
            try:
                loader = DataLoader(
                    stations_path=stations_path,
                    waveforms_dir=waveforms_dir,
                    velocity_model_path=velocity_path
                )
                loader.load_all()
                
                # 保存到 session_state
                st.session_state.stations = loader.stations
                st.session_state.waveforms = loader.waveforms
                st.session_state.velocity_model = loader.velocity_model
                st.session_state.load_errors = loader.load_errors
                st.session_state.load_warnings = loader.load_warnings
                st.session_state.data_loaded = True
                
                # 执行校验
                validator = DataValidator()
                st.session_state.validation_result = validator.validate_all(
                    st.session_state.stations,
                    st.session_state.waveforms,
                    st.session_state.velocity_model
                )
                
                st.success("✅ 数据加载成功！")
                st.rerun()
                
            except Exception as e:
                st.error(f"❌ 数据加载失败: {str(e)}")
    
    def _display_data_summary(self):
        """显示数据摘要"""
        st.subheader("📊 数据摘要")
        
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric("总台站数", len(st.session_state.stations))
        
        with col2:
            valid_stations = sum(1 for s in st.session_state.stations.values() if s.is_valid)
            st.metric("有效台站数", valid_stations)
        
        with col3:
            st.metric("总波形数", len(st.session_state.waveforms))
        
        with col4:
            valid_waveforms = sum(1 for w in st.session_state.waveforms.values() if w.is_valid)
            st.metric("有效波形数", valid_waveforms)
        
        # 显示台站表格
        st.subheader("📋 台站信息")
        stations_df = pd.DataFrame([
            s.to_dict() for s in st.session_state.stations.values()
        ])
        st.dataframe(stations_df, use_container_width=True)
        
        # 显示加载错误和警告
        if st.session_state.load_errors:
            st.subheader("❌ 加载错误")
            for error in st.session_state.load_errors:
                st.error(error)
        
        if st.session_state.load_warnings:
            st.subheader("⚠️ 加载警告")
            for warning in st.session_state.load_warnings:
                st.warning(warning)
    
    def _render_data_validation(self):
        """渲染数据校验页面"""
        st.markdown('<h2 class="section-header">✅ 数据校验</h2>', unsafe_allow_html=True)
        
        if not st.session_state.data_loaded:
            st.warning("请先在「数据导入」页面加载数据")
            return
        
        if st.session_state.validation_result is None:
            # 执行校验
            validator = DataValidator()
            st.session_state.validation_result = validator.validate_all(
                st.session_state.stations,
                st.session_state.waveforms,
                st.session_state.velocity_model
            )
        
        result = st.session_state.validation_result
        
        # 校验状态
        if result.is_valid:
            st.success("✅ 数据校验通过！")
        else:
            st.error("❌ 数据校验存在错误！")
        
        # 校验统计
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.metric("有效台站", result.n_valid_stations)
        
        with col2:
            st.metric("有效波形", result.n_valid_waveforms)
        
        with col3:
            status_color = "🟢" if result.is_valid else "🔴"
            st.metric(f"{status_color} 校验状态", "通过" if result.is_valid else "失败")
        
        # 详细信息
        st.subheader("📋 校验详情")
        
        tab1, tab2, tab3 = st.tabs(["错误", "警告", "信息"])
        
        with tab1:
            if result.errors:
                for error in result.errors:
                    st.error(f"❌ {error}")
            else:
                st.success("无错误")
        
        with tab2:
            if result.warnings:
                for warning in result.warnings:
                    st.warning(f"⚠️ {warning}")
            else:
                st.success("无警告")
        
        with tab3:
            if result.info:
                for info in result.info:
                    st.info(f"ℹ️ {info}")
            
            # 跨午夜检测
            if result.stations_with_cross_midnight:
                st.subheader("🌙 跨午夜检测")
                st.warning(
                    f"检测到 {len(result.stations_with_cross_midnight)} 个波形跨越午夜: "
                    f"{', '.join(result.stations_with_cross_midnight)}"
                )
                st.info("波形已自动处理，不影响拾取和定位")
            
            # 缺台站检测
            if result.n_missing_stations > 0:
                st.subheader("📭 缺台站检测")
                st.warning(
                    f"有 {result.n_missing_stations} 个波形没有对应的台站配置"
                )
            
            if result.n_missing_waveforms > 0:
                st.subheader("📭 缺波形检测")
                st.warning(
                    f"有 {result.n_missing_waveforms} 个台站没有对应的波形数据"
                )
        
        # 重新校验按钮
        if st.button("🔄 重新校验"):
            validator = DataValidator()
            st.session_state.validation_result = validator.validate_all(
                st.session_state.stations,
                st.session_state.waveforms,
                st.session_state.velocity_model
            )
            st.rerun()
    
    def _render_picking(self):
        """渲染P波拾取页面"""
        st.markdown('<h2 class="section-header">🔍 P波拾取</h2>', unsafe_allow_html=True)
        
        if not st.session_state.data_loaded:
            st.warning("请先在「数据导入」页面加载数据")
            return
        
        # 拾取参数
        st.subheader("⚙️ 拾取参数")
        
        col1, col2 = st.columns(2)
        
        with col1:
            method = st.radio(
                "拾取方法",
                ["STA/LTA 方法", "阈值方法"],
                index=0 if st.session_state.pick_method == 'sta_lta' else 1
            )
            st.session_state.pick_method = 'sta_lta' if method == "STA/LTA 方法" else 'threshold'
        
        with col2:
            if st.session_state.pick_method == 'sta_lta':
                st.write("STA/LTA 参数已在侧边栏设置")
            else:
                st.write("阈值方法参数已在侧边栏设置")
        
        # 执行拾取
        st.divider()
        col1, col2 = st.columns([1, 3])
        
        with col1:
            run_pick = st.button("🚀 执行P波拾取", type="primary", use_container_width=True)
        
        with col2:
            auto_review = st.checkbox("自动复核拾取质量", value=True)
        
        if run_pick:
            self._run_picking()
            st.success("✅ P波拾取完成！")
        
        # 显示拾取结果
        if st.session_state.pick_results:
            st.divider()
            self._display_pick_results()
    
    def _run_picking(self):
        """执行P波拾取"""
        # 创建拾取器
        if st.session_state.pick_method == 'sta_lta':
            picker = PWavePicker(
                method='sta_lta',
                sta_window=getattr(st.session_state, 'sta_window', DEFAULT_STA_WINDOW),
                lta_window=getattr(st.session_state, 'lta_window', DEFAULT_LTA_WINDOW),
                sta_lta_threshold=getattr(st.session_state, 'sta_lta_threshold', DEFAULT_STA_LTA_THRESHOLD)
            )
        else:
            picker = PWavePicker(
                method='threshold',
                threshold_multiplier=getattr(st.session_state, 'threshold_multiplier', DEFAULT_THRESHOLD_MULTIPLIER)
            )
        
        # 批量拾取
        st.session_state.pick_results = picker.pick_all(
            st.session_state.waveforms,
            method=st.session_state.pick_method
        )
        
        # 更新波形对象中的拾取信息
        for station_id, pick_result in st.session_state.pick_results.items():
            if station_id in st.session_state.waveforms:
                waveform = st.session_state.waveforms[station_id]
                if pick_result.is_valid():
                    waveform.p_pick_idx = pick_result.pick_idx
                    waveform.p_pick_time = pick_result.pick_time
                    waveform.p_pick_quality = pick_result.pick_quality
    
    def _display_pick_results(self):
        """显示拾取结果"""
        st.subheader("📊 拾取结果摘要")
        
        results = st.session_state.pick_results
        
        # 统计
        n_total = len(results)
        n_valid = sum(1 for r in results.values() if r.is_valid())
        avg_quality = np.mean([r.pick_quality for r in results.values() if r.is_valid()]) if n_valid > 0 else 0
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.metric("拾取总数", n_total)
        
        with col2:
            st.metric("有效拾取", n_valid)
        
        with col3:
            st.metric("平均质量", f"{avg_quality:.2f}")
        
        # 详细结果表格
        st.subheader("📋 详细结果")
        
        results_df = pd.DataFrame([
            {
                '台站ID': r.station_id,
                '拾取方法': r.method,
                '拾取索引': r.pick_idx,
                '拾取时间 (s)': f"{r.pick_time:.4f}" if r.pick_time else '-',
                '质量': f"{r.pick_quality:.2f}",
                '置信度': f"{r.confidence:.2f}",
                'SNR': f"{r.snr:.1f}",
                '有效': '✅' if r.is_valid() else '❌'
            }
            for r in results.values()
        ])
        
        st.dataframe(results_df, use_container_width=True)
        
        # 质量分布
        st.subheader("📈 质量分布")
        
        qualities = [r.pick_quality for r in results.values() if r.is_valid()]
        if qualities:
            fig, ax = plt.subplots(figsize=(10, 4))
            ax.hist(qualities, bins=10, range=(0, 1), edgecolor='black', alpha=0.7)
            ax.set_xlabel('拾取质量')
            ax.set_ylabel('数量')
            ax.set_title('P波拾取质量分布')
            ax.axvline(x=0.6, color='r', linestyle='--', label='质量阈值 (0.6)')
            ax.legend()
            st.pyplot(fig)
        else:
            st.warning("没有有效的拾取结果")
        
        # 台站选择（用于详细查看）
        st.subheader("🔍 详细查看")
        station_ids = sorted(results.keys())
        selected_station = st.selectbox(
            "选择台站查看详细拾取信息",
            options=['请选择...'] + station_ids
        )
        
        if selected_station != '请选择...':
            self._display_pick_detail(selected_station)
    
    def _display_pick_detail(self, station_id: str):
        """显示单个台站的拾取详情"""
        result = st.session_state.pick_results.get(station_id)
        waveform = st.session_state.waveforms.get(station_id)
        
        if not result or not waveform:
            st.error(f"找不到台站 {station_id} 的数据")
            return
        
        col1, col2 = st.columns([1, 2])
        
        with col1:
            st.subheader("📋 拾取信息")
            st.write(f"**台站ID:** {station_id}")
            st.write(f"**拾取方法:** {result.method}")
            st.write(f"**拾取索引:** {result.pick_idx}")
            st.write(f"**拾取时间:** {result.pick_time:.4f} s")
            st.write(f"**质量:** {result.pick_quality:.2f}")
            st.write(f"**置信度:** {result.confidence:.2f}")
            st.write(f"**SNR:** {result.snr:.1f}")
            st.write(f"**噪声水平:** {result.pre_noise_level:.2e}")
            st.write(f"**信号水平:** {result.post_signal_level:.2e}")
        
        with col2:
            st.subheader("📈 波形图")
            
            # 准备绘图数据
            t = waveform.get_time_axis()
            data = waveform.data
            
            # 创建图表
            fig = go.Figure()
            
            # 波形数据
            fig.add_trace(go.Scatter(
                x=t,
                y=data,
                mode='lines',
                name='波形',
                line=dict(color='blue', width=1)
            ))
            
            # 拾取线
            if result.is_valid():
                pick_time = result.pick_time
                y_min, y_max = np.min(data), np.max(data)
                fig.add_vline(
                    x=pick_time,
                    line=dict(color='red', width=2, dash='dash'),
                    annotation_text=f'P波拾取 ({pick_time:.3f}s)',
                    annotation_position='top'
                )
            
            fig.update_layout(
                title=f'台站 {station_id} 波形与P波拾取',
                xaxis_title='时间 (s)',
                yaxis_title='振幅',
                height=400,
                showlegend=True
            )
            
            st.plotly_chart(fig, use_container_width=True)
            
            # 显示STA/LTA曲线（如果有）
            if result.sta_lta_curve is not None:
                st.subheader("📊 STA/LTA 曲线")
                
                fig_stalta = go.Figure()
                
                fig_stalta.add_trace(go.Scatter(
                    x=t,
                    y=result.sta_lta_curve,
                    mode='lines',
                    name='STA/LTA',
                    line=dict(color='green', width=1)
                ))
                
                # 阈值线
                threshold = getattr(st.session_state, 'sta_lta_threshold', DEFAULT_STA_LTA_THRESHOLD)
                fig_stalta.add_hline(
                    y=threshold,
                    line=dict(color='orange', width=2, dash='dash'),
                    annotation_text=f'阈值 ({threshold})',
                    annotation_position='right'
                )
                
                fig_stalta.update_layout(
                    title=f'STA/LTA 比值曲线',
                    xaxis_title='时间 (s)',
                    yaxis_title='STA/LTA 比值',
                    height=300
                )
                
                st.plotly_chart(fig_stalta, use_container_width=True)
    
    def _render_location(self):
        """渲染事件定位页面"""
        st.markdown('<h2 class="section-header">📍 事件定位</h2>', unsafe_allow_html=True)
        
        if not st.session_state.data_loaded:
            st.warning("请先在「数据导入」页面加载数据")
            return
        
        if not st.session_state.pick_results:
            st.warning("请先在「P波拾取」页面执行拾取")
            return
        
        # 检查有效台站数量
        valid_picks = {k: v for k, v in st.session_state.pick_results.items() if v.is_valid()}
        n_valid = len(valid_picks)
        
        if n_valid < MIN_STATIONS_FOR_LOCATION:
            st.error(
                f"有效拾取数量不足 (当前: {n_valid}, "
                f"定位需要至少 {MIN_STATIONS_FOR_LOCATION} 个)"
            )
            return
        
        # 定位参数
        st.subheader("⚙️ 定位参数")
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.metric("可用台站数", n_valid)
            st.metric("最小台站要求", MIN_STATIONS_FOR_LOCATION)
        
        with col2:
            if st.session_state.velocity_model:
                vm = st.session_state.velocity_model
                st.write(f"**速度模型:**")
                st.write(f"- P波速度: {vm.p_velocity} m/s")
                if vm.s_velocity:
                    st.write(f"- S波速度: {vm.s_velocity} m/s")
                if vm.is_layered:
                    st.write(f"- 分层数: {len(vm.layers)}")
            else:
                st.warning("使用默认速度模型 (5000 m/s)")
        
        # 执行定位
        st.divider()
        col1, col2 = st.columns([1, 3])
        
        with col1:
            run_location = st.button("🚀 执行事件定位", type="primary", use_container_width=True)
        
        with col2:
            event_id = st.text_input("事件ID (可选)", value="EVT_001")
        
        if run_location:
            self._run_location(event_id)
            st.success("✅ 事件定位完成！")
        
        # 显示定位结果
        if st.session_state.location_result:
            st.divider()
            self._display_location_result()
    
    def _run_location(self, event_id: str):
        """执行事件定位"""
        locator = EventLocator(
            velocity_model=st.session_state.velocity_model
        )
        
        result = locator.locate(
            stations=st.session_state.stations,
            pick_results=st.session_state.pick_results,
            waveforms=st.session_state.waveforms,
            event_id=event_id
        )
        
        st.session_state.location_result = result
        
        # 添加到事件列表
        if result.is_valid:
            event_data = result.to_dict()
            event_data['review_time'] = datetime.now().isoformat()
            st.session_state.events_data.append(event_data)
    
    def _display_location_result(self):
        """显示定位结果"""
        result = st.session_state.location_result
        
        # 定位状态
        if result.is_valid:
            st.success("✅ 定位成功！")
        else:
            st.error("❌ 定位失败！")
            return
        
        st.subheader("📊 定位结果摘要")
        
        # 主要结果
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric("X 坐标", f"{result.x:.2f} m")
            if not np.isnan(result.x_err):
                st.caption(f"误差: ±{result.x_err:.2f} m")
        
        with col2:
            st.metric("Y 坐标", f"{result.y:.2f} m")
            if not np.isnan(result.y_err):
                st.caption(f"误差: ±{result.y_err:.2f} m")
        
        with col3:
            st.metric("Z 坐标", f"{result.z:.2f} m")
            if not np.isnan(result.z_err):
                st.caption(f"误差: ±{result.z_err:.2f} m")
        
        with col4:
            st.metric("发震时刻", f"{result.origin_time:.4f} s")
            if result.absolute_origin_time:
                st.caption(f"绝对时间: {result.absolute_origin_time}")
        
        # 质量指标
        st.subheader("📋 质量指标")
        
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric("RMS 残差", f"{result.rms*1000:.2f} ms")
        
        with col2:
            st.metric("平均残差", f"{result.residual*1000:.2f} ms")
        
        with col3:
            st.metric("方位角间隙", f"{result.azimuthal_gap:.1f}°")
        
        with col4:
            quality_colors = {
                'A': '🟢',
                'B': '🟡',
                'C': '🟠',
                'D': '🔴'
            }
            st.metric(
                f"{quality_colors.get(result.quality_class, '⚪')} 质量等级",
                result.quality_class
            )
            st.caption(f"质量评分: {result.quality_score:.2f}")
        
        # 各台站残差
        st.subheader("📊 各台站残差")
        
        residuals_df = pd.DataFrame([
            {
                '台站ID': station_id,
                '到时 (s)': f"{arrival:.4f}",
                '残差 (ms)': f"{result.station_residuals[station_id]*1000:.2f}"
            }
            for station_id, arrival in result.station_arrivals.items()
        ])
        
        st.dataframe(residuals_df, use_container_width=True)
        
        # 残差图
        st.subheader("📈 残差分布")
        
        residuals = [r * 1000 for r in result.station_residuals.values()]
        station_ids = list(result.station_residuals.keys())
        
        fig, ax = plt.subplots(figsize=(10, 4))
        colors = ['green' if abs(r) < 50 else 'orange' if abs(r) < 100 else 'red' for r in residuals]
        ax.bar(station_ids, residuals, color=colors, alpha=0.7)
        ax.axhline(y=0, color='black', linestyle='-', linewidth=0.5)
        ax.axhline(y=50, color='orange', linestyle='--', linewidth=0.5)
        ax.axhline(y=-50, color='orange', linestyle='--', linewidth=0.5)
        ax.set_xlabel('台站ID')
        ax.set_ylabel('残差 (ms)')
        ax.set_title('各台站到时残差')
        plt.xticks(rotation=45)
        st.pyplot(fig)
        
        # 台站和事件位置图
        st.subheader("🗺️ 位置分布图")
        
        # 准备数据
        stations = st.session_state.stations
        event_x, event_y, event_z = result.x, result.y, result.z
        
        # 2D 平面图
        fig = go.Figure()
        
        # 台站位置
        station_x = [s.x for s in stations.values()]
        station_y = [s.y for s in stations.values()]
        station_ids = list(stations.keys())
        
        fig.add_trace(go.Scatter(
            x=station_x,
            y=station_y,
            mode='markers+text',
            name='台站',
            marker=dict(size=15, color='blue'),
            text=station_ids,
            textposition='top center'
        ))
        
        # 事件位置
        fig.add_trace(go.Scatter(
            x=[event_x],
            y=[event_y],
            mode='markers+text',
            name='事件',
            marker=dict(size=20, color='red', symbol='star'),
            text=['事件'],
            textposition='top center'
        ))
        
        # 连线（显示到时路径）
        for station_id, station in stations.items():
            if station_id in result.used_stations:
                fig.add_trace(go.Scatter(
                    x=[station.x, event_x],
                    y=[station.y, event_y],
                    mode='lines',
                    line=dict(color='gray', dash='dot'),
                    showlegend=False,
                    hoverinfo='none'
                ))
        
        fig.update_layout(
            title='台站与事件位置平面图 (X-Y)',
            xaxis_title='X 坐标 (m)',
            yaxis_title='Y 坐标 (m)',
            height=500,
            showlegend=True
        )
        
        st.plotly_chart(fig, use_container_width=True)
        
        # 深度剖面图
        st.subheader("🗺️ 深度剖面图 (X-Z)")
        
        fig_depth = go.Figure()
        
        # 台站
        fig_depth.add_trace(go.Scatter(
            x=station_x,
            y=[s.z for s in stations.values()],
            mode='markers+text',
            name='台站',
            marker=dict(size=15, color='blue'),
            text=station_ids,
            textposition='top center'
        ))
        
        # 事件
        fig_depth.add_trace(go.Scatter(
            x=[event_x],
            y=[event_z],
            mode='markers+text',
            name='事件',
            marker=dict(size=20, color='red', symbol='star'),
            text=['事件'],
            textposition='top center'
        ))
        
        fig_depth.update_layout(
            title='深度剖面图 (X-Z)',
            xaxis_title='X 坐标 (m)',
            yaxis_title='Z 坐标 (m)',
            height=400
        )
        
        st.plotly_chart(fig_depth, use_container_width=True)
    
    def _render_waveform_viewer(self):
        """渲染波形查看器页面"""
        st.markdown('<h2 class="section-header">📊 波形查看</h2>', unsafe_allow_html=True)
        
        if not st.session_state.data_loaded:
            st.warning("请先在「数据导入」页面加载数据")
            return
        
        waveforms = st.session_state.waveforms
        picks = st.session_state.pick_results
        
        # 台站选择
        st.subheader("🔍 选择台站")
        
        station_ids = sorted(waveforms.keys())
        
        # 多选
        selected_stations = st.multiselect(
            "选择要查看的台站 (可多选)",
            options=station_ids,
            default=station_ids[:min(4, len(station_ids))]
        )
        
        if not selected_stations:
            st.warning("请至少选择一个台站")
            return
        
        # 显示选项
        st.subheader("⚙️ 显示选项")
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            show_picks = st.checkbox("显示P波拾取", value=True if picks else False)
        
        with col2:
            normalize = st.checkbox("归一化波形", value=False)
        
        with col3:
            time_range = st.slider(
                "时间范围 (秒)",
                min_value=0.1,
                max_value=5.0,
                value=2.0,
                step=0.1
            )
        
        # 绘制波形
        st.subheader("📈 波形图")
        
        n_stations = len(selected_stations)
        
        # 使用 Plotly 绘制子图
        fig = make_subplots(
            rows=n_stations,
            cols=1,
            shared_xaxes=True,
            vertical_spacing=0.05,
            subplot_titles=[f'台站 {sid}' for sid in selected_stations]
        )
        
        for i, station_id in enumerate(selected_stations):
            waveform = waveforms.get(station_id)
            if not waveform:
                continue
            
            t = waveform.get_time_axis()
            data = waveform.data
            
            # 应用时间范围
            mask = t <= time_range
            t_plot = t[mask]
            data_plot = data[mask]
            
            # 归一化
            if normalize and len(data_plot) > 0:
                max_val = np.max(np.abs(data_plot))
                if max_val > 0:
                    data_plot = data_plot / max_val
            
            # 绘制波形
            fig.add_trace(
                go.Scatter(
                    x=t_plot,
                    y=data_plot,
                    mode='lines',
                    name=station_id,
                    line=dict(color='blue', width=1)
                ),
                row=i+1,
                col=1
            )
            
            # 绘制拾取线
            if show_picks and station_id in picks:
                pick = picks[station_id]
                if pick.is_valid() and pick.pick_time <= time_range:
                    fig.add_vline(
                        x=pick.pick_time,
                        line=dict(color='red', width=2, dash='dash'),
                        row=i+1,
                        col=1
                    )
                    
                    # 添加拾取质量标注
                    y_min, y_max = np.min(data_plot), np.max(data_plot)
                    fig.add_annotation(
                        x=pick.pick_time,
                        y=y_max * 0.9,
                        text=f"Q:{pick.pick_quality:.2f}",
                        showarrow=False,
                        row=i+1,
                        col=1
                    )
        
        fig.update_layout(
            height=200 * n_stations,
            showlegend=False,
            title_text="多台站波形对比"
        )
        
        fig.update_xaxes(title_text='时间 (s)', row=n_stations, col=1)
        
        st.plotly_chart(fig, use_container_width=True)
        
        # 单台站详细查看
        st.divider()
        st.subheader("🔍 单台站详细查看")
        
        detail_station = st.selectbox(
            "选择台站进行详细查看",
            options=['请选择...'] + selected_stations
        )
        
        if detail_station != '请选择...':
            self._display_detailed_waveform(detail_station)
    
    def _display_detailed_waveform(self, station_id: str):
        """显示单个台站的详细波形"""
        waveform = st.session_state.waveforms.get(station_id)
        pick = st.session_state.pick_results.get(station_id)
        
        if not waveform:
            st.error(f"找不到台站 {station_id} 的波形数据")
            return
        
        t = waveform.get_time_axis()
        data = waveform.data
        
        # 如果有拾取，放大显示
        if pick and pick.is_valid():
            pick_time = pick.pick_time
            
            # 计算放大范围
            from config import DEFAULT_TIME_ZOOM_BEFORE, DEFAULT_TIME_ZOOM_AFTER
            zoom_before = DEFAULT_TIME_ZOOM_BEFORE
            zoom_after = DEFAULT_TIME_ZOOM_AFTER
            
            t_zoom_start = max(0, pick_time - zoom_before)
            t_zoom_end = pick_time + zoom_after
            
            # 显示放大图
            st.subheader(f"📊 {station_id} - 拾取附近放大视图")
            
            mask_zoom = (t >= t_zoom_start) & (t <= t_zoom_end)
            t_zoom = t[mask_zoom]
            data_zoom = data[mask_zoom]
            
            fig = go.Figure()
            
            fig.add_trace(go.Scatter(
                x=t_zoom,
                y=data_zoom,
                mode='lines+markers',
                name='波形',
                line=dict(color='blue', width=2),
                marker=dict(size=4)
            ))
            
            # 拾取线
            fig.add_vline(
                x=pick_time,
                line=dict(color='red', width=3, dash='dash'),
                annotation_text=f'P波拾取 ({pick_time:.4f}s)',
                annotation_position='top'
            )
            
            fig.update_layout(
                title=f'台站 {station_id} - P波拾取附近细节',
                xaxis_title='时间 (s)',
                yaxis_title='振幅',
                height=400
            )
            
            st.plotly_chart(fig, use_container_width=True)
            
            # 显示拾取信息
            col1, col2, col3, col4 = st.columns(4)
            
            with col1:
                st.metric("拾取时间", f"{pick_time:.4f} s")
            
            with col2:
                st.metric("质量", f"{pick.pick_quality:.2f}")
            
            with col3:
                st.metric("置信度", f"{pick.confidence:.2f}")
            
            with col4:
                st.metric("SNR", f"{pick.snr:.1f}")
        
        # 完整波形
        st.subheader(f"📊 {station_id} - 完整波形")
        
        fig_full = go.Figure()
        
        fig_full.add_trace(go.Scatter(
            x=t,
            y=data,
            mode='lines',
            name='波形',
            line=dict(color='blue', width=1)
        ))
        
        if pick and pick.is_valid():
            fig_full.add_vline(
                x=pick.pick_time,
                line=dict(color='red', width=2, dash='dash')
            )
        
        fig_full.update_layout(
            title=f'台站 {station_id} - 完整波形',
            xaxis_title='时间 (s)',
            yaxis_title='振幅',
            height=400
        )
        
        st.plotly_chart(fig_full, use_container_width=True)
        
        # 波形信息
        st.subheader("📋 波形信息")
        
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric("采样率", f"{waveform.sampling_rate} Hz")
        
        with col2:
            st.metric("采样点数", len(data))
        
        with col3:
            st.metric("时长", f"{len(data) * waveform.dt:.2f} s")
        
        with col4:
            if waveform.start_time:
                st.metric("起始时间", waveform.start_time.strftime("%Y-%m-%d %H:%M:%S"))
            else:
                st.metric("起始时间", "未知")
        
        # 统计信息
        st.subheader("📊 统计信息")
        
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric("均值", f"{np.mean(data):.2e}")
        
        with col2:
            st.metric("标准差", f"{np.std(data):.2e}")
        
        with col3:
            st.metric("最大值", f"{np.max(data):.2e}")
        
        with col4:
            st.metric("最小值", f"{np.min(data):.2e}")
    
    def _render_export(self):
        """渲染导出页面"""
        st.markdown('<h2 class="section-header">📤 导出结果</h2>', unsafe_allow_html=True)
        
        if not st.session_state.data_loaded:
            st.warning("请先在「数据导入」页面加载数据")
            return
        
        # 复核评论
        st.subheader("📝 复核评论")
        
        review_comment = st.text_area(
            "添加复核评论 (可选)",
            placeholder="请输入复核意见..."
        )
        
        if st.button("💾 保存评论"):
            if review_comment:
                st.session_state.review_comments.append({
                    'time': datetime.now().isoformat(),
                    'comment': review_comment
                })
                st.success("评论已保存")
        
        # 显示已保存的评论
        if st.session_state.review_comments:
            st.subheader("📋 已保存的评论")
            for i, comment in enumerate(reversed(st.session_state.review_comments)):
                with st.expander(f"评论 {i+1} - {comment['time']}"):
                    st.write(comment['comment'])
        
        # 导出选项
        st.divider()
        st.subheader("📦 导出选项")
        
        col1, col2 = st.columns(2)
        
        with col1:
            export_events = st.checkbox("导出事件数据 (events.csv)", value=True)
        
        with col2:
            export_report = st.checkbox("导出复核报告 (review_report.md)", value=True)
        
        # 执行导出
        st.divider()
        
        if st.button("🚀 执行导出", type="primary", use_container_width=True):
            self._run_export(export_events, export_report)
    
    def _run_export(self, export_events: bool, export_report: bool):
        """执行导出"""
        # 创建输出目录
        output_dir = DEFAULT_OUTPUT_DIR
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        exported_files = []
        
        # 导出事件数据
        if export_events:
            events_csv = self._generate_events_csv()
            if events_csv:
                csv_path = os.path.join(output_dir, "events.csv")
                with open(csv_path, 'w') as f:
                    f.write(events_csv)
                exported_files.append(csv_path)
                
                st.download_button(
                    label="📥 下载 events.csv",
                    data=events_csv,
                    file_name="events.csv",
                    mime="text/csv"
                )
        
        # 导出复核报告
        if export_report:
            report_md = self._generate_report_md()
            if report_md:
                report_path = os.path.join(output_dir, "review_report.md")
                with open(report_path, 'w') as f:
                    f.write(report_md)
                exported_files.append(report_path)
                
                st.download_button(
                    label="📥 下载 review_report.md",
                    data=report_md,
                    file_name="review_report.md",
                    mime="text/markdown"
                )
        
        if exported_files:
            st.success(f"✅ 导出完成！共导出 {len(exported_files)} 个文件")
            for f in exported_files:
                st.info(f"  - {f}")
        else:
            st.warning("没有数据可导出")
    
    def _generate_events_csv(self) -> str:
        """生成 events.csv 内容"""
        events = st.session_state.events_data
        result = st.session_state.location_result
        
        # 如果没有事件列表但有当前结果，添加进去
        if not events and result and result.is_valid:
            event_data = result.to_dict()
            event_data['review_time'] = datetime.now().isoformat()
            events = [event_data]
        
        if not events:
            return ""
        
        # 转换为 DataFrame
        df = pd.DataFrame(events)
        
        # 转换为 CSV
        return df.to_csv(index=False)
    
    def _generate_report_md(self) -> str:
        """生成复核报告 Markdown 内容"""
        result = st.session_state.location_result
        
        lines = []
        lines.append("# 微震事件复核报告")
        lines.append("")
        lines.append(f"**生成时间:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 数据摘要
        lines.append("## 1. 数据摘要")
        lines.append("")
        lines.append(f"- **台站数量:** {len(st.session_state.stations)}")
        lines.append(f"- **波形数量:** {len(st.session_state.waveforms)}")
        
        valid_stations = sum(1 for s in st.session_state.stations.values() if s.is_valid)
        valid_waveforms = sum(1 for w in st.session_state.waveforms.values() if w.is_valid)
        lines.append(f"- **有效台站:** {valid_stations}")
        lines.append(f"- **有效波形:** {valid_waveforms}")
        lines.append("")
        
        # 台站信息
        lines.append("### 1.1 台站信息")
        lines.append("")
        lines.append("| 台站ID | X坐标 | Y坐标 | Z坐标 | 采样率 |")
        lines.append("|--------|-------|-------|-------|--------|")
        
        for station_id, station in st.session_state.stations.items():
            lines.append(f"| {station_id} | {station.x:.2f} | {station.y:.2f} | {station.z:.2f} | {station.sampling_rate} Hz |")
        lines.append("")
        
        # P波拾取结果
        lines.append("## 2. P波拾取结果")
        lines.append("")
        
        if st.session_state.pick_results:
            lines.append("### 2.1 拾取摘要")
            lines.append("")
            
            n_valid = sum(1 for r in st.session_state.pick_results.values() if r.is_valid())
            avg_quality = np.mean([r.pick_quality for r in st.session_state.pick_results.values() if r.is_valid()]) if n_valid > 0 else 0
            
            lines.append(f"- **拾取总数:** {len(st.session_state.pick_results)}")
            lines.append(f"- **有效拾取:** {n_valid}")
            lines.append(f"- **平均质量:** {avg_quality:.2f}")
            lines.append("")
            
            lines.append("### 2.2 详细拾取结果")
            lines.append("")
            lines.append("| 台站ID | 拾取方法 | 拾取时间 | 质量 | 置信度 | SNR |")
            lines.append("|--------|----------|----------|------|--------|-----|")
            
            for station_id, pick in st.session_state.pick_results.items():
                if pick.is_valid():
                    lines.append(f"| {station_id} | {pick.method} | {pick.pick_time:.4f}s | {pick.pick_quality:.2f} | {pick.confidence:.2f} | {pick.snr:.1f} |")
                else:
                    lines.append(f"| {station_id} | {pick.method} | - | 0.00 | 0.00 | - |")
            lines.append("")
        else:
            lines.append("*未执行P波拾取*")
            lines.append("")
        
        # 定位结果
        lines.append("## 3. 事件定位结果")
        lines.append("")
        
        if result and result.is_valid:
            lines.append("### 3.1 定位坐标")
            lines.append("")
            lines.append(f"- **X坐标:** {result.x:.2f} m (±{result.x_err:.2f} m)" if not np.isnan(result.x_err) else f"- **X坐标:** {result.x:.2f} m")
            lines.append(f"- **Y坐标:** {result.y:.2f} m (±{result.y_err:.2f} m)" if not np.isnan(result.y_err) else f"- **Y坐标:** {result.y:.2f} m")
            lines.append(f"- **Z坐标:** {result.z:.2f} m (±{result.z_err:.2f} m)" if not np.isnan(result.z_err) else f"- **Z坐标:** {result.z:.2f} m")
            lines.append("")
            
            if result.absolute_origin_time:
                lines.append(f"- **绝对发震时刻:** {result.absolute_origin_time}")
            lines.append(f"- **相对发震时刻:** {result.origin_time:.4f} s")
            lines.append("")
            
            lines.append("### 3.2 质量指标")
            lines.append("")
            lines.append(f"- **RMS残差:** {result.rms*1000:.2f} ms")
            lines.append(f"- **平均残差:** {result.residual*1000:.2f} ms")
            lines.append(f"- **方位角间隙:** {result.azimuthal_gap:.1f}°")
            lines.append(f"- **使用台站数:** {result.n_used_stations}")
            lines.append(f"- **质量等级:** {result.quality_class} (评分: {result.quality_score:.2f})")
            lines.append("")
            
            lines.append("### 3.3 各台站残差")
            lines.append("")
            lines.append("| 台站ID | 到时 | 残差 |")
            lines.append("|--------|------|------|")
            
            for station_id, arrival in result.station_arrivals.items():
                residual = result.station_residuals.get(station_id, 0)
                lines.append(f"| {station_id} | {arrival:.4f}s | {residual*1000:.2f}ms |")
            lines.append("")
        else:
            lines.append("*未执行事件定位或定位失败*")
            lines.append("")
        
        # 复核评论
        if st.session_state.review_comments:
            lines.append("## 4. 复核评论")
            lines.append("")
            for comment in st.session_state.review_comments:
                lines.append(f"**[{comment['time']}]**")
                lines.append("")
                lines.append(f"{comment['comment']}")
                lines.append("")
        
        # 校验结果
        if st.session_state.validation_result:
            lines.append("## 5. 数据校验记录")
            lines.append("")
            
            vr = st.session_state.validation_result
            
            if vr.errors:
                lines.append("### 5.1 错误")
                lines.append("")
                for error in vr.errors:
                    lines.append(f"- ❌ {error}")
                lines.append("")
            
            if vr.warnings:
                lines.append("### 5.2 警告")
                lines.append("")
                for warning in vr.warnings:
                    lines.append(f"- ⚠️ {warning}")
                lines.append("")
        
        return "\n".join(lines)


def main():
    """主函数"""
    app = MicroseismicReviewApp()
    app.run()


if __name__ == "__main__":
    main()
