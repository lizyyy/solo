"""
命令行交互界面
"""

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.prompt import Prompt, Confirm
from rich import print as rprint
from typing import Optional, List
import os
import sys

from .manager import BakeCalculator
from .storage import StorageManager
from .import_export import ImportExportManager
from .models import AllergenType, DietaryLabel


console = Console()
calculator: Optional[BakeCalculator] = None
storage: Optional[StorageManager] = None
ie_manager: Optional[ImportExportManager] = None


def init_app():
    """初始化应用"""
    global calculator, storage, ie_manager
    
    storage = StorageManager()
    calculator = storage.load()
    ie_manager = ImportExportManager(calculator)


def save_data():
    """保存数据"""
    if storage and calculator:
        storage.save(calculator)


def get_console() -> Console:
    return console


# ==================== 主菜单 ====================

@click.group(invoke_without_command=True)
@click.pass_context
def main(ctx):
    """
    烘焙店配方成本和过敏原替换工具
    
    使用 'bake-calc 命令 --help' 查看详细帮助
    """
    init_app()
    
    if ctx.invoked_subcommand is None:
        show_main_menu()


def show_main_menu():
    """显示主菜单"""
    console.clear()
    
    console.print(Panel.fit(
        "[bold blue]🍰 烘焙配方成本计算器[/bold blue]\n"
        "[dim]原料库 → 配方管理 → 替换演练 → 导出结果[/dim]",
        title="主菜单"
    ))
    
    console.print("\n[bold]请选择功能:[/bold]")
    console.print("  [1] 原料库管理")
    console.print("  [2] 配方/SKU管理")
    console.print("  [3] 替换演练")
    console.print("  [4] 导入导出")
    console.print("  [5] 数据统计概览")
    console.print("  [0] 退出并保存")
    
    choice = Prompt.ask("\n请输入选项", choices=["1", "2", "3", "4", "5", "0"], default="0")
    
    if choice == "1":
        menu_ingredients()
    elif choice == "2":
        menu_recipes()
    elif choice == "3":
        menu_replacement()
    elif choice == "4":
        menu_import_export()
    elif choice == "5":
        show_statistics()
    elif choice == "0":
        save_data()
        console.print("\n[green]数据已保存，感谢使用！[/green]")
        sys.exit(0)


# ==================== 原料管理菜单 ====================

def menu_ingredients():
    """原料管理菜单"""
    while True:
        console.clear()
        ingredients = calculator.get_all_ingredients()
        
        console.print(Panel.fit(
            f"[bold green]📦 原料库管理[/bold green] - 共 {len(ingredients)} 种原料",
            title="原料库"
        ))
        
        if ingredients:
            table = Table(show_header=True, header_style="bold magenta")
            table.add_column("序号", style="dim", width=4)
            table.add_column("ID", style="dim")
            table.add_column("名称", style="bold")
            table.add_column("单位")
            table.add_column("单价", justify="right")
            table.add_column("供应商")
            table.add_column("过敏原", style="yellow")
            
            for idx, ing in enumerate(ingredients, 1):
                allergens = ",".join([a.value for a in ing.allergens]) if ing.allergens else "无"
                table.add_row(
                    str(idx),
                    ing.id,
                    ing.name,
                    ing.unit,
                    f"¥{ing.current_price:.2f}",
                    ing.supplier,
                    allergens
                )
            
            console.print(table)
        else:
            console.print("[yellow]暂无原料数据[/yellow]")
        
        console.print("\n[bold]操作选项:[/bold]")
        console.print("  [1] 添加原料")
        console.print("  [2] 查看原料详情")
        console.print("  [3] 更新原料信息")
        console.print("  [4] 删除原料")
        console.print("  [0] 返回主菜单")
        
        choice = Prompt.ask("\n请输入选项", choices=["1", "2", "3", "4", "0"], default="0")
        
        if choice == "1":
            add_ingredient_interactive()
        elif choice == "2":
            view_ingredient_detail()
        elif choice == "3":
            update_ingredient_interactive()
        elif choice == "4":
            delete_ingredient_interactive()
        elif choice == "0":
            save_data()
            show_main_menu()
            break


def add_ingredient_interactive():
    """交互式添加原料"""
    console.clear()
    console.print(Panel("[bold]添加新原料[/bold]"))
    
    name = Prompt.ask("原料名称")
    
    unit = Prompt.ask("单位 (如 kg, g, 个, 盒)", default="kg")
    
    while True:
        try:
            current_price = float(Prompt.ask("当前采购单价"))
            if current_price >= 0:
                break
            console.print("[red]价格不能为负数[/red]")
        except ValueError:
            console.print("[red]请输入有效数字[/red]")
    
    supplier = Prompt.ask("供应商", default="未知")
    
    console.print("\n[bold]过敏原标签 (多选，用逗号分隔):[/bold]")
    for a in AllergenType:
        console.print(f"  - {a.value}")
    allergen_input = Prompt.ask("输入过敏原 (如 '乳制品,鸡蛋')", default="")
    
    allergens = []
    if allergen_input:
        allergen_map = {a.value: a for a in AllergenType}
        for a in allergen_input.split(","):
            a = a.strip()
            if a in allergen_map:
                allergens.append(allergen_map[a])
    
    console.print("\n[bold]饮食标签 (多选，用逗号分隔):[/bold]")
    for d in DietaryLabel:
        console.print(f"  - {d.value}")
    label_input = Prompt.ask("输入饮食标签", default="")
    
    dietary_labels = []
    if label_input:
        label_map = {d.value: d for d in DietaryLabel}
        for d in label_input.split(","):
            d = d.strip()
            if d in label_map:
                dietary_labels.append(label_map[d])
    
    is_substitutable = Confirm.ask("是否可被其他原料替代?", default=True)
    
    notes = Prompt.ask("备注 (可选)", default="")
    
    try:
        ingredient = calculator.add_ingredient(
            name=name,
            unit=unit,
            current_price=current_price,
            supplier=supplier,
            allergens=allergens,
            dietary_labels=dietary_labels,
            is_substitutable=is_substitutable,
            notes=notes
        )
        console.print(f"\n[green]✓ 原料添加成功: {ingredient.name} (ID: {ingredient.id})[/green]")
        save_data()
    except Exception as e:
        console.print(f"\n[red]添加失败: {str(e)}[/red]")
    
    input("\n按回车键继续...")


