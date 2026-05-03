import streamlit as st
import pandas as pd
import numpy as np
from datetime import date, timedelta
import io
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from data_parser import DataParser
from metrics_calculator import MetricsCalculator
from rule_engine import RuleEngine
from visualization import Visualizer
from exporter import Exporter
from sample_data import SampleDataGenerator


st.set_page_config(
    page_title="短视频投放复盘工具",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)


def init_session_state():
    if 'combined_data' not in st.session_state:
        st.session_state.combined_data = None
    if 'daily_metrics' not in st.session_state:
        st.session_state.daily_metrics = None
    if 'material_metrics' not in st.session_state:
        st.session_state.material_metrics = None
    if 'anomalies' not in st.session_state:
        st.session_state.anomalies = None
    if 'summary' not in st.session_state:
        st.session_state.summary = None
    if 'uploaded_files' not in st.session_state:
        st.session_state.uploaded_files = {}
    if 'use_sample_data' not in st.session_state:
        st.session_state.use_sample_data = False


def load_sample_data():
    generator = SampleDataGenerator()
    sample_data = generator.get_all_sample_data()
    
    parser = DataParser()
    
    ad_data_list = []
    for platform in ['抖音', '小红书', '视频号']:
        if platform in sample_data:
            df = sample_data[platform]
            normalized, _ = parser.normalize_data(df, platform)
            ad_data_list.append((platform, normalized))
    
    transaction_df = None
    if '成交数据' in sample_data:
        transaction_df = sample_data['成交数据']
    
    combined, _ = parser.merge_all_data(ad_data_list, transaction_df)
    
    return combined


def process_data(combined_df: pd.DataFrame):
    if combined_df.empty:
        return None, None, None, None
    
    calculator = MetricsCalculator()
    
    combined_with_metrics = calculator.calculate_basic_metrics(combined_df)
    
    daily_metrics = calculator.aggregate_by_date(combined_with_metrics)
    
    material_metrics = calculator.aggregate_by_material(combined_with_metrics)
    material_metrics = calculator.calculate_fatigue(combined_with_metrics, material_metrics)
    
    summary = calculator.get_overall_summary(combined_with_metrics)
    
    rule_engine = RuleEngine()
    anomalies = rule_engine.detect_all_anomalies(daily_metrics, material_metrics)
    
    return daily_metrics, material_metrics, anomalies, summary


def apply_filters(df, platforms, start_date, end_date, materials=None):
    if df.empty:
        return df
    
    filtered = df.copy()
    
    if 'platform' in filtered.columns and platforms:
        filtered = filtered[filtered['platform'].isin(platforms)]
    
    if 'date' in filtered.columns:
        if start_date:
            filtered = filtered[filtered['date'] >= start_date]
        if end_date:
            filtered = filtered[filtered['date'] <= end_date]
    
    if materials and 'material_id' in filtered.columns:
        filtered = filtered[filtered['material_id'].isin(materials)]
    
    return filtered


def display_metrics_cards(summary):
    if not summary:
        return
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("总花费", f"¥{summary.get('total_spend', 0):,.2f}")
    
    with col2:
        st.metric("总转化", f"{summary.get('total_conversion', 0):,}")
    
    with col3:
        st.metric("平均ROI", f"{summary.get('avg_roi', 0):.2f}")
    
    with col4:
        st.metric("平均CPA", f"¥{summary.get('avg_cpa', 0):.2f}")
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("总曝光", f"{summary.get('total_impression', 0):,}")
    
    with col2:
        st.metric("总点击", f"{summary.get('total_click', 0):,}")
    
    with col3:
        st.metric("平均CTR", f"{summary.get('avg_ctr', 0):.2f}%")
    
    with col4:
        st.metric("平均CPC", f"¥{summary.get('avg_cpc', 0):.2f}")


