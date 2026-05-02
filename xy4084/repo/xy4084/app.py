import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
import io

from config import config, RiskThresholds, ensure_directories
from src.data import DataImporter, DataCleaner
from src.metrics import MetricsCalculator
from src.risk import RiskEngine
from src.export import ReportExporter
from src.sample import SampleDataGenerator
from src.models import RiskLevel


st.set_page_config(
    page_title=config.APP_NAME,
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="expanded",
)


def init_session_state():
    if "importer" not in st.session_state:
        st.session_state.importer = DataImporter()
    if "cleaner" not in st.session_state:
        st.session_state.cleaner = DataCleaner()
    if "calculator" not in st.session_state:
        st.session_state.calculator = MetricsCalculator()
    if "risk_engine" not in st.session_state:
        st.session_state.risk_engine = RiskEngine()
    if "exporter" not in st.session_state:
        st.session_state.exporter = ReportExporter()
    if "sample_generator" not in st.session_state:
        st.session_state.sample_generator = SampleDataGenerator()
    
    if "imported_data" not in st.session_state:
        st.session_state.imported_data = {}
    if "cleaned_data" not in st.session_state:
        st.session_state.cleaned_data = {}
    if "merged_data" not in st.session_state:
        st.session_state.merged_data = None
    if "metrics_dict" not in st.session_state:
        st.session_state.metrics_dict = {}
    if "risk_assessments" not in st.session_state:
        st.session_state.risk_assessments = {}
    
    if "period_start" not in st.session_state:
        st.session_state.period_start = date.today() - timedelta(days=28)
    if "period_end" not in st.session_state:
        st.session_state.period_end = date.today()
    
    if "thresholds" not in st.session_state:
        st.session_state.thresholds = RiskThresholds()
    
    if "data_loaded" not in st.session_state:
        st.session_state.data_loaded = False
    if "metrics_calculated" not in st.session_state:
        st.session_state.metrics_calculated = False
    if "risk_assessed" not in st.session_state:
        st.session_state.risk_assessed = False


def render_sidebar():
    with st.sidebar:
        st.title(f"🏥 {config.APP_NAME}")
        st.markdown(f"版本: {config.VERSION}")
        st.markdown("---")
        
        page = st.radio(
            "功能导航",
            [
                "📥 数据导入",
                "📊 数据概览",
                "⚠️ 风险分析",
                "👤 单人详情",
                "⚙️ 阈值配置",
                "📄 报告导出",
                "🧪 示例数据",
            ],
        )
        
        st.markdown("---")
        st.markdown("### 周期选择")
        
        col1, col2 = st.columns(2)
        with col1:
            st.session_state.period_start = st.date_input(
                "开始日期",
                value=st.session_state.period_start,
            )
        with col2:
            st.session_state.period_end = st.date_input(
                "结束日期",
                value=st.session_state.period_end,
            )
        
        if st.button("重新计算指标"):
            if st.session_state.data_loaded and st.session_state.merged_data:
                calculate_metrics_and_risk()
                st.success("指标已重新计算！")
        
        return page


