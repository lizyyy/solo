import streamlit as st
import pandas as pd
import numpy as np
from pathlib import Path
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from modules.data_loader import DataLoader
from modules.quality_analyzer import QualityAnalyzer
from modules.data_cleaner import DataCleaner
from modules.exporter import Exporter, ReviewManager


st.set_page_config(
    page_title="OCR 质检工具",
    page_icon="📄",
    layout="wide",
    initial_sidebar_state="expanded"
)


def init_session_state():
    if 'data_loader' not in st.session_state:
        st.session_state.data_loader = DataLoader()
    if 'quality_analyzer' not in st.session_state:
        st.session_state.quality_analyzer = None
    if 'data_cleaner' not in st.session_state:
        st.session_state.data_cleaner = None
    if 'review_manager' not in st.session_state:
        st.session_state.review_manager = ReviewManager()
    if 'data_loaded' not in st.session_state:
        st.session_state.data_loaded = False
    if 'analysis_done' not in st.session_state:
        st.session_state.analysis_done = False
    if 'current_archive' not in st.session_state:
        st.session_state.current_archive = None
    if 'current_page' not in st.session_state:
        st.session_state.current_page = None
    if 'review_mode' not in st.session_state:
        st.session_state.review_mode = False


def load_sample_data():
    sample_dir = Path(__file__).parent / "sample_data"
    
    pages_file = sample_dir / "batch_pages.csv"
    tokens_file = sample_dir / "ocr_tokens.jsonl"
    rules_file = sample_dir / "template_rules.yaml"
    
    if not all([pages_file.exists(), tokens_file.exists(), rules_file.exists()]):
        st.error("示例数据文件不完整")
        return False
    
    try:
        data_loader = st.session_state.data_loader
        data_loader.load_batch_pages(str(pages_file))
        data_loader.load_ocr_tokens(str(tokens_file))
        data_loader.load_template_rules(str(rules_file))
        
        st.session_state.quality_analyzer = QualityAnalyzer(data_loader)
        st.session_state.data_cleaner = DataCleaner(data_loader)
        
        st.session_state.data_loaded = True
        st.session_state.analysis_done = False
        
        return True
    except Exception as e:
        st.error(f"加载示例数据失败: {e}")
        return False


def run_analysis():
    if not st.session_state.data_loaded:
        st.error("请先加载数据")
        return
    
    try:
        with st.spinner("正在进行质量分析..."):
            st.session_state.quality_analyzer.analyze_all()
        
        with st.spinner("正在进行脏数据清理..."):
            st.session_state.data_cleaner.clean_all()
        
        st.session_state.analysis_done = True
        st.success("分析完成!")
    except Exception as e:
        st.error(f"分析失败: {e}")


