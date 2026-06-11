import streamlit as st
import pandas as pd

from models import RecordStatus, CorrectionType
from demo_data import (
    make_calibrations, make_sensors, make_first_run_records,
    make_corrections, make_rerun_records, make_run_histories,
    get_unit_explanation, BASE_TIME
)
from leak_calculator import (
    calculate_leakage, get_threshold, kpa_to_bar, mm2_to_m2,
    nozzle_area_mm2, REFERENCE_DIAMETER_MM
)

st.set_page_config(page_title="压缩空气泄漏估算", layout="wide")

st.title("🔧 压缩空气泄漏估算工具")
st.caption("实验教学演示版 — 林老师专用")

st.sidebar.title("📋 流程导航")
step = st.sidebar.radio(
    "处理步骤",
    [
        "1️⃣ 温度校准记录导入",
        "2️⃣ 初始计算（未查传感器编号）",
        "3️⃣ 林老师补查传感器编号",
        "4️⃣ 单位换算说明更新",
        "5️⃣ 重跑与补录",
        "6️⃣ 三种处理结果对比",
        "7️⃣ 维修复核状态"
    ]
)

calibrations = make_calibrations()
sensors = make_sensors()
first_run = make_first_run_records()
corrections = make_corrections()
rerun_records = make_rerun_records()
run_histories = make_run_histories()
threshold = get_threshold()
unit_info = get_unit_explanation()

sensor_map = {s.sensor_id: s for s in sensors}

sns_a02 = sensor_map["SNS-A02"]
rec002 = first_run[1]
rec002_corrected_leak = calculate_leakage(
    rec002.raw_flow_rate, rec002.temp_c, rec002.pressure_kpa,
    sns_a02.nozzle_diameter_mm, sns_a02.calibration_factor
)
other_leak_values = [
    r.estimated_leak_lmin for r in first_run
    if r.record_id != rec002.record_id and r.estimated_leak_lmin is not None
]
rec002_avg_leak = round(sum(other_leak_values) / len(other_leak_values), 2)
rec002_leak_delta = rec002.estimated_leak_lmin - rec002_corrected_leak


def record_to_dict(r):
    return {
        "记录ID": r.record_id,
        "传感器编号": r.sensor_id,
        "测量时间": r.measured_at.strftime("%Y-%m-%d %H:%M"),
        "原始流量(L/min)": r.raw_flow_rate,
        "温度(°C)": r.temp_c,
        "压力(kPa)": r.pressure_kpa,
        "喷嘴口径(mm)": r.nozzle_diameter_mm,
        "估算泄漏(L/min)": r.estimated_leak_lmin,
        "状态": r.status.value,
        "是否平均值覆盖": "是" if r.is_averaged else "否",
        "是否补录": "是" if r.is_backfilled else "否",
        "原始口径(mm)": r.original_diameter_mm or "-",
        "运行ID": r.run_id or "-"
    }


def correction_to_dict(c):
    return {
        "修正ID": c.correction_id,
        "修正类型": c.correction_type.value,
        "关联记录": c.record_id or "-",
        "旧泄漏值(L/min)": c.old_value if c.old_value is not None else "-",
        "新泄漏值(L/min)": c.new_value if c.new_value is not None else "-",
        "旧口径(mm)": c.old_diameter if c.old_diameter is not None else "-",
        "新口径(mm)": c.new_diameter if c.new_diameter is not None else "-",
        "操作人": c.operator,
        "修正时间": c.corrected_at.strftime("%Y-%m-%d %H:%M"),
        "原因": c.reason,
        "备注": c.notes or "-"
    }