def render_data_import():
    st.header("📥 数据导入")
    
    tab1, tab2 = st.tabs(["上传文件", "导入状态"])
    
    with tab1:
        st.markdown("### 支持的CSV文件类型")
        col1, col2, col3 = st.columns(3)
        with col1:
            st.info("**患者信息**\n- patient_id, name, age, gender")
        with col2:
            st.info("**训练记录**\n- patient_id, date, training_program, is_completed")
        with col3:
            st.info("**疼痛评分**\n- patient_id, date, pain_location, pain_score")
        
        col4, col5 = st.columns(2)
        with col4:
            st.info("**动作完成度**\n- patient_id, date, movement_name, completion_score")
        with col5:
            st.info("**随访记录**\n- patient_id, date, therapist_name, follow_up_type, summary")
        
        st.markdown("---")
        st.markdown("### 上传CSV文件")
        
        uploaded_files = st.file_uploader(
            "选择一个或多个CSV文件",
            type=["csv"],
            accept_multiple_files=True,
        )
        
        if uploaded_files:
            if st.button("开始导入", type="primary"):
                with st.spinner("正在导入数据..."):
                    importer = st.session_state.importer
                    importer.clear_imported_data()
                    
                    success_count = 0
                    fail_count = 0
                    import_results = []
                    
                    for uploaded_file in uploaded_files:
                        try:
                            file_bytes = uploaded_file.read()
                            df = importer.load_csv_from_bytes(file_bytes, uploaded_file.name)
                            
                            data_type = importer.detect_data_type(df)
                            
                            if data_type:
                                is_valid, errors = importer.validate_columns(df, data_type)
                                if is_valid:
                                    if data_type in importer.imported_data:
                                        existing_df = importer.imported_data[data_type]
                                        merged_df = pd.concat([existing_df, df], ignore_index=True).drop_duplicates()
                                        importer.imported_data[data_type] = merged_df
                                    else:
                                        importer.imported_data[data_type] = df
                                    
                                    import_results.append({
                                        "文件名": uploaded_file.name,
                                        "类型": data_type,
                                        "状态": "成功",
                                        "记录数": len(df),
                                    })
                                    success_count += 1
                                else:
                                    import_results.append({
                                        "文件名": uploaded_file.name,
                                        "类型": data_type,
                                        "状态": "失败",
                                        "错误": "; ".join(errors),
                                    })
                                    fail_count += 1
                            else:
                                import_results.append({
                                    "文件名": uploaded_file.name,
                                    "类型": "未知",
                                    "状态": "失败",
                                    "错误": "无法识别数据类型",
                                })
                                fail_count += 1
                                
                        except Exception as e:
                            import_results.append({
                                "文件名": uploaded_file.name,
                                "类型": "未知",
                                "状态": "失败",
                                "错误": str(e),
                            })
                            fail_count += 1
                    
                    st.session_state.imported_data = importer.get_all_dataframes()
                    
                    if success_count > 0:
                        with st.spinner("正在清洗和合并数据..."):
                            cleaner = st.session_state.cleaner
                            cleaned_data = cleaner.clean_all_dataframes(st.session_state.imported_data)
                            st.session_state.cleaned_data = cleaned_data
                            
                            patient_df = cleaned_data.get("patient")
                            training_df = cleaned_data.get("training")
                            pain_df = cleaned_data.get("pain")
                            movement_df = cleaned_data.get("movement")
                            followup_df = cleaned_data.get("followup")
                            
                            if patient_df is not None:
                                merged_data = cleaner.merge_patient_data(
                                    patient_df=patient_df,
                                    training_df=training_df,
                                    pain_df=pain_df,
                                    movement_df=movement_df,
                                    followup_df=followup_df,
                                )
                                st.session_state.merged_data = merged_data
                                st.session_state.data_loaded = True
                                
                                calculate_metrics_and_risk()
                    
                    st.success(f"导入完成: 成功 {success_count} 个文件，失败 {fail_count} 个")
                    
                    if import_results:
                        st.dataframe(pd.DataFrame(import_results), use_container_width=True)
                    
                    warnings = cleaner.get_warnings()
                    if warnings:
                        st.markdown("### 清洗警告")
                        for warning in warnings:
                            st.warning(f"[{warning['type']}] {warning['message']}")
    
    with tab2:
        if st.session_state.imported_data:
            st.markdown("### 已导入的数据")
            
            for data_type, df in st.session_state.imported_data.items():
                with st.expander(f"{data_type} ({len(df)} 条记录)"):
                    st.dataframe(df.head(10), use_container_width=True)
            
            if st.button("清除所有数据", type="secondary"):
                st.session_state.importer.clear_imported_data()
                st.session_state.cleaner.clear_cleaned_data()
                st.session_state.imported_data = {}
                st.session_state.cleaned_data = {}
                st.session_state.merged_data = None
                st.session_state.metrics_dict = {}
                st.session_state.risk_assessments = {}
                st.session_state.data_loaded = False
                st.session_state.metrics_calculated = False
                st.session_state.risk_assessed = False
                st.success("数据已清除")
                st.rerun()
        else:
            st.info("暂无已导入的数据")


def calculate_metrics_and_risk():
    if not st.session_state.merged_data:
        return
    
    calculator = st.session_state.calculator
    risk_engine = st.session_state.risk_engine
    
    metrics_dict = calculator.calculate_batch_metrics(
        data_by_patient=st.session_state.merged_data["data_by_patient"],
        period_start=st.session_state.period_start,
        period_end=st.session_state.period_end,
    )
    st.session_state.metrics_dict = metrics_dict
    st.session_state.metrics_calculated = True
    
    risk_assessments = risk_engine.assess_batch_risk(metrics_dict)
    st.session_state.risk_assessments = risk_assessments
    st.session_state.risk_assessed = True


