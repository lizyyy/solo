import streamlit as st
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import tempfile
import folium
from streamlit_folium import st_folium
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots

import sys
sys.path.insert(0, str(Path(__file__).parent))

from core.import_validator import DataImporter, ValidationResult
from core.matcher import DataMatcher, MatchResult, DuplicateGroup
from core.rule_engine import RuleEngine, EngineResult, RuleResult
from core.persistence import DataPersistence, WorkflowState
from exporters.exporter import DataExporter
import config

st.set_page_config(
    page_title="雨后井盖异响排查台",
    page_icon="🔧",
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
    .sub-header {
        font-size: 1.2rem;
        color: #555;
        text-align: center;
        margin-bottom: 2rem;
    }
    .risk-critical {
        background-color: #dc2626;
        color: white;
        padding: 0.2rem 0.5rem;
        border-radius: 0.3rem;
        font-weight: bold;
    }
    .risk-high {
        background-color: #ea580c;
        color: white;
        padding: 0.2rem 0.5rem;
        border-radius: 0.3rem;
        font-weight: bold;
    }
    .risk-medium {
        background-color: #ca8a04;
        color: white;
        padding: 0.2rem 0.5rem;
        border-radius: 0.3rem;
        font-weight: bold;
    }
    .risk-low {
        background-color: #16a34a;
        color: white;
        padding: 0.2rem 0.5rem;
        border-radius: 0.3rem;
        font-weight: bold;
    }
    .metric-card {
        background-color: #f8f9fa;
        border-radius: 0.5rem;
        padding: 1rem;
        text-align: center;
    }
    .metric-value {
        font-size: 2rem;
        font-weight: bold;
        color: #1f77b4;
    }
    .metric-label {
        font-size: 0.9rem;
        color: #666;
    }
</style>
""", unsafe_allow_html=True)


def init_session_state():
    if 'session_id' not in st.session_state:
        st.session_state.session_id = None
    
    if 'sensor_data' not in st.session_state:
        st.session_state.sensor_data = None
    
    if 'manual_data' not in st.session_state:
        st.session_state.manual_data = None
    
    if 'water_data' not in st.session_state:
        st.session_state.water_data = None
    
    if 'merged_data' not in st.session_state:
        st.session_state.merged_data = None
    
    if 'validation_results' not in st.session_state:
        st.session_state.validation_results = {}
    
    if 'match_result' not in st.session_state:
        st.session_state.match_result = None
    
    if 'engine_result' not in st.session_state:
        st.session_state.engine_result = None
    
    if 'duplicate_groups' not in st.session_state:
        st.session_state.duplicate_groups = []
    
    if 'workflow_state' not in st.session_state:
        st.session_state.workflow_state = None
    
    if 'persistence' not in st.session_state:
        st.session_state.persistence = DataPersistence(config.DATA_DIR, config.EXPORTS_DIR)
    
    if 'exporter' not in st.session_state:
        st.session_state.exporter = DataExporter(config.EXPORTS_DIR)
    
    if 'active_page' not in st.session_state:
        st.session_state.active_page = "数据导入"


def render_header():
    st.markdown('<h1 class="main-header">🔧 雨后井盖异响排查台</h1>', unsafe_allow_html=True)
    st.markdown('<p class="sub-header">城市排水巡检员数据分析可视化工具</p>', unsafe_allow_html=True)


def render_sidebar():
    with st.sidebar:
        st.header("导航")
        
        pages = [
            "数据导入",
            "数据校验",
            "匹配分析",
            "规则引擎",
            "风险分层",
            "异响趋势",
            "待复核清单",
            "重复合并",
            "导出中心"
        ]
        
        selected_page = st.radio("选择页面", pages, index=pages.index(st.session_state.active_page))
        st.session_state.active_page = selected_page
        
        st.divider()
        
        st.subheader("会话管理")
        
        if st.session_state.session_id:
            st.success(f"当前会话: {st.session_state.session_id}")
            
            if st.button("保存当前状态"):
                if st.session_state.workflow_state:
                    st.session_state.persistence.save_workflow_state(st.session_state.workflow_state)
                    st.success("状态已保存！")
        
        sessions = st.session_state.persistence.list_workflow_sessions()
        if sessions:
            st.subheader("历史会话")
            session_options = ["新建会话"] + [s["session_id"] for s in sessions]
            selected = st.selectbox("加载历史会话", session_options)
            
            if selected != "新建会话" and selected != st.session_state.session_id:
                load_state = st.session_state.persistence.load_workflow_state(selected)
                if load_state:
                    st.session_state.workflow_state = load_state
                    st.session_state.session_id = selected
                    st.success(f"已加载会话: {selected}")
        
        st.divider()
        
        st.info("提示: 导入数据后会自动创建新会话")


def render_data_import():
    st.header("📥 数据导入")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.subheader("传感器数据 (CSV)")
        sensor_file = st.file_uploader("上传井盖传感器 CSV", type=["csv"], key="sensor_upload")
        
        if sensor_file:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as tmp:
                tmp.write(sensor_file.getvalue())
                tmp_path = Path(tmp.name)
            
            try:
                importer = DataImporter(config.__dict__)
                result = importer.import_sensor_csv(tmp_path)
                
                st.session_state.sensor_data = result.valid_rows
                st.session_state.validation_results['sensor'] = result
                
                st.success(f"✅ 成功导入 {len(result.valid_rows)} 条传感器数据")
                
                if result.has_errors:
                    st.warning(f"⚠️ 发现 {len(result.errors)} 个错误")
                    with st.expander("查看错误详情"):
                        for error in result.errors[:10]:
                            st.error(f"行 {error.row_index}: {error.column} - {error.message}")
                
                tmp_path.unlink()
            except Exception as e:
                st.error(f"导入失败: {e}")
        
        if st.session_state.sensor_data is not None:
            st.dataframe(st.session_state.sensor_data.head(), use_container_width=True)
    
    with col2:
        st.subheader("人工巡检数据 (CSV)")
        manual_file = st.file_uploader("上传人工巡检 CSV", type=["csv"], key="manual_upload")
        
        if manual_file:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as tmp:
                tmp.write(manual_file.getvalue())
                tmp_path = Path(tmp.name)
            
            try:
                importer = DataImporter(config.__dict__)
                result = importer.import_manual_csv(tmp_path)
                
                st.session_state.manual_data = result.valid_rows
                st.session_state.validation_results['manual'] = result
                
                st.success(f"✅ 成功导入 {len(result.valid_rows)} 条人工巡检数据")
                
                if result.has_errors:
                    st.warning(f"⚠️ 发现 {len(result.errors)} 个错误")
                
                tmp_path.unlink()
            except Exception as e:
                st.error(f"导入失败: {e}")
        
        if st.session_state.manual_data is not None:
            st.dataframe(st.session_state.manual_data.head(), use_container_width=True)
    
    with col3:
        st.subheader("积水点位数据 (GeoJSON)")
        water_file = st.file_uploader("上传积水点位 GeoJSON", type=["geojson", "json"], key="water_upload")
        
        if water_file:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.geojson') as tmp:
                tmp.write(water_file.getvalue())
                tmp_path = Path(tmp.name)
            
            try:
                importer = DataImporter(config.__dict__)
                result = importer.import_water_geojson(tmp_path)
                
                st.session_state.water_data = result.valid_rows
                st.session_state.validation_results['water'] = result
                
                st.success(f"✅ 成功导入 {len(result.valid_rows)} 个积水点位")
                
                tmp_path.unlink()
            except Exception as e:
                st.error(f"导入失败: {e}")
        
        if st.session_state.water_data is not None:
            st.dataframe(st.session_state.water_data.head(), use_container_width=True)
    
    st.divider()
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("样例数据")
        if st.button("加载样例数据"):
            load_sample_data()
            st.success("样例数据已加载！")
    
    with col2:
        st.subheader("会话初始化")
        if st.button("创建新会话"):
            if not st.session_state.session_id:
                workflow = st.session_state.persistence.create_new_session()
                st.session_state.workflow_state = workflow
                st.session_state.session_id = workflow.session_id
                st.success(f"新会话已创建: {workflow.session_id}")


def load_sample_data():
    sensor_data = pd.DataFrame([
        {
            "井盖编号": "MH-001",
            "经度": 118.8,
            "纬度": 31.0,
            "记录时间": "2024-05-01 08:30:00",
            "异响次数": 5,
            "振动强度": 3.5,
            "传感器状态": "正常",
            "街区": "中心城区"
        },
        {
            "井盖编号": "MH-002",
            "经度": 118.81,
            "纬度": 31.01,
            "记录时间": "2024-05-01 08:45:00",
            "异响次数": 3,
            "振动强度": 2.8,
            "传感器状态": "正常",
            "街区": "中心城区"
        },
        {
            "井盖编号": "S-003",
            "经度": 118.9,
            "纬度": 31.1,
            "记录时间": "2024-05-01 09:00:00",
            "异响次数": 8,
            "振动强度": 4.2,
            "传感器状态": "告警",
            "街区": "北部新城"
        },
        {
            "井盖编号": "MH-004",
            "经度": 118.7,
            "纬度": 30.9,
            "记录时间": "2024-05-01 09:15:00",
            "异响次数": 2,
            "振动强度": 1.5,
            "传感器状态": "正常",
            "街区": "南部新区"
        },
        {
            "井盖编号": "SS-005",
            "经度": 118.95,
            "纬度": 31.05,
            "记录时间": "2024-05-01 09:30:00",
            "异响次数": 6,
            "振动强度": 3.9,
            "传感器状态": "告警",
            "街区": "东部工业区"
        }
    ])
    
    manual_data = pd.DataFrame([
        {
            "井盖编号": "井盖-001",
            "经度": 118.8,
            "纬度": 31.0,
            "巡检时间": "2024-05-01 09:00:00",
            "异响情况": "有异响",
            "积水深度": 15,
            "巡检员": "张三",
            "状态": "待复核",
            "街区": "中心城区"
        },
        {
            "井盖编号": "井盖编号-002",
            "经度": 118.81,
            "纬度": 31.01,
            "巡检时间": "2024-05-01 09:15:00",
            "异响情况": "无异响",
            "积水深度": 0,
            "巡检员": "张三",
            "状态": "已复核",
            "街区": "中心城区"
        },
        {
            "井盖编号": "JH-003",
            "经度": 118.9,
            "纬度": 31.1,
            "巡检时间": "2024-05-01 09:30:00",
            "异响情况": "有异响",
            "积水深度": 30,
            "巡检员": "李四",
            "状态": "待复核",
            "街区": "北部新城"
        },
        {
            "井盖编号": "JG-006",
            "经度": 118.75,
            "纬度": 30.95,
            "巡检时间": "2024-05-01 09:45:00",
            "异响情况": "有异响",
            "积水深度": 20,
            "巡检员": "王五",
            "状态": "待复核",
            "街区": "南部新区"
        }
    ])
    
    water_data = pd.DataFrame([
        {
            "经度": 118.805,
            "纬度": 31.005,
            "积水深度": 25,
            "积水半径": 60,
            "发生时间": "2024-05-01 07:00:00",
            "严重程度": "严重",
            "街区": "中心城区"
        },
        {
            "经度": 118.902,
            "纬度": 31.102,
            "积水深度": 40,
            "积水半径": 80,
            "发生时间": "2024-05-01 06:30:00",
            "严重程度": "特别严重",
            "街区": "北部新城"
        }
    ])
    
    importer = DataImporter(config.__dict__)
    
    st.session_state.sensor_data = importer._normalize_sensor_data(sensor_data)
    st.session_state.manual_data = importer._normalize_manual_data(manual_data)
    st.session_state.water_data = importer._normalize_water_data(water_data)
    
    workflow = st.session_state.persistence.create_new_session()
    st.session_state.workflow_state = workflow
    st.session_state.session_id = workflow.session_id


def render_data_validation():
    st.header("✅ 数据校验")
    
    if 'sensor' not in st.session_state.validation_results and \
       'manual' not in st.session_state.validation_results and \
       'water' not in st.session_state.validation_results:
        st.info("请先导入数据")
        return
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.subheader("传感器数据校验")
        if 'sensor' in st.session_state.validation_results:
            result = st.session_state.validation_results['sensor']
            
            st.metric("有效记录", len(result.valid_rows))
            st.metric("无效记录", len(result.invalid_rows))
            st.metric("错误数量", len(result.errors))
            
            if result.has_errors:
                st.subheader("错误汇总")
                for error_type, count in result.error_summary.items():
                    st.write(f"- {error_type}: {count} 个")
                
                with st.expander("查看详细错误"):
                    for error in result.errors:
                        st.error(f"行 {error.row_index} | {error.column} | {error.error_type}: {error.message}")
        else:
            st.info("未上传传感器数据")
    
    with col2:
        st.subheader("人工巡检数据校验")
        if 'manual' in st.session_state.validation_results:
            result = st.session_state.validation_results['manual']
            
            st.metric("有效记录", len(result.valid_rows))
            st.metric("无效记录", len(result.invalid_rows))
            st.metric("错误数量", len(result.errors))
            
            if result.has_errors:
                st.subheader("错误汇总")
                for error_type, count in result.error_summary.items():
                    st.write(f"- {error_type}: {count} 个")
        else:
            st.info("未上传人工巡检数据")
    
    with col3:
        st.subheader("积水点位数据校验")
        if 'water' in st.session_state.validation_results:
            result = st.session_state.validation_results['water']
            
            st.metric("有效记录", len(result.valid_rows))
            st.metric("无效记录", len(result.invalid_rows))
            st.metric("错误数量", len(result.errors))
        else:
            st.info("未上传积水点位数据")
    
    st.divider()
    
    st.subheader("坐标范围校验")
    
    all_valid = True
    coord_data = []
    
    if st.session_state.sensor_data is not None:
        for _, row in st.session_state.sensor_data.iterrows():
            coord_data.append({
                "类型": "传感器",
                "编号": row.get("井盖编号", ""),
                "经度": row.get("经度", 0),
                "纬度": row.get("纬度", 0),
                "街区": row.get("街区", "未知")
            })
    
    if st.session_state.manual_data is not None:
        for _, row in st.session_state.manual_data.iterrows():
            coord_data.append({
                "类型": "人工巡检",
                "编号": row.get("井盖编号", ""),
                "经度": row.get("经度", 0),
                "纬度": row.get("纬度", 0),
                "街区": row.get("街区", "未知")
            })
    
    if coord_data:
        coord_df = pd.DataFrame(coord_data)
        
        st.write(f"坐标范围检查 (设定范围: 经度 {config.COORDINATE_BOUNDS['min_lon']}-{config.COORDINATE_BOUNDS['max_lon']}, 纬度 {config.COORDINATE_BOUNDS['min_lat']}-{config.COORDINATE_BOUNDS['max_lat']})")
        
        fig = px.scatter_mapbox(
            coord_df,
            lat="纬度",
            lon="经度",
            color="类型",
            hover_name="编号",
            hover_data=["街区"],
            zoom=10,
            height=400
        )
        
        fig.update_layout(mapbox_style="carto-positron")
        st.plotly_chart(fig, use_container_width=True)


def render_matching():
    st.header("🔗 匹配分析")
    
    if st.session_state.sensor_data is None or st.session_state.manual_data is None:
        st.info("需要同时导入传感器数据和人工巡检数据")
        return
    
    if st.button("执行匹配分析") or st.session_state.match_result is None:
        matcher = DataMatcher(config.__dict__)
        st.session_state.match_result = matcher.match_sensor_manual(
            st.session_state.sensor_data,
            st.session_state.manual_data
        )
        
        all_records = pd.concat([
            st.session_state.sensor_data,
            st.session_state.manual_data
        ], ignore_index=True)
        st.session_state.duplicate_groups = matcher.find_duplicates(all_records)
        
        st.session_state.merged_data = st.session_state.match_result.merged_records
        
        st.session_state.persistence.save_merged_data(st.session_state.merged_data)
        
        st.success("匹配分析完成！")
    
    result = st.session_state.match_result
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric("成功匹配", result.matched_count)
    
    with col2:
        st.metric("未匹配传感器", len(result.unmatched_sensor))
    
    with col3:
        st.metric("未匹配人工巡检", len(result.unmatched_manual))
    
    st.divider()
    
    tab1, tab2, tab3, tab4 = st.tabs(["匹配详情", "匹配详情列表", "未匹配传感器", "未匹配人工巡检"])
    
    with tab1:
        if result.match_details:
            st.subheader("匹配详情")
            details_df = pd.DataFrame(result.match_details)
            st.dataframe(details_df, use_container_width=True)
        
        if st.session_state.duplicate_groups:
            st.subheader(f"发现 {len(st.session_state.duplicate_groups)} 组潜在重复记录")
            
            for group in st.session_state.duplicate_groups:
                with st.expander(f"群组 {group.group_id} ({len(group.records)} 条记录)"):
                    st.code(group.merge_suggestion)
                    
                    for i, record in enumerate(group.records):
                        st.write(f"记录 {i+1}: {record.get('井盖编号', '未知')}")
                        st.write(f"  - 坐标: ({record.get('纬度', 0)}, {record.get('经度', 0)})")
                        st.write(f"  - 异响次数: {record.get('异响次数', 0)}")
    
    with tab2:
        if not st.session_state.merged_data.empty:
            st.dataframe(st.session_state.merged_data, use_container_width=True)
        else:
            st.info("暂无匹配数据")
    
    with tab3:
        if result.unmatched_sensor:
            unmatched_df = pd.DataFrame(result.unmatched_sensor)
            st.dataframe(unmatched_df, use_container_width=True)
        else:
            st.info("所有传感器数据都已匹配")
    
    with tab4:
        if result.unmatched_manual:
            unmatched_df = pd.DataFrame(result.unmatched_manual)
            st.dataframe(unmatched_df, use_container_width=True)
        else:
            st.info("所有人工巡检数据都已匹配")


def render_rule_engine():
    st.header("⚙️ 规则引擎")
    
    if st.session_state.merged_data is None:
        st.info("请先执行匹配分析")
        return
    
    col1, col2 = st.columns(2)
    
    with col1:
        storm_time = st.date_input("暴雨发生日期", value=datetime.now().date())
        storm_time = datetime.combine(storm_time, datetime.min.time())
    
    with col2:
        current_time = st.datetime_input("当前时间", value=datetime.now())
    
    if st.button("运行规则引擎") or st.session_state.engine_result is None:
        engine = RuleEngine(config.__dict__)
        
        st.session_state.engine_result = engine.run_all_rules(
            st.session_state.merged_data,
            st.session_state.water_data,
            storm_time=storm_time,
            current_time=current_time,
            reviewed_ids=st.session_state.workflow_state.reviewed_ids if st.session_state.workflow_state else []
        )
        
        st.success(f"规则引擎运行完成！触发 {st.session_state.engine_result.triggered_rules} 条规则")
    
    result = st.session_state.engine_result
    
    st.divider()
    
    col1, col2, col3, col4 = st.columns(4)
    
    risk_colors = {
        "critical": "#DC2626",
        "high": "#EA580C",
        "medium": "#CA8A04",
        "low": "#16A34A"
    }
    
    with col1:
        critical_count = result.risk_summary.get('critical', 0)
        st.metric("极高风险", critical_count)
    
    with col2:
        high_count = result.risk_summary.get('high', 0)
        st.metric("高风险", high_count)
    
    with col3:
        medium_count = result.risk_summary.get('medium', 0)
        st.metric("中风险", medium_count)
    
    with col4:
        low_count = result.risk_summary.get('low', 0)
        st.metric("低风险", low_count)
    
    st.divider()
    
    tab1, tab2, tab3 = st.tabs(["规则统计", "触发详情", "高风险记录"])
    
    with tab1:
        st.subheader("规则触发统计")
        stats_data = []
        for rule_key, rule_info in result.rules_statistics.items():
            stats_data.append({
                "规则ID": rule_info['rule_id'],
                "规则名称": rule_info['rule_name'],
                "触发次数": rule_info['triggered_count'],
                "描述": rule_info['description']
            })
        
        stats_df = pd.DataFrame(stats_data)
        st.dataframe(stats_df, use_container_width=True)
        
        fig = px.bar(
            stats_df,
            x="规则名称",
            y="触发次数",
            color="触发次数",
            color_continuous_scale="Reds",
            title="规则触发分布"
        )
        st.plotly_chart(fig, use_container_width=True)
    
    with tab2:
        if result.rule_results:
            for rule_result in result.rule_results:
                with st.expander(f"{rule_result.rule_name} - {rule_result.manhole_id} (置信度: {rule_result.confidence:.2f})"):
                    st.write(f"**规则ID**: {rule_result.rule_id}")
                    st.write(f"**风险评分**: {rule_result.risk_score}")
                    st.write(f"**详情**:")
                    st.json(rule_result.details)
    
    with tab3:
        if not result.high_risk_records.empty:
            st.dataframe(result.high_risk_records, use_container_width=True)
        else:
            st.info("暂无高风险记录")


def render_risk_layer():
    st.header("📊 风险分层")
    
    if st.session_state.engine_result is None:
        st.info("请先运行规则引擎")
        return
    
    result = st.session_state.engine_result
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("风险分布")
        
        risk_data = []
        for level, count in result.risk_summary.items():
            level_name = {
                "critical": "极高风险",
                "high": "高风险",
                "medium": "中风险",
                "low": "低风险"
            }.get(level, level)
            
            risk_data.append({
                "风险等级": level_name,
                "数量": count,
                "等级代码": level
            })
        
        risk_df = pd.DataFrame(risk_data)
        
        color_map = {
            "极高风险": "#DC2626",
            "高风险": "#EA580C",
            "中风险": "#CA8A04",
            "低风险": "#16A34A"
        }
        
        fig = px.pie(
            risk_df,
            values="数量",
            names="风险等级",
            color="风险等级",
            color_discrete_map=color_map,
            title="风险等级分布"
        )
        st.plotly_chart(fig, use_container_width=True)
    
    with col2:
        st.subheader("按街区风险分布")
        
        if not result.high_risk_records.empty and "街区" in result.high_risk_records.columns:
            block_risk = result.high_risk_records.groupby(["街区", "风险等级"]).size().unstack(fill_value=0)
            
            fig = px.bar(
                block_risk,
                barmode="stack",
                title="各街区风险分布",
                color_discrete_map={
                    "critical": "#DC2626",
                    "high": "#EA580C",
                    "medium": "#CA8A04",
                    "low": "#16A34A"
                }
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("暂无街区数据")
    
    st.divider()
    
    st.subheader("风险地图")
    
    if not result.high_risk_records.empty and "纬度" in result.high_risk_records.columns:
        map_data = result.high_risk_records.copy()
        
        def get_risk_color(risk_level):
            return {
                "critical": "#DC2626",
                "high": "#EA580C",
                "medium": "#CA8A04",
                "low": "#16A34A"
            }.get(risk_level, "#666666")
        
        center_lat = map_data["纬度"].mean() if not map_data.empty else 31.0
        center_lon = map_data["经度"].mean() if not map_data.empty else 118.8
        
        m = folium.Map(location=[center_lat, center_lon], zoom_start=12)
        
        for _, row in map_data.iterrows():
            color = get_risk_color(row.get("风险等级", "low"))
            popup_text = f"""
            <b>井盖编号:</b> {row.get('井盖编号', '未知')}<br>
            <b>风险等级:</b> {row.get('风险等级', '未知')}<br>
            <b>风险评分:</b> {row.get('风险评分', 0)}<br>
            <b>触发规则:</b> {row.get('触发规则列表', '')}
            """
            
            folium.CircleMarker(
                location=[row["纬度"], row["经度"]],
                radius=10,
                popup=folium.Popup(popup_text, max_width=300),
                color=color,
                fill=True,
                fill_color=color,
                fill_opacity=0.7
            ).add_to(m)
        
        if st.session_state.water_data is not None:
            for _, row in st.session_state.water_data.iterrows():
                popup_text = f"""
                <b>积水点</b><br>
                <b>深度:</b> {row.get('积水深度', 0)} cm<br>
                <b>半径:</b> {row.get('积水半径', 0)} m<br>
                <b>严重程度:</b> {row.get('严重程度', '未知')}
                """
                
                folium.Circle(
                    location=[row["纬度"], row["经度"]],
                    radius=row.get("积水半径", 50),
                    popup=folium.Popup(popup_text, max_width=200),
                    color="#0066CC",
                    fill=True,
                    fill_color="#0066CC",
                    fill_opacity=0.2
                ).add_to(m)
        
        st_folium(m, width=1000, height=500)


def render_trend():
    st.header("📈 异响趋势")
    
    if st.session_state.merged_data is None:
        st.info("请先执行匹配分析")
        return
    
    df = st.session_state.merged_data.copy()
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("异响次数分布")
        
        if "异响次数" in df.columns:
            fig = px.histogram(
                df,
                x="异响次数",
                nbins=20,
                title="异响次数分布直方图",
                labels={"异响次数": "异响次数", "count": "记录数"}
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("暂无异响次数数据")
    
    with col2:
        st.subheader("振动强度分布")
        
        if "振动强度" in df.columns:
            fig = px.box(
                df,
                y="振动强度",
                title="振动强度箱线图"
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("暂无振动强度数据")
    
    st.divider()
    
    st.subheader("按街区统计")
    
    if "街区" in df.columns:
        col1, col2 = st.columns(2)
        
        with col1:
            block_stats = df.groupby("街区").agg({
                "异响次数": ["mean", "max", "count"],
                "振动强度": ["mean", "max"]
            }).round(2)
            
            block_stats.columns = ["_".join(col) for col in block_stats.columns]
            st.dataframe(block_stats, use_container_width=True)
        
        with col2:
            if "异响次数_mean" in block_stats.columns:
                fig = px.bar(
                    block_stats.reset_index(),
                    x="街区",
                    y="异响次数_mean",
                    color="异响次数_mean",
                    color_continuous_scale="Oranges",
                    title="各街区平均异响次数"
                )
                st.plotly_chart(fig, use_container_width=True)
    
    st.divider()
    
    st.subheader("异响与积水关系")
    
    if "异响次数" in df.columns and "积水深度" in df.columns:
        fig = px.scatter(
            df,
            x="积水深度",
            y="异响次数",
            color="街区" if "街区" in df.columns else None,
            size="振动强度" if "振动强度" in df.columns else None,
            title="积水深度 vs 异响次数",
            labels={"积水深度": "积水深度 (cm)", "异响次数": "异响次数"}
        )
        st.plotly_chart(fig, use_container_width=True)


def render_review_list():
    st.header("📋 待复核清单")
    
    if st.session_state.engine_result is None:
        st.info("请先运行规则引擎")
        return
    
    result = st.session_state.engine_result
    workflow = st.session_state.workflow_state
    
    high_risk_df = result.high_risk_records.copy()
    
    if high_risk_df.empty:
        st.success("🎉 暂无高风险记录需要复核")
        return
    
    if workflow and workflow.reviewed_ids:
        high_risk_df["已复核"] = high_risk_df["井盖编号"].isin(workflow.reviewed_ids)
    else:
        high_risk_df["已复核"] = False
    
    pending_df = high_risk_df[~high_risk_df["已复核"]]
    reviewed_df = high_risk_df[high_risk_df["已复核"]]
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric("待复核", len(pending_df))
    
    with col2:
        st.metric("已复核", len(reviewed_df))
    
    with col3:
        st.metric("总计", len(high_risk_df))
    
    st.divider()
    
    tab1, tab2 = st.tabs(["待复核记录", "已复核记录"])
    
    with tab1:
        if not pending_df.empty:
            display_cols = [col for col in ["井盖编号", "街区", "风险评分", "风险等级", 
                                             "触发规则列表", "异响次数", "积水深度", "纬度", "经度"]
                           if col in pending_df.columns]
            
            st.dataframe(pending_df[display_cols], use_container_width=True)
            
            st.subheader("批量操作")
            
            col1, col2 = st.columns(2)
            
            with col1:
                selected_ids = st.multiselect(
                    "选择要标记为已复核的井盖",
                    options=pending_df["井盖编号"].tolist()
                )
                
                if st.button("标记为已复核") and selected_ids:
                    if workflow:
                        for manhole_id in selected_ids:
                            st.session_state.persistence.mark_as_reviewed(
                                workflow.session_id,
                                manhole_id
                            )
                        st.success(f"已标记 {len(selected_ids)} 条记录为已复核")
                        st.rerun()
            
            with col2:
                st.subheader("单条记录详情")
                
                if len(pending_df) > 0:
                    selected_idx = st.selectbox(
                        "选择记录",
                        options=range(len(pending_df)),
                        format_func=lambda i: f"{pending_df.iloc[i]['井盖编号']} - 风险: {pending_df.iloc[i]['风险评分']}"
                    )
                    
                    if selected_idx is not None:
                        record = pending_df.iloc[selected_idx]
                        
                        st.json(record.to_dict())
                        
                        note_text = st.text_area("添加备注", key="review_note")
                        
                        if st.button("确认复核并添加备注"):
                            if workflow:
                                manhole_id = record["井盖编号"]
                                st.session_state.persistence.mark_as_reviewed(
                                    workflow.session_id,
                                    manhole_id
                                )
                                if note_text:
                                    st.session_state.persistence.add_note(
                                        workflow.session_id,
                                        manhole_id,
                                        note_text
                                    )
                                st.success("已确认复核！")
                                st.rerun()
        else:
            st.success("🎉 所有记录都已复核完成")
    
    with tab2:
        if not reviewed_df.empty:
            display_cols = [col for col in ["井盖编号", "街区", "风险评分", "风险等级", "触发规则列表"]
                           if col in reviewed_df.columns]
            st.dataframe(reviewed_df[display_cols], use_container_width=True)
        else:
            st.info("暂无已复核记录")
    
    st.divider()
    
    st.subheader("任务分配")
    
    if not pending_df.empty:
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            assign_id = st.selectbox(
                "选择井盖",
                options=pending_df["井盖编号"].tolist(),
                key="assign_id"
            )
        
        with col2:
            assignee = st.text_input("责任人", key="assignee")
        
        with col3:
            priority = st.selectbox("优先级", ["critical", "high", "medium", "low"], key="priority")
        
        with col4:
            due_hours = st.number_input("截止时间(小时)", min_value=1, value=24, key="due_hours")
        
        if st.button("分配任务"):
            if workflow and assignee:
                st.session_state.persistence.assign_task(
                    workflow.session_id,
                    assign_id,
                    assignee,
                    priority,
                    due_hours
                )
                st.success(f"任务已分配给 {assignee}")
            else:
                st.warning("请输入责任人姓名")
    
    if workflow and workflow.assigned_tasks:
        st.subheader("已分配任务")
        tasks_df = pd.DataFrame(workflow.assigned_tasks)
        st.dataframe(tasks_df, use_container_width=True)


def render_duplicate_merge():
    st.header("🔄 重复合并")
    
    if not st.session_state.duplicate_groups:
        st.info("未发现重复记录，或请先执行匹配分析")
        return
    
    workflow = st.session_state.workflow_state
    
    st.write(f"发现 {len(st.session_state.duplicate_groups)} 组潜在重复记录")
    
    for group_idx, group in enumerate(st.session_state.duplicate_groups):
        is_merged = False
        if workflow:
            is_merged = any(
                mg.get("group_id") == group.group_id 
                for mg in workflow.merged_groups
            )
        
        if is_merged:
            st.success(f"✅ 群组 {group.group_id} 已合并")
            continue
        
        with st.expander(f"群组 {group.group_id} ({len(group.records)} 条记录)"):
            st.code(group.merge_suggestion)
            
            records_df = pd.DataFrame(group.records)
            display_cols = [col for col in ["井盖编号", "normalized_id", "纬度", "经度", 
                                             "异响次数", "振动强度", "has_abnormal_sound", "积水深度",
                                             "记录时间", "巡检时间", "街区"]
                           if col in records_df.columns]
            
            st.dataframe(records_df[display_cols], use_container_width=True)
            
            col1, col2 = st.columns(2)
            
            with col1:
                primary_options = list(range(len(group.records)))
                primary_idx = st.selectbox(
                    "选择主记录",
                    options=primary_options,
                    format_func=lambda i: f"记录 {i+1}: {group.records[i].get('井盖编号', '未知')}",
                    key=f"primary_{group.group_id}"
                )
            
            with col2:
                merge_confirm = st.checkbox(
                    f"确认合并此群组的所有记录",
                    key=f"confirm_{group.group_id}"
                )
            
            if st.button(f"执行合并 - {group.group_id}", key=f"merge_{group.group_id}"):
                if merge_confirm and workflow:
                    matcher = DataMatcher(config.__dict__)
                    merged_record = matcher.merge_duplicates(group, keep_primary=True)
                    
                    primary_id = group.records[primary_idx].get("井盖编号", "")
                    merged_ids = [r.get("井盖编号", "") for r in group.records]
                    
                    st.session_state.persistence.mark_duplicates_merged(
                        workflow.session_id,
                        group.group_id,
                        primary_id,
                        merged_ids
                    )
                    
                    st.success(f"已合并群组 {group.group_id}，主记录: {primary_id}")
                    st.json(merged_record)
                else:
                    st.warning("请先勾选确认合并")


def render_export():
    st.header("📤 导出中心")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.subheader("导出复盘报告 (Markdown)")
        
        if st.button("生成 Markdown 复盘报告"):
            if st.session_state.engine_result is not None and st.session_state.merged_data is not None:
                path = st.session_state.exporter.export_markdown_report(
                    st.session_state.engine_result,
                    st.session_state.merged_data,
                    st.session_state.workflow_state,
                    st.session_state.session_id or ""
                )
                st.success(f"报告已导出: {path}")
            else:
                st.warning("请先完成数据处理")
    
    with col2:
        st.subheader("导出派单表 (CSV)")
        
        if st.button("生成 CSV 派单表"):
            if st.session_state.engine_result is not None:
                assigned_tasks = []
                if st.session_state.workflow_state:
                    assigned_tasks = st.session_state.workflow_state.assigned_tasks
                
                path = st.session_state.exporter.export_dispatch_csv(
                    st.session_state.engine_result.high_risk_records,
                    assigned_tasks
                )
                st.success(f"派单表已导出: {path}")
            else:
                st.warning("请先运行规则引擎")
    
    with col3:
        st.subheader("导出审计包 (JSON)")
        
        if st.button("生成 JSON 审计包"):
            audit_package = st.session_state.persistence.export_audit_package(
                st.session_state.session_id
            )
            path = st.session_state.exporter.export_audit_json(
                audit_package,
                st.session_state.merged_data
            )
            st.success(f"审计包已导出: {path}")
    
    st.divider()
    
    st.subheader("一键导出所有格式")
    
    if st.button("导出全部", type="primary"):
        if st.session_state.engine_result is not None and st.session_state.merged_data is not None:
            audit_package = st.session_state.persistence.export_audit_package(
                st.session_state.session_id
            )
            
            assigned_tasks = []
            if st.session_state.workflow_state:
                assigned_tasks = st.session_state.workflow_state.assigned_tasks
            
            results = st.session_state.exporter.export_all(
                st.session_state.engine_result,
                st.session_state.merged_data,
                st.session_state.workflow_state,
                audit_package,
                st.session_state.session_id or ""
            )
            
            st.success("所有文件已导出！")
            for format_type, path in results.items():
                st.write(f"- {format_type}: {path}")
        else:
            st.warning("请先完成数据处理")
    
    st.divider()
    
    st.subheader("已导出文件列表")
    
    exports = st.session_state.exporter.list_exports()
    
    if exports:
        exports_df = pd.DataFrame(exports)
        st.dataframe(exports_df[["filename", "file_type", "size_bytes", "modified_time"]], use_container_width=True)
        
        if st.button("清理30天前的导出文件"):
            deleted = st.session_state.exporter.cleanup_old_exports(days=30)
            st.success(f"已清理 {deleted} 个旧文件")
    else:
        st.info("暂无已导出文件")
    
    st.divider()
    
    st.subheader("审计日志")
    
    audit_log = st.session_state.persistence.get_audit_log(limit=50)
    
    if audit_log:
        audit_df = pd.DataFrame(audit_log)
        st.dataframe(audit_df, use_container_width=True)
    else:
        st.info("暂无审计日志")


def main():
    init_session_state()
    render_header()
    render_sidebar()
    
    page = st.session_state.active_page
    
    if page == "数据导入":
        render_data_import()
    elif page == "数据校验":
        render_data_validation()
    elif page == "匹配分析":
        render_matching()
    elif page == "规则引擎":
        render_rule_engine()
    elif page == "风险分层":
        render_risk_layer()
    elif page == "异响趋势":
        render_trend()
    elif page == "待复核清单":
        render_review_list()
    elif page == "重复合并":
        render_duplicate_merge()
    elif page == "导出中心":
        render_export()


if __name__ == "__main__":
    main()
