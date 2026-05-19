import click
import sys
from pathlib import Path
from typing import List, Optional, Tuple

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
from .review import ReviewManager


class QueryPlanChecker:
    def __init__(self, review_file: str = "review_records.json"):
        self.parser = PlanParser()
        self.rule_engine = RuleEngine()
        self.reporter = ReportGenerator()
        self.review_manager = ReviewManager(review_file)

    def run_check(
        self,
        old_plan_file: str,
        new_plan_file: str,
        output_dir: Optional[str] = None,
        report_name: str = "plan_regression_report",
        min_risk_level: str = "LOW",
        apply_reviews: bool = True
    ) -> CheckResult:
        old_plans, old_errors = self.parser.parse_file(old_plan_file, "old")
        new_plans, new_errors = self.parser.parse_file(new_plan_file, "new")

        all_errors = old_errors + new_errors
        self.reporter.source_tracker.track_errors(all_errors)

        comparisons, unmatched = self.rule_engine.compare_plans(old_plans, new_plans)

        if apply_reviews:
            for comp in comparisons:
                review = self.review_manager.get_review(comp.parameter_set_normalized)
                if review:
                    comp.confirm_status = review.status
                    comp.review_by = review.reviewer
                    comp.review_at = review.reviewed_at
                    comp.notes = review.notes
                    if review.status == ConfirmStatus.CONFIRMED:
                        comp.conclusion = RegressionConclusion.REGRESSED
                    elif review.status == ConfirmStatus.REJECTED:
                        comp.conclusion = RegressionConclusion.FALSE_POSITIVE

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

    def list_comparisons_for_review(
        self,
        old_plan_file: str,
        new_plan_file: str,
        min_risk_level: str = "LOW"
    ) -> List[Tuple[str, str, str]]:
        old_plans, _ = self.parser.parse_file(old_plan_file, "old")
        new_plans, _ = self.parser.parse_file(new_plan_file, "new")
        comparisons, _ = self.rule_engine.compare_plans(old_plans, new_plans)

        min_risk = RiskLevel(min_risk_level)
        result = []
        for comp in comparisons:
            if self._risk_priority(comp.risk_level) <= self._risk_priority(min_risk):
                result.append((
                    comp.parameter_set_normalized,
                    comp.query_template,
                    comp.risk_level.value
                ))
        return result

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
        reviewed_count = 0

        for comp in comparisons:
            risk_val = comp.risk_level.value
            risk_level_counts[risk_val] = risk_level_counts.get(risk_val, 0) + 1

            concl_val = comp.conclusion.value
            conclusion_counts[concl_val] = conclusion_counts.get(concl_val, 0) + 1

            if comp.conclusion == RegressionConclusion.REGRESSED:
                regressed_count += 1

            if comp.confirm_status != ConfirmStatus.PENDING:
                reviewed_count += 1

        return {
            'total_comparisons': len(comparisons),
            'total_old_plans': len(old_plans),
            'total_new_plans': len(new_plans),
            'total_errors': len(errors),
            'regressed_count': regressed_count,
            'reviewed_count': reviewed_count,
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


@cli.group()
def review():
    """查询计划回归审核管理"""
    pass


@review.command(name="list")
@click.argument('old_plan_file', type=click.Path(exists=True))
@click.argument('new_plan_file', type=click.Path(exists=True))
@click.option('--min-risk-level', '-r', type=click.Choice(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE']),
              default='LOW', help='最小显示风险级别')
@click.option('--review-file', '-f', default='review_records.json', help='审核记录文件路径')
def review_list(old_plan_file, new_plan_file, min_risk_level, review_file):
    """列出待审核的查询计划对比"""
    checker = QueryPlanChecker(review_file)

    try:
        items = checker.list_comparisons_for_review(old_plan_file, new_plan_file, min_risk_level)

        click.echo("\n" + "=" * 80)
        click.echo("待审核查询计划列表")
        click.echo("=" * 80)

        if not items:
            click.echo("\n  没有符合条件的待审核项")
        else:
            click.echo(f"\n  共 {len(items)} 项待审核：\n")
            for idx, (sig, template, risk) in enumerate(items, 1):
                review_status = ""
                review = checker.review_manager.get_review(sig)
                if review:
                    review_status = f" [已审核: {review.status.value}]"
                click.echo(f"  [{idx:2d}] [{risk:10s}] {template[:60]}...")
                click.echo(f"       签名: {sig}{review_status}")
                click.echo()

        click.echo("=" * 80 + "\n")

    except Exception as e:
        click.echo(f"❌ 错误: {str(e)}", err=True)
        sys.exit(2)


@review.command(name="confirm")
@click.argument('query_signature')
@click.argument('old_plan_file', type=click.Path(exists=True))
@click.argument('new_plan_file', type=click.Path(exists=True))
@click.option('--reviewer', '-u', default='', help='审核人')
@click.option('--notes', '-m', default='', help='备注信息')
@click.option('--review-file', '-f', default='review_records.json', help='审核记录文件路径')
def review_confirm(query_signature, old_plan_file, new_plan_file, reviewer, notes, review_file):
    """确认一个回归项（标记为已确认回归）"""
    checker = QueryPlanChecker(review_file)

    try:
        items = checker.list_comparisons_for_review(old_plan_file, new_plan_file, 'NONE')
        query_template = ""
        for sig, template, _ in items:
            if sig == query_signature:
                query_template = template
                break

        if not query_template:
            click.echo(f"⚠ 未找到签名为 {query_signature} 的查询")
            sys.exit(1)

        checker.review_manager.add_review(
            query_signature=query_signature,
            query_template=query_template,
            status=ConfirmStatus.CONFIRMED,
            reviewer=reviewer,
            notes=notes
        )

        click.echo(f"✅ 已确认回归: {query_template[:60]}...")
        if reviewer:
            click.echo(f"   审核人: {reviewer}")
        if notes:
            click.echo(f"   备注: {notes}")

    except Exception as e:
        click.echo(f"❌ 错误: {str(e)}", err=True)
        import traceback
        traceback.print_exc()
        sys.exit(2)


@review.command(name="reject")
@click.argument('query_signature')
@click.argument('old_plan_file', type=click.Path(exists=True))
@click.argument('new_plan_file', type=click.Path(exists=True))
@click.option('--reviewer', '-u', default='', help='审核人')
@click.option('--notes', '-m', default='', help='备注信息')
@click.option('--review-file', '-f', default='review_records.json', help='审核记录文件路径')
def review_reject(query_signature, old_plan_file, new_plan_file, reviewer, notes, review_file):
    """驳回一个回归项（标记为误报）"""
    checker = QueryPlanChecker(review_file)

    try:
        items = checker.list_comparisons_for_review(old_plan_file, new_plan_file, 'NONE')
        query_template = ""
        for sig, template, _ in items:
            if sig == query_signature:
                query_template = template
                break

        if not query_template:
            click.echo(f"⚠ 未找到签名为 {query_signature} 的查询")
            sys.exit(1)

        checker.review_manager.add_review(
            query_signature=query_signature,
            query_template=query_template,
            status=ConfirmStatus.REJECTED,
            reviewer=reviewer,
            notes=notes
        )

        click.echo(f"✅ 已驳回（误报）: {query_template[:60]}...")
        if reviewer:
            click.echo(f"   审核人: {reviewer}")
        if notes:
            click.echo(f"   备注: {notes}")

    except Exception as e:
        click.echo(f"❌ 错误: {str(e)}", err=True)
        import traceback
        traceback.print_exc()
        sys.exit(2)


@review.command(name="need-review")
@click.argument('query_signature')
@click.argument('old_plan_file', type=click.Path(exists=True))
@click.argument('new_plan_file', type=click.Path(exists=True))
@click.option('--reviewer', '-u', default='', help='审核人')
@click.option('--notes', '-m', default='', help='备注信息')
@click.option('--review-file', '-f', default='review_records.json', help='审核记录文件路径')
def review_need_review(query_signature, old_plan_file, new_plan_file, reviewer, notes, review_file):
    """标记为需要进一步审核"""
    checker = QueryPlanChecker(review_file)

    try:
        items = checker.list_comparisons_for_review(old_plan_file, new_plan_file, 'NONE')
        query_template = ""
        for sig, template, _ in items:
            if sig == query_signature:
                query_template = template
                break

        if not query_template:
            click.echo(f"⚠ 未找到签名为 {query_signature} 的查询")
            sys.exit(1)

        checker.review_manager.add_review(
            query_signature=query_signature,
            query_template=query_template,
            status=ConfirmStatus.NEED_REVIEW,
            reviewer=reviewer,
            notes=notes
        )

        click.echo(f"✅ 已标记为需要进一步审核: {query_template[:60]}...")
        if reviewer:
            click.echo(f"   审核人: {reviewer}")
        if notes:
            click.echo(f"   备注: {notes}")

    except Exception as e:
        click.echo(f"❌ 错误: {str(e)}", err=True)
        import traceback
        traceback.print_exc()
        sys.exit(2)


@review.command(name="summary")
@click.option('--review-file', '-f', default='review_records.json', help='审核记录文件路径')
def review_summary(review_file):
    """显示审核记录摘要"""
    from .review import ReviewManager
    rm = ReviewManager(review_file)
    rm.print_summary()


def main():
    cli()


if __name__ == '__main__':
    main()
