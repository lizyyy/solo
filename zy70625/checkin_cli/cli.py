import click
import sys
from pathlib import Path

from .parsers import (
    parse_players,
    parse_groups,
    parse_materials,
    parse_substitutes,
    parse_checkins,
)
from .engine import run_full_validation
from .reports import generate_html_report, generate_excel_report, generate_json_report


@click.group()
@click.version_option(version="1.0.0", prog_name="checkin-cli")
def cli():
    """检录资格替补递补材料校验排查CLI工具"""
    pass


@cli.command()
@click.option("--players", "-p", required=True, type=click.Path(exists=True), help="选手信息文件 (CSV/Excel)")
@click.option("--groups", "-g", required=True, type=click.Path(exists=True), help="组别配置文件 (CSV/Excel)")
@click.option("--materials", "-m", required=True, type=click.Path(exists=True), help="材料信息文件 (CSV/Excel)")
@click.option("--substitutes", "-s", default=None, type=click.Path(exists=True), help="替补名单文件 (CSV/Excel)")
@click.option("--checkins", "-c", default=None, type=click.Path(exists=True), help="检录记录文件 (CSV/Excel)")
@click.option("--output", "-o", default="report.html", help="输出报告路径")
@click.option("--format", "-f", "output_format", type=click.Choice(["html", "excel", "json"]), default="html", help="输出格式")
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
def validate(players, groups, materials, substitutes, checkins, output, output_format, verbose):
    """执行资格校验并生成报告"""
    click.echo("🏆 开始执行检录资格校验...")

    all_parse_errors = []

    try:
        players_result = parse_players(players)
        all_parse_errors.extend(players_result.errors)
        if verbose:
            click.echo(f"  ✓ 解析选手信息: {len(players_result.data)} 条, {len(players_result.errors)} 个错误")

        groups_result = parse_groups(groups)
        all_parse_errors.extend(groups_result.errors)
        if verbose:
            click.echo(f"  ✓ 解析组别配置: {len(groups_result.data)} 条, {len(groups_result.errors)} 个错误")

        materials_result = parse_materials(materials)
        all_parse_errors.extend(materials_result.errors)
        if verbose:
            click.echo(f"  ✓ 解析材料信息: {len(materials_result.data)} 条, {len(materials_result.errors)} 个错误")

        substitutes_data = []
        if substitutes:
            substitutes_result = parse_substitutes(substitutes)
            substitutes_data = substitutes_result.data
            all_parse_errors.extend(substitutes_result.errors)
            if verbose:
                click.echo(f"  ✓ 解析替补名单: {len(substitutes_data)} 条, {len(substitutes_result.errors)} 个错误")

        checkins_data = []
        if checkins:
            checkins_result = parse_checkins(checkins)
            checkins_data = checkins_result.data
            all_parse_errors.extend(checkins_result.errors)
            if verbose:
                click.echo(f"  ✓ 解析检录记录: {len(checkins_data)} 条, {len(checkins_result.errors)} 个错误")

        if all_parse_errors:
            click.echo(f"⚠️  解析阶段发现 {len(all_parse_errors)} 个错误")

        click.echo("🔍 执行规则校验...")
        report = run_full_validation(
            players=players_result.data,
            groups=groups_result.data,
            materials=materials_result.data,
            substitutes=substitutes_data,
            checkins=checkins_data,
        )

        report.parse_errors = all_parse_errors

        click.echo("\n📊 校验结果统计:")
        click.echo(f"  总选手数: {report.total_players}")
        click.echo(f"  资格通过: {report.qualified_count}")
        click.echo(f"  资格不通过: {report.disqualified_count}")
        click.echo(f"  存在警告: {report.warning_count}")
        if report.all_issues:
            click.echo(f"  发现问题: {len(report.all_issues)} 个")

        output_path = Path(output)
        if output_format == "html":
            if not output_path.suffix:
                output_path = output_path.with_suffix(".html")
            generate_html_report(report, str(output_path))
        elif output_format == "excel":
            if not output_path.suffix:
                output_path = output_path.with_suffix(".xlsx")
            generate_excel_report(report, str(output_path))
        elif output_format == "json":
            if not output_path.suffix:
                output_path = output_path.with_suffix(".json")
            generate_json_report(report, str(output_path))

        click.echo(f"\n✅ 报告已生成: {output_path.resolve()}")

    except Exception as e:
        click.echo(f"❌ 执行失败: {str(e)}", err=True)
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


@cli.command()
def template():
    """生成示例数据模板文件"""
    click.echo("📁 正在生成示例数据模板...")

    import csv

    templates = {
        "players.csv": [
            ["player_id", "name", "id_card", "gender", "birth_date", "group_id", "phone", "email"],
            ["P001", "张三", "110101199001011234", "男", "1990-01-01", "G001", "13800138001", "zhangsan@example.com"],
            ["P002", "李四", "110101199202022345", "女", "1992-02-02", "G001", "13800138002", "lisi@example.com"],
            ["P003", "王五", "110101198503033456", "男", "1985-03-03", "G002", "13800138003", "wangwu@example.com"],
        ],
        "groups.csv": [
            ["group_id", "group_name", "min_age", "max_age", "allowed_gender", "max_players", "require_materials"],
            ["G001", "男子成年组", 18, 40, "男", 32, "身份证,照片,健康证明"],
            ["G002", "女子成年组", 18, 40, "女", 32, "身份证,照片,健康证明"],
        ],
        "materials.csv": [
            ["player_id", "material_type", "material_status", "upload_date", "expiry_date"],
            ["P001", "身份证", "已验证", "2024-01-01", ""],
            ["P001", "照片", "已验证", "2024-01-01", ""],
            ["P001", "健康证明", "未上传", "", ""],
            ["P002", "身份证", "已验证", "2024-01-01", ""],
            ["P002", "照片", "已验证", "2024-01-01", ""],
            ["P002", "健康证明", "已验证", "2024-01-01", "2024-12-31"],
        ],
        "substitutes.csv": [
            ["player_id", "target_group_id", "priority", "substitute_reason"],
            ["P003", "G001", 1, "正式选手退赛"],
        ],
        "checkins.csv": [
            ["checkin_id", "player_id", "checkin_time", "checkin_station"],
            ["C001", "P001", "2024-06-01T08:00:00", "A口"],
            ["C002", "P002", "2024-06-01T08:05:00", "A口"],
            ["C003", "P001", "2024-06-01T08:10:00", "B口"],
        ],
    }

    for filename, rows in templates.items():
        with open(filename, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerows(rows)
        click.echo(f"  ✓ 已生成: {filename}")

    click.echo("\n💡 使用示例:")
    click.echo("  checkin-cli validate --players players.csv --groups groups.csv --materials materials.csv --substitutes substitutes.csv --checkins checkins.csv")
