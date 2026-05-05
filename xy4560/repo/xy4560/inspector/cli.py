"""命令行接口"""

import os
import sys
import click
from typing import Optional

from inspector import __version__
from inspector.config import InspectorConfig
from inspector.core import DeliveryInspector
from inspector.database import DatabaseManager
from inspector.reporter import ReportExporter


@click.group()
@click.version_option(version=__version__, prog_name="delivery-inspector")
@click.option("--debug", is_flag=True, help="启用调试模式")
@click.pass_context
def cli(ctx, debug: bool):
    """交付验收巡检器 - 解析 README 命令并与实际配置核对"""
    ctx.ensure_object(dict)
    ctx.obj["DEBUG"] = debug


@cli.command()
@click.argument("project_dir", type=click.Path(exists=True, file_okay=False))
@click.option("--no-execute", is_flag=True, help="不执行命令，只进行静态检查")
@click.option("--output", "-o", type=click.Path(), help="输出目录（默认: 项目目录/.inspector）")
@click.pass_context
def inspect(ctx, project_dir: str, no_execute: bool, output: Optional[str]):
    """对项目进行交付验收检查
    
    PROJECT_DIR: 项目目录路径
    """
    config = InspectorConfig(project_dir=project_dir)
    if output:
        config.output_dir = output
        config.db_path = os.path.join(output, "inspector.db")
    
    click.echo(f"📁 项目目录: {project_dir}")
    click.echo(f"📋 开始检查...\n")
    
    try:
        inspector = DeliveryInspector(project_dir=project_dir, config=config)
        result = inspector.run_inspection(execute_commands=not no_execute)
        
        click.echo("✅ 检查完成！\n")
        click.echo(f"📊 结果摘要:")
        click.echo(f"   状态: {result.status}")
        click.echo(f"   运行ID: {result.run_id}")
        click.echo(f"   耗时: {result.summary['duration']:.2f} 秒")
        click.echo(f"   命令数: {result.summary['commands']['total']}")
        click.echo(f"     - 成功: {result.summary['commands']['success']}")
        click.echo(f"     - 失败: {result.summary['commands']['failed']}")
        click.echo(f"     - 阻止: {result.summary['commands']['blocked']}")
        click.echo(f"   发现问题: {result.summary['issues']} 个\n")
        
        click.echo(f"📄 报告已生成:")
        click.echo(f"   Markdown: {result.markdown_path}")
        click.echo(f"   JSON: {result.json_path}")
        
    except Exception as e:
        click.echo(f"❌ 检查失败: {str(e)}", err=True)
        if ctx.obj.get("DEBUG"):
            import traceback
            traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.argument("run_id", type=int)
@click.argument("reason", type=str)
@click.option("--project-dir", "-p", type=click.Path(exists=True, file_okay=False), 
              help="项目目录路径（用于查找数据库）")
@click.option("--marked-by", "-u", default="user", help="标记人（默认: user）")
def mark_false_positive(run_id: int, reason: str, project_dir: Optional[str], marked_by: str):
    """标记问题为误报
    
    RUN_ID: 运行ID
    REASON: 误报原因
    """
    if not project_dir:
        project_dir = os.getcwd()
    
    config = InspectorConfig(project_dir=project_dir)
    db = DatabaseManager(config.db_path)
    
    issues = db.get_issues(run_id, include_false_positives=False)
    if not issues:
        click.echo(f"❌ 未找到运行 ID {run_id} 的问题记录")
        sys.exit(1)
    
    click.echo(f"找到 {len(issues)} 个问题记录:")
    for i, issue in enumerate(issues, 1):
        click.echo(f"   {i}. ID={issue['id']}: [{issue['severity']}] {issue['issue_type']} - {issue['command'] or issue['description'][:50]}")
    
    click.echo()
    issue_id_str = click.prompt("请输入要标记为误报的问题 ID（输入 'all' 标记全部）", type=str)
    
    if issue_id_str.lower() == "all":
        count = 0
        for issue in issues:
            if db.mark_false_positive(issue["id"], reason, marked_by):
                count += 1
        click.echo(f"✅ 已标记 {count} 个问题为误报")
    else:
        try:
            issue_id = int(issue_id_str)
            if db.mark_false_positive(issue_id, reason, marked_by):
                click.echo(f"✅ 问题 ID {issue_id} 已标记为误报")
            else:
                click.echo(f"❌ 未找到问题 ID {issue_id}")
                sys.exit(1)
        except ValueError:
            click.echo(f"❌ 无效的问题 ID")
            sys.exit(1)


@cli.command()
@click.argument("run_id", type=int, required=False)
@click.option("--project-dir", "-p", type=click.Path(exists=True, file_okay=False),
              help="项目目录路径")
