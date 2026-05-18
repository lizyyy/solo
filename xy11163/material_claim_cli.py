#!/usr/bin/env python3
"""
物业报修中心物业材料领用 CLI 工具
处理材料领用记录，解决反复修改同一条记录的问题
"""

import argparse
import csv
import json
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from collections import defaultdict


class MaterialClaimProcessor:
    def __init__(self, input_dir: str, rules_file: str, output_dir: str, preview: bool = False):
        self.input_dir = Path(input_dir)
        self.rules_file = Path(rules_file)
        self.output_dir = Path(output_dir)
        self.preview = preview
        self.rules = {}
        self.records: List[Dict] = []
        self.processed_records: Dict[str, Dict] = {}
        self.errors: List[Dict] = []
        self.warnings: List[Dict] = []
        self.stats = defaultdict(int)

    def load_rules(self) -> None:
        if not self.rules_file.exists():
            raise FileNotFoundError(f"规则文件不存在: {self.rules_file}")
        
        with open(self.rules_file, 'r', encoding='utf-8') as f:
            self.rules = json.load(f)
        
        print(f"✓ 加载规则文件: {self.rules_file}")

    def read_input_files(self) -> None:
        if not self.input_dir.exists():
            raise FileNotFoundError(f"输入目录不存在: {self.input_dir}")
        
        csv_files = list(self.input_dir.glob('*.csv'))
        if not csv_files:
            print(f"⚠ 输入目录中没有找到CSV文件: {self.input_dir}")
            return
        
        for csv_file in csv_files:
            self._read_single_file(csv_file)
        
        print(f"✓ 读取 {len(csv_files)} 个输入文件，共 {len(self.records)} 条记录")

    def _read_single_file(self, file_path: Path) -> None:
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row_num, row in enumerate(reader, start=2):
                    record = {
                        'source_file': file_path.name,
                        'row_number': row_num,
                        'raw_data': dict(row)
                    }
                    self.records.append(record)
        except Exception as e:
            self.errors.append({
                'file': file_path.name,
                'error': f"读取文件失败: {str(e)}"
            })

    def _generate_record_id(self, record: Dict) -> str:
        data = record['raw_data']
        id_fields = self.rules.get('id_fields', ['领用单号'])
        id_parts = []
        for field in id_fields:
            id_parts.append(str(data.get(field, '')).strip())
        return '|'.join(id_parts)

    def process_records(self) -> None:
        special_types = self.rules.get('special_types', {
            'return': '返库',
            'substitute': '替代料',
            'manual': '手写单',
            'retry': '可复跑'
        })

        for record in self.records:
            try:
                self._process_single_record(record, special_types)
            except Exception as e:
                self.errors.append({
                    'record': record.get('raw_data', {}),
                    'error': f"处理记录失败: {str(e)}"
                })

        print(f"✓ 处理完成: {len(self.processed_records)} 条唯一记录")
        print(f"  - 警告: {len(self.warnings)} 条")
        print(f"  - 错误: {len(self.errors)} 条")

    def _process_single_record(self, record: Dict, special_types: Dict) -> None:
        data = record['raw_data']
        record_id = self._generate_record_id(record)
        
        record_type = self._detect_record_type(data, special_types)
        
        if record_id in self.processed_records:
            existing = self.processed_records[record_id]
            existing['versions'].append({
                'data': data.copy(),
                'source': record['source_file'],
                'row': record['row_number'],
                'type': record_type,
                'timestamp': data.get('修改时间', data.get('领用时间', ''))
            })
            existing['version_count'] = len(existing['versions'])
            
            if self._is_newer_version(data, existing['final_data']):
                existing['final_data'] = data.copy()
                existing['final_source'] = record['source_file']
                existing['final_type'] = record_type
            
            self.warnings.append({
                'record_id': record_id,
                'message': f"发现重复记录，共 {existing['version_count']} 个版本",
                'type': record_type
            })
            self.stats['duplicate_records'] += 1
        else:
            self.processed_records[record_id] = {
                'record_id': record_id,
                'final_data': data.copy(),
                'final_source': record['source_file'],
                'final_type': record_type,
                'versions': [{
                    'data': data.copy(),
                    'source': record['source_file'],
                    'row': record['row_number'],
                    'type': record_type,
                    'timestamp': data.get('修改时间', data.get('领用时间', ''))
                }],
                'version_count': 1
            }
            self.stats['unique_records'] += 1
        
        if record_type != 'normal':
            self.stats[f'{record_type}_records'] += 1

    def _detect_record_type(self, data: Dict, special_types: Dict) -> str:
        remark = str(data.get('备注', '') + data.get('说明', '')).strip()
        
        if special_types['return'] in remark:
            return 'return'
        if special_types['substitute'] in remark:
            return 'substitute'
        if special_types['manual'] in remark:
            return 'manual'
        if special_types['retry'] in remark:
            return 'retry'
        return 'normal'

    def _is_newer_version(self, new_data: Dict, old_data: Dict) -> bool:
        new_time = new_data.get('修改时间', new_data.get('领用时间', ''))
        old_time = old_data.get('修改时间', old_data.get('领用时间', ''))
        
        if new_time and old_time:
            try:
                new_dt = datetime.fromisoformat(str(new_time).replace('/', '-'))
                old_dt = datetime.fromisoformat(str(old_time).replace('/', '-'))
                return new_dt > old_dt
            except:
                pass
        
        new_qty = abs(float(str(new_data.get('数量', 0)) or 0))
        old_qty = abs(float(str(old_data.get('数量', 0)) or 0))
        return new_qty > 0 and old_qty == 0

    def write_output(self) -> None:
        if self.preview:
            print("\n=== 预览模式: 不会实际写入文件 ===")
            self._print_preview()
            return

        if not self.output_dir.exists():
            self.output_dir.mkdir(parents=True)
        else:
            shutil.rmtree(self.output_dir)
            self.output_dir.mkdir(parents=True)

        self._write_final_records()
        self._write_version_history()
        self._write_special_records()
        self._write_errors_warnings()
        self._write_summary_report()

        print(f"\n✓ 输出文件已写入: {self.output_dir}")

    def _write_final_records(self) -> None:
        if not self.processed_records:
            return
        
        output_file = self.output_dir / 'final_material_claims.csv'
        records = list(self.processed_records.values())
        
        if records:
            fieldnames = ['记录ID', '最终来源', '记录类型', '版本数'] + list(records[0]['final_data'].keys())
            
            with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(fieldnames)
                
                for rec in records:
                    row = [
                        rec['record_id'],
                        rec['final_source'],
                        rec['final_type'],
                        rec['version_count']
                    ] + list(rec['final_data'].values())
                    writer.writerow(row)
        
        print(f"  - final_material_claims.csv: {len(records)} 条最终记录")

    def _write_version_history(self) -> None:
        output_file = self.output_dir / 'version_history.csv'
        
        with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['记录ID', '版本号', '来源文件', '行号', '记录类型', '时间戳', '领用材料', '数量'])
            
            for rec_id, rec in self.processed_records.items():
                for idx, version in enumerate(rec['versions'], start=1):
                    writer.writerow([
                        rec_id,
                        idx,
                        version['source'],
                        version['row'],
                        version['type'],
                        version['timestamp'],
                        version['data'].get('材料名称', ''),
                        version['data'].get('数量', '')
                    ])
        
        print(f"  - version_history.csv: 所有版本历史记录")

    def _write_special_records(self) -> None:
        for record_type in ['return', 'substitute', 'manual', 'retry']:
            type_records = [
                rec for rec in self.processed_records.values()
                if rec['final_type'] == record_type
            ]
            
            if type_records:
                output_file = self.output_dir / f'{record_type}_records.csv'
                with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
                    writer = csv.writer(f)
                    if type_records:
                        fieldnames = ['记录ID', '来源', '版本数'] + list(type_records[0]['final_data'].keys())
                        writer.writerow(fieldnames)
                        for rec in type_records:
                            row = [rec['record_id'], rec['final_source'], rec['version_count']] + list(rec['final_data'].values())
                            writer.writerow(row)
                
                print(f"  - {record_type}_records.csv: {len(type_records)} 条")

    def _write_errors_warnings(self) -> None:
        if self.errors or self.warnings:
            output_file = self.output_dir / 'issues_report.csv'
            
            with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['类型', '记录ID', '来源文件', '消息'])
                
                for warn in self.warnings:
                    writer.writerow([
                        '警告',
                        warn.get('record_id', ''),
                        '',
                        warn.get('message', '')
                    ])
                
                for err in self.errors:
                    writer.writerow([
                        '错误',
                        '',
                        err.get('file', ''),
                        err.get('error', '')
                    ])
            
            print(f"  - issues_report.csv: {len(self.errors)+len(self.warnings)} 个问题")

    def _write_summary_report(self) -> None:
        output_file = self.output_dir / 'summary_report.json'
        
        summary = {
            'processing_time': datetime.now().isoformat(),
            'input_directory': str(self.input_dir),
            'output_directory': str(self.output_dir),
            'total_records': len(self.records),
            'unique_records': len(self.processed_records),
            'statistics': dict(self.stats),
            'warnings_count': len(self.warnings),
            'errors_count': len(self.errors),
            'output_files': {
                'final_material_claims.csv': '去重合并后的最终材料领用记录（主文件）',
                'version_history.csv': '所有记录的版本历史，追踪每次修改',
                'return_records.csv': '标记为"返库"的特殊记录',
                'substitute_records.csv': '标记为"替代料"的特殊记录',
                'manual_records.csv': '标记为"手写单"的特殊记录',
                'retry_records.csv': '标记为"可复跑"的特殊记录',
                'issues_report.csv': '处理过程中的警告和错误信息',
                'summary_report.json': '本次处理的汇总报告和统计数据'
            }
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        
        print(f"  - summary_report.json: 汇总统计报告")

    def _print_preview(self) -> None:
        print(f"\n统计信息:")
        print(f"  - 总记录数: {len(self.records)}")
        print(f"  - 唯一记录数: {len(self.processed_records)}")
        print(f"  - 重复记录: {self.stats.get('duplicate_records', 0)}")
        print(f"  - 返库记录: {self.stats.get('return_records', 0)}")
        print(f"  - 替代料记录: {self.stats.get('substitute_records', 0)}")
        print(f"  - 手写单记录: {self.stats.get('manual_records', 0)}")
        print(f"  - 可复跑记录: {self.stats.get('retry_records', 0)}")
        
        if self.warnings:
            print(f"\n前5条警告:")
            for warn in self.warnings[:5]:
                print(f"  - {warn['message']}")

    def run(self) -> None:
        self.load_rules()
        self.read_input_files()
        self.process_records()
        self.write_output()


def main():
    parser = argparse.ArgumentParser(
        description='物业报修中心物业材料领用 CLI 工具 - 处理反复修改的领用记录',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例命令:
  python material_claim_cli.py --preview --input sample_input --rules rules/default_rules.json
  python material_claim_cli.py --input sample_input --rules rules/default_rules.json --output sample_output
  python material_claim_cli.py --report sample_output/summary_report.json
        """
    )
    
    parser.add_argument('--input', '-i', help='输入目录路径，包含CSV格式的材料领用记录')
    parser.add_argument('--rules', '-r', help='规则文件路径 (JSON格式)')
    parser.add_argument('--output', '-o', help='输出目录路径')
    parser.add_argument('--preview', '-p', action='store_true', help='预览模式，不实际写入文件')
    parser.add_argument('--report', help='查看指定的汇总报告文件')
    
    args = parser.parse_args()
    
    if args.report:
        with open(args.report, 'r', encoding='utf-8') as f:
            report = json.load(f)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return
    
    if not args.input or not args.rules:
        parser.print_help()
        return
    
    try:
        processor = MaterialClaimProcessor(
            input_dir=args.input,
            rules_file=args.rules,
            output_dir=args.output or 'output',
            preview=args.preview
        )
        processor.run()
    except Exception as e:
        print(f"✗ 处理失败: {str(e)}")
        exit(1)


if __name__ == '__main__':
    main()
