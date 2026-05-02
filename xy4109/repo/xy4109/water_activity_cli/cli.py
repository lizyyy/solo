import json
import sys
from pathlib import Path
from typing import Optional

import click

from water_activity_cli.calculator import WaterActivityCalculator
from water_activity_cli.models import ExportPackage
from water_activity_cli.parser import load_ingredient_library, load_recipe
from water_activity_cli.reporter import ReportExporter
from water_activity_cli.validator import RecipeValidator
from water_activity_cli.version import __version__


TEMPLATE_INGREDIENTS = """# 水分活度配方校算器 - 原料库模板
# 在此定义您的常用原料及其水分特性
# moisture_content_wet: 湿基含水率（0-1之间的小数，或百分比如 12%）
# aw: 该原料在该含水率下的水分活度（可选，用于估算混合aw）
# sorption_isotherm: 水分吸附等温线（可选，格式: aw值: 干基含水率）

ingredients:
  - name: 高筋面粉
    moisture_content_wet: 0.12
    aw: 0.55
    notes: 市售面包粉，蛋白质含量11-13%

  - name: 低筋面粉
    moisture_content_wet: 0.115
    aw: 0.53
    notes: 蛋糕/饼干用粉

  - name: 白砂糖
    moisture_content_wet: 0.005
    aw: 0.10
    notes: 精制蔗糖，含水量极低

  - name: 黄糖/红糖
    moisture_content_wet: 0.025
    aw: 0.30
    notes: 含少量糖蜜和水分

  - name: 无盐黄油
    moisture_content_wet: 0.16
    aw: 0.90
    notes: 典型黄油水分约16%

  - name: 全脂奶粉
    moisture_content_wet: 0.03
    aw: 0.25
    notes: 喷雾干燥产品

  - name: 鸡蛋（带壳）
    moisture_content_wet: 0.75
    aw: 0.98
    notes: 鲜鸡蛋，水分含量约75%

  - name: 鸡蛋（全蛋液）
    moisture_content_wet: 0.76
    aw: 0.98
    notes: 去壳全蛋液

  - name: 食盐
    moisture_content_wet: 0.001
    aw: 0.10
    notes: 纯氯化钠几乎无水分

  - name: 水
    moisture_content_wet: 1.0
    aw: 1.00
    notes: 纯水

  - name: 牛奶（全脂）
    moisture_content_wet: 0.875
    aw: 0.99
    notes: 鲜牛奶

  - name: 蜂蜜
    moisture_content_wet: 0.17
    aw: 0.60
    notes: 典型蜂蜜，水分17%左右

  - name: 酵母（干）
    moisture_content_wet: 0.06
    aw: 0.35
    notes: 活性干酵母

  - name: 可可粉
    moisture_content_wet: 0.03
    aw: 0.25
    notes: 天然可可粉

  - name: 巧克力（黑）
    moisture_content_wet: 0.01
    aw: 0.30
    notes: 黑巧克力含水量低
"""


TEMPLATE_RECIPE = """# 水分活度配方校算器 - 配方模板
# 使用此模板创建您的产品配方

name: 经典黄油曲奇
version: "1.0"
batch_size: 1.0
batch_unit: kg  # kg | g | mg
notes: 实验室小试配方

# 目标水分活度设置
target:
  target_aw: 0.65        # 目标水分活度
  safety_margin_aw: 0.02  # 安全余量(+/-)
  # min_aw: 0.60          # 最低允许aw（可选）
  # max_aw: 0.70          # 最高允许aw（可选）

# 烘烤工艺设置
baking_profile:
  loss_percentage: 0.08   # 烘烤损耗率（8% = 0.08，或 8%）
  loss_is_water_only: true # 损耗是否全部为水分
  notes: 170℃/12分钟

# 原料列表
# unit: g | kg | mg | %（百分比基于总配方）
# moisture_override: 覆盖原料库中的含水率（可选）
# aw_override: 覆盖原料库中的aw（可选）
ingredients:
  - name: 低筋面粉
    amount: 250
    unit: g

  - name: 无盐黄油
    amount: 180
    unit: g

  - name: 白砂糖
    amount: 120
    unit: g

  - name: 鸡蛋（全蛋液）
    amount: 50
    unit: g

  - name: 食盐
    amount: 2
    unit: g
"""


