import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from typing import Optional, List
import io
import tempfile
import os

# 导入自定义模块
from data_loader import DataLoader
from pricing_config import PricingConfig, TimeSlot
from data_visualizer import DataVisualizer
from task_manager import TaskManager, FlexibleTask
from load_shifting_optimizer import (
    LoadShiftingOptimizer, 
    OptimizationResult, 
    OptimizationSummary
)
from report_generator import ReportGenerator


# 页面配置
st.set_page_config(
    page_title="电费分析小工具",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)


# 初始化会话状态
def init_session_state():
    if 'df' not in st.session_state:
        st.session_state.df = None
    
    if 'data_loader' not in st.session_state:
        st.session_state.data_loader = DataLoader()
    
    if 'pricing_config' not in st.session_state:
        st.session_state.pricing_config = PricingConfig()
    
    if 'visualizer' not in st.session_state:
        st.session_state.visualizer = DataVisualizer(st.session_state.pricing_config)
    
    if 'task_manager' not in st.session_state:
        st.session_state.task_manager = TaskManager()
    
    if 'optimizer' not in st.session_state:
        st.session_state.optimizer = LoadShiftingOptimizer(st.session_state.pricing_config)
    
    if 'optimization_results' not in st.session_state:
        st.session_state.optimization_results = None
    
    if 'optimization_summary' not in st.session_state:
        st.session_state.optimization_summary = None
    
    if 'report_generator' not in st.session_state:
        st.session_state.report_generator = ReportGenerator()


# 侧边栏导航
def render_sidebar():
    st.sidebar.title("⚡ 电费分析小工具")
    st.sidebar.markdown("---")
    
    # 页面选择
    page = st.sidebar.radio(
        "选择功能页面",
        ["📊 数据导入", "💰 电价配置", "📈 用电分析", "🔧 任务管理", "🎯 错峰优化", "📄 报告导出"],
        index=0
    )
    
    st.sidebar.markdown("---")
    st.sidebar.markdown("### 快捷操作")
    
    # 加载示例数据按钮
    if st.sidebar.button("📥 加载示例数据", use_container_width=True):
        load_sample_data()
    
    # 重置所有配置
    if st.sidebar.button("🔄 重置所有配置", use_container_width=True):
        reset_all_configs()
    
    return page


# 加载示例数据
def load_sample_data():
    sample_file = "sample_data.csv"
    if os.path.exists(sample_file):
        loader = DataLoader()
        success, df = loader.load_csv(sample_file)
        
        if success:
            st.session_state.df = df
            st.session_state.data_loader = loader
            
            # 显示警告（如果有）
            warnings = loader.get_warnings()
            if warnings:
                for warning in warnings:
                    st.sidebar.warning(warning)
            
            st.sidebar.success("✅ 示例数据加载成功！")
        else:
            errors = loader.get_errors()
            for error in errors:
                st.sidebar.error(error)
    else:
        st.sidebar.error("❌ 示例数据文件不存在")


# 重置所有配置
def reset_all_configs():
    st.session_state.df = None
    st.session_state.data_loader = DataLoader()
    st.session_state.pricing_config = PricingConfig()
    st.session_state.visualizer = DataVisualizer(st.session_state.pricing_config)
    st.session_state.task_manager = TaskManager()
    st.session_state.optimizer = LoadShiftingOptimizer(st.session_state.pricing_config)
    st.session_state.optimization_results = None
    st.session_state.optimization_summary = None
    st.sidebar.success("✅ 所有配置已重置")