def view_ingredient_detail():
    """查看原料详情"""
    ingredients = calculator.get_all_ingredients()
    if not ingredients:
        console.print("[yellow]暂无原料[/yellow]")
        input("\n按回车键继续...")
        return
    
    console.print("\n[bold]请选择要查看的原料序号:[/bold]")
    for idx, ing in enumerate(ingredients, 1):
        console.print(f"  [{idx}] {ing.name}")
    
    try:
        choice = int(Prompt.ask("请输入序号"))
        if 1 <= choice <= len(ingredients):
            ing = ingredients[choice - 1]
            
            console.clear()
            console.print(Panel(f"[bold]{ing.name}[/bold] 详细信息"))
            
            table = Table(show_header=False)
            table.add_column("属性", style="bold")
            table.add_column("值")
            
            table.add_row("ID", ing.id)
            table.add_row("名称", ing.name)
            table.add_row("单位", ing.unit)
            table.add_row("当前单价", f"¥{ing.current_price:.2f}")
            table.add_row("供应商", ing.supplier)
            table.add_row("是否可替代", "是" if ing.is_substitutable else "否")
            table.add_row("预设替代原料", ",".join(ing.substitute_ids) if ing.substitute_ids else "无")
            table.add_row("过敏原", ",".join([a.value for a in ing.allergens]) if ing.allergens else "无")
            table.add_row("饮食标签", ",".join([d.value for d in ing.dietary_labels]) if ing.dietary_labels else "无")
            table.add_row("备注", ing.notes if ing.notes else "无")
            table.add_row("创建时间", ing.created_at.strftime("%Y-%m-%d %H:%M"))
            table.add_row("更新时间", ing.updated_at.strftime("%Y-%m-%d %H:%M"))
            
            console.print(table)
            
            if ing.price_history:
                console.print("\n[bold]价格历史:[/bold]")
                ph_table = Table(show_header=True)
                ph_table.add_column("日期")
                ph_table.add_column("价格", justify="right")
                ph_table.add_column("供应商")
                ph_table.add_column("批次号")
                
                for ph in reversed(ing.price_history[-10:]):
                    ph_table.add_row(
                        ph.purchase_date.strftime("%Y-%m-%d %H:%M"),
                        f"¥{ph.price:.2f}",
                        ph.supplier,
                        ph.batch_number or "-"
                    )
                
                console.print(ph_table)
        else:
            console.print("[red]无效序号[/red]")
    except ValueError:
        console.print("[red]请输入有效数字[/red]")
    
    input("\n按回车键继续...")


def update_ingredient_interactive():
    """更新原料"""
    ingredients = calculator.get_all_ingredients()
    if not ingredients:
        console.print("[yellow]暂无原料[/yellow]")
        input("\n按回车键继续...")
        return
    
    console.print("\n[bold]请选择要更新的原料序号:[/bold]")
    for idx, ing in enumerate(ingredients, 1):
        console.print(f"  [{idx}] {ing.name}")
    
    try:
        choice = int(Prompt.ask("请输入序号"))
        if 1 <= choice <= len(ingredients):
            ing = ingredients[choice - 1]
            console.print(f"\n当前: {ing.name} - ¥{ing.current_price:.2f}/{ing.unit}")
            
            new_name = Prompt.ask("新名称 (留空保持不变)", default=ing.name)
            new_unit = Prompt.ask("新单位 (留空保持不变)", default=ing.unit)
            
            while True:
                price_input = Prompt.ask(f"新单价 (当前: ¥{ing.current_price:.2f}，留空保持不变)", default="")
                if not price_input:
                    new_price = ing.current_price
                    break
                try:
                    new_price = float(price_input)
                    if new_price >= 0:
                        break
                    console.print("[red]价格不能为负数[/red]")
                except ValueError:
                    console.print("[red]请输入有效数字[/red]")
            
            new_supplier = Prompt.ask("新供应商 (留空保持不变)", default=ing.supplier)
            
            calculator.update_ingredient(
                ing.id,
                name=new_name,
                unit=new_unit,
                current_price=new_price,
                supplier=new_supplier
            )
            console.print("\n[green]✓ 原料已更新[/green]")
            save_data()
        else:
            console.print("[red]无效序号[/red]")
    except ValueError:
        console.print("[red]请输入有效数字[/red]")
    
    input("\n按回车键继续...")


