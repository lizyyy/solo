import os
import sys
import time
import traceback
from pathlib import Path
import click

from .parser import HostListParser
from .scanner import HostScanner
from .reporter import ResultAggregator, ConsoleReporter, FileReporter
from . import __version__


def print_error(message: str, show_traceback: bool = False):
    click.secho(f"错误: {message}", fg="red", err=True)
    if show_traceback:
        click.secho(traceback.format_exc(), fg="yellow", dim=True, err=True)


@click.group()
@click.version_option(version=__version__, prog_name="host-scanner")
def cli():
    """远程主机清单CLI - 并发探测主机连通性，生成巡检报告
    
    支持清单读取、并发探测、标签分组、失败归因、报告导出
    """
    pass


@cli.command()
@click.argument("hostfile", type=click.Path(exists=True, readable=True))
@click.option("-p", "--port", type=int, default=22, help="默认端口号 (默认: 22)")
@click.option("-t", "--timeout", type=float, default=3.0, help="连接超时时间(秒) (默认: 3.0)")
@click.option("-c", "--concurrency", type=int, default=50, help="最大并发数 (默认: 50)")
@click.option("-o", "--output-dir", type=click.Path(), default="./reports", help="输出目录 (默认: ./reports)")
@click.option("--no-console", is_flag=True, help="不输出终端摘要")
@click.option("--json/--no-json", default=True, help="是否输出JSON文件 (默认: 是)")
@click.option("--csv/--no-csv", default=True, help="是否输出CSV文件 (默认: 是)")
@click.option("--markdown/--no-markdown", default=True, help="是否输出Markdown报告 (默认: 是)")
@click.option("--verbose", "-v", is_flag=True, help="显示详细错误信息")
def scan(
    hostfile: str,
    port: int,
    timeout: float,
    concurrency: int,
    output_dir: str,
    no_console: bool,
    json: bool,
    csv: bool,
    markdown: bool,
    verbose: bool
):
    """扫描主机清单文件并生成报告
    
    HOSTFILE: 主机清单文件路径
    """
    try:
        click.secho(f"📋 读取主机清单: {hostfile}", fg="cyan")
        parser = HostListParser(default_port=port)
        hosts, bad_entries = parser.parse_file(hostfile)
        
        click.secho(f"   解析完成: {len(hosts)} 个有效主机, {len(bad_entries)} 个坏数据", fg="cyan")
        
        if not hosts and not bad_entries:
            click.secho("警告: 主机清单文件为空", fg="yellow")
            return
        
        click.secho(f"🔍 开始连通性探测 (超时: {timeout}s, 并发: {concurrency})", fg="cyan")
        
        start_time = time.time()
        scanner = HostScanner(timeout=timeout, max_concurrent=concurrency)
        results = scanner.run_scan(hosts)
        scan_duration = time.time() - start_time
        
        click.secho(f"   探测完成: {scan_duration:.2f}s", fg="cyan")
        
        summary = ResultAggregator.calculate_summary(results, bad_entries, scan_duration)
        
        if not no_console:
            click.echo()
            reporter = ConsoleReporter()
            reporter.print_summary(summary)
        
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        base_name = f"scan_report_{timestamp}"
        
        exported_files = []
        
        if json:
            json_path = output_path / f"{base_name}.json"
            FileReporter.export_json(summary, str(json_path))
            exported_files.append(f"JSON: {json_path}")
        
        if csv:
            csv_path = output_path / f"{base_name}.csv"
            FileReporter.export_csv(summary, str(csv_path))
            exported_files.append(f"CSV:  {csv_path}")
        
        if markdown:
            md_path = output_path / f"{base_name}.md"
            FileReporter.export_markdown(summary, str(md_path))
            exported_files.append(f"MD:   {md_path}")
        
        if exported_files:
            click.echo()
            click.secho("📄 导出报告:", fg="green")
            for f in exported_files:
                click.secho(f"   {f}", fg="green")
        
        if bad_entries:
            click.echo()
            click.secho(f"⚠️  注意: 发现 {len(bad_entries)} 个坏数据条目已保留在报告中", fg="yellow")
        
        sys.exit(0 if summary.failed == 0 and summary.bad_entries == 0 else 1)
        
    except FileNotFoundError as e:
        print_error(f"文件不存在: {e.filename}", verbose)
        sys.exit(2)
    except PermissionError as e:
        print_error(f"权限不足: {e.filename}", verbose)
        sys.exit(2)
    except KeyboardInterrupt:
        click.secho("\n⏹️  用户中断扫描", fg="yellow")
        sys.exit(130)
    except Exception as e:
        print_error(f"扫描过程发生错误: {str(e)}", verbose)
        sys.exit(3)


@cli.command()
@click.argument("hostfile", type=click.Path(exists=True, readable=True))
@click.option("-p", "--port", type=int, default=22, help="默认端口号 (默认: 22)")
def validate(hostfile: str, port: int):
    """验证主机清单文件格式
    
    HOSTFILE: 主机清单文件路径
    """
    try:
        click.secho(f"🔍 验证主机清单: {hostfile}", fg="cyan")
        parser = HostListParser(default_port=port)
        hosts, bad_entries = parser.parse_file(hostfile)
        
        click.echo()
        click.secho(f"✅ 有效主机: {len(hosts)}", fg="green")
        click.secho(f"⚠️  坏数据: {len(bad_entries)}", fg="yellow")
        
        if bad_entries:
            click.echo()
            click.secho("坏数据详情:", fg="yellow")
            for bad in bad_entries:
                raw = bad.raw_line if bad.raw_line else "(空行)"
                click.secho(f"  行 {bad.line_number}: {bad.error_reason} - `{raw}`", fg="yellow")
        
        if hosts:
            click.echo()
            click.secho("主机列表预览:", fg="green")
            for host in hosts[:10]:
                tags = ", ".join(host.tags) if host.tags else "-"
                click.secho(f"  {host.hostname}:{host.port} [{tags}]", fg="green")
            if len(hosts) > 10:
                click.secho(f"  ... 还有 {len(hosts) - 10} 个主机", fg="green", dim=True)
        
        sys.exit(0 if not bad_entries else 1)
        
    except Exception as e:
        print_error(f"验证失败: {str(e)}", True)
        sys.exit(2)


@cli.command()
def template():
    """生成主机清单模板文件"""
    template_content = """# 主机清单模板
# 格式: 主机名 [端口] [标签1,标签2,...]
# 分隔符支持: 空格 逗号 分号 冒号

# 仅主机名 (使用默认端口22)
server01.example.com
server02.example.com

# 主机名 + 端口
web01.example.com 80
web02.example.com 443

# 主机名 + 端口 + 标签
db01.example.com 3306 database,production
db02.example.com 3306 database,staging
cache01.example.com 6379 redis,production

# 空行会被标记为坏数据
# 格式错误的行也会被保留
这是一行格式错误的数据
"""
    
    template_file = Path("hosts_template.txt")
    if template_file.exists():
        if not click.confirm(f"文件 {template_file} 已存在，是否覆盖？"):
            click.echo("操作取消")
            return
    
    template_file.write_text(template_content, encoding="utf-8")
    click.secho(f"✅ 模板文件已生成: {template_file}", fg="green")
    click.secho("   请按照模板格式填写主机清单", fg="dim")


def main():
    try:
        cli()
    except Exception as e:
        print_error(f"程序异常: {str(e)}", True)
        sys.exit(255)


if __name__ == "__main__":
    main()
