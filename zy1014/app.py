import streamlit as st
import pandas as pd
import numpy as np
import os
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))

from src.csv_parser import CSVParser, ColumnMapper, ColumnMapping
from src.data_validator import DataValidator, ValidationResult, ValidationIssue, ValidationSeverity
from src.metrics import RoRCalculator, RoastMetrics, RoastPhase
from src.visualizer import RoastVisualizer
from src.storage import LocalStorage, RoastNote, DEFECT_TAGS, POSITIVE_TAGS
from src.exporter import ReportExporter


st.set_page_config(
    page_title="咖啡烘焙曲线复盘看板",
    page_icon="☕",
    layout="wide",
    initial_sidebar_state="expanded"
)


SAMPLE_DATA_DIR = Path(__file__).parent / "sample_data"


@st.cache_resource
def get_storage():
    return LocalStorage()


@st.cache_resource
def get_parser():
    return CSVParser()


@st.cache_resource
def get_validator():
    return DataValidator()


@st.cache_resource
def get_ror_calculator():
    return RoRCalculator()


@st.cache_resource
def get_visualizer():
    return RoastVisualizer()


@st.cache_resource
def get_exporter():
    return ReportExporter()


def load_sample_data():
    samples = []
    if SAMPLE_DATA_DIR.exists():
        for csv_file in sorted(SAMPLE_DATA_DIR.glob("*.csv")):
            samples.append({
                "name": csv_file.stem,
                "path": csv_file
            })
    return samples


def process_csv_file(uploaded_file, filename: str = ""):
    parser = get_parser()
    
    try:
        df, metadata, auto_mapping = parser.parse_uploaded_file(uploaded_file)
    except Exception as e:
        st.error(f"CSV 解析失败: {e}")
        return None, None, None, None
    
    ror_calc = get_ror_calculator()
    df_with_ror = ror_calc.calculate_ror(df)
    
    events = ror_calc.extract_events(df_with_ror)
    metrics = ror_calc.calculate_metrics(df_with_ror, events)
    
    validator = get_validator()
    validation = validator.validate(df_with_ror, metadata)
    
    return df_with_ror, metrics, events, validation


def format_seconds(seconds: float) -> str:
    if seconds is None:
        return "N/A"
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes}:{secs:02d}"