# 页面1: 数据导入
def render_data_import_page():
    st.title("📊 数据导入")
    st.markdown("---")
    
    # 数据加载选项
    col1, col2 = st.columns([1, 1])
    
    with col1:
        st.subheader("📁 上传数据")
        uploaded_file = st.file_uploader(
            "选择 CSV 文件",
            type=['csv'],
            help="请上传包含日期、小时、用电量列的 CSV 文件"
        )
        
        if uploaded_file is not None:
            if st.button("🔍 解析并校验数据", use_container_width=True):
                loader = DataLoader()
                success, df = loader.load_csv(uploaded_file, is_uploaded=True)
                
                if success:
                    st.session_state.df = df
                    st.session_state.data_loader = loader
                    st.success("✅ 数据加载成功！")
                    
                    # 显示警告
                    warnings = loader.get_warnings()
                    if warnings:
                        for warning in warnings:
                            st.warning(f"⚠️ {warning}")
                else:
                    errors = loader.get_errors()
                    for error in errors:
                        st.error(f"❌ {error}")
    
    with col2:
        st.subheader("📋 示例数据")
        st.markdown("""
        示例数据包含2024年4月整月的用电数据，用于演示工具功能。
        
        **数据格式说明:**
        - `日期`: YYYY-MM-DD 格式
        - `小时`: 0-23 的整数
        - `用电量(kWh)`: 该小时的用电量
        """)
        
        if st.button("📥 加载示例数据", use_container_width=True):
            load_sample_data()
    
    # 数据预览
    if st.session_state.df is not None:
        st.markdown("---")
        st.subheader("📊 数据预览")
        
        # 显示数据摘要
        summary = st.session_state.data_loader.get_data_summary()
        
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("总记录数", summary.get('总记录数', 'N/A'))
        with col2:
            st.metric("日期范围", summary.get('日期范围', 'N/A'))
        with col3:
            st.metric("总用电量", f"{summary.get('总用电量(kWh)', 0):.2f} kWh")
        with col4:
            st.metric("平均日用电量", f"{summary.get('平均日用电量(kWh)', 0):.2f} kWh")
        
        # 数据表格
        with st.expander("📋 查看详细数据（前50行）"):
            st.dataframe(
                st.session_state.df.head(50),
                use_container_width=True
            )
        
        # 最高/最低用电时段
        st.info(f"""
        💡 **用电时段分析**
        - 最高用电量时段: {summary.get('最高用电量时段', 'N/A')}
        - 最低用电量时段: {summary.get('最低用电量时段', 'N/A')}
        """)


# 页面2: 电价配置
def render_pricing_page():
    st.title("💰 电价配置")
    st.markdown("---")
    
    config = st.session_state.pricing_config
    
    # 显示当前配置
    st.subheader("📋 当前时段配置")
    
    time_slots = config.get_time_slots_as_list()
    if time_slots:
        # 创建数据框显示
        slot_data = []
        for slot in time_slots:
            hours_list = ', '.join([f"{h}:00" for h in slot['hours'][:6]])
            if len(slot['hours']) > 6:
                hours_list += f" 等{len(slot['hours'])}小时"
            
            slot_data.append({
                '时段': slot['name'],
                '开始时间': f"{slot['start_hour']}:00",
                '结束时间': f"{slot['end_hour']}:00",
                '电价(元/kWh)': slot['price'],
                '覆盖小时': hours_list
            })
        
        st.dataframe(pd.DataFrame(slot_data), use_container_width=True)
        
        # 检查覆盖情况
        is_covered, uncovered = config.validate_coverage()
        if not is_covered:
            st.error(f"⚠️ 以下小时未被任何时段覆盖: {', '.join([f'{h}:00' for h in uncovered])}")
        else:
            st.success("✅ 所有时段已完整覆盖全天24小时")
    else:
        st.warning("⚠️ 尚未配置任何时段")
    
    st.markdown("---")
    
    # 添加/编辑时段
    st.subheader("✏️ 配置时段")
    
    # 选择操作模式
    operation_mode = st.radio(
        "选择操作",
        ["添加新时段", "编辑现有时段", "删除时段", "重置为默认配置"],
        horizontal=True
    )
    
    if operation_mode == "添加新时段":
        render_add_slot_form(config)
    elif operation_mode == "编辑现有时段":
        render_edit_slot_form(config)
    elif operation_mode == "删除时段":
        render_delete_slot_form(config)
    elif operation_mode == "重置为默认配置":
        if st.button("🔄 确认重置", type="primary"):
            config.reset_to_default()
            # 更新优化器和可视化器
            st.session_state.optimizer.set_pricing_config(config)
            st.session_state.visualizer.set_pricing_config(config)
            st.success("✅ 已重置为默认配置")
    
    st.markdown("---")
    
    # 电价可视化
    st.subheader("📊 24小时电价分布")
    render_price_visualization(config)


