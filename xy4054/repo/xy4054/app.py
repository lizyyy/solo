import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
import io
import sys

sys.path.insert(0, str(Path(__file__).parent))

from modules.data_validator import (
    CSVReader,
    DataValidator,
    ValidationResult,
    validate_elderly_id,
    validate_meal_type,
    validate_weight,
    validate_dish_code,
    validate_date
)

from modules.metrics import (
    NutritionCalculator,
    WasteAnalyzer,
    ChronicAnalyzer,
    MetricsEngine,
    calculate_waste_rate,
    calculate_nutrition_deviation
)

from modules.persistence import (
    DataManager,
    SessionState,
    save_session,
    load_session,
    export_to_csv,
    export_to_markdown
)

from modules.sample_data import (
    SampleDataGenerator,
    create_all_sample_data,
    save_sample_data_to_csv
)

from config.settings import MEAL_TYPES, CHRONIC_DISEASES, NUTRITION_ITEMS
from models.enums import ChronicDisease, NutritionType


st.set_page_config(
    page_title="配餐偏差复盘台",
    page_icon="🍽️",
    layout="wide",
    initial_sidebar_state="expanded"
)


def init_session_state():
    if 'data_manager' not in st.session_state:
        st.session_state.data_manager = DataManager()
    
    if 'session' not in st.session_state:
        st.session_state.session = st.session_state.data_manager.create_new_session()
    
    if 'validation_results' not in st.session_state:
        st.session_state.validation_results = {}
    
    if 'analysis_results' not in st.session_state:
        st.session_state.analysis_results = {}
    
    if 'active_tab' not in st.session_state:
        st.session_state.active_tab = "数据导入"
    
    if 'metrics_engine' not in st.session_state:
        st.session_state.metrics_engine = None
    
    if 'sample_data_loaded' not in st.session_state:
        st.session_state.sample_data_loaded = False


def show_sidebar():
    with st.sidebar:
        st.title("🍽️ 配餐偏差复盘台")
        st.markdown("---")
        
        st.subheader("当前会话")
        session = st.session_state.session
        if session:
            st.info(f"会话ID: {session.session_id}")
            st.caption(f"创建时间: {session.created_at.strftime('%Y-%m-%d %H:%M') if session.created_at else '未知'}")
            
            st.markdown("### 数据状态")
            col1, col2 = st.columns(2)
            with col1:
                st.metric("老人信息", 
                         len(session.elderly_df) if session.elderly_df is not None else 0)
                st.metric("菜品信息",
                         len(session.dish_df) if session.dish_df is not None else 0)
            with col2:
                st.metric("订餐记录",
                         len(session.orders_df) if session.orders_df is not None else 0)
                st.metric("打餐记录",
                         len(session.servings_df) if session.servings_df is not None else 0)
                st.metric("剩余记录",
                         len(session.wastes_df) if session.wastes_df is not None else 0)
        
        st.markdown("---")
        
        with st.expander("会话管理", expanded=False):
            if st.button("新建会话", use_container_width=True):
                st.session_state.session = st.session_state.data_manager.create_new_session()
                st.session_state.validation_results = {}
                st.session_state.analysis_results = {}
                st.session_state.metrics_engine = None
                st.success("已创建新会话")
                st.rerun()
            
            sessions = st.session_state.data_manager.list_sessions()
            if sessions:
                selected_session = st.selectbox(
                    "加载历史会话",
                    options=[""] + [s['session_id'] for s in sessions],
                    format_func=lambda x: x if x else "选择会话..."
                )
                if selected_session:
                    if st.button("加载选中会话", use_container_width=True):
                        loaded = load_session(selected_session, st.session_state.data_manager)
                        if loaded:
                            st.session_state.session = loaded
                            st.success(f"已加载会话: {selected_session}")
                            if st.session_state.session.dish_df is not None and st.session_state.session.elderly_df is not None:
                                st.session_state.metrics_engine = MetricsEngine(
                                    st.session_state.session.dish_df,
                                    st.session_state.session.elderly_df
                                )
                            st.rerun()
                        else:
                            st.error("会话加载失败")
            
            if st.button("保存当前会话", use_container_width=True):
                if save_session(st.session_state.session, st.session_state.data_manager):
                    st.success("会话已保存")
                else:
                    st.error("保存失败")
        
        st.markdown("---")
        st.caption("社区食堂配餐分析工具 v1.0")


