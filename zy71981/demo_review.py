#!/usr/bin/env python3
"""
多租户权限回看系统 - 完整演示
演示内容：
1. 正常处理流程
2. 重复记录检测
3. 晚到记录处理
4. 无效权限识别
5. 证据链追踪
6. 人工更正流程
7. 迁移报告生成
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tenant_permission_review import PermissionReviewEngine
from tenant_permission_review.tests import generate_test_batch, TestScenario
from tenant_permission_review.models import CallLog


def print_section(title: str):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70 + "\n")


def main():
    engine = PermissionReviewEngine()
    tenant_id = "tenant_acme_corp"
    batch_id = "batch_2024_may_migration"

    print_section("🚀 多租户权限回看系统 - 演示开始")
    print("场景：ACME Corp 5月权限迁移，包含正常、重复、晚到、无效权限数据")

    print_section("📦 1. 生成测试数据（混合场景）")
    test_logs = generate_test_batch(
        tenant_id=tenant_id,
        batch_id=batch_id,
        scenario=TestScenario.MIXED,
        total_records=15,
    )
    print(f"生成了 {len(test_logs)} 条测试记录")
    print("数据来源分布：api_gateway | retry_job | delayed_queue | third_party_api")

    print_section("⚙️  2. 执行批量迁移处理")
    report = engine.process_batch(
        tenant_id=tenant_id,
        batch_id=batch_id,
        call_logs=test_logs,
        batch_cutoff_minutes=60,
    )
    print("处理完成！")

    print_section("📊 3. 迁移报告（人性化可读）")
    print(engine.get_batch_report_text(batch_id))

    print_section("🔍 4. 查看单条记录的完整证据链")
    if report.success_count > 0:
        first_log = test_logs[0]
        timeline = engine.get_evidence_timeline(first_log.log_id)
        if timeline:
            print(f"记录 ID: {first_log.log_id}")
            print(f"用户: {first_log.user_id}")
            print(f"权限: {first_log.request_body.get('permission_code')}")
            print("\n⏱️  事件时间线：")
            for i, node in enumerate(timeline["timeline"], 1):
                print(f"  {i}. [{node['timestamp']}]")
                print(f"     类型: {node['node_type']}")
                print(f"     描述: {node['description']}")
                print(f"     引用: {node['data_reference']}")

    print_section("🔄 5. 查看重复记录的证据链")
    if report.duplicate_record_ids:
        dup_log_id = report.duplicate_record_ids[0]
        timeline = engine.get_evidence_timeline(dup_log_id)
        if timeline:
            print(f"重复记录 ID: {dup_log_id}")
            print("\n⏱️  事件时间线：")
            for i, node in enumerate(timeline["timeline"], 1):
                print(f"  {i}. [{node['timestamp']}]")
                print(f"     类型: {node['node_type']}")
                print(f"     描述: {node['description']}")

    print_section("👋 6. 人工更正流程演示")
    if report.failed_record_ids:
        failed_id = report.failed_record_ids[0]
        print(f"对失败记录 {failed_id} 执行人工更正...")

        result = engine.apply_manual_correction(
            record_id=failed_id,
            operator_id="admin_zhang",
            operator_name="张三",
            correction_details={
                "record_type": "permission_change",
                "before_state": {"status": "failed", "permission": "can_do_magic"},
                "after_state": {"status": "corrected", "permission": "can_view_dashboard"},
                "comments": "客户反馈权限编码写错了，应该是 can_view_dashboard",
            },
            reason="客户反馈权限编码错误，人工修正",
        )

        print(f"\n✅ {result['message']}")
        print(f"   确认单 ID: {result['details']['confirmation_id']}")

        print("\n📝 该记录的人工确认历史：")
        confirmations = engine.get_record_confirmations(failed_id)
        for conf in confirmations:
            print(f"  - [{conf['timestamp']}] {conf['operator_name']}: {conf['reason']}")

    print_section("❌ 7. 错误提示演示（人性化 vs 技术化）")
    from tenant_permission_review.utils import DuplicateRecordError

    error = DuplicateRecordError(
        idempotency_key="tenant:user:action:12345",
        existing_record_id="log_abc_123",
        existing_timestamp="2024-05-20T10:30:00",
    )

    print("💡 人性化错误提示：")
    print(f"   {error.message}")
    print(f"   提示: {error.user_tip}")
    print(f"\n🔧 技术细节（供开发人员）：")
    print(f"   错误码: {error.error_code}")
    print(f"   证据引用: {error.evidence_reference}")

    print_section("🎉 演示完成！")
    print("关键特性总结：")
    print("  ✅ 完整证据链 - 每笔操作都有时间线记录，可追溯")
    print("  ✅ 重复检测 - 幂等键自动识别重复，防止重复处理")
    print("  ✅ 晚到处理 - 超时数据标记，不影响主流程")
    print("  ✅ 人工更正 - 留痕可查，谁改的、改了什么都有记录")
    print("  ✅ 人话提示 - 错误提示有温度，附带操作建议")
    print("  ✅ 迁移报告 - 统计清晰，问题一眼看到")
    print("\n数据持久化位置：tenant_permission_review/data/")
    print("SQLite 数据库：tenant_permission_review/data/review.db")


if __name__ == "__main__":
    main()
