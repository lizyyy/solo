import pandas as pd
from datetime import datetime
from typing import List
from pathlib import Path

from .models import CheckResult, BadRecord, RuleResultType


class ReportGenerator:
    def __init__(self):
        pass

    def _get_source_location(self, obj) -> str:
        if not obj or not obj.source_info:
            return ""
        source = obj.source_info
        location = f"{Path(source.file_path).name}"
        if source.sheet_name:
            location += f"!{source.sheet_name}"
        if source.row_number:
            location += f"!{source.row_number}行"
        return location

    def generate_summary(self, results: List[CheckResult], bad_records: List[BadRecord]) -> dict:
        total = len(results)
        passed = sum(1 for r in results if r.final_status == RuleResultType.PASS)
        warned = sum(1 for r in results if r.final_status == RuleResultType.WARN)
        blocked = sum(1 for r in results if r.final_status == RuleResultType.BLOCK)
        
        rule_violations = {}
        for result in results:
            for rule_result in result.rule_results:
                if rule_result.result_type != RuleResultType.PASS:
                    rule_name = rule_result.rule_name
                    rule_violations[rule_name] = rule_violations.get(rule_name, 0) + 1
        
        return {
            "total_events": total,
            "passed": passed,
            "warned": warned,
            "blocked": blocked,
            "pass_rate": f"{(passed/total*100):.2f}%" if total > 0 else "0%",
            "bad_records_count": len(bad_records),
            "rule_violations": rule_violations,
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    def export_to_excel(self, results: List[CheckResult], bad_records: List[BadRecord], 
                       output_path: str, include_duplicates: bool = True):
        summary_data = self.generate_summary(results, bad_records)
        
        summary_rows = []
        summary_rows.append(["统计项", "数值"])
        summary_rows.append(["总事件数", summary_data["total_events"]])
        summary_rows.append(["通过", summary_data["passed"]])
        summary_rows.append(["警告", summary_data["warned"]])
        summary_rows.append(["拦截", summary_data["blocked"]])
        summary_rows.append(["通过率", summary_data["pass_rate"]])
        summary_rows.append(["坏记录数", summary_data["bad_records_count"]])
        summary_rows.append(["生成时间", summary_data["generated_at"]])
        summary_rows.append([])
        summary_rows.append(["规则违规统计", "次数"])
        for rule_name, count in summary_data["rule_violations"].items():
            summary_rows.append([rule_name, count])
        
        df_summary = pd.DataFrame(summary_rows[1:], columns=summary_rows[0])
        
        detail_rows = []
        headers = [
            "事件ID", "人员ID", "姓名", "事件时间", "闸机名称", "事件类型",
            "是否重复", "重复自事件ID",
            "最终状态", "最终消息",
            "人员档案来源", "闸机记录来源", "访客申请来源", "培训记录来源", "黑名单来源"
        ]
        
        for result in sorted(results, key=lambda x: x.event.event_time):
            event = result.event
            
            person_source = self._get_source_location(result.person)
            event_source = self._get_source_location(event)
            visitor_source = self._get_source_location(result.visitor_app)
            training_source = self._get_source_location(result.training_records[0]) if result.training_records else ""
            blacklist_source = self._get_source_location(result.blacklist_records[0]) if result.blacklist_records else ""
            
            detail_rows.append([
                event.event_id,
                event.person_id,
                event.name,
                event.event_time.strftime("%Y-%m-%d %H:%M:%S"),
                event.gate_name,
                event.event_type.value,
                "是" if event.is_duplicate else "否",
                event.duplicate_of or "",
                result.final_status.value,
                result.final_message,
                person_source,
                event_source,
                visitor_source,
                training_source,
                blacklist_source
            ])
        
        df_details = pd.DataFrame(detail_rows, columns=headers)
        
        rule_detail_rows = []
        rule_headers = [
            "事件ID", "人员ID", "姓名", "规则名称", "规则结果", "规则消息", "规则详情"
        ]
        
        for result in sorted(results, key=lambda x: x.event.event_time):
            event = result.event
            for rule_result in result.rule_results:
                rule_detail_rows.append([
                    event.event_id,
                    event.person_id,
                    event.name,
                    rule_result.rule_name,
                    rule_result.result_type.value,
                    rule_result.message,
                    str(rule_result.details)
                ])
        
        df_rule_details = pd.DataFrame(rule_detail_rows, columns=rule_headers)
        
        bad_rows = []
        bad_headers = [
            "来源文件", "工作表", "行号", "错误类型", "错误消息", "原始内容"
        ]
        
        for bad in bad_records:
            bad_rows.append([
                Path(bad.source_info.file_path).name,
                bad.source_info.sheet_name or "",
                bad.source_info.row_number,
                bad.error_type,
                bad.error_message,
                bad.source_info.raw_content
            ])
        
        df_bad_records = pd.DataFrame(bad_rows, columns=bad_headers)
        
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            df_summary.to_excel(writer, sheet_name='统计汇总', index=False)
            df_details.to_excel(writer, sheet_name='检查结果明细', index=False)
            df_rule_details.to_excel(writer, sheet_name='规则明细', index=False)
            df_bad_records.to_excel(writer, sheet_name='坏记录', index=False)
            
            workbook = writer.book
            for sheet_name in workbook.sheetnames:
                worksheet = workbook[sheet_name]
                for column in worksheet.columns:
                    max_length = 0
                    column_letter = column[0].column_letter
                    for cell in column:
                        try:
                            if len(str(cell.value)) > max_length:
                                max_length = len(str(cell.value))
                        except:
                            pass
                    adjusted_width = min(max_length + 2, 50)
                    worksheet.column_dimensions[column_letter].width = adjusted_width

        return output_path

    def print_console_summary(self, results: List[CheckResult], bad_records: List[BadRecord]):
        summary = self.generate_summary(results, bad_records)
        
        print("\n" + "="*60)
        print("工地通行资格访客时段安全拦截排查 - 检查报告")
        print("="*60)
        print(f"生成时间: {summary['generated_at']}")
        print(f"总事件数: {summary['total_events']}")
        print(f"通过: {summary['passed']} ({summary['pass_rate']})")
        print(f"警告: {summary['warned']}")
        print(f"拦截: {summary['blocked']}")
        print(f"坏记录: {summary['bad_records_count']}")
        print("-"*60)
        
        if summary['rule_violations']:
            print("\n规则违规统计:")
            for rule_name, count in sorted(summary['rule_violations'].items()):
                print(f"  {rule_name}: {count} 次")
        
        blocked_results = [r for r in results if r.final_status == RuleResultType.BLOCK]
        if blocked_results:
            print("\n拦截明细:")
            for r in sorted(blocked_results, key=lambda x: x.event.event_time)[:10]:
                print(f"  [{r.event.event_time}] {r.event.name}: {r.final_message}")
            if len(blocked_results) > 10:
                print(f"  ... 还有 {len(blocked_results) - 10} 条拦截记录")
        
        print("\n" + "="*60)
