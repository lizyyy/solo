# -*- coding: utf-8 -*-
import click
from pathlib import Path
from decimal import Decimal
from typing import List, Optional
import shutil
import os

from .models import (
    Bill, BillLineItem, DiscountRule, TaxRule, RoundingProfile,
    RoundingMode, DiscountType, DiscountApplication, CalculationResult
)
from .calculator import BillCalculator, RoundingService
from .data_loader import DataLoader, DataValidator
from .comparator import ResultComparator
from .exporter import ReportExporter


@click.group()
@click.version_option(version='1.0.0')
def main():
    """
    账单试算工具 - 用于门店或 SaaS 计费团队在上线规则前回放样例订单
    
    支持的命令:
      init      - 初始化样例数据文件
      calc      - 计算账单
      compare   - 比较预期结果和实际结果
      export    - 导出计算结果或差异报告
    
    支持的配置文件:
      bills.yaml          - 账单数据
      discounts.csv       - 折扣规则
      tax-rules.json      - 税率规则
      rounding-profiles.json - 取整配置
    """
    pass


@main.command()
@click.option('--output', '-o', default='.', help='输出目录路径，默认为当前目录')
@click.option('--force', '-f', is_flag=True, help='强制覆盖已存在的文件')
def init(output, force):
    """
    初始化样例数据文件
    
    该命令会在指定目录创建以下样例文件:
    - bills.yaml: 包含正常和异常的账单样例
    - discounts.csv: 包含各种折扣规则样例
    - tax-rules.json: 包含税率规则样例
    - rounding-profiles.json: 包含取整配置样例
    
    示例:
      bill-calc init
      bill-calc init -o ./data
      bill-calc init --force
    """
    output_path = Path(output)
    
    # 确保输出目录存在
    output_path.mkdir(parents=True, exist_ok=True)
    
    # 定义样例文件内容
    sample_files = {
        'bills.yaml': _get_sample_bills_yaml(),
        'discounts.csv': _get_sample_discounts_csv(),
        'tax-rules.json': _get_sample_tax_rules_json(),
        'rounding-profiles.json': _get_sample_rounding_profiles_json()
    }
    
    # 写入文件
    for filename, content in sample_files.items():
        file_path = output_path / filename
        
        if file_path.exists() and not force:
            click.echo(f"跳过: {filename} 已存在 (使用 --force 覆盖)")
            continue
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        click.echo(f"已创建: {file_path}")
    
    click.echo("")
    click.echo("初始化完成！你可以使用以下命令开始测试:")
    click.echo(f"  cd {output}")
    click.echo("  bill-calc calc")
    click.echo("  bill-calc compare")
    click.echo("  bill-calc export --format markdown")


