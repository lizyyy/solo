#!/usr/bin/env python3
"""演示脚本：从创建记录到导出的完整流程"""

import sys
import os
import subprocess
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pharmacy_expiry_tracker.db.database import SessionLocal, Base, engine
from pharmacy_expiry_tracker.models.enums import UserRole
from pharmacy_expiry_tracker.schemas.record import ExpiryRecordCreate
from pharmacy_expiry_tracker.services.record_service import RecordService
from pharmacy_expiry_tracker.services.workflow_service import WorkflowService
from pharmacy_expiry_tracker.services.export_service import ExportService
from pharmacy_expiry_tracker.schemas.export import ExportRequest
from datetime import date, timedelta

Base.metadata.create_all(bind=engine)

def print_step(step: str, title: str):
    print(f"\n{'='*60}")
    print(f"[{step}] {title}")
    print(f"{'='*60}")

def demo():
    print("乡镇药房近效期权限追责台账系统 - 完整流程演示")
    print("=" * 60)

    db = SessionLocal()

    print_step("1", "创建近效期记录（药房店长）")
    record_service = RecordService(db)

    expiry_date = date.today() + timedelta(days=45)

    create_data = ExpiryRecordCreate(
        pharmacy_code="PH001",
        pharmacy_name="XX乡镇大药房",
        region="华东区",
        town="XX镇",
        drug_code="DRUG001",
        drug_name="阿莫西林胶囊",
        drug_spec="0.5g*24粒",
        batch_no="B202401001",
        expiry_date=expiry_date,
        quantity=50,
        unit="盒",
        created_by="店长张三"
    )

    record = record_service.create_record(create_data, UserRole.PHARMACY_MANAGER.value)
    print(f"✅ 记录创建成功!")
    print(f"   记录编号: {record.record_no}")
    print(f"   当前状态: {record.status}")
    print(f"   近效期天数: {record.days_near_expiry}")
    print(f"   近效期分类: {record.expiry_category}")

    print_step("2", "提交审核（药房店长）")
    workflow_service = WorkflowService(db)

    record = workflow_service.submit_record(
        record_id=record.id,
        operator="店长张三",
        operator_role=UserRole.PHARMACY_MANAGER.value,
        change_reason="月度近效期药品上报"
    )
    print(f"✅ 记录已提交!")
    print(f"   当前状态: {record.status}")

    print_step("3", "驳回记录（区域督导）")
    record = workflow_service.reject_record(
        record_id=record.id,
        operator="督导李四",
        operator_role=UserRole.REGIONAL_SUPERVISOR.value,
        change_reason="请补充调拨单照片证据"
    )
    print(f"⚠️  记录已驳回!")
    print(f"   当前状态: {record.status}")
    print(f"   驳回原因: {record.change_reason}")

    print_step("4", "查看变更日志")
    logs = workflow_service.get_change_logs(record.id)
    print(f"📋 变更日志（共 {len(logs)} 条）:")
    for log in logs:
        print(f"   [{log.changed_at}] {log.change_type}: {log.old_status or '-'} → {log.new_status or '-'}")
        print(f"      操作人: {log.changed_by}, 原因: {log.change_reason or '-'}")

    print_step("5", "修改后重新提交（药房店长）")
    from pharmacy_expiry_tracker.schemas.record import ExpiryRecordUpdate

    update_data = ExpiryRecordUpdate(
        remarks="已补充调拨单照片，证据编号E001",
        change_reason="补充证据后重新提交",
        updated_by="店长张三"
    )
    record = record_service.update_record(record.id, update_data, UserRole.PHARMACY_MANAGER.value)

    record = workflow_service.submit_record(
        record_id=record.id,
        operator="店长张三",
        operator_role=UserRole.PHARMACY_MANAGER.value,
        change_reason="补充证据后重新提交"
    )
    print(f"✅ 记录已重新提交!")
    print(f"   当前状态: {record.status}")
    print(f"   当前版本: {record.current_version}")

    print_step("6", "审核通过（区域督导）")
    record = workflow_service.confirm_record(
        record_id=record.id,
        operator="督导李四",
        operator_role=UserRole.REGIONAL_SUPERVISOR.value,
        change_reason="证据齐全，审核通过"
    )
    print(f"✅ 记录已确认!")
    print(f"   当前状态: {record.status}")

    print_step("7", "导出前冻结（区域督导）")
    record = workflow_service.freeze_record(
        record_id=record.id,
        operator="督导李四",
        operator_role=UserRole.REGIONAL_SUPERVISOR.value,
        change_reason="月度审计，导出前冻结"
    )
    print(f"✅ 记录已冻结!")
    print(f"   当前状态: {record.status}")
    print(f"   冻结时间: {record.frozen_at}")
    print(f"   冻结人: {record.frozen_by}")

    print_step("8", "解冻后导出脱敏Excel（区域督导）")
    record = workflow_service.unfreeze_record(
        record_id=record.id,
        operator="督导李四",
        operator_role=UserRole.REGIONAL_SUPERVISOR.value,
        change_reason="准备导出"
    )

    export_service = ExportService(db)
    export_request = ExportRequest(
        region="华东区",
        export_format="excel",
        is_masked=True,
        exported_by="督导李四",
        user_role=UserRole.REGIONAL_SUPERVISOR.value
    )

    file_content, file_name, record_count = export_service.export_to_excel(export_request)

    output_path = os.path.join(os.path.dirname(__file__), file_name)
    with open(output_path, 'wb') as f:
        f.write(file_content)

    print(f"✅ 导出成功!")
    print(f"   文件名: {file_name}")
    print(f"   保存路径: {output_path}")
    print(f"   记录数: {record_count}")
    print(f"   脱敏: 是")

    print_step("9", "查看导出审计日志")
    logs, total = export_service.get_export_audit_logs()
    print(f"📋 导出审计日志（共 {total} 条）:")
    for log in logs:
        print(f"   [{log.exported_at}] {log.export_id}")
        print(f"      导出人: {log.exported_by} ({log.user_role})")
        print(f"      记录数: {log.record_count}, 脱敏: {'是' if log.is_masked else '否'}")

    print("\n" + "="*60)
    print("✅ 演示流程完成!")
    print("="*60)
    print("\nCLI 命令示例:")
    print("  python run.py record create --help")
    print("  python run.py workflow submit 1 --operator=张三 --role=pharmacy_manager")
    print("  python run.py export excel -o output.xlsx --exported-by=李四 --role=regional_supervisor")
    print("  python run.py run-server")

    db.close()

if __name__ == "__main__":
    demo()
