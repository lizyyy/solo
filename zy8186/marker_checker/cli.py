#!/usr/bin/env python3
import argparse
import os
import sys


def main():
    parser = argparse.ArgumentParser(
        description='服装版房唛架排料预检工具 - 大货裁剪前检查裁片排料',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例:
  # 基础用法
  marker-checker --pieces samples/pieces.csv --fabric samples/fabric_rules.yaml --size samples/size_ratio.json
  
  # 带瑕疵区
  marker-checker -p pieces.csv -f fabric.yaml -s size.json -d defects.csv
  
  # 指定输出目录和单位
  marker-checker -p pieces.csv -f fabric.yaml -s size.json -o ./output --input-unit cm --output-unit m
        '''
    )
    
    parser.add_argument('-p', '--pieces', required=True,
                        help='裁片尺寸 CSV 文件路径')
    parser.add_argument('-f', '--fabric', required=True,
                        help='面料门幅/纹向规则 YAML 文件路径')
    parser.add_argument('-s', '--size', required=True,
                        help='尺码配比 JSON 文件路径')
    parser.add_argument('-d', '--defects', default=None,
                        help='瑕疵区 CSV 文件路径 (可选)')
    parser.add_argument('-o', '--output', default='.',
                        help='输出目录 (默认: 当前目录)')
    parser.add_argument('--input-unit', default='mm',
                        choices=['mm', 'cm', 'm', 'inch', 'yard'],
                        help='输入单位 (默认: mm)')
    parser.add_argument('--output-unit', default='mm',
                        choices=['mm', 'cm', 'm', 'inch', 'yard'],
                        help='输出单位 (默认: mm)')
    parser.add_argument('-v', '--verbose', action='store_true',
                        help='显示详细输出')
    
    args = parser.parse_args()
    
    for filepath in [args.pieces, args.fabric, args.size]:
        if not os.path.exists(filepath):
            print(f"错误: 文件不存在 - {filepath}")
            sys.exit(1)
    
    if args.defects and not os.path.exists(args.defects):
        print(f"警告: 瑕疵区文件不存在 - {args.defects}，将跳过瑕疵避让")
        args.defects = None
    
    if args.output and not os.path.exists(args.output):
        os.makedirs(args.output)
        if args.verbose:
            print(f"创建输出目录: {args.output}")
    
    try:
        from marker_checker.checker import MarkerChecker
    except ImportError:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from marker_checker.checker import MarkerChecker
    
    checker = MarkerChecker(
        input_unit=args.input_unit,
        output_unit=args.output_unit
    )
    
    if args.verbose:
        print(f"开始处理...")
        print(f"  裁片文件: {args.pieces}")
        print(f"  面料规则: {args.fabric}")
        print(f"  尺码配比: {args.size}")
        if args.defects:
            print(f"  瑕疵区: {args.defects}")
        print(f"  输入单位: {args.input_unit}")
        print(f"  输出单位: {args.output_unit}")
        print(f"  输出目录: {args.output}")
        print()
    
    result = checker.run(
        pieces_file=args.pieces,
        fabric_file=args.fabric,
        size_ratio_file=args.size,
        defects_file=args.defects,
        output_dir=args.output
    )
    
    if args.verbose:
        print("处理完成!")
        print()
        print("=== 汇总 ===")
        print(f"总裁片数: {result['input_summary']['total_pieces']}")
        print(f"面料种类: {result['input_summary']['total_fabrics']}")
        print(f"瑕疵数量: {result['input_summary']['defect_count']}")
        print()
        
        waste = result['waste_stats']
        print("=== 损耗统计 ===")
        print(f"排版效率: {waste['efficiency']}%")
        print(f"损耗率: {waste['waste_percentage']}%")
        print()
        
        issues = result['issues']
        if issues:
            print(f"=== 发现问题 ({len(issues)} 个) ===")
            for issue in issues:
                severity = issue.get('severity', 'info').upper()
                message = issue.get('message', '未知问题')
                print(f"  [{severity}] {message}")
        else:
            print("=== 未发现问题 ===")
        print()
    
    print(f"输出文件已生成至: {os.path.abspath(args.output)}")
    print(f"  - issues.csv: 问题列表")
    print(f"  - marker_report.md: 唛架报告")
    print(f"  - layout.html: 排料布局图")
    
    issues = result['issues']
    errors = [i for i in issues if i.get('severity') == 'error']
    
    if errors:
        print(f"\n警告: 发现 {len(errors)} 个严重问题，请检查 issues.csv")
        sys.exit(1)
    
    sys.exit(0)


if __name__ == '__main__':
    main()
