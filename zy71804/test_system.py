import sys
import os
import hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from database import get_db, CollateralBatch, CollateralRecord, StatusHistory, ManualNote, ExportSnapshot
from services import process_batch, add_manual_note, get_record_history, prepare_export_data, generate_batch_id, EXCEPTION_CODES

def run_tests():
    db = next(get_db())

    print("=" * 60)
    print("质押品折扣回看系统 - 核心功能验证测试")
    print("=" * 60)

    test_records = [
        {"collateral_code": "000001", "collateral_name": "平安银行", "collateral_type": "股票", "market_value": 1000000, "face_value": 1000000, "discount_rate": 0.6},
        {"collateral_code": "000002", "collateral_name": "万科A", "collateral_type": "股票", "market_value": 2500000, "face_value": 2500000, "discount_rate": 0.55},
        {"collateral_code": "600036", "collateral_name": "招商银行", "collateral_type": "股票", "market_value": 500000, "face_value": 500000, "discount_rate": 0.65},
        {"collateral_code": "000961", "collateral_name": "中南建设", "collateral_type": "股票", "market_value": -500000, "face_value": 500000, "discount_rate": 0.5},
        {"collateral_code": "000651", "collateral_name": "格力电器", "collateral_type": "股票", "market_value": 2000000, "face_value": 2000000, "discount_rate": 1.5},
        {"collateral_code": "", "collateral_name": "空代码", "collateral_type": "股票", "market_value": 1000000, "face_value": 1000000, "discount_rate": 0.6},
        {"collateral_code": "600036", "collateral_name": "招商银行-重复", "collateral_type": "股票", "market_value": 500000, "face_value": 500000, "discount_rate": 0.65},
        {"collateral_code": "113508", "collateral_name": "可转债", "collateral_type": "其他类型", "market_value": 1500000, "face_value": 1500000, "discount_rate": 0.6},
    ]

    print("\n【测试1】首次导入批次 - 验证正常处理和异常识别")
    print("-" * 60)
    batch_date = "2024-05-31"
    source_file = "collateral_test.xlsx"
    batch_id = generate_batch_id(batch_date, source_file)

    result1 = process_batch(db, batch_date, source_file, test_records, "tester")
    print(f"批次号: {result1['batch_id']}")
    print(f"总记录: {result1['total_records']}")
    print(f"成功: {result1['success_count']}")
    print(f"异常: {result1['exception_count']}")
    print(f"是否重跑: {result1['is_reprocess']}")
    assert result1['is_reprocess'] == False, "首次导入不应标记为重跑"
    assert result1['success_count'] == 3, f"成功数应为3，实际{result1['success_count']}"
    assert result1['exception_count'] == 5, f"异常数应为5，实际{result1['exception_count']}"
    print("✓ 首次导入测试通过")

    print("\n【测试2】验证异常识别和处理建议")
    print("-" * 60)
    records = db.query(CollateralRecord).filter(CollateralRecord.batch_id == batch_id).all()
    exceptions = [r for r in records if r.is_exception]
    print(f"异常记录数: {len(exceptions)}")

    exception_codes_found = set(r.exception_code for r in exceptions)
    expected_codes = {"E002", "E003", "E005", "E006", "E007"}
    print(f"异常代码: {exception_codes_found}")
    assert exception_codes_found == expected_codes, f"异常代码不匹配: {exception_codes_found} vs {expected_codes}"

    for r in exceptions:
        assert r.exception_suggestion is not None, f"{r.exception_code} 缺少处理建议"
        assert r.exception_code in EXCEPTION_CODES, f"未知异常代码 {r.exception_code}"
        print(f"  {r.exception_code}: {EXCEPTION_CODES[r.exception_code]['description'][:30]}...")
        print(f"    建议: {r.exception_suggestion[:40]}...")
    print("✓ 异常识别和处理建议测试通过")

    print("\n【测试3】幂等性验证 - 同一批次重复导入")
    print("-" * 60)
    result2 = process_batch(db, batch_date, source_file, test_records, "tester")
    print(f"批次号: {result2['batch_id']}")
    print(f"是否重跑: {result2['is_reprocess']}")
    assert result2['is_reprocess'] == True, "重复导入应标记为重跑"
    assert result2['batch_id'] == result1['batch_id'], "批次号应保持一致"

    batches = db.query(CollateralBatch).filter(CollateralBatch.batch_date == batch_date).all()
    print(f"数据库中批次记录数: {len(batches)}")
    assert len(batches) == 1, f"重复导入不应创建新批次，实际{len(batches)}条"

    records_after = db.query(CollateralRecord).filter(CollateralRecord.batch_id == batch_id).all()
    print(f"数据库中记录数: {len(records_after)}")
    assert len(records_after) == len(records), f"重复导入不应增加记录数"
    print("✓ 幂等性测试通过 - 重复导入不新增批次和记录")

    print("\n【测试4】版本追踪验证")
    print("-" * 60)
    sample_record = records_after[0]
    print(f"记录 {sample_record.collateral_code} 当前版本: v{sample_record.current_version}")
    assert sample_record.current_version == 2, f"版本号应为2，实际v{sample_record.current_version}"

    history = get_record_history(db, sample_record.record_key)
    print(f"历史记录数: {len(history)}")
    assert len(history) >= 2, "历史记录数应>=2"

    for i, h in enumerate(history):
        print(f"  v{h['version']}: {h['operation_type']} - {h['operator']} - {h['new_discount']}")
    print("✓ 版本追踪测试通过")

    print("\n【测试5】人工备注和历史保护")
    print("-" * 60)
    record_to_note = records_after[1]
    old_discount = record_to_note.final_discount
    new_discount = old_discount + 10000

    note_result = add_manual_note(
        db,
        record_to_note.record_key,
        batch_id,
        "经与业务部门确认，该质押品流动性较好，折扣率可适当上调",
        "张三",
        new_final_discount=new_discount,
        new_status="manual_override"
    )
    print(f"备注ID: {note_result['id']}")
    print(f"操作人: {note_result['operator']}")

    db.refresh(record_to_note)
    print(f"原值: {old_discount}")
    print(f"新值: {record_to_note.final_discount}")
    print(f"当前状态: {record_to_note.status}")
    print(f"是否有人工备注: {record_to_note.has_manual_note}")
    print(f"最新备注: {record_to_note.latest_note[:30]}...")

    assert record_to_note.final_discount == new_discount, "折扣值未正确更新"
    assert record_to_note.has_manual_note == True, "未标记有人工备注"
    assert record_to_note.current_version == 3, f"版本号应为3，实际v{record_to_note.current_version}"
    print("✓ 人工备注测试通过")

    print("\n【测试6】人工备注保护 - 重跑不应覆盖备注")
    print("-" * 60)
    result3 = process_batch(db, batch_date, source_file, test_records, "tester")
    print(f"批次重跑完成，异常数: {result3['exception_count']}")

    db.refresh(record_to_note)
    print(f"重跑后折扣值: {record_to_note.final_discount}")
    print(f"重跑后状态: {record_to_note.status}")
    print(f"重跑后异常代码: {record_to_note.exception_code}")
    print(f"重跑后版本: v{record_to_note.current_version}")

    assert record_to_note.final_discount == new_discount, "人工备注的值不应被重跑覆盖"
    assert record_to_note.status == "manual_override", "状态不应被重跑覆盖"
    assert record_to_note.exception_code == "E008", "应标记E008覆盖风险异常"
    print("✓ 人工备注保护测试通过 - 重跑不覆盖已备注记录")

    print("\n【测试7】第二次人工备注 - 旧备注标记为已覆盖但不删除")
    print("-" * 60)
    note_result2 = add_manual_note(
        db,
        record_to_note.record_key,
        batch_id,
        "经再次核实，最新市场行情显示风险上升，调整折扣值",
        "李四",
        new_final_discount=new_discount - 5000,
        new_status="manual_override"
    )

    notes = db.query(ManualNote).filter(
        ManualNote.record_key == record_to_note.record_key
    ).order_by(ManualNote.created_at.desc()).all()

    print(f"备注总数: {len(notes)}")
    for i, n in enumerate(notes):
        status = "已覆盖" if n.overridden else "当前有效"
        print(f"  [{status}] {n.operator}: {n.note_content[:25]}...")
        if n.overridden:
            print(f"        被 {n.overridden_by} 于 {n.overridden_at} 覆盖")

    assert len(notes) == 2, "应有2条备注记录"
    assert notes[0].overridden == False, "最新备注应为有效"
    assert notes[1].overridden == True, "旧备注应标记为已覆盖"
    assert notes[1].overridden_by == "李四", "覆盖人不正确"
    assert notes[1].note_content is not None, "旧备注内容不应被删除"
    print("✓ 备注覆盖测试通过 - 旧备注内容保留不删除")

    print("\n【测试8】导出一致性验证")
    print("-" * 60)
    export_data1, hash1 = prepare_export_data(db, batch_id)
    export_data2, hash2 = prepare_export_data(db, batch_id)

    print(f"导出记录数: {len(export_data1)}")
    print(f"首次哈希: {hash1[:20]}...")
    print(f"二次哈希: {hash2[:20]}...")
    print(f"哈希一致: {hash1 == hash2}")

    assert hash1 == hash2, "同一批数据两次导出哈希应一致"

    note_result3 = add_manual_note(
        db,
        record_to_note.record_key,
        batch_id,
        "最终确认",
        "王五",
        new_final_discount=new_discount - 3000,
        new_status="reviewed"
    )

    export_data3, hash3 = prepare_export_data(db, batch_id)
    print(f"变更后哈希: {hash3[:20]}...")
    print(f"与变更前一致: {hash3 == hash1}")

    assert hash3 != hash1, "数据变更后哈希应变化"
    print("✓ 导出一致性测试通过 - 数据不变则哈希不变")

    print("\n" + "=" * 60)
    print("✅ 所有测试通过！系统核心功能验证完成")
    print("=" * 60)
    print("\n核心功能总结:")
    print("  ✓ 幂等性: 同一批次重复导入不产生新记录")
    print("  ✓ 状态追踪: 每次变更版本号+1，历史完整留存")
    print("  ✓ 人工备注保护: 已备注记录重跑不覆盖，标记E008")
    print("  ✓ 备注不删除: 旧备注标记为'已覆盖'但内容保留")
    print("  ✓ 异常解释: 每条异常附错误码和处理建议")
    print("  ✓ 导出一致: 数据哈希验证，同批数据导出一致")

    db.close()

if __name__ == "__main__":
    run_tests()
