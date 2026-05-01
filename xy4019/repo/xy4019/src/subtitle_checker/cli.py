import os
import sys
from pathlib import Path
from typing import List, Optional, Tuple

import click

from . import __version__
from .config import ConfigManager
from .cache import CacheManager
from .parser import parse_file, generate_file
from .rules import RuleEngine
from .reporter import Reporter, create_check_result
from .fixer import FixerManager, generate_fixed_filename, FixResult
from .models import (
    SubtitleFile, CheckResult, IssueSeverity, Issue, ProjectConfig
)


class Context:
    def __init__(self):
        self.config_manager: Optional[ConfigManager] = None
        self.config: Optional[ProjectConfig] = None
        self.verbose: bool = False


pass_context = click.make_pass_decorator(Context, ensure=True)


@click.group()
@click.version_option(version=__version__, prog_name='subtitle-checker')
@click.option('-v', '--verbose', is_flag=True, help='显示详细输出')
@pass_context
def main(ctx: Context, verbose: bool):
    """纪录片字幕质检工具 - 用于检查和修复字幕文件"""
    ctx.verbose = verbose
    
    try:
        ctx.config_manager = ConfigManager()
        ctx.config = ctx.config_manager.load()
    except Exception as e:
        if verbose:
            click.echo(f"警告: 加载配置时出错: {e}", err=True)


@main.command()
@click.argument('project_name', required=False, default='My Project')
@pass_context
def init(ctx: Context, project_name: str):
    """初始化新项目配置"""
    try:
        config = ctx.config_manager.init_project(project_name)
        click.echo(f"✅ 项目 '{project_name}' 初始化成功!")
        click.echo(f"   配置文件: {ctx.config_manager.config_path}")
        click.echo("")
        click.echo("接下来可以:")
        click.echo("  - subtitle-checker speaker add '张三' --alias '张教授' '张老师'")
        click.echo("  - subtitle-checker term add '人工智能' --alt 'AI' '机器智能'")
        click.echo("  - subtitle-checker check path/to/subtitles")
    except FileExistsError:
        click.echo(f"❌ 配置文件已存在: {ctx.config_manager.config_path}", err=True)
        click.echo("   如果要重新初始化，请先删除该文件", err=True)
        sys.exit(1)


@main.group()
def speaker():
    """管理说话人配置"""
    pass


@speaker.command('add')
@click.argument('name')
@click.option('--alias', '-a', multiple=True, help='说话人别名（可多次使用）')
@click.option('--primary/--no-primary', default=True, help='是否为主要说话人')
@pass_context
def speaker_add(ctx: Context, name: str, alias: Tuple[str], primary: bool):
    """添加说话人"""
    try:
        speaker = ctx.config_manager.add_speaker(
            name=name,
            aliases=list(alias),
            is_primary=primary
        )
        click.echo(f"✅ 说话人 '{name}' 添加成功!")
        if alias:
            click.echo(f"   别名: {', '.join(alias)}")
    except ValueError as e:
        click.echo(f"❌ {e}", err=True)
        sys.exit(1)


@speaker.command('list')
@pass_context
def speaker_list(ctx: Context):
    """列出所有说话人"""
    if not ctx.config.speakers:
        click.echo("暂无说话人配置")
        return
    
    click.echo("说话人列表:")
    for i, speaker in enumerate(ctx.config.speakers, 1):
        primary_mark = "⭐" if speaker.is_primary else ""
        click.echo(f"  {i}. {primary_mark} {speaker.name}")
        if speaker.aliases:
            click.echo(f"     别名: {', '.join(speaker.aliases)}")


@main.group()
def term():
    """管理术语配置"""
    pass


@term.command('add')
@click.argument('correct')
@click.option('--alt', '-a', multiple=True, help='替代术语（可多次使用）')
@click.option('--category', '-c', default='general', help='术语分类')
@pass_context
def term_add(ctx: Context, correct: str, alt: Tuple[str], category: str):
    """添加术语"""
    try:
        term = ctx.config_manager.add_term(
            correct=correct,
            alternatives=list(alt),
            category=category
        )
        click.echo(f"✅ 术语 '{correct}' 添加成功!")
        if alt:
            click.echo(f"   替代术语: {', '.join(alt)}")
    except ValueError as e:
        click.echo(f"❌ {e}", err=True)
        sys.exit(1)