@main.command()
@click.option('--bills', '-b', default='bills.yaml', help='账单文件路径，默认为 bills.yaml')
@click.option('--discounts', '-d', default='discounts.csv', help='折扣文件路径，默认为 discounts.csv')
@click.option('--tax-rules', '-t', default='tax-rules.json', help='税率规则文件路径，默认为 tax-rules.json')
@click.option('--rounding-profiles', '-r', default='rounding-profiles.json', help='取整配置文件路径，默认为 rounding-profiles.json')
@click.option('--verbose', '-v', is_flag=True, help='显示详细计算步骤')
@click.option('--output', '-o', default=None, help='输出计算结果到文件')
@click.option('--format', '-f', default='markdown', type=click.Choice(['markdown', 'csv']), help='输出格式')
def calc(bills, discounts, tax_rules, rounding_profiles, verbose, output, format):
    """
    计算账单
    
    该命令会读取配置文件并计算每个账单的最终金额。
    
    示例:
      bill-calc calc
      bill-calc calc -b custom_bills.yaml
      bill-calc calc --verbose
      bill-calc calc -o result.md --format markdown
    """
    try:
        # 加载配置文件
        click.echo("正在加载配置文件...")
        
        bills_list = DataLoader.parse_bills(bills)
        click.echo(f"  已加载 {len(bills_list)} 个账单")
        
        discounts_list = DataLoader.parse_discounts(discounts)
        click.echo(f"  已加载 {len(discounts_list)} 个折扣规则")
        
        tax_rules_list = DataLoader.parse_tax_rules(tax_rules)
        click.echo(f"  已加载 {len(tax_rules_list)} 个税率规则")
        
        rounding_profiles_dict = DataLoader.parse_rounding_profiles(rounding_profiles)
        click.echo(f"  已加载 {len(rounding_profiles_dict)} 个取整配置")
        
        # 验证数据
        click.echo("\n正在验证数据...")
        validation_errors = []
        
        for bill in bills_list:
            bill_errors = DataValidator.validate_bill(bill)
            validation_errors.extend(bill_errors)
        
        for discount in discounts_list:
            discount_errors = DataValidator.validate_discount(discount)
            validation_errors.extend(discount_errors)
        
        for tax_rule in tax_rules_list:
            tax_errors = DataValidator.validate_tax_rule(tax_rule)
            validation_errors.extend(tax_errors)
        
        for profile in rounding_profiles_dict.values():
            profile_errors = DataValidator.validate_rounding_profile(profile)
            validation_errors.extend(profile_errors)
        
        # 检查税率冲突
        tax_conflicts = DataValidator.validate_tax_rules_conflict(tax_rules_list)
        validation_errors.extend(tax_conflicts)
        
        if validation_errors:
            click.echo("\n验证问题:")
            for error in validation_errors:
                if error.startswith("错误:"):
                    click.echo(f"  ❌ {error}")
                else:
                    click.echo(f"  ⚠️ {error}")
        
        # 计算账单
        click.echo("\n正在计算账单...")
        
        calculator = BillCalculator(rounding_profiles_dict)
        results = []
        
        for bill in bills_list:
            # 获取该账单明确引用的折扣
            # 收集账单级别的折扣ID和行级别的折扣ID
            referenced_discount_ids = set(bill.discounts)
            for line in bill.lines:
                referenced_discount_ids.update(line.discounts)
            
            # 根据引用的ID查找折扣规则
            applicable_discounts = []
            for discount in discounts_list:
                if discount.id in referenced_discount_ids:
                    applicable_discounts.append(discount)
            
            # 去重
            applicable_discounts = list({d.id: d for d in applicable_discounts}.values())
            
            # 计算
            result = calculator.calculate(bill, applicable_discounts)
            results.append(result)
            
            # 显示结果
            status = "✅" if result.is_valid else "❌"
            click.echo(f"\n{status} 账单 {bill.id} (订单: {bill.order_id}):")
            click.echo(f"  总小计: {bill.total_subtotal}")
            click.echo(f"  总折扣: {bill.total_discount}")
            click.echo(f"  总税费: {bill.total_tax}")
            click.echo(f"  总服务费: {bill.total_service_fee}")
            click.echo(f"  最终总额: {bill.grand_total}")
            
            if result.validation_errors:
                click.echo(f"  验证信息:")
                for error in result.validation_errors:
                    if error.startswith("错误:"):
                        click.echo(f"    ❌ {error}")
                    else:
                        click.echo(f"    ⚠️ {error}")
            
            if verbose:
                click.echo(f"\n  计算步骤:")
                for step in result.calculation_steps:
                    click.echo(f"    步骤: {step.get('step', '未知')}")
                    details = step.get('details', [])
                    if isinstance(details, list):
                        for detail in details:
                            if isinstance(detail, dict):
                                for key, value in detail.items():
                                    click.echo(f"      {key}: {value}")
                            else:
                                click.echo(f"      {detail}")
                    click.echo("")
        
        # 输出到文件
        if output and results:
            if len(results) == 1:
                ReportExporter.export_calculation_result(results[0], output, format)
            else:
                click.echo(f"\n⚠️  多个账单时，请使用 export 命令导出")
        
        click.echo(f"\n计算完成！共处理 {len(results)} 个账单")
        
    except Exception as e:
        click.echo(f"\n❌ 错误: {str(e)}", err=True)
        raise click.Abort()