@click.group()
@click.version_option(__version__, "-v", "--version", prog_name="wacalc")
def main():
    """
    水分活度配方校算器 - 为小型食品实验室设计的本地配方计算工具
    
    用于新品打样时的水分活度计算、烘烤损耗分析和配方校验。
    
    基本流程:
      1. wacalc init         # 初始化项目，生成原料库和配方模板
      2. 编辑 ingredients.yaml 和 recipe.yaml
      3. wacalc check        # 检查配方问题
      4. wacalc calc         # 执行计算
      5. wacalc report       # 导出审计报告
    """
    pass


@main.command()
@click.option(
    "-o", "--output",
    type=click.Path(file_okay=False, writable=True),
    default=".",
    help="输出目录（默认为当前目录）",
)
@click.option(
    "-f", "--force",
    is_flag=True,
    help="覆盖已存在的文件",
)
def init(output, force):
    """
    初始化项目 - 生成原料库模板和配方模板
    
    在指定目录创建:
      - ingredients.yaml: 原料库模板（含常见烘焙原料数据）
      - recipe.yaml: 配方模板（经典黄油曲奇示例）
    
    示例:
      wacalc init
      wacalc init -o ./my_project
    """
    output_path = Path(output)
    output_path.mkdir(parents=True, exist_ok=True)
    
    ingredients_file = output_path / "ingredients.yaml"
    recipe_file = output_path / "recipe.yaml"
    
    created = []
    skipped = []
    
    if ingredients_file.exists() and not force:
        skipped.append(str(ingredients_file))
    else:
        ingredients_file.write_text(TEMPLATE_INGREDIENTS, encoding="utf-8")
        created.append(str(ingredients_file))
    
    if recipe_file.exists() and not force:
        skipped.append(str(recipe_file))
    else:
        recipe_file.write_text(TEMPLATE_RECIPE, encoding="utf-8")
        created.append(str(recipe_file))
    
    if created:
        click.echo("✓ 已创建文件:")
        for f in created:
            click.echo(f"  - {f}")
    
    if skipped:
        click.echo("⚠ 已跳过（已存在，使用 -f 覆盖）:")
        for f in skipped:
            click.echo(f"  - {f}")
    
    if created:
        click.echo("")
        click.echo("下一步:")
        click.echo("  1. 编辑 ingredients.yaml 添加您的原料数据")
        click.echo("  2. 编辑 recipe.yaml 定义您的配方")
        click.echo("  3. 运行 'wacalc check' 检查配方")


@main.command()
@click.argument("recipe", type=click.Path(exists=True, dir_okay=False))
@click.option(
    "-i", "--ingredients",
    type=click.Path(exists=True, dir_okay=False),
    default="ingredients.yaml",
    help="原料库文件（默认: ingredients.yaml）",
)
@click.option(
    "--json", "output_json",
    is_flag=True,
    help="以JSON格式输出",
)
def check(recipe, ingredients, output_json):
    """
    检查配方 - 校验单位混用、数据缺失、目标可达性等问题
    
    校验规则:
      - 单位混用检测 (g/kg/mg混合使用)
      - 原料数据缺失 (原料不在库中且未指定含水率)
      - 目标可达性 (aw目标是否在合理范围)
      - 批次缩放问题 (批量过大/过小)
      - 含水率一致性 (干基/湿基数值矛盾)
    
    示例:
      wacalc check recipe.yaml
      wacalc check recipe.yaml -i my_ingredients.yaml
    """
    try:
        ingredient_library = load_ingredient_library(ingredients)
        click.echo(f"✓ 已加载原料库: {ingredients} ({len(ingredient_library)} 种原料)")
    except Exception as e:
        click.echo(f"✗ 加载原料库失败: {e}", err=True)
        sys.exit(1)
    
    try:
        recipe_obj = load_recipe(recipe)
        click.echo(f"✓ 已加载配方: {recipe_obj.name}")
    except Exception as e:
        click.echo(f"✗ 加载配方失败: {e}", err=True)
        sys.exit(1)
    
    validator = RecipeValidator(ingredient_library)
    validation_report = validator.validate(recipe_obj)
    
    if output_json:
        result_dict = {
            "valid": validation_report.valid,
            "summary": validation_report.summary,
            "issues": [
                {
                    "level": i.level,
                    "category": i.category,
                    "message": i.message,
                    "location": i.location,
                    "suggestion": i.suggestion,
                }
                for i in validation_report.issues
            ],
        }
        click.echo(json.dumps(result_dict, indent=2, ensure_ascii=False))
    else:
        click.echo("")
        click.echo("=" * 60)
        click.echo(f"校验结果: {'✅ 通过' if validation_report.valid else '❌ 发现错误'}")
        click.echo(f"总计: {validation_report.summary['total']} 个问题")
        click.echo(f"  错误: {validation_report.summary['errors']} 个")
        click.echo(f"  警告: {validation_report.summary['warnings']} 个")
        click.echo("=" * 60)
        
        if validation_report.issues:
            click.echo("")
            for issue in validation_report.issues:
                icon = "❌" if issue.level == "error" else "⚠️"
                click.echo(f"{icon} [{issue.level.upper()}] {issue.category}")
                click.echo(f"   {issue.message}")
                if issue.location:
                    click.echo(f"   位置: {issue.location}")
                if issue.suggestion:
                    click.echo(f"   建议: {issue.suggestion}")
                click.echo("")
    
    sys.exit(0 if validation_report.valid else 1)