@term.command('list')
@pass_context
def term_list(ctx: Context):
    """列出所有术语"""
    if not ctx.config.terms:
        click.echo("暂无术语配置")
        return
    
    click.echo("术语列表:")
    for i, term in enumerate(ctx.config.terms, 1):
        click.echo(f"  {i}. [{term.category}] {term.correct}")
        if term.alternatives:
            click.echo(f"     替代: {', '.join(term.alternatives)}")


@main.group()
def forbidden():
    """管理禁用词配置"""
    pass


@forbidden.command('add')
@click.argument('word')
@click.option('--category', '-c', default='general', help='禁用词分类')
@click.option('--suggestion', '-s', help='替换建议')
@pass_context
def forbidden_add(ctx: Context, word: str, category: str, suggestion: Optional[str]):
    """添加禁用词"""
    try:
        fw = ctx.config_manager.add_forbidden_word(
            word=word,
            category=category,
            suggestion=suggestion
        )
        click.echo(f"✅ 禁用词 '{word}' 添加成功!")
        if suggestion:
            click.echo(f"   建议替换: {suggestion}")
    except ValueError as e:
        click.echo(f"❌ {e}", err=True)
        sys.exit(1)


@forbidden.command('list')
@pass_context
def forbidden_list(ctx: Context):
    """列出所有禁用词"""
    if not ctx.config.forbidden_words:
        click.echo("暂无禁用词配置")
        return
    
    click.echo("禁用词列表:")
    for i, fw in enumerate(ctx.config.forbidden_words, 1):
        click.echo(f"  {i}. [{fw.category}] {fw.word}")
        if fw.suggestion:
            click.echo(f"     建议: {fw.suggestion}")


def find_subtitle_files(paths: List[Path]) -> List[Path]:
    """查找所有字幕文件"""
    subtitle_files: List[Path] = []
    
    for path in paths:
        if path.is_file():
            if path.suffix.lower() in ['.srt', '.vtt']:
                subtitle_files.append(path)
        elif path.is_dir():
            for ext in ['*.srt', '*.vtt', '*.SRT', '*.VTT']:
                subtitle_files.extend(path.rglob(ext))
    
    return sorted(set(subtitle_files))


@main.command()
@click.argument('paths', nargs=-1, type=click.Path(exists=True, path_type=Path))
@click.option('--no-cache', is_flag=True, help='禁用缓存，强制重新检查')
@click.option('--format', '-f', 'output_format', type=click.Choice(['text', 'json', 'md']), 
              default='text', help='输出格式')
@click.option('--output', '-o', type=click.Path(path_type=Path), help='输出文件路径')
@click.option('--severity', '-s', type=click.Choice(['critical', 'error', 'warning', 'info']),
              multiple=True, help='只显示指定严重程度的问题')
