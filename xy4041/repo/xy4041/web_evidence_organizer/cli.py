#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
CLI 入口模块
提供 init、import、extract、check、redact、report、verify 命令
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import click

from . import __version__
from .config import (
    AuditLogEntry,
    CaseConfig,
    EvidenceRecord,
    TimeTrustLevel,
)
from .hasher import Hasher
from .importer import EvidenceImporter
from .quarantine import QuarantineManager
from .redactor import Redactor
from .reporter import Reporter
from .timeline import TimelineExtractor
from .validator import Validator


def get_config_path() -> str:
    """获取配置文件路径"""
    return str(Path.cwd() / "case_config.json")


def load_config() -> CaseConfig:
    """加载配置文件"""
    config_path = get_config_path()
    if not Path(config_path).exists():
        click.echo(f"错误: 配置文件不存在: {config_path}")
        click.echo("请先运行 'evidence init' 命令初始化案件")
        sys.exit(1)
    return CaseConfig.load(config_path)


def get_evidence_index_path() -> str:
    """获取证据索引路径"""
    return str(Path.cwd() / "output" / "evidence_index.json")


def load_evidence_records() -> List[EvidenceRecord]:
    """加载证据记录"""
    index_path = get_evidence_index_path()
    if not Path(index_path).exists():
        click.echo(f"错误: 证据索引不存在: {index_path}")
        click.echo("请先运行 'evidence import' 命令导入证据")
        sys.exit(1)
    return EvidenceImporter.load_evidence_index(index_path)


def get_timeline_path() -> str:
    """获取时间线路径"""
    return str(Path.cwd() / "output" / "timeline.json")


@click.group()
@click.version_option(__version__, "--version", "-v")
def cli():
    """网页证据包整理员 - 为法务助理和售后仲裁小组设计的证据整理工具"""
    pass


@cli.command()
@click.option("--case-id", "-i", required=True, help="案件唯一标识")
@click.option("--case-name", "-n", required=True, help="案件名称")
@click.option("--timezone", "-t", default="Asia/Shanghai", help="时区（默认: Asia/Shanghai）")
@click.option("--output-dir", "-o", default="./output", help="输出目录（默认: ./output）")
@click.option("--evidence-dir", "-e", default="./evidence", help="证据存储目录（默认: ./evidence）")
@click.option("--max-size", "-s", default=100, type=int, help="附件最大大小(MB)（默认: 100）")
@click.option("--force", "-f", is_flag=True, help="覆盖现有配置")
def init(
    case_id: str,
    case_name: str,
    timezone: str,
    output_dir: str,
    evidence_dir: str,
    max_size: int,
    force: bool,
):
    """初始化案件配置

    创建案件配置文件，包括证据类型、脱敏规则、时区设置等。
    """
    config_path = get_config_path()

    if Path(config_path).exists() and not force:
        click.echo(f"错误: 配置文件已存在: {config_path}")
        click.echo("使用 --force 选项覆盖现有配置")
        sys.exit(1)

    config = CaseConfig(
        case_id=case_id,
        case_name=case_name,
        timezone=timezone,
        output_dir=output_dir,
        evidence_evidence_dir=evidence_dir,
        max_attachment_size_mb=max_size,
    )

    for dir_path in [output_dir, evidence_dir, config.quarantine_dir, config.redacted_dir]:
        Path(dir_path).mkdir(parents=True, exist_ok=True)

    config.save(config_path)

    click.echo(click.style("✓ 案件配置已创建", fg="green"))
    click.echo(f"  案件编号: {case_id}")
    click.echo(f"  案件名称: {case_name}")
    click.echo(f"  时区: {timezone}")
    click.echo(f"  配置文件: {config_path}")


