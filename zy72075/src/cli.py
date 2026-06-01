import os
import sys
import click
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.models.params import CalculationParams
from src.data import DataLoader, CalculationPipeline
from src.report import ReportGenerator


@click.group()
def cli():
    """可转债转股边界计算工具"""
    pass


@cli.command()
@click.argument("input_file", type=click.Path(exists=True))
@click.option("--output-dir", "-o", default="output", help="输出目录")
@click.option("--format", "-f", "output_format", type=click.Choice(["text", "csv", "json", "all"]), default="all", help="输出格式")
@click.option("--boundary-low", default=0.0, type=float, help="溢价率下边界（%）")
@click.option("--boundary-high", default=2.0, type=float, help="溢价率上边界（%）")
def calculate(input_file, output_dir, output_format, boundary_low, boundary_high):
    """执行可转债转股边界计算"""
    click.echo(f"开始处理: {input_file}")
    click.echo(f"边界设置: 低={boundary_low}%, 高={boundary_high}%")

    params = CalculationParams(
        boundary_premium_rate_low=boundary_low,
        boundary_premium_rate_high=boundary_high,
    )

    try:
        if input_file.endswith(".csv"):
            records = DataLoader.load_csv(input_file)
        elif input_file.endswith(".json"):
            records = DataLoader.load_json(input_file)
        else:
            click.echo(f"不支持的文件格式: {input_file}", err=True)
            sys.exit(1)
    except Exception as e:
        click.echo(f"加载文件失败: {e}", err=True)
        sys.exit(1)

    click.echo(f"加载记录数: {len(records)}")

    pipeline = CalculationPipeline(params)
    results = pipeline.run(records)
    cleaning_summary = pipeline.get_cleaning_summary()

    click.echo(f"处理完成: 成功{sum(1 for r in results if r.status.value == '计算成功')}条, "
               f"失败{sum(1 for r in results if r.status.value == '计算失败')}条, "
               f"跳过{sum(1 for r in results if r.status.value == '已跳过')}条")

    generator = ReportGenerator(params)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_name = os.path.splitext(os.path.basename(input_file))[0]

    os.makedirs(output_dir, exist_ok=True)

    if output_format in ["text", "all"]:
        text_file = os.path.join(output_dir, f"{base_name}_report_{timestamp}.txt")
        generator.generate_text_report(results, cleaning_summary, text_file)
        click.echo(f"文本报告已生成: {text_file}")

    if output_format in ["csv", "all"]:
        csv_file = os.path.join(output_dir, f"{base_name}_detail_{timestamp}.csv")
        generator.generate_csv_detail(results, csv_file)
        click.echo(f"CSV明细已生成: {csv_file}")

    if output_format in ["json", "all"]:
        json_file = os.path.join(output_dir, f"{base_name}_report_{timestamp}.json")
        generator.generate_json_report(results, cleaning_summary, json_file)
        click.echo(f"JSON报告已生成: {json_file}")

    click.echo("\n--- 异常记录摘要 ---")
    abnormal = [r for r in results if r.status.value != "计算成功" or r.warnings]
    if abnormal:
        for r in abnormal:
            status_icon = "❌" if r.status.value == "计算失败" else "⚠️" if r.warnings else "⏭️"
            click.echo(f"{status_icon} 行{r.line_number}: {r.bond_code} {r.bond_name} - {r.status.value}")
            if r.error_reason:
                click.echo(f"   原因: {r.error_reason}")
    else:
        click.echo("✨ 无异常记录")

    click.echo("\n完成!")


