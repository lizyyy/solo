import click
import json
import sys
from typing import Optional

from .workflow import ThreeStepWorkflow
from .self_check import SelfChecker
from .exporter import DataExporter


def _print_evidence_summary(evidence: dict, indent: int = 0):
    prefix = "  " * indent
    click.echo(f"{prefix}=== 证据摘要 ===")
    for key, value in evidence.items():
        if isinstance(value, dict):
            click.echo(f"{prefix}{key}:")
            _print_evidence_summary(value, indent + 1)
        elif isinstance(value, list):
            if value:
                click.echo(f"{prefix}{key}:")
                for item in value:
                    if isinstance(item, dict):
                        _print_evidence_summary(item, indent + 1)
                    else:
                        click.echo(f"{prefix}  - {item}")
        else:
            click.echo(f"{prefix}{key}: {value}")


@click.group()
def main():
    """老旧小区楼间距复测系统 - CLI"""
    pass


@main.command()
@click.option("--import-file", required=True, help="障碍物备注导入文件 (.csv 或 .xlsx)")
@click.option("--sketch-file", help="楼层剖面草图文件路径")
@click.option("--building", help="楼栋号")
@click.option("--floors", type=int, help="楼层数")
@click.option("--review-note", default="已补看楼层剖面草图，无异常", help="补看备注")
@click.option("--export-excel", required=True, help="导出Excel文件路径")
@click.option("--export-json", help="导出JSON文件路径")
@click.option("--operator", default="许工", help="操作人员")
@click.option("--supplement-record", help="需要补录路线的记录ID")
@click.option("--supplement-points", help='补录路线点，JSON格式: [{"x":0,"y":0},...]')
@click.option("--auto-recalc", is_flag=True, help="补录后自动重算长度")
def run(
    import_file: str,
    sketch_file: Optional[str],
    building: Optional[str],
    floors: Optional[int],
    review_note: str,
    export_excel: str,
    export_json: Optional[str],
    operator: str,
    supplement_record: Optional[str],
    supplement_points: Optional[str],
    auto_recalc: bool,
):
    """运行完整的三步流程"""
    click.echo("=" * 60)
    click.echo("老旧小区楼间距复测系统 - 三步流程")
    click.echo("=" * 60)

    workflow = ThreeStepWorkflow()

    click.echo(f"\n[步骤1/3] 导入障碍物备注: {import_file}")
    step1 = workflow.step1_import_obstacle_remarks(import_file, operator)
    click.echo(f"  导入结果: {step1['import_result']['imported']} 条成功, "
               f"{step1['import_result']['duplicates']} 条重复, "
               f"{len(step1['import_result']['errors'])} 条错误")

    if step1["import_result"]["errors"]:
        for err in step1["import_result"]["errors"]:
            click.echo(f"    错误: {err}", err=True)

    first_record_id = next(iter(workflow.project.records.keys()), None)

    if supplement_record and supplement_points:
        click.echo(f"\n[补充] 处理补录路线: {supplement_record}")
        try:
            points = json.loads(supplement_points)
            result = workflow.handle_length_not_recalculated(
                supplement_record, points, "设备工程师补录路线点",
                operator, auto_recalc
            )
            click.echo(f"  补录结果: {result['supplement_result']['new_point_count']} 个点")
            click.echo(f"  需要重算: {result['supplement_result']['needs_recalculation']}")
            click.echo(f"  是否已自动重算: {result['auto_recalculated']}")
            click.echo(f"  留给客户复核: {result['needs_customer_review']}")
            click.echo()
            _print_evidence_summary(result["evidence"], indent=1)
        except json.JSONDecodeError:
            click.echo("  错误: 路线点JSON格式无效", err=True)

    if sketch_file and building and floors:
        target_record = supplement_record or first_record_id
        if target_record:
            click.echo(f"\n[步骤2/3] 补看楼层剖面草图: {sketch_file}")
            step2 = workflow.step2_review_floor_sketches(
                target_record, sketch_file, building, floors, review_note, operator
            )
            if step2["completed"]:
                click.echo(f"  草图ID: {step2['sketch_id']}")
                click.echo(f"  补看结果: {step2['review_result']['note']}")
            else:
                click.echo(f"  失败: {step2.get('error', '未知错误')}", err=True)

    click.echo(f"\n[步骤3/3] 导出报告: {export_excel}")
    step3 = workflow.step3_export(export_excel, export_json, operator)
    click.echo(f"  Excel导出: {step3['excel_export']['success']}")
    if export_json:
        click.echo(f"  JSON导出: {step3['json_export']['success'] if step3['json_export'] else '未执行'}")
    click.echo(f"  一致性检测: {'通过' if step3['consistency_check']['consistent'] else '不通过'}")

    click.echo("\n" + "=" * 60)
    click.echo("自检报告")
    click.echo("=" * 60)
    checker = SelfChecker(workflow.project)
    summary = checker.get_summary()
    click.echo(f"总记录数: {summary['total_records']}")
    click.echo(f"补录记录数: {summary['supplementary_records']}")
    click.echo(f"待客户复核数: {summary['needs_customer_review']}")
    click.echo(f"未重算长度数: {summary['length_not_recalculated']}")
    click.echo(f"自检通过率: {summary['checks_passed']}/{summary['checks_total']}")

    for check in summary["checks"]:
        status = "✓ 通过" if check["passed"] else "✗ 不通过"
        click.echo(f"  {status} - {check['check_name']}: {check['message']}")

    needing_review = checker.get_records_needing_customer_review()
    if needing_review:
        click.echo("\n" + "=" * 60)
        click.echo("⚠️  需要展陈客户复核的记录")
        click.echo("=" * 60)
        for rec in needing_review:
            click.echo(f"\n记录ID: {rec['record_id']}")
            click.echo(f"楼栋: {rec['buildings']}")
            click.echo(f"状态: {rec['status']}")
            _print_evidence_summary(rec["evidence"], indent=1)

    click.echo("\n" + "=" * 60)
    click.echo("API格式证据摘要（部分）")
    click.echo("=" * 60)
    api_evidence = workflow.get_evidence_for_api()
    click.echo(json.dumps({
        "project_id": api_evidence["project_id"],
        "project_name": api_evidence["project_name"],
        "summary": {
            "total_records": api_evidence["summary"]["total_records"],
            "needs_customer_review": api_evidence["summary"]["needs_customer_review"],
            "length_not_recalculated": api_evidence["summary"]["length_not_recalculated"],
        }
    }, ensure_ascii=False, indent=2))

    click.echo("\n✓ 流程执行完成")


