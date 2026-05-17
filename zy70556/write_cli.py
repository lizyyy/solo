import os

cli_content = '''import click
import logging
import json
import os
from typing import Optional

from .scanner import RedisScanner
from .analyzer import KeyAnalyzer
from .report import ReportGenerator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@click.group()
@click.version_option(version="1.0.0")
def cli():
    """Redis Key Space Analyzer - 分析Redis键空间使用情况"""
    pass


@cli.command()
@click.option("--host", "-h", default="localhost", help="Redis主机地址")
@click.option("--port", "-p", default=6379, type=int, help="Redis端口")
@click.option("--db", "-d", default=0, type=int, help="Redis数据库编号")
@click.option("--password", "-a", help="Redis密码")
@click.option("--output", "-o", default="data/scan_result.json", help="扫描结果输出文件")
@click.option("--prefix-delimiter", default=":", help="键前缀分隔符")
@click.option("--count", default=1000, type=int, help="SCAN命令每次返回的键数量")
@click.option("--no-memory", is_flag=True, help="跳过内存使用统计（更快）")
def scan(host: str, port: int, db: int, password: Optional[str], output: str,
         prefix_delimiter: str, count: int, no_memory: bool):
    """扫描Redis键空间并保存结果"""
    try:
        os.makedirs(os.path.dirname(output), exist_ok=True)

        scanner = RedisScanner(prefix_delimiter=prefix_delimiter)
        scanner.connect(host=host, port=port, db=db, password=password)

        keys_info, bad_records = scanner.scan_keys(
            count=count,
            with_memory=not no_memory
        )

        scanner.save_to_file(keys_info, bad_records, output)
        click.echo(f"扫描完成！共扫描 {len(keys_info)} 个键，{len(bad_records)} 个失败记录")
        click.echo(f"结果已保存到: {output}")

    except Exception as e:
        click.echo(f"扫描失败: {str(e)}", err=True)
        raise click.Abort()


@cli.command()
@click.option("--input", "-i", default="data/scan_result.json", help="扫描结果输入文件")
@click.option("--output", "-o", default="reports", help="分析报告输出目录")
@click.option("--owner-mapping", "-m", help="所有者映射JSON文件路径")
@click.option("--format", "-f", "formats", multiple=True, default=["terminal", "json", "csv", "html"],
              type=click.Choice(["terminal", "json", "csv", "html"]),
              help="输出格式（可多选）")
def analyze(input: str, output: str, owner_mapping: Optional[str], formats):
    """分析扫描结果并生成报告"""
    try:
        os.makedirs(output, exist_ok=True)

        scanner = RedisScanner()
        keys_info, bad_records = scanner.load_from_file(input)
        click.echo(f"加载扫描结果: {len(keys_info)} 个键")

        mapping = {}
        if owner_mapping and os.path.exists(owner_mapping):
            mapping = KeyAnalyzer.load_owner_mapping(owner_mapping)
            click.echo(f"加载所有者映射: {len(mapping)} 个条目")

        analyzer = KeyAnalyzer(owner_mapping=mapping)
        result = analyzer.analyze(keys_info, bad_records)

        report_gen = ReportGenerator(output_dir=output)
        report_gen.generate_all(result, formats=list(formats))

        click.echo(f"分析完成！报告已保存到: {output}/")

    except FileNotFoundError as e:
        click.echo(f"文件未找到: {str(e)}", err=True)
        raise click.Abort()
    except Exception as e:
        click.echo(f"分析失败: {str(e)}", err=True)
        raise click.Abort()


@cli.command("init-mapping")
@click.option("--output", "-o", default="owner_mapping.json", help="输出文件路径")
@click.option("--force", is_flag=True, help="覆盖已存在的文件")
def init_mapping(output: str, force: bool):
    """初始化所有者映射配置文件"""
    if os.path.exists(output) and not force:
        click.confirm(f"文件 {output} 已存在，是否覆盖？", abort=True)

    default_mapping = {
        "user": "用户服务",
        "session": "会话服务",
        "cache": "缓存服务",
        "product": "商品服务",
        "order": "订单服务",
        "cart": "购物车服务",
        "config": "配置中心",
        "stats": "统计服务"
    }

    try:
        with open(output, "w", encoding="utf-8") as f:
            json.dump(default_mapping, f, indent=2, ensure_ascii=False)
        click.echo(f"所有者映射文件已创建: {output}")
        click.echo("请编辑此文件以匹配您的业务前缀")
    except Exception as e:
        click.echo(f"创建文件失败: {str(e)}", err=True)
        raise click.Abort()


if __name__ == "__main__":
    cli()
'''

with open('redis_key_analyzer/cli.py', 'w', encoding='utf-8') as f:
    f.write(cli_content)
print('cli.py written successfully')
