import click
import sys
import os
import time
import random

from .parser import SlowlogParser, SlowlogEntry
from .analysis import SlowlogAnalyzer
from .report import TerminalReporter, MachineReadableReporter, MarkdownReporter


def generate_sample_data(num_entries: int = 100, include_errors: bool = True) -> str:
    lines = []
    
    key_patterns = [
        "user:{id}",
        "session:{uuid}",
        "product:{id}:info",
        "cache:{prefix}:{id}",
        "order:{id}:items",
        "config:{key}",
        "rate_limit:{ip}",
    ]
    
    commands = [
        ("GET", 500, 50000),
        ("SET", 1000, 100000),
        ("DEL", 200, 20000),
        ("HGET", 800, 80000),
        ("HSET", 1200, 150000),
        ("KEYS", 50000, 500000),
        ("SMEMBERS", 10000, 100000),
        ("LRANGE", 20000, 200000),
        ("ZADD", 1500, 150000),
        ("ZRANGE", 10000, 100000),
    ]
    
    ips = ["192.168.1.100", "192.168.1.101", "192.168.2.50", "10.0.0.25"]
    client_names = ["web-server", "api-gateway", "cache-service", "worker-1"]
    
    base_time = int(time.time())
    
    for i in range(num_entries):
        cmd_name, dur_min, dur_max = random.choice(commands)
        duration = random.randint(dur_min, dur_max)
        
        pattern = random.choice(key_patterns)
        key = pattern.format(
            id=random.randint(1, 10000),
            uuid=f"{random.randint(1, 9999):04}-abc",
            prefix=random.choice(["data", "temp", "perm"]),
            key=f"setting_{random.randint(1, 100)}",
            ip=f"10.0.{random.randint(0, 10)}.{random.randint(1, 255)}"
        )
        
        lines.append(f"*{4}")
        lines.append(f":{i + 1}")
        lines.append(f":{base_time + i}")
        lines.append(f":{duration}")
        lines.append(f"*{2}")
        lines.append(f"${len(cmd_name)}")
        lines.append(f"{cmd_name}")
        lines.append(f"${len(key)}")
        lines.append(f"{key}")
        
        if random.random() < 0.3:
            lines.append(f"${len(ips[0])}")
            lines.append(f"{random.choice(ips)}")
            
            if random.random() < 0.5:
                lines.append(f"${len(client_names[0])}")
                lines.append(f"{random.choice(client_names)}")
    
    if include_errors:
        lines.append("INVALID LINE FORMAT")
        lines.append("*2")
        lines.append(":not-a-number")
        lines.append("$5")
        lines.append("hello")
    
    return "\n".join(lines)


@click.group()
def main():
    """Redis Slowlog 归因分析工具
    
    分析 Redis 慢查询日志，解析命令、提取 Key 模式、统计耗时分布、关联调用方。
    """
    pass


@main.command()
@click.argument('input_file', type=click.Path(exists=True), required=False)
@click.option('--output', '-o', help='输出文件前缀')
@click.option('--format', '-f', type=click.Choice(['all', 'terminal', 'json', 'markdown']), default='all', help='输出格式')
@click.option('--sample', '-s', is_flag=True, help='使用内置示例数据进行演示')
def analyze(input_file, output, format, sample):
    """分析 slowlog 文件并生成报告"""
    
    if sample:
        click.echo("使用示例数据进行分析演示...")
        content = generate_sample_data(100, include_errors=True)
    elif not input_file:
        click.echo("错误: 请提供输入文件或使用 --sample 参数")
        sys.exit(1)
    else:
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()
    
    parser = SlowlogParser()
    parse_result = parser.parse(content)
    
    analyzer = SlowlogAnalyzer(parse_result)
    result = analyzer.analyze()
    
    output_prefix = output or ("slowlog_report" if not sample else "sample_report")
    
    if format in ['all', 'terminal']:
        reporter = TerminalReporter(result)
        reporter.print_summary()
    
    if format in ['all', 'json']:
        reporter = MachineReadableReporter(result)
        reporter.write_json(f"{output_prefix}.json")
        click.echo(f"JSON报告已写入: {output_prefix}.json")
    
    if format in ['all', 'markdown']:
        reporter = MarkdownReporter(result)
        reporter.write_report(f"{output_prefix}.md")
        click.echo(f"Markdown报告已写入: {output_prefix}.md")


