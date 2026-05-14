import asyncio
import sys
import json
import click
from typing import List

from .scanner import DeadConfigScanner
from .models.scan import ScanConfig
from .storage import StorageManager
from .reports import ReportGenerator


@click.group()
def cli():
    """死配置扫描命令行工具"""
    pass


@cli.command()
@click.argument('input_file', type=click.Path(exists=True))
@click.option('--name', '-n', default='', help='批次名称')
@click.option('--output', '-o', default='./output', help='输出目录')
@click.option('--concurrent', '-c', default=5, help='并发数')
@click.option('--timeout', '-t', default=10, help='超时时间(秒)')
@click.option('--no-cache', is_flag=True, help='不使用缓存')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
def scan(input_file: str, name: str, output: str, concurrent: int, timeout: int, no_cache: bool, verbose: bool):
    """扫描输入文件中的URL或配置项"""
    scan_config = ScanConfig(
        output_dir=output,
        concurrent=concurrent,
        timeout=timeout
    )
    
    scanner = DeadConfigScanner(scan_config)
    
    try:
        items = scanner.load_items_from_file(input_file)
    except Exception as e:
        click.echo(f"错误: 无法加载输入文件 - {e}", err=True)
        sys.exit(3)
    
    if not items:
        click.echo("警告: 输入文件中没有找到待扫描项", err=True)
        sys.exit(0)
    
    click.echo(f"找到 {len(items)} 个待扫描项")
    
    batch = scanner.create_batch(items, name=name)
    
    click.echo(f"开始扫描批次: {batch.batch_id}")
    if verbose:
        click.echo(f"规则集版本: {batch.rule_set_version}")
    
    batch, failures = asyncio.run(scanner.scan_batch(batch, use_cache=not no_cache))
    
    reports = scanner.generate_reports(batch, failures)
    
    click.echo("\n" + reports["text_summary"])
    click.echo(f"\n详细报告已保存至:")
    click.echo(f"  JSON: {reports['json_report']}")
    
    exit_code = scanner.get_exit_code(batch)
    sys.exit(exit_code)


@cli.command(name="list")
@click.option('--output', '-o', default='./output', help='输出目录')
def list_batches(output: str):
    """列出所有扫描批次"""
    storage = StorageManager(output)
    batches = storage.list_batches()
    
    if not batches:
        click.echo("没有找到扫描批次")
        return
    
    click.echo(f"找到 {len(batches)} 个扫描批次:\n")
    for batch in batches:
        counts = batch.get("summary", {}).get("counts", {})
        click.echo(f"批次ID: {batch['batch_id']}")
        click.echo(f"  名称: {batch.get('name', '(无名称)')}")
        click.echo(f"  创建时间: {batch['created_at']}")
        click.echo(f"  状态: {batch['status']}")
        click.echo(f"  统计: 总计={counts.get('total', 0)}, 无效={counts.get('invalid', 0)}, 错误={counts.get('error', 0)}")
        click.echo("")


@cli.command()
@click.argument('batch_id')
@click.option('--output', '-o', default='./output', help='输出目录')
def show(batch_id: str, output: str):
    """显示指定批次的详细信息"""
    storage = StorageManager(output)
    batch_data = storage.load_batch(batch_id)
    
    if not batch_data:
        click.echo(f"错误: 找不到批次 {batch_id}", err=True)
        sys.exit(1)
    
    click.echo(f"批次ID: {batch_data['batch_id']}")
    click.echo(f"名称: {batch_data.get('name', '(无名称)')}")
    click.echo(f"创建时间: {batch_data['created_at']}")
    click.echo(f"规则集版本: {batch_data['rule_set_version']}")
    click.echo(f"状态: {batch_data['status']}")
    click.echo("\n扫描项:")
    
    for item in batch_data.get("items", []):
        status_mark = "✓" if item["status"] == "valid" else "✗"
        click.echo(f"  {status_mark} [{item['status']}] {item['content']}")
        if item.get("error_message"):
            click.echo(f"      原因: {item['error_message']}")