def sidebar():
    st.sidebar.title("📄 OCR 质检工具")
    st.sidebar.markdown("---")
    
    st.sidebar.header("数据加载")
    
    col1, col2 = st.sidebar.columns(2)
    with col1:
        if st.button("📦 加载示例数据", use_container_width=True):
            if load_sample_data():
                st.sidebar.success("示例数据加载成功")
    
    with col2:
        if st.session_state.data_loaded and st.button("🔄 重新加载", use_container_width=True):
            st.session_state.data_loader = DataLoader()
            st.session_state.quality_analyzer = None
            st.session_state.data_cleaner = None
            st.session_state.data_loaded = False
            st.session_state.analysis_done = False
            st.rerun()
    
    st.sidebar.markdown("### 自定义数据")
    uploaded_pages = st.sidebar.file_uploader("batch_pages.csv", type=['csv'])
    uploaded_tokens = st.sidebar.file_uploader("ocr_tokens.jsonl", type=['jsonl'])
    uploaded_rules = st.sidebar.file_uploader("template_rules.yaml", type=['yaml', 'yml'])
    
    if all([uploaded_pages, uploaded_tokens, uploaded_rules]):
        if st.sidebar.button("加载自定义数据", use_container_width=True):
            try:
                import tempfile
                import os
                
                with tempfile.TemporaryDirectory() as tmpdir:
                    pages_path = os.path.join(tmpdir, "pages.csv")
                    tokens_path = os.path.join(tmpdir, "tokens.jsonl")
                    rules_path = os.path.join(tmpdir, "rules.yaml")
                    
                    with open(pages_path, 'wb') as f:
                        f.write(uploaded_pages.getvalue())
                    with open(tokens_path, 'wb') as f:
                        f.write(uploaded_tokens.getvalue())
                    with open(rules_path, 'wb') as f:
                        f.write(uploaded_rules.getvalue())
                    
                    data_loader = st.session_state.data_loader
                    data_loader.load_batch_pages(pages_path)
                    data_loader.load_ocr_tokens(tokens_path)
                    data_loader.load_template_rules(rules_path)
                    
                    st.session_state.quality_analyzer = QualityAnalyzer(data_loader)
                    st.session_state.data_cleaner = DataCleaner(data_loader)
                    
                    st.session_state.data_loaded = True
                    st.session_state.analysis_done = False
                    st.sidebar.success("自定义数据加载成功")
            except Exception as e:
                st.sidebar.error(f"加载失败: {e}")
    
    if st.session_state.data_loaded:
        st.sidebar.markdown("---")
        st.sidebar.header("分析控制")
        
        if not st.session_state.analysis_done:
            if st.sidebar.button("▶️ 开始分析", type="primary", use_container_width=True):
                run_analysis()
                st.rerun()
        else:
            st.sidebar.success("✅ 分析已完成")
            
            if st.sidebar.button("🔄 重新分析", use_container_width=True):
                st.session_state.analysis_done = False
                run_analysis()
                st.rerun()
        
        st.sidebar.markdown("---")
        st.sidebar.header("导出结果")
        
        if st.session_state.analysis_done:
            col_export1, col_export2 = st.sidebar.columns(2)
            
            with col_export1:
                if st.button("📊 导出报告", use_container_width=True):
                    exporter = Exporter(
                        st.session_state.data_loader,
                        st.session_state.quality_analyzer,
                        st.session_state.data_cleaner,
                        st.session_state.review_manager
                    )
                    output_dir = Path("output")
                    output_dir.mkdir(exist_ok=True)
                    
                    report_path = exporter.export_review_report(str(output_dir / "review_report.md"))
                    st.sidebar.success(f"报告已导出: {report_path}")
            
            with col_export2:
                if st.button("📋 导出问题清单", use_container_width=True):
                    exporter = Exporter(
                        st.session_state.data_loader,
                        st.session_state.quality_analyzer,
                        st.session_state.data_cleaner,
                        st.session_state.review_manager
                    )
                    output_dir = Path("output")
                    output_dir.mkdir(exist_ok=True)
                    
                    csv_path = exporter.export_issues_csv(str(output_dir / "issues.csv"))
                    st.sidebar.success(f"问题清单已导出: {csv_path}")
    
    st.sidebar.markdown("---")
    st.sidebar.info("使用说明:\n1. 加载数据\n2. 运行分析\n3. 查看结果并复核\n4. 导出报告")