def delete_ingredient_interactive():
    """删除原料"""
    ingredients = calculator.get_all_ingredients()
    if not ingredients:
        console.print("[yellow]暂无原料[/yellow]")
        input("\n按回车键继续...")
        return
    
    console.print("\n[bold]请选择要删除的原料序号:[/bold]")
    for idx, ing in enumerate(ingredients, 1):
        console.print(f"  [{idx}] {ing.name}")
    
    try:
        choice = int(Prompt.ask("请输入序号"))
        if 1 <= choice <= len(ingredients):
            ing = ingredients[choice - 1]
            
            if Confirm.ask(f"确定要删除原料 '{ing.name}' 吗?", default=False):
                try:
                    calculator.delete_ingredient(ing.id)
                    console.print("\n[green]✓ 原料已删除[/green]")
                    save_data()
                except ValueError as e:
                    console.print(f"\n[red]{str(e)}[/red]")
        else:
            console.print("[red]无效序号[/red]")
    except ValueError:
        console.print("[red]请输入有效数字[/red]")
    
    input("\n按回车键继续...")


# ==================== 配方管理菜单 ====================

def menu_recipes():
    """配方管理菜单"""
    while True:
        console.clear()
        recipes = calculator.get_all_recipes()
        
        console.print(Panel.fit(
            f"[bold cyan]📋 配方/SKU管理[/bold cyan] - 共 {len(recipes)} 个配方",
            title="配方库"
        ))
        
        if recipes:
            table = Table(show_header=True, header_style="bold magenta")
            table.add_column("序号", style="dim", width=4)
            table.add_column("ID", style="dim")
            table.add_column("SKU")
            table.add_column("名称", style="bold")
            table.add_column("产量")
            table.add_column("目标售价", justify="right")
            table.add_column("原料数")
            
            for idx, recipe in enumerate(recipes, 1):
                table.add_row(
                    str(idx),
                    recipe.id,
                    recipe.sku,
                    recipe.name,
                    f"{recipe.yield_quantity} {recipe.yield_unit}",
                    f"¥{recipe.target_price:.2f}",
                    str(len(recipe.ingredients))
                )
            
            console.print(table)
        else:
            console.print("[yellow]暂无配方数据[/yellow]")
        
        console.print("\n[bold]操作选项:[/bold]")
        console.print("  [1] 添加配方")
        console.print("  [2] 查看配方成本分析")
        console.print("  [3] 添加/编辑配方原料")
        console.print("  [4] 删除配方")
        console.print("  [0] 返回主菜单")
        
        choice = Prompt.ask("\n请输入选项", choices=["1", "2", "3", "4", "0"], default="0")
        
        if choice == "1":
            add_recipe_interactive()
        elif choice == "2":
            view_recipe_cost()
        elif choice == "3":
            manage_recipe_ingredients()
        elif choice == "4":
            delete_recipe_interactive()
        elif choice == "0":
            save_data()
            show_main_menu()
            break


def add_recipe_interactive():
    """交互式添加配方"""
    console.clear()
    console.print(Panel("[bold]添加新配方[/bold]"))
    
    sku = Prompt.ask("SKU (产品编码)")
    name = Prompt.ask("产品名称")
    description = Prompt.ask("产品描述", default="")
    
    while True:
        try:
            yield_quantity = float(Prompt.ask("批次产量 (数字)"))
            if yield_quantity > 0:
                break
            console.print("[red]产量必须大于0[/red]")
        except ValueError:
            console.print("[red]请输入有效数字[/red]")
    
    yield_unit = Prompt.ask("产量单位 (如 个, 克, 盒)", default="个")
    
    while True:
        try:
            target_price = float(Prompt.ask("目标售价"))
            if target_price > 0:
                break
            console.print("[red]售价必须大于0[/red]")
        except ValueError:
            console.print("[red]请输入有效数字[/red]")
    
    notes = Prompt.ask("备注", default="")
    
    try:
        recipe = calculator.add_recipe(
            sku=sku,
            name=name,
            description=description,
            yield_quantity=yield_quantity,
            yield_unit=yield_unit,
            target_price=target_price,
            notes=notes
        )
        console.print(f"\n[green]✓ 配方添加成功: {recipe.name} (SKU: {recipe.sku})[/green]")
        console.print("[dim]提示: 使用 '添加/编辑配方原料' 功能来添加原料[/dim]")
        save_data()
    except Exception as e:
        console.print(f"\n[red]添加失败: {str(e)}[/red]")
    
    input("\n按回车键继续...")


