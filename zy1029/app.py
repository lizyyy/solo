import json
import uuid
from datetime import date, datetime, timedelta
from typing import Dict, List, Any, Optional

import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import streamlit as st
from streamlit import session_state as ss

from src.models import (
    Project,
    RunRecord,
    PlannedRun,
    RiskAlert,
    RunIntensity,
    PainLocation,
    INTENSITY_LABELS,
    PAIN_LOCATION_LABELS,
    DATA_SOURCE_NAMES
)
from src.importers import (
    parse_csv_to_records,
    auto_detect_mapping,
    ImportResult,
    ColumnMapping,
    FIELD_MAPPERS
)
from src.analytics import (
    build_dashboard,
    DashboardData,
    WeeklySummary,
    RollingLoad
)
from src.data import generate_sample_project


def format_pace(pace_min: Optional[float]) -> str:
    if pace_min is None:
        return "-"
    minutes = int(pace_min)
    seconds = int((pace_min - minutes) * 60)
    return f"{minutes}:{seconds:02d}/km"


def format_duration(minutes: Optional[float]) -> str:
    if minutes is None:
        return "-"
    hours = int(minutes // 60)
    mins = int(minutes % 60)
    secs = int((minutes - hours * 60 - mins) * 60)
    if hours > 0:
        return f"{hours}h {mins}m {secs}s"
    return f"{mins}m {secs}s"


def severity_color(severity: str) -> str:
    m = {
        "high": "#ff4b4b",
        "medium": "#ffaa00",
        "low": "#4da6ff"
    }
    return m.get(severity, "#808080")


def intensity_color(intensity: RunIntensity) -> str:
    m = {
        RunIntensity.EASY: "#4ade80",
        RunIntensity.MODERATE: "#60a5fa",
        RunIntensity.THRESHOLD: "#f59e0b",
        RunIntensity.INTERVAL: "#ef4444",
        RunIntensity.RACE: "#dc2626"
    }
    return m.get(intensity, "#9ca3af")


def init_session_state():
    if "project" not in ss:
        ss.project = generate_sample_project()
    if "dashboard_cache" not in ss:
        ss.dashboard_cache = None
    if "selected_record_id" not in ss:
        ss.selected_record_id = None
    if "active_tab" not in ss:
        ss.active_tab = "dashboard"
    if "import_result" not in ss:
        ss.import_result = None
    if "temp_mapping" not in ss:
        ss.temp_mapping = None
    if "preview_df" not in ss:
        ss.preview_df = None


def get_dashboard() -> DashboardData:
    if ss.dashboard_cache is None:
        ss.dashboard_cache = build_dashboard(
            ss.project.records,
            ss.project.planned_runs
        )
    return ss.dashboard_cache


def invalidate_dashboard():
    ss.dashboard_cache = None


def render_header():
    st.set_page_config(
        page_title="跑步训练复盘工具",
        page_icon="🏃",
        layout="wide",
        initial_sidebar_state="expanded"
    )

    st.title("🏃 跑步训练复盘工具")
    st.caption(f"项目: {ss.project.project_name} | "
               f"记录数: {len(ss.project.records)} | "
               f"更新: {ss.project.updated_at.strftime('%Y-%m-%d %H:%M')}")
    st.markdown("---")


def render_sidebar():
    with st.sidebar:
        st.header("📊 导航")

        tabs = [
            ("dashboard", "🎯 核心看板"),
            ("import", "📥 导入数据"),
            ("records", "📋 训练记录"),
            ("plans", "📅 训练计划"),
            ("export", "💾 导入/导出"),
            ("report", "📄 复盘报告")
        ]

        for tab_id, tab_label in tabs:
            if st.button(
                tab_label,
                use_container_width=True,
                type="primary" if ss.active_tab == tab_id else "secondary"
            ):
                ss.active_tab = tab_id
                st.rerun()

        st.markdown("---")
        st.subheader("⚙️ 操作")

        if st.button("🔄 重新加载示例数据", use_container_width=True):
            ss.project = generate_sample_project()
            invalidate_dashboard()
            st.success("已加载示例数据")
            st.rerun()

        st.markdown("---")
        st.caption(f"当前目录: {date.today().strftime('%Y-%m-%d')}")


def render_risk_alert(alert: RiskAlert):
    risk_name = RiskAlert.RISK_TYPE_LABELS.get(alert.risk_type, alert.risk_type)
    severity_name = RiskAlert.SEVERITY_LABELS.get(alert.severity, alert.severity)
    color = severity_color(alert.severity)

    with st.expander(
        f"⚠️ {risk_name} ({severity_name})",
        expanded=alert.severity == "high"
    ):
        st.markdown(f"**{alert.message}**")

        if alert.related_dates:
            st.caption(f"相关日期: {', '.join(d.isoformat() for d in alert.related_dates)}")

        if "threshold" in alert.details:
            st.info(f"阈值说明: 超过 {alert.details['threshold']}% 即触发警告")

        if "acwr" in alert.details:
            rec_range = alert.details.get("recommended_range")
            if rec_range:
                st.info(f"推荐 ACWR 范围: {rec_range[0]} - {rec_range[1]}")


def render_dashboard_tab():
    st.header("🎯 训练看板")

    db = get_dashboard()

    if not db.weekly_summaries:
        st.info("暂无训练记录，请先导入数据或使用示例数据。")
        return

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        km = db.key_metrics.get("total_distance_km", 0)
        st.metric("总距离", f"{km:.1f} km")

    with col2:
        runs = db.key_metrics.get("total_runs", 0)
        st.metric("总次数", f"{runs} 次")

    with col3:
        acwr = db.key_metrics.get("latest_acwr")
        acwr_label = f"{acwr:.2f}" if acwr else "-"
        delta = None
        if acwr:
            if acwr > 1.5:
                delta = "过高 ⚠️"
            elif acwr > 1.3:
                delta = "偏高"
        st.metric("当前 ACWR", acwr_label, delta=delta)

    with col4:
        pain_count = db.key_metrics.get("pain_run_count", 0)
        if pain_count > 0:
            st.metric("伤痛记录", f"{pain_count} 次", delta="需要注意 ⚠️")
        else:
            st.metric("伤痛记录", "0 次")

    st.markdown("---")

    if db.risks:
        st.subheader("⚠️ 风险提示")
        high_risks = [r for r in db.risks if r.severity == "high"]
        other_risks = [r for r in db.risks if r.severity != "high"]

        for risk in high_risks:
            render_risk_alert(risk)
        for risk in other_risks:
            render_risk_alert(risk)

        st.markdown("---")

    tab1, tab2, tab3, tab4 = st.tabs(["📈 周度统计", "📊 负荷曲线", "💪 强度分布", "⚡ 区间分析"])

    with tab1:
        st.subheader("📈 周度训练统计")

        weeks = db.weekly_summaries
        if weeks:
            week_data = pd.DataFrame([{
                "周开始": w.week_start,
                "周数": w.week_number,
                "距离(km)": round(w.total_distance_km, 2),
                "时长(分钟)": round(w.total_duration_min, 2),
                "训练负荷": round(w.total_training_load, 2),
                "单次最长(km)": round(w.max_distance_single_run_km, 2),
                "次数": w.total_runs,
                "平均配速": format_pace(w.avg_pace_min_per_km),
                "平均心率": f"{w.avg_hr} bpm" if w.avg_hr else "-",
                "伤痛次数": w.pain_count
            } for w in weeks])

            st.dataframe(week_data, use_container_width=True, hide_index=True)

            fig = make_subplots(specs=[[{"secondary_y": True}]])

            fig.add_trace(
                go.Bar(
                    x=[f"第{w.week_number}周" for w in weeks],
                    y=[w.total_distance_km for w in weeks],
                    name="距离(km)",
                    marker_color="#60a5fa"
                ),
                secondary_y=False
            )

            fig.add_trace(
                go.Scatter(
                    x=[f"第{w.week_number}周" for w in weeks],
                    y=[w.total_training_load for w in weeks],
                    name="训练负荷",
                    mode="lines+markers",
                    line=dict(color="#f59e0b", width=3)
                ),
                secondary_y=True
            )

            fig.update_layout(title_text="周跑量与训练负荷", height=400)
            fig.update_xaxes(title_text="周")
            fig.update_yaxes(title_text="距离 (km)", secondary_y=False)
            fig.update_yaxes(title_text="训练负荷", secondary_y=True)
            st.plotly_chart(fig, use_container_width=True)

    with tab2:
        st.subheader("📊 7天/28天滚动训练负荷")

        if db.rolling_loads:
            load_dates = sorted(db.rolling_loads.keys())
            load_7d = [db.rolling_loads[d].load_7d for d in load_dates]
            load_28d = [db.rolling_loads[d].load_28d for d in load_dates]
            acwr = [db.rolling_loads[d].acwr for d in load_dates]

            fig = make_subplots(rows=2, cols=1, shared_xaxes=True,
                                subplot_titles=("滚动负荷 (7天/28天)", "ACWR (急性慢性工作负荷比)"))

            fig.add_trace(
                go.Scatter(x=load_dates, y=load_7d, name="7天负荷",
                          fill="tozeroy", line=dict(color="#ef4444")),
                row=1, col=1
            )
            fig.add_trace(
                go.Scatter(x=load_dates, y=load_28d, name="28天负荷",
                          line=dict(color="#3b82f6", dash="dash")),
                row=1, col=1
            )

            fig.add_trace(
                go.Scatter(x=load_dates, y=acwr, name="ACWR", mode="lines+markers",
                          line=dict(color="#f59e0b", width=2)),
                row=2, col=1
            )

            fig.add_hline(y=0.8, line_dash="dash", line_color="gray", row=2, col=1,
                         annotation_text="下限 0.8")
            fig.add_hline(y=1.3, line_dash="dash", line_color="orange", row=2, col=1,
                         annotation_text="预警 1.3")
            fig.add_hline(y=1.5, line_dash="dash", line_color="red", row=2, col=1,
                         annotation_text="危险 1.5")

            fig.update_layout(height=600, showlegend=True)
            st.plotly_chart(fig, use_container_width=True)

            st.caption("""
            **ACWR (急性慢性工作负荷比) 解读**:
            - 0.8 - 1.3: 安全范围，稳步提升
            - 1.3 - 1.5: 偏高范围，注意恢复
            - > 1.5: 危险范围，受伤风险大幅增加
            """)

    with tab3:
        st.subheader("💪 强度分布")

        weeks = db.weekly_summaries
        intensity_order = [RunIntensity.EASY, RunIntensity.MODERATE,
                           RunIntensity.THRESHOLD, RunIntensity.INTERVAL, RunIntensity.RACE]

        dist_by_intensity = {
            INTENSITY_LABELS[i]: sum(
                w.intensity_load_distribution.get(i, 0) for w in weeks
            ) for i in intensity_order
        }

        count_by_intensity = {
            INTENSITY_LABELS[i]: sum(
                w.intensity_distribution.get(i, 0) for w in weeks
            ) for i in intensity_order
        }

        col1, col2 = st.columns(2)

        with col1:
            labels = [k for k, v in dist_by_intensity.items() if v > 0]
            values = [v for v in dist_by_intensity.values() if v > 0]
            colors = [intensity_color(i) for i in intensity_order
                     if dist_by_intensity[INTENSITY_LABELS[i]] > 0]

            if values:
                fig = go.Figure(data=[go.Pie(
                    labels=labels,
                    values=values,
                    marker_colors=colors,
                    textinfo="label+percent"
                )])
                fig.update_layout(title_text="按训练负荷的强度分布")
                st.plotly_chart(fig, use_container_width=True)

        with col2:
            labels = [k for k, v in count_by_intensity.items() if v > 0]
            values = [v for v in count_by_intensity.values() if v > 0]
            colors = [intensity_color(i) for i in intensity_order
                     if count_by_intensity[INTENSITY_LABELS[i]] > 0]

            if values:
                fig = go.Figure(data=[go.Pie(
                    labels=labels,
                    values=values,
                    marker_colors=colors,
                    textinfo="label+percent"
                )])
                fig.update_layout(title_text="按次数的强度分布")
                st.plotly_chart(fig, use_container_width=True)

    with tab4:
        st.subheader("⚡ 配速与心率区间")

        col1, col2 = st.columns(2)

        with col1:
            st.write("**配速区间**")
            if db.pace_zones:
                pace_df = pd.DataFrame([{
                    "区间": z.zone_name,
                    "次数": z.count,
                    "总距离(km)": round(z.total_distance, 2)
                } for z in db.pace_zones if z.count > 0])
                if not pace_df.empty:
                    st.dataframe(pace_df, use_container_width=True, hide_index=True)

                    fig = go.Figure(go.Bar(
                        x=pace_df["区间"],
                        y=pace_df["次数"],
                        marker_color="#60a5fa"
                    ))
                    fig.update_layout(title_text="各配速区间次数分布")
                    st.plotly_chart(fig, use_container_width=True)
                else:
                    st.info("暂无配速数据")

        with col2:
            st.write("**心率区间**")
            if db.hr_zones:
                hr_df = pd.DataFrame([{
                    "区间": z.zone_name,
                    "次数": z.count,
                    "总距离(km)": round(z.total_distance, 2)
                } for z in db.hr_zones if z.count > 0])
                if not hr_df.empty:
                    st.dataframe(hr_df, use_container_width=True, hide_index=True)

                    fig = go.Figure(go.Bar(
                        x=hr_df["区间"],
                        y=hr_df["次数"],
                        marker_color="#f59e0b"
                    ))
                    fig.update_layout(title_text="各心率区间次数分布")
                    st.plotly_chart(fig, use_container_width=True)
                else:
                    st.info("暂无心率数据")


def render_import_tab():
    st.header("📥 导入数据")

    st.markdown("""
    支持导入以下来源的 CSV 数据：
    - **佳明 Garmin**: 从佳明 Connect 导出的活动 CSV
    - **Keep**: 从 Keep 导出的跑步记录 CSV
    - **手动格式**: 自己整理的 CSV（需包含指定字段）

    请上传 CSV 文件，系统将自动检测来源并映射字段。
    """)

    uploaded_file = st.file_uploader("选择 CSV 文件", type=["csv"])

    if uploaded_file is not None:
        try:
            csv_content = uploaded_file.getvalue().decode("utf-8")
            import io
            df = pd.read_csv(io.StringIO(csv_content))

            st.subheader("📋 数据预览")
            st.dataframe(df.head(10), use_container_width=True)
            st.caption(f"共 {len(df)} 行数据")

            mapping = auto_detect_mapping(list(df.columns))
            detected_source = mapping.source_type

            st.subheader("🔍 自动检测")
            source_name = DATA_SOURCE_NAMES.get(detected_source, "未知")
            st.info(f"检测到来源: **{source_name}**")

            st.subheader("⚙️ 字段映射 (可调整)")

            col_map = mapping.column_map.copy()
            all_columns = list(df.columns)

            field_configs = {
                "date": ("日期 (必填)", "date"),
                "distance_km": ("距离 (必填)", "distance"),
                "duration_min": ("用时 (必填)", "duration"),
                "avg_hr": ("平均心率", "avg_hr"),
                "pace_min_per_km": ("配速", "avg_pace"),
                "elevation_m": ("爬升", "elevation"),
                "rpe": ("主观疲劳(RPE)", "rpe"),
                "pain_location": ("伤痛位置", "pain_location"),
                "notes": ("备注", "notes")
            }

            user_mapping = {}

            for field_key, (field_label, fallback_key) in field_configs.items():
                current_col = col_map.get(field_key) or col_map.get(fallback_key)

                options = ["(不映射/自动计算)"] + all_columns
                selected_idx = 0
                if current_col and current_col in all_columns:
                    selected_idx = options.index(current_col)

                selected = st.selectbox(
                    field_label,
                    options=options,
                    index=selected_idx,
                    key=f"map_{field_key}"
                )
                if selected != "(不映射/自动计算)":
                    user_mapping[field_key] = selected

            if st.button("开始导入", type="primary", use_container_width=True):
                final_mapping = ColumnMapping(
                    source_type=detected_source,
                    column_map=user_mapping,
                    raw_columns=all_columns
                )

                result = parse_csv_to_records(
                    csv_content,
                    final_mapping,
                    data_source=detected_source
                )

                ss.import_result = result

        except Exception as e:
            st.error(f"文件解析错误: {str(e)}")
            return

    if ss.import_result is not None:
        result: ImportResult = ss.import_result

        st.markdown("---")
        st.subheader("📊 导入结果")

        if result.warnings:
            for w in result.warnings:
                st.warning(w)

        if result.imported_rows > 0:
            st.success(f"成功导入 {result.imported_rows} 条记录！")

            with st.expander("查看即将导入的记录"):
                preview_df = pd.DataFrame([{
                    "日期": r.date.isoformat(),
                    "距离(km)": round(r.distance_km, 2),
                    "用时": format_duration(r.duration_min),
                    "配速": format_pace(r.pace_min_per_km),
                    "平均心率": f"{r.avg_hr} bpm" if r.avg_hr else "-",
                    "强度": INTENSITY_LABELS.get(r.intensity_category, "-"),
                    "伤痛": PAIN_LOCATION_LABELS.get(r.pain_location, "-")
                } for r in result.records])
                st.dataframe(preview_df, use_container_width=True, hide_index=True)

            col1, col2 = st.columns(2)

            with col1:
                if st.button("✔️ 确认导入", type="primary", use_container_width=True):
                    existing_ids = {r.record_id for r in ss.project.records}
                    for r in result.records:
                        if r.record_id not in existing_ids:
                            ss.project.records.append(r)
                    ss.project.updated_at = datetime.now()
                    invalidate_dashboard()
                    ss.import_result = None
                    st.success("导入完成！")
                    st.rerun()

            with col2:
                if st.button("❌ 取消", use_container_width=True):
                    ss.import_result = None
                    st.rerun()

        if result.errors:
            st.subheader("❌ 错误详情")
            for err in result.errors[:20]:
                st.error(err.to_display())
            if len(result.errors) > 20:
                st.caption(f"... 还有 {len(result.errors) - 20} 个错误")


def render_records_tab():
    st.header("📋 训练记录")

    records = ss.project.sorted_records()

    if not records:
        st.info("暂无训练记录")
        return

    search_text = st.text_input("搜索 (日期/距离/备注)", "")

    filtered_records = records
    if search_text:
        search_lower = search_text.lower()
        filtered_records = [
            r for r in records
            if (search_lower in r.date.isoformat())
            or (search_lower in str(r.distance_km))
            or (search_lower in r.notes.lower())
            or any(search_lower in t.lower() for t in r.tags)
        ]

    st.caption(f"显示 {len(filtered_records)} 条记录")

    for idx, record in enumerate(filtered_records):
        with st.expander(
            f"📅 {record.date} | {record.distance_km:.2f} km | {format_duration(record.duration_min)} "
            f"| {'⚠️ ' if record.pain_location != PainLocation.NONE else ''}"
            f"{INTENSITY_LABELS.get(record.intensity_category, '')}"
        ):
            col1, col2 = st.columns(2)

            with col1:
                st.write("**基本信息**")
                st.metric("距离", f"{record.distance_km:.2f} km")
                st.metric("用时", format_duration(record.duration_min))
                st.metric("配速", format_pace(record.pace_min_per_km))
                st.metric("平均心率", f"{record.avg_hr} bpm" if record.avg_hr else "-")
                st.metric("爬升", f"{record.elevation_m:.0f} m")

            with col2:
                st.write("**强度与负荷**")
                intensity = record.intensity_category
                st.metric("强度类别", INTENSITY_LABELS.get(intensity, intensity.value))
                st.metric("训练负荷", f"{record.training_load:.1f}")

                st.write("**主观与伤痛**")
                rpe_val = record.rpe if record.rpe else "-"
                st.metric("RPE (1-10)", rpe_val)
                pain_label = PAIN_LOCATION_LABELS.get(record.pain_location, record.pain_location.value)
                st.metric("伤痛位置", pain_label)
                if record.pain_severity:
                    st.metric("疼痛程度", f"{record.pain_severity}/10")

            if record.tags:
                st.write("**标签**:", ", ".join(record.tags))
            if record.notes:
                st.write("**备注**:", record.notes)

            st.caption(f"来源: {DATA_SOURCE_NAMES.get(record.data_source, record.data_source)} "
                      f"| ID: {record.record_id}")

            if st.button("✏️ 编辑此记录", key=f"edit_{record.record_id}"):
                ss.selected_record_id = record.record_id
                st.rerun()

    if ss.selected_record_id:
        st.markdown("---")
        render_record_editor()


def render_record_editor():
    record_id = ss.selected_record_id
    record = next((r for r in ss.project.records if r.record_id == record_id), None)

    if not record:
        ss.selected_record_id = None
        return

    st.subheader(f"✏️ 编辑记录 - {record.date}")

    col1, col2 = st.columns(2)

    with col1:
        new_rpe = st.slider(
            "主观疲劳度 (RPE)",
            min_value=1, max_value=10, value=record.rpe or 5,
            help="1=非常轻松，10=极限"
        )

        pain_options = list(PAIN_LOCATION_LABELS.values())
        current_pain_label = PAIN_LOCATION_LABELS.get(record.pain_location, "无")
        pain_idx = pain_options.index(current_pain_label) if current_pain_label in pain_options else 0

        new_pain_label = st.selectbox(
            "伤痛位置",
            options=pain_options,
            index=pain_idx
        )

        label_to_enum = {v: k for k, v in PAIN_LOCATION_LABELS.items()}
        new_pain = label_to_enum.get(new_pain_label, PainLocation.NONE)

        new_pain_severity = None
        if new_pain != PainLocation.NONE:
            new_pain_severity = st.slider(
                "疼痛程度",
                min_value=1, max_value=10,
                value=record.pain_severity or 5
            )

    with col2:
        all_tags = set()
        for r in ss.project.records:
            all_tags.update(r.tags)

        available_tags = list(sorted(all_tags))
        current_tags = record.tags

        new_tags_str = st.text_input(
            "标签 (逗号分隔)",
            value=", ".join(current_tags)
        )
        new_tags = [t.strip() for t in new_tags_str.split(",") if t.strip()]

        existing_tag_suggestions = [t for t in available_tags if t not in new_tags]
        if existing_tag_suggestions:
            st.caption("已有标签: " + ", ".join(existing_tag_suggestions))

        new_notes = st.text_area(
            "备注",
            value=record.notes,
            height=150
        )

    col_save, col_cancel, col_delete = st.columns([2, 1, 1])

    with col_save:
        if st.button("💾 保存修改", type="primary", use_container_width=True):
            record.rpe = new_rpe
            record.pain_location = new_pain
            record.pain_severity = new_pain_severity
            record.tags = new_tags
            record.notes = new_notes
            ss.project.updated_at = datetime.now()
            invalidate_dashboard()
            st.success("已保存")
            ss.selected_record_id = None
            st.rerun()

    with col_cancel:
        if st.button("❌ 取消", use_container_width=True):
            ss.selected_record_id = None
            st.rerun()

    with col_delete:
        if st.button("🗑️ 删除此记录", use_container_width=True):
            ss.project.records = [r for r in ss.project.records if r.record_id != record_id]
            ss.project.updated_at = datetime.now()
            invalidate_dashboard()
            ss.selected_record_id = None
            st.success("已删除")
            st.rerun()


def render_plans_tab():
    st.header("📅 训练计划")

    st.markdown("""
    在此规划未来两周的训练计划。系统会将计划训练与历史负荷对比，
    预测潜在的超量风险或休息冲突。
    """)

    plans = ss.project.sorted_plans()
    today = date.today()

    existing_plans = [p for p in plans if p.date >= today]

    if existing_plans:
        st.subheader("📋 现有计划")

        plans_df = pd.DataFrame([{
            "日期": p.date.isoformat(),
            "星期": ["一", "二", "三", "四", "五", "六", "日"][p.date.weekday()],
            "计划距离(km)": f"{p.planned_distance_km:.1f}" if p.planned_distance_km else "-",
            "计划时长": format_duration(p.planned_duration_min) if p.planned_duration_min else "-",
            "强度": INTENSITY_LABELS.get(p.planned_intensity, "-") if p.planned_intensity else "-",
            "描述": p.description,
            "预估负荷": f"{p.estimated_load:.1f}"
        } for p in existing_plans])

        st.dataframe(plans_df, use_container_width=True, hide_index=True)

    st.markdown("---")
    st.subheader("➕ 添加新计划")

    col1, col2, col3 = st.columns(3)

    with col1:
        plan_date = st.date_input("训练日期", min_value=today, value=today)

    with col2:
        plan_distance = st.number_input(
            "计划距离 (km)",
            min_value=0.0, max_value=50.0, value=5.0, step=0.5
        )

    with col3:
        plan_duration = st.number_input(
            "计划时长 (分钟)",
            min_value=0.0, max_value=300.0, value=35.0, step=5.0
        )

    col4, col5 = st.columns(2)

    with col4:
        intensity_options = list(INTENSITY_LABELS.values())
        plan_intensity_label = st.selectbox(
            "计划强度",
            options=intensity_options,
            index=0
        )
        label_to_intensity = {v: k for k, v in INTENSITY_LABELS.items()}
        plan_intensity = label_to_intensity.get(plan_intensity_label)

    with col5:
        plan_desc = st.text_input("训练描述", value="")

    if st.button("➕ 添加计划", type="primary", use_container_width=True):
        new_plan = PlannedRun(
            plan_id=f"plan_{uuid.uuid4().hex[:6]}",
            date=plan_date,
            planned_distance_km=plan_distance if plan_distance > 0 else None,
            planned_duration_min=plan_duration if plan_duration > 0 else None,
            planned_intensity=plan_intensity,
            description=plan_desc,
            tags=[plan_intensity.value] if plan_intensity else []
        )
        ss.project.planned_runs.append(new_plan)
        ss.project.updated_at = datetime.now()
        invalidate_dashboard()
        st.success("已添加计划")
        st.rerun()

    if existing_plans:
        st.markdown("---")
        st.subheader("🗑️ 删除计划")

        plan_to_delete = st.selectbox(
            "选择要删除的计划",
            options=["(选择计划)"] + [
                f"{p.date.isoformat()} - {p.description or INTENSITY_LABELS.get(p.planned_intensity, '训练')}"
                for p in existing_plans
            ]
        )

        if plan_to_delete != "(选择计划)":
            date_str = plan_to_delete.split(" - ")[0].strip()
            plan_date_to_del = date.fromisoformat(date_str)

            if st.button("确认删除此计划", type="secondary"):
                ss.project.planned_runs = [
                    p for p in ss.project.planned_runs
                    if not (p.date == plan_date_to_del and plan_to_delete.endswith(p.description or ""))
                ]
                ss.project.updated_at = datetime.now()
                invalidate_dashboard()
                st.success("已删除")
                st.rerun()

    st.markdown("---")
    st.subheader("📊 计划与历史负荷对比")

    db = get_dashboard()
    if db.rolling_loads:
        latest_date = max(db.rolling_loads.keys())
        latest_load = db.rolling_loads[latest_date]

        col1, col2, col3 = st.columns(3)

        with col1:
            st.metric("历史7天负荷", f"{latest_load.load_7d:.1f}")

        with col2:
            st.metric("基线周均负荷", f"{latest_load.baseline_weekly_avg:.1f}")

        with col2:
            st.metric("当前 ACWR", f"{latest_load.acwr:.2f}")

        future_plans = [p for p in ss.project.planned_runs if p.date > latest_date]
        if future_plans:
            next_7d = [p for p in future_plans if p.date <= latest_date + timedelta(days=7)]
            next_7d_load = sum(p.estimated_load for p in next_7d)

            projected_7d = latest_load.load_7d + next_7d_load
            projected_acwr = (
                projected_7d / latest_load.baseline_weekly_avg
                if latest_load.baseline_weekly_avg > 0 else 1.0
            )

            st.info(f"""
            **预测**:
            - 未来7天计划新增负荷: {next_7d_load:.1f}
            - 预计7天总负荷: {projected_7d:.1f}
            - **预计 ACWR: {projected_acwr:.2f}**
            """)

            if projected_acwr > 1.5:
                st.error("⚠️ 警告：按计划执行后 ACWR 将超过 1.5，受伤风险较高！")
            elif projected_acwr > 1.3:
                st.warning("⚠️ 注意：按计划执行后 ACWR 将超过 1.3，建议减少训练量或增加恢复。")


def render_export_tab():
    st.header("💾 导入/导出项目")

    st.markdown("---")
    st.subheader("📤 导出项目")

    st.markdown("将当前项目（训练记录+计划+标签定义）导出为 JSON 文件，方便备份或分享。")

    project_json = json.dumps(ss.project.to_dict(), indent=2, ensure_ascii=False, default=str)

    st.download_button(
        label="📥 下载项目 JSON",
        data=project_json,
        file_name=f"run_project_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
        mime="application/json",
        use_container_width=True
    )

    with st.expander("预览 JSON 内容"):
        st.code(project_json, language="json")

    st.markdown("---")
    st.subheader("📥 导入项目")

    st.markdown("从之前导出的 JSON 文件恢复项目。**注意：这将覆盖当前所有数据！**")

    uploaded_json = st.file_uploader("选择项目 JSON 文件", type=["json"])

    if uploaded_json is not None:
        try:
            json_content = uploaded_json.getvalue().decode("utf-8")
            data = json.loads(json_content)

            st.subheader("📋 预览要导入的内容")
            col1, col2, col3 = st.columns(3)

            with col1:
                st.metric("项目名称", data.get("project_name", "未知"))
            with col2:
                st.metric("训练记录", f"{len(data.get('records', []))} 条")
            with col3:
                st.metric("训练计划", f"{len(data.get('planned_runs', []))} 条")

            col_confirm, col_cancel = st.columns(2)

            with col_confirm:
                if st.button("⚠️ 确认导入（覆盖当前数据）", type="primary", use_container_width=True):
                    ss.project = Project.from_dict(data)
                    invalidate_dashboard()
                    st.success("导入成功！")
                    st.rerun()

            with col_cancel:
                if st.button("取消", use_container_width=True):
                    st.rerun()

        except Exception as e:
            st.error(f"导入失败: {str(e)}")


def render_report_tab():
    st.header("📄 复盘报告")

    st.markdown("生成一份结构化的训练复盘报告，包含关键指标、风险解释和训练建议。")

    report_date = st.date_input("报告日期", value=date.today())
    report_weeks = st.slider("回顾周数", min_value=2, max_value=12, value=4)

    include_risks = st.checkbox("包含风险分析", value=True)
    include_recommendations = st.checkbox("包含训练建议", value=True)

    if st.button("🔄 生成报告", type="primary", use_container_width=True):
        ss["generate_report_trigger"] = True

    if ss.get("generate_report_trigger"):
        db = get_dashboard()

        markdown = generate_report_markdown(
            db,
            ss.project,
            report_date,
            report_weeks,
            include_risks,
            include_recommendations
        )

        html = generate_report_html(markdown)

        st.markdown("---")
        st.subheader("📄 报告预览")

        st.components.v1.html(html, height=800, scrolling=True)

        st.markdown("---")
        st.subheader("📥 下载报告")

        col1, col2 = st.columns(2)

        with col1:
            st.download_button(
                label="下载 Markdown",
                data=markdown,
                file_name=f"run_report_{report_date.isoformat()}.md",
                mime="text/markdown",
                use_container_width=True
            )

        with col2:
            st.download_button(
                label="下载 HTML",
                data=html,
                file_name=f"run_report_{report_date.isoformat()}.html",
                mime="text/html",
                use_container_width=True
            )

        with st.expander("查看 Markdown 源码"):
            st.code(markdown, language="markdown")


def generate_report_markdown(
    db: DashboardData,
    project: Project,
    report_date: date,
    lookback_weeks: int,
    include_risks: bool,
    include_recommendations: bool
) -> str:
    lines = []

    lines.append(f"# 跑步训练复盘报告")
    lines.append(f"")
    lines.append(f"> 项目: **{project.project_name}**")
    lines.append(f"> 报告日期: **{report_date.isoformat()}**")
    lines.append(f"> 回顾周期: 最近 **{lookback_weeks} 周**")
    lines.append(f"")
    lines.append("---")
    lines.append("")

    lines.append("## 📊 关键指标总览")
    lines.append("")

    metrics = db.key_metrics

    lines.append("| 指标 | 数值 |")
    lines.append("|------|------|")
    lines.append(f"| 总跑步次数 | {metrics.get('total_runs', 0)} 次 |")
    lines.append(f"| 总距离 | {metrics.get('total_distance_km', 0):.1f} km |")
    lines.append(f"| 总时长 | {format_duration(metrics.get('total_duration_min'))} |")
    lines.append(f"| 平均配速 | {format_pace(metrics.get('avg_pace_min_per_km'))} |")
    if metrics.get('avg_hr'):
        lines.append(f"| 平均心率 | {metrics['avg_hr']} bpm |")
    if metrics.get('latest_acwr') is not None:
        acwr = metrics['latest_acwr']
        acwr_status = "✅ 正常" if 0.8 <= acwr <= 1.3 else ("⚠️ 偏高" if acwr > 1.3 else "⬇️ 偏低")
        lines.append(f"| 当前 ACWR | {acwr:.2f} ({acwr_status}) |")
    lines.append(f"| 带痛跑步次数 | {metrics.get('pain_run_count', 0)} 次 |")
    lines.append("")

    lines.append("---")
    lines.append("")

    lines.append("## 📈 近期周度趋势")
    lines.append("")

    recent_weeks = db.weekly_summaries[-lookback_weeks:] if db.weekly_summaries else []

    if recent_weeks:
        lines.append("| 周数 | 周开始 | 距离(km) | 时长(分) | 训练负荷 | 次数 | 伤痛 |")
        lines.append("|------|--------|----------|----------|----------|------|------|")
        for w in recent_weeks:
            lines.append(
                f"| 第{w.week_number}周 | {w.week_start.isoformat()} | "
                f"{w.total_distance_km:.1f} | {w.total_duration_min:.0f} | "
                f"{w.total_training_load:.1f} | {w.total_runs} | {w.pain_count} |"
            )
    lines.append("")

    lines.append("---")
    lines.append("")

    if include_risks and db.risks:
        lines.append("## ⚠️ 风险分析")
        lines.append("")

        high_risks = [r for r in db.risks if r.severity == "high"]
        other_risks = [r for r in db.risks if r.severity != "high"]

        for idx, risk in enumerate(high_risks + other_risks, 1):
            risk_name = RiskAlert.RISK_TYPE_LABELS.get(risk.risk_type, risk.risk_type)
            severity_name = RiskAlert.SEVERITY_LABELS.get(risk.severity, risk.severity)
            severity_icon = "🔴" if risk.severity == "high" else ("🟡" if risk.severity == "medium" else "🔵")

            lines.append(f"### {severity_icon} {idx}. {risk_name} ({severity_name})")
            lines.append("")
            lines.append(f"> {risk.message}")
            lines.append("")

            if risk.related_dates:
                lines.append(f"- 相关日期: {', '.join(d.isoformat() for d in risk.related_dates)}")

            if "increase_pct" in risk.details:
                lines.append(f"- 增加幅度: {risk.details['increase_pct']:.0f}%")

            if "acwr" in risk.details:
                lines.append(f"- 当前 ACWR: {risk.details['acwr']:.2f}")
                rec = risk.details.get("recommended_range")
                if rec:
                    lines.append(f"- 推荐范围: {rec[0]} - {rec[1]}")

            lines.append("")

        lines.append("---")
        lines.append("")

    if include_recommendations:
        lines.append("## 💡 训练建议")
        lines.append("")

        recommendations = build_recommendations(db, project, lookback_weeks)

        for idx, rec in enumerate(recommendations, 1):
            lines.append(f"### {idx}. {rec['title']}")
            lines.append("")
            lines.append(rec["content"])
            lines.append("")
            if rec.get("action"):
                lines.append(f"**建议行动**: {rec['action']}")
            lines.append("")

        lines.append("---")
        lines.append("")

    lines.append("## 📋 附录")
    lines.append("")
    lines.append(f"- 数据记录数: {len(project.records)}")
    lines.append(f"- 计划训练数: {len([p for p in project.planned_runs if p.date >= date.today()])}")
    lines.append(f"- 报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    lines.append("")

    return "\n".join(lines)


def build_recommendations(
    db: DashboardData,
    project: Project,
    lookback_weeks: int
) -> List[Dict[str, str]]:
    recs = []

    acwr = db.key_metrics.get("latest_acwr")
    if acwr:
        if acwr > 1.5:
            recs.append({
                "title": "⚠️ 立即减少训练量",
                "content": f"当前 ACWR ({acwr:.2f}) 远高于安全范围 (0.8-1.3)。"
                          f"这意味着你最近的训练量相对于过去4周的基线增加过快，"
                          f"受伤风险显著提高。",
                "action": "建议本周完全休息或只做非常轻松的交叉训练，下周再逐渐恢复训练。"
            })
        elif acwr > 1.3:
            recs.append({
                "title": "⚠️ 考虑减少下周训练量",
                "content": f"当前 ACWR ({acwr:.2f}) 略高于安全范围 (0.8-1.3)。"
                          f"虽然还没有到危险程度，但继续保持当前训练节奏可能会导致过度训练。",
                "action": "建议下周减少 20-30% 的训练量，或增加一个休息日。"
            })
        elif acwr < 0.8:
            recs.append({
                "title": "💪 可以考虑适当加量",
                "content": f"当前 ACWR ({acwr:.2f}) 低于推荐范围，说明最近的训练量相对保守。"
                          f"如果你感觉状态良好，可以考虑逐步增加训练负荷。",
                "action": "可以考虑下周增加 10-15% 的训练量，但不要超过 30% 的周增幅。"
            })
        else:
            recs.append({
                "title": "✅ 当前负荷管理良好",
                "content": f"当前 ACWR ({acwr:.2f}) 处于理想范围 (0.8-1.3)。"
                          f"这意味着你在稳步提高训练量，同时给身体足够的适应时间。",
                "action": "继续保持当前的训练节奏，每周增加量控制在 10% 以内。"
            })

    pain_count = db.key_metrics.get("pain_run_count", 0)
    if pain_count > 0:
        pain_records = [r for r in project.records if r.pain_location != PainLocation.NONE]
        if pain_records:
            loc_counts: Dict[str, int] = defaultdict(int)
            for r in pain_records:
                loc = PAIN_LOCATION_LABELS.get(r.pain_location, r.pain_location.value)
                loc_counts[loc] += 1

            top_loc = max(loc_counts.items(), key=lambda x: x[1])[0]

            recs.append({
                "title": "🩹 关注伤痛恢复",
                "content": f"你记录了 {pain_count} 次带痛跑步，最常出现问题的部位是 **{top_loc}**。"
                          f"带伤训练可能会延长恢复时间，甚至导致更严重的慢性损伤。",
                "action": f"建议在 {top_loc} 完全恢复之前，避免高强度训练。"
                          f"可以考虑游泳、骑自行车等低冲击交叉训练来保持状态。"
            })

    recent_weeks = db.weekly_summaries[-lookback_weeks:] if db.weekly_summaries else []
    if len(recent_weeks) >= 2:
        last_week = recent_weeks[-1]
        prev_week = recent_weeks[-2]

        if prev_week.total_distance_km > 0:
            increase_pct = (last_week.total_distance_km - prev_week.total_distance_km) / prev_week.total_distance_km * 100

            if increase_pct > 30:
                recs.append({
                    "title": "📈 注意周增幅控制",
                    "content": f"最近一周的跑量 ({last_week.total_distance_km:.1f}km) 比前一周 ({prev_week.total_distance_km:.1f}km) 增加了 {increase_pct:.0f}%。"
                              f"一般建议每周跑量增幅控制在 10% 以内，最多不超过 20%。",
                    "action": "建议下周适当减少训练量，给身体更多适应时间。"
                })

    high_intensity_runs = db.key_metrics.get("high_intensity_run_count", 0)
    if high_intensity_runs > 0:
        recs.append({
            "title": "⏱️ 高强度训练安排",
            "content": f"你近期进行了 {high_intensity_runs} 次高强度训练（阈值/间歇/比赛配速）。"
                      f"高强度训练对身体刺激很大，需要足够的恢复时间。",
            "action": "建议两次高强度训练之间至少间隔 48 小时，中间安排轻松跑或休息日。"
        })

    if not recs:
        recs.append({
            "title": "✅ 训练状态良好",
            "content": "从数据分析来看，你的训练安排比较合理，没有发现明显的风险点。",
            "action": "继续保持当前的训练节奏，注意倾听身体信号，有伤痛及时休息。"
        })

    return recs


def generate_report_html(markdown_content: str) -> str:
    html = f"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>跑步训练复盘报告</title>
    <style>
        * {{
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #fafafa;
        }}
        .container {{
            background: white;
            padding: 60px;
            border-radius: 12px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.08);
        }}
        h1 {{
            font-size: 2rem;
            border-bottom: 3px solid #60a5fa;
            padding-bottom: 12px;
            margin-top: 0;
            color: #1e293b;
        }}
        h2 {{
            font-size: 1.5rem;
            border-left: 4px solid #60a5fa;
            padding-left: 12px;
            margin-top: 2.5rem;
            color: #1e293b;
        }}
        h3 {{
            font-size: 1.25rem;
            margin-top: 1.5rem;
            color: #334155;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
        }}
        th, td {{
            border: 1px solid #e2e8f0;
            padding: 12px 16px;
            text-align: left;
        }}
        th {{
            background: #f8fafc;
            font-weight: 600;
        }}
        tr:nth-child(even) td {{
            background: #fefefe;
        }}
        blockquote {{
            border-left: 4px solid #d1d5db;
            padding-left: 16px;
            margin: 1rem 0;
            color: #6b7280;
        }}
        hr {{
            border: none;
            border-top: 1px solid #e2e8f0;
            margin: 2rem 0;
        }}
        ul {{
            padding-left: 20px;
        }}
        li {{
            margin: 0.5rem 0;
        }}
        .danger {{ color: #ef4444; }}
        .warning {{ color: #f59e0b; }}
        .success {{ color: #10b981; }}
        .info {{ color: #3b82f6; }}
    </style>
</head>
<body>
<div class="container">
{markdown_to_simple_html(markdown_content)}
</div>
</body>
</html>
"""
    return html


def markdown_to_simple_html(md: str) -> str:
    lines = md.split("\n")
    html_lines = []
    in_table = False
    table_rows = []

    for line in lines:
        stripped = line.strip()

        if stripped.startswith("|") and stripped.endswith("|"):
            if not in_table:
                in_table = True
                table_rows = []
            table_rows.append(line)
            continue
        elif in_table:
            if table_rows:
                html_lines.append(_render_markdown_table(table_rows))
            in_table = False
            table_rows = []

        if stripped.startswith("# "):
            html_lines.append(f"<h1>{stripped[2:]}</h1>")
        elif stripped.startswith("## "):
            html_lines.append(f"<h2>{stripped[3:]}</h2>")
        elif stripped.startswith("### "):
            html_lines.append(f"<h3>{stripped[4:]}</h3>")
        elif stripped.startswith("> "):
            content = stripped[2:]
            while lines and lines[0].strip().startswith("> "):
                pass
            html_lines.append(f"<blockquote>{content[2:] if content.startswith('> ') else content}</blockquote>")
        elif stripped.startswith("---"):
            html_lines.append("<hr>")
        elif stripped.startswith("- ") or stripped.startswith("* "):
            html_lines.append(f"<li>{_inline_markdown(stripped[2:])}</li>")
        elif stripped == "":
            html_lines.append("")
        else:
            if stripped:
                html_lines.append(f"<p>{_inline_markdown(stripped)}</p>")

    if table_rows:
        html_lines.append(_render_markdown_table(table_rows))

    return "\n".join(html_lines)


def _render_markdown_table(rows: List[str]) -> str:
    if len(rows) < 2:
        return ""

    html_rows = []

    header_cells = [c.strip() for c in rows[0].split("|")[1:-1]]
    separator = rows[1].strip()

    is_separator = all(c in "-|:| " for c in separator)

    if is_separator:
        header_html = "<tr>" + "".join(f"<th>{_inline_markdown(c)}</th>" for c in header_cells) + "</tr>"
        html_rows.append(f"<thead>{header_html}</thead>")
        data_rows = rows[2:]
    else:
        data_rows = rows

    if data_rows:
        body_html_parts = []
        for row in data_rows:
            cells = [c.strip() for c in row.split("|")[1:-1]]
            row_html = "<tr>" + "".join(f"<td>{_inline_markdown(c)}</td>" for c in cells) + "</tr>"
            body_html_parts.append(row_html)
        html_rows.append(f"<tbody>{''.join(body_html_parts)}</tbody>")

    return f"<table>{''.join(html_rows)}</table>"


def _inline_markdown(text: str) -> str:
    t = text
    t = t.replace("**", "<strong>", 1)
    t = t.replace("**", "</strong>", 1)
    t = t.replace("*", "<em>", 1)
    t = t.replace("*", "</em>", 1)
    return t


def main():
    init_session_state()
    render_header()
    render_sidebar()

    if ss.active_tab == "dashboard":
        render_dashboard_tab()
    elif ss.active_tab == "import":
        render_import_tab()
    elif ss.active_tab == "records":
        render_records_tab()
    elif ss.active_tab == "plans":
        render_plans_tab()
    elif ss.active_tab == "export":
        render_export_tab()
    elif ss.active_tab == "report":
        render_report_tab()


if __name__ == "__main__":
    main()
