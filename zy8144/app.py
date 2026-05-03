import streamlit as st
import pandas as pd
import json
import yaml
from datetime import datetime, date
from io import StringIO, BytesIO
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src import (
    ConfigLoader,
    CompatibilityChecker,
    InventoryManager,
    AppointmentManager,
    AllocationEngine,
    IssueDetector,
    ReportGenerator
)


def load_sample_data():
    base_dir = os.path.dirname(os.path.abspath(__file__))

    config_loader = ConfigLoader(os.path.join(base_dir, 'config'))
    config_loader.load_compatibility_config()
    config_loader.load_campus_config()

    inventory_manager = InventoryManager()
    inventory_path = os.path.join(base_dir, 'data', 'sample_inventory.csv')
    inventory_manager.load_from_csv(inventory_path)

    appointment_manager = AppointmentManager()
    appointments_path = os.path.join(base_dir, 'data', 'sample_appointments.json')
    appointment_manager.load_from_json(appointments_path)

    return config_loader, inventory_manager, appointment_manager


def process_allocation(config_loader, inventory_manager, appointment_manager, current_date):
    compatibility_checker = CompatibilityChecker(config_loader)

    allocation_engine = AllocationEngine(
        config_loader,
        compatibility_checker,
        inventory_manager,
        appointment_manager
    )

    allocation_results, unmet_appointments = allocation_engine.run_allocation(current_date)

    issue_detector = IssueDetector(
        config_loader,
        compatibility_checker,
        inventory_manager,
        appointment_manager,
        allocation_engine
    )
    issues = issue_detector.detect_all_issues(current_date)

    report_generator = ReportGenerator(
        config_loader,
        inventory_manager,
        appointment_manager,
        allocation_engine,
        issue_detector
    )

    return allocation_engine, issue_detector, report_generator