def render_data_overview():
    st.header("📊 数据概览")
    
    if not st.session_state.data_loaded:
        st.warning("请先导入数据")
        return
    
    merged_data = st.session_state.merged_data
    if not merged_data:
        st.warning("数据未正确加载")
        return
    
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("患者总数", merged_data.get("patient_count", 0))
    with col2:
        st.metric("训练记录数", len(merged_data.get("training_records", [])))
    with col3:
        st.metric("疼痛记录数", len(merged_data.get("pain_records", [])))
    with col4:
        st.metric("动作记录数", len(merged_data.get("movement_records", [])))
    
    st.markdown("---")
    
    tab1, tab2, tab3 = st.tabs(["依从性趋势", "疼痛趋势", "训练分布"])
    
    with tab1:
        if st.session_state.metrics_calculated and st.session_state.metrics_dict:
            compliance_data = []
            for patient_id, metrics in st.session_state.metrics_dict.items():
                patient_info = merged_data["data_by_patient"].get(patient_id, {}).get("patient_info", {})
                compliance_data.append({
                    "患者": patient_info.get("name", patient_id),
                    "患者ID": patient_id,
                    "依从率": metrics.compliance_rate * 100,
                    "完成天数": metrics.completed_training_days,
                    "总天数": metrics.total_training_days,
                })
            
            if compliance_data:
                df = pd.DataFrame(compliance_data)
                df = df.sort_values("依从率", ascending=False)
                
                fig = px.bar(
                    df,
                    x="患者",
                    y="依从率",
                    color="依从率",
                    color_continuous_scale="RdYlGn",
                    title="患者依从率排名",
                    labels={"依从率": "依从率 (%)"},
                )
                fig.update_layout(yaxis_range=[0, 100])
                st.plotly_chart(fig, use_container_width=True)
                
                st.markdown("### 依从率详情")
                st.dataframe(
                    df[["患者", "患者ID", "依从率", "完成天数", "总天数"]].style.format({
                        "依从率": "{:.1f}%"
                    }),
                    use_container_width=True,
                )
    
    with tab2:
        pain_records = merged_data.get("pain_records", [])
        if pain_records:
            pain_df = pd.DataFrame(pain_records)
            if "date" in pain_df.columns and "pain_score" in pain_df.columns:
                pain_df["date"] = pd.to_datetime(pain_df["date"])
                pain_df = pain_df.sort_values("date")
                
                fig = px.line(
                    pain_df,
                    x="date",
                    y="pain_score",
                    color="patient_id",
                    title="疼痛评分时间趋势",
                    labels={"pain_score": "疼痛评分", "date": "日期"},
                )
                fig.update_layout(yaxis_range=[0, 10])
                st.plotly_chart(fig, use_container_width=True)
                
                st.markdown("### 平均疼痛评分统计")
                avg_pain = pain_df.groupby("patient_id")["pain_score"].agg(["mean", "min", "max", "count"]).reset_index()
                avg_pain.columns = ["患者ID", "平均疼痛", "最低疼痛", "最高疼痛", "记录数"]
                st.dataframe(avg_pain, use_container_width=True)
    
    with tab3:
        training_records = merged_data.get("training_records", [])
        if training_records:
            training_df = pd.DataFrame(training_records)
            if "training_program" in training_df.columns:
                program_counts = training_df["training_program"].value_counts().reset_index()
                program_counts.columns = ["训练项目", "次数"]
                
                fig = px.pie(
                    program_counts,
                    values="次数",
                    names="训练项目",
                    title="训练项目分布",
                )
                st.plotly_chart(fig, use_container_width=True)


