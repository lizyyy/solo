import os
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table

from freeze_gate import __version__
from freeze_gate.config import ConfigManager
from freeze_gate.exporters import Exporter
from freeze_gate.models import CheckSeverity, CheckType, ProjectConfig
from freeze_gate.parsers import ParserFactory
from freeze_gate.review import ReviewStore
from freeze_gate.rules import RuleEngine
from freeze_gate.samples import SampleGenerator

console = Console()
error_console = Console(stderr=True, style="bold red")


class CliContext:
    def __init__(self):
        self.verbose: bool = False
        self.config_path: Path = Path.cwd()
        self.config: Optional[ProjectConfig] = None
        self.config_manager: Optional[ConfigManager] = None
    
    def load_config(self, raise_on_missing: bool = True):
        self.config_manager = ConfigManager(self.config_path)
        if not self.config_manager.config_exists():
            if raise_on_missing:
                error_console.print("未找到项目配置文件！请先运行 'freeze-gate init' 初始化项目。")
                raise click.Abort()
            return None
        self.config = self.config_manager.load()
        return self.config


pass_context = click.make_pass_decorator(CliContext, ensure=True)


@click.group()
@click.version_option(__version__, '-v', '--version', prog_name='freeze-gate')
@click.option('-c', '--config', type=click.Path(path_type=Path), 
              help='项目配置文件路径', default=None)
@click.option('-v', '--verbose', is_flag=True, help='显示详细输出')
@pass_context
def cli(ctx: CliContext, config: Optional[Path], verbose: bool):
    """多语言文本包冻结闸 - 游戏本地化质量检查CLI工具
    
    在游戏发版前进行本地化质量检查，包括：
    - Key 完整性比对
    - 占位符规则校验
    - ICU 复数规则一致性检查
    - UI 长度预算控制
    - 禁用词检测
    """
    ctx.verbose = verbose
    if config:
        ctx.config_path = config.parent if config.is_file() else config
    if verbose:
        console.print(f"[dim]工作目录: {Path.cwd()}[/dim]")


@cli.command()
@click.option('-n', '--name', required=True, help='项目名称')
@click.option('-s', '--source-lang', default='zh-CN', help='源语言 (默认: zh-CN)')
@click.option('-t', '--target-lang', multiple=True, default=['en-US', 'ja-JP', 'ko-KR'],
              help='目标语言 (可多次指定)')
@click.option('--no-samples', is_flag=True, help='不生成示例数据')
@pass_context
def init(ctx: CliContext, name: str, source_lang: str, target_lang: list, no_samples: bool):
    """初始化新项目
    
    创建项目配置文件和目录结构。
    """
    config_manager = ConfigManager(ctx.config_path)
    
    if config_manager.config_exists():
        error_console.print(f"项目配置已存在于 {config_manager.config_file}")
        raise click.Abort()
    
    config = ProjectConfig(
        name=name,
        version="1.0.0",
        source_language=source_lang,
        target_languages=list(target_lang),
    )
    config.placeholder_rules = config.default_placeholder_rules()
    
    config_manager.save(config)
    
    if not no_samples:
        sample_gen = SampleGenerator(ctx.config_path, config)
        sample_gen.generate_all()
        console.print(f"[green]✓ 已生成示例数据到 {ctx.config_path}/samples[/green]")
    
    console.print(f"\n[bold green]✓ 项目 '{name}' 初始化完成！[/bold green]")
    console.print(f"  配置文件: {config_manager.config_file}")
    console.print(f"  源语言: {source_lang}")
    console.print(f"  目标语言: {', '.join(target_lang)}")
    console.print("\n[yellow]下一步:[/yellow]")
    console.print("  1. 编辑 freeze-gate.yaml 配置占位符规则、长度预算和禁用词")
    console.print("  2. 运行 'freeze-gate import' 导入多语言资源")
    console.print("  3. 运行 'freeze-gate check' 进行质量检查")


@cli.command()
@click.option('-f', '--format', type=click.Choice(['json', 'csv', 'auto']), default='auto',
              help='文件格式 (json/csv/auto)')