@cli.command("import")
@click.argument("source_dirs", nargs=-1, required=True)
@click.option("--evidence-dir", "-e", help="证据存储目录（默认使用配置中的目录）")
@click.option("--output", "-o", help="证据索引输出路径")
def import_evidence(source_dirs: List[str], evidence_dir: str, output: str):
    """导入证据文件

    从一个或多个目录导入 HTML/MHTML/HAR/PNG/JPG/PDF/TXT 文件，
    保留原始文件，计算 SHA256，识别重复文件。

    SOURCE_DIRS: 一个或多个源目录路径
    """
    config = load_config()

    evidence_dir = evidence_dir or config.evidence_evidence_dir
    output = output or get_evidence_index_path()

    existing_records = []
    if Path(output).exists():
        try:
            existing_records = EvidenceImporter.load_evidence_index(output)
        except Exception:
            pass

    importer = EvidenceImporter(config)

    for record in existing_records:
        if Path(record.file_path).exists():
            importer.duplicate_detector.add_file(record.file_path, record.evidence_id)

    click.echo(f"正在扫描 {len(source_dirs)} 个目录...")

    results = importer.import_multiple_directories(
        list(source_dirs),
        evidence_dir,
    )

    all_records = existing_records + importer.evidence_records
    importer.evidence_records = all_records
    importer.save_evidence_index(output)

    click.echo("\n" + click.style("导入结果:", fg="cyan"))
    click.echo(f"  总文件数: {results['total']}")
    click.echo(f"  成功导入: {click.style(str(results['imported']), fg='green')}")
    if results["duplicates"] > 0:
        click.echo(f"  跳过重复: {click.style(str(results['duplicates']), fg='yellow')}")
    if results["name_conflicts"] > 0:
        click.echo(f"  文件名冲突: {click.style(str(results['name_conflicts']), fg='yellow')}")
    if results["skipped"] > 0:
        click.echo(f"  跳过: {click.style(str(results['skipped']), fg='yellow')}")
    if results["errors"] > 0:
        click.echo(f"  错误: {click.style(str(results['errors']), fg='red')}")

    click.echo(f"\n证据索引已保存: {output}")


@cli.command("extract")
@click.option("--evidence-index", "-i", help="证据索引路径（默认: output/evidence_index.json）")
@click.option("--output", "-o", help="时间线输出路径（默认: output/timeline.json）")
def extract(evidence_index: str, output: str):
    """提取时间线事件

    从 HTML 标题、meta、HAR request/response、
    文本聊天记录和文件修改时间里抽取事件，
    统一成带来源、时间、可信度和摘要的 timeline.json。
    """
    config = load_config()

    evidence_index = evidence_index or get_evidence_index_path()
    output = output or get_timeline_path()

    if not Path(evidence_index).exists():
        click.echo(f"错误: 证据索引不存在: {evidence_index}")
        sys.exit(1)

    evidence_records = EvidenceImporter.load_evidence_index(evidence_index)

    click.echo(f"正在从 {len(evidence_records)} 个证据提取事件...")

    extractor = TimelineExtractor(config)
    events = extractor.extract_from_evidence(evidence_records)
    normalized_events = extractor.normalize_events(events)

    click.echo(f"提取到 {len(normalized_events)} 个事件")

    extractor.save_timeline(normalized_events, output)

    stats = extractor.get_statistics(normalized_events)

    click.echo("\n" + click.style("时间线统计:", fg="cyan"))
    click.echo(f"  总事件数: {stats['total_events']}")
    click.echo(f"  来源分布: {stats['source_distribution']}")
    click.echo(f"  可信度分布: {stats['trust_distribution']}")

    time_range = stats.get("time_range", {})
    if time_range.get("start") and time_range.get("end"):
        click.echo(f"  时间范围: {time_range['start']} 至 {time_range['end']}")
        click.echo(f"  持续时长: {time_range['duration_hours']} 小时")

    click.echo(f"\n时间线已保存: {output}")