def dashboard_page():
    st.title("📊 质检概览")
    
    if not st.session_state.data_loaded:
        st.info("请先在侧边栏加载数据")
        return
    
    data_loader = st.session_state.data_loader
    summary = data_loader.get_summary()
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("总案卷数", summary['total_archives'])
    with col2:
        st.metric("总页数", summary['total_pages'])
    with col3:
        st.metric("总Token数", summary['total_tokens'])
    with col4:
        st.metric("关键字段数", summary['key_fields_count'])
    
    st.markdown("---")
    
    if not st.session_state.analysis_done:
        st.warning("请先运行分析以查看详细结果")
        return
    
    quality_summary = st.session_state.quality_analyzer.get_quality_summary()
    cleaning_summary = st.session_state.data_cleaner.get_cleaning_summary()
    review_stats = st.session_state.review_manager.get_statistics()
    
    st.header("质量分析结果")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.subheader("问题统计")
        st.metric("问题案卷", f"{quality_summary['archives_with_issues']}/{quality_summary['total_archives']}")
        st.metric("问题页数", f"{quality_summary['pages_with_issues']}/{quality_summary['total_pages']}")
        st.metric("需复核页数", quality_summary['review_pages_count'])
    
    with col2:
        st.subheader("置信度问题")
        st.metric("低置信度Token", quality_summary['low_confidence_tokens'])
        st.metric("极低置信度Token", quality_summary['critical_confidence_tokens'])
        st.metric("缺页总数", quality_summary['missing_pages_total'])
    
    with col3:
        st.subheader("脏数据问题")
        st.metric("总问题数", cleaning_summary['total_issues'])
        st.metric("旋转页", cleaning_summary['rotated_pages_total'])
        st.metric("坐标越界Token", cleaning_summary['out_of_bounds_tokens_total'])
    
    st.markdown("---")
    
    st.header("复核进度")
    col1, col2 = st.columns(2)
    
    with col1:
        st.metric("已复核页数", review_stats.get('total_reviewed', 0))
        if review_stats.get('by_decision'):
            st.write("复核结果分布:")
            for decision, count in review_stats['by_decision'].items():
                st.write(f"- {decision}: {count}")
    
    with col2:
        if quality_summary['review_pages_count'] > 0:
            progress = review_stats.get('total_reviewed', 0) / quality_summary['review_pages_count']
            st.progress(progress, text=f"复核进度: {progress:.0%}")
        else:
            st.info("无需要复核的页面")
    
    st.markdown("---")
    
    st.header("案卷列表")
    
    archives_data = []
    for archive_id, info in summary['archives'].items():
        archive_quality = quality_summary['archives'].get(archive_id, {})
        archive_decisions = st.session_state.review_manager.get_decisions_by_archive(archive_id)
        
        archives_data.append({
            '案卷ID': archive_id,
            '总页数': info['page_count'],
            '问题页数': archive_quality.get('pages_with_issues', 0),
            '缺页': ', '.join(map(str, archive_quality.get('missing_pages', []))) or '无',
            'Token数': info['token_count'],
            '已复核': len(archive_decisions),
            '状态': '✅ 正常' if not archive_quality.get('needs_review') else '⚠️ 需复核'
        })
    
    if archives_data:
        df = pd.DataFrame(archives_data)
        st.dataframe(df, use_container_width=True)


def archive_browser_page():
    st.title("📁 案卷浏览")
    
    if not st.session_state.data_loaded:
        st.info("请先在侧边栏加载数据")
        return
    
    data_loader = st.session_state.data_loader
    archive_ids = data_loader.get_all_archive_ids()
    
    if not archive_ids:
        st.warning("没有可用的案卷")
        return
    
    col1, col2 = st.columns([1, 3])
    
    with col1:
        st.subheader("选择案卷")
        selected_archive = st.selectbox(
            "案卷ID",
            archive_ids,
            index=0 if st.session_state.current_archive is None else 
            archive_ids.index(st.session_state.current_archive) if st.session_state.current_archive in archive_ids else 0
        )
        
        if selected_archive != st.session_state.current_archive:
            st.session_state.current_archive = selected_archive
            st.session_state.current_page = None
        
        pages = data_loader.get_archive_pages(selected_archive)
        page_nums = [p.page_num for p in pages]
        
        st.subheader("选择页码")
        
        if st.session_state.analysis_done:
            quality = st.session_state.quality_analyzer.get_quality_summary()
            archive_quality = quality['archives'].get(selected_archive, {})
            missing_pages = archive_quality.get('missing_pages', [])
            
            if missing_pages:
                st.warning(f"⚠️ 缺页: {missing_pages}")
        
        page_options = []
        for p in pages:
            if st.session_state.analysis_done:
                page_quality = st.session_state.quality_analyzer.get_page_quality(selected_archive, p.page_num)
                decision = st.session_state.review_manager.get_decision(selected_archive, p.page_num)
                
                status = ""
                if decision:
                    status = "✅" if decision.decision == "通过" else "🔄"
                elif page_quality and page_quality.needs_review:
                    status = "⚠️"
                
                page_options.append(f"第 {p.page_num} 页 {status}")
            else:
                page_options.append(f"第 {p.page_num} 页")
        
        selected_page_option = st.radio(
            "页码",
            page_options,
            index=0
        )
        
        selected_page_num = int(selected_page_option.split()[1])
    
    with col2:
        page_info = data_loader.get_page_info(selected_archive, selected_page_num)
        tokens = data_loader.get_page_tokens(selected_archive, selected_page_num)
        
        st.subheader(f"案卷 {selected_archive} - 第 {selected_page_num} 页")
        
        col_a, col_b, col_c, col_d = st.columns(4)
        with col_a:
            st.metric("页面尺寸", f"{page_info.width}x{page_info.height}")
        with col_b:
            st.metric("旋转角度", f"{page_info.rotation}°")
        with col_c:
            st.metric("Token数量", len(tokens))
        with col_d:
            if st.session_state.analysis_done:
                page_quality = st.session_state.quality_analyzer.get_page_quality(selected_archive, selected_page_num)
                if page_quality:
                    status = "⚠️ 需复核" if page_quality.needs_review else "✅ 正常"
                    st.metric("质量状态", status)
        
        st.markdown("---")
        
        if st.session_state.analysis_done:
            page_quality = st.session_state.quality_analyzer.get_page_quality(selected_archive, selected_page_num)
            
            if page_quality:
                if page_quality.needs_review:
                    st.warning(f"⚠️ 需要复核: {'; '.join(page_quality.review_reasons)}")
                
                st.subheader("字段质量分析")
                
                fields_data = []
                for field_name, fq in page_quality.fields_quality.items():
                    status_icon = "⚠️" if fq.needs_review else "✅" if fq.detected else "❓"
                    
                    fields_data.append({
                        '字段': f"{status_icon} {field_name}",
                        '检测状态': '✓ 已检测' if fq.detected else '✗ 未检测',
                        '识别文本': fq.detected_text,
                        '置信度': f"{fq.confidence:.2f}" if fq.detected else '-',
                        '版式漂移': f"{fq.layout_drift_distance:.1f}px" if fq.detected else '-',
                        '复核状态': '需复核' if fq.needs_review else '正常',
                        '问题原因': fq.review_reason if fq.needs_review else '-'
                    })
                
                if fields_data:
                    df_fields = pd.DataFrame(fields_data)
                    st.dataframe(df_fields, use_container_width=True)
        
        st.markdown("---")
        st.subheader("OCR Token 列表")
        
        if tokens:
            tokens_data = []
            for t in tokens:
                tokens_data.append({
                    'Token ID': t.token_id,
                    '文本': t.text,
                    '置信度': t.confidence,
                    '位置': f"({t.x1},{t.y1})-({t.x2},{t.y2})",
                    '行号': t.line_num
                })
            
            df_tokens = pd.DataFrame(tokens_data)
            st.dataframe(df_tokens, use_container_width=True)
        else:
            st.info("该页面没有OCR Token数据")


