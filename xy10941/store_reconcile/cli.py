import os
import sys
from datetime import timedelta
import click

from .data_loader import DataLoader
from .reconciler import Reconciler
from .reporter import Reporter


def validate_positive_int(ctx, param, value):
    if value < 0:
        raise click.BadParameter(f"{param.name}必须大于等于0")
    return value


@click.command()
@click.option(
    "--cash-dir",
    "-c",
    required=True,
    type=click.Path(exists=True, file_okay=False, dir_okay=True),
    help="收银流水CSV文件目录",
)
@click.option(
    "--payment-dir",
    "-p",
    required=True,
    type=click.Path(exists=True, file_okay=False, dir_okay=True),
    help="支付平台流水CSV文件目录",
)
@click.option(
    "--store-id",
    "-s",
    required=True,
    help="门店编号（如：STORE001）",
)
@click.option(
    "--output-dir",
    "-o",
    default="./output",
    type=click.Path(file_okay=False, dir_okay=True),
    help="输出目录（默认：./output）",
)
@click.option(
    "--time-window",
    "-t",
    default=300,
    type=int,
    callback=validate_positive_int,
    help="时间匹配窗口（秒，默认：300秒=5分钟）",
)
@click.option(
    "--amount-tolerance",
    "-a",
    default=0.01,
    type=float,
    help="金额容忍度（元，默认：0.01元）",
)
@click.option(
    "--encoding",
    "-e",
    default="utf-8",
    help="CSV文件编码（默认：utf-8）",
)
@click.option(
    "--verbose",
    "-v",
    is_flag=True,
    help="显示详细日志",
)
def main(cash_dir, payment_dir, store_id, output_dir, time_window, 
         amount_tolerance, encoding, verbose):
    """门店收银差异对账CLI工具
    
    对比收银机流水与支付平台流水，自动识别差异并生成对账报告。
    
    输入CSV文件要求：
    - 收银流水：trade_no, amount, time, is_refund, store_id
    - 支付流水：trade_no, amount, time, is_refund, platform
    """
    click.echo(click.style("=" * 60, fg="blue"))
    click.echo(click.style("门店收银差异对账工具", fg="blue", bold=True))
    click.echo(click.style("=" * 60, fg="blue"))
    click.echo()
    
    click.echo(f"门店编号: {store_id}")
    click.echo(f"收银流水目录: {cash_dir}")
    click.echo(f"支付流水目录: {payment_dir}")
    click.echo(f"输出目录: {output_dir}")
    click.echo(f"时间窗口: {time_window}秒")
    click.echo(f"金额容忍度: {amount_tolerance}元")
    click.echo()
    
    os.makedirs(output_dir, exist_ok=True)
    
    try:
        loader = DataLoader(encoding=encoding, verbose=verbose)
        
        click.echo(click.style("📂 正在读取收银流水...", fg="cyan"))
        cash_df, cash_errors = loader.load_cash_records(cash_dir, store_id)
        
        click.echo(click.style("📂 正在读取支付流水...", fg="cyan"))
        payment_df, payment_errors = loader.load_payment_records(payment_dir)
        
        click.echo()
        if cash_errors:
            click.echo(click.style(f"⚠️  收银流水发现 {len(cash_errors)} 条坏记录", fg="yellow"))
        if payment_errors:
            click.echo(click.style(f"⚠️  支付流水发现 {len(payment_errors)} 条坏记录", fg="yellow"))
        click.echo()
        
        if cash_df.empty:
            click.echo(click.style("❌ 错误：收银流水为空", fg="red"))
            sys.exit(1)
        if payment_df.empty:
            click.echo(click.style("❌ 错误：支付流水为空", fg="red"))
            sys.exit(1)
        
        click.echo(click.style(f"✅ 收银流水: {len(cash_df)} 条有效记录", fg="green"))
        click.echo(click.style(f"✅ 支付流水: {len(payment_df)} 条有效记录", fg="green"))
        click.echo()
        
        click.echo(click.style("🔍 正在执行对账匹配...", fg="cyan"))
        reconciler = Reconciler(
            time_window=timedelta(seconds=time_window),
            amount_tolerance=amount_tolerance,
            verbose=verbose
        )
        
        result = reconciler.reconcile(cash_df, payment_df, store_id)
        
        click.echo()
        click.echo(click.style("📊 对账完成！正在生成报告...", fg="cyan"))
        
        reporter = Reporter(output_dir=output_dir, store_id=store_id)
        reporter.generate_all(result, cash_errors, payment_errors)
        
        click.echo()
        click.echo(click.style("=" * 60, fg="green"))
        click.echo(click.style("🎉 对账完成！", fg="green", bold=True))
        click.echo(click.style("=" * 60, fg="green"))
        
    except Exception as e:
        click.echo()
        click.echo(click.style(f"❌ 执行失败: {str(e)}", fg="red", bold=True))
        if verbose:
            import traceback
            click.echo(click.style(traceback.format_exc(), fg="red"))
        sys.exit(1)


if __name__ == "__main__":
    main()

def run():
    main()
