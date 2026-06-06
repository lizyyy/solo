#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
演出票务赠票核销系统 - 三步流程CLI
流程: 1.票务导出表导入  2.补看音频文件备注  3.曲目核对表更新
"""
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src import (
    TicketImporter, AudioRemarkParser, ConflictDetector,
    ChecklistManager, SelfChecker, ReportGenerator,
    TicketStatus, LeaveStatus, ConflictType
)


class TicketVerificationCLI:
    def __init__(self):
        self.importer = TicketImporter()
        self.audio_parser = AudioRemarkParser()
        self.conflict_detector = ConflictDetector()
        self.checklist_mgr = ChecklistManager()
        self.self_checker = SelfChecker()
        self.report_gen = ReportGenerator()

        self.tickets = []
        self.audio_remarks = []
        self.conflicts = []
        self.checklist = None
        self.import_batches = []

    def print_header(self, title: str):
        print("\n" + "=" * 70)
        print(f"  {title}")
        print("=" * 70)

    def print_step(self, step: int, title: str):
        print(f"\n{'='*70}")
        print(f"  步骤 {step}: {title}")
        print(f"{'='*70}\n")

    def step1_import_tickets(self, ticket_file: str, batch_id: str = None):
        self.print_step(1, "票务导出表第一次导入")

        tickets, batch = self.importer.import_from_csv(ticket_file, batch_id)
        self.tickets.extend(tickets)
        self.import_batches.append(batch)

        print(f"✓ 成功导入文件: {batch.file_name}")
        print(f"  批次号: {batch.batch_id}")
        print(f"  记录数: {batch.record_count}")

        if batch.is_duplicate:
            print(f"  ⚠️  警告: 该文件与批次 {batch.duplicate_of} 重复!")

        duplicates = self.importer.find_duplicate_records(self.tickets)
        if duplicates:
            print(f"\n⚠️  检测到 {len(duplicates)} 组重复记录:")
            for t1, t2 in duplicates[:3]:
                print(f"  - 票号 {t1.ticket_id} ({t1.student_name}) 在批次 {t1.import_batch} 和 {t2.import_batch} 重复")

        print(f"\n导入完成，当前总票数: {len(self.tickets)}")
        return tickets, batch

    def step2_review_audio_remarks(self, audio_file: str):
        self.print_step(2, "琴行店长老周补看音频文件备注")

        self.audio_remarks = self.audio_parser.parse_file(audio_file)
        print(f"✓ 成功解析音频备注文件: {Path(audio_file).name}")
        print(f"  备注记录数: {len(self.audio_remarks)}")

        print(f"\n📝 音频原始备注预览 (保留完整原始信息，不做清洗):")
        for i, remark in enumerate(self.audio_remarks[:3], 1):
            print(f"\n  备注 #{i}:")
            print(f"    票号: {remark.ticket_id}")
            print(f"    学员: {remark.student_name}")
            print(f"    音频文件: {remark.audio_file}")
            print(f"    原始备注: {remark.raw_remark}")
        if len(self.audio_remarks) > 3:
            print(f"\n  ... 还有 {len(self.audio_remarks) - 3} 条备注")

        remarks_by_ticket = self.audio_parser.get_raw_remarks_by_ticket(self.audio_remarks)
        matched = 0
        for ticket in self.tickets:
            remarks = remarks_by_ticket.get(ticket.ticket_id, [])
            if remarks:
                matched += 1
                all_raw = "\n".join([r.raw_remark for r in remarks])
                ticket.audio_remarks = all_raw
                ticket.add_history("音频备注补充", "老周", f"补充 {len(remarks)} 条音频备注")

        print(f"\n✓ 已为 {matched} 张票补充音频备注信息")

        self.conflicts = self.conflict_detector.detect_all_conflicts(self.tickets, self.audio_remarks)

        if self.conflicts:
            print(f"\n⚠️  检测到 {len(self.conflicts)} 个冲突，请店长老周审核:")
            for i, conflict in enumerate(self.conflicts[:5], 1):
                print(f"\n  冲突 #{i}: {conflict.description}")
                print(f"    类型: {conflict.conflict_type.value}")
                print(f"    票务表值: {conflict.ticket_value}")
                print(f"    音频值: {conflict.audio_value}")
                if conflict.evidence and 'audio_raw_remark' in conflict.evidence:
                    print(f"    原始备注证据: {conflict.evidence['audio_raw_remark']}")

            leave_conflicts = [c for c in self.conflicts if c.conflict_type == ConflictType.LEAVE_COUNTED]
            if leave_conflicts:
                print(f"\n🚨 特别注意: {len(leave_conflicts)} 条请假课时被算进已消耗")
                print(f"   已标记为【待巡演统筹复核】，不会自动归为正常")
                for c in leave_conflicts:
                    ticket = next((t for t in self.tickets if t.ticket_id == c.ticket_id), None)
                    if ticket:
                        ticket.verification_status = TicketStatus.NEED_REVIEW

            print(f"\n💡 请店长老周对每个冲突选择【确认】或【驳回】")
            print("   系统不会替业务同事自动拍板")
        else:
            print("\n✓ 未检测到冲突")

        return self.audio_remarks, self.conflicts

    def step3_update_checklist(self, operator: str = "老周"):
        self.print_step(3, "曲目核对表更新")

        if not self.tickets:
            print("❌ 请先导入票务数据")
            return None

        self.checklist = self.checklist_mgr.create_checklist_from_tickets(self.tickets)
        print(f"✓ 创建曲目核对表")
        print(f"  核对表ID: {self.checklist.checklist_id}")
        print(f"  演出日期: {self.checklist.performance_date}")
        print(f"  曲目项数: {len(self.checklist.items)}")

        if self.audio_remarks:
            self.checklist = self.checklist_mgr.update_checklist_from_audio_remarks(
                self.checklist, self.audio_remarks, operator
            )
            print(f"\n✓ 已将音频备注更新到核对表")

        for ticket in self.tickets:
            if ticket.verification_status == TicketStatus.PENDING and not ticket.conflicts:
                self.checklist_mgr.mark_item_checked(self.checklist, ticket.ticket_id, operator)
                ticket.verification_status = TicketStatus.CONFIRMED
                ticket.add_history("核对通过", operator)

        summary = self.checklist_mgr.get_checklist_summary(self.checklist)
        print(f"\n📊 核对表状态:")
        print(f"  总项数: {summary['total_items']}")
        print(f"  已核对: {summary['checked_count']} ({summary['checked_percentage']:.1f}%)")
        print(f"  含备注: {summary['with_remarks_count']}")

        return self.checklist

    def run_self_check(self, exported_file: str = None):
        self.print_header("系统自检")

        check_results = self.self_checker.run_all_checks(
            self.tickets, self.import_batches,
            [self.checklist] if self.checklist else None
        )

        if exported_file and Path(exported_file).exists():
            export_check = self.self_checker.check_export_consistency(
                self.tickets, exported_file
            )
            check_results.append(export_check)

        passed = sum(1 for r in check_results if r.passed)
        total = len(check_results)
        print(f"\n自检结果: {passed}/{total} 通过")

        for result in check_results:
            status = "✓" if result.passed else "✗"
            print(f"\n  {status} {result.check_name}: {result.details}")
            if result.issues:
                for issue in result.issues[:3]:
                    print(f"    - {issue}")

        return check_results

    def generate_final_report(self, output_dir: str = "reports"):
        self.print_header("生成核销报告")

        os.makedirs(output_dir, exist_ok=True)
        timestamp = self.import_batches[0].import_time.strftime("%Y%m%d_%H%M%S") if self.import_batches else "latest"

        check_results = self.self_checker.run_all_checks(
            self.tickets, self.import_batches,
            [self.checklist] if self.checklist else None
        )

        report = self.report_gen.generate_report(
            self.tickets, self.conflicts,
            [self.checklist] if self.checklist else [],
            check_results
        )

        text_report_path = os.path.join(output_dir, f"verification_report_{timestamp}.txt")
        json_report_path = os.path.join(output_dir, f"verification_report_{timestamp}.json")

        self.report_gen.export_report_text(report, text_report_path)
        self.report_gen.export_report_json(report, json_report_path)

        print(f"\n✓ 报告已生成:")
        print(f"  文本报告: {text_report_path}")
        print(f"  JSON报告: {json_report_path}")

        print(f"\n📊 报告摘要:")
        print(f"  总票数: {report.total_tickets}")
        print(f"  已确认: {report.confirmed_count}")
        print(f"  已驳回: {report.rejected_count}")
        print(f"  存在冲突: {report.conflict_count}")
        print(f"  待巡演统筹复核: {report.need_review_count}")
        print(f"  请假课时被算进已消耗: {report.leave_counted_count}")

        return report, text_report_path, json_report_path

    def run_full_flow(
        self,
        ticket_file: str,
        audio_file: str,
        output_dir: str = "reports",
        batch_id: str = None,
        operator: str = "老周"
    ):
        self.print_header("演出票务赠票核销 - 完整流程")
        print(f"\n操作人员: {operator}")
        print(f"票务文件: {ticket_file}")
        print(f"音频备注文件: {audio_file}")

        self.step1_import_tickets(ticket_file, batch_id)
        self.step2_review_audio_remarks(audio_file)
        self.step3_update_checklist(operator)
        self.run_self_check()
        report, text_path, json_path = self.generate_final_report(output_dir)

        self.print_header("流程完成")
        print(f"\n✓ 三步流程执行完毕")
        print(f"✓ 文本报告: {text_path}")
        print(f"✓ JSON报告: {json_path}")

        return report


def main():
    import argparse

    parser = argparse.ArgumentParser(description="演出票务赠票核销系统")
    subparsers = parser.add_subparsers(dest="command", help="命令")

    full_parser = subparsers.add_parser("run", help="执行完整三步流程")
    full_parser.add_argument("--tickets", required=True, help="票务导出表CSV路径")
    full_parser.add_argument("--audio", required=True, help="音频备注文件路径")
    full_parser.add_argument("--output", default="reports", help="报告输出目录")
    full_parser.add_argument("--operator", default="老周", help="操作人员")
    full_parser.add_argument("--batch-id", help="批次号")

    args = parser.parse_args()

    if args.command == "run":
        cli = TicketVerificationCLI()
        cli.run_full_flow(
            ticket_file=args.tickets,
            audio_file=args.audio,
            output_dir=args.output,
            operator=args.operator,
            batch_id=args.batch_id
        )
    else:
        parser.print_help()
        print("\n示例:")
        print("  python cli.py run --tickets data/samples/normal_tickets.csv --audio data/samples/normal_audio_remarks.csv")


if __name__ == "__main__":
    main()