@main.command()
@click.argument("recipe", type=click.Path(exists=True, dir_okay=False))
@click.option(
    "-i", "--ingredients",
    type=click.Path(exists=True, dir_okay=False),
    default="ingredients.yaml",
    help="原料库文件（默认: ingredients.yaml）",
)
@click.option(
    "--json", "output_json",
    is_flag=True,
    help="以JSON格式输出",
)
@click.option(
    "--no-validate",
    is_flag=True,
    help="跳过校验直接计算",
)
def calc(recipe, ingredients, output_json, no_validate):
    """
    执行计算 - 干基/湿基换算、烘烤损耗、补水量推算
    
    计算内容:
      1. 初始状态分析: 总投料、干固物、水分、初始aw估算
      2. 烘烤损耗分析: 水分损失、干物质损失、烘烤后状态
      3. 目标推算: 基于GAB模型从aw推算目标含水率
      4. 调整建议: 需要补水/排水的量
      5. 最终预测: 成品重量、最终含水率、最终aw
    
    示例:
      wacalc calc recipe.yaml
      wacalc calc recipe.yaml -i my_ingredients.yaml --json
    """
    try:
        ingredient_library = load_ingredient_library(ingredients)
    except Exception as e:
        click.echo(f"✗ 加载原料库失败: {e}", err=True)
        sys.exit(1)
    
    try:
        recipe_obj = load_recipe(recipe)
    except Exception as e:
        click.echo(f"✗ 加载配方失败: {e}", err=True)
        sys.exit(1)
    
    if not no_validate:
        validator = RecipeValidator(ingredient_library)
        validation_report = validator.validate(recipe_obj)
        if not validation_report.valid:
            click.echo("✗ 校验失败，请先运行 'wacalc check' 修复问题", err=True)
            click.echo("  或使用 --no-validate 跳过校验", err=True)
            sys.exit(1)
    
    calculator = WaterActivityCalculator(ingredient_library)
    result = calculator.calculate(recipe_obj)
    
    if output_json:
        from water_activity_cli.reporter import JSONReporter
        json_data = JSONReporter.generate(result)
        click.echo(json.dumps(json_data, indent=2, ensure_ascii=False))
    else:
        click.echo("=" * 60)
        click.echo(f"配方: {result.recipe_name}")
        click.echo(f"计算时间: {result.timestamp}")
        click.echo("=" * 60)
        
        click.echo("")
        click.echo("【一、输入概览】")
        click.echo(f"  总投料量: {float(result.total_input_weight):.2f} {result.total_input_weight_unit.value}")
        click.echo(f"  总干固物: {float(result.total_dry_solids):.2f} g")
        click.echo(f"  总水分: {float(result.total_water_input):.2f} g")
        click.echo(f"  初始含水率: {float(result.initial_moisture_wet_basis)*100:.2f}% (湿基)")
        click.echo(f"               {float(result.initial_moisture_dry_basis)*100:.2f}% (干基)")
        if result.initial_aw_estimate:
            click.echo(f"  估算初始aw: {float(result.initial_aw_estimate):.4f}")
        
        click.echo("")
        click.echo("【二、烘烤损耗】")
        click.echo(f"  总损耗: {float(result.baking_loss_amount):.2f} g")
        click.echo(f"  - 水分损耗: {float(result.baking_water_loss):.2f} g")
        click.echo(f"  - 干物质损耗: {float(result.baking_solids_loss):.2f} g")
        click.echo("")
        click.echo(f"  烘烤后剩余水分: {float(result.water_after_baking):.2f} g")
        click.echo(f"  烘烤后总重: {float(result.total_after_baking):.2f} g")
        click.echo(f"  烘烤后含水率: {float(result.moisture_after_baking_wet)*100:.2f}% (湿基)")
        
        click.echo("")
        click.echo("【三、目标参数】")
        click.echo(f"  目标aw: {float(result.final_aw):.4f}")
        click.echo(f"  目标含水率: {float(result.target_moisture_wet_basis)*100:.2f}% (湿基)")
        click.echo(f"               {float(result.target_moisture_dry_basis)*100:.2f}% (干基)")
        
        click.echo("")
        click.echo("【四、调整建议】")
        if result.adjustment_direction == "add":
            click.echo(f"  💧 需要补水: {float(result.water_adjustment_needed):.2f} g")
        elif result.adjustment_direction == "remove":
            click.echo(f"  🔥 需要额外去除水分: {float(result.water_adjustment_needed):.2f} g")
            click.echo(f"     (建议: 延长烘烤时间或提高温度)")
        else:
            click.echo(f"  ✅ 无需调整")
        
        click.echo("")
        click.echo("【五、最终预测】")
        click.echo(f"  预期成品重量: {float(result.final_expected_weight):.2f} g")
        click.echo(f"  预期含水率: {float(result.final_moisture_wet)*100:.2f}% (湿基)")
        click.echo(f"  预期最终aw: {float(result.final_aw):.4f}")
        
        if result.warnings:
            click.echo("")
            click.echo("【警告】")
            for warning in result.warnings:
                click.echo(f"  ⚠️ {warning}")
        
        click.echo("")
        click.echo("提示: 使用 'wacalc report' 导出完整审计报告")


