#!/usr/bin/env python3
"""
岩芯箱照片归档助手 - 主程序入口
用于地质勘探队的本地自动化工具，自动整理岩芯箱照片、取样记录、GPS轨迹和手写备注。
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from config import config
from core.scanner import FileScanner
from core.parser import CSVParser, GPXParser, OCRTextParser
from core.validator import DataValidator
from core.archiver import ArchiveManager
from core.rollback import RollbackManager
from core.reporter import ReportGenerator


def print_header():
    """打印程序头部"""
    print("=" * 60)
    print("          岩芯箱照片归档助手 v1.0.0")
    print("          地质勘探数据自动化整理工具")
    print("=" * 60)
    print()


def scan_directory(source_dir: str) -> Dict[str, Any]:
    """扫描目录"""
    print(f"[1/6] 正在扫描目录: {source_dir}")
    
    scanner = FileScanner(source_dir)
    scan_results = scanner.scan()
    scan_summary = scanner.get_scan_summary()
    
    print(f"  - 发现 {scan_summary['total_files']} 个文件")
    print(f"  - 照片: {scan_summary['photo_count']} 个")
    print(f"  - CSV文件: {scan_summary['csv_count']} 个")
    print(f"  - GPX文件: {scan_summary['gpx_count']} 个")
    print(f"  - 文本文件: {scan_summary['text_count']} 个")
    print()
    
    return {
        'scan_results': scan_results,
        'scan_summary': scan_summary
    }


def parse_files(scan_results: Dict[str, Any]) -> Dict[str, Any]:
    """解析文件"""
    print("[2/6] 正在解析数据文件...")
    
    csv_records: List[Dict[str, Any]] = []
    gpx_data: Dict[str, Any] = {'track_points': [], 'waypoints': []}
    ocr_notes: List[Dict[str, Any]] = []
    
    for csv_file in scan_results.get('csv_files', []):
        try:
            parser = CSVParser(csv_file['path'])
            records = parser.parse()
            csv_records.extend(records)
            print(f"  - 解析CSV: {csv_file['name']} -> {len(records)} 条记录")
        except Exception as e:
            print(f"  - 警告: 解析CSV失败 {csv_file['name']}: {e}")
    
    for gpx_file in scan_results.get('gpx_files', []):
        try:
            parser = GPXParser(gpx_file['path'])
            data = parser.parse()
            gpx_data['track_points'].extend(data.get('track_points', []))
            gpx_data['waypoints'].extend(data.get('waypoints', []))
            print(f"  - 解析GPX: {gpx_file['name']} -> {len(data.get('track_points', []))} 轨迹点, {len(data.get('waypoints', []))} 航点")
        except Exception as e:
            print(f"  - 警告: 解析GPX失败 {gpx_file['name']}: {e}")
    
    for text_file in scan_results.get('text_files', []):
        try:
            parser = OCRTextParser(text_file['path'])
            notes = parser.parse()
            ocr_notes.extend(notes)
            print(f"  - 解析OCR文本: {text_file['name']} -> {len(notes)} 条备注")
        except Exception as e:
            print(f"  - 警告: 解析文本失败 {text_file['name']}: {e}")
    
    print()
    return {
        'csv_records': csv_records,
        'gpx_data': gpx_data,
        'ocr_notes': ocr_notes
    }


def validate_data(scan_data: Dict[str, Any], parse_data: Dict[str, Any], 
                  output_dir: str) -> Dict[str, Any]:
    """校验数据"""
    print("[3/6] 正在执行数据校验...")
    
    validator = DataValidator(
        scan_results=scan_data['scan_results'],
        csv_records=parse_data['csv_records'],
        gpx_data=parse_data['gpx_data'],
        ocr_notes=parse_data['ocr_notes']
    )
    
    validation_results = validator.validate()
    
    issue_summary = validation_results.get('issue_summary', {})
    total_issues = issue_summary.get('total', 0)
    
    print(f"  - 校验照片: {len(validation_results.get('validated_photos', []))} 张")
    print(f"  - 发现问题: {total_issues} 个")
    
    by_severity = issue_summary.get('by_severity', {})
    if by_severity:
        for severity, count in by_severity.items():
            print(f"    - {severity}: {count} 个")
    
    review_path = Path(output_dir) / config.REVIEW_FILE
    validator.save_review_file(str(review_path))
    print(f"  - 冲突报告已保存: {review_path}")
    print()
    
    return validation_results


def create_archive_plan(parse_data: Dict[str, Any], validation_results: Dict[str, Any],
                         scan_results: Dict[str, Any], source_dir: str, 
                         target_dir: str) -> ArchiveManager:
    """创建归档计划"""
    print("[4/6] 正在建立归档计划...")
    
    archiver = ArchiveManager(
        validated_photos=validation_results.get('validated_photos', []),
        csv_records=parse_data['csv_records'],
        ocr_notes=parse_data['ocr_notes'],
        gpx_files=scan_results.get('gpx_files', []),
        target_root=target_dir
    )
    
    plan = archiver.build_archive_plan(source_dir)
    
    summary = plan.summary
    print(f"  - 计划ID: {plan.plan_id}")
    print(f"  - 总项目数: {summary.get('total_items', 0)} 个")
    
    by_type = summary.get('by_type', {})
    for item_type, count in by_type.items():
        print(f"    - {item_type}: {count} 个")
    
    print()
    return archiver


def execute_archive(archiver: ArchiveManager, dry_run: bool = False) -> Dict[str, Any]:
    """执行归档"""
    if dry_run:
        print("[5/6] 预览归档模式（不实际执行）...")
        plan_summary = archiver.get_plan_summary()
        print(f"  - 计划ID: {plan_summary.get('plan_id')}")
        print(f"  - 状态: {plan_summary.get('status')}")
        print("  - 这是预览模式，不会实际复制文件")
        print()
        return {'dry_run': True, 'status': 'preview'}
    
    print("[5/6] 正在执行归档...")
    
    results = archiver.execute_archive()
    
    print(f"  - 执行状态: {results.get('status')}")
    print(f"  - 成功: {results.get('success_count', 0)} 个")
    print(f"  - 失败: {results.get('failed_count', 0)} 个")
    
    if results.get('failed_count', 0) > 0:
        print("  - 警告: 部分项目归档失败")
        for failed in results.get('failed_items', []):
            print(f"    - {failed.get('item_type')}: {failed.get('source_path')} - {failed.get('error')}")
    
    print()
    return results


def generate_reports(scan_data: Dict[str, Any], validation_results: Dict[str, Any],
                     archiver: Optional[ArchiveManager], archive_results: Optional[Dict[str, Any]],
                     output_dir: str):
    """生成报告"""
    print("[6/6] 正在生成报告...")
    
    archive_plan = None
    if archiver and archiver.archive_plan:
        archive_plan = archiver.archive_plan.to_dict()
    
    reporter = ReportGenerator(
        scan_results=scan_data,
        validation_results=validation_results,
        archive_plan=archive_plan,
        archive_results=archive_results
    )
    
    md_path = Path(output_dir) / "交接报告.md"
    reporter.generate_markdown_report(str(md_path))
    print(f"  - Markdown报告: {md_path}")
    
    csv_path = Path(output_dir) / "问题清单.csv"
    reporter.generate_issues_csv(str(csv_path))
    print(f"  - CSV问题清单: {csv_path}")
    
    print()


def execute_rollback(archive_dir: str, dry_run: bool = False) -> Dict[str, Any]:
    """执行回滚"""
    print_header()
    print("执行回滚操作...")
    print()
    
    rollback_manager = RollbackManager(archive_dir)
    
    can_rollback, message = rollback_manager.can_rollback()
    if not can_rollback:
        print(f"错误: {message}")
        return {'status': 'failed', 'message': message}
    
    latest_info = rollback_manager.get_latest_archive_info()
    if latest_info:
        print(f"最近一次归档:")
        print(f"  - 计划ID: {latest_info.get('plan_id')}")
        print(f"  - 归档时间: {latest_info.get('archive_time')}")
        print(f"  - 操作数: {latest_info.get('total_operations')} 个")
        print()
    
    if dry_run:
        print("预览回滚操作:")
        preview = rollback_manager.preview_rollback()
        for op in preview.get('operations', []):
            print(f"  - [{op.get('status')}] {op.get('item_type')}: {op.get('target_path')}")
        print()
        return {'dry_run': True, 'status': 'preview'}
    
    confirm = input("确认执行回滚？这将删除最近一次归档的所有文件。(y/N): ")
    if confirm.lower() != 'y':
        print("已取消回滚操作。")
        return {'status': 'cancelled'}
    
    print("正在执行回滚...")
    results = rollback_manager.execute_rollback()
    
    print(f"  - 状态: {results.get('status')}")
    print(f"  - 成功: {results.get('success_count', 0)} 个")
    print(f"  - 失败: {results.get('failed_count', 0)} 个")
    
    return results


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='岩芯箱照片归档助手 - 地质勘探数据自动化整理工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例用法:
  python main.py --source ./sample_data --output ./output
  python main.py --source ./sample_data --output ./output --dry-run
  python main.py --rollback --archive-dir ./archive
  python main.py --rollback --archive-dir ./archive --dry-run
        '''
    )
    
    parser.add_argument('--source', '-s', type=str, 
                        help='源数据目录路径')
    parser.add_argument('--output', '-o', type=str, default='./output',
                        help='输出目录路径 (默认: ./output)')
    parser.add_argument('--archive-dir', type=str,
                        help='归档目录路径（用于回滚操作）')
    parser.add_argument('--rollback', action='store_true',
                        help='执行回滚操作')
    parser.add_argument('--dry-run', action='store_true',
                        help='预览模式，不实际执行文件操作')
    parser.add_argument('--no-archive', action='store_true',
                        help='只执行扫描和校验，不执行归档')
    
    args = parser.parse_args()
    
    if args.rollback:
        archive_dir = args.archive_dir or config.ARCHIVE_ROOT
        execute_rollback(archive_dir, args.dry_run)
        return
    
    if not args.source:
        print("错误: 请指定源数据目录 (--source)")
        parser.print_help()
        sys.exit(1)
    
    source_dir = Path(args.source)
    if not source_dir.exists():
        print(f"错误: 源目录不存在: {source_dir}")
        sys.exit(1)
    
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print_header()
    print(f"源目录: {source_dir.absolute()}")
    print(f"输出目录: {output_dir.absolute()}")
    if args.dry_run:
        print("模式: 预览模式（不实际执行文件操作）")
    if args.no_archive:
        print("模式: 仅扫描校验模式（不执行归档）")
    print()
    
    try:
        scan_data = scan_directory(str(source_dir))
        
        parse_data = parse_files(scan_data['scan_results'])
        
        validation_results = validate_data(scan_data, parse_data, str(output_dir))
        
        archiver = None
        archive_results = None
        
        if not args.no_archive:
            archiver = create_archive_plan(
                parse_data, validation_results,
                scan_data['scan_results'],
                str(source_dir), str(output_dir / 'archive')
            )
            
            archive_results = execute_archive(archiver, args.dry_run)
        
        if not args.dry_run:
            generate_reports(
                scan_data, validation_results,
                archiver, archive_results,
                str(output_dir)
            )
        
        print("=" * 60)
        print("处理完成！")
        print("=" * 60)
        print()
        
        issue_summary = validation_results.get('issue_summary', {})
        total_issues = issue_summary.get('total', 0)
        
        if total_issues > 0:
            print(f"⚠️  发现 {total_issues} 个问题，请查看 review.json 和 问题清单.csv")
            print()
        
        if not args.no_archive and archive_results:
            if not args.dry_run:
                print(f"✅ 归档已完成，文件位于: {output_dir / 'archive'}")
            else:
                print(f"ℹ️  预览模式，归档计划已生成但未执行")
        
    except Exception as e:
        print(f"错误: 处理过程中发生异常: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
