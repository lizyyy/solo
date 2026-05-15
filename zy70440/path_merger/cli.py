import click
import json
from pathlib import Path
from datetime import datetime

from . import __version__
from .models import PathRecord, QueryFilter, PathStatus, IssueType
from .merger import PathMerger
from .cache import CacheManager
from .query import QueryEngine
from .reporter import ReportGenerator
from .sample_data import generate_sample_records, save_sample_data, load_sample_data


@click.group()
@click.version_option(version=__version__, prog_name="path-merger")
def cli():
    """路径归并工具 - 处理售后录音权限路径归并"""
    pass


@cli.command()
@click.option('--batch-id', default=None, help='批次ID，默认自动生成')
@click.option('--input', '-i', type=click.Path(exists=True), help='输入JSON文件路径')
@click.option('--use-cache/--no-cache', default=True, help='是否使用缓存')
@click.option('--generate-report/--no-report', default=True, help='是否生成报告')
@click.option('--sample', '-s', is_flag=True, help='使用样例数据进行测试')
def process(batch_id, input, use_cache, generate_report, sample):
    """处理路径归并"""

    if not batch_id:
        batch_id = f"BATCH_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    if sample:
        click.echo(f"使用样例数据...")
        records = generate_sample_records(batch_id)
    elif input:
        click.echo(f"加载数据文件: {input}")
        records = load_sample_data(input)
    else:
        click.echo("错误: 请指定 --input 或 --sample 参数")
        return

    click.echo(f"处理批次: {batch_id}")
    click.echo(f"记录数量: {len(records)}")

    merger = PathMerger()
    query_engine = QueryEngine()
    reporter = ReportGenerator()

    if use_cache:
        cache_manager = CacheManager()
        result = cache_manager.process_batch_with_cache(records, batch_id, merger)
    else:
        result = merger.process_batch(records, batch_id)

    query_engine.save_result(result)

    reporter.print_summary(result)

    if generate_report:
        report_path = reporter.save_report(result)
        click.echo(f"报告已生成: {report_path}")

    return result


@cli.command()
@click.option('--batch-id', help='按批次ID过滤')
@click.option('--status', type=click.Choice([s.value for s in PathStatus]), help='按状态过滤')
@click.option('--issue-type', type=click.Choice([i.value for i in IssueType]), help='按问题类型过滤')
@click.option('--agent-id', help='按坐席ID过滤')
@click.option('--format', type=click.Choice(['table', 'json', 'brief']), default='table', help='输出格式')
def query(batch_id, status, issue_type, agent_id, format):
    """查询处理结果"""

    query_engine = QueryEngine()

    filter = QueryFilter(
        batch_id=batch_id,
        status=PathStatus(status) if status else None,
        issue_type=IssueType(issue_type) if issue_type else None,
        agent_id=agent_id
    )

    records = query_engine.query(filter)

    if not records:
        click.echo("未找到匹配的记录")
        return

    if format == 'json':
        data = [r.model_dump() for r in records]
        click.echo(json.dumps(data, ensure_ascii=False, indent=2, default=str))
    elif format == 'brief':
        for r in records:
            click.echo(f"{r.record_id} | {r.status.value:8s} | {r.recording_id} | 问题: {len(r.issues)}")
    else:
        click.echo("-" * 100)
        click.echo(f"{'记录ID':<30} {'状态':<10} {'录音ID':<25} {'问题数':<8} {'耗时(ms)':<10}")
        click.echo("-" * 100)
        for r in records:
            click.echo(f"{r.record_id:<30} {r.status.value:<10} {r.recording_id:<25} {len(r.issues):<8} {r.execution_time_ms:<10.2f}")
        click.echo("-" * 100)
        click.echo(f"总计: {len(records)} 条记录")


@cli.command()
@click.option('--batch-id', required=True, help='批次ID')
@click.option('--output', '-o', help='输出文件路径')
def report(batch_id, output):
    """生成报告"""

    reporter = ReportGenerator()
    result = reporter.query_engine.load_result(batch_id)

    if not result:
        click.echo(f"错误: 批次 {batch_id} 未找到")
        return

    report_content = reporter.generate_report(result)

    if output:
        with open(output, 'w', encoding='utf-8') as f:
            f.write(report_content)
        click.echo(f"报告已保存到: {output}")
    else:
        click.echo(report_content)


