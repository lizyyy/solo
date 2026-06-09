#!/usr/bin/env python3
"""距离度量门店分群 - 命令行接口"""

import argparse
import sys
import os
import json
from datetime import datetime
from typing import List, Dict, Any

from models import ProcessingType, RecordStatus
from store import DataStore
from importer import DataImporter
from annotation import AnnotationManager
from grouping import GroupingEngine
from auditor import AuditExporter
from demo_data import DemoDataGenerator


class StoreGroupingCLI:
    """命令行接口"""

    def __init__(self, data_dir: str = "data"):
        self.store = DataStore(data_dir)
        self.importer = DataImporter(self.store)
        self.annotation_manager = AnnotationManager(self.store)
        self.grouping_engine = GroupingEngine(self.store)
        self.auditor = AuditExporter(self.store)

    def cmd_init_demo(self, args):
        """初始化演示数据"""
        print("🚀 正在初始化距离度量门店分群演示数据...")
        generator = DemoDataGenerator(self.store.base_dir)
        results = generator.generate_all()

        print("\n✅ 演示数据初始化完成！")
        print("\n📋 记录列表:")
        for key, info in results.items():
            print(f"  {info['store_name']} ({info['record_id']}) - {info['processing_type']}")

        print("\n💡 下一步操作:")
        print(f"  查看汇总: python {sys.argv[0]} summary")
        print(f"  查看单条: python {sys.argv[0]} show --record-id {results['smooth']['record_id']}")
        print(f"  导出复盘: python {sys.argv[0]} export-all")
        print(f"  查看演示流程: python {sys.argv[0]} demo-flow")

    def cmd_create(self, args):
        """创建新记录"""
        try:
            ptype = ProcessingType[args.processing_type]
        except KeyError:
            print(f"❌ 无效的处理类型: {args.processing_type}")
            print(f"   可选值: {[t.name for t in ProcessingType]}")
            return 1

        record = self.importer.create_new_record(
            store_id=args.store_id,
            store_name=args.store_name,
            processing_type=ptype,
            operator=args.operator
        )
        print(f"✅ 创建记录成功: {record.record_id} ({record.store_name})")
        return 0

    def cmd_import_screenshot(self, args):
        """导入旧公式截图"""
        try:
            screenshot = self.importer.import_screenshot(
                record_id=args.record_id,
                screenshot_path=args.path,
                formula_text=args.formula,
                description=args.desc,
                operator=args.operator
            )
            print(f"✅ 导入截图成功: {screenshot.screenshot_id}")
            print(f"   描述: {screenshot.description}")
            return 0
        except ValueError as e:
            print(f"❌ {e}")
            return 1

    def cmd_import_answers(self, args):
        """导入学生答案"""
        try:
            if args.answers_json:
                with open(args.answers_json, "r", encoding="utf-8") as f:
                    data = json.load(f)
                answers_data = data.get("student_answers", [])
            else:
                answers_data = json.loads(args.answers)

            record, answers = self.importer.import_student_answers(
                record_id=args.record_id,
                answers_data=answers_data,
                operator=args.operator
            )

            print(f"✅ 导入成功，共 {len(answers)} 条答案")
            if record.has_duplicate_answers():
                dup_count = len(record.get_duplicate_answers())
                print(f"⚠️  检测到 {dup_count} 条重复答案（同一学生多版）")
                print(f"   当前状态: {record.status.value}")
                print(f"   误差说明: {record.error_explanation.current_text}")
            return 0
        except ValueError as e:
            print(f"❌ {e}")
            return 1

    def cmd_mark_review(self, args):
        """标记待业务运营复核"""
        try:
            record = self.importer.mark_for_review(
                record_id=args.record_id,
                operator=args.operator
            )
            print(f"✅ 已标记待业务运营复核")
            print(f"   记录: {record.store_name} ({record.record_id})")
            print(f"   状态: {record.status.value}")
            print(f"   误差说明: {record.error_explanation.current_text}")
            return 0
        except ValueError as e:
            print(f"❌ {e}")
            return 1

    def cmd_add_annotation(self, args):
        """添加老师批注"""
        try:
            annotation = self.annotation_manager.add_annotation(
                record_id=args.record_id,
                teacher_name=args.teacher,
                content=args.content,
                old_standard_reference=args.old_standard,
                error_explanation_update=args.error_update,
                operator=args.operator
            )
            print(f"✅ 添加批注成功: {annotation.annotation_id}")
            print(f"   老师: {annotation.teacher_name}")
            print(f"   内容: {annotation.content}")
            if args.error_update:
                record = self.store.get_record(args.record_id)
                print(f"   误差说明已更新为: {record.error_explanation.current_text}")
            return 0
        except ValueError as e:
            print(f"❌ {e}")
            return 1

    def cmd_review_duplicate(self, args):
        """业务运营复核重复答案"""
        try:
            record = self.annotation_manager.review_duplicate_answers(
                record_id=args.record_id,
                approved_answer_id=args.approved_answer_id,
                reviewer=args.reviewer
            )
            print(f"✅ 复核完成")
            print(f"   记录: {record.store_name}")
            print(f"   当前状态: {record.status.value}")
            print(f"   误差说明: {record.error_explanation.current_text}")
            return 0
        except ValueError as e:
            print(f"❌ {e}")
            return 1

    def cmd_manual_correct(self, args):
        """人工修正"""
        try:
            record = self.annotation_manager.manual_correct(
                record_id=args.record_id,
                correction_note=args.note,
                operator=args.operator
            )
            print(f"✅ 人工修正完成")
            print(f"   修正说明: {record.manual_correction_note}")
            return 0
        except ValueError as e:
            print(f"❌ {e}")
            return 1

    def cmd_run_grouping(self, args):
        """运行分群算法"""
        try:
            result = self.grouping_engine.run_grouping(
                record_id=args.record_id,
                operator=args.operator
            )
            if result:
                print(f"✅ 分群完成")
                print(f"   门店: {result.store_id}")
                print(f"   分群结果: {result.final_group}")
                print(f"   置信度: {result.confidence:.2%}")
                print(f"   误差说明: {result.error_explanation}")
            else:
                record = self.store.get_record(args.record_id)
                print(f"⏸️  分群被阻止")
                print(f"   原因: {record.status.value}")
                print(f"   误差说明: {record.error_explanation.current_text}")
            return 0
        except ValueError as e:
            print(f"❌ {e}")
            return 1

    def cmd_re_run(self, args):
        """重跑分群"""
        try:
            result = self.grouping_engine.re_run(
                record_id=args.record_id,
                operator=args.operator
            )
            if result:
                record = self.store.get_record(args.record_id)
                print(f"✅ 重跑完成（第{record.re_run_count}次）")
                print(f"   分群结果: {result.final_group}")
                print(f"   置信度: {result.confidence:.2%}")
            else:
                record = self.store.get_record(args.record_id)
                print(f"⏸️  分群被阻止: {record.status.value}")
            return 0
        except ValueError as e:
            print(f"❌ {e}")
            return 1

    def cmd_show(self, args):
        """显示记录详情"""
        self.auditor.print_audit_summary(args.record_id)
        return 0

    def cmd_summary(self, args):
        """显示汇总"""
        self.auditor.print_audit_summary()
        return 0

    def cmd_export_audit(self, args):
        """导出单条复盘记录"""
        try:
            path = self.auditor.export_audit_trail(
                record_id=args.record_id,
                output_dir=args.output_dir
            )
            print(f"✅ 复盘记录已导出: {path}")
            return 0
        except ValueError as e:
            print(f"❌ {e}")
            return 1

    def cmd_export_all(self, args):
        """导出所有复盘记录"""
        paths = self.auditor.export_all_audit_trails(output_dir=args.output_dir)
        summary_path = self.auditor.generate_summary_report(output_dir=args.output_dir)
        print(f"✅ 已导出 {len(paths)} 条复盘记录")
        for p in paths:
            print(f"   - {p}")
        print(f"✅ 汇总报告: {summary_path}")
        return 0

    def cmd_list(self, args):
        """列出所有记录"""
        records = self.store.get_all_records()
        print(f"\n共 {len(records)} 条记录:\n")
        for r in records:
            result = self.store.get_grouping_result(r.record_id)
            group = result.final_group if result else "未分群"
            print(f"  [{r.status.value}] {r.record_id} - {r.store_name}")
            print(f"      类型: {r.processing_type.value} | 分群: {group}")
            print(f"      误差: {r.error_explanation.current_text[:50]}...")
            print()
        return 0

    def cmd_demo_flow(self, args):
        """展示完整演示流程 - 所有状态、分群、误差说明引用同一份最新 record"""
        records = self.store.get_all_records()
        if not records:
            print("❌ 请先运行: python cli.py init-demo")
            return 1

        smooth = [r for r in records if r.processing_type == ProcessingType.SMOOTH][0]
        duplicate = [r for r in records if r.processing_type == ProcessingType.DUPLICATE][0]
        old_std = [r for r in records if r.processing_type == ProcessingType.OLD_STANDARD_SUPPLEMENT][0]

        auditor = AuditExporter(self.store)

        smooth_result = self.store.get_grouping_result(smooth.record_id)
        duplicate_result = self.store.get_grouping_result(duplicate.record_id)
        old_std_result = self.store.get_grouping_result(old_std.record_id)

        dup_is_pending = duplicate.status in [RecordStatus.PENDING_REVIEW, RecordStatus.DUPLICATE_DETECTED]
        dup_approved_id = auditor._find_approved_answer(duplicate)
        dup_reviewer = auditor._find_reviewer_name(duplicate)
        dup_approved = next((a for a in duplicate.student_answers if a.answer_id == dup_approved_id), None)

        print("\n" + "=" * 70)
        print("📚 距离度量门店分群 - 完整演示流程（所有视图引用同一份最新数据）")
        print("=" * 70)

        print("\n🎬 场景一：顺利记录（望京SOHO店）")
        print("-" * 50)
        print("  步骤1: 小祁导入旧公式截图")
        print(f"    命令: python cli.py import-screenshot --record-id {smooth.record_id} ...")
        print("  步骤2: 导入学生答案（无重复）")
        print(f"    命令: python cli.py import-answers --record-id {smooth.record_id} ...")
        print("  步骤3: 运行分群算法")
        print(f"    命令: python cli.py run-grouping --record-id {smooth.record_id}")
        smooth_group = (smooth.final_group if smooth.final_group else
                        (smooth_result.final_group if smooth_result else "未分群"))
        print(f"  ✅ 最新结果: {smooth_group}（状态：{smooth.status.value}）")

        print("\n🎬 场景二：同一学生两版答案（国贸商城店）")
        print("-" * 50)
        print("  步骤1: 小祁导入旧公式截图")
        print(f"    命令: python cli.py import-screenshot --record-id {duplicate.record_id} ...")
        print("  步骤2: 导入学生答案（同一学生小红交了两版）")
        print(f"    命令: python cli.py import-answers --record-id {duplicate.record_id} ...")
        print("  ⚠️  系统自动检测到重复，不自动归正常")
        print(f"     当前状态: {duplicate.status.value}" + ("，分群已阻止" if dup_is_pending else ""))
        print(f"     误差说明: {duplicate.error_explanation.current_text}")
        print("  步骤3: 小祁标记待业务运营复核")
        print(f"    命令: python cli.py mark-review --record-id {duplicate.record_id}")
        if dup_is_pending:
            print("  🔴 下一步：业务运营复核，指定正确版本（未执行，留待人工）")
            print(f"     可用命令:")
            for a in duplicate.student_answers:
                print(f"       python cli.py review-duplicate --record-id {duplicate.record_id} --approved-answer-id {a.answer_id} --reviewer <姓名>  # 采纳{a.student_name}v{a.version}")
            print("     💡 关键细节: 不提前归正常，留给业务运营复核后才分群")
        else:
            print(f"  步骤4: 业务运营{dup_reviewer or '（已）'}复核，指定采纳{dup_approved.student_name if dup_approved else ''}v{dup_approved.version if dup_approved else ''}")
            print(f"    命令: python cli.py review-duplicate --record-id {duplicate.record_id} --approved-answer-id {dup_approved_id} --reviewer {dup_reviewer or '<运营姓名>'}")
            dup_group = (duplicate.final_group if duplicate.final_group else
                         (duplicate_result.final_group if duplicate_result else "未分群"))
            print(f"  步骤5: 运行分群 → {dup_group}（状态：{duplicate.status.value}）")
            print(f"    命令: python cli.py run-grouping --record-id {duplicate.record_id}")

        print("\n🎬 场景三：老师批注补录旧口径（三里屯太古里店）")
        print("-" * 50)
        print("  步骤1: 小祁导入旧公式截图")
        print(f"    命令: python cli.py import-screenshot --record-id {old_std.record_id} ...")
        print("  步骤2: 导入学生答案")
        print(f"    命令: python cli.py import-answers --record-id {old_std.record_id} ...")
        print("  步骤3: 第一次分群")
        print(f"    命令: python cli.py run-grouping --record-id {old_std.record_id}")
        print("  步骤4: 小祁补录李老师的批注，更新误差说明")
        print(f"    命令: python cli.py add-annotation --record-id {old_std.record_id} ...")
        print(f"     误差说明已更新为: {old_std.error_explanation.current_text}")
        print("  步骤5: 人工修正（应用旧口径）")
        print(f"    命令: python cli.py manual-correct --record-id {old_std.record_id} ...")
        print(f"    修正说明: {old_std.manual_correction_note}")
        print("  步骤6: 重跑分群")
        print(f"    命令: python cli.py re-run --record-id {old_std.record_id}")
        old_std_group = (old_std.final_group if old_std.final_group else
                         (old_std_result.final_group if old_std_result else "未分群"))
        print(f"  ✅ 最终结果: {old_std_group}（状态：{old_std.status.value}，共运行{old_std.re_run_count}次）")

        print("\n" + "=" * 70)
        print("🎯 三种处理结果对比（均引用同一份最新 record）")
        print("=" * 70)

        print(f"\n  1. 顺利记录（望京SOHO店）:")
        smooth_conf = f"{smooth_result.confidence:.2%}" if smooth_result else "-"
        print(f"     分群: {smooth_group} | 置信度: {smooth_conf}")
        print(f"     状态: {smooth.status.value} | 误差: {smooth.error_explanation.current_text}")

        print(f"\n  2. 两版答案（国贸商城店）:")
        if dup_is_pending:
            print(f"     状态: {duplicate.status.value} | 不自动归正常，留待业务运营复核")
            print(f"     分群: 未分群（待运营复核后再执行）")
            print(f"     误差: {duplicate.error_explanation.current_text}")
            print(f"     下一步找谁: 业务运营使用 review-duplicate 命令指定正确版本")
        else:
            dup_group = (duplicate.final_group if duplicate.final_group else
                         (duplicate_result.final_group if duplicate_result else "未分群"))
            dup_conf = f"{duplicate_result.confidence:.2%}" if duplicate_result else "-"
            print(f"     状态: {duplicate.status.value} | 运营: {dup_reviewer or '-'}")
            print(f"     分群: {dup_group} | 置信度: {dup_conf}")
            print(f"     采纳: {dup_approved.student_name if dup_approved else '-'}v{dup_approved.version if dup_approved else '-'}")
            print(f"     误差: {duplicate.error_explanation.current_text}")

        print(f"\n  3. 旧口径补录（三里屯太古里店）:")
        old_std_conf = f"{old_std_result.confidence:.2%}" if old_std_result else "-"
        print(f"     分群: {old_std_group} | 置信度: {old_std_conf}")
        print(f"     状态: {old_std.status.value} | 重跑次数: {old_std.re_run_count}")
        print(f"     误差: {old_std.error_explanation.current_text}")
        print(f"     旧口径: {old_std.annotations[0].old_standard_reference if old_std.annotations else 'N/A'}")

        print("\n" + "=" * 70)
        print("📖 复盘与重跑（与 record 同一份最新结果）")
        print("=" * 70)
        print("\n  导出复盘记录（含可直接复制粘贴的重跑命令）:")
        print(f"    python cli.py export-audit --record-id {smooth.record_id}")
        print(f"    python cli.py export-audit --record-id {duplicate.record_id}")
        print(f"    python cli.py export-all")
        print("\n  查看单条详情:")
        print(f"    python cli.py show --record-id {duplicate.record_id}")
        print("\n  重跑任意记录（先复核的话国贸店需要先 review-duplicate）:")
        print(f"    python cli.py re-run --record-id {old_std.record_id}")
        print("=" * 70 + "\n")

        return 0


