import json
import os
from pathlib import Path
from decimal import Decimal

import click

from .models import (
    ValidationError,
    CalculationResult,
    WeighingPlan,
)
from .csv_parser import CsvParser
from .solver import FormulaSolver
from .ledger import LedgerManager, DecimalEncoder
from .reporter import Reporter


def _load_calc_result(file_path: str) -> CalculationResult:
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    plans = []
    for plan_data in data.get("plans", []):
        plans.append(WeighingPlan(
            material_name=plan_data["material_name"],
            grams_needed=Decimal(plan_data["grams_needed"]),
            cost=Decimal(plan_data["cost"]),
            element_contributions={
                k: Decimal(v) for k, v in plan_data.get("element_contributions", {}).items()
            },
        ))

    from .models import ElementResult
    element_results = {}
    for elem, result_data in data.get("element_results", {}).items():
        element_results[elem] = ElementResult(
            element=elem,
            target_min_ppm=Decimal(result_data["target_min_ppm"]),
            target_max_ppm=Decimal(result_data["target_max_ppm"]),
            actual_ppm=Decimal(result_data["actual_ppm"]),
            deviation=Decimal(result_data["deviation"]),
            deviation_percent=Decimal(result_data["deviation_percent"]),
            status=result_data["status"],
        )

    return CalculationResult(
        volume_liters=Decimal(data["volume_liters"]),
        plans=plans,
        total_cost=Decimal(data["total_cost"]),
        element_results=element_results,
        warnings=data.get("warnings", []),
        is_feasible=data.get("is_feasible", True),
    )


def _save_calc_result(result: CalculationResult, file_path: str) -> None:
    data = {
        "volume_liters": result.volume_liters,
        "total_cost": result.total_cost,
        "is_feasible": result.is_feasible,
        "warnings": result.warnings,
        "plans": [
            {
                "material_name": p.material_name,
                "grams_needed": p.grams_needed,
                "cost": p.cost,
                "element_contributions": p.element_contributions,
            }
            for p in result.plans
        ],
        "element_results": {
            elem: {
                "element": r.element,
                "target_min_ppm": r.target_min_ppm,
                "target_max_ppm": r.target_max_ppm,
                "actual_ppm": r.actual_ppm,
                "deviation": r.deviation,
                "deviation_percent": r.deviation_percent,
                "status": r.status,
            }
            for elem, r in result.element_results.items()
        },
    }

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, cls=DecimalEncoder, ensure_ascii=False, indent=2)


@click.group()
@click.version_option()
def main():
    """水培营养液配方计算 CLI 工具"""
    pass


@main.command()
@click.option("--inventory", "-i", required=True, help="原料库存 CSV 文件路径")
@click.option("--recipe", "-r", required=True, help="目标配方 CSV 文件路径")
def check(inventory: str, recipe: str):
    """检查 CSV 数据完整性"""
    parser = CsvParser()

    click.echo("检查原料库存文件...")
    inv, inv_errors = parser.parse_inventory(inventory)

    click.echo("检查配方文件...")
    rec, rec_errors = parser.parse_recipe(recipe)

    all_errors = inv_errors + rec_errors

    if all_errors:
        click.echo(f"\n发现 {len(all_errors)} 个问题:")
        for i, error in enumerate(all_errors, 1):
            click.echo(f"  {i}. {error}")
        raise click.ClickException("数据验证失败，请修复上述问题")
    else:
        click.echo("\n✅ 所有检查通过")
        if inv:
            click.echo(f"   - 原料库存: {len(inv.list_materials())} 种原料")
        if rec:
            click.echo(f"   - 目标配方: {len(rec.element_limits)} 种元素, {rec.target_volume_liters}L")