def tab_data_import():
    st.header("📥 数据导入")
    st.markdown("---")
    
    session = st.session_state.session
    
    col1, col2 = st.columns([3, 1])
    
    with col2:
        st.subheader("快速开始")
        if st.button("加载示例数据", use_container_width=True, type="primary"):
            with st.spinner("正在生成示例数据..."):
                sample_data = create_all_sample_data()
                session.elderly_df = sample_data['elderly']
                session.dish_df = sample_data['dish']
                session.orders_df = sample_data['orders']
                session.servings_df = sample_data['servings']
                session.wastes_df = sample_data['wastes']
                
                st.session_state.metrics_engine = MetricsEngine(
                    session.dish_df, session.elderly_df
                )
                st.session_state.sample_data_loaded = True
                
                st.success("示例数据加载完成！")
                st.rerun()
        
        st.markdown("### 数据格式说明")
        with st.expander("查看格式要求"):
            st.markdown("""
            **老人信息 CSV:**
            - 必需列: elderly_id (老人编号), chronic_diseases (慢病标签)
            - 可选列: name, age, gender, bed_number
            
            **菜品信息 CSV:**
            - 必需列: dish_code (菜品编码), dish_name (菜品名称), dish_category (分类)
            - 营养列: energy_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, sodium_per_100g
            
            **订餐数据 CSV:**
            - 必需列: elderly_id, date, meal_type, dish_code, planned_weight
            
            **打餐数据 CSV:**
            - 必需列: elderly_id, date, meal_type, dish_code, actual_weight
            
            **剩余数据 CSV:**
            - 必需列: elderly_id, date, meal_type, dish_code, waste_weight
            """)
    
    with col1:
        st.subheader("上传数据文件")
        
        tab1, tab2, tab3, tab4, tab5 = st.tabs([
            "👴 老人信息", "🍳 菜品信息", "📋 订餐数据", "🍽️ 打餐数据", "🗑️ 剩余数据"
        ])
        
        with tab1:
            uploaded_file = st.file_uploader("上传老人信息 CSV", type=['csv'], key="elderly_upload")
            if uploaded_file:
                process_uploaded_file(uploaded_file, "elderly")
        
        with tab2:
            uploaded_file = st.file_uploader("上传菜品信息 CSV", type=['csv'], key="dish_upload")
            if uploaded_file:
                process_uploaded_file(uploaded_file, "dish")
        
        with tab3:
            uploaded_file = st.file_uploader("上传订餐数据 CSV", type=['csv'], key="orders_upload")
            if uploaded_file:
                process_uploaded_file(uploaded_file, "orders")
        
        with tab4:
            uploaded_file = st.file_uploader("上传打餐数据 CSV", type=['csv'], key="servings_upload")
            if uploaded_file:
                process_uploaded_file(uploaded_file, "servings")
        
        with tab5:
            uploaded_file = st.file_uploader("上传剩余数据 CSV", type=['csv'], key="wastes_upload")
            if uploaded_file:
                process_uploaded_file(uploaded_file, "wastes")
    
    st.markdown("---")
    st.subheader("数据预览")
    
    if session.elderly_df is not None and not session.elderly_df.empty:
        with st.expander("老人信息预览", expanded=True):
            st.dataframe(session.elderly_df.head(10), use_container_width=True)
            st.caption(f"共 {len(session.elderly_df)} 条记录")
    
    if session.dish_df is not None and not session.dish_df.empty:
        with st.expander("菜品信息预览", expanded=True):
            st.dataframe(session.dish_df.head(10), use_container_width=True)
            st.caption(f"共 {len(session.dish_df)} 条记录")
    
    if session.orders_df is not None and not session.orders_df.empty:
        with st.expander("订餐数据预览"):
            st.dataframe(session.orders_df.head(10), use_container_width=True)
            st.caption(f"共 {len(session.orders_df)} 条记录")
    
    if session.servings_df is not None and not session.servings_df.empty:
        with st.expander("打餐数据预览"):
            st.dataframe(session.servings_df.head(10), use_container_width=True)
            st.caption(f"共 {len(session.servings_df)} 条记录")
    
    if session.wastes_df is not None and not session.wastes_df.empty:
        with st.expander("剩余数据预览"):
            st.dataframe(session.wastes_df.head(10), use_container_width=True)
            st.caption(f"共 {len(session.wastes_df)} 条记录")


def process_uploaded_file(uploaded_file, data_type: str):
    session = st.session_state.session
    validator = DataValidator()
    csv_reader = CSVReader()
    
    try:
        content = uploaded_file.read()
        df, warnings = csv_reader.read_csv(content, data_type)
        
        if data_type == "elderly":
            df = csv_reader.parse_numeric_column(df, 'age')
            result = validator.validate_elderly_data(df)
        elif data_type == "dish":
            for col in ['energy_per_100g', 'protein_per_100g', 'fat_per_100g', 
                       'carbs_per_100g', 'sodium_per_100g', 'fiber_per_100g']:
                df = csv_reader.parse_numeric_column(df, col)
            result = validator.validate_dish_data(df)
        else:
            df = csv_reader.parse_date_column(df)
            df = csv_reader.parse_numeric_column(df, 
                'planned_weight' if data_type == 'orders' else 
                'actual_weight' if data_type == 'servings' else 'waste_weight'
            )
            
            if data_type == "orders":
                result = validator.validate_order_data(df)
            elif data_type == "servings":
                result = validator.validate_serving_data(df)
            else:
                result = validator.validate_waste_data(df)
        
        st.session_state.validation_results[data_type] = result
        
        if warnings:
            for w in warnings:
                st.warning(w)
        
        if result.is_valid:
            st.success(f"数据校验通过！共 {len(result.valid_rows)} 条有效记录")
            
            if data_type == "elderly":
                session.elderly_df = result.valid_rows
            elif data_type == "dish":
                session.dish_df = result.valid_rows
            elif data_type == "orders":
                session.orders_df = result.valid_rows
            elif data_type == "servings":
                session.servings_df = result.valid_rows
            else:
                session.wastes_df = result.valid_rows
            
            if session.dish_df is not None and session.elderly_df is not None:
                st.session_state.metrics_engine = MetricsEngine(
                    session.dish_df, session.elderly_df
                )
        
        else:
            st.error(f"数据校验失败！发现 {result.total_errors} 个错误")
            
            with st.expander("查看错误详情", expanded=True):
                errors_df = pd.DataFrame([
                    {
                        '行号': e.row_number + 1,
                        '列名': e.column_name or '-',
                        '错误类型': e.error_type,
                        '错误描述': e.error_message,
                        '字段值': e.field_value or '-',
                        '建议': e.suggestion or '-'
                    }
                    for e in result.errors
                ])
                st.dataframe(errors_df, use_container_width=True)
            
            if not result.valid_rows.empty:
                st.warning(f"有 {len(result.valid_rows)} 条有效记录可导入")
                if st.button("仅导入有效记录", key=f"import_valid_{data_type}"):
                    if data_type == "elderly":
                        session.elderly_df = result.valid_rows
                    elif data_type == "dish":
                        session.dish_df = result.valid_rows
                    elif data_type == "orders":
                        session.orders_df = result.valid_rows
                    elif data_type == "servings":
                        session.servings_df = result.valid_rows
                    else:
                        session.wastes_df = result.valid_rows
                    
                    st.success("有效记录已导入")
                    
                    if session.dish_df is not None and session.elderly_df is not None:
                        st.session_state.metrics_engine = MetricsEngine(
                            session.dish_df, session.elderly_df
                        )
                    
                    st.rerun()
        
        if result.total_warnings > 0:
            with st.expander(f"查看 {result.total_warnings} 个警告"):
                warnings_df = pd.DataFrame([
                    {
                        '行号': w.row_number + 1,
                        '列名': w.column_name or '-',
                        '警告类型': w.error_type,
                        '描述': w.error_message
                    }
                    for w in result.warnings
                ])
                st.dataframe(warnings_df, use_container_width=True)
    
    except Exception as e:
        st.error(f"文件处理失败: {str(e)}")


