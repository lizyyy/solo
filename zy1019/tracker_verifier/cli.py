"""
命令行入口
提供完整的命令行界面来执行埋点日志验证
"""

import os
import sys
from pathlib import Path
from typing import Optional

import click

from .log_parser import LogParser
from .rule_engine import RuleEngine
from .session_manager import SessionManager
from .reporter import Reporter, ValidationResult


@click.group()
@click.version_option(version='1.0.0')
def cli():
    """埋点日志回放检查工具 - 用于验证埋点日志是否符合预设规则"""
    pass


@cli.command()
@click.option('--log-path', '-l', required=True, 
              help='日志文件路径或包含日志文件的目录路径（支持.jsonl和.csv格式）')
@click.option('--rules-path', '-r', required=True,
              help='规则文件路径（JSON格式）')
@click.option('--output-dir', '-o', default='./reports',
              help='报告输出目录（默认为当前目录下的reports文件夹）')
@click.option('--formats', '-f', default='json,html,md',
              help='输出报告格式，用逗号分隔，支持 json, html, md（默认为全部）')
@click.option('--fail-on-error', is_flag=True, default=False,
              help='如果有任何规则验证失败，返回非零退出码')
@click.option('--verbose', '-v', is_flag=True, default=False,
              help='显示详细输出信息')
