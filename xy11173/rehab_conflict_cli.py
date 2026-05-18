#!/usr/bin/env python3
import os
import sys
import csv
import yaml
import shutil
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Tuple, Any
import argparse


class ConfigLoader:
    DEFAULT_CONFIG = {
        "cli": {
            "name": "运动康复门店康复器械冲突分析工具",
            "version": "1.0.0"
        },
        "rules": {
            "abnormal_keywords": [
                "保养封锁", "器械故障", "设备维修", "患者迟到",
                "预约冲突", "器械占用", "无法使用", "维修中",
                "暂停使用", "超时使用"
            ],
            "normal_keywords": [
                "正常使用", "已完成", "顺利完成", "康复训练",
                "治疗完成", "患者到场", "器械可用"
            ],
            "maintenance_lockout": {
                "keywords": ["保养封锁", "维修中", "暂停使用", "设备维修"],
                "priority": "high",
                "suggestion": "立即安排工程师进行器械检修，确认保养完成后解除封锁状态，更新预约系统避免患者空跑"
            },
            "patient_late": {
                "keywords": ["患者迟到", "未按时到达", "迟到", "晚到"],
                "threshold_minutes": 15,
                "priority": "medium",
                "suggestion": "联系患者确认是否仍需到店，调整后续预约时间，必要时安排候补患者使用器械"
            },
            "rerun_available": {
                "keywords": ["可复跑", "重新安排", "改期", "重新预约"],
                "priority": "low",
                "suggestion": "主动联系患者提供可选时间段，优先安排近期空闲时段，赠送康复咨询服务作为补偿"
            }
        },
        "output": {
            "normal_dir": "output/normal",
            "abnormal_dir": "output/abnormal",
            "summary_file": "output/abnormal_summary.md",
            "error_log": "output/error_log.txt"
        },
        "file": {
            "supported_formats": [".csv", ".xlsx", ".xls", ".txt"],
            "encoding": "utf-8",
            "delimiter": ","
        }
    }

    @classmethod
    def load(cls, config_path: str = None) -> Dict:
        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    user_config = yaml.safe_load(f)
                return cls._merge_config(cls.DEFAULT_CONFIG, user_config)
            except Exception as e:
                print(f"警告: 配置文件加载失败，使用默认配置: {e}")
        return cls.DEFAULT_CONFIG.copy()

    @classmethod
    def _merge_config(cls, default: Dict, user: Dict) -> Dict:
        result = default.copy()
        for key, value in user.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = cls._merge_config(result[key], value)
            else:
                result[key] = value
        return result


class RecordClassifier:
    def __init__(self, config: Dict):
        self.config = config
        self.abnormal_keywords = config['rules']['abnormal_keywords']
        self.normal_keywords = config['rules']['normal_keywords']

    def classify(self, row: Dict[str, str]) -> Tuple[str, List[str]]:
        row_text = ' '.join(str(v) for v in row.values())

        matched_abnormal = []
        for keyword in self.abnormal_keywords:
            if keyword in row_text:
                matched_abnormal.append(keyword)

        if matched_abnormal:
            return 'abnormal', matched_abnormal

        for keyword in self.normal_keywords:
            if keyword in row_text:
                return 'normal', []

        return 'normal', []

    def get_abnormal_category(self, row: Dict[str, str], matched_keywords: List[str]) -> List[Dict]:
        categories = []
        row_text = ' '.join(str(v) for v in row.values())

        maintenance_config = self.config['rules']['maintenance_lockout']
        for kw in maintenance_config['keywords']:
            if kw in row_text:
                categories.append({
                    'type': '保养封锁',
                    'priority': maintenance_config['priority'],
                    'suggestion': maintenance_config['suggestion'],
                    'matched_keyword': kw
                })
                break

        patient_late_config = self.config['rules']['patient_late']
        for kw in patient_late_config['keywords']:
            if kw in row_text:
                categories.append({
                    'type': '患者迟到',
                    'priority': patient_late_config['priority'],
                    'suggestion': patient_late_config['suggestion'],
                    'matched_keyword': kw
                })
                break

        rerun_config = self.config['rules']['rerun_available']
        for kw in rerun_config['keywords']:
            if kw in row_text:
                categories.append({
                    'type': '可复跑输出',
                    'priority': rerun_config['priority'],
                    'suggestion': rerun_config['suggestion'],
                    'matched_keyword': kw
                })
                break

        if not categories:
            categories.append({
                'type': '其他异常',
                'priority': 'medium',
                'suggestion': '核查具体异常原因，根据实际情况处理',
                'matched_keyword': matched_keywords[0] if matched_keywords else '未知'
            })

        return categories