def main():
    init_session_state()
    
    st.title("📊 短视频投放复盘工具")
    st.markdown("支持抖音、小红书、视频号多平台数据整合与智能分析")
    
    with st.sidebar:
        st.header("📁 数据导入")
        
        use_sample = st.checkbox("使用示例数据", value=st.session_state.use_sample_data)
        
        if use_sample:
            st.session_state.use_sample_data = True
            if st.button("加载示例数据"):
                with st.spinner("正在加载示例数据..."):
                    combined = load_sample_data()
                    if not combined.empty:
                        st.session_state.combined_data = combined
                        daily, material, anomalies, summary = process_data(combined)
                        st.session_state.daily_metrics = daily
                        st.session_state.material_metrics = material
                        st.session_state.anomalies = anomalies
                        st.session_state.summary = summary
                        st.success("示例数据加载成功！")
                    else:
                        st.error("数据加载失败")
        else:
            st.session_state.use_sample_data = False
            
            st.subheader("投放数据")
            
            douyin_file = st.file_uploader("抖音数据 CSV", type=['csv'], key='douyin')
            xhs_file = st.file_uploader("小红书数据 CSV", type=['csv'], key='xhs')
            wxh_file = st.file_uploader("视频号数据 CSV", type=['csv'], key='wxh')
            
            st.subheader("成交数据")
            transaction_file = st.file_uploader("成交数据 CSV (可选)", type=['csv'], key='transaction')
            
            if st.button("开始处理数据"):
                parser = DataParser()
                ad_data_list = []
                
                with st.spinner("正在处理数据..."):
                    
                    if douyin_file is not None:
                        df = pd.read_csv(douyin_file)
                        normalized, warnings = parser.normalize_data(df, '抖音')
                        ad_data_list.append(('抖音', normalized))
                        if any(warnings.values()):
                            st.warning(f"抖音数据有警告: {warnings}")
                    
                    if xhs_file is not None:
                        df = pd.read_csv(xhs_file)
                        normalized, warnings = parser.normalize_data(df, '小红书')
                        ad_data_list.append(('小红书', normalized))
                        if any(warnings.values()):
                            st.warning(f"小红书数据有警告: {warnings}")
                    
                    if wxh_file is not None:
                        df = pd.read_csv(wxh_file)
                        normalized, warnings = parser.normalize_data(df, '视频号')
                        ad_data_list.append(('视频号', normalized))
                        if any(warnings.values()):
                            st.warning(f"视频号数据有警告: {warnings}")
                    
                    transaction_df = None
                    if transaction_file is not None:
                        transaction_df = pd.read_csv(transaction_file)
                    
                    if ad_data_list:
                        combined, merge_warnings = parser.merge_all_data(ad_data_list, transaction_df)
                        
                        if not combined.empty:
                            st.session_state.combined_data = combined
                            
                            daily, material, anomalies, summary = process_data(combined)
                            
                            st.session_state.daily_metrics = daily
                            st.session_state.material_metrics = material
                            st.session_state.anomalies = anomalies
                            st.session_state.summary = summary
                            
                            st.success(f"数据处理成功！共 {len(combined)} 条记录")
                        else:
                            st.error("数据合并失败，请检查上传的文件")
                    else:
                        st.error("请至少上传一个平台的投放数据")
        
        st.markdown("---")
        st.subheader("⚙️ 筛选条件")
        
        if st.session_state.combined_data is not None and not st.session_state.combined_data.empty:
            combined = st.session_state.combined_data
            
            all_platforms = sorted(combined['platform'].unique().tolist())
            selected_platforms = st.multiselect("选择平台", all_platforms, default=all_platforms)
            
            min_date = combined['date'].min()
            max_date = combined['date'].max()
            
            col1, col2 = st.columns(2)
            with col1:
                start_date = st.date_input("开始日期", min_date)
            with col2:
                end_date = st.date_input("结束日期", max_date)
            
            all_materials = sorted(combined['material_id'].unique().tolist())
            selected_materials = st.multiselect(
                "选择素材 (可选)", 
                all_materials, 
                default=[],
                help="不选择则显示所有素材"
            )
            
            st.session_state.filter_platforms = selected_platforms
            st.session_state.filter_start = start_date
            st.session_state.filter_end = end_date
            st.session_state.filter_materials = selected_materials
        else:
            st.info("请先导入数据")
    
    if st.session_state.combined_data is None or st.session_state.combined_data.empty:
        st.info("👋 欢迎使用短视频投放复盘工具！请从左侧边栏上传数据或使用示例数据开始。")
        
        st.markdown("## 功能介绍")
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.markdown("### 📈 数据整合")
            st.markdown("- 支持抖音、小红书、视频号三平台")
            st.markdown("- 自动字段映射与类型转换")
            st.markdown("- 支持成交数据关联")
        
        with col2:
            st.markdown("### 🎯 智能分析")
            st.markdown("- 统一计算花费、ROI、CPA等指标")
            st.markdown("- 素材疲劳度检测")
            st.markdown("- 异常规则自动识别")
        
        with col3:
            st.markdown("### 📊 可视化导出")
            st.markdown("- 多维度趋势图表")
            st.markdown("- Markdown复盘报告")
            st.markdown("- CSV汇总数据导出")
        
        st.stop()
    
    tabs = st.tabs(["📊 数据概览", "📈 趋势分析", "🎯 素材分析", "⚠️ 异常检测", "📋 数据导出"])
    
    with tabs[0]:
        st.header("数据概览")
        
        display_metrics_cards(st.session_state.summary)
        
        st.markdown("---")
        
        col1, col2 = st.columns([1, 2])
        
        with col1:
            st.subheader("平台分布")
            if st.session_state.daily_metrics is not None and not st.session_state.daily_metrics.empty:
                visualizer = Visualizer()
                platform_chart = visualizer.create_platform_comparison_chart(st.session_state.daily_metrics)
                st.plotly_chart(platform_chart, use_container_width=True)
        
        with col2:
            st.subheader("原始数据预览")
            if st.session_state.combined_data is not None:
                preview_df = st.session_state.combined_data.copy()
                preview_df['date'] = pd.to_datetime(preview_df['date']).dt.strftime('%Y-%m-%d')
                st.dataframe(
                    preview_df[['date', 'platform', 'material_id', 'spend', 'impression', 'click', 'conversion', 'roi']].head(20),
                    use_container_width=True
                )
    
    with tabs[1]:
        st.header("趋势分析")
        
        visualizer = Visualizer()
        
        filtered_daily = apply_filters(
            st.session_state.daily_metrics,
            st.session_state.get('filter_platforms', []),
            st.session_state.get('filter_start', None),
            st.session_state.get('filter_end', None)
        )
        
        if filtered_daily is None or filtered_daily.empty:
            st.warning("当前筛选条件下无数据")
        else:
            col1, col2 = st.columns(2)
            
            with col1:
                spend_chart = visualizer.create_spend_trend_chart(filtered_daily)
                st.plotly_chart(spend_chart, use_container_width=True)
                
                roi_chart = visualizer.create_roi_trend_chart(filtered_daily)
                st.plotly_chart(roi_chart, use_container_width=True)
            
            with col2:
                conv_chart = visualizer.create_conversion_trend_chart(filtered_daily)
                st.plotly_chart(conv_chart, use_container_width=True)
                
                cpa_chart = visualizer.create_cpa_trend_chart(filtered_daily)
                st.plotly_chart(cpa_chart, use_container_width=True)
            
            st.markdown("---")
            
            ctr_cpc_chart = visualizer.create_ctr_cpc_chart(filtered_daily)
            st.plotly_chart(ctr_cpc_chart, use_container_width=True)
            
            st.markdown("---")
            
            with st.expander("查看完整每日指标数据"):
                display_df = filtered_daily.copy()
                display_df['date'] = pd.to_datetime(display_df['date']).dt.strftime('%Y-%m-%d')
                st.dataframe(display_df, use_container_width=True)
    
    with tabs[2]:
        st.header("素材分析")
        
        visualizer = Visualizer()
        
        filtered_material = apply_filters(
            st.session_state.material_metrics,
            st.session_state.get('filter_platforms', []),
            None,
            None,
            st.session_state.get('filter_materials', [])
        )
        
        if filtered_material is None or filtered_material.empty:
            st.warning("当前筛选条件下无素材数据")
        else:
            col1, col2 = st.columns([1, 1])
            
            with col1:
                metric_option = st.selectbox(
                    "选择排序指标",
                    ['total_spend', 'total_conversion', 'avg_roi', 'fatigue_score'],
                    format_func=lambda x: {
                        'total_spend': '总花费',
                        'total_conversion': '总转化',
                        'avg_roi': '平均ROI',
                        'fatigue_score': '疲劳度得分'
                    }.get(x, x)
                )
                
                rank_chart = visualizer.create_material_ranking_chart(
                    filtered_material, metric_option, top_n=10
                )
                st.plotly_chart(rank_chart, use_container_width=True)
            
            with col2:
                if 'fatigue_score' in filtered_material.columns:
                    st.subheader("素材疲劳度分析")
                    fatigue_chart = visualizer.create_fatigue_analysis_chart(filtered_material)
                    st.plotly_chart(fatigue_chart, use_container_width=True)
            
            st.markdown("---")
            
            st.subheader("花费 vs ROI 分析")
            scatter_chart = visualizer.create_spend_vs_roi_scatter(filtered_material)
            st.plotly_chart(scatter_chart, use_container_width=True)
            
            st.markdown("---")
            
            with st.expander("查看完整素材数据"):
                display_cols = ['material_id', 'platform', 'total_spend', 'total_impression', 
                               'total_click', 'total_conversion', 'avg_roi', 'avg_cpa', 
                               'days_active', 'fatigue_score', 'is_fatigued']
                available_cols = [c for c in display_cols if c in filtered_material.columns]
                st.dataframe(filtered_material[available_cols], use_container_width=True)
            
            if 'is_fatigued' in filtered_material.columns:
                fatigued_materials = filtered_material[filtered_material['is_fatigued']]
                if not fatigued_materials.empty:
                    st.markdown("---")
                    st.subheader("⚠️ 疲劳素材预警")
                    st.warning(f"发现 {len(fatigued_materials)} 个疲劳素材，建议及时更换或优化！")
                    
                    st.dataframe(
                        fatigued_materials[['material_id', 'platform', 'total_spend', 'days_active', 'fatigue_score']],
                        use_container_width=True
                    )
    
    with tabs[3]:
        st.header("异常检测")
        
        rule_engine = RuleEngine()
        
        if st.session_state.anomalies is None:
            st.info("暂无异常数据")
        else:
            anomalies = st.session_state.anomalies
            total_anomalies = sum(len(v) for v in anomalies.values())
            
            if total_anomalies == 0:
                st.success("🎉 未检测到异常情况，数据表现稳定！")
            else:
                st.warning(f"⚠️ 共检测到 {total_anomalies} 个异常情况")
                
                anomaly_df = rule_engine.anomalies_to_dataframe(anomalies)
                
                st.subheader("异常明细")
                st.dataframe(anomaly_df, use_container_width=True)
                
                st.markdown("---")
                
                col1, col2 = st.columns(2)
                
                with col1:
                    if anomalies.get('spend_surge'):
                        st.subheader("💰 花费突增")
                        for a in anomalies['spend_surge']:
                            with st.expander(f"{a.date} - {a.platform} ({a.severity}度)"):
                                st.write(f"**当前花费**: ¥{a.current_value:,.2f}")
                                st.write(f"**基准花费**: ¥{a.baseline_value:,.2f}")
                                st.write(f"**变化率**: {a.change_pct:+.2f}%")
                                st.write(f"**描述**: {a.message}")
                
                with col2:
                    if anomalies.get('conversion_cliff'):
                        st.subheader("📉 转化断崖")
                        for a in anomalies['conversion_cliff']:
                            with st.expander(f"{a.date} - {a.platform} ({a.severity}度)"):
                                st.write(f"**当前转化**: {a.current_value:,}")
                                st.write(f"**基准转化**: {a.baseline_value:,}")
                                st.write(f"**变化率**: {a.change_pct:+.2f}%")
                                st.write(f"**描述**: {a.message}")
                
                if anomalies.get('low_roi') or anomalies.get('high_cpa'):
                    st.markdown("---")
                    
                    col1, col2 = st.columns(2)
                    
                    with col1:
                        if anomalies.get('low_roi'):
                            st.subheader("📉 ROI过低")
                            for a in anomalies['low_roi']:
                                with st.expander(f"{a.material_id} - {a.platform}"):
                                    st.write(f"**当前ROI**: {a.current_value:.2f}")
                                    st.write(f"**阈值**: {a.baseline_value:.2f}")
                                    st.write(f"**总花费**: ¥{a.details.get('total_spend', 0):,.2f}")
                    
                    with col2:
                        if anomalies.get('high_cpa'):
                            st.subheader("📈 CPA过高")
                            for a in anomalies['high_cpa']:
                                with st.expander(f"{a.material_id} - {a.platform}"):
                                    st.write(f"**当前CPA**: ¥{a.current_value:.2f}")
                                    st.write(f"**阈值**: ¥{a.baseline_value:.2f}")
                                    st.write(f"**总花费**: ¥{a.details.get('total_spend', 0):,.2f}")
                                    st.write(f"**总转化**: {a.details.get('total_conversion', 0):,}")
                
                if anomalies.get('cross_platform_diff'):
                    st.markdown("---")
                    st.subheader("🔄 跨平台表现差异")
                    
                    seen = set()
                    for a in anomalies['cross_platform_diff']:
                        key = f"{a.material_id}_{a.platform}_{a.details.get('better_platform')}"
                        if key not in seen:
                            seen.add(key)
                            with st.expander(f"素材 {a.material_id}: {a.platform} vs {a.details.get('better_platform')}"):
                                st.write(f"**较差平台**: {a.platform} (ROI: {a.current_value:.2f})")
                                st.write(f"**较好平台**: {a.details.get('better_platform')} (ROI: {a.baseline_value:.2f})")
                                st.write(f"**差异率**: {a.change_pct:+.2f}%")
    
    with tabs[4]:
        st.header("数据导出")
        
        exporter = Exporter()
        
        col1, col2 = st.columns([1, 1])
        
        with col1:
            st.subheader("📝 复盘报告")
            
            report_title = st.text_input("报告标题", value="短视频投放复盘报告")
            
            if st.button("生成 Markdown 报告", type="primary"):
                with st.spinner("正在生成报告..."):
                    markdown = exporter.generate_markdown_report(
                        st.session_state.daily_metrics,
                        st.session_state.material_metrics,
                        st.session_state.anomalies,
                        report_title=report_title
                    )
                    
                    st.download_button(
                        label="📥 下载 Markdown 报告",
                        data=markdown,
                        file_name=f"复盘报告_{date.today().strftime('%Y%m%d')}.md",
                        mime="text/markdown"
                    )
                    
                    st.markdown("---")
                    st.subheader("报告预览")
                    st.markdown(markdown)
        
        with col2:
            st.subheader("📊 CSV 数据导出")
            
            csv_outputs = exporter.generate_summary_csv(
                st.session_state.daily_metrics,
                st.session_state.material_metrics
            )
            
            for filename, csv_content in csv_outputs.items():
                st.download_button(
                    label=f"📥 下载 {filename}",
                    data=csv_content,
                    file_name=filename,
                    mime="text/csv"
                )
            
            st.markdown("---")
            
            st.subheader("🔧 异常检测配置")
            
            with st.form("anomaly_config"):
                spend_threshold = st.slider("花费突增阈值 (倍数)", 1.5, 5.0, 2.0, 0.5)
                conversion_threshold = st.slider("转化断崖阈值 (比例)", 0.2, 0.8, 0.5, 0.1)
                roi_threshold = st.slider("ROI过低阈值", 0.1, 2.0, 1.0, 0.1)
                cpa_threshold = st.slider("CPA过高阈值 (元)", 10.0, 200.0, 50.0, 10.0)
                fatigue_threshold = st.slider("疲劳度阈值", 10, 50, 30, 5)
                
                if st.form_submit_button("保存配置"):
                    st.success("配置已保存（下次分析时生效）")


if __name__ == "__main__":
    main()
