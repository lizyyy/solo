"""参考文献检查工具命令行入口"""

import os
import sys
from pathlib import Path
from typing import List, Optional, Tuple

import click

from .models import (
    ProjectAnalysis,
    CheckResult,
    ReferenceEntry,
    Citation,
)
from .parsers import (
    MarkdownParser,
    LatexParser,
    BibtexParser,
    RisParser,
)
from .checker import ReferenceChecker
from .reporter import Reporter


def detect_text_format(filepath: str) -> str:
    ext = Path(filepath).suffix.lower()
    if ext in ('.md', '.markdown', '.mdown'):
        return 'markdown'
    elif ext in ('.tex', '.latex'):
        return 'latex'
    return 'unknown'


def detect_ref_format(filepath: str) -> str:
    ext = Path(filepath).suffix.lower()
    if ext in ('.bib', '.bibtex'):
        return 'bibtex'
    elif ext in ('.ris', '.ref'):
        return 'ris'
    return 'unknown'


def parse_text_file(filepath: str, format_hint: Optional[str] = None) -> List[Citation]:
    if not format_hint:
        format_hint = detect_text_format(filepath)
    
    if format_hint == 'markdown':
        parser = MarkdownParser()
        return parser.parse_file(filepath)
    elif format_hint == 'latex':
        parser = LatexParser()
        return parser.parse_file(filepath)
    else:
        md_parser = MarkdownParser()
        lt_parser = LatexParser()
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception:
            raise ValueError(f"无法读取文件: {filepath}")
        
        md_cites = md_parser.parse(content, filepath)
        lt_cites = lt_parser.parse(content, filepath)
        
        return md_cites + lt_cites


def parse_ref_file(filepath: str, format_hint: Optional[str] = None) -> List[ReferenceEntry]:
    if not format_hint:
        format_hint = detect_ref_format(filepath)
    
    if format_hint == 'bibtex':
        parser = BibtexParser()
        return parser.parse_file(filepath)
    elif format_hint == 'ris':
        parser = RisParser()
        return parser.parse_file(filepath)
    else:
        raise ValueError(f"无法识别参考文献格式: {filepath}")


def print_summary(analysis: ProjectAnalysis):
    result = analysis.check_result
    
    click.echo("=" * 60)
    click.echo("参考文献检查报告")
    click.echo("=" * 60)
    click.echo("")
    
    click.echo("📊 概要统计")
    click.echo(f"  - 正文引用数: {len(analysis.citations)} 处")
    click.echo(f"  - 唯一引用键: {len(analysis.get_unique_citation_keys())} 个")
    click.echo(f"  - 参考文献条目: {len(analysis.references)} 条")
    click.echo(f"  - 唯一文献键: {len(analysis.get_unique_reference_keys())} 个")
    click.echo("")
    
    has_issues = False
    
    if result.missing_citations:
        has_issues = True
        click.echo("❌ 缺失引用 (找不到对应的文献条目)")
        click.echo(f"   共发现 {len(result.missing_citations)} 个问题")
        for cite in result.missing_citations:
            line_info = f" (行 {cite.line_number})" if cite.line_number else ""
            click.echo(f"   - [{cite.source_type}]{line_info}: `{cite.key}`")
        click.echo("")
    
    if result.unused_references:
        has_issues = True
        click.echo("⚠️  未引用的参考文献")
        click.echo(f"   共发现 {len(result.unused_references)} 个问题")
        for ref in result.unused_references:
            click.echo(f"   - `{ref.key}` (来自 {ref.source_file})")
        click.echo("")
    
    if result.duplicate_keys:
        has_issues = True
        click.echo("⚠️  重复的引用键")
        click.echo(f"   共发现 {len(result.duplicate_keys)} 个问题")
        for dup in result.duplicate_keys:
            click.echo(f"   - 键 `{dup['key']}` 出现在 {len(dup['entries'])} 个条目中")
        click.echo("")
    
    if result.duplicate_candidates:
        has_issues = True
        click.echo("⚠️  疑似重复文献")
        click.echo(f"   共发现 {len(result.duplicate_candidates)} 组")
        for i, group in enumerate(result.duplicate_candidates, 1):
            keys = ', '.join(f"`{r.key}`" for r in group)
            click.echo(f"   - 第 {i} 组: {keys}")
        click.echo("")
    
    if result.doi_conflicts:
        has_issues = True
        click.echo("❌ DOI 字段冲突")
        click.echo(f"   共发现 {len(result.doi_conflicts)} 个问题")
        for conflict in result.doi_conflicts:
            click.echo(f"   - DOI `{conflict['doi']}` 有字段冲突")
        click.echo("")
    
    if result.warnings:
        for warning in result.warnings:
            click.echo(f"⚠️  警告: {warning}")
        click.echo("")
    
    if not has_issues:
        click.echo("✅ 所有检查通过！未发现问题。")
    else:
        click.echo("=" * 60)
        click.echo(f"共发现 {len(result.missing_citations) + len(result.doi_conflicts)} 个错误，"
                   f"{len(result.unused_references) + len(result.duplicate_keys) + len(result.duplicate_candidates)} 个警告")
        click.echo("=" * 60)
    
    return has_issues