@main.command()
@click.option("--project-file", required=True, help="项目文件路径")
@click.option("--format", type=click.Choice(["json", "text"]), default="text", help="输出格式")
def show(project_file: str, format: str):
    """查看项目证据摘要"""
    workflow = ThreeStepWorkflow.load_project(project_file)

    if format == "json":
        click.echo(json.dumps(workflow.get_evidence_for_api(), ensure_ascii=False, indent=2))
    else:
        _print_evidence_summary(workflow.get_evidence_for_api())


@main.command()
@click.option("--project-file", required=True, help="项目文件路径")
@click.option("--output", required=True, help="输出Excel文件路径")
def export(project_file: str, output: str):
    """导出项目数据到Excel"""
    workflow = ThreeStepWorkflow.load_project(project_file)
    exporter = DataExporter(workflow.project)
    result = exporter.export_to_excel(output)
    if result["success"]:
        click.echo(f"✓ 导出成功: {result['file_path']} ({result['record_count']} 条记录)")
    else:
        click.echo(f"✗ 导出失败: {result.get('error', '未知错误')}", err=True)
        sys.exit(1)


@main.command()
@click.option("--project-file", required=True, help="项目文件路径")
def self_check(project_file: str):
    """运行自检"""
    workflow = ThreeStepWorkflow.load_project(project_file)
    checker = SelfChecker(workflow.project)
    results = checker.run_all_checks()

    click.echo("=" * 60)
    click.echo("自检结果")
    click.echo("=" * 60)

    passed = 0
    for result in results:
        status = "✓ 通过" if result["passed"] else "✗ 不通过"
        click.echo(f"{status} - {result['check_name']}")
        click.echo(f"    {result['message']}")
        if result["passed"]:
            passed += 1

    click.echo(f"\n总计: {passed}/{len(results)} 通过")


if __name__ == "__main__":
    main()