def render_add_slot_form(config: PricingConfig):
    """渲染添加时段表单"""
    col1, col2, col3 = st.columns(3)
    
    with col1:
        slot_name = st.selectbox(
            "时段名称",
            ["峰", "平", "谷", "自定义"],
            help="选择时段类型"
        )
        if slot_name == "自定义":
            slot_name = st.text_input("输入自定义时段名称")
    
    with col2:
        start_hour = st.slider(
            "开始小时",
            min_value=0,
            max_value=23,
            value=8,
            help="时段开始的小时（包含）"
        )
    
    with col3:
        end_hour = st.slider(
            "结束小时",
            min_value=0,
            max_value=23,
            value=21,
            help="时段结束的小时（包含）"
        )
    
    # 默认价格
    default_prices = {
        '峰': 0.977,
        '平': 0.617,
        '谷': 0.307
    }
    default_price = default_prices.get(slot_name, 0.5)
    
    price = st.number_input(
        "电价 (元/kWh)",
        min_value=0.0,
        max_value=10.0,
        value=default_price,
        step=0.001,
        format="%.3f"
    )
    
    if st.button("✅ 添加时段", type="primary"):
        if not slot_name:
            st.error("请输入时段名称")
            return
        
        success = config.set_time_slot(
            name=slot_name,
            start_hour=start_hour,
            end_hour=end_hour,
            price=price
        )
        
        if success:
            # 更新优化器和可视化器
            st.session_state.optimizer.set_pricing_config(config)
            st.session_state.visualizer.set_pricing_config(config)
            st.success(f"✅ 时段 '{slot_name}' 添加成功")
        else:
            errors = config.get_errors()
            for error in errors:
                st.error(f"❌ {error}")


def render_edit_slot_form(config: PricingConfig):
    """渲染编辑时段表单"""
    slots = config.get_all_time_slots()
    
    if not slots:
        st.warning("⚠️ 没有可编辑的时段")
        return
    
    slot_names = list(slots.keys())
    selected_slot = st.selectbox("选择要编辑的时段", slot_names)
    
    if selected_slot:
        slot = slots[selected_slot]
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            new_name = st.text_input("时段名称", value=slot.name)
        
        with col2:
            new_start = st.slider(
                "开始小时",
                min_value=0,
                max_value=23,
                value=slot.start_hour,
                key="edit_start"
            )
        
        with col3:
            new_end = st.slider(
                "结束小时",
                min_value=0,
                max_value=23,
                value=slot.end_hour,
                key="edit_end"
            )
        
        new_price = st.number_input(
            "电价 (元/kWh)",
            min_value=0.0,
            max_value=10.0,
            value=slot.price,
            step=0.001,
            format="%.3f",
            key="edit_price"
        )
        
        if st.button("💾 保存修改", type="primary"):
            success = config.set_time_slot(
                name=new_name,
                start_hour=new_start,
                end_hour=new_end,
                price=new_price
            )
            
            # 如果名称改变，删除旧的
            if new_name != selected_slot and success:
                config.remove_time_slot(selected_slot)
            
            if success:
                # 更新优化器和可视化器
                st.session_state.optimizer.set_pricing_config(config)
                st.session_state.visualizer.set_pricing_config(config)
                st.success("✅ 修改已保存")
            else:
                errors = config.get_errors()
                for error in errors:
                    st.error(f"❌ {error}")


def render_delete_slot_form(config: PricingConfig):
    """渲染删除时段表单"""
    slots = config.get_all_time_slots()
    
    if not slots:
        st.warning("⚠️ 没有可删除的时段")
        return
    
    slot_names = list(slots.keys())
    selected_slot = st.selectbox("选择要删除的时段", slot_names)
    
    if selected_slot:
        st.warning(f"⚠️ 确定要删除时段 '{selected_slot}' 吗？")
        
        col1, col2 = st.columns(2)
        with col1:
            if st.button("❌ 确认删除", type="primary"):
                success = config.remove_time_slot(selected_slot)
                if success:
                    # 更新优化器和可视化器
                    st.session_state.optimizer.set_pricing_config(config)
                    st.session_state.visualizer.set_pricing_config(config)
                    st.success(f"✅ 时段 '{selected_slot}' 已删除")
                else:
                    st.error("删除失败")
        with col2:
            if st.button("取消"):
                st.info("已取消")


def render_price_visualization(config: PricingConfig):
    """渲染电价可视化"""
    # 获取每小时电价
    hours = list(range(24))
    prices = []
    slot_names = []
    
    for hour in hours:
        price, slot_name = config.get_price_for_hour(hour)
        prices.append(price or 0)
        slot_names.append(slot_name or '未覆盖')
    
    # 创建数据框
    df_prices = pd.DataFrame({
        '小时': hours,
        '电价(元/kWh)': prices,
        '时段': slot_names
    })
    
    # 颜色映射
    color_map = {
        '峰': '#FF6B6B',
        '平': '#4ECDC4',
        '谷': '#45B7D1',
        '未覆盖': '#95A5A6'
    }
    
    # 创建图表
    fig = px.bar(
        df_prices,
        x='小时',
        y='电价(元/kWh)',
        color='时段',
        color_discrete_map=color_map,
        title='24小时电价分布',
        labels={'小时': '小时', '电价(元/kWh)': '电价 (元/kWh)'}
    )
    
    fig.update_layout(
        xaxis=dict(tickmode='linear', tick0=0, dtick=1),
        bargap=0.1
    )
    
    st.plotly_chart(fig, use_container_width=True)