def render_risk_analysis():
    st.header("⚠️ 风险分析")
    
    if not st.session_state.risk_assessed:
        st.warning("请先导入数据并计算指标")
        return
    
    risk_assessments = st.session_state.risk_assessments
    if not risk_assessments:
        st.warning("暂无风险评估数据")
        return
    
    merged_data = st.session_state.merged_data
    
    risk_engine = st.session_state.risk_engine
    distribution = risk_engine.get_risk_level_distribution(risk_assessments)
    
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("低风险", distribution.get("low", 0))
    with col2:
        st.metric("中风险", distribution.get("medium", 0))
    with col3:
        st.metric("高风险", distribution.get("high", 0))
    with col4:
        st.metric("危急风险", distribution.get("critical", 0))
    
    st.markdown("---")
    
    fig_colors = [
        config.RISK_COLORS.get("low", "#2ca02c"),
        config.RISK_COLORS.get("medium", "#ff7f0e"),
        config.RISK_COLORS.get("high", "#dc3912"),
        config.RISK_COLORS.get("critical", "#9400d3"),
    ]
    
    fig_labels = ["低风险", "中风险", "高风险", "危急风险"]
    fig_values = [
        distribution.get("low", 0),
        distribution.get("medium", 0),
        distribution.get("high", 0),
        distribution.get("critical", 0),
    ]
    
    fig = go.Figure(data=[go.Pie(
        labels=fig_labels,
        values=fig_values,
        marker_colors=fig_colors,
        hole=0.4,
    )])
    fig.update_layout(title="风险等级分布")
    st.plotly_chart(fig, use_container_width=True)
    
    st.markdown("---")
    st.markdown("### 风险患者名单")
    
    risk_list = []
    for patient_id, assessment in risk_assessments.items():
        patient_info = merged_data["data_by_patient"].get(patient_id, {}).get("patient_info", {})
        
        risk_level_name = config.RISK_LEVELS.get(assessment.risk_level.value, "未知")
        
        main_factors = []
        if assessment.compliance_risk:
            main_factors.append("依从性")
        if assessment.pain_risk:
            main_factors.append("疼痛")
        if assessment.movement_risk:
            main_factors.append("动作稳定性")
        if assessment.missed_days_risk:
            main_factors.append("缺训")
        
        risk_list.append({
            "患者": patient_info.get("name", patient_id),
            "患者ID": patient_id,
            "风险等级": risk_level_name,
            "综合评分": assessment.overall_score,
            "主要风险因素": "、".join(main_factors) if main_factors else "无",
            "随访优先级": assessment.follow_up_priority,
            "需要紧急随访": "是" if assessment.needs_urgent_follow_up else "否",
        })
    
    if risk_list:
        risk_df = pd.DataFrame(risk_list)
        
        risk_order = ["危急风险", "高风险", "中风险", "低风险"]
        risk_df["风险等级_排序"] = risk_df["风险等级"].map({r: i for i, r in enumerate(risk_order)})
        risk_df = risk_df.sort_values(["风险等级_排序", "综合评分"], ascending=[True, False])
        risk_df = risk_df.drop(columns=["风险等级_排序"])
        
        def highlight_risk(val):
            if val == "危急风险":
                return "background-color: #9400d3; color: white"
            elif val == "高风险":
                return "background-color: #dc3912; color: white"
            elif val == "中风险":
                return "background-color: #ff7f0e; color: white"
            else:
                return "background-color: #2ca02c; color: white"
        
        styled_df = risk_df.style.applymap(highlight_risk, subset=["风险等级"])
        st.dataframe(styled_df, use_container_width=True)
        
        st.markdown("---")
        st.markdown("### 高风险和危急风险患者详情")
        
        high_risk_patients = risk_df[risk_df["风险等级"].isin(["高风险", "危急风险"])]
        if len(high_risk_patients) > 0:
            for _, row in high_risk_patients.iterrows():
                patient_id = row["患者ID"]
                assessment = risk_assessments.get(patient_id)
                
                if assessment:
                    with st.expander(f"⚠️ {row['患者']} ({patient_id}) - {row['风险等级']}"):
                        col1, col2 = st.columns(2)
                        with col1:
                            st.markdown("**风险详情**")
                            if assessment.compliance_risk:
                                st.warning(f"依从性风险: {assessment.compliance_risk_details}")
                            if assessment.pain_risk:
                                st.warning(f"疼痛风险: {assessment.pain_risk_details}")
                            if assessment.movement_risk:
                                st.warning(f"动作稳定性风险: {assessment.movement_risk_details}")
                            if assessment.missed_days_risk:
                                st.warning(f"缺训风险: {assessment.missed_days_risk_details}")
                        
                        with col2:
                            st.markdown("**随访建议**")
                            for i, rec in enumerate(assessment.recommendations, 1):
                                st.write(f"{i}. {rec}")
        else:
            st.success("暂无高风险或危急风险患者")


