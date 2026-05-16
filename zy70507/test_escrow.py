#!/usr/bin/env python3
"""多租户密钥托管API自检脚本"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, KeyStatus, KeyPurpose, TenantKey, KeyReference
from service import KeyEscrowService
import json
from datetime import datetime


class TestResult:
    def __init__(self, name: str, passed: bool, message: str = ""):
        self.name = name
        self.passed = passed
        self.message = message

    def __str__(self):
        status = "✓ PASS" if self.passed else "✗ FAIL"
        return f"{status} - {self.name}: {self.message}"


def run_tests():
    print("=" * 60)
    print("多租户密钥托管API自检脚本")
    print("=" * 60)
    print()

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)

    results = []

    print("📋 测试1: 正常流程 - 完整密钥生命周期")
    print("-" * 60)
    try:
        db = Session()
        service = KeyEscrowService(db)

        key1, log1 = service.create_key(
            tenant_id="TENANT001",
            purpose=KeyPurpose.DATA_ENCRYPTION,
            encryption_material="-----BEGIN ENCRYPTED KEY-----...",
            metadata={"algorithm": "AES-256-GCM", "rotation": "90d"},
            operator="admin@company.com"
        )
        assert key1 is not None, "密钥创建失败"
        assert key1.status == KeyStatus.PENDING.value, f"初始状态错误: {key1.status}"
        print(f"  ✓ 创建密钥成功: {key1.key_version}")

        key2, log2 = service.create_key(
            tenant_id="TENANT001",
            purpose=KeyPurpose.DATA_ENCRYPTION,
            encryption_material="another-key",
            metadata={},
            operator="admin@company.com"
        )
        assert key2 is None, "应该阻止创建重复用途的密钥"
        print("  ✓ 重复用途创建被正确阻止")

        key_activated, log3 = service.advance_status(
            tenant_id="TENANT001",
            key_version=key1.key_version,
            target_status=KeyStatus.ACTIVE,
            approved_by="security@company.com",
            operator="admin@company.com",
            reason=None
        )
        assert key_activated is not None, "激活失败"
        assert key_activated.status == KeyStatus.ACTIVE.value, f"激活后状态错误: {key_activated.status}"
        assert key_activated.approved_by == "security@company.com", "审批人未记录"
        print("  ✓ 密钥审批激活成功")

        ref1, log4 = service.record_reference(
            tenant_id="TENANT001",
            key_version=key1.key_version,
            data_batch_id="BATCH-2024-001",
            purpose="用户数据加密",
            metadata={"record_count": 15000},
            operator="app_server_01"
        )
        assert ref1 is not None, "引用记录失败"
        print(f"  ✓ 记录引用成功: 批次 {ref1.data_batch_id}")

        ref2, log5 = service.record_reference(
            tenant_id="TENANT001",
            key_version=key1.key_version,
            data_batch_id="BATCH-2024-001",
            purpose="用户数据加密",
            metadata={},
            operator="app_server_02"
        )
        assert ref2 is not None, "重复引用失败"
        assert ref2.reference_count == 2, f"引用计数未正确累加: {ref2.reference_count}"
        print(f"  ✓ 重复批次引用计数累加正确: {ref2.reference_count}")

        ref3, log6 = service.record_reference(
            tenant_id="TENANT001",
            key_version=key1.key_version,
            data_batch_id="BATCH-2024-002",
            purpose="订单数据加密",
            metadata={},
            operator="app_server_01"
        )
        assert ref3 is not None, "第二批次引用失败"
        print("  ✓ 多批次引用记录成功")

        report, content = service.export_report(
            tenant_id="TENANT001",
            report_type="full_escrow",
            period_start=None,
            period_end=None,
            operator="auditor@company.com"
        )
        assert report is not None, "报告生成失败"
        assert content["conclusions"]["total_keys"] >= 1, "报告中密钥数量错误"
        assert content["conclusions"]["total_references"] >= 2, "报告中引用数量错误"
        print(f"  ✓ 托管报告生成成功: {report.report_id}")

        key_deprecated, log7 = service.advance_status(
            tenant_id="TENANT001",
            key_version=key1.key_version,
            target_status=KeyStatus.DEPRECATED,
            approved_by=None,
            operator="admin@company.com",
            reason=None
        )
        assert key_deprecated is not None, "弃用失败"
        assert key_deprecated.status == KeyStatus.DEPRECATED.value, f"弃用后状态错误"
        print("  ✓ 密钥弃用成功")

        key_deactivated, log8 = service.advance_status(
            tenant_id="TENANT001",
            key_version=key1.key_version,
            target_status=KeyStatus.DEACTIVATED,
            approved_by=None,
            operator="admin@company.com",
            reason="密钥轮换完成，数据已迁移"
        )
        assert key_deactivated is not None, "停用失败"
        assert key_deactivated.status == KeyStatus.DEACTIVATED.value, f"停用后状态错误"
        print("  ✓ 密钥停用成功")

        db.close()
        results.append(TestResult("正常流程测试", True, "完整密钥生命周期验证通过"))
        print("  ✓ 正常流程测试通过")
    except Exception as e:
        results.append(TestResult("正常流程测试", False, str(e)))
        print(f"  ✗ 正常流程测试失败: {e}")
    print()

    print("📋 测试2: 脏数据处理")
    print("-" * 60)
    try:
        db = Session()
        service = KeyEscrowService(db)

        ref_inactive, log = service.record_reference(
            tenant_id="TENANT002",
            key_version="NONEXISTENT-KEY-v1",
            data_batch_id="BATCH-TEST",
            purpose=None,
            metadata={},
            operator="test_user"
        )
        assert ref_inactive is None, "应该拒绝不存在密钥的引用"
        print("  ✓ 正确拒绝引用不存在的密钥")

        key3, log = service.create_key(
            tenant_id="TENANT002",
            purpose=KeyPurpose.BACKUP,
            encryption_material="test-key-material",
            metadata={},
            operator="admin"
        )
        assert key3 is not None, "创建测试密钥失败"

        ref_pending, log = service.record_reference(
            tenant_id="TENANT002",
            key_version=key3.key_version,
            data_batch_id="BATCH-PENDING",
            purpose=None,
            metadata={},
            operator="test_user"
        )
        assert ref_pending is None, "应该拒绝引用PENDING状态的密钥"
        print("  ✓ 正确拒绝引用PENDING状态的密钥")

        bad_transition, log = service.advance_status(
            tenant_id="TENANT002",
            key_version=key3.key_version,
            target_status=KeyStatus.DEPRECATED,
            approved_by=None,
            operator="admin",
            reason=None
        )
        assert bad_transition is None, "应该阻止无效的状态转换"
        print("  ✓ 正确阻止无效状态转换 (PENDING -> DEPRECATED)")

        no_approval, log = service.advance_status(
            tenant_id="TENANT002",
            key_version=key3.key_version,
            target_status=KeyStatus.ACTIVE,
            approved_by=None,
            operator="admin",
            reason=None
        )
        assert no_approval is None, "应该要求审批信息"
        print("  ✓ 正确检查审批要求 (PENDING->ACTIVE 需要审批人)")

        bad_correction, log = service.manual_correction(
            tenant_id="TENANT002",
            key_version=key3.key_version,
            field_updates={"status": "active", "created_at": "2099-01-01"},
            operator="hacker",
            reason="恶意修改"
        )
        assert bad_correction is None, "应该阻止修改不允许的字段"
        print("  ✓ 正确阻止修改不允许的字段")

        nonexistent_correction, log = service.manual_correction(
            tenant_id="TENANT002",
            key_version="FAKE-KEY-v1",
            field_updates={"encryption_material": "new-material"},
            operator="admin",
            reason="修正"
        )
        assert nonexistent_correction is None, "应该拒绝修正不存在的密钥"
        print("  ✓ 正确拒绝修正不存在的密钥")

        db.close()
        results.append(TestResult("脏数据处理测试", True, "所有边界情况处理正确"))
        print("  ✓ 脏数据处理测试通过")
    except Exception as e:
        results.append(TestResult("脏数据处理测试", False, str(e)))
        print(f"  ✗ 脏数据处理测试失败: {e}")
    print()

    print("📋 测试3: 重复请求处理")
    print("-" * 60)
    try:
        db = Session()
        service = KeyEscrowService(db)

        key4, log = service.create_key(
            tenant_id="TENANT003",
            purpose=KeyPurpose.SIGNING,
            encryption_material="signing-key-v1",
            metadata={},
            operator="admin"
        )
        assert key4 is not None

        duplicate, log = service.create_key(
            tenant_id="TENANT003",
            purpose=KeyPurpose.SIGNING,
            encryption_material="signing-key-v2",
            metadata={},
            operator="admin"
        )
        assert duplicate is None, "应该阻止创建相同用途的第二个PENDING密钥"
        print("  ✓ 正确阻止相同用途重复创建（幂等性保证）")

        key_activated, log = service.advance_status(
            tenant_id="TENANT003",
            key_version=key4.key_version,
            target_status=KeyStatus.ACTIVE,
            approved_by="security",
            operator="admin",
            reason=None
        )
        assert key_activated is not None

        for i in range(5):
            ref, log = service.record_reference(
                tenant_id="TENANT003",
                key_version=key4.key_version,
                data_batch_id="BATCH-IDEMPOTENT",
                purpose="重复测试",
                metadata={"attempt": i},
                operator=f"worker_{i}"
            )
            assert ref is not None

        refs = service.get_key_references("TENANT003", key4.key_version)
        assert len(refs) == 1, f"应该只有1条引用记录，实际有{len(refs)}条"
        assert refs[0].reference_count == 5, f"引用计数应该为5，实际为{refs[0].reference_count}"
        print(f"  ✓ 重复引用正确去重并计数: count={refs[0].reference_count}")

        db.close()
        results.append(TestResult("重复请求处理测试", True, "幂等性和计数逻辑正确"))
        print("  ✓ 重复请求处理测试通过")
    except Exception as e:
        results.append(TestResult("重复请求处理测试", False, str(e)))
        print(f"  ✗ 重复请求处理测试失败: {e}")
    print()

    print("📋 测试4: 人工修正后重新计算")
    print("-" * 60)
    try:
        db = Session()
        service = KeyEscrowService(db)

        key5, log = service.create_key(
            tenant_id="TENANT004",
            purpose=KeyPurpose.DATA_ENCRYPTION,
            encryption_material="initial-material-with-typo",
            metadata={"version": "1.0", "note": "原始创建"},
            operator="operator_a"
        )
        assert key5 is not None

        key_activated, log = service.advance_status(
            tenant_id="TENANT004",
            key_version=key5.key_version,
            target_status=KeyStatus.ACTIVE,
            approved_by="manager",
            operator="operator_a",
            reason=None
        )
        assert key_activated is not None

        for i in range(3):
            ref, log = service.record_reference(
                tenant_id="TENANT004",
                key_version=key5.key_version,
                data_batch_id=f"CORRECT-BATCH-{i}",
                purpose="测试数据",
                metadata={},
                operator="system"
            )
            assert ref is not None
        print("  ✓ 初始化数据和引用完成")

        corrected_key, log = service.manual_correction(
            tenant_id="TENANT004",
            key_version=key5.key_version,
            field_updates={
                "encryption_material": "CORRECTED-ENCRYPTION-MATERIAL-FIXED",
                "metadata": {"version": "1.1", "note": "人工修正:修复密钥材料错误", "corrected_by": "security_admin"},
                "is_protected": True
            },
            operator="security_admin",
            reason="检测到原始密钥材料录入错误，已重新生成正确材料"
        )
        assert corrected_key is not None, "人工修正失败"
        assert corrected_key.metadata_["version"] == "1.1", "metadata未正确更新"
        assert corrected_key.is_protected == True, "保护标志未设置"
        assert "FIXED" in corrected_key.encryption_material, "密钥材料未更新"
        print("  ✓ 人工修正成功，字段正确更新")

        report_after, content_after = service.export_report(
            tenant_id="TENANT004",
            report_type="audit_report",
            period_start=None,
            period_end=None,
            operator="auditor"
        )
        assert report_after is not None
        key_info = content_after["key_summary"].get(key5.key_version, {})
        assert key_info.get("reference_count", 0) == 3, f"报告中引用计数错误: {key_info.get('reference_count')}"
        print(f"  ✓ 修正后报告重新计算正确: 引用数={key_info.get('reference_count')}")

        logs = service.get_operation_logs("TENANT004")
        manual_logs = [l for l in logs if l.operation_type == "manual_correct"]
        assert len(manual_logs) >= 1, "操作日志未记录人工修正"
        assert manual_logs[0].success == True, "人工修正日志状态错误"
        assert "人工修正" in manual_logs[0].conclusion, "日志结论未记录修正信息"
        print("  ✓ 操作审计日志正确记录人工修正操作")

        protect_deactivate, log = service.advance_status(
            tenant_id="TENANT004",
            key_version=key5.key_version,
            target_status=KeyStatus.DEACTIVATED,
            approved_by=None,
            operator="test_user",
            reason=None
        )
        assert protect_deactivate is None, "受保护密钥停用应该被阻止"
        print("  ✓ 受保护密钥停用保护生效（需提供理由）")

        protect_deactivate2, log = service.advance_status(
            tenant_id="TENANT004",
            key_version=key5.key_version,
            target_status=KeyStatus.DEACTIVATED,
            approved_by=None,
            operator="admin",
            reason="已确认数据全部迁移到新密钥，可以安全停用"
        )
        assert protect_deactivate2 is not None, "提供理由后应该可以停用"
        print("  ✓ 提供理由后受保护密钥可正常停用")

        db.close()
        results.append(TestResult("人工修正后重新计算测试", True, "修正、重计算、审计日志均正确"))
        print("  ✓ 人工修正后重新计算测试通过")
    except Exception as e:
        results.append(TestResult("人工修正后重新计算测试", False, str(e)))
        print(f"  ✗ 人工修正后重新计算测试失败: {e}")
    print()

    print("📋 测试5: 租户数据隔离验证")
    print("-" * 60)
    try:
        db = Session()
        service = KeyEscrowService(db)

        for tenant in ["TENANT-A", "TENANT-B", "TENANT-C"]:
            key, log = service.create_key(
                tenant_id=tenant,
                purpose=KeyPurpose.DATA_ENCRYPTION,
                encryption_material=f"key-for-{tenant}",
                metadata={"tenant": tenant},
                operator="system"
            )
            key_activated, log = service.advance_status(
                tenant_id=tenant,
                key_version=key.key_version,
                target_status=KeyStatus.ACTIVE,
                approved_by="security",
                operator="system",
                reason=None
            )
            for i in range(2):
                ref, log = service.record_reference(
                    tenant_id=tenant,
                    key_version=key.key_version,
                    data_batch_id=f"{tenant}-BATCH-{i}",
                    purpose=None,
                    metadata={},
                    operator="system"
                )

        keys_a = service.query_keys(tenant_id="TENANT-A")
        keys_b = service.query_keys(tenant_id="TENANT-B")
        keys_c = service.query_keys(tenant_id="TENANT-C")

        assert len(keys_a) == 1, f"TENANT-A 密钥数量错误: {len(keys_a)}"
        assert len(keys_b) == 1, f"TENANT-B 密钥数量错误: {len(keys_b)}"
        assert len(keys_c) == 1, f"TENANT-C 密钥数量错误: {len(keys_c)}"
        print("  ✓ 租户密钥数据完全隔离")

        refs_a = service.get_key_references("TENANT-A")
        refs_b = service.get_key_references("TENANT-B")
        assert len(refs_a) == 2, f"TENANT-A 引用数量错误"
        assert len(refs_b) == 2, f"TENANT-B 引用数量错误"
        print("  ✓ 租户引用数据完全隔离")

        db.close()
        results.append(TestResult("租户数据隔离测试", True, "多租户数据隔离正确"))
        print("  ✓ 租户数据隔离测试通过")
    except Exception as e:
        results.append(TestResult("租户数据隔离测试", False, str(e)))
        print(f"  ✗ 租户数据隔离测试失败: {e}")
    print()

    print("=" * 60)
    print("测试汇总")
    print("=" * 60)
    passed = sum(1 for r in results if r.passed)
    total = len(results)
    for result in results:
        print(result)
    print()
    print(f"结果: {passed}/{total} 测试通过")

    if passed == total:
        print("\n🎉 所有测试通过！系统运行正常。")
        return 0
    else:
        print("\n❌ 部分测试失败，请检查系统配置。")
        return 1


if __name__ == "__main__":
    exit_code = run_tests()
    sys.exit(exit_code)