@click.option('-n', '--name', help='资源名称 (默认从文件名推导)')
@click.argument('file_path', type=click.Path(exists=True, path_type=Path))
@pass_context
def import_cmd(ctx: CliContext, format: str, name: Optional[str], file_path: Path):
    """导入多语言资源
    
    支持 JSON 嵌套结构和 CSV 表格格式。
    """
    config = ctx.load_config()
    
    if format == 'auto':
        if file_path.suffix.lower() == '.json':
            format = 'json'
        elif file_path.suffix.lower() == '.csv':
            format = 'csv'
        else:
            error_console.print(f"无法自动识别文件格式: {file_path.suffix}")
            raise click.Abort()
    
    parser = ParserFactory.get_parser(format)
    
    try:
        resource = parser.parse(file_path, config.source_language)
    except Exception as e:
        error_console.print(f"解析文件失败: {e}")
        raise click.Abort()
    
    resource_name = name or file_path.stem
    resource.name = resource_name
    
    resources_dir = ctx.config_path / "resources"
    resources_dir.mkdir(exist_ok=True)
    
    output_file = resources_dir / f"{resource_name}.json"
    
    import json
    from dataclasses import asdict
    
    output_data = {
        "name": resource.name,
        "source_language": resource.source_language,
        "target_languages": resource.target_languages,
        "source_file": resource.source_file,
        "format": resource.format,
        "entries": {
            key: {
                lang: asdict(entry)
                for lang, entry in lang_map.items()
            }
            for key, lang_map in resource.entries.items()
        }
    }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    if resource_name not in config.resource_paths:
        config.resource_paths[resource_name] = str(output_file.relative_to(ctx.config_path))
        ctx.config_manager.save(config)
    
    console.print(f"[green]✓ 资源 '{resource_name}' 导入成功！[/green]")
    console.print(f"  输出文件: {output_file}")
    console.print(f"  源语言: {resource.source_language}")
    console.print(f"  目标语言: {', '.join(resource.target_languages)}")
    console.print(f"  总条目数: {len(resource.entries)}")


@cli.command()
@click.option('-r', '--resource', 'resources', multiple=True,
              help='指定要检查的资源名称 (可多次指定，默认检查全部)')
@click.option('--check-type', 'check_types', multiple=True,
              type=click.Choice([t.name.lower() for t in CheckType]),
              help='指定检查类型 (默认全部检查)')
@click.option('--language', 'languages', multiple=True,
              help='指定要检查的语言 (可多次指定)')
