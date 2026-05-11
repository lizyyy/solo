import click
import json
from pathlib import Path
from .models import SystemState
from .data_loader import DataLoader
from .engine import MigrationEngine
from .report import ReportGenerator
from .storage import StateStorage
from . import __version__


class MigrationContext:
    def __init__(self, work_dir: Path):
        self.work_dir = work_dir
        self.storage = StateStorage(work_dir)
        self.state = self.storage.load_state()
        self.current_plan = self.storage.load_plan()
        self.current_result = self.storage.load_result()

    def save(self):
        self.storage.save_state(self.state)
        if self.current_plan:
            self.storage.save_plan(self.current_plan)
        if self.current_result:
            self.storage.save_result(self.current_result)


pass_ctx = click.make_pass_decorator(MigrationContext, ensure=True)


@click.group()
@click.version_option(__version__, '-v', '--version')
@click.option('--work-dir', '-w', type=click.Path(), default='.', help='工作目录')
@click.pass_context
def main(ctx, work_dir):
    """小程序用户迁移 CLI 工具 - 安全、可靠的用户权益迁移解决方案"""
    work_path = Path(work_dir).resolve()
    ctx.obj = MigrationContext(work_path)


@main.group(name='import')
def import_group():
    """导入数据"""
    pass


@import_group.command('users')
@click.argument('file_path', type=click.Path(exists=True))
@pass_ctx
def import_users(ctx, file_path):
    """导入旧用户数据 (CSV/JSON)"""
    loader = DataLoader(ctx.state)
    count = loader.load_old_users(file_path)
    click.echo(f'✓ 成功导入 {count} 个旧用户')
    ctx.save()
    _show_stats(ctx)


@import_group.command('mapping')
@click.argument('file_path', type=click.Path(exists=True))
@pass_ctx
def import_mapping(ctx, file_path):
    """导入新用户映射 (CSV/JSON)"""
    loader = DataLoader(ctx.state)
    count = loader.load_user_mappings(file_path)
    click.echo(f'✓ 成功导入 {count} 条用户映射')
    ctx.save()
    _show_stats(ctx)


@import_group.command('points')
@click.argument('file_path', type=click.Path(exists=True))
@pass_ctx
def import_points(ctx, file_path):
    """导入积分流水 (CSV/JSON)"""
    loader = DataLoader(ctx.state)
    count = loader.load_point_records(file_path)
    click.echo(f'✓ 成功导入 {count} 条积分流水')
    ctx.save()
    _show_stats(ctx)


@import_group.command('coupons')
@click.argument('file_path', type=click.Path(exists=True))
@pass_ctx
def import_coupons(ctx, file_path):
    """导入优惠券数据 (CSV/JSON)"""
    loader = DataLoader(ctx.state)
    count = loader.load_coupons(file_path)
    click.echo(f'✓ 成功导入 {count} 张优惠券')
    ctx.save()
    _show_stats(ctx)


@import_group.command('phones')
@click.argument('file_path', type=click.Path(exists=True))
@pass_ctx
def import_phones(ctx, file_path):
    """导入手机号绑定记录 (CSV/JSON)"""
    loader = DataLoader(ctx.state)
    count = loader.load_phone_bindings(file_path)
    click.echo(f'✓ 成功导入 {count} 条手机号绑定')
    ctx.save()
    _show_stats(ctx)