# 页面3: 用电分析
def render_analysis_page():
    st.title("📈 用电分析")
    st.markdown("---")
    
    if st.session_state.df is None:
        st.warning("⚠️ 请先导入数据")
        return
    
    df = st.session_state.df
    visualizer = st.session_state.visualizer
    
    # 更新可视化器的电价配置
    visualizer.set_pricing_config(st.session_state.pricing_config)
    
    # 筛选选项
    st.subheader("🔍 数据筛选")
    
    col1, col2 = st.columns(2)
    
    with col1:
        # 日期筛选
        dates = sorted(df['日期'].unique())
        date_range = st.select_slider(
            "选择日期范围",
            options=dates,
            value=(dates[0], dates[-1])
        )
    
    with col2:
        # 时段筛选
        hour_range = st.slider(
            "选择小时范围",
            min_value=0,
            max_value=23,
            value=(0, 23)
        )
    
    # 应用筛选
    mask = (
        (df['日期'] >= date_range[0]) &
        (df['日期'] <= date_range[1]) &
        (df['小时'] >= hour_range[0]) &
        (df['小时'] <= hour_range[1])
    )
    filtered_df = df[mask]
    
    # 统计摘要
    st.subheader("📊 统计摘要")
    
    stats = visualizer.get_summary_statistics(filtered_df)
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("总用电量", f"{stats.get('总用电量(kWh)', 0):.2f} kWh")
    with col2:
        st.metric("总电费", f"¥{stats.get('总电费(元)', 0):.2f}")
    with col3:
        st.metric("平均日用电量", f"{stats.get('平均日用电量(kWh)', 0):.2f} kWh")
    with col4:
        st.metric("异常时段数", stats.get('异常高用电时段数', 0))
    
    st.markdown("---")
    
    # 图表选项卡
    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        "📅 每日趋势",
        "⏰ 小时分布",
        "📊 峰谷对比",
        "🔥 热力图",
        "⚠️ 异常检测"
    ])
    
    with tab1:
        st.subheader("📅 每日用电量趋势")
        fig_daily = visualizer.create_daily_consumption_chart(filtered_df)
        st.plotly_chart(fig_daily, use_container_width=True)
    
    with tab2:
        st.subheader("⏰ 24小时用电分布")
        
        # 日期选择（可选）
        specific_dates = st.multiselect(
            "选择特定日期分析（可选，留空则显示平均值）",
            options=sorted(filtered_df['日期'].unique()),
            default=[]
        )
        
        if specific_dates:
            fig_hourly = visualizer.create_hourly_consumption_chart(
                filtered_df, selected_dates=specific_dates
            )
        else:
            fig_hourly = visualizer.create_hourly_consumption_chart(filtered_df)
        
        st.plotly_chart(fig_hourly, use_container_width=True)
        
        st.info("💡 背景颜色标识时段：红色=峰、青色=平、蓝色=谷")
    
    with tab3:
        st.subheader("📊 峰平谷时段对比")
        fig_slot = visualizer.create_time_slot_comparison_chart(filtered_df)
        st.plotly_chart(fig_slot, use_container_width=True)
        
        # 费用明细图表
        st.subheader("💰 每日电费明细")
        fig_cost = visualizer.create_cost_breakdown_chart(filtered_df)
        st.plotly_chart(fig_cost, use_container_width=True)
    
    with tab4:
        st.subheader("🔥 用电热力图")
        fig_heatmap = visualizer.create_heatmap_chart(filtered_df)
        st.plotly_chart(fig_heatmap, use_container_width=True)
        
        st.info("💡 颜色越深表示用电量越高，可直观看到用电高峰时段")
    
    with tab5:
        st.subheader("⚠️ 异常高用电检测")
        
        threshold = st.slider(
            "异常阈值（标准差倍数）",
            min_value=1.0,
            max_value=4.0,
            value=2.0,
            step=0.5,
            help="用电量超过平均值 + N倍标准差 时被标记为异常"
        )
        
        fig_anomaly = visualizer.create_anomaly_detection_chart(
            filtered_df, threshold_std=threshold
        )
        st.plotly_chart(fig_anomaly, use_container_width=True)
        
        # 显示异常时段详情
        mean_consumption = filtered_df['用电量(kWh)'].mean()
        std_consumption = filtered_df['用电量(kWh)'].std()
        high_threshold = mean_consumption + threshold * std_consumption
        
        high_values = filtered_df[filtered_df['用电量(kWh)'] > high_threshold]
        
        if not high_values.empty:
            st.warning(f"⚠️ 发现 {len(high_values)} 个异常高用电时段")
            
            with st.expander("📋 查看异常时段详情"):
                # 添加时段信息
                def get_slot_info(hour):
                    price, slot_name = st.session_state.pricing_config.get_price_for_hour(hour)
                    return pd.Series([slot_name or '未分类', price or 0])
                
                high_values[['时段', '电价(元/kWh)']] = high_values['小时'].apply(get_slot_info)
                
                display_df = high_values[['日期', '小时', '用电量(kWh)', '时段', '电价(元/kWh)']].copy()
                display_df['电费(元)'] = display_df['用电量(kWh)'] * display_df['电价(元/kWh)']
                
                st.dataframe(
                    display_df.sort_values('用电量(kWh)', ascending=False),
                    use_container_width=True
                )
        else:
            st.success("✅ 未发现异常高用电时段")