@main.command()
@click.option('--output', '-o', type=click.Path(), help='输出示例数据文件路径')
@click.option('--num-entries', '-n', type=int, default=100, help='生成的条目数量')
@click.option('--include-errors', is_flag=True, default=True, help='是否包含错误行')
def generate_sample(output, num_entries, include_errors):
    """生成示例 slowlog 数据用于测试"""
    
    content = generate_sample_data(num_entries, include_errors)
    
    if output:
        with open(output, 'w', encoding='utf-8') as f:
            f.write(content)
        click.echo(f"示例数据已写入: {output}")
    else:
        print(content)


@main.command()
def self_test():
    """执行自检，验证解析、模式提取和报告生成功能"""
    
    click.echo("=" * 60)
    click.echo("Redis Slowlog Attribution 自检")
    click.echo("=" * 60)
    click.echo("")
    
    tests_passed = 0
    tests_failed = 0
    
    # Test 1: Parser
    click.echo("🔍 Test 1: 解析器测试")
    try:
        test_content = generate_sample_data(50, include_errors=True)
        parser = SlowlogParser()
        result = parser.parse(test_content)
        
        if result.entries:
            click.echo(f"   ✓ 成功解析 {len(result.entries)} 条条目")
            tests_passed += 1
        else:
            click.echo("   ✗ 没有解析到任何条目")
            tests_failed += 1
            
        if result.errors:
            click.echo(f"   ✓ 正确识别 {len(result.errors)} 个解析错误")
            tests_passed += 1
        else:
            click.echo("   ⚠ 没有识别到错误（如果禁用了错误，这是正常的）")
    except Exception as e:
        click.echo(f"   ✗ 解析失败: {e}")
        tests_failed += 1
    
    click.echo("")
    
    # Test 2: Key pattern extraction
    click.echo("🔍 Test 2: Key模式提取")
    try:
        test_content = generate_sample_data(50, include_errors=False)
        parser = SlowlogParser()
        parse_result = parser.parse(test_content)
        
        analyzer = SlowlogAnalyzer(parse_result)
        result = analyzer.analyze()
        
        if result.key_patterns:
            click.echo(f"   ✓ 提取到 {len(result.key_patterns)} 个Key模式")
            tests_passed += 1
        else:
            click.echo("   ✗ 没有提取到Key模式")
            tests_failed += 1
    except Exception as e:
        click.echo(f"   ✗ 模式提取失败: {e}")
        tests_failed += 1
    
    click.echo("")
    
    # Test 3: Reports
    click.echo("🔍 Test 3: 报告生成")
    try:
        test_content = generate_sample_data(50, include_errors=True)
        parser = SlowlogParser()
        parse_result = parser.parse(test_content)
        analyzer = SlowlogAnalyzer(parse_result)
        result = analyzer.analyze()
        
        # Test JSON report
        json_reporter = MachineReadableReporter(result)
        json_str = json_reporter.to_json()
        if len(json_str) > 0:
            click.echo("   ✓ JSON报告生成成功")
            tests_passed += 1
        else:
            click.echo("   ✗ JSON报告为空")
            tests_failed += 1
        
        # Test Markdown report
        md_reporter = MarkdownReporter(result)
        md_str = md_reporter.generate()
        if len(md_str) > 0:
            click.echo("   ✓ Markdown报告生成成功")
            tests_passed += 1
        else:
            click.echo("   ✗ Markdown报告为空")
            tests_failed += 1
            
    except Exception as e:
        click.echo(f"   ✗ 报告生成失败: {e}")
        tests_failed += 2
    
    click.echo("")
    
    # Test 4: Boundary cases
    click.echo("🔍 Test 4: 边界情况处理")
    try:
        parser = SlowlogParser()
        
        empty_result = parser.parse("")
        if len(empty_result.entries) == 0 and len(empty_result.errors) == 0:
            click.echo("   ✓ 空输入处理正确")
            tests_passed += 1
        else:
            click.echo("   ✗ 空输入处理错误")
            tests_failed += 1
        
        json_content = '[{"id": 1, "timestamp": 1234567890, "duration": 1000, "command": "GET", "args": ["test_key"]}]'
        json_result = parser.parse(json_content)
        if len(json_result.entries) == 1:
            click.echo("   ✓ JSON格式解析正确")
            tests_passed += 1
        else:
            click.echo("   ✗ JSON格式解析错误")
            tests_failed += 1
            
    except Exception as e:
        click.echo(f"   ✗ 边界情况处理失败: {e}")
        tests_failed += 2
    
    click.echo("")
    click.echo("=" * 60)
    
    total = tests_passed + tests_failed
    click.echo(f"测试结果: {tests_passed}/{total} 通过")
    
    if tests_failed == 0:
        click.echo("✅ 所有测试通过！")
        sys.exit(0)
    else:
        click.echo(f"❌ {tests_failed} 个测试失败")
        sys.exit(1)


if __name__ == '__main__':
    main()
