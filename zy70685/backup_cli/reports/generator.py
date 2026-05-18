import csv
import json
import os
from datetime import datetime
from typing import List, Dict, Any

from backup_cli.parser.csv_parser import ParseResult
from backup_cli.rules.engine import ProcessedRecord, RuleStatus, RuleType
from backup_cli.tracker.source_tracker import SourceTracker, ValidationSummary, SourceTrace


class ReportGenerator:
    def __init__(self, output_dir: str = "./output"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def generate_all_reports(
        self,
        parse_result: ParseResult,
        processed_records: List[ProcessedRecord],
        tracker: SourceTracker,
        validation_summary: ValidationSummary
    ) -> Dict[str, str]:
        generated_files = {}

        generated_files['summary'] = self._generate_summary_report(
            processed_records, validation_summary
        )
        generated_files['detailed'] = self._generate_detailed_report(processed_records)
        generated_files['overdue'] = self._generate_overdue_report(processed_records)
        generated_files['damage'] = self._generate_damage_report(processed_records)
        generated_files['invalid'] = self._generate_invalid_records_report(tracker)
        generated_files['json'] = self._generate_json_export(processed_records, validation_summary)

        return generated_files

    def _generate_summary_report(
        self,
        processed_records: List[ProcessedRecord],
        validation_summary: ValidationSummary
    ) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = os.path.join(self.output_dir, f"summary_report_{timestamp}.txt")

        returned = sum(1 for r in processed_records if r.is_returned)
        not_returned = len(processed_records) - returned
        overdue = sum(1 for r in processed_records if r.is_overdue)
        has_damage = sum(1 for r in processed_records if r.has_damage)
        locked_devices = sum(1 for r in processed_records if r.device_locked)
        frozen_deposits = sum(1 for r in processed_records if r.deposit_frozen)
        
        total_deposit = sum(r.original_record.data.get('deposit_amount', 0.0) for r in processed_records)
        total_damage_charge = sum(r.final_deposit_refund for r in processed_records if r.has_damage)
        total_refund = sum(r.final_deposit_refund for r in processed_records if r.is_returned)

        with open(filename, 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write("          备机借用押金归还检查排查汇总报告\n")
            f.write("=" * 60 + "\n")
            f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            f.write("【数据验证概览】\n")
            f.write(f"  总记录数: {validation_summary.total_records}\n")
            f.write(f"  有效记录: {validation_summary.valid_records}\n")
            f.write(f"  无效记录: {validation_summary.invalid_records}\n")
            f.write(f"  唯一备机数: {validation_summary.unique_devices}\n")
            f.write(f"  唯一维修单数: {validation_summary.unique_repair_orders}\n")
            f.write(f"  押金总额: ¥{validation_summary.total_deposit:.2f}\n\n")
            
            f.write("【业务状态概览】\n")
            f.write(f"  已归还: {returned}\n")
            f.write(f"  未归还: {not_returned}\n")
            f.write(f"  逾期: {overdue}\n")
            f.write(f"  有损坏: {has_damage}\n")
            f.write(f"  锁定备机: {locked_devices}\n")
            f.write(f"  冻结押金: {frozen_deposits}\n\n")
            
            f.write("【金额概览】\n")
            f.write(f"  押金总额: ¥{total_deposit:.2f}\n")
            f.write(f"  损坏扣款总额: ¥{total_damage_charge:.2f}\n")
            f.write(f"  应退还押金总额: ¥{total_refund:.2f}\n\n")
            
            if validation_summary.duplicate_ids:
                f.write("【重复/冲突检测】\n")
                for dup_type, lines in validation_summary.duplicate_ids:
                    f.write(f"  {dup_type} - 行号: {lines}\n")
                f.write("\n")

        return filename

    def _generate_detailed_report(self, processed_records: List[ProcessedRecord]) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = os.path.join(self.output_dir, f"detailed_report_{timestamp}.csv")

        headers = [
            '客户姓名', '维修单号', '备机编号', '押金金额',
            '借用日期', '预计归还日期', '实际归还日期',
            '已归还', '逾期', '有损坏', '损坏扣款',
            '应退押金', '备机锁定', '押金冻结',
            '来源文件', '行号'
        ]

        with open(filename, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            
            for record in processed_records:
                data = record.original_record.data
                writer.writerow([
                    data.get('customer_name', ''),
                    data.get('repair_order_id', ''),
                    data.get('backup_device_id', ''),
                    f"{data.get('deposit_amount', 0.0):.2f}",
                    str(data.get('borrow_date', '')),
                    str(data.get('expected_return_date', '')),
                    str(data.get('actual_return_date', '')),
                    '是' if record.is_returned else '否',
                    '是' if record.is_overdue else '否',
                    '是' if record.has_damage else '否',
                    f"{data.get('damage_charge_amount', 0.0):.2f}",
                    f"{record.final_deposit_refund:.2f}",
                    '是' if record.device_locked else '否',
                    '是' if record.deposit_frozen else '否',
                    record.original_record.source.file_path,
                    record.original_record.source.line_number
                ])

        return filename

    def _generate_overdue_report(self, processed_records: List[ProcessedRecord]) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = os.path.join(self.output_dir, f"overdue_report_{timestamp}.txt")

        overdue_records = [r for r in processed_records if r.is_overdue]

        with open(filename, 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write("                 逾期记录报告\n")
            f.write("=" * 60 + "\n\n")
            
            f.write(f"逾期总数: {len(overdue_records)}\n\n")
            
            for i, record in enumerate(overdue_records, 1):
                data = record.original_record.data
                overdue_rule = next(
                    (r for r in record.rule_results if r.rule_type == RuleType.OVERDUE_REMINDER),
                    None
                )
                
                f.write(f"【记录 {i}】\n")
                f.write(f"  客户: {data.get('customer_name')}\n")
                f.write(f"  维修单: {data.get('repair_order_id')}\n")
                f.write(f"  备机: {data.get('backup_device_id')}\n")
                f.write(f"  押金: ¥{data.get('deposit_amount', 0.0):.2f}\n")
                f.write(f"  借用日期: {data.get('borrow_date')}\n")
                f.write(f"  预计归还: {data.get('expected_return_date')}\n")
                
                if overdue_rule:
                    f.write(f"  {overdue_rule.message}\n")
                
                f.write(f"  来源: 行 {record.original_record.source.line_number}\n\n")

        return filename

    def _generate_damage_report(self, processed_records: List[ProcessedRecord]) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = os.path.join(self.output_dir, f"damage_report_{timestamp}.txt")

        damage_records = [r for r in processed_records if r.has_damage]

        with open(filename, 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write("                 损坏记录报告\n")
            f.write("=" * 60 + "\n\n")
            
            f.write(f"损坏总数: {len(damage_records)}\n\n")
            
            for i, record in enumerate(damage_records, 1):
                data = record.original_record.data
                damage_rule = next(
                    (r for r in record.rule_results if r.rule_type == RuleType.DAMAGE_CHARGE),
                    None
                )
                
                f.write(f"【记录 {i}】\n")
                f.write(f"  客户: {data.get('customer_name')}\n")
                f.write(f"  维修单: {data.get('repair_order_id')}\n")
                f.write(f"  备机: {data.get('backup_device_id')}\n")
                f.write(f"  押金: ¥{data.get('deposit_amount', 0.0):.2f}\n")
                
                if damage_rule:
                    f.write(f"  {damage_rule.message}\n")
                    f.write(f"  应退押金: ¥{record.final_deposit_refund:.2f}\n")
                
                f.write(f"  来源: 行 {record.original_record.source.line_number}\n\n")

        return filename

    def _generate_invalid_records_report(self, tracker: SourceTracker) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = os.path.join(self.output_dir, f"invalid_records_report_{timestamp}.txt")

        invalid_traces = tracker.get_all_invalid_traces()

        with open(filename, 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write("                 无效记录报告\n")
            f.write("=" * 60 + "\n\n")
            
            f.write(f"无效记录总数: {len(invalid_traces)}\n\n")
            
            for i, trace in enumerate(invalid_traces, 1):
                f.write(f"【记录 {i} - 行 {trace.line_number}】\n")
                f.write(f"  文件: {trace.file_path}\n")
                f.write(f"  原始内容: {trace.raw_content}\n")
                f.write(f"  错误:\n")
                for error in trace.validation_errors:
                    f.write(f"    - {error}\n")
                f.write("\n")

        return filename

    def _generate_json_export(
        self,
        processed_records: List[ProcessedRecord],
        validation_summary: ValidationSummary
    ) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = os.path.join(self.output_dir, f"full_export_{timestamp}.json")

        export_data = {
            'export_time': datetime.now().isoformat(),
            'validation_summary': {
                'total_records': validation_summary.total_records,
                'valid_records': validation_summary.valid_records,
                'invalid_records': validation_summary.invalid_records,
                'duplicate_ids': validation_summary.duplicate_ids,
                'unique_devices': validation_summary.unique_devices,
                'unique_repair_orders': validation_summary.unique_repair_orders,
                'total_deposit': validation_summary.total_deposit
            },
            'records': []
        }

        for record in processed_records:
            record_data = {
                'summary': record.summary,
                'source': {
                    'file_path': record.original_record.source.file_path,
                    'line_number': record.original_record.source.line_number,
                    'raw_content': record.original_record.source.raw_content
                },
                'rule_results': [
                    {
                        'rule_type': r.rule_type.value,
                        'status': r.status.value,
                        'message': r.message,
                        'details': r.details,
                        'severity': r.severity
                    }
                    for r in record.rule_results
                ]
            }
            export_data['records'].append(record_data)

        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2, default=str)

        return filename