if step == "1️⃣ 温度校准记录导入":
    st.header("第一步：温度校准记录导入")
    st.info("✅ 温度校准记录已从校准系统导入，共 3 条")

    df_cal = pd.DataFrame([{
        "校准ID": c.calibration_id,
        "传感器编号": c.sensor_id,
        "校准温度(°C)": c.temp_c,
        "校准压力(kPa)": c.pressure_kpa,
        "校准时间": c.calibrated_at.strftime("%Y-%m-%d %H:%M"),
        "操作人": c.operator
    } for c in calibrations])

    st.dataframe(df_cal, use_container_width=True)

    st.subheader("📐 单位换算说明")
    for key, desc in unit_info.items():
        if key != "conversions":
            st.markdown(f"- **{key}**: {desc}")
    st.markdown("**换算关系:**")
    for conv in unit_info["conversions"]:
        st.markdown(f"- {conv}")

    st.subheader("🔬 公式验证（实时计算）")
    st.caption(f"参考口径 = {REFERENCE_DIAMETER_MM} mm，阈值 = {threshold} L/min")
    col_demo1, col_demo2 = st.columns(2)
    with col_demo1:
        demo_d = st.number_input("喷嘴口径 mm", value=2.5, min_value=0.5, max_value=10.0, step=0.1, key="step1_d")
        demo_raw = st.number_input("原始流量 L/min", value=30.0, min_value=0.0, key="step1_raw")
    with col_demo2:
        demo_C = st.number_input("校准因子", value=0.98, min_value=0.5, max_value=1.5, step=0.01, key="step1_C")
        demo_T = st.number_input("温度 °C", value=23.5, min_value=-10.0, max_value=60.0, step=0.1, key="step1_T")
    demo_result = calculate_leakage(demo_raw, demo_T, 600.0, demo_d, demo_C)
    demo_A_ref = nozzle_area_mm2(REFERENCE_DIAMETER_MM)
    demo_A_nozzle = nozzle_area_mm2(demo_d)
    demo_ratio = demo_A_ref / demo_A_nozzle
    demo_temp_corr = (293.15 / (demo_T + 273.15)) ** 0.5
    st.code(
        f"A_ref = π×({REFERENCE_DIAMETER_MM}/2)² = {demo_A_ref:.4f} mm²\n"
        f"A_nozzle = π×({demo_d}/2)² = {demo_A_nozzle:.4f} mm²\n"
        f"area_ratio = {demo_A_ref:.4f} / {demo_A_nozzle:.4f} = {demo_ratio:.4f}\n"
        f"temp_correction = √(293.15 / {demo_T + 273.15:.2f}) = {demo_temp_corr:.4f}\n"
        f"Q = {demo_C} × {demo_raw} × {demo_ratio:.4f} × {demo_temp_corr:.4f} = {demo_result} L/min"
    )
    is_over = demo_result > threshold
    if is_over:
        st.error(f"⚠️ 计算结果 {demo_result} L/min > 阈值 {threshold} L/min → 超阈值")
    else:
        st.success(f"✅ 计算结果 {demo_result} L/min ≤ 阈值 {threshold} L/min → 正常")