@main.command()
@click.option("--inventory", "-i", required=True, help="原料库存 CSV 文件路径")
@click.option("--recipe", "-r", required=True, help="目标配方 CSV 文件路径")
@click.option("--output", "-o", default="plan.json", help="输出计算结果文件路径")
def calc(inventory: str, recipe: str, output: str):
    """计算配方，生成称量方案"""
    parser = CsvParser()

    click.echo("读取原料库存...")
    inv, inv_errors = parser.parse_inventory(inventory)
    if inv_errors:
        for error in inv_errors:
            click.echo(f"错误: {error}")
        raise click.ClickException("无法解析原料库存文件")

    click.echo("读取配方...")
    rec, rec_errors = parser.parse_recipe(recipe)
    if rec_errors:
        for error in rec_errors:
            click.echo(f"错误: {error}")
        raise click.ClickException("无法解析配方文件")

    assert inv is not None
    assert rec is not None

    click.echo("计算配方...")
    solver = FormulaSolver()
    result = solver.solve(inv, rec)

    click.echo("\n" + "=" * 60)
    click.echo(f"计算结果 (配液体积: {result.volume_liters}L)")
    click.echo("=" * 60)

    click.echo("\n📋 称量方案:")
    for plan in result.plans:
        click.echo(
            f"  - {plan.material_name}: {float(plan.grams_needed):.4f}g "
            f"(成本: {float(plan.cost):.4f}元)"
        )

    click.echo(f"\n💰 总成本: {float(result.total_cost):.4f}元")
    click.echo(f"   每升成本: {float(result.total_cost / result.volume_liters):.6f}元/L")

    click.echo("\n🧪 元素含量:")
    click.echo(f"  {'元素':<4} {'目标范围':<15} {'实际':<10} {'偏差':<10} {'状态'}")
    for elem, r in result.element_results.items():
        target_range = f"{float(r.target_min_ppm)}-{float(r.target_max_ppm)}"
        actual = f"{float(r.actual_ppm):.2f}"
        dev = f"{float(r.deviation):+.2f}"
        if r.status == "ok":
            status = click.style("✅ 正常", fg="green")
        elif r.status == "below":
            status = click.style("⬇️ 偏低", fg="yellow")
        else:
            status = click.style("⬆️ 偏高", fg="red")
        click.echo(f"  {elem:<4} {target_range:<15} {actual:<10} {dev:<10} {status}")

    if result.warnings:
        click.echo("\n⚠️ 警告:")
        for warning in result.warnings:
            click.echo(f"  - {warning}")

    if not result.is_feasible:
        click.echo("\n" + click.style("❌ 警告: 部分元素无法达到目标范围", fg="red"))

    _save_calc_result(result, output)
    click.echo(f"\n💾 计算结果已保存到: {output}")


@main.command()
@click.option("--plan", "-p", required=True, help="计算方案 JSON 文件路径")
@click.option("--inventory", "-i", required=True, help="原料库存 CSV 文件路径")
@click.option("--notes", "-n", default="", help="备注信息")
def apply(plan: str, inventory: str, notes: str):
    """应用方案，扣减库存并记录到账本"""
    parser = CsvParser()

    click.echo("读取库存...")
    inv, inv_errors = parser.parse_inventory(inventory)
    if inv_errors:
        for error in inv_errors:
            click.echo(f"错误: {error}")
        raise click.ClickException("无法解析库存文件")

    click.echo("读取计算方案...")
    try:
        result = _load_calc_result(plan)
    except Exception as e:
        raise click.ClickException(f"无法读取方案文件: {e}")

    assert inv is not None

    for plan_item in result.plans:
        material = inv.get_material(plan_item.material_name)
        if not material:
            raise click.ClickException(f"原料不存在: {plan_item.material_name}")
        if material.remaining_grams < plan_item.grams_needed:
            raise click.ClickException(
                f"库存不足: {plan_item.material_name} "
                f"(剩余 {float(material.remaining_grams)}g, 需要 {float(plan_item.grams_needed)}g)"
            )

    click.echo("\n即将执行以下扣减:")
    for plan_item in result.plans:
        material = inv.get_material(plan_item.material_name)
        assert material is not None
        click.echo(
            f"  - {plan_item.material_name}: {float(plan_item.grams_needed):.4f}g "
            f"(剩余: {float(material.remaining_grams):.4f}g → "
            f"{float(material.remaining_grams - plan_item.grams_needed):.4f}g)"
        )

    click.echo(f"\n总成本: {float(result.total_cost):.4f}元")

    if not click.confirm("\n确认执行?"):
        click.echo("已取消")
        return

    ledger_path = str(Path(inventory).parent / "ledger.json")
    ledger = LedgerManager(ledger_path)

    click.echo("执行扣减...")
    entry, updated_inventory = ledger.record_usage(inv, result, notes)

    parser.write_inventory(inv, inventory)

    click.echo(f"\n✅ 操作已完成")
    click.echo(f"   批次ID: {entry.batch_id}")
    click.echo(f"   账本已更新: {ledger_path}")
    click.echo(f"   库存已更新: {inventory}")