def render_single_patient():
    st.header("👤 单人详情")
    
    if not st.session_state.data_loaded:
        st.warning("请先导入数据")
        return
    
    merged_data = st.session_state.merged_data
    if not merged_data:
        st.warning("数据未正确加载")
        return
    
    data_by_patient = merged_data.get("data_by_patient", {})
    if not data_by_patient:
        st.warning("暂无患者数据")
        return
    
    patient_options = []
    for patient_id, patient_data in data_by_patient.items():
        patient_info = patient_data.get("patient_info", {})
        name = patient_info.get("name", patient_id)
        patient_options.append((f"{name} ({patient_id})", patient_id))
    
    selected = st.selectbox(
        "选择患者",
        options=patient_options,
        format_func=lambda x: x[0],
    )
    
    if selected:
        patient_id = selected[1]
        patient_data = data_by_patient.get(patient_id, {})
        patient_info = patient_data.get("patient_info", {})
        
        st.markdown("---")
        st.markdown("### 患者基本信息")
        
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("姓名", patient_info.get("name", "N/A"))
        with col2:
            st.metric("年龄", f"{patient_info.get('age', 'N/A')}岁")
        with col3:
            st.metric("性别", patient_info.get("gender", "N/A"))
        with col4:
            st.metric("诊断", patient_info.get("primary_diagnosis", "N/A"))
        
        st.markdown("---")
        
        if st.session_state.metrics_calculated and patient_id in st.session_state.metrics_dict:
            metrics = st.session_state.metrics_dict[patient_id]
            
            st.markdown("### 周期指标")
            
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.metric("依从率", f"{metrics.compliance_rate:.1%}")
            with col2:
                st.metric("训练天数", f"{metrics.completed_training_days}/{metrics.total_training_days}")
            with col3:
                st.metric("平均疼痛", f"{metrics.average_pain_score:.1f}/10")
            with col4:
                st.metric("疼痛变化", f"{metrics.pain_score_change:+.1f}")
            
            col5, col6, col7, col8 = st.columns(4)
            with col5:
                st.metric("缺训天数", metrics.missed_days_count)
            with col6:
                st.metric("连续缺训", metrics.consecutive_missed_days)
            with col7:
                st.metric("平均时长", f"{metrics.average_duration_minutes:.0f}分钟")
            with col8:
                st.metric("动作分数", f"{metrics.average_movement_score:.1f}")
        
        st.markdown("---")
        
        if st.session_state.risk_assessed and patient_id in st.session_state.risk_assessments:
            assessment = st.session_state.risk_assessments[patient_id]
            
            st.markdown("### 风险评估")
            
            risk_level_name = config.RISK_LEVELS.get(assessment.risk_level.value, "未知")
            risk_color = config.RISK_COLORS.get(assessment.risk_level.value, "#888888")
            
            st.markdown(
                f"<h3 style='color: {risk_color};'>风险等级: {risk_level_name}</h3>",
                unsafe_allow_html=True,
            )
            st.metric("综合风险评分", f"{assessment.overall_score:.2f}")
            
            if assessment.needs_urgent_follow_up:
                st.error("⚠️ 需要紧急随访！")
            
            st.markdown("#### 随访建议")
            for i, rec in enumerate(assessment.recommendations, 1):
                st.write(f"{i}. {rec}")
        
        st.markdown("---")
        
        tab1, tab2, tab3, tab4 = st.tabs(["训练趋势", "疼痛趋势", "动作趋势", "历史记录"])
        
        with tab1:
            training_records = patient_data.get("training", [])
            if training_records:
                training_df = pd.DataFrame(training_records)
                if "date" in training_df.columns:
                    training_df["date"] = pd.to_datetime(training_df["date"])
                    training_df = training_df.sort_values("date")
                    
                    daily_stats = training_df.groupby("date").agg({
                        "is_completed": "any",
                        "duration_minutes": "sum",
                    }).reset_index()
                    daily_stats.columns = ["日期", "完成训练", "总时长(分钟)"]
                    
                    fig = px.bar(
                        daily_stats,
                        x="日期",
                        y="总时长(分钟)",
                        color="完成训练",
                        title="训练时长趋势",
                        color_discrete_map={True: "#2ca02c", False: "#dc3912"},
                    )
                    st.plotly_chart(fig, use_container_width=True)
        
        with tab2:
            pain_records = patient_data.get("pain", [])
            if pain_records:
                pain_df = pd.DataFrame(pain_records)
                if "date" in pain_df.columns and "pain_score" in pain_df.columns:
                    pain_df["date"] = pd.to_datetime(pain_df["date"])
                    pain_df = pain_df.sort_values("date")
                    
                    fig = px.line(
                        pain_df,
                        x="date",
                        y="pain_score",
                        color="pain_location",
                        title="疼痛评分趋势",
                        labels={"pain_score": "疼痛评分", "date": "日期"},
                    )
                    fig.update_layout(yaxis_range=[0, 10])
                    st.plotly_chart(fig, use_container_width=True)
        
        with tab3:
            movement_records = patient_data.get("movement", [])
            if movement_records:
                movement_df = pd.DataFrame(movement_records)
                if "date" in movement_df.columns and "completion_score" in movement_df.columns:
                    movement_df["date"] = pd.to_datetime(movement_df["date"])
                    movement_df = movement_df.sort_values("date")
                    
                    fig = px.line(
                        movement_df,
                        x="date",
                        y="completion_score",
                        color="movement_name",
                        title="动作完成分数趋势",
                        labels={"completion_score": "完成分数", "date": "日期"},
                    )
                    st.plotly_chart(fig, use_container_width=True)
        
        with tab4:
            st.markdown("#### 随访记录")
            followup_records = patient_data.get("followup", [])
            if followup_records:
                followup_df = pd.DataFrame(followup_records)
                st.dataframe(followup_df, use_container_width=True)
            else:
                st.info("暂无随访记录")


