#!/usr/bin/env python3
import sys
from pathlib import Path

from models import DataStore, JudgmentStatus, IssueType
from importer_exporter import KnowledgeBaseImporter, KnowledgeBaseExporter
from judgment_manager import JudgmentManager
from issue_detector import IssueDetector
from weekly_report_generator import WeeklyReportGenerator


class GrayMonitorCLI:
    def __init__(self):
        self.data_store = DataStore()
        self.importer = KnowledgeBaseImporter(self.data_store)
        self.exporter = KnowledgeBaseExporter(self.data_store)
        self.judgment_manager = JudgmentManager(self.data_store)
        self.issue_detector = IssueDetector(self.data_store)
        self.report_generator = WeeklyReportGenerator(self.data_store)
        self.current_operator = "analyst"
    
    def print_header(self):
        print("\n" + "=" * 60)
        print("          AI助手灰度监控系统")
        print("=" * 60)
    
    def print_menu(self):
        print("\n请选择操作:")
        print("  1. 知识库导入")
        print("  2. 查看/筛选记录")
        print("  3. 人工改判")
        print("  4. 问题检测")
        print("  5. 数据导出")
        print("  6. 质检周报")
        print("  7. 查看统计")
        print("  8. 设置操作人")
        print("  0. 退出")
    
    def set_operator(self):
        operator = input("请输入您的姓名/工号: ").strip()
        if operator:
            self.current_operator = operator
            print(f"操作人已设置为: {operator}")
    
    def import_knowledge_base(self):
        file_path = input("请输入CSV文件路径: ").strip()
        if not file_path:
            print("路径不能为空")
            return
        
        path = Path(file_path)
        if not path.exists():
            print(f"文件不存在: {file_path}")
            return
        
        try:
            batch = self.importer.import_from_csv(
                file_path=str(path),
                operator=self.current_operator,
                auto_ai_judgment=True,
            )
            print(f"\n导入成功!")
            print(f"  批次ID: {batch.batch_id}")
            print(f"  导入记录数: {batch.record_count}")
            print(f"  导入时间: {batch.import_time.strftime('%Y-%m-%d %H:%M:%S')}")
            
            detect_now = input("是否立即进行问题检测? (y/n): ").strip().lower()
            if detect_now == "y":
                result = self.issue_detector.batch_detect_issues(
                    qa_ids=batch.qa_ids,
                    operator=self.current_operator,
                )
                print(f"问题检测完成:")
                print(f"  扫描记录数: {result['total_scanned']}")
                print(f"  发现新问题记录: {result['records_with_new_issues']}")
                if result['issue_distribution']:
                    print("  问题分布:")
                    for issue, count in result['issue_distribution'].items():
                        print(f"    - {issue}: {count}")
        except Exception as e:
            print(f"导入失败: {e}")
    
    def view_records(self):
        print("\n筛选条件 (直接回车表示不限制):")
        print("  状态筛选: 1=待确认, 2=AI通过, 3=AI不通过, 4=人工通过, 5=人工不通过, 6=存疑")
        status_input = input("请输入状态编号 (多个用逗号分隔): ").strip()
        
        has_issues_input = input("只看有问题的记录? (y/n): ").strip().lower()
        has_issues = None
        if has_issues_input == "y":
            has_issues = True
        elif has_issues_input == "n":
            has_issues = False
        
        batches = self.data_store.load_all_import_batches()
        if batches:
            print("\n最近导入批次:")
            for i, batch in enumerate(batches[:5]):
                print(f"  {i+1}. {batch.batch_id[:8]}... ({batch.record_count}条, {batch.import_time.strftime('%m-%d %H:%M')})")
        
        batch_index = input("选择批次编号 (直接回车表示全部): ").strip()
        batch_id = None
        if batch_index and batch_index.isdigit():
            idx = int(batch_index) - 1
            if 0 <= idx < len(batches):
                batch_id = batches[idx].batch_id
        
        status_filter = []
        if status_input:
            status_map = {
                "1": JudgmentStatus.PENDING,
                "2": JudgmentStatus.AI_PASS,
                "3": JudgmentStatus.AI_FAIL,
                "4": JudgmentStatus.MANUAL_PASS,
                "5": JudgmentStatus.MANUAL_FAIL,
                "6": JudgmentStatus.QUESTIONABLE,
            }
            for s in status_input.split(","):
                s = s.strip()
                if s in status_map:
                    status_filter.append(status_map[s])
        
        records = self.judgment_manager.get_records_for_judgment(
            status_filter=status_filter if status_filter else None,
            batch_id=batch_id,
            has_issues=has_issues,
            limit=50,
        )
        
        if not records:
            print("没有找到符合条件的记录")
            return
        
        print(f"\n找到 {len(records)} 条记录 (显示前50条):")
        for i, record in enumerate(records, 1):
            status = record.get_final_status().value
            issue_mark = " ⚠️" if record.issues else ""
            print(f"\n{i}. [{status}]{issue_mark}")
            print(f"   问题: {record.question[:50]}..." if len(record.question) > 50 else f"   问题: {record.question}")
            print(f"   QA_ID: {record.qa_id}")
            if record.ai_reason:
                print(f"   AI判断: {record.ai_judgment.value if record.ai_judgment else ''} - {record.ai_reason[:60]}...")
            if record.issues:
                issues_str = ", ".join([i.value for i in record.issues])
                print(f"   问题: {issues_str}")
        
        view_detail = input("\n查看记录详情? 输入序号或QA_ID (直接回车返回): ").strip()
        if view_detail:
            self.view_record_detail(view_detail, records)
    
    def view_record_detail(self, record_id: str, records_list):
        record = None
        
        if record_id.isdigit():
            idx = int(record_id) - 1
            if 0 <= idx < len(records_list):
                record = records_list[idx]
        else:
            record = self.data_store.load_qa_record(record_id)
        
        if not record:
            print("未找到记录")
            return
        
        print("\n" + "-" * 60)
        print("记录详情")
        print("-" * 60)
        print(f"QA_ID: {record.qa_id}")
        print(f"版本: {record.version}")
        print(f"状态: {record.get_final_status().value}")
        print(f"\n问题:\n{record.question}")
        print(f"\n答案:\n{record.answer}")
        print(f"\n来源: {record.source or '-'}")
        print(f"来源链接: {record.source_link or '-'}")
        
        print(f"\n--- AI判断 ---")
        if record.ai_judgment:
            print(f"结果: {record.ai_judgment.value}")
            print(f"置信度: {record.ai_confidence:.2f}")
            print(f"理由: {record.ai_reason}")
        else:
            print("未进行AI判断")
        
        print(f"\n--- 人工判断 ---")
        if record.manual_judgment:
            print(f"结果: {record.manual_judgment.value}")
            print(f"操作人: {record.manual_operator}")
            print(f"时间: {record.manual_time.strftime('%Y-%m-%d %H:%M:%S') if record.manual_time else '-'}")
            print(f"理由: {record.manual_reason}")
        else:
            print("未进行人工判断")
        
        print(f"\n--- 问题标记 ---")
        if record.issues:
            for issue in record.issues:
                detail = record.issue_details.get(issue.value, "")
                print(f"- {issue.value}: {detail}")
        else:
            print("无问题标记")
        
        print(f"\n备注: {record.notes or '-'}")
        print("-" * 60)
    
    def manual_judge(self):
        qa_id = input("请输入要改判的QA_ID: ").strip()
        if not qa_id:
            return
        
        record = self.data_store.load_qa_record(qa_id)
        if not record:
            print(f"未找到记录: {qa_id}")
            return
        
        self.view_record_detail(qa_id, [record])
        
        print("\n改判选项:")
        print("  1. 人工通过")
        print("  2. 人工不通过")
        print("  3. 人工修正")
        print("  4. 撤回之前的人工判断")
        print("  5. 添加备注")
        print("  0. 取消")
        
        choice = input("请选择: ").strip()
        
        if choice == "0":
            return
        
        if choice == "4":
            reason = input("请输入撤回理由: ").strip()
            if reason:
                success, msg = self.judgment_manager.withdraw_judgment(
                    qa_id=qa_id,
                    reason=reason,
                    operator=self.current_operator,
                )
                print(msg)
            return
        
        if choice == "5":
            note = input("请输入备注内容: ").strip()
            if note:
                success, msg = self.judgment_manager.add_note(
                    qa_id=qa_id,
                    note=note,
                    operator=self.current_operator,
                )
                print(msg)
            return
        
        judgment_map = {
            "1": JudgmentStatus.MANUAL_PASS,
            "2": JudgmentStatus.MANUAL_FAIL,
            "3": JudgmentStatus.MANUAL_REVISED,
        }
        
        if choice not in judgment_map:
            print("无效选项")
            return
        
        reason = input("请输入判断理由: ").strip()
        if not reason:
            print("理由不能为空")
            return
        
        if choice == "3":
            new_answer = input("请输入修正后的答案: ").strip()
            if not new_answer:
                print("答案不能为空")
                return
            new_source = input("请输入新来源 (可选): ").strip()
            new_source_link = input("请输入新来源链接 (可选): ").strip()
            
            success, msg = self.judgment_manager.revise_answer(
                qa_id=qa_id,
                new_answer=new_answer,
                reason=reason,
                operator=self.current_operator,
                new_source=new_source,
                new_source_link=new_source_link,
            )
        else:
            success, msg = self.judgment_manager.manual_judge(
                qa_id=qa_id,
                judgment=judgment_map[choice],
                reason=reason,
                operator=self.current_operator,
            )
        
        print(msg)
    
    def detect_issues(self):
        print("\n问题检测选项:")
        print("  1. 检测全部记录")
        print("  2. 检测指定批次")
        print("  3. 查看问题统计")
        print("  4. 清除问题标记")
        print("  0. 返回")
        
        choice = input("请选择: ").strip()
        
        if choice == "0":
            return
        
        if choice == "1":
            check_links = input("是否检查链接可访问性? (较慢) (y/n): ").strip().lower() == "y"
            print("正在检测...")
            result = self.issue_detector.batch_detect_issues(
                operator=self.current_operator,
                check_link_access=check_links,
            )
            print(f"\n检测完成:")
            print(f"  扫描记录数: {result['total_scanned']}")
            print(f"  发现新问题记录: {result['records_with_new_issues']}")
            if result['issue_distribution']:
                print("  问题分布:")
                for issue, count in result['issue_distribution'].items():
                    print(f"    - {issue}: {count}")
        
        elif choice == "2":
            batches = self.data_store.load_all_import_batches()
            if not batches:
                print("没有导入批次")
                return
            print("\n导入批次:")
            for i, batch in enumerate(batches):
                print(f"  {i+1}. {batch.batch_id[:8]}... ({batch.record_count}条)")
            
            batch_idx = input("选择批次编号: ").strip()
            if batch_idx.isdigit():
                idx = int(batch_idx) - 1
                if 0 <= idx < len(batches):
                    print("正在检测...")
                    result = self.issue_detector.batch_detect_issues(
                        qa_ids=batches[idx].qa_ids,
                        operator=self.current_operator,
                    )
                    print(f"检测完成，发现 {result['records_with_new_issues']} 条有问题的记录")
        
        elif choice == "3":
            summary = self.issue_detector.get_issue_summary()
            print(f"\n问题统计:")
            print(f"  总记录数: {summary['total_records']}")
            print(f"  有问题记录: {summary['records_with_issues']} ({summary['issue_rate']:.1%})")
            if summary['issue_breakdown']:
                print("  问题类型分布:")
                for issue, count in summary['issue_breakdown'].items():
                    print(f"    - {issue}: {count}")
        
        elif choice == "4":
            qa_id = input("请输入QA_ID: ").strip()
            if not qa_id:
                return
            
            record = self.data_store.load_qa_record(qa_id)
            if not record or not record.issues:
                print("该记录没有问题标记")
                return
            
            print("\n当前问题标记:")
            for i, issue in enumerate(record.issues, 1):
                print(f"  {i}. {issue.value}")
            
            issue_idx = input("选择要清除的问题编号: ").strip()
            if issue_idx.isdigit():
                idx = int(issue_idx) - 1
                if 0 <= idx < len(record.issues):
                    reason = input("请输入清除理由: ").strip()
                    if reason:
                        success, msg = self.issue_detector.clear_issue(
                            qa_id=qa_id,
                            issue_type=record.issues[idx],
                            reason=reason,
                            operator=self.current_operator,
                        )
                        print(msg)
    
    def export_data(self):
        print("\n导出选项:")
        print("  1. 导出全部记录")
        print("  2. 导出现疑记录")
        print("  3. 导出待确认记录")
        print("  4. 按筛选条件导出")
        print("  0. 返回")
        
        choice = input("请选择: ").strip()
        
        if choice == "0":
            return
        
        output_path = input("请输入输出文件路径 (默认: ./export.csv): ").strip()
        if not output_path:
            output_path = "./export.csv"
        
        count = 0
        
        if choice == "1":
            count = self.exporter.export_to_csv(
                output_path=output_path,
                operator=self.current_operator,
            )
        
        elif choice == "2":
            count = self.exporter.export_questionable_to_csv(
                output_path=output_path,
                operator=self.current_operator,
            )
        
        elif choice == "3":
            count = self.exporter.export_pending_to_csv(
                output_path=output_path,
                operator=self.current_operator,
            )
        
        elif choice == "4":
            print("请输入筛选条件 (直接回车表示不限制):")
            print("状态: 1=待确认, 2=AI通过, 3=AI不通过, 4=人工通过, 5=人工不通过, 6=存疑")
            status_input = input("状态编号 (多个用逗号分隔): ").strip()
            
            status_filter = []
            status_map = {
                "1": JudgmentStatus.PENDING,
                "2": JudgmentStatus.AI_PASS,
                "3": JudgmentStatus.AI_FAIL,
                "4": JudgmentStatus.MANUAL_PASS,
                "5": JudgmentStatus.MANUAL_FAIL,
                "6": JudgmentStatus.QUESTIONABLE,
            }
            if status_input:
                for s in status_input.split(","):
                    s = s.strip()
                    if s in status_map:
                        status_filter.append(status_map[s])
            
            count = self.exporter.export_to_csv(
                output_path=output_path,
                status_filter=status_filter if status_filter else None,
                operator=self.current_operator,
            )
        
        print(f"导出完成，共导出 {count} 条记录")
        print(f"文件路径: {output_path}")
    
    def generate_weekly_report(self):
        print("\n周报选项:")
        print("  1. 生成本周周报")
        print("  2. 生成指定周期周报")
        print("  3. 查看历史周报")
        print("  4. 导出周报")
        print("  0. 返回")
        
        choice = input("请选择: ").strip()
        
        if choice == "0":
            return
        
        if choice == "1":
            report = self.report_generator.generate_report(
                operator=self.current_operator,
            )
            self._print_report_summary(report)
        
        elif choice == "2":
            week_start = input("请输入周开始日期 (YYYY-MM-DD): ").strip()
            week_end = input("请输入周结束日期 (YYYY-MM-DD): ").strip()
            if week_start and week_end:
                report = self.report_generator.generate_report(
                    operator=self.current_operator,
                    week_start=week_start,
                    week_end=week_end,
                )
                self._print_report_summary(report)
        
        elif choice == "3":
            reports = self.report_generator.list_reports()
            if not reports:
                print("没有历史周报")
                return
            print("\n历史周报:")
            for i, report in enumerate(reports, 1):
                print(f"  {i}. {report.week_start} 至 {report.week_end} ({report.total_records}条)")
            
            report_idx = input("选择周报编号查看详情: ").strip()
            if report_idx.isdigit():
                idx = int(report_idx) - 1
                if 0 <= idx < len(reports):
                    self._print_report_summary(reports[idx])
        
        elif choice == "4":
            reports = self.report_generator.list_reports()
            if not reports:
                print("没有可导出的周报")
                return
            print("\n可导出的周报:")
            for i, report in enumerate(reports, 1):
                print(f"  {i}. {report.week_start} 至 {report.week_end}")
            
            report_idx = input("选择周报编号: ").strip()
            if report_idx.isdigit():
                idx = int(report_idx) - 1
                if 0 <= idx < len(reports):
                    output_dir = input("请输入输出目录 (默认: ./reports): ").strip()
                    if not output_dir:
                        output_dir = "./reports"
                    path = self.report_generator.export_report_to_csv(
                        report=reports[idx],
                        output_dir=output_dir,
                        operator=self.current_operator,
                    )
                    print(f"周报已导出到: {path}")
    
    def _print_report_summary(self, report):
        print("\n" + "=" * 60)
        print(f"质检周报: {report.week_start} 至 {report.week_end}")
        print("=" * 60)
        print(f"\n基本统计:")
        print(f"  总记录数: {report.total_records}")
        print(f"  AI通过: {report.ai_pass_count}")
        print(f"  AI不通过: {report.ai_fail_count}")
        print(f"  人工通过: {report.manual_pass_count}")
        print(f"  人工不通过: {report.manual_fail_count}")
        print(f"  待确认: {report.pending_count}")
        print(f"  存疑: {report.questionable_count}")
        print(f"\n质量指标:")
        print(f"  AI准确率: {report.accuracy_rate:.1%}")
        print(f"  人工覆盖率: {report.coverage_rate:.1%}")
        
        if report.issue_breakdown:
            print(f"\n问题分布:")
            for issue, count in report.issue_breakdown.items():
                print(f"  - {issue}: {count}")
        
        print(f"\n本周要点:")
        for line in report.highlights.split("\n"):
            print(f"  {line}")
        
        print(f"\n下一步行动:")
        for line in report.next_steps.split("\n"):
            print(f"  {line}")
    
    def show_statistics(self):
        stats = self.judgment_manager.get_judgment_statistics()
        
        print("\n" + "=" * 60)
        print("系统统计")
        print("=" * 60)
        print(f"\n总记录数: {stats['total_records']}")
        print(f"已人工判断: {stats['manual_judged_count']} ({stats['manual_coverage']:.1%})")
        print(f"AI准确率: {stats['ai_accuracy']:.1%}")
        
        print(f"\n状态分布:")
        for status, count in stats['status_breakdown'].items():
            print(f"  {status}: {count}")
        
        print(f"\nAI与人工对比:")
        print(f"  AI通过-人工通过: {stats['ai_vs_manual']['ai_pass_manual_pass']}")
        print(f"  AI通过-人工不通过: {stats['ai_vs_manual']['ai_pass_manual_fail']}")
        print(f"  AI不通过-人工通过: {stats['ai_vs_manual']['ai_fail_manual_pass']}")
        print(f"  AI不通过-人工不通过: {stats['ai_vs_manual']['ai_fail_manual_fail']}")
    
    def run(self):
        self.print_header()
        print(f"\n当前操作人: {self.current_operator}")
        print("提示: 首次使用请先设置操作人 (选项8)")
        
        while True:
            self.print_menu()
            choice = input("\n请输入选项: ").strip()
            
            if choice == "0":
                print("再见!")
                sys.exit(0)
            
            elif choice == "1":
                self.import_knowledge_base()
            
            elif choice == "2":
                self.view_records()
            
            elif choice == "3":
                self.manual_judge()
            
            elif choice == "4":
                self.detect_issues()
            
            elif choice == "5":
                self.export_data()
            
            elif choice == "6":
                self.generate_weekly_report()
            
            elif choice == "7":
                self.show_statistics()
            
            elif choice == "8":
                self.set_operator()
            
            else:
                print("无效选项，请重新输入")


def main():
    cli = GrayMonitorCLI()
    cli.run()


if __name__ == "__main__":
    main()
