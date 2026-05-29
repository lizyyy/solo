import os
import time
from pathlib import Path
from typing import List, Optional

import click
from rich.console import Console

from .models import PhotoRecord, PhotoStatus, CurateResult
from .duplicate_detector import DuplicateDetector
from .face_analyzer import FaceAnalyzer
from .scorer import PhotoScorer, PhotoFilter
from .manual_review import ManualReviewer
from .report_exporter import ReportExporter


console = Console()


@click.group()
@click.version_option(version="0.1.0")
def main():
    """摄影选片去重CLI - 批量筛选照片，去重、人脸分组、评分筛选和报告导出"""
    pass


@main.command()
@click.argument('directory', type=click.Path(exists=True, file_okay=False))
@click.option('--output', '-o', default='./output', help='输出目录')
@click.option('--key-persons', '-k', multiple=True, help='重点人物名称（可多次指定）')
@click.option('--min-score', '-s', default=50.0, type=float, help='最低评分阈值')
@click.option('--auto-confirm', is_flag=True, help='自动确认，跳过人工审核')
@click.option('--skip-duplicates', is_flag=True, help='跳过去重检测')
@click.option('--skip-faces', is_flag=True, help='跳过人脸分析')
@click.option('--hash-size', default=16, type=int, help='感知哈希大小')
@click.option('--use-simulation', is_flag=True, help='使用模拟数据进行测试')
def curate(directory: str, output: str, key_persons: List[str], min_score: float, 
           auto_confirm: bool, skip_duplicates: bool, skip_faces: bool, 
           hash_size: int, use_simulation: bool):
    """完整的选片流程：加载→去重→人脸分析→评分→人工审核→导出报告"""
    
    start_time = time.time()
    
    console.print("[bold blue]=== 摄影选片去重CLI ===[/bold blue]")
    console.print(f"输入目录: {directory}")
    console.print(f"输出目录: {output}")
    if key_persons:
        console.print(f"重点人物: {', '.join(key_persons)}")
    
    if use_simulation:
        from .simulator import create_simulated_photos
        console.print("[yellow]使用模拟数据模式[/yellow]")
        photos = create_simulated_photos(count=100, key_persons=list(key_persons))
    else:
        console.print("\n[bold]第1步: 加载图片[/bold]")
        detector = DuplicateDetector(hash_size=hash_size)
        photos = detector.load_photos(directory)
    
    if not photos:
        console.print("[red]未找到任何图片[/red]")
        return
    
    duplicate_groups = []
    if not skip_duplicates:
        console.print("\n[bold]第2步: 检测重复照片[/bold]")
        if use_simulation:
            from .simulator import create_simulated_duplicates
            duplicate_groups = create_simulated_duplicates(photos)
        else:
            duplicate_groups = detector.find_duplicates(photos)
        console.print(f"发现 {len(duplicate_groups)} 个重复组")
    
    if not skip_faces:
        console.print("\n[bold]第3步: 人脸分析[/bold]")
        analyzer = FaceAnalyzer(key_persons=list(key_persons))
        photos = analyzer.batch_analyze(photos)
    
    console.print("\n[bold]第4步: 评分和筛选[/bold]")
    scorer = PhotoScorer(min_score=min_score)
    photos = scorer.batch_score(photos)
    
    if duplicate_groups and not skip_duplicates:
        console.print("\n[bold]第5步: 审核重复照片[/bold]")
        reviewer = ManualReviewer(auto_confirm=auto_confirm, output_dir=output)
        reviewer.batch_review_by_groups(duplicate_groups)
        photos = reviewer.apply_decisions(photos)
    
    if not auto_confirm:
        console.print("\n[bold]第6步: 人工审核[/bold]")
        reviewer = ManualReviewer(auto_confirm=False, output_dir=output)
        photos = reviewer.review_all(photos)
    
    console.print("\n[bold]第7步: 生成选片结果[/bold]")
    result = _compile_result(photos, duplicate_groups, start_time)
    
    console.print("\n[bold]第8步: 导出报告[/bold]")
    exporter = ReportExporter(output_dir=output)
    exporter.print_console_summary(result)
    exporter.export_all(result, photos, duplicate_groups, list(key_persons))
    
    console.print("\n[bold green]✓ 选片完成！[/bold green]")