@cli.command()
@click.option('--batch-id', help='按批次ID统计，不指定则统计全部')
@click.option('--detail/--no-detail', default=False, help='是否显示详细统计')
def stats(batch_id, detail):
    """查看统计信息"""

    query_engine = QueryEngine()
    stats = query_engine.get_statistics(batch_id)

    if batch_id:
        click.echo(f"批次 {batch_id} 统计:")
    else:
        click.echo("全局统计:")

    click.echo(f"  总记录数: {stats['total']}")
    click.echo(f"  按状态分布:")
    for status, count in stats['by_status'].items():
        click.echo(f"    {status}: {count}")

    if detail:
        click.echo(f"  按问题类型分布:")
        for issue_type, count in stats['by_issue_type'].items():
            click.echo(f"    {issue_type}: {count}")
        click.echo(f"  跨天录音数: {stats['cross_day_count']}")
        click.echo(f"  人工修正数: {stats['manual_fix_count']}")
        if 'avg_execution_time_ms' in stats:
            click.echo(f"  平均执行时间: {stats['avg_execution_time_ms']:.2f} ms")


@cli.command()
@click.option('--batch-id', help='只清除指定批次的缓存')
@click.option('--force', '-f', is_flag=True, help='强制清除，不提示')
def clear_cache(batch_id, force):
    """清除缓存"""

    if not force:
        if batch_id:
            msg = f"确定要清除批次 {batch_id} 的缓存吗？"
        else:
            msg = "确定要清除所有缓存吗？此操作不可恢复！"
        click.confirm(msg, abort=True)

    cache_manager = CacheManager()
    cache_manager.clear_cache(batch_id)

    if batch_id:
        click.echo(f"批次 {batch_id} 的缓存已清除")
    else:
        click.echo("所有缓存已清除")