# 页面4: 任务管理
def render_task_page():
    st.title("🔧 用电任务管理")
    st.markdown("---")
    
    task_manager = st.session_state.task_manager
    
    # 显示当前任务
    st.subheader("📋 可挪用电任务列表")
    
    tasks = task_manager.get_all_tasks()
    
    if not tasks:
        st.info("💡 还没有配置任何任务，可使用下方表单添加或加载预设任务")
    else:
        # 创建任务表格
        task_data = []
        for task in tasks:
            status = "✅ 启用" if task.is_enabled else "⚠️ 禁用"
            window = f"{task.window_start_hour}:00-{task.window_end_hour}:00"
            
            task_data.append({
                '状态': status,
                '任务名称': task.name,
                '用电量(kWh)': task.energy_kwh,
                '持续时间(h)': task.duration_hours,
                '可用时段': window,
                '最大延迟(h)': task.max_delay_hours,
                '备注': task.notes or '-'
            })
        
        task_df = pd.DataFrame(task_data)
        st.dataframe(task_df, use_container_width=True)
        
        # 任务统计
        enabled_tasks = task_manager.get_enabled_tasks()
        total_energy = sum(t.energy_kwh for t in enabled_tasks)
        
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("总任务数", len(tasks))
        with col2:
            st.metric("已启用任务", len(enabled_tasks))
        with col3:
            st.metric("总用电量", f"{total_energy:.1f} kWh")
    
    st.markdown("---")
    
    # 添加/编辑任务
    st.subheader("✏️ 管理任务")
    
    operation = st.radio(
        "选择操作",
        ["添加新任务", "编辑任务", "启用/禁用任务", "删除任务"],
        horizontal=True
    )
    
    if operation == "添加新任务":
        render_add_task_form(task_manager)
    elif operation == "编辑任务":
        render_edit_task_form(task_manager)
    elif operation == "启用/禁用任务":
        render_toggle_task_form(task_manager)
    elif operation == "删除任务":
        render_delete_task_form(task_manager)


def render_add_task_form(task_manager: TaskManager):
    """渲染添加任务表单"""
    col1, col2 = st.columns(2)
    
    with col1:
        task_name = st.text_input(
            "任务名称 *",
            placeholder="例如：洗衣机、电动车充电",
            help="输入任务的名称"
        )
        
        energy_kwh = st.number_input(
            "用电量 (kWh) *",
            min_value=0.1,
            max_value=100.0,
            value=1.2,
            step=0.1,
            help="该任务的预计用电量"
        )
        
        duration_hours = st.number_input(
            "持续时间 (小时) *",
            min_value=0.5,
            max_value=24.0,
            value=1.5,
            step=0.5,
            help="任务预计运行的小时数"
        )
    
    with col2:
        window_start = st.slider(
            "可用时段 - 开始小时",
            min_value=0,
            max_value=23,
            value=22,
            help="任务可以开始的最早小时"
        )
        
        window_end = st.slider(
            "可用时段 - 结束小时",
            min_value=0,
            max_value=23,
            value=7,
            help="任务可以运行的最晚小时（包含）"
        )
        
        max_delay = st.number_input(
            "最大延迟 (小时)",
            min_value=0.0,
            max_value=24.0,
            value=10.0,
            step=1.0,
            help="从偏好时间开始计算的最大允许延迟"
        )
    
    notes = st.text_area(
        "备注（可选）",
        placeholder="添加任务的备注信息...",
        help="可选的备注信息"
    )
    
    if st.button("✅ 添加任务", type="primary"):
        if not task_name.strip():
            st.error("❌ 请输入任务名称")
            return
        
        success, message, task = task_manager.add_task(
            name=task_name,
            energy_kwh=energy_kwh,
            duration_hours=duration_hours,
            window_start_hour=window_start,
            window_end_hour=window_end,
            max_delay_hours=max_delay,
            notes=notes
        )
        
        if success:
            st.success(f"✅ {message}")
        else:
            st.error(f"❌ {message}")