@click.command()
@click.option('--text', '-t', 'text_files', multiple=True, type=click.Path(exists=True),
              help='正文文件 (Markdown 或 LaTeX)，可多次指定')
@click.option('--ref', '-r', 'ref_files', multiple=True, type=click.Path(exists=True),
              help='参考文献文件 (.bib 或 .ris)，可多次指定')
@click.option('--report', '-o', type=click.Path(),
              help='输出 Markdown 报告文件路径')
@click.option('--json', '-j', 'json_output', type=click.Path(),
              help='输出 JSON 明细文件路径')
@click.option('--export-bib', '-e', 'export_bib', type=click.Path(),
              help='导出清洗后的 BibTeX 文件路径')
@click.option('--include-unused', is_flag=True,
              help='导出时包含未被引用的参考文献')
@click.option('--no-dedupe', 'no_dedupe', is_flag=True,
              help='导出时不进行去重')
@click.option('--title-threshold', type=int, default=85,
              help='标题相似度阈值 (0-100，默认 85)')
@click.option('--verbose', '-v', is_flag=True,
              help='详细输出模式')
@click.option('--quiet', '-q', is_flag=True,
              help='安静模式，只输出结果概要')
def main(
    text_files: Tuple[str],
    ref_files: Tuple[str],
    report: Optional[str],
    json_output: Optional[str],
    export_bib: Optional[str],
    include_unused: bool,
    no_dedupe: bool,
    title_threshold: int,
    verbose: bool,
    quiet: bool,
):
    """参考文献一致性检查工具
    
    扫描正文文件中的引用，检查与参考文献库的一致性。
    
    示例:
      refchecker -t paper.md -r references.bib
      refchecker -t main.tex -r refs1.bib -r refs2.ris -o report.md
      refchecker -t paper.md -r refs.bib --export-bib clean.bib
    """
    
    if not text_files and not ref_files:
        click.echo("错误: 请至少指定一个正文文件 (-t) 或参考文献文件 (-r)")
        click.echo("使用 --help 查看帮助")
        sys.exit(1)
    
    analysis = ProjectAnalysis()
    
    if not quiet:
        click.echo("正在解析文件...")
    
    for text_file in text_files:
        try:
            if verbose and not quiet:
                click.echo(f"  解析正文文件: {text_file}")
            citations = parse_text_file(text_file)
            analysis.citations.extend(citations)
            if verbose and not quiet:
                click.echo(f"    找到 {len(citations)} 个引用")
        except Exception as e:
            click.echo(f"错误: 解析正文文件 {text_file} 失败: {str(e)}", err=True)
            sys.exit(1)
    
    for ref_file in ref_files:
        try:
            if verbose and not quiet:
                click.echo(f"  解析参考文献文件: {ref_file}")
            refs = parse_ref_file(ref_file)
            analysis.references.extend(refs)
            if verbose and not quiet:
                click.echo(f"    找到 {len(refs)} 条文献")
        except Exception as e:
            click.echo(f"错误: 解析参考文献文件 {ref_file} 失败: {str(e)}", err=True)
            sys.exit(1)
    
    if not quiet:
        click.echo("")
    
    if not analysis.citations and text_files:
        click.echo("警告: 在正文文件中未找到任何引用", err=True)
    
    if not analysis.references and ref_files:
        click.echo("警告: 在参考文献文件中未找到任何条目", err=True)
    
    if not quiet:
        click.echo("正在运行检查...")
    
    checker = ReferenceChecker(title_threshold=title_threshold)
    analysis.check_result = checker.run_checks(analysis)
    
    has_issues = False
    if not quiet:
        has_issues = print_summary(analysis)
    
    reporter = Reporter()
    
    if report:
        try:
            md_report = reporter.generate_markdown(analysis)
            with open(report, 'w', encoding='utf-8') as f:
                f.write(md_report)
            if not quiet:
                click.echo(f"\n📄 Markdown 报告已写入: {report}")
        except Exception as e:
            click.echo(f"错误: 写入报告文件失败: {str(e)}", err=True)
    
    if json_output:
        try:
            json_content = reporter.generate_json(analysis)
            with open(json_output, 'w', encoding='utf-8') as f:
                f.write(json_content)
            if not quiet:
                click.echo(f"📊 JSON 明细已写入: {json_output}")
        except Exception as e:
            click.echo(f"错误: 写入 JSON 文件失败: {str(e)}", err=True)
    
    if export_bib:
        try:
            clean_bib = reporter.generate_clean_bibtex(
                analysis,
                include_unused=include_unused,
                deduplicate=not no_dedupe
            )
            with open(export_bib, 'w', encoding='utf-8') as f:
                f.write(clean_bib)
            if not quiet:
                click.echo(f"📚 清洗后的 BibTeX 已写入: {export_bib}")
        except Exception as e:
            click.echo(f"错误: 导出 BibTeX 失败: {str(e)}", err=True)
    
    if has_issues:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == '__main__':
    main()