@pass_context
def check(ctx: Context, paths: Tuple[Path], no_cache: bool, output_format: str, 
          output: Optional[Path], severity: Tuple[str]):
    """检查字幕文件中的问题"""
    if not paths:
        click.echo("❌ 请指定要检查的文件或目录", err=True)
        sys.exit(1)
    
    subtitle_files = find_subtitle_files(list(paths))
    
    if not subtitle_files:
        click.echo("❌ 未找到字幕文件 (.srt 或 .vtt)", err=True)
        sys.exit(1)
    
    click.echo(f"📂 发现 {len(subtitle_files)} 个字幕文件")
    click.echo("")
    
    config_hash = ctx.config_manager.config_hash
    cache_manager = CacheManager(config_hash=config_hash)
    rule_engine = RuleEngine()
    
    processed_files: List[SubtitleFile] = []
    total_issues = 0
    cached_count = 0
    
    severity_filter: List[IssueSeverity] = []
    if severity:
        severity_map = {
            'critical': IssueSeverity.CRITICAL,
            'error': IssueSeverity.ERROR,
            'warning': IssueSeverity.WARNING,
            'info': IssueSeverity.INFO
        }
        severity_filter = [severity_map[s] for s in severity]
    
    for file_path in subtitle_files:
        click.echo(f"🔍 检查: {file_path.name}")
        
        should_recheck = no_cache or cache_manager.should_recheck(file_path)
        
        if not should_recheck:
            cached_issues = cache_manager.get_cached_issues(file_path)
            if cached_issues:
                if ctx.verbose:
                    click.echo(f"   📦 使用缓存结果")
                
                subtitle_file = SubtitleFile(
                    path=file_path,
                    format=file_path.suffix.lower().lstrip('.')
                )
                
                from .models import IssueType
                issues = []
                for issue_data in cached_issues:
                    try:
                        issue_type = IssueType[issue_data['type']]
                        issue_severity = IssueSeverity[issue_data['severity']]
                        issues.append(Issue(
                            type=issue_type,
                            severity=issue_severity,
                            message=issue_data['message'],
                            file_path=Path(issue_data['file_path']) if issue_data.get('file_path') else None,
                            subtitle_index=issue_data.get('subtitle_index'),
                            original_text=issue_data.get('original_text'),
                            suggestion=issue_data.get('suggestion'),
                            context=issue_data.get('context', {})
                        ))
                    except (KeyError, ValueError):
                        continue
                
                subtitle_file.issues = issues
                processed_files.append(subtitle_file)
                cached_count += 1
                continue
        
        try:
            subtitle_file = parse_file(file_path)
            issues = rule_engine.check_file(subtitle_file, ctx.config)
            
            if severity_filter:
                issues = [i for i in issues if i.severity in severity_filter]
            
            subtitle_file.issues = issues
            processed_files.append(subtitle_file)
            
            if not no_cache:
                cache_manager.cache_issues(file_path, [i.to_dict() for i in issues])
            
            file_issue_count = len(issues)
            total_issues += file_issue_count
            
            if file_issue_count > 0:
                click.echo(f"   ❌ 发现 {file_issue_count} 个问题")
            else:
                click.echo(f"   ✅ 未发现问题")
                
        except Exception as e:
            click.echo(f"   ❌ 解析失败: {e}", err=True)
            continue
    
    click.echo("")
    click.echo(f"📊 检查完成: 共 {len(processed_files)} 个文件, {total_issues} 个问题")
    if cached_count > 0:
        click.echo(f"   其中 {cached_count} 个文件使用了缓存")
    
    check_result = create_check_result(processed_files, config_hash)
    
    if output_format == 'json':
        reporter = Reporter()
        json_content = reporter.generate_report(check_result, 'json')
        if output:
            output.parent.mkdir(parents=True, exist_ok=True)
            with open(output, 'w', encoding='utf-8') as f:
                f.write(json_content)
            click.echo(f"💾 JSON 报告已保存到: {output}")
        else:
            click.echo("")
            click.echo(json_content)
    
    elif output_format == 'md':
        reporter = Reporter()
        md_content = reporter.generate_report(check_result, 'md')
        if output:
            output.parent.mkdir(parents=True, exist_ok=True)
            with open(output, 'w', encoding='utf-8') as f:
                f.write(md_content)
            click.echo(f"💾 Markdown 报告已保存到: {output}")
        else:
            click.echo("")
            click.echo(md_content)
    
    elif output_format == 'text' and total_issues > 0:
        click.echo("")
        click.echo("=" * 60)
        click.echo("详细问题列表")
        click.echo("=" * 60)
        
        for subtitle_file in processed_files:
            if not subtitle_file.issues:
                continue
            
            click.echo("")
            click.echo(f"📄 文件: {subtitle_file.path.name}")
            click.echo("-" * 60)
            
            for issue in subtitle_file.issues:
                severity_emoji = {
                    IssueSeverity.CRITICAL: '🚨',
                    IssueSeverity.ERROR: '❌',
                    IssueSeverity.WARNING: '⚠️',
                    IssueSeverity.INFO: 'ℹ️',
                }.get(issue.severity, '')
                
                click.echo(f"{severity_emoji} [{issue.type.name}]")
                click.echo(f"   描述: {issue.message}")
                if issue.subtitle_index is not None:
                    click.echo(f"   位置: 第 {issue.subtitle_index} 条字幕")
                if issue.original_text:
                    click.echo(f"   原文: {issue.original_text[:50]}{'...' if len(issue.original_text) > 50 else ''}")
                if issue.suggestion:
                    click.echo(f"   建议: {issue.suggestion}")
                click.echo("")
    
    if total_issues > 0:
        sys.exit(1)


