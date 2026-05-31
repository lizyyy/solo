#!/usr/bin/env python3
import os
import sys
import click
from dam_analyzer.config import Config
from dam_analyzer.battle_parser import BattleParser
from dam_analyzer.state_manager import StateManager
from dam_analyzer.anomaly_detector import AnomalyDetector
from dam_analyzer.exporter import Exporter
from dam_analyzer.report_generator import ReportGenerator
from dam_analyzer.models import RecordStatus


class DamAnalyzerApp:
    def __init__(self):
        self.config = Config()
        self.parser = BattleParser(self.config)
        self.state = StateManager(self.config)
        self.detector = AnomalyDetector(self.config)
        self.exporter = Exporter(self.config)
        self.reporter = ReportGenerator(self.config)

    def import_report(self, file_path: str) -> tuple:
        if not os.path.exists(file_path):
            return False, f"文件不存在: {file_path}"

        records, warnings = self.parser.parse_file(file_path)

        if not records:
            return False, "未解析到有效记录"

        existing_records = self.state.get_all_records()
        duplicates = self.parser.detect_duplicates(records, existing_records)
        if duplicates:
            warnings.append(f"警告: 检测到 {len(duplicates)} 条重复记录")

        self.state.add_records(records, source=os.path.basename(file_path))

        session = self.parser.create_import_session(os.path.basename(file_path), records)
        self.parser.archive_source_file(file_path)

        anomalies = self.detector.detect_all(self.state.get_all_records())

        return True, {
            "imported_count": len(records),
            "warnings": warnings,
            "session_id": session.session_id,
            "anomalies_count": len(anomalies),
        }

    def rollback_session(self, session_id: str, reason: str = "") -> tuple:
        success, record_ids = self.parser.rollback_session(session_id, reason)
        if success:
            removed = self.state.remove_records(record_ids, reason=f"撤回导入: {reason}")
            return True, f"已撤回 {len(removed)} 条记录"
        return False, record_ids[0] if record_ids else "撤回失败"

    def show_status(self):
        records = self.state.get_all_records()
        anomalies = self.detector.anomalies
        self.reporter.print_text_report(records, anomalies)

    def show_anomalies(self, severity: str = None):
        if severity:
            anomalies = self.detector.get_anomalies_by_severity(severity)
        else:
            anomalies = self.detector.anomalies

        click.echo(f"\n=== 异常记录 (共{len(anomalies)}条) ===")
        for i, a in enumerate(anomalies, 1):
            status = "✓" if a.resolved else "✗"
            click.echo(f"{i}. [{a.severity}] {status} {a.anomaly_type.value}: {a.description}")
            if a.affected_records:
                click.echo(f"   影响记录: {', '.join(a.affected_records[:3])}")
        click.echo("")

    def export_data(self, output_format: str = "excel", round_start: int = None, round_end: int = None):
        records = self.state.get_all_records()

        filtered = self.exporter.filter_records(
            records, round_start=round_start, round_end=round_end
        )

        check_result = self.exporter.export_consistency_check(filtered)
        if not check_result["is_consistent"]:
            click.echo("⚠  一致性检查警告:")
            for issue in check_result["issues"][:3]:
                click.echo(f"   - {issue}")

        if output_format == "excel":
            path = self.exporter.export_to_excel(filtered, anomalies=self.detector.anomalies)
        elif output_format == "csv":
            path = self.exporter.export_to_csv(filtered, anomalies=self.detector.anomalies)
        else:
            path = self.exporter.export_to_json(filtered, anomalies=self.detector.anomalies)

        return path

    def generate_report(self):
        records = self.state.get_all_records()
        path = self.reporter.generate_review_report(
            records,
            anomalies=self.detector.anomalies,
            import_sessions=self.parser.import_sessions,
        )
        return path

    def list_snapshots(self):
        snapshots = self.state.list_snapshots()
        click.echo("\n=== 历史快照 ===")
        for i, s in enumerate(snapshots, 1):
            click.echo(f"{i}. {s['time']} | {s['description']} | {s['record_count']}条记录")
            click.echo(f"   ID: {s['id']}")
        click.echo("")

    def rollback_snapshot(self, snapshot_id: str):
        success = self.state.rollback_to_snapshot(snapshot_id)
        if success:
            return True, f"已回滚到快照: {snapshot_id}"
        return False, "快照不存在"

    def modify_record(self, record_id: str, field: str, value: str, reason: str):
        updates = {field: value}
        success = self.state.update_record(record_id, updates, reason)
        if success:
            return True, "记录已更新"
        return False, "记录不存在"


app = DamAnalyzerApp()


@click.group()
def cli():
    """河谷水坝攻防 - 战报分析工具"""
    pass


@cli.command()
@click.argument("file_path")
def import_report(file_path):
    """导入战报文本文件"""
    success, result = app.import_report(file_path)
    if success:
        click.echo(f"✓ 导入成功! 共 {result['imported_count']} 条记录")
        click.echo(f"  会话ID: {result['session_id']}")
        if result["warnings"]:
            click.echo(f"  警告 ({len(result['warnings'])}):")
            for w in result["warnings"][:5]:
                click.echo(f"    - {w}")
        if result["anomalies_count"] > 0:
            click.echo(f"  检测到 {result['anomalies_count']} 个异常，使用 'status' 查看详情")
    else:
        click.echo(f"✗ 导入失败: {result}")