@cli.command()
@click.argument('content_hash')
@click.option('--output', '-o', default='./output', help='输出目录')
def query(content_hash: str, output: str):
    """按内容摘要查询扫描记录"""
    storage = StorageManager(output)
    result = storage.query_by_content_hash(content_hash)
    
    click.echo(f"内容摘要: {content_hash}\n")
    
    if result["cached_result"]:
        click.echo("缓存结果:")
        cached = result["cached_result"]
        click.echo(f"  状态: {cached['status']}")
        click.echo(f"  最后更新: {cached.get('last_updated', '未知')}")
        if cached.get("error_message"):
            click.echo(f"  错误: {cached['error_message']}")
        click.echo("")
    
    if result["failures"]:
        click.echo(f"失败记录 ({len(result['failures'])} 条):")
        for failure in result["failures"]:
            click.echo(f"  - 批次: {failure['batch_id']}")
            click.echo(f"    来源: {failure['source']}")
            click.echo(f"    原因: {failure['failure_reason']}")
            click.echo(f"    人工审核: {'是' if failure.get('human_reviewed') else '否'}")
        click.echo("")
    
    if result["batch_appearances"]:
        click.echo(f"出现批次 ({len(result['batch_appearances'])} 个):")
        for appearance in result["batch_appearances"]:
            click.echo(f"  - {appearance['batch_id']} ({appearance.get('batch_name', '')})")
    else:
        click.echo("未找到相关记录")


@cli.command(name="failures")
@click.option('--batch-id', '-b', help='按批次过滤')
@click.option('--hash', 'content_hash', help='按内容摘要过滤')
@click.option('--output', '-o', default='./output', help='输出目录')
@click.option('--json', 'as_json', is_flag=True, help='以JSON格式输出')
def list_failures(batch_id: str, content_hash: str, output: str, as_json: bool):
    """列出失败记录"""
    storage = StorageManager(output)
    failures = storage.list_failures(batch_id=batch_id, content_hash=content_hash)
    
    if as_json:
        click.echo(json.dumps(failures, indent=2, ensure_ascii=False))
        return
    
    if not failures:
        click.echo("没有找到失败记录")
        return
    
    click.echo(f"找到 {len(failures)} 条失败记录:\n")
    for failure in failures:
        reviewed = " [已审核]" if failure.get("human_reviewed") else ""
        click.echo(f"记录ID: {failure['record_id']}{reviewed}")
        click.echo(f"  批次: {failure['batch_id']}")
        click.echo(f"  来源: {failure['source']}")
        click.echo(f"  内容: {failure['content']}")
        click.echo(f"  原因: {failure['failure_reason']}")
        click.echo(f"  摘要: {failure['content_hash']}")
        click.echo("")


@cli.command()
@click.argument('record_id')
@click.option('--comment', '-c', default='', help='审核备注')
@click.option('--output', '-o', default='./output', help='输出目录')
def review(record_id: str, comment: str, output: str):
    """标记失败记录为已人工审核"""
    storage = StorageManager(output)
    
    if storage.mark_human_reviewed(record_id, comment):
        click.echo(f"记录 {record_id} 已标记为已人工审核")
        if comment:
            click.echo(f"备注: {comment}")
    else:
        click.echo(f"错误: 找不到记录 {record_id}", err=True)
        sys.exit(1)


@cli.command()
@click.option('--output', '-o', default='./output', help='输出目录')
def demo(output: str):
    """运行演示扫描（包含边界测试用例）"""
    scan_config = ScanConfig(output_dir=output, concurrent=3, timeout=5)
    scanner = DeadConfigScanner(scan_config)
    
    demo_items = [
        {
            "source": "灰度法务证据页-示例1",
            "content": "https://httpstat.us/404",
            "metadata": {"type": "legal_evidence", "priority": "high"}
        },
        {
            "source": "灰度法务证据页-示例2",
            "content": "https://httpstat.us/200",
            "metadata": {"type": "legal_evidence"}
        },
        {
            "source": "边界案例-无效域名",
            "content": "https://nonexistent.example.invalid",
            "metadata": {"test_case": "boundary"}
        },
        {
            "source": "废弃配置模式",
            "content": "https://old-api.example.com/v1/endpoint",
            "metadata": {"test_case": "deprecated_pattern"}
        }
    ]
    
    click.echo("运行演示扫描...")
    click.echo(f"包含 {len(demo_items)} 个测试项，其中:")
    click.echo("  - 1个404失效链接（法务证据页）")
    click.echo("  - 1个有效链接")
    click.echo("  - 1个无效域名（边界案例）")
    click.echo("  - 1个废弃API模式\n")
    
    batch = scanner.create_batch(demo_items, name="演示扫描-边界测试")
    batch, failures = asyncio.run(scanner.scan_batch(batch, use_cache=False))
    
    reports = scanner.generate_reports(batch, failures)
    
    click.echo(reports["text_summary"])
    click.echo(f"\n报告已保存至: {scan_config.output_dir}/reports/")
    
    if failures:
        click.echo("\n失败项单独保存在:")
        for failure in failures:
            click.echo(f"  {scan_config.output_dir}/failures/{failure.record_id}.json")
    
    exit_code = scanner.get_exit_code(batch)
    sys.exit(exit_code)


if __name__ == "__main__":
    cli()