@main.command()
@click.argument('paths', nargs=-1, type=click.Path(exists=True, path_type=Path))
@click.option('--format', '-f', 'output_format', type=click.Choice(['json', 'md', 'all']), 
              default='all', help='报告格式')
@click.option('--output-dir', '-o', type=click.Path(path_type=Path), 
              default=Path('./reports'), help='输出目录')
@click.option('--no-cache', is_flag=True, help='禁用缓存，强制重新检查')
@pass_context
def report(ctx: Context, paths: Tuple[Path], output_format: str, 
           output_dir: Path, no_cache: bool):
    """生成质检报告"""
    if not paths:
        click.echo("❌ 请指定要检查的文件或目录", err=True)
        sys.exit(1)
    
    subtitle_files = find_subtitle_files(list(paths))
    
    if not subtitle_files:
        click.echo("❌ 未找到字幕文件 (.srt 或 .vtt)", err=True)
        sys.exit(1)
    
    click.echo(f"📂 发现 {len(subtitle_files)} 个字幕文件")
    click.echo("🔍 正在检查...")
    
    config_hash = ctx.config_manager.config_hash
    cache_manager = CacheManager(config_hash=config_hash)
    rule_engine = RuleEngine()
    
    processed_files: List[SubtitleFile] = []
    
    for file_path in subtitle_files:
        should_recheck = no_cache or cache_manager.should_recheck(file_path)
        
        if not should_recheck:
            cached_issues = cache_manager.get_cached_issues(file_path)
            if cached_issues:
                subtitle_file = SubtitleFile(
                    path=file_path,
                    format=file_path.suffix.lower().lstrip('.')
                )
                
                from .models import IssueType
                issues = []
                for issue_data in cached_issues:
                    try:
                        issue_type = IssueType[issue_data['type']]
                        issue_severity = IssueSeverity[issue_data['severity']]
                        issues.append(Issue(
                            type=issue_type,
                            severity=issue_severity,
                            message=issue_data['message'],
                            file_path=Path(issue_data['file_path']) if issue_data.get('file_path') else None,
                            subtitle_index=issue_data.get('subtitle_index'),
                            original_text=issue_data.get('original_text'),
                            suggestion=issue_data.get('suggestion'),
                            context=issue_data.get('context', {})
                        ))
                    except (KeyError, ValueError):
                        continue
                
                subtitle_file.issues = issues
                processed_files.append(subtitle_file)
                continue
        
        try:
            subtitle_file = parse_file(file_path)
            issues = rule_engine.check_file(subtitle_file, ctx.config)
            subtitle_file.issues = issues
            processed_files.append(subtitle_file)
            
            if not no_cache:
                cache_manager.cache_issues(file_path, [i.to_dict() for i in issues])
                
        except Exception as e:
            click.echo(f"   ❌ 解析失败 {file_path.name}: {e}", err=True)
            continue
    
    check_result = create_check_result(processed_files, config_hash)
    reporter = Reporter()
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    formats_to_generate = []
    if output_format == 'all':
        formats_to_generate = ['json', 'md']
    else:
        formats_to_generate = [output_format]
    
    for fmt in formats_to_generate:
        output_path = output_dir / f"subtitle_report.{fmt}"
        reporter.save_report(check_result, output_path, fmt)
        click.echo(f"💾 {fmt.upper()} 报告已保存到: {output_path}")
    
    click.echo("")
    click.echo(f"📊 报告摘要:")
    click.echo(f"   - 检查文件数: {check_result.total_files}")
    click.echo(f"   - 发现问题数: {check_result.total_issues}")


@main.command()
@click.argument('paths', nargs=-1, type=click.Path(exists=True, path_type=Path))
@click.option('--output-dir', '-o', type=click.Path(path_type=Path), 
              help='输出目录（默认为原文件同级目录）')
@click.option('--suffix', '-s', default='_fixed', help='修复后文件名后缀')
@click.option('--fixer', '-f', multiple=True, 
              type=click.Choice(['sequence', 'speaker', 'term']),
              help='指定要使用的修复器（可多次使用，默认使用所有安全修复器）')
