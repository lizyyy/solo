#!/usr/bin/env python3
import argparse
import csv
import json
import hashlib
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional


def load_rules(rules_file: Path) -> Dict[str, Any]:
    with open(rules_file, 'r', encoding='utf-8') as f:
        if rules_file.suffix == '.json':
            return json.load(f)
        elif rules_file.suffix in ['.yaml', '.yml']:
            try:
                import yaml
                return yaml.safe_load(f)
            except ImportError:
                print("警告: PyYAML 未安装，使用 JSON 格式规则文件", file=sys.stderr)
                return {}
    return {}


def read_input_files(input_dir: Path) -> List[Dict[str, Any]]:
    records = []
    for file_path in input_dir.glob('*.csv'):
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                row['_source_file'] = file_path.name
                records.append(row)
    return records


def generate_record_hash(record: Dict[str, Any], key_fields: List[str]) -> str:
    key_values = [str(record.get(field, '')) for field in key_fields]
    key_string = '|'.join(key_values)
    return hashlib.md5(key_string.encode('utf-8')).hexdigest()


def process_records(records: List[Dict[str, Any]], rules: Dict[str, Any]) -> Dict[str, Any]:
    key_fields = rules.get('key_fields', ['票根编号', '影院名称', '观影日期'])
    refund_keywords = rules.get('refund_keywords', ['退票', '退款', '取消'])
    group_keywords = rules.get('group_keywords', ['团体', '团购', '包场'])
    group_min_count = rules.get('group_min_count', 10)
    
    hash_index = {}
    valid_records = []
    duplicates = []
    refunds = []
    group_tickets = []
    errors = []
    
    for record in records:
        try:
            record_hash = generate_record_hash(record, key_fields)
            
            ticket_type = record.get('票类', '')
            status = record.get('状态', '')
            quantity = int(record.get('数量', '1'))
            ticket_no = record.get('票根编号', '')
            
            is_refund = any(kw in ticket_type or kw in status for kw in refund_keywords)
            is_group = any(kw in ticket_type for kw in group_keywords) or quantity >= group_min_count
            
            if is_refund:
                record['_category'] = '退票'
                refunds.append(record)
                continue
            
            if is_group:
                record['_category'] = '团体票'
                group_tickets.append(record)
                continue
            
            if record_hash in hash_index:
                record['_category'] = '重复上传'
                record['_duplicate_of'] = hash_index[record_hash]['_source_file']
                duplicates.append(record)
                continue
            
            hash_index[record_hash] = record
            record['_category'] = '正常'
            record['_hash'] = record_hash
            valid_records.append(record)
            
        except Exception as e:
            record['_error'] = str(e)
            errors.append(record)
    
    return {
        'valid': valid_records,
        'duplicates': duplicates,
        'refunds': refunds,
        'group_tickets': group_tickets,
        'errors': errors,
        'total_input': len(records)
    }


def write_csv(file_path: Path, records: List[Dict[str, Any]], fieldnames: Optional[List[str]] = None):
    if not records:
        return
    
    if fieldnames is None:
        all_keys = set()
        for record in records:
            all_keys.update(record.keys())
        fieldnames = sorted(all_keys)
    
    with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)