@cli.command()
@click.option('--output', '-o', help='输出文件路径')
def gen_sample(output):
    """生成样例数据"""

    records = generate_sample_records()
    path = save_sample_data(records, output_dir='.' if output else './data/samples')

    if output:
        out_path = Path(output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        data = [r.model_dump() for r in records]
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
        path = output

    click.echo(f"已生成 {len(records)} 条样例记录")
    click.echo(f"保存位置: {path}")
    click.echo("")
    click.echo("样例数据包含:")
    click.echo("  - 多条正常权限路径记录")
    click.echo("  - 权限被误放大的问题记录（可检测）")
    click.echo("  - 跨天售后录音记录")
    click.echo("  - 数据缺失记录")
    click.echo("  - 完全匹配记录")
    click.echo("  - 人工修正记录")


@cli.command()
@click.argument('record_id')
@click.argument('fixed_path', nargs=-1, required=True)
@click.option('--reason', '-r', required=True, help='修正原因')
@click.option('--batch-id', help='批次ID（用于查询）')
def fix(record_id, fixed_path, reason, batch_id):
    """人工修正记录"""

    query_engine = QueryEngine()
    reporter = ReportGenerator()

    filter = QueryFilter(record_id=record_id, batch_id=batch_id)
    records = query_engine.query(filter)

    if not records:
        click.echo(f"错误: 记录 {record_id} 未找到")
        return

    record = records[0]
    fixed_path_list = list(fixed_path)

    PathMerger.apply_manual_fix(record, fixed_path_list, reason)

    result = query_engine.load_result(record.batch_id)
    if result:
        for i, r in enumerate(result.records):
            if r.record_id == record_id:
                result.records[i] = record
                break
        query_engine.save_result(result)

    click.echo(f"记录 {record_id} 已人工修正")
    click.echo(f"修正原因: {reason}")
    click.echo(f"修正后路径:")
    for i, path in enumerate(fixed_path_list, 1):
        click.echo(f"  {i}. {path}")


@cli.command()
def self_test():
    """运行自检，验证边界情况"""

    click.echo("=" * 60)
    click.echo("路径归并工具 - 自检程序")
    click.echo("=" * 60)
    click.echo("")

    merger = PathMerger()
    tests_passed = 0
    tests_total = 0

    click.echo("测试 1: 完全匹配的路径")
    tests_total += 1
    record = PathRecord(
        record_id="TEST_001",
        batch_id="TEST_BATCH",
        source="test",
        recording_id="TEST_REC_001",
        agent_id="TEST_AGENT",
        customer_id="TEST_CUST",
        start_time=datetime.now(),
        end_time=datetime.now(),
        permission_path=["/a/b", "/a/c", "/d"],
        actual_path=["/a/b", "/a/c", "/d"]
    )
    result = merger.merge_paths(record)
    if result.status == PathStatus.SUCCESS and len(result.issues) == 0:
        click.echo("  ✓ 通过")
        tests_passed += 1
    else:
        click.echo(f"  ✗ 失败: {result.status}, 问题数: {len(result.issues)}")

    click.echo("测试 2: 权限放大检测")
    tests_total += 1
    record = PathRecord(
        record_id="TEST_002",
        batch_id="TEST_BATCH",
        source="test",
        recording_id="TEST_REC_002",
        agent_id="TEST_AGENT",
        customer_id="TEST_CUST",
        start_time=datetime.now(),
        end_time=datetime.now(),
        permission_path=["/a/b"],
        actual_path=["/a/b", "/a/c", "/admin/secret"]
    )
    result = merger.merge_paths(record)
    has_over_grant = any(i.get('type') == IssueType.PERMISSION_OVER_GRANT for i in result.issues)
    if has_over_grant:
        click.echo("  ✓ 通过 - 成功检测到权限放大")
        tests_passed += 1
    else:
        click.echo("  ✗ 失败 - 未检测到权限放大")

    click.echo("测试 3: 跨天录音检测")
    tests_total += 1
    record = PathRecord(
        record_id="TEST_003",
        batch_id="TEST_BATCH",
        source="test",
        recording_id="TEST_REC_003",
        agent_id="TEST_AGENT",
        customer_id="TEST_CUST",
        start_time=datetime(2024, 5, 15, 23, 45, 0),
        end_time=datetime(2024, 5, 16, 0, 15, 0),
        permission_path=["/a/b"],
        actual_path=["/a/b"]
    )
    result = merger.merge_paths(record)
    has_cross_day = any(i.get('type') == IssueType.CROSS_DAY_BOUNDARY for i in result.issues)
    if has_cross_day:
        click.echo("  ✓ 通过 - 成功检测到跨天录音")
        tests_passed += 1
    else:
        click.echo("  ✗ 失败 - 未检测到跨天录音")

    click.echo("测试 4: 数据缺失检测")
    tests_total += 1
    record = PathRecord(
        record_id="TEST_004",
        batch_id="TEST_BATCH",
        source="test",
        recording_id="TEST_REC_004",
        agent_id="TEST_AGENT",
        customer_id="TEST_CUST",
        start_time=datetime.now(),
        end_time=datetime.now(),
        permission_path=["/a/b"],
        actual_path=[]
    )
    result = merger.merge_paths(record)
    has_missing = any(i.get('type') == IssueType.MISSING_DATA for i in result.issues)
    if has_missing:
        click.echo("  ✓ 通过 - 成功检测到数据缺失")
        tests_passed += 1
    else:
        click.echo("  ✗ 失败 - 未检测到数据缺失")

    click.echo("测试 5: 路径层级归并逻辑")
    tests_total += 1
    record = PathRecord(
        record_id="TEST_005",
        batch_id="TEST_BATCH",
        source="test",
        recording_id="TEST_REC_005",
        agent_id="TEST_AGENT",
        customer_id="TEST_CUST",
        start_time=datetime.now(),
        end_time=datetime.now(),
        permission_path=["/a", "/b/c"],
        actual_path=["/a/b", "/b", "/b/c/d"]
    )
    result = merger.merge_paths(record)
    if result.merged_path and len(result.merged_path) > 0:
        click.echo(f"  ✓ 通过 - 归并后路径数: {len(result.merged_path)}")
        tests_passed += 1
    else:
        click.echo("  ✗ 失败 - 归并逻辑异常")

    click.echo("测试 6: 人工修正功能")
    tests_total += 1
    record = PathRecord(
        record_id="TEST_006",
        batch_id="TEST_BATCH",
        source="test",
        recording_id="TEST_REC_006",
        agent_id="TEST_AGENT",
        customer_id="TEST_CUST",
        start_time=datetime.now(),
        end_time=datetime.now(),
        permission_path=["/a/b"],
        actual_path=["/a/b", "/a/c"]
    )
    result = merger.merge_paths(record)
    fixed = PathMerger.apply_manual_fix(result, ["/a/b", "/a/c"], "测试人工修正")
    if fixed.is_manual_fix and fixed.fix_reason == "测试人工修正":
        click.echo("  ✓ 通过 - 人工修正功能正常")
        tests_passed += 1
    else:
        click.echo("  ✗ 失败 - 人工修正功能异常")

    click.echo("")
    click.echo("=" * 60)
    click.echo(f"自检结果: {tests_passed}/{tests_total} 通过")
    if tests_passed == tests_total:
        click.echo("所有测试通过！✓")
    else:
        click.echo(f"有 {tests_total - tests_passed} 个测试未通过！")
    click.echo("=" * 60)


if __name__ == "__main__":
    cli()
