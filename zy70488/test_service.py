#!/usr/bin/env python3
"""
收据去重服务功能测试脚本
"""

from services import DeduplicationService, ExportService
from data import generate_all_samples


def test_deduplication():
    print("=" * 60)
    print("测试1: 收据去重功能")
    print("=" * 60)
    
    service = DeduplicationService()
    samples = generate_all_samples()
    service.add_receipts_batch(samples)
    
    print(f"加载样本数量: {len(samples)}")
    
    result = service.run_full_deduplication()
    
    print(f"处理记录总数: {result.total_processed}")
    print(f"发现重复记录: {result.duplicates_found}")
    print(f"有效记录: {result.valid_records}")
    print(f"异常记录: {result.abnormal_records}")
    print(f"口径变更记录: {result.caliber_changed_records}")
    
    assert result.duplicates_found > 0, "应该检测到重复记录"
    assert result.caliber_changed_records > 0, "应该检测到口径变更记录"
    print("✓ 去重功能测试通过")


def test_original_id_tracking():
    print("\n" + "=" * 60)
    print("测试2: 原始输入ID回溯功能")
    print("=" * 60)
    
    service = DeduplicationService()
    samples = generate_all_samples()
    service.add_receipts_batch(samples)
    
    original_id = "ORIG000000"
    receipt = service.get_receipt_by_original_id(original_id)
    
    assert receipt is not None, f"应该能通过原始ID {original_id} 找到记录"
    print(f"通过原始ID找到记录: {receipt.device_name}")
    print(f"原始来源文件: {receipt.source_file}")
    print(f"原始行号: {receipt.row_number}")
    print(f"保留的原始数据字段数: {len(receipt.raw_data)}")
    
    print("✓ 原始ID回溯功能测试通过")


def test_caliber_change_detection():
    print("\n" + "=" * 60)
    print("测试3: 报告口径变更异常检测")
    print("=" * 60)
    
    service = DeduplicationService()
    samples = generate_all_samples()
    service.add_receipts_batch(samples)
    
    service.run_full_deduplication()
    
    caliber_abnormal = [
        r for r in service.abnormal_records 
        if r.abnormal_type == "报告口径不一致"
    ]
    
    print(f"检测到口径变更异常记录: {len(caliber_abnormal)}")
    
    if caliber_abnormal:
        record = caliber_abnormal[0]
        print(f"异常类型: {record.abnormal_type}")
        print(f"异常描述: {record.description}")
        print(f"字段名: {record.field_name}")
        print(f"原始值: {record.original_value}")
        print(f"期望值: {record.expected_value}")
        
        receipt = service.get_original_receipt(record.receipt_id)
        if receipt and receipt.meeting_attachments:
            att = receipt.meeting_attachments[0]
            print(f"会议纪要附件原始值: {att.original_value}")
            print(f"会议纪要附件修正值: {att.corrected_value}")
    
    assert len(caliber_abnormal) > 0, "应该检测到口径变更异常"
    print("✓ 口径变更检测功能测试通过")


def test_batch_preview():
    print("\n" + "=" * 60)
    print("测试4: 批量操作预览功能")
    print("=" * 60)
    
    service = DeduplicationService()
    samples = generate_all_samples()
    service.add_receipts_batch(samples)
    
    from collections import defaultdict
    
    fields = ["receipt_number", "device_code"]
    fingerprint_groups = defaultdict(list)
    for receipt in samples:
        fingerprint = service.generate_fingerprint(receipt, fields)
        fingerprint_groups[fingerprint].append(receipt)
    
    potential_duplicates = sum(
        len(group) - 1 for group in fingerprint_groups.values() if len(group) > 1
    )
    
    print(f"预览去重字段: {fields}")
    print(f"潜在重复记录: {potential_duplicates}")
    
    store_calibers = defaultdict(set)
    for receipt in samples:
        store_calibers[receipt.store_code].add(receipt.report_caliber)
    
    caliber_issues = sum(
        len([r for r in samples if r.store_code == store])
        for store, calibers in store_calibers.items()
        if len(calibers) > 1
    )
    
    print(f"潜在口径变更影响: {caliber_issues}")
    
    print("✓ 批量预览功能测试通过")


def test_export_function():
    print("\n" + "=" * 60)
    print("测试5: 导出功能")
    print("=" * 60)
    
    dedup_service = DeduplicationService()
    export_service = ExportService()
    
    samples = generate_all_samples()
    dedup_service.add_receipts_batch(samples)
    dedup_service.run_full_deduplication()
    
    result = export_service.export_abnormal_records(
        dedup_service.abnormal_records,
        dedup_service.receipts,
    )
    
    print(f"导出文件路径: {result.file_path}")
    print(f"导出记录数: {result.record_count}")
    print(f"文件校验和: {result.checksum}")
    
    assert result.record_count > 0, "应该有记录被导出"
    assert result.file_path, "应该生成导出文件"
    
    print("✓ 导出功能测试通过")


def test_approval_node_query():
    print("\n" + "=" * 60)
    print("测试6: 按审批节点查询功能")
    print("=" * 60)
    
    service = DeduplicationService()
    samples = generate_all_samples()
    service.add_receipts_batch(samples)
    
    from models import ApprovalNode
    
    for node in ApprovalNode:
        receipts = service.get_receipts_by_approval_node(node)
        if receipts:
            print(f"审批节点 [{node}] 记录数: {len(receipts)}")
            
            receipt_with_attachment = next(
                (r for r in receipts if r.meeting_attachments), None
            )
            if receipt_with_attachment and receipt_with_attachment.meeting_attachments:
                att = receipt_with_attachment.meeting_attachments[0]
                print(f"  - 示例会议纪要修正前后值: {att.original_value} → {att.corrected_value}")
    
    print("✓ 按审批节点查询功能测试通过")


def main():
    print("\n" + "🚀 收据去重服务功能测试开始 🚀" + "\n")
    
    try:
        test_deduplication()
        test_original_id_tracking()
        test_caliber_change_detection()
        test_batch_preview()
        test_export_function()
        test_approval_node_query()
        
        print("\n" + "=" * 60)
        print("✅ 所有测试通过！")
        print("=" * 60)
        print("\n📊 功能总结:")
        print("  1. ✓ 收据去重 - 基于多字段指纹检测重复")
        print("  2. ✓ 原始回溯 - 保留原始输入ID、来源文件、行号")
        print("  3. ✓ 口径变更 - 检测同门店报告口径不一致")
        print("  4. ✓ 批量预览 - 预览操作影响范围再执行")
        print("  5. ✓ 异常导出 - 导出异常记录供同事复核")
        print("  6. ✓ 会议纪要 - 保留附件修正前后值")
        print("  7. ✓ 审批节点 - 支持按审批节点回查导出")
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