def verify(
    log_path: str,
    rules_path: str,
    output_dir: str,
    formats: str,
    fail_on_error: bool,
    verbose: bool
):
    """
    验证埋点日志是否符合预设规则
    
    示例:
      tracker-verifier verify -l ./logs -r ./rules.json -o ./output
      tracker-verifier verify -l ./data/log.jsonl -r ./rules/product.json -f html,json
    """
    if verbose:
        click.echo("🚀 开始执行埋点日志验证...")
        click.echo(f"   日志路径: {log_path}")
        click.echo(f"   规则路径: {rules_path}")
        click.echo(f"   输出目录: {output_dir}")
        click.echo(f"   输出格式: {formats}")
        click.echo("")
    
    # 检查输入文件是否存在
    if not os.path.exists(log_path):
        click.echo(f"❌ 错误: 日志路径不存在: {log_path}", err=True)
        sys.exit(1)
    
    if not os.path.exists(rules_path):
        click.echo(f"❌ 错误: 规则文件不存在: {rules_path}", err=True)
        sys.exit(1)
    
    # 创建输出目录
    try:
        os.makedirs(output_dir, exist_ok=True)
        if verbose:
            click.echo(f"📁 输出目录已创建/确认: {output_dir}")
    except Exception as e:
        click.echo(f"❌ 错误: 无法创建输出目录: {str(e)}", err=True)
        sys.exit(1)
    
    # 解析日志
    if verbose:
        click.echo("\n📖 正在解析日志文件...")
    
    try:
        if os.path.isdir(log_path):
            events, parse_errors = LogParser.parse_directory(log_path)
        else:
            events, parse_errors = LogParser.parse_file(log_path)
        
        if verbose:
            click.echo(f"   ✅ 成功解析 {len(events)} 个事件")
            if parse_errors:
                click.echo(f"   ⚠️  发现 {len(parse_errors)} 个解析错误")
    except Exception as e:
        click.echo(f"❌ 日志解析失败: {str(e)}", err=True)
        sys.exit(1)
    
    # 加载规则
    if verbose:
        click.echo("\n📋 正在加载规则...")
    
    try:
        rule_engine = RuleEngine()
        rules = rule_engine.load_rules_from_file(rules_path)
        
        if verbose:
            click.echo(f"   ✅ 成功加载 {len(rules)} 条规则")
            for rule in rules:
                click.echo(f"      - {rule.rule_id}: {rule.rule_name} ({rule.rule_type.value})")
    except Exception as e:
        click.echo(f"❌ 规则加载失败: {str(e)}", err=True)
        sys.exit(1)
    
    # 管理Session并验证
    if verbose:
        click.echo("\n🔄 正在按Session分组并执行验证...")
    
    try:
        session_manager = SessionManager()
        session_manager.load_events(events)
        session_manager.set_rule_engine(rule_engine)
        
        if verbose:
            stats = session_manager.get_statistics()
            click.echo(f"   📊 统计信息:")
            click.echo(f"      - 总Session数: {stats['session_count']}")
            click.echo(f"      - 总事件数: {stats['total_events']}")
            click.echo(f"      - 独立用户数: {stats['user_count']}")
        
        # 执行验证
        all_results = session_manager.validate_all_sessions()
        
        # 构建验证结果对象
        validation_result = ValidationResult()
        validation_result.add_parse_errors(parse_errors)
        validation_result.set_statistics(session_manager.get_statistics())
        
        for session_id, results in all_results.items():
            validation_result.add_session_results(session_id, results)
        
        if verbose:
            summary = validation_result.get_summary()
            click.echo("\n✅ 验证完成！")
            click.echo(f"   📈 规则通过率: {summary['pass_rate']}%")
            click.echo(f"   📈 Session通过率: {summary['session_pass_rate']}%")
            
            if summary['failed_rules'] > 0:
                click.echo(f"\n   ❌ 失败规则数: {summary['failed_rules']}")
                click.echo(f"   ❌ 失败Session数: {summary['failed_sessions_count']}")
        
    except Exception as e:
        click.echo(f"❌ Session验证失败: {str(e)}", err=True)
        import traceback
        if verbose:
            traceback.print_exc()
        sys.exit(1)
    
    # 生成报告
    if verbose:
        click.echo("\n📝 正在生成报告...")
    
    output_formats = [f.strip().lower() for f in formats.split(',')]
    generated_files = []
    
    try:
        if 'json' in output_formats:
            json_path = os.path.join(output_dir, 'validation_result.json')
            Reporter.generate_json_report(validation_result, json_path)
            generated_files.append(json_path)
            if verbose:
                click.echo(f"   ✅ JSON报告已生成: {json_path}")
        
        if 'md' in output_formats or 'markdown' in output_formats:
            md_path = os.path.join(output_dir, 'validation_report.md')
            Reporter.generate_markdown_report(validation_result, md_path)
            generated_files.append(md_path)
            if verbose:
                click.echo(f"   ✅ Markdown报告已生成: {md_path}")
        
        if 'html' in output_formats:
            html_path = os.path.join(output_dir, 'validation_report.html')
            Reporter.generate_html_report(validation_result, html_path)
            generated_files.append(html_path)
            if verbose:
                click.echo(f"   ✅ HTML报告已生成: {html_path}")
    
    except Exception as e:
        click.echo(f"❌ 报告生成失败: {str(e)}", err=True)
        import traceback
        if verbose:
            traceback.print_exc()
        sys.exit(1)
    
    # 输出最终摘要
    summary = validation_result.get_summary()
    
    click.echo("\n" + "="*60)
    click.echo("📊 验证结果摘要")
    click.echo("="*60)
    click.echo(f"")
    click.echo(f"📈 规则验证:")
    click.echo(f"   总规则数: {summary['total_rules']}")
    click.echo(f"   通过: {summary['passed_rules']} | 失败: {summary['failed_rules']}")
    click.echo(f"   通过率: {summary['pass_rate']}%")
    click.echo(f"")
    click.echo(f"👥 Session统计:")
    click.echo(f"   总Session数: {summary['total_sessions']}")
    click.echo(f"   通过: {summary['passed_sessions']} | 失败: {summary['failed_sessions_count']}")
    click.echo(f"   通过率: {summary['session_pass_rate']}%")
    click.echo(f"")
    
    if summary['failed_rules_ranking']:
        click.echo(f"🏆 失败规则排行:")
        for idx, rule_info in enumerate(summary['failed_rules_ranking'][:5], 1):
            click.echo(f"   {idx}. {rule_info['rule']} - 失败 {rule_info['failure_count']} 次")
        click.echo(f"")
    
    click.echo(f"📄 生成的报告文件:")
    for f in generated_files:
        click.echo(f"   - {f}")
    click.echo("")
    
    # 根据需要返回非零退出码
    if fail_on_error and summary['failed_rules'] > 0:
        click.echo(f"❌ 验证失败，有 {summary['failed_rules']} 条规则未通过")
        sys.exit(1)
    else:
        if summary['failed_rules'] > 0:
            click.echo(f"⚠️  验证完成，但有 {summary['failed_rules']} 条规则未通过")
        else:
            click.echo(f"🎉 所有规则验证通过！")
        sys.exit(0)