def render_edit_task_form(task_manager: TaskManager):
    """渲染编辑任务表单"""
    tasks = task_manager.get_all_tasks()
    
    if not tasks:
        st.warning("⚠️ 没有可编辑的任务")
        return
    
    task_options = {t.name: t.id for t in tasks}
    selected_name = st.selectbox("选择要编辑的任务", list(task_options.keys()))
    
    if selected_name:
        task = task_manager.get_task(task_options[selected_name])
        
        if task:
            col1, col2 = st.columns(2)
            
            with col1:
                new_name = st.text_input("任务名称", value=task.name)
                new_energy = st.number_input(
                    "用电量 (kWh)",
                    min_value=0.1,
                    max_value=100.0,
                    value=task.energy_kwh,
                    step=0.1,
                    key="edit_energy"
                )
                new_duration = st.number_input(
                    "持续时间 (小时)",
                    min_value=0.5,
                    max_value=24.0,
                    value=task.duration_hours,
                    step=0.5,
                    key="edit_duration"
                )
            
            with col2:
                new_window_start = st.slider(
                    "可用时段 - 开始小时",
                    min_value=0,
                    max_value=23,
                    value=task.window_start_hour,
                    key="edit_window_start"
                )
                new_window_end = st.slider(
                    "可用时段 - 结束小时",
                    min_value=0,
                    max_value=23,
                    value=task.window_end_hour,
                    key="edit_window_end"
                )
                new_max_delay = st.number_input(
                    "最大延迟 (小时)",
                    min_value=0.0,
                    max_value=24.0,
                    value=task.max_delay_hours,
                    step=1.0,
                    key="edit_max_delay"
                )
            
            new_notes = st.text_area(
                "备注",
                value=task.notes or "",
                key="edit_notes"
            )
            
            new_enabled = st.checkbox("启用任务", value=task.is_enabled)
            
            if st.button("💾 保存修改", type="primary"):
                success, message = task_manager.update_task(
                    task.id,
                    name=new_name,
                    energy_kwh=new_energy,
                    duration_hours=new_duration,
                    window_start_hour=new_window_start,
                    window_end_hour=new_window_end,
                    max_delay_hours=new_max_delay,
                    notes=new_notes,
                    is_enabled=new_enabled
                )
                
                if success:
                    st.success("✅ 修改已保存")
                else:
                    st.error(f"❌ {message}")


def render_toggle_task_form(task_manager: TaskManager):
    """渲染启用/禁用任务表单"""
    tasks = task_manager.get_all_tasks()
    
    if not tasks:
        st.warning("⚠️ 没有可管理的任务")
        return
    
    st.write("点击任务名称切换启用/禁用状态：")
    
    for task in tasks:
        status_text = "✅ 启用" if task.is_enabled else "⚠️ 禁用"
        col1, col2 = st.columns([3, 1])
        
        with col1:
            st.write(f"**{task.name}** - {task.energy_kwh} kWh, {task.duration_hours} 小时")
        
        with col2:
            if st.button(
                f"切换 ({status_text})",
                key=f"toggle_{task.id}"
            ):
                success, message = task_manager.toggle_task(task.id)
                if success:
                    st.success(f"✅ {message}")
                    st.rerun()


def render_delete_task_form(task_manager: TaskManager):
    """渲染删除任务表单"""
    tasks = task_manager.get_all_tasks()
    
    if not tasks:
        st.warning("⚠️ 没有可删除的任务")
        return
    
    task_options = {t.name: t.id for t in tasks}
    selected_name = st.selectbox("选择要删除的任务", list(task_options.keys()))
    
    if selected_name:
        st.warning(f"⚠️ 确定要删除任务 '{selected_name}' 吗？此操作不可撤销。")
        
        col1, col2 = st.columns(2)
        with col1:
            if st.button("❌ 确认删除", type="primary"):
                success, message = task_manager.delete_task(task_options[selected_name])
                if success:
                    st.success(f"✅ {message}")
                    st.rerun()
                else:
                    st.error(f"❌ {message}")
        with col2:
            if st.button("取消"):
                st.info("已取消")


