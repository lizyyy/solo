import csv
import json
from datetime import datetime
from typing import List, Dict, Any
from pathlib import Path

from .models import SubleaseRecord, BadRecord, ValidationResult, LeaseStatus, AccessStatus


class ReportGenerator:
    def __init__(self, output_dir: str = None):
        if output_dir:
            self.output_dir = Path(output_dir)
        else:
            self.output_dir = Path.cwd() / "reports"
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_summary_report(self, summary: Dict[str, Any], 
                                 records: List[SubleaseRecord],
                                 bad_records: List[BadRecord],
                                 validation_results: List[ValidationResult],
                                 fee_summary: Dict[str, Dict],
                                 access_summary: Dict[str, Dict]) -> str:
        report_time = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = self.output_dir / f"summary_report_{report_time}.json"
        
        error_records = [r for r in validation_results if not r.is_valid]
        warning_records = [r for r in validation_results if r.warnings]
        
        records_data = []
        for record in records:
            record_dict = record.to_dict()
            record_dict["fee_detail"] = fee_summary.get(record.record_id, {})
            record_dict["access_detail"] = access_summary.get(record.record_id, {})
            records_data.append(record_dict)
        
        validation_data = [r.to_dict() for r in validation_results]
        bad_records_data = [b.to_dict() for b in bad_records]
        
        report = {
            "report_title": "车位转租门禁授权费用分摊排查报告",
            "report_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "summary": summary,
            "statistics": {
                "total_records": len(records),
                "valid_records": sum(1 for r in records if r.status == LeaseStatus.VALID),
                "expired_records": sum(1 for r in records if r.status == LeaseStatus.EXPIRED),
                "overlapping_records": sum(1 for r in records if r.status == LeaseStatus.OVERLAPPING),
                "early_terminated_records": sum(1 for r in records if r.status == LeaseStatus.EARLY_TERMINATED),
                "invalid_date_records": sum(1 for r in records if r.status == LeaseStatus.INVALID_DATE),
                "bad_records": len(bad_records),
                "records_with_errors": len(error_records),
                "records_with_warnings": len(warning_records),
                "access_granted": sum(1 for r in records if r.access_status == AccessStatus.GRANTED),
                "access_revoked": sum(1 for r in records if r.access_status == AccessStatus.REVOKED),
                "access_not_granted": sum(1 for r in records if r.access_status == AccessStatus.NOT_GRANTED)
            },
            "records": records_data,
            "validation_results": validation_data,
            "bad_records": bad_records_data,
            "error_records": [r.to_dict() for r in error_records],
            "warning_records": [r.to_dict() for r in warning_records]
        }
        
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        return str(report_file)
    
    def generate_csv_report(self, records: List[SubleaseRecord],
                            fee_summary: Dict[str, Dict],
                            access_summary: Dict[str, Dict]) -> str:
        report_time = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = self.output_dir / f"sublease_report_{report_time}.csv"
        
        records.sort(key=lambda r: r.record_id)
        
        headers = [
            "记录ID", "车位编号", "业主ID", "业主姓名",
            "承租人ID", "承租人姓名", "承租人电话",
            "开始日期", "结束日期", "实际终止日期",
            "月租金", "租期天数", "总费用",
            "物业分成", "业主收入",
            "租期状态", "门禁状态",
            "门禁授权日期", "门禁撤销日期",
            "源文件路径", "源文件行号"
        ]
        
        with open(report_file, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            
            for record in records:
                fee = fee_summary.get(record.record_id, {})
                access = access_summary.get(record.record_id, {})
                
                row = [
                    record.record_id,
                    record.space_id,
                    record.owner_id,
                    record.owner_name,
                    record.tenant_id,
                    record.tenant_name,
                    record.tenant_phone,
                    record.start_date.strftime("%Y-%m-%d"),
                    record.end_date.strftime("%Y-%m-%d"),
                    record.actual_terminate_date.strftime("%Y-%m-%d") if record.actual_terminate_date else "",
                    record.monthly_fee,
                    record.lease_days,
                    record.total_fee,
                    fee.get("property_fee", 0),
                    fee.get("owner_income", 0),
                    record.status.value,
                    record.access_status.value,
                    record.access_grant_date.strftime("%Y-%m-%d") if record.access_grant_date else "",
                    record.access_revoke_date.strftime("%Y-%m-%d") if record.access_revoke_date else "",
                    record.source.file_path,
                    record.source.row_number
                ]
                writer.writerow(row)
        
        return str(report_file)
    
    def generate_bad_records_report(self, bad_records: List[BadRecord]) -> str:
        if not bad_records:
            return ""
        
        report_time = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = self.output_dir / f"bad_records_{report_time}.csv"
        
        headers = [
            "源文件路径", "工作表名称", "行号",
            "原始数据", "错误信息"
        ]
        
        bad_records.sort(key=lambda b: (b.file_path, b.row_number))
        
        with open(report_file, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            
            for bad in bad_records:
                row = [
                    bad.file_path,
                    bad.sheet_name or "",
                    bad.row_number,
                    bad.original_data,
                    bad.error_message
                ]
                writer.writerow(row)
        
        return str(report_file)
    
    def generate_validation_report(self, validation_results: List[ValidationResult]) -> str:
        report_time = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = self.output_dir / f"validation_report_{report_time}.csv"
        
        headers = [
            "记录ID", "是否有效", "错误信息", "警告信息",
            "源文件路径", "源文件行号"
        ]
        
        validation_results.sort(key=lambda r: r.record_id)
        
        with open(report_file, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            
            for result in validation_results:
                row = [
                    result.record_id,
                    "是" if result.is_valid else "否",
                    "; ".join(result.errors) if result.errors else "",
                    "; ".join(result.warnings) if result.warnings else "",
                    result.source.file_path,
                    result.source.row_number
                ]
                writer.writerow(row)
        
        return str(report_file)
    
    def generate_owner_summary(self, records: List[SubleaseRecord],
                                fee_summary: Dict[str, Dict]) -> str:
        report_time = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = self.output_dir / f"owner_summary_{report_time}.csv"
        
        owner_data: Dict[str, Dict] = {}
        for record in records:
            owner_id = record.owner_id
            if owner_id not in owner_data:
                owner_data[owner_id] = {
                    "owner_name": record.owner_name,
                    "total_income": 0,
                    "total_fee": 0,
                    "record_count": 0,
                    "spaces": set()
                }
            
            fee = fee_summary.get(record.record_id, {})
            owner_data[owner_id]["total_income"] += fee.get("owner_income", 0)
            owner_data[owner_id]["total_fee"] += fee.get("total_fee", 0)
            owner_data[owner_id]["record_count"] += 1
            owner_data[owner_id]["spaces"].add(record.space_id)
        
        headers = [
            "业主ID", "业主姓名", "转租记录数",
            "涉及车位数", "总费用", "业主总收入"
        ]
        
        sorted_owners = sorted(owner_data.items(), key=lambda x: x[0])
        
        with open(report_file, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            
            for owner_id, data in sorted_owners:
                row = [
                    owner_id,
                    data["owner_name"],
                    data["record_count"],
                    len(data["spaces"]),
                    round(data["total_fee"], 2),
                    round(data["total_income"], 2)
                ]
                writer.writerow(row)
        
        return str(report_file)
    
    def print_console_summary(self, summary: Dict[str, Any],
                               bad_records_count: int):
        print("\n" + "=" * 60)
        print("车位转租门禁授权费用分摊排查 - 处理摘要")
        print("=" * 60)
        print(f"  检查日期: {summary.get('check_date', 'N/A')}")
        print(f"  物业费率: {summary.get('property_fee_rate', 0) * 100:.1f}%")
        print(f"  总记录数: {summary.get('total_records', 0)}")
        print(f"  有效记录: {summary.get('valid_records', 0)}")
        print(f"  无效记录: {summary.get('invalid_records', 0)}")
        print(f"  坏记录数: {bad_records_count}")
        print(f"  门禁授权: {summary.get('granted_access', 0)} 条")
        print(f"  总费用: {summary.get('total_fee', 0):.2f} 元")
        print(f"  物业分成: {summary.get('total_property_fee', 0):.2f} 元")
        print(f"  业主收入: {summary.get('total_owner_income', 0):.2f} 元")
        print("=" * 60)
        print(f"  报告已导出到: {self.output_dir}")
        print("=" * 60 + "\n")