def main():
    st.set_page_config(
        page_title="血库红细胞库存效期调拨看板",
        page_icon="🩸",
        layout="wide"
    )

    st.title("🩸 血库红细胞库存效期调拨看板")
    st.markdown("---")

    if 'initialized' not in st.session_state:
        st.session_state.initialized = False
        st.session_state.config_loader = None
        st.session_state.inventory_manager = None
        st.session_state.appointment_manager = None
        st.session_state.allocation_engine = None
        st.session_state.issue_detector = None
        st.session_state.report_generator = None
        st.session_state.current_date = datetime.now()
        st.session_state.use_sample_data = True

    with st.sidebar:
        st.header("📁 数据配置")

        data_source = st.radio(
            "数据源选择",
            ["使用示例数据", "上传自定义数据"],
            index=0 if st.session_state.use_sample_data else 1
        )

        if data_source == "上传自定义数据":
            st.session_state.use_sample_data = False

            inventory_file = st.file_uploader("上传库存 CSV", type=['csv'])
            appointments_file = st.file_uploader("上传预约 JSON", type=['json'])
            compatibility_file = st.file_uploader("上传血型规则 YAML", type=['yaml', 'yml'])
            distance_file = st.file_uploader("上传院区距离 YAML", type=['yaml', 'yml'])

            if st.button("加载数据"):
                try:
                    config_loader = ConfigLoader()

                    if compatibility_file:
                        config_loader.compatibility_config = yaml.safe_load(compatibility_file)
                    else:
                        config_loader.load_compatibility_config()

                    if distance_file:
                        config_loader.campus_config = yaml.safe_load(distance_file)
                    else:
                        config_loader.load_campus_config()

                    inventory_manager = InventoryManager()
                    if inventory_file:
                        inventory_manager.inventory_df = pd.read_csv(inventory_file)
                        inventory_manager._process_dates()
                    else:
                        st.error("请上传库存 CSV 文件")

                    appointment_manager = AppointmentManager()
                    if appointments_file:
                        appointment_manager.appointments = json.load(appointments_file)
                    else:
                        st.error("请上传预约 JSON 文件")

                    st.session_state.config_loader = config_loader
                    st.session_state.inventory_manager = inventory_manager
                    st.session_state.appointment_manager = appointment_manager
                    st.session_state.initialized = True
                    st.success("数据加载成功！")
                except Exception as e:
                    st.error(f"数据加载失败: {e}")
        else:
            st.session_state.use_sample_data = True
            if st.button("加载示例数据") or not st.session_state.initialized:
                try:
                    config_loader, inventory_manager, appointment_manager = load_sample_data()
                    st.session_state.config_loader = config_loader
                    st.session_state.inventory_manager = inventory_manager
                    st.session_state.appointment_manager = appointment_manager
                    st.session_state.initialized = True
                    st.success("示例数据加载成功！")
                except Exception as e:
                    st.error(f"示例数据加载失败: {e}")

        st.markdown("---")
        st.header("⚙️ 分析设置")

        st.session_state.current_date = st.date_input(
            "分析日期",
            value=st.session_state.current_date.date() if isinstance(st.session_state.current_date, datetime) else date.today()
        )
        if isinstance(st.session_state.current_date, date):
            st.session_state.current_date = datetime.combine(st.session_state.current_date, datetime.min.time())

        if st.session_state.initialized and st.session_state.config_loader:
            st.markdown("---")
            st.header("🔍 筛选条件")

            all_campuses = [c['id'] for c in st.session_state.config_loader.get_all_campuses()]
            campus_names = {c['id']: c['name'] for c in st.session_state.config_loader.get_all_campuses()}

            st.session_state.filter_campuses = st.multiselect(
                "院区",
                options=all_campuses,
                default=all_campuses,
                format_func=lambda x: campus_names.get(x, x)
            )

            all_blood_types = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"]
            st.session_state.filter_blood_types = st.multiselect(
                "血型",
                options=all_blood_types,
                default=all_blood_types
            )

            st.session_state.filter_expiry_risk = st.selectbox(
                "效期风险",
                options=["全部", "临期(≤2天)", "预警(3-5天)", "正常(>5天)"],
                index=0
            )

    if not st.session_state.initialized:
        st.info("👈 请在左侧侧边栏选择数据源并加载数据")
        st.markdown("""
        ### 功能说明

        本看板用于血库红细胞库存效期管理和调拨决策，主要功能包括：

        1. **库存概览** - 查看各院区、各血型的库存分布
        2. **预约占用分析** - 分析用血预约和库存分配情况
        3. **临期优先** - 识别即将过期的血袋并给出分配建议
        4. **稀有血型短缺** - 监测稀有血型库存状态
        5. **跨院调拨建议** - 根据库存和需求给出调拨方案
        6. **问题检测** - 自动检测血型不相容、重复分配等问题
        7. **报告导出** - 导出评审报告和问题清单

        ### 数据格式

        - **库存 CSV**: 包含血袋编号、血型、效期、院区等信息
        - **预约 JSON**: 包含患者信息、所需血型、手术时间等
        - **血型规则 YAML**: 定义 ABO/Rh 血型相容规则
        - **院区距离 YAML**: 定义各院区之间的运输时间
        """)
        return

    current_date = st.session_state.current_date
    config_loader = st.session_state.config_loader
    inventory_manager = st.session_state.inventory_manager
    appointment_manager = st.session_state.appointment_manager

    try:
        allocation_engine, issue_detector, report_generator = process_allocation(
            config_loader, inventory_manager, appointment_manager, current_date
        )
        st.session_state.allocation_engine = allocation_engine
        st.session_state.issue_detector = issue_detector
        st.session_state.report_generator = report_generator
    except Exception as e:
        st.error(f"分析处理失败: {e}")
        return

    tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
        "📊 库存概览",
        "📋 预约占用",
        "⏰ 临期优先",
        "⚠️ 问题检测",
        "🚚 调拨建议",
        "📄 导出报告"
    ])

    with tab1:
        st.header("库存概览")

        inventory_summary = inventory_manager.get_inventory_summary(current_date)

        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("总血袋数", inventory_summary.get('total_bags', 0))
        with col2:
            st.metric("总容量(ml)", inventory_summary.get('total_volume_ml', 0))
        with col3:
            expiry = inventory_summary.get('expiry_summary', {})
            st.metric("临期(≤2天)", expiry.get('critical', 0), delta_color="inverse")
        with col4:
            st.metric("预警(3-5天)", expiry.get('warning', 0), delta_color="off")

        st.subheader("按血型分布")
        by_type = inventory_summary.get('by_blood_type', {})
        if by_type:
            type_df = pd.DataFrame([
                {
                    '血型': bt,
                    '容量(ml)': vol,
                    '袋数': vol // 450,
                    '稀有血型': '是' if config_loader.is_rare_blood_type(bt) else '否'
                }
                for bt, vol in sorted(by_type.items())
            ])
            st.dataframe(type_df, use_container_width=True, hide_index=True)

        st.subheader("按院区分布")
        by_campus = inventory_summary.get('by_campus', {})
        if by_campus:
            campus_df = pd.DataFrame([
                {
                    '院区': config_loader.get_campus_name(campus_id),
                    '容量(ml)': vol,
                    '袋数': vol // 450
                }
                for campus_id, vol in by_campus.items()
            ])
            st.dataframe(campus_df, use_container_width=True, hide_index=True)

        st.subheader("库存明细")
        filter_expiry_map = {
            "全部": None,
            "临期(≤2天)": "critical",
            "预警(3-5天)": "warning",
            "正常(>5天)": "normal"
        }
        expiry_filter = filter_expiry_map.get(st.session_state.get('filter_expiry_risk', '全部'))

        filtered_inventory = inventory_manager.filter_inventory(
            campuses=st.session_state.get('filter_campuses'),
            blood_types=st.session_state.get('filter_blood_types'),
            expiry_risk=expiry_filter,
            current_date=current_date
        )

        if not filtered_inventory.empty:
            display_df = filtered_inventory.copy()
            display_df['days_until_expiry'] = (display_df['expiry_date'] - pd.Timestamp(current_date)).dt.days
            display_df['院区名称'] = display_df['campus'].apply(config_loader.get_campus_name)
            display_df = display_df[[
                'blood_bag_id', 'blood_type', 'volume_ml', '院区名称',
                'storage_location', 'days_until_expiry', 'status'
            ]]
            display_df.columns = ['血袋编号', '血型', '容量(ml)', '院区', '库位', '剩余天数', '状态']
            st.dataframe(display_df, use_container_width=True, hide_index=True)

    with tab2:
        st.header("预约占用分析")

        appointment_summary = appointment_manager.get_appointments_summary()

        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("总预约数", appointment_summary.get('total_appointments', 0))
        with col2:
            st.metric("总需求(ml)", appointment_summary.get('total_required_volume_ml', 0))
        with col3:
            st.metric("急诊预约", sum(1 for a in appointment_manager.appointments if a.get('urgency') == 'emergency'))
        with col4:
            st.metric("跨午夜预约", appointment_summary.get('cross_midnight_count', 0))

        st.subheader("预约列表")
        appointments = appointment_manager.appointments

        if appointments:
            apt_df = pd.DataFrame([
                {
                    '预约编号': a['appointment_id'],
                    '患者': a.get('patient_name', ''),
                    '科室': a.get('department', ''),
                    '院区': config_loader.get_campus_name(a['campus']),
                    '所需血型': a['required_blood_type'],
                    '所需容量(ml)': a['required_volume_ml'],
                    '紧急程度': '急诊' if a.get('urgency') == 'emergency' else '常规',
                    '开始时间': a['scheduled_start_time'],
                    '结束时间': a['scheduled_end_time'],
                    '跨午夜': '是' if appointment_manager.is_cross_midnight(a) else '否'
                }
                for a in appointments
            ])
            st.dataframe(apt_df, use_container_width=True, hide_index=True)

        st.subheader("分配结果")
        allocation_results = allocation_engine.allocation_results

        if allocation_results:
            for result in allocation_results:
                status_color = {
                    'fully_allocated': '🟢',
                    'partially_allocated': '🟡',
                    'unallocated': '🔴'
                }.get(result['status'], '⚪')

                status_text = {
                    'fully_allocated': '完全分配',
                    'partially_allocated': '部分分配',
                    'unallocated': '未分配'
                }.get(result['status'], '未知')

                with st.expander(
                    f"{status_color} {result['appointment_id']} - {result['patient_name']} ({status_text})",
                    expanded=True
                ):
                    col1, col2, col3 = st.columns(3)
                    with col1:
                        st.write(f"**所需血型**: {result['required_blood_type']}")
                        st.write(f"**院区**: {config_loader.get_campus_name(result['campus'])}")
                    with col2:
                        st.write(f"**所需容量**: {result['required_volume_ml']} ml")
                        st.write(f"**紧急程度**: {result['urgency']}")
                    with col3:
                        st.write(f"**已分配**: {result['total_assigned_volume_ml']} ml")
                        st.write(f"**未满足**: {result['unmet_volume_ml']} ml")

                    if result['assigned_bags']:
                        st.write("**分配的血袋**:")
                        bags_df = pd.DataFrame([
                            {
                                '血袋编号': b['bag_id'],
                                '血型': b['blood_type'],
                                '容量(ml)': b['volume_ml'],
                                '来源院区': config_loader.get_campus_name(b['campus']),
                                '剩余天数': b['days_until_expiry'],
                                '相容性': b['compatibility_label'],
                                '需要调拨': '是' if b.get('transfer_needed') else '否'
                            }
                            for b in result['assigned_bags']
                        ])
                        st.dataframe(bags_df, use_container_width=True, hide_index=True)

    with tab3:
        st.header("临期优先分配")

        expiring_priority = allocation_engine.get_expiring_priority_list(current_date)

        if expiring_priority.empty:
            st.success("暂无临期血袋需要优先处理")
        else:
            col1, col2 = st.columns(2)
            with col1:
                st.metric("临期血袋总数", len(expiring_priority))
            with col2:
                critical_count = len(expiring_priority[expiring_priority['expiry_risk'] == 'critical'])
                st.metric("临期(≤2天)", critical_count, delta_color="inverse")

            st.subheader("临期血袋优先级列表")

            for idx, row in expiring_priority.iterrows():
                risk_icon = "🔴" if row['expiry_risk'] == 'critical' else "🟡"

                with st.expander(
                    f"{risk_icon} {row['blood_bag_id']} - {row['blood_type']} (剩余{row['days_until_expiry']}天)",
                    expanded=row['expiry_risk'] == 'critical'
                ):
                    col1, col2, col3 = st.columns(3)
                    with col1:
                        st.write(f"**血型**: {row['blood_type']}")
                        st.write(f"**院区**: {config_loader.get_campus_name(row['campus'])}")
                    with col2:
                        st.write(f"**剩余天数**: {row['days_until_expiry']} 天")
                        st.write(f"**风险等级**: {'临期' if row['expiry_risk'] == 'critical' else '预警'}")
                    with col3:
                        st.write(f"**匹配预约数**: {row['matching_appointments_count']} 例")
                        st.write(f"**优先级分数**: {row['priority_score']:.2f}")

                    matches = row.get('matching_appointments', [])
                    if matches:
                        st.write("**建议分配给**:")
                        matches_df = pd.DataFrame([
                            {
                                '预约编号': m['appointment_id'],
                                '患者': m['patient_name'],
                                '紧急程度': '急诊' if m.get('urgency') == 'emergency' else '常规',
                                '院区': config_loader.get_campus_name(m['campus'])
                            }
                            for m in matches
                        ])
                        st.dataframe(matches_df, use_container_width=True, hide_index=True)
                    else:
                        st.warning("⚠️ 该血袋暂无匹配的预约，建议考虑跨院调拨或紧急使用")

    with tab4:
        st.header("问题检测")

        issue_stats = issue_detector.get_issue_statistics()

        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("总问题数", issue_stats.get('total_issues', 0))
        with col2:
            st.metric("严重问题", issue_stats.get('by_severity', {}).get('critical', 0), delta_color="inverse")
        with col3:
            st.metric("警告问题", issue_stats.get('by_severity', {}).get('warning', 0), delta_color="off")

        st.subheader("问题列表")

        issues = issue_detector.issues

        if not issues:
            st.success("🎉 未检测到任何问题")
        else:
            for issue in issues:
                severity_icon = "🔴" if issue.get('severity') == 'critical' else "🟡"
                issue_type_names = {
                    'duplicate_assignment': '重复分配',
                    'incompatible_blood': '血型不相容',
                    'cross_midnight': '跨午夜预约',
                    'expiring_soon': '临期血袋',
                    'rare_shortage': '稀有血型短缺',
                    'unmet_demand': '需求未满足',
                    'time_overlap': '时间重叠'
                }
                issue_type_name = issue_type_names.get(issue.get('issue_type', ''), issue.get('issue_type', ''))

                with st.expander(
                    f"{severity_icon} [{issue_type_name}] {issue.get('description', '')}",
                    expanded=issue.get('severity') == 'critical'
                ):
                    st.write(f"**问题类型**: {issue_type_name}")
                    st.write(f"**严重程度**: {'严重' if issue.get('severity') == 'critical' else '警告'}")
                    st.write(f"**描述**: {issue.get('description', '')}")
                    st.write(f"**建议**: {issue.get('recommendation', '')}")

                    for key in ['bag_id', 'appointment_id', 'blood_type', 'patient_name', 'campus']:
                        if key in issue and issue[key]:
                            key_names = {
                                'bag_id': '血袋编号',
                                'appointment_id': '预约编号',
                                'blood_type': '血型',
                                'patient_name': '患者',
                                'campus': '院区'
                            }
                            st.write(f"**{key_names.get(key, key)}**: {issue[key]}")

        st.subheader("问题统计")
        by_type = issue_stats.get('by_type', {})
        if by_type:
            stats_df = pd.DataFrame([
                {
                    '问题类型': issue_type_names.get(issue_type, issue_type),
                    '数量': count
                }
                for issue_type, count in by_type.items() if count > 0
            ])
            st.dataframe(stats_df, use_container_width=True, hide_index=True)

    with tab5:
        st.header("跨院调拨建议")

        transfer_suggestions = allocation_engine.get_cross_campus_transfer_suggestions()

        if not transfer_suggestions:
            st.success("暂无跨院调拨需求")
        else:
            col1, col2 = st.columns(2)
            with col1:
                st.metric("需要调拨的血袋数", len(transfer_suggestions))
            with col2:
                emergency_count = sum(1 for t in transfer_suggestions if t.get('urgency') == 'emergency')
                st.metric("急诊调拨", emergency_count, delta_color="inverse")

            st.subheader("调拨详情")

            transfer_df = pd.DataFrame([
                {
                    '血袋编号': t['bag_id'],
                    '血型': t['blood_type'],
                    '来源院区': config_loader.get_campus_name(t['from_campus']),
                    '目标院区': config_loader.get_campus_name(t['to_campus']),
                    '运输时间(分钟)': t['distance_minutes'],
                    '用于预约': t['appointment_id'],
                    '患者': t['patient_name'],
                    '紧急程度': '急诊' if t.get('urgency') == 'emergency' else '常规'
                }
                for t in transfer_suggestions
            ])
            st.dataframe(transfer_df, use_container_width=True, hide_index=True)

            st.subheader("调拨路线汇总")
            route_summary = {}
            for t in transfer_suggestions:
                key = (t['from_campus'], t['to_campus'])
                if key not in route_summary:
                    route_summary[key] = {
                        'count': 0,
                        'blood_types': set(),
                        'distance': t['distance_minutes']
                    }
                route_summary[key]['count'] += 1
                route_summary[key]['blood_types'].add(t['blood_type'])

            route_df = pd.DataFrame([
                {
                    '来源院区': config_loader.get_campus_name(from_c),
                    '目标院区': config_loader.get_campus_name(to_c),
                    '血袋数': data['count'],
                    '涉及血型': ', '.join(sorted(data['blood_types'])),
                    '运输时间(分钟)': data['distance']
                }
                for (from_c, to_c), data in route_summary.items()
            ])
            st.dataframe(route_df, use_container_width=True, hide_index=True)

    with tab6:
        st.header("导出报告")

        report_content = report_generator.generate_review_report(current_date)
        issues_csv = report_generator.generate_issues_csv()

        col1, col2 = st.columns(2)

        with col1:
            st.subheader("评审报告 (review_report.md)")
            with st.expander("预览报告", expanded=True):
                st.markdown(report_content)

            st.download_button(
                label="📥 下载 review_report.md",
                data=report_content,
                file_name=f"review_report_{current_date.strftime('%Y%m%d_%H%M%S')}.md",
                mime="text/markdown"
            )

        with col2:
            st.subheader("问题清单 (issues.csv)")

            issues_df = issue_detector.get_issues_dataframe()
            if issues_df.empty:
                st.info("暂无问题需要记录")
            else:
                with st.expander("预览问题清单", expanded=True):
                    st.dataframe(issues_df, use_container_width=True, hide_index=True)

            st.download_button(
                label="📥 下载 issues.csv",
                data=issues_csv,
                file_name=f"issues_{current_date.strftime('%Y%m%d_%H%M%S')}.csv",
                mime="text/csv"
            )

        st.markdown("---")
        st.subheader("批量导出")

        if st.button("📦 导出所有文件", type="primary"):
            try:
                output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output')
                saved_paths = report_generator.save_report(output_dir, current_date)

                st.success(f"文件已导出到:")
                st.code(f"报告: {saved_paths['report_path']}\n问题: {saved_paths['issues_path']}")
            except Exception as e:
                st.error(f"导出失败: {e}")


if __name__ == "__main__":
    main()