@click.option("--output", "-o", type=click.Path(), help="输出目录")
@click.option("--json/--no-json", default=True, help="是否导出 JSON")
@click.option("--markdown/--no-markdown", default=True, help="是否导出 Markdown")
def export(run_id: Optional[int], project_dir: Optional[str], output: Optional[str],
           json: bool, markdown: bool):
    """导出检查报告
    
    RUN_ID: 运行ID（可选，不传则列出所有运行记录）
    """
    if not project_dir:
        project_dir = os.getcwd()
    
    config = InspectorConfig(project_dir=project_dir)
    db = DatabaseManager(config.db_path)
    
    if not run_id:
        runs = db.get_all_runs(project_dir, limit=20)
        if not runs:
            click.echo("❌ 未找到任何运行记录")
            sys.exit(1)
        
        click.echo("可用的运行记录:")
        for run in runs:
            click.echo(f"   ID={run['id']} | {run['run_time']} | {run['status']} | "
                      f"问题数: {run['total_issues']}")
        
        run_id = click.prompt("请输入要导出的运行 ID", type=int)
    
    if not output:
        output = config.output_dir
    
    if markdown:
        md_path = os.path.join(output, f"report_{run_id}.md")
        reporter = ReportExporter(db)
        reporter.export_markdown(run_id, md_path)
        click.echo(f"📄 Markdown 报告已导出: {md_path}")
    
    if json:
        json_path = os.path.join(output, f"report_{run_id}.json")
        json_str = db.export_to_json(run_id)
        with open(json_path, "w", encoding="utf-8") as f:
            f.write(json_str)
        click.echo(f"📋 JSON 明细已导出: {json_path}")


@cli.command()
@click.option("--project-dir", "-p", type=click.Path(exists=True, file_okay=False),
              help="项目目录路径")
@click.option("--limit", "-n", default=10, help="显示最近 N 条记录")
def history(project_dir: Optional[str], limit: int):
    """查看检查历史记录"""
    if not project_dir:
        project_dir = os.getcwd()
    
    config = InspectorConfig(project_dir=project_dir)
    db = DatabaseManager(config.db_path)
    
    runs = db.get_all_runs(project_dir, limit=limit)
    
    if not runs:
        click.echo("📭 暂无检查历史记录")
        return
    
    click.echo(f"📊 最近 {len(runs)} 条检查记录:\n")
    click.echo("-" * 100)
    
    for run in runs:
        status_icon = {
            "completed": "✅",
            "partial": "⚠️",
            "failed": "❌",
            "running": "⏳"
        }.get(run['status'], "❓")
        
        click.echo(
            f"ID: {run['id']:4d} | "
            f"{status_icon} {run['status']:10s} | "
            f"时间: {run['run_time'][:19]} | "
            f"命令: {run['total_commands']:3d} | "
            f"问题: {run['total_issues']:3d}"
        )
    
    click.echo("-" * 100)


@cli.command()
@click.argument("project_dir", type=click.Path(exists=True, file_okay=False))
@click.option("--output", "-o", type=click.Path(), help="输出目录")
def info(project_dir: str, output: Optional[str]):
    """显示项目信息和配置"""
    from inspector.readme_parser import ReadmeParser
    from inspector.config_checker import ConfigChecker
    
    click.echo(f"📁 项目目录: {project_dir}")
    click.echo()
    
    parser = ReadmeParser(project_dir)
    parsed = parser.parse()
    
    if parsed.commands:
        click.echo(f"📜 从 README 提取的命令 ({len(parsed.commands)} 个):")
        for cmd in parsed.commands:
            click.echo(f"   - [{cmd.command_type}] {cmd.command}")
        click.echo()
    
    if parsed.ports:
        click.echo(f"🌐 从 README 提取的端口 ({len(parsed.ports)} 个):")
        for port in parsed.ports:
            click.echo(f"   - 端口 {port.port}: {port.description[:50] if port.description else '无描述'}")
        click.echo()
    
    if parsed.files:
        click.echo(f"📁 从 README 提取的预期文件 ({len(parsed.files)} 个):")
        for f in parsed.files:
            click.echo(f"   - {f.file_path} ({'输出文件' if f.is_output else '必要文件'})")
        click.echo()
    
    checker = ConfigChecker(project_dir)
    scripts = checker.get_available_scripts()
    
    if scripts:
        click.echo(f"⚙️  package.json 中的可用脚本 ({len(scripts)} 个):")
        for script in scripts:
            click.echo(f"   - {script}")


def main():
    """主入口"""
    cli()


if __name__ == "__main__":
    main()