# 页面5: 错峰优化
def render_optimization_page():
    st.title("🎯 错峰优化")
    st.markdown("---")
    
    optimizer = st.session_state.optimizer
    task_manager = st.session_state.task_manager
    
    # 更新优化器的电价配置
    optimizer.set_pricing_config(st.session_state.pricing_config)
    
    # 检查是否有启用的任务
    enabled_tasks = task_manager.get_enabled_tasks()
    
    if not enabled_tasks:
        st.warning("⚠️ 没有启用的用电任务，请先在「任务管理」页面添加并启用任务")
        return
    
    # 显示电价信息
    st.subheader("💰 当前电价配置")
    
    price_data = optimizer.get_price_comparison_chart_data()
    
    # 创建电价图表
    fig_prices = go.Figure()
    
    for slot_name, slot_data in price_data.get('slot_groups', {}).items():
        fig_prices.add_trace(go.Bar(
            x=slot_data['hours'],
            y=slot_data['prices'],
            name=slot_name
        ))
    
    fig_prices.update_layout(
        title='24小时电价分布',
        xaxis_title='小时',
        yaxis_title='电价 (元/kWh)',
        xaxis=dict(tickmode='linear', tick0=0, dtick=1),
        barmode='stack'
    )
    
    st.plotly_chart(fig_prices, use_container_width=True)
    
    st.markdown("---")
    
    # 执行优化
    st.subheader("⚡ 执行错峰优化")
    
    col1, col2 = st.columns([1, 3])
    
    with col1:
        if st.button("🚀 开始优化", type="primary", use_container_width=True):
            with st.spinner("正在计算最优方案..."):
                results, summary = optimizer.optimize_all_tasks(task_manager)
                st.session_state.optimization_results = results
                st.session_state.optimization_summary = summary
            
            st.success("✅ 优化完成！")
    
    with col2:
        st.info("""
        💡 优化逻辑说明：
        1. 分析每个任务的可用时间窗口
        2. 在窗口内找到电价最低的时段
        3. 计算原始成本与优化后成本的差异
        4. 检查是否超过最大允许延迟
        """)
    
    # 显示优化结果
    if st.session_state.optimization_summary is not None:
        summary = st.session_state.optimization_summary
        results = st.session_state.optimization_results
        
        st.markdown("---")
        st.subheader("📊 优化效果汇总")
        
        # 关键指标
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric(
                "优化任务数",
                summary.optimized_tasks
            )
        with col2:
            st.metric(
                "优化前费用",
                f"¥{summary.total_original_cost:.2f}"
            )
        with col3:
            st.metric(
                "优化后费用",
                f"¥{summary.total_optimized_cost:.2f}"
            )
        with col4:
            st.metric(
                "预计节省",
                f"¥{summary.total_savings:.2f}",
                f"{summary.total_savings_percentage:.1f}%"
            )
        
        st.markdown("---")
        
        # 各任务详情
        st.subheader("📋 各任务优化详情")
        
        if results:
            result_data = []
            for result in results:
                original_time = f"{result.original_start_hour}:00" if result.original_start_hour is not None else "N/A"
                optimized_time = f"{result.optimized_start_hour}:00"
                
                status = "✅ 正常"
                if not result.is_within_window:
                    status = "⚠️ 超出窗口"
                elif not result.is_delay_acceptable:
                    status = "⚠️ 延迟过长"
                
                result_data.append({
                    '状态': status,
                    '任务名称': result.task_name,
                    '原始时段': f"{original_time} ({result.original_slot_name or 'N/A'})",
                    '推荐时段': f"{optimized_time} ({result.optimized_slot_name or 'N/A'})",
                    '原始费用': f"¥{result.original_cost:.2f}",
                    '优化费用': f"¥{result.optimized_cost:.2f}",
                    '节省金额': f"¥{result.savings:.2f}",
                    '节省比例': f"{result.savings_percentage:.1f}%",
                    '延迟时间': f"{result.delay_hours:.1f}h"
                })
            
            result_df = pd.DataFrame(result_data)
            st.dataframe(result_df, use_container_width=True)
            
            # 详细展开每个任务
            st.subheader("🔍 详细分析")
            
            for result in results:
                with st.expander(f"📋 {result.task_name} - 详情"):
                    recommendation = optimizer.generate_recommendation(result)
                    st.markdown(recommendation)
                    
                    # 显示可用时段的电价
                    if result.hourly_prices:
                        st.write("**可用时段电价:**")
                        price_df = pd.DataFrame([
                            {'小时': f"{h}:00", '电价(元/kWh)': p}
                            for h, p in result.hourly_prices.items()
                        ]).sort_values('电价(元/kWh)')
                        
                        st.dataframe(price_df, use_container_width=True)
        
        # 问题任务警告
        if summary.tasks_with_issues:
            st.markdown("---")
            st.warning("⚠️ 以下任务存在问题：")
            
            for issue in summary.tasks_with_issues:
                st.error(f"""
                **任务: {issue['task_name']}**
                - 问题: {issue['issue']}
                - 延迟时间: {issue['delay_hours']:.1f} 小时
                - 最大允许: {issue['max_allowed']:.1f} 小时
                
                💡 建议: 调整该任务的时间窗口或最大延迟限制，或手动选择合适的运行时间。
                """)


