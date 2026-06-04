import click
from datetime import datetime
import sys

sys.path.insert(0, '.')

from config import Config
from storage import DataStore
from core import DuplicateDetector, WeightUpdater


@click.group()
def cli():
    """随机游走资产敞口 - 评分权重表处理工具
    """
    pass


@cli.command()
@click.argument('excel_path')
@click.option('--batch', default=None, help='导入批次号，默认自动生成')
def import_answers(excel_path, batch):
    """导入学生答案数据
    """
    batch = batch or f"BATCH_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    store = DataStore()
    answers = store.import_answers_from_excel(excel_path, batch)
    click.echo(f"导入完成，共导入 {len(answers)} 条答案")

    all_answers = store.get_all_answers()
    all_answers = DuplicateDetector.mark_duplicates(all_answers)
    store._save_all()

    duplicates = store.get_duplicates_pending()
    if duplicates:
        click.echo(f"检测到 {len(duplicates)} 条重复提交待复核")

    click.echo("导入完成！")


@cli.command()
@click.argument('excel_path')
def import_weights(excel_path):
    """导入评分权重表
    """
    store = DataStore()
    weights = store.import_weights_from_excel(excel_path)
    click.echo(f"导入完成，共导入 {len(weights)} 条权重配置")


@cli.command()
@click.option('--all', is_flag=True, help='对所有历史答案应用权重更新')
def apply_weights(all):
    """应用评分权重表补录，更新误差说明
    """
    store = DataStore()
    weights = store.get_all_weights()
    answers = store.get_all_answers()

    if not all:
        answers = [a for a in answers if a.status == "NORMAL"]

    error_logs = WeightUpdater.apply_old_standard_update(answers, weights)
    store.add_error_logs(error_logs)
    click.echo(f"应用完成，生成 {len(error_logs)} 条误差说明")


@cli.command()
def status():
    """查看当前数据状态
    """
    store = DataStore()
    answers = store.get_all_answers()
    weights = store.get_all_weights()
    errors = store.get_all_error_logs()

    click.echo("=" * 50)
    click.echo("随机游走资产敞口 - 数据概览")
    click.echo("=" * 50)
    click.echo(f"学生答案总数: {len(answers)}")

    status_counts = {}
    for a in answers:
        status_counts[a.status] = status_counts.get(a.status, 0) + 1
    for status, count in status_counts.items():
        status_name = Config.STATUS_TYPES.get(status, status)
        click.echo(f"  - {status_name}: {count}")

    click.echo(f"评分权重表: {len(weights)} 条")
    click.echo(f"误差说明记录: {len(errors)} 条")
    click.echo("=" * 50)


@cli.command()
@click.argument('answer_id')
@click.option('--reviewer', required=True, help='复核人姓名')
@click.option('--keep/--discard', default=True, help='是否保留此版')
def review(answer_id, reviewer, keep):
    """复核重复提交的答案
    """
    store = DataStore()
    success = store.review_duplicate(answer_id, reviewer, keep)
    if success:
        action = "保留" if keep else "弃用"
        click.echo(f"复核完成，{answer_id} 已{action}")
    else:
        click.echo("复核失败，未找到待复核记录")


@cli.command()
@click.argument('demo_data_dir', default='./data')
def init_demo(demo_data_dir):
    """初始化演示数据
    """
    import os
    import pandas as pd

    os.makedirs(demo_data_dir, exist_ok=True)

    answers_df = pd.DataFrame([
        {
            "answer_id": "A001",
            "student_id": "S001",
            "student_name": "张三",
            "question_id": "Q1",
            "answer_content": "这是一个完整的答案内容...",
            "score": 85.0,
            "submitted_at": "2024-01-15 10:30:00",
            "notes": "顺利记录，无异常"
        },
        {
            "answer_id": "A002",
            "student_id": "S002",
            "student_name": "李四",
            "question_id": "Q1",
            "answer_content": "第一版答案内容...",
            "score": 78.0,
            "submitted_at": "2024-01-15 11:00:00",
            "notes": "同一学生提交两版答案"
        },
        {
            "answer_id": "A003",
            "student_id": "S002",
            "student_name": "李四",
            "question_id": "Q1",
            "answer_content": "第二版修改后的答案...",
            "score": 88.0,
            "submitted_at": "2024-01-15 14:30:00",
            "notes": "重交版答案"
        },
        {
            "answer_id": "A004",
            "student_id": "S003",
            "student_name": "王五",
            "question_id": "Q2",
            "answer_content": "旧口径下的答案...",
            "score": 92.0,
            "submitted_at": "2024-01-10 09:00:00",
            "notes": "后续将从评分权重表补录"
        },
    ])

    answers_path = os.path.join(demo_data_dir, "demo_answers.xlsx")
    answers_df.to_excel(answers_path, index=False)

    weights_df = pd.DataFrame([
        {
            "weight_id": "W001",
            "question_id": "Q2",
            "dimension": "逻辑完整性",
            "weight": 0.9,
            "standard_version": "V1.0",
            "effective_date": "2024-01-01",
            "remarks": "旧口径权重系数，因评分标准调整需补录说明"
        },
    ])

    weights_path = os.path.join(demo_data_dir, "demo_weights.xlsx")
    weights_df.to_excel(weights_path, index=False)

    click.echo(f"演示数据已生成：")
    click.echo(f"  - 学生答案: {answers_path}")
    click.echo(f"  - 评分权重表: {weights_path}")
    click.echo("")
    click.echo("使用方法：")
    click.echo("  1. python cli.py import-answers ./data/demo_answers.xlsx")
    click.echo("  2. python cli.py status  # 查看检测结果")
    click.echo("  3. python cli.py import-weights ./data/demo_weights.xlsx")
    click.echo("  4. python cli.py apply-weights")
    click.echo("  5. python cli.py status  # 查看误差说明")


if __name__ == '__main__':
    cli()