@main.command()
@click.argument("recipe", type=click.Path(exists=True, dir_okay=False))
@click.option(
    "-i", "--ingredients",
    type=click.Path(exists=True, dir_okay=False),
    default="ingredients.yaml",
    help="原料库文件（默认: ingredients.yaml）",
)
@click.option(
    "-o", "--output",
    type=click.Path(file_okay=False, writable=True),
    default=".",
    help="输出目录（默认: 当前目录）",
)
@click.option(
    "-n", "--name",
    default="calculation_report",
    help="报告文件名（不含扩展名，默认: calculation_report）",
)
def report(recipe, ingredients, output, name):
    """
    导出报告 - 生成Markdown、CSV和JSON格式的审计包
    
    导出内容:
      - {name}.md: 格式化的Markdown报告，适合阅读/打印
      - {name}.csv: CSV格式，适合导入Excel
      - {name}.json: JSON格式，适合程序处理
    
    示例:
      wacalc report recipe.yaml
      wacalc report recipe.yaml -o ./reports -n cookie_recipe_v1
    """
    try:
        ingredient_library = load_ingredient_library(ingredients)
    except Exception as e:
        click.echo(f"✗ 加载原料库失败: {e}", err=True)
        sys.exit(1)
    
    try:
        recipe_obj = load_recipe(recipe)
    except Exception as e:
        click.echo(f"✗ 加载配方失败: {e}", err=True)
        sys.exit(1)
    
    validator = RecipeValidator(ingredient_library)
    validation_report = validator.validate(recipe_obj)
    
    calculator = WaterActivityCalculator(ingredient_library)
    result = calculator.calculate(recipe_obj)
    
    package = ReportExporter.export_package(result, validation_report)
    
    output_path = Path(output)
    written_files = ReportExporter.write_to_files(package, output_path, name)
    
    click.echo("✓ 报告已导出:")
    for f in written_files:
        click.echo(f"  - {f}")
    
    click.echo("")
    click.echo(f"包含内容:")
    click.echo(f"  📄 Markdown: 完整计算报告，含表格和分析")
    click.echo(f"  📊 CSV: 参数数据，可导入Excel进一步分析")
    click.echo(f"  📋 JSON: 结构化数据，适合程序处理")


if __name__ == "__main__":
    main()
