#!/usr/bin/env python3
"""
机械表摆轮误差系统 - 完整演示脚本

演示内容：
1. 第一次导入工况照片（包含摄氏度/开尔文混用的情况）
2. 查看待教练复核的混用记录
3. 教练修正混用问题
4. 林老师补看手写巡检备注
5. 教练更新交接报告
6. 追溯变更历史
7. 重复导入同一批（仅更新备注，不翻倍）
8. 对比改前改后差别
9. 回滚操作演示
"""

import json
from src.app import BalanceWheelErrorApp
from src.models.enums import TemperatureUnit


def print_separator(title=""):
    print("\n" + "=" * 70)
    if title:
        print(f"  {title}")
        print("=" * 70)


def print_json(data, indent=2):
    print(json.dumps(data, indent=indent, ensure_ascii=False))


def main():
    app = BalanceWheelErrorApp()

    print_separator("第一步：工况照片第一次导入")
    rows = [
        {
            "file_name": "IMG_20240101_001.jpg",
            "original_row": 1,
            "temperature": "25°C",
            "balance_wheel_error": 0.5,
        },
        {
            "file_name": "IMG_20240101_002.jpg",
            "original_row": 2,
            "temperature": "25°C / 298.15K",
            "balance_wheel_error": 0.3,
        },
        {
            "file_name": "IMG_20240101_003.jpg",
            "original_row": 3,
            "temperature": "300开尔文",
            "balance_wheel_error": 0.7,
        },
        {
            "file_name": "IMG_20240101_004.jpg",
            "original_row": 4,
            "temperature": "22摄氏度，标注为295.15K",
            "balance_wheel_error": 0.2,
        },
    ]

    result = app.import_photos(rows, "2024年1月工况表.xlsx")
    batch_id = result["batch_id"]
    print(f"批次ID: {batch_id}")
    print(f"导入数量: {result['imported_count']}")
    print(f"跳过重复: {result['skipped_duplicates']}")
    print("\n工作流汇总:")
    print_json(result["workflow_summary"])

    print_separator("查看待教练复核的混用记录")
    pending = app.get_pending_coach_review()
    print(f"待复核数量: {len(pending)}")
    for p in pending:
        print(f"  - 行号{p['original_row']}: {p['file_name']} (ID: {p['photo_id']})")

    if pending:
        mixed_photo_id = pending[0]["photo_id"]

        print_separator("查看混用照片详情")
        ok, msg, details = app.get_photo_details(mixed_photo_id)
        if ok:
            print(f"原始行号: {details['original_row_number']}")
            print(f"原始温度文本: {details['temperature_raw']}")
            print(f"解析值: {details['temperature_value']} {details['temperature_unit']}")
            print(f"是否混用: {details['has_mixed_units']}")
            print(f"当前状态: {details['status']}")
            print(f"当前步骤: 第{details['current_step']}步 - {details['current_step_description']}")

        print_separator("教练修正混用（以摄氏度为准）")
        ok, msg, summary = app.coach_fix_mixed_units(
            mixed_photo_id,
            TemperatureUnit.CELSIUS,
            "经核对原始记录，手写标注有误，以摄氏度25°C为准",
        )
        print(f"修正结果: {ok} - {msg}")
        if summary:
            print(f"修正后状态: {summary['status']}")
            print(f"当前步骤: 第{summary['current_step']}步")

        print_separator("第二步：林老师补看手写巡检备注")
        ok, msg, summary = app.lin_teacher_add_remark(
            mixed_photo_id,
            "巡检时观察：摆轮运转平稳，磨损轻微，误差在允许范围内",
        )
        print(f"备注结果: {ok} - {msg}")
        if summary:
            print(f"当前步骤: 第{summary['current_step']}步 - {summary['current_step_description']}")

        print_separator("第三步：交接报告更新")
        ok, msg, summary = app.coach_update_report(
            mixed_photo_id,
            "交接报告：该表误差0.3s/d，温度修正后符合出厂标准，准予放行",
        )
        print(f"报告结果: {ok} - {msg}")
        if summary:
            print(f"当前步骤: 第{summary['current_step']}步 - {summary['current_step_description']}")

        print_separator("追溯变更历史（训练教练追问时）")
        ok, msg, trail = app.get_photo_audit_trail(mixed_photo_id)
        if ok:
            print(f"共 {len(trail)} 条变更记录:")
            for t in trail:
                print(f"\n  版本 {t['version']}: {t['change_type']}")
                print(f"    时间: {t['timestamp']}")
                print(f"    操作人: {t['operator']}")
                print(f"    字段: {t['field']}")
                print(f"    旧值: {t['old_value']}")
                print(f"    新值: {t['new_value']}")
                print(f"    备注: {t['remark']}")

        print_separator("对比版本差异（改前改后）")
        ok, msg, diff = app.compare_photo_versions(mixed_photo_id, 0, 2)
        if ok:
            print("导入时 vs 教练修正后:")
            print_json(diff)

    print_separator("重复导入同一批（林老师只改了一条备注）")
    rows_reimport = [
        {
            "file_name": "IMG_20240101_001.jpg",
            "original_row": 1,
            "temperature": "25°C",
            "balance_wheel_error": 0.5,
            "handwritten_remark": "林老师补：这台表上次校准正常",
        },
        {
            "file_name": "IMG_20240101_002.jpg",
            "original_row": 2,
            "temperature": "25°C / 298.15K",
            "balance_wheel_error": 0.3,
        },
        {
            "file_name": "IMG_20240101_003.jpg",
            "original_row": 3,
            "temperature": "300开尔文",
            "balance_wheel_error": 0.7,
        },
    ]

    result2 = app.reimport_photos(rows_reimport, "2024年1月工况表.xlsx", batch_id)
    print(f"批次ID: {result2['batch_id']}")
    print(f"总数量: {result2['total_count']} (未翻倍！)")
    print(f"更新的照片: {result2['updated_photos']}")
    print(f"跳过的照片: {result2['skipped_duplicates']}")
    print("\n工作流汇总:")
    print_json(result2["workflow_summary"])

    print_separator("查看林老师更新备注后的历史")
    ok, msg, batch_summary = app.get_batch_summary(batch_id)
    if ok:
        print_json(batch_summary)

    print_separator("演示：回滚操作")
    if pending:
        ok, msg, details = app.get_photo_details(mixed_photo_id)
        if ok:
            current_version = details["version_count"]
            print(f"当前版本: {current_version}")

            ok, msg, summary = app.coach_rollback(
                mixed_photo_id,
                1,
                "复核时发现之前的修正有误，回滚到修正前状态",
            )
            print(f"回滚结果: {ok} - {msg}")
            if summary:
                print(f"已回滚: {summary['is_rollbacked']}")
                print(f"回滚到版本: {summary['rollback_to_version']}")

            ok, msg, trail = app.get_photo_audit_trail(mixed_photo_id)
            if ok:
                print(f"\n回滚后的历史记录（共 {len(trail)} 条）:")
                for t in trail[-2:]:
                    print(f"  版本 {t['version']}: {t['change_type']} - {t['remark']}")

    print_separator("查看边界规则文档（代码内置）")
    rules_doc = app.get_boundary_rules_doc()
    print("代码中内置的边界规则文档已加载，可通过 get_boundary_rules_doc() 获取")
    print(f"文档长度: {len(rules_doc)} 字符")

    print("\n" + "=" * 70)
    print("  演示完成！")
    print("=" * 70)


if __name__ == "__main__":
    main()