def tab_validation():
    st.header("✅ 数据校验")
    st.markdown("---")
    
    session = st.session_state.session
    
    if not st.session_state.validation_results:
        st.info("暂无校验结果，请先导入数据")
        return
    
    for data_type, result in st.session_state.validation_results.items():
        type_names = {
            'elderly': '老人信息',
            'dish': '菜品信息',
            'orders': '订餐数据',
            'servings': '打餐数据',
            'wastes': '剩余数据'
        }
        
        with st.expander(f"{type_names.get(data_type, data_type)} 校验结果", expanded=True):
            col1, col2, col3, col4 = st.columns(4)
            
            with col1:
                st.metric("总行数", result.stats.get('total_rows', 0))
            with col2:
                st.metric("有效行数", result.stats.get('valid_rows', 0),
                         delta_color="normal")
            with col3:
                st.metric("无效行数", result.stats.get('invalid_rows', 0),
                         delta_color="inverse")
            with col4:
                st.metric("错误数", result.total_errors,
                         delta_color="inverse")
            
            if result.total_errors > 0:
                st.subheader("错误详情")
                errors_df = pd.DataFrame([
                    {
                        '行号': e.row_number + 1,
                        '列名': e.column_name or '-',
                        '错误类型': e.error_type,
                        '错误描述': e.error_message,
                        '严重程度': e.severity
                    }
                    for e in result.errors
                ])
                st.dataframe(errors_df, use_container_width=True)
            
            if result.total_warnings > 0:
                st.subheader("警告信息")
                warnings_df = pd.DataFrame([
                    {
                        '行号': w.row_number + 1,
                        '列名': w.column_name or '-',
                        '警告类型': w.error_type,
                        '描述': w.error_message
                    }
                    for w in result.warnings
                ])
                st.dataframe(warnings_df, use_container_width=True)
    
    st.markdown("---")
    st.subheader("交叉校验")
    
    if (session.orders_df is not None and not session.orders_df.empty and
        session.servings_df is not None and not session.servings_df.empty):
        
        validator = DataValidator()
        cross_errors = validator.validate_cross_reference(
            session.orders_df, session.servings_df, 
            session.wastes_df or pd.DataFrame()
        )
        
        if cross_errors:
            st.warning(f"发现 {len(cross_errors)} 个交叉校验问题")
            cross_df = pd.DataFrame([
                {
                    '错误类型': e.error_type,
                    '描述': e.error_message,
                    '严重程度': e.severity
                }
                for e in cross_errors
            ])
            st.dataframe(cross_df, use_container_width=True)
        else:
            st.success("交叉校验通过，数据一致性良好")


def tab_dashboard():
    st.header("📊 数据分析仪表盘")
    st.markdown("---")
    
    session = st.session_state.session
    
    if (session.orders_df is None or session.servings_df is None or
        session.dish_df is None or session.elderly_df is None):
        st.warning("请先导入完整数据（老人信息、菜品信息、订餐数据、打餐数据）")
        return
    
    if st.session_state.metrics_engine is None:
        st.session_state.metrics_engine = MetricsEngine(
            session.dish_df, session.elderly_df
        )
    
    engine = st.session_state.metrics_engine
    
    all_dates = []
    for df in [session.orders_df, session.servings_df, session.wastes_df]:
        if df is not None and not df.empty and 'date' in df.columns:
            all_dates.extend(df['date'].dropna().tolist())
    
    if not all_dates:
        st.error("无法获取日期范围")
        return
    
    min_date = min(all_dates)
    max_date = max(all_dates)
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        start_date = st.date_input("开始日期", min_date, min_value=min_date, max_value=max_date)
    with col2:
        end_date = st.date_input("结束日期", max_date, min_value=min_date, max_value=max_date)
    with col3:
        selected_meal = st.multiselect("餐次", MEAL_TYPES, default=MEAL_TYPES)
    
    st.markdown("---")
    
    orders_filtered = filter_by_date_and_meal(session.orders_df, start_date, end_date, selected_meal)
    servings_filtered = filter_by_date_and_meal(session.servings_df, start_date, end_date, selected_meal)
    wastes_filtered = filter_by_date_and_meal(session.wastes_df or pd.DataFrame(), start_date, end_date, selected_meal)
    
    st.subheader("📈 总体概况")
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        total_orders = len(orders_filtered)
        st.metric("总订单数", f"{total_orders:,}")
    
    with col2:
        total_elderly = orders_filtered['elderly_id'].nunique()
        st.metric("用餐老人数", total_elderly)
    
    with col3:
        total_planned = orders_filtered['planned_weight'].sum() / 1000
        total_actual = servings_filtered['actual_weight'].sum() / 1000
        st.metric("总供给量", f"{total_actual:.1f} kg", 
                 delta=f"{(total_actual - total_planned)/total_planned*100:.1f}%" if total_planned > 0 else "0%")
    
    with col4:
        total_waste = wastes_filtered['waste_weight'].sum() / 1000 if not wastes_filtered.empty else 0
        waste_rate = (total_waste / total_actual * 100) if total_actual > 0 else 0
        st.metric("总浪费量", f"{total_waste:.1f} kg",
                 delta=f"{waste_rate:.1f}%", delta_color="inverse")
    
    st.markdown("---")
    
    tab1, tab2, tab3, tab4 = st.tabs([
        "🥗 菜品浪费分析", "👴 慢病人群分析", "📅 每日趋势", "⚠️ 营养告警"
    ])
    
    with tab1:
        show_waste_analysis(engine, orders_filtered, servings_filtered, wastes_filtered,
                          start_date, end_date, session.dish_df)
    
    with tab2:
        show_chronic_analysis(engine, servings_filtered, wastes_filtered,
                            start_date, end_date, session.elderly_df)
    
    with tab3:
        show_daily_trends(orders_filtered, servings_filtered, wastes_filtered,
                         session.dish_df, session.elderly_df)
    
    with tab4:
        show_nutrition_alerts(engine, servings_filtered, wastes_filtered,
                             start_date, end_date, session.elderly_df)