class FileParser:
    def __init__(self, config: Dict):
        self.config = config
        self.supported_formats = config['file']['supported_formats']
        self.encoding = config['file']['encoding']
        self.delimiter = config['file']['delimiter']

    def parse_csv(self, file_path: str) -> Tuple[List[Dict], List[str]]:
        rows = []
        headers = []
        expected_fields = ['记录ID', '日期', '门店名称', '器械名称', '患者姓名']
        with open(file_path, 'r', encoding=self.encoding) as f:
            reader = csv.reader(f, delimiter=self.delimiter)
            try:
                headers = next(reader)
            except StopIteration:
                raise ValueError("CSV文件为空")
            if len(headers) < 3 or not any(h in headers for h in expected_fields):
                raise ValueError("不是有效的运动康复门店数据文件格式")
            for row in reader:
                if any(cell.strip() for cell in row):
                    row_dict = {}
                    for i, header in enumerate(headers):
                        row_dict[header] = row[i] if i < len(row) else ''
                    rows.append(row_dict)
        if not rows:
            raise ValueError("CSV文件没有数据行")
        return rows, headers

    def parse(self, file_path: str) -> Tuple[List[Dict], List[str]]:
        ext = Path(file_path).suffix.lower()
        if ext == '.csv':
            return self.parse_csv(file_path)
        elif ext in ['.txt']:
            return self.parse_csv(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")


class SummaryGenerator:
    def __init__(self, config: Dict):
        self.config = config

    def generate(self, abnormal_records: List[Dict]) -> str:
        maintenance_records = []
        patient_late_records = []
        rerun_records = []
        other_records = []

        for record in abnormal_records:
            primary_category = record['categories'][0] if record['categories'] else None
            if not primary_category:
                continue

            has_rerun = any(c['type'] == '可复跑输出' for c in record['categories'])

            if primary_category['type'] == '保养封锁':
                maintenance_records.append(record)
            elif primary_category['type'] == '患者迟到':
                patient_late_records.append(record)
            else:
                if has_rerun:
                    rerun_records.append(record)
                else:
                    other_records.append(record)

            if has_rerun and primary_category['type'] != '可复跑输出':
                if record not in rerun_records:
                    rerun_records.append(record)

        all_unique = set()
        for r in maintenance_records: all_unique.add(id(r))
        for r in patient_late_records: all_unique.add(id(r))
        for r in rerun_records: all_unique.add(id(r))
        for r in other_records: all_unique.add(id(r))

        md_content = f"# 运动康复门店康复器械冲突异常摘要\n\n"
        md_content += f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        md_content += f"## 统计概览\n\n"
        md_content += f"- 保养封锁: {len(maintenance_records)} 条\n"
        md_content += f"- 患者迟到: {len(patient_late_records)} 条\n"
        md_content += f"- 可复跑输出: {len(rerun_records)} 条\n"
        md_content += f"- 其他异常: {len(other_records)} 条\n"
        md_content += f"- **总计异常记录: {len(abnormal_records)} 条**\n\n"
        md_content += f"> 注: 部分记录可能同时属于多个分类（如同时有患者迟到和可复跑标识）\n\n"

        if maintenance_records:
            md_content += "## 一、保养封锁\n\n"
            md_content += "### 修复建议\n"
            md_content += f"> {self.config['rules']['maintenance_lockout']['suggestion']}\n\n"
            md_content += "### 异常记录\n\n"
            md_content += "| 记录ID | 日期 | 门店 | 器械 | 患者 | 备注 |\n"
            md_content += "|--------|------|------|------|------|------|\n"
            for r in maintenance_records[:10]:
                md_content += f"| {r['data'].get('记录ID', '-')} | {r['data'].get('日期', '-')} | {r['data'].get('门店名称', '-')} | {r['data'].get('器械名称', '-')} | {r['data'].get('患者姓名', '-')} | {r['data'].get('备注', '-')} |\n"
            if len(maintenance_records) > 10:
                md_content += f"| ... 共 {len(maintenance_records)} 条记录 |\n"
            md_content += "\n"

        if patient_late_records:
            md_content += "## 二、患者迟到\n\n"
            md_content += "### 修复建议\n"
            md_content += f"> {self.config['rules']['patient_late']['suggestion']}\n\n"
            md_content += "### 异常记录\n\n"
            md_content += "| 记录ID | 日期 | 门店 | 器械 | 患者 | 预约时间 | 实际使用时间 | 备注 |\n"
            md_content += "|--------|------|------|------|------|----------|--------------|------|\n"
            for r in patient_late_records[:10]:
                md_content += f"| {r['data'].get('记录ID', '-')} | {r['data'].get('日期', '-')} | {r['data'].get('门店名称', '-')} | {r['data'].get('器械名称', '-')} | {r['data'].get('患者姓名', '-')} | {r['data'].get('预约时间', '-')} | {r['data'].get('实际使用时间', '-')} | {r['data'].get('备注', '-')} |\n"
            if len(patient_late_records) > 10:
                md_content += f"| ... 共 {len(patient_late_records)} 条记录 |\n"
            md_content += "\n"

        if rerun_records:
            md_content += "## 三、可复跑输出\n\n"
            md_content += "### 修复建议\n"
            md_content += f"> {self.config['rules']['rerun_available']['suggestion']}\n\n"
            md_content += "### 异常记录\n\n"
            md_content += "| 记录ID | 日期 | 门店 | 器械 | 患者 | 备注 |\n"
            md_content += "|--------|------|------|------|------|------|\n"
            for r in rerun_records[:10]:
                md_content += f"| {r['data'].get('记录ID', '-')} | {r['data'].get('日期', '-')} | {r['data'].get('门店名称', '-')} | {r['data'].get('器械名称', '-')} | {r['data'].get('患者姓名', '-')} | {r['data'].get('备注', '-')} |\n"
            if len(rerun_records) > 10:
                md_content += f"| ... 共 {len(rerun_records)} 条记录 |\n"
            md_content += "\n"

        if other_records:
            md_content += "## 四、其他异常\n\n"
            md_content += "### 异常记录\n\n"
            md_content += "| 记录ID | 日期 | 门店 | 器械 | 患者 | 状态 | 备注 |\n"
            md_content += "|--------|------|------|------|------|------|------|\n"
            for r in other_records[:10]:
                md_content += f"| {r['data'].get('记录ID', '-')} | {r['data'].get('日期', '-')} | {r['data'].get('门店名称', '-')} | {r['data'].get('器械名称', '-')} | {r['data'].get('患者姓名', '-')} | {r['data'].get('状态', '-')} | {r['data'].get('备注', '-')} |\n"
            if len(other_records) > 10:
                md_content += f"| ... 共 {len(other_records)} 条记录 |\n"
            md_content += "\n"

        return md_content


class RehabConflictCLI:
    def __init__(self, config_path: str = None):
        self.config = ConfigLoader.load(config_path)
        self.classifier = RecordClassifier(self.config)
        self.parser = FileParser(self.config)
        self.summary_generator = SummaryGenerator(self.config)
        self.error_log = []

    def _ensure_dirs(self):
        normal_dir = self.config['output']['normal_dir']
        abnormal_dir = self.config['output']['abnormal_dir']
        os.makedirs(normal_dir, exist_ok=True)
        os.makedirs(abnormal_dir, exist_ok=True)
        os.makedirs(os.path.dirname(self.config['output']['summary_file']), exist_ok=True)

    def _write_csv(self, file_path: str, headers: List[str], rows: List[Dict]):
        with open(file_path, 'w', encoding=self.config['file']['encoding'], newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(rows)

    def process_file(self, file_path: str) -> Dict[str, Any]:
        file_name = os.path.basename(file_path)
        result = {
            'file': file_name,
            'success': False,
            'normal_count': 0,
            'abnormal_count': 0,
            'abnormal_records': [],
            'error': None
        }

        try:
            rows, headers = self.parser.parse(file_path)
            if not rows:
                raise ValueError("文件内容为空或格式不正确")

            normal_rows = []
            abnormal_rows = []
            abnormal_records_detail = []

            for row in rows:
                classification, matched_keywords = self.classifier.classify(row)
                if classification == 'abnormal':
                    abnormal_rows.append(row)
                    categories = self.classifier.get_abnormal_category(row, matched_keywords)
                    abnormal_records_detail.append({
                        'data': row,
                        'matched_keywords': matched_keywords,
                        'categories': categories,
                        'source_file': file_name
                    })
                else:
                    normal_rows.append(row)

            self._ensure_dirs()

            if normal_rows:
                normal_path = os.path.join(self.config['output']['normal_dir'], f"normal_{file_name}")
                self._write_csv(normal_path, headers, normal_rows)
                result['normal_count'] = len(normal_rows)

            if abnormal_rows:
                abnormal_path = os.path.join(self.config['output']['abnormal_dir'], f"abnormal_{file_name}")
                self._write_csv(abnormal_path, headers, abnormal_rows)
                result['abnormal_count'] = len(abnormal_rows)
                result['abnormal_records'] = abnormal_records_detail

            result['success'] = True
            print(f"✓ {file_name}: 正常记录 {len(normal_rows)} 条, 异常记录 {len(abnormal_rows)} 条")

        except Exception as e:
            error_msg = f"{file_name}: {str(e)}"
            result['error'] = error_msg
            self.error_log.append(error_msg)
            print(f"✗ {file_name}: 处理失败 - {str(e)}")

        return result

    def process_directory(self, dir_path: str) -> Dict[str, Any]:
        all_results = []
        all_abnormal_records = []
        total_normal = 0
        total_abnormal = 0

        supported_ext = tuple(self.config['file']['supported_formats'])
        files = [f for f in os.listdir(dir_path) if f.lower().endswith(supported_ext)]

        print(f"\n发现 {len(files)} 个待处理文件...\n")

        for file_name in files:
            file_path = os.path.join(dir_path, file_name)
            result = self.process_file(file_path)
            all_results.append(result)
            total_normal += result['normal_count']
            total_abnormal += result['abnormal_count']
            all_abnormal_records.extend(result['abnormal_records'])

        summary_content = self.summary_generator.generate(all_abnormal_records)
        summary_file = self.config['output']['summary_file']
        with open(summary_file, 'w', encoding='utf-8') as f:
            f.write(summary_content)
        print(f"\n异常摘要已生成: {summary_file}")

        if self.error_log:
            error_log_file = self.config['output']['error_log']
            with open(error_log_file, 'w', encoding='utf-8') as f:
                f.write(f"错误汇总 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
                for i, error in enumerate(self.error_log, 1):
                    f.write(f"{i}. {error}\n")
            print(f"错误日志已生成: {error_log_file}")

        print(f"\n{'='*50}")
        print(f"处理完成汇总:")
        print(f"  总文件数: {len(all_results)}")
        print(f"  成功处理: {sum(1 for r in all_results if r['success'])}")
        print(f"  处理失败: {len(self.error_log)}")
        print(f"  正常记录总计: {total_normal}")
        print(f"  异常记录总计: {total_abnormal}")
        print(f"{'='*50}")

        return {
            'results': all_results,
            'total_normal': total_normal,
            'total_abnormal': total_abnormal,
            'errors': self.error_log
        }


def main():
    parser = argparse.ArgumentParser(description='运动康复门店康复器械冲突分析工具')
    parser.add_argument('input_path', help='输入文件或目录路径')
    parser.add_argument('--config', help='配置文件路径', default='config/default.yaml')
    parser.add_argument('--sample', action='store_true', help='使用样例数据进行测试')

    args = parser.parse_args()

    print(f"\n{'='*60}")
    print("        运动康复门店康复器械冲突分析工具 v1.0.0")
    print(f"{'='*60}\n")

    input_path = args.input_path
    if args.sample:
        input_path = 'sample_data'

    if not os.path.exists(input_path):
        print(f"错误: 路径不存在 - {input_path}")
        sys.exit(1)

    cli = RehabConflictCLI(args.config)

    if os.path.isdir(input_path):
        cli.process_directory(input_path)
    else:
        result = cli.process_file(input_path)
        if result['abnormal_records']:
            cli._ensure_dirs()
            summary = cli.summary_generator.generate(result['abnormal_records'])
            with open(cli.config['output']['summary_file'], 'w', encoding='utf-8') as f:
                f.write(summary)
            print(f"\n异常摘要已生成: {cli.config['output']['summary_file']}")

        if cli.error_log:
            cli._ensure_dirs()
            with open(cli.config['output']['error_log'], 'w', encoding='utf-8') as f:
                f.write(f"错误汇总 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
                for i, error in enumerate(cli.error_log, 1):
                    f.write(f"{i}. {error}\n")


if __name__ == '__main__':
    main()
