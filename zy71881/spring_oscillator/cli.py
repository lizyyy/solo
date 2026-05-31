"""命令行接口。

提供简单易用的命令行界面，让一线同事可以直接运行处理流程。
"""

import sys
from pathlib import Path
from typing import List, Optional

import click

from .pipeline import SpringOscillatorPipeline
from .errors import SpringOscillatorError


@click.group()
@click.version_option(version="1.0.0", prog_name="spring-fit")
def cli():
    """弹簧振子实验数据处理工具。

    用于处理弹簧振子实验数据，支持数据导入、清洗、拟合和批改表生成。
    """
    pass


@cli.command()
@click.argument("experiment_file", type=click.Path(exists=True, dir_okay=False))
@click.option(
    "--calibration", "-c",
    type=click.Path(exists=True, dir_okay=False),
    help="标定表文件路径（可选）",
)
@click.option(
    "--late-attachment", "-a",
    multiple=True,
    type=click.Path(exists=True, dir_okay=False),
    help="晚到附件文件路径，可多次指定",
)
@click.option(
    "--fit-method", "-m",
    type=click.Choice(["nonlinear", "linear"]),
    default="nonlinear",
    help="拟合方法：nonlinear（非线性最小二乘）或 linear（线性拟合T² vs m），默认 nonlinear",
)
@click.option(
    "--student-name", "-n",
    default="",
    help="学生姓名",
)
@click.option(
    "--student-id", "-i",
    default="",
    help="学号",
)
@click.option(
    "--output-dir", "-o",
    type=click.Path(file_okay=False),
    default="./output",
    help="输出目录，默认 ./output",
)
@click.option(
    "--format", "-f",
    "formats",
    multiple=True,
    type=click.Choice(["excel", "csv", "json"]),
    default=["excel", "json"],
    help="导出格式，可多次指定，默认 excel 和 json",
)
@click.option(
    "--quiet", "-q",
    is_flag=True,
    help="安静模式，减少输出信息",
)
def process(
    experiment_file: str,
    calibration: Optional[str],
    late_attachment: List[str],
    fit_method: str,
    student_name: str,
    student_id: str,
    output_dir: str,
    formats: List[str],
    quiet: bool,
):
    """处理弹簧振子实验数据并生成批改表。

    EXPERIMENT_FILE: 实验数据文件路径（CSV或Excel）
    """
    try:
        pipeline = SpringOscillatorPipeline(output_dir=output_dir)

        result = pipeline.run(
            experiment_file=experiment_file,
            calibration_file=calibration,
            late_attachment_files=list(late_attachment) if late_attachment else None,
            fit_method=fit_method,
            student_name=student_name,
            student_id=student_id,
            export_formats=list(formats),
        )

        if not quiet:
            pipeline.print_summary(result)

        click.secho("\n🎉 处理成功完成！", fg="green", bold=True)
        click.echo(f"📁 输出目录: {Path(output_dir).resolve()}")

        sys.exit(0)

    except SpringOscillatorError as e:
        click.secho(str(e), fg="red")
        sys.exit(1)
    except Exception as e:
        click.secho(f"\n❌ 发生未预期的错误: {e}", fg="red", bold=True)
        click.echo("请检查数据文件是否正确，或联系技术支持。")
        sys.exit(1)


@cli.command()
@click.option(
    "--output-dir", "-o",
    type=click.Path(file_okay=False),
    default="./examples",
    help="示例数据输出目录，默认 ./examples",
)
def generate_examples(output_dir: str):
    """生成示例数据文件，帮助理解所需格式。"""
    try:
        from . import examples
        files = examples.generate_example_files(output_dir)

        click.secho("\n✅ 示例数据生成成功！", fg="green", bold=True)
        click.echo("生成的文件：")
        for f in files:
            click.echo(f"  📄 {f}")
        click.echo("\n💡 使用以下命令处理示例数据：")
        click.echo(f"   spring-fit process {Path(output_dir) / 'experiment_data.csv'}")

        sys.exit(0)

    except Exception as e:
        click.secho(f"❌ 生成示例数据失败: {e}", fg="red")
        sys.exit(1)


@cli.command()
def explain_errors():
    """显示常见错误说明及解决方法。"""
    click.echo("\n" + "=" * 60)
    click.secho("📖 常见问题及解决方法", fg="cyan", bold=True)
    click.echo("=" * 60)

    issues = [
        {
            "问题": "找不到文件",
            "原因": "文件路径写错了，或者文件被移动/删除了",
            "解决": "检查文件路径，确认文件确实存在于指定位置",
        },
        {
            "问题": "文件里缺少必要的列",
            "原因": "表格的列名不对，或者缺少质量/周期等关键列",
            "解决": "请确保表格包含「质量(kg)」和「周期(秒)」这两列",
        },
        {
            "问题": "某格填的不是数字",
            "原因": "比如写了'100克'而不是'0.1'，或者有多余的单位",
            "解决": "数字列只填纯数字，不要带单位或文字",
        },
        {
            "问题": "质量/周期是负数",
            "原因": "可能不小心多打了负号，或者单位换算错了",
            "解决": "检查数据，质量和周期都应该是正数",
        },
        {
            "问题": "可用的数据点太少",
            "原因": "有效数据不足5个，无法进行可靠的拟合",
            "解决": "请补充至少5个不同质量点的测量数据",
        },
        {
            "问题": "检测到零点漂移",
            "原因": "弹簧空载时指针没有对准标尺零点",
            "解决": "检查实验装置，或在数据中加入基准偏移量",
        },
        {
            "问题": "拟合效果不太好（R²太低）",
            "原因": "数据可能有异常值，或者振幅太大引入了非线性",
            "解决": "检查有没有明显偏离趋势的数据点，确认振幅控制在2cm以内",
        },
    ]

    for i, issue in enumerate(issues, 1):
        click.echo(f"\n{i}. ❓ {issue['问题']}")
        click.echo(f"   📌 原因: {issue['原因']}")
        click.secho(f"   ✅ 解决: {issue['解决']}", fg="green")

    click.echo("\n" + "=" * 60)
    click.echo("💡 如遇其他问题，请联系实验助教或技术支持。")
    click.echo("=" * 60 + "\n")


def main():
    """主入口函数。"""
    cli()


if __name__ == "__main__":
    main()