@cli.command("check")
@click.option("--evidence-index", "-i", help="证据索引路径")
@click.option("--timeline", "-t", help="时间线路径（可选）")
@click.option("--quarantine", "-q", is_flag=True, help="将问题证据移入隔离区")
@click.option("--output", "-o", help="隔离区文件输出路径")
def check(evidence_index: str, timeline: str, quarantine: bool, output: str):
    """校验证据问题

    校验证据编号缺失、时间倒序、跨时区冲突、
    附件哈希重复、HAR 里有 4xx/5xx 关键请求、
    聊天记录缺页、敏感信息未脱敏这些问题。
    坏项进入 quarantine.json 并说明原因。
    """
    config = load_config()

    evidence_index = evidence_index or get_evidence_index_path()
    timeline = timeline or get_timeline_path()

    if not Path(evidence_index).exists():
        click.echo(f"错误: 证据索引不存在: {evidence_index}")
        sys.exit(1)

    evidence_records = EvidenceImporter.load_evidence_index(evidence_index)

    timeline_events = None
    if Path(timeline).exists():
        try:
            timeline_data = TimelineExtractor.load_timeline(timeline)
            timeline_events = []
        except Exception:
            pass

    click.echo("正在执行校验...")

    validator = Validator(config)
    issues = validator.validate_all(evidence_records, timeline_events)

    summary = validator.get_issues_summary()

    click.echo("\n" + click.style("校验结果:", fg="cyan"))
    click.echo(f"  总问题数: {summary['total_issues']}")

    sev = summary.get("severity_distribution", {})
    if sev.get("critical", 0) > 0:
        click.echo(f"  严重问题: {click.style(str(sev['critical']), fg='red')}")
    if sev.get("high", 0) > 0:
        click.echo(f"  高危问题: {click.style(str(sev['high']), fg='yellow')}")
    if sev.get("medium", 0) > 0:
        click.echo(f"  中等问题: {click.style(str(sev['medium']), fg='blue')}")
    if sev.get("low", 0) > 0:
        click.echo(f"  低危问题: {click.style(str(sev['low']), fg='green')}")

    if summary["total_issues"] > 0:
        click.echo("\n" + click.style("问题详情:", fg="yellow"))
        for issue in issues:
            sev_color = {
                "critical": "red",
                "high": "yellow",
                "medium": "blue",
                "low": "green",
            }.get(issue.severity, "white")

            click.echo(f"\n  [{issue.issue_id}] {click.style(issue.severity.upper(), fg=sev_color)}")
            click.echo(f"  类型: {issue.issue_type}")
            click.echo(f"  描述: {issue.description}")
            if issue.evidence_id:
                click.echo(f"  证据编号: {issue.evidence_id}")
            if issue.file_path:
                click.echo(f"  文件: {issue.file_path}")
            if issue.suggested_action:
                click.echo(f"  建议: {issue.suggested_action}")

    if quarantine and issues:
        quarantine_manager = QuarantineManager(config)
        quarantined_items = quarantine_manager.add_issues_to_quarantine(issues, evidence_records)

        output = output or str(Path(config.quarantine_dir) / "quarantine.json")
        quarantine_manager.save_quarantine_json(output)

        click.echo(f"\n{len(quarantined_items)} 个问题项已移入隔离区")
        click.echo(f"隔离区文件: {output}")

    if not issues:
        click.echo(click.style("\n✓ 未发现问题", fg="green"))


@cli.command("redact")
@click.option("--evidence-index", "-i", help="证据索引路径")
@click.option("--output-dir", "-o", help="脱敏文件输出目录（默认: ./redacted）")
@click.option("--rule", "-r", multiple=True, help="自定义脱敏关键词（可多次使用）")
def redact(evidence_index: str, output_dir: str, rule: List[str]):
    """脱敏敏感信息

    按配置把手机号、邮箱、身份证号、地址
    和自定义关键词脱敏，不能改动原始证据，
    只能生成 redacted 副本。
    """
    config = load_config()

    evidence_index = evidence_index or get_evidence_index_path()
    output_dir = output_dir or config.redacted_dir

    if rule:
        config.custom_redaction_keywords = list(rule)

    if not Path(evidence_index).exists():
        click.echo(f"错误: 证据索引不存在: {evidence_index}")
        sys.exit(1)

    evidence_records = EvidenceImporter.load_evidence_index(evidence_index)

    click.echo(f"正在对 {len(evidence_records)} 个证据进行脱敏...")

    redactor = Redactor(config)
    results = redactor.redact_evidence(evidence_records, output_dir)

    click.echo("\n" + click.style("脱敏结果:", fg="cyan"))
    click.echo(f"  总文件数: {results['total_files']}")
    click.echo(f"  成功: {click.style(str(results['success_count']), fg='green')}")
    if results['error_count'] > 0:
        click.echo(f"  错误: {click.style(str(results['error_count']), fg='red')}")
    click.echo(f"  总脱敏次数: {results['total_redactions']}")
    click.echo(f"  涉及文件数: {results['files_with_redactions']}")

    log_path = str(Path(output_dir) / "redaction_log.json")
    redactor.save_redaction_log(log_path)

    click.echo(f"\n脱敏文件已保存至: {output_dir}")
    click.echo(f"脱敏日志: {log_path}")


@cli.command("report")
@click.option("--evidence-index", "-i", help="证据索引路径")
@click.option("--timeline", "-t", help="时间线路径（可选）")
@click.option("--output-dir", "-o", help="报告输出目录（默认: ./output）")
@click.option("--prefix", "-p", default="", help="报告文件名前缀")
@click.option("--format", "-f", "formats", multiple=True,
              type=click.Choice(["markdown", "csv", "json", "all"]),
              default=["all"],
              help="输出格式（默认: all）")