elif step == "2️⃣ 初始计算（未查传感器编号）":
    st.header("第二步：初始计算（新人操作，未查传感器编号）")
    st.warning("⚠️ 张同学第一次操作，仅导入温度校准记录，未核对传感器编号和口径档案")

    df_first = pd.DataFrame([record_to_dict(r) for r in first_run])
    st.dataframe(df_first, use_container_width=True)

    st.subheader("🔍 逐记录分析")

    col1, col2, col3 = st.columns(3)

    with col1:
        r1 = first_run[0]
        st.metric(f"{r1.record_id} - {r1.sensor_id}",
                 f"{r1.estimated_leak_lmin} L/min",
                 delta=f"阈值 {threshold}", delta_color="off")
        st.success(f"✅ {r1.status.value}")
        st.caption(f"口径: {r1.nozzle_diameter_mm}mm | 与档案一致")

    with col2:
        r2 = first_run[1]
        st.metric(f"{r2.record_id} - {r2.sensor_id}",
                 f"{r2.estimated_leak_lmin} L/min",
                 delta=f"超阈值 {r2.estimated_leak_lmin - threshold:.1f}", delta_color="inverse")
        st.error(f"❌ {r2.status.value}")
        st.caption(f"口径: {r2.nozzle_diameter_mm}mm | ⚠️ 未核对传感器档案")

    with col3:
        r3 = first_run[2]
        st.metric(f"{r3.record_id} - {r3.sensor_id}",
                 f"{r3.estimated_leak_lmin} L/min",
                 delta=f"阈值 {threshold}", delta_color="off")
        st.success(f"✅ {r3.status.value}")
        st.caption(f"口径: {r3.nozzle_diameter_mm}mm | 与档案一致")

    st.info(f"""
    **本次运行摘要:**
    - 运行ID: RUN-001
    - 操作人: 张同学
    - 时间: {BASE_TIME.strftime('%Y-%m-%d %H:%M')}
    - 记录数: 3 条
    - 正常: 2 条 | 超阈值: 1 条

    **关键: REC-002 使用口径 2.5mm 计算得到 {rec002.estimated_leak_lmin} L/min，
    超过阈值 {threshold} L/min。但实际传感器 SNS-A02 的口径已改为 3.0mm，
    用错口径会导致面积比偏大，泄漏量被高估。**
    """)

elif step == "3️⃣ 林老师补查传感器编号":
    st.header("第三步：林老师补查传感器编号")
    st.info("🔍 林老师发现 REC-002 异常，调出传感器档案核对")

    col_a, col_b = st.columns([1, 1])

    with col_a:
        st.subheader("📋 传感器档案")
        df_sensors = pd.DataFrame([{
            "传感器编号": s.sensor_id,
            "当前口径(mm)": s.nozzle_diameter_mm,
            "校准因子": s.calibration_factor,
            "安装位置": s.location,
            "备注": s.notes or "-"
        } for s in sensors])
        st.dataframe(df_sensors, use_container_width=True)

    with col_b:
        st.subheader("⚠️ 问题发现")
        bad_record = first_run[1]
        sensor = sensor_map[bad_record.sensor_id]

        A_wrong = nozzle_area_mm2(bad_record.nozzle_diameter_mm)
        A_correct = nozzle_area_mm2(sensor.nozzle_diameter_mm)
        A_ref = nozzle_area_mm2(REFERENCE_DIAMETER_MM)

        st.error(f"""
        **REC-002 口径不一致！**

        - 记录使用口径: **{bad_record.nozzle_diameter_mm} mm**（A = {A_wrong:.2f} mm²）
        - 档案实际口径: **{sensor.nozzle_diameter_mm} mm**（A = {A_correct:.2f} mm²）

        面积比影响:
        - 错: A_ref/A_wrong = {A_ref:.2f}/{A_wrong:.2f} = **{A_ref/A_wrong:.4f}** → 高估泄漏
        - 对: A_ref/A_correct = {A_ref:.2f}/{A_correct:.2f} = **{A_ref/A_correct:.4f}** → 正确估算

        用错口径 {bad_record.nozzle_diameter_mm}mm：泄漏 = {bad_record.estimated_leak_lmin} L/min（超阈值）
        修正口径 {sensor.nozzle_diameter_mm}mm：泄漏 = {rec002_corrected_leak} L/min
        **泄漏量估算减少了 {rec002_leak_delta:.2f} L/min**
        """)

        st.subheader("📝 生成修正记录")
        corr = corrections[0]
        st.write(pd.DataFrame([correction_to_dict(corr)]), use_container_width=True)