def review_page():
    st.title("✅ 人工复核")
    
    if not st.session_state.data_loaded:
        st.info("请先在侧边栏加载数据")
        return
    
    if not st.session_state.analysis_done:
        st.warning("请先运行分析")
        return
    
    quality_analyzer = st.session_state.quality_analyzer
    review_manager = st.session_state.review_manager
    data_loader = st.session_state.data_loader
    
    review_pages = quality_analyzer.get_review_pages()
    
    if not review_pages:
        st.success("🎉 没有需要复核的页面!")
        return
    
    st.subheader(f"需要复核的页面: {len(review_pages)} 个")
    
    reviewed_count = len(review_manager.get_all_decisions())
    remaining = len(review_pages) - reviewed_count
    
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("已复核", reviewed_count)
    with col2:
        st.metric("待复核", remaining)
    with col3:
        progress = reviewed_count / len(review_pages) if review_pages else 0
        st.progress(progress, text=f"进度: {progress:.0%}")
    
    st.markdown("---")
    
    page_options = []
    for archive_id, page_num in review_pages:
        decision = review_manager.get_decision(archive_id, page_num)
        status = "✅ 已复核" if decision else "⏳ 待复核"
        page_options.append(f"{archive_id} - 第 {page_num} 页 [{status}]")
    
    selected_option = st.selectbox("选择要复核的页面", page_options)
    
    if selected_option:
        archive_id = selected_option.split(" - ")[0]
        page_num = int(selected_option.split("第 ")[1].split(" 页")[0])
        
        page_info = data_loader.get_page_info(archive_id, page_num)
        page_quality = quality_analyzer.get_page_quality(archive_id, page_num)
        existing_decision = review_manager.get_decision(archive_id, page_num)
        tokens = data_loader.get_page_tokens(archive_id, page_num)
        
        st.markdown("---")
        st.subheader(f"复核详情: {archive_id} - 第 {page_num} 页")
        
        col_a, col_b = st.columns(2)
        
        with col_a:
            st.write("**页面信息**")
            st.write(f"- 尺寸: {page_info.width}x{page_info.height}")
            st.write(f"- 旋转: {page_info.rotation}°")
            st.write(f"- Token数: {len(tokens)}")
            
            if page_quality and page_quality.needs_review:
                st.warning(f"**问题原因**:")
                for reason in page_quality.review_reasons:
                    st.write(f"- {reason}")
        
        with col_b:
            if page_quality and page_quality.fields_quality:
                st.write("**字段问题**")
                for field_name, fq in page_quality.fields_quality.items():
                    if fq.needs_review:
                        st.error(f"❌ {field_name}: {fq.review_reason}")
                        if fq.detected_text:
                            st.write(f"  识别文本: {fq.detected_text}")
                            st.write(f"  置信度: {fq.confidence:.2f}")
        
        st.markdown("---")
        st.subheader("复核表单")
        
        if existing_decision:
            st.info(f"该页面已在 {existing_decision.reviewed_at} 由 {existing_decision.reviewed_by} 复核")
            st.write(f"- 复核结果: **{existing_decision.decision}**")
            if existing_decision.comments:
                st.write(f"- 复核意见: {existing_decision.comments}")
            if existing_decision.corrected_fields:
                st.write(f"- 修正字段:")
                for field, value in existing_decision.corrected_fields.items():
                    st.write(f"  - {field}: {value}")
        
        with st.form("review_form"):
            col1, col2 = st.columns(2)
            
            with col1:
                reviewer = st.text_input("复核人", value=existing_decision.reviewed_by if existing_decision else "")
                decision = st.selectbox(
                    "复核结果",
                    ["通过", "需修正", "重新扫描"],
                    index=0 if not existing_decision else 
                    ["通过", "需修正", "重新扫描"].index(existing_decision.decision) if existing_decision.decision in ["通过", "需修正", "重新扫描"] else 0
                )
            
            with col2:
                comments = st.text_area(
                    "复核意见",
                    value=existing_decision.comments if existing_decision else "",
                    height=100
                )
            
            st.subheader("字段修正（可选）")
            
            corrected_fields = {}
            if page_quality and page_quality.fields_quality:
                for field_name, fq in page_quality.fields_quality.items():
                    if fq.needs_review or fq.detected:
                        default_value = existing_decision.corrected_fields.get(field_name, fq.detected_text) if existing_decision else fq.detected_text
                        corrected_fields[field_name] = st.text_input(
                            f"{field_name} (原: {fq.detected_text or '未检测'})",
                            value=default_value,
                            key=f"field_{field_name}"
                        )
            
            submitted = st.form_submit_button("提交复核结果", type="primary")
            
            if submitted:
                if not reviewer.strip():
                    st.error("请输入复核人姓名")
                else:
                    actual_corrections = {}
                    for field_name, value in corrected_fields.items():
                        fq = page_quality.fields_quality.get(field_name)
                        if fq and value.strip() and value.strip() != fq.detected_text:
                            actual_corrections[field_name] = value.strip()
                    
                    review_manager.add_decision(
                        archive_id=archive_id,
                        page_num=page_num,
                        reviewed_by=reviewer.strip(),
                        decision=decision,
                        comments=comments,
                        corrected_fields=actual_corrections
                    )
                    
                    st.success(f"复核结果已保存: {decision}")
                    st.rerun()