def view_recipe_cost():
    """查看配方成本分析"""
    recipes = calculator.get_all_recipes()
    if not recipes:
        console.print("[yellow]暂无配方[/yellow]")
        input("\n按回车键继续...")
        return
    
    console.print("\n[bold]请选择要分析的配方序号:[/bold]")
    for idx, recipe in enumerate(recipes, 1):
        console.print(f"  [{idx}] {recipe.sku} - {recipe.name}")
    
    try:
        choice = int(Prompt.ask("请输入序号"))
        if 1 <= choice <= len(recipes):
            recipe = recipes[choice - 1]
            
            try:
                analysis = calculator.calculate_recipe_cost(recipe.id)
                
                console.clear()
                console.print(Panel(f"[bold]{analysis.recipe_name}[/bold] 成本分析报告"))
                
                summary_table = Table(show_header=False)
                summary_table.add_column("指标", style="bold")
                summary_table.add_column("数值", justify="right")
                
                summary_table.add_row("SKU", analysis.sku)
                summary_table.add_row("理论成本", f"¥{analysis.theoretical_cost:.2f}")
                summary_table.add_row("实际成本", f"[bold red]¥{analysis.actual_cost:.2f}[/bold red]")
                summary_table.add_row("目标售价", f"¥{analysis.target_price:.2f}")
                
                theo_margin_style = "green" if analysis.theoretical_margin >= 0.4 else "red"
                actual_margin_style = "green" if analysis.actual_margin >= 0.4 else "red"
                
                summary_table.add_row(
                    "理论毛利率", 
                    f"[{theo_margin_style}]{analysis.theoretical_margin * 100:.1f}%[/{theo_margin_style}]"
                )
                summary_table.add_row(
                    "实际毛利率", 
                    f"[{actual_margin_style}]{analysis.actual_margin * 100:.1f}%[/{actual_margin_style}]"
                )
                summary_table.add_row("单位成本", f"¥{analysis.cost_per_unit:.2f}/{analysis.yield_unit}")
                
                console.print(summary_table)
                
                if analysis.ingredient_breakdown:
                    console.print("\n[bold]原料成本明细:[/bold]")
                    
                    breakdown_table = Table(show_header=True, header_style="bold magenta")
                    breakdown_table.add_column("原料")
                    breakdown_table.add_column("用量")
                    breakdown_table.add_column("损耗率")
                    breakdown_table.add_column("实际用量")
                    breakdown_table.add_column("单价")
                    breakdown_table.add_column("理论成本", justify="right")
                    breakdown_table.add_column("实际成本", justify="right")
                    
                    for item in analysis.ingredient_breakdown:
                        breakdown_table.add_row(
                            item["ingredient_name"],
                            f"{item['quantity']} {item['unit']}",
                            f"{item['waste_rate'] * 100:.0f}%",
                            f"{item['actual_quantity']:.2f} {item['unit']}",
                            f"¥{item['unit_price']:.2f}/{item['unit']}",
                            f"¥{item['cost']:.2f}",
                            f"[bold]¥{item['actual_cost']:.2f}[/bold]"
                        )
                    
                    console.print(breakdown_table)
                
                if analysis.allergens:
                    console.print("\n[bold yellow]⚠️ 过敏原信息:[/bold yellow]")
                    for a in analysis.allergens:
                        console.print(f"  - {a.value}")
                
                if analysis.dietary_labels:
                    console.print("\n[bold green]✅ 饮食标签:[/bold green]")
                    for d in analysis.dietary_labels:
                        console.print(f"  - {d.value}")
                
                if Confirm.ask("\n是否导出此报告?", default=False):
                    export_path = Prompt.ask("导出文件路径", default=f"./{analysis.sku}_cost_analysis")
                    fmt = Prompt.ask("导出格式", choices=["markdown", "html", "csv"], default="markdown")
                    
                    if not export_path.endswith(f".{fmt}"):
                        export_path = f"{export_path}.{fmt}"
                    
                    try:
                        ie_manager.export_recipe_cost_analysis(recipe.id, export_path, fmt)
                        console.print(f"[green]✓ 报告已导出到: {export_path}[/green]")
                    except Exception as e:
                        console.print(f"[red]导出失败: {str(e)}[/red]")
                    
            except Exception as e:
                console.print(f"\n[red]分析失败: {str(e)}[/red]")
        else:
            console.print("[red]无效序号[/red]")
    except ValueError:
        console.print("[red]请输入有效数字[/red]")
    
    input("\n按回车键继续...")


def manage_recipe_ingredients():
    """管理配方原料"""
    recipes = calculator.get_all_recipes()
    if not recipes:
        console.print("[yellow]暂无配方[/yellow]")
        input("\n按回车键继续...")
        return
    
    console.print("\n[bold]请选择配方序号:[/bold]")
    for idx, recipe in enumerate(recipes, 1):
        console.print(f"  [{idx}] {recipe.sku} - {recipe.name}")
    
    try:
        choice = int(Prompt.ask("请输入序号"))
        if 1 <= choice <= len(recipes):
            recipe = recipes[choice - 1]
            
            while True:
                console.clear()
                console.print(Panel(f"[bold]管理配方原料: {recipe.name}[/bold]"))
                
                if recipe.ingredients:
                    table = Table(show_header=True, header_style="bold magenta")
                    table.add_column("序号", style="dim", width=4)
                    table.add_column("原料名称")
                    table.add_column("用量")
                    table.add_column("损耗率")
                    table.add_column("备注")
                    
                    for idx, ri in enumerate(recipe.ingredients, 1):
                        ing = calculator.get_ingredient(ri.ingredient_id)
                        name = ing.name if ing else ri.ingredient_id
                        table.add_row(
                            str(idx),
                            name,
                            f"{ri.quantity} {ing.unit if ing else ''}",
                            f"{ri.waste_rate * 100:.0f}%",
                            ri.notes or "-"
                        )
                    
                    console.print(table)
                else:
                    console.print("[yellow]该配方暂无原料[/yellow]")
                
                console.print("\n[bold]操作选项:[/bold]")
                console.print("  [1] 添加原料")
                console.print("  [2] 更新原料用量")
                console.print("  [3] 移除原料")
                console.print("  [0] 返回")
                
                sub_choice = Prompt.ask("\n请输入选项", choices=["1", "2", "3", "0"], default="0")
                
                if sub_choice == "1":
                    add_ingredient_to_recipe(recipe)
                elif sub_choice == "2":
                    update_recipe_ingredient_quantity(recipe)
                elif sub_choice == "3":
                    remove_ingredient_from_recipe(recipe)
                elif sub_choice == "0":
                    save_data()
                    break
        else:
            console.print("[red]无效序号[/red]")
            input("\n按回车键继续...")
    except ValueError:
        console.print("[red]请输入有效数字[/red]")
        input("\n按回车键继续...")


