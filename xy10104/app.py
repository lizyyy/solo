import streamlit as st
import pandas as pd
import numpy as np
from pathlib import Path
from modules.data_quality import QualityControl
from modules.leq_calculator import LeqCalculator
from modules.report_generator import ReportGenerator

st.set_page_config(
    page_title="噪声监测等效声级计算系统",
    page_icon="🔊",
    layout="wide"
)

st.title("🔊 噪声监测等效声级计算系统")
st.markdown("### 适用于工地噪声监测的可复算Leq计算平台")

with st.sidebar:
    st.header("📂 数据输入")
    
    upload_mode = st.radio(
        "选择数据来源",
        ["上传文件", "使用示例数据"],
        index=1
    )
    
    if upload_mode == "上传文件":
        uploaded_file = st.file_uploader(
            "上传噪声监测数据",
            type=["csv", "xlsx", "xls"],
            help="支持CSV和Excel格式"
        )
        df = None
        if uploaded_file is not None:
            try:
                if uploaded_file.name.endswith('.csv'):
                    df = pd.read_csv(uploaded_file)
                else:
                    df = pd.read_excel(uploaded_file)
                st.success(f"成功读取 {len(df)} 条记录")
            except Exception as e:
                st.error(f"文件读取失败: {str(e)}")
    else:
        st.info("使用内置示例数据进行演示")
        example_path = Path(__file__).parent / "data" / "sample_data.csv"
        if example_path.exists():
            df = pd.read_csv(example_path)
        else:
            df = None
    
    st.divider()
    st.header("⚙️ 计算参数")
    
    time_col = st.selectbox(
        "时间列名称",
        ["timestamp", "time", "datetime", "日期时间", "时间"] if df is None else 
        [col for col in df.columns if any(kw in col.lower() for kw in ['time', 'date', '时刻', '时间', '日期'])],
        index=0
    )
    
    noise_col = st.selectbox(
        "噪声值列名称",
        ["noise", "value", "level", "噪声值", "声级"] if df is None else 
        [col for col in df.columns if any(kw in col.lower() for kw in ['noise', 'value', 'level', '声级', '噪声', 'db', 'laeq'])],
        index=0
    )
    
    st.divider()
    st.header("🔬 质量控制参数")
    
    min_valid = st.number_input("最小有效声级 (dB)", value=30.0, min_value=0.0, max_value=100.0)
    max_valid = st.number_input("最大有效声级 (dB)", value=120.0, min_value=80.0, max_value=200.0)
    outlier_method = st.selectbox(
        "异常值检测方法",
        ["IQR方法", "Z-score方法", "不检测"],
        index=0,
        help="选择用于检测极端值的统计方法"
    )
    time_interval = st.number_input(
        "采样间隔 (秒)", 
        value=1.0, 
        min_value=0.1, 
        max_value=3600.0,
        help="用于检测断点的预期时间间隔"
    )
    
    calculate_btn = st.button("开始计算", type="primary", disabled=df is None)

