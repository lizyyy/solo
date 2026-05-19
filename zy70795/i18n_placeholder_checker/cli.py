import click
import os
from .placeholder_extractor import PlaceholderExtractor
from .comparator import CrossLanguageComparator
from .report_generator import ReportGenerator
from .file_loader import FileLoader

@click.group()
def cli():
    pass

@cli.command()
@click.argument('source_file', type=click.Path(exists=True))
@click.argument('target_file', type=click.Path(exists=True))
@click.option('--source-lang', default='en', help='源语言代码')
@click.option('--target-lang', default='zh', help='目标语言代码')
@click.option('--output-json', help='JSON报告输出路径')
@click.option('--output-text', help='文本报告输出路径')
@click.option('--verbose', is_flag=True, help='显示详细信息')
def check(source_file, target_file, source_lang, target_lang, output_json, output_text, verbose):
    click.echo(f"正在检查 {source_file} vs {target_file}...")
    
    source_data = FileLoader.load_file(source_file)
    target_data = FileLoader.load_file(target_file)
    
    comparator = CrossLanguageComparator()
    issues = comparator.compare(source_data, target_data, source_lang, target_lang)
    
    all_issues = {target_lang: issues}
    
    if verbose or not output_json and not output_text:
        reporter = ReportGenerator()
        click.echo(reporter.generate_human_readable(all_issues))
    
    if output_json:
        reporter = ReportGenerator()
        reporter.save_json_report(all_issues, output_json)
        click.echo(f"JSON报告已保存到: {output_json}")
    
    if output_text:
        reporter = ReportGenerator()
        reporter.save_text_report(all_issues, output_text)
        click.echo(f"文本报告已保存到: {output_text}")
    
    if issues:
        click.echo(f"\n发现 {len(issues)} 个问题!")
        raise SystemExit(1)
    else:
        click.echo("\n未发现占位符不一致问题!")

@cli.command()
@click.argument('directory', type=click.Path(exists=True))
@click.option('--reference-lang', help='参考语言代码（默认使用第一个文件）')
@click.option('--output-json', help='JSON报告输出路径')
@click.option('--output-text', help='文本报告输出路径')
@click.option('--verbose', is_flag=True, help='显示详细信息')
def check_dir(directory, reference_lang, output_json, output_text, verbose):
    click.echo(f"正在检查目录: {directory}")
    
    translations = FileLoader.load_directory(directory)
    
    if not translations:
        click.echo("未找到翻译文件!")
        raise SystemExit(1)
    
    click.echo(f"找到 {len(translations)} 个语言文件: {', '.join(translations.keys())}")
    
    comparator = CrossLanguageComparator()
    all_issues = comparator.compare_multiple(translations, reference_lang)
    
    total_issues = sum(len(issues) for issues in all_issues.values())
    
    if verbose or not output_json and not output_text:
        reporter = ReportGenerator()
        click.echo(reporter.generate_human_readable(all_issues))
    
    if output_json:
        reporter = ReportGenerator()
        reporter.save_json_report(all_issues, output_json)
        click.echo(f"JSON报告已保存到: {output_json}")
    
    if output_text:
        reporter = ReportGenerator()
        reporter.save_text_report(all_issues, output_text)
        click.echo(f"文本报告已保存到: {output_text}")
    
    if total_issues > 0:
        click.echo(f"\n共发现 {total_issues} 个问题!")
        raise SystemExit(1)
    else:
        click.echo("\n未发现占位符不一致问题!")

@cli.command()
@click.argument('text')
def extract(text):
    extractor = PlaceholderExtractor()
    placeholders = extractor.extract(text)
    
    if placeholders:
        click.echo(f"找到占位符: {sorted(placeholders)}")
    else:
        click.echo("未找到占位符")

def main():
    cli()

if __name__ == '__main__':
    main()