@main.command()
@click.option("--inventory", "-i", required=True, help="原料库存 CSV 文件路径")
def undo(inventory: str):
    """撤销最近一次扣减操作"""
    parser = CsvParser()

    click.echo("读取库存...")
    inv, inv_errors = parser.parse_inventory(inventory)
    if inv_errors:
        for error in inv_errors:
            click.echo(f"错误: {error}")
        raise click.ClickException("无法解析库存文件")

    ledger_path = str(Path(inventory).parent / "ledger.json")

    if not os.path.exists(ledger_path):
        raise click.ClickException("账本不存在，没有可撤销的操作")

    ledger = LedgerManager(ledger_path)

    last_entry = ledger.get_last_entry()
    if not last_entry:
        raise click.ClickException("没有可撤销的操作")

    assert inv is not None

    click.echo("即将撤销以下操作:")
    click.echo(f"  批次ID: {last_entry.batch_id}")
    click.echo(f"  时间: {last_entry.timestamp}")
    click.echo(f"  体积: {float(last_entry.volume_liters)}L")
    click.echo(f"  总成本: {float(last_entry.total_cost):.4f}元")

    for usage in last_entry.material_usages:
        click.echo(
            f"  - {usage.material_name}: 恢复 {float(usage.grams_used):.4f}g"
        )

    if not click.confirm("\n确认撤销?"):
        click.echo("已取消")
        return

    click.echo("执行撤销...")
    undone_entry = ledger.undo_last(inv)

    if not undone_entry:
        raise click.ClickException("撤销失败")

    parser.write_inventory(inv, inventory)

    click.echo(f"\n✅ 已撤销批次: {undone_entry.batch_id}")
    click.echo(f"   库存已恢复: {inventory}")


@main.command()
@click.option("--inventory", "-i", required=True, help="原料库存 CSV 文件路径")
@click.option("--ledger", "-l", default=None, help="账本文件路径 (默认: inventory目录/ledger.json)")
@click.option("--format", "-f", "fmt", type=click.Choice(["md", "csv"]), default="md", help="输出格式")
@click.option("--output", "-o", default=None, help="输出文件路径")
def report(inventory: str, ledger: str, fmt: str, output: str):
    """生成报告"""
    parser = CsvParser()

    inv, inv_errors = parser.parse_inventory(inventory)
    if inv_errors:
        for error in inv_errors:
            click.echo(f"错误: {error}")
        raise click.ClickException("无法解析库存文件")

    if ledger is None:
        ledger = str(Path(inventory).parent / "ledger.json")

    ledger_manager = LedgerManager(ledger)

    reporter = Reporter(inventory=inv, ledger_manager=ledger_manager)

    if fmt == "md":
        content = reporter.generate_markdown_report()
        if output:
            with open(output, "w", encoding="utf-8") as f:
                f.write(content)
            click.echo(f"报告已保存到: {output}")
        else:
            click.echo(content)
    else:
        if not output:
            output = "report.csv"
        reporter.generate_csv_report(output)
        click.echo(f"CSV 报告已保存到: {output}")


if __name__ == "__main__":
    main()
