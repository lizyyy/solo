#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
合唱声部排练优化系统 - 命令行界面
朴素易用，调度主管周姐也能轻松操作
"""
import sys
import os
import argparse
import json
from pathlib import Path
from datetime import datetime

from choir_optimizer.workflow import ChoirOptimizationWorkflow
from choir_optimizer.params import ParameterManager
from choir_optimizer.config import EXAMPLES_DIR


def cmd_run(args):
    """运行完整工作流"""
    print("=" * 60)
    print("  合唱声部排练优化系统")
    print("=" * 60)
    print()
    workflow = ChoirOptimizationWorkflow()
    print(f"批次号: {workflow.batch_id}")
    print()
    param_updates = None
    if args.params:
        try:
            param_updates = json.loads(args.params)
        except json.JSONDecodeError:
            print(f"❌ 参数格式错误: {args.params}")
            print("   正确格式: '{\"weights.音准得分\": 0.35}'")
            return
    review_data = None
    if args.review:
        try:
            review_data = json.loads(args.review)
        except json.JSONDecodeError:
            print(f"❌ 复盘数据格式错误: {args.review}")
            return
    supplements = None
    if args.supplement:
        try:
            supplements = json.loads(args.supplement)
            if not isinstance(supplements, list):
                supplements = [supplements]
        except json.JSONDecodeError:
            print(f"❌ 补录数据格式错误: {args.supplement}")
            return
    data_dir = args.data_dir
    if not Path(data_dir).exists():
        print(f"❌ 数据目录不存在: {data_dir}")
        return
    result = workflow.run_full_workflow(
        data_dir=data_dir,
        param_updates=param_updates,
        review_data=review_data,
        supplements=supplements,
        operator=args.operator
    )
    print()
    print("=" * 60)
    print("  处理完成！")
    print("=" * 60)
    print(f"📄 文本报告: {result['report']['text_report']}")
    print(f"🌐 HTML报告: {result['report']['html_report']}")
    print(f"📊 图表数量: {result['charts']['count']}")
    print(f"⚠️  异常数量: {result['anomalies']['total_count']}")
    print(f"🔀 冲突数量: {result['conflicts']['total_count']}")
    if args.export:
        export_result = workflow.export_all()
        print(f"📦 完整导出: {export_result['export_path']}")
    print()
    print("💡 如需复查计算过程，请运行:")
    print(f"   python cli.py audit --batch {workflow.batch_id} --record <记录ID>")


def cmd_rework(args):
    """返工处理：基于已有批次补录后重新计算"""
    print("=" * 60)
    print("  返工处理 - 基于已有批次补录后重新计算")
    print("=" * 60)
    print()
    workflow = ChoirOptimizationWorkflow()
    print(f"原批次: {args.batch_id}")
    print(f"新批次: {workflow.batch_id}")
    print()
    try:
        supplements = json.loads(args.supplement)
        if not isinstance(supplements, list):
            supplements = [supplements]
    except json.JSONDecodeError:
        print(f"❌ 补录数据格式错误: {args.supplement}")
        return
    review_data = None
    if args.review:
        try:
            review_data = json.loads(args.review)
        except json.JSONDecodeError:
            print(f"❌ 复盘数据格式错误: {args.review}")
            return
    result = workflow.run_rework_workflow(
        existing_batch_id=args.batch_id,
        supplements=supplements,
        review_data=review_data
    )
    print()
    print("=" * 60)
    print("  返工完成！")
    print("=" * 60)
    print(f"📄 文本报告: {result['report']['text_report']}")
    print(f"🌐 HTML报告: {result['report']['html_report']}")
    if args.export:
        export_result = workflow.export_all()
        print(f"📦 完整导出: {export_result['export_path']}")


def cmd_audit(args):
    """查询计算审计，用于复查"""
    workflow = ChoirOptimizationWorkflow(batch_id=args.batch)
    if args.record:
        print(f"查询记录 {args.record} 的计算过程...")
        audits = workflow.query_calc_audit(args.record)
        if not audits:
            print("❌ 未找到计算记录")
            return
        for audit in audits:
            print()
            print(f"计算类型: {audit['calc_type']}")
            print(f"结果值: {audit['result_value']}")
            print(f"参数版本: {audit['param_version']}")
            print("计算步骤:")
            for i, step in enumerate(audit.get('steps', []), 1):
                print(f"  {i}. {step['step_name']}")
                print(f"     公式: {step['formula']}")
                print(f"     输出: {step['output_value']}")
            print(f"计算ID: {audit['id']}")
        print()
        print("✅ 计算过程清晰可复查")
    elif args.param:
        print(f"查询参数 {args.param} 的历史版本...")
        pm = ParameterManager()
        history = pm.get_param_history(args.param)
        if not history:
            print("❌ 未找到参数历史")
            return
        for h in history:
            print(f"版本{v['version']}: {h['old_value']} → {h['new_value']}")
            print(f"  原因: {h['reason']}")
            print(f"  操作人: {h['operator']}")
            print(f"  时间: {h['created_at']}")
            print()


def cmd_decision(args):
    """获取冲突决策支持（只摆证据，不替用户拍板）"""
    workflow = ChoirOptimizationWorkflow(batch_id=args.batch)
    if args.conflict_id:
        decision = workflow.get_decision_support(args.conflict_id)
        if not decision:
            print("❌ 未找到冲突记录")
            return
        print()
        print("=" * 50)
        print(f"  决策支持 - 冲突字段: {decision['field']}")
        print("=" * 50)
        print()
        print("📋 两边证据：")
        for i, opt in enumerate(decision['options'], 1):
            print(f"  选项{i}: 来源[{opt['source']}]")
            print(f"         值: {opt['value']}")
            print(f"         证据: {opt['evidence']}")
            print()
        print("💡 建议动作:")
        print(f"   {decision['suggested_action']}")
        print()
        print(f"⚠️  {decision['note']}")
        print()
        if args.resolve:
            result = workflow.resolve_conflict(
                args.conflict_id,
                args.resolve,
                args.operator
            )
            print(f"✅ 已记录解决结果: {args.resolve}")
        else:
            print("💡 如需记录决策，请添加 --resolve \"决策内容\"")


def cmd_params(args):
    """参数管理 - 确保人工调优不被默认值覆盖"""
    pm = ParameterManager()
    if args.list:
        params = pm.get_all_params()
        diffs = pm.compare_with_defaults()
        print("当前参数配置:")
        print(json.dumps(params, ensure_ascii=False, indent=2))
        print()
        if diffs:
            print(f"⚠️  有 {len(diffs)} 个参数已人工修改（不会被默认值覆盖）:")
            for key, diff in diffs.items():
                print(f"  {key}: {diff.get('default')} → {diff.get('current')}")
        else:
            print("✅ 当前使用默认参数")
    elif args.set:
        try:
            updates = json.loads(args.set)
            if not isinstance(updates, dict):
                raise ValueError("必须是字典格式")
        except Exception as e:
            print(f"❌ 参数格式错误: {e}")
            print("   正确格式: '{\"weights.音准得分\": 0.35}'")
            return
        results = pm.set_params_batch(updates, args.reason, args.operator)
        print(f"✅ 已设置 {len(results)} 个参数:")
        for r in results:
            print(f"  {r['key']}: {r['old_value']} → {r['new_value']}")
    elif args.export:
        path = pm.export_params(args.export if args.export != "true" else None)
        print(f"✅ 参数已导出到: {path}")
    elif args.reset:
        if args.yes:
            pm.reset_to_default(args.reset if args.reset != "all" else None, args.operator)
            print(f"✅ 已重置参数为默认值")
        else:
            print("⚠️  此操作将重置所有人工调优参数为默认值")
            print("   请添加 --yes 确认")
    elif args.history:
        history = pm.get_param_history(args.history)
        if not history:
            print("❌ 未找到参数历史")
            return
        print(f"参数 {args.history} 的历史版本:")
        for h in history:
            print(f"  版本{h['version']}: {h['old_value']} → {h['new_value']}")
            print(f"         原因: {h['reason']}, 操作人: {h['operator']}")
            print(f"         时间: {h['created_at']}")
            print()


def cmd_demo_smooth(args):
    """演示场景1：一次顺利处理"""
    print("🎬 演示场景：一次顺利处理")
    print("=" * 60)
    print()
    print("场景说明:")
    print("  - 多源数据导入（业务表CSV、老师讲义YAML、临时截图TXT）")
    print("  - 数据质量良好，无冲突，有少量边界样本")
    print("  - 人工微调一个参数（提高音准权重）")
    print("  - 补录一条指挥备注")
    print()
    data_dir = EXAMPLES_DIR / "smooth"
    workflow = ChoirOptimizationWorkflow()
    print(f"批次号: {workflow.batch_id}")
    print()
    result = workflow.step1_import_data(str(data_dir))
    print()
    print("💡 周姐：根据上次复盘，音准应该更重要一些")
    param_updates = {"weights.音准得分": 0.35, "weights.情感表达": 0.05}
    result["params"] = workflow.step2_set_params(param_updates, "根据上次复盘调整权重", "周姐")
    print()
    result["calculation"] = workflow.step3_calculate()
    print()
    result["anomalies"] = workflow.step4_detect_anomalies()
    print()
    result["conflicts"] = workflow.step5_detect_conflicts()
    print()
    print("💡 周姐：钱伟强这次情感表达特别好，补录一条备注")
    personal_df = result["calculation"]["personal_scores"]
    qian_record = personal_df[personal_df["人员"] == "钱伟强"].iloc[0]
    supplements = [
        {
            "type": "add_remark",
            "record_id": qian_record["_record_id"],
            "remark": "2026-05-30排练情感表达特别到位，继续保持",
            "operator": "周姐"
        }
    ]
    result["supplements"] = workflow.step6_supplement(supplements)
    result["calculation"] = workflow.step3_calculate()
    result["anomalies"] = workflow.step4_detect_anomalies()
    result["conflicts"] = workflow.step5_detect_conflicts()
    print()
    result["charts"] = workflow.step7_generate_charts()
    print()
    result["report"] = workflow.step8_generate_report()
    print()
    print("=" * 60)
    print("  演示完成！")
    print("=" * 60)
    print()
    print("📊 处理结果摘要:")
    print(f"  总人数: {len(result['calculation']['personal_scores'])}")
    print(f"  声部数: {len(result['calculation']['section_metrics'])}")
    print(f"  异常数: {result['anomalies']['total_count']}")
    print(f"  冲突数: {result['conflicts']['total_count']}")
    print(f"  补录数: {result['supplements']['count']}")
    print()
    print("📄 报告文件:")
    print(f"  文本: {result['report']['text_report']}")
    print(f"  HTML: {result['report']['html_report']}")
    print()
    print("🔍 可复查内容:")
    print(f"  参数版本: {result['params']['param_version']}")
    print(f"  计算审计: 可通过记录ID查询每步计算")
    print(f"  完整导出: python cli.py export --batch {workflow.batch_id}")
    return workflow


def cmd_demo_rework(args):
    """演示场景2：一次返工处理"""
    print("🎬 演示场景：一次返工处理")
    print("=" * 60)
    print()
    print("场景说明:")
    print("  - 数据有冲突（业务表 vs 老师手写记录）")
    print("  - 复盘图表说法与导入数据冲突")
    print("  - 有数据缺失、低分异常、边界样本")
    print("  - 先处理第一版，发现问题后补录修正，重新计算")
    print()
    print("【第一轮：初步处理】")
    print("-" * 50)
    print()
    data_dir = EXAMPLES_DIR / "rework"
    workflow1 = ChoirOptimizationWorkflow()
    print(f"批次号: {workflow1.batch_id}")
    print()
    review_data = {
        "女高音": {"个人综合分": 82, "声部人数": 5},
        "女低音": {"个人综合分": 78, "声部人数": 5},
        "男高音": {"个人综合分": 83, "声部人数": 5},
        "男低音": {"个人综合分": 75, "声部人数": 6}
    }
    result1 = workflow1.run_full_workflow(
        data_dir=str(data_dir),
        review_data=review_data,
        operator="周姐"
    )
    print()
    print("📊 第一轮处理结果:")
    print(f"  异常数: {result1['anomalies']['total_count']} "
          f"(高{result1['anomalies']['high_count']} "
          f"中{result1['anomalies']['medium_count']} "
          f"低{result1['anomalies']['low_count']})")
    print(f"  冲突数: {result1['conflicts']['total_count']}")
    print()
    print("💡 周姐：发现问题了，需要核实几个冲突")
    print()
    print("【第二轮：返工处理】")
    print("-" * 50)
    print()
    print("核实结果:")
    print("  - 王芳芳音准：业务表75错误，实际应为78（以老师手写为准）")
    print("  - 赵雅琴出勤：业务表缺勤错误，实际是请假")
    print("  - 孙玉婷音准：缺失，根据记录补录75")
    print()
    workflow2 = ChoirOptimizationWorkflow()
    print(f"新批次号: {workflow2.batch_id}")
    print(f"基于批次: {workflow1.batch_id}")
    print()
    personal_df1 = result1["calculation"]["personal_scores"]
    wang_record = personal_df1[personal_df1["人员"] == "王芳芳"].iloc[0]
    zhao_record = personal_df1[personal_df1["人员"] == "赵雅琴"].iloc[0]
    sun_record = personal_df1[personal_df1["人员"] == "孙玉婷"].iloc[0]
    supplements = [
        {
            "type": "correct_field",
            "record_id": wang_record["_record_id"],
            "field_name": "音准得分",
            "new_value": 78,
            "reason": "与老师手写记录核对，业务表录入错误，实际为78",
            "operator": "周姐"
        },
        {
            "type": "correct_field",
            "record_id": zhao_record["_record_id"],
            "field_name": "出勤状态",
            "new_value": "请假",
            "reason": "与老师手写记录核对，业务表录入错误，实际为请假",
            "operator": "周姐"
        },
        {
            "type": "correct_field",
            "record_id": sun_record["_record_id"],
            "field_name": "音准得分",
            "new_value": 75,
            "reason": "数据缺失，根据老师手写记录补录75",
            "operator": "周姐"
        },
        {
            "type": "correct_field",
            "record_id": sun_record["_record_id"],
            "field_name": "节奏得分",
            "new_value": 78,
            "reason": "数据缺失，根据老师手写记录补录78",
            "operator": "周姐"
        }
    ]
    result2 = workflow2.run_rework_workflow(
        existing_batch_id=workflow1.batch_id,
        supplements=supplements,
        review_data=review_data
    )
    print()
    print("📊 第二轮处理结果:")
    print(f"  异常数: {result2['anomalies']['total_count']} "
          f"(高{result2['anomalies']['high_count']} "
          f"中{result2['anomalies']['medium_count']} "
          f"低{result2['anomalies']['low_count']})")
    print(f"  冲突数: {result2['conflicts']['total_count']}")
    print(f"  补录数: {result2['supplements']['count']}")
    print()
    print("=" * 60)
    print("  返工演示完成！")
    print("=" * 60)
    print()
    print("📄 报告文件:")
    print(f"  第一轮文本: {result1['report']['text_report']}")
    print(f"  第二轮文本: {result2['report']['text_report']}")
    print(f"  第二轮HTML: {result2['report']['html_report']}")
    print()
    print("🔍 可复查内容:")
    print(f"  两轮数据均可独立追溯")
    print(f"  补录记录有差异对比")
    print(f"  冲突证据完整保留，解决结果有记录")
    print()
    print("💡 周姐不用再手工核对第二遍了！")
    return workflow1, workflow2


def cmd_export(args):
    """导出所有可复查数据"""
    workflow = ChoirOptimizationWorkflow(batch_id=args.batch)
    result = workflow.export_all(args.output)
    print(f"✅ 完整数据已导出到: {result['export_path']}")


def main():
    parser = argparse.ArgumentParser(
        description="合唱声部排练优化系统 - 调度主管周姐的好帮手",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 运行完整工作流
  python cli.py run --data-dir examples/smooth

  # 带参数调整和复盘数据
  python cli.py run --data-dir examples/smooth \\
      --params '{"weights.音准得分": 0.35}' \\
      --review '{"女高音": {"个人综合分": 85}}'

  # 返工处理
  python cli.py rework --batch-id <原批次号> \\
      --supplement '[{"type": "correct_field", "record_id": "...", "field_name": "音准得分", "new_value": 78, "reason": "..."}]'

  # 复查计算过程
  python cli.py audit --batch <批次号> --record <记录ID>

  # 查看参数
  python cli.py params --list

  # 演示：顺利处理
  python cli.py demo-smooth

  # 演示：返工处理
  python cli.py demo-rework

  # 导出完整数据
  python cli.py export --batch <批次号>
        """
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    parser_run = subparsers.add_parser("run", help="运行完整工作流")
    parser_run.add_argument("--data-dir", required=True, help="数据目录路径")
    parser_run.add_argument("--params", help="参数调整(JSON格式)")
    parser_run.add_argument("--review", help="复盘图表数据(JSON格式)")
    parser_run.add_argument("--supplement", help="补录数据(JSON格式)")
    parser_run.add_argument("--operator", default="周姐", help="操作人")
    parser_run.add_argument("--export", action="store_true", help="完成后导出完整数据")

    parser_rework = subparsers.add_parser("rework", help="返工处理")
    parser_rework.add_argument("--batch-id", required=True, help="原批次号")
    parser_rework.add_argument("--supplement", required=True, help="补录数据(JSON格式)")
    parser_rework.add_argument("--review", help="复盘图表数据(JSON格式)")
    parser_rework.add_argument("--operator", default="周姐", help="操作人")
    parser_rework.add_argument("--export", action="store_true", help="完成后导出完整数据")

    parser_audit = subparsers.add_parser("audit", help="审计复查")
    parser_audit.add_argument("--batch", required=True, help="批次号")
    parser_audit.add_argument("--record", help="记录ID（查询计算过程）")
    parser_audit.add_argument("--param", help="参数名（查询参数历史）")

    parser_decision = subparsers.add_parser("decision", help="冲突决策支持")
    parser_decision.add_argument("--batch", required=True, help="批次号")
    parser_decision.add_argument("--conflict-id", required=True, help="冲突ID")
    parser_decision.add_argument("--resolve", help="记录解决结果")
    parser_decision.add_argument("--operator", default="周姐", help="操作人")

    parser_params = subparsers.add_parser("params", help="参数管理")
    parser_params.add_argument("--list", action="store_true", help="列出当前参数")
    parser_params.add_argument("--set", help="设置参数(JSON格式)")
    parser_params.add_argument("--reason", default="人工调优", help="调整原因")
    parser_params.add_argument("--operator", default="周姐", help="操作人")
    parser_params.add_argument("--export", nargs="?", const="true", help="导出参数到文件")
    parser_params.add_argument("--reset", nargs="?", const="all", help="重置为默认值")
    parser_params.add_argument("--yes", action="store_true", help="确认重置")
    parser_params.add_argument("--history", help="查看参数历史")

    parser_demo_smooth = subparsers.add_parser("demo-smooth", help="演示：一次顺利处理")
    parser_demo_smooth.add_argument("--export", action="store_true", help="完成后导出完整数据")

    parser_demo_rework = subparsers.add_parser("demo-rework", help="演示：一次返工处理")
    parser_demo_rework.add_argument("--export", action="store_true", help="完成后导出完整数据")

    parser_export = subparsers.add_parser("export", help="导出完整数据")
    parser_export.add_argument("--batch", required=True, help="批次号")
    parser_export.add_argument("--output", help="输出目录")

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return

    try:
        if args.command == "run":
            cmd_run(args)
        elif args.command == "rework":
            cmd_rework(args)
        elif args.command == "audit":
            cmd_audit(args)
        elif args.command == "decision":
            cmd_decision(args)
        elif args.command == "params":
            cmd_params(args)
        elif args.command == "demo-smooth":
            cmd_demo_smooth(args)
        elif args.command == "demo-rework":
            cmd_demo_rework(args)
        elif args.command == "export":
            cmd_export(args)
    except KeyboardInterrupt:
        print("\n\n操作已取消")
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