def add_ingredient_to_recipe(recipe):
    """向配方添加原料"""
    ingredients = calculator.get_all_ingredients()
    if not ingredients:
        console.print("[yellow]请先添加原料到原料库[/yellow]")
        input("\n按回车键继续...")
        return
    
    console.print("\n[bold]请选择要添加的原料序号:[/bold]")
    for idx, ing in enumerate(ingredients, 1):
        console.print(f"  [{idx}] {ing.name} (¥{ing.current_price:.2f}/{ing.unit})")
    
    try:
        choice = int(Prompt.ask("请输入序号"))
        if 1 <= choice <= len(ingredients):
            ing = ingredients[choice - 1]
            
            while True:
                try:
                    quantity = float(Prompt.ask(f"用量 ({ing.unit})"))
                    if quantity > 0:
                        break
                    console.print("[red]用量必须大于0[/red]")
                except ValueError:
                    console.print("[red]请输入有效数字[/red]")
            
            while True:
                try:
                    waste_input = Prompt.ask("损耗率 (如 0.05 表示 5%)", default="0")
                    waste_rate = float(waste_input)
                    if 0 <= waste_rate < 1:
                        break
                    console.print("[red]损耗率必须在 0-1 之间[/red]")
                except ValueError:
                    console.print("[red]请输入有效数字[/red]")
            
            notes = Prompt.ask("备注", default="")
            
            calculator.add_recipe_ingredient(
                recipe.id,
                ing.id,
                quantity=quantity,
                waste_rate=waste_rate,
                notes=notes
            )
            
            console.print(f"\n[green]✓ 已添加 {ing.name} 到配方[/green]")
            save_data()
        else:
            console.print("[red]无效序号[/red]")
    except ValueError:
        console.print("[red]请输入有效数字[/red]")
    
    input("\n按回车键继续...")


def update_recipe_ingredient_quantity(recipe):
    """更新配方原料用量"""
    if not recipe.ingredients:
        console.print("[yellow]该配方暂无原料[/yellow]")
        input("\n按回车键继续...")
        return
    
    console.print("\n[bold]请选择要更新的原料序号:[/bold]")
    for idx, ri in enumerate(recipe.ingredients, 1):
        ing = calculator.get_ingredient(ri.ingredient_id)
        name = ing.name if ing else ri.ingredient_id
        console.print(f"  [{idx}] {name} - 当前: {ri.quantity}")
    
    try:
        choice = int(Prompt.ask("请输入序号"))
        if 1 <= choice <= len(recipe.ingredients):
            ri = recipe.ingredients[choice - 1]
            ing = calculator.get_ingredient(ri.ingredient_id)
            
            while True:
                try:
                    new_qty = Prompt.ask(f"新用量 (当前: {ri.quantity} {ing.unit if ing else ''}，留空保持不变)", default="")
                    if not new_qty:
                        new_quantity = ri.quantity
                        break
                    new_quantity = float(new_qty)
                    if new_quantity > 0:
                        break
                    console.print("[red]用量必须大于0[/red]")
                except ValueError:
                    console.print("[red]请输入有效数字[/red]")
            
            while True:
                try:
                    new_waste_input = Prompt.ask(f"新损耗率 (当前: {ri.waste_rate * 100:.0f}%，留空保持不变)", default="")
                    if not new_waste_input:
                        new_waste_rate = ri.waste_rate
                        break
                    new_waste_rate = float(new_waste_input)
                    if 0 <= new_waste_rate < 1:
                        break
                    console.print("[red]损耗率必须在 0-1 之间[/red]")
                except ValueError:
                    console.print("[red]请输入有效数字[/red]")
            
            calculator.add_recipe_ingredient(
                recipe.id,
                ri.ingredient_id,
                quantity=new_quantity,
                waste_rate=new_waste_rate
            )
            
            console.print("\n[green]✓ 用量已更新[/green]")
            save_data()
        else:
            console.print("[red]无效序号[/red]")
    except ValueError:
        console.print("[red]请输入有效数字[/red]")
    
    input("\n按回车键继续...")


def remove_ingredient_from_recipe(recipe):
    """从配方移除原料"""
    if not recipe.ingredients:
        console.print("[yellow]该配方暂无原料[/yellow]")
        input("\n按回车键继续...")
        return
    
    console.print("\n[bold]请选择要移除的原料序号:[/bold]")
    for idx, ri in enumerate(recipe.ingredients, 1):
        ing = calculator.get_ingredient(ri.ingredient_id)
        name = ing.name if ing else ri.ingredient_id
        console.print(f"  [{idx}] {name}")
    
    try:
        choice = int(Prompt.ask("请输入序号"))
        if 1 <= choice <= len(recipe.ingredients):
            ri = recipe.ingredients[choice - 1]
            ing = calculator.get_ingredient(ri.ingredient_id)
            name = ing.name if ing else ri.ingredient_id
            
            if Confirm.ask(f"确定要移除 '{name}' 吗?", default=False):
                calculator.remove_recipe_ingredient(recipe.id, ri.ingredient_id)
                console.print("\n[green]✓ 已移除[/green]")
                save_data()
        else:
            console.print("[red]无效序号[/red]")
    except ValueError:
        console.print("[red]请输入有效数字[/red]")
    
    input("\n按回车键继续...")


