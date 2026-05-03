import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import os
import sys
from datetime import date, datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from ration_calculator import (
    load_feed_inventory,
    load_lab_results,
    load_herd_groups,
    load_ration_plan,
    process_all_groups,
    generate_markdown_report,
    issues_to_dataframe
)

SAMPLE_DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

st.set_page_config(
    page_title="奶牛日粮配方偏差复核看板",
    page_icon="🐄",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
<style>
    .main-header {
        font-size: 2rem;
        font-weight: bold;
        color: #2c3e50;
    }
    .metric-card {
        background-color: #f8f9fa;
        border-radius: 10px;
        padding: 15px;
        box-shadow: 2px 2px 5px rgba(0,0,0,0.1);
    }
    .error-text {
        color: #dc3545;
        font-weight: bold;
    }
    .warning-text {
        color: #ffc107;
        font-weight: bold;
    }
    .success-text {
        color: #28a745;
        font-weight: bold;
    }
</style>
""", unsafe_allow_html=True)


def load_sample_data():
    try:
        inventory_df = load_feed_inventory(os.path.join(SAMPLE_DATA_DIR, 'feed_inventory.csv'))
        lab_df = load_lab_results(os.path.join(SAMPLE_DATA_DIR, 'lab_results.csv'))
        herd_df = load_herd_groups(os.path.join(SAMPLE_DATA_DIR, 'herd_groups.csv'))
        ration_plan = load_ration_plan(os.path.join(SAMPLE_DATA_DIR, 'ration_plan.yaml'))
        return inventory_df, lab_df, herd_df, ration_plan, True
    except Exception as e:
        st.error(f"加载示例数据失败: {e}")
        return None, None, None, None, False


def get_user_uploaded_data():
    st.sidebar.header("📁 数据导入")
    
    inventory_file = st.sidebar.file_uploader("1. 饲料库存 (feed_inventory.csv)", type=['csv'], key='inv')
    lab_file = st.sidebar.file_uploader("2. 实验室检测结果 (lab_results.csv)", type=['csv'], key='lab')
    herd_file = st.sidebar.file_uploader("3. 牛群分组 (herd_groups.csv)", type=['csv'], key='herd')
    ration_file = st.sidebar.file_uploader("4. 日粮配方 (ration_plan.yaml)", type=['yaml', 'yml'], key='ration')
    
    if all([inventory_file, lab_file, herd_file, ration_file]):
        try:
            inventory_df = load_feed_inventory(inventory_file)
            lab_df = load_lab_results(lab_file)
            herd_df = load_herd_groups(herd_file)
            ration_plan = load_ration_plan(ration_file)
            return inventory_df, lab_df, herd_df, ration_plan, True
        except Exception as e:
            st.sidebar.error(f"数据导入失败: {e}")
            return None, None, None, None, False
    
    return None, None, None, None, False


def create_radar_chart(targets, actuals, group_name):
    categories = ['干物质', '粗蛋白', '净能量', '钙', '磷']
    
    target_values = [
        targets.get('dry_matter_kg', 0) or 0,
        targets.get('crude_protein_percent', 0) or 0,
        targets.get('net_energy_mcal_kg', 0) or 0,
        targets.get('calcium_percent', 0) or 0,
        targets.get('phosphorus_percent', 0) or 0,
    ]
    
    actual_values = [
        actuals.get('dry_matter_kg', 0) or 0,
        actuals.get('crude_protein_percent', 0) or 0,
        actuals.get('net_energy_mcal_kg', 0) or 0,
        actuals.get('calcium_percent', 0) or 0,
        actuals.get('phosphorus_percent', 0) or 0,
    ]
    
    max_vals = [max(t, a) * 1.2 if max(t, a) > 0 else 1 for t, a in zip(target_values, actual_values)]
    target_normalized = [t / m if m > 0 else 0 for t, m in zip(target_values, max_vals)]
    actual_normalized = [a / m if m > 0 else 0 for a, m in zip(actual_values, max_vals)]
    
    fig = go.Figure()
    
    fig.add_trace(go.Scatterpolar(
        r=target_normalized,
        theta=categories,
        fill='toself',
        name='目标值',
        line=dict(color='#1f77b4'),
        fillcolor='rgba(31, 119, 180, 0.2)'
    ))
    
    fig.add_trace(go.Scatterpolar(
        r=actual_normalized,
        theta=categories,
        fill='toself',
        name='实际值',
        line=dict(color='#ff7f0e'),
        fillcolor='rgba(255, 127, 14, 0.2)'
    ))
    
    fig.update_layout(
        polar=dict(
            radialaxis=dict(visible=True, range=[0, 1.2], showticklabels=False)
        ),
        showlegend=True,
        title=f"{group_name} - 营养指标对比",
        height=400
    )
    
    return fig


def create_bar_comparison(group_results):
    groups = list(group_results.keys())
    group_names = [r['group_name'] for r in group_results.values()]
    
    target_dm = [r['targets'].get('dry_matter_kg', 0) or 0 for r in group_results.values()]
    actual_dm = [r['actual'].get('dry_matter_kg', 0) or 0 for r in group_results.values()]
    
    target_cp = [r['targets'].get('crude_protein_percent', 0) or 0 for r in group_results.values()]
    actual_cp = [r['actual'].get('crude_protein_percent', 0) or 0 for r in group_results.values()]
    
    fig = make_subplots(rows=1, cols=2, subplot_titles=('干物质采食量 (kg/头/天)', '粗蛋白 (%)'))
    
    fig.add_trace(
        go.Bar(name='目标', x=group_names, y=target_dm, marker_color='#1f77b4'),
        row=1, col=1
    )
    fig.add_trace(
        go.Bar(name='实际', x=group_names, y=actual_dm, marker_color='#ff7f0e'),
        row=1, col=1
    )
    
    fig.add_trace(
        go.Bar(name='目标', x=group_names, y=target_cp, marker_color='#1f77b4', showlegend=False),
        row=1, col=2
    )
    fig.add_trace(
        go.Bar(name='实际', x=group_names, y=actual_cp, marker_color='#ff7f0e', showlegend=False),
        row=1, col=2
    )
    
    fig.update_layout(height=400, barmode='group')
    return fig


def create_inventory_chart(inventory_consumptions):
    feeds = [inv.feed_name for inv in inventory_consumptions]
    current_inv = [inv.current_inventory_kg for inv in inventory_consumptions]
    daily_use = [inv.daily_consumption_kg * 30 for inv in inventory_consumptions]
    
    fig = go.Figure()
    
    fig.add_trace(go.Bar(
        name='当前库存',
        x=feeds,
        y=current_inv,
        marker_color='#2ca02c'
    ))
    
    fig.add_trace(go.Bar(
        name='30天预计消耗',
        x=feeds,
        y=daily_use,
        marker_color='#ff7f0e'
    ))
    
    fig.update_layout(
        title='库存 vs 30天消耗预测',
        xaxis_title='饲料',
        yaxis_title='数量 (kg)',
        barmode='group',
        height=400
    )
    
    return fig


def main():
    st.markdown('<p class="main-header">🐄 奶牛日粮配方偏差复核看板</p>', unsafe_allow_html=True)
    
    use_sample = st.sidebar.checkbox("使用示例数据", value=True)
    
    if use_sample:
        inventory_df, lab_df, herd_df, ration_plan, success = load_sample_data()
        if success:
            st.sidebar.success("✅ 示例数据已加载")
    else:
        inventory_df, lab_df, herd_df, ration_plan, success = get_user_uploaded_data()
    
    if not success:
        st.info("👈 请在左侧边栏上传数据文件或勾选'使用示例数据'")
        
        with st.expander("📋 数据文件格式说明"):
            st.markdown("""
            ### 必需的4个数据文件：
            
            **1. feed_inventory.csv - 饲料库存**
            - feed_id, feed_name, batch_number, quantity_kg, unit_cost_cny_kg
            - dry_matter_percent, expiry_date, storage_location
            
            **2. lab_results.csv - 实验室检测结果**
            - feed_id, test_date, dry_matter_actual, crude_protein_percent
            - net_energy_mcal_kg, calcium_percent, phosphorus_percent
            
            **3. herd_groups.csv - 牛群分组**
            - group_id, group_name, cow_count, average_weight_kg, stage
            
            **4. ration_plan.yaml - 日粮配方**
            - 包含各牛群的目标营养指标、预算和饲料配方
            """)
        return
    
    st.sidebar.header("⚙️ 分析参数")
    projection_days = st.sidebar.slider("库存预测天数", min_value=7, max_value=90, value=30)
    tolerance_pct = st.sidebar.slider("营养偏差容忍度 (%)", min_value=1, max_value=20, value=5)
    
    group_results, all_issues, inventory_consumptions = process_all_groups(
        ration_plan, inventory_df, lab_df, herd_df,
        projection_days=projection_days,
        tolerance_pct=tolerance_pct
    )
    
    st.sidebar.header("🐄 牛群筛选")
    all_groups = list(group_results.keys())
    all_group_names = {g: r['group_name'] for g, r in group_results.items()}
    
    selected_groups = st.sidebar.multiselect(
        "选择牛群",
        options=all_groups,
        default=all_groups,
        format_func=lambda x: f"{x} - {all_group_names[x]}"
    )
    
    filtered_results = {g: group_results[g] for g in selected_groups if g in group_results}
    
    tab_overview, tab_groups, tab_inventory, tab_issues, tab_export = st.tabs([
        "📊 概览", "🐄 牛群详情", "📦 库存分析", "⚠️ 问题明细", "📥 导出报告"
    ])
    
    with tab_overview:
        st.header("📊 总览")
        
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.metric("牛群数量", f"{len(filtered_results)}")
        
        with col2:
            total_cows = sum(r['cow_count'] for r in filtered_results.values())
            st.metric("总牛头数", f"{total_cows:,}")
        
        with col3:
            error_count = sum(1 for i in all_issues if i.severity == 'error')
            st.metric("🔴 错误", f"{error_count}", delta_color="inverse")
        
        with col4:
            warning_count = sum(1 for i in all_issues if i.severity == 'warning')
            st.metric("🟡 警告", f"{warning_count}", delta_color="inverse")
        
        st.plotly_chart(create_bar_comparison(filtered_results), use_container_width=True)
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.subheader("日粮成本汇总")
            cost_data = []
            for gid, result in filtered_results.items():
                budget = result['targets'].get('budget_cny', 0) or 0
                actual = result['actual'].get('cost_cny', 0) or 0
                deviation = ((actual - budget) / budget * 100) if budget > 0 else 0
                cost_data.append({
                    '牛群': result['group_name'],
                    '预算(元/天)': f"{budget:.2f}",
                    '实际(元/天)': f"{actual:.2f}",
                    '偏差': f"{deviation:+.1f}%"
                })
            st.table(pd.DataFrame(cost_data))
        
        with col2:
            st.subheader("钙磷比例检查")
            ca_p_data = []
            for gid, result in filtered_results.items():
                ratio = result['actual'].get('ca_p_ratio', 0) or 0
                status = "✅ 正常" if 1.5 <= ratio <= 2.5 else ("⚠️ 偏低" if ratio < 1.5 else "⚠️ 偏高")
                ca_p_data.append({
                    '牛群': result['group_name'],
                    '钙磷比': f"{ratio:.2f}:1",
                    '状态': status
                })
            st.table(pd.DataFrame(ca_p_data))
    
    with tab_groups:
        st.header("🐄 牛群营养详情")
        
        if len(selected_groups) == 0:
            st.warning("请在左侧边栏选择至少一个牛群")
        else:
            for gid in selected_groups:
                if gid not in group_results:
                    continue
                    
                result = group_results[gid]
                st.subheader(f"{result['group_name']} ({gid}) - {result['cow_count']} 头")
                
                col1, col2 = st.columns([1, 1])
                
                with col1:
                    st.plotly_chart(create_radar_chart(result['targets'], result['actual'], result['group_name']), use_container_width=True)
                
                with col2:
                    metrics_df = pd.DataFrame({
                        '指标': ['干物质(kg)', '粗蛋白(%)', '净能(Mcal/kg)', '钙(%)', '磷(%)', '钙磷比', '成本(元)'],
                        '目标值': [
                            f"{result['targets'].get('dry_matter_kg', '-')}",
                            f"{result['targets'].get('crude_protein_percent', '-')}",
                            f"{result['targets'].get('net_energy_mcal_kg', '-')}",
                            f"{result['targets'].get('calcium_percent', '-')}",
                            f"{result['targets'].get('phosphorus_percent', '-')}",
                            "1.5-2.5",
                            f"{result['targets'].get('budget_cny', '-')}"
                        ],
                        '实际值': [
                            f"{result['actual']['dry_matter_kg']:.2f}",
                            f"{result['actual']['crude_protein_percent']:.2f}",
                            f"{result['actual']['net_energy_mcal_kg']:.2f}",
                            f"{result['actual']['calcium_percent']:.2f}",
                            f"{result['actual']['phosphorus_percent']:.2f}",
                            f"{result['actual']['ca_p_ratio']:.2f}",
                            f"{result['actual']['cost_cny']:.2f}"
                        ]
                    })
                    st.dataframe(metrics_df, use_container_width=True, hide_index=True)
                
                st.subheader("📋 饲料配方明细")
                feed_details = []
                for feed in result['feeds']:
                    feed_details.append({
                        '饲料名称': feed['feed_name'],
                        '饲喂量(kg)': f"{feed['as_fed_kg']:.1f}",
                        '干物质(%)': f"{feed['dm_percent']:.1f}",
                        'DM摄入量(kg)': f"{feed['dry_matter_kg']:.2f}"
                    })
                st.dataframe(pd.DataFrame(feed_details), use_container_width=True, hide_index=True)
                st.divider()
    
    with tab_inventory:
        st.header("📦 库存消耗分析")
        
        st.plotly_chart(create_inventory_chart(inventory_consumptions), use_container_width=True)
        
        st.subheader("库存明细")
        inv_table = []
        for inv in inventory_consumptions:
            days_str = "∞" if inv.days_remaining == float('inf') else f"{int(inv.days_remaining)}天"
            status = "✅ 充足" if inv.days_remaining > 30 else ("⚠️ 紧张" if inv.days_remaining > 14 else "🔴 不足")
            inv_table.append({
                '饲料': inv.feed_name,
                '当前库存(kg)': f"{inv.current_inventory_kg:,.0f}",
                '日消耗(kg)': f"{inv.daily_consumption_kg:,.1f}",
                '可用天数': days_str,
                f'{projection_days}天缺口(kg)': f"{inv.projected_shortfall_kg:,.1f}",
                '状态': status
            })
        st.dataframe(pd.DataFrame(inv_table), use_container_width=True, hide_index=True)
        
        st.subheader("📈 饲料消耗总量 (全群)")
        total_use = []
        for inv in inventory_consumptions:
            if inv.daily_consumption_kg > 0:
                total_use.append({
                    '饲料': inv.feed_name,
                    '日消耗(kg)': f"{inv.daily_consumption_kg:,.1f}",
                    '周消耗(kg)': f"{inv.daily_consumption_kg * 7:,.0f}",
                    '月消耗(kg)': f"{inv.daily_consumption_kg * 30:,.0f}"
                })
        if total_use:
            st.dataframe(pd.DataFrame(total_use), use_container_width=True, hide_index=True)
    
    with tab_issues:
        st.header("⚠️ 问题明细")
        
        if not all_issues:
            st.success("✅ 未检测到任何问题！")
        else:
            col1, col2, col3 = st.columns(3)
            errors = [i for i in all_issues if i.severity == 'error']
            warnings = [i for i in all_issues if i.severity == 'warning']
            infos = [i for i in all_issues if i.severity == 'info']
            
            with col1:
                st.metric("🔴 错误", f"{len(errors)}")
            with col2:
                st.metric("🟡 警告", f"{len(warnings)}")
            with col3:
                st.metric("ℹ️ 提示", f"{len(infos)}")
            
            issue_type_filter = st.multiselect(
                "筛选问题类型",
                options=['expired_batch', 'expiring_soon', 'inventory_shortfall', 
                         'missing_lab_data', 'nutrient_deviation', 'ca_p_ratio_deviation',
                         'budget_exceeded', 'budget_underutilized'],
                default=[]
            )
            
            severity_filter = st.multiselect(
                "筛选严重程度",
                options=['error', 'warning', 'info'],
                default=['error', 'warning']
            )
            
            filtered_issues = [
                i for i in all_issues 
                if (not issue_type_filter or i.issue_type in issue_type_filter)
                and (not severity_filter or i.severity in severity_filter)
            ]
            
            if filtered_issues:
                for issue in filtered_issues:
                    icon = '🔴' if issue.severity == 'error' else ('🟡' if issue.severity == 'warning' else 'ℹ️')
                    
                    with st.expander(f"{icon} [{issue.severity.upper()}] {issue.issue_type}"):
                        st.write(f"**消息**: {issue.message}")
                        if issue.group_id:
                            st.write(f"**牛群**: {issue.group_id}")
                        if issue.feed_id:
                            st.write(f"**饲料**: {issue.feed_id}")
                        st.write(f"**详情**: {issue.details}")
            else:
                st.info("当前筛选条件下没有匹配的问题")
    
    with tab_export:
        st.header("📥 导出报告")
        
        metadata = {
            'version': ration_plan.get('version', '1.0'),
            'date': ration_plan.get('date', date.today()),
            'created_by': ration_plan.get('created_by', '未知')
        }
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.subheader("📄 生成 ration_report.md")
            
            markdown_report = generate_markdown_report(
                filtered_results, inventory_consumptions, all_issues, metadata
            )
            
            st.download_button(
                label="下载 Markdown 报告",
                data=markdown_report,
                file_name=f"ration_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md",
                mime="text/markdown"
            )
            
            with st.expander("预览报告"):
                st.markdown(markdown_report)
        
        with col2:
            st.subheader("📊 生成 issues.csv")
            
            issues_df = issues_to_dataframe(all_issues)
            
            csv_data = issues_df.to_csv(index=False, encoding='utf-8-sig')
            
            st.download_button(
                label="下载问题列表 CSV",
                data=csv_data,
                file_name=f"issues_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                mime="text/csv"
            )
            
            if not issues_df.empty:
                st.dataframe(issues_df, use_container_width=True)
            else:
                st.info("没有问题需要导出")
        
        st.divider()
        
        st.subheader("📦 原始数据预览")
        
        with st.expander("饲料库存数据"):
            st.dataframe(inventory_df, use_container_width=True)
        
        with st.expander("实验室检测数据"):
            st.dataframe(lab_df, use_container_width=True)
        
        with st.expander("牛群分组数据"):
            st.dataframe(herd_df, use_container_width=True)


if __name__ == "__main__":
    main()