if df is not None:
    tab1, tab2, tab3, tab4 = st.tabs([
        "📊 计算结果", 
        "🔍 质量控制", 
        "📈 图表分析", 
        "📥 报告导出"
    ])
    
    qc = QualityControl(
        min_threshold=min_valid,
        max_threshold=max_valid,
        outlier_method=outlier_method,
        expected_interval=time_interval
    )
    calculator = LeqCalculator()
    reporter = ReportGenerator()
    
    if calculate_btn or st.session_state.get('_results_loaded'):
        st.session_state['_results_loaded'] = True
        
        qc_report = qc.validate(df, time_col, noise_col)
        valid_data = qc_report['valid_data']
        leq_results = calculator.calculate(valid_data, time_col, noise_col)
        
        with tab1:
            col1, col2, col3 = st.columns(3)
            
            with col1:
                st.metric(
                    "等效连续A声级 (LAeq)",
                    f"{leq_results['leq']:.2f} dB",
                    delta="主要结果"
                )
            
            with col2:
                st.metric(
                    "L10 (累计10%声级)",
                    f"{leq_results['L10']:.2f} dB"
                )
            
            with col3:
                st.metric(
                    "L90 (累计90%声级)",
                    f"{leq_results['L90']:.2f} dB"
                )
            
            st.divider()
            
            st.subheader("📋 详细统计参数")
            stats_df = pd.DataFrame({
                "参数": ["LAeq", "Lmax", "Lmin", "L10", "L50", "L90", "L95", "标准差", "有效样本数"],
                "数值 (dB)": [
                    f"{leq_results['leq']:.2f}",
                    f"{leq_results['Lmax']:.2f}",
                    f"{leq_results['Lmin']:.2f}",
                    f"{leq_results['L10']:.2f}",
                    f"{leq_results['L50']:.2f}",
                    f"{leq_results['L90']:.2f}",
                    f"{leq_results['L95']:.2f}",
                    f"{leq_results['std']:.2f}",
                    f"{int(leq_results['n_samples'])}"
                ]
            })
            st.dataframe(stats_df, width='stretch', hide_index=True)
        
        with tab2:
            st.subheader("🔍 质量控制报告")
            
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.metric("总样本数", qc_report['total_samples'])
            with col2:
                st.metric("有效样本", qc_report['valid_samples'])
            with col3:
                st.metric("异常/无效", qc_report['invalid_samples'], delta_color="inverse")
            with col4:
                st.metric("缺失值", qc_report['missing_count'], delta_color="inverse")
            
            st.divider()
            
            st.subheader("📋 详细质控规则")
            rules_df = pd.DataFrame({
                "质控项目": [
                    "缺失值检查",
                    "重复值检查",
                    "范围有效性 (30-120 dB)",
                    "单位一致性",
                    "异常值检测",
                    "时间连续性"
                ],
                "状态": [
                    "✓ 通过" if qc_report['missing_count'] == 0 else f"✗ 发现 {qc_report['missing_count']} 个",
                    "✓ 通过" if qc_report['duplicate_count'] == 0 else f"✗ 发现 {qc_report['duplicate_count']} 个",
                    "✓ 通过" if qc_report['out_of_range_count'] == 0 else f"✗ 发现 {qc_report['out_of_range_count']} 个",
                    "✓ 通过" if len(qc_report['unit_issues']) == 0 else "✗ 有问题",
                    "✓ 通过" if qc_report['outlier_count'] == 0 else f"⚠ 检测到 {qc_report['outlier_count']} 个",
                    "✓ 连续" if qc_report['break_count'] == 0 else f"⚠ 有 {qc_report['break_count']} 个断点"
                ]
            })
            st.dataframe(rules_df, width='stretch', hide_index=True)
            
            if len(qc_report['failed_records']) > 0:
                st.divider()
                st.subheader("❌ 失败样本详情（含原因）")
                
                failed_df = pd.DataFrame(qc_report['failed_records'])
                st.dataframe(
                    failed_df[['index', 'timestamp', 'original_value', 'reason']],
                    width='stretch',
                    hide_index=True
                )
                
                st.info("💡 所有失败样本均已记录在报告中，可在导出时查看完整信息")
        
        with tab3:
            st.subheader("📈 声级时间序列图")
            fig1 = reporter.plot_time_series(valid_data, time_col, noise_col, leq_results)
            st.plotly_chart(fig1, width='stretch')
            
            st.divider()
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.subheader("📊 声级分布直方图")
                fig2 = reporter.plot_histogram(valid_data, noise_col)
                st.plotly_chart(fig2, width='stretch')
            
            with col2:
                st.subheader("📉 累计百分位数曲线")
                fig3 = reporter.plot_percentiles(valid_data, noise_col, leq_results)
                st.plotly_chart(fig3, width='stretch')
            
            if len(qc_report['failed_records']) > 0:
                st.divider()
                st.subheader("🔴 异常样本分布")
                fig4 = reporter.plot_failed_records(qc_report['failed_records'])
                st.plotly_chart(fig4, width='stretch')
        
        with tab4:
            st.subheader("📥 报告导出")
            
            export_format = st.radio(
                "导出格式",
                ["Excel报告 (含所有数据)", "CSV格式 (原始数据)", "Markdown报告"],
                horizontal=True
            )
            
            report_data = {
                'summary': {
                    'leq': leq_results['leq'],
                    'Lmax': leq_results['Lmax'],
                    'Lmin': leq_results['Lmin'],
                    'L10': leq_results['L10'],
                    'L50': leq_results['L50'],
                    'L90': leq_results['L90'],
                    'L95': leq_results['L95'],
                    'std': leq_results['std'],
                    'n_samples': leq_results['n_samples']
                },
                'quality_control': {
                    'total_samples': qc_report['total_samples'],
                    'valid_samples': qc_report['valid_samples'],
                    'invalid_samples': qc_report['invalid_samples'],
                    'missing_count': qc_report['missing_count'],
                    'duplicate_count': qc_report['duplicate_count'],
                    'out_of_range_count': qc_report['out_of_range_count'],
                    'outlier_count': qc_report['outlier_count'],
                    'break_count': qc_report['break_count'],
                    'unit_issues': qc_report['unit_issues'],
                    'failed_records': qc_report['failed_records']
                },
                'valid_data': valid_data,
                'original_data': df,
                'parameters': {
                    'min_threshold': min_valid,
                    'max_threshold': max_valid,
                    'outlier_method': outlier_method,
                    'time_interval': time_interval
                }
            }
            
            if export_format == "Excel报告 (含所有数据)":
                excel_data = reporter.generate_excel_report(report_data)
                st.download_button(
                    "📊 下载完整Excel报告",
                    data=excel_data,
                    file_name=f"噪声监测Leq计算报告_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    width='stretch'
                )
                st.info("Excel报告包含：计算结果、统计参数、质控规则、失败样本（含原因）、原始数据、有效数据")
            
            elif export_format == "CSV格式 (原始数据)":
                csv_valid = valid_data.to_csv(index=False).encode('utf-8-sig')
                st.download_button(
                    "📋 下载有效数据 (CSV)",
                    data=csv_valid,
                    file_name=f"有效噪声数据_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.csv",
                    mime="text/csv",
                    width='stretch'
                )
                
                if len(qc_report['failed_records']) > 0:
                    failed_csv = pd.DataFrame(qc_report['failed_records']).to_csv(index=False).encode('utf-8-sig')
                    st.download_button(
                        "❌ 下载失败样本数据 (CSV)",
                        data=failed_csv,
                        file_name=f"失败样本记录_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.csv",
                        mime="text/csv",
                        width='stretch'
                    )
            
            else:
                markdown_report = reporter.generate_markdown_report(report_data)
                st.download_button(
                    "📝 下载Markdown报告",
                    data=markdown_report,
                    file_name=f"噪声监测Leq计算报告_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.md",
                    mime="text/markdown",
                    width='stretch'
                )
                
                st.divider()
                st.subheader("📄 报告预览")
                st.markdown(markdown_report)

else:
    st.info("👈 请在左侧边栏上传数据文件或使用示例数据")
    
    st.markdown("""
    ## 📖 系统功能说明
    
    ### 核心功能
    - **可复算的Leq计算**：基于能量平均法，所有计算步骤可追溯
    - **完善的质量控制**：缺失值、重复值、范围检查、单位一致性、异常值检测、时间连续性
    - **详细的失败记录**：每个异常样本都标记具体原因
    - **多格式报告导出**：Excel、CSV、Markdown
    
    ### 计算方法
    等效声级 Leq 计算公式：
    
    $$L_{eq} = 10 \\log_{10}\\left(\\frac{1}{N}\\sum_{i=1}^{N}10^{L_i/10}\\right)$$
    
    ### 质量控制规则
    1. **缺失值检查**：识别空值和缺失的时间/噪声值
    2. **重复值检查**：检测完全相同的记录
    3. **范围有效性**：默认30-120 dB范围内为有效值
    4. **单位一致性**：识别带单位或格式不一致的值
    5. **异常值检测**：IQR方法或Z-score方法
    6. **时间连续性**：检测采样断点
    """)