def delete_recipe_interactive():
    """删除配方"""
    recipes = calculator.get_all_recipes()
    if not recipes:
        console.print("[yellow]暂无配方[/yellow]")
        input("\n按回车键继续...")
        return
    
    console.print("\n[bold]请选择要删除的配方序号:[/bold]")
    for idx, recipe in enumerate(recipes, 1):
        console.print(f"  [{idx}] {recipe.sku} - {recipe.name}")
    
    try:
        choice = int(Prompt.ask("请输入序号"))
        if 1 <= choice <= len(recipes):
            recipe = recipes[choice - 1]
            
            if Confirm.ask(f"确定要删除配方 '{recipe.name}' (SKU: {recipe.sku}) 吗?", default=False):
                calculator.delete_recipe(recipe.id)
                console.print("\n[green]✓ 配方已删除[/green]")
                save_data()
        else:
            console.print("[red]无效序号[/red]")
    except ValueError:
        console.print("[red]请输入有效数字[/red]")
    
    input("\n按回车键继续...")


# ==================== 替换演练菜单 ====================

def menu_replacement():
    """替换演练菜单"""
    while True:
        console.clear()
        recipes = calculator.get_all_recipes()
        
        console.print(Panel.fit(
            "[bold magenta]🔄 原料替换演练[/bold magenta]\n"
            "[dim]模拟原料替换，查看成本、毛利、过敏原变化[/dim]",
            title="替换演练"
        ))
        
        if not recipes:
            console.print("[yellow]请先添加配方[/yellow]")
            input("\n按回车键返回...")
            show_main_menu()
            break
        
        console.print("\n[bold]请选择要演练的配方序号:[/bold]")
        for idx, recipe in enumerate(recipes, 1):
            console.print(f"  [{idx}] {recipe.sku} - {recipe.name}")
        console.print("  [0] 返回主菜单")
        
        try:
            choice = int(Prompt.ask("请输入序号", default="0"))
            if choice == 0:
                save_data()
                show_main_menu()
                break
            
            if 1 <= choice <= len(recipes):
                recipe = recipes[choice - 1]
                run_replacement_simulation(recipe)
            else:
                console.print("[red]无效序号[/red]")
                input("\n按回车键继续...")
        except ValueError:
            console.print("[red]请输入有效数字[/red]")
            input("\n按回车键继续...")


def run_replacement_simulation(recipe):
    """运行替换演练"""
    console.clear()
    console.print(Panel(f"[bold]替换演练: {recipe.name}[/bold]"))
    
    if not recipe.ingredients:
        console.print("[yellow]该配方暂无原料[/yellow]")
        input("\n按回车键返回...")
        return
    
    possible_replacements = calculator.get_possible_replacements(recipe.id)
    
    if not possible_replacements:
        console.print("[yellow]该配方中的原料均标记为不可替代[/yellow]")
        input("\n按回车键返回...")
        return
    
    console.print("\n[bold]配方中可替换的原料:[/bold]")
    
    replaceable_ings = []
    for idx, (orig_ing_id, candidates) in enumerate(possible_replacements.items(), 1):
        orig_ing = calculator.get_ingredient(orig_ing_id)
        orig_name = orig_ing.name if orig_ing else orig_ing_id
        console.print(f"  [{idx}] {orig_name} - 有 {len(candidates)} 个候选替换品")
        replaceable_ings.append((orig_ing_id, candidates))
    
    try:
        choice = int(Prompt.ask("\n请选择要替换的原料序号"))
        if 1 <= choice <= len(replaceable_ings):
            orig_ing_id, candidates = replaceable_ings[choice - 1]
            orig_ing = calculator.get_ingredient(orig_ing_id)
            orig_name = orig_ing.name if orig_ing else orig_ing_id
            
            console.print(f"\n[bold]为 '{orig_name}' 选择替换原料:[/bold]")
            for idx, candidate in enumerate(candidates, 1):
                price_diff = candidate.current_price - (orig_ing.current_price if orig_ing else 0)
                price_diff_str = f"({price_diff:+.2f})" if price_diff != 0 else ""
                console.print(f"  [{idx}] {candidate.name} - ¥{candidate.current_price}/{candidate.unit} {price_diff_str}")
            
            sub_choice = int(Prompt.ask("请选择替换原料序号"))
            if 1 <= sub_choice <= len(candidates):
                replacement_ing = candidates[sub_choice - 1]
                
                with console.status("[bold]正在计算替换影响...[/bold]"):
                    result = calculator.simulate_replacement(
                        recipe.id,
                        orig_ing_id,
                        replacement_ing.id
                    )
                
                display_replacement_result(result, orig_ing, replacement_ing, recipe)
                
                if Confirm.ask("\n是否导出此演练报告?", default=False):
                    export_path = Prompt.ask("导出文件路径", default=f"./replacement_{recipe.sku}")
                    fmt = Prompt.ask("导出格式", choices=["markdown", "html", "csv"], default="markdown")
                    
                    if not export_path.endswith(f".{fmt}"):
                        export_path = f"{export_path}.{fmt}"
                    
                    try:
                        ie_manager.export_replacement_result(result, export_path, fmt)
                        console.print(f"[green]✓ 报告已导出到: {export_path}[/green]")
                    except Exception as e:
                        console.print(f"[red]导出失败: {str(e)}[/red]")
                
                save_data()
            else:
                console.print("[red]无效序号[/red]")
        else:
            console.print("[red]无效序号[/red]")
    except ValueError:
        console.print("[red]请输入有效数字[/red]")
    
    input("\n按回车键继续...")