@click.option('--dry-run', '-n', is_flag=True, help='预览修复内容但不实际写入文件')
@pass_context
def apply(ctx: Context, paths: Tuple[Path], output_dir: Optional[Path], 
          suffix: str, fixer: Tuple[str], dry_run: bool):
    """应用安全修复，生成修复后的副本（不覆盖原文件）"""
    if not paths:
        click.echo("❌ 请指定要修复的文件或目录", err=True)
        sys.exit(1)
    
    subtitle_files = find_subtitle_files(list(paths))
    
    if not subtitle_files:
        click.echo("❌ 未找到字幕文件 (.srt 或 .vtt)", err=True)
        sys.exit(1)
    
    click.echo(f"📂 发现 {len(subtitle_files)} 个字幕文件")
    click.echo("")
    
    fixer_manager = FixerManager()
    
    fixer_names_map = {
        'sequence': 'sequence_fixer',
        'speaker': 'speaker_fixer',
        'term': 'term_fixer',
    }
    
    fixer_names: Optional[List[str]] = None
    if fixer:
        fixer_names = [fixer_names_map[f] for f in fixer]
    
    total_fixes = 0
    results: List[FixResult] = []
    
    for file_path in subtitle_files:
        click.echo(f"🔧 处理: {file_path.name}")
        
        try:
            subtitle_file = parse_file(file_path)
            fixed_file, fixes = fixer_manager.fix_file(
                subtitle_file, ctx.config, fixer_names
            )
            
            fix_count = len(fixes)
            total_fixes += fix_count
            
            if fix_count == 0:
                click.echo(f"   ℹ️ 无需修复")
                results.append(FixResult(
                    success=True,
                    original_file=file_path,
                    fixes_applied=0,
                    message="无需修复"
                ))
                continue
            
            if dry_run:
                click.echo(f"   📋 预览: 将应用 {fix_count} 个修复")
                for i, fix in enumerate(fixes[:5], 1):
                    fix_type = fix.get('type', 'unknown')
                    click.echo(f"      {i}. [{fix_type}] {str(fix)[:50]}...")
                if len(fixes) > 5:
                    click.echo(f"      ... 还有 {len(fixes) - 5} 个修复")
                
                results.append(FixResult(
                    success=True,
                    original_file=file_path,
                    fixes_applied=fix_count,
                    fixes_details=fixes,
                    message="预览模式，未实际写入"
                ))
            else:
                if output_dir:
                    output_path = output_dir / file_path.name
                    output_path = output_path.with_stem(output_path.stem + suffix)
                else:
                    output_path = generate_fixed_filename(file_path, suffix)
                
                output_path.parent.mkdir(parents=True, exist_ok=True)
                generate_file(fixed_file, output_path, subtitle_file.encoding)
                
                click.echo(f"   ✅ 应用了 {fix_count} 个修复")
                click.echo(f"   💾 保存到: {output_path}")
                
                results.append(FixResult(
                    success=True,
                    original_file=file_path,
                    fixed_file=output_path,
                    fixes_applied=fix_count,
                    fixes_details=fixes,
                    message="修复成功"
                ))
                
        except Exception as e:
            click.echo(f"   ❌ 处理失败: {e}", err=True)
            results.append(FixResult(
                success=False,
                original_file=file_path,
                message=str(e)
            ))
            continue
    
    click.echo("")
    click.echo(f"📊 处理完成: 共 {len(results)} 个文件, {total_fixes} 个修复")
    
    if dry_run:
        click.echo("   (预览模式，未实际修改文件)")


@main.command('cache-clear')
@pass_context
def cache_clear(ctx: Context):
    """清除缓存"""
    config_hash = ctx.config_manager.config_hash
    cache_manager = CacheManager(config_hash=config_hash)
    
    stats = cache_manager.get_cache_stats()
    click.echo(f"📦 缓存状态:")
    click.echo(f"   - 缓存条目数: {stats['total_entries']}")
    click.echo(f"   - 配置是否变更: {'是' if stats['config_changed'] else '否'}")
    click.echo(f"   - 缓存文件: {stats['cache_file']}")
    
    click.echo("")
    if click.confirm("确定要清除缓存吗？"):
        cache_manager.clear()
        click.echo("✅ 缓存已清除")
    else:
        click.echo("取消操作")


@main.command('config-show')
@pass_context
def config_show(ctx: Context):
    """显示当前配置"""
    import json
    
    click.echo(f"📄 配置文件: {ctx.config_manager.config_path}")
    click.echo("")
    click.echo(json.dumps(ctx.config.to_dict(), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
