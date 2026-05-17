import csv
import os
from datetime import datetime
from typing import List, Dict, Any
from pathlib import Path
from .parser import Record, ParseResult
from .rules import RuleResult, Anomaly, AnomalyType


class ReportGenerator:
    def __init__(self, output_dir: str = "output"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def generate_all(self, parse_result: ParseResult, rule_result: RuleResult, 
                     missing_meters: List[str], prefix: str = "") -> Dict[str, str]:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_prefix = f"{prefix}_{timestamp}" if prefix else timestamp

        files = {
            'summary': self._generate_summary(parse_result, rule_result, missing_meters, file_prefix),
            'anomalies': self._generate_anomalies_csv(rule_result.anomalies, file_prefix),
            'bad_records': self._generate_bad_records_csv(parse_result.bad_records, file_prefix),
            'billing': self._generate_billing_csv(rule_result.records, file_prefix),
            'missing': self._generate_missing_meters_csv(missing_meters, file_prefix)
        }

        return files

    def _generate_summary(self, parse_result: ParseResult, rule_result: RuleResult,
                          missing_meters: List[str], file_prefix: str) -> str:
        filename = os.path.join(self.output_dir, f"{file_prefix}_summary.txt")
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write("水电抄表异常排查报告\n")
            f.write("=" * 60 + "\n\n")
            f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"源文件: {', '.join(parse_result.source_files)}\n\n")

            f.write("-" * 60 + "\n")
            f.write("统计概览\n")
            f.write("-" * 60 + "\n")
            for key, value in sorted(rule_result.statistics.items()):
                f.write(f"{key}: {value}\n")
            f.write(f"缺表数量: {len(missing_meters)}\n\n")

            f.write("-" * 60 + "\n")
            f.write("异常详情\n")
            f.write("-" * 60 + "\n")
            
            for anomaly_type in AnomalyType:
                anomalies = rule_result.get_anomalies_by_type(anomaly_type)
                if anomalies:
                    f.write(f"\n【{anomaly_type.value}】({len(anomalies)}条)\n")
                    for a in sorted(anomalies, key=lambda x: (x.record.source_file, x.record.row_number)):
                        f.write(f"  [{os.path.basename(a.record.source_file)}:{a.record.row_number}] ")
                        f.write(f"{a.record.household_id} - 表号{a.record.meter_number}: ")
                        f.write(f"{a.description} (用量: {a.record.usage:.2f})\n")

            if missing_meters:
                f.write(f"\n【缺表提示】({len(missing_meters)}条)\n")
                for meter in sorted(missing_meters):
                    f.write(f"  表号: {meter}\n")

            if parse_result.bad_records:
                f.write(f"\n【坏行记录】({len(parse_result.bad_records)}条)\n")
                for r in sorted(parse_result.bad_records, key=lambda x: (x.source_file, x.row_number)):
                    f.write(f"  [{os.path.basename(r.source_file)}:{r.row_number}] ")
                    f.write(f"{r.household_id or '未知住户'} - 表号{r.meter_number or '未知'}: ")
                    f.write(f"错误: {', '.join(r.errors)}\n")

        return filename

    def _generate_anomalies_csv(self, anomalies: List[Anomaly], file_prefix: str) -> str:
        filename = os.path.join(self.output_dir, f"{file_prefix}_anomalies.csv")
        
        with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow(['源文件', '行号', '住户', '表号', '异常类型', '异常描述', '用量', '倍率', '上月读数', '本月读数'])
            
            for a in sorted(anomalies, key=lambda x: (x.record.source_file, x.record.row_number)):
                writer.writerow([
                    os.path.basename(a.record.source_file),
                    a.record.row_number,
                    a.record.household_id,
                    a.record.meter_number,
                    a.anomaly_type.value,
                    a.description,
                    f"{a.record.usage:.2f}",
                    a.record.multiplier,
                    a.record.last_reading,
                    a.record.current_reading
                ])

        return filename

    def _generate_bad_records_csv(self, bad_records: List[Record], file_prefix: str) -> str:
        filename = os.path.join(self.output_dir, f"{file_prefix}_bad_records.csv")
        
        with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow(['源文件', '行号', '住户', '表号', '错误信息', '原始数据'])
            
            for r in sorted(bad_records, key=lambda x: (x.source_file, x.row_number)):
                writer.writerow([
                    os.path.basename(r.source_file),
                    r.row_number,
                    r.household_id,
                    r.meter_number,
                    '; '.join(r.errors),
                    str(r.raw_data)
                ])

        return filename

    def _generate_billing_csv(self, records: List[Record], file_prefix: str) -> str:
        filename = os.path.join(self.output_dir, f"{file_prefix}_billing.csv")
        
        with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow(['住户', '表号', '上月读数', '本月读数', '倍率', '用量', '数据来源', '行号', '状态'])
            
            for r in sorted(records, key=lambda x: (x.source_file, x.row_number)):
                status = "正常" if r.is_valid else "异常"
                writer.writerow([
                    r.household_id,
                    r.meter_number,
                    r.last_reading,
                    r.current_reading,
                    r.multiplier,
                    f"{r.usage:.2f}",
                    os.path.basename(r.source_file),
                    r.row_number,
                    status
                ])

        return filename

    def _generate_missing_meters_csv(self, missing_meters: List[str], file_prefix: str) -> str:
        filename = os.path.join(self.output_dir, f"{file_prefix}_missing_meters.csv")
        
        with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow(['序号', '缺失表号'])
            for idx, meter in enumerate(sorted(missing_meters), 1):
                writer.writerow([idx, meter])

        return filename

    def print_console_summary(self, rule_result: RuleResult, missing_meters: List[str]):
        print("\n" + "=" * 60)
        print("水电抄表异常排查 - 检查结果")
        print("=" * 60)
        
        print(f"\n有效记录: {rule_result.statistics.get('有效记录数', 0)}")
        print(f"无效记录: {rule_result.statistics.get('无效记录数', 0)}")
        print(f"总异常数: {rule_result.statistics.get('总异常数', 0)}")
        print(f"缺表数量: {len(missing_meters)}")

        if rule_result.anomalies:
            print("\n异常类型统计:")
            for anomaly_type in AnomalyType:
                count = len(rule_result.get_anomalies_by_type(anomaly_type))
                if count > 0:
                    print(f"  - {anomaly_type.value}: {count}条")
