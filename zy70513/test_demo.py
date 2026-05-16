#!/usr/bin/env python3
"""配置快照签收API演示脚本"""

import sys
from datetime import datetime

from models import ConfigReceiptCreate, StatusUpdateRequest, ManualCorrectionRequest, ReceiptStatus
from service import ConfigReceiptService


def demo():
    service = ConfigReceiptService()

    print("=" * 60)
    print("配置快照签收API - 功能演示")
    print("=" * 60)

    print("\n1. 创建签收记录（配置完全匹配）")
    print("-" * 60)
    create_data1 = ConfigReceiptCreate(
        service_name="user-service",
        config_version="v2.1.0",
        snapshot_version="20240115-001",
        instance_id="user-service-01",
        expected_config={"db.host": "localhost", "db.port": 3306, "log.level": "info"},
        actual_config={"db.host": "localhost", "db.port": 3306, "log.level": "info"}
    )
    receipt1 = service.create_receipt(create_data1)
    print(f"签收ID: {receipt1.id}")
    print(f"服务名: {receipt1.service_name}")
    print(f"状态: {receipt1.status.value}")
    print(f"差异数: {len(receipt1.diffs)}")
    print(f"审计日志数: {len(receipt1.audit_logs)}")

    print("\n2. 创建签收记录（存在配置差异）")
    print("-" * 60)
    create_data2 = ConfigReceiptCreate(
        service_name="user-service",
        config_version="v2.1.0",
        snapshot_version="20240115-001",
        instance_id="user-service-02",
        expected_config={"db.host": "localhost", "db.port": 3306, "log.level": "info"},
        actual_config={"db.host": "192.168.1.100", "db.port": 3306, "log.level": "debug"}
    )
    receipt2 = service.create_receipt(create_data2)
    print(f"签收ID: {receipt2.id}")
    print(f"服务名: {receipt2.service_name}")
    print(f"状态: {receipt2.status.value}")
    print(f"差异数: {len(receipt2.diffs)}")
    for diff in receipt2.diffs:
        print(f"  - {diff.key_path}: {diff.diff_type.value}")

    print("\n3. 异常处理 - 将记录标记为被拦截")
    print("-" * 60)
    receipt2_blocked = service.handle_exception(
        receipt_id=receipt2.id,
        reason="配置不匹配：log.level应为info，实际为debug",
        operator="admin@example.com",
        final_conclusion="需要重新拉取配置"
    )
    print(f"新状态: {receipt2_blocked.status.value}")
    last_log = receipt2_blocked.audit_logs[-1]
    print(f"操作人: {last_log.operator}")
    print(f"原因: {last_log.reason}")
    print(f"处理依据: {last_log.processing_basis}")
    print(f"最终结论: {last_log.final_conclusion}")

    print("\n4. 人工修正 - 补偿处理")
    print("-" * 60)
    correction_request = ManualCorrectionRequest(
        operator="sre@example.com",
        reason="已手动修复实例配置，并重载成功",
        corrected_diffs=[],
        processing_basis={
            "action_taken": "手动执行 curl -X POST http://user-service-02/reload",
            "verify_time": datetime.now().isoformat(),
            "result": "配置已同步"
        },
        final_conclusion="问题已解决，配置同步完成"
    )
    receipt2_compensated = service.manual_correction(receipt2.id, correction_request)
    print(f"新状态: {receipt2_compensated.status.value}")
    print(f"差异数(修正后): {len(receipt2_compensated.diffs)}")
    last_log = receipt2_compensated.audit_logs[-1]
    print(f"操作人: {last_log.operator}")
    print(f"最终结论: {last_log.final_conclusion}")

    print("\n5. 获取签收汇总")
    print("-" * 60)
    create_data3 = ConfigReceiptCreate(
        service_name="user-service",
        config_version="v2.1.0",
        snapshot_version="20240115-001",
        instance_id="user-service-03"
    )
    service.create_receipt(create_data3)

    summaries = service.get_summary()
    for summary in summaries:
        print(f"服务: {summary.service_name}")
        print(f"版本: {summary.config_version} / {summary.snapshot_version}")
        print(f"总实例数: {summary.total_instances}")
        print(f"  待处理: {summary.pending_count}")
        print(f"  已确认: {summary.confirmed_count}")
        print(f"  被拦截: {summary.blocked_count}")
        print(f"  已补偿: {summary.compensated_count}")
        print(f"  存在差异: {summary.has_any_diff}")

    print("\n6. 导出签收记录 (JSON)")
    print("-" * 60)
    from models import ConfigReceiptQuery
    export_data = service.export_receipts(ConfigReceiptQuery(), fmt="json")
    print(f"导出成功，数据长度: {len(export_data)} 字符")

    print("\n7. 状态流转说明")
    print("-" * 60)
    print("pending   → 待处理：实例已上报但未完成校验")
    print("confirmed → 已确认：配置校验通过，快照已正确签收")
    print("blocked   → 被拦截：出现异常或校验失败，需要人工介入")
    print("revoked   → 已撤销：该签收记录已作废")
    print("compensated → 已补偿：问题已通过人工方式修正")

    print("\n" + "=" * 60)
    print("演示完成！异常路径追溯已完整记录在 audit_logs 中")
    print("=" * 60)


if __name__ == "__main__":
    demo()
