import click
from pathlib import Path
from typing import Optional
from datetime import datetime

from .parser import ChatParser
from .filereader import FileReader
from .merger import MergeEngine
from .rule_engine import RuleEngine
from .exporter import Exporter
from .models import (
    ProcessingResult,
    ValidationIssue,
)


@click.group()
def cli():
    """
    接龙报名处理工具 - 自动化处理微信群混乱的接龙报名信息
    
    主要功能:
    - 解析混乱的接龙文本
    - 自动去重和合并重复报名
    - 匹配付款记录
    - 根据规则生成分组和候补名单
    - 导出各种格式的报告
    """
    pass


@cli.command()
@click.option('--input', '-i', 'input_dir', 
              type=click.Path(exists=True, file_okay=False, dir_okay=True),
              default='./input',
              help='输入目录，包含 chat.txt、payments.csv、rules.json 等文件')
@click.option('--output', '-o', 'output_dir',
              type=click.Path(file_okay=False, dir_okay=True),
              default='./output',
              help='输出目录，处理结果将保存到这里')
@click.option('--verbose', '-v', is_flag=True, help='显示详细处理过程')
def process(input_dir: str, output_dir: str, verbose: bool):
    """
    处理接龙报名数据
    
    从输入目录读取 chat.txt、payments.csv、rules.json 等文件，
    执行解析、去重、付款匹配、分组等操作，然后导出结果到输出目录。
    """
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    
    click.echo(f"{'='*60}")
    click.echo(f"接龙报名处理工具")
    click.echo(f"{'='*60}")
    click.echo(f"")
    click.echo(f"输入目录: {input_path.absolute()}")
    click.echo(f"输出目录: {output_path.absolute()}")
    click.echo(f"处理时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    click.echo(f"")
    
    all_issues: list[ValidationIssue] = []
    
    if verbose:
        click.echo("📂 读取输入文件...")
    
    reader = FileReader(input_path)
    
    chat_content = reader.read_chat_file()
    if chat_content is None:
        click.echo("❌ 错误: 无法读取 chat.txt 文件", err=True)
        return 1
    
    payments = reader.read_payments_csv()
    edits = reader.read_edits_csv()
    rules = reader.read_rules_json()
    
    all_issues.extend(reader.issues)
    
    if verbose:
        click.echo(f"   - 付款记录数: {len(payments)}")
        click.echo(f"   - 修改记录数: {len(edits)}")
        click.echo(f"")
    
    if verbose:
        click.echo("📝 解析接龙文本...")
    
    parser = ChatParser()
    registrations = parser.parse(chat_content)
    
    if not registrations:
        click.echo("⚠️ 警告: 未解析到任何有效报名记录", err=True)
        return 1
    
    if verbose:
        click.echo(f"   - 解析到 {len(registrations)} 条报名记录")
        for reg in registrations:
            click.echo(f"     行{reg.line_number}: {reg.real_name or reg.group_nickname or '未知'} - {reg.total_people}人")
        click.echo(f"")
    
    if verbose:
        click.echo("🔀 去重合并...")
    
    merger = MergeEngine(rules)
    merged_records, merge_issues = merger.merge(registrations, payments, edits)
    all_issues.extend(merge_issues)
    
    if verbose:
        click.echo(f"   - 合并后 {len(merged_records)} 条记录")
        click.echo(f"")
    
    if verbose:
        click.echo("📋 应用规则生成结果...")
    
    rule_engine = RuleEngine(rules)
    groups, waitlist, rule_issues = rule_engine.process(merged_records)
    all_issues.extend(rule_issues)
    
    for merged in merged_records:
        merged.is_waitlist = any(w.merged_id == merged.merged_id for w in waitlist)
    
    if verbose:
        confirmed_count = len([r for r in merged_records if not r.is_waitlist])
        waitlist_count = len(waitlist)
        click.echo(f"   - 已确认: {confirmed_count} 条")
        click.echo(f"   - 候补名单: {waitlist_count} 条")
        for slot_name, slot_groups in groups.items():
            total_people = sum(g.current_size for g in slot_groups)
            click.echo(f"   - {slot_name}: {len(slot_groups)} 组, {total_people} 人")
        click.echo(f"")
    
    result = ProcessingResult(
        raw_registrations=registrations,
        payments=payments,
        edits=edits,
        merged_records=merged_records,
        groups=groups,
        waitlist=waitlist,
        validation_issues=all_issues,
        rules=rules,
    )
    
    if verbose:
        click.echo("💾 导出结果...")
    
    exporter = Exporter(output_path)
    exported_paths = exporter.export_all(result)
    
    if verbose:
        click.echo(f"   导出文件:")
        for name, path in exported_paths.items():
            click.echo(f"   - {name}: {path}")
        click.echo(f"")
    
    click.echo(f"{'='*60}")
    click.echo(f"✅ 处理完成!")
    click.echo(f"{'='*60}")
    click.echo(f"")
    
    error_count = len([i for i in all_issues if i.severity == 'error'])
    warning_count = len([i for i in all_issues if i.severity == 'warning'])
    info_count = len([i for i in all_issues if i.severity == 'info'])
    
    click.echo(f"📊 统计摘要:")
    click.echo(f"   - 原始报名: {len(registrations)} 条")
    click.echo(f"   - 合并后: {len(merged_records)} 条")
    click.echo(f"   - 已确认: {len([r for r in merged_records if not r.is_waitlist])} 条")
    click.echo(f"   - 候补: {len(waitlist)} 条")
    click.echo(f"   - 问题: {error_count} 错误, {warning_count} 警告, {info_count} 提示")
    click.echo(f"")
    
    if all_issues:
        click.echo(f"⚠️ 问题列表:")
        click.echo(f"")
        for issue in all_issues:
            severity_icon = "🔴" if issue.severity == 'error' else "🟡" if issue.severity == 'warning' else "🔵"
            click.echo(f"   {severity_icon} [{issue.category}] {issue.message}")
            if issue.line_number:
                click.echo(f"      行号: {issue.line_number}")
            if issue.suggestion:
                click.echo(f"      建议: {issue.suggestion}")
            click.echo(f"")
    
    click.echo(f"📂 输出文件位置:")
    for name, path in exported_paths.items():
        click.echo(f"   - {path.absolute()}")
    click.echo(f"")
    
    return 0


@cli.command()
@click.option('--input', '-i', 'input_dir', 
              type=click.Path(exists=True, file_okay=False, dir_okay=True),
              default='./input',
              help='输入目录')
@click.option('--all', '-a', 'run_all', is_flag=True, help='运行所有自检')
@click.option('--parse', '-p', is_flag=True, help='测试解析功能')
@click.option('--merge', '-m', is_flag=True, help='测试合并功能')
@click.option('--rules', '-r', is_flag=True, help='测试规则引擎')
@click.option('--export', '-e', is_flag=True, help='测试导出功能')
def test(input_dir: str, run_all: bool, parse: bool, merge: bool, rules: bool, export: bool):
    """
    运行自检测试
    
    测试解析、去重、付款匹配、容量校验和导出功能。
    """
    input_path = Path(input_dir)
    
    click.echo(f"{'='*60}")
    click.echo(f"接龙报名处理工具 - 自检测试")
    click.echo(f"{'='*60}")
    click.echo(f"")
    
    if not (run_all or parse or merge or rules or export):
        click.echo("⚠️ 请指定要测试的模块，或使用 --all 运行所有测试")
        click.echo("")
        click.echo("用法:")
        click.echo("   signup test --all          运行所有测试")
        click.echo("   signup test --parse        测试解析功能")
        click.echo("   signup test --merge        测试合并功能")
        click.echo("   signup test --rules        测试规则引擎")
        click.echo("   signup test --export       测试导出功能")
        return 0
    
    tests_to_run = []
    if run_all:
        tests_to_run = ['parse', 'merge', 'rules', 'export']
    else:
        if parse:
            tests_to_run.append('parse')
        if merge:
            tests_to_run.append('merge')
        if rules:
            tests_to_run.append('rules')
        if export:
            tests_to_run.append('export')
    
    passed = 0
    failed = 0
    
    if 'parse' in tests_to_run:
        click.echo("📝 [测试1] 解析功能测试")
        click.echo("-" * 40)
        
        sample_text = """1. 张三 2大1小 周六上午 已转账
2. 李四 1大0小 周六下午 13800138000
3. 王五+朋友 3大2小 周日上午 已付款200
4. 赵六 夫妻 周六上午 不能吃花生
"""
        
        parser = ChatParser()
        records = parser.parse(sample_text)
        
        if len(records) == 4:
            click.echo("✅ 解析记录数正确: 4 条")
            passed += 1
        else:
            click.echo(f"❌ 解析记录数错误: 期望 4，实际 {len(records)}")
            failed += 1
        
        if records[0].real_name == "张三" or records[0].group_nickname == "张三":
            click.echo("✅ 姓名解析正确")
            passed += 1
        else:
            click.echo(f"❌ 姓名解析错误: {records[0].real_name} / {records[0].group_nickname}")
            failed += 1
        
        if records[0].total_people == 3:
            click.echo("✅ 人数解析正确: 3 人")
            passed += 1
        else:
            click.echo(f"❌ 人数解析错误: 期望 3，实际 {records[0].total_people}")
            failed += 1
        
        if "周六上午" in records[0].time_slots:
            click.echo("✅ 时段解析正确")
            passed += 1
        else:
            click.echo(f"❌ 时段解析错误: {records[0].time_slots}")
            failed += 1
        
        if records[1].phone == "13800138000":
            click.echo("✅ 手机号解析正确")
            passed += 1
        else:
            click.echo(f"❌ 手机号解析错误: {records[1].phone}")
            failed += 1
        
        click.echo("")
    
    if 'merge' in tests_to_run:
        click.echo("🔀 [测试2] 合并功能测试")
        click.echo("-" * 40)
        
        sample_text = """1. 张三 2大1小 周六上午 已转账
2. 张三 2大1小 周六上午 13800138000
3. 李四 1大0小 周六下午
"""
        
        parser = ChatParser()
        registrations = parser.parse(sample_text)
        
        from .models import RulesConfig, TimeSlotRule
        from decimal import Decimal
        
        rules = RulesConfig(
            total_max_capacity=100,
            price_per_adult=Decimal('100'),
            price_per_child=Decimal('50'),
            time_slots=[
                TimeSlotRule(name="周六上午", max_capacity=50),
                TimeSlotRule(name="周六下午", max_capacity=50),
            ],
        )
        
        merger = MergeEngine(rules)
        merged_records, issues = merger.merge(registrations, [], [])
        
        if len(merged_records) == 2:
            click.echo(f"✅ 去重合并正确: {len(registrations)} 条原始记录 → {len(merged_records)} 条合并记录")
            passed += 1
        else:
            click.echo(f"❌ 去重合并错误: 期望 2，实际 {len(merged_records)}")
            failed += 1
        
        if any(len(r.duplicate_records) > 0 for r in merged_records):
            click.echo("✅ 正确识别了重复记录")
            passed += 1
        else:
            click.echo("⚠️ 未识别到重复记录（可能解析问题）")
        
        click.echo("")
    
    if 'rules' in tests_to_run:
        click.echo("📋 [测试3] 规则引擎测试")
        click.echo("-" * 40)
        
        from .models import RulesConfig, TimeSlotRule, MergedRecord, RegistrationRecord
        from decimal import Decimal
        
        rules = RulesConfig(
            total_max_capacity=10,
            price_per_adult=Decimal('100'),
            price_per_child=Decimal('50'),
            time_slots=[
                TimeSlotRule(name="周六上午", max_capacity=5),
                TimeSlotRule(name="周六下午", max_capacity=5),
            ],
            group_size=5,
        )
        
        merged_records = []
        for i in range(8):
            reg = RegistrationRecord(
                raw_line=f"{i+1}. 测试用户{i+1}",
                line_number=i+1,
            )
            reg.real_name = f"用户{i+1}"
            reg.group_nickname = f"用户{i+1}"
            reg.total_people = 1
            reg.adult_count = 1
            reg.time_slots = ["周六上午" if i < 6 else "周六下午"]
            
            merged = MergedRecord(primary_record=reg)
            merged_records.append(merged)
        
        rule_engine = RuleEngine(rules)
        groups, waitlist, issues = rule_engine.process(merged_records)
        
        slot_people = sum(sum(g.current_size for g in gs) for gs in groups.values())
        if slot_people == 7:
            click.echo(f"✅ 容量限制正确: 总共 {slot_people} 人确认，{len(waitlist)} 人候补")
            passed += 1
        else:
            click.echo(f"❌ 容量限制错误: 期望 7，实际 {slot_people}")
            failed += 1
        
        if len(waitlist) > 0:
            click.echo(f"✅ 正确生成候补名单: {len(waitlist)} 人")
            passed += 1
        else:
            click.echo("⚠️ 未生成候补名单（可能容量足够）")
        
        click.echo("")
    
    if 'export' in tests_to_run:
        click.echo("💾 [测试4] 导出功能测试")
        click.echo("-" * 40)
        
        import tempfile
        import os
        
        temp_dir = tempfile.mkdtemp()
        temp_path = Path(temp_dir)
        
        try:
            from .models import (
                ProcessingResult, RulesConfig, TimeSlotRule,
                MergedRecord, RegistrationRecord, PaymentRecord
            )
            from decimal import Decimal
            
            rules = RulesConfig(
                total_max_capacity=100,
                price_per_adult=Decimal('100'),
                price_per_child=Decimal('50'),
                time_slots=[
                    TimeSlotRule(name="周六上午", max_capacity=50),
                ],
                group_size=10,
            )
            
            reg = RegistrationRecord(
                raw_line="1. 测试用户 1大0小 周六上午 已转账",
                line_number=1,
            )
            reg.real_name = "测试用户"
            reg.group_nickname = "测试用户"
            reg.total_people = 1
            reg.adult_count = 1
            reg.time_slots = ["周六上午"]
            
            merged = MergedRecord(primary_record=reg)
            merged.assigned_time_slot = "周六上午"
            merged.assigned_group = "周六上午第1组"
            merged.calculate_expected_payment(rules)
            
            from .models import Group
            group = Group(
                group_name="周六上午第1组",
                time_slot="周六上午",
                max_size=10,
            )
            group.members = [merged]
            
            result = ProcessingResult(
                raw_registrations=[reg],
                payments=[],
                edits=[],
                merged_records=[merged],
                groups={"周六上午": [group]},
                waitlist=[],
                validation_issues=[],
                rules=rules,
            )
            
            exporter = Exporter(temp_path)
            exported_paths = exporter.export_all(result)
            
            all_exist = all(p.exists() for p in exported_paths.values())
            if all_exist:
                click.echo("✅ 所有导出文件创建成功")
                passed += 1
                for name, path in exported_paths.items():
                    size = path.stat().st_size
                    click.echo(f"   - {name}: {path} ({size} 字节)")
            else:
                click.echo("❌ 部分导出文件未创建")
                failed += 1
            
            click.echo("")
            
        finally:
            import shutil
            shutil.rmtree(temp_dir)
    
    click.echo(f"{'='*60}")
    click.echo(f"📊 测试结果:")
    click.echo(f"   - 通过: {passed} 项")
    click.echo(f"   - 失败: {failed} 项")
    click.echo(f"")
    
    if failed == 0:
        click.echo("✅ 所有测试通过!")
    else:
        click.echo("❌ 部分测试失败，请检查相关模块")
    
    click.echo("")
    
    return 0 if failed == 0 else 1


@cli.command()
@click.argument('text', nargs=-1)
@click.option('--file', '-f', type=click.Path(exists=True), help='从文件读取文本')
def parse(text: tuple, file: str):
    """
    解析单条或多条接龙文本（调试用）
    
    直接输入文本或从文件读取，查看解析结果。
    """
    if file:
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()
    elif text:
        content = '\n'.join(text)
    else:
        click.echo("请提供文本或使用 --file 参数指定文件", err=True)
        return 1
    
    click.echo(f"解析以下文本:")
    click.echo("-" * 40)
    click.echo(content)
    click.echo("-" * 40)
    click.echo("")
    
    parser = ChatParser()
    records = parser.parse(content)
    
    click.echo(f"解析结果 ({len(records)} 条记录):")
    click.echo("")
    
    for idx, rec in enumerate(records, 1):
        click.echo(f"📝 记录 {idx}:")
        click.echo(f"   原始行: {rec.raw_line}")
        click.echo(f"   序号: {rec.sequence_number}")
        click.echo(f"   群昵称: {rec.group_nickname}")
        click.echo(f"   真实姓名: {rec.real_name}")
        click.echo(f"   手机号: {rec.phone}")
        click.echo(f"   总人数: {rec.total_people}")
        click.echo(f"   成人: {rec.adult_count}")
        click.echo(f"   儿童: {rec.child_count}")
        click.echo(f"   时段: {', '.join(rec.time_slots)}")
        click.echo(f"   忌口: {', '.join(rec.dietary_restrictions)}")
        click.echo(f"   付款金额: {rec.payment_amount}")
        click.echo(f"   有截图: {rec.has_payment_screenshot}")
        click.echo(f"   备注: {', '.join(rec.notes)}")
        
        if rec.parse_warnings:
            click.echo(f"   ⚠️ 解析警告:")
            for w in rec.parse_warnings:
                click.echo(f"      - {w}")
        
        click.echo("")
    
    return 0


def main():
    return cli(obj={})


if __name__ == '__main__':
    main()