@import_group.command('all')
@click.option('--users', 'users_file', type=click.Path(exists=True), help='旧用户数据文件')
@click.option('--mapping', 'mapping_file', type=click.Path(exists=True), help='用户映射文件')
@click.option('--points', 'points_file', type=click.Path(exists=True), help='积分流水文件')
@click.option('--coupons', 'coupons_file', type=click.Path(exists=True), help='优惠券文件')
@click.option('--phones', 'phones_file', type=click.Path(exists=True), help='手机号绑定文件')
@pass_ctx
def import_all(ctx, users_file, mapping_file, points_file, coupons_file, phones_file):
    """一次性导入所有数据"""
    loader = DataLoader(ctx.state)
    if users_file:
        loader.load_old_users(users_file)
        click.echo(f'✓ 导入用户数据')
    if mapping_file:
        loader.load_user_mappings(mapping_file)
        click.echo(f'✓ 导入用户映射')
    if points_file:
        loader.load_point_records(points_file)
        click.echo(f'✓ 导入积分流水')
    if coupons_file:
        loader.load_coupons(coupons_file)
        click.echo(f'✓ 导入优惠券')
    if phones_file:
        loader.load_phone_bindings(phones_file)
        click.echo(f'✓ 导入手机号绑定')
    ctx.save()
    _show_stats(ctx)


@main.command()
@click.option('--output', '-o', type=click.Path(), help='输出计划到文件')
@pass_ctx
def plan(ctx, output):
    """生成迁移计划"""
    if not ctx.state.old_users:
        click.echo('✗ 请先导入旧用户数据', err=True)
        return

    engine = MigrationEngine(ctx.state, simulate=True)
    migration_plan = engine.generate_plan()
    ctx.current_plan = migration_plan
    ctx.save()

    reporter = ReportGenerator(engine)
    report = reporter.generate_plan_report(migration_plan)
    click.echo(report)

    if output:
        plan_data = _serialize_plan(migration_plan)
        with open(output, 'w', encoding='utf-8') as f:
            json.dump(plan_data, f, ensure_ascii=False, indent=2, default=str)
        click.echo(f'✓ 计划已保存到 {output}')


@main.command()
@click.option('--real', is_flag=True, help='正式执行（默认模拟）')
@click.option('--output', '-o', type=click.Path(), help='输出结果到文件')
@pass_ctx
def execute(ctx, real, output):
    """执行迁移（默认模拟模式）"""
    if not ctx.current_plan:
        engine = MigrationEngine(ctx.state, simulate=not real)
        ctx.current_plan = engine.generate_plan()
        click.echo('→ 自动生成迁移计划...')
    else:
        engine = MigrationEngine(ctx.state, simulate=not real)

    mode = '正式执行' if real else '模拟执行'
    click.echo(f'→ 开始{mode}...')

    result = engine.execute_plan(ctx.current_plan)
    ctx.current_result = result
    ctx.state.migration_history[result.plan_id] = result
    ctx.save()

    reporter = ReportGenerator(engine)
    report = reporter.generate_result_report(result, ctx.current_plan)
    click.echo(report)

    if output:
        result_data = _serialize_result(result)
        with open(output, 'w', encoding='utf-8') as f:
            json.dump(result_data, f, ensure_ascii=False, indent=2, default=str)
        click.echo(f'✓ 结果已保存到 {output}')


@main.command()
@click.option('--corrections', '-c', type=click.Path(exists=True),
              help='修正数据文件 (JSON: {old_user_id: {phone, points_to_migrate, coupons}})')
@click.option('--real', is_flag=True, help='正式执行（默认模拟）')
@click.option('--output', '-o', type=click.Path(), help='输出结果到文件')
@pass_ctx
def retry(ctx, corrections, real, output):
    """重试失败项"""
    if not ctx.current_result or not ctx.current_result.failed_items:
        click.echo('✗ 没有失败项可以重试', err=True)
        return

    corrections_data = {}
    if corrections:
        with open(corrections, 'r', encoding='utf-8') as f:
            corrections_data = json.load(f)

    engine = MigrationEngine(ctx.state, simulate=not real)
    reporter = ReportGenerator(engine)

    click.echo(f'→ 重试 {len(ctx.current_result.failed_items)} 个失败项...')
    if corrections_data:
        click.echo(f'→ 已加载 {len(corrections_data)} 条修正数据')

    retry_result = engine.retry_failed_items(ctx.current_result, corrections_data)
    ctx.current_result = retry_result
    ctx.save()

    report = reporter.generate_result_report(retry_result, ctx.current_plan)
    click.echo(report)

    if output:
        result_data = _serialize_result(retry_result)
        with open(output, 'w', encoding='utf-8') as f:
            json.dump(result_data, f, ensure_ascii=False, indent=2, default=str)
        click.echo(f'✓ 结果已保存到 {output}')