elif step == "4️⃣ 单位换算说明更新":
    st.header("第四步：单位换算说明更新")
    st.info("📝 林老师顺便更新单位换算说明，避免以后再踩坑")

    corr2 = corrections[1]
    st.write(pd.DataFrame([correction_to_dict(corr2)]), use_container_width=True)

    st.subheader("📐 更新后的单位换算说明")

    col1, col2 = st.columns(2)

    with col1:
        st.markdown("### 压力换算")
        kpa_val = st.number_input("输入 kPa 值", value=600.0, min_value=0.0)
        bar_val = kpa_to_bar(kpa_val)
        st.metric("换算为 bar", f"{bar_val:.2f} bar")
        st.code(f"{kpa_val} kPa × 0.01 = {bar_val} bar")

    with col2:
        st.markdown("### 面积换算与口径影响")
        mm_val = st.number_input("输入喷嘴直径 mm", value=3.0, min_value=0.1)
        area_val = nozzle_area_mm2(mm_val)
        area_m2 = mm2_to_m2(area_val)
        A_ref = nozzle_area_mm2(REFERENCE_DIAMETER_MM)
        ratio = A_ref / area_val
        st.metric(f"直径 {mm_val}mm 喷嘴面积", f"{area_m2:.2e} m²")
        st.metric(f"面积比 A_ref/A_nozzle", f"{ratio:.4f}")
        st.code(
            f"A = π×({mm_val}/2)² = {area_val:.4f} mm²\n"
            f"A_ref/A = {A_ref:.4f}/{area_val:.4f} = {ratio:.4f}\n"
            f"口径越大 → 面积比越小 → 估算泄漏越低"
        )

    st.subheader("📌 标准条件与公式")
    st.info(f"""
    - 标准温度: 20°C (293.15 K)
    - 参考口径: {REFERENCE_DIAMETER_MM} mm
    - 阈值: {threshold} L/min
    - 公式: **Q = C × raw × (A_ref / A_nozzle) × √(T_std / T_actual)**
    - 关键: **口径越大 → A_nozzle 越大 → 面积比越小 → 估算泄漏越低**
    """)

elif step == "5️⃣ 重跑与补录":
    st.header("第五步：重跑与补录")
    st.info("🔄 修正口径后，林老师重跑 REC-002，并补录了一条旧口径的历史数据")

    col1, col2 = st.columns(2)

    with col1:
        st.subheader("🔄 重跑 REC-002（口径修正后）")

        st.metric("修正前泄漏量（口径 2.5mm）", f"{rec002.estimated_leak_lmin} L/min")
        st.metric("修正后泄漏量（口径 3.0mm）", f"{rec002_corrected_leak} L/min",
                 delta=f"减少 {rec002_leak_delta:.2f} L/min", delta_color="normal")

        if rec002_leak_delta > 0:
            st.success(f"✅ 口径修正后，泄漏量估算减少了 {rec002_leak_delta:.2f} L/min")
        elif rec002_leak_delta < 0:
            st.error(f"❌ 口径修正后，泄漏量估算增加了 {abs(rec002_leak_delta):.2f} L/min")
        else:
            st.info("口径修正后，泄漏量估算未变化")

        st.warning(f"""
        📊 与相邻记录取平均:
        - REC-001 ({first_run[0].sensor_id}): {first_run[0].estimated_leak_lmin} L/min
        - REC-003 ({first_run[2].sensor_id}): {first_run[2].estimated_leak_lmin} L/min
        - 相邻记录平均: {rec002_avg_leak} L/min
        - 最终状态: **平均值覆盖 - 待维修复核**
        - ⚠️ 不自动归为正常，留给维修师傅现场确认
        """)

    with col2:
        st.subheader("📥 补录历史数据（旧口径）")
        backfill = rerun_records[1]

        st.write(pd.DataFrame([record_to_dict(backfill)]), use_container_width=True)

        st.info(f"""
        **补录说明:**
        - 记录ID: {backfill.record_id}
        - 测量时间: {backfill.measured_at.strftime('%Y-%m-%d %H:%M')}
        - 使用口径: {backfill.nozzle_diameter_mm}mm（当时的旧口径）
        - 估算泄漏: {backfill.estimated_leak_lmin} L/min
        - 状态: {backfill.status.value}
        - 来源: 从历史测量记录中补录，用于口径变更前后对比
        """)

    st.subheader("📋 两次运行对比")
    df_runs = pd.DataFrame([{
        "运行ID": rh.run_id,
        "操作人": rh.operator,
        "开始时间": rh.started_at.strftime("%Y-%m-%d %H:%M"),
        "结束时间": rh.ended_at.strftime("%Y-%m-%d %H:%M") if rh.ended_at else "-",
        "描述": rh.description,
        "记录数": len(rh.record_ids),
        "修正数": len(rh.correction_ids)
    } for rh in run_histories])
    st.dataframe(df_runs, use_container_width=True)

