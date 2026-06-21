import streamlit as st
import pandas as pd
import numpy as np
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).parent))

from src.data_processor import DataProcessor
from src.validator import DataValidator
from src.calibration import LaserRangeCalibrator
from src.conflict_detector import ConflictDetector
from src.report_generator import ReportGenerator
from config import UNITS


st.set_page_config(
    page_title="激光测距误差校准",
    page_icon="🔬",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.title("🔬 激光测距误差校准系统")

st.sidebar.title("导航")
page = st.sidebar.radio("选择功能模块", [
    "📥 数据导入",
    "✅ 数据验证",
    "⚖️ 冲突检测",
    "🔧 误差校准",
    "📊 报告生成"
])

if 'data_processor' not in st.session_state:
    st.session_state.data_processor = DataProcessor()
if 'validator' not in st.session_state:
    st.session_state.validator = DataValidator()
if 'calibrator' not in st.session_state:
    st.session_state.calibrator = LaserRangeCalibrator()
if 'conflict_detector' not in st.session_state:
    st.session_state.conflict_detector = ConflictDetector()
if 'report_generator' not in st.session_state:
    st.session_state.report_generator = ReportGenerator()
if 'raw_data' not in st.session_state:
    st.session_state.raw_data = None
if 'validation_report' not in st.session_state:
    st.session_state.validation_report = None
if 'calibration_result' not in st.session_state:
    st.session_state.calibration_result = None
if 'column_mapping' not in st.session_state:
    st.session_state.column_mapping = {}


if page == "📥 数据导入":
    st.header("📥 数据导入")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("实验数据表")
        uploaded_file = st.file_uploader(
            "上传Excel或CSV文件",
            type=['xlsx', 'xls', 'csv'],
            help="支持Excel和CSV格式的实验数据表"
        )
        
        if uploaded_file:
            with st.spinner("正在导入数据..."):
                file_path = Path("uploads") / uploaded_file.name
                with open(file_path, "wb") as f:
                    f.write(uploaded_file.getbuffer())
                
                df = st.session_state.data_processor.load_experiment_table(str(file_path))
                st.session_state.raw_data = df
                st.session_state.column_mapping = st.session_state.data_processor.column_mapping
                
                st.success(f"✅ 成功导入 {len(df)} 行数据")
                st.dataframe(df.head(10), use_container_width=True)
    
    with col2:
        st.subheader("自动列映射")
        if st.session_state.column_mapping:
            st.write("检测到的列映射关系：")
            for std_name, col_name in st.session_state.column_mapping.items():
                st.info(f"**{std_name}**: {col_name}")
        else:
            st.info("请先上传数据文件")
    
    st.divider()
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("照片说明")
        photo_notes = st.text_area(
            "输入照片对应的测量记录",
            height=150,
            placeholder="例如：\n时间: 2024-01-15 10:30\n距离: 100.5 mm\n方向: 正向\n备注: 照片1号"
        )
        
        if st.button("解析照片说明"):
            if photo_notes:
                st.success("照片说明已保存")
            else:
                st.warning("请输入照片说明内容")
    
    with col2:
        st.subheader("工况记录")
        working_conditions = st.text_area(
            "输入工况记录",
            height=150,
            placeholder="例如：\n环境温度: 25°C\n环境湿度: 60%\n设备型号: LASER-001\n操作人员: 何工"
        )
        
        if st.button("解析工况记录"):
            if working_conditions:
                conditions = st.session_state.data_processor.parse_working_conditions(working_conditions)
                st.write("解析到的工况：")
                st.json(conditions)
            else:
                st.warning("请输入工况记录内容")
    
    if st.session_state.raw_data is not None:
        st.divider()
        st.subheader("单位转换")
        
        value_col = st.selectbox(
            "选择数值列",
            options=st.session_state.raw_data.columns.tolist(),
            index=st.session_state.raw_data.columns.tolist().index(st.session_state.column_mapping.get('distance_raw', st.session_state.raw_data.columns[0])) if st.session_state.column_mapping.get('distance_raw') in st.session_state.raw_data.columns else 0
        )
        
        col1, col2 = st.columns(2)
        with col1:
            from_unit = st.selectbox("原始单位", options=list(UNITS['distance'].keys()), index=0)
        with col2:
            to_unit = st.selectbox("目标单位", options=list(UNITS['distance'].keys()), index=0)
        
        if st.button("执行单位转换"):
            df = st.session_state.data_processor.convert_units(
                st.session_state.raw_data, value_col, from_unit, to_unit
            )
            st.session_state.raw_data = df
            st.success(f"✅ 转换完成，新增列: {value_col}_{to_unit}")
            st.dataframe(df[[value_col, f'{value_col}_{to_unit}']].head(), use_container_width=True)


elif page == "✅ 数据验证":
    st.header("✅ 数据验证")
    
    if st.session_state.raw_data is None:
        st.warning("请先在「数据导入」页面上传数据")
    else:
        df = st.session_state.raw_data
        
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            time_col = st.selectbox(
                "时间列",
                options=['(无)'] + df.columns.tolist(),
                index=df.columns.tolist().index(st.session_state.column_mapping.get('timestamp', '')) + 1 if st.session_state.column_mapping.get('timestamp') in df.columns else 0
            )
        
        with col2:
            value_col = st.selectbox(
                "数值列",
                options=['(无)'] + df.columns.tolist(),
                index=df.columns.tolist().index(st.session_state.column_mapping.get('distance_raw', '')) + 1 if st.session_state.column_mapping.get('distance_raw') in df.columns else 0
            )
        
        with col3:
            direction_col = st.selectbox(
                "方向列",
                options=['(无)'] + df.columns.tolist(),
                index=df.columns.tolist().index(st.session_state.column_mapping.get('direction', '')) + 1 if st.session_state.column_mapping.get('direction') in df.columns else 0
            )
        
        with col4:
            ref_col = st.selectbox(
                "标准值列",
                options=['(无)'] + df.columns.tolist(),
                index=df.columns.tolist().index(st.session_state.column_mapping.get('distance_reference', '')) + 1 if st.session_state.column_mapping.get('distance_reference') in df.columns else 0
            )
        
        st.subheader("边界值设置")
        col1, col2 = st.columns(2)
        with col1:
            min_value = st.number_input("最小值", value=0.0)
        with col2:
            max_value = st.number_input("最大值", value=1000.0)
        
        if st.button("开始验证", type="primary"):
            with st.spinner("正在验证数据..."):
                report = st.session_state.validator.validate_all(
                    df,
                    time_col=time_col if time_col != '(无)' else None,
                    value_col=value_col if value_col != '(无)' else None,
                    direction_col=direction_col if direction_col != '(无)' else None,
                    min_value=min_value,
                    max_value=max_value
                )
                st.session_state.validation_report = report
                
                warnings = st.session_state.validator.get_warnings()
                if warnings:
                    st.error(f"⚠️ 发现 {len(warnings)} 个问题")
                    for w in warnings:
                        with st.expander(f"{w['message']}"):
                            st.write(w['details'])
                            if 'rows' in w:
                                st.write(f"涉及行号: {w['rows'][:10]}")
                                if len(w['rows']) > 10:
                                    st.write(f"... 共 {len(w['rows'])} 行")
                else:
                    st.success("✅ 数据验证通过，未发现明显问题")
        
        if st.session_state.validation_report:
            st.divider()
            st.subheader("验证报告详情")
            
            report = st.session_state.validation_report
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.metric("空值行数", report.get('empty_values', {}).get('empty_count', 0))
                st.metric("重复行数", report.get('duplicates', {}).get('duplicate_count', 0))
            
            with col2:
                st.metric("边界值记录数", len(report.get('boundary', {}).get('boundary_rows', [])))
                direction_valid = report.get('direction', {}).get('valid', True)
                st.metric("方向验证", "通过" if direction_valid else "失败")


elif page == "⚖️ 冲突检测":
    st.header("⚖️ 冲突检测")
    
    if st.session_state.raw_data is None:
        st.warning("请先在「数据导入」页面上传数据")
    else:
        df = st.session_state.raw_data
        
        st.subheader("微信群记录")
        wechat_text = st.text_area(
            "粘贴微信群聊天记录",
            height=200,
            placeholder="""何工 14:30:15
刚才测的第5点距离是105mm，正向

张工 14:32:20
收到，我这边记录是100mm，是不是单位错了？

何工 14:35:00
哦不对，应该是10.5cm！"""
        )
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            data_value_col = st.selectbox(
                "数据值列",
                options=df.columns.tolist(),
                index=df.columns.tolist().index(st.session_state.column_mapping.get('distance_raw', '')) if st.session_state.column_mapping.get('distance_raw') in df.columns else 0
            )
        
        with col2:
            data_time_col = st.selectbox(
                "数据时间列",
                options=['(无)'] + df.columns.tolist(),
                index=df.columns.tolist().index(st.session_state.column_mapping.get('timestamp', '')) + 1 if st.session_state.column_mapping.get('timestamp') in df.columns else 0
            )
        
        with col3:
            data_direction_col = st.selectbox(
                "数据方向列",
                options=['(无)'] + df.columns.tolist(),
                index=df.columns.tolist().index(st.session_state.column_mapping.get('direction', '')) + 1 if st.session_state.column_mapping.get('direction') in df.columns else 0
            )
        
        if st.button("检测冲突", type="primary"):
            with st.spinner("正在分析..."):
                st.session_state.conflict_detector.clear_conflicts()
                
                ref_date = ConflictDetector.infer_reference_date_from_data(
                    df, data_time_col if data_time_col != '(无)' else None
                )
                
                parsed_records = st.session_state.conflict_detector.parse_wechat_text(
                    wechat_text, reference_date=ref_date
                )
                
                for rec in parsed_records:
                    st.session_state.conflict_detector.add_wechat_record(
                        timestamp=rec.get('timestamp', ''),
                        content=rec.get('content', ''),
                        distance=rec.get('distance'),
                        direction=rec.get('direction'),
                        operator=rec.get('speaker')
                    )
                
                conflicts = st.session_state.conflict_detector.compare_distance(
                    df,
                    data_value_col,
                    data_time_col if data_time_col != '(无)' else None
                )
                
                if data_direction_col != '(无)':
                    dir_conflicts = st.session_state.conflict_detector.compare_direction(
                        df,
                        data_direction_col,
                        data_time_col if data_time_col != '(无)' else None
                    )
                    conflicts.extend(dir_conflicts)
                
                st.session_state.last_conflicts_parsed = parsed_records
                st.session_state.last_conflicts_summary = st.session_state.conflict_detector.get_conflict_summary()
        
        if 'last_conflicts_summary' in st.session_state:
            summary = st.session_state.last_conflicts_summary
            report = summary.get('detection_report', {})
            
            st.subheader("检测统计")
            stat_col1, stat_col2, stat_col3, stat_col4 = st.columns(4)
            stat_col1.metric("微信记录", report.get('wechat_records_count', 0))
            stat_col2.metric("含距离记录", report.get('distance_wechat_records', 0))
            stat_col3.metric("含有效方向", report.get('directional_wechat_records', 0))
            stat_col4.metric("时间匹配成功", report.get('time_matches', 0))

            if report.get('missing_direction_wechat_records', 0):
                st.info(f"ℹ️ {report['missing_direction_wechat_records']} 条微信记录未标注方向（会以'微信方向缺失'单独提示）")
            
            pending = summary.get('pending_conflicts', 0)
            total = summary.get('total_conflicts', 0)
            resolved = summary.get('resolved_conflicts', 0)
            ignored = summary.get('ignored_conflicts', 0)
            pending_high = sum(1 for c in summary.get('pending_conflicts_list', [])
                               if c.severity == 'high')
            
            sc1, sc2, sc3, sc4 = st.columns(4)
            sc1.metric("待处理冲突", pending, delta=None)
            sc2.metric("  其中 high 级", pending_high, delta=None)
            sc3.metric("已解决 / 已忽略", f"{resolved} / {ignored}", delta=None)
            sc4.metric("冲突总数", total, delta=None)

            by_type = summary.get('by_type', {})
            if by_type:
                type_cols = st.columns(len(by_type))
                for i, (ctype, cnt) in enumerate(by_type.items()):
                    type_cols[i].metric(ctype, cnt)
            
            if report.get('parse_errors'):
                with st.expander(f"⚠️ 解析/匹配异常 {len(report['parse_errors'])} 条"):
                    for e in report['parse_errors'][:10]:
                        st.warning(e)

            if pending_high > 0:
                st.error(f"⚖️ 存在 {pending_high} 个 **high 严重度**待处理冲突，必须先处理再继续校准")
            elif pending > 0:
                st.warning(f"⚠️ 存在 {pending} 个低/中严重度待处理冲突，建议先核对后再校准")
            elif total > 0:
                st.success(f"✅ {total} 个冲突已全部处理（已解决 {resolved}，已忽略 {ignored}），可以继续校准")
            else:
                if report.get('direction_checked') or report.get('distance_checked'):
                    st.success("✅ 已执行冲突检测，未发现冲突，可以继续校准")
                else:
                    st.warning("⚠️ 检测未完整执行，请确认列选择正确（特别是时间列）")
            
            if total > 0:
                st.subheader("冲突处理")
                
                filter_status = st.radio(
                    "筛选状态",
                    options=['待处理', '已解决', '已忽略', '全部'],
                    horizontal=True,
                    key='conflict_filter'
                )

                filter_type = st.multiselect(
                    "筛选类型（可选）",
                    options=list(by_type.keys()),
                    default=list(by_type.keys()),
                    key='conflict_filter_type'
                )
                
                display_conflicts = []
                for c in summary['conflicts']:
                    if filter_status == '待处理' and c.status != 'pending':
                        continue
                    elif filter_status == '已解决' and c.status != 'resolved':
                        continue
                    elif filter_status == '已忽略' and c.status != 'ignored':
                        continue
                    if c.conflict_type not in filter_type:
                        continue
                    display_conflicts.append(c)

                if not display_conflicts:
                    st.info("该筛选条件下没有冲突")
                
                for idx, c in enumerate(display_conflicts):
                    status_label = {'pending': '🟡 待处理', 'resolved': '✅ 已解决', 'ignored': '⚪ 已忽略'}[c.status]
                    sev_map = {'high': '🔴', 'medium': '🟡', 'low': '🔵'}
                    severity_icon = sev_map.get(c.severity, '⚪')

                    if c.conflict_type.startswith('数值'):
                        title_suffix = f"差异 {c.discrepancy:.2f} mm ({c.discrepancy_percent:.1f}%)"
                    elif c.conflict_type == '方向冲突':
                        title_suffix = f"方向不一致"
                    elif c.conflict_type == '微信方向缺失':
                        title_suffix = f"微信记录未说明方向"
                    elif c.conflict_type == '数据方向缺失':
                        title_suffix = f"实验数据方向无法识别"
                    else:
                        title_suffix = ""
                    
                    with st.expander(f"{status_label} {severity_icon} [{c.severity.upper()}] "
                                     f"{c.conflict_type} - {title_suffix}"
                                     f"{' | ' + c.resolution_note if c.resolution_note else ''}"):
                        col_a, col_b = st.columns(2)
                        with col_a:
                            st.write("**实验数据**")
                            if c.conflict_type.startswith('数值'):
                                st.info(f"数值: {c.data_value:.2f} mm")
                            elif c.conflict_type in ('方向冲突', '微信方向缺失', '数据方向缺失'):
                                # 从 suggestion 里抓实际方向展示
                                st.info(c.suggestion.split('，')[0].replace('方向不一致，', '').strip()
                                        if c.conflict_type == '方向冲突' else c.suggestion.split('，')[0])
                            st.caption(f"时间: {c.timestamp}")
                        with col_b:
                            st.write("**微信群记录**")
                            if c.conflict_type.startswith('数值'):
                                st.warning(f"数值: {c.wechat_value:.2f} mm")
                            st.code(c.wechat_record, language=None)
                        
                        st.write("**建议动作**")
                        st.success(c.suggestion)
                        
                        if c.status == 'pending':
                            note = st.text_input("处理说明（可选）", key=f"note_{c.conflict_id}_{idx}")
                            bcol1, bcol2 = st.columns(2)
                            with bcol1:
                                if st.button("✅ 标记为已解决", key=f"resolve_{c.conflict_id}_{idx}"):
                                    st.session_state.conflict_detector.mark_resolved(c.conflict_id, note)
                                    st.session_state.last_conflicts_summary = st.session_state.conflict_detector.get_conflict_summary()
                                    st.rerun()
                            with bcol2:
                                if st.button("⚪ 标记为已忽略", key=f"ignore_{c.conflict_id}_{idx}"):
                                    st.session_state.conflict_detector.mark_ignored(c.conflict_id, note)
                                    st.session_state.last_conflicts_summary = st.session_state.conflict_detector.get_conflict_summary()
                                    st.rerun()
                        else:
                            st.info(f"当前状态: {c.status} | 处理说明: {c.resolution_note or '无'}")
                            if st.button("↩️ 撤销处理（恢复为待处理）", key=f"reopen_{c.conflict_id}_{idx}"):
                                c.status = 'pending'
                                c.resolution_note = ''
                                if c.conflict_id in st.session_state.conflict_detector._resolved_keys:
                                    st.session_state.conflict_detector._resolved_keys.discard(c.conflict_id)
                                if c.conflict_id in st.session_state.conflict_detector._ignored_keys:
                                    st.session_state.conflict_detector._ignored_keys.discard(c.conflict_id)
                                st.session_state.last_conflicts_summary = st.session_state.conflict_detector.get_conflict_summary()
                                st.rerun()

            # 把处理状态暴露给"继续校准"判断
            st.session_state.pending_high_conflicts = pending_high
            
            st.divider()
            st.subheader("建议动作")
            actions = st.session_state.conflict_detector.get_suggested_actions()
            for action in actions:
                if action.startswith("⚠️"):
                    st.warning(action)
                elif action.startswith("✅"):
                    st.success(action)
                elif action.startswith("【"):
                    st.write(f"**{action}**")
                else:
                    st.write(f"• {action}")


elif page == "🔧 误差校准":
    st.header("🔧 误差校准")
    
    if st.session_state.raw_data is None:
        st.warning("请先在「数据导入」页面上传数据")
    else:
        df = st.session_state.raw_data
        
        col1, col2 = st.columns(2)
        
        with col1:
            raw_col = st.selectbox(
                "原始测量值列",
                options=df.columns.tolist(),
                index=df.columns.tolist().index(st.session_state.column_mapping.get('distance_raw', '')) if st.session_state.column_mapping.get('distance_raw') in df.columns else 0
            )
        
        with col2:
            ref_col = st.selectbox(
                "标准值列",
                options=df.columns.tolist(),
                index=df.columns.tolist().index(st.session_state.column_mapping.get('distance_reference', '')) if st.session_state.column_mapping.get('distance_reference') in df.columns else 0
            )
        
        direction_col = None
        if st.session_state.column_mapping.get('direction') in df.columns:
            direction_col = st.selectbox(
                "方向列（可选）",
                options=['(无)'] + df.columns.tolist(),
                index=df.columns.tolist().index(st.session_state.column_mapping.get('direction')) + 1
            )
        
        calibration_method = st.radio(
            "校准方法",
            options=["线性校准", "分段线性校准"],
            horizontal=True
        )
        
        segments = 3
        if calibration_method == "分段线性校准":
            segments = st.slider("分段数量", min_value=2, max_value=5, value=3)

        pending_high = st.session_state.get('pending_high_conflicts', None)
        if pending_high and pending_high > 0:
            st.error(f"⚠️ 检测到 {pending_high} 个 high 严重度冲突尚未处理，必须先在「微信群记录对比」页面标记处理")
        elif pending_high == 0 and st.session_state.get('last_conflicts_summary', {}).get('total_conflicts', 0):
            st.success("✅ 所有冲突已处理，可以继续校准")
        
        if st.button("执行校准", type="primary", disabled=(pending_high and pending_high > 0)):
            with st.spinner("正在计算校准参数..."):
                raw_values = pd.to_numeric(df[raw_col], errors='coerce').values
                ref_values = pd.to_numeric(df[ref_col], errors='coerce').values
                
                if calibration_method == "线性校准":
                    result = st.session_state.calibrator.linear_calibration(raw_values, ref_values)
                else:
                    result = st.session_state.calibrator.piecewise_linear_calibration(raw_values, ref_values, segments)
                
                st.session_state.calibration_result = result
                
                st.success("✅ 校准完成")
                
                col1, col2, col3, col4 = st.columns(4)
                col1.metric("校准偏差 (bias)", f"{result.bias:.6f} mm")
                col2.metric("比例系数 (scale)", f"{result.scale_factor:.6f}")
                col3.metric("RMSE", f"{result.rmse:.6f} mm")
                col4.metric("R²", f"{result.r_squared:.6f}")
                
                col1, col2 = st.columns(2)
                with col1:
                    st.metric("平均绝对误差 (MAE)", f"{result.mae:.6f} mm")
                with col2:
                    st.metric("最大绝对误差", f"{result.max_error:.6f} mm")
                
                st.divider()
                
                st.subheader("校准曲线")
                fig1 = st.session_state.report_generator.create_calibration_curve(
                    raw_values, ref_values,
                    np.array(result.corrected_values),
                    np.array(result.residuals)
                )
                st.plotly_chart(fig1, use_container_width=True)
                
                col1, col2 = st.columns(2)
                
                with col1:
                    st.subheader("误差分布")
                    fig2 = st.session_state.report_generator.create_error_histogram(
                        np.array(result.residuals)
                    )
                    st.plotly_chart(fig2, use_container_width=True)
                
                with col2:
                    if direction_col and direction_col != '(无)':
                        st.subheader("方向误差对比")
                        directions = df[direction_col].tolist()
                        dir_stats = st.session_state.calibrator.direction_analysis(
                            raw_values, ref_values, directions
                        )
                        if '正向' in dir_stats or '反向' in dir_stats:
                            fig3 = st.session_state.report_generator.create_direction_comparison(dir_stats)
                            st.plotly_chart(fig3, use_container_width=True)
                            
                            if '方向差异' in dir_stats:
                                if dir_stats['方向差异']['has_hysteresis']:
                                    st.warning("⚠️ 检测到明显的滞环误差，正向和反向误差差异显著")
                                else:
                                    st.info("✅ 正向和反向误差差异在可接受范围内")


elif page == "📊 报告生成":
    st.header("📊 报告生成")
    
    if st.session_state.calibration_result is None:
        st.warning("请先在「误差校准」页面完成校准")
    else:
        result = st.session_state.calibration_result
        df = st.session_state.raw_data
        
        raw_col = st.selectbox(
            "原始测量值列",
            options=df.columns.tolist(),
            index=df.columns.tolist().index(st.session_state.column_mapping.get('distance_raw', '')) if st.session_state.column_mapping.get('distance_raw') in df.columns else 0
        )
        ref_col = st.selectbox(
            "标准值列",
            options=df.columns.tolist(),
            index=df.columns.tolist().index(st.session_state.column_mapping.get('distance_reference', '')) if st.session_state.column_mapping.get('distance_reference') in df.columns else 0
        )
        
        raw_values = pd.to_numeric(df[raw_col], errors='coerce').values
        ref_values = pd.to_numeric(df[ref_col], errors='coerce').values
        
        st.subheader("校准结果摘要")
        error_stats = st.session_state.calibrator.get_error_statistics(raw_values, ref_values)
        summary_df = st.session_state.report_generator.create_summary_table(result, error_stats)
        st.table(summary_df)
        
        st.subheader("校准明细预览")
        detail_df = pd.DataFrame({
            '原始值': raw_values,
            '标准值': ref_values,
            '校准后': result.corrected_values,
            '残差': result.residuals
        })
        st.dataframe(detail_df, use_container_width=True)
        
        st.divider()
        st.subheader("生成报告")
        
        report_format = st.radio(
            "报告格式",
            options=["HTML交互式报告", "Excel数据报告"],
            horizontal=True
        )
        
        if st.button("生成报告", type="primary"):
            with st.spinner("正在生成报告..."):
                figs = []
                
                figs.append(st.session_state.report_generator.create_calibration_curve(
                    raw_values, ref_values,
                    np.array(result.corrected_values),
                    np.array(result.residuals)
                ))
                
                figs.append(st.session_state.report_generator.create_error_histogram(
                    np.array(result.residuals)
                ))
                
                warnings = st.session_state.validator.get_warnings()
                suggestions = st.session_state.conflict_detector.get_suggested_actions()
                
                if report_format == "HTML交互式报告":
                    report_path = st.session_state.report_generator.generate_html_report(
                        figs, summary_df, warnings, suggestions
                    )
                else:
                    report_path = st.session_state.report_generator.export_report_data(
                        df, result, 
                        st.session_state.validation_report or {},
                        raw_col=raw_col,
                        ref_col=ref_col
                    )
                
                st.success(f"✅ 报告已生成: {report_path}")
                
                with open(report_path, 'rb') as f:
                    file_bytes = f.read()
                
                st.download_button(
                    label="⬇️ 下载报告",
                    data=file_bytes,
                    file_name=Path(report_path).name,
                    mime='text/html' if report_format == "HTML交互式报告" else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                )


st.sidebar.divider()
st.sidebar.info("""
**使用流程：**
1. 📥 导入实验数据、照片说明和工况记录
2. ✅ 进行数据质量验证
3. ⚖️ 检测与微信群记录的冲突
4. 🔧 执行误差校准
5. 📊 生成校准报告
""")
