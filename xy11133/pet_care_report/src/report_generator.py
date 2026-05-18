import csv
import json
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime
from .parser import PetCareRecord
from .validator import ValidationError


class ReportGenerator:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_reports(self, validation_result: Dict[str, Any], 
                         parse_errors: List[str], 
                         unprocessed_files: List[str],
                         run_id: str = None) -> Dict[str, Path]:
        if run_id is None:
            run_id = datetime.now().strftime('%Y%m%d_%H%M%S')

        reports = {}

        reports['normal'] = self._generate_normal_report(
            validation_result['normal_records'], run_id)
        reports['abnormal'] = self._generate_abnormal_report(
            validation_result['abnormal_records'], validation_result['errors'], run_id)
        reports['summary'] = self._generate_summary_report(
            validation_result['summary'], parse_errors, unprocessed_files, run_id)
        reports['errors'] = self._generate_error_details_report(
            validation_result['errors'], parse_errors, run_id)

        return reports

    def _generate_normal_report(self, records: List[PetCareRecord], run_id: str) -> Path:
        file_path = self.output_dir / f'正常记录_{run_id}.csv'
        with open(file_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['记录ID', '日期', '笼号', '宠物名称', '宠物数量', 
                           '喂食情况', '健康状况', '备注', '来源文件'])
            for record in records:
                writer.writerow([
                    record.record_id,
                    record.date,
                    record.cage_number,
                    '、'.join(record.pet_names),
                    record.pet_count,
                    record.feeding_status,
                    record.health_status,
                    record.notes,
                    record.source_file
                ])
        return file_path

    def _generate_abnormal_report(self, records: List[PetCareRecord], 
                                  errors: List[ValidationError], run_id: str) -> Path:
        file_path = self.output_dir / f'异常记录_{run_id}.csv'
        
        record_errors = {}
        for error in errors:
            if error.record_id not in record_errors:
                record_errors[error.record_id] = []
            record_errors[error.record_id].append(error.message)

        with open(file_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['记录ID', '日期', '笼号', '宠物名称', '异常描述', '来源文件'])
            for record in records:
                error_msgs = '; '.join(record_errors.get(record.record_id, []))
                writer.writerow([
                    record.record_id,
                    record.date,
                    record.cage_number,
                    '、'.join(record.pet_names),
                    error_msgs,
                    record.source_file
                ])
        return file_path

    def _generate_summary_report(self, summary: Dict[str, Any], 
                                 parse_errors: List[str], 
                                 unprocessed_files: List[str], 
                                 run_id: str) -> Path:
        file_path = self.output_dir / f'处理汇总_{run_id}.txt'
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write("      宠物寄养店寄养护理日报 - 处理汇总报告\n")
            f.write("=" * 60 + "\n\n")
            f.write(f"运行ID: {run_id}\n")
            f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            f.write("-" * 60 + "\n")
            f.write("【记录统计】\n")
            f.write("-" * 60 + "\n")
            f.write(f"总记录数: {summary['total_records']}\n")
            f.write(f"正常记录数: {summary['normal_count']}\n")
            f.write(f"异常记录数: {summary['abnormal_count']}\n\n")
            
            f.write("-" * 60 + "\n")
            f.write("【异常统计】\n")
            f.write("-" * 60 + "\n")
            f.write(f"总异常数: {summary['total_errors']}\n")
            f.write(f"  错误级: {summary['severity_count']['error']}\n")
            f.write(f"  警告级: {summary['severity_count']['warning']}\n")
            f.write(f"  信息级: {summary['severity_count']['info']}\n\n")
            
            f.write("异常类型分布:\n")
            for error_type, count in summary['error_types'].items():
                f.write(f"  - {error_type}: {count} 次\n")
            f.write("\n")
            
            f.write("-" * 60 + "\n")
            f.write("【文件处理情况】\n")
            f.write("-" * 60 + "\n")
            if unprocessed_files:
                f.write(f"未处理文件数: {len(unprocessed_files)}\n")
                for idx, file_info in enumerate(unprocessed_files, 1):
                    f.write(f"  {idx}. {file_info}\n")
            else:
                f.write("所有文件处理成功\n")
            f.write("\n")
            
            if parse_errors:
                f.write("-" * 60 + "\n")
                f.write("【解析错误详情】\n")
                f.write("-" * 60 + "\n")
                for idx, error in enumerate(parse_errors, 1):
                    f.write(f"  {idx}. {error}\n")
                f.write("\n")
            
            f.write("=" * 60 + "\n")
            f.write("报告结束\n")
            f.write("=" * 60 + "\n")
        
        return file_path

    def _generate_error_details_report(self, errors: List[ValidationError],
                                       parse_errors: List[str], run_id: str) -> Path:
        file_path = self.output_dir / f'错误详情_{run_id}.json'
        
        data = {
            'run_id': run_id,
            'generated_at': datetime.now().isoformat(),
            'validation_errors': [e.to_dict() for e in errors],
            'parse_errors': parse_errors
        }
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return file_path

    def generate_rerun_comparison(self, run1_id: str, run2_id: str) -> Path:
        file_path = self.output_dir / f'重跑对比_{run1_id}_vs_{run2_id}.txt'
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write("      宠物寄养店寄养护理日报 - 重跑对比报告\n")
            f.write("=" * 60 + "\n\n")
            f.write(f"第一次运行: {run1_id}\n")
            f.write(f"第二次运行: {run2_id}\n\n")
            
            f.write("说明: 重跑功能确保相同输入产生相同输出，\n")
            f.write("      便于验证修复效果和数据一致性。\n")
            f.write("=" * 60 + "\n")
        
        return file_path
