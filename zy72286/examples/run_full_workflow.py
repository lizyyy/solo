"""
老旧小区楼间距复测 - 完整流程样例

使用说明：
1. 确保已安装依赖: pip install -e .
2. 运行: python examples/run_full_workflow.py

这个脚本会走完三步标准流程：
1. 导入障碍物备注（含重复导入检测）
2. 设备工程师许工补看楼层剖面草图
3. 导出截图更新

中间会遇到"补录路线没有重新计算长度"的情况，
系统会标记为待客户复核，而不是自动归为正常。
"""

import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from resurvey.workflow import ThreeStepWorkflow
from resurvey.self_check import SelfChecker
from resurvey.exporter import DataExporter
from resurvey.models import ProcessingStatus


def main():
    print("=" * 70)
    print("老旧小区楼间距复测系统 - 完整流程演示")
    print("=" * 70)

    project = ThreeStepWorkflow()
    print(f"\n项目ID: {project.project.project_id}")

    import_file = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "sample_obstacle_remarks.csv"
    )

    print("\n" + "=" * 70)
    print("[步骤 1/3] 第一次导入障碍物备注")
    print("=" * 70)
    step1 = project.step1_import_obstacle_remarks(import_file, operator="许工")
    print(f"✓ 导入完成: {step1['import_result']['imported']} 条成功, "
          f"{step1['import_result']['duplicates']} 条重复")

    first_record_id = next(iter(project.project.records.keys()))
    second_record_id = list(project.project.records.keys())[1]
    print(f"\n第一条记录ID: {first_record_id}")
    print(f"第二条记录ID: {second_record_id}（将用于补录演示）")

    print("\n" + "=" * 70)
    print("[补充] 设备工程师许工补录路线，触发'补录路线没有重新计算长度'")
    print("=" * 70)
    new_points = [
        {"x": 0, "y": 0},
        {"x": 8, "y": 0},
        {"x": 8, "y": 6},
        {"x": 22.3, "y": 6},
    ]
    supplement_result = project.handle_length_not_recalculated(
        record_id=second_record_id,
        new_points=new_points,
        remark="楼间围墙位置更新，重新测量路线点",
        operator="许工",
        auto_recalculate=False,
    )
    print(f"✓ 补录完成: {supplement_result['supplement_result']['new_point_count']} 个点")
    print(f"  需要重算: {supplement_result['supplement_result']['needs_recalculation']}")
    print(f"  自动重算: {supplement_result['auto_recalculated']}")
    print(f"  留给客户复核: {supplement_result['needs_customer_review']}")
    print(f"  当前状态: {project.project.get_record(second_record_id).obstacle_remark.processing_status.value}")

    print("\n" + "-" * 50)
    print("证据摘要（障碍物备注 + 楼层剖面草图）:")
    print("-" * 50)
    evidence = supplement_result["evidence"]
    print(json.dumps(evidence, ensure_ascii=False, indent=2))

    print("\n" + "=" * 70)
    print("[步骤 2/3] 设备工程师许工补看楼层剖面草图")
    print("=" * 70)
    sketch_file = os.path.join("data", f"{first_record_id}_floor_sketch.png")
    os.makedirs("data", exist_ok=True)
    with open(sketch_file, "w") as f:
        f.write("placeholder for sketch image")

    step2 = project.step2_review_floor_sketches(
        record_id=first_record_id,
        sketch_file_path=sketch_file,
        building="1号楼",
        floors=6,
        review_note="1号楼为6层砖混结构，楼间距测量起点为单元门外侧",
        reviewer="许工",
    )
    print(f"✓ 补看完成: 草图ID {step2['sketch_id']}")
    print(f"  补看备注: {step2['review_result']['note']}")

    step2_2 = project.step2_review_floor_sketches(
        record_id=second_record_id,
        sketch_file_path=sketch_file,
        building="2号楼",
        floors=7,
        review_note="2号楼为7层框架结构，东北角有突出阳台，影响楼间距测量",
        reviewer="许工",
    )
    print(f"✓ 补看完成: 草图ID {step2_2['sketch_id']}")
    print(f"  补看备注: {step2_2['review_result']['note']}")

    print("\n" + "=" * 70)
    print("[步骤 3/3] 导出截图更新")
    print("=" * 70)
    export_dir = "data"
    os.makedirs(export_dir, exist_ok=True)
    excel_path = os.path.join(export_dir, f"{project.project.project_id}_楼间距复测报告.xlsx")
    json_path = os.path.join(export_dir, f"{project.project.project_id}_楼间距复测报告.json")

    step3 = project.step3_export(
        excel_path=excel_path,
        json_path=json_path,
        operator="许工",
    )
    print(f"✓ Excel导出: {step3['excel_export']['success']} -> {excel_path}")
    print(f"✓ JSON导出: {step3['json_export']['success'] if step3['json_export'] else '未执行'} -> {json_path}")
    print(f"✓ 一致性检测: {'通过' if step3['consistency_check']['consistent'] else '不通过'}")

    print("\n" + "=" * 70)
    print("[自检] 四个核心检测")
    print("=" * 70)
    checker = SelfChecker(project.project)
    checks = checker.run_all_checks()
    for check in checks:
        status = "✓ 通过" if check["passed"] else "✗ 不通过"
        print(f"{status} - {check['check_name']}: {check['message']}")

    print("\n" + "=" * 70)
    print("[待客户复核] 补录路线未重算的记录")
    print("=" * 70)
    needing_review = checker.get_records_needing_customer_review()
    print(f"需要展陈客户复核的记录数: {len(needing_review)}")
    for rec in needing_review:
        print(f"\n  记录ID: {rec['record_id']}")
        print(f"  楼栋: {rec['buildings']}")
        print(f"  状态: {rec['status']}")
        print(f"  原始行号: {rec['evidence']['原始行号']}")
        print(f"  原始内容: {rec['evidence']['原始内容']}")
        print(f"  人工改动:")
        for change in rec['evidence']['人工改动记录']:
            print(f"    - {change}")

    print("\n" + "=" * 70)
    print("[模拟客户复核后] 重算路线长度")
    print("=" * 70)
    recalc_result = project.recalculate_after_review(second_record_id, operator="许工")
    print(f"✓ 重算完成: {recalc_result['result']['old_length']} -> {recalc_result['result']['new_length']}")
    print(f"  新状态: {project.project.get_record(second_record_id).obstacle_remark.processing_status.value}")

    print("\n" + "=" * 70)
    print("[最终自检] 确认所有问题已解决")
    print("=" * 70)
    checks = checker.run_all_checks()
    passed = sum(1 for c in checks if c["passed"])
    print(f"自检通过率: {passed}/{len(checks)}")
    for check in checks:
        status = "✓ 通过" if check["passed"] else "✗ 不通过"
        print(f"{status} - {check['check_name']}: {check['message']}")

    print("\n" + "=" * 70)
    print("[API格式输出] 完整证据摘要")
    print("=" * 70)
    api_evidence = project.get_evidence_for_api()
    print(json.dumps({
        "project_id": api_evidence["project_id"],
        "project_name": api_evidence["project_name"],
        "summary": {
            "total_records": api_evidence["summary"]["total_records"],
            "supplementary_records": api_evidence["summary"]["supplementary_records"],
            "needs_customer_review": api_evidence["summary"]["needs_customer_review"],
            "length_not_recalculated": api_evidence["summary"]["length_not_recalculated"],
            "checks_passed": api_evidence["summary"]["checks_passed"],
            "checks_total": api_evidence["summary"]["checks_total"],
        },
        "workflow_steps": [
            {"step": h["step"], "name": h["name"], "timestamp": h["timestamp"]}
            for h in api_evidence["workflow_history"]
        ],
    }, ensure_ascii=False, indent=2))

    project_file = os.path.join(export_dir, f"{project.project.project_id}_project.json")
    project.save_project(project_file)
    print(f"\n✓ 项目已保存: {project_file}")
    print(f"\n🎉 完整流程演示完成！")

    print("\n" + "=" * 70)
    print("生成的文件清单:")
    print("=" * 70)
    print(f"  1. {excel_path} - Excel报告（含明细、待复核、汇总三个sheet）")
    print(f"  2. {json_path} - JSON完整数据导出")
    print(f"  3. {project_file} - 项目存档文件")
    print(f"\nCLI命令查看项目: python -m resurvey.cli show --project-file {project_file}")
    print(f"CLI命令运行自检: python -m resurvey.cli self-check --project-file {project_file}")
    print(f"启动API服务: python -m resurvey.api")


if __name__ == "__main__":
    main()