@cli.command()
@click.argument("session_id")
@click.option("--reason", default="", help="撤回原因")
def rollback(session_id, reason):
    """撤回指定导入会话"""
    success, message = app.rollback_session(session_id, reason)
    if success:
        click.echo(f"✓ {message}")
    else:
        click.echo(f"✗ {message}")


@cli.command()
def status():
    """显示当前数据状态摘要"""
    app.show_status()


@cli.command()
@click.option("--severity", type=click.Choice(["high", "medium", "low"]), help="按严重程度筛选")
def anomalies(severity):
    """显示异常检测结果"""
    app.show_anomalies(severity)


@cli.command()
@click.option("--format", "output_format", default="excel", type=click.Choice(["excel", "csv", "json"]))
@click.option("--round-start", type=int, help="起始回合")
@click.option("--round-end", type=int, help="结束回合")
def export(output_format, round_start, round_end):
    """导出筛选后的数据"""
    path = app.export_data(output_format, round_start, round_end)
    click.echo(f"✓ 已导出到: {path}")


@cli.command()
def report():
    """生成完整复盘报告"""
    path = app.generate_report()
    click.echo(f"✓ 复盘报告已生成: {path}")
    click.echo("  报告包含: 全部记录 | 已确认 | 待补 | 人工修改 | 异常记录 | 处理口径")


@cli.command()
def snapshots():
    """列出历史快照"""
    app.list_snapshots()


@cli.command()
@click.argument("snapshot_id")
def rollback_snapshot(snapshot_id):
    """回滚到指定快照"""
    success, message = app.rollback_snapshot(snapshot_id)
    if success:
        click.echo(f"✓ {message}")
    else:
        click.echo(f"✗ {message}")


@cli.command()
@click.argument("record_id")
@click.argument("field")
@click.argument("value")
@click.option("--reason", required=True, help="修改原因")
def modify(record_id, field, value, reason):
    """人工修改记录字段"""
    success, message = app.modify_record(record_id, field, value, reason)
    if success:
        click.echo(f"✓ {message}")
    else:
        click.echo(f"✗ {message}")


@cli.command()
def check_order():
    """检查回合顺序问题"""
    records = app.state.get_all_records()
    order_errors = [a for a in app.detector.anomalies if a.anomaly_type.value == "回合顺序错误"]

    if order_errors:
        click.echo("\n⚠  回合顺序检查结果:")
        click.echo("  可能存在顺序错误的记录:")
        for a in order_errors:
            click.echo(f"  - {a.description}")
        click.echo("\n  排查方法:")
        click.echo("  1. 查看战报原文的行号")
        click.echo("  2. 确认每个回合内'进攻方→防守方'的顺序")
        click.echo("  3. 使用 modify 命令调整后注明原因")
    else:
        click.echo("✓ 回合顺序检查通过")


@cli.command()
def quick_check():
    """导出前快速复核"""
    click.echo("\n=== 导出前复核清单 ===")
    records = app.state.get_all_records()
    pending = [r for r in records if r.status == RecordStatus.PENDING]
    modified = [r for r in records if r.status == RecordStatus.MANUAL_MODIFIED]
    unresolved = [a for a in app.detector.anomalies if not a.resolved]

    items = [
        ("待补记录补充完整", len(pending) == 0, f"剩余{len(pending)}条"),
        ("异常记录已处理确认", len(unresolved) == 0, f"剩余{len(unresolved)}条"),
        ("人工修改已注明原因", all(r.manual_modify_reason for r in modified), f"共{len(modified)}条修改记录"),
    ]

    all_pass = True
    for name, passed, detail in items:
        status = "✓" if passed else "✗"
        if not passed:
            all_pass = False
        click.echo(f"  {status} {name}: {detail if not passed else '通过'}")

    if all_pass:
        click.echo("\n✓ 复核通过，可以导出")
    else:
        click.echo("\n⚠  请完成复核后再导出")


@cli.command()
def guide():
    """显示使用指南"""
    click.echo("""
=== 河谷水坝攻防 - 使用指南 ===

1. 放置战报文件
   将战报文本(.txt)放到 data/raw_reports/ 目录
   格式参考: data/raw_reports/sample.txt

2. 导入战报
   python main.py import-report data/raw_reports/your_file.txt

3. 查看状态
   python main.py status

4. 检查异常
   python main.py anomalies
   python main.py check-order

5. (可选)人工修正
   python main.py modify <记录ID> <字段> <值> --reason "修正原因"

6. 导出前复核
   python main.py quick-check

7. 导出数据
   python main.py export --format excel
   python main.py export --round-start 1 --round-end 10

8. 生成复盘报告
   python main.py report

9. 撤回/回滚
   python main.py rollback <会话ID> --reason "导入错误"
   python main.py snapshots
   python main.py rollback-snapshot <快照ID>
""")


if __name__ == "__main__":
    cli()