def _compile_result(photos: List[PhotoRecord], duplicate_groups: list, start_time: float) -> CurateResult:
    keep_count = len([p for p in photos if p.status == PhotoStatus.KEEP])
    remove_count = len([p for p in photos if "remove" in p.status.value])
    
    result = CurateResult(
        total_photos=len(photos),
        keep_count=keep_count,
        remove_count=remove_count,
        duplicate_groups=len(duplicate_groups),
        photos_removed_as_duplicate=len([p for p in photos if p.status == PhotoStatus.REMOVE_DUPLICATE]),
        photos_removed_closed_eyes=len([p for p in photos if p.status == PhotoStatus.REMOVE_CLOSED_EYES]),
        photos_removed_low_score=len([p for p in photos if p.status == PhotoStatus.REMOVE_LOW_SCORE]),
        photos_removed_manual=len([p for p in photos if p.status == PhotoStatus.REMOVE_MANUAL]),
        processing_time=time.time() - start_time,
        photo_records=photos,
        duplicate_groups_list=duplicate_groups
    )
    
    key_person_photos = {}
    key_persons = set()
    for photo in photos:
        for face in photo.faces:
            if face.is_key_person and face.person_name:
                key_persons.add(face.person_name)
                key_person_photos[face.person_name] = key_person_photos.get(face.person_name, 0) + 1
    
    result.key_persons_found = list(key_persons)
    result.key_person_photos = key_person_photos
    
    scored_photos = [p.score for p in photos if p.score > 0]
    result.average_score = sum(scored_photos) / len(scored_photos) if scored_photos else 0
    
    return result


@main.command()
@click.argument('directory', type=click.Path(exists=True, file_okay=False))
@click.option('--output', '-o', default='./output', help='输出目录')
@click.option('--hash-size', default=16, type=int, help='感知哈希大小')
def dedupe(directory: str, output: str, hash_size: int):
    """仅执行去重检测"""
    detector = DuplicateDetector(hash_size=hash_size)
    photos = detector.load_photos(directory)
    groups = detector.find_duplicates(photos)
    
    console.print(f"发现 {len(groups)} 个重复组")
    
    for group in groups:
        console.print(f"\n重复组 {group.group_id}:")
        for photo in group.photos:
            mark = "★" if photo.duplicate_rank == 0 else "  "
            console.print(f"  {mark} {photo.metadata.file_name} (评分: {photo.score})")
    
    exporter = ReportExporter(output_dir=output)
    exporter.export_duplicate_groups(groups)


@main.command()
@click.argument('directory', type=click.Path(exists=True, file_okay=False))
@click.option('--output', '-o', default='./output', help='输出目录')
@click.option('--key-persons', '-k', multiple=True, help='重点人物名称')
def faces(directory: str, output: str, key_persons: List[str]):
    """仅执行人脸分析"""
    detector = DuplicateDetector()
    photos = detector.load_photos(directory)
    
    analyzer = FaceAnalyzer(key_persons=list(key_persons))
    photos = analyzer.batch_analyze(photos)
    
    photo_filter = PhotoFilter()
    kp_summary = photo_filter.get_key_person_summary(photos)
    
    console.print("\n人脸检测结果:")
    for person, count in kp_summary.items():
        console.print(f"  {person}: {count} 张照片")
    
    exporter = ReportExporter(output_dir=output)
    exporter.export_details_csv(photos, title="faces")
    if key_persons:
        exporter.export_key_person_photos(photos, list(key_persons))


@main.command()
@click.argument('directory', type=click.Path(exists=True, file_okay=False))
@click.option('--output', '-o', default='./output', help='输出目录')
@click.option('--min-score', '-s', default=50.0, type=float, help='最低评分阈值')
def score(directory: str, output: str, min_score: float):
    """仅执行评分"""
    detector = DuplicateDetector()
    photos = detector.load_photos(directory)
    
    analyzer = FaceAnalyzer()
    photos = analyzer.batch_analyze(photos)
    
    scorer = PhotoScorer(min_score=min_score)
    photos = scorer.batch_score(photos)
    
    console.print(f"\n评分完成，平均评分: {sum(p.score for p in photos) / len(photos):.2f}")
    
    exporter = ReportExporter(output_dir=output)
    exporter.export_details_csv(photos, title="scored")


