#!/usr/bin/env python3
import csv
import os
import sys
import argparse
from datetime import datetime
from typing import List, Dict, Tuple, Any
import json


REQUIRED_COLUMNS = [
    "设备ID",
    "设备名称",
    "领用时间",
    "归还时间",
    "初始电量(%)",
    "当前电量(%)",
    "讲解员",
    "展区",
    "快充标识"
]


class BatteryPredictor:
    def __init__(self, input_path: str, output_dir: str):
        self.input_path = input_path
        self.output_dir = output_dir
        self.normal_results: List[Dict[str, Any]] = []
        self.exception_results: List[Dict[str, Any]] = []
        self.summary = {
            "total_files": 0,
            "processed_files": 0,
            "failed_files": 0,
            "total_records": 0,
            "normal_records": 0,
            "exception_records": 0,
            "failed_files_list": [],
            "exception_types": {}
        }

    def validate_and_parse_record(self, row: Dict[str, str], filename: str) -> Tuple[bool, Dict[str, Any], List[str]]:
        issues = []
        cleaned_row = row.copy()
        cleaned_row["源文件"] = filename

        device_id = row.get("设备ID", "").strip()
        if not device_id:
            issues.append("设备ID为空")

        borrow_time_str = row.get("领用时间", "").strip()
        return_time_str = row.get("归还时间", "").strip()

        if not borrow_time_str or borrow_time_str.lower() in ["", "n/a", "null", "invalid_date"]:
            issues.append("领用时间格式无效或缺失")
            cleaned_row["领用时间"] = None
        else:
            try:
                borrow_time = datetime.strptime(borrow_time_str, "%Y-%m-%d %H:%M:%S")
                cleaned_row["领用时间"] = borrow_time
            except ValueError:
                issues.append("领用时间格式无效")
                cleaned_row["领用时间"] = None

        if not return_time_str or return_time_str.lower() in ["", "n/a", "null"]:
            issues.append("设备未归还（归还时间缺失）")
            cleaned_row["归还时间"] = None
        else:
            try:
                return_time = datetime.strptime(return_time_str, "%Y-%m-%d %H:%M:%S")
                cleaned_row["归还时间"] = return_time
                if cleaned_row.get("领用时间") and return_time < cleaned_row["领用时间"]:
                    issues.append("归还时间早于领用时间")
            except ValueError:
                issues.append("归还时间格式无效")
                cleaned_row["归还时间"] = None

        initial_battery_str = row.get("初始电量(%)", "").strip()
        if not initial_battery_str or initial_battery_str.lower() in ["", "n/a", "null"]:
            issues.append("初始电量缺失")
            cleaned_row["初始电量(%)"] = None
        else:
            try:
                initial_battery = float(initial_battery_str)
                if initial_battery < 0 or initial_battery > 100:
                    issues.append("初始电量超出正常范围(0-100)")
                cleaned_row["初始电量(%)"] = initial_battery
            except ValueError:
                issues.append("初始电量格式无效")
                cleaned_row["初始电量(%)"] = None

        current_battery_str = row.get("当前电量(%)", "").strip()
        if not current_battery_str or current_battery_str.lower() in ["", "n/a", "null"]:
            issues.append("当前电量缺失")
            cleaned_row["当前电量(%)"] = None
        else:
            try:
                current_battery = float(current_battery_str)
                if current_battery < 0 or current_battery > 100:
                    issues.append("当前电量超出正常范围(0-100)")
                cleaned_row["当前电量(%)"] = current_battery
            except ValueError:
                issues.append("当前电量格式无效")
                cleaned_row["当前电量(%)"] = None

        if cleaned_row.get("初始电量(%)") is not None and cleaned_row.get("当前电量(%)") is not None:
            if cleaned_row["当前电量(%)"] > cleaned_row["初始电量(%)"]:
                issues.append("当前电量高于初始电量（可能存在快充或数据异常）")

        fast_charge_str = row.get("快充标识", "").strip()
        if fast_charge_str not in ["0", "1"]:
            issues.append("快充标识值无效（应为0或1）")
        cleaned_row["快充标识"] = fast_charge_str

        return len(issues) == 0, cleaned_row, issues

    def predict_end_battery(self, record: Dict[str, Any]) -> Dict[str, Any]:
        result = record.copy()

        if not all([record.get("初始电量(%)"), record.get("领用时间"), record.get("归还时间")]):
            result["预测剩余电量(%)"] = None
            result["预测可使用时长(小时)"] = None
            result["耗电速率(%/小时)"] = None
            return result

        duration_hours = (record["归还时间"] - record["领用时间"]).total_seconds() / 3600
        battery_consumed = record["初始电量(%)"] - record["当前电量(%)"]

        if duration_hours > 0:
            consumption_rate = battery_consumed / duration_hours
        else:
            consumption_rate = 0

        is_fast_charge = record.get("快充标识") == "1"
        if is_fast_charge:
            base_prediction = record["当前电量(%)"] - (consumption_rate * 2 * 0.7)
        else:
            base_prediction = record["当前电量(%)"] - (consumption_rate * 2)

        predicted_remaining = max(0, min(100, base_prediction))

        if consumption_rate > 0:
            usable_hours = predicted_remaining / consumption_rate
        else:
            usable_hours = 999

        result["耗电速率(%/小时)"] = round(consumption_rate, 2)
        result["预测剩余电量(%)"] = round(predicted_remaining, 1)
        result["预测可使用时长(小时)"] = round(usable_hours, 2)
        result["预测说明"] = "快充设备耗电按70%计算" if is_fast_charge else "正常耗电计算"

        return result

    def process_csv_file(self, filepath: str) -> bool:
        filename = os.path.basename(filepath)
        self.summary["total_files"] += 1

        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)

                if not reader.fieldnames:
                    raise ValueError("CSV文件无表头")

                missing_cols = [col for col in REQUIRED_COLUMNS if col not in reader.fieldnames]
                if missing_cols:
                    raise ValueError(f"缺少必需列: {', '.join(missing_cols)}")

                for row in reader:
                    self.summary["total_records"] += 1
                    is_valid, cleaned_record, issues = self.validate_and_parse_record(row, filename)

                    if is_valid:
                        predicted_record = self.predict_end_battery(cleaned_record)
                        self.normal_results.append(predicted_record)
                        self.summary["normal_records"] += 1
                    else:
                        cleaned_record["异常原因"] = " | ".join(issues)
                        self.exception_results.append(cleaned_record)
                        self.summary["exception_records"] += 1
                        for issue in issues:
                            self.summary["exception_types"][issue] = self.summary["exception_types"].get(issue, 0) + 1

                self.summary["processed_files"] += 1
                return True

        except Exception as e:
            self.summary["failed_files"] += 1
            self.summary["failed_files_list"].append({
                "filename": filename,
                "error": str(e)
            })
            print(f"处理文件失败 [{filename}]: {str(e)}")
            return False

    def process_input(self):
        if os.path.isfile(self.input_path):
            self.process_csv_file(self.input_path)
        elif os.path.isdir(self.input_path):
            for filename in sorted(os.listdir(self.input_path)):
                if filename.lower().endswith('.csv'):
                    filepath = os.path.join(self.input_path, filename)
                    self.process_csv_file(filepath)
        else:
            print(f"错误: 输入路径不存在或不可读: {self.input_path}")
            sys.exit(1)

    def format_record_for_output(self, record: Dict[str, Any]) -> Dict[str, str]:
        formatted = {}
        for key, value in record.items():
            if isinstance(value, datetime):
                formatted[key] = value.strftime("%Y-%m-%d %H:%M:%S")
            elif value is None:
                formatted[key] = ""
            else:
                formatted[key] = str(value)
        return formatted

    def write_results(self):
        os.makedirs(os.path.join(self.output_dir, "normal_results"), exist_ok=True)
        os.makedirs(os.path.join(self.output_dir, "exception_results"), exist_ok=True)

        if self.normal_results:
            normal_file = os.path.join(self.output_dir, "normal_results", "正常电量预测结果.csv")
            fieldnames = [
                "设备ID", "设备名称", "领用时间", "归还时间", "初始电量(%)",
                "当前电量(%)", "讲解员", "展区", "快充标识", "源文件",
                "耗电速率(%/小时)", "预测剩余电量(%)", "预测可使用时长(小时)", "预测说明"
            ]
            with open(normal_file, 'w', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for record in self.normal_results:
                    writer.writerow(self.format_record_for_output(record))
            print(f"正常结果已写入: {normal_file} ({len(self.normal_results)} 条)")

        if self.exception_results:
            exception_file = os.path.join(self.output_dir, "exception_results", "异常数据记录.csv")
            fieldnames = [
                "设备ID", "设备名称", "领用时间", "归还时间", "初始电量(%)",
                "当前电量(%)", "讲解员", "展区", "快充标识", "源文件", "异常原因"
            ]
            with open(exception_file, 'w', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for record in self.exception_results:
                    writer.writerow(self.format_record_for_output(record))
            print(f"异常结果已写入: {exception_file} ({len(self.exception_results)} 条)")

        summary_file = os.path.join(self.output_dir, "处理汇总报告.json")
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(self.summary, f, ensure_ascii=False, indent=2)
        print(f"汇总报告已写入: {summary_file}")

    def print_summary(self):
        print("\n" + "="*60)
        print("博物馆讲解组讲解器电量预测 - 处理汇总")
        print("="*60)
        print(f"总文件数: {self.summary['total_files']}")
        print(f"成功处理: {self.summary['processed_files']}")
        print(f"处理失败: {self.summary['failed_files']}")
        print(f"总记录数: {self.summary['total_records']}")
        print(f"正常记录: {self.summary['normal_records']}")
        print(f"异常记录: {self.summary['exception_records']}")

        if self.summary["failed_files_list"]:
            print("\n未处理的损坏文件:")
            for item in self.summary["failed_files_list"]:
                print(f"  - {item['filename']}: {item['error']}")

        if self.summary["exception_types"]:
            print("\n异常类型统计:")
            for issue, count in sorted(self.summary["exception_types"].items(), key=lambda x: -x[1]):
                print(f"  - {issue}: {count} 次")
        print("="*60 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="博物馆讲解组讲解器电量预测 CLI - 统一口径，分离正常/异常结果"
    )
    parser.add_argument(
        "--input", "-i",
        required=True,
        help="输入文件或目录路径（支持单个CSV文件或包含多个CSV的目录）"
    )
    parser.add_argument(
        "--output", "-o",
        default="./output",
        help="输出目录路径（默认为 ./output）"
    )

    args = parser.parse_args()

    predictor = BatteryPredictor(args.input, args.output)
    predictor.process_input()
    predictor.write_results()
    predictor.print_summary()


if __name__ == "__main__":
    main()