def filter_by_date_and_meal(df: pd.DataFrame, start_date: date, end_date: date, 
                            meals: List[str]) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame()
    
    mask = (df['date'] >= start_date) & (df['date'] <= end_date)
    if meals:
        mask &= df['meal_type'].isin(meals)
    
    return df[mask].copy()


def show_waste_analysis(engine: MetricsEngine, orders: pd.DataFrame, 
                        servings: pd.DataFrame, wastes: pd.DataFrame,
                        start_date: date, end_date: date, dish_df: pd.DataFrame):
    if orders.empty or servings.empty:
        st.info("数据不足，无法进行浪费分析")
        return
    
    waste_analyses = engine.get_all_waste_analysis(orders, servings, wastes, start_date, end_date)
    
    if not waste_analyses:
        st.info("无浪费分析结果")
        return
    
    st.subheader("🍽️ 浪费率排行")
    
    waste_data = []
    for wa in waste_analyses:
        waste_data.append({
            '菜品编码': wa.dish_code,
            '菜品名称': wa.dish_name,
            '分类': wa.dish_category,
            '浪费率(%)': round(wa.avg_waste_rate, 2),
            '少打次数': wa.under_serve_count,
            '少打率(%)': round(wa.under_serve_rate, 2),
            '是否长期少打': '是' if wa.is_persistent_under else '否'
        })
    
    waste_df = pd.DataFrame(waste_data)
    
    col1, col2 = st.columns(2)
    
    with col1:
        top_waste = waste_df.nlargest(10, '浪费率(%)')
        fig = px.bar(top_waste, x='菜品名称', y='浪费率(%)',
                    color='分类', title='浪费率 TOP 10',
                    text='浪费率(%)')
        fig.update_traces(texttemplate='%{text:.1f}%', textposition='outside')
        st.plotly_chart(fig, use_container_width=True)
    
    with col2:
        persistent_under = waste_df[waste_df['是否长期少打'] == '是']
        if not persistent_under.empty:
            st.subheader("⚠️ 长期少打菜品")
            st.dataframe(
                persistent_under[['菜品名称', '分类', '少打次数', '少打率(%)']],
                use_container_width=True
            )
            
            fig2 = px.bar(persistent_under, x='菜品名称', y='少打率(%)',
                         color='分类', title='长期少打菜品分析',
                         text='少打率(%)')
            st.plotly_chart(fig2, use_container_width=True)
        else:
            st.success("未发现长期少打菜品")
    
    st.markdown("---")
    st.subheader("📋 完整浪费分析表")
    
    st.dataframe(
        waste_df.style.highlight_max(subset=['浪费率(%)', '少打率(%)'], color='#fff3cd')
        .highlight_between(subset=['少打率(%)'], left=50, right=100, color='#ffcccc'),
        use_container_width=True
    )


def show_chronic_analysis(engine: MetricsEngine, servings: pd.DataFrame,
                          wastes: pd.DataFrame, start_date: date, end_date: date,
                          elderly_df: pd.DataFrame):
    if servings.empty:
        st.info("数据不足，无法进行慢病分析")
        return
    
    chronic_analyses = engine.get_all_chronic_analysis(servings, wastes, start_date, end_date)
    
    if not chronic_analyses:
        st.info("无慢病分析结果")
        return
    
    st.subheader("📊 各慢病标签营养摄入对比")
    
    chronic_data = []
    for ca in chronic_analyses:
        if ca.total_persons == 0:
            continue
        
        chronic_data.append({
            '慢病类型': ca.chronic_type,
            '人数': ca.total_persons,
            '能量(kcal)': round(ca.avg_daily_nutrition.get('能量', 0), 1),
            '蛋白质(g)': round(ca.avg_daily_nutrition.get('蛋白质', 0), 1),
            '脂肪(g)': round(ca.avg_daily_nutrition.get('脂肪', 0), 1),
            '碳水化合物(g)': round(ca.avg_daily_nutrition.get('碳水化合物', 0), 1),
            '钠(mg)': round(ca.avg_daily_nutrition.get('钠', 0), 1),
            '关键问题': '; '.join(ca.key_concerns)
        })
    
    chronic_df = pd.DataFrame(chronic_data)
    
    if chronic_df.empty:
        st.info("无有效慢病数据")
        return
    
    col1, col2 = st.columns(2)
    
    with col1:
        fig = px.bar(chronic_df, x='慢病类型', y='钠(mg)',
                    color='慢病类型', title='各慢病标签日均钠摄入',
                    text='钠(mg)')
        fig.add_hline(y=2000, line_dash="dash", line_color="red",
                     annotation_text="每日参考值 2000mg")
        st.plotly_chart(fig, use_container_width=True)
    
    with col2:
        fig2 = px.bar(chronic_df, x='慢病类型', y='蛋白质(g)',
                     color='慢病类型', title='各慢病标签日均蛋白质摄入',
                     text='蛋白质(g)')
        fig2.add_hline(y=60, line_dash="dash", line_color="red",
                      annotation_text="每日参考值 60g")
        st.plotly_chart(fig2, use_container_width=True)
    
    st.markdown("---")
    st.subheader("📝 各慢病标签详细分析")
    
    for ca in chronic_analyses:
        if ca.total_persons == 0:
            continue
        
        with st.expander(f"🩺 {ca.chronic_type} ({ca.total_persons}人)", expanded=False):
            col1, col2 = st.columns(2)
            
            with col1:
                st.markdown("**日均营养摄入**")
                nut_df = pd.DataFrame([
                    {'营养项': k, 
                     '实际摄入': f"{v:.1f} {NutritionType.get_unit(k)}",
                     '偏差%': f"{ca.nutrition_deviation.get(k, 0):.1f}%"}
                    for k, v in ca.avg_daily_nutrition.items()
                ])
                st.dataframe(nut_df, use_container_width=True, hide_index=True)
            
            with col2:
                st.markdown("**关键问题**")
                for concern in ca.key_concerns:
                    st.warning(concern)
                
                st.markdown("**改进建议**")
                for suggestion in ca.improvement_suggestions:
                    st.success(suggestion)


