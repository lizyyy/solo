#!/usr/bin/env python3
import click
import json
from pathlib import Path
from typing import List, Optional
from webhook_verifier.models import VerificationRule
from webhook_verifier.parser import LogParser
from webhook_verifier.rules import VerificationEngine
from webhook_verifier.tracker import SourceTracker, ResultStabilizer
from webhook_verifier.reporter import ReportGenerator


@click.group()
def cli():
    """Webhook供应商切换双投验证排查工具"""
    pass


@cli.command()
@click.option("--old-endpoint", required=True, help="旧webhook地址")
@click.option("--new-endpoint", required=True, help="新webhook地址")
@click.option("--vendor", required=True, help="供应商名称")
@click.option("--event-type", required=True, help="事件类型")
@click.option("--log-files", required=True, multiple=True, help="日志文件路径，可指定多个")
@click.option("--window-seconds", default=300, help="双投匹配窗口秒数，默认300")
@click.option("--min-success-rate", default=0.95, help="最低成功率要求，默认0.95")
@click.option("--required-consecutive", default=100, help="要求连续成功数，默认100")
@click.option("--output-dir", default="./reports", help="报告输出目录")
@click.option("--format", type=click.Choice(["console", "json", "csv", "excel", "all"]), default="all")
def verify(
    old_endpoint: str,
    new_endpoint: str,
    vendor: str,
    event_type: str,
    log_files: List[str],
    window_seconds: int,
    min_success_rate: float,
    required_consecutive: int,
    output_dir: str,
    format: str,
):
    """执行双投验证"""

    rule = VerificationRule(
        vendor=vendor,
        event_type=event_type,
        dual_delivery_window_seconds=window_seconds,
        min_success_rate=min_success_rate,
        required_consecutive_success=required_consecutive,
    )

    parser = LogParser(old_endpoint=old_endpoint, new_endpoint=new_endpoint, vendor=vendor)
    parse_result = parser.parse_files(log_files)

    source_tracker = SourceTracker()
    source_tracker.track_parse_result(parse_result)

    stabilized_events = ResultStabilizer.stabilize_event_list(parse_result.valid_events)

    engine = VerificationEngine(old_endpoint, new_endpoint, [rule])
    verification_results = engine.verify(stabilized_events)

    all_dual_results: List = []
    conclusions = {}
    for key, result in verification_results.items():
        stabilized = ResultStabilizer.stabilize_dual_delivery_results(result["dual_delivery_results"])
        all_dual_results.extend(stabilized)
        conclusions[f"{key[0]}_{key[1]}"] = result["conclusion"]

    reporter = ReportGenerator(output_dir)

    if format in ["console", "all"]:
        summary = reporter.generate_console_summary(conclusions, parse_result)
        click.echo(summary)

    if format in ["json", "all"]:
        json_path = reporter.generate_json_report(conclusions, all_dual_results, source_tracker)
        click.echo(f"\nJSON报告已生成: {json_path}")

    if format in ["csv", "all"]:
        csv_files = reporter.generate_csv_reports(conclusions, all_dual_results, source_tracker)
        click.echo(f"\nCSV报告已生成:")
        for name, path in csv_files.items():
            click.echo(f"  - {name}: {path}")

    if format in ["excel", "all"]:
        excel_path = reporter.generate_excel_report(conclusions, all_dual_results, source_tracker)
        click.echo(f"\nExcel报告已生成: {excel_path}")


