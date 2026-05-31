import json
from datetime import datetime, timedelta
from package_parser import PackageParser
from rollback_engine import RollbackEngine
from models import RecordStatus, IssueType


def create_test_package():
    now = datetime.now()
    return {
        "package_id": "TEST-PKG-001",
        "received_time": now.strftime("%Y-%m-%d %H:%M:%S"),
        "permission_table": {
            "version": "v2.0",
            "effective_date": "2026-05-01",
            "entries": {
                "张三": ["审批", "查看"],
                "李四": ["审批", "查看", "修改"],
                "王五": ["查看"]
            },
            "source_file": "permission_v2.xlsx"
        },
        "records": [
            {
                "record_id": "REC-001",
                "approval_id": "APR-2026-0501-001",
                "applicant": "张三",
                "approver": "李四",
                "approval_time": (now - timedelta(days=5)).strftime("%Y-%m-%d %H:%M:%S"),
                "status": "已通过",
                "content": "采购办公用品申请",
                "idempotent_key": "IDEMP-001-ABC",
                "client_version": "2.5",
                "audit_log_ids": ["LOG-001", "LOG-002", "LOG-003"],
                "permission_table_version": "v1.0",
                "attachments": [
                    {
                        "attachment_id": "ATT-001",
                        "name": "采购清单.pdf",
                        "upload_time": (now - timedelta(days=5, hours=-2)).strftime("%Y-%m-%d %H:%M:%S"),
                        "content_hash": "abc123"
                    }
                ],
                "manual_corrections": []
            },
            {
                "record_id": "REC-002",
                "approval_id": "APR-2026-0501-002",
                "applicant": "王五",
                "approver": "李四",
                "approval_time": (now - timedelta(days=10)).strftime("%Y-%m-%d %H:%M:%S"),
                "status": "已通过",
                "content": "出差报销申请",
                "idempotent_key": "IDEMP-002-DEF",
                "client_version": "2.5",
                "audit_log_ids": ["LOG-004", "LOG-005", "LOG-006"],
                "permission_table_version": "v2.0",
                "attachments": [
                    {
                        "attachment_id": "ATT-002",
                        "name": "发票扫描件.jpg",
                        "upload_time": (now - timedelta(days=10)).strftime("%Y-%m-%d %H:%M:%S"),
                        "content_hash": "def456"
                    }
                ],
                "manual_corrections": [
                    {
                        "correction_id": "CORR-001",
                        "field_name": "报销金额",
                        "old_value": "1500",
                        "new_value": "1650",
                        "operator": "系统管理员",
                        "correction_time": (now - timedelta(days=8)).strftime("%Y-%m-%d %H:%M:%S"),
                        "reason": "发票金额录入错误"
                    }
                ]
            },
            {
                "record_id": "REC-003",
                "approval_id": "APR-2026-0501-003",
                "applicant": "赵六",
                "approver": "",
                "approval_time": (now - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S"),
                "status": "已通过",
                "content": "设备采购申请",
                "idempotent_key": "IDEMP-003-GHI",
                "client_version": "1.8",
                "audit_log_ids": ["LOG-007"],
                "permission_table_version": "v2.0",
                "attachments": [],
                "manual_corrections": []
            },
            {
                "record_id": "REC-004",
                "approval_id": "APR-2026-0501-004",
                "applicant": "孙七",
                "approver": "李四",
                "approval_time": (now - timedelta(days=400)).strftime("%Y-%m-%d %H:%M:%S"),
                "status": "已通过",
                "content": "合同审批",
                "idempotent_key": "IDEMP-004-JKL",
                "client_version": "2.5",
                "audit_log_ids": ["LOG-010", "LOG-011", "LOG-012"],
                "permission_table_version": "v2.0",
                "attachments": [],
                "manual_corrections": []
            },
            {
                "record_id": "REC-005",
                "approval_id": "APR-2026-0501-001",
                "applicant": "张三",
                "approver": "李四",
                "approval_time": (now - timedelta(days=5)).strftime("%Y-%m-%d %H:%M:%S"),
                "status": "已通过",
                "content": "采购办公用品申请（重复）",
                "idempotent_key": "IDEMP-001-ABC",
                "client_version": "2.5",
                "audit_log_ids": ["LOG-001", "LOG-002", "LOG-003"],
                "permission_table_version": "v2.0",
                "attachments": [],
                "manual_corrections": []
            }
        ]
    }


def test_normal_scenario():
    print("=" * 60)
    print("测试1：正常记录回滚")
    print("=" * 60)

    parser = PackageParser()
    engine = RollbackEngine()

    from models import PermissionTable
    old_perm = PermissionTable(
        version="v1.0",
        effective_date=datetime(2026, 1, 1),
        entries={
            "张三": ["审批"],
            "李四": ["审批", "查看"],
            "钱七": ["查看", "修改"]
        }
    )
    engine.permission_manager.register_version(old_perm)

    raw_data = create_test_package()
    normal_record = {
        "package_id": "TEST-NORMAL",
        "received_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "permission_table": raw_data["permission_table"],
        "records": [raw_data["records"][0]]
    }

    package = parser.parse_package(normal_record, "测试正常场景")
    results = engine.process_package(package)

    for result in results:
        print(result.human_readable_report())
        print()

    assert results[0].success == True
    assert results[0].record_status == RecordStatus.ROLLBACK_SUCCESS
    print("✅ 正常记录测试通过")


def test_duplicate_detection():
    print("\n" + "=" * 60)
    print("测试2：重复项检测")
    print("=" * 60)

    parser = PackageParser()
    engine = RollbackEngine()

    raw_data = create_test_package()
    dup_test_data = {
        "package_id": "TEST-DUP",
        "received_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "permission_table": raw_data["permission_table"],
        "records": [raw_data["records"][0], raw_data["records"][4]]
    }

    package = parser.parse_package(dup_test_data, "测试重复场景")
    results = engine.process_package(package)

    for result in results:
        print(result.human_readable_report())
        print()

    assert results[0].success == True
    assert results[1].record_status == RecordStatus.DUPLICATE
    assert any(issue.issue_type == IssueType.DUPLICATE_RECORD for issue in results[1].issues)
    print("✅ 重复项检测测试通过")


def test_late_attachment():
    print("\n" + "=" * 60)
    print("测试3：晚到附件检测")
    print("=" * 60)

    parser = PackageParser()
    engine = RollbackEngine()

    raw_data = create_test_package()
    late_att_data = {
        "package_id": "TEST-LATE",
        "received_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "permission_table": raw_data["permission_table"],
        "records": [raw_data["records"][0]]
    }

    package = parser.parse_package(late_att_data, "测试晚到附件")
    results = engine.process_package(package)

    for result in results:
        print(result.human_readable_report())
        print()

    assert any(issue.issue_type == IssueType.LATE_ATTACHMENT_WARNING for issue in results[0].issues)
    assert package.records[0].attachments[0].is_late == True
    print("✅ 晚到附件检测测试通过")


def test_manual_correction():
    print("\n" + "=" * 60)
    print("测试4：人工更正回滚")
    print("=" * 60)

    parser = PackageParser()
    engine = RollbackEngine()

    raw_data = create_test_package()
    corr_data = {
        "package_id": "TEST-CORR",
        "received_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "permission_table": raw_data["permission_table"],
        "records": [raw_data["records"][1]]
    }

    package = parser.parse_package(corr_data, "测试人工更正")
    results = engine.process_package(package)

    for result in results:
        print(result.human_readable_report())
        print()

    assert results[0].success == True
    assert package.records[0].record_status == RecordStatus.MANUAL_CORRECTION
    assert any("撤销人工更正" in action for action in results[0].actions_taken)
    print("✅ 人工更正回滚测试通过")


def test_idempotent_key_expired():
    print("\n" + "=" * 60)
    print("测试5：幂等键失效（超过有效期）")
    print("=" * 60)

    parser = PackageParser()
    engine = RollbackEngine(idempotent_validity_hours=720)

    raw_data = create_test_package()
    expired_data = {
        "package_id": "TEST-EXPIRED",
        "received_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "permission_table": raw_data["permission_table"],
        "records": [raw_data["records"][3]]
    }

    package = parser.parse_package(expired_data, "测试幂等键过期")
    results = engine.process_package(package)

    for result in results:
        print(result.human_readable_report())
        print()

    assert results[0].needs_manual_confirm == True
    assert results[0].record_status == RecordStatus.PENDING_CONFIRM
    assert any(issue.issue_type == IssueType.IDEMPOTENT_KEY_INVALID for issue in results[0].issues)
    report = results[0].human_readable_report()
    assert "需人工确认" in report or "待确认" in report
    print("✅ 幂等键失效测试通过")


def test_old_client_params_corrupted():
    print("\n" + "=" * 60)
    print("测试6：旧客户端参数被破坏")
    print("=" * 60)

    parser = PackageParser()
    engine = RollbackEngine()

    raw_data = create_test_package()
    old_client_data = {
        "package_id": "TEST-OLD-CLIENT",
        "received_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "permission_table": raw_data["permission_table"],
        "records": [raw_data["records"][2]]
    }

    package = parser.parse_package(old_client_data, "测试旧客户端")
    results = engine.process_package(package)

    for result in results:
        print(result.human_readable_report())
        print()

    assert results[0].needs_manual_confirm == True
    assert results[0].record_status == RecordStatus.PENDING_CONFIRM
    assert any(issue.issue_type == IssueType.OLD_CLIENT_PARAMS_CORRUPTED for issue in results[0].issues)
    print("✅ 旧客户端参数破坏测试通过")


def test_audit_log_gap():
    print("\n" + "=" * 60)
    print("测试7：审计日志缺口")
    print("=" * 60)

    parser = PackageParser()
    engine = RollbackEngine()

    raw_data = create_test_package()
    gap_data = {
        "package_id": "TEST-AUDIT-GAP",
        "received_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "permission_table": raw_data["permission_table"],
        "records": [raw_data["records"][2]]
    }

    package = parser.parse_package(gap_data, "测试审计日志缺口")
    results = engine.process_package(package)

    for result in results:
        print(result.human_readable_report())
        print()

    assert results[0].needs_manual_confirm == True
    assert results[0].record_status == RecordStatus.PENDING_CONFIRM
    assert any(issue.issue_type == IssueType.AUDIT_LOG_GAP for issue in results[0].issues)
    print("✅ 审计日志缺口测试通过")


def test_permission_table_version_change():
    print("\n" + "=" * 60)
    print("测试8：权限表版本变更提醒")
    print("=" * 60)

    parser = PackageParser()
    engine = RollbackEngine()

    from models import PermissionTable

    old_perm = PermissionTable(
        version="v1.0",
        effective_date=datetime(2026, 1, 1),
        entries={
            "张三": ["审批"],
            "李四": ["审批", "查看"],
            "钱七": ["查看", "修改"]
        },
        source_file="permission_v1.xlsx"
    )
    engine.permission_manager.register_version(old_perm)

    raw_data = create_test_package()
    perm_data = {
        "package_id": "TEST-PERM-CHANGE",
        "received_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "permission_table": raw_data["permission_table"],
        "records": [raw_data["records"][0]]
    }

    package = parser.parse_package(perm_data, "测试权限表变更")
    results = engine.process_package(package)

    for result in results:
        print(result.human_readable_report())
        print()

    assert results[0].permission_changes is not None
    assert results[0].permission_changes.has_changes == True
    assert "权限表版本变更提醒" in results[0].human_readable_report()
    assert any("新增人员" in msg or "移除人员" in msg or "权限变更" in msg
               for msg in results[0].permission_changes.human_readable_summary())
    print("✅ 权限表版本变更提醒测试通过")


def test_summary_report():
    print("\n" + "=" * 60)
    print("测试9：综合汇总报告")
    print("=" * 60)

    parser = PackageParser()
    engine = RollbackEngine()

    from models import PermissionTable

    old_perm = PermissionTable(
        version="v1.0",
        effective_date=datetime(2026, 1, 1),
        entries={
            "张三": ["审批"],
            "李四": ["审批", "查看"],
            "钱七": ["查看", "修改"]
        }
    )
    engine.permission_manager.register_version(old_perm)

    raw_data = create_test_package()
    package = parser.parse_package(raw_data, "综合测试数据包")
    results = engine.process_package(package)

    print(engine.summarize_results(results))
    print()

    for result in results:
        print(result.human_readable_report())
        print("-" * 60)

    success_count = sum(1 for r in results if r.success)
    pending_count = sum(1 for r in results if r.needs_manual_confirm)
    duplicate_count = sum(1 for r in results if r.record_status == RecordStatus.DUPLICATE)

    assert success_count >= 1
    assert pending_count >= 1
    assert duplicate_count >= 1
    print(f"✅ 汇总报告测试通过：{success_count} 成功，{pending_count} 待确认，{duplicate_count} 重复")


def test_human_readable_messages():
    print("\n" + "=" * 60)
    print("测试10：人文化错误提示验证")
    print("=" * 60)

    parser = PackageParser()
    engine = RollbackEngine()

    raw_data = create_test_package()
    test_data = {
        "package_id": "TEST-HUMAN",
        "received_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "permission_table": raw_data["permission_table"],
        "records": [raw_data["records"][3]]
    }

    package = parser.parse_package(test_data, "测试人文化提示")
    results = engine.process_package(package)

    report = results[0].human_readable_report()
    print(report)
    print()

    internal_field_names = ["idempotent_key", "client_version", "audit_log_ids", "stack", "traceback"]
    for field in internal_field_names:
        assert field not in report, f"错误报告中不应包含内部字段名: {field}"

    human_phrases = ["去重标记", "待确认", "建议"]
    for phrase in human_phrases:
        assert phrase in report, f"错误报告中应包含人文化表述: {phrase}"

    assert "❓" in report or "⚠️" in report, "错误报告中应包含状态图标"

    print("✅ 人文化错误提示测试通过")
    print("  ✅ 确认没有暴露内部字段名")
    print("  ✅ 确认使用了人文化表述")
    print("  ✅ 确认包含状态图标和操作建议")


def run_all_tests():
    print("\n" + "🚀" * 30)
    print("开始运行审批流回滚系统综合测试")
    print("🚀" * 30 + "\n")

    tests = [
        test_normal_scenario,
        test_duplicate_detection,
        test_late_attachment,
        test_manual_correction,
        test_idempotent_key_expired,
        test_old_client_params_corrupted,
        test_audit_log_gap,
        test_permission_table_version_change,
        test_summary_report,
        test_human_readable_messages,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            failed += 1
            print(f"\n❌ 测试 {test.__name__} 失败: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "=" * 60)
    print(f"测试完成：{passed} 个通过，{failed} 个失败")
    print("=" * 60)

    if failed == 0:
        print("\n🎉 所有测试通过！审批流回滚系统已准备就绪。")
    else:
        print(f"\n⚠️  有 {failed} 个测试失败，请检查。")

    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)