# 页面6: 报告导出
def render_report_page():
    st.title("📄 报告导出")
    st.markdown("---")
    
    if st.session_state.df is None:
        st.warning("⚠️ 请先导入数据")
        return
    
    # 报告选项
    st.subheader("⚙️ 报告选项")
    
    col1, col2 = st.columns(2)
    
    with col1:
        report_format = st.radio(
            "报告格式",
            ["Markdown", "HTML"],
            horizontal=True
        )
    
    with col2:
        include_optimization = st.checkbox(
            "包含错峰优化分析",
            value=st.session_state.optimization_summary is not None
        )
    
    # 生成报告
    if st.button("📄 生成报告", type="primary", use_container_width=True):
        with st.spinner("正在生成报告..."):
            generator = st.session_state.report_generator
            
            # 准备数据
            df = st.session_state.df
            pricing_config = st.session_state.pricing_config
            data_loader = st.session_state.data_loader
            visualizer = st.session_state.visualizer
            
            # 更新可视化器
            visualizer.set_pricing_config(pricing_config)
            
            # 获取优化结果
            opt_results = st.session_state.optimization_results if include_optimization else None
            opt_summary = st.session_state.optimization_summary if include_optimization else None
            
            # 生成 Markdown
            markdown_content = generator.generate_markdown_report(
                df=df,
                pricing_config=pricing_config,
                data_loader=data_loader,
                visualizer=visualizer,
                optimization_results=opt_results,
                optimization_summary=opt_summary,
                task_manager=st.session_state.task_manager
            )
            
            if report_format == "Markdown":
                st.session_state.report_content = markdown_content
                st.session_state.report_format = "markdown"
            else:
                # 转换为 HTML
                html_content = generator.generate_html_report(markdown_content)
                st.session_state.report_content = html_content
                st.session_state.report_format = "html"
            
            st.success("✅ 报告生成完成！")
    
    # 显示报告
    if 'report_content' in st.session_state:
        st.markdown("---")
        st.subheader("📋 报告预览")
        
        if st.session_state.report_format == "markdown":
            # 显示 Markdown 预览
            st.markdown(st.session_state.report_content)
            
            # 下载按钮
            st.download_button(
                label="📥 下载 Markdown 报告",
                data=st.session_state.report_content,
                file_name=f"电费分析报告_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.md",
                mime="text/markdown",
                use_container_width=True
            )
        else:
            # 显示 HTML 预览
            st.components.v1.html(
                st.session_state.report_content,
                height=600,
                scrolling=True
            )
            
            # 下载按钮
            st.download_button(
                label="📥 下载 HTML 报告",
                data=st.session_state.report_content,
                file_name=f"电费分析报告_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.html",
                mime="text/html",
                use_container_width=True
            )


# 主函数
def main():
    # 初始化会话状态
    init_session_state()
    
    # 渲染侧边栏
    page = render_sidebar()
    
    # 渲染对应页面
    if page == "📊 数据导入":
        render_data_import_page()
    elif page == "💰 电价配置":
        render_pricing_page()
    elif page == "📈 用电分析":
        render_analysis_page()
    elif page == "🔧 任务管理":
        render_task_page()
    elif page == "🎯 错峰优化":
        render_optimization_page()
    elif page == "📄 报告导出":
        render_report_page()


if __name__ == "__main__":
    main()
