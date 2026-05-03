import streamlit as st
import pandas as pd
import numpy as np
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Any
import io
import os
import sys

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 导入模块
from parsers.complaints import parse_complaints_csv
from parsers.decibel_meter import parse_decibel_jsonl
from parsers.enforcement_records import parse_enforcement_csv
from parsers.construction_permits import parse_construction_permits_csv

from metrics.calculator import (
    calculate_exceedance_duration,
    calculate_duplicate_complaints,
    calculate_response_delay
)

from rules.engine import (
    RuleEngine,
    detect_illegal_construction,
    ViolationType
)

from visualization.charts import (
    plot_noise_trend,
    plot_complaint_distribution,
    plot_response_time_distribution,
    plot_violation_summary,
    plot_hourly_heatmap
)

from storage.state_store import (
    StateStore,
    VerificationStatus
)

from export.exporter import (
    export_markdown_report,
    export_issue_csv,
    export_complaints_csv
)

from sample_data.generator import generate_sample_data


# 页面配置
st.set_page_config(
    page_title="社区夜间噪声治理复盘工具",
    page_icon="🔊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# 初始化会话状态
def init_session_state():
    """初始化会话状态"""
    if 'data' not in st.session_state:
        st.session_state.data = {
            'complaints': pd.DataFrame(),
            'decibel': pd.DataFrame(),
            'enforcement': pd.DataFrame(),
            'permits': pd.DataFrame()
        }
    
    if 'analysis_results' not in st.session_state:
        st.session_state.analysis_results = {
            'exceedance': {},
            'duplicates': {},
            'response': {},
            'violations': [],
            'violations_df': pd.DataFrame()
        }
    
    if 'state_store' not in st.session_state:
        st.session_state.state_store = StateStore(storage_dir="./data")
    
    if 'filters' not in st.session_state:
        st.session_state.filters = {
            'selected_communities': [],
            'selected_noise_sources': [],
            'date_range': None,
            'show_verified': True
        }
    
    if 'data_loaded' not in st.session_state:
        st.session_state.data_loaded = False
    
    if 'use_sample_data' not in st.session_state:
        st.session_state.use_sample_data = False


init_session_state()


# 侧边栏
def render_sidebar():
    """渲染侧边栏"""
    st.sidebar.title("🔊 噪声治理工具")
    
    # 数据导入选项
    st.sidebar.header("📁 数据导入")
    
    # 示例数据按钮
    use_sample = st.sidebar.button("📊 加载示例数据", use_container_width=True)
    if use_sample:
        with st.spinner("生成示例数据..."):
            sample_data = generate_sample_data(days=7)
            st.session_state.data = sample_data
            st.session_state.use_sample_data = True
            st.session_state.data_loaded = True
            run_analysis()
            st.success("示例数据已加载！")
    
    st.sidebar.markdown("---")
    
    # 文件上传
    st.sidebar.subheader("上传数据文件")
    
    # 投诉数据
    complaints_file = st.sidebar.file_uploader(
        "投诉热线 CSV",
        type=['csv'],
        key="complaints_upload"
    )
    if complaints_file:
        try:
            df = parse_complaints_csv(complaints_file)
            st.session_state.data['complaints'] = df
            st.sidebar.success(f"✓ 加载 {len(df)} 条投诉记录")
        except Exception as e:
            st.sidebar.error(f"加载失败: {e}")
    
    # 分贝仪数据
    decibel_file = st.sidebar.file_uploader(
        "分贝仪 JSONL",
        type=['jsonl', 'json'],
        key="decibel_upload"
    )
    if decibel_file:
        try:
            # 保存临时文件用于解析
            with open("temp_decibel.jsonl", "wb") as f:
                f.write(decibel_file.getvalue())
            df = parse_decibel_jsonl("temp_decibel.jsonl")
            os.remove("temp_decibel.jsonl")
            st.session_state.data['decibel'] = df
            st.sidebar.success(f"✓ 加载 {len(df)} 条分贝记录")
        except Exception as e:
            st.sidebar.error(f"加载失败: {e}")
    
    # 执法记录
    enforcement_file = st.sidebar.file_uploader(
        "执法记录 CSV",
        type=['csv'],
        key="enforcement_upload"
    )
    if enforcement_file:
        try:
            df = parse_enforcement_csv(enforcement_file)
            st.session_state.data['enforcement'] = df
            st.sidebar.success(f"✓ 加载 {len(df)} 条执法记录")
        except Exception as e:
            st.sidebar.error(f"加载失败: {e}")
    
    # 施工许可
    permits_file = st.sidebar.file_uploader(
        "施工许可 CSV",
        type=['csv'],
        key="permits_upload"
    )
    if permits_file:
        try:
            df = parse_construction_permits_csv(permits_file)
            st.session_state.data['permits'] = df
            st.sidebar.success(f"✓ 加载 {len(df)} 条施工许可")
        except Exception as e:
            st.sidebar.error(f"加载失败: {e}")
    
    # 分析按钮
    if st.sidebar.button("🔍 开始分析", use_container_width=True, type="primary"):
        with st.spinner("分析数据中..."):
            st.session_state.data_loaded = True
            run_analysis()
            st.success("分析完成！")
    
    st.sidebar.markdown("---")
    
    # 筛选器
    if st.session_state.data_loaded:
        render_filters()


def render_filters():
    """渲染筛选器"""
    st.sidebar.header("🔍 筛选条件")
    
    data = st.session_state.data
    
    # 小区筛选
    if not data['complaints'].empty and 'community' in data['complaints'].columns:
        communities = sorted(data['complaints']['community'].dropna().unique().tolist())
        selected = st.sidebar.multiselect(
            "选择小区",
            options=communities,
            default=st.session_state.filters['selected_communities']
        )
        st.session_state.filters['selected_communities'] = selected
    
    # 噪声源筛选
    if not data['complaints'].empty and 'noise_source' in data['complaints'].columns:
        sources = sorted(data['complaints']['noise_source'].dropna().unique().tolist())
        selected = st.sidebar.multiselect(
            "选择噪声源",
            options=sources,
            default=st.session_state.filters['selected_noise_sources']
        )
        st.session_state.filters['selected_noise_sources'] = selected
    
    # 日期范围
    if not data['complaints'].empty and 'date' in data['complaints'].columns:
        dates = data['complaints']['date'].dropna().unique()
        if len(dates) > 0:
            min_date = min(dates)
            max_date = max(dates)
            date_range = st.sidebar.date_input(
                "日期范围",
                value=(min_date, max_date),
                min_value=min_date,
                max_value=max_date
            )
            st.session_state.filters['date_range'] = date_range
    
    # 显示已核实
    st.session_state.filters['show_verified'] = st.sidebar.checkbox(
        "显示已核实记录",
        value=True
    )


def run_analysis():
    """运行数据分析"""
    data = st.session_state.data
    results = st.session_state.analysis_results
    
    # 1. 计算超标时长
    if not data['decibel'].empty:
        results['exceedance'] = calculate_exceedance_duration(data['decibel'])
    
    # 2. 检测重复投诉
    if not data['complaints'].empty:
        data['complaints'], dup_stats = calculate_duplicate_complaints(
            data['complaints'],
            time_window_minutes=60
        )
        results['duplicates'] = dup_stats
    
    # 3. 计算响应延迟
    if not data['complaints'].empty and not data['enforcement'].empty:
        response_df, resp_stats = calculate_response_delay(
            data['complaints'],
            data['enforcement']
        )
        results['response'] = resp_stats
        results['response_df'] = response_df
    
    # 4. 检测违规
    rule_engine = RuleEngine()
    rule_results = rule_engine.execute_all(
        data['complaints'],
        data['decibel'],
        data['enforcement'],
        data['permits']
    )
    
    results['violations'] = rule_results.get('violations', [])
    results['violations_df'] = rule_results.get('violations_df', pd.DataFrame())
    results['rule_stats'] = rule_results.get('statistics', {})


def get_filtered_data() -> Dict[str, pd.DataFrame]:
    """获取筛选后的数据"""
    filters = st.session_state.filters
    data = st.session_state.data
    
    filtered = {
        'complaints': data['complaints'].copy(),
        'decibel': data['decibel'].copy(),
        'enforcement': data['enforcement'].copy(),
        'permits': data['permits'].copy()
    }
    
    # 小区筛选
    if filters['selected_communities'] and not filtered['complaints'].empty:
        if 'community' in filtered['complaints'].columns:
            filtered['complaints'] = filtered['complaints'][
                filtered['complaints']['community'].isin(filters['selected_communities'])
            ]
        
        if 'community' in filtered['enforcement'].columns:
            filtered['enforcement'] = filtered['enforcement'][
                filtered['enforcement']['community'].isin(filters['selected_communities'])
            ]
    
    # 噪声源筛选
    if filters['selected_noise_sources'] and not filtered['complaints'].empty:
        if 'noise_source' in filtered['complaints'].columns:
            filtered['complaints'] = filtered['complaints'][
                filtered['complaints']['noise_source'].isin(filters['selected_noise_sources'])
            ]
    
    # 日期范围筛选
    if filters['date_range'] and len(filters['date_range']) == 2:
        start_date, end_date = filters['date_range']
        
        for key in ['complaints', 'decibel', 'enforcement']:
            if not filtered[key].empty and 'date' in filtered[key].columns:
                filtered[key] = filtered[key][
                    (filtered[key]['date'] >= start_date) &
                    (filtered[key]['date'] <= end_date)
                ]
    
    return filtered


def render_overview():
    """渲染概览页面"""
    st.header("📊 数据概览")
    
    if not st.session_state.data_loaded:
        st.info("请先加载数据或点击\"加载示例数据\"按钮开始使用")
        return
    
    data = get_filtered_data()
    results = st.session_state.analysis_results
    
    # 统计卡片
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        total_complaints = len(data['complaints'])
        night_complaints = data['complaints'][data['complaints']['is_night']].shape[0] if not data['complaints'].empty and 'is_night' in data['complaints'].columns else 0
        st.metric(
            "投诉总数",
            f"{total_complaints} 起",
            f"夜间 {night_complaints} 起"
        )
    
    with col2:
        total_decibel = len(data['decibel'])
        exceed_count = results['exceedance'].get('exceedance_count', 0)
        st.metric(
            "分贝测量",
            f"{total_decibel} 次",
            f"超标 {exceed_count} 次"
        )
    
    with col3:
        total_enforcement = len(data['enforcement'])
        resp_rate = results['response'].get('response_rate', 0) * 100
        st.metric(
            "执法记录",
            f"{total_enforcement} 次",
            f"响应率 {resp_rate:.1f}%"
        )
    
    with col4:
        total_violations = len(results['violations'])
        high_sev = sum(1 for v in results['violations'] if v.severity == 'high')
        st.metric(
            "检测违规",
            f"{total_violations} 起",
            f"高优先级 {high_sev} 起"
        )
    
    st.markdown("---")
    
    # 图表区域
    tab1, tab2, tab3 = st.tabs(["噪声趋势", "投诉分布", "违规摘要"])
    
    with tab1:
        if not data['decibel'].empty:
            fig = plot_noise_trend(data['decibel'])
            if fig:
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info("无法生成噪声趋势图")
        else:
            st.info("暂无分贝仪数据")
    
    with tab2:
        col_a, col_b = st.columns(2)
        
        with col_a:
            if not data['complaints'].empty:
                fig = plot_complaint_distribution(data['complaints'], 'community')
                if fig:
                    st.plotly_chart(fig, use_container_width=True)
            else:
                st.info("暂无投诉数据")
        
        with col_b:
            if not data['complaints'].empty:
                fig = plot_complaint_distribution(data['complaints'], 'hour')
                if fig:
                    st.plotly_chart(fig, use_container_width=True)
    
    with tab3:
        if not results['violations_df'].empty:
            fig = plot_violation_summary(results['violations_df'])
            if fig:
                st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("暂无违规数据")


def render_complaints_analysis():
    """渲染投诉分析页面"""
    st.header("📋 投诉分析")
    
    if not st.session_state.data_loaded:
        st.info("请先加载数据")
        return
    
    data = get_filtered_data()
    results = st.session_state.analysis_results
    
    if data['complaints'].empty:
        st.info("暂无投诉数据")
        return
    
    # 重复投诉统计
    dup_stats = results.get('duplicates', {})
    if dup_stats:
        st.subheader("🔄 重复投诉检测")
        
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("总投诉数", dup_stats.get('total_complaints', 0))
        with col2:
            st.metric("重复组数", dup_stats.get('duplicate_groups', 0))
        with col3:
            st.metric("重复投诉数", dup_stats.get('duplicate_complaints', 0))
        with col4:
            st.metric("去重后有效", dup_stats.get('unique_complaints', 0))
        
        # 显示重复投诉组
        if dup_stats.get('groups'):
            with st.expander("查看重复投诉详情"):
                for group in dup_stats['groups']:
                    st.write(f"**组 {group['group_id']}**: {group['community']} - {group['noise_source']}")
                    st.write(f"投诉数: {group['size']}, 时间: {group['complaint_time']}")
                    st.write(f"投诉ID: {', '.join(map(str, group['complaints_in_group']))}")
                    st.markdown("---")
    
    st.markdown("---")
    
    # 投诉列表
    st.subheader("📋 投诉详情列表")
    
    # 合并核实状态
    state_store = st.session_state.state_store
    display_df = state_store.merge_with_dataframe(
        data['complaints'], 'complaint_id', 'complaint'
    )
    
    # 过滤已核实
    if not st.session_state.filters['show_verified'] and 'verification_status' in display_df.columns:
        display_df = display_df[
            display_df['verification_status'] != VerificationStatus.VERIFIED.value
        ]
    
    # 选择要显示的列
    display_cols = [
        'complaint_id', 'community', 'noise_source', 
        'complaint_time', 'description', 'is_night',
        'is_duplicate', 'verification_status'
    ]
    available_cols = [c for c in display_cols if c in display_df.columns]
    
    if available_cols:
        st.dataframe(
            display_df[available_cols],
            use_container_width=True,
            hide_index=True
        )
    
    # 核实功能
    st.markdown("---")
    st.subheader("✅ 人工核实")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        complaint_id = st.text_input("投诉ID", placeholder="输入投诉ID")
    
    with col2:
        status = st.selectbox(
            "核实状态",
            options=[s.value for s in VerificationStatus]
        )
    
    with col3:
        verified_by = st.text_input("核实人", placeholder="可选")
    
    notes = st.text_area("备注", placeholder="添加核实备注...")
    
    if st.button("保存核实状态", use_container_width=True):
        if complaint_id:
            state_store.set_verification_status(
                record_id=complaint_id,
                record_type='complaint',
                status=VerificationStatus(status),
                verified_by=verified_by if verified_by else None,
                notes=notes if notes else None
            )
            st.success(f"投诉 {complaint_id} 状态已更新为: {status}")
        else:
            st.error("请输入投诉ID")


def render_noise_analysis():
    """渲染噪声分析页面"""
    st.header("🔊 噪声监测分析")
    
    if not st.session_state.data_loaded:
        st.info("请先加载数据")
        return
    
    data = get_filtered_data()
    results = st.session_state.analysis_results
    
    if data['decibel'].empty:
        st.info("暂无分贝仪数据")
        return
    
    # 超标统计
    exc_stats = results.get('exceedance', {})
    if exc_stats:
        st.subheader("📈 超标统计")
        
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric(
                "总测量次数",
                exc_stats.get('total_measurements', 0)
            )
        with col2:
            st.metric(
                "超标次数",
                f"{exc_stats.get('exceedance_count', 0)}",
                f"{exc_stats.get('exceedance_ratio', 0)*100:.1f}%"
            )
        with col3:
            night_exc_ratio = exc_stats.get('night_exceedance_ratio', 0) * 100
            day_exc_ratio = exc_stats.get('day_exceedance_ratio', 0) * 100
            st.metric(
                "夜间/昼间超标率",
                f"{night_exc_ratio:.1f}% / {day_exc_ratio:.1f}%"
            )
    
    st.markdown("---")
    
    # 图表
    tab1, tab2 = st.tabs(["噪声趋势", "时段热力图"])
    
    with tab1:
        fig = plot_noise_trend(data['decibel'])
        if fig:
            st.plotly_chart(fig, use_container_width=True)
    
    with tab2:
        fig = plot_hourly_heatmap(data['decibel'])
        if fig:
            st.plotly_chart(fig, use_container_width=True)
    
    st.markdown("---")
    
    # 按地点统计
    st.subheader("📍 按地点统计")
    
    by_location = exc_stats.get('by_location', {})
    if by_location:
        loc_data = []
        for loc, stats in by_location.items():
            loc_data.append({
                '地点': loc,
                '测量次数': stats['count'],
                '超标次数': stats['exceedance_count'],
                '超标率': f"{stats['exceedance_ratio']*100:.1f}%",
                '平均分贝': f"{stats['avg_db']:.1f}",
                '最大分贝': f"{stats['max_db']:.1f}"
            })
        
        if loc_data:
            st.dataframe(
                pd.DataFrame(loc_data),
                use_container_width=True,
                hide_index=True
            )


def render_enforcement_analysis():
    """渲染执法分析页面"""
    st.header("🚔 执法响应分析")
    
    if not st.session_state.data_loaded:
        st.info("请先加载数据")
        return
    
    data = get_filtered_data()
    results = st.session_state.analysis_results
    
    if data['enforcement'].empty:
        st.info("暂无执法记录数据")
        return
    
    # 响应时间统计
    resp_stats = results.get('response', {})
    if resp_stats:
        st.subheader("⏱️ 响应时间统计")
        
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("总投诉数", resp_stats.get('total_complaints', 0))
        with col2:
            st.metric("已响应", resp_stats.get('responded_complaints', 0))
        with col3:
            st.metric("未响应", resp_stats.get('unresponded_complaints', 0))
        with col4:
            avg_resp = resp_stats.get('avg_response_time_minutes', 0)
            st.metric("平均响应时间", f"{avg_resp:.1f} 分钟")
    
    st.markdown("---")
    
    # 响应时间分布图
    if 'response_df' in results and not results['response_df'].empty:
        st.subheader("📊 响应时间分布")
        fig = plot_response_time_distribution(results['response_df'])
        if fig:
            st.plotly_chart(fig, use_container_width=True)
    
    st.markdown("---")
    
    # 执法记录列表
    st.subheader("📋 执法记录详情")
    
    display_cols = [
        'enforcement_id', 'complaint_id', 'community',
        'arrival_time', 'departure_time', 'noise_source',
        'action_taken', 'result', 'officer_name'
    ]
    available_cols = [c for c in display_cols if c in data['enforcement'].columns]
    
    if available_cols:
        st.dataframe(
            data['enforcement'][available_cols],
            use_container_width=True,
            hide_index=True
        )


def render_violations_analysis():
    """渲染违规分析页面"""
    st.header("⚠️ 违规检测分析")
    
    if not st.session_state.data_loaded:
        st.info("请先加载数据")
        return
    
    results = st.session_state.analysis_results
    state_store = st.session_state.state_store
    
    violations = results.get('violations', [])
    violations_df = results.get('violations_df', pd.DataFrame())
    
    if not violations and violations_df.empty:
        st.info("暂无检测到的违规记录")
        return
    
    # 统计
    rule_stats = results.get('rule_stats', {})
    if rule_stats:
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("总违规数", rule_stats.get('total_violations', 0))
        with col2:
            st.metric("高优先级", rule_stats.get('high_severity', 0))
        with col3:
            st.metric("中优先级", rule_stats.get('medium_severity', 0))
        with col4:
            st.metric("已核实", rule_stats.get('verified_count', 0))
    
    st.markdown("---")
    
    # 违规列表
    st.subheader("📋 违规详情")
    
    # 合并核实状态
    if not violations_df.empty:
        display_df = state_store.merge_with_dataframe(
            violations_df, 'violation_id', 'violation'
        )
        
        # 过滤已核实
        if not st.session_state.filters['show_verified'] and 'verification_status' in display_df.columns:
            display_df = display_df[
                display_df['verification_status'] != VerificationStatus.VERIFIED.value
            ]
        
        # 按严重程度排序
        severity_order = {'high': 0, 'medium': 1, 'low': 2}
        if 'severity' in display_df.columns:
            display_df = display_df.sort_values(
                by='severity',
                key=lambda x: x.map(severity_order)
            )
        
        st.dataframe(
            display_df,
            use_container_width=True,
            hide_index=True
        )
    
    st.markdown("---")
    
    # 核实功能
    st.subheader("✅ 违规核实")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        violation_id = st.text_input("违规ID", placeholder="输入违规ID", key="v_id")
    
    with col2:
        v_status = st.selectbox(
            "核实状态",
            options=[s.value for s in VerificationStatus],
            key="v_status"
        )
    
    with col3:
        v_verified_by = st.text_input("核实人", placeholder="可选", key="v_by")
    
    v_notes = st.text_area("备注", placeholder="添加核实备注...", key="v_notes")
    
    if st.button("保存核实状态", use_container_width=True, key="v_save"):
        if violation_id:
            state_store.set_verification_status(
                record_id=violation_id,
                record_type='violation',
                status=VerificationStatus(v_status),
                verified_by=v_verified_by if v_verified_by else None,
                notes=v_notes if v_notes else None
            )
            st.success(f"违规 {violation_id} 状态已更新为: {v_status}")
        else:
            st.error("请输入违规ID")


def render_export():
    """渲染导出页面"""
    st.header("📤 数据导出")
    
    if not st.session_state.data_loaded:
        st.info("请先加载数据")
        return
    
    data = get_filtered_data()
    results = st.session_state.analysis_results
    state_store = st.session_state.state_store
    
    # 统计信息
    stats = {
        'exceedance': results.get('exceedance', {}),
        'duplicates': results.get('duplicates', {}),
        'response': results.get('response', {})
    }
    
    tab1, tab2, tab3 = st.tabs(["周报导出", "问题清单", "投诉清单"])
    
    with tab1:
        st.subheader("📋 Markdown 周报")
        
        report_date = st.date_input("报告日期", value=date.today())
        report_title = st.text_input("报告标题", value="社区夜间噪声治理周报")
        include_details = st.checkbox("包含详细列表", value=True)
        
        if st.button("生成周报", use_container_width=True):
            with st.spinner("生成报告中..."):
                markdown = export_markdown_report(
                    complaints_df=data['complaints'],
                    decibel_df=data['decibel'],
                    enforcement_df=data['enforcement'],
                    permits_df=data['permits'],
                    violations_df=results.get('violations_df', pd.DataFrame()),
                    stats=stats,
                    report_date=report_date,
                    title=report_title,
                    include_details=include_details
                )
                
                st.markdown(markdown)
                
                # 下载按钮
                st.download_button(
                    label="📥 下载 Markdown 文件",
                    data=markdown,
                    file_name=f"noise_report_{report_date.strftime('%Y%m%d')}.md",
                    mime="text/markdown",
                    use_container_width=True
                )
    
    with tab2:
        st.subheader("⚠️ 问题清单 CSV")
        
        include_verified = st.checkbox("包含已核实记录", value=True, key="iv_csv")
        
        if st.button("生成问题清单", use_container_width=True, key="gen_issue"):
            csv_content = export_issue_csv(
                violations_df=results.get('violations_df', pd.DataFrame()),
                complaints_df=data['complaints'],
                state_store=state_store,
                include_verified=include_verified
            )
            
            if csv_content:
                st.success("问题清单已生成！")
                st.download_button(
                    label="📥 下载 CSV 文件",
                    data=csv_content,
                    file_name=f"issue_list_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                    mime="text/csv",
                    use_container_width=True
                )
            else:
                st.info("暂无问题数据")
    
    with tab3:
        st.subheader("📋 投诉清单 CSV")
        
        include_duplicates = st.checkbox("包含重复投诉", value=True)
        
        if st.button("生成投诉清单", use_container_width=True, key="gen_complaint"):
            csv_content = export_complaints_csv(
                complaints_df=data['complaints'],
                include_duplicates=include_duplicates,
                state_store=state_store
            )
            
            if csv_content:
                st.success("投诉清单已生成！")
                st.download_button(
                    label="📥 下载 CSV 文件",
                    data=csv_content,
                    file_name=f"complaint_list_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                    mime="text/csv",
                    use_container_width=True
                )
            else:
                st.info("暂无投诉数据")


def render_permits_analysis():
    """渲染施工许可页面"""
    st.header("🏗️ 施工许可管理")
    
    if not st.session_state.data_loaded:
        st.info("请先加载数据")
        return
    
    data = get_filtered_data()
    
    if data['permits'].empty:
        st.info("暂无施工许可数据")
        return
    
    # 统计
    st.subheader("📊 许可统计")
    
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("总许可数", len(data['permits']))
    with col2:
        night_permits = data['permits'][data['permits']['permitted_night_work']].shape[0] if 'permitted_night_work' in data['permits'].columns else 0
        st.metric("含夜间施工", night_permits)
    with col3:
        if 'permit_end_date' in data['permits'].columns:
            today = date.today()
            active = data['permits'][data['permits']['permit_end_date'] >= today].shape[0]
            st.metric("有效许可", active)
    
    st.markdown("---")
    
    # 许可列表
    st.subheader("📋 许可详情")
    
    display_cols = [
        'permit_id', 'project_name', 'location', 'community',
        'permit_start_date', 'permit_end_date',
        'permitted_start_time', 'permitted_end_time',
        'permitted_night_work', 'contractor'
    ]
    available_cols = [c for c in display_cols if c in data['permits'].columns]
    
    if available_cols:
        display_df = data['permits'][available_cols].copy()
        
        # 转换布尔值
        if 'permitted_night_work' in display_df.columns:
            display_df['permitted_night_work'] = display_df['permitted_night_work'].map(
                lambda x: '是' if x else '否'
            )
        
        st.dataframe(
            display_df,
            use_container_width=True,
            hide_index=True
        )


def main():
    """主函数"""
    render_sidebar()
    
    # 主页面
    st.title("🔊 社区夜间噪声治理复盘工具")
    st.markdown("---")
    
    # 导航标签
    if st.session_state.data_loaded:
        tabs = st.tabs([
            "📊 数据概览",
            "📋 投诉分析",
            "🔊 噪声监测",
            "🚔 执法响应",
            "⚠️ 违规检测",
            "🏗️ 施工许可",
            "📤 数据导出"
        ])
        
        with tabs[0]:
            render_overview()
        with tabs[1]:
            render_complaints_analysis()
        with tabs[2]:
            render_noise_analysis()
        with tabs[3]:
            render_enforcement_analysis()
        with tabs[4]:
            render_violations_analysis()
        with tabs[5]:
            render_permits_analysis()
        with tabs[6]:
            render_export()
    else:
        # 欢迎页面
        st.markdown("""
        ## 👋 欢迎使用社区夜间噪声治理复盘工具
        
        本工具帮助您：
        
        ### 核心功能
        - **数据导入**: 支持导入投诉热线CSV、分贝仪JSONL、执法记录和施工许可表
        - **统一时间轴**: 将所有数据统一到时间轴上进行分析
        - **智能检测**: 自动检测重复投诉、噪声超标、疑似违规施工
        - **响应分析**: 分析执法响应时间和效率
        - **人工核实**: 支持对检测结果进行人工标记核实
        - **数据导出**: 导出Markdown周报和CSV问题清单
        
        ### 快速开始
        1. 点击左侧 **\"加载示例数据\"** 按钮体验功能
        2. 或上传您的真实数据文件：
           - 投诉热线 CSV
           - 分贝仪 JSONL
           - 执法记录 CSV
           - 施工许可 CSV
        3. 点击 **\"开始分析\"** 按钮
        4. 在各标签页查看分析结果
        """)
        
        st.markdown("---")
        
        st.info("💡 提示：点击左侧\"加载示例数据\"按钮可快速体验所有功能")


if __name__ == "__main__":
    main()
