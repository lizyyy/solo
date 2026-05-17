import sys
import traceback
import click
from pathlib import Path

from .reader import JSONLReader
from .grouper import ErrorGrouper
from .sampler import StratifiedSampler
from .redactor import Redactor
from .reporter import Reporter


@click.command()
@click.argument("input_file", type=click.Path(exists=True, file_okay=True, dir_okay=False))
@click.option("-o", "--output-dir", type=click.Path(), default="./deadletter_output", 
              help="输出目录 (默认: ./deadletter_output)")
@click.option("-n", "--max-samples", type=int, default=100, 
              help="最大采样总数 (默认: 100)")
@click.option("--max-per-group", type=int, default=None, 
              help="每组最大采样数 (默认: 无限制)")
@click.option("--min-per-group", type=int, default=1, 
              help="每组最小采样数 (默认: 1)")
@click.option("--error-field", type=str, default="error_reason", 
              help="错误原因字段名 (默认: error_reason)")
@click.option("--key-field", type=str, default="business_key", 
              help="业务键字段名 (默认: business_key)")
@click.option("--seed", type=int, default=42, 
              help="随机种子 (默认: 42)")
@click.option("--no-redact", is_flag=True, default=False, 
              help="禁用敏感数据脱敏")
@click.option("--quiet", "-q", is_flag=True, default=False, 
              help="静默模式，不打印终端摘要")
def main(input_file, output_dir, max_samples, max_per_group, min_per_group, 
         error_field, key_field, seed, no_redact, quiet):
    """死信队列消息采样工具
    
    INPUT_FILE: 死信消息 JSONL 文件路径
    """
    try:
        reader = JSONLReader(
            error_reason_field=error_field,
            business_key_field=key_field
        )
        read_result = reader.read(input_file)

        grouper = ErrorGrouper()
        group_result = grouper.group(read_result.messages)

        sampler = StratifiedSampler(
            max_total_samples=max_samples,
            max_per_group=max_per_group,
            min_per_group=min_per_group,
            seed=seed
        )
        sample_result = sampler.sample(group_result)

        redactor = None if no_redact else Redactor()
        
        reporter = Reporter(redactor=redactor, no_redact=no_redact)

        if not quiet:
            reporter.print_terminal_summary(read_result, group_result, sample_result)

        reporter.write_outputs(output_dir, read_result, group_result, sample_result)

    except Exception as e:
        click.echo(f"\n{click.style('错误', fg='red')}: {str(e)}", err=True)
        click.echo("\n提示:", err=True)
        click.echo("  1. 请确保输入文件是有效的 JSONL 格式", err=True)
        click.echo("  2. 检查文件编码是否为 UTF-8", err=True)
        click.echo(f"  3. 使用 --error-field 指定正确的错误原因字段", err=True)
        click.echo(f"  4. 如果需要调试，可查看 errors.jsonl", err=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
