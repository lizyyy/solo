#!/usr/bin/env python3

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from dp_strategy.importer import (
    import_formula_screenshots,
    manual_edit_record,
    get_record_history,
    compare_versions,
)
from dp_strategy.boundary_rules import (
    init_boundary_rules,
    get_abnormal_records,
)


def print_separator(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def demo_step1_import_screenshots():
    print_separator("步骤1: 第一次导入旧公式截图")

    file_path = os.path.join(
        os.path.dirname(__file__), "..", "data", "raw", "sample_formulas.csv"
    )
    result = import_formula_screenshots(file_path, imported_by="运营规划阿岚")
    print(f"导入结果: {result['message']}")
    print(f"批次ID: {result['batch_id']}")
    print(f"异常记录数: {result['abnormal_count']}")

    return result["batch_id"]


def demo_step2_check_abnormal():
    print_separator("数据复核人检查异常记录")

    abnormal_records = get_abnormal_records()
    print(f"发现 {len(abnormal_records)} 条异常记录:\n")

    for r in abnormal_records:
        print(f"记录ID: {r['id']}")
        print(f"  原始行号: {r['original_row_number']}")
        print(f"  SKU: {r['sku_code']} ({r['product_name']})")
        print(f"  分母: {r['denominator_value']}")
        print(f"  原始结果: '{r['original_result']}'")
        print(f"  异常类型: {r['abnormal_type']}")
        print(f"  异常说明: {r['abnormal_note']}")
        print()

    return abnormal_records


def demo_step3_alan_adds_teacher_comment(abnormal_records):
    print_separator("步骤2: 运营规划阿岚补看老师批注，添加备注")

    target_id = abnormal_records[0]["id"]
    result = manual_edit_record(
        screenshot_id=target_id,
        field_name="abnormal_note",
        new_value="分母为0但结果被填空字符串，原始行号: 3; 老师批注: 此商品已下架，分母为0属正常情况，需特殊处理",
        edited_by="运营规划阿岚",
        change_reason="补看老师批注: 商品B已下架，分母为0属正常业务场景",
    )
    print(f"修改结果: {result['message']}")
    print(f"版本从1升级到: {result['new_version']}")

    return target_id


def demo_step4_view_history(target_id: int):
    print_separator("查看历史变更记录")

    history = get_record_history(target_id)
    for h in history:
        print(f"版本 {h['version']}:")
        print(f"  变更类型: {h['change_type']}")
        print(f"  操作人: {h['changed_by']}")
        print(f"  变更原因: {h['change_reason']}")
        print(f"  变更字段: {h['diff_fields']}")
        print()


def demo_step5_compare_versions(target_id: int):
    print_separator("对比版本差异 (版本1 vs 版本2)")

    diff = compare_versions(target_id, 1, 2)
    if diff["success"]:
        for field, values in diff["diff"].items():
            print(f"字段: {field}")
            print(f"  版本1: {values['version1']}")
            print(f"  版本2: {values['version2']}")
            print()


def demo_step6_classroom_demo_update(target_id: int):
    print_separator("步骤3: 课堂演示结果更新")

    result = manual_edit_record(
        screenshot_id=target_id,
        field_name="result_value",
        new_value="N/A(下架)",
        edited_by="课堂演示系统",
        change_reason="课堂演示结果: 已下架商品标记为N/A",
    )
    print(f"修改结果: {result['message']}")
    print(f"字段: {result['field']}")
    print(f"旧值: '{result['old_value']}'")
    print(f"新值: '{result['new_value']}'")
    print(f"新版本: {result['new_version']}")


def demo_step7_final_review(target_id: int):
    print_separator("最终复盘: 完整变更历史")

    history = get_record_history(target_id)
    print(f"记录 {target_id} 的完整变更轨迹:\n")
    for h in history:
        print(f"【版本 {h['version']}】{h['change_time']}")
        print(f"  操作: {h['change_type']}")
        print(f"  操作人: {h['changed_by']}")
        print(f"  原因: {h['change_reason']}")
        print()


def main():
    print("""
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║       动态规划补货策略 - 返工场景完整演示                   ║
║                                                           ║
║  完整流程:                                                 ║
║  1. 第一次导入旧公式截图                                   ║
║  2. 发现分母为0却被填成空字符串等异常                       ║
║  3. 数据复核人追问，阿兰补看老师批注                        ║
║  4. 课堂演示结果更新                                       ║
║  5. 完整历史记录可追溯，可复盘                             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    """)

    init_boundary_rules()

    batch_id = demo_step1_import_screenshots()
    abnormal_records = demo_step2_check_abnormal()

    if not abnormal_records:
        print("没有异常记录，演示结束")
        return

    target_id = demo_step3_alan_adds_teacher_comment(abnormal_records)
    demo_step4_view_history(target_id)
    demo_step5_compare_versions(target_id)
    demo_step6_classroom_demo_update(target_id)
    demo_step7_final_review(target_id)

    print_separator("演示完成")
    print(f"批次ID: {batch_id}")
    print(f"关键记录ID: {target_id}")
    print("\n可使用以下命令继续验证:")
    print(f"  python -m dp_strategy.cli history {target_id}")
    print(f"  python -m dp_strategy.cli abnormal")


if __name__ == "__main__":
    main()
