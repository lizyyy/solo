#!/usr/bin/env python3
import click
import os
import sys
from pathlib import Path

from ua_parse import LogParser
from rule_matcher import RuleMatcher
from cluster import UnknownSampleCluster, IPTracker
from path_analyzer import PathAnalyzer
from reporter import Reporter


@click.group()
@click.version_option(version="1.0.0", prog_name="ua-classifier")
def cli():
    """User-Agent归类未知样本聚类排查CLI"""
    pass


@cli.command()
@click.argument("log_files", nargs=-1, type=click.Path(exists=True, file_okay=True, dir_okay=False))
@click.option("--rules", "-r", type=click.Path(exists=True), help="自定义分类规则YAML文件")
@click.option("--output-dir", "-o", default="reports", help="报告输出目录")
@click.option("--report-id", help="指定报告ID（用于重复运行时结果稳定）")
@click.option("--min-cluster-size", default=3, help="最小聚类样本数")
@click.option("--similarity-threshold", default=0.7, help="UA相似度阈值")
@click.option("--quiet", "-q", is_flag=True, help="静默模式，不打印控制台输出")
def analyze(log_files, rules, output_dir, report_id, min_cluster_size, similarity_threshold, quiet):
    """分析访问日志，进行UA分类和未知样本聚类"""
    
    if not log_files:
        click.echo("错误: 请指定至少一个日志文件")
        sys.exit(1)
    
    log_parser = LogParser()
    rule_matcher = RuleMatcher(rules_path=rules)
    clusterer = UnknownSampleCluster(
        min_cluster_size=min_cluster_size,
        similarity_threshold=similarity_threshold
    )
    ip_tracker = IPTracker()
    path_analyzer = PathAnalyzer()
    reporter = Reporter(output_dir=output_dir)
    
    all_entries = []
    total_lines = 0
    
    for log_file in log_files:
        if not quiet:
            click.echo(f"正在处理: {log_file}")
        
        with open(log_file, "r", encoding="utf-8", errors="replace") as f:
            for line_num, line in enumerate(f, start=1):
                total_lines += 1
                entry = log_parser.parse_line(line, line_num)
                all_entries.append(entry)
                
                if entry.is_valid and entry.parsed_ua:
                    rule_matcher.classify(entry)
                    ip_tracker.add_entry(entry)
                    path_analyzer.add_entry(entry)
    
    unknown_entries = [e for e in all_entries if e.category == "unknown" and e.is_valid]
    if unknown_entries:
        if not quiet:
            click.echo(f"正在聚类 {len(unknown_entries)} 个未知样本...")
        clusterer.add_entries(unknown_entries, category="unknown")
    
    risk_entries = [e for e in all_entries if e.category == "risk" and e.is_valid]
    if risk_entries:
        risk_clusterer = UnknownSampleCluster(
            min_cluster_size=max(2, min_cluster_size // 2),
            similarity_threshold=similarity_threshold
        )
        risk_clusterer.add_entries(risk_entries, category="risk")
        all_clusters = clusterer.get_clusters() + risk_clusterer.get_clusters()
    else:
        all_clusters = clusterer.get_clusters()
    
    if not quiet:
        click.echo(f"正在生成报告...")
    
    input_file_name = log_files[0] if len(log_files) == 1 else "multiple_files"
    report = reporter.generate_full_report(
        entries=all_entries,
        rule_matcher=rule_matcher,
        clusters=all_clusters,
        ip_tracker=ip_tracker,
        path_analyzer=path_analyzer,
        input_file=input_file_name,
        report_id=report_id
    )
    
    if not quiet:
        reporter.print_console_summary(report)
    
    click.echo(f"分析完成! 报告ID: {report['report_id']}")


@cli.command()
@click.argument("log_file", type=click.Path(exists=True))
@click.option("--category", "-c", type=click.Choice(["client", "crawler", "risk", "unknown"]), help="过滤分类")
@click.option("--limit", "-n", default=20, help="显示数量")
@click.option("--show-ua", is_flag=True, help="显示完整UA")
def top(log_file, category, limit, show_ua):
    """查看日志中的Top UA统计"""
    
    from collections import Counter
    
    log_parser = LogParser()
    rule_matcher = RuleMatcher()
    ua_counts = Counter()
    
    with open(log_file, "r", encoding="utf-8", errors="replace") as f:
        for line_num, line in enumerate(f, start=1):
            entry = log_parser.parse_line(line, line_num)
            if entry.is_valid and entry.user_agent:
                rule_matcher.classify(entry)
                if category and entry.category != category:
                    continue
                ua_counts[entry.user_agent] += 1
    
    click.echo(f"\nTop {limit} User-Agents:")
    for i, (ua, count) in enumerate(ua_counts.most_common(limit), 1):
        display_ua = ua if show_ua else (ua[:80] + "..." if len(ua) > 80 else ua)
        click.echo(f"{i:2d}. [{count:5d}] {display_ua}")
    click.echo()


@cli.command()
@click.argument("ua_string")
@click.option("--rules", "-r", type=click.Path(exists=True), help="自定义分类规则YAML文件")
def parse(ua_string, rules):
    """解析单个User-Agent字符串并分类"""
    
    from ua_parse import UAParser
    from rule_matcher import RuleMatcher
    
    ua_parser = UAParser()
    rule_matcher = RuleMatcher(rules_path=rules)
    
    parsed = ua_parser.parse(ua_string)
    
    click.echo("\n[解析结果]")
    click.echo(f"  UA Family: {parsed.family} {parsed.major}")
    click.echo(f"  OS Family: {parsed.os_family} {parsed.os_major}")
    click.echo(f"  Device:    {parsed.device_family}")
    click.echo(f"  Is Bot:    {parsed.is_bot}")
    click.echo(f"  Is Mobile: {parsed.is_mobile}")
    click.echo(f"  Is PC:     {parsed.is_pc}")
    click.echo(f"  UA Hash:   {parsed.hash}")
    
    from ua_parser import LogEntry
    entry = LogEntry(line_number=0, raw_line="")
    entry.user_agent = ua_string
    entry.parsed_ua = parsed
    
    category = rule_matcher.classify(entry)
    click.echo(f"\n[分类结果]")
    click.echo(f"  Category:  {category}")
    click.echo(f"  Reason:    {entry.category_reason}")
    click.echo()


@cli.command()
def init_config():
    """初始化默认分类规则配置文件"""
    
    config_content = """# User-Agent 分类规则配置
# priority: 优先级，数字越大优先级越高
# category: client(客户端), crawler(爬虫), risk(风险)

rules:
  - name: "企业内网浏览器"
    category: "client"
    priority: 90
    ua_families:
      - "Chrome"
      - "Firefox"
      - "Safari"
      - "Edge"
    os_families:
      - "Windows"
      - "Mac OS X"
    is_bot: false

  - name: "移动端APP"
    category: "client"
    priority: 85
    patterns:
      - "okhttp"
      - "CFNetwork"
      - "Darwin"
      - "AndroidDownloadManager"
    is_bot: false

  - name: "搜索引擎爬虫"
    category: "crawler"
    priority: 95
    patterns:
      - "googlebot"
      - "bingbot"
      - "baiduspider"
      - "yandexbot"
      - "sogou"
      - "360spider"
      - "bytespider"
      - "petalbot"
    is_bot: true

  - name: "安全扫描器"
    category: "risk"
    priority: 100
    patterns:
      - "masscan"
      - "nmap"
      - "nessus"
      - "burp"
      - "sqlmap"
      - "nikto"
      - "dirbuster"
      - "gobuster"
      - "feroxbuster"
      - "metasploit"
      - "zgrab"
      - "zmap"
      - "shodan"

  - name: "脚本工具"
    category: "risk"
    priority: 80
    patterns:
      - "curl/"
      - "wget/"
      - "python-requests"
      - "python-urllib"
      - "go-http-client"
      - "java/"
      - "perl-"
      - "php/"
      - "node-fetch"
      - "axios"
"""
    
    config_file = Path("ua_rules.yaml")
    if config_file.exists():
        if not click.confirm(f"配置文件 {config_file} 已存在，是否覆盖?"):
            click.echo("已取消")
            return
    
    with open(config_file, "w", encoding="utf-8") as f:
        f.write(config_content)
    
    click.echo(f"已创建配置文件: {config_file}")


@cli.command()
@click.argument("report_file", type=click.Path(exists=True))
def view(report_file):
    """查看已生成的报告摘要"""
    
    import json
    
    with open(report_file, "r", encoding="utf-8") as f:
        report = json.load(f)
    
    from reporter import Reporter
    reporter = Reporter()
    reporter.print_console_summary(report)


if __name__ == "__main__":
    cli()