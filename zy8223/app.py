import streamlit as st
import pandas as pd
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from modules.data_loader import DataLoader
from modules.risk_calculator import RiskCalculator
from modules.exporter import Exporter


st.set_page_config(
    page_title="行道树台风倒伏风险复盘看板",
    page_icon="🌳",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
<style>
    .main-header {
        font-size: 2rem;
        font-weight: bold;
        color: #1f77b4;
        margin-bottom: 1rem;
    }
    .sub-header {
        font-size: 1.2rem;
        color: #555;
        margin-bottom: 0.5rem;
    }
    .risk-high {
        color: #d62728;
        font-weight: bold;
    }
    .risk-medium {
        color: #ff7f0e;
        font-weight: bold;
    }
    .risk-low {
        color: #2ca02c;
        font-weight: bold;
    }
    .warning-box {
        background-color: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 4px;
        padding: 10px;
        margin: 10px 0;
    }
    .success-box {
        background-color: #d4edda;
        border: 1px solid #28a745;
        border-radius: 4px;
        padding: 10px;
        margin: 10px 0;
    }
</style>
""", unsafe_allow_html=True)


@st.cache_resource
def get_data_loader():
    return DataLoader()


@st.cache_resource
def get_exporter():
    return Exporter()


def main():
    st.markdown('<div class="main-header">🌳 行道树台风倒伏风险复盘看板</div>', unsafe_allow_html=True)
    st.markdown('<div class="sub-header">台风过后树木风险评估与处置决策支持系统</div>', unsafe_allow_html=True)

    data_loader = get_data_loader()
    exporter = get_exporter()

    if 'data_loaded' not in st.session_state:
        st.session_state.data_loaded = False
    if 'tree_inventory' not in st.session_state:
        st.session_state.tree_inventory = None
    if 'inspection_events' not in st.session_state:
        st.session_state.inspection_events = None
    if 'weather_hourly' not in st.session_state:
        st.session_state.weather_hourly = None
    if 'risk_rules' not in st.session_state:
        st.session_state.risk_rules = None
    if 'risk_df' not in st.session_state:
        st.session_state.risk_df = None
    if 'statistics' not in st.session_state:
        st.session_state.statistics = None
    if 'typhoon_periods' not in st.session_state:
        st.session_state.typhoon_periods = []
    if 'selected_period' not in st.session_state:
        st.session_state.selected_period = None
    if 'warnings' not in st.session_state:
        st.session_state.warnings = {}

    with st.sidebar:
        st.header("📂 数据导入")

        sample_dir = os.path.join(os.path.dirname(__file__), 'sample_data')
        if os.path.exists(sample_dir):
            if st.button("📊 加载示例数据", use_container_width=True):
                try:
                    results = data_loader.load_sample_data(sample_dir)
                    
                    if 'tree_inventory' in results:
                        st.session_state.tree_inventory, st.session_state.warnings['tree'] = results['tree_inventory']
                    if 'inspection_events' in results:
                        st.session_state.inspection_events, st.session_state.warnings['inspection'] = results['inspection_events']
                    if 'weather_hourly' in results:
                        st.session_state.weather_hourly, st.session_state.warnings['weather'] = results['weather_hourly']
                    if 'risk_rules' in results:
                        st.session_state.risk_rules, st.session_state.warnings['rules'] = results['risk_rules']

                    st.session_state.typhoon_periods = data_loader.get_typhoon_periods()
                    st.session_state.data_loaded = True
                    st.success("✅ 示例数据加载成功！")
                    st.rerun()
                except Exception as e:
                    st.error(f"❌ 加载示例数据失败: {e}")

        st.subheader("或上传数据文件")

        tree_file = st.file_uploader("树木台账 CSV", type=['csv'], key='tree_upload')
        inspection_file = st.file_uploader("巡查事件 JSONL", type=['jsonl'], key='inspection_upload')
        weather_file = st.file_uploader("小时级风雨 CSV", type=['csv'], key='weather_upload')
        rules_file = st.file_uploader("风险规则 YAML", type=['yaml', 'yml'], key='rules_upload')

        if st.button("🔄 加载上传的数据", use_container_width=True):
            try:
                temp_dir = 'temp_uploads'
                os.makedirs(temp_dir, exist_ok=True)

                if tree_file:
                    temp_path = os.path.join(temp_dir, tree_file.name)
                    with open(temp_path, 'wb') as f:
                        f.write(tree_file.getbuffer())
                    st.session_state.tree_inventory, st.session_state.warnings['tree'] = data_loader.load_tree_inventory(temp_path)

                if inspection_file:
                    temp_path = os.path.join(temp_dir, inspection_file.name)
                    with open(temp_path, 'wb') as f:
                        f.write(inspection_file.getbuffer())
                    st.session_state.inspection_events, st.session_state.warnings['inspection'] = data_loader.load_inspection_events(temp_path)

                if weather_file:
                    temp_path = os.path.join(temp_dir, weather_file.name)
                    with open(temp_path, 'wb') as f:
                        f.write(weather_file.getbuffer())
                    st.session_state.weather_hourly, st.session_state.warnings['weather'] = data_loader.load_weather_hourly(temp_path)

                if rules_file:
                    temp_path = os.path.join(temp_dir, rules_file.name)
                    with open(temp_path, 'wb') as f:
                        f.write(rules_file.getbuffer())
                    st.session_state.risk_rules, st.session_state.warnings['rules'] = data_loader.load_risk_rules(temp_path)

                st.session_state.typhoon_periods = data_loader.get_typhoon_periods()
                st.session_state.data_loaded = True
                st.success("✅ 数据加载成功！")
                st.rerun()

            except Exception as e:
                st.error(f"❌ 数据加载失败: {e}")

        if st.session_state.data_loaded:
            st.divider()
            st.header("⚙️ 筛选条件")

            if st.session_state.tree_inventory is not None:
                road_names = sorted(st.session_state.tree_inventory['road_name'].dropna().unique().tolist())
                tree_species = sorted(st.session_state.tree_inventory['tree_species'].dropna().unique().tolist())

                selected_roads = st.multiselect("选择路段", road_names, default=[], placeholder="所有路段")
                selected_species = st.multiselect("选择树种", tree_species, default=[], placeholder="所有树种")

                st.session_state.filters = {
                    'road_names': selected_roads,
                    'tree_species': selected_species
                }

            if st.session_state.inspection_events is not None:
                status_options = {
                    'all': '全部状态',
                    'pending': '待处置',
                    'processing': '处置中',
                    'resolved': '已处置',
                    'no_action': '无需处置'
                }
                selected_status = st.multiselect(
                    "处置状态",
                    options=list(status_options.keys()),
                    format_func=lambda x: status_options[x],
                    default=['all'],
                    placeholder="选择状态"
                )
                st.session_state.filters['disposal_status'] = selected_status

            risk_level_options = {
                'all': '全部等级',
                'high': '高风险',
                'medium': '中风险',
                'low': '低风险',
                'very_low': '极低风险'
            }
            selected_risk_levels = st.multiselect(
                "风险等级",
                options=list(risk_level_options.keys()),
                format_func=lambda x: risk_level_options[x],
                default=['all'],
                placeholder="选择风险等级"
            )
            st.session_state.filters['risk_levels'] = selected_risk_levels

            if st.session_state.typhoon_periods:
                period_options = {None: '全部时段'}
                for i, period in enumerate(st.session_state.typhoon_periods):
                    period_options[i] = period['label']
                
                selected_period_idx = st.selectbox(
                    "选择台风时段",
                    options=list(period_options.keys()),
                    format_func=lambda x: period_options[x],
                    index=0
                )
                if selected_period_idx is not None:
                    st.session_state.selected_period = st.session_state.typhoon_periods[selected_period_idx]
                else:
                    st.session_state.selected_period = None
            else:
                st.session_state.selected_period = None

            if st.button("🔍 应用筛选并计算风险", use_container_width=True, type='primary'):
                calculate_risk()

    if not st.session_state.data_loaded:
        show_welcome_page()
    else:
        show_dashboard()


def calculate_risk():
    if st.session_state.tree_inventory is None:
        st.error("❌ 请先加载树木台账数据")
        return

    if st.session_state.risk_rules is None:
        st.warning("⚠️ 未加载风险规则，将使用默认规则")

    try:
        calculator = RiskCalculator(st.session_state.risk_rules or {})

        if st.session_state.weather_hourly is not None:
            calculator.set_weather_data(st.session_state.weather_hourly)

        if st.session_state.inspection_events is not None:
            calculator.set_inspection_events(st.session_state.inspection_events)

        risk_df = calculator.calculate_all_trees_risk(
            st.session_state.tree_inventory,
            st.session_state.selected_period
        )

        filters = st.session_state.get('filters', {})
        filtered_df = calculator.filter_risk_list(risk_df, filters)

        st.session_state.risk_df = filtered_df
        st.session_state.statistics = calculator.get_statistics(filtered_df)

        st.success(f"✅ 风险计算完成！共评估 {len(filtered_df)} 棵树木")
        st.rerun()

    except Exception as e:
        st.error(f"❌ 风险计算失败: {e}")
        import traceback
        st.error(traceback.format_exc())


def show_welcome_page():
    st.markdown("""
    ## 👋 欢迎使用行道树台风风险复盘看板

    本系统帮助您在台风过后快速评估行道树的倒伏风险，提供科学的处置决策支持。

    ### 📋 功能特点

    - **数据导入**: 支持树木台账、巡查事件、气象数据和风险规则
    - **风险计算**: 综合评估风雨暴露、浅根、高龄、积水等风险因子
    - **智能筛选**: 按路段、树种、处置状态、风险等级多维度筛选
    - **边界处理**: 妥善处理跨午夜台风、重复巡查、缺失经纬度等情况
    - **导出报告**: 生成风险清单 CSV 和复盘报告 Markdown

    ### 📁 数据格式要求

    | 数据类型 | 格式 | 关键字段 |
    |---------|------|---------|
    | 树木台账 | CSV | tree_id, road_name, tree_species, tree_age, root_depth_category, has_water_pool, latitude, longitude |
    | 巡查事件 | JSONL | tree_id, inspection_time, disposal_status, damage_type |
    | 气象数据 | CSV | time, wind_speed, rainfall |
    | 风险规则 | YAML | 自定义风险阈值和权重 |

    ### 🚀 开始使用

    请通过左侧边栏：
    1. **推荐**: 点击「加载示例数据」快速体验
    2. **或**: 分别上传您的数据文件

    加载数据后，设置筛选条件，点击「应用筛选并计算风险」即可看到分析结果。
    """)

    show_data_format_examples()


def show_data_format_examples():
    st.divider()
    st.subheader("📝 数据格式示例")

    tab1, tab2, tab3, tab4 = st.tabs(["树木台账 CSV", "巡查事件 JSONL", "气象数据 CSV", "风险规则 YAML"])

    with tab1:
        st.code("""tree_id,road_name,tree_species,tree_age,root_depth_category,has_water_pool,latitude,longitude
T001,中山路,樟树,35,浅根,True,31.2304,121.4737
T002,中山路,悬铃木,20,中根,False,31.2306,121.4739
T003,北京路,水杉,40,浅根,True,31.2310,121.4745
T004,北京路,香樟,15,深根,False,,
T005,南京路,广玉兰,25,中根,False,31.2320,121.4755""", language="csv")

    with tab2:
        st.code("""{"tree_id": "T001", "inspection_time": "2024-07-25 14:30:00", "disposal_status": "待处置", "damage_type": "fall_over", "inspector": "张三"}
{"tree_id": "T002", "inspection_time": "2024-07-25 15:00:00", "disposal_status": "处置中", "damage_type": "branch_break", "inspector": "李四"}
{"tree_id": "T003", "inspection_time": "2024-07-25 10:00:00", "disposal_status": "已处置", "damage_type": "leaning", "inspector": "王五"}
{"tree_id": "T001", "inspection_time": "2024-07-26 09:00:00", "disposal_status": "处置中", "damage_type": "fall_over", "inspector": "赵六"}
{"tree_id": "T005", "inspection_time": "2024-07-25 16:00:00", "disposal_status": "无需处置", "damage_type": null, "inspector": "孙七"}""", language="json")

    with tab3:
        st.code("""time,wind_speed,rainfall,temperature
2024-07-24 20:00:00,12,5,28
2024-07-24 21:00:00,15,8,27
2024-07-24 22:00:00,18,12,26
2024-07-24 23:00:00,22,15,25
2024-07-25 00:00:00,25,18,24
2024-07-25 01:00:00,28,20,23
2024-07-25 02:00:00,32,25,23
2024-07-25 03:00:00,29,22,24
2024-07-25 04:00:00,24,15,25
2024-07-25 05:00:00,18,8,26""", language="csv")

    with tab4:
        st.code("""wind_risk:
  thresholds:
    - wind_speed: 10
      risk_level: low
    - wind_speed: 20
      risk_level: medium
    - wind_speed: 30
      risk_level: high
  weights:
    exposure_hours: 0.3
    max_wind: 0.7

root_risk:
  shallow_root_factor: 1.5
  categories:
    浅根: high
    中根: medium
    深根: low

age_risk:
  old_tree_age_threshold: 30
  young_tree_age_threshold: 10
  age_factor:
    old: 1.5
    young: 0.8
    normal: 1.0

water_risk:
  rainfall_threshold: 50
  water_pool_factor: 1.3

overall_risk:
  weights:
    wind_risk: 0.35
    root_risk: 0.25
    age_risk: 0.20
    water_risk: 0.20
  thresholds:
    low: 30
    medium: 60
    high: 80

damage_types:
  fall_over: 倒伏
  branch_break: 断枝
  leaning: 倾斜
  root_exposed: 露根""", language="yaml")


def show_dashboard():
    if 'warnings' in st.session_state:
        for source, warning_info in st.session_state.warnings.items():
            if warning_info.get('count', 0) > 0:
                with st.expander(f"⚠️ 数据加载警告 - {source} ({warning_info['count']} 条)"):
                    for detail in warning_info.get('details', []):
                        st.warning(f"[{detail['type']}] {detail['message']}")

    if st.session_state.risk_df is None or st.session_state.statistics is None:
        st.info("💡 请设置筛选条件后点击「应用筛选并计算风险」查看分析结果")
        show_data_summary()
        return

    show_risk_dashboard()


def show_data_summary():
    st.subheader("📊 数据概览")

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        if st.session_state.tree_inventory is not None:
            st.metric("树木总数", len(st.session_state.tree_inventory))
        else:
            st.metric("树木总数", "未加载")

    with col2:
        if st.session_state.inspection_events is not None:
            st.metric("巡查记录", len(st.session_state.inspection_events))
        else:
            st.metric("巡查记录", "未加载")

    with col3:
        if st.session_state.weather_hourly is not None:
            st.metric("气象记录", len(st.session_state.weather_hourly))
        else:
            st.metric("气象记录", "未加载")

    with col4:
        if st.session_state.typhoon_periods:
            st.metric("台风时段", len(st.session_state.typhoon_periods))
        else:
            st.metric("台风时段", "未识别")

    if st.session_state.typhoon_periods:
        st.subheader("🌀 识别到的台风时段")
        for i, period in enumerate(st.session_state.typhoon_periods):
            with st.container():
                col1, col2, col3, col4 = st.columns(4)
                with col1:
                    st.write(f"**时段 {i+1}**")
                    st.write(f"开始: {period['start'].strftime('%Y-%m-%d %H:%M')}")
                    st.write(f"结束: {period['end'].strftime('%Y-%m-%d %H:%M')}")
                with col2:
                    st.metric("最大风速", f"{period['max_wind']:.1f} m/s")
                with col3:
                    st.metric("累计降雨", f"{period['total_rain']:.1f} mm")
                with col4:
                    st.metric("持续时长", f"{period['duration_hours']:.1f} 小时")
                    if period['cross_midnight']:
                        st.warning("⚠️ 跨午夜")


def show_risk_dashboard():
    stats = st.session_state.statistics
    risk_df = st.session_state.risk_df

    st.subheader("📈 风险统计概览")

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric("评估树木", stats.get('total_trees', 0))

    with col2:
        st.metric("平均风险评分", stats.get('avg_risk_score', 0))

    with col3:
        high_risk = stats.get('high_risk_count', 0)
        color = "🔴" if high_risk > 0 else "✅"
        st.metric(f"{color} 高风险树木", high_risk)

    with col4:
        pending = stats.get('pending_count', 0)
        color = "🟡" if pending > 0 else "✅"
        st.metric(f"{color} 待处置", pending)

    col5, col6, col7, col8 = st.columns(4)

    with col5:
        damaged = stats.get('damaged_count', 0)
        st.metric("已受损树木", damaged)

    with col6:
        fall_over = stats.get('fall_over_count', 0)
        st.metric("🌀 倒伏", fall_over)

    with col7:
        branch_break = stats.get('branch_break_count', 0)
        st.metric("🌿 断枝", branch_break)

    with col8:
        no_coords = stats.get('without_coordinates', 0)
        if no_coords > 0:
            st.metric("⚠️ 缺失经纬度", no_coords)
        else:
            st.metric("经纬度完整", "全部")

    tab1, tab2, tab3, tab4 = st.tabs(["🎯 优先处置清单", "📊 风险分布", "🗂️ 详细列表", "📥 数据导出"])

    with tab1:
        show_priority_list(risk_df)

    with tab2:
        show_risk_distribution(risk_df, stats)

    with tab3:
        show_detail_list(risk_df)

    with tab4:
        show_export_section(risk_df, stats)


def show_priority_list(risk_df: pd.DataFrame):
    st.subheader("🎯 优先处置清单")

    priority_type = st.radio(
        "筛选类型",
        options=['all', 'fall_over', 'branch_break', 'high_risk', 'pending'],
        format_func=lambda x: {
            'all': '全部优先 (按风险排序)',
            'fall_over': '🌪️ 仅倒伏树木',
            'branch_break': '🌿 仅断枝树木',
            'high_risk': '⚠️ 仅高/中风险',
            'pending': '⏳ 仅待处置'
        }[x],
        horizontal=True
    )

    calculator = RiskCalculator(st.session_state.risk_rules or {})
    priority_df = calculator.get_priority_disposal_list(risk_df, priority_type)

    if priority_df.empty:
        st.info("当前筛选条件下没有数据")
        return

    st.write(f"**共 {len(priority_df)} 条记录需要优先处置**")

    display_cols = [
        'priority', 'tree_id', 'road_name', 'tree_species',
        'overall_risk_score', 'overall_risk_level_cn',
        'disposal_status_cn', 'damage_type_cn', 'risk_tags'
    ]

    display_df = priority_df[[col for col in display_cols if col in priority_df.columns]].copy()

    if 'risk_tags' in display_df.columns:
        display_df['risk_tags'] = display_df['risk_tags'].apply(
            lambda x: ','.join(x) if isinstance(x, list) else ''
        )

    def color_risk(val):
        if val in ['高', 'high']:
            return 'background-color: #ffcccc'
        elif val in ['中', 'medium']:
            return 'background-color: #fff3cc'
        elif val in ['低', 'low']:
            return 'background-color: #ccffcc'
        return ''

    st.dataframe(
        display_df.style.applymap(color_risk, subset=['overall_risk_level_cn']),
        use_container_width=True,
        hide_index=True
    )

    show_priority_summary(priority_df)


def show_priority_summary(priority_df: pd.DataFrame):
    st.subheader("📋 按路段汇总")

    if 'road_name' in priority_df.columns:
        road_summary = priority_df.groupby('road_name').agg({
            'tree_id': 'count',
            'overall_risk_score': 'mean',
            'priority': 'min'
        }).round(2).sort_values('priority')

        road_summary.columns = ['树木数量', '平均风险评分', '最高优先级']
        st.dataframe(road_summary, use_container_width=True)

    st.subheader("🌳 按树种汇总")
    if 'tree_species' in priority_df.columns:
        species_summary = priority_df.groupby('tree_species').agg({
            'tree_id': 'count',
            'overall_risk_score': 'mean'
        }).round(2).sort_values('overall_risk_score', ascending=False)

        species_summary.columns = ['树木数量', '平均风险评分']
        st.dataframe(species_summary, use_container_width=True)


def show_risk_distribution(risk_df: pd.DataFrame, stats: Dict):
    st.subheader("📊 风险分布")

    col1, col2 = st.columns(2)

    with col1:
        st.markdown("**风险等级分布**")
        risk_dist = stats.get('risk_distribution_cn', {})
        if risk_dist:
            risk_df_display = pd.DataFrame({
                '风险等级': list(risk_dist.keys()),
                '数量': list(risk_dist.values())
            })
            st.bar_chart(risk_df_display.set_index('风险等级'))

    with col2:
        st.markdown("**处置状态分布**")
        status_dist = stats.get('status_distribution_cn', {})
        if status_dist:
            status_df_display = pd.DataFrame({
                '处置状态': list(status_dist.keys()),
                '数量': list(status_dist.values())
            })
            st.bar_chart(status_df_display.set_index('处置状态'))

    col3, col4 = st.columns(2)

    with col3:
        st.markdown("**损坏类型分布**")
        damage_dist = stats.get('damage_distribution', {})
        if damage_dist:
            damage_names = {
                'fall_over': '倒伏',
                'branch_break': '断枝',
                'leaning': '倾斜',
                'root_exposed': '露根'
            }
            damage_df_display = pd.DataFrame({
                '损坏类型': [damage_names.get(k, k) for k in damage_dist.keys()],
                '数量': list(damage_dist.values())
            })
            st.bar_chart(damage_df_display.set_index('损坏类型'))

    with col4:
        st.markdown("**风险因子统计**")

        factors = {
            '浅根树木': len(risk_df[risk_df.get('is_shallow_root', pd.Series([False]*len(risk_df)))]),
            '高龄树木': len(risk_df[risk_df.get('is_old_tree', pd.Series([False]*len(risk_df)))]),
            '易积水区域': len(risk_df[risk_df.get('has_water_pool', pd.Series([False]*len(risk_df)))]),
            '已受损': len(risk_df[risk_df.get('is_damaged', pd.Series([False]*len(risk_df)))])
        }

        factors_df = pd.DataFrame({
            '因子': list(factors.keys()),
            '数量': list(factors.values())
        })
        st.bar_chart(factors_df.set_index('因子'))


def show_detail_list(risk_df: pd.DataFrame):
    st.subheader("🗂️ 详细风险列表")

    search_term = st.text_input("🔍 搜索 (树木ID/路段/树种)", placeholder="输入关键词搜索...")

    filtered_df = risk_df.copy()
    if search_term:
        filtered_df = filtered_df[
            filtered_df['tree_id'].astype(str).str.contains(search_term, case=False) |
            filtered_df['road_name'].astype(str).str.contains(search_term, case=False) |
            filtered_df['tree_species'].astype(str).str.contains(search_term, case=False)
        ]

    st.write(f"显示 {len(filtered_df)} 条记录")

    all_columns = list(filtered_df.columns)
    default_columns = [
        'priority', 'tree_id', 'road_name', 'tree_species',
        'overall_risk_score', 'overall_risk_level_cn',
        'disposal_status_cn', 'damage_type_cn', 'risk_tags',
        'wind_risk_score', 'root_risk_score', 'age_risk_score', 'water_risk_score',
        'tree_age', 'root_depth_category', 'has_water_pool',
        'inspection_count', 'latest_inspection_time'
    ]

    selected_columns = st.multiselect(
        "选择显示列",
        options=all_columns,
        default=[col for col in default_columns if col in all_columns]
    )

    if selected_columns:
        display_df = filtered_df[selected_columns].copy()
        if 'risk_tags' in display_df.columns:
            display_df['risk_tags'] = display_df['risk_tags'].apply(
                lambda x: ','.join(x) if isinstance(x, list) else ''
            )
        st.dataframe(display_df, use_container_width=True, hide_index=True)
    else:
        st.dataframe(filtered_df, use_container_width=True, hide_index=True)

    st.subheader("📋 单棵树详情")
    if not filtered_df.empty:
        tree_ids = sorted(filtered_df['tree_id'].astype(str).unique().tolist())
        selected_tree = st.selectbox("选择树木查看详情", tree_ids)

        if selected_tree:
            tree_row = filtered_df[filtered_df['tree_id'] == selected_tree].iloc[0]
            show_tree_detail(tree_row)


def show_tree_detail(tree_row: pd.Series):
    col1, col2, col3 = st.columns(3)

    with col1:
        st.markdown("**基本信息**")
        st.write(f"树木ID: {tree_row.get('tree_id', '-')}")
        st.write(f"路段: {tree_row.get('road_name', '-')}")
        st.write(f"树种: {tree_row.get('tree_species', '-')}")
        st.write(f"树龄: {tree_row.get('tree_age', '-')} 年")
        st.write(f"根系类型: {tree_row.get('root_depth_category', '-')}")
        st.write(f"易积水区域: {'是' if tree_row.get('has_water_pool') else '否'}")

    with col2:
        st.markdown("**风险评估**")
        score = tree_row.get('overall_risk_score', 0)
        level = tree_row.get('overall_risk_level_cn', '-')
        priority = tree_row.get('priority', '-')

        if score >= 80:
            st.metric("综合风险评分", f"{score}", f"优先级 {priority}", delta_color="inverse")
        elif score >= 60:
            st.metric("综合风险评分", f"{score}", f"优先级 {priority}")
        else:
            st.metric("综合风险评分", f"{score}", f"优先级 {priority}", delta_color="normal")

        st.write(f"风险等级: {level}")
        st.write(f"风风险: {tree_row.get('wind_risk_score', 0):.1f}")
        st.write(f"根风险: {tree_row.get('root_risk_score', 0):.1f}")
        st.write(f"龄风险: {tree_row.get('age_risk_score', 0):.1f}")
        st.write(f"水风险: {tree_row.get('water_risk_score', 0):.1f}")

    with col3:
        st.markdown("**巡查状态**")
        st.write(f"有巡查记录: {'是' if tree_row.get('has_inspection') else '否'}")
        st.write(f"处置状态: {tree_row.get('disposal_status_cn', '-')}")
        st.write(f"损坏类型: {tree_row.get('damage_type_cn', '-')}")
        st.write(f"巡查次数: {tree_row.get('inspection_count', 0)}")
        latest_time = tree_row.get('latest_inspection_time')
        if latest_time:
            if hasattr(latest_time, 'strftime'):
                st.write(f"最近巡查: {latest_time.strftime('%Y-%m-%d %H:%M')}")
            else:
                st.write(f"最近巡查: {latest_time}")

        risk_tags = tree_row.get('risk_tags', [])
        if risk_tags and isinstance(risk_tags, list) and len(risk_tags) > 0:
            st.write("**风险标签**: " + ', '.join(risk_tags))


def show_export_section(risk_df: pd.DataFrame, stats: Dict):
    st.subheader("📥 数据导出")

    st.markdown("""
    导出以下格式的文件:
    - **risk_items.csv**: 风险清单，包含所有树木的详细风险信息
    - **tree_risk_review.md**: 风险复盘报告，包含统计分析和处置建议
    """)

    export_base_name = st.text_input("导出文件前缀 (可选)", placeholder="例如: typhoon_20240725")

    if st.button("📤 导出全部文件", type='primary', use_container_width=True):
        try:
            exporter = get_exporter()

            typhoon_info = None
            if st.session_state.selected_period:
                typhoon_info = st.session_state.selected_period
            elif st.session_state.typhoon_periods:
                typhoon_info = st.session_state.typhoon_periods[0]

            result = exporter.export_all(
                risk_df,
                stats,
                typhoon_info,
                export_base_name if export_base_name else None
            )

            st.success("✅ 导出成功！")
            st.write(f"CSV 文件: `{result['csv_file']}`")
            st.write(f"Markdown 报告: `{result['markdown_file']}`")
            st.write(f"导出记录数: {result['record_count']}")

            with open(result['csv_file'], 'rb') as f:
                st.download_button(
                    label="📥 下载 risk_items.csv",
                    data=f,
                    file_name=os.path.basename(result['csv_file']),
                    mime='text/csv'
                )

            with open(result['markdown_file'], 'rb') as f:
                st.download_button(
                    label="📥 下载 tree_risk_review.md",
                    data=f,
                    file_name=os.path.basename(result['markdown_file']),
                    mime='text/markdown'
                )

        except Exception as e:
            st.error(f"❌ 导出失败: {e}")
            import traceback
            st.error(traceback.format_exc())

    st.divider()
    st.markdown("### 📄 报告预览")

    if st.checkbox("显示 Markdown 报告预览"):
        exporter = get_exporter()
        typhoon_info = None
        if st.session_state.selected_period:
            typhoon_info = st.session_state.selected_period
        elif st.session_state.typhoon_periods:
            typhoon_info = st.session_state.typhoon_periods[0]

        preview_content = exporter._build_markdown_content(risk_df, stats, typhoon_info)
        st.markdown(preview_content)


if __name__ == "__main__":
    main()
