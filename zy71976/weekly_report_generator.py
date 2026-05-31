import csv
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Tuple

from models import DataStore, QARecord, WeeklyReport, OperationLog, JudgmentStatus, IssueType


class WeeklyReportGenerator:
    def __init__(self, data_store: DataStore):
        self.data_store = data_store
    
    def _get_week_range(
        self,
        date: Optional[datetime] = None,
    ) -> Tuple[str, str]:
        if date is None:
            date = datetime.now()
        
        weekday = date.weekday()
        week_start = date - timedelta(days=weekday)
        week_end = week_start + timedelta(days=6)
        
        return (
            week_start.strftime("%Y-%m-%d"),
            week_end.strftime("%Y-%m-%d"),
        )
    
    def _filter_records_by_date(
        self,
        records: List[QARecord],
        start_date: str,
        end_date: str,
    ) -> List[QARecord]:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        
        filtered = []
        for record in records:
            if record.import_time:
                if start_dt <= record.import_time < end_dt:
                    filtered.append(record)
            elif record.manual_time:
                if start_dt <= record.manual_time < end_dt:
                    filtered.append(record)
        
        return filtered
    
    def generate_report(
        self,
        operator: str,
        week_start: Optional[str] = None,
        week_end: Optional[str] = None,
        auto_next_steps: bool = True,
    ) -> WeeklyReport:
        if week_start is None or week_end is None:
            week_start, week_end = self._get_week_range()
        
        all_records = self.data_store.load_all_qa_records()
        all_records = [r for r in all_records if r.is_latest]
        
        week_records = self._filter_records_by_date(all_records, week_start, week_end)
        
        report = WeeklyReport(week_start=week_start, week_end=week_end)
        report.generator = operator
        report.total_records = len(week_records)
        report.qa_ids = [r.qa_id for r in week_records]
        
        for record in week_records:
            final_status = record.get_final_status()
            
            if final_status == JudgmentStatus.AI_PASS:
                report.ai_pass_count += 1
            elif final_status == JudgmentStatus.AI_FAIL:
                report.ai_fail_count += 1
            elif final_status == JudgmentStatus.MANUAL_PASS:
                report.manual_pass_count += 1
            elif final_status == JudgmentStatus.MANUAL_FAIL:
                report.manual_fail_count += 1
            elif final_status == JudgmentStatus.MANUAL_REVISED:
                report.manual_pass_count += 1
            elif final_status == JudgmentStatus.PENDING:
                report.pending_count += 1
            elif final_status == JudgmentStatus.QUESTIONABLE:
                report.questionable_count += 1
            
            for issue in record.issues:
                issue_str = issue.value
                report.issue_breakdown[issue_str] = report.issue_breakdown.get(issue_str, 0) + 1
        
        manual_judged = report.manual_pass_count + report.manual_fail_count
        ai_total = report.ai_pass_count + report.ai_fail_count
        
        if manual_judged > 0:
            ai_vs_manual_correct = 0
            for record in week_records:
                if record.ai_judgment and record.manual_judgment:
                    ai_pass = record.ai_judgment == JudgmentStatus.AI_PASS
                    manual_pass = record.manual_judgment in [
                        JudgmentStatus.MANUAL_PASS,
                        JudgmentStatus.MANUAL_REVISED,
                    ]
                    if ai_pass == manual_pass:
                        ai_vs_manual_correct += 1
            
            report.accuracy_rate = ai_vs_manual_correct / manual_judged if manual_judged > 0 else 0.0
        
        report.coverage_rate = manual_judged / report.total_records if report.total_records > 0 else 0.0
        
        report.highlights = self._generate_highlights(report, week_records)
        
        if auto_next_steps:
            report.next_steps = self._generate_next_steps(report, week_records)
        
        self.data_store.save_weekly_report(report)
        
        log = OperationLog(
            operation_type="生成周报",
            operator=operator,
            details=f"周报周期: {week_start} 至 {week_end}, 记录数: {report.total_records}",
        )
        self.data_store.save_operation_log(log)
        
        return report
    
    def _generate_highlights(
        self,
        report: WeeklyReport,
        records: List[QARecord],
    ) -> str:
        highlights = []
        
        highlights.append(f"本周共处理 {report.total_records} 条记录")
        
        if report.accuracy_rate >= 0.8:
            highlights.append(f"AI判断准确率较高: {report.accuracy_rate:.1%}")
        elif report.accuracy_rate >= 0.6:
            highlights.append(f"AI判断准确率中等: {report.accuracy_rate:.1%}，需关注误判案例")
        else:
            highlights.append(f"AI判断准确率偏低: {report.accuracy_rate:.1%}，建议调整AI策略")
        
        if report.coverage_rate >= 0.9:
            highlights.append(f"人工复核覆盖率较高: {report.coverage_rate:.1%}")
        else:
            highlights.append(f"人工复核覆盖率: {report.coverage_rate:.1%}，建议加强抽检")
        
        if report.questionable_count > 0:
            highlights.append(f"存在 {report.questionable_count} 条存疑记录，需优先处理")
        
        if report.issue_breakdown:
            top_issues = sorted(
                report.issue_breakdown.items(),
                key=lambda x: x[1],
                reverse=True,
            )[:3]
            issue_str = ", ".join([f"{k}({v})" for k, v in top_issues])
            highlights.append(f"主要问题类型: {issue_str}")
        
        return "\n".join(highlights)
    
    def _generate_next_steps(
        self,
        report: WeeklyReport,
        records: List[QARecord],
    ) -> str:
        next_steps = []
        
        if report.questionable_count > 0:
            next_steps.append(f"1. 优先处理 {report.questionable_count} 条存疑记录，确认问题后标记清除或修正")
        
        if report.pending_count > 0:
            next_steps.append(f"2. 完成 {report.pending_count} 条待确认记录的人工复核")
        
        if IssueType.SENSITIVE_WORD.value in report.issue_breakdown:
            count = report.issue_breakdown[IssueType.SENSITIVE_WORD.value]
            next_steps.append(f"3. 敏感词漏脱敏问题 ({count}条): 检查脱敏规则，补全敏感词库")
        
        if IssueType.BROKEN_LINK.value in report.issue_breakdown:
            count = report.issue_breakdown[IssueType.BROKEN_LINK.value]
            next_steps.append(f"4. 来源断链问题 ({count}条): 核实来源链接有效性，更新或移除无效链接")
        
        if IssueType.REPORT_INCONSISTENT.value in report.issue_breakdown:
            count = report.issue_breakdown[IssueType.REPORT_INCONSISTENT.value]
            next_steps.append(f"5. 结论不一致问题 ({count}条): 核对AI与人工判断差异，优化AI判断逻辑")
        
        if report.accuracy_rate < 0.7:
            next_steps.append("6. 分析AI误判案例，调整判断规则或置信度阈值")
        
        if report.coverage_rate < 0.8:
            next_steps.append("7. 扩大人工抽检比例，确保数据质量")
        
        if not next_steps:
            next_steps.append("1. 持续监控数据质量，保持当前运营节奏")
            next_steps.append("2. 关注新增记录的AI判断准确性")
        
        return "\n".join(next_steps)
    
    def export_report_to_csv(
        self,
        report: WeeklyReport,
        output_dir: str,
        operator: str = "system",
    ) -> str:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        summary_file = output_path / f"周报_{report.week_start}_{report.week_end}_汇总.csv"
        details_file = output_path / f"周报_{report.week_start}_{report.week_end}_明细.csv"
        
        with open(summary_file, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["指标", "数值", "说明"])
            writer.writerow(["统计周期", f"{report.week_start} 至 {report.week_end}", ""])
            writer.writerow(["生成时间", report.generated_time.strftime("%Y-%m-%d %H:%M:%S"), ""])
            writer.writerow(["生成人", report.generator, ""])
            writer.writerow(["总记录数", report.total_records, ""])
            writer.writerow(["AI通过", report.ai_pass_count, ""])
            writer.writerow(["AI不通过", report.ai_fail_count, ""])
            writer.writerow(["人工通过", report.manual_pass_count, ""])
            writer.writerow(["人工不通过", report.manual_fail_count, ""])
            writer.writerow(["待确认", report.pending_count, ""])
            writer.writerow(["存疑", report.questionable_count, ""])
            writer.writerow(["AI准确率", f"{report.accuracy_rate:.1%}", "AI与人工判断一致比例"])
            writer.writerow(["人工覆盖率", f"{report.coverage_rate:.1%}", "已人工判断记录占比"])
            writer.writerow(["", "", ""])
            writer.writerow(["本周要点", "", ""])
            for line in report.highlights.split("\n"):
                writer.writerow(["", line, ""])
            writer.writerow(["", "", ""])
            writer.writerow(["下一步行动", "", ""])
            for line in report.next_steps.split("\n"):
                writer.writerow(["", line, ""])
        
        records = [
            self.data_store.load_qa_record(qa_id)
            for qa_id in report.qa_ids
        ]
        records = [r for r in records if r is not None]
        
        with open(details_file, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "问题",
                "最终状态",
                "AI判断",
                "AI判断理由",
                "人工判断",
                "人工判断理由",
                "问题类型",
                "问题详情",
                "标签",
                "备注",
                "QA_ID",
            ])
            
            for record in records:
                issues_str = ";".join([i.value for i in record.issues]) if record.issues else ""
                issue_details_str = str(record.issue_details) if record.issue_details else ""
                tags_str = ",".join(record.tags) if record.tags else ""
                
                writer.writerow([
                    record.question,
                    record.get_final_status().value,
                    record.ai_judgment.value if record.ai_judgment else "",
                    record.ai_reason,
                    record.manual_judgment.value if record.manual_judgment else "",
                    record.manual_reason,
                    issues_str,
                    issue_details_str,
                    tags_str,
                    record.notes,
                    record.qa_id,
                ])
        
        log = OperationLog(
            operation_type="导出周报",
            operator=operator,
            details=f"导出周报: {report.week_start} 至 {report.week_end}",
        )
        self.data_store.save_operation_log(log)
        
        return str(output_path)
    
    def list_reports(self) -> List[WeeklyReport]:
        return self.data_store.load_all_weekly_reports()
    
    def get_report(self, report_id: str) -> Optional[WeeklyReport]:
        reports = self.data_store.load_all_weekly_reports()
        for report in reports:
            if report.report_id == report_id:
                return report
        return None