def show_daily_trends(orders: pd.DataFrame, servings: pd.DataFrame, wastes: pd.DataFrame,
                      dish_df: pd.DataFrame, elderly_df: pd.DataFrame):
    if orders.empty or servings.empty:
        st.info("数据不足，无法展示趋势")
        return
    
    st.subheader("📈 每日趋势")
    
    daily_orders = orders.groupby('date').agg({
        'planned_weight': 'sum',
        'elderly_id': 'nunique',
        'dish_code': 'count'
    }).reset_index()
    daily_orders.columns = ['date', 'planned_kg', 'elderly_count', 'order_count']
    daily_orders['planned_kg'] = daily_orders['planned_kg'] / 1000
    
    daily_servings = servings.groupby('date').agg({
        'actual_weight': 'sum'
    }).reset_index()
    daily_servings.columns = ['date', 'actual_kg']
    daily_servings['actual_kg'] = daily_servings['actual_kg'] / 1000
    
    daily_waste = pd.DataFrame()
    if not wastes.empty:
        daily_waste = wastes.groupby('date').agg({
            'waste_weight': 'sum'
        }).reset_index()
        daily_waste.columns = ['date', 'waste_kg']
        daily_waste['waste_kg'] = daily_waste['waste_kg'] / 1000
    
    daily = pd.merge(daily_orders, daily_servings, on='date', how='left')
    if not daily_waste.empty:
        daily = pd.merge(daily, daily_waste, on='date', how='left')
        daily['waste_rate'] = (daily['waste_kg'] / daily['actual_kg'] * 100).fillna(0)
    
    daily['date'] = pd.to_datetime(daily['date'])
    daily = daily.sort_values('date')
    
    col1, col2 = st.columns(2)
    
    with col1:
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=daily['date'], y=daily['planned_kg'],
                                 mode='lines+markers', name='预订量',
                                 line=dict(color='blue', dash='dash')))
        fig.add_trace(go.Scatter(x=daily['date'], y=daily['actual_kg'],
                                 mode='lines+markers', name='实际量',
                                 line=dict(color='green')))
        if 'waste_kg' in daily.columns:
            fig.add_trace(go.Scatter(x=daily['date'], y=daily['waste_kg'],
                                     mode='lines+markers', name='浪费量',
                                     line=dict(color='red')))
        
        fig.update_layout(title='每日重量趋势 (kg)', xaxis_title='日期', yaxis_title='重量 (kg)')
        st.plotly_chart(fig, use_container_width=True)
    
    with col2:
        if 'waste_rate' in daily.columns:
            fig2 = px.bar(daily, x='date', y='waste_rate',
                         title='每日浪费率 (%)',
                         text=daily['waste_rate'].round(1).astype(str) + '%')
            fig2.update_traces(textposition='outside')
            fig2.add_hline(y=10, line_dash="dash", line_color="orange",
                          annotation_text="警戒线 10%")
            st.plotly_chart(fig2, use_container_width=True)
    
    st.markdown("---")
    st.subheader("🍽️ 餐次分布")
    
    meal_orders = orders.groupby('meal_type').agg({
        'planned_weight': 'sum',
        'elderly_id': 'nunique'
    }).reset_index()
    meal_orders.columns = ['餐次', '预订总量(g)', '用餐人数']
    
    meal_servings = servings.groupby('meal_type').agg({
        'actual_weight': 'sum'
    }).reset_index()
    meal_servings.columns = ['餐次', '实际总量(g)']
    
    meal_stats = pd.merge(meal_orders, meal_servings, on='餐次')
    
    fig3 = make_subplots(rows=1, cols=2, specs=[[{"type": "pie"}, {"type": "bar"}]],
                        subplot_titles=['预订量分布', '餐次对比'])
    
    fig3.add_trace(
        go.Pie(labels=meal_stats['餐次'], values=meal_stats['预订总量(g)'],
               name='预订量'),
        row=1, col=1
    )
    
    fig3.add_trace(
        go.Bar(x=meal_stats['餐次'], y=meal_stats['预订总量(g)']/1000,
               name='预订量 (kg)'),
        row=1, col=2
    )
    fig3.add_trace(
        go.Bar(x=meal_stats['餐次'], y=meal_stats['实际总量(g)']/1000,
               name='实际量 (kg)'),
        row=1, col=2
    )
    
    fig3.update_layout(height=400)
    st.plotly_chart(fig3, use_container_width=True)


