import streamlit as st
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from modules.csv_parser import parse_all_csv_files, validate_csv_structure
from modules.field_validator import validate_all_fields, FieldValidationError
from modules.time_window_merger import merge_by_time_window, BatchTimeWindow
from modules.risk_rules import run_all_risk_checks, RiskCheckResult
from modules.chart_data import generate_trend_chart_data, generate_temperature_chart_data
from modules.report_exporter import generate_markdown_report, export_anomalies_csv
from modules.sample_data import generate_sample_data, save_sample_data_to_csv

st.set_page_config(
    page_title="冷链留样复盘台",
    page_icon="🥗",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        font-weight: 700;
        color: #2c3e50;
        text-align: center;
        margin-bottom: 2rem;
    }
    .sub-header {
        font-size: 1.5rem;
        font-weight: 600;
        color: #34495e;
        margin-bottom: 1rem;
    }
    .risk-card {
        padding: 1rem;
        border-radius: 0.5rem;
        margin-bottom: 1rem;
    }
    .risk-high {
        background-color: #ffcccc;
        border-left: 5px solid #e74c3c;
    }
    .risk-medium {
        background-color: #fff3cd;
        border-left: 5px solid #f39c12;
    }
    .risk-low {
        background-color: #d4edda;
        border-left: 5px solid #27ae60;
    }
