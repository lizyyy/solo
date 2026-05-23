#!/usr/bin/env python3
"""
完整流程测试脚本
演示：初始化数据库 -> 导入样例 -> 触发坏数据 -> 人工修正 -> 生成报告
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import json
from datetime import datetime, timedelta
from app.database import SessionLocal
from app.models import UserRole, DataSource, LedgerStatus, PermissionResult
from app.services.auth_service import AuthService
from app.services.import_service import ImportService
from app.services.workflow_service import WorkflowService
from app.services.export_service import ExportService


def print_header(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_step(step, desc):
    print(f"\n  [{step}] {desc}")
    print("  " + "-" * 50)


def main():
    print_header("园区访客通行权限追责台账 - 完整流程演示")

    db = SessionLocal()

    try:
        print_step("1", "初始化服务")
        auth_service = AuthService(db)
        import_service = ImportService(db)
        workflow_service = WorkflowService(db)
        export_service = ExportService(db)
        print("    ✓ 服务初始化完成")

        print_step("2", "获取测试用户")
        admin_user = auth_service.get_user("admin")
        operator_user = auth_service.get_user("operator")
        auditor_user = auth_service.get_user("auditor")
        security_user = auth_service.get_user("security")

        if not admin_user:
            print("    ⚠  默认用户不存在，正在创建...")
            admin_user = auth_service.create_user("admin", "admin123", "系统管理员", UserRole.ADMIN)
            operator_user = auth_service.create_user("operator", "operator123", "操作员", UserRole.OPERATOR)
            auditor_user = auth_service.create_user("auditor", "auditor123", "审核员", UserRole.AUDITOR)
            security_user = auth_service.create_user("security", "security123", "安保主管", UserRole.SECURITY_SUPERVISOR)

        print(f"    ✓ 管理员: {admin_user.username}")
        print(f"    ✓ 操作员: {operator_user.username}")
        print(f"    ✓ 审核员: {auditor_user.username}")
        print(f"    ✓ 安保主管: {security_user.username}")

        print_step("3", "导入访客预约表（模拟Excel导入）")
        import pandas as pd

        appointment_data = [
            {
                "访客姓名": "张三",
                "联系电话": "13800138001",
                "身份证号": "110101199001011234",
                "来访事由": "商务洽谈",
                "被访人": "李经理",
                "被访部门": "市场部",
                "临时车牌": "京A12345",
                "预约开始时间": datetime(2024, 1, 15, 9, 0),
                "预约结束时间": datetime(2024, 1, 15, 17, 0),
                "权限开通时间": datetime(2024, 1, 15, 8, 0),
                "权限收回时间": datetime(2024, 1, 15, 18, 0),
            },
            {
                "访客姓名": "李四",
                "联系电话": "13800138002",
                "身份证号": "110101199002022345",
                "来访事由": "设备维修",
                "被访人": "王主管",
                "被访部门": "运维部",
                "临时车牌": "京B67890",
                "预约开始时间": datetime(2024, 1, 16, 9, 0),
                "预约结束时间": datetime(2024, 1, 17, 12, 0),
                "权限开通时间": datetime(2024, 1, 16, 8, 0),
                "权限收回时间": datetime(2024, 1, 17, 14, 0),
            },
            {
                "访客姓名": "",
                "联系电话": "13800138003",
                "身份证号": "",
                "来访事由": "客户拜访",
                "被访人": "陈总监",
                "被访部门": "销售部",
                "临时车牌": "",
                "预约开始时间": datetime(2024, 1, 17, 10, 0),
                "预约结束时间": datetime(2024, 1, 17, 16, 0),
                "权限开通时间": None,
                "权限收回时间": None,
            },
        ]

        df = pd.DataFrame(appointment_data)
        import io
        excel_buffer = io.BytesIO()
        df.to_excel(excel_buffer, index=False)
        excel_buffer.seek(0)

        batch = import_service.import_from_excel(
            excel_buffer.read(),
            "visitor_appointments.xlsx",
            DataSource.VISITOR_APPOINTMENT,
            operator_user
        )

        print(f"    批次号: {batch.batch_id}")
        print(f"    总行数: {batch.total_rows}")
        print(f"    成功: {batch.success_count}, 失败: {batch.failed_count}, 跳过: {batch.skipped_count}")
        print(f"    状态: {batch.status}")

        print_step("4", "查看导入的台账记录")
        from app.models import VisitorLedger
        ledgers = db.query(VisitorLedger).all()

        for ledger in ledgers:
            cross_day_marker = " ⚠ 跨天问题" if ledger.is_cross_day else ""
            print(f"    - {ledger.ledger_no} | {ledger.visitor_name or '未知'} | {ledger.temp_plate_number or '无车牌'} | {ledger.status.value} | {ledger.permission_result.value}{cross_day_marker}")

        print_step("5", "操作员提交第一条记录")
        first_ledger = ledgers[0]
        updated = workflow_service.submit(
            first_ledger.id,
            operator_user,
            comment="数据核查无误，提交审核",
            change_reason="首次录入提交"
        )
        print(f"    {first_ledger.ledger_no} 状态变更: {LedgerStatus.DRAFT.value} -> {updated.status.value}")

        print_step("6", "操作员撤回提交")
        withdrawn = workflow_service.withdraw(
            first_ledger.id,
            operator_user,
            comment="发现信息有误，撤回修改",
            change_reason="访客车牌信息需要补充"
        )
        print(f"    {first_ledger.ledger_no} 状态变更: {LedgerStatus.SUBMITTED.value} -> {withdrawn.status.value}")

        print_step("7", "编辑修改后重新提交")
        updated_data = {
            "temp_plate_number": "京A12345",
            "visit_purpose": "重要商务洽谈"
        }
        edited = workflow_service.edit_draft(
            first_ledger.id,
            operator_user,
            updated_data,
            change_reason="修正来访事由和车牌信息"
        )

        resubmitted = workflow_service.submit(
            first_ledger.id,
            operator_user,
            comment="修正后重新提交"
        )
        print(f"    {first_ledger.ledger_no} 状态变更: {LedgerStatus.DRAFT.value} -> {resubmitted.status.value}")

        print_step("8", "审核员驳回（发现跨天问题）")
        cross_day_ledger = next((l for l in ledgers if l.is_cross_day), None)
        if cross_day_ledger:
            submitted = workflow_service.submit(
                cross_day_ledger.id,
                operator_user,
                comment="提交审核"
            )
            print(f"    {cross_day_ledger.ledger_no} 已提交")

            rejected = workflow_service.reject(
                cross_day_ledger.id,
                auditor_user,
                comment="跨天权限问题需要人工核实",
                change_reason="跨天权限未收回，存在安全风险"
            )
            print(f"    {cross_day_ledger.ledger_no} 状态变更: {LedgerStatus.SUBMITTED.value} -> {rejected.status.value}")

        print_step("9", "审核员进行人工改判")
        if cross_day_ledger:
            judged = workflow_service.manual_judgment(
                cross_day_ledger.id,
                auditor_user,
                PermissionResult.MANUAL_JUDGMENT,
                "经核实，该访客为设备维修人员，因设备抢修需要跨天，已获得部门负责人审批，权限已按时收回"
            )
            print(f"    {cross_day_ledger.ledger_no} 人工改判: {judged.permission_result.value}")
            print(f"    改判原因: {judged.judgment_reason}")

        print_step("10", "安保主管二次确认并最终确认")
        for ledger in ledgers[:2]:
            if ledger.status == LedgerStatus.DRAFT:
                workflow_service.submit(ledger.id, operator_user)

            if ledger.status == LedgerStatus.SUBMITTED:
                second_confirmed = workflow_service.second_confirmation(
                    ledger.id,
                    security_user,
                    comment="安保核查通过",
                    change_reason="安保主管二次确认"
                )
                print(f"    {ledger.ledger_no} 二次确认完成")

                final_confirmed = workflow_service.confirm(
                    ledger.id,
                    security_user,
                    comment="最终确认无误",
                    change_reason="流程闭环"
                )
                print(f"    {ledger.ledger_no} 最终确认: {final_confirmed.status.value}")

        print_step("11", "添加临时补录单")
        supplement = workflow_service.add_supplement(
            first_ledger.id,
            auditor_user,
            "纸质证明补录",
            {
                "document_type": "访客登记单",
                "document_no": "FD20240115001",
                "received_by": "张保安",
                "received_time": "2024-01-15 08:30:00"
            },
            "纸质访客登记单扫描件存档"
        )
        print(f"    补录单ID: {supplement.id}, 类型: {supplement.supplement_type}")

        print_step("12", "导出前冻结记录")
        frozen = workflow_service.freeze(
            first_ledger.id,
            security_user,
            comment="导出审计前冻结",
            change_reason="审计导出冻结"
        )
        print(f"    {first_ledger.ledger_no} 已冻结: {frozen.status.value}")

        print_step("13", "查看版本历史")
        versions = workflow_service.get_version_history(first_ledger.id)
        for v in versions:
            print(f"    版本{v.version_number}: {v.action_type} | {v.operator_name} | {v.created_at.strftime('%H:%M:%S')}")
            if v.change_reason:
                print(f"        原因: {v.change_reason}")

        print_step("14", "查看工作流日志")
        logs = workflow_service.get_workflow_logs(first_ledger.id)
        for log in logs:
            from_state = log.from_status.value if log.from_status else "无"
            print(f"    {log.action}: {from_state} -> {log.to_status.value} | {log.operator_name}({log.operator_role})")

        print_step("15", "版本对比（版本1 vs 版本2）")
        if len(versions) >= 2:
            diff = workflow_service.compare_versions(first_ledger.id, 1, 2)
            if diff['diff']:
                for field, change in diff['diff'].items():
                    print(f"    {field}: {change['previous']} -> {change['current']}")
            else:
                print("    无差异")

        print_step("16", "查看系统统计")
        stats = export_service.get_statistics(admin_user)
        for key, value in stats.items():
            print(f"    {key}: {value}")

        print_step("17", "安保主管视图")
        try:
            supervisor_view = export_service.get_security_supervisor_view(security_user)
            print("    状态汇总:")
            for status, count in supervisor_view['role_summary'].items():
                print(f"      {status}: {count}")

            print(f"    跨天问题记录: {len(supervisor_view['cross_day_issues'])} 条")
            print(f"    人工改判记录: {len(supervisor_view['recent_manual_judgments'])} 条")
            print(f"    待审批记录: {len(supervisor_view['pending_approvals'])} 条")
        except PermissionError as e:
            print(f"    权限验证: {e}")

        print_step("18", "脱敏导出测试")
        all_ledger_ids = [l.id for l in ledgers]
        json_export = export_service.export_to_json(
            all_ledger_ids,
            security_user,
            include_workflow=True,
            include_version_history=True,
            mask_sensitive=True
        )

        export_data = json.loads(json_export)
        print(f"    导出记录数: {len(export_data)}")
        if export_data:
            first = export_data[0]
            print(f"    联系电话(脱敏): {first.get('联系电话', 'N/A')}")
            print(f"    身份证号(脱敏): {first.get('身份证号', 'N/A')}")
            print(f"    工作流记录数: {len(first.get('工作流记录', []))}")
            print(f"    版本历史数: {len(first.get('版本历史', []))}")

        print_header("流程演示完成")
        print("\n  演示总结:")
        print("  ✓ 数据导入（含重复检测、部分失败处理）")
        print("  ✓ 草稿->提交->撤回->重新提交流程")
        print("  ✓ 驳回->人工改判流程")
        print("  ✓ 二次确认->最终确认流程")
        print("  ✓ 临时补录单追加")
        print("  ✓ 导出前冻结")
        print("  ✓ 版本历史和差异对比")
        print("  ✓ 工作流日志追踪")
        print("  ✓ 角色视图和脱敏导出")
        print("\n  API文档: http://localhost:8000/docs")

    except Exception as e:
        print(f"\n  ✗ 错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