def display_replacement_result(result, orig_ing, replacement_ing, recipe):
    """显示替换演练结果"""
    console.clear()
    
    status = "✅ 推荐替换" if result.is_recommended else "❌ 不推荐替换"
    status_color = "green" if result.is_recommended else "red"
    
    console.print(Panel(
        f"[bold]原料替换演练结果[/bold]\n"
        f"{recipe.name}\n"
        f"[{status_color}]{status}[/{status_color}]",
        title="演练结果"
    ))
    
    summary_table = Table(show_header=True, header_style="bold magenta")
    summary_table.add_column("指标")
    summary_table.add_column("替换前", justify="right")
    summary_table.add_column("替换后", justify="right")
    summary_table.add_column("变化", justify="right")
    
    cost_diff_style = "green" if result.cost_difference < 0 else "red"
    margin_diff_style = "green" if result.margin_difference > 0 else "red"
    
    summary_table.add_row(
        "实际成本",
        f"¥{result.original_cost:.2f}",
        f"¥{result.new_cost:.2f}",
        f"[{cost_diff_style}]{result.cost_difference:+.2f} ({result.cost_difference_percentage:+.1f}%)[/{cost_diff_style}]"
    )
    summary_table.add_row(
        "毛利率",
        f"{result.original_margin * 100:.1f}%",
        f"{result.new_margin * 100:.1f}%",
        f"[{margin_diff_style}]{result.margin_difference * 100:+.1f}个百分点[/{margin_diff_style}]"
    )
    
    console.print(summary_table)
    
    if result.warnings:
        console.print("\n[bold yellow]⚠️ 警告信息:[/bold yellow]")
        for w in result.warnings:
            console.print(f"  - {w}")
    
    if result.added_allergens or result.removed_allergens:
        console.print("\n[bold]过敏原变化:[/bold]")
        if result.added_allergens:
            console.print("  [red]新增过敏原:[/red]")
            for a in result.added_allergens:
                console.print(f"    - {a.value}")
        if result.removed_allergens:
            console.print("  [green]移除过敏原:[/green]")
            for a in result.removed_allergens:
                console.print(f"    - {a.value}")
    
    if result.added_dietary_labels or result.removed_dietary_labels:
        console.print("\n[bold]饮食标签变化:[/bold]")
        if result.added_dietary_labels:
            console.print("  [green]新增标签:[/green]")
            for d in result.added_dietary_labels:
                console.print(f"    - {d.value}")
        if result.removed_dietary_labels:
            console.print("  [red]失去标签:[/red]")
            for d in result.removed_dietary_labels:
                console.print(f"    - {d.value}")


# ==================== 导入导出菜单 ====================

def menu_import_export():
    """导入导出菜单"""
    while True:
        console.clear()
        
        console.print(Panel.fit(
            "[bold yellow]📤 导入导出[/bold yellow]\n"
            "[dim]支持 CSV/JSON 导入，支持 Markdown/HTML/CSV 导出[/dim]",
            title="导入导出"
        ))
        
        console.print("\n[bold]操作选项:[/bold]")
        console.print("  [1] 从 CSV 导入原料")
        console.print("  [2] 从 JSON 导入原料")
        console.print("  [3] 导出原料到 CSV")
        console.print("  [4] 导出配方到 CSV")
        console.print("  [5] 导出所有配方过敏原清单")
        console.print("  [6] 完整数据备份 (JSON)")
        console.print("  [7] 从备份恢复")
        console.print("  [0] 返回主菜单")
        
        choice = Prompt.ask("\n请输入选项", choices=["1", "2", "3", "4", "5", "6", "7", "0"], default="0")
        
        if choice == "1":
            import_ingredients_csv()
        elif choice == "2":
            import_ingredients_json()
        elif choice == "3":
            export_ingredients_csv()
        elif choice == "4":
            export_recipes_csv()
        elif choice == "5":
            export_allergen_list()
        elif choice == "6":
            backup_data()
        elif choice == "7":
            restore_backup()
        elif choice == "0":
            save_data()
            show_main_menu()
            break


def import_ingredients_csv():
    """从 CSV 导入原料"""
    filepath = Prompt.ask("请输入 CSV 文件路径")
    
    if not os.path.exists(filepath):
        console.print(f"[red]文件不存在: {filepath}[/red]")
        input("\n按回车键继续...")
        return
    
    with console.status("[bold]正在导入...[/bold]"):
        results = ie_manager.import_ingredients_from_csv(filepath)
    
    console.print(f"\n导入结果: 成功 {results['success']} 项, 失败 {results['failed']} 项")
    
    if results['errors']:
        console.print("\n[bold]错误/警告信息:[/bold]")
        for e in results['errors'][:10]:
            console.print(f"  - {e}")
        if len(results['errors']) > 10:
            console.print(f"  ... 还有 {len(results['errors']) - 10} 条信息")
    
    save_data()
    input("\n按回车键继续...")