def render_threshold_config():
    st.header("⚙️ 阈值配置")
    
    thresholds = st.session_state.thresholds
    
    st.markdown("### 依从性阈值")
    col1, col2 = st.columns(2)
    with col1:
        thresholds.compliance_rate_warning = st.slider(
            "依从率警戒线",
            min_value=0.0,
            max_value=1.0,
            value=thresholds.compliance_rate_warning,
            format="%.0f%%",
            help="低于此值触发依从性预警",
        )
    with col2:
        thresholds.compliance_rate_low = st.slider(
            "依从率危急线",
            min_value=0.0,
            max_value=1.0,
            value=thresholds.compliance_rate_low,
            format="%.0f%%",
            help="低于此值触发高风险",
        )
    
    st.markdown("---")
    st.markdown("### 疼痛阈值")
    col3, col4 = st.columns(2)
    with col3:
        thresholds.pain_high_level = st.slider(
            "高疼痛评分阈值",
            min_value=0,
            max_value=10,
            value=thresholds.pain_high_level,
            help="疼痛评分达到此值视为高风险",
        )
    with col4:
        thresholds.pain_increase_threshold = st.slider(
            "疼痛上升阈值",
            min_value=0,
            max_value=10,
            value=thresholds.pain_increase_threshold,
            help="周期内疼痛上升此值视为风险",
        )
    
    st.markdown("---")
    st.markdown("### 动作稳定性阈值")
    thresholds.movement_volatility_threshold = st.slider(
        "动作变异系数阈值",
        min_value=0.0,
        max_value=1.0,
        value=thresholds.movement_volatility_threshold,
        format="%.0f%%",
        help="变异系数高于此值视为稳定性差",
    )
    
    st.markdown("---")
    st.markdown("### 缺训阈值")
    col5, col6 = st.columns(2)
    with col5:
        thresholds.missed_days_warning = st.slider(
            "连续缺训预警天数",
            min_value=1,
            max_value=14,
            value=thresholds.missed_days_warning,
            help="连续缺训此天数触发预警",
        )
    with col6:
        thresholds.missed_days_critical = st.slider(
            "连续缺训危急天数",
            min_value=1,
            max_value=14,
            value=thresholds.missed_days_critical,
            help="连续缺训此天数触发高风险",
        )
    
    st.markdown("---")
    
    col7, col8 = st.columns(2)
    with col7:
        if st.button("应用阈值", type="primary"):
            st.session_state.risk_engine.update_thresholds(thresholds)
            if st.session_state.data_loaded and st.session_state.metrics_calculated:
                calculate_metrics_and_risk()
                st.success("阈值已应用，风险评估已更新")
            else:
                st.success("阈值已保存")
    
    with col8:
        if st.button("恢复默认"):
            st.session_state.thresholds = RiskThresholds()
            st.session_state.risk_engine.update_thresholds(st.session_state.thresholds)
            st.success("已恢复默认阈值")


