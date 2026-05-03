"""
CLI 模块 - 香精配方标签核验员的命令行接口
"""

import os
import sys
from typing import Optional

import click

from .calculator import FormulaCalculator
from .examples import ExampleDataGenerator
from .models import Unit
from .parser import DataStore, ParserError
from .reporter import Reporter
from .rules import RuleEngine


@click.group()
@click.version_option(version="0.1.0")
@click.option("--verbose", "-v", is_flag=True, help="显示详细输出")
@click.pass_context
def cli(ctx, verbose):
    """
    香精配方标签核验员 - 小型调香工作室的本地命令行工具
    
    用于新品打样前的配方核验，包括：
    - 原料用量换算和成本计算
    - IFRA 规则和过敏原阈值检查
    - 批次过期和库存检查
    - 合规报告导出
    """
    ctx.ensure_object(dict)
    ctx.obj["VERBOSE"] = verbose


@cli.command()
@click.option("--directory", "-d", default="./fragrance-project", 
              help="项目目录路径 (默认: ./fragrance-project)")
@click.pass_context
def init(ctx, directory):
    """
    初始化新项目，创建配置和示例数据
    
    创建目录结构、配置文件和示例数据文件：
    - formulas/: 配方 CSV 文件
    - raw_materials/: 原料信息 CSV 文件
    - batches/: 批次信息 CSV 文件
    - rules/: IFRA/过敏原规则 YAML 文件
    - reports/: 输出报告目录
    - config.yaml: 项目配置文件
    """
    verbose = ctx.obj.get("VERBOSE", False)
    
    if os.path.exists(directory) and os.listdir(directory):
        click.echo(f"错误: 目录 '{directory}' 已存在且不为空")
        sys.exit(1)
    
    try:
        generated_files = ExampleDataGenerator.generate_all(directory)
        
        click.echo(f"✅ 项目初始化完成: {directory}")
        click.echo("")
        click.echo("创建的文件:")
        for name, path in generated_files.items():
            click.echo(f"  - {name}: {path}")
        click.echo("")
        click.echo("接下来的步骤:")
        click.echo(f"  1. 进入目录: cd {directory}")
        click.echo(f"  2. 导入数据: fragrance-checker import --all")
        click.echo(f"  3. 计算配方: fragrance-checker calc --formula formulas/example_formula.csv --target 500")
        click.echo(f"  4. 检查合规: fragrance-checker check --formula formulas/example_formula.csv")
        click.echo(f"  5. 生成报告: fragrance-checker report --formula formulas/example_formula.csv --output reports/")
        
    except Exception as e:
        click.echo(f"❌ 初始化失败: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.option("--formula", "-f", help="配方 CSV 文件路径")
@click.option("--materials", "-m", help="原料 CSV 文件路径")
@click.option("--batches", "-b", help="批次 CSV 文件路径")
@click.option("--rules", "-r", help="规则 YAML 文件路径")
@click.option("--all", "-a", is_flag=True, help="从默认目录导入所有数据")
@click.option("--directory", "-d", default=".", help="数据目录 (默认: 当前目录)")
@click.pass_context
def import_data(ctx, formula, materials, batches, rules, all, directory):
    """
    导入配方、原料、批次、规则数据
    
    可以单独指定各个文件，或者使用 --all 从默认目录结构导入。
    默认目录结构:
    - formulas/*.csv: 配方文件
    - raw_materials/*.csv: 原料文件
    - batches/*.csv: 批次文件
    - rules/*.yaml: 规则文件
    """
    verbose = ctx.obj.get("VERBOSE", False)
    data_store = DataStore()
    
    try:
        if all:
            # 从默认目录结构导入所有数据
            formulas_dir = os.path.join(directory, "formulas")
            materials_dir = os.path.join(directory, "raw_materials")
            batches_dir = os.path.join(directory, "batches")
            rules_dir = os.path.join(directory, "rules")
            
            # 导入原料
            if os.path.isdir(materials_dir):
                for filename in os.listdir(materials_dir):
                    if filename.endswith(".csv"):
                        filepath = os.path.join(materials_dir, filename)
                        materials_list = data_store.load_raw_materials(filepath)
                        click.echo(f"✅ 导入原料: {filepath} ({len(materials_list)} 种原料)")
            
            # 导入配方
            if os.path.isdir(formulas_dir):
                for filename in os.listdir(formulas_dir):
                    if filename.endswith(".csv"):
                        filepath = os.path.join(formulas_dir, filename)
                        try:
                            formula_obj = data_store.load_formula(filepath)
                            click.echo(f"✅ 导入配方: {filepath} (配方: {formula_obj.name})")
                        except ParserError as e:
                            if verbose:
                                click.echo(f"⚠️  跳过配方文件 {filepath}: {e}")
            
            # 导入批次
            if os.path.isdir(batches_dir):
                for filename in os.listdir(batches_dir):
                    if filename.endswith(".csv"):
                        filepath = os.path.join(batches_dir, filename)
                        batches_list = data_store.load_batches(filepath)
                        click.echo(f"✅ 导入批次: {filepath} ({len(batches_list)} 个批次)")
            
            # 导入规则
            if os.path.isdir(rules_dir):
                for filename in os.listdir(rules_dir):
                    if filename.endswith(".yaml") or filename.endswith(".yml"):
                        filepath = os.path.join(rules_dir, filename)
                        rule_set = data_store.load_rule_set(filepath)
                        click.echo(f"✅ 导入规则: {filepath} (规则集: {rule_set.name})")
        
        else:
            # 单独导入指定文件
            if materials:
                materials_list = data_store.load_raw_materials(materials)
                click.echo(f"✅ 导入原料: {materials} ({len(materials_list)} 种原料)")
            
            if formula:
                formula_obj = data_store.load_formula(formula)
                click.echo(f"✅ 导入配方: {formula} (配方: {formula_obj.name})")
            
            if batches:
                batches_list = data_store.load_batches(batches)
                click.echo(f"✅ 导入批次: {batches} ({len(batches_list)} 个批次)")
            
            if rules:
                rule_set = data_store.load_rule_set(rules)
                click.echo(f"✅ 导入规则: {rules} (规则集: {rule_set.name})")
        
        # 数据校验
        valid, errors = data_store.validate_all()
        if not valid:
            click.echo("")
            click.echo("⚠️  数据校验发现问题:")
            for error in errors:
                click.echo(f"   - {error}")
        
        click.echo("")
        click.echo("📊 导入统计:")
        click.echo(f"   - 配方: {len(data_store.formulas)} 个")
        click.echo(f"   - 原料: {len(data_store.raw_materials)} 种")
        click.echo(f"   - 批次: {len(data_store.batches)} 个")
        click.echo(f"   - 规则集: {len(data_store.rule_sets)} 个")
        
    except ParserError as e:
        click.echo(f"❌ 导入失败: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)
    except Exception as e:
        click.echo(f"❌ 发生错误: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.option("--formula", "-f", required=True, help="配方 CSV 文件路径")
@click.option("--materials", "-m", help="原料 CSV 文件路径 (可选，默认从同目录查找)")
@click.option("--target", "-t", required=True, type=float, help="目标灌装量")
@click.option("--unit", "-u", default="g", help="目标单位 (默认: g)")
@click.option("--output", "-o", help="输出 JSON 文件路径")
@click.pass_context
def calc(ctx, formula, materials, target, unit, output):
    """
    按目标量换算用量、计算成本和乙醇/香精比例
    
    输入原始配方和目标灌装量，输出：
    - 每种原料的实际用量
    - 总成本估算
    - 乙醇和香精的比例分析
    """
    verbose = ctx.obj.get("VERBOSE", False)
    
    try:
        data_store = DataStore()
        
        # 加载原料数据
        if materials:
            data_store.load_raw_materials(materials)
        else:
            # 尝试从配方文件同目录查找原料文件
            formula_dir = os.path.dirname(formula) or "."
            materials_dir = os.path.join(os.path.dirname(formula_dir), "raw_materials")
            if os.path.isdir(materials_dir):
                for filename in os.listdir(materials_dir):
                    if filename.endswith(".csv"):
                        filepath = os.path.join(materials_dir, filename)
                        data_store.load_raw_materials(filepath)
        
        # 加载配方
        formula_obj = data_store.load_formula(formula)
        
        # 解析目标单位
        try:
            target_unit = Unit.from_string(unit)
        except ValueError:
            click.echo(f"❌ 无效的单位: {unit}")
            click.echo(f"   支持的单位: g, mg, kg, ml, l, drop")
            sys.exit(1)
        
        # 计算
        calculator = FormulaCalculator(data_store.raw_materials)
        result = calculator.calculate(formula_obj, target, target_unit)
        
        # 显示结果
        click.echo("")
        click.echo(f"📋 配方: {formula_obj.name} (ID: {formula_obj.id})")
        click.echo(f"🎯 目标灌装量: {target} {target_unit.value}")
        click.echo("")
        
        click.echo("📊 计算结果摘要:")
        click.echo(f"   - 总成本: ¥{result.total_cost:.2f}")
        click.echo(f"   - 乙醇含量: {result.ethanol_content:.2f}g ({result.ethanol_ratio*100:.1f}%)")
        click.echo(f"   - 香精含量: {result.fragrance_content:.2f}g ({result.fragrance_ratio*100:.1f}%)")
        click.echo("")
        
        click.echo("🧪 原料明细:")
        click.echo("   " + "-" * 80)
        click.echo(f"   {'原料':<20} {'原用量':<12} {'计算用量':<15} {'占比':<10} {'成本':<10}")
        click.echo("   " + "-" * 80)
        for ing in result.ingredient_details:
            cost_str = f"¥{ing.cost:.2f}" if ing.cost is not None else "-"
            click.echo(
                f"   {ing.raw_material_name:<20} "
                f"{ing.original_amount:.2f}{ing.original_unit.value:<8} "
                f"{ing.calculated_amount:.4f}g{'':<6} "
                f"{ing.percentage*100:.2f}%{'':<5} "
                f"{cost_str}"
            )
        
        # 过敏原摘要
        allergen_summary = calculator.get_allergen_summary(result)
        if allergen_summary:
            click.echo("")
            click.echo("🌿 过敏原摘要:")
            for allergen, percentage in allergen_summary.items():
                click.echo(f"   - {allergen}: {percentage*100:.2f}%")
        
        # 输出到文件
        if output:
            reporter = Reporter(formula=formula_obj, calculation_result=result)
            json_content = reporter.generate_json()
            with open(output, 'w', encoding='utf-8') as f:
                f.write(json_content)
            click.echo("")
            click.echo(f"💾 结果已保存到: {output}")
        
    except ParserError as e:
        click.echo(f"❌ 计算失败: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)
    except Exception as e:
        click.echo(f"❌ 发生错误: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.option("--formula", "-f", required=True, help="配方 CSV 文件路径")
@click.option("--materials", "-m", help="原料 CSV 文件路径")
@click.option("--batches", "-b", help="批次 CSV 文件路径")
@click.option("--rules", "-r", help="规则 YAML 文件路径")
@click.option("--target", "-t", type=float, help="目标灌装量 (默认: 配方原始量)")
@click.option("--unit", "-u", default="g", help="目标单位 (默认: g)")
@click.pass_context
def check(ctx, formula, materials, batches, rules, target, unit):
    """
    检查合规性：禁用物、阈值超限、库存不足、单位混用、批次追溯断点
    
    执行以下检查：
    1. 禁用物质检查
    2. IFRA 浓度限制检查
    3. 过敏原阈值检查
    4. 批次过期检查
    5. 库存充足检查
    6. 单位一致性检查
    """
    verbose = ctx.obj.get("VERBOSE", False)
    
    try:
        data_store = DataStore()
        
        # 加载数据
        if materials:
            data_store.load_raw_materials(materials)
        if batches:
            data_store.load_batches(batches)
        if rules:
            data_store.load_rule_set(rules)
        
        # 尝试从默认目录加载
        formula_dir = os.path.dirname(formula) or "."
        parent_dir = os.path.dirname(formula_dir)
        
        materials_dir = os.path.join(parent_dir, "raw_materials")
        if not materials and os.path.isdir(materials_dir):
            for filename in os.listdir(materials_dir):
                if filename.endswith(".csv"):
                    filepath = os.path.join(materials_dir, filename)
                    data_store.load_raw_materials(filepath)
        
        batches_dir = os.path.join(parent_dir, "batches")
        if not batches and os.path.isdir(batches_dir):
            for filename in os.listdir(batches_dir):
                if filename.endswith(".csv"):
                    filepath = os.path.join(batches_dir, filename)
                    data_store.load_batches(filepath)
        
        rules_dir = os.path.join(parent_dir, "rules")
        if not rules and os.path.isdir(rules_dir):
            for filename in os.listdir(rules_dir):
                if filename.endswith(".yaml") or filename.endswith(".yml"):
                    filepath = os.path.join(rules_dir, filename)
                    data_store.load_rule_set(filepath)
        
        # 加载配方
        formula_obj = data_store.load_formula(formula)
        
        # 计算
        calculator = FormulaCalculator(data_store.raw_materials)
        
        if target is None:
            target = formula_obj.total_amount
            target_unit = formula_obj.unit
        else:
            target_unit = Unit.from_string(unit)
        
        calc_result = calculator.calculate(formula_obj, target, target_unit)
        
        # 检查
        if data_store.rule_sets:
            rule_set = list(data_store.rule_sets.values())[0]
        else:
            # 使用默认空规则集
            from .models import RuleSet
            rule_set = RuleSet(name="Default", version="1.0")
        
        rule_engine = RuleEngine(rule_set, data_store.raw_materials)
        check_result = rule_engine.check(
            calc_result,
            data_store.batches if data_store.batches else None
        )
        
        # 显示结果
        click.echo("")
        click.echo(f"📋 合规性检查: {formula_obj.name}")
        click.echo(f"🎯 灌装量: {target} {target_unit.value}")
        click.echo("")
        
        if check_result.passed:
            click.echo("✅ 检查通过！")
        else:
            click.echo("❌ 检查未通过！")
        click.echo("")
        
        # 显示错误
        if check_result.errors:
            click.echo("🚨 错误:")
            for i, error in enumerate(check_result.errors, 1):
                click.echo(f"   {i}. [{error.code}] {error.message}")
                if verbose and error.context:
                    click.echo(f"      上下文: {error.context}")
            click.echo("")
        
        # 显示警告
        if check_result.warnings:
            click.echo("⚠️  警告:")
            for i, warning in enumerate(check_result.warnings, 1):
                click.echo(f"   {i}. [{warning.code}] {warning.message}")
                if verbose and warning.context:
                    click.echo(f"      上下文: {warning.context}")
            click.echo("")
        
        # 统计
        click.echo(f"📊 统计: 错误 {len(check_result.errors)} 个, 警告 {len(check_result.warnings)} 个")
        
        if not check_result.passed:
            sys.exit(1)
        
    except ParserError as e:
        click.echo(f"❌ 检查失败: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)
    except Exception as e:
        click.echo(f"❌ 发生错误: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.option("--formula", "-f", required=True, help="配方 CSV 文件路径")
@click.option("--materials", "-m", help="原料 CSV 文件路径")
@click.option("--batches", "-b", help="批次 CSV 文件路径")
@click.option("--rules", "-r", help="规则 YAML 文件路径")
@click.option("--target", "-t", type=float, help="目标灌装量 (默认: 配方原始量)")
@click.option("--unit", "-u", default="g", help="目标单位 (默认: g)")
@click.option("--output", "-o", required=True, help="输出目录路径")
@click.option("--format", "-fmt", default="all", 
              type=click.Choice(["all", "markdown", "csv", "json"]),
              help="输出格式 (默认: all)")
@click.pass_context
def report(ctx, formula, materials, batches, rules, target, unit, output, format):
    """
    导出合规报告：Markdown、CSV、JSON 格式
    
    生成完整的合规性报告，包含：
    - 配方基本信息
    - 用量计算结果
    - 成本分析
    - 合规性检查结果
    - 标签建议
    """
    verbose = ctx.obj.get("VERBOSE", False)
    
    try:
        data_store = DataStore()
        
        # 加载数据
        if materials:
            data_store.load_raw_materials(materials)
        if batches:
            data_store.load_batches(batches)
        if rules:
            data_store.load_rule_set(rules)
        
        # 尝试从默认目录加载
        formula_dir = os.path.dirname(formula) or "."
        parent_dir = os.path.dirname(formula_dir)
        
        materials_dir = os.path.join(parent_dir, "raw_materials")
        if not materials and os.path.isdir(materials_dir):
            for filename in os.listdir(materials_dir):
                if filename.endswith(".csv"):
                    filepath = os.path.join(materials_dir, filename)
                    data_store.load_raw_materials(filepath)
        
        batches_dir = os.path.join(parent_dir, "batches")
        if not batches and os.path.isdir(batches_dir):
            for filename in os.listdir(batches_dir):
                if filename.endswith(".csv"):
                    filepath = os.path.join(batches_dir, filename)
                    data_store.load_batches(filepath)
        
        rules_dir = os.path.join(parent_dir, "rules")
        if not rules and os.path.isdir(rules_dir):
            for filename in os.listdir(rules_dir):
                if filename.endswith(".yaml") or filename.endswith(".yml"):
                    filepath = os.path.join(rules_dir, filename)
                    data_store.load_rule_set(filepath)
        
        # 加载配方
        formula_obj = data_store.load_formula(formula)
        
        # 计算
        calculator = FormulaCalculator(data_store.raw_materials)
        
        if target is None:
            target = formula_obj.total_amount
            target_unit = formula_obj.unit
        else:
            target_unit = Unit.from_string(unit)
        
        calc_result = calculator.calculate(formula_obj, target, target_unit)
        
        # 检查
        if data_store.rule_sets:
            rule_set = list(data_store.rule_sets.values())[0]
        else:
            from .models import RuleSet
            rule_set = RuleSet(name="Default", version="1.0")
        
        rule_engine = RuleEngine(rule_set, data_store.raw_materials)
        check_result = rule_engine.check(
            calc_result,
            data_store.batches if data_store.batches else None
        )
        
        # 生成报告
        reporter = Reporter(
            formula=formula_obj,
            calculation_result=calc_result,
            check_result=check_result,
        )
        
        os.makedirs(output, exist_ok=True)
        
        generated_files = []
        
        if format in ["all", "markdown"]:
            md_content = reporter.generate_markdown()
            md_path = os.path.join(output, "report.md")
            with open(md_path, 'w', encoding='utf-8') as f:
                f.write(md_content)
            generated_files.append(md_path)
        
        if format in ["all", "csv"]:
            csv_files = reporter.generate_csv(output)
            generated_files.extend(csv_files)
        
        if format in ["all", "json"]:
            json_content = reporter.generate_json()
            json_path = os.path.join(output, "report.json")
            with open(json_path, 'w', encoding='utf-8') as f:
                f.write(json_content)
            generated_files.append(json_path)
        
        # 显示结果
        click.echo("")
        click.echo(f"📄 报告已生成: {output}")
        click.echo("")
        click.echo("生成的文件:")
        for filepath in generated_files:
            click.echo(f"   - {filepath}")
        click.echo("")
        
        # 显示检查结果摘要
        if check_result.passed:
            click.echo("✅ 合规性检查通过")
        else:
            click.echo("❌ 合规性检查未通过")
        click.echo(f"   错误: {len(check_result.errors)} 个")
        click.echo(f"   警告: {len(check_result.warnings)} 个")
        
    except ParserError as e:
        click.echo(f"❌ 报告生成失败: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)
    except Exception as e:
        click.echo(f"❌ 发生错误: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    cli()
