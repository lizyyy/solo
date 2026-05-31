#!/usr/bin/env python3
import click
import json
import sys
from pathlib import Path
from equivalent_scoring.manager import ScoringManager
from equivalent_scoring.export import ExportManager
from equivalent_scoring.scoring import EquivalentScorer

@click.group()
def cli():
    """错题等价判分系统"""
    pass

@cli.command()
@click.option('--file', '-f', type=click.Path(exists=True), help='导入JSON文件路径')
def import_data(file):
    """导入错题数据"""
    manager = ScoringManager()
    
    if not file:
        sample_file = Path(__file__).parent / 'data' / 'sample_questions.json'
        if sample_file.exists():
            file = str(sample_file)
            click.echo(f"使用示例数据: {file}")
        else:
            click.echo("请提供数据文件路径", err=True)
            return
    
    with open(file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    count = manager.import_questions(data)
    click.echo(f"成功导入 {count} 条错题记录")

@cli.command()
def score():
    """执行等价判分"""
    manager = ScoringManager()
    total, controversial = manager.run_scoring()
    
    click.echo(f"判分完成:")
    click.echo(f"  总记录数: {total}")
    click.echo(f"  争议记录: {controversial}")
    click.echo(f"  争议率: {controversial/total*100:.1f}%")

@cli.command()
@click.argument('record_id', type=int)
@click.argument('reviewer')
@click.argument('is_equivalent', type=bool)
@click.argument('final_score', type=float)
@click.option('--reason', '-r', default='', help='复核原因')
def review(record_id, reviewer, is_equivalent, final_score, reason):
    """复核单条记录"""
    manager = ScoringManager()
    try:
        record = manager.review_record(record_id, reviewer, is_equivalent, final_score, reason)
        click.echo(f"复核完成: 记录 {record_id}")
        click.echo(f"  等价判定: {is_equivalent}")
        click.echo(f"  最终分数: {final_score}")
        click.echo(f"  复核原因: {reason}")
    except ValueError as e:
        click.echo(str(e), err=True)

@cli.command()
@click.option('--question', '-q', help='按题目ID筛选')
@click.option('--student', '-s', help='按学生ID筛选')
@click.option('--controversial', is_flag=True, help='只显示争议记录')
@click.option('--unreviewed', is_flag=True, help='只显示未复核记录')
@click.option('--limit', '-n', type=int, default=10, help='显示条数')
def list_records(question, student, controversial, unreviewed, limit):
    """列出判分记录"""
    manager = ScoringManager()
    
    records = manager.get_records(
        question_id=question,
        student_id=student,
        reviewed=not unreviewed if unreviewed else None,
        controversial=controversial if controversial else None
    )
    
    if not records:
        click.echo("无记录")
        return
    
    click.echo(f"共 {len(records)} 条记录，显示前 {min(limit, len(records))} 条:")
    click.echo("-" * 80)
    
    for r in records[:limit]:
        status = []
        if r.is_controversial:
            status.append("争议")
        if r.reviewed:
            status.append("已复核")
        status_str = f"[{','.join(status)}]" if status else ""
        
        click.echo(f"ID:{r.id:3d} | {r.question_id} | {r.student_id} | "
                   f"相似度:{r.similarity_score:.2%} | "
                   f"等价:{r.is_equivalent!s:5} {status_str}")
        if r.is_controversial:
            click.echo(f"      原因: {r.controversial_reason}")
        click.echo(f"      标准: {r.standard_answer or '(空)'}")
        click.echo(f"      学生: {r.student_answer or '(空)'}")

@cli.command()
def stats():
    """显示统计信息"""
    manager = ScoringManager()
    stats = manager.get_statistics()
    
    click.echo("=" * 50)
    click.echo("错题等价判分统计")
    click.echo("=" * 50)
    click.echo(f"总记录数:     {stats['total_records']}")
    click.echo(f"已复核:       {stats['reviewed_count']}")
    click.echo(f"待复核:       {stats['unreviewed_count']}")
    click.echo(f"等价答案:     {stats['equivalent_count']}")
    click.echo(f"非等价答案:   {stats['non_equivalent_count']}")
    click.echo(f"争议记录:     {stats['controversial_count']}")
    click.echo(f"平均相似度:   {stats['average_similarity']:.2%}")
    click.echo(f"涉及题目数:   {stats['unique_questions']}")
    click.echo(f"涉及学生数:   {stats['unique_students']}")
    click.echo("=" * 50)

@cli.command()
@click.option('--prefix', '-p', default='', help='文件名前缀')
def export_all(prefix):
    """导出所有数据"""
    manager = ScoringManager()
    exporter = ExportManager()
    
    files = exporter.export_all(manager, prefix)
    
    click.echo("导出完成:")
    for key, path in files.items():
        click.echo(f"  {key:12s}: {path}")

@cli.command()
@click.argument('standard')
@click.argument('student')
@click.option('--threshold', '-t', type=float, default=0.85, help='判分阈值')
def test_score(standard, student, threshold):
    """测试单条判分"""
    scorer = EquivalentScorer(threshold=threshold)
    result = scorer.score(standard, student)
    
    click.echo(f"标准答案: '{standard}'")
    click.echo(f"学生答案: '{student}'")
    click.echo(f"相似度:   {result['similarity_score']:.2%}")
    click.echo(f"等价判定: {result['is_equivalent']}")
    click.echo(f"有争议:   {result['is_controversial']}")
    if result['is_controversial']:
        click.echo(f"争议原因: {result['controversial_reason']}")
    click.echo(f"判分原因: {result['scoring_reason']}")

@cli.command()
@click.argument('record_id', type=int)
def history(record_id):
    """查看记录的复核历史"""
    manager = ScoringManager()
    history_list = manager.get_record_history(record_id)
    
    if not history_list:
        click.echo(f"记录 {record_id} 无复核历史")
        return
    
    click.echo(f"记录 {record_id} 的复核历史:")
    click.echo("-" * 60)
    
    for h in history_list:
        click.echo(f"时间: {h.created_at}")
        click.echo(f"  操作人: {h.reviewer} | 动作: {h.action}")
        prev_eq = "是" if h.previous_equivalent else "否" if h.previous_equivalent is not None else "无"
        new_eq = "是" if h.new_equivalent else "否" if h.new_equivalent is not None else "无"
        click.echo(f"  等价: {prev_eq} → {new_eq}")
        click.echo(f"  原因: {h.reason}")
        click.echo()

@cli.command()
def clear():
    """清空所有数据"""
    manager = ScoringManager()
    if click.confirm("确定要清空所有数据吗？此操作不可恢复"):
        manager.clear_all_data()
        click.echo("已清空所有数据")

if __name__ == '__main__':
    cli()