def render_report_export():
    st.header("📄 报告导出")
    
    if not st.session_state.data_loaded:
        st.warning("请先导入数据")
        return
    
    tab1, tab2 = st.tabs(["Markdown报告", "CSV导出"])
    
    with tab1:
        st.markdown("### 单人报告")
        
        merged_data = st.session_state.merged_data
        data_by_patient = merged_data.get("data_by_patient", {})
        
        if data_by_patient:
            patient_options = []
            for patient_id, patient_data in data_by_patient.items():
                patient_info = patient_data.get("patient_info", {})
                name = patient_info.get("name", patient_id)
                patient_options.append((f"{name} ({patient_id})", patient_id, patient_info))
            
            selected = st.selectbox(
                "选择要导出报告的患者",
                options=patient_options,
                format_func=lambda x: x[0],
                key="report_patient_select",
            )
            
            if selected:
                patient_id = selected[1]
                patient_info = selected[2]
                
                metrics = None
                risk_assessment = None
                
                if st.session_state.metrics_calculated and patient_id in st.session_state.metrics_dict:
                    metrics = st.session_state.metrics_dict[patient_id]
                
                if st.session_state.risk_assessed and patient_id in st.session_state.risk_assessments:
                    risk_assessment = st.session_state.risk_assessments[patient_id]
                
                if st.button("生成单人报告", type="primary"):
                    if metrics and risk_assessment:
                        exporter = st.session_state.exporter
                        markdown_content, file_path = exporter.export_single_patient_report(
                            patient_info=patient_info,
                            metrics=metrics,
                            risk_assessment=risk_assessment,
                            save_to_file=True,
                        )
                        
                        st.markdown("#### 报告预览")
                        st.markdown(markdown_content)
                        
                        st.download_button(
                            label="下载Markdown报告",
                            data=markdown_content,
                            file_name=f"患者报告_{patient_info.get('name', 'unknown')}_{date.today().strftime('%Y%m%d')}.md",
                            mime="text/markdown",
                        )
                    else:
                        st.warning("请确保已计算指标和风险评估")
        
        st.markdown("---")
        st.markdown("### 风险汇总报告")
        
        if st.session_state.risk_assessed:
            if st.button("生成风险汇总报告"):
                risk_engine = st.session_state.risk_engine
                distribution = risk_engine.get_risk_level_distribution(st.session_state.risk_assessments)
                
                high_risk_patients = []
                for patient_id, assessment in st.session_state.risk_assessments.items():
                    if assessment.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
                        patient_info = data_by_patient.get(patient_id, {}).get("patient_info", {})
                        risk_level_name = config.RISK_LEVELS.get(assessment.risk_level.value, "未知")
                        
                        main_factors = []
                        if assessment.compliance_risk:
                            main_factors.append(assessment.compliance_risk_details or "")
                        if assessment.pain_risk:
                            main_factors.append(assessment.pain_risk_details or "")
                        if assessment.movement_risk:
                            main_factors.append(assessment.movement_risk_details or "")
                        if assessment.missed_days_risk:
                            main_factors.append(assessment.missed_days_risk_details or "")
                        
                        high_risk_patients.append({
                            "patient_id": patient_id,
                            "patient_name": patient_info.get("name", patient_id),
                            "risk_level": risk_level_name,
                            "risk_details": f"综合评分: {assessment.overall_score:.2f}",
                            "main_factors": main_factors,
                        })
                
                exporter = st.session_state.exporter
                markdown_content, file_path = exporter.export_risk_summary_report(
                    risk_distribution=distribution,
                    high_risk_patients=high_risk_patients,
                    save_to_file=True,
                )
                
                st.markdown("#### 报告预览")
                st.markdown(markdown_content)
                
                st.download_button(
                    label="下载风险汇总报告",
                    data=markdown_content,
                    file_name=f"风险汇总报告_{date.today().strftime('%Y%m%d')}.md",
                    mime="text/markdown",
                )
    
    with tab2:
        st.markdown("### 导出指标数据")
        
        if st.session_state.metrics_calculated and st.session_state.metrics_dict:
            exporter = st.session_state.exporter
            
            patient_info_dict = {}
            for patient_id, patient_data in data_by_patient.items():
                patient_info = patient_data.get("patient_info", {})
                patient_info_dict[patient_id] = patient_info
            
            csv_data = exporter.prepare_patient_metrics_csv_data(
                metrics_dict=st.session_state.metrics_dict,
                patient_info_dict=patient_info_dict,
            )
            
            if csv_data:
                csv_content = exporter.generate_csv_report(csv_data, "metrics_summary")
                
                st.dataframe(pd.DataFrame(csv_data), use_container_width=True)
                
                st.download_button(
                    label="下载指标CSV",
                    data=csv_content,
                    file_name=f"患者指标汇总_{date.today().strftime('%Y%m%d')}.csv",
                    mime="text/csv",
                )
        
        st.markdown("---")
        st.markdown("### 导出风险评估数据")
        
        if st.session_state.risk_assessed and st.session_state.risk_assessments:
            exporter = st.session_state.exporter
            
            patient_info_dict = {}
            for patient_id, patient_data in data_by_patient.items():
                patient_info = patient_data.get("patient_info", {})
                patient_info_dict[patient_id] = patient_info
            
            csv_data = exporter.prepare_risk_csv_data(
                assessments_dict=st.session_state.risk_assessments,
                patient_info_dict=patient_info_dict,
            )
            
            if csv_data:
                csv_content = exporter.generate_csv_report(csv_data, "risk_summary")
                
                st.dataframe(pd.DataFrame(csv_data), use_container_width=True)
                
                st.download_button(
                    label="下载风险评估CSV",
                    data=csv_content,
                    file_name=f"风险评估汇总_{date.today().strftime('%Y%m%d')}.csv",
                    mime="text/csv",
                )


