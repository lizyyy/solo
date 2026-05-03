import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from datetime import datetime, timedelta
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.data_loader import (
    get_sample_data,
    validate_data,
    parse_time_columns,
    load_csv_from_upload
)
from src.metrics import (
    add_metrics_columns,
    filter_data,
    get_overview_stats,
    calculate_route_metrics,
    calculate_time_period_metrics,
    calculate_daily_metrics
)
from src.anomaly_analyzer import AnomalyAnalyzer, AnomalyType
from src.schedule_simulator import (
    ScheduleSimulator,
    Adjustment,
    AdjustmentType
)
from src.report_exporter import ReportExporter

st.set_page_config(
    page_title="通勤班车准点分析工具",
    page_icon="🚌",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        color: #1a5276;
        text-align: center;
        margin-bottom: 2rem;
    }
    .metric-card {
        background-color: #f8f9fa;
        border-radius: 10px;
        padding: 1rem;
        text-align: center;
        box-shadow: 2px 2px 5px rgba(0,0,0,0.1);
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
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
    }
    .stTabs [data-baseweb="tab"] {
        height: 50px;
        white-space: pre-wrap;
        border-radius: 4px 4px 0px 0px;
        padding-top: 10px;
        padding-bottom: 10px;
    }
</style>
""", unsafe_allow_html=True)

def initialize_session_state():
    if 'data_loaded' not in st.session_state:
        st.session_state.data_loaded = False
    if 'df' not in st.session_state:
        st.session_state.df = None
    if 'df_with_metrics' not in st.session_state:
        st.session_state.df_with_metrics = None
    if 'filtered_df' not in st.session_state:
        st.session_state.filtered_df = None
    if 'anomalies' not in st.session_state:
        st.session_state.anomalies = []
    if 'scenario_results' not in st.session_state:
        st.session_state.scenario_results = []

def load_sample_data():
    with st.spinner('正在加载示例数据...'):
        df = get_sample_data()
        validation = validate_data(df)
        
        if not validation['valid']:
            st.error("示例数据验证失败!")
            for error in validation['errors']:
                st.error(f"❌ {error['message']}")
            return
        
        df_parsed = parse_time_columns(df)
        df_with_metrics = add_metrics_columns(df_parsed)
        
        st.session_state.df = df
        st.session_state.df_with_metrics = df_with_metrics
        st.session_state.filtered_df = df_with_metrics
        st.session_state.data_loaded = True
        
        for warning in validation['warnings']:
            st.warning(f"⚠️ {warning['message']}")
        
        st.success(f"✅ 成功加载示例数据，共 {len(df)} 条记录")

def load_uploaded_data(uploaded_file):
    try:
        with st.spinner('正在处理上传的文件...'):
            df = load_csv_from_upload(uploaded_file)
            validation = validate_data(df)
            
            if not validation['valid']:
                st.error("数据验证失败!")
                for error in validation['errors']:
                    st.error(f"❌ {error['message']}")
                return
            
            for warning in validation['warnings']:
                st.warning(f"⚠️ {warning['message']}")
            
            df_parsed = parse_time_columns(df)
            df_with_metrics = add_metrics_columns(df_parsed)
            
            st.session_state.df = df
            st.session_state.df_with_metrics = df_with_metrics
            st.session_state.filtered_df = df_with_metrics
            st.session_state.data_loaded = True
            st.session_state.anomalies = []
            st.session_state.scenario_results = []
            
            st.success(f"✅ 成功加载数据，共 {len(df)} 条记录")
            
    except Exception as e:
        st.error(f"文件处理出错: {str(e)}")

def render_data_loading_section():
    st.header("📁 数据加载")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("使用示例数据")
        st.write("点击下方按钮快速体验，使用内置的模拟数据。")
        if st.button("加载示例数据", type="primary", use_container_width=True):
            load_sample_data()
    
    with col2:
        st.subheader("上传您的数据")
        st.write("支持 CSV 格式，字段包括：日期、线路、站点、计划/实际时间、座位数、签到人数、司机备注。")
        uploaded_file = st.file_uploader("选择 CSV 文件", type=['csv'])
        
        if uploaded_file is not None:
            load_uploaded_data(uploaded_file)
    
    if st.session_state.data_loaded:
        with st.expander("查看原始数据预览"):
            st.dataframe(
                st.session_state.df.head(50),
                use_container_width=True
            )

def render_filters():
    if not st.session_state.data_loaded:
        return
    
    df = st.session_state.df_with_metrics
    
    st.sidebar.header("🔍 筛选条件")
    
    with st.sidebar.expander("日期范围", expanded=True):
        min_date = pd.to_datetime(df['日期']).min().date()
        max_date = pd.to_datetime(df['日期']).max().date()
        
        date_range = st.date_input(
            "选择日期范围",
            value=(min_date, max_date),
            min_value=min_date,
            max_value=max_date
        )
    
    with st.sidebar.expander("线路筛选", expanded=True):
        all_routes = sorted(df['线路'].unique().tolist())
        selected_routes = st.multiselect(
            "选择线路",
            options=all_routes,
            default=all_routes
        )
    
    with st.sidebar.expander("站点筛选", expanded=False):
        if selected_routes:
            available_stations = df[df['线路'].isin(selected_routes)]['站点'].unique().tolist()
        else:
            available_stations = sorted(df['站点'].unique().tolist())
        
        selected_stations = st.multiselect(
            "选择站点（可选）",
            options=sorted(available_stations),
            default=[]
        )
    
    with st.sidebar.expander("时段筛选", expanded=True):
        all_periods = ['早高峰', '晚高峰', '午间', '夜间', '平峰']
        selected_periods = st.multiselect(
            "选择时段",
            options=all_periods,
            default=all_periods
        )
    
    with st.sidebar.expander("其他筛选", expanded=False):
        weekdays_only = st.checkbox("仅工作日", value=False)
        remark_keyword = st.text_input("司机备注关键词（可选）")
    
    if st.sidebar.button("应用筛选", type="primary", use_container_width=True):
        start_date = date_range[0].strftime('%Y-%m-%d') if len(date_range) > 0 else None
        end_date = date_range[1].strftime('%Y-%m-%d') if len(date_range) > 1 else None
        
        filtered = filter_data(
            df,
            date_range=(start_date, end_date) if start_date and end_date else None,
            routes=selected_routes if selected_routes else None,
            stations=selected_stations if selected_stations else None,
            time_periods=selected_periods if selected_periods else None,
            weekdays_only=weekdays_only,
            remark_keyword=remark_keyword if remark_keyword else None
        )
        
        st.session_state.filtered_df = filtered
        st.rerun()
    
    if st.sidebar.button("重置筛选", use_container_width=True):
        st.session_state.filtered_df = st.session_state.df_with_metrics
        st.rerun()

def render_overview():
    if not st.session_state.data_loaded:
        st.info("请先加载数据")
        return
    
    df = st.session_state.filtered_df
    
    if df.empty:
        st.warning("当前筛选条件下没有数据")
        return
    
    stats = get_overview_stats(df)
    
    st.header("📊 数据概览")
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric(
            "平均准点率",
            f"{stats['平均准点率']:.1f}%",
            help="准点定义为延误不超过3分钟"
        )
    
    with col2:
        st.metric(
            "平均延误",
            f"{stats['平均延误_分钟']:.1f} 分钟",
            help="所有记录的平均延误时间"
        )
    
    with col3:
        st.metric(
            "平均座位利用率",
            f"{stats['平均座位利用率']:.1f}%",
            help="签到人数/座位数的平均值"
        )
    
    with col4:
        st.metric(
            "严重问题数",
            f"{stats['严重延误次数'] + stats['超载次数']}",
            help="严重延误(>10分钟)+超载次数"
        )
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric("总记录数", f"{stats['总记录数']}")
    
    with col2:
        st.metric("线路数", f"{stats['线路数']}")
    
    with col3:
        st.metric("站点数", f"{stats['站点数']}")
    
    tab1, tab2, tab3, tab4 = st.tabs(["📈 趋势分析", "🚌 线路对比", "🕐 时段分析", "📋 详细数据"])
    
    with tab1:
        render_daily_trend_chart(df)
    
    with tab2:
        render_route_comparison(df)
    
    with tab3:
        render_time_period_analysis(df)
    
    with tab4:
        render_detail_data(df)

def render_daily_trend_chart(df):
    st.subheader("每日趋势分析")
    
    daily_metrics = calculate_daily_metrics(df)
    
    if daily_metrics.empty:
        st.warning("没有足够的数据进行趋势分析")
        return
    
    fig = make_subplots(
        rows=2, cols=2,
        subplot_titles=('准点率趋势', '平均延误趋势', '座位利用率趋势', '严重延误次数'),
        vertical_spacing=0.15,
        horizontal_spacing=0.1
    )
    
    fig.add_trace(
        go.Scatter(
            x=daily_metrics.index,
            y=daily_metrics['准点率'] * 100,
            mode='lines+markers',
            name='准点率',
            line=dict(color='#2ecc71', width=2),
            marker=dict(size=6)
        ),
        row=1, col=1
    )
    
    fig.add_trace(
        go.Scatter(
            x=daily_metrics.index,
            y=daily_metrics['平均延误_分钟'],
            mode='lines+markers',
            name='平均延误(分钟)',
            line=dict(color='#e74c3c', width=2),
            marker=dict(size=6)
        ),
        row=1, col=2
    )
    
    fig.add_trace(
        go.Scatter(
            x=daily_metrics.index,
            y=daily_metrics['平均座位利用率'] * 100,
            mode='lines+markers',
            name='座位利用率',
            line=dict(color='#3498db', width=2),
            marker=dict(size=6)
        ),
        row=2, col=1
    )
    
    fig.add_trace(
        go.Bar(
            x=daily_metrics.index,
            y=daily_metrics['严重延误次数'],
            name='严重延误次数',
            marker=dict(color='#e67e22')
        ),
        row=2, col=2
    )
    
    fig.update_layout(
        height=600,
        showlegend=False,
        title_text="每日运营指标趋势"
    )
    
    fig.update_xaxes(tickangle=45)
    
    st.plotly_chart(fig, use_container_width=True)

def render_route_comparison(df):
    st.subheader("线路对比分析")
    
    route_metrics = calculate_route_metrics(df)
    
    if not route_metrics:
        st.warning("没有足够的数据进行线路对比")
        return
    
    routes_data = []
    for route, metrics in route_metrics.items():
        routes_data.append({
            '线路': route,
            '总班次': metrics.total_trips,
            '准点率': metrics.on_time_rate * 100,
            '平均延误': metrics.avg_delay_minutes,
            '延误波动': metrics.delay_std,
            '平均座位利用率': metrics.avg_seat_utilization * 100,
            '超载率': metrics.overload_rate * 100
        })
    
    routes_df = pd.DataFrame(routes_data)
    
    col1, col2 = st.columns(2)
    
    with col1:
        fig1 = px.bar(
            routes_df,
            x='线路',
            y='准点率',
            title='各线路准点率对比',
            color='准点率',
            color_continuous_scale='RdYlGn',
            text='准点率'
        )
        fig1.update_traces(texttemplate='%{text:.1f}%', textposition='outside')
        fig1.update_layout(yaxis_title='准点率 (%)')
        st.plotly_chart(fig1, use_container_width=True)
    
    with col2:
        fig2 = px.scatter(
            routes_df,
            x='平均延误',
            y='平均座位利用率',
            size='总班次',
            color='准点率',
            hover_name='线路',
            title='延误 vs 座位利用率',
            color_continuous_scale='RdYlGn',
            size_max=30
        )
        st.plotly_chart(fig2, use_container_width=True)
    
    st.subheader("线路详细指标")
    st.dataframe(
        routes_df.style.format({
            '准点率': '{:.1f}%',
            '平均延误': '{:.1f}分钟',
            '延误波动': '{:.1f}',
            '平均座位利用率': '{:.1f}%',
            '超载率': '{:.1f}%'
        }),
        use_container_width=True
    )

def render_time_period_analysis(df):
    st.subheader("时段分析")
    
    period_metrics = calculate_time_period_metrics(df)
    
    if period_metrics.empty:
        st.warning("没有足够的数据进行时段分析")
        return
    
    period_order = ['早高峰', '午间', '晚高峰', '夜间', '平峰']
    period_metrics = period_metrics.reindex([p for p in period_order if p in period_metrics.index])
    
    col1, col2 = st.columns(2)
    
    with col1:
        fig1 = px.bar(
            period_metrics,
            x=period_metrics.index,
            y='平均延误_分钟',
            title='各时段平均延误',
            color='平均延误_分钟',
            color_continuous_scale='Reds',
            text='平均延误_分钟'
        )
        fig1.update_traces(texttemplate='%{text:.1f}分钟', textposition='outside')
        st.plotly_chart(fig1, use_container_width=True)
    
    with col2:
        fig2 = px.bar(
            period_metrics,
            x=period_metrics.index,
            y='平均座位利用率',
            title='各时段平均座位利用率',
            color='平均座位利用率',
            color_continuous_scale='Blues',
            text='平均座位利用率'
        )
        fig2.update_traces(texttemplate='%{text:.1%}', textposition='outside')
        st.plotly_chart(fig2, use_container_width=True)
    
    st.subheader("时段详细指标")
    display_df = period_metrics.copy()
    display_df['准点率'] = display_df['准点率'].apply(lambda x: f"{x*100:.1f}%")
    display_df['严重延误率'] = display_df['严重延误率'].apply(lambda x: f"{x*100:.1f}%")
    display_df['平均座位利用率'] = display_df['平均座位利用率'].apply(lambda x: f"{x*100:.1f}%")
    display_df['超载率'] = display_df['超载率'].apply(lambda x: f"{x*100:.1f}%")
    display_df['高满载率'] = display_df['高满载率'].apply(lambda x: f"{x*100:.1f}%")
    
    st.dataframe(display_df, use_container_width=True)

def render_detail_data(df):
    st.subheader("详细数据")
    
    display_cols = [
        '日期', '线路', '站点', '计划发车时间', '实际发车时间',
        '最大延误_分钟', '是否准点', '座位数', '签到人数',
        '座位利用率', '是否超载', '时段', '司机备注'
    ]
    
    available_cols = [c for c in display_cols if c in df.columns]
    display_df = df[available_cols].copy()
    
    if '座位利用率' in display_df.columns:
        display_df['座位利用率'] = display_df['座位利用率'].apply(
            lambda x: f"{x*100:.1f}%" if pd.notna(x) else 'N/A'
        )
    
    if '最大延误_分钟' in display_df.columns:
        display_df['最大延误_分钟'] = display_df['最大延误_分钟'].apply(
            lambda x: f"{x:.1f}" if pd.notna(x) else 'N/A'
        )
    
    st.dataframe(
        display_df,
        use_container_width=True,
        hide_index=True
    )
    
    csv = df.to_csv(index=False).encode('utf-8-sig')
    st.download_button(
        label="下载当前筛选的数据 (CSV)",
        data=csv,
        file_name=f"commute_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
        mime='text/csv'
    )

def render_anomaly_analysis():
    if not st.session_state.data_loaded:
        st.info("请先加载数据")
        return
    
    df = st.session_state.filtered_df
    
    if df.empty:
        st.warning("当前筛选条件下没有数据")
        return
    
    st.header("🔍 异常归因分析")
    
    col1, col2, col3 = st.columns([2, 2, 1])
    
    with col3:
        if st.button("重新运行分析", type="primary", use_container_width=True):
            with st.spinner('正在分析异常...'):
                analyzer = AnomalyAnalyzer(df)
                anomalies = analyzer.analyze_all()
                st.session_state.anomalies = anomalies
                st.rerun()
    
    if not st.session_state.anomalies:
        with st.spinner('正在分析异常...'):
            analyzer = AnomalyAnalyzer(df)
            anomalies = analyzer.analyze_all()
            st.session_state.anomalies = anomalies
    
    anomalies = st.session_state.anomalies
    
    if not anomalies:
        st.success("✅ 未检测到明显异常问题")
        return
    
    by_severity = {'严重': [], '中等': [], '轻微': []}
    for a in anomalies:
        if a.severity in by_severity:
            by_severity[a.severity].append(a)
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric(
            "🔴 严重问题",
            len(by_severity['严重']),
            delta_color="inverse"
        )
    
    with col2:
        st.metric(
            "🟡 中等问题",
            len(by_severity['中等'])
        )
    
    with col3:
        st.metric(
            "🔵 轻微问题",
            len(by_severity['轻微'])
        )
    
    for severity in ['严重', '中等', '轻微']:
        if not by_severity[severity]:
            continue
        
        st.subheader(f"{severity}问题")
        
        for idx, anomaly in enumerate(by_severity[severity], 1):
            with st.expander(f"{idx}. {anomaly.anomaly_type.value} - {anomaly.location}", expanded=(severity == '严重')):
                col1, col2 = st.columns([1, 1])
                
                with col1:
                    st.markdown(f"**描述**: {anomaly.description}")
                    st.markdown(f"**原因分析**: {anomaly.cause_analysis}")
                
                with col2:
                    st.markdown("**关键指标**:")
                    for key, value in anomaly.metrics.items():
                        st.text(f"  • {key}: {value}")
                
                st.info(f"💡 **调整建议**: {anomaly.suggestion}")
                
                if not anomaly.affected_records.empty:
                    with st.expander("查看受影响的记录"):
                        display_cols = ['日期', '线路', '站点', '最大延误_分钟', '座位利用率', '司机备注']
                        available_cols = [c for c in display_cols if c in anomaly.affected_records.columns]
                        st.dataframe(
                            anomaly.affected_records[available_cols].head(20),
                            use_container_width=True,
                            hide_index=True
                        )

def render_scenario_simulation():
    if not st.session_state.data_loaded:
        st.info("请先加载数据")
        return
    
    df = st.session_state.filtered_df
    
    if df.empty:
        st.warning("当前筛选条件下没有数据")
        return
    
    st.header("🎯 调班方案对比")
    
    st.markdown("""
    通过模拟不同的调班方案，分析对准点率和满载率的影响。
    支持三种调整方式：
    - **调整发车时间**: 提前或延后发车，避开拥堵
    - **增加座位数**: 更换更大容量的车型
    - **增加班次**: 在高峰时段增加发车频率
    """)
    
    all_routes = sorted(df['线路'].unique().tolist())
    all_periods = ['早高峰', '晚高峰', '午间', '夜间', '平峰']
    
    col1, col2 = st.columns([1, 1])
    
    with col1:
        st.subheader("设置调班方案")
        
        selected_route = st.selectbox("选择线路", options=all_routes)
        
        adjustment_type = st.radio(
            "调整类型",
            options=["调整发车时间", "增加座位数", "增加班次"]
        )
        
        scenario_name = st.text_input("方案名称", value=f"方案 {len(st.session_state.scenario_results) + 1}")
        
        params = {}
        
        if adjustment_type == "调整发车时间":
            col_a, col_b = st.columns(2)
            with col_a:
                direction = st.radio("调整方向", options=["提前发车", "延后发车"])
            with col_b:
                minutes = st.slider("调整分钟数", min_value=1, max_value=30, value=10)
            
            time_period = st.selectbox(
                "适用时段（可选）",
                options=["全部时段"] + all_periods
            )
            
            params['minutes'] = -minutes if direction == "提前发车" else minutes
            params['time_period'] = time_period if time_period != "全部时段" else None
            
            adj_type = AdjustmentType.SHIFT_TIME
            
        elif adjustment_type == "增加座位数":
            additional_seats = st.slider("增加座位数", min_value=5, max_value=30, value=10)
            
            params['additional_seats'] = additional_seats
            adj_type = AdjustmentType.INCREASE_SEATS
            
        else:
            time_period = st.selectbox("选择时段", options=all_periods)
            trips_to_add = st.slider("增加班次数量", min_value=1, max_value=3, value=1)
            
            params['time_period'] = time_period
            params['trips_to_add'] = trips_to_add
            adj_type = AdjustmentType.ADD_TRIP
        
        if st.button("添加方案进行对比", type="primary"):
            adjustment = Adjustment(
                adjustment_type=adj_type,
                route_name=selected_route,
                description=scenario_name,
                parameters=params
            )
            
            simulator = ScheduleSimulator(df)
            result = simulator.compare_scenario(adjustment)
            
            st.session_state.scenario_results.append(result)
            st.success(f"✅ 已添加方案: {scenario_name}")
    
    with col2:
        st.subheader("已添加的方案")
        
        if st.session_state.scenario_results:
            for idx, result in enumerate(st.session_state.scenario_results):
                with st.expander(f"方案 {idx + 1}: {result.scenario_name}", expanded=True):
                    st.markdown("**调整前后对比**:")
                    
                    improvement = result.improvement_summary
                    
                    col_a, col_b, col_c = st.columns(3)
                    
                    with col_a:
                        ontime_imp = improvement.get('准点率', 0)
                        st.metric(
                            "准点率变化",
                            f"{ontime_imp:+.1f}%",
                            delta_color="normal" if ontime_imp >= 0 else "inverse"
                        )
                    
                    with col_b:
                        delay_imp = improvement.get('平均延误_分钟', 0)
                        st.metric(
                            "平均延误变化",
                            f"{-delay_imp:+.1f}分钟",
                            delta_color="normal" if delay_imp >= 0 else "inverse"
                        )
                    
                    with col_c:
                        overload_imp = improvement.get('超载率', 0)
                        st.metric(
                            "超载率变化",
                            f"{-overload_imp:+.1f}%",
                            delta_color="normal" if overload_imp >= 0 else "inverse"
                        )
                    
                    if st.button(f"删除方案 {idx + 1}", key=f"del_{idx}"):
                        st.session_state.scenario_results.pop(idx)
                        st.rerun()
        else:
            st.info("请在左侧设置并添加调班方案")
    
    if st.session_state.scenario_results:
        st.markdown("---")
        st.subheader("📊 方案对比分析")
        
        comparison_data = []
        
        for idx, result in enumerate(st.session_state.scenario_results):
            row = {
                '方案名称': result.scenario_name,
                '准点率(后)': f"{result.adjusted_metrics.get('准点率', 0):.1f}%",
                '准点率提升': f"{result.improvement_summary.get('准点率', 0):+.1f}%",
                '平均延误(后)': f"{result.adjusted_metrics.get('平均延误_分钟', 0):.1f}分钟",
                '延误减少': f"{result.improvement_summary.get('平均延误_分钟', 0):+.1f}分钟",
                '超载率(后)': f"{result.adjusted_metrics.get('超载率', 0):.1f}%",
                '超载减少': f"{result.improvement_summary.get('超载率', 0):+.1f}%",
            }
            comparison_data.append(row)
        
        comparison_df = pd.DataFrame(comparison_data)
        st.dataframe(comparison_df, use_container_width=True, hide_index=True)
        
        chart_data = []
        for idx, result in enumerate(st.session_state.scenario_results):
            chart_data.append({
                '方案': result.scenario_name,
                '准点率提升': result.improvement_summary.get('准点率', 0),
                '延误减少': result.improvement_summary.get('平均延误_分钟', 0),
                '超载率下降': result.improvement_summary.get('超载率', 0)
            })
        
        if chart_data:
            chart_df = pd.DataFrame(chart_data)
            
            fig = go.Figure()
            
            fig.add_trace(go.Bar(
                x=chart_df['方案'],
                y=chart_df['准点率提升'],
                name='准点率提升 (%)',
                marker_color='#2ecc71'
            ))
            
            fig.add_trace(go.Bar(
                x=chart_df['方案'],
                y=chart_df['延误减少'],
                name='延误减少 (分钟)',
                marker_color='#3498db'
            ))
            
            fig.add_trace(go.Bar(
                x=chart_df['方案'],
                y=chart_df['超载率下降'],
                name='超载率下降 (%)',
                marker_color='#e74c3c'
            ))
            
            fig.update_layout(
                barmode='group',
                title='各方案效果对比',
                xaxis_title='方案',
                yaxis_title='改善幅度',
                legend_title='指标'
            )
            
            st.plotly_chart(fig, use_container_width=True)
        
        col1, col2 = st.columns([1, 1])
        with col1:
            if st.button("清空所有方案", type="secondary"):
                st.session_state.scenario_results = []
                st.rerun()

def render_report_export():
    if not st.session_state.data_loaded:
        st.info("请先加载数据")
        return
    
    df = st.session_state.filtered_df
    
    if df.empty:
        st.warning("当前筛选条件下没有数据")
        return
    
    st.header("📄 报告导出")
    
    overview_stats = get_overview_stats(df)
    anomalies = st.session_state.anomalies
    scenario_results = st.session_state.scenario_results
    
    st.markdown("""
    导出包含以下内容的分析报告：
    - 关键指标概览
    - 异常问题汇总（按严重程度分组）
    - 调班方案对比结论
    """)
    
    col1, col2 = st.columns([1, 1])
    
    with col1:
        st.subheader("报告预览")
        
        with st.spinner('正在生成报告...'):
            exporter = ReportExporter(
                overview_stats=overview_stats,
                anomalies=anomalies,
                scenario_results=scenario_results,
                filtered_df=df
            )
            
            markdown_content = exporter.generate_markdown()
            
            with st.expander("查看 Markdown 报告内容", expanded=True):
                st.markdown(markdown_content)
    
    with col2:
        st.subheader("下载报告")
        
        md_b64, _ = exporter.get_downloadable_markdown()
        html_b64, _ = exporter.get_downloadable_html()
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        st.download_button(
            label="📥 下载 Markdown 格式",
            data=markdown_content,
            file_name=f"commute_analysis_report_{timestamp}.md",
            mime="text/markdown",
            use_container_width=True
        )
        
        html_content = exporter.generate_html()
        st.download_button(
            label="📥 下载 HTML 格式",
            data=html_content,
            file_name=f"commute_analysis_report_{timestamp}.html",
            mime="text/html",
            use_container_width=True
        )
        
        st.info("💡 提示：HTML 格式报告包含样式，可以直接在浏览器中打开查看或打印")

def main():
    initialize_session_state()
    
    st.markdown("<h1 class='main-header'>🚌 通勤班车准点分析工具</h1>", unsafe_allow_html=True)
    
    if not st.session_state.data_loaded:
        render_data_loading_section()
    else:
        render_filters()
        
        tab1, tab2, tab3, tab4, tab5 = st.tabs([
            "📊 数据概览",
            "🔍 异常归因",
            "🎯 调班模拟",
            "📄 报告导出",
            "📁 数据管理"
        ])
        
        with tab1:
            render_overview()
        
        with tab2:
            render_anomaly_analysis()
        
        with tab3:
            render_scenario_simulation()
        
        with tab4:
            render_report_export()
        
        with tab5:
            render_data_loading_section()

if __name__ == "__main__":
    main()