elif step == "6️⃣ 三种处理结果对比":
    st.header("第六步：三种处理结果对比")
    st.success("🎯 三种典型场景全部跑完，结果差异清晰可见")

    all_records = first_run + rerun_records
    scenarios = [
        ("REC-001", "✅ 顺利记录（口径正确，一次通过）"),
        ("REC-002-R", "📊 超阈值被平均值覆盖（待维修复核）"),
        ("REC-004", "📥 补录旧口径数据（从传感器编号追溯）")
    ]

    for rec_id, title in scenarios:
        with st.expander(title, expanded=True):
            rec = next(r for r in all_records if r.record_id == rec_id)
            col_a, col_b, col_c = st.columns(3)

            with col_a:
                st.metric("记录ID", rec.record_id)
                st.metric("传感器", rec.sensor_id)
                st.metric("测量时间", rec.measured_at.strftime("%m-%d %H:%M"))

            with col_b:
                st.metric("使用口径", f"{rec.nozzle_diameter_mm} mm")
                if rec.original_diameter_mm and rec.original_diameter_mm != rec.nozzle_diameter_mm:
                    st.metric("原始口径", f"{rec.original_diameter_mm} mm")
                else:
                    st.metric("原始口径", "-")
                st.metric("泄漏量", f"{rec.estimated_leak_lmin} L/min")

            with col_c:
                st.metric("状态", rec.status.value)
                st.metric("平均值覆盖", "是" if rec.is_averaged else "否")
                st.metric("补录来源", "是" if rec.is_backfilled else "否")

    st.subheader("📊 汇总对比表")
    scenario_records = [
        next(r for r in all_records if r.record_id == rid)
        for rid, _ in scenarios
    ]
    df_compare = pd.DataFrame([record_to_dict(r) for r in scenario_records])
    st.dataframe(df_compare, use_container_width=True)

    st.subheader("🔬 口径对泄漏量的影响链")
    st.info(f"""
    **REC-002 的完整变化链:**

    1. 原始计算（口径 2.5mm）: **{rec002.estimated_leak_lmin} L/min** → 超阈值
       - A_ref/A_nozzle = {nozzle_area_mm2(REFERENCE_DIAMETER_MM):.2f}/{nozzle_area_mm2(2.5):.2f} = {nozzle_area_mm2(REFERENCE_DIAMETER_MM)/nozzle_area_mm2(2.5):.4f}

    2. 修正口径后（口径 3.0mm）: **{rec002_corrected_leak} L/min** → 低于阈值但需复核
       - A_ref/A_nozzle = {nozzle_area_mm2(REFERENCE_DIAMETER_MM):.2f}/{nozzle_area_mm2(3.0):.2f} = {nozzle_area_mm2(REFERENCE_DIAMETER_MM)/nozzle_area_mm2(3.0):.4f}

    3. 平均值覆盖: **{rec002_avg_leak} L/min** → 用相邻记录平均替代，但仍待维修复核

    **泄漏量估算减少了 {rec002_leak_delta:.2f} L/min**（口径从 2.5mm 修正为 3.0mm 的直接效果）
    """)

    st.subheader("💡 林老师教学笔记")
    st.info(f"""
    **三种场景讲给新人听:**

    1. **顺利记录 (REC-001)** — 传感器编号、口径、温度校准都对得上，一次过。
       口径 {first_run[0].nozzle_diameter_mm}mm → 面积比 {nozzle_area_mm2(REFERENCE_DIAMETER_MM)/nozzle_area_mm2(first_run[0].nozzle_diameter_mm):.4f} → 泄漏 {first_run[0].estimated_leak_lmin} L/min ✅

    2. **超阈值被平均值覆盖 (REC-002 → REC-002-R)** — 口径用错导致计算值超标，
       修正口径后泄漏从 {rec002.estimated_leak_lmin} 降到 {rec002_corrected_leak} L/min，
       用相邻数据平均后为 {rec002_avg_leak} L/min。
       但**不能自动归为正常**，必须标记「待维修复核」，
       让维修师傅去现场看是不是真漏。⚠️

    3. **补录旧口径 (REC-004)** — 传感器编号是关键！查 SNS-A02 的档案发现
       6 月 1 日换过喷嘴，口径从 2.5mm 变 3.0mm。补录一条换喷嘴前的旧数据，
       口径用当时的 2.5mm → 泄漏 {rerun_records[1].estimated_leak_lmin} L/min，
       这样前后对比才有意义。📥

    **记住:** 返工不怕，只要留在明面上，每一步修正都有记录，新人就能看懂为什么改、改了什么。
    """)

