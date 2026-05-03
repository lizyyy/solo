"""
庭审笔录证据锚点核对员 - CLI主程序
"""

import os
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from . import __version__
from .parsers.csv_parser import TimestampCSVParser
from .parsers.markdown_parser import TranscriptMarkdownParser
from .parsers.json_parser import EvidenceJSONParser
from .indexer.local_index import LocalIndex
from .reporter.check_engine import CheckEngine
from .reporter.report_generator import MarkdownReportGenerator, CSVRevisionGenerator


console = Console()


def get_index() -> LocalIndex:
    return LocalIndex(os.getcwd())


@click.group()
@click.version_option(__version__, '-v', '--version')
def main():
    """
    庭审笔录证据锚点核对员

    用于核对庭审笔录中的证据锚点，检查证据编号错误、引用页码缺失、重复锚定等问题。

    使用流程:
    1. init    生成示例文件
    2. import  导入数据并建立索引
    3. check   执行核对检查
    4. export  导出检查报告
    """
    pass


@main.command()
@click.option('--output', '-o', default='./examples', help='示例文件输出目录')
@click.option('--with-errors', '-e', is_flag=True, help='同时生成包含错误的异常样例')
def init(output, with_errors):
    """
    生成示例文件

    创建示例的时间码CSV、笔录Markdown、证据目录JSON文件，
    便于快速上手和测试。
    """
    output_path = Path(output)
    output_path.mkdir(parents=True, exist_ok=True)

    console.print(f"[bold green]✓[/bold green] 开始生成示例文件到: {output_path.absolute()}")

    timestamp_csv = """时间码,发言人,事件类型,描述,持续时间(秒)
00:05:30,审判长,开庭,宣布开庭,30
00:06:00,原告代理人,举证,提交证据1-5,120
00:08:00,被告代理人,质证,对证据1-3发表意见,90
00:09:30,审判长,法庭调查,询问原告,60
00:10:30,原告代理人,举证,补充提交证据6,45
00:11:15,被告代理人,质证,对证据6发表意见,30
"""

    transcript_md = """[00:05:30]
【审判长】现在宣布开庭。今天审理原告张三与被告李四的合同纠纷一案。

[00:06:00]
【原告代理人】现在开始举证。我方提交证1 第1页，证明双方存在合同关系。证2 第2-3页，证明原告已履行合同义务。证3 第5页，证明被告违约事实。

[00:08:00]
【被告代理人】对原告证据发表质证意见。证1 真实性无异议，但证2 第2页的内容与本案无关。对于证3，第5页的签名并非被告本人签署。

[00:09:30]
【审判长】原告方，关于证据3还有补充吗？

[00:10:30]
【原告代理人】补充举证证4 第10页，以及证6 第15页，证明相关事实。

[00:11:15]
【被告代理人】对于证6 第15页，我方认为该证据已过举证期限。
"""

    evidence_json = """{
  "证据目录": [
    {
      "证据编号": "证1",
      "证据名称": "合同书",
      "页数": 5,
      "提交方": "原告",
      "证据类型": "书证"
    },
    {
      "证据编号": "证2",
      "证据名称": "付款凭证",
      "页数": 4,
      "提交方": "原告",
      "证据类型": "书证"
    },
    {
      "证据编号": "证3",
      "证据名称": "违约确认书",
      "页数": 8,
      "提交方": "原告",
      "证据类型": "书证"
    },
    {
      "证据编号": "证4",
      "证据名称": "补充协议",
      "页数": 12,
      "提交方": "原告",
      "证据类型": "书证"
    },
    {
      "证据编号": "证5",
      "证据名称": "证人证言",
      "页数": 3,
      "提交方": "原告",
      "证据类型": "证人证言"
    }
  ]
}
"""

    with open(output_path / "timestamp.csv", 'w', encoding='utf-8-sig', newline='') as f:
        f.write(timestamp_csv)
    console.print(f"  [cyan]•[/cyan] 时间码CSV: {output_path / 'timestamp.csv'}")

    with open(output_path / "transcript.md", 'w', encoding='utf-8') as f:
        f.write(transcript_md)
    console.print(f"  [cyan]•[/cyan] 笔录Markdown: {output_path / 'transcript.md'}")

    with open(output_path / "evidence.json", 'w', encoding='utf-8') as f:
        f.write(evidence_json)
    console.print(f"  [cyan]•[/cyan] 证据目录JSON: {output_path / 'evidence.json'}")

    if with_errors:
        abnormal_path = output_path / "abnormal"
        abnormal_path.mkdir(exist_ok=True)

        transcript_abnormal = """[00:05:30]
【审判长】现在宣布开庭。

[00:06:00]
【原告代理人】现在开始举证。我方提交证1，证明双方存在合同关系。证2 第2-3页。证99 第1页（不存在的证据）。证1 第2页（重复锚定证1）。

[00:08:00]
【被告代理人】质证意见。证3 第100页（超出页数）。证-1 （无效格式）。
"""

        with open(abnormal_path / "transcript_error.md", 'w', encoding='utf-8') as f:
            f.write(transcript_abnormal)
        console.print(f"  [cyan]•[/cyan] 异常样例笔录: {abnormal_path / 'transcript_error.md'}")

    console.print("")
    console.print(Panel.fit(
        "[bold green]示例文件生成完成！[/bold green]\n\n"
        "下一步操作：\n"
        f"1. cd {output}\n"
        "2. evidence-anchor import -t timestamp.csv -m transcript.md -e evidence.json\n"
        "3. evidence-anchor check\n"
        "4. evidence-anchor export -o ./reports",
        title="使用提示",
        border_style="blue"
    ))


