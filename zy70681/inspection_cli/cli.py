import click
import sys
from pathlib import Path
from typing import List, Optional

from .parsers import DataParser
from .rules import RuleEngine
from .photo import PhotoManager
from .report import ReportGenerator
from .models.base import InspectionSession


class InspectionCLI:
    def __init__(self):
        self.parser = DataParser()
        self.engine = RuleEngine()
        self.photo_manager = PhotoManager()
        self.report_generator = ReportGenerator()
        self.session: Optional[InspectionSession] = None

    def load_files(self, file_paths: List[str]) -> None:
        session = InspectionSession(session_id="")

        for file_path in file_paths:
            path = Path(file_path)
            if not path.exists():
                click.echo(f"错误: 文件不存在 - {file_path}", err=True)
                continue

            try:
                result = self.parser.parse_file(file_path, session)
                click.echo(f"已加载: {file_path}")
                click.echo(f"  - 门店: {result.stats.get('stores', 0)}")
                click.echo(f"  - 巡检项: {result.stats.get('items', 0)}")
                click.echo(f"  - 整改任务: {result.stats.get('tasks', 0)}")
                click.echo(f"  - 复查记录: {result.stats.get('rechecks', 0)}")
                click.echo(f"  - 扣分记录: {result.stats.get('deductions', 0)}")
                click.echo(f"  - 照片: {result.stats.get('photos', 0)}")
                if result.stats.get('errors', 0) > 0:
                    click.echo(f"  - 解析错误: {result.stats['errors']}", err=True)
            except Exception as e:
                click.echo(f"解析失败 {file_path}: {e}", err=True)

        self.session = session

    def print_summary(self) -> None:
        if not self.session:
            click.echo("没有加载数据", err=True)
            return

        result = self.engine.apply_rules(self.session)

        click.echo("\n" + "=" * 60)
        click.echo("巡检汇总")
        click.echo("=" * 60)

        summary = result.summary
        click.echo(f"门店总数: {summary['total_stores']}")
        click.echo(f"平均得分: {summary['average_score']:.2f}")
        click.echo(f"巡检项总数: {summary['total_inspection_items']}")
        click.echo(f"  - 合格: {summary['passed_items']}")
        click.echo(f"  - 不合格: {summary['failed_items']}")
        click.echo(f"整改任务总数: {summary['total_tasks']}")
        click.echo(f"复查次数: {summary['total_rechecks']}")
        click.echo(f"扣分总数: {summary['total_deductions']} 次, {summary['total_deduction_points']:.1f} 分")
        click.echo(f"逾期任务: {summary['overdue_tasks']}")
        click.echo(f"缺少照片任务: {summary['tasks_without_photo']}")
        click.echo(f"解析错误: {summary['parsing_errors']}")

    def print_store_scores(self) -> None:
        if not self.session:
            click.echo("没有加载数据", err=True)
            return

        result = self.engine.apply_rules(self.session)

        click.echo("\n" + "=" * 60)
        click.echo("门店评分")
        click.echo("=" * 60)

        for store_id, score in result.store_scores.items():
            status = "✓" if score.final_score >= 60 else "✗"
            click.echo(f"{status} [{store_id}] {score.store_name}")
            click.echo(f"  最终得分: {score.final_score:.1f} (原始: {score.percentage:.1f}%, 扣分: {score.deduction_points:.1f})")
            click.echo(f"  合格项: {score.pass_count}, 不合格项: {score.fail_count}")

    def print_warnings(self) -> None:
        if not self.session:
            click.echo("没有加载数据", err=True)
            return

        result = self.engine.apply_rules(self.session)

        click.echo("\n" + "=" * 60)
        click.echo(f"警告信息 ({len(result.warnings)} 条)")
        click.echo("=" * 60)

        for i, warning in enumerate(result.warnings, 1):
            click.echo(f"{i:3d}. {warning}")

    def print_photo_status(self) -> None:
        if not self.session:
            click.echo("没有加载数据", err=True)
            return

        photo_results = self.photo_manager.validate_all_photos(self.session)
        photo_usage = self.photo_manager.get_photo_usage(self.session)
        duplicates = self.photo_manager.find_duplicate_photos(self.session)

        click.echo("\n" + "=" * 60)
        click.echo("照片状态")
        click.echo("=" * 60)

        valid_count = sum(1 for r in photo_results.values() if r.is_valid_image)
        click.echo(f"总照片数: {len(photo_results)}")
        click.echo(f"有效照片: {valid_count}")
        click.echo(f"重复照片: {len(duplicates)} 组")

        if duplicates:
            click.echo("\n重复照片:")
            for file_hash, photo_ids in duplicates.items():
                click.echo(f"  [{file_hash[:8]}...]: {', '.join(photo_ids)}")

        invalid_photos = [
            (photo_id, result)
            for photo_id, result in photo_results.items()
            if not result.is_valid_image
        ]

        if invalid_photos:
            click.echo("\n无效照片:")
            for photo_id, result in invalid_photos:
                click.echo(f"  [{photo_id}]: {'; '.join(result.errors)}")

    def generate_report(self, format: str = "excel") -> None:
        if not self.session:
            click.echo("没有加载数据", err=True)
            return

        result = self.engine.apply_rules(self.session)
        report_path = self.report_generator.generate_full_report(
            self.session, result, self.photo_manager, format
        )

        click.echo(f"\n报告已生成: {report_path}")

    def generate_store_report(self, store_id: str) -> None:
        if not self.session:
            click.echo("没有加载数据", err=True)
            return

        if store_id not in self.session.stores:
            click.echo(f"门店不存在: {store_id}", err=True)
            return

        report_path = self.report_generator.generate_store_detail_report(
            self.session, self.engine, store_id
        )

        click.echo(f"门店报告已生成: {report_path}")

    def generate_item_report(self, item_id: str) -> None:
        if not self.session:
            click.echo("没有加载数据", err=True)
            return

        if item_id not in self.session.items:
            click.echo(f"巡检项不存在: {item_id}", err=True)
            return

        report_path = self.report_generator.generate_item_trace_report(
            self.session, self.engine, item_id
        )

        click.echo(f"巡检项追踪报告已生成: {report_path}")