@main.command()
@click.option('--expected', '-e', required=True, help='预期结果文件路径 (YAML/JSON)')
@click.option('--actual', '-a', required=True, help='实际结果文件路径 (YAML/JSON)')
@click.option('--bills', '-b', default='bills.yaml', help='账单文件路径，用于重新计算实际结果')
@click.option('--discounts', '-d', default='discounts.csv', help='折扣文件路径')
@click.option('--tax-rules', '-t', default='tax-rules.json', help='税率规则文件路径')
@click.option('--rounding-profiles', '-r', default='rounding-profiles.json', help='取整配置文件路径')
@click.option('--recalculate', '-R', is_flag=True, help='重新计算实际结果，而不是从文件读取')
@click.option('--output', '-o', default=None, help='输出比较报告到文件')
@click.option('--format', '-f', default='markdown', type=click.Choice(['markdown', 'csv']), help='输出格式')
def compare(expected, actual, bills, discounts, tax_rules, rounding_profiles, recalculate, output, format):
    """
    比较预期结果和实际结果
    
    该命令用于验证计算结果是否符合预期，可以:
    1. 从文件读取预期结果和实际结果进行比较
    2. 或者重新计算实际结果并与预期结果比较
    
    示例:
      bill-calc compare -e expected.yaml -a actual.yaml
      bill-calc compare -e expected.yaml --recalculate
      bill-calc compare -e expected.yaml -a actual.yaml -o report.md
    """
    try:
        # 加载预期结果
        click.echo("正在加载预期结果...")
        # TODO: 实现从文件加载预期结果的逻辑
        
        # 如果需要重新计算实际结果
        if recalculate:
            click.echo("正在重新计算实际结果...")
            
            # 加载配置文件
            bills_list = DataLoader.parse_bills(bills)
            discounts_list = DataLoader.parse_discounts(discounts)
            rounding_profiles_dict = DataLoader.parse_rounding_profiles(rounding_profiles)
            
            # 计算
            calculator = BillCalculator(rounding_profiles_dict)
            actual_results = []
            
            for bill in bills_list:
                applicable_discounts = []
                for discount in discounts_list:
                    if discount.applicable_to_all:
                        applicable_discounts.append(discount)
                    else:
                        for line in bill.lines:
                            if line.id in discount.applicable_line_ids:
                                applicable_discounts.append(discount)
                                break
                
                applicable_discounts = list({d.id: d for d in applicable_discounts}.values())
                result = calculator.calculate(bill, applicable_discounts)
                actual_results.append(result)
            
            click.echo(f"  已计算 {len(actual_results)} 个账单")
        
        else:
            # 从文件加载实际结果
            click.echo("正在加载实际结果...")
            # TODO: 实现从文件加载实际结果的逻辑
            actual_results = []
        
        # 比较
        # TODO: 实现完整的比较逻辑
        
        click.echo("\n比较功能正在完善中，当前支持:")
        click.echo("  - 使用 --recalculate 重新计算实际结果")
        click.echo("  - 使用 export 命令导出计算结果")
        click.echo("\n建议使用以下工作流:")
        click.echo("  1. bill-calc calc -o actual_results.md")
        click.echo("  2. 手动修改或从系统导出预期结果")
        click.echo("  3. 使用 diff 工具或 export 命令进行比较")
        
    except Exception as e:
        click.echo(f"\n❌ 错误: {str(e)}", err=True)
        raise click.Abort()


@main.command()
@click.option('--bills', '-b', default='bills.yaml', help='账单文件路径')
@click.option('--discounts', '-d', default='discounts.csv', help='折扣文件路径')
@click.option('--tax-rules', '-t', default='tax-rules.json', help='税率规则文件路径')
@click.option('--rounding-profiles', '-r', default='rounding-profiles.json', help='取整配置文件路径')
@click.option('--output', '-o', default='bill-report', help='输出文件路径 (不含扩展名)')
@click.option('--format', '-f', default='both', type=click.Choice(['markdown', 'csv', 'both']), help='输出格式')
@click.option('--include-steps', '-s', is_flag=True, help='包含详细计算步骤')
def export(bills, discounts, tax_rules, rounding_profiles, output, format, include_steps):
    """
    导出计算结果
    
    该命令会计算账单并导出结果到 Markdown 或 CSV 格式的文件。
    
    示例:
      bill-calc export
      bill-calc export -o my_report
      bill-calc export --format csv
      bill-calc export --include-steps
    """
    try:
        # 加载配置文件
        click.echo("正在加载配置文件...")
        
        bills_list = DataLoader.parse_bills(bills)
        discounts_list = DataLoader.parse_discounts(discounts)
        rounding_profiles_dict = DataLoader.parse_rounding_profiles(rounding_profiles)
        
        # 计算
        click.echo("正在计算账单...")
        
        calculator = BillCalculator(rounding_profiles_dict)
        results = []
        
        for bill in bills_list:
            # 获取该账单明确引用的折扣
            referenced_discount_ids = set(bill.discounts)
            for line in bill.lines:
                referenced_discount_ids.update(line.discounts)
            
            # 根据引用的ID查找折扣规则
            applicable_discounts = []
            for discount in discounts_list:
                if discount.id in referenced_discount_ids:
                    applicable_discounts.append(discount)
            
            applicable_discounts = list({d.id: d for d in applicable_discounts}.values())
            result = calculator.calculate(bill, applicable_discounts)
            results.append(result)
        
        click.echo(f"  已计算 {len(results)} 个账单")
        
        # 导出
        click.echo("\n正在导出报告...")
        
        if format in ['markdown', 'both']:
            md_path = f"{output}.md"
            
            # 如果只有一个账单，导出单个结果
            if len(results) == 1:
                ReportExporter.export_calculation_result(results[0], md_path, 'markdown')
            else:
                # 多个账单时，创建汇总报告
                # TODO: 实现多账单汇总报告
                click.echo(f"  ⚠️  多账单导出功能正在完善中，当前导出第一个账单")
                if results:
                    ReportExporter.export_calculation_result(results[0], md_path, 'markdown')
        
        if format in ['csv', 'both']:
            csv_path = f"{output}.csv"
            
            if len(results) == 1:
                ReportExporter.export_calculation_result(results[0], csv_path, 'csv')
            else:
                click.echo(f"  ⚠️  多账单导出功能正在完善中，当前导出第一个账单")
                if results:
                    ReportExporter.export_calculation_result(results[0], csv_path, 'csv')
        
        click.echo("\n导出完成！")
        
    except Exception as e:
        click.echo(f"\n❌ 错误: {str(e)}", err=True)
        raise click.Abort()