def write_json(file_path: Path, data: Any):
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def write_markdown_report(file_path: Path, results: Dict[str, Any], run_id: str):
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(f"# 影院票根补积分处理报告\n\n")
        f.write(f"**运行ID**: {run_id}\n\n")
        f.write(f"**处理时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        f.write("## 统计摘要\n\n")
        f.write(f"- 总输入记录: {results['total_input']}\n")
        f.write(f"- 正常积分记录: {len(results['valid'])}\n")
        f.write(f"- 退票记录: {len(results['refunds'])}\n")
        f.write(f"- 团体票记录: {len(results['group_tickets'])}\n")
        f.write(f"- 重复上传记录: {len(results['duplicates'])}\n")
        f.write(f"- 错误记录: {len(results['errors'])}\n\n")
        
        f.write("## 1. 正常积分记录\n\n")
        for r in results['valid'][:5]:
            f.write(f"- {r.get('票根编号')} | {r.get('影院名称')} | {r.get('观影日期')} | {r.get('会员手机号')} | +{r.get('积分')}分\n")
        if len(results['valid']) > 5:
            f.write(f"... 还有 {len(results['valid']) - 5} 条记录\n")
        f.write("\n")
        
        f.write("## 2. 退票记录\n\n")
        for r in results['refunds'][:3]:
            f.write(f"- {r.get('票根编号')} | {r.get('影院名称')} | 原因: {r.get('状态')}\n")
        if len(results['refunds']) > 3:
            f.write(f"... 还有 {len(results['refunds']) - 3} 条记录\n")
        f.write("\n")
        
        f.write("## 3. 团体票记录\n\n")
        for r in results['group_tickets'][:3]:
            f.write(f"- {r.get('票根编号')} | {r.get('影院名称')} | {r.get('票类')} | 数量: {r.get('数量')}\n")
        if len(results['group_tickets']) > 3:
            f.write(f"... 还有 {len(results['group_tickets']) - 3} 条记录\n")
        f.write("\n")
        
        f.write("## 4. 重复上传记录\n\n")
        for r in results['duplicates'][:3]:
            f.write(f"- {r.get('票根编号')} | 来源: {r.get('_source_file')} | 重复自: {r.get('_duplicate_of')}\n")
        if len(results['duplicates']) > 3:
            f.write(f"... 还有 {len(results['duplicates']) - 3} 条记录\n")
        f.write("\n")


def compare_runs(current_results: Dict[str, Any], previous_results: Dict[str, Any]) -> Dict[str, Any]:
    def get_record_set(records: List[Dict[str, Any]]) -> set:
        return set(r.get('_hash') or generate_record_hash(r, ['票根编号', '影院名称', '观影日期']) for r in records)
    
    current_valid = get_record_set(current_results['valid'])
    previous_valid = get_record_set(previous_results.get('valid', []))
    
    return {
        'added': len(current_valid - previous_valid),
        'removed': len(previous_valid - current_valid),
        'unchanged': len(current_valid & previous_valid),
        'diff_hashes': list(current_valid.symmetric_difference(previous_valid))
    }


def main():
    parser = argparse.ArgumentParser(description='影院会员部影院票根补积分 CLI')
    parser.add_argument('--input', '-i', required=True, help='输入目录路径')
    parser.add_argument('--rules', '-r', required=True, help='规则文件路径')
    parser.add_argument('--output', '-o', required=True, help='输出目录路径')
    parser.add_argument('--format', '-f', default='csv', choices=['csv', 'json', 'md'], help='输出格式')
    parser.add_argument('--compare', '-c', help='对比之前的运行结果目录')
    parser.add_argument('--run-id', help='手动指定运行ID（用于复跑对比）')
    
    args = parser.parse_args()
    
    input_dir = Path(args.input)
    rules_file = Path(args.rules)
    output_dir = Path(args.output)
    
    if not input_dir.exists():
        print(f"错误: 输入目录不存在: {input_dir}", file=sys.stderr)
        sys.exit(1)
    
    if not rules_file.exists():
        print(f"错误: 规则文件不存在: {rules_file}", file=sys.stderr)
        sys.exit(1)
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    run_id = args.run_id or datetime.now().strftime('%Y%m%d_%H%M%S')
    
    rules = load_rules(rules_file)
    records = read_input_files(input_dir)
    results = process_records(records, rules)
    
    base_fieldnames = ['_category', '票根编号', '影院名称', '观影日期', '场次时间', 
                       '影厅', '座位号', '影片名称', '会员手机号', '会员姓名', 
                       '票类', '数量', '单价', '实付金额', '积分', '状态', 
                       '售票员', '_source_file', '_hash', '_duplicate_of', '_error']
    
    if args.format == 'json':
        write_json(output_dir / f'{run_id}_results.json', results)
        write_json(output_dir / f'{run_id}_valid.json', results['valid'])
    elif args.format == 'md':
        write_markdown_report(output_dir / f'{run_id}_report.md', results, run_id)
        write_csv(output_dir / f'{run_id}_valid.csv', results['valid'], base_fieldnames)
    else:
        write_csv(output_dir / f'{run_id}_valid.csv', results['valid'], base_fieldnames)
        write_csv(output_dir / f'{run_id}_refunds.csv', results['refunds'], base_fieldnames)
        write_csv(output_dir / f'{run_id}_group_tickets.csv', results['group_tickets'], base_fieldnames)
        write_csv(output_dir / f'{run_id}_duplicates.csv', results['duplicates'], base_fieldnames)
        write_csv(output_dir / f'{run_id}_errors.csv', results['errors'], base_fieldnames)
    
    summary = {
        'run_id': run_id,
        'timestamp': datetime.now().isoformat(),
        'input_dir': str(input_dir),
        'rules_file': str(rules_file),
        'statistics': {
            'total_input': results['total_input'],
            'valid': len(results['valid']),
            'refunds': len(results['refunds']),
            'group_tickets': len(results['group_tickets']),
            'duplicates': len(results['duplicates']),
            'errors': len(results['errors'])
        }
    }
    write_json(output_dir / f'{run_id}_summary.json', summary)
    
    if args.compare:
        compare_dir = Path(args.compare)
        prev_summary = None
        for f in compare_dir.glob('*_summary.json'):
            with open(f, 'r', encoding='utf-8') as fp:
                prev_summary = json.load(fp)
                break
        
        if prev_summary:
            prev_results = {}
            for f in compare_dir.glob('*_results.json'):
                with open(f, 'r', encoding='utf-8') as fp:
                    prev_results = json.load(fp)
                    break
            
            if prev_results:
                diff = compare_runs(results, prev_results)
                summary['comparison'] = {
                    'previous_run_id': prev_summary['run_id'],
                    'added_records': diff['added'],
                    'removed_records': diff['removed'],
                    'unchanged_records': diff['unchanged']
                }
                write_json(output_dir / f'{run_id}_comparison.json', summary['comparison'])
                
                print(f"\n=== 对比结果 ===")
                print(f"新增记录: {diff['added']}")
                print(f"减少记录: {diff['removed']}")
                print(f"不变记录: {diff['unchanged']}")
    
    print(f"\n=== 处理完成 ===")
    print(f"运行ID: {run_id}")
    print(f"总输入: {results['total_input']} 条")
    print(f"正常积分: {len(results['valid'])} 条")
    print(f"退票: {len(results['refunds'])} 条")
    print(f"团体票: {len(results['group_tickets'])} 条")
    print(f"重复上传: {len(results['duplicates'])} 条")
    print(f"错误: {len(results['errors'])} 条")
    print(f"\n结果已输出到: {output_dir}")


if __name__ == '__main__':
    main()