@main.command()
@click.option('--summary', is_flag=True, help='仅显示概要')
@pass_ctx
def report(ctx, summary):
    """生成迁移报告"""
    engine = MigrationEngine(ctx.state)
    reporter = ReportGenerator(engine)

    if summary and ctx.current_result:
        summary_data = reporter.generate_equity_summary(ctx.current_result)
        click.echo('=' * 60)
        click.echo('权益迁移汇总')
        click.echo('=' * 60)
        for key, value in summary_data.items():
            click.echo(f'  {key}: {value}')
    elif ctx.current_result:
        report_text = reporter.generate_result_report(ctx.current_result, ctx.current_plan)
        click.echo(report_text)
    elif ctx.current_plan:
        report_text = reporter.generate_plan_report(ctx.current_plan)
        click.echo(report_text)
    else:
        click.echo('✗ 没有计划或结果可报告', err=True)


@main.command()
@click.option('--force', is_flag=True, help='强制清除')
@pass_ctx
def reset(ctx, force):
    """清除所有状态"""
    if not force:
        confirm = click.confirm('确定要清除所有状态吗？', default=False)
        if not confirm:
            return
    ctx.storage.clear_all()
    click.echo('✓ 已清除所有状态')


@main.command()
@pass_ctx
def status(ctx):
    """查看当前状态"""
    _show_stats(ctx)


def _show_stats(ctx):
    click.echo('')
    click.echo('─' * 50)
    click.echo('数据状态:')
    click.echo(f'  旧用户: {len(ctx.state.old_users)}')
    click.echo(f'  用户映射: {len(ctx.state.user_mappings)}')
    click.echo(f'  积分流水: {sum(len(v) for v in ctx.state.point_records.values())}')
    click.echo(f'  优惠券: {sum(len(v) for v in ctx.state.coupons.values())}')
    click.echo(f'  手机号绑定: {sum(len(v) for v in ctx.state.phone_bindings.values())}')
    click.echo(f'  已迁移用户: {len(ctx.state.migrated_users)}')
    click.echo('─' * 50)


def _serialize_plan(plan):
    return {
        'plan_id': plan.plan_id,
        'created_at': plan.created_at.isoformat() if plan.created_at else None,
        'total_users': plan.total_users,
        'pending_count': len(plan.pending_items),
        'needs_review_count': len(plan.needs_review_items),
        'validation_errors': plan.validation_errors,
        'pending_items': [_serialize_item(i) for i in plan.pending_items],
        'needs_review_items': [_serialize_item(i) for i in plan.needs_review_items],
    }


def _serialize_result(result):
    return {
        'plan_id': result.plan_id,
        'executed_at': result.executed_at.isoformat() if result.executed_at else None,
        'is_simulation': result.is_simulation,
        'total_items': result.total_items,
        'success_count': result.success_count,
        'failed_count': result.failed_count,
        'skipped_count': result.skipped_count,
        'success_items': [_serialize_item(i) for i in result.success_items],
        'failed_items': [_serialize_item(i) for i in result.failed_items],
        'skipped_items': [_serialize_item(i) for i in result.skipped_items],
    }


def _serialize_item(item):
    return {
        'old_user_id': item.old_user_id,
        'new_user_id': item.new_user_id,
        'phone': item.phone,
        'points_to_migrate': item.points_to_migrate,
        'coupons_count': len(getattr(item, 'coupons', [])),
        'status': item.status.value,
        'error_reason': item.error_reason,
        'warnings': item.warnings,
        'retries': item.retries,
        'migrated_at': item.migrated_at.isoformat() if item.migrated_at else None,
    }


if __name__ == '__main__':
    main()