def _get_sample_bills_yaml() -> str:
    """获取样例账单 YAML 内容"""
    return """# 账单样例文件
# 包含正常和异常的账单样例

bills:
  # 正常样例 1: 简单订单
  - id: "bill-normal-001"
    order_id: "order-2024-001"
    currency: "CNY"
    rounding_profile_id: "standard"
    lines:
      - id: "line-1"
        name: "智能手机"
        quantity: 1
        unit_price: 3999.00
        tax_rate: 13
        is_tax_exempt: false
        service_fee_rate: 1.5
      - id: "line-2"
        name: "手机壳"
        quantity: 2
        unit_price: 49.00
        tax_rate: 13
        is_tax_exempt: false
    discounts: []
    notes: "正常订单 - 购买手机和配件"

  # 正常样例 2: 含折扣订单
  - id: "bill-normal-002"
    order_id: "order-2024-002"
    currency: "CNY"
    rounding_profile_id: "standard"
    lines:
      - id: "line-1"
        name: "笔记本电脑"
        quantity: 1
        unit_price: 5999.00
        tax_rate: 13
        is_tax_exempt: false
        discounts: ["disc-new-user"]
    discounts: ["disc-new-user"]
    notes: "含新用户折扣的订单"

  # 正常样例 3: 免税商品
  - id: "bill-normal-003"
    order_id: "order-2024-003"
    currency: "CNY"
    rounding_profile_id: "standard"
    lines:
      - id: "line-1"
        name: "出口商品A"
        quantity: 10
        unit_price: 100.00
        tax_rate: 0
        is_tax_exempt: true
      - id: "line-2"
        name: "国内商品B"
        quantity: 5
        unit_price: 200.00
        tax_rate: 13
        is_tax_exempt: false
    discounts: []
    notes: "包含免税商品的订单"

  # 正常样例 4: 测试取整策略差异
  - id: "bill-rounding-test-001"
    order_id: "order-2024-004"
    currency: "CNY"
    rounding_profile_id: "standard"
    lines:
      - id: "line-1"
        name: "测试商品1"
        quantity: 3
        unit_price: 10.333
        tax_rate: 13
        is_tax_exempt: false
      - id: "line-2"
        name: "测试商品2"
        quantity: 1
        unit_price: 1.235
        tax_rate: 6
        is_tax_exempt: false
    discounts: []
    notes: "用于测试取整策略的订单 - 标准取整"

  # 正常样例 5: 使用不同取整配置
  - id: "bill-rounding-test-002"
    order_id: "order-2024-005"
    currency: "CNY"
    rounding_profile_id: "aggressive"
    lines:
      - id: "line-1"
        name: "测试商品1"
        quantity: 3
        unit_price: 10.333
        tax_rate: 13
        is_tax_exempt: false
      - id: "line-2"
        name: "测试商品2"
        quantity: 1
        unit_price: 1.235
        tax_rate: 6
        is_tax_exempt: false
    discounts: []
    notes: "用于测试取整策略的订单 - 向上取整"

  # 异常样例 1: 缺少必填字段
  - id: "bill-error-001"
    order_id: ""
    currency: "CNY"
    rounding_profile_id: "standard"
    lines:
      - id: ""
        name: ""
        quantity: 0
        unit_price: -100.00
        tax_rate: 13
    discounts: []
    notes: "异常订单 - 测试字段验证"

  # 异常样例 2: 折扣超过小计
  - id: "bill-error-002"
    order_id: "order-2024-error-002"
    currency: "CNY"
    rounding_profile_id: "standard"
    lines:
      - id: "line-1"
        name: "低价商品"
        quantity: 1
        unit_price: 50.00
        tax_rate: 13
        is_tax_exempt: false
        discounts: ["disc-too-large"]
    discounts: ["disc-too-large"]
    notes: "异常订单 - 测试折扣超过小计"

  # 异常样例 3: 无效取整配置
  - id: "bill-error-003"
    order_id: "order-2024-error-003"
    currency: "CNY"
    rounding_profile_id: "non-existent-profile"
    lines:
      - id: "line-1"
        name: "普通商品"
        quantity: 1
        unit_price: 100.00
        tax_rate: 13
        is_tax_exempt: false
    discounts: []
    notes: "异常订单 - 测试无效取整配置"
"""