pass_cli = click.make_pass_decorator(InspectionCLI, ensure=True)


@click.group()
@click.version_option(version="1.0.0", prog_name="inspection-cli")
def cli():
    """门店巡检整改复查管理命令行工具"""
    pass


@cli.command()
@click.argument('files', nargs=-1, type=click.Path(exists=True))
@pass_cli
def summary(cli_instance: InspectionCLI, files):
    """加载数据文件并显示汇总信息"""
    if not files:
        click.echo("请指定要加载的文件", err=True)
        return

    cli_instance.load_files(list(files))
    cli_instance.print_summary()
    cli_instance.print_store_scores()
    cli_instance.print_warnings()
    cli_instance.print_photo_status()


@cli.command()
@click.argument('files', nargs=-1, type=click.Path(exists=True))
@click.option('--format', '-f', type=click.Choice(['excel', 'json']), default='excel', help='报告格式')
@click.option('--output-dir', '-o', type=click.Path(), help='输出目录')
@pass_cli
def report(cli_instance: InspectionCLI, files, format, output_dir):
    """生成完整的巡检报告"""
    if not files:
        click.echo("请指定要加载的文件", err=True)
        return

    if output_dir:
        cli_instance.report_generator = ReportGenerator(output_dir)

    cli_instance.load_files(list(files))
    cli_instance.print_summary()
    cli_instance.generate_report(format)


@cli.command(name="store-report")
@click.argument('files', nargs=-1, type=click.Path(exists=True))
@click.option('--store-id', '-s', required=True, help='门店编号')
@click.option('--output-dir', '-o', type=click.Path(), help='输出目录')
@pass_cli
def store_report(cli_instance: InspectionCLI, files, store_id, output_dir):
    """生成指定门店的详细报告"""
    if not files:
        click.echo("请指定要加载的文件", err=True)
        return

    if output_dir:
        cli_instance.report_generator = ReportGenerator(output_dir)

    cli_instance.load_files(list(files))
    cli_instance.generate_store_report(store_id)


@cli.command(name="item-report")
@click.argument('files', nargs=-1, type=click.Path(exists=True))
@click.option('--item-id', '-i', required=True, help='巡检项编号')
@click.option('--output-dir', '-o', type=click.Path(), help='输出目录')
@pass_cli
def item_report(cli_instance: InspectionCLI, files, item_id, output_dir):
    """生成指定巡检项的追踪报告"""
    if not files:
        click.echo("请指定要加载的文件", err=True)
        return

    if output_dir:
        cli_instance.report_generator = ReportGenerator(output_dir)

    cli_instance.load_files(list(files))
    cli_instance.generate_item_report(item_id)


@cli.command()
@click.argument('files', nargs=-1, type=click.Path(exists=True))
@pass_cli
def warnings(cli_instance: InspectionCLI, files):
    """仅显示警告信息"""
    if not files:
        click.echo("请指定要加载的文件", err=True)
        return

    cli_instance.load_files(list(files))
    cli_instance.print_warnings()


@cli.command()
@click.argument('files', nargs=-1, type=click.Path(exists=True))
@pass_cli
def photos(cli_instance: InspectionCLI, files):
    """检查照片状态"""
    if not files:
        click.echo("请指定要加载的文件", err=True)
        return

    cli_instance.load_files(list(files))
    cli_instance.print_photo_status()


@cli.command()
@click.argument('files', nargs=-1, type=click.Path(exists=True))
@pass_cli
def scores(cli_instance: InspectionCLI, files):
    """显示门店评分"""
    if not files:
        click.echo("请指定要加载的文件", err=True)
        return

    cli_instance.load_files(list(files))
    cli_instance.print_store_scores()


if __name__ == '__main__':
    cli()