</style>
""", unsafe_allow_html=True)

def main():
    st.markdown('<h1 class="main-header">🥗 冷链留样复盘台</h1>', unsafe_allow_html=True)
    
    if 'data_loaded' not in st.session_state:
        st.session_state.data_loaded = False
        st.session_state.raw_data = {}
        st.session_state.merged_data = {}
        st.session_state.risk_results = []
        st.session_state.validation_errors = []
    
    with st.sidebar:
        st.markdown("## 📁 数据导入")
        
        data_source = st.radio(
            "选择数据源",
            ["使用示例数据", "上传CSV文件"],
            horizontal=True
        )
        
        if data_source == "使用示例数据":
            if st.button("📥 加载示例数据", type="primary", use_container_width=True):
                with st.spinner("正在生成示例数据..."):
                    sample_data = generate_sample_data()
                    save_sample_data_to_csv(sample_data, "data/sample")
                    
                    st.session_state.raw_data = sample_data
                    
                    try:
                        validation_errors = validate_all_fields(sample_data)
                        st.session_state.validation_errors = validation_errors
                        
                        if validation_errors:
                            st.warning(f"发现 {len(validation_errors)} 个字段验证问题")
                        else:
                            st.success("所有字段验证通过")
                        
                        st.session_state.merged_data = merge_by_time_window(sample_data)
                        st.session_state.risk_results = run_all_risk_checks(st.session_state.merged_data)
                        st.session_state.data_loaded = True
                        
                    except Exception as e:
                        st.error(f"数据处理错误: {str(e)}")
        
        else:
            st.markdown("### 上传数据文件")
            uploaded_files = st.file_uploader(
                "选择CSV文件 (可多选)",
                type=["csv"],
                accept_multiple_files=True
            )
            
            if uploaded_files:
                if st.button("📥 处理上传的数据", type="primary", use_container_width=True):
                    with st.spinner("正在解析数据..."):
                        try:
                            parsed_data = parse_all_csv_files(uploaded_files)
                            st.session_state.raw_data = parsed_data
                            
                            validation_errors = validate_all_fields(parsed_data)
                            st.session_state.validation_errors = validation_errors
                            
                            if validation_errors:
                                st.warning(f"发现 {len(validation_errors)} 个字段验证问题")
                            else:
                                st.success("所有字段验证通过")
                            
                            st.session_state.merged_data = merge_by_time_window(parsed_data)
                            st.session_state.risk_results = run_all_risk_checks(st.session_state.merged_data)
                            st.session_state.data_loaded = True
                            
                        except Exception as e:
                            st.error(f"数据处理错误: {str(e)}")
    
    if st.session_state.data_loaded:
        tab1, tab2, tab3, tab4, tab5 = st.tabs([
            "📊 概览", 
            "⚠️ 批次风险列表", 
            "📈 趋势分析", 
            "⏰ 异常时间轴",
            "📄 报告导出"
        ])
        
        with tab1:
            col1, col2, col3, col4 = st.columns(4)
            
            total_batches = len(st.session_state.merged_data)
            high_risk_batches = sum(1 for r in st.session_state.risk_results if r.risk_level == "high")
            medium_risk_batches = sum(1 for r in st.session_state.risk_results if r.risk_level == "medium")
            anomalies_count = len(st.session_state.risk_results)
            
            with col1:
                st.metric("总批次数量", total_batches)
            with col2:
                st.metric("高风险批次", high_risk_batches, delta_color="inverse")
            with col3:
                st.metric("中风险批次", medium_risk_batches, delta_color="off")
            with col4:
                st.metric("异常总数", anomalies_count)
            
            st.markdown("---")
            st.markdown('<h2 class="sub-header">📋 数据统计</h2>', unsafe_allow_html=True)
            
            if 'batches' in st.session_state.raw_data:
                col1, col2 = st.columns(2)
                with col1:
                    st.markdown("**菜品分布**")
                    dish_counts = st.session_state.raw_data['batches']['菜品'].value_counts()
                    st.bar_chart(dish_counts)
                
                with col2:
                    st.markdown("**门店分布**")
                    store_counts = st.session_state.raw_data['batches']['门店'].value_counts()
                    st.bar_chart(store_counts)
            
            if st.session_state.validation_errors:
                st.markdown("---")
                st.markdown('<h2 class="sub-header">⚠️ 字段验证问题</h2>', unsafe_allow_html=True)
                for error in st.session_state.validation_errors[:10]:
                    st.warning(f"**{error.table_name}** - {error.field_name}: {error.message}")
                if len(st.session_state.validation_errors) > 10:
                    st.info(f"还有 {len(st.session_state.validation_errors) - 10} 个问题...")
        
        with tab2:
            st.markdown('<h2 class="sub-header">⚠️ 批次风险列表</h2>', unsafe_allow_html=True)
            
            if st.session_state.risk_results:
                risk_level_filter = st.multiselect(
                    "筛选风险等级",
                    ["high", "medium", "low"],
                    default=["high", "medium"]
                )
                
                filtered_results = [
                    r for r in st.session_state.risk_results 
                    if r.risk_level in risk_level_filter
                ]
                
                for result in filtered_results:
                    risk_class = f"risk-{result.risk_level}"
                    risk_label = "🔴 高风险" if result.risk_level == "high" else \
                                 "🟡 中风险" if result.risk_level == "medium" else "🟢 低风险"
                    
                    with st.container():
                        st.markdown(f"""
                        <div class="risk-card {risk_class}">
                            <h4>{risk_label}: {result.rule_name}</h4>
                            <p><strong>批次号:</strong> {result.batch_number}</p>
                            <p><strong>描述:</strong> {result.description}</p>
                            <p><strong>证据:</strong> {result.evidence}</p>
                        </div>
                        """, unsafe_allow_html=True)
            else:
                st.success("✅ 未发现任何异常风险")
        
        with tab3:
            st.markdown('<h2 class="sub-header">📈 趋势分析</h2>', unsafe_allow_html=True)
            
            col1, col2, col3 = st.columns(3)
            
            with col1:
                stores = ["全部"] + sorted(st.session_state.raw_data['batches']['门店'].unique().tolist())
                selected_store = st.selectbox("选择门店", stores)
            
            with col2:
                delivery_cars = ["全部"] + sorted(st.session_state.raw_data['batches']['配送车'].unique().tolist())
                selected_car = st.selectbox("选择配送车", delivery_cars)
            
            with col3:
                freezers = ["全部"]
                if 'temperatures' in st.session_state.raw_data:
                    freezers += sorted(st.session_state.raw_data['temperatures']['冷柜编号'].unique().tolist())
                selected_freezer = st.selectbox("选择冷柜", freezers)
            
            st.markdown("---")
            st.markdown("### 温度趋势图")
            
            if 'temperatures' in st.session_state.raw_data:
                temp_data = st.session_state.raw_data['temperatures'].copy()
                
                if selected_store != "全部":
                    batch_stores = st.session_state.raw_data['batches'][
                        st.session_state.raw_data['batches']['门店'] == selected_store
                    ]['批次号'].unique()
                    temp_data = temp_data[temp_data['批次号'].isin(batch_stores)]
                
                if selected_car != "全部":
                    batch_cars = st.session_state.raw_data['batches'][
                        st.session_state.raw_data['batches']['配送车'] == selected_car
                    ]['批次号'].unique()
                    temp_data = temp_data[temp_data['批次号'].isin(batch_cars)]
                
                if selected_freezer != "全部":
                    temp_data = temp_data[temp_data['冷柜编号'] == selected_freezer]
                
                if not temp_data.empty:
                    import plotly.express as px
                    
                    temp_data['温度读数时间'] = temp_data['温度读数时间'].astype(str)
                    
                    fig = px.line(
                        temp_data,
                        x='温度读数时间',
                        y='温度值',
                        color='冷柜编号',
                        title='温度趋势图',
                        labels={'温度值': '温度 (°C)', '温度读数时间': '时间'}
                    )
                    fig.add_hline(y=4, line_dash="dash", line_color="red", annotation_text="超温阈值 (4°C)")
                    st.plotly_chart(fig, use_container_width=True)
                else:
                    st.info("当前筛选条件下没有温度数据")
        
        with tab4:
            st.markdown('<h2 class="sub-header">⏰ 异常时间轴</h2>', unsafe_allow_html=True)
            
            if st.session_state.risk_results:
                import plotly.express as px
                import pandas as pd
                
                timeline_data = []
                for result in st.session_state.risk_results:
                    if hasattr(result, 'timestamp') and result.timestamp:
                        timeline_data.append({
                            '时间': result.timestamp,
                            '批次号': result.batch_number,
                            '风险等级': result.risk_level,
                            '规则名称': result.rule_name,
                            '描述': result.description
                        })
                
                if timeline_data:
                    df = pd.DataFrame(timeline_data)
                    df['时间'] = pd.to_datetime(df['时间'])
                    df = df.sort_values('时间')
                    
                    color_map = {'high': '#e74c3c', 'medium': '#f39c12', 'low': '#27ae60'}
                    
                    fig = px.scatter(
                        df,
                        x='时间',
                        y='风险等级',
                        color='风险等级',
                        color_discrete_map=color_map,
                        size_max=20,
                        hover_data=['批次号', '规则名称', '描述'],
                        title='异常时间轴'
                    )
                    st.plotly_chart(fig, use_container_width=True)
                    
                    st.markdown("### 详细事件列表")
                    df_display = df[['时间', '批次号', '风险等级', '规则名称', '描述']].copy()
                    df_display['时间'] = df_display['时间'].astype(str)
                    st.dataframe(df_display, use_container_width=True)
                else:
                    st.info("异常结果中没有时间戳信息")
            else:
                st.success("✅ 未发现任何异常事件")
        
        with tab5:
            st.markdown('<h2 class="sub-header">📄 报告导出</h2>', unsafe_allow_html=True)
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.markdown("### 📝 Markdown 复盘报告")
                
                if st.button("生成复盘报告", type="primary"):
                    with st.spinner("正在生成报告..."):
                        report = generate_markdown_report(
                            st.session_state.merged_data,
                            st.session_state.risk_results,
                            st.session_state.raw_data
                        )
                        
                        st.session_state.generated_report = report
                        st.success("报告生成成功！")
                
                if 'generated_report' in st.session_state:
                    st.markdown("#### 报告预览")
                    st.markdown(st.session_state.generated_report)
                    
                    st.download_button(
                        label="⬇️ 下载 Markdown 报告",
                        data=st.session_state.generated_report,
                        file_name=f"冷链复盘报告_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.md",
                        mime="text/markdown"
                    )
            
            with col2:
                st.markdown("### 📊 CSV 异常清单")
                
                if st.button("生成异常清单", type="primary"):
                    with st.spinner("正在生成异常清单..."):
                        csv_data = export_anomalies_csv(st.session_state.risk_results)
                        st.session_state.anomalies_csv = csv_data
                        st.success("异常清单生成成功！")
                
                if 'anomalies_csv' in st.session_state:
                    st.download_button(
                        label="⬇️ 下载 CSV 异常清单",
                        data=st.session_state.anomalies_csv,
                        file_name=f"异常清单_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.csv",
                        mime="text/csv"
                    )
            
            st.markdown("---")
            st.markdown("### 批次详情查询")
            
            if st.session_state.merged_data:
                batch_numbers = sorted(list(st.session_state.merged_data.keys()))
                selected_batch = st.selectbox("选择批次号查看详情", batch_numbers)
                
                if selected_batch:
                    batch_data = st.session_state.merged_data[selected_batch]
                    
                    st.markdown(f"#### 批次 {selected_batch} 详情")
                    
                    col1, col2, col3 = st.columns(3)
                    
                    with col1:
                        st.markdown("**基本信息**")
                        st.write(f"菜品: {batch_data.dish}")
                        st.write(f"生产时间: {batch_data.production_time}")
                        st.write(f"出库时间: {batch_data.outbound_time}")
                    
                    with col2:
                        st.markdown("**配送信息**")
                        st.write(f"门店: {batch_data.store}")
                        st.write(f"配送车: {batch_data.delivery_car}")
                        st.write(f"交接签收时间: {batch_data.signoff_time}")
                    
                    with col3:
                        st.markdown("**风险状态**")
                        batch_risks = [r for r in st.session_state.risk_results if r.batch_number == selected_batch]
                        if batch_risks:
                            st.error(f"发现 {len(batch_risks)} 个风险")
                            for risk in batch_risks:
                                st.write(f"- {risk.rule_name}: {risk.description}")
                        else:
                            st.success("无风险")
                    
                    if batch_data.temperature_records:
                        st.markdown("**温度记录**")
                        temp_df = pd.DataFrame(batch_data.temperature_records)
                        st.dataframe(temp_df, use_container_width=True)
                        
                        import plotly.express as px
                        fig = px.line(
                            temp_df,
                            x='温度读数时间',
                            y='温度值',
                            markers=True,
                            title=f'批次 {selected_batch} 温度曲线'
                        )
                        fig.add_hline(y=4, line_dash="dash", line_color="red", annotation_text="超温阈值 (4°C)")
                        st.plotly_chart(fig, use_container_width=True)
                    
                    if batch_data.sample_records:
                        st.markdown("**留样抽检记录**")
                        sample_df = pd.DataFrame(batch_data.sample_records)
                        st.dataframe(sample_df, use_container_width=True)
    else:
        st.markdown("---")
        st.markdown("""
        ## 👋 欢迎使用冷链留样复盘台
        
        这是一个专为连锁轻食店中央厨房质控员设计的本地数据分析工具。
        
        ### 📋 功能特性
        
        - **数据整合**: 自动整合成品批次、冷柜温度、配送交接和留样抽检数据
        - **异常识别**: 智能识别多种风险场景
        - **可视化分析**: 趋势图、时间轴、批次详情页
        - **报告导出**: 一键生成复盘报告和异常清单
        
        ### 🚀 开始使用
        
        请从左侧侧边栏选择数据源：
        1. **使用示例数据**: 快速体验系统功能
        2. **上传CSV文件**: 导入您的实际数据
        
        ### 📁 支持的数据文件
        
        系统支持以下类型的CSV文件：
        - 成品批次数据（含批次号、菜品、生产时间等）
        - 冷柜温度记录（含冷柜编号、温度读数时间、温度值等）
        - 配送交接记录（含交接签收时间等）
        - 留样抽检结果（含留样编号、抽检结论等）
        """)

if __name__ == "__main__":
    main()
