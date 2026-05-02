import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import json
import yaml
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from billing_logic import (
    MeterDataParser,
    BillingCalculator,
    parse_meter_readings_csv,
    parse_shop_mapping_json,
    parse_billing_rules_yaml,
    parse_holiday_csv,
    calculate_bill_adjustments,
    export_bill_adjustments,
    generate_review_report
)
from anomaly_detection import (
    AnomalyDetector,
    apply_adjustments,
    get_anomaly_summary
)


st.set_page_config(
    page_title="商场用电分摊看板",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        font-weight: bold;
        color: #1f77b4;
        text-align: center;
        padding: 1rem;
    }
    .metric-card {
        background-color: #f0f8ff;
        border-radius: 10px;
        padding: 1rem;
        text-align: center;
    }
    .anomaly-high { color: #dc3545; font-weight: bold; }
    .anomaly-medium { color: #fd7e14; font-weight: bold; }
    .anomaly-low { color: #ffc107; font-weight: bold; }
</style>
""", unsafe_allow_html=True)


def initialize_session_state():
    if 'parsed_bills' not in st.session_state:
        st.session_state.parsed_bills = None
    if 'anomalies' not in st.session_state:
        st.session_state.anomalies = None
    if 'adjusted_bills' not in st.session_state:
        st.session_state.adjusted_bills = None
    if 'selected_shop' not in st.session_state:
        st.session_state.selected_shop = None
    if 'billing_rules' not in st.session_state:
        st.session_state.billing_rules = None


initialize_session_state()


def render_header():
    st.markdown('<div class="main-header">⚡ 商场用电分摊复核看板</div>', unsafe_allow_html=True)
    st.markdown("---")


def render_sidebar():
    with st.sidebar:
        st.header("📁 数据导入")

        meter_file = st.file_uploader(
            "电表读数 CSV",
            type=['csv'],
            help="格式: meter_id,meter_name,shop_no,reading_date,reading_value,reading_type"
        )

        mapping_file = st.file_uploader(
            "铺位-电表映射 JSON",
            type=['json'],
            help="电表与铺位的映射关系，包含共享比例等配置"
        )

        rules_file = st.file_uploader(
            "租约计费规则 YAML",
            type=['yaml'],
            help="电价、费率、异常检测阈值等配置"
        )

        holiday_file = st.file_uploader(
            "节假日客流 CSV (可选)",
            type=['csv'],
            help="用于节假日用电优惠识别"
        )

        use_sample = st.checkbox("使用示例数据", value=False)

        st.markdown("---")

        if st.button("🔄 加载数据", type="primary", use_container_width=True):
            if use_sample or (meter_file and mapping_file and rules_file):
                load_data(meter_file, mapping_file, rules_file, holiday_file, use_sample)
                st.success("数据加载成功!")
            else:
                st.error("请上传所有必需文件或勾选使用示例数据")

        st.markdown("---")
        st.markdown("### 📊 数据预览")
        if st.session_state.parsed_bills is not None:
            st.write(f"记录数: {len(st.session_state.parsed_bills)}")
            st.write(f"铺位数: {st.session_state.parsed_bills['shop_no'].nunique()}")
            st.write(f"电表数: {st.session_state.parsed_bills['meter_id'].nunique()}")

    return meter_file, mapping_file, rules_file, holiday_file, use_sample


def load_data(meter_file, mapping_file, rules_file, holiday_file, use_sample):
    if use_sample:
        base_path = os.path.join(os.path.dirname(__file__), 'sample_data')
        meter_df = parse_meter_readings_csv(os.path.join(base_path, 'meter_readings.csv'))
        shop_mapping = parse_shop_mapping_json(os.path.join(base_path, 'shop_meter_mapping.json'))
        billing_rules = parse_billing_rules_yaml(os.path.join(base_path, 'billing_rules.yaml'))
        holiday_df = parse_holiday_csv(os.path.join(base_path, 'holiday_traffic.csv'))
    else:
        meter_df = parse_meter_readings_csv(meter_file)
        shop_mapping = parse_shop_mapping_json(mapping_file)
        billing_rules = parse_billing_rules_yaml(rules_file)
        if holiday_file:
            holiday_df = parse_holiday_csv(holiday_file)
        else:
            holiday_df = None

    st.session_state.billing_rules = billing_rules

    parser = MeterDataParser(meter_df, shop_mapping, billing_rules)
    parsed_bills = parser.parse_readings()

    if holiday_df is not None:
        parsed_bills = calculate_bill_adjustments(parsed_bills, holiday_df)

    st.session_state.parsed_bills = parsed_bills

    detector = AnomalyDetector(billing_rules)
    anomalies = detector.detect_all_anomalies(parsed_bills)
    st.session_state.anomalies = anomalies

    adjusted_bills = apply_adjustments(parsed_bills, anomalies)
    st.session_state.adjusted_bills = adjusted_bills


def render_filters():
    st.header("🔍 筛选条件")

    if st.session_state.parsed_bills is None:
        st.warning("请先加载数据")
        return None, None, None

    df = st.session_state.parsed_bills

    col1, col2, col3 = st.columns(3)

    with col1:
        shop_options = ['全部'] + sorted(df['shop_no'].unique().tolist())
        selected_shop = st.selectbox("选择铺位", shop_options)
        st.session_state.selected_shop = selected_shop

    with col2:
        month_options = ['全部'] + sorted(df['month'].unique().tolist(), reverse=True)
        selected_month = st.selectbox("选择月份", month_options)

    with col3:
        anomaly_types = ['全部', '跨月抄表', '倍率错误', '空铺仍计费', '共享区域分摊异常', '缺失读数', '同一电表挂多铺位', '日均用电异常', '长期零用电']
        selected_anomaly = st.selectbox("异常类型", anomaly_types)

    filtered_df = df.copy()
    if selected_shop != '全部':
        filtered_df = filtered_df[filtered_df['shop_no'] == selected_shop]
    if selected_month != '全部':
        filtered_df = filtered_df[filtered_df['month'] == selected_month]

    return filtered_df, selected_shop, selected_month, selected_anomaly


def render_summary_metrics(df, anomalies_df, adjusted_df):
    st.header("📈 数据概览")

    col1, col2, col3, col4, col5 = st.columns(5)

    total_consumption = df['consumption_kwh'].sum()
    total_amount = df['total_amount'].sum()
    total_adjusted = adjusted_df['adjusted_amount'].sum()
    anomaly_count = len(anomalies_df) if anomalies_df is not None else 0
    shop_count = df['shop_no'].nunique()

    with col1:
        st.metric("总用电量", f"{total_consumption:,.0f} kWh")
    with col2:
        st.metric("调整前总额", f"¥{total_amount:,.2f}")
    with col3:
        st.metric("调整后总额", f"¥{total_adjusted:,.2f}")
    with col4:
        diff = total_adjusted - total_amount
        st.metric("调整差额", f"¥{diff:,.2f}", delta=f"{diff/total_amount*100:.1f}%" if total_amount else "N/A")
    with col5:
        st.metric("异常记录数", f"{anomaly_count}")


def render_anomaly_details(anomalies_df, selected_shop, selected_anomaly):
    st.header("🚨 异常检测明细")

    if anomalies_df is None or len(anomalies_df) == 0:
        st.success("未检测到异常")
        return

    filtered_anomalies = anomalies_df.copy()

    if selected_shop != '全部':
        filtered_anomalies = filtered_anomalies[
            filtered_anomalies['shop_no'].str.contains(selected_shop, na=False)
        ]

    if selected_anomaly != '全部':
        filtered_anomalies = filtered_anomalies[
            filtered_anomalies['anomaly_type'] == selected_anomaly
        ]

    summary = get_anomaly_summary(filtered_anomalies)

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("异常总数", summary['total'])
    with col2:
        high_count = summary['by_severity'].get('high', 0)
        st.markdown(f"<span class='anomaly-high'>高危: {high_count}</span>", unsafe_allow_html=True)
    with col3:
        medium_count = summary['by_severity'].get('medium', 0)
        st.markdown(f"<span class='anomaly-medium'>中危: {medium_count}</span>", unsafe_allow_html=True)
    with col4:
        low_count = summary['by_severity'].get('low', 0)
        st.markdown(f"<span class='anomaly-low'>低危: {low_count}</span>", unsafe_allow_html=True)

    st.markdown("---")

    tab1, tab2 = st.tabs(["📋 异常列表", "📊 按类型统计"])

    with tab1:
        display_df = filtered_anomalies[['shop_no', 'meter_id', 'month', 'anomaly_type', 'description', 'severity', 'amount_impact']].copy()
        display_df['amount_impact'] = display_df['amount_impact'].apply(lambda x: f"¥{x:.2f}" if pd.notna(x) else "¥0.00")

        st.dataframe(
            display_df,
            use_container_width=True,
            height=400
        )

    with tab2:
        if summary['by_type']:
            fig = px.pie(
                values=list(summary['by_type'].values()),
                names=list(summary['by_type'].keys()),
                title='异常类型分布',
                hole=0.4
            )
            st.plotly_chart(fig, use_container_width=True)


def render_comparison_charts(df, adjusted_df, selected_shop):
    st.header("📊 分摊前后对比")

    if df is None or len(df) == 0:
        st.warning("无数据可供对比")
        return

    tab1, tab2, tab3 = st.tabs(["💰 金额对比", "⚡ 用电量对比", "📈 趋势分析"])

    with tab1:
        comparison_df = df.groupby('month').agg({
            'total_amount': 'sum',
        }).reset_index()

        if 'adjusted_amount' in adjusted_df.columns:
            adjusted_monthly = adjusted_df.groupby('month').agg({
                'adjusted_amount': 'sum'
            }).reset_index()
            comparison_df = comparison_df.merge(adjusted_monthly, on='month')

        fig = make_subplots(
            rows=1, cols=2,
            subplot_titles=('月度账单对比', '调整前后差异'),
            specs=[[{"type": "bar"}, {"type": "bar"}]]
        )

        fig.add_trace(
            go.Bar(
                x=comparison_df['month'],
                y=comparison_df['total_amount'],
                name='调整前',
                marker_color='#ff6b6b'
            ),
            row=1, col=1
        )

        if 'adjusted_amount' in comparison_df.columns:
            fig.add_trace(
                go.Bar(
                    x=comparison_df['month'],
                    y=comparison_df['adjusted_amount'],
                    name='调整后',
                    marker_color='#51cf66'
                ),
                row=1, col=1
            )

        if 'adjusted_amount' in comparison_df.columns:
            diff = comparison_df['adjusted_amount'] - comparison_df['total_amount']
            fig.add_trace(
                go.Bar(
                    x=comparison_df['month'],
                    y=diff,
                    name='差异',
                    marker_color='#339af0'
                ),
                row=1, col=2
            )

        fig.update_layout(height=400, showlegend=True)
        st.plotly_chart(fig, use_container_width=True)

    with tab2:
        consumption_by_month = df.groupby('month')['consumption_kwh'].sum().reset_index()

        fig = px.bar(
            consumption_by_month,
            x='month',
            y='consumption_kwh',
            title='月度用电量',
            labels={'consumption_kwh': '用电量 (kWh)', 'month': '月份'}
        )
        fig.update_layout(height=400)
        st.plotly_chart(fig, use_container_width=True)

    with tab3:
        if selected_shop and selected_shop != '全部':
            shop_data = df[df['shop_no'] == selected_shop].copy()
            if len(shop_data) > 0:
                fig = make_subplots(
                    rows=2, cols=1,
                    subplot_titles=(f'{selected_shop} 用电量趋势', f'{selected_shop} 金额趋势')
                )

                fig.add_trace(
                    go.Scatter(
                        x=shop_data['month'],
                        y=shop_data['consumption_kwh'],
                        mode='lines+markers',
                        name='用电量'
                    ),
                    row=1, col=1
                )

                fig.add_trace(
                    go.Scatter(
                        x=shop_data['month'],
                        y=shop_data['total_amount'],
                        mode='lines+markers',
                        name='金额'
                    ),
                    row=2, col=1
                )

                fig.update_layout(height=500, showlegend=True)
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info(f"铺位 {selected_shop} 无数据")
        else:
            monthly_summary = df.groupby('month').agg({
                'consumption_kwh': 'sum',
                'total_amount': 'sum'
            }).reset_index()

            fig = make_subplots(
                rows=2, cols=1,
                subplot_titles=('总用电量趋势', '总金额趋势')
            )

            fig.add_trace(
                go.Scatter(
                    x=monthly_summary['month'],
                    y=monthly_summary['consumption_kwh'],
                    mode='lines+markers',
                    name='用电量',
                    line=dict(color='#339af0')
                ),
                row=1, col=1
            )

            fig.add_trace(
                go.Scatter(
                    x=monthly_summary['month'],
                    y=monthly_summary['total_amount'],
                    mode='lines+markers',
                    name='金额',
                    line=dict(color='#ff6b6b')
                ),
                row=2, col=1
            )

            fig.update_layout(height=500, showlegend=True)
            st.plotly_chart(fig, use_container_width=True)


def render_shop_details(df, selected_shop):
    if selected_shop and selected_shop != '全部':
        st.header(f"🏪 铺位详情: {selected_shop}")

        shop_df = df[df['shop_no'] == selected_shop]

        if len(shop_df) > 0:
            shop_info = shop_df.iloc[0]

            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.metric("铺位名称", shop_info.get('shop_name', 'N/A'))
            with col2:
                st.metric("电表ID", shop_info.get('meter_id', 'N/A'))
            with col3:
                st.metric("区域类型", shop_info.get('area_type', 'N/A'))
            with col4:
                st.metric("铺位状态", shop_info.get('shop_status', 'N/A'))

            st.markdown("---")

            detail_df = shop_df[['month', 'consumption_kwh', 'base_amount', 'service_fee', 'total_amount']].copy()
            detail_df.columns = ['月份', '用电量(kWh)', '基础费用', '服务费', '总费用']

            st.dataframe(detail_df, use_container_width=True, hide_index=True)
        else:
            st.info(f"铺位 {selected_shop} 无数据")
    else:
        st.header("🏪 铺位汇总")

        if df is not None and len(df) > 0:
            shop_summary = df.groupby('shop_no').agg({
                'consumption_kwh': 'sum',
                'total_amount': 'sum',
                'shop_name': 'first',
                'area_type': 'first'
            }).reset_index()

            shop_summary.columns = ['铺位', '总用电量', '总费用', '名称', '区域类型']

            st.dataframe(shop_summary, use_container_width=True, hide_index=True)


def render_export_section(df, anomalies_df, adjusted_df):
    st.header("📤 导出报告")

    col1, col2 = st.columns(2)

    with col1:
        if st.button("📊 导出 bill_adjustments.csv", use_container_width=True):
            if adjusted_df is not None:
                export_bill_adjustments(adjusted_df, 'bill_adjustments.csv')
                st.success("已导出 bill_adjustments.csv")

    with col2:
        if st.button("📝 导出 review_report.md", use_container_width=True):
            if df is not None and anomalies_df is not None:
                generate_review_report(df, anomalies_df, 'review_report.md')
                st.success("已导出 review_report.md")


def main():
    render_header()

    meter_file, mapping_file, rules_file, holiday_file, use_sample = render_sidebar()

    st.markdown("---")

    filtered_df, selected_shop, selected_month, selected_anomaly = render_filters()

    if st.session_state.parsed_bills is not None:
        render_summary_metrics(
            filtered_df,
            st.session_state.anomalies,
            st.session_state.adjusted_bills
        )

        st.markdown("---")

        render_anomaly_details(
            st.session_state.anomalies,
            selected_shop,
            selected_anomaly
        )

        st.markdown("---")

        render_comparison_charts(
            filtered_df,
            st.session_state.adjusted_bills,
            selected_shop
        )

        st.markdown("---")

        render_shop_details(filtered_df, selected_shop)

        st.markdown("---")

        render_export_section(
            st.session_state.parsed_bills,
            st.session_state.anomalies,
            st.session_state.adjusted_bills
        )
    else:
        st.info("👈 请在侧边栏上传数据文件或勾选使用示例数据开始分析")


if __name__ == "__main__":
    main()