def main():
    st.title("☕ 咖啡烘焙曲线复盘看板")
    st.markdown("### 家用烘焙数据分析与可视化工具")
    
    if 'loaded_roasts' not in st.session_state:
        st.session_state.loaded_roasts = {}
    if 'selected_roast' not in st.session_state:
        st.session_state.selected_roast = None
    if 'comparison_roasts' not in st.session_state:
        st.session_state.comparison_roasts = []
    
    storage = get_storage()
    visualizer = get_visualizer()
    exporter = get_exporter()
    
    with st.sidebar:
        st.header("📁 数据导入")
        
        sample_files = load_sample_data()
        if sample_files:
            st.subheader("示例数据")
            selected_sample = st.selectbox(
                "选择示例文件",
                ["-- 请选择 --"] + [s["name"] for s in sample_files],
                key="sample_selector"
            )
            
            if selected_sample != "-- 请选择 --":
                sample_info = next((s for s in sample_files if s["name"] == selected_sample), None)
                if sample_info:
                    if st.button("📥 加载示例数据", use_container_width=True):
                        with open(sample_info["path"], 'rb') as f:
                            df, metrics, events, validation = process_csv_file(f, sample_info["name"])
                            if df is not None:
                                roast_id = LocalStorage.generate_roast_id(df, sample_info["name"])
                                st.session_state.loaded_roasts[roast_id] = {
                                    "name": sample_info["name"],
                                    "df": df,
                                    "metrics": metrics,
                                    "events": events,
                                    "validation": validation,
                                    "loaded_at": datetime.now().isoformat()
                                }
                                st.session_state.selected_roast = roast_id
                                st.success(f"已加载: {sample_info['name']}")
        
        st.markdown("---")
        st.subheader("上传 CSV")
        
        uploaded_files = st.file_uploader(
            "选择烘焙数据 CSV 文件",
            type=['csv'],
            accept_multiple_files=True,
            key="file_uploader"
        )
        
        if uploaded_files:
            for uploaded_file in uploaded_files:
                if st.button(f"处理: {uploaded_file.name}", key=f"process_{uploaded_file.name}"):
                    df, metrics, events, validation = process_csv_file(uploaded_file, uploaded_file.name)
                    if df is not None:
                        roast_id = LocalStorage.generate_roast_id(df, uploaded_file.name)
                        st.session_state.loaded_roasts[roast_id] = {
                            "name": uploaded_file.name,
                            "df": df,
                            "metrics": metrics,
                            "events": events,
                            "validation": validation,
                            "loaded_at": datetime.now().isoformat()
                        }
                        st.session_state.selected_roast = roast_id
                        st.success(f"已加载: {uploaded_file.name}")
        
        st.markdown("---")
        
        if st.session_state.loaded_roasts:
            st.subheader("已加载烘焙")
            roast_list = list(st.session_state.loaded_roasts.items())
            
            selected = st.radio(
                "选择查看",
                [rid for rid, _ in roast_list],
                format_func=lambda rid: st.session_state.loaded_roasts[rid]["name"],
                key="roast_selector"
            )
            if selected:
                st.session_state.selected_roast = selected
            
            st.subheader("对比分析")
            comparison_selections = st.multiselect(
                "选择要对比的烘焙 (至少2个)",
                [rid for rid, _ in roast_list],
                format_func=lambda rid: st.session_state.loaded_roasts[rid]["name"],
                key="comparison_selector"
            )
            st.session_state.comparison_roasts = comparison_selections
    
    if st.session_state.selected_roast and st.session_state.selected_roast in st.session_state.loaded_roasts:
        roast_data = st.session_state.loaded_roasts[st.session_state.selected_roast]
        roast_name = roast_data["name"]
        df = roast_data["df"]
        metrics = roast_data["metrics"]
        events = roast_data["events"]
        validation = roast_data["validation"]
        
        roast_id = st.session_state.selected_roast
        note = storage.get_or_create_note(roast_id, roast_name)
        
        tab1, tab2, tab3, tab4, tab5 = st.tabs([
            "📊 曲线与指标", 
            "⚠️ 数据校验", 
            "📝 复盘笔记", 
            "📤 导出报告",
            "📈 对比分析"
        ])
        
        with tab1:
            col1, col2 = st.columns([2, 1])
            
            with col1:
                st.subheader(f"烘焙曲线: {roast_name}")
                
                fig = visualizer.create_roast_curve(
                    df, events,
                    title=f"{roast_name} - 烘焙曲线"
                )
                st.plotly_chart(fig, use_container_width=True)
            
            with col2:
                st.subheader("关键指标")
                
                with st.container(border=True):
                    st.metric("总时长", format_seconds(metrics.total_duration))
                    st.metric("下豆温度", f"{metrics.drop_temperature:.1f}°C" if metrics.drop_temperature else "N/A")
                    st.metric("发展时间", format_seconds(metrics.development_time))
                    st.metric("发展比例", f"{metrics.development_ratio:.1f}%" if metrics.development_ratio else "N/A")
                
                st.subheader("RoR 统计")
                with st.container(border=True):
                    st.metric("平均 RoR", f"{metrics.avg_ror_overall:.1f}°C/min" if metrics.avg_ror_overall else "N/A")
                    st.metric("最小 RoR", f"{metrics.min_ror:.1f}°C/min" if metrics.min_ror else "N/A")
                    st.metric("最大 RoR", f"{metrics.max_ror:.1f}°C/min" if metrics.max_ror else "N/A")
            
            st.markdown("---")
            st.subheader("阶段分析")
            
            if metrics.phases:
                phase_cols = st.columns(len(metrics.phases))
                
                for idx, (phase_key, phase) in enumerate(metrics.phases.items()):
                    with phase_cols[idx]:
                        with st.container(border=True):
                            st.markdown(f"**{phase.name}**")
                            st.markdown(f"耗时: `{format_seconds(phase.duration)}`")
                            st.markdown(f"温升: `{phase.temp_change:+.1f}°C`" if phase.temp_change else "温升: `N/A`")
            else:
                st.info("未检测到完整的阶段事件数据。请确保 CSV 中包含事件标记（回温点、黄点、一爆、下豆等）。")
            
            st.markdown("---")
            st.subheader("事件时间线")
            
            if events:
                event_df = pd.DataFrame([
                    {
                        "事件": visualizer.EVENT_MARKERS.get(k, {}).get('name', k),
                        "时间": format_seconds(v.get('time')),
                        "温度": f"{v['temp']:.1f}°C" if v.get('temp') is not None else "N/A"
                    }
                    for k, v in events.items()
                ])
                st.table(event_df)
            else:
                st.info("未检测到事件标记。")
        
        with tab2:
            st.subheader("数据校验结果")
            
            if validation.has_errors():
                st.error("❌ 检测到错误")
                errors = validation.get_issues_by_severity(ValidationSeverity.ERROR)
                for issue in errors:
                    with st.container(border=True):
                        st.markdown(f"**{issue.category}**")
                        st.markdown(f"- {issue.message}")
                        if issue.row_index is not None:
                            st.markdown(f"- 行号: {issue.row_index}")
            
            if validation.has_warnings():
                st.warning("⚠️ 检测到警告")
                warnings = validation.get_issues_by_severity(ValidationSeverity.WARNING)
                for issue in warnings:
                    with st.container(border=True):
                        st.markdown(f"**{issue.category}**")
                        st.markdown(f"- {issue.message}")
                        if issue.row_index is not None:
                            st.markdown(f"- 行号: {issue.row_index}")
            
            info_issues = validation.get_issues_by_severity(ValidationSeverity.INFO)
            if info_issues:
                st.info("ℹ️ 提示信息")
                for issue in info_issues:
                    st.markdown(f"- {issue.message}")
            
            if not validation.has_errors() and not validation.has_warnings():
                st.success("✅ 数据校验通过，未发现问题")
            
            st.markdown("---")
            st.subheader("原始数据预览")
            st.dataframe(df.head(50), use_container_width=True)
        
        with tab3:
            st.subheader("复盘笔记")
            
            col1, col2 = st.columns(2)
            
            with col1:
                with st.form("note_form"):
                    st.markdown("### 基本信息")
                    
                    note.roast_name = st.text_input("烘焙名称", value=note.roast_name)
                    note.roast_date = st.date_input(
                        "烘焙日期",
                        value=datetime.strptime(note.roast_date, "%Y-%m-%d").date() if note.roast_date else datetime.now().date()
                    ).strftime("%Y-%m-%d")
                    
                    note.bean_origin = st.text_input("产地", value=note.bean_origin)
                    note.bean_variety = st.text_input("品种", value=note.bean_variety)
                    note.bean_process = st.selectbox(
                        "处理法",
                        ["", "水洗", "日晒", "蜜处理", "厌氧发酵", "其他"],
                        index=0 if not note.bean_process else 
                        ["", "水洗", "日晒", "蜜处理", "厌氧发酵", "其他"].index(note.bean_process) if note.bean_process in ["", "水洗", "日晒", "蜜处理", "厌氧发酵", "其他"] else 0
                    )
                    note.roast_level = st.selectbox(
                        "烘焙度",
                        ["", "极浅", "浅", "中", "中深", "深", "极深"],
                        index=0 if not note.roast_level else
                        ["", "极浅", "浅", "中", "中深", "深", "极深"].index(note.roast_level) if note.roast_level in ["", "极浅", "浅", "中", "中深", "深", "极深"] else 0
                    )
                    
                    st.markdown("### 重量信息")
                    weight_col1, weight_col2 = st.columns(2)
                    with weight_col1:
                        green_weight_input = st.number_input(
                            "生豆重 (g)",
                            min_value=0.0,
                            value=float(note.green_weight) if note.green_weight else 0.0,
                            step=1.0
                        )
                        note.green_weight = green_weight_input if green_weight_input > 0 else None
                    with weight_col2:
                        roasted_weight_input = st.number_input(
                            "熟豆重 (g)",
                            min_value=0.0,
                            value=float(note.roasted_weight) if note.roasted_weight else 0.0,
                            step=1.0
                        )
                        note.roasted_weight = roasted_weight_input if roasted_weight_input > 0 else None
                    
                    if note.green_weight and note.roasted_weight:
                        weight_loss = (note.green_weight - note.roasted_weight) / note.green_weight * 100
                        st.info(f"失重: {weight_loss:.1f}%")
                    
                    st.markdown("### 缺陷标签")
                    note.defects = st.multiselect(
                        "选择存在的缺陷",
                        DEFECT_TAGS,
                        default=note.defects if note.defects else []
                    )
                    
                    st.markdown("### 优点标签")
                    note.positive_aspects = st.multiselect(
                        "选择表现好的方面",
                        POSITIVE_TAGS,
                        default=note.positive_aspects if note.positive_aspects else []
                    )
                    
                    st.markdown("### 自定义标签")
                    custom_tags_input = st.text_input(
                        "添加自定义标签 (逗号分隔)",
                        value=",".join(note.custom_tags) if note.custom_tags else ""
                    )
                    if custom_tags_input:
                        note.custom_tags = [t.strip() for t in custom_tags_input.split(",") if t.strip()]
                    
                    st.markdown("### 备注")
                    note.overall_notes = st.text_area(
                        "总体评价",
                        value=note.overall_notes,
                        height=100
                    )
                    note.flavor_notes = st.text_area(
                        "风味描述",
                        value=note.flavor_notes,
                        height=100
                    )
                    
                    submit_button = st.form_submit_button("💾 保存笔记", use_container_width=True)
                    if submit_button:
                        storage.save_note(note)
                        st.success("笔记已保存！")
            
            with col2:
                st.markdown("### 笔记预览")
                
                if note.defects:
                    st.markdown("**缺陷标签:**")
                    for defect in note.defects:
                        st.markdown(f"- 🔴 {defect}")
                
                if note.positive_aspects:
                    st.markdown("**优点标签:**")
                    for positive in note.positive_aspects:
                        st.markdown(f"- 🟢 {positive}")
                
                if note.custom_tags:
                    st.markdown("**自定义标签:**")
                    for tag in note.custom_tags:
                        st.markdown(f"- 🏷️ {tag}")
                
                if note.overall_notes:
                    st.markdown("**总体评价:**")
                    st.markdown(note.overall_notes)
                
                if note.flavor_notes:
                    st.markdown("**风味描述:**")
                    st.markdown(note.flavor_notes)
                
                st.markdown(f"---")
                st.markdown(f"*创建时间: {note.created_at}*")
                st.markdown(f"*最后更新: {note.updated_at}*")
        
        with tab4:
            st.subheader("导出复盘报告")
            
            export_format = st.radio("选择导出格式", ["HTML", "Markdown"], horizontal=True)
            
            col1, col2 = st.columns(2)
            
            with col1:
                include_chart = st.checkbox("包含曲线图", value=True)
                include_notes = st.checkbox("包含复盘笔记", value=True)
                include_validation = st.checkbox("包含数据校验结果", value=True)
            
            with col2:
                report_title = st.text_input("报告标题", value=f"{roast_name} - 烘焙复盘报告")
            
            validation_issues = []
            if include_validation:
                for issue in validation.issues:
                    validation_issues.append({
                        "category": issue.category,
                        "message": issue.message,
                        "severity": issue.severity.value
                    })
            
            if st.button("📄 生成报告预览", use_container_width=True):
                fig = None
                if include_chart:
                    fig = visualizer.create_roast_curve(df, events, title=report_title)
                
                note_to_include = note if include_notes else None
                
                if export_format == "HTML":
                    html_content = exporter.export_html(
                        df=df,
                        metrics=metrics,
                        note=note_to_include,
                        validation_issues=validation_issues if validation_issues else None,
                        fig=fig,
                        title=report_title
                    )
                    
                    st.components.v1.html(html_content, height=800, scrolling=True)
                    
                    st.download_button(
                        label="📥 下载 HTML 报告",
                        data=html_content,
                        file_name=f"{roast_name.replace('.csv', '')}_report.html",
                        mime="text/html",
                        use_container_width=True
                    )
                else:
                    md_content = exporter.export_markdown(
                        df=df,
                        metrics=metrics,
                        note=note_to_include,
                        validation_issues=validation_issues if validation_issues else None,
                        title=report_title
                    )
                    
                    st.markdown(md_content)
                    
                    st.download_button(
                        label="📥 下载 Markdown 报告",
                        data=md_content,
                        file_name=f"{roast_name.replace('.csv', '')}_report.md",
                        mime="text/markdown",
                        use_container_width=True
                    )
        
        with tab5:
            st.subheader("多锅对比分析")
            
            if len(st.session_state.comparison_roasts) >= 2:
                comparison_data = []
                for rid in st.session_state.comparison_roasts:
                    if rid in st.session_state.loaded_roasts:
                        roast = st.session_state.loaded_roasts[rid]
                        comparison_data.append({
                            "name": roast["name"],
                            "df": roast["df"],
                            "metrics": roast["metrics"],
                            "events": roast["events"]
                        })
                
                st.markdown("### 曲线对比")
                comparison_fig = visualizer.create_comparison_plot(
                    comparison_data,
                    title="多锅曲线对比"
                )
                st.plotly_chart(comparison_fig, use_container_width=True)
                
                st.markdown("### 阶段对比")
                phase_fig = visualizer.create_phase_comparison_chart(
                    comparison_data,
                    title="关键阶段耗时与温升对比"
                )
                st.plotly_chart(phase_fig, use_container_width=True)
                
                st.markdown("### RoR 抖动分析")
                variability_fig = visualizer.create_ror_variability_chart(
                    comparison_data,
                    title="RoR 稳定性对比"
                )
                st.plotly_chart(variability_fig, use_container_width=True)
                
                st.markdown("### 指标对比表")
                
                comparison_metrics = []
                for data in comparison_data:
                    m = data["metrics"]
                    comparison_metrics.append({
                        "烘焙": data["name"],
                        "总时长": format_seconds(m.total_duration),
                        "下豆温度": f"{m.drop_temperature:.1f}°C" if m.drop_temperature else "N/A",
                        "发展时间": format_seconds(m.development_time),
                        "发展比例": f"{m.development_ratio:.1f}%" if m.development_ratio else "N/A",
                        "平均 RoR": f"{m.avg_ror_overall:.1f}°C/min" if m.avg_ror_overall else "N/A"
                    })
                
                comparison_df = pd.DataFrame(comparison_metrics)
                st.table(comparison_df)
                
                if st.button("📄 导出对比报告", use_container_width=True):
                    comparison_md = exporter.export_comparison_markdown(
                        comparison_data,
                        title="多锅烘焙对比报告"
                    )
                    
                    st.download_button(
                        label="📥 下载对比报告 (Markdown)",
                        data=comparison_md,
                        file_name="roast_comparison_report.md",
                        mime="text/markdown",
                        use_container_width=True
                    )
            else:
                st.info("请在左侧边栏选择至少 2 个烘焙进行对比分析。")
                if st.session_state.loaded_roasts:
                    st.markdown("**已加载的烘焙:**")
                    for rid, roast in st.session_state.loaded_roasts.items():
                        st.markdown(f"- {roast['name']}")
    
    else:
        st.info("👈 请在左侧边栏上传 CSV 文件或选择示例数据开始分析。")
        
        st.markdown("---")
        st.subheader("📖 使用说明")
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            with st.container(border=True):
                st.markdown("### 1. 数据导入")
                st.markdown("""
                - 上传烘豆机导出的 CSV 文件
                - 或选择内置示例数据测试
                - 支持中英文列名自动识别
                """)
        
        with col2:
            with st.container(border=True):
                st.markdown("### 2. 数据分析")
                st.markdown("""
                - 自动绘制温度曲线和 RoR
                - 智能识别事件点（回温点、一爆等）
                - 计算阶段耗时和发展比例
                - 检测 RoR 异常和数据问题
                """)
        
        with col3:
            with st.container(border=True):
                st.markdown("### 3. 复盘与导出")
                st.markdown("""
                - 记录复盘笔记和缺陷标签
                - 支持多锅对比分析
                - 导出 HTML 或 Markdown 报告
                - 笔记自动保存在本地
                """)
        
        st.markdown("---")
        st.subheader("📋 支持的 CSV 列名")
        
        st.markdown("""
        | 数据类型 | 可识别的列名 |
        |----------|--------------|
        | 时间 | time, 时间, 时刻, timestamp, elapsed |
        | 豆温 | bean_temp, 豆温, BT, 豆温_实际 |
        | 环境温 | env_temp, 环境温, ET, 排气温 |
        | 火力 | power, 火力, heat, 火 |
        | 风门 | damper, 风门, 风, air |
        | 事件 | event, 事件, 备注, note, mark |
        """)
        
        st.markdown("---")
        st.subheader("🏷️ 事件标记关键词")
        
        st.markdown("""
        - **入豆**: 入豆, charge, 入锅, 开始
        - **回温点**: 回温点, 回温, TP, Turning Point
        - **黄点**: 黄点, 转黄, Yellow
        - **一爆开始**: 一爆开始, 一爆, 1C, First Crack
        - **一爆结束**: 一爆结束, 1C 结束
        - **二爆开始**: 二爆开始, 二爆, 2C, Second Crack
        - **下豆**: 下豆, 出锅, Drop, 结束
        """)


if __name__ == "__main__":
    main()
