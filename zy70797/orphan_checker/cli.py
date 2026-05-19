import sys
import traceback
from typing import List, Optional
import click
from .parser import ServiceCatalogParser
from .repo_checker import RepositoryChecker
from .alert_checker import AlertChecker
from .owner_merger import OwnerMerger
from .reporter import ReportGenerator
from .models import OrphanReport, EvidenceStatus


class OrphanCheckerError(Exception):
    pass


class OrphanChecker:
    def __init__(
        self,
        catalog_file: str,
        repo_base_path: str = "",
        alert_dirs: List[str] = None,
        owner_mapping_file: str = None,
        output_dir: str = "reports",
        max_repo_age_days: int = 365,
    ):
        self.catalog_file = catalog_file
        self.repo_base_path = repo_base_path
        self.alert_dirs = alert_dirs or []
        self.owner_mapping_file = owner_mapping_file
        self.output_dir = output_dir
        self.max_repo_age_days = max_repo_age_days

        self.parser = ServiceCatalogParser(catalog_file)
        self.repo_checker = RepositoryChecker(repo_base_path, max_repo_age_days)
        self.alert_checker = AlertChecker(self.alert_dirs)
        self.owner_merger = OwnerMerger(owner_mapping_file)
        self.reporter = ReportGenerator(output_dir)

    def run(self) -> dict:
        try:
            click.echo(f"正在解析服务目录: {self.catalog_file}")
            valid_entries, invalid_entries = self.parser.parse()
            click.echo(f"  有效服务: {len(valid_entries)} 个")
            click.echo(f"  无效条目: {len(invalid_entries)} 个")

            if self.alert_dirs:
                click.echo(f"正在加载告警规则: {', '.join(self.alert_dirs)}")
                self.alert_checker.load_alerts()

            click.echo("正在检查存活证据...")
            orphan_reports = self._check_orphans(valid_entries)
            orphan_count = sum(1 for r in orphan_reports if r.is_orphan)
            click.echo(f"  发现孤儿服务: {orphan_count} 个")

            click.echo("正在生成报告...")
            report = self.reporter.generate_report(
                valid_entries, invalid_entries, orphan_reports
            )

            files = self.reporter.export_all(report)
            click.echo(f"报告已生成到: {self.output_dir}/")
            for fmt, path in files.items():
                click.echo(f"  {fmt.upper()}: {path}")

            return report

        except FileNotFoundError as e:
            raise OrphanCheckerError(f"文件未找到: {str(e)}")
        except Exception as e:
            raise OrphanCheckerError(f"执行失败: {str(e)}\n{traceback.format_exc()}")

    def _check_orphans(self, entries: List) -> List[OrphanReport]:
        reports: List[OrphanReport] = []

        for entry in entries:
            repo_evidence = self.repo_checker.check_repository(entry)
            alert_evidence = self.alert_checker.check_alerts(entry)
            owner_evidence = self.owner_merger.track_owner_sources(entry)

            is_orphan = False
            orphan_reasons: List[str] = []

            if repo_evidence.status == EvidenceStatus.DEAD:
                is_orphan = True
                orphan_reasons.append(f"仓库失效: {repo_evidence.message}")
            elif repo_evidence.status == EvidenceStatus.UNKNOWN and not entry.repository:
                is_orphan = True
                orphan_reasons.append("未配置仓库地址")

            if alert_evidence.status == EvidenceStatus.DEAD:
                is_orphan = True
                orphan_reasons.append(f"告警规则失效: {alert_evidence.message}")
            elif alert_evidence.status == EvidenceStatus.UNKNOWN and not entry.alert_rules:
                if is_orphan:
                    orphan_reasons.append("未配置告警规则")

            if not entry.owners:
                if is_orphan:
                    orphan_reasons.append("未配置负责人")

            overall_status = self._determine_overall_status(repo_evidence, alert_evidence)

            report = OrphanReport(
                service_entry=entry,
                repository_evidence=repo_evidence,
                alert_evidence=alert_evidence,
                owner_evidence=owner_evidence,
                is_orphan=is_orphan,
                orphan_reasons=orphan_reasons,
                overall_status=overall_status,
            )
            reports.append(report)

        return reports

    def _determine_overall_status(self, repo_evidence, alert_evidence) -> EvidenceStatus:
        if repo_evidence.status == EvidenceStatus.ALIVE or alert_evidence.status == EvidenceStatus.ALIVE:
            return EvidenceStatus.ALIVE
        if repo_evidence.status == EvidenceStatus.DEAD and alert_evidence.status == EvidenceStatus.DEAD:
            return EvidenceStatus.DEAD
        if repo_evidence.status == EvidenceStatus.ERROR or alert_evidence.status == EvidenceStatus.ERROR:
            return EvidenceStatus.ERROR
        return EvidenceStatus.UNKNOWN