def render_sample_data():
    st.header("🧪 示例数据")
    
    st.markdown("""
    使用示例数据可以快速测试应用的所有功能。生成的数据包含：
    - 10名模拟患者
    - 4周的训练记录
    - 疼痛评分记录
    - 动作完成度记录
    - 随访记录
    """)
    
    st.markdown("---")
    
    col1, col2 = st.columns(2)
    with col1:
        num_patients = st.slider("患者数量", min_value=3, max_value=20, value=10)
    
    with col2:
        days_back = st.slider("数据周期(天)", min_value=7, max_value=90, value=28)
    
    if st.button("生成示例数据并加载", type="primary"):
        with st.spinner("正在生成示例数据..."):
            generator = st.session_state.sample_generator
            
            start_date = date.today() - timedelta(days=days_back)
            end_date = date.today()
            
            data_dict = generator.generate_all_sample_data(
                num_patients=num_patients,
                start_date=start_date,
                end_date=end_date,
            )
            
            importer = st.session_state.importer
            importer.clear_imported_data()
            
            for data_type, df in data_dict.items():
                importer.imported_data[data_type] = df
            
            st.session_state.imported_data = importer.get_all_dataframes()
            
            with st.spinner("正在清洗和合并数据..."):
                cleaner = st.session_state.cleaner
                cleaned_data = cleaner.clean_all_dataframes(st.session_state.imported_data)
                st.session_state.cleaned_data = cleaned_data
                
                patient_df = cleaned_data.get("patient")
                training_df = cleaned_data.get("training")
                pain_df = cleaned_data.get("pain")
                movement_df = cleaned_data.get("movement")
                followup_df = cleaned_data.get("followup")
                
                if patient_df is not None:
                    merged_data = cleaner.merge_patient_data(
                        patient_df=patient_df,
                        training_df=training_df,
                        pain_df=pain_df,
                        movement_df=movement_df,
                        followup_df=followup_df,
                    )
                    st.session_state.merged_data = merged_data
                    st.session_state.data_loaded = True
                    
                    st.session_state.period_start = start_date
                    st.session_state.period_end = end_date
                    
                    calculate_metrics_and_risk()
            
            st.success(f"成功生成 {num_patients} 名患者的示例数据！")
            st.balloons()
    
    st.markdown("---")
    st.markdown("### 数据说明")
    
    with st.expander("查看示例数据格式"):
        st.markdown("""
        **患者信息CSV格式：**
        - patient_id, name, age, gender, primary_diagnosis, treatment_plan, admission_date, notes
        
        **训练记录CSV格式：**
        - patient_id, date, training_program, is_completed, completion_percentage, duration_minutes, difficulty_level, notes
        
        **疼痛评分CSV格式：**
        - patient_id, date, pain_location, pain_score, pain_type, notes
        
        **动作完成度CSV格式：**
        - patient_id, date, movement_name, completion_score, form_quality, range_of_motion, symmetry_score, notes
        
        **随访记录CSV格式：**
        - patient_id, date, therapist_name, follow_up_type, summary, recommendations, next_follow_up_date
        """)


def main():
    init_session_state()
    ensure_directories()
    
    page = render_sidebar()
    
    if page == "📥 数据导入":
        render_data_import()
    elif page == "📊 数据概览":
        render_data_overview()
    elif page == "⚠️ 风险分析":
        render_risk_analysis()
    elif page == "👤 单人详情":
        render_single_patient()
    elif page == "⚙️ 阈值配置":
        render_threshold_config()
    elif page == "📄 报告导出":
        render_report_export()
    elif page == "🧪 示例数据":
        render_sample_data()


if __name__ == "__main__":
    main()