def report(evidence_index: str, timeline: str, output_dir: str, prefix: str, formats: List[str]):
    """导出报告

    导出 Markdown 证据目录、CSV 时间线和 JSON 审计清单。
    """
    config = load_config()

    evidence_index = evidence_index or get_evidence_index_path()
    timeline = timeline or get_timeline_path()
    output_dir = output_dir or config.output_dir

    if not Path(evidence_index).exists():
        click.echo(f"错误: 证据索引不存在: {evidence_index}")
        sys.exit(1)

    evidence_records = EvidenceImporter.load_evidence_index(evidence_index)

    timeline_events = None
    if Path(timeline).exists():
        try:
            timeline_data = TimelineExtractor.load_timeline(timeline)
            timeline_events = []
        except Exception:
            pass

    reporter = Reporter(config)

    click.echo("正在生成报告...")

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    export_all = "all" in formats
    report_paths = {}

    if export_all or "markdown" in formats:
        md_path = output_path / f"{prefix}evidence_catalog.md" if prefix else output_path / "evidence_catalog.md"
        reporter.export_evidence_markdown(evidence_records, str(md_path))
        report_paths["markdown"] = str(md_path.absolute())
        click.echo(f"  ✓ Markdown 证据目录: {md_path}")

    if export_all or "csv" in formats:
        if timeline_events:
            csv_path = output_path / f"{prefix}timeline.csv" if prefix else output_path / "timeline.csv"
            reporter.export_timeline_csv(timeline_events, str(csv_path))
            report_paths["csv"] = str(csv_path.absolute())
            click.echo(f"  ✓ CSV 时间线: {csv_path}")
        else:
            click.echo(f"  ⚠  跳过 CSV 时间线（时间线文件不存在）")

    if export_all or "json" in formats:
        json_path = output_path / f"{prefix}audit_manifest.json" if prefix else output_path / "audit_manifest.json"
        reporter.export_audit_json(
            evidence_records,
            timeline_events,
            None,
            str(json_path),
        )
        report_paths["json"] = str(json_path.absolute())
        click.echo(f"  ✓ JSON 审计清单: {json_path}")

    click.echo(click.style(f"\n✓ 报告已生成", fg="green"))


@cli.command("verify")
@click.option("--evidence-index", "-i", help="证据索引路径")
@click.option("--output", "-o", help="验证结果输出路径")
def verify(evidence_index: str, output: str):
    """校验证据完整性

    重新校验哈希并报告哪些文件被移动、
    丢失或内容变化。
    """
    config = load_config()

    evidence_index = evidence_index or get_evidence_index_path()

    if not Path(evidence_index).exists():
        click.echo(f"错误: 证据索引不存在: {evidence_index}")
        sys.exit(1)

    evidence_records = EvidenceImporter.load_evidence_index(evidence_index)

    click.echo(f"正在验证 {len(evidence_records)} 个证据的完整性...")

    results = {
        "verified_at": datetime.now().isoformat(),
        "total": len(evidence_records),
        "valid": 0,
        "missing": 0,
        "modified": 0,
        "moved": 0,
        "details": [],
    }

    for record in evidence_records:
        file_path = Path(record.file_path)
        detail = {
            "evidence_id": record.evidence_id,
            "original_filename": record.original_filename,
            "stored_path": record.file_path,
            "expected_hash": record.sha256_hash,
            "status": "unknown",
        }

        if not file_path.exists():
            detail["status"] = "missing"
            detail["error"] = "文件不存在"
            results["missing"] += 1
        else:
            actual_hash = Hasher.compute_file_hash(str(file_path))
            detail["actual_hash"] = actual_hash

            if actual_hash.lower() == record.sha256_hash.lower():
                detail["status"] = "valid"
                results["valid"] += 1
            else:
                detail["status"] = "modified"
                detail["error"] = "哈希不匹配，文件内容可能被修改"
                results["modified"] += 1

        results["details"].append(detail)

        status_color = {
            "valid": "green",
            "missing": "red",
            "modified": "yellow",
        }.get(detail["status"], "white")

        click.echo(f"  [{record.evidence_id}] {click.style(detail['status'].upper(), fg=status_color)} - {record.original_filename}")

    click.echo("\n" + click.style("验证结果:", fg="cyan"))
    click.echo(f"  总文件数: {results['total']}")
    click.echo(f"  完整有效: {click.style(str(results['valid']), fg='green')}")
    if results['missing'] > 0:
        click.echo(f"  丢失文件: {click.style(str(results['missing']), fg='red')}")
    if results['modified'] > 0:
        click.echo(f"  被修改文件: {click.style(str(results['modified']), fg='yellow')}")

    if output:
        Path(output).parent.mkdir(parents=True, exist_ok=True)
        with open(output, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        click.echo(f"\n验证结果已保存: {output}")

    if results["valid"] == results["total"]:
        click.echo(click.style("\n✓ 所有证据完整有效", fg="green"))
    else:
        click.echo(click.style("\n⚠ 发现问题，请检查详细报告", fg="yellow"))


if __name__ == "__main__":
    cli()