def issues_page():
    st.title("🐛 问题清单")
    
    if not st.session_state.data_loaded:
        st.info("请先在侧边栏加载数据")
        return
    
    if not st.session_state.analysis_done:
        st.warning("请先运行分析")
        return
    
    data_cleaner = st.session_state.data_cleaner
    quality_analyzer = st.session_state.quality_analyzer
    review_manager = st.session_state.review_manager
    
    cleaning_summary = data_cleaner.get_cleaning_summary()
    quality_summary = quality_analyzer.get_quality_summary()
    
    st.subheader("问题统计")
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("总问题数", cleaning_summary['total_issues'])
    with col2:
        st.metric("缺页", cleaning_summary['missing_pages_total'])
    with col3:
        st.metric("旋转页", cleaning_summary['rotated_pages_total'])
    with col4:
        st.metric("坐标越界", cleaning_summary['out_of_bounds_tokens_total'])
    
    st.markdown("---")
    
    tab1, tab2, tab3 = st.tabs(["按类型分类", "按严重程度", "完整列表"])
    
    with tab1:
        if cleaning_summary['issue_types']:
            for issue_type, count in cleaning_summary['issue_types'].items():
                st.subheader(f"{issue_type} ({count})")
                issues = data_cleaner.get_issues_by_type(issue_type)
                
                if issues:
                    issues_data = []
                    for issue in issues:
                        decision = review_manager.get_decision(issue.archive_id, issue.page_num)
                        issues_data.append({
                            '案卷': issue.archive_id,
                            '页码': issue.page_num,
                            '严重程度': issue.severity,
                            '描述': issue.description,
                            '建议修复': issue.suggested_fix or '-',
                            '已复核': '是' if decision else '否',
                            '复核结果': decision.decision if decision else '-'
                        })
                    
                    df = pd.DataFrame(issues_data)
                    st.dataframe(df, use_container_width=True)
    
    with tab2:
        severities = ['critical', 'high', 'medium', 'low']
        severity_names = {'critical': '严重', 'high': '高', 'medium': '中', 'low': '低'}
        
        for sev in severities:
            issues = data_cleaner.get_issues_by_severity(sev)
            if issues:
                st.subheader(f"{severity_names.get(sev, sev)} 级别 ({len(issues)})")
                
                issues_data = []
                for issue in issues:
                    decision = review_manager.get_decision(issue.archive_id, issue.page_num)
                    issues_data.append({
                        '案卷': issue.archive_id,
                        '页码': issue.page_num,
                        '问题类型': issue.issue_type,
                        '描述': issue.description,
                        '已复核': '是' if decision else '否',
                        '复核结果': decision.decision if decision else '-'
                    })
                
                df = pd.DataFrame(issues_data)
                st.dataframe(df, use_container_width=True)
    
    with tab3:
        all_issues = data_cleaner.all_issues
        
        if all_issues:
            issues_data = []
            for issue in all_issues:
                decision = review_manager.get_decision(issue.archive_id, issue.page_num)
                issues_data.append({
                    '案卷': issue.archive_id,
                    '页码': issue.page_num,
                    '问题类型': issue.issue_type,
                    '严重程度': issue.severity,
                    '描述': issue.description,
                    'Token ID': issue.token_id or '-',
                    '建议修复': issue.suggested_fix or '-',
                    '已复核': '是' if decision else '否',
                    '复核结果': decision.decision if decision else '-'
                })
            
            df = pd.DataFrame(issues_data)
            st.dataframe(df, use_container_width=True)
            
            csv = df.to_csv(index=False).encode('utf-8-sig')
            st.download_button(
                "📥 下载问题清单 (CSV)",
                csv,
                "issues.csv",
                "text/csv",
                key='download-csv'
            )
        else:
            st.success("没有发现问题!")


