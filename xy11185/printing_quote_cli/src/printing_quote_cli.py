#!/usr/bin/env python3
import csv
import sys
import os
from pathlib import Path
from typing import List, Dict, Tuple

REQUIRED_COLUMNS = ['订单号', '起印量', '覆膜加价', '可复跑']
CRITICAL_COLUMNS = ['起印量', '覆膜加价', '可复跑']


class PrintingQuoteError(Exception):
    pass


class EmptyFileError(PrintingQuoteError):
    pass


class MissingColumnError(PrintingQuoteError):
    pass


class DuplicateRowError(PrintingQuoteError):
    pass


class InvalidValueError(PrintingQuoteError):
    pass


def read_csv_file(file_path: Path) -> Tuple[List[str], List[Dict]]:
    if file_path.stat().st_size == 0:
        raise EmptyFileError(f"文件是空的，没有任何内容")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = [line.strip() for line in f if line.strip()]
    
    if not lines:
        raise EmptyFileError(f"文件只有空行，没有有效内容")
    
    if len(lines) == 1:
        headers = lines[0].split(',')
        return headers, []
    
    reader = csv.DictReader(lines)
    headers = reader.fieldnames if reader.fieldnames else []
    rows = list(reader)
    
    return headers, rows


def validate_columns(headers: List[str]) -> None:
    missing = [col for col in REQUIRED_COLUMNS if col not in headers]
    if missing:
        raise MissingColumnError(f"缺少必填列: {', '.join(missing)}")


def validate_numeric_value(value: str, field_name: str) -> float:
    try:
        return float(value)
    except (ValueError, TypeError):
        raise InvalidValueError(f"{field_name} 字段值无效: '{value}'，必须是数字")


def validate_row(row: Dict[str, str], row_num: int) -> List[str]:
    warnings = []
    
    if '起印量' in row:
        try:
            validate_numeric_value(row['起印量'], '起印量')
        except InvalidValueError as e:
            warnings.append(f"第{row_num}行: {e}")
    
    if '覆膜加价' in row:
        try:
            validate_numeric_value(row['覆膜加价'], '覆膜加价')
        except InvalidValueError as e:
            warnings.append(f"第{row_num}行: {e}")
    
    if '可复跑' in row:
        value = row['可复跑']
        if value not in ['是', '否']:
            warnings.append(f"第{row_num}行: 可复跑字段值 '{value}' 无效，必须是'是'或'否'")
    
    return warnings


def check_duplicates(rows: List[Dict[str, str]]) -> List[str]:
    seen = set()
    duplicates = []
    
    for i, row in enumerate(rows, start=2):
        order_id = row.get('订单号', '')
        if order_id in seen:
            duplicates.append(f"第{i}行: 订单号 '{order_id}' 重复")
        else:
            seen.add(order_id)
    
    return duplicates


def process_single_file(file_path: Path) -> Dict:
    result = {
        'file': str(file_path),
        'success': False,
        'errors': [],
        'warnings': [],
        'row_count': 0,
        'continue_reason': None
    }
    
    try:
        headers, rows = read_csv_file(file_path)
        result['row_count'] = len(rows)
        
        if not rows:
            result['warnings'].append("文件只有表头，没有数据行")
            result['success'] = True
            return result
        
        validate_columns(headers)
        
        duplicates = check_duplicates(rows)
        result['warnings'].extend(duplicates)
        
        for i, row in enumerate(rows, start=2):
            row_warnings = validate_row(row, i)
            result['warnings'].extend(row_warnings)
        
        result['success'] = True
        
    except EmptyFileError as e:
        result['errors'].append(str(e))
        result['continue_reason'] = "空文件，跳过继续处理"
    except MissingColumnError as e:
        missing_cols = str(e).replace('缺少必填列: ', '').split(', ')
        critical_missing = [col for col in missing_cols if col in CRITICAL_COLUMNS]
        if critical_missing:
            result['errors'].append(str(e))
            result['continue_reason'] = f"缺少关键业务列: {', '.join(critical_missing)}，但继续处理其他文件"
        else:
            result['warnings'].append(str(e))
            result['success'] = True
    except Exception as e:
        result['errors'].append(f"处理文件时出错: {str(e)}")
    
    return result


def process_files(file_paths: List[Path]) -> List[Dict]:
    results = []
    success_count = 0
    error_count = 0
    
    print("\n" + "="*60)
    print("印刷报价组 - 印刷工艺报价 CLI 处理工具")
    print("="*60)
    print(f"\n开始处理 {len(file_paths)} 个文件...\n")
    
    for i, file_path in enumerate(file_paths, 1):
        print(f"[{i}/{len(file_paths)}] 处理: {file_path.name}")
        
        result = process_single_file(file_path)
        results.append(result)
        
        if result['success']:
            success_count += 1
            status = "✓ 成功"
        else:
            error_count += 1
            status = "✗ 失败"
        
        print(f"    状态: {status}")
        print(f"    行数: {result['row_count']}")
        
        if result['warnings']:
            print(f"    警告 ({len(result['warnings'])} 条):")
            for warning in result['warnings'][:3]:
                print(f"      - {warning}")
            if len(result['warnings']) > 3:
                print(f"      - ...还有 {len(result['warnings']) - 3} 条警告")
        
        if result['errors']:
            print(f"    错误 ({len(result['errors'])} 条):")
            for error in result['errors']:
                print(f"      - {error}")
        
        if result['continue_reason']:
            print(f"    继续处理原因: {result['continue_reason']}")
        
        print()
    
    print("-"*60)
    print(f"处理完成! 成功: {success_count}, 失败: {error_count}")
    print("-"*60)
    
    return results


def print_usage():
    print("用法: python printing_quote_cli.py <文件或目录路径...>")
    print()
    print("示例:")
    print("  python printing_quote_cli.py samples/normal/报价单_2024_001.csv")
    print("  python printing_quote_cli.py samples/")
    print("  python printing_quote_cli.py samples/normal/ samples/bad/")
    print()
    print("功能说明:")
    print("  - 验证必填列: 订单号、起印量、覆膜加价、可复跑")
    print("  - 检测重复行（按订单号）")
    print("  - 验证数值字段格式")
    print("  - 遇到关键业务列问题时继续处理其他文件")
    print("  - 提供友好的错误提示和处理原因记录")


def main():
    if len(sys.argv) < 2:
        print("错误: 请指定要处理的文件或目录路径")
        print()
        print_usage()
        sys.exit(1)
    
    if sys.argv[1] in ['-h', '--help', 'help']:
        print_usage()
        sys.exit(0)
    
    paths = []
    for path_str in sys.argv[1:]:
        path = Path(path_str)
        if not path.exists():
            print(f"错误: 路径不存在 - {path_str}")
            sys.exit(1)
        
        if path.is_file():
            paths.append(path)
        elif path.is_dir():
            csv_files = sorted(path.rglob('*.csv'))
            paths.extend(csv_files)
    
    if not paths:
        print("错误: 没有找到要处理的CSV文件")
        sys.exit(1)
    
    process_files(paths)


if __name__ == '__main__':
    main()