@main.command()
@click.option('--timestamp', '-t', required=True, help='时间码CSV文件路径')
@click.option('--markdown', '-m', required=True, help='笔录Markdown文件路径')
@click.option('--evidence', '-e', required=True, help='证据目录JSON文件路径')
@click.option('--force', '-f', is_flag=True, help='强制重建索引')
def import_data(timestamp, markdown, evidence, force):
    """
    导入数据并建立本地索引

    校验各文件字段格式，解析数据后建立本地索引，
    为后续核对检查做准备。
    """
    index = get_index()

    if index.exists() and not force:
        console.print("[bold yellow]⚠[/bold yellow] 索引已存在，使用 --force 强制重建")
        console.print("当前索引状态:")
        info = index.get_index_info()
        console.print(f"  证据数量: {info['evidence_count']}")
        console.print(f"  笔录段落: {info['transcript_segments']}")
        console.print(f"  时间码条目: {info['timestamp_entries']}")
        return

    console.print("[bold blue]📂[/bold blue] 开始导入数据...")

    all_errors = []

    console.print("  [cyan]•[/cyan] 解析时间码CSV...")
    timestamp_entries, errors = TimestampCSVParser.parse(timestamp)
    all_errors.extend(errors)
    console.print(f"    解析到 {len(timestamp_entries)} 条时间码记录")
    if errors:
        console.print(f"    [bold red]警告: 发现 {len(errors)} 个格式问题[/bold red]")

    console.print("  [cyan]•[/cyan] 解析笔录Markdown...")
    transcript_segments, errors = TranscriptMarkdownParser.parse(markdown)
    all_errors.extend(errors)
    console.print(f"    解析到 {len(transcript_segments)} 个笔录段落")

    console.print("  [cyan]•[/cyan] 解析证据目录JSON...")
    evidence_catalog, errors = EvidenceJSONParser.parse(evidence)
    all_errors.extend(errors)
    console.print(f"    解析到 {len(evidence_catalog)} 项证据")

    if all_errors:
        console.print("")
        console.print(Panel.fit(
            f"[bold yellow]发现 {len(all_errors)} 个数据格式问题[/bold yellow]\n"
            "部分问题可能影响后续检查结果",
            title="数据警告",
            border_style="yellow"
        ))

    console.print("")
    console.print("[bold blue]📊[/bold blue] 建立索引...")

    index.initialize(
        timestamp_csv_path=timestamp,
        transcript_md_path=markdown,
        evidence_json_path=evidence
    )
    index.timestamp_entries = timestamp_entries
    index.transcript_segments = transcript_segments
    index.evidence_catalog = evidence_catalog
    index.save()

    anchors = index.get_all_anchors()

    table = Table(title="导入完成", show_header=True)
    table.add_column("数据类型", style="cyan")
    table.add_column("数量", justify="right")
    table.add_row("时间码记录", str(len(timestamp_entries)))
    table.add_row("笔录段落", str(len(transcript_segments)))
    table.add_row("证据条目", str(len(evidence_catalog)))
    table.add_row("检测到的锚点", str(len(anchors)))

    console.print("")
    console.print(table)
    console.print("")
    console.print("[bold green]✓[/bold green] 索引已建立，可使用 'evidence-anchor check' 进行核对")