@cli.command()
@click.option("--output-dir", "-o", default="data", help="样例数据输出目录")
def sample(output_dir):
    """生成包含各种异常情况的样例数据"""
    os.makedirs(output_dir, exist_ok=True)
    sample_file = os.path.join(output_dir, "sample_bonds.csv")

    csv_content = """bond_code,bond_name,bond_price,bond_price_unit,conversion_price,conversion_price_unit,stock_price,stock_price_unit,face_value,face_value_unit,remark
110001,示例转债1,102.5,元,10.5,元,10.8,元,100,元,正常数据，边界内
110002,示例转债2,105.0,元,10.0,元,10.0,元,100,元,溢价率5%，边界外
110003,示例转债3,98.0,元,10.0,元,10.2,元,100,元,溢价率-0.04%，接近边界
110004,示例转债4,,元,10.0,元,10.0,元,100,元,转债价格为空，应该算不出来
110005,示例转债5,102.0,元,,元,10.0,元,100,元,转股价格为空
110006,示例转债6,102.0,元,10.0,元,,元,100,元,正股价格为空
110001,示例转债1-重复,102.5,元,10.5,元,10.8,元,100,元,重复记录，代码与第2行相同
110007,单位混用转债,1020000,万元,10.5,元,10.8,元,100,元,转债价格用万元，其他用元，需要自动转换
110008,下边界转债,100.0,元,10.0,元,10.0,元,100,元,溢价率正好0%，下边界
110009,上边界转债,102.0,元,10.0,元,10.0,元,100,元,溢价率正好2%，上边界
110010,结果奇怪转债,150.0,元,50.0,元,51.0,元,100,元,转股价高得离谱，溢价率-47%，看起来正常但结果怪
110011,空单位转债,103.0,,10.0,元,10.1,元,100,元,转债价格单位为空，应默认元
110012,除零测试,100.0,元,0.0,元,10.0,元,100,元,转股价为0，应该报错
110001,示例转债1-重复2,102.5,元,10.5,元,10.8,元,100,元,第二条重复记录
"""

    with open(sample_file, "w", encoding="utf-8-sig") as f:
        f.write(csv_content)

    click.echo(f"样例数据已生成: {sample_file}")
    click.echo("\n样例数据包含以下测试场景:")
    click.echo("  ✅ 2条正常数据（边界内、边界外）")
    click.echo("  ⚠️ 3条空值数据（转债价格、转股价格、正股价格各一条）")
    click.echo("  ⚠️ 3条重复记录（同一代码出现3次）")
    click.echo("  ⚠️ 1条单位混用（转债价格用万元）")
    click.echo("  🎯 2条边界记录（正好0%和2%）")
    click.echo("  🤔 1条结果奇怪（高转股价，负溢价率很大）")
    click.echo("  ⚠️ 1条空单位")
    click.echo("  ❌ 1条除零错误")
    click.echo("\n运行计算命令测试: python -m src.cli calculate data/sample_bonds.csv")


@cli.command()
def show_params():
    """显示计算参数和备注说明"""
    params = CalculationParams()

    click.echo("=" * 60)
    click.echo("可转债转股边界计算参数说明")
    click.echo("=" * 60)
    click.echo("")

    click.echo("--- 核心参数 ---")
    click.echo(f"  溢价率下边界: {params.boundary_premium_rate_low}%")
    click.echo(f"  溢价率上边界: {params.boundary_premium_rate_high}%")
    click.echo(f"  默认面值: {params.default_face_value}{params.default_face_value_unit}")
    click.echo("")

    click.echo("--- 计算公式 ---")
    click.echo("  转股价值 = 面值 ÷ 转股价格 × 正股价格")
    click.echo("  转股溢价率 = (转债价格 - 转股价值) ÷ 转股价值 × 100%")
    click.echo("")

    click.echo("--- 参数备注（保留原始说明） ---")
    for item in params.remarks:
        click.echo(f"  [{item['key']}]")
        click.echo(f"    {item['remark']}")
        click.echo("")

    click.echo("--- 单位换算表 ---")
    for from_unit, conversions in params.unit_conversion.items():
        click.echo(f"  从{from_unit}:")
        for to_unit, factor in conversions.items():
            if from_unit != to_unit:
                click.echo(f"    → {to_unit}: ×{factor}")
    click.echo("")

    click.echo("--- 边界判断规则 ---")
    click.echo(f"  溢价率 < {params.boundary_premium_rate_low}% → 边界内，建议转股")
    click.echo(f"  溢价率 = {params.boundary_premium_rate_low}% → 临界点，正好触达下边界")
    click.echo(f"  {params.boundary_premium_rate_low}% < 溢价率 < {params.boundary_premium_rate_high}% → 边界内，关注转股机会")
    click.echo(f"  溢价率 = {params.boundary_premium_rate_high}% → 临界点，正好触达上边界")
    click.echo(f"  溢价率 > {params.boundary_premium_rate_high}% → 边界外，不建议转股")


if __name__ == "__main__":
    cli()