def show_nutrition_alerts(engine: MetricsEngine, servings: pd.DataFrame,
                          wastes: pd.DataFrame, start_date: date, end_date: date,
                          elderly_df: pd.DataFrame):
    if servings.empty:
        st.info("数据不足，无法进行营养告警分析")
        return
    
    nutrition_calc = NutritionCalculator(engine.dish_info)
    
    all_alerts = []
    elderly_ids = servings['elderly_id'].unique()
    
    progress_bar = st.progress(0)
    status_text = st.empty()
    
    for i, elderly_id in enumerate(elderly_ids):
        progress = (i + 1) / len(elderly_ids)
        progress_bar.progress(progress)
        status_text.text(f"正在分析老人 {i+1}/{len(elderly_ids)}...")
        
        analysis = nutrition_calc.analyze_elderly_nutrition(
            elderly_id, servings, elderly_df, start_date, end_date
        )
        
        if analysis.alerts:
            elderly_name = ""
            elderly_row = elderly_df[elderly_df['elderly_id'] == elderly_id]
            if not elderly_row.empty:
                elderly_name = elderly_row['name'].iloc[0]
            
            for alert in analysis.alerts:
                all_alerts.append({
                    '老人编号': elderly_id,
                    '姓名': elderly_name,
                    '慢病标签': ', '.join(analysis.chronic_diseases) if analysis.chronic_diseases else '普通',
                    '营养项': alert['nutrition'],
                    '级别': alert['level'],
                    '偏差%': round(alert['deviation'], 1),
                    '建议': alert['message']
                })
    
    progress_bar.empty()
    status_text.empty()
    
    if not all_alerts:
        st.success("🎉 未发现营养告警，所有老人营养摄入情况良好！")
        return
    
    alerts_df = pd.DataFrame(all_alerts)
    
    st.subheader(f"⚠️ 共发现 {len(alerts_df)} 个营养告警")
    
    col1, col2 = st.columns(2)
    
    with col1:
        level_counts = alerts_df['级别'].value_counts().reset_index()
        level_counts.columns = ['级别', '数量']
        
        fig = px.pie(level_counts, values='数量', names='级别',
                    title='告警级别分布',
                    color='级别',
                    color_discrete_map={
                        '严重超标': 'red',
                        '超标': 'orange',
                        '摄入不足': 'yellow'
                    })
        st.plotly_chart(fig, use_container_width=True)
    
    with col2:
        nut_counts = alerts_df['营养项'].value_counts().reset_index()
        nut_counts.columns = ['营养项', '数量']
        
        fig2 = px.bar(nut_counts, x='营养项', y='数量',
                     title='各营养项告警数量',
                     color='营养项', text='数量')
        st.plotly_chart(fig2, use_container_width=True)
    
    st.markdown("---")
    st.subheader("📋 告警详情")
    
    severe_alerts = alerts_df[alerts_df['级别'] == '严重超标']
    if not severe_alerts.empty:
        st.error(f"🚨 严重超标 ({len(severe_alerts)} 项)")
        st.dataframe(
            severe_alerts[['老人编号', '姓名', '慢病标签', '营养项', '偏差%', '建议']],
            use_container_width=True
        )
    
    high_alerts = alerts_df[alerts_df['级别'] == '超标']
    if not high_alerts.empty:
        st.warning(f"⚠️ 超标 ({len(high_alerts)} 项)")
        st.dataframe(
            high_alerts[['老人编号', '姓名', '慢病标签', '营养项', '偏差%', '建议']],
            use_container_width=True
        )
    
    low_alerts = alerts_df[alerts_df['级别'] == '摄入不足']
    if not low_alerts.empty:
        st.info(f"ℹ️ 摄入不足 ({len(low_alerts)} 项)")
        st.dataframe(
            low_alerts[['老人编号', '姓名', '慢病标签', '营养项', '偏差%', '建议']],
            use_container_width=True
        )


def tab_correction():
    st.header("✏️ 数据修正")
    st.markdown("---")
    
    session = st.session_state.session
    
    if session.servings_df is None or session.servings_df.empty:
        st.warning("请先导入打餐数据")
        return
    
    st.subheader("筛选记录")
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        search_elderly = st.text_input("老人编号", placeholder="E00001")
    with col2:
        search_dish = st.text_input("菜品编码/名称", placeholder="D0001 或 白米饭")
    with col3:
        filter_meal = st.selectbox("餐次", ["全部"] + MEAL_TYPES)
    with col4:
        only_manual = st.checkbox("仅显示已修正记录")
    
    df = session.servings_df.copy()
    
    if search_elderly:
        df = df[df['elderly_id'].str.contains(search_elderly, case=False)]
    
    if search_dish:
        dish_mask = df['dish_code'].str.contains(search_dish, case=False, na=False)
        if session.dish_df is not None:
            dish_names = session.dish_df[
                session.dish_df['dish_name'].str.contains(search_dish, case=False, na=False)
            ]['dish_code'].tolist()
            dish_mask |= df['dish_code'].isin(dish_names)
        df = df[dish_mask]
    
    if filter_meal != "全部":
        df = df[df['meal_type'] == filter_meal]
    
    if only_manual and 'is_manual' in df.columns:
        df = df[df['is_manual'] == True]
    
    st.markdown("---")
    st.subheader("打餐记录列表")
    
    if session.dish_df is not None:
        dish_map = dict(zip(session.dish_df['dish_code'], session.dish_df['dish_name']))
        df['dish_name'] = df['dish_code'].map(dish_map).fillna(df['dish_code'])
    else:
        df['dish_name'] = df['dish_code']
    
    if session.orders_df is not None:
        orders_subset = session.orders_df[['elderly_id', 'date', 'meal_type', 'dish_code', 'planned_weight']]
        df = pd.merge(df, orders_subset,
                     on=['elderly_id', 'date', 'meal_type', 'dish_code'],
                     how='left')
    
    display_cols = ['elderly_id', 'date', 'meal_type', 'dish_name', 
                   'planned_weight', 'actual_weight', 'is_manual']
    display_cols = [c for c in display_cols if c in df.columns]
    
    event = st.dataframe(
        df[display_cols].head(100),
        use_container_width=True,
        hide_index=True,
        on_select="rerun",
        selection_mode="single-row"
    )
    
    if event.selection.rows:
        selected_idx = event.selection.rows[0]
        if selected_idx < len(df):
            selected_row = df.iloc[selected_idx]
            
            st.markdown("---")
            st.subheader("编辑记录")
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.markdown(f"**老人编号**: {selected_row['elderly_id']}")
                st.markdown(f"**日期**: {selected_row['date']}")
                st.markdown(f"**餐次**: {selected_row['meal_type']}")
                st.markdown(f"**菜品**: {selected_row.get('dish_name', selected_row['dish_code'])}")
            
            with col2:
                planned = selected_row.get('planned_weight', 0)
                actual = selected_row['actual_weight']
                st.markdown(f"**预订克重**: {planned} g")
                st.markdown(f"**当前实际克重**: {actual} g")
                
                if planned > 0:
                    diff_pct = (actual - planned) / planned * 100
                    if diff_pct < -10:
                        st.error(f"⚠️ 少打 {abs(diff_pct):.1f}%")
                    elif diff_pct > 10:
                        st.warning(f"⚠️ 多打 {diff_pct:.1f}%")
                    else:
                        st.success("✅ 打餐量正常")
            
            st.markdown("---")
            
            new_weight = st.number_input(
                "修正实际克重 (g)",
                min_value=0.0,
                max_value=5000.0,
                value=float(actual),
                step=10.0
            )
            
            correction_reason = st.selectbox(
                "修正原因",
                ["称重记录错误", "打餐量统计错误", "系统录入错误", "其他原因"]
            )
            
            operator = st.text_input("操作员", value="营养师")
            
            if st.button("保存修正", type="primary"):
                correction = {
                    'data_type': 'serving',
                    'elderly_id': selected_row['elderly_id'],
                    'date': selected_row['date'],
                    'meal_type': selected_row['meal_type'],
                    'dish_code': selected_row['dish_code'],
                    'original_value': actual,
                    'new_value': new_weight,
                    'reason': correction_reason,
                    'operator': operator
                }
                
                if st.session_state.data_manager.apply_manual_correction(correction):
                    st.success("修正已保存！")
                    save_session(session, st.session_state.data_manager)
                    st.rerun()
                else:
                    st.error("保存失败")
    
    st.markdown("---")
    st.subheader("📋 修正历史")
    
    if session.manual_corrections is not None and not session.manual_corrections.empty:
        corr_df = session.manual_corrections.copy()
        corr_df['correction_time'] = pd.to_datetime(corr_df['correction_time'])
        
        st.dataframe(
            corr_df[['correction_time', 'elderly_id', 'meal_type', 'dish_code',
                    'original_value', 'new_value', 'correction_reason', 'operator']],
            use_container_width=True
        )
    else:
        st.info("暂无修正记录")