elif step == "7️⃣ 维修复核状态":
    st.header("第七步：维修复核状态")
    st.warning("⚠️ 超阈值记录即使被平均值覆盖，也必须留待维修师傅确认")

    col1, col2 = st.columns(2)

    with col1:
        st.subheader("🔧 待复核清单")
        pending = [r for r in rerun_records if r.status == RecordStatus.AVERAGED]
        if pending:
            for r in pending:
                with st.container():
                    st.error(f"**{r.record_id} - {r.sensor_id}**")
                    st.write(f"- 修正前泄漏: {rec002.estimated_leak_lmin} L/min（口径 {rec002.nozzle_diameter_mm}mm）")
                    st.write(f"- 修正后泄漏: {rec002_corrected_leak} L/min（口径 {sns_a02.nozzle_diameter_mm}mm）")
                    st.write(f"- 平均值覆盖: {r.estimated_leak_lmin} L/min")
                    st.write(f"- 泄漏量估算减少了: {rec002_leak_delta:.2f} L/min")
                    st.write(f"- 状态: {r.status.value} - 待维修师傅现场复核")
                    st.write(f"- ⚠️ 虽已取平均值覆盖，但不自动判定为正常")

                    if st.button(f"✅ 维修师傅已复核 - {r.record_id}", key=r.record_id):
                        st.success("已标记为维修复核完成")
        else:
            st.success("当前没有待复核记录")

    with col2:
        st.subheader("📋 修正历史全记录")
        df_corr = pd.DataFrame([correction_to_dict(c) for c in corrections])
        st.dataframe(df_corr, use_container_width=True)

        st.subheader("📝 操作日志")
        for rh in run_histories:
            with st.expander(f"{rh.run_id} - {rh.description}"):
                st.write(f"- 操作人: {rh.operator}")
                st.write(f"- 开始: {rh.started_at.strftime('%Y-%m-%d %H:%M')}")
                st.write(f"- 结束: {rh.ended_at.strftime('%Y-%m-%d %H:%M')}")
                st.write(f"- 记录: {', '.join(rh.record_ids)}")
                st.write(f"- 修正: {', '.join(rh.correction_ids) if rh.correction_ids else '无'}")

st.sidebar.markdown("---")
st.sidebar.info("""
**教学演示要点:**
1. 温度校准先导入
2. 传感器编号务必查
3. 口径错了全白算
4. 超阈值别急着盖
5. 维修师傅说了算
6. 返工都要留记录
""")