@cli.command()
@click.option("--config", required=True, help="配置文件路径(JSON格式)")
@click.option("--log-files", required=True, multiple=True, help="日志文件路径")
@click.option("--output-dir", default="./reports", help="报告输出目录")
@click.option("--format", type=click.Choice(["console", "json", "csv", "excel", "all"]), default="all")
def verify_with_config(config: str, log_files: List[str], output_dir: str, format: str):
    """使用配置文件执行验证（支持多供应商、多事件类型）"""

    with open(config, "r", encoding="utf-8") as f:
        config_data = json.load(f)

    old_endpoint = config_data["old_endpoint"]
    new_endpoint = config_data["new_endpoint"]
    rules_config = config_data.get("rules", [])

    rules = []
    for rc in rules_config:
        rules.append(VerificationRule(
            vendor=rc["vendor"],
            event_type=rc["event_type"],
            dual_delivery_window_seconds=rc.get("window_seconds", 300),
            min_success_rate=rc.get("min_success_rate", 0.95),
            required_consecutive_success=rc.get("required_consecutive", 100),
        ))

    if not rules:
        click.echo("错误: 配置文件中未定义验证规则")
        return

    default_vendor = rules_config[0]["vendor"] if rules_config else None
    parser = LogParser(old_endpoint=old_endpoint, new_endpoint=new_endpoint, vendor=default_vendor)
    parse_result = parser.parse_files(log_files)

    source_tracker = SourceTracker()
    source_tracker.track_parse_result(parse_result)

    stabilized_events = ResultStabilizer.stabilize_event_list(parse_result.valid_events)

    engine = VerificationEngine(old_endpoint, new_endpoint, rules)
    verification_results = engine.verify(stabilized_events)

    all_dual_results = []
    conclusions = {}
    for key, result in verification_results.items():
        stabilized = ResultStabilizer.stabilize_dual_delivery_results(result["dual_delivery_results"])
        all_dual_results.extend(stabilized)
        conclusions[f"{key[0]}_{key[1]}"] = result["conclusion"]

    all_dual_results = ResultStabilizer.stabilize_dual_delivery_results(all_dual_results)

    reporter = ReportGenerator(output_dir)

    if format in ["console", "all"]:
        summary = reporter.generate_console_summary(conclusions, parse_result)
        click.echo(summary)

    if format in ["json", "all"]:
        json_path = reporter.generate_json_report(conclusions, all_dual_results, source_tracker)
        click.echo(f"\nJSON报告已生成: {json_path}")

    if format in ["csv", "all"]:
        csv_files = reporter.generate_csv_reports(conclusions, all_dual_results, source_tracker)
        click.echo(f"\nCSV报告已生成:")
        for name, path in csv_files.items():
            click.echo(f"  - {name}: {path}")

    if format in ["excel", "all"]:
        excel_path = reporter.generate_excel_report(conclusions, all_dual_results, source_tracker)
        click.echo(f"\nExcel报告已生成: {excel_path}")


@cli.command()
@click.argument("output_path", default="sample_config.json")
def generate_config(output_path: str):
    """生成示例配置文件"""
    sample_config = {
        "old_endpoint": "https://example.com/old/webhook",
        "new_endpoint": "https://example.com/new/webhook",
        "rules": [
            {
                "vendor": "supplier_a",
                "event_type": "order_created",
                "window_seconds": 300,
                "min_success_rate": 0.95,
                "required_consecutive": 100
            },
            {
                "vendor": "supplier_a",
                "event_type": "order_updated",
                "window_seconds": 300,
                "min_success_rate": 0.95,
                "required_consecutive": 100
            }
        ]
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(sample_config, f, ensure_ascii=False, indent=2)
    click.echo(f"示例配置文件已生成: {output_path}")


@cli.command()
@click.argument("output_path", default="sample_log.jsonl")
def generate_sample_log(output_path: str):
    """生成示例日志文件用于测试"""
    import random
    from datetime import datetime, timedelta

    base_time = datetime.now() - timedelta(hours=1)

    with open(output_path, "w", encoding="utf-8") as f:
        for i in range(150):
            event_id = f"evt_{i:06d}"
            event_time = base_time + timedelta(seconds=i * 2)

            old_line = {
                "event_id": event_id,
                "event_type": "order_created",
                "vendor": "supplier_a",
                "timestamp": event_time.isoformat(),
                "endpoint": "https://example.com/old/webhook",
                "payload_hash": f"hash_{i}",
                "status_code": 200
            }
            f.write(json.dumps(old_line, ensure_ascii=False) + "\n")

            if i < 145:
                new_time = event_time + timedelta(seconds=random.uniform(0, 10))
                new_line = {
                    "event_id": event_id,
                    "event_type": "order_created",
                    "vendor": "supplier_a",
                    "timestamp": new_time.isoformat(),
                    "endpoint": "https://example.com/new/webhook",
                    "payload_hash": f"hash_{i}",
                    "status_code": 200
                }
                f.write(json.dumps(new_line, ensure_ascii=False) + "\n")

    click.echo(f"示例日志文件已生成: {output_path}")


if __name__ == "__main__":
    cli()
