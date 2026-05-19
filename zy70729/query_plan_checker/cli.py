import click
import sys
from pathlib import Path
from typing import List, Optional

from datetime import datetime

from .models import (
    CheckResult,
    QueryPlan,
    RiskLevel,
    RegressionConclusion,
    ConfirmStatus
)
from .parser import PlanParser
from .rules import RuleEngine
from .reporter import ReportGenerator


class QueryPlanChecker:
    def __init__(self):
        self.parser = PlanParser()
        self.rule_engine = RuleEngine()
        self.reporter = ReportGenerator()

    def run_check(
        self,
        old_plan_file: str,
        new_plan_file: str,
        output_dir: Optional[str] = None,
        report_name: str = "plan_regression_report",
        min_risk_level: str = "LOW"
    ) -> CheckResult:
        old_plans, old_errors = self.parser.parse_file(old_plan_file, "old")
        new_plans, new_errors = self.parser.parse_file(new_plan_file, "new")

        all_errors = old_errors + new_errors
        self.reporter.source_tracker.track_errors(all_errors)

        comparisons, unmatched = self.rule_engine.compare_plans(old_plans, new_plans)

        min_risk = RiskLevel(min_risk_level)
        filtered_comparisons = [
            c for c in comparisons
            if self._risk_priority(c.risk_level) <= self._risk_priority(min_risk)
        ]

        summary = self._build_summary(filtered_comparisons, all_errors, old_plans, new_plans)

        check_result = CheckResult(
            comparisons=filtered_comparisons,
            parse_errors=all_errors,
            summary=summary,
            generated_at=datetime.now()
        )

        if output_dir:
            generated_files = self.reporter.generate_full_report(
                check_result,
                output_dir,
                report_name
            )
            check_result.summary['generated_files'] = generated_files

        return check_result

    def _risk_priority(self, risk_level: RiskLevel) -> int:
        priority_map = {
            RiskLevel.CRITICAL: 0,
            RiskLevel.HIGH: 1,
            RiskLevel.MEDIUM: 2,
            RiskLevel.LOW: 3,
            RiskLevel.NONE: 4
        }
        return priority_map.get(risk_level, 99)

    def _build_summary(
        self,
        comparisons: List,
        errors: List,
        old_plans: List[QueryPlan],
        new_plans: List[QueryPlan]
    ) -> dict:
        risk_level_counts = {}
        conclusion_counts = {}
        regressed_count = 0

        for comp in comparisons:
            risk_val = comp.risk_level.value
            risk_level_counts[risk_val] = risk_level_counts.get(risk_val, 0) + 1

            concl_val = comp.conclusion.value
            conclusion_counts[concl_val] = conclusion_counts.get(concl_val, 0) + 1

            if comp.conclusion == RegressionConclusion.REGRESSED:
                regressed_count += 1

        return {
            'total_comparisons': len(comparisons),
            'total_old_plans': len(old_plans),
            'total_new_plans': len(new_plans),
            'total_errors': len(errors),
            'regressed_count': regressed_count,
            'risk_level_counts': risk_level_counts,
            'conclusion_counts': conclusion_counts
        }


@click.group()
def cli():
    """查询计划回归参数集合排查CLI - Query Plan Regression Checker"""
    pass


@cli.command()
@click.argument('old_plan_file', type=click.Path(exists=True))
@click.argument('new_plan_file', type=click.Path(exists=True))
@click.option('--output-dir', '-o', type=click.Path(), help='报告输出目录')
@click.option('--report-name', '-n', default='plan_regression_report', help='报告文件名前缀')
@click.option('--min-risk-level', '-r', type=click.Choice(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE']),
              default='LOW', help='最小显示风险级别')
@click.option('--quiet', '-q', is_flag=True, help='静默模式，不打印控制台摘要')
def check(old_plan_file, new_plan_file, output_dir, report_name, min_risk_level, quiet):
    """对比新旧查询计划，检测回归

    OLD_PLAN_FILE: 旧版本的查询计划文件 (JSON)
    NEW_PLAN_FILE: 新版本的查询计划文件 (JSON)
    """
    checker = QueryPlanChecker()

    try:
        result = checker.run_check(
            old_plan_file=old_plan_file,
            new_plan_file=new_plan_file,
            output_dir=output_dir,
            report_name=report_name,
            min_risk_level=min_risk_level
        )

        if not quiet:
            checker.reporter.print_console_summary(result)

        if output_dir and 'generated_files' in result.summary:
            click.echo(f"\n📄 报告已生成到目录: {output_dir}")
            for fmt, path in result.summary['generated_files'].items():
                click.echo(f"   - {fmt}: {path}")

        if result.summary.get('regressed_count', 0) > 0:
            sys.exit(1)
        else:
            sys.exit(0)

    except Exception as e:
        click.echo(f"❌ 错误: {str(e)}", err=True)
        import traceback
        traceback.print_exc()
        sys.exit(2)


@cli.command()
@click.argument('plan_file', type=click.Path(exists=True))
@click.option('--output', '-o', type=click.Path(), help='输出解析结果到文件')
def parse(plan_file, output):
    """解析单个查询计划文件，验证格式

    PLAN_FILE: 要解析的查询计划文件 (JSON)
    """
    parser = PlanParser()
    plans, errors = parser.parse_file(plan_file)

    click.echo(f"解析结果:")
    click.echo(f"  - 成功解析: {len(plans)} 个查询计划")
    click.echo(f"  - 解析错误: {len(errors)} 个")

    if errors:
        click.echo("\n错误详情:")
        for error in errors:
            click.echo(f"  行 {error.source_location.line_number}: [{error.error_type}] {error.error_message}")

    if output:
        import json
        result = {
            'plans_count': len(plans),
            'errors_count': len(errors),
            'plans': [
                {
                    'query_template': p.query_template,
                    'summary': {
                        'scan_type': p.summary.scan_type,
                        'estimated_cost': p.summary.estimated_cost,
                        'estimated_rows': p.summary.estimated_rows
                    }
                }
                for p in plans
            ],
            'errors': [
                {
                    'line': e.source_location.line_number,
                    'type': e.error_type,
                    'message': e.error_message
                }
                for e in errors
            ]
        }
        with open(output, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        click.echo(f"\n解析结果已保存到: {output}")


@cli.command()
def version():
    """显示版本信息"""
    from . import __version__
    click.echo(f"查询计划回归排查工具 v{__version__}")
    click.echo("Query Plan Regression Checker")


def main():
    cli()


if __name__ == '__main__':
    main()