def main():
    init_session_state()
    sidebar()
    
    if not st.session_state.data_loaded:
        st.title("📄 OCR 质检工具")
        st.markdown("""
        ## 欢迎使用档案数字化 OCR 质检工具
        
        这是一个用于档案数字化后 OCR 质量检查的本地工具，主要功能包括:
        
        ### 📊 核心功能
        - **数据导入**: 支持导入 batch_pages.csv、ocr_tokens.jsonl、template_rules.yaml
        - **质量分析**: 自动分析关键字段（姓名、日期、编号、印章等）的置信度和版式漂移
        - **脏数据处理**: 自动检测旋转页、缺页、OCR token 坐标越界等问题
        - **人工复核**: 提供直观的复核界面，支持保存复核结果
        - **结果导出**: 导出 review_report.md 和 issues.csv
        
        ### 🚀 快速开始
        1. 点击侧边栏的 **"加载示例数据"** 按钮
        2. 点击 **"开始分析"** 运行质量检查
        3. 在各页面查看分析结果
        4. 在 **"人工复核"** 页面处理需要复核的页面
        5. 导出报告和问题清单
        
        ### 📁 示例数据说明
        示例数据包含:
        - 3 个案卷 (AJ2024_001, AJ2024_002, AJ2024_003)
        - 包含旋转页、缺页、低置信度 token、坐标越界等多种测试场景
        """)
        return
    
    page = st.sidebar.radio(
        "导航",
        ["📊 概览", "📁 案卷浏览", "✅ 人工复核", "🐛 问题清单"],
        index=0
    )
    
    if page == "📊 概览":
        dashboard_page()
    elif page == "📁 案卷浏览":
        archive_browser_page()
    elif page == "✅ 人工复核":
        review_page()
    elif page == "🐛 问题清单":
        issues_page()


if __name__ == "__main__":
    main()