def _get_sample_discounts_csv() -> str:
    """获取样例折扣 CSV 内容"""
    return """id,name,type,value,application,priority,applicable_to_all,applicable_line_ids
disc-new-user,新用户立减,FIXED_AMOUNT,100,PRE_TAX,1,true,
disc-member,会员折扣,PERCENTAGE,10,POST_TAX,2,true,
disc-seasonal,季节性折扣,PERCENTAGE,15,PRE_TAX,3,true,
disc-too-large,超大折扣,FIXED_AMOUNT,200,PRE_TAX,1,true,
disc-specific,特定商品折扣,PERCENTAGE,20,PRE_TAX,1,false,line-1
"""


def _get_sample_tax_rules_json() -> str:
    """获取样例税率规则 JSON 内容"""
    return """{
    "tax_rules": [
        {
            "id": "tax-13",
            "name": "一般纳税人税率",
            "rate": 13,
            "categories": ["电子产品", "服装", "日用品"],
            "is_default": false
        },
        {
            "id": "tax-6",
            "name": "服务业税率",
            "rate": 6,
            "categories": ["服务", "咨询"],
            "is_default": false
        },
        {
            "id": "tax-0",
            "name": "零税率",
            "rate": 0,
            "categories": ["出口商品", "免税商品"],
            "is_default": false
        },
        {
            "id": "tax-default",
            "name": "默认税率",
            "rate": 13,
            "categories": [],
            "is_default": true
        }
    ]
}
"""


def _get_sample_rounding_profiles_json() -> str:
    """获取样例取整配置 JSON 内容"""
    return """{
    "rounding_profiles": [
        {
            "id": "standard",
            "name": "标准取整配置",
            "line_level_mode": "ROUND_HALF_UP",
            "line_level_precision": 2,
            "order_level_mode": "ROUND_HALF_UP",
            "order_level_precision": 2,
            "tax_rounding_mode": "ROUND_HALF_UP",
            "tax_rounding_precision": 2
        },
        {
            "id": "aggressive",
            "name": "进取型取整（向上取整）",
            "line_level_mode": "CEIL",
            "line_level_precision": 2,
            "order_level_mode": "CEIL",
            "order_level_precision": 2,
            "tax_rounding_mode": "CEIL",
            "tax_rounding_precision": 2
        },
        {
            "id": "conservative",
            "name": "保守型取整（向下取整）",
            "line_level_mode": "FLOOR",
            "line_level_precision": 2,
            "order_level_mode": "FLOOR",
            "order_level_precision": 2,
            "tax_rounding_mode": "FLOOR",
            "tax_rounding_precision": 2
        },
        {
            "id": "high-precision",
            "name": "高精度取整",
            "line_level_mode": "ROUND_HALF_UP",
            "line_level_precision": 4,
            "order_level_mode": "ROUND_HALF_UP",
            "order_level_precision": 4,
            "tax_rounding_mode": "ROUND_HALF_UP",
            "tax_rounding_precision": 4
        }
    ]
}
"""


if __name__ == '__main__':
    main()
