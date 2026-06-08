"""诊断脚本 - 观察当前系统在改备注重复导入场景下的行为"""
import os
import sys
import tempfile
import shutil

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from quantile_calibration import QuantileCalibrationSystem
from quantile_calibration.models import BoundaryType, ProcessingStatus


def diagnose():
    test_dir = tempfile.mkdtemp()
    db_path = os.path.join(test_dir, "diag.db")
    system = QuantileCalibrationSystem(db_path)
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
    v1 = os.path.join(data_dir, "test_rating_weights_v1.csv")
    v1_edited = os.path.join(data_dir, "test_rating_weights_v1_edited.csv")

    print("=" * 80)
    print("【诊断 1】导入 v1（原始文件）")
    print("=" * 80)
    step1 = system.step1_import(v1, "alan_ops")
    batch1 = step1["batch_id"]
    recs1 = system.db.get_records_by_batch(batch1)
    print(f"批次 ID: {batch1}")
    print(f"记录数量: {len(recs1)}")
    print(f"第一条记录 ID: {recs1[0].id}, 原始行号: {recs1[0].original_row_number}, 备注: {recs1[0].remark}")
    print(f"第一条记录状态: {recs1[0].status.value}")

    print()
    print("=" * 80)
    print("【诊断 2】导入 v1_edited（内容不同，哈希不同）")
    print("=" * 80)
    step1b = system.step1_import(v1_edited, "alan_ops")
    batch2 = step1b["batch_id"]
    recs2 = system.db.get_records_by_batch(batch2)
    print(f"新批次 ID: {batch2}")
    print(f"旧批次 ID: {batch1}")
    print(f"新批次记录数量: {len(recs2)}")
    print(f"两次总数: {len(recs1) + len(recs2)}")
    print(f"是否翻倍了? {batch1 != batch2}")
    print(f"v1_edited 第一条备注: {recs2[0].remark if recs2 else 'N/A'}")
    print(f"导入返回 is_duplicate: {step1b['import_result'].get('is_duplicate')}")
    print(f"导入返回 action: {step1b['import_result'].get('action')}")

    print()
    print("=" * 80)
    print("【诊断 3】手动改备注后，再导入同一 v1 文件（哈希相同）")
    print("=" * 80)
    system.manual_edit(
        record_id=recs1[0].id,
        updates={"remark": "手动修改的备注"},
        operator="alan_ops",
        reason="测试"
    )
    rec_after_edit = system.db.get_rating_record(recs1[0].id)
    print(f"改备注后 ID={recs1[0].id} 的备注: {rec_after_edit.remark}")

    step1c = system.step1_import(v1, "alan_ops")
    print(f"导入返回 is_duplicate: {step1c['import_result'].get('is_duplicate')}")
    print(f"changes_detected: {step1c['import_result'].get('changes_detected')}")
    print(f"change_details 数量: {len(step1c['import_result'].get('change_details', []))}")

    rec_final = system.db.get_rating_record(recs1[0].id)
    print(f"最终 ID={recs1[0].id} 的备注: {rec_final.remark}")

    total = len(system.db.get_records_by_batch(batch1)) + (len(recs2) if batch1 != batch2 else 0)
    print(f"当前总数: {len(system.db.get_records_by_batch(batch1))} (batch1) + {len(recs2) if batch1 != batch2 else 0} (batch2) = {len(system.db.get_records_by_batch(batch1)) + (len(recs2) if batch1 != batch2 else 0)}")

    print()
    print("=" * 80)
    print("【诊断 4】一致性检查：列表、历史、版本对比是否同源")
    print("=" * 80)
    record_id = recs1[0].id
    evidence = system.get_evidence(record_id)
    version_diff = system.get_version_diff(record_id)
    print(f"原始行号: {evidence['original_row_number']}")
    print(f"证据中状态: {evidence['status']}")
    print(f"完整历史条数: {len(evidence['full_history'])}")
    print(f"版本对比差异条数: {len(version_diff['version_diffs'])}")
    for i, h in enumerate(evidence['full_history']):
        print(f"  历史#{i+1}: source={h['change_source']}, field={h['field_name']}, by={h['changed_by']}")

    print()
    print("=" * 80)
    print("【总结诊断】")
    print("=" * 80)
    if batch1 != batch2:
        print("❌ 问题 1：两个文件内容不同（哈希不同）被当成新批次，数量翻倍了！")
        print("   → 只改了一条备注的文件，基于 content hash 无法识别为同一份最新结果")
    else:
        print("✅ 两个文件哈希相同，未翻倍")

    print()
    print("建议修复方向：")
    print("  1. 增加 position(岗位)+original_row_number 作为记录级的业务主键")
    print("  2. 同一岗位+行号的记录，在导入时合并到最新版本，不翻倍")
    print("  3. 增加统一的视图层，列表/详情/摘要/导出/报告全部来自同一份数据")
    print("  4. 人工复核流程：保留原始说法、改后值、处理原因、下一步联系人")

    shutil.rmtree(test_dir, ignore_errors=True)


if __name__ == "__main__":
    diagnose()
