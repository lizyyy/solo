#!/usr/bin/env python3
"""
乡镇药房近效期异常回执状态机 - 完整自动化流程示例
从创建批次 -> 导入数据 -> 复核 -> 冻结 -> 解冻 -> 导出
"""

import sys
import json
import uuid
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from receipt_system.database import get_db_session, init_db
from receipt_system.models import Batch, Receipt, ReceiptStatus, DuplicateAction
from receipt_system.state_machine import ReceiptStateMachine, handle_duplicate_receipt, batch_state_summary
from receipt_system.exporter import ReceiptExporter


def run_complete_workflow():
    print("=" * 60)
    print("乡镇药房近效期异常回执状态机 - 完整流程演示")
    print("=" * 60)

    init_db()

    with get_db_session() as db:
        print("\n[步骤 1] 创建批次")
        print("-" * 40)

        batch_id = f"BATCH-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        batch = Batch(
            id=batch_id,
            pharmacy_id="PHARM001",
            pharmacy_name="XX镇中心大药房",
            region="华东区-江苏省-苏州市",
            created_by="店长张三",
            description="2026年5月份近效期药品处理批次"
        )
        db.add(batch)
        print(f"批次ID: {batch_id}")
        print(f"药房名称: {batch.pharmacy_name}")
        print(f"区域: {batch.region}")

        print("\n[步骤 2] 导入回执数据")
        print("-" * 40)

        sample_file = Path(__file__).parent / "sample_data.json"
        with open(sample_file, "r", encoding="utf-8") as f:
            sample_data = json.load(f)

        created_count = 0
        for item in sample_data:
            idempotency_key = f"{batch_id}:{item['medicine_code']}:{item['batch_number']}"

            receipt = Receipt(
                id=str(uuid.uuid4()),
                batch_id=batch_id,
                idempotency_key=idempotency_key,
                medicine_code=item["medicine_code"],
                medicine_name=item["medicine_name"],
                specification=item.get("specification"),
                batch_number=item["batch_number"],
                expiry_date=datetime.fromisoformat(item["expiry_date"]),
                quantity=item["quantity"],
                unit=item["unit"],
                original_price=item["original_price"],
                adjusted_price=item.get("adjusted_price"),
                source_type=item["source_type"]
            )
            db.add(receipt)
            created_count += 1
            print(f"  导入: {item['medicine_name']} x{item['quantity']}{item['unit']}")

        batch.total_receipts = created_count
        print(f"共导入 {created_count} 条回执")

        print("\n[步骤 3] 提交待复核")
        print("-" * 40)
        for receipt in batch.receipts:
            sm = ReceiptStateMachine(receipt)
            sm.submit_for_review(db, "店长张三", "数据核对无误，提交复核")
        batch.status = ReceiptStatus.PENDING_REVIEW
        print(f"所有回执已提交待复核，当前批次状态: {batch.status.value}")

        print("\n[步骤 4] 区域督导复核")
        print("-" * 40)
        success_count = 0
        for receipt in batch.receipts:
            sm = ReceiptStateMachine(receipt)
            sm.approve(db, "督导李四", "复核通过，价格调整合理")
            success_count += 1
        batch.status = ReceiptStatus.APPROVED
        print(f"复核通过: {success_count} 条，批次状态: {batch.status.value}")

        print("\n[步骤 5] 发现问题 - 冻结结算")
        print("-" * 40)
        freeze_reason = "发现维生素C批次有效期录入错误，需重新核实后再结算"
        receipt_to_freeze = batch.receipts[2]
        sm = ReceiptStateMachine(receipt_to_freeze)
        sm.freeze(db, "财务王五", freeze_reason)
        batch.status = ReceiptStatus.FROZEN
        batch.frozen_at = datetime.now()
        batch.frozen_by = "财务王五"
        print(f"冻结回执: {receipt_to_freeze.medicine_name}")
        print(f"冻结原因: {freeze_reason}")
        print(f"批次状态: {batch.status.value}")

        print("\n[步骤 6] 核查问题 - 解冻恢复")
        print("-" * 40)
        unfreeze_reason = "经核实，有效期录入正确，系系统导入时格式转换问题"
        sm = ReceiptStateMachine(receipt_to_freeze)
        sm.unfreeze(db, "财务王五", unfreeze_reason, ReceiptStatus.APPROVED)
        batch.status = ReceiptStatus.APPROVED
        batch.frozen_at = None
        batch.frozen_by = None
        print(f"已解冻回执: {receipt_to_freeze.medicine_name}")
        print(f"解冻原因: {unfreeze_reason}")
        print(f"批次状态: {batch.status.value}")

        print("\n[步骤 7] 查看批次汇总")
        print("-" * 40)
        summary = batch_state_summary(batch)
        print(json.dumps(summary, ensure_ascii=False, indent=2, default=str))

        print("\n[步骤 8] 导出Excel报表")
        print("-" * 40)
        excel_data = ReceiptExporter.export_to_excel(
            db, batch_ids=[batch_id], include_audit_log=True
        )
        output_file = f"export_{batch_id}.xlsx"
        with open(output_file, "wb") as f:
            f.write(excel_data.getvalue())
        print(f"已导出到: {output_file}")

        export_summary = ReceiptExporter.get_export_summary(db, batch_ids=[batch_id])
        print(f"导出汇总: {json.dumps(export_summary, ensure_ascii=False, indent=2)}")

        print("\n[步骤 9] 查看状态流转历史")
        print("-" * 40)
        for receipt in batch.receipts:
            print(f"\n药品: {receipt.medicine_name}")
            for transition in receipt.status_transitions:
                print(f"  [{transition.transitioned_at.strftime('%H:%M:%S')}] "
                      f"{transition.from_status.value:12} -> {transition.to_status.value:12} "
                      f"by {transition.transitioned_by:10} | {transition.reason or ''}")

    print("\n" + "=" * 60)
    print("流程演示完成!")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(run_complete_workflow())
