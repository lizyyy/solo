import os
import sys
from pathlib import Path
from typing import Optional

import click

from . import __version__
from .parser import ConfigParser
from .matcher import RouteMatcher
from .reporter import Reporter
from .models import CheckResult


@click.group()
@click.version_option(version=__version__, prog_name="route-checker")
def main():
    """API网关路由体检CLI工具 - 验证路由配置并生成报告。"""
    pass


@main.command()
@click.argument('path', type=click.Path(exists=True))
@click.option('--json', '-j', 'json_output', type=click.Path(), help='输出JSON报告文件路径')
@click.option('--markdown', '-m', 'md_output', type=click.Path(), help='输出Markdown报告文件路径')
@click.option('--output-dir', '-o', type=click.Path(), help='报告输出目录')
@click.option('--no-terminal', is_flag=True, help='不显示终端输出')
@click.option('--strict', '-s', is_flag=True, help='严格模式：存在坏行时退出码非0')
def check(path: str, json_output: Optional[str], md_output: Optional[str], 
          output_dir: Optional[str], no_terminal: bool, strict: bool) -> None:
    """检查路由配置并生成体检报告。
    
    PATH 可以是文件或目录路径。
    """
    try:
        parser = ConfigParser()
        
        if os.path.isfile(path):
            routes, requests, bad_lines = parser.parse_file(path)
        else:
            routes, requests, bad_lines = parser.parse_directory(path)
        
        if not routes:
            click.echo(f"警告: 未找到任何路由规则", err=True)
        
        matcher = RouteMatcher(routes)
        match_results = matcher.match_all_requests(requests)
        
        unmatched_requests = [r.request for r in match_results if not r.is_matched]
        
        upstream_stats = {}
        for result in match_results:
            if result.matched_route:
                upstream = result.matched_route.upstream
                upstream_stats[upstream] = upstream_stats.get(upstream, 0) + 1
        
        check_result = CheckResult(
            routes=matcher.routes,
            requests=requests,
            match_results=match_results,
            unmatched_requests=unmatched_requests,
            bad_lines=bad_lines,
            upstream_stats=upstream_stats
        )
        
        reporter = Reporter(check_result)
        
        if not no_terminal:
            reporter.print_terminal_summary()
        
        if output_dir:
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)
            json_output = str(output_path / "route-check-report.json")
            md_output = str(output_path / "route-check-report.md")
        
        if json_output:
            reporter.generate_json_report(json_output)
            if not no_terminal:
                click.echo(f"\nJSON报告已生成: {json_output}")
        
        if md_output:
            reporter.generate_markdown_report(md_output)
            if not no_terminal:
                click.echo(f"Markdown报告已生成: {md_output}")
        
        if strict and bad_lines:
            sys.exit(1)
            
    except Exception as e:
        click.echo(f"错误: {str(e)}", err=True)
        sys.exit(1)


@main.command()
@click.argument('path', type=click.Path(exists=True))
@click.option('--type', '-t', 'config_type', type=click.Choice(['yaml', 'json', 'nginx', 'txt']), 
              help='强制指定配置类型')
def parse(path: str, config_type: Optional[str]) -> None:
    """仅解析配置文件，显示找到的路由规则。"""
    try:
        parser = ConfigParser()
        
        if os.path.isfile(path):
            routes, requests, bad_lines = parser.parse_file(path)
        else:
            routes, requests, bad_lines = parser.parse_directory(path)
        
        click.echo(f"找到 {len(routes)} 条路由规则:")
        for idx, route in enumerate(routes, 1):
            click.echo(f"  {idx}. {route.path} -> {route.upstream} ({route.match_type.value})")
        
        if requests:
            click.echo(f"\n找到 {len(requests)} 个请求样本")
        
        if bad_lines:
            click.echo(f"\n发现 {len(bad_lines)} 行解析错误:")
            for bl in bad_lines:
                click.echo(f"  行 {bl.line_number}: {bl.error_message}")
                
    except Exception as e:
        click.echo(f"错误: {str(e)}", err=True)
        sys.exit(1)


@main.command()
@click.argument('path', type=click.Path(exists=True))
def priority(path: str) -> None:
    """显示路由规则的优先级排序。"""
    try:
        parser = ConfigParser()
        
        if os.path.isfile(path):
            routes, requests, bad_lines = parser.parse_file(path)
        else:
            routes, requests, bad_lines = parser.parse_directory(path)
        
        matcher = RouteMatcher(routes)
        explanations = matcher.get_route_priority_explanation()
        
        click.echo("路由规则优先级排序（从高到低）:")
        click.echo("=" * 60)
        for explanation in explanations:
            click.echo(explanation)
        
        if bad_lines:
            click.echo(f"\n⚠️  注意: 发现 {len(bad_lines)} 行解析错误")
                
    except Exception as e:
        click.echo(f"错误: {str(e)}", err=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