def tab_export():
    st.header("📤 数据导出")
    st.markdown("---")
    
    session = st.session_state.session
    
    if (session.orders_df is None or session.servings_df is None or
        session.dish_df is None or session.elderly_df is None):
        st.warning("请先导入完整数据")
        return
    
    all_dates = []
    for df in [session.orders_df, session.servings_df, session.wastes_df]:
        if df is not None and not df.empty and 'date' in df.columns:
            all_dates.extend(df['date'].dropna().tolist())
    
    min_date = min(all_dates) if all_dates else date.today()
    max_date = max(all_dates) if all_dates else date.today()
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        export_start = st.date_input("报告开始日期", min_date, key="export_start")
    with col2:
        export_end = st.date_input("报告结束日期", max_date, key="export_end")
    with col3:
        export_meals = st.multiselect("报告餐次", MEAL_TYPES, default=MEAL_TYPES, key="export_meals")
    
    st.markdown("---")
    
    tab1, tab2 = st.tabs(["📊 导出明细 CSV", "📝 生成复盘报告"])
    
    with tab1:
        st.subheader("选择要导出的数据")
        
        export_options = {
            '老人信息': session.elderly_df,
            '菜品信息': session.dish_df,
            '订餐数据': session.orders_df,
            '打餐数据': session.servings_df,
            '剩余数据': session.wastes_df,
            '修正记录': session.manual_corrections
        }
        
        selected_exports = []
        cols = st.columns(3)
        for i, (name, df) in enumerate(export_options.items()):
            with cols[i % 3]:
                if df is not None and not df.empty:
                    if st.checkbox(f"{name} ({len(df)}条)", key=f"export_{name}"):
                        selected_exports.append((name, df))
        
        if selected_exports and st.button("生成并下载 CSV", type="primary"):
            with st.spinner("正在生成导出文件..."):
                for name, df in selected_exports:
                    csv = df.to_csv(index=False, encoding='utf-8-sig')
                    st.download_button(
                        label=f"下载 {name}.csv",
                        data=csv,
                        file_name=f"{name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                        mime="text/csv",
                        key=f"download_{name}"
                    )
                
                st.success("导出文件已生成！")
    
    with tab2:
        st.subheader("配餐偏差复盘报告")
        
        engine = st.session_state.metrics_engine
        if engine is None:
            engine = MetricsEngine(session.dish_df, session.elderly_df)
        
        orders_filtered = filter_by_date_and_meal(session.orders_df, export_start, export_end, export_meals)
        servings_filtered = filter_by_date_and_meal(session.servings_df, export_start, export_end, export_meals)
        wastes_filtered = filter_by_date_and_meal(session.wastes_df or pd.DataFrame(), export_start, export_end, export_meals)
        
        if st.button("生成复盘报告", type="primary"):
            with st.spinner("正在生成报告..."):
                waste_analyses = engine.get_all_waste_analysis(
                    orders_filtered, servings_filtered, wastes_filtered,
                    export_start, export_end
                )
                
                chronic_analyses = engine.get_all_chronic_analysis(
                    servings_filtered, wastes_filtered, export_start, export_end
                )
                
                total_planned = orders_filtered['planned_weight'].sum() / 1000
                total_actual = servings_filtered['actual_weight'].sum() / 1000
                total_waste = wastes_filtered['waste_weight'].sum() / 1000 if not wastes_filtered.empty else 0
                waste_rate = (total_waste / total_actual * 100) if total_actual > 0 else 0
                
                nutrition_calc = NutritionCalculator(session.dish_df)
                
                report_data = {
                    'start_date': export_start,
                    'end_date': export_end,
                    'data_source': '配餐偏差复盘台',
                    'overall_stats': {
                        '分析天数': (export_end - export_start).days + 1,
                        '老人数': orders_filtered['elderly_id'].nunique(),
                        '订单数': len(orders_filtered),
                        '预订总量(kg)': round(total_planned, 2),
                        '实际总量(kg)': round(total_actual, 2),
                        '浪费总量(kg)': round(total_waste, 2),
                        '浪费率(%)': round(waste_rate, 2)
                    },
                    'nutrition_overview': [],
                    'waste_ranking': [],
                    'under_served': [],
                    'chronic_nutrition': [],
                    'nutrition_alerts': [],
                    'recommendations': []
                }
                
                for nut in NutritionType.list():
                    ref = NutritionType.get_daily_reference(nut)
                    report_data['nutrition_overview'].append({
                        '营养项': nut,
                        '实际摄入': '待计算',
                        '参考值': f"{ref} {NutritionType.get_unit(nut)}",
                        '偏差%': '待计算'
                    })
                
                for wa in waste_analyses[:10]:
                    report_data['waste_ranking'].append({
                        '菜品名称': wa.dish_name,
                        '分类': wa.dish_category,
                        '浪费率%': round(wa.avg_waste_rate, 2),
                        '少打次数': wa.under_serve_count
                    })
                
                for wa in waste_analyses:
                    if wa.is_persistent_under:
                        report_data['under_served'].append({
                            '菜品名称': wa.dish_name,
                            '分类': wa.dish_category,
                            '少打率%': round(wa.under_serve_rate, 2),
                            '是否长期少打': '是'
                        })
                
                for ca in chronic_analyses:
                    if ca.total_persons > 0:
                        report_data['chronic_nutrition'].append({
                            '慢病类型': ca.chronic_type,
                            '人数': ca.total_persons,
                            '钠摄入': f"{ca.avg_daily_nutrition.get('钠', 0):.0f}mg",
                            '蛋白质': f"{ca.avg_daily_nutrition.get('蛋白质', 0):.1f}g",
                            '关键问题': '; '.join(ca.key_concerns)
                        })
                        
                        for sug in ca.improvement_suggestions:
                            if sug not in report_data['recommendations']:
                                report_data['recommendations'].append(sug)
                
                st.markdown("---")
                st.subheader("📋 报告预览")
                
                col1, col2, col3, col4 = st.columns(4)
                with col1:
                    st.metric("分析天数", (export_end - export_start).days + 1)
                with col2:
                    st.metric("用餐老人数", orders_filtered['elderly_id'].nunique())
                with col3:
                    st.metric("总浪费率", f"{waste_rate:.1f}%")
                with col4:
                    st.metric("长期少打菜品", len(report_data['under_served']))
                
                if report_data['waste_ranking']:
                    st.subheader("🥗 浪费率 TOP 5")
                    waste_top5 = pd.DataFrame(report_data['waste_ranking'][:5])
                    st.dataframe(waste_top5, use_container_width=True, hide_index=True)
                
                if report_data['chronic_nutrition']:
                    st.subheader("🩺 各慢病标签营养状况")
                    chronic_df = pd.DataFrame(report_data['chronic_nutrition'])
                    st.dataframe(chronic_df, use_container_width=True, hide_index=True)
                
                if report_data['recommendations']:
                    st.subheader("💡 改进建议")
                    for i, rec in enumerate(report_data['recommendations'], 1):
                        st.info(f"{i}. {rec}")
                
                st.markdown("---")
                
                report_md = f"""# 配餐偏差复盘报告

## 报告信息
- **生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
- **分析周期**: {export_start} 至 {export_end}
- **数据来源**: 配餐偏差复盘台

## 一、总体概况

### 1.1 基本统计
| 指标 | 数值 |
|------|------|
| 分析天数 | {(export_end - export_start).days + 1} 天 |
| 用餐老人数 | {orders_filtered['elderly_id'].nunique()} 人 |
| 总订单数 | {len(orders_filtered)} 条 |
| 预订总量 | {total_planned:.2f} kg |
| 实际总量 | {total_actual:.2f} kg |
| 浪费总量 | {total_waste:.2f} kg |
| 浪费率 | {waste_rate:.2f}% |

## 二、菜品浪费分析

### 2.1 浪费率排行
"""
                
                if report_data['waste_ranking']:
                    report_md += "\n| 菜品名称 | 分类 | 浪费率(%) | 少打次数 |\n"
                    report_md += "|----------|------|-----------|----------|\n"
                    for item in report_data['waste_ranking'][:10]:
                        report_md += f"| {item['菜品名称']} | {item['分类']} | {item['浪费率%']} | {item['少打次数']} |\n"
                else:
                    report_md += "\n无浪费数据\n"
                
                report_md += """
### 2.2 长期少打菜品分析
"""
                
                if report_data['under_served']:
                    report_md += "\n| 菜品名称 | 分类 | 少打率(%) |\n"
                    report_md += "|----------|------|-----------|\n"
                    for item in report_data['under_served']:
                        report_md += f"| {item['菜品名称']} | {item['分类']} | {item['少打率%']} |\n"
                else:
                    report_md += "\n未发现长期少打菜品\n"
                
                report_md += """
## 三、慢病标签人群分析

### 3.1 各慢病标签营养摄入
"""
                
                if report_data['chronic_nutrition']:
                    report_md += "\n| 慢病类型 | 人数 | 钠摄入 | 蛋白质 | 关键问题 |\n"
                    report_md += "|----------|------|--------|--------|----------|\n"
                    for item in report_data['chronic_nutrition']:
                        report_md += f"| {item['慢病类型']} | {item['人数']} | {item['钠摄入']} | {item['蛋白质']} | {item['关键问题']} |\n"
                else:
                    report_md += "\n无慢病数据\n"
                
                report_md += """
## 四、改进建议
"""
                
                if report_data['recommendations']:
                    for i, rec in enumerate(report_data['recommendations'], 1):
                        report_md += f"{i}. {rec}\n"
                else:
                    report_md += "\n暂无特殊建议\n"
                
                report_md += """
---
*报告由配餐偏差复盘台自动生成*
"""
                
                st.download_button(
                    label="📥 下载 Markdown 报告",
                    data=report_md,
                    file_name=f"配餐偏差复盘报告_{export_start}_{export_end}.md",
                    mime="text/markdown",
                    type="primary"
                )
                
                st.success("报告生成完成！")


def main():
    init_session_state()
    
    show_sidebar()
    
    tabs = st.tabs([
        "📥 数据导入",
        "✅ 数据校验",
        "📊 数据分析",
        "✏️ 数据修正",
        "📤 数据导出"
    ])
    
    with tabs[0]:
        tab_data_import()
    
    with tabs[1]:
        tab_validation()
    
    with tabs[2]:
        tab_dashboard()
    
    with tabs[3]:
        tab_correction()
    
    with tabs[4]:
        tab_export()


if __name__ == "__main__":
    main()