@click.option('--save-result', is_flag=True, help='保存检查结果到输出目录')
@pass_context
def check(ctx: CliContext, resources: tuple, check_types: tuple, languages: tuple, save_result: bool):
    """执行质量检查
    
    检查内容包括：
    - Key 完整性比对
    - 占位符规则校验
    - ICU 复数规则一致性
    - UI 长度预算控制
    - 禁用词检测
    """
    config = ctx.load_config()
    
    import json
    from dataclasses import asdict
    from freeze_gate.models import LanguageEntry, TranslationResource
    
    loaded_resources: list = []
    resources_dir = ctx.config_path / "resources"
    
    if not resources_dir.exists():
        error_console.print("未找到 resources 目录，请先运行 'freeze-gate import' 导入资源")
        raise click.Abort()
    
    for resource_name, rel_path in config.resource_paths.items():
        if resources and resource_name not in resources:
            continue
            
        resource_file = ctx.config_path / rel_path
        if not resource_file.exists():
            error_console.print(f"资源文件不存在: {resource_file}")
            continue
        
        try:
            with open(resource_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            resource = TranslationResource(
                name=data["name"],
                source_language=data["source_language"],
                target_languages=data["target_languages"],
                source_file=data.get("source_file", ""),
                format=data.get("format", "json"),
            )
            
            for key, lang_map in data["entries"].items():
                for lang, entry_data in lang_map.items():
                    entry = LanguageEntry(**entry_data)
                    resource.add_entry(entry)
            
            loaded_resources.append(resource)
        except Exception as e:
            error_console.print(f"加载资源失败: {resource_file} - {e}")
            continue
    
    if not loaded_resources:
        error_console.print("没有可检查的资源！")
        raise click.Abort()
    
    rule_engine = RuleEngine(config)
    
    enabled_checks = None
    if check_types:
        enabled_checks = {CheckType[t.upper()] for t in check_types}
    
    all_results = []
    
    for resource in loaded_resources:
        console.print(f"\n[bold]检查资源: {resource.name}[/bold]")
        
        result = rule_engine.check(
            resource,
            languages=list(languages) if languages else None,
            enabled_checks=enabled_checks
        )
        all_results.append(result)
        
        _display_check_result(result, ctx.verbose)
    
    review_store = ReviewStore(ctx.config_path)
    for result in all_results:
        result.reviewed_decisions = review_store.get_all_decisions()
    
    if save_result:
        output_dir = Path(config.output_directory) if not os.path.isabs(config.output_directory) else Path(config.output_directory)
        if not output_dir.is_absolute():
            output_dir = ctx.config_path / output_dir
        output_dir.mkdir(exist_ok=True)
        
        timestamp = __import__('datetime').datetime.now().strftime('%Y%m%d_%H%M%S')
        
        for result in all_results:
            result_file = output_dir / f"check_result_{result.resource_name}_{timestamp}.json"
            with open(result_file, 'w', encoding='utf-8') as f:
                json.dump({
                    "resource_name": result.resource_name,
                    "total_keys": result.total_keys,
                    "languages_checked": result.languages_checked,
                    "issues": [i.to_dict() for i in result.issues],
                    "reviewed_decisions": [d.to_dict() for d in result.reviewed_decisions],
                }, f, ensure_ascii=False, indent=2)
            
            console.print(f"[dim]结果已保存: {result_file}[/dim]")
    
    total_critical = sum(r.critical_count for r in all_results)
    total_error = sum(r.error_count for r in all_results)
    total_warning = sum(r.warning_count for r in all_results)
    
    console.print(f"\n{'='*50}")
    console.print("[bold]检查汇总[/bold]")
    console.print(f"  关键错误: {total_critical}")
    console.print(f"  错误: {total_error}")
    console.print(f"  警告: {total_warning}")
    
    if total_critical > 0 or total_error > 0:
        error_console.print("\n[bold red]✗ 检查未通过，存在需要修复的问题[/bold red]")
        raise click.Abort()
    else:
        console.print("\n[bold green]✓ 检查通过，所有资源符合质量要求[/bold green]")


def _display_check_result(result, verbose: bool):
    table = Table(title=f"检查结果: {result.resource_name}")
    table.add_column("级别", style="cyan")
    table.add_column("数量", justify="right")
    
    from freeze_gate.models import CheckSeverity
    
    severity_styles = {
        CheckSeverity.CRITICAL: "bold red",
        CheckSeverity.ERROR: "red",
        CheckSeverity.WARNING: "yellow",
        CheckSeverity.INFO: "cyan",
    }
    
    for severity in [CheckSeverity.CRITICAL, CheckSeverity.ERROR, CheckSeverity.WARNING, CheckSeverity.INFO]:
        count = len(result.get_issues_by_severity(severity))
        if count > 0:
            table.add_row(
                f"[{severity_styles[severity]}]{severity.name}[/{severity_styles[severity]}]",
                str(count)
            )
    
    if len(result.issues) > 0:
        console.print(table)
    
    if verbose and result.issues:
        console.print("\n[bold]问题详情:[/bold]")
        for issue in result.issues[:20]:
            style = severity_styles.get(issue.severity, "white")
            console.print(f"  [{style}]{issue.severity.name}[/{style}]: {issue.key} [{issue.language}]")
            console.print(f"    类型: {issue.check_type.name}")
            console.print(f"    消息: {issue.message}")
            if issue.source_text:
                console.print(f"    原文: {issue.source_text}")
            if issue.translated_text:
                console.print(f"    译文: {issue.translated_text}")
            console.print()
        
        if len(result.issues) > 20:
            console.print(f"[dim]... 还有 {len(result.issues) - 20} 个问题[/dim]")
    elif not verbose and result.issues:
        console.print("[dim]使用 --verbose 查看详细问题列表[/dim]")


@cli.command()
@click.option('-k', '--key', required=True, help='问题的 Key')
@click.option('-l', '--language', required=True, help='语言代码')
@click.option('--approve/--reject', default=True, help='批准/拒绝')
@click.option('-r', '--reviewer', required=True, help='复核人名称')
@click.option('-c', '--comment', default='', help='复核意见')
@pass_context
def review(ctx: CliContext, key: str, language: str, approve: bool, reviewer: str, comment: str):
    """保存人工复核意见
    
    对检查发现的问题进行人工放行或拒绝。
    """
    config = ctx.load_config()
    
    review_store = ReviewStore(ctx.config_path)
    
    decision = review_store.add_decision(
        key=key,
        language=language,
        approved=approve,
        reviewer=reviewer,
        comment=comment
    )
    
    console.print(f"[green]✓ 复核意见已保存[/green]")
    console.print(f"  Key: {key}")
    console.print(f"  语言: {language}")
    console.print(f"  状态: {'批准' if approve else '拒绝'}")
    console.print(f"  复核人: {reviewer}")
    if comment:
        console.print(f"  意见: {comment}")


@cli.command()
@click.option('-f', '--format', 'formats', multiple=True, default=['markdown'],
              type=click.Choice(['markdown', 'csv', 'json', 'all']),
              help='导出格式 (可多次指定，使用 "all" 导出全部)')
@click.option('-o', '--output', type=click.Path(path_type=Path),
              help='输出目录 (默认使用配置中的 output_directory)')
@click.option('--include-approved', is_flag=True, help='包含已批准的问题')
@pass_context
def report(ctx: CliContext, formats: tuple, output: Optional[Path], include_approved: bool):
    """导出质量检查报告
    
    支持导出：
    - Markdown 冻结报告
    - CSV 问题清单
    - JSON 审计包
    """
    config = ctx.load_config()
    
    import json
    from dataclasses import asdict
    from freeze_gate.models import LanguageEntry, TranslationResource
    
    loaded_resources: list = []
    
    for resource_name, rel_path in config.resource_paths.items():
        resource_file = ctx.config_path / rel_path
        if not resource_file.exists():
            continue
        
        try:
            with open(resource_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            resource = TranslationResource(
                name=data["name"],
                source_language=data["source_language"],
                target_languages=data["target_languages"],
                source_file=data.get("source_file", ""),
                format=data.get("format", "json"),
            )
            
            for key, lang_map in data["entries"].items():
                for lang, entry_data in lang_map.items():
                    entry = LanguageEntry(**entry_data)
                    resource.add_entry(entry)
            
            loaded_resources.append(resource)
        except Exception:
            continue
    
    if not loaded_resources:
        error_console.print("没有可导出的资源！")
        raise click.Abort()
    
    rule_engine = RuleEngine(config)
    all_results = []
    
    for resource in loaded_resources:
        result = rule_engine.check(resource)
        all_results.append(result)
    
    review_store = ReviewStore(ctx.config_path)
    for result in all_results:
        result.reviewed_decisions = review_store.get_all_decisions()
    
    if 'all' in formats:
        export_formats = ['markdown', 'csv', 'json']
    else:
        export_formats = list(formats)
    
    output_dir = output or (
        Path(config.output_directory) if os.path.isabs(config.output_directory) 
        else ctx.config_path / config.output_directory
    )
    if not isinstance(output_dir, Path):
        output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = __import__('datetime').datetime.now().strftime('%Y%m%d_%H%M%S')
    
    exporter = Exporter(output_dir, timestamp)
    
    for result in all_results:
        if 'markdown' in export_formats:
            md_file = exporter.export_markdown(result, config, include_approved)
            console.print(f"[green]✓ 已导出 Markdown:[/green] {md_file}")
        
        if 'csv' in export_formats:
            csv_file = exporter.export_csv(result, include_approved)
            console.print(f"[green]✓ 已导出 CSV:[/green] {csv_file}")
        
        if 'json' in export_formats:
            json_file = exporter.export_json(result, config, include_approved)
            console.print(f"[green]✓ 已导出 JSON:[/green] {json_file}")
    
    console.print(f"\n[bold green]✓ 报告导出完成！[/bold green]")
    console.print(f"  输出目录: {output_dir}")


@cli.command()
@click.option('-o', '--output', type=click.Path(path_type=Path),
              help='输出目录 (默认: ./samples)')
@pass_context
def samples(ctx: CliContext, output: Optional[Path]):
    """生成示例数据
    
    用于测试和演示工具功能。
    """
    config = ctx.load_config(raise_on_missing=False)
    
    if config is None:
        config = ProjectConfig(
            name="Demo",
            version="1.0.0",
            source_language="zh-CN",
            target_languages=["en-US", "ja-JP", "ko-KR"],
        )
        config.placeholder_rules = config.default_placeholder_rules()
    
    output_dir = output or ctx.config_path / "samples"
    if not isinstance(output_dir, Path):
        output_dir = Path(output_dir)
    
    sample_gen = SampleGenerator(output_dir, config)
    sample_gen.generate_all()
    
    console.print(f"[green]✓ 示例数据已生成到: {output_dir}[/green]")
    console.print("\n包含示例:")
    console.print("  - source.json: 源语言 JSON 文件")
    console.print("  - translations.csv: 翻译 CSV 文件")
    console.print("  - freeze-gate.yaml: 示例配置文件")
    console.print("  - 包含各种测试场景：正确翻译、缺翻、占位符错误、长度超限、禁用词等")


if __name__ == '__main__':
    cli()