@cli.command()
@click.option('--output-dir', '-o', default='./examples',
              help='示例文件输出目录')
def init_examples(output_dir: str):
    """
    创建示例文件（示例日志、规则文件和目录结构）
    
    此命令将创建:
      - 示例JSONL日志文件
      - 示例CSV日志文件  
      - 示例规则文件
      - 基本的目录结构
    """
    click.echo("📦 正在创建示例文件...")
    
    try:
        os.makedirs(output_dir, exist_ok=True)
        logs_dir = os.path.join(output_dir, 'logs')
        rules_dir = os.path.join(output_dir, 'rules')
        os.makedirs(logs_dir, exist_ok=True)
        os.makedirs(rules_dir, exist_ok=True)
        
        # 这里只是提示，实际的示例文件内容会在项目中提供
        click.echo(f"   ✅ 目录结构已创建: {output_dir}")
        click.echo(f"   - {logs_dir}/ (日志目录)")
        click.echo(f"   - {rules_dir}/ (规则目录)")
        click.echo("")
        click.echo("💡 提示: 请查看项目中的 examples 目录获取完整的示例文件。")
        click.echo("   你可以复制这些示例文件到创建的目录中进行测试。")
        
    except Exception as e:
        click.echo(f"❌ 创建示例文件失败: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
@click.argument('rule_type', required=False)
def list_rules(rule_type: Optional[str] = None):
    """
    列出所有支持的规则类型及说明
    
    支持的规则类型:
      - time_window: 时间窗口规则
      - sequence: 顺序规则
      - duplicate: 重复规则
      - presence: 存在规则
    """
    rules_info = {
        "time_window": {
            "name": "时间窗口规则",
            "description": "检查在某个事件发生后的指定时间窗口内，是否应该（或不应该）出现另一个事件",
            "example": "打开详情页之后 5 分钟内应该有 click_buy 或 add_to_cart",
            "config_keys": ["trigger_event", "target_events", "window_seconds", "must_have"]
        },
        "sequence": {
            "name": "顺序规则",
            "description": "检查事件的发生顺序，确保事件B在事件A之后发生",
            "example": "支付成功前必须出现 submit_order",
            "config_keys": ["before_event", "after_event", "strict"]
        },
        "duplicate": {
            "name": "重复规则",
            "description": "检查同一个Session中是否重复上报了过多相同的事件",
            "example": "同一个 session 里不能连续重复上报同一个曝光事件超过 3 次",
            "config_keys": ["target_event", "max_count", "consecutive", "include_page"]
        },
        "presence": {
            "name": "存在规则",
            "description": "检查某个事件是否必须存在或必须不存在",
            "example": "每个Session必须有 page_view 事件",
            "config_keys": ["target_event", "must_exist", "min_count", "max_count"]
        }
    }
    
    click.echo("📋 支持的规则类型")
    click.echo("="*60)
    click.echo("")
    
    if rule_type:
        if rule_type in rules_info:
            info = rules_info[rule_type]
            click.echo(f"🔹 类型: {rule_type}")
            click.echo(f"   名称: {info['name']}")
            click.echo(f"   描述: {info['description']}")
            click.echo(f"   示例: {info['example']}")
            click.echo(f"   配置字段: {', '.join(info['config_keys'])}")
        else:
            click.echo(f"❌ 未知的规则类型: {rule_type}")
            click.echo(f"可用的规则类型: {', '.join(rules_info.keys())}")
    else:
        for rule_type, info in rules_info.items():
            click.echo(f"🔹 {rule_type}: {info['name']}")
            click.echo(f"   描述: {info['description']}")
            click.echo(f"   示例: {info['example']}")
            click.echo("")


def main():
    """主入口函数"""
    cli()


if __name__ == '__main__':
    main()