def import_ingredients_json():
    """从 JSON 导入原料"""
    filepath = Prompt.ask("请输入 JSON 文件路径")
    
    if not os.path.exists(filepath):
        console.print(f"[red]文件不存在: {filepath}[/red]")
        input("\n按回车键继续...")
        return
    
    with console.status("[bold]正在导入...[/bold]"):
        results = ie_manager.import_ingredients_from_json(filepath)
    
    console.print(f"\n导入结果: 成功 {results['success']} 项, 失败 {results['failed']} 项")
    
    if results['errors']:
        console.print("\n[bold]错误/警告信息:[/bold]")
        for e in results['errors'][:10]:
            console.print(f"  - {e}")
    
    save_data()
    input("\n按回车键继续...")


def export_ingredients_csv():
    """导出原料到 CSV"""
    filepath = Prompt.ask("导出文件路径", default="./ingredients_export.csv")
    
    if not filepath.endswith(".csv"):
        filepath = f"{filepath}.csv"
    
    try:
        ie_manager.export_ingredients_to_csv(filepath)
        console.print(f"\n[green]✓ 已导出到: {filepath}[/green]")
    except Exception as e:
        console.print(f"\n[red]导出失败: {str(e)}[/red]")
    
    input("\n按回车键继续...")


def export_recipes_csv():
    """导出配方到 CSV"""
    filepath = Prompt.ask("导出文件路径", default="./recipes_export.csv")
    include_ingredients = Confirm.ask("是否包含原料明细?", default=True)
    
    if not filepath.endswith(".csv"):
        filepath = f"{filepath}.csv"
    
    try:
        ie_manager.export_recipes_to_csv(filepath, include_ingredients)
        console.print(f"\n[green]✓ 已导出到: {filepath}[/green]")
    except Exception as e:
        console.print(f"\n[red]导出失败: {str(e)}[/red]")
    
    input("\n按回车键继续...")


def export_allergen_list():
    """导出过敏原清单"""
    filepath = Prompt.ask("导出文件路径", default="./allergen_list.csv")
    
    if not filepath.endswith(".csv"):
        filepath = f"{filepath}.csv"
    
    try:
        ie_manager.export_allergen_list(filepath)
        console.print(f"\n[green]✓ 过敏原清单已导出到: {filepath}[/green]")
    except Exception as e:
        console.print(f"\n[red]导出失败: {str(e)}[/red]")
    
    input("\n按回车键继续...")


def backup_data():
    """完整数据备份"""
    filepath = Prompt.ask("备份文件路径", default="./bake_calc_backup.json")
    
    if not filepath.endswith(".json"):
        filepath = f"{filepath}.json"
    
    try:
        storage.export_backup(filepath)
        console.print(f"\n[green]✓ 完整备份已保存到: {filepath}[/green]")
    except Exception as e:
        console.print(f"\n[red]备份失败: {str(e)}[/red]")
    
    input("\n按回车键继续...")


def restore_backup():
    """从备份恢复"""
    filepath = Prompt.ask("备份文件路径")
    
    if not os.path.exists(filepath):
        console.print(f"[red]文件不存在: {filepath}[/red]")
        input("\n按回车键继续...")
        return
    
    if not Confirm.ask("恢复将覆盖当前所有数据，确定继续吗?", default=False):
        return
    
    global calculator, ie_manager
    
    try:
        calculator = storage.import_backup(filepath)
        ie_manager = ImportExportManager(calculator)
        save_data()
        console.print(f"\n[green]✓ 数据已从备份恢复[/green]")
    except Exception as e:
        console.print(f"\n[red]恢复失败: {str(e)}[/red]")
    
    input("\n按回车键继续...")


# ==================== 统计概览 ====================

def show_statistics():
    """显示数据统计概览"""
    console.clear()
    
    ingredients = calculator.get_all_ingredients()
    recipes = calculator.get_all_recipes()
    replacement_history = calculator.get_replacement_history()
    
    console.print(Panel(
        "[bold]📊 数据统计概览[/bold]",
        title="统计"
    ))
    
    console.print(f"\n[bold]原料库:[/bold] {len(ingredients)} 种原料")
    
    if ingredients:
        allergens_count = sum(1 for i in ingredients if i.allergens)
        substitutable_count = sum(1 for i in ingredients if i.is_substitutable)
        
        console.print(f"  - 含过敏原: {allergens_count} 种")
        console.print(f"  - 可替代: {substitutable_count} 种")
        
        suppliers = set(i.supplier for i in ingredients)
        console.print(f"  - 供应商数量: {len(suppliers)}")
    
    console.print(f"\n[bold]配方库:[/bold] {len(recipes)} 个配方")
    
    if recipes:
        total_ingredients = sum(len(r.ingredients) for r in recipes)
        console.print(f"  - 总原料使用数: {total_ingredients} 项次")
        
        console.print("\n[bold]配方成本概览:[/bold]")
        
        for recipe in recipes[:10]:
            try:
                analysis = calculator.calculate_recipe_cost(recipe.id)
                margin_style = "green" if analysis.actual_margin >= 0.4 else "red"
                console.print(
                    f"  - {recipe.sku} {recipe.name}: "
                    f"成本 ¥{analysis.actual_cost:.2f}, "
                    f"售价 ¥{analysis.target_price:.2f}, "
                    f"毛利率 [{margin_style}]{analysis.actual_margin * 100:.1f}%[/{margin_style}]"
                )
            except Exception:
                pass
    
    console.print(f"\n[bold]替换演练历史:[/bold] {len(replacement_history)} 次演练")
    
    console.print("\n[dim]提示: 从 '导出所有配方过敏原清单' 可以获得完整的产品合规标签[/dim]")
    
    input("\n按回车键返回...")
    show_main_menu()


if __name__ == "__main__":
    main()