@click.group()
def cli():
    """服务目录孤儿条目存活证据排查工具"""
    pass


@cli.command()
@click.argument("catalog_file", type=click.Path(exists=True))
@click.option("--repo-base-path", "-r", type=click.Path(), default="", help="本地仓库根目录")
@click.option("--alert-dir", "-a", multiple=True, type=click.Path(), help="告警规则目录（可多次指定）")
@click.option("--owner-mapping", "-m", type=click.Path(), help="负责人别名映射文件")
@click.option("--output-dir", "-o", type=click.Path(), default="reports", help="报告输出目录")
@click.option("--max-repo-age", type=int, default=365, help="仓库最大活跃天数")
@click.option("--verbose", "-v", is_flag=True, help="显示详细输出")
def check(
    catalog_file: str,
    repo_base_path: str,
    alert_dir: tuple,
    owner_mapping: Optional[str],
    output_dir: str,
    max_repo_age: int,
    verbose: bool,
):
    """检查服务目录中的孤儿条目"""
    try:
        checker = OrphanChecker(
            catalog_file=catalog_file,
            repo_base_path=repo_base_path,
            alert_dirs=list(alert_dir),
            owner_mapping_file=owner_mapping,
            output_dir=output_dir,
            max_repo_age_days=max_repo_age,
        )

        report = checker.run()

        orphan_count = report["summary"]["orphan_services"]
        if orphan_count > 0:
            click.secho(f"发现 {orphan_count} 个孤儿服务需要处理", fg="yellow")
            sys.exit(1)
        else:
            click.secho("检查完成，未发现孤儿服务", fg="green")
            sys.exit(0)

    except OrphanCheckerError as e:
        click.secho(f"错误: {str(e)}", fg="red")
        sys.exit(2)
    except Exception as e:
        click.secho(f"未预期的错误: {str(e)}\n{traceback.format_exc()}", fg="red")
        sys.exit(3)


@cli.command()
@click.argument("catalog_file", type=click.Path(exists=True))
@click.option("--output-dir", "-o", type=click.Path(), default="reports", help="报告输出目录")
def parse(catalog_file: str, output_dir: str):
    """仅解析服务目录（不进行存活检查）"""
    try:
        click.echo(f"正在解析服务目录: {catalog_file}")
        parser = ServiceCatalogParser(catalog_file)
        valid_entries, invalid_entries = parser.parse()

        click.echo(f"有效服务: {len(valid_entries)} 个")
        for entry in valid_entries:
            click.echo(f"  - {entry.service_name}")
            if entry.repository:
                click.echo(f"    仓库: {entry.repository}")
            if entry.owners:
                click.echo(f"    负责人: {', '.join(entry.owners)}")

        if invalid_entries:
            click.echo(f"\n无效条目: {len(invalid_entries)} 个")
            for entry in invalid_entries:
                click.echo(f"  - {entry.service_name}: {entry.parse_error}")
                click.echo(f"    位置: {entry.source}")

    except Exception as e:
        click.secho(f"解析失败: {str(e)}", fg="red")
        sys.exit(1)


def main():
    try:
        cli()
    except KeyboardInterrupt:
        click.echo("\n操作已取消")
        sys.exit(0)


if __name__ == "__main__":
    main()
