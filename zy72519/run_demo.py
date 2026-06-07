#!/usr/bin/env python3
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from core import WorkflowEngine


def print_section(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def main():
    print_section("舆情分类人工改判 - 演示流程")

    base_dir = Path(__file__).parent
    sample_dir = base_dir / "data" / "samples"

    engine = WorkflowEngine(
        data_dir=str(base_dir / "data"),
        output_dir=str(base_dir / "output"),
    )

    print_section("第一步：运行三步核心流程")
    print("1. 导入线上反馈工单（正常+错口径+补录材料）")
    print("2. 标注负责人周姐补看脱敏规则备注")
    print("3. 冲突样本表更新\n")

    result = engine.run_three_step_workflow(
        normal_file=str(sample_dir / "normal_work_orders.json"),
        remarks_file=str(sample_dir / "desensitization_remarks.json"),
        wrong_caliber_file=str(sample_dir / "wrong_caliber_work_orders.json"),
        supplementary_file=str(sample_dir / "supplementary_work_orders.json"),
    )

    print_section("第二步：查看待确认的冲突列表")
    pending = engine.list_pending_conflicts()
    print(f"\n发现 {len(pending)} 个冲突待周姐确认：\n")

    for i, conflict in enumerate(pending, 1):
        print(f"--- 冲突 #{i} ---")
        print(f"  冲突ID: {conflict['conflict_id']}")
        print(f"  工单ID: {conflict['work_order_id']}")
        print(f"  工单标题: {conflict['work_order_title']}")
        print(f"  冲突类型: {conflict['conflict_type']}")
        print(f"  证据:")
        for ev in conflict["evidence"]:
            print(f"    - {ev['description']}")
            print(f"      来源: {ev['source']}")
            if "remark_content" in ev["details"]:
                print(f"      备注内容: {ev['details']['remark_content'][:80]}...")
        print()

    print_section("第三步：周姐确认/驳回冲突（演示）")

    if pending:
        conflict_id = pending[0]["conflict_id"]
        print(f"\n周姐确认冲突 {conflict_id}...")
        confirmed = engine.confirm_conflict(
            conflict_id,
            operator="周姐",
            notes="经核实，此冲突确实存在，需要重新分类",
        )
        print(f"冲突状态更新为: {confirmed['status']}")

        if len(pending) > 1:
            conflict_id2 = pending[1]["conflict_id"]
            print(f"\n周姐驳回冲突 {conflict_id2}...")
            rejected = engine.reject_conflict(
                conflict_id2,
                operator="周姐",
                notes="经核实，分类是正确的，备注描述有误",
            )
            print(f"冲突状态更新为: {rejected['status']}")

    print_section("第四步：运行自检模块")
    print("\n运行基本自检：重复导入、引用链接404、补录重算、导出一致性...\n")

    check_report = engine.run_self_check()

    print(f"\n自检结果汇总:")
    summary = check_report["summary"]
    print(f"  总计: {summary['total']} 项")
    print(f"  通过: {summary['passed']} 项")
    print(f"  失败: {summary['failed']} 项")
    print(f"  错误: {summary['errors']} 项")
    print(f"  警告: {summary['warnings']} 项")

    print("\n详细结果:")
    for r in check_report["results"]:
        status = "✓" if r["passed"] else "✗"
        print(f"  {status} [{r['severity']}] {r['check_name']}: {r['message']}")

    print_section("第五步：导出所有数据")
    engine.export_all()

    print("\n生成的文件:")
    output_dir = base_dir / "output"
    for f in sorted(output_dir.glob("*")):
        if f.is_file():
            print(f"  - {f.relative_to(base_dir)}")

    reports_dir = base_dir / "reports"
    for f in sorted(reports_dir.glob("*")):
        if f.is_file():
            print(f"  - {f.relative_to(base_dir)}")

    print_section("演示完成")
    print("\n请查看 output/ 和 reports/ 目录下的输出文件。")
    print("详细使用说明请参考 README.md。\n")


if __name__ == "__main__":
    main()