@main.command()
@click.option('--output', '-o', default='./output', help='输出目录')
@click.option('--count', '-n', default=100, type=int, help='生成模拟照片数量')
@click.option('--key-persons', '-k', multiple=True, help='重点人物名称')
@click.option('--min-score', '-s', default=50.0, type=float, help='最低评分阈值')
@click.option('--auto-confirm', is_flag=True, help='自动确认，跳过人工审核')
def demo(output: str, count: int, key_persons: List[str], min_score: float, auto_confirm: bool):
    """使用模拟数据演示完整流程"""
    from .simulator import create_simulated_photos, create_simulated_duplicates
    
    start_time = time.time()
    
    console.print("[bold blue]=== 摄影选片去重CLI - 演示模式 ===[/bold blue]")
    console.print(f"生成 {count} 张模拟照片")
    if key_persons:
        console.print(f"重点人物: {', '.join(key_persons)}")
    
    photos = create_simulated_photos(count=count, key_persons=list(key_persons))
    
    console.print("\n[bold]第1步: 检测重复照片[/bold]")
    duplicate_groups = create_simulated_duplicates(photos)
    console.print(f"发现 {len(duplicate_groups)} 个重复组")
    
    console.print("\n[bold]第2步: 人脸分析[/bold]")
    analyzer = FaceAnalyzer(key_persons=list(key_persons))
    photos = analyzer.batch_analyze(photos)
    
    console.print("\n[bold]第3步: 评分和筛选[/bold]")
    scorer = PhotoScorer(min_score=min_score)
    photos = scorer.batch_score(photos)
    
    console.print("\n[bold]第4步: 审核重复照片[/bold]")
    reviewer = ManualReviewer(auto_confirm=True, output_dir=output)
    reviewer.batch_review_by_groups(duplicate_groups)
    photos = reviewer.apply_decisions(photos)
    
    if not auto_confirm:
        console.print("\n[bold]第5步: 人工审核（演示模式快速审核）[/bold]")
        reviewer = ManualReviewer(auto_confirm=True, output_dir=output)
        photos = reviewer.review_all(photos)
    else:
        console.print("\n[bold]第5步: 自动确认[/bold]")
    
    console.print("\n[bold]第6步: 生成选片结果[/bold]")
    result = _compile_result(photos, duplicate_groups, start_time)
    
    console.print("\n[bold]第7步: 导出报告[/bold]")
    exporter = ReportExporter(output_dir=output)
    exporter.print_console_summary(result)
    exporter.export_all(result, photos, duplicate_groups, list(key_persons))
    
    console.print("\n[bold green]✓ 演示完成！报告已导出到 output 目录[/bold green]")


@main.command('list')
@click.argument('directory', type=click.Path(exists=True, file_okay=False))
@click.option('--status', type=click.Choice(['keep', 'remove', 'duplicate', 'all']), default='all')
@click.option('--min-score', type=float, default=0)
@click.option('--person', help='按人物筛选')
def list_photos(directory: str, status: str, min_score: float, person: Optional[str]):
    """列出并筛选照片（屏幕显示与导出内容一致）"""
    detector = DuplicateDetector()
    photos = detector.load_photos(directory)
    
    analyzer = FaceAnalyzer()
    photos = analyzer.batch_analyze(photos)
    
    scorer = PhotoScorer(min_score=min_score)
    photos = scorer.batch_score(photos)
    
    photo_filter = PhotoFilter()
    
    if status == 'keep':
        photos = photo_filter.get_keep_photos(photos)
    elif status == 'remove':
        photos = photo_filter.get_remove_photos(photos)
    elif status == 'duplicate':
        photos = photo_filter.get_duplicate_photos(photos)
    
    if min_score > 0:
        photos = photo_filter.filter_by_score_range(photos, min_score)
    
    if person:
        photos = photo_filter.filter_by_key_person(photos, person)
    
    console.print(f"\n找到 {len(photos)} 张照片:")
    for photo in photos[:50]:
        status_color = "green" if photo.status == PhotoStatus.KEEP else "red"
        console.print(f"  [{status_color}]{photo.status.value:12}[/{status_color}] {photo.metadata.file_name} (评分: {photo.score:.1f})")
    
    if len(photos) > 50:
        console.print(f"  ... 还有 {len(photos) - 50} 张")


if __name__ == '__main__':
    main()
