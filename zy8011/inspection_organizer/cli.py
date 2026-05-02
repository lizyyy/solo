"""
命令行界面
整合所有模块，提供完整的巡检照片整理功能
"""
import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import List

from .config import PhotoMetadata, Issue
from .photo_reader import PhotoReader
from .filename_parser import FilenameParser
from .archiver import PhotoArchiver
from .rule_manager import RuleManager
from .issue_detector import IssueDetector
from .tracker import PhotoTracker
from .output_generator import OutputGenerator


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='连锁门店巡检照片整理工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例:
  # 基本用法
  inspection-organizer --photos ./photos --rules ./rules.json --inspection ./inspection.csv --output ./output

  # 使用移动模式（不保留原文件）
  inspection-organizer --photos ./photos --rules ./rules.json --inspection ./inspection.csv --output ./output --move

  # 指定数据库路径
  inspection-organizer --photos ./photos --rules ./rules.json --inspection ./inspection.csv --output ./output --db ./tracker.db
        '''
    )
    
    # 必需参数
    parser.add_argument('--photos', '-p', required=True,
                        help='照片目录路径')
    parser.add_argument('--rules', '-r', required=True,
                        help='门店规则JSON文件路径')
    parser.add_argument('--inspection', '-i', required=True,
                        help='巡检清单CSV文件路径')
    parser.add_argument('--output', '-o', required=True,
                        help='输出目录路径')
    
    # 可选参数
    parser.add_argument('--db', '-d', default=None,
                        help='SQLite追踪数据库路径（默认: 输出目录/tracker.db）')
    parser.add_argument('--move', '-m', action='store_true',
                        help='移动照片而不是复制（默认: 复制）')
    parser.add_argument('--skip-archive', action='store_true',
                        help='跳过归档操作，只检测问题')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='显示详细输出')
    
    args = parser.parse_args()
    
    # 运行主流程
    try:
        result = run_inspection_organizer(
            photo_dir=args.photos,
            rules_file=args.rules,
            inspection_file=args.inspection,
            output_dir=args.output,
            db_path=args.db,
            move=args.move,
            skip_archive=args.skip_archive,
            verbose=args.verbose,
        )
        
        # 输出结果摘要
        print('\n' + '='*60)
        print('处理完成！')
        print('='*60)
        print(f'总处理照片数: {result["total_photos"]}')
        print(f'归档照片数: {result["archived_photos"]}')
        print(f'检测到问题数: {result["issues_count"]}')
        
        if result["issues_count"] > 0:
            print(f'\n问题详情请查看: {result["issues_csv"]}')
            print(f'复盘报告请查看: {result["markdown_report"]}')
        
        print('='*60)
        
        sys.exit(0)
        
    except Exception as e:
        print(f'错误: {str(e)}', file=sys.stderr)
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


def run_inspection_organizer(
    photo_dir: str,
    rules_file: str,
    inspection_file: str,
    output_dir: str,
    db_path: str = None,
    move: bool = False,
    skip_archive: bool = False,
    verbose: bool = False,
) -> dict:
    """
    运行巡检照片整理主流程
    
    Args:
        photo_dir: 照片目录
        rules_file: 门店规则JSON文件
        inspection_file: 巡检清单CSV文件
        output_dir: 输出目录
        db_path: SQLite数据库路径
        move: 是否移动而非复制
        skip_archive: 是否跳过归档
        verbose: 是否显示详细信息
    
    Returns:
        处理结果字典
    """
    start_time = datetime.now()
    
    # 确定数据库路径
    if db_path is None:
        db_path = str(Path(output_dir) / 'tracker.db')
    
    if verbose:
        print(f'[INFO] 开始处理...')
        print(f'  照片目录: {photo_dir}')
        print(f'  规则文件: {rules_file}')
        print(f'  巡检清单: {inspection_file}')
        print(f'  输出目录: {output_dir}')
        print(f'  数据库: {db_path}')
        print(f'  模式: {"移动" if move else "复制"}')
    
    # 1. 初始化各个组件
    if verbose:
        print('\n[INFO] 初始化组件...')
    
    rule_manager = RuleManager()
    tracker = PhotoTracker(db_path)
    output_generator = OutputGenerator(output_dir)
    
    # 2. 加载规则和巡检清单
    if verbose:
        print('[INFO] 加载门店规则...')
    store_rules = rule_manager.load_store_rules(rules_file)
    if verbose:
        print(f'  加载了 {len(store_rules)} 个门店规则')
    
    if verbose:
        print('[INFO] 加载巡检清单...')
    inspection_items = rule_manager.load_inspection_list(inspection_file)
    if verbose:
        print(f'  加载了 {len(inspection_items)} 个巡检项')
    
    # 验证规则和清单的一致性
    validation_issues = rule_manager.validate()
    if validation_issues and verbose:
        print('[WARNING] 规则与清单不一致:')
        for issue in validation_issues:
            print(f'  - {issue}')
    
    # 3. 开始批次
    batch_id = tracker.start_batch(
        photo_dir=photo_dir,
        rules_file=rules_file,
        inspection_file=inspection_file,
        output_dir=output_dir,
    )
    
    # 4. 读取和解析照片
    if verbose:
        print('\n[INFO] 读取照片...')
    
    photo_reader = PhotoReader(photo_dir)
    photos = photo_reader.get_all_photos()
    
    if verbose:
        print(f'  找到 {len(photos)} 张照片')
    
    filename_parser = FilenameParser(store_rules)
    archiver = PhotoArchiver(output_dir, store_rules)
    issue_detector = IssueDetector(rule_manager)
    
    all_metadata: List[PhotoMetadata] = []
    all_issues: List[Issue] = []
    archived_count = 0
    
    # 处理每张照片
    for idx, photo_path in enumerate(photos, 1):
        if verbose:
            print(f'  处理 [{idx}/{len(photos)}]: {photo_path.name}')
        
        # 读取元数据
        metadata = photo_reader.read_photo_metadata(photo_path)
        
        # 解析文件名
        metadata = filename_parser.parse_filename(photo_path, metadata)
        
        all_metadata.append(metadata)
        
        # 检查历史重复
        if tracker.is_duplicate_hash(metadata.file_hash):
            existing = tracker.get_photo_by_hash(metadata.file_hash)
            if existing:
                metadata.is_duplicate = True
                metadata.duplicate_of = existing.get('original_path', '')
                
                issue = Issue(
                    issue_type="duplicate_photo",
                    severity="warning",
                    photo_metadata=metadata,
                    message=f"照片与历史记录重复: {existing.get('filename', '')}",
                    store_code=metadata.determined_store_code,
                    checkpoint=metadata.determined_checkpoint,
                    details={
                        "original_path": existing.get('original_path', ''),
                        "archived_path": existing.get('archived_path', ''),
                    }
                )
                all_issues.append(issue)
                continue
        
        # 注册到问题检测器
        issue_detector.register_photo(metadata)
        
        # 归档照片
        if not skip_archive and not metadata.is_duplicate:
            target_dir, new_filename = archiver.generate_archive_path(metadata)
            
            if verbose:
                print(f'    归档到: {target_dir / new_filename}')
            
            archived_path, archive_issues = archiver.archive_photo(
                metadata, target_dir, new_filename, copy=not move
            )
            
            all_issues.extend(archive_issues)
            archived_count += 1
            
            # 记录到数据库
            photo_id = tracker.record_photo(
                metadata,
                archived_path=str(archived_path),
                batch_id=batch_id,
            )
        else:
            # 即使不归档，也要记录到数据库
            photo_id = tracker.record_photo(
                metadata,
                archived_path=None,
                batch_id=batch_id,
            )
    
    # 5. 检测所有问题
    if verbose:
        print('\n[INFO] 检测问题...')
    
    detected_issues = issue_detector.detect_all_issues()
    all_issues.extend(detected_issues)
    
    if verbose:
        print(f'  检测到 {len(detected_issues)} 个问题')
    
    # 6. 记录问题到数据库
    for issue in all_issues:
        # 查找对应的photo_id
        photo_id = None
        if issue.photo_metadata:
            # 这里简化处理，实际应该通过哈希或路径查找
            pass
        
        tracker.record_issue(issue, photo_id)
    
    # 7. 生成输出
    if verbose:
        print('\n[INFO] 生成输出文件...')
    
    # 导出问题CSV
    issues_csv = output_generator.export_issues_csv(all_issues)
    if verbose:
        print(f'  问题CSV: {issues_csv}')
    
    # 导出照片索引
    photos_csv = output_generator.export_photos_csv(all_metadata)
    if verbose:
        print(f'  照片索引: {photos_csv}')
    
    # 生成Markdown报告
    stats = tracker.get_statistics(batch_id)
    issue_stats = issue_detector.get_statistics()
    
    markdown_report = output_generator.generate_markdown_report(
        issues=all_issues,
        photos=all_metadata,
        statistics=stats,
        issue_statistics=issue_stats,
        batch_id=batch_id,
    )
    if verbose:
        print(f'  复盘报告: {markdown_report}')
    
    # 8. 结束批次
    tracker.end_batch(
        batch_id=batch_id,
        total_photos=len(all_metadata),
        archived_photos=archived_count,
        issues_count=len(all_issues),
    )
    
    # 计算耗时
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    if verbose:
        print(f'\n[INFO] 处理完成，耗时: {duration:.2f} 秒')
    
    return {
        'batch_id': batch_id,
        'total_photos': len(all_metadata),
        'archived_photos': archived_count,
        'issues_count': len(all_issues),
        'issues_csv': str(issues_csv),
        'photos_csv': str(photos_csv),
        'markdown_report': str(markdown_report),
        'duration_seconds': duration,
        'statistics': stats,
        'issue_statistics': issue_stats,
    }


if __name__ == '__main__':
    main()