def main():
    parser = argparse.ArgumentParser(
        description="距离度量门店分群系统 - 处理门店分群数据，追踪同一学生多版答案"
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    parser.add_argument("--data-dir", default="data", help="数据目录")

    p_init = subparsers.add_parser("init-demo", help="初始化演示数据")
    p_init.set_defaults(func="cmd_init_demo")

    p_create = subparsers.add_parser("create", help="创建新记录")
    p_create.add_argument("--store-id", required=True, help="门店ID")
    p_create.add_argument("--store-name", required=True, help="门店名称")
    p_create.add_argument("--processing-type", required=True,
                          choices=[t.name for t in ProcessingType], help="处理类型")
    p_create.add_argument("--operator", default="小祁", help="操作人")
    p_create.set_defaults(func="cmd_create")

    p_shot = subparsers.add_parser("import-screenshot", help="导入旧公式截图")
    p_shot.add_argument("--record-id", required=True, help="记录ID")
    p_shot.add_argument("--path", required=True, help="截图路径")
    p_shot.add_argument("--formula", required=True, help="公式文本")
    p_shot.add_argument("--desc", required=True, help="描述")
    p_shot.add_argument("--operator", default="小祁", help="操作人")
    p_shot.set_defaults(func="cmd_import_screenshot")

    p_ans = subparsers.add_parser("import-answers", help="导入学生答案")
    p_ans.add_argument("--record-id", required=True, help="记录ID")
    p_ans.add_argument("--answers", help="JSON格式的答案数据")
    p_ans.add_argument("--answers-json", help="包含答案数据的JSON文件")
    p_ans.add_argument("--operator", default="小祁", help="操作人")
    p_ans.set_defaults(func="cmd_import_answers")

    p_review = subparsers.add_parser("mark-review", help="标记待业务运营复核")
    p_review.add_argument("--record-id", required=True, help="记录ID")
    p_review.add_argument("--operator", default="小祁", help="操作人")
    p_review.set_defaults(func="cmd_mark_review")

    p_ann = subparsers.add_parser("add-annotation", help="添加老师批注")
    p_ann.add_argument("--record-id", required=True, help="记录ID")
    p_ann.add_argument("--teacher", required=True, help="老师姓名")
    p_ann.add_argument("--content", required=True, help="批注内容")
    p_ann.add_argument("--old-standard", help="旧口径参考")
    p_ann.add_argument("--error-update", help="误差说明更新")
    p_ann.add_argument("--operator", default="小祁", help="操作人")
    p_ann.set_defaults(func="cmd_add_annotation")

    p_rev_dup = subparsers.add_parser("review-duplicate", help="业务运营复核重复答案")
    p_rev_dup.add_argument("--record-id", required=True, help="记录ID")
    p_rev_dup.add_argument("--approved-answer-id", required=True, help="采纳的答案ID")
    p_rev_dup.add_argument("--reviewer", default="业务运营", help="复核人")
    p_rev_dup.set_defaults(func="cmd_review_duplicate")

    p_correct = subparsers.add_parser("manual-correct", help="人工修正")
    p_correct.add_argument("--record-id", required=True, help="记录ID")
    p_correct.add_argument("--note", required=True, help="修正说明")
    p_correct.add_argument("--operator", default="小祁", help="操作人")
    p_correct.set_defaults(func="cmd_manual_correct")

    p_group = subparsers.add_parser("run-grouping", help="运行分群算法")
    p_group.add_argument("--record-id", required=True, help="记录ID")
    p_group.add_argument("--operator", default="小祁", help="操作人")
    p_group.set_defaults(func="cmd_run_grouping")

    p_rerun = subparsers.add_parser("re-run", help="重跑分群")
    p_rerun.add_argument("--record-id", required=True, help="记录ID")
    p_rerun.add_argument("--operator", default="小祁", help="操作人")
    p_rerun.set_defaults(func="cmd_re_run")

    p_show = subparsers.add_parser("show", help="显示记录详情")
    p_show.add_argument("--record-id", help="记录ID（不填则显示所有）")
    p_show.set_defaults(func="cmd_show")

    p_summary = subparsers.add_parser("summary", help="显示汇总")
    p_summary.set_defaults(func="cmd_summary")

    p_exp = subparsers.add_parser("export-audit", help="导出单条复盘记录")
    p_exp.add_argument("--record-id", required=True, help="记录ID")
    p_exp.add_argument("--output-dir", default="audit_reports", help="输出目录")
    p_exp.set_defaults(func="cmd_export_audit")

    p_exp_all = subparsers.add_parser("export-all", help="导出所有复盘记录")
    p_exp_all.add_argument("--output-dir", default="audit_reports", help="输出目录")
    p_exp_all.set_defaults(func="cmd_export_all")

    p_list = subparsers.add_parser("list", help="列出所有记录")
    p_list.set_defaults(func="cmd_list")

    p_demo = subparsers.add_parser("demo-flow", help="展示完整演示流程")
    p_demo.set_defaults(func="cmd_demo_flow")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        print("\n💡 快速开始:")
        print("  python cli.py init-demo    # 初始化演示数据")
        print("  python cli.py summary      # 查看汇总")
        print("  python cli.py demo-flow    # 查看演示流程")
        return 0

    cli = StoreGroupingCLI(args.data_dir)
    func = getattr(cli, args.func)
    return func(args)


if __name__ == "__main__":
    sys.exit(main())
