#!/usr/bin/env python3
"""浮标海况数据清洗 - 坐标解析增强校验脚本

覆盖校验点：
1. B20260615-005 纬度建议值应接近30.5（符号乱序纠正）
2. 重复导入不会新增重复记录（幂等性）
3. 人工备注不会被覆盖

运行方式：python3 test_coordinate_enhancement.py
"""
import os
import sys
import json
import shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from buoy_cleaner.coordinate_parser import parse_latitude, parse_longitude, normalize_coordinates
from buoy_cleaner.cleaner import BuoyDataCleaner


def assert_approx_equal(actual, expected, tolerance=0.001, name="值"):
    if actual is None:
        raise AssertionError(f"{name} 为 None，预期接近 {expected}")
    if abs(actual - expected) > tolerance:
        raise AssertionError(f"{name}={actual} 不接近预期值 {expected}（容差 {tolerance}）")
    print(f"  ✅ {name}={actual} ≈ {expected}")


def test_parser_core():
    print("=" * 60)
    print("【测试1】坐标解析核心")
    print("=" * 60)

    cases = [
        ("B20260615-005 纬度符号乱序（核心场景）", "30°30″00′N", 30.5),
        ("B20260615-005 经度标准）", '121°52′36″E', 121.876667),
        ("标准度分秒正确顺序", '30°30′00″N', 30.5),
        ("有分秒有值", '30°15′24″N', 30.256667),
        ("南纬", '30°15′24″S', -30.256667),
        ("经度符号乱序", '121°36″52′E', 121.876667),
        ("十进制度", '30.2567', 30.2567),
    ]

    passed = 0
    for desc, raw, expected in cases:
        is_lat = 'N' in raw.upper() or 'S' in raw.upper()
        result = parse_latitude(raw) if is_lat else parse_longitude(raw)
        if result.needs_confirmation and result.suggested_value is not None:
            actual = result.suggested_value
        else:
            actual = result.decimal_degrees
        try:
            assert_approx_equal(actual, expected, name=f"{desc}")
            passed += 1
        except AssertionError as e:
            print(f"  ❌ {e}")

    print(f"\n解析测试通过: {passed}/{len(cases)}")
    return passed == len(cases)


def test_import_idempotency_and_notes():
    print()
    print("=" * 60)
    print("【测试2】重复导入幂等性 + 人工备注保护")
    print("=" * 60)

    test_dir = os.path.join(SCRIPT_DIR, "data_test_tmp")
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)

    input_file = os.path.join(SCRIPT_DIR, "data", "input", "浮标海况数据_20260618.csv")

    try:
        cleaner = BuoyDataCleaner(data_dir=test_dir)

        print("第一次导入...")
        r1 = cleaner.import_data(input_file)
        cleaner._save_state()
        total_after_first = len(cleaner.records)
        print(f"  首次导入记录数: {total_after_first}")

        print("\n为第一条记录添加人工备注...")
        target_rec = cleaner.records[0]
        target_id = target_rec.record_id
        cleaner.confirm_duplicate(
            record_id=target_id,
            operator="测试员",
            is_valid=True,
            reason="测试备注保护验证",
        )
        note_after_confirm = cleaner.records[0].manual_note
        print(f"  备注已写入: {note_after_confirm[:40]}...")

        print("\n第二次导入（相同文件）...")
        cleaner2 = BuoyDataCleaner(data_dir=test_dir)
        r2 = cleaner2.import_data(input_file)
        cleaner2._save_state()
        total_after_second = len(cleaner2.records)
        print(f"  二次导入记录数: {total_after_second}")

        assert total_after_first == total_after_second, \
            f"记录数翻倍！首次{total_after_first} ≠ 二次{total_after_second}"
        print(f"  ✅ 记录数未增加（{total_after_first} == {total_after_second}）")

        preserved = cleaner2.existing_keys[cleaner2.records[0].unique_key()]
        preserved_note = preserved.manual_note
        assert preserved_note is not None and "测试备注保护验证" in preserved_note, \
            f"人工备注丢失！实际: {preserved_note}"
        print(f"  ✅ 人工备注保留: {preserved_note[:50]}...")

        return True
    finally:
        if os.path.exists(test_dir):
            shutil.rmtree(test_dir)


def test_pending_and_confirmation():
    print()
    print("=" * 60)
    print("【测试3】待确认记录（B20260615-005 进入待确认列表 + 确认后写入标准化")
    print("=" * 60)

    test_dir = os.path.join(SCRIPT_DIR, "data_test2")
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)

    input_file = os.path.join(SCRIPT_DIR, "data", "input", "浮标海况数据_20260618.csv")

    try:
        cleaner = BuoyDataCleaner(data_dir=test_dir)
        result = cleaner.import_data(input_file)
        cleaner._save_state()

        pending = cleaner.get_pending_confirmation()
        target = [r for r in pending if r.sample_bottle_no == "B20260615-005"]
        assert len(target) >= 1, f"B20260615-005 未进入待确认列表！待确认共{len(pending)}条"
        rec = target[0]

        print(f"  ✅ B20260615-005 在待确认列表中")
        print(f"     原始纬度: {rec.latitude_raw}")
        print(f"     建议纬度: {rec.latitude_suggested}")
        print(f"     原始经度: {rec.longitude_raw}")
        print(f"     待确认原因: {rec.confirmation_reason[:50]}...")

        assert_approx_equal(rec.latitude_suggested, 30.5, name="建议纬度")

        assert rec.latitude_std is None, "未确认前标准化纬度应为 None"
        print(f"  ✅ 未确认前标准化纬度为 None（不会写入建议值）")

        print("\n执行确认操作（采用建议值）...")
        cleaner.confirm_duplicate(
            record_id=rec.record_id,
            operator="值班员小宋",
            is_valid=True,
            reason="与遥感截图核对，分秒符号确实录入顺序错误，建议值 30.5°",
        )

        cleaner3 = BuoyDataCleaner(data_dir=test_dir)
        cleaner3._load_existing_records()
        confirmed = [r for r in cleaner3.records if r.sample_bottle_no == "B20260615-005"][0]

        assert_approx_equal(confirmed.latitude_std, 30.5, name="确认后标准化纬度")
        assert confirmed.is_confirmed is True, "确认后 is_confirmed 应为 True"
        print(f"  ✅ 确认后已标记 is_confirmed=True")
        assert not confirmed.needs_confirmation, "确认后 needs_confirmation 应为 False"
        print(f"  ✅ 确认后 needs_confirmation=False")

        return True
    finally:
        if os.path.exists(test_dir):
            shutil.rmtree(test_dir)


def main():
    results = []
    results.append(("坐标解析核心", test_parser_core()))
    results.append(("幂等导入+备注保护", test_import_idempotency_and_notes()))
    results.append(("待确认+确认写回", test_pending_and_confirmation()))

    print()
    print("=" * 60)
    print("校验总结")
    print("=" * 60)
    all_pass = True
    for name, ok in results:
        status = "✅ 通过" if ok else "❌ 失败"
        print(f"  {status}  {name}")
        if not ok:
            all_pass = False

    print()
    if all_pass:
        print("🎉 全部校验通过！运营主管可放心使用。")
    else:
        print("⚠️ 存在未通过项，请检查。")
        sys.exit(1)


if __name__ == '__main__':
    main()
