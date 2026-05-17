import click
import logging
import json
import os
from pathlib import Path

from .scanner import RedisScanner
from .analyzer import KeyAnalyzer
from .report import ReportGenerator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@click.group()
@click.version_option(version="0.1.0")
def cli():
    """Redis Key Space Analyzer - 分析Redis键空间使用情况"""
    pass


@cli.command()
@click.option("--host", "-h", default="localhost", help="Redis主机地址")
@click.option("--port", "-p", type=int, default=6379, help="Redis端口")
@click.option("--db", "-d", type=int, default=0, help="Redis数据库编号")
@click.option("--password", "-a", default=None, help="Redis密码")
@click.option("--pattern", "-k", default="*", help="键匹配模式，默认为*")
@click.option("--batch-size", type=int, default=1000, help="SCAN命令每次返回的键数量")
@click.option("--max-keys", "-m", type=int, default=None, help="最大扫描键数，适用于大型Redis")
@click.option("--output", "-o", default=None, help="扫描结果输出文件路径（JSON格式）")
@click.option("--owner-mapping", default=None, help="Owner映射JSON文件路径")
@click.option("--output-dir", default="redis_key_analyzer/reports", help="报告输出目录")
def scan(host, port, db, password, pattern, batch_size, max_keys, output, owner_mapping, output_dir):
    """扫描Redis键空间并生成分析报告"""
    click.echo(click.style(f"🔍 开始扫描Redis: {host}:{port}/{db}", fg="blue"))
    
    scanner = RedisScanner(host=host, port=port, db=db, password=password)
    
    if not scanner.connect():
        click.echo(click.style("❌ 无法连接到Redis，请检查连接参数", fg="red"))
        return
    
    keys_info, bad_records = scanner.scan_keys(pattern=pattern, batch_size=batch_size, max_keys=max_keys)
    
    if not keys_info:
        click.echo(click.style("⚠️ 未扫描到任何键", fg="yellow"))
        return
    
    click.echo(click.style(f"✅ 扫描完成: {len(keys_info)} 个键, {len(bad_records)} 条异常记录", fg="green"))
    
    owner_map = {}
    if owner_mapping:
        owner_map = KeyAnalyzer.load_owner_mapping(owner_mapping)
    
    analyzer = KeyAnalyzer(owner_mapping=owner_map)
    result = analyzer.analyze(keys_info, bad_records)
    
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    if output:
        output_path = Path(output_dir) / output
    else:
        timestamp = result.scan_timestamp.replace(":", "-").replace(".", "-")
        output_path = Path(output_dir) / f"redis_analysis_{timestamp}"
    
    reporter = ReportGenerator(output_dir=output_dir)
    reporter.generate_all(result, base_filename=str(output_path))
    
    click.echo(click.style(f"🎉 报告已生成到目录: {output_dir}", fg="green"))


@cli.command()
@click.argument("input_file", type=click.Path(exists=True))
@click.option("--owner-mapping", default=None, help="Owner映射JSON文件路径")
@click.option("--output", "-o", default=None, help="分析结果输出文件路径（不含扩展名）")
@click.option("--output-dir", default="redis_key_analyzer/reports", help="报告输出目录")
def analyze(input_file, owner_mapping, output, output_dir):
    """从已保存的扫描文件进行离线分析"""
    click.echo(click.style(f"📂 加载扫描数据: {input_file}", fg="blue"))
    
    scanner = RedisScanner()
    keys_info, bad_records = scanner.load_from_file(input_file)
    
    click.echo(click.style(f"✅ 加载完成: {len(keys_info)} 个键, {len(bad_records)} 条异常记录", fg="green"))
    
    owner_map = {}
    if owner_mapping:
        owner_map = KeyAnalyzer.load_owner_mapping(owner_mapping)
    
    analyzer = KeyAnalyzer(owner_mapping=owner_map)
    result = analyzer.analyze(keys_info, bad_records)
    
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    if output:
        output_path = Path(output_dir) / output
    else:
        timestamp = result.scan_timestamp.replace(":", "-").replace(".", "-")
        output_path = Path(output_dir) / f"redis_analysis_{timestamp}"
    
    reporter = ReportGenerator(output_dir=output_dir)
    reporter.generate_all(result, base_filename=str(output_path))
    
    click.echo(click.style(f"🎉 报告已生成到目录: {output_dir}", fg="green"))


@cli.command()
@click.option("--output", "-o", default="owner_mapping.json", help="输出文件路径")
@click.option("--force", is_flag=True, help="覆盖已存在的文件")
def init_mapping(output, force):
    """初始化Owner映射配置文件模板"""
    if os.path.exists(output) and not force:
        click.echo(click.style(f"⚠️ 文件已存在: {output}", fg="yellow"))
        click.echo("使用 --force 参数覆盖")
        return
    
    template = {
        "user:": "用户服务",
        "order:": "订单服务",
        "product:": "商品服务",
        "cache:": "缓存服务",
        "session:": "会话服务",
        "stats:": "统计服务",
        "api:rate:limit:": "API限流",
        "temp:": "临时数据"
    }
    
    with open(output, 'w', encoding='utf-8') as f:
        json.dump(template, f, ensure_ascii=False, indent=2)
    
    click.echo(click.style(f"✅ Owner映射模板已生成: {output}", fg="green"))
    click.echo("请根据实际需求修改前缀和对应的服务/负责人名称")


def main():
    """命令行入口函数"""
    cli()


if __name__ == "__main__":
    main()
