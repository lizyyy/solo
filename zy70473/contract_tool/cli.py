import json
import sys
from pathlib import Path
import click
from .demo_data import DemoDataGenerator
from .processor import ContractProcessor
from .storage import Storage


@click.group()
@click.version_option(version="0.1.0")
def cli():
    """合同日志采样处理工具"""
    pass


@cli.command()
@click.option('--include-error/--no-include-error', default=True, help='是否包含时间顺序错误的测试合同')
@click.option('--output', '-o', default=None, help='输出文件路径')
def generate_demo(include_error, output):
    """生成演示数据"""
    try:
        generator = DemoDataGenerator()
        batch = generator.get_demo_batch(include_error=include_error)
        
        if output:
            output_path = Path(output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(batch, f, ensure_ascii=False, indent=2, default=str)
            click.echo(f"演示数据已生成: {output_path}")
        else:
            click.echo(json.dumps(batch, ensure_ascii=False, indent=2, default=str))
        
        click.echo(f"共生成 {len(batch)} 条合同数据")
        sys.exit(0)
    except Exception as e:
        click.echo(f"生成演示数据失败: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
@click.argument('input_file', type=click.Path(exists=True))
@click.option('--output', '-o', default=None, help='结果输出文件路径')
def process(input_file, output):
    """处理合同提交数据"""
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            submissions = json.load(f)
        
        if not isinstance(submissions, list):
            submissions = [submissions]
        
        processor = ContractProcessor()
        result = processor.process_batch(submissions)
        
        if output:
            output_path = Path(output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2, default=str)
            click.echo(f"处理结果已保存: {output_path}")
        else:
            click.echo(json.dumps(result, ensure_ascii=False, indent=2, default=str))
        
        click.echo("\n处理统计:")
        click.echo(f"  总数: {result['total']}")
        click.echo(f"  通过: {result['success']}")
        click.echo(f"  失败: {result['failure']}")
        click.echo(f"  复用: {result['reused']}")
        click.echo(f"  冲突: {result['conflict']}")
        
        if result['failure'] > 0:
            sys.exit(2)
        elif result['conflict'] > 0:
            sys.exit(3)
        else:
            sys.exit(0)
            
    except json.JSONDecodeError as e:
        click.echo(f"JSON解析错误: {str(e)}", err=True)
        sys.exit(4)
    except Exception as e:
        click.echo(f"处理失败: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
@click.option('--output', '-o', default="output/failures_report.json", help='失败报告输出路径')
def export_failures(output):
    """导出失败记录报告"""
    try:
        processor = ContractProcessor()
        report_path = processor.export_failures_report(output)
        
        click.echo(f"失败报告已导出: {report_path}")
        
        failures = processor.storage.get_all_failures()
        click.echo(f"共 {len(failures)} 条失败记录")
        
        sys.exit(0)
    except Exception as e:
        click.echo(f"导出失败报告失败: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
@click.argument('caller')
@click.option('--output', '-o', default=None, help='输出文件路径')
def query_receipts(caller, output):
    """按调用方查询支付回执"""
    try:
        storage = Storage()
        receipts = storage.get_receipts_by_caller(caller)
        
        result = {
            "caller": caller,
            "total": len(receipts),
            "receipts": receipts
        }
        
        if output:
            output_path = Path(output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2, default=str)
            click.echo(f"查询结果已保存: {output_path}")
        else:
            click.echo(json.dumps(result, ensure_ascii=False, indent=2, default=str))
        
        click.echo(f"找到 {len(receipts)} 条记录")
        sys.exit(0)
    except Exception as e:
        click.echo(f"查询失败: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
def run_demo():
    """运行完整演示流程"""
    try:
        click.echo("=" * 50)
        click.echo("开始演示流程")
        click.echo("=" * 50)
        
        click.echo("\n1. 生成演示数据...")
        generator = DemoDataGenerator()
        batch = generator.get_demo_batch(include_error=True)
        demo_file = Path("data/demo") / "demo_batch.json"
        demo_file.parent.mkdir(parents=True, exist_ok=True)
        with open(demo_file, 'w', encoding='utf-8') as f:
            json.dump(batch, f, ensure_ascii=False, indent=2, default=str)
        click.echo(f"   已生成 {len(batch)} 条合同数据")
        
        click.echo("\n2. 处理合同数据...")
        processor = ContractProcessor()
        result = processor.process_batch(batch)
        
        click.echo("\n处理结果:")
        for res in result['results']:
            status_color = {'verified': 'green', 'rejected': 'red', 'conflict': 'yellow'}
            color = status_color.get(res['status'], 'white')
            click.echo(f"  {res['contract_id']}: {click.style(res['status'], fg=color)}")
            if res.get('error_message'):
                click.echo(f"    错误: {res['error_message']}")
        
        click.echo("\n3. 导出失败报告...")
        report_path = processor.export_failures_report()
        click.echo(f"   失败报告: {report_path}")
        
        click.echo("\n4. 异常样本已导出至: output/abnormal_samples/")
        
        click.echo("\n" + "=" * 50)
        click.echo("演示流程完成")
        click.echo("=" * 50)
        click.echo("\n返回码说明:")
        click.echo("  0 - 全部通过")
        click.echo("  2 - 存在失败项")
        click.echo("  3 - 存在冲突项")
        click.echo("  4 - 数据格式错误")
        
        if result['failure'] > 0:
            sys.exit(2)
        sys.exit(0)
        
    except Exception as e:
        click.echo(f"演示失败: {str(e)}", err=True)
        sys.exit(1)


if __name__ == '__main__':
    cli()