@main.command()
@click.option('--detail', '-d', is_flag=True, help='显示详细错误信息')
def check(detail):
    """
    执行核对检查

    检查以下问题：
    - 证据编号是否存在于证据目录
    - 引用页码是否缺失或无效
    - 同一发言是否被重复锚定
    - 时间码、发言人是否与记录一致
    """
    index = get_index()

    if not index.exists():
        console.print("[bold red]✗[/bold red] 未找到索引，请先执行 'import' 命令")
        sys.exit(1)

    index.load()

    console.print("[bold blue]🔍[/bold blue] 开始核对检查...")

    engine = CheckEngine(index)
    errors, result = engine.run_all_checks()

    index.save()

    console.print("")

    if result.total_errors == 0:
        console.print(Panel.fit(
            "[bold green]🎉 未发现任何错误！[/bold green]\n\n"
            "所有证据锚点均符合规范。",
            title="检查结果",
            border_style="green"
        ))
    else:
        summary_table = Table(title="错误统计", show_header=True)
        summary_table.add_column("错误类型", style="cyan")
        summary_table.add_column("数量", justify="right", style="red")

        for error_type, count in sorted(result.error_summary.items(), key=lambda x: -x[1]):
            summary_table.add_row(error_type, str(count))

        console.print(summary_table)

        if detail:
            console.print("")
            console.print("[bold]详细错误列表:[/bold]")
            console.print("")

            for i, error in enumerate(errors, 1):
                error_panel = Panel(
                    Text.assemble(
                        ("问题: ", "bold"),
                        f"{error.message}\n",
                        ("位置: ", "bold"),
                        f"{error.location}\n",
                        ("建议: ", "bold yellow"),
                        f"{error.suggestion or '无'}"
                    ),
                    title=f"错误 {i}",
                    border_style="red",
                    expand=False
                )
                console.print(error_panel)
                console.print("")

    console.print("")
    console.print(f"[bold blue]💡[/bold blue] 使用 'evidence-anchor export' 导出完整报告")


@main.command()
@click.option('--output', '-o', default='./reports', help='报告输出目录')
@click.option('--format', '-f', type=click.Choice(['all', 'md', 'csv']), default='all', help='输出格式')
def export(output, format):
    """
    导出检查报告

    导出：
    - Markdown格式差错报告
    - CSV格式修订清单
    - CSV格式锚点汇总表
    """
    index = get_index()

    if not index.exists():
        console.print("[bold red]✗[/bold red] 未找到索引，请先执行 'import' 和 'check' 命令")
        sys.exit(1)

    index.load()

    engine = CheckEngine(index)
    errors, result = engine.run_all_checks()

    output_path = Path(output)
    output_path.mkdir(parents=True, exist_ok=True)

    console.print(f"[bold blue]📄[/bold blue] 导出报告到: {output_path.absolute()}")

    if format in ['all', 'md']:
        md_generator = MarkdownReportGenerator(index)
        report_path = output_path / "error_report.md"
        md_generator.save_report(errors, result, report_path)
        console.print(f"  [cyan]•[/cyan] Markdown报告: {report_path}")

    if format in ['all', 'csv']:
        csv_generator = CSVRevisionGenerator(index)

        revision_path = output_path / "revision_list.csv"
        csv_generator.save_revision_list(errors, revision_path)
        console.print(f"  [cyan]•[/cyan] 修订清单CSV: {revision_path}")

        summary_path = output_path / "anchor_summary.csv"
        csv_generator.save_anchor_summary(summary_path)
        console.print(f"  [cyan]•[/cyan] 锚点汇总CSV: {summary_path}")

    console.print("")
    console.print(Panel.fit(
        f"[bold green]报告导出完成！[/bold green]\n\n"
        f"总错误数: {result.total_errors}\n"
        f"输出目录: {output_path.absolute()}",
        title="导出结果",
        border_style="green"
    ))


@main.command()
def status():
    """
    显示当前索引状态
    """
    index = get_index()

    if not index.exists():
        console.print("[bold yellow]⚠[/bold yellow] 未找到索引")
        console.print("使用 'evidence-anchor import' 命令建立索引")
        return

    index.load()
    info = index.get_index_info()

    table = Table(title="索引状态", show_header=True)
    table.add_column("项目", style="cyan")
    table.add_column("值")

    table.add_row("索引存在", "✅ 是" if info['exists'] else "❌ 否")
    table.add_row("创建时间", info['created_at'] or "N/A")
    table.add_row("更新时间", info['updated_at'] or "N/A")
    table.add_row("证据数量", str(info['evidence_count']))
    table.add_row("笔录段落", str(info['transcript_segments']))
    table.add_row("时间码条目", str(info['timestamp_entries']))
    table.add_row("锚点数量", str(info['anchor_count']))

    if info['last_check']['time']:
        table.add_row(
            "上次检查",
            f"错误: {info['last_check']['errors']}, 警告: {info['last_check']['warnings']}"
        )

    console.print(table)


@main.command()
def clear():
    """
    清除本地索引
    """
    index = get_index()

    if not index.exists():
        console.print("[bold yellow]⚠[/bold yellow] 不存在索引")
        return

    console.print("[bold red]⚠[/bold red] 确定要清除索引吗？这将删除所有已导入的数据。")
    console.print("输入 'yes' 确认，其他输入取消: ", end="")

    confirm = input().strip().lower()

    if confirm == 'yes':
        index.clear()
        console.print("[bold green]✓[/bold green] 索引已清除")
    else:
        console.print("[bold yellow]✗[/bold yellow] 操作已取消")


if __name__ == '__main__':
    main()
