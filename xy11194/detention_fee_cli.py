#!/usr/bin/env python3
import argparse
import csv
import os
import sys
import traceback
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Tuple

import yaml
import pandas as pd


class DetentionFeeCalculator:
    def __init__(self, config_path: str = "config.yaml"):
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = yaml.safe_load(f)
        self.rules = self.config['detention_fee_rules']
        self.holidays = set(self.rules['holidays'])
        self.errors = []

    def parse_date(self, date_str: str) -> datetime:
        if pd.isna(date_str) or str(date_str).strip() == '':
            return None
        if isinstance(date_str, datetime):
            return date_str
        date_str = str(date_str).strip()
        for fmt in self.config['input']['date_formats']:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        raise ValueError(f"无法解析日期: {date_str}")

    def is_holiday(self, date: datetime) -> bool:
        return date.strftime("%Y-%m-%d") in self.holidays

    def is_weekend(self, date: datetime) -> bool:
        return date.weekday() >= 5

    def get_free_days(self, shipping_line: str) -> int:
        shipping_line = str(shipping_line).strip().upper()
        special_lines = self.rules['free_days']['special_lines']
        return special_lines.get(shipping_line, self.rules['free_days']['default'])

    def calculate_work_days(self, start: datetime, end: datetime, exclude_holidays: bool = True) -> int:
        if start is None or end is None:
            return 0
        days = 0
        current = start
        while current <= end:
            if exclude_holidays:
                if not self.is_weekend(current) and not self.is_holiday(current):
                    days += 1
            else:
                days += 1
            current += timedelta(days=1)
        return days

    def calculate_calendar_days(self, start: datetime, end: datetime) -> int:
        if start is None or end is None:
            return 0
        return (end - start).days + 1

    def get_daily_rate(self, container_type: str, day: int) -> float:
        container_type = str(container_type).strip().upper()
        rates = self.rules['daily_rates'].get(container_type)
        if not rates:
            return 0
        for range_str, rate in rates.items():
            if '+' in range_str:
                threshold = int(range_str.replace('+', ''))
                if day >= threshold:
                    return rate
            else:
                min_day, max_day = map(int, range_str.split('-'))
                if min_day <= day <= max_day:
                    return rate
        return 0

    def calculate_detention_fee(self, row: Dict) -> Dict[str, Any]:
        bl_no = str(row.get('BL_NO', '')).strip()
        container_no = str(row.get('CONTAINER_NO', '')).strip()
        container_type = str(row.get('CONTAINER_TYPE', '')).strip()
        shipping_line = str(row.get('SHIPPING_LINE', '')).strip()
        arrival_date = self.parse_date(row.get('ARRIVAL_DATE'))
        release_date = self.parse_date(row.get('RELEASE_DATE'))
        has_inspection = str(row.get('INSPECTION', '')).strip().upper() in ['Y', 'YES', '是', '有']
        inspection_date = self.parse_date(row.get('INSPECTION_DATE'))
        has_port_change = str(row.get('PORT_CHANGE', '')).strip().upper() in ['Y', 'YES', '是', '有']
        original_port = str(row.get('ORIGINAL_PORT', '')).strip()
        new_port = str(row.get('NEW_PORT', '')).strip()
        remarks = str(row.get('REMARKS', '')).strip()

        if not arrival_date or not release_date:
            raise ValueError(f"缺少必要日期字段: 提单号={bl_no}, 箱号={container_no}")

        free_days = self.get_free_days(shipping_line)
        total_calendar_days = self.calculate_calendar_days(arrival_date, release_date)
        total_work_days = self.calculate_work_days(arrival_date, release_date)

        exempt_days = 0
        if has_inspection and inspection_date:
            exempt_days = self.rules['inspection_exempt_days']

        effective_days = max(0, total_calendar_days - free_days - exempt_days)

        total_fee = 0
        fee_breakdown = []
        for day in range(1, effective_days + 1):
            rate = self.get_daily_rate(container_type, day)
            total_fee += rate
            fee_breakdown.append({"day": day, "rate": rate})

        port_change_penalty = self.rules['port_change_penalty'] if has_port_change else 0
        final_total = total_fee + port_change_penalty

        need_rerun = False
        if '复核' in remarks or '待确认' in remarks or '疑问' in remarks:
            need_rerun = True

        category = "NORMAL"
        if has_inspection:
            category = "INSPECTION"
        elif has_port_change:
            category = "PORT_CHANGE"
        elif any(self.is_holiday(arrival_date + timedelta(days=i)) for i in range(total_calendar_days)):
            category = "HOLIDAY_INCLUDED"

        if need_rerun:
            category = "RERUN"

        return {
            "bl_no": bl_no,
            "container_no": container_no,
            "container_type": container_type,
            "shipping_line": shipping_line,
            "arrival_date": arrival_date.strftime("%Y-%m-%d") if arrival_date else "",
            "release_date": release_date.strftime("%Y-%m-%d") if release_date else "",
            "free_days": free_days,
            "total_calendar_days": total_calendar_days,
            "total_work_days": total_work_days,
            "exempt_days": exempt_days,
            "detention_days": effective_days,
            "detention_fee": total_fee,
            "has_inspection": has_inspection,
            "inspection_date": inspection_date.strftime("%Y-%m-%d") if inspection_date else "",
            "has_port_change": has_port_change,
            "original_port": original_port,
            "new_port": new_port,
            "port_change_penalty": port_change_penalty,
            "total_amount": final_total,
            "category": category,
            "need_rerun": need_rerun,
            "remarks": remarks
        }

    def process_file(self, file_path: str) -> Tuple[List[Dict], str]:
        results = []
        file_path = Path(file_path)
        suffix = file_path.suffix.lower()

        if suffix == '.csv':
            df = pd.read_csv(file_path, encoding='utf-8-sig')
        elif suffix in ['.xlsx', '.xls']:
            df = pd.read_excel(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {suffix}")

        df.columns = df.columns.str.strip().str.replace(' ', '_').str.upper()

        for idx, row in df.iterrows():
            try:
                result = self.calculate_detention_fee(row.to_dict())
                result['source_file'] = file_path.name
                result['row_index'] = idx + 2
                results.append(result)
            except Exception as e:
                error_msg = f"文件 [{file_path.name}] 第 {idx + 2} 行处理失败: {str(e)}"
                self.errors.append(error_msg)
                continue

        return results, file_path.name

    def sort_results(self, results: List[Dict]) -> List[Dict]:
        sort_keys = self.config['output']['sort_by']
        return sorted(results, key=lambda x: tuple(x.get(k, '') for k in sort_keys))

    def separate_results(self, results: List[Dict]) -> Dict[str, List[Dict]]:
        separated = {
            "normal": [],
            "inspection": [],
            "holiday": [],
            "port_change": [],
            "rerun": []
        }

        for r in results:
            category = r['category']
            if r['need_rerun']:
                separated['rerun'].append(r)
            elif category == 'INSPECTION':
                separated['inspection'].append(r)
            elif category == 'PORT_CHANGE':
                separated['port_change'].append(r)
            elif category == 'HOLIDAY_INCLUDED':
                separated['holiday'].append(r)
            else:
                separated['normal'].append(r)

        return separated

    def write_results(self, separated: Dict[str, List[Dict]], output_dir: str = "output"):
        os.makedirs(output_dir, exist_ok=True)
        encoding = self.config['output']['encoding']

        file_mapping = {
            "normal": "正常结果.csv",
            "inspection": "查验记录.csv",
            "holiday": "节假日记录.csv",
            "port_change": "改港记录.csv",
            "rerun": "可复跑记录.csv"
        }

        fieldnames = [
            "source_file", "row_index", "bl_no", "container_no", "container_type",
            "shipping_line", "arrival_date", "release_date", "free_days",
            "total_calendar_days", "total_work_days", "exempt_days",
            "detention_days", "detention_fee", "has_inspection", "inspection_date",
            "has_port_change", "original_port", "new_port", "port_change_penalty",
            "total_amount", "category", "need_rerun", "remarks"
        ]

        for key, filename in file_mapping.items():
            data = separated.get(key, [])
            if not data:
                continue
            data = self.sort_results(data)
            filepath = os.path.join(output_dir, filename)
            with open(filepath, 'w', newline='', encoding=encoding) as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(data)

    def write_summary(self, separated: Dict[str, List[Dict]], output_dir: str = "output"):
        os.makedirs(output_dir, exist_ok=True)
        encoding = self.config['output']['encoding']

        summary = {
            "正常结果": len(separated.get('normal', [])),
            "查验记录": len(separated.get('inspection', [])),
            "节假日记录": len(separated.get('holiday', [])),
            "改港记录": len(separated.get('port_change', [])),
            "可复跑记录": len(separated.get('rerun', [])),
            "处理失败": len(self.errors)
        }

        filepath = os.path.join(output_dir, "处理汇总.txt")
        with open(filepath, 'w', encoding=encoding) as f:
            f.write("=" * 50 + "\n")
            f.write("口岸仓储代理滞箱费用复核 - 处理汇总\n")
            f.write("=" * 50 + "\n\n")
            f.write(f"处理时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write("统计信息:\n")
            f.write("-" * 50 + "\n")
            for name, count in summary.items():
                f.write(f"  {name}: {count} 条\n")
            f.write("-" * 50 + "\n\n")

            if self.errors:
                f.write("错误详情:\n")
                f.write("-" * 50 + "\n")
                for i, error in enumerate(self.errors, 1):
                    f.write(f"  [{i}] {error}\n")
                f.write("-" * 50 + "\n")


def main():
    parser = argparse.ArgumentParser(description="口岸仓储代理滞箱费用复核 CLI")
    parser.add_argument("inputs", nargs='+', help="输入文件或目录路径")
    parser.add_argument("-c", "--config", default="config.yaml", help="配置文件路径 (默认: config.yaml)")
    parser.add_argument("-o", "--output", default="output", help="输出目录 (默认: output)")
    parser.add_argument("-v", "--verbose", action="store_true", help="显示详细处理信息")

    args = parser.parse_args()

    if not os.path.exists(args.config):
        print(f"错误: 配置文件不存在: {args.config}")
        sys.exit(1)

    calculator = DetentionFeeCalculator(args.config)

    all_results = []
    input_files = []

    for input_path in args.inputs:
        path = Path(input_path)
        if path.is_file():
            if path.suffix.lower() in calculator.config['input']['supported_formats']:
                input_files.append(str(path))
        elif path.is_dir():
            for suffix in calculator.config['input']['supported_formats']:
                input_files.extend([str(f) for f in path.glob(f"*{suffix}")])

    if not input_files:
        print("错误: 未找到任何支持的输入文件")
        sys.exit(1)

    print(f"开始处理 {len(input_files)} 个文件...")

    for file_path in input_files:
        try:
            if args.verbose:
                print(f"  处理: {Path(file_path).name}")
            results, filename = calculator.process_file(file_path)
            all_results.extend(results)
            if args.verbose:
                print(f"    成功处理 {len(results)} 条记录")
        except Exception as e:
            error_msg = f"文件 [{Path(file_path).name}] 处理失败: {str(e)}"
            calculator.errors.append(error_msg)
            if args.verbose:
                print(f"    错误: {str(e)}")
            continue

    separated = calculator.separate_results(all_results)
    calculator.write_results(separated, args.output)
    calculator.write_summary(separated, args.output)

    print("\n处理完成!")
    print(f"  输出目录: {os.path.abspath(args.output)}")
    print(f"  正常结果: {len(separated['normal'])} 条")
    print(f"  查验记录: {len(separated['inspection'])} 条")
    print(f"  节假日记录: {len(separated['holiday'])} 条")
    print(f"  改港记录: {len(separated['port_change'])} 条")
    print(f"  可复跑记录: {len(separated['rerun'])} 条")
    print(f"  处理失败: {len(calculator.errors)} 条")

    if calculator.errors:
        print("\n错误汇总:")
        for i, error in enumerate(calculator.errors, 1):
            print(f"  [{i}] {error}")


if __name__ == "__main__":
    main()
