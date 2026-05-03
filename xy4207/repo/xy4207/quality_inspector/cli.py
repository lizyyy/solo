"""
命令行接口模块
提供清晰的子命令结构，用于执行各种质检操作
"""

import os
import sys
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

import click

from quality_inspector.models import (
    Conversation,
    Message,
    Violation,
    ViolationType,
    Severity,
    QualityReport,
)
from quality_inspector.validators import (
    DataValidator,
    ValidationError,
    validate_directory,
)
from quality_inspector.rules import (
    RuleEngine,
    load_config,
    DEFAULT_CONFIG,
)
from quality_inspector.exporters import (
    export_terminal_summary,
    export_markdown_report,
    export_csv_exceptions,
)


# 全局配置
CONFIG: Dict[str, Any] = {}


def load_global_config(ctx: click.Context, param: click.Parameter, value: str) -> str:
    """加载全局配置的回调函数"""
    global CONFIG
    if value:
        CONFIG = load_config(value)
    else:
        # 尝试从默认位置加载
        default_config_paths = [
            "./quality_inspector/config.yaml",
            "./config.yaml",
            os.path.expanduser("~/.quality_inspector/config.yaml"),
        ]
        for config_path in default_config_paths:
            if os.path.exists(config_path):
                CONFIG = load_config(config_path)
                break
        else:
            CONFIG = DEFAULT_CONFIG
    return value


# 定义命令组
@click.group()
@click.option(
    "--config", 
    "-c", 
    type=click.Path(exists=True, file_okay=True, dir_okay=False),
    callback=load_global_config,
    is_eager=True,
    help="配置文件路径"
)
@click.option(
    "--strict", 
    "-s", 
    is_flag=True, 
    help="严格模式，任何字段缺失都会报错"
)
@click.option(
    "--verbose", 
    "-v", 
    is_flag=True, 
    help="显示详细输出"
)
@click.pass_context
def main(ctx: click.Context, config: str, strict: bool, verbose: bool):
    """
    客服回访录音质检工具
    
    用于批量处理客服回访录音的文字稿，进行质检分析并生成报告。
    
    支持的操作：
    - validate: 校验输入文件格式
    - analyze: 执行质检分析
    - report: 生成完整质检报告
    - export: 导出异常样本
    - examples: 生成示例数据
    """
    # 将上下文传递给子命令
    ctx.ensure_object(dict)
    ctx.obj["strict"] = strict
    ctx.obj["verbose"] = verbose
    ctx.obj["config"] = CONFIG


@main.command()
@click.argument(
    "input_path", 
    type=click.Path(exists=True, file_okay=True, dir_okay=True)
)
@click.option(
    "--recursive", 
    "-r", 
    is_flag=True, 
    help="递归处理子目录"
)
@click.option(
    "--output", 
    "-o", 
    type=click.Path(file_okay=True, dir_okay=False),
    help="输出JSON报告的路径"
)
@click.pass_context
def validate(ctx: click.Context, input_path: str, recursive: bool, output: str):
    """
    校验输入文件格式
    
    检查JSON/Markdown文件的字段完整性和格式正确性。
    
    INPUT_PATH: 输入文件或目录路径
    """
    click.echo(f"开始校验: {input_path}")
    click.echo("-" * 50)
    
    strict_mode = ctx.obj["strict"]
    verbose = ctx.obj["verbose"]
    
    # 初始化校验器
    validator = DataValidator(strict_mode=strict_mode)
    
    results = {}
    total_files = 0
    valid_files = 0
    invalid_files = 0
    
    # 处理单个文件或目录
    if os.path.isfile(input_path):
        # 单个文件
        is_valid, errors, data = validator.validate_file(input_path)
        results[input_path] = (is_valid, errors, data)
        total_files = 1
        if is_valid:
            valid_files = 1
        else:
            invalid_files = 1
    else:
        # 目录
        dir_results = validate_directory(input_path, strict_mode, recursive)
        results = dir_results
        total_files = len(results)
        valid_files = sum(1 for is_valid, _, _ in results.values() if is_valid)
        invalid_files = total_files - valid_files
    
    # 输出结果
    for file_path, (is_valid, errors, data) in results.items():
        status = "✓ 有效" if is_valid else "✗ 无效"
        color = "green" if is_valid else "red"
        click.echo(click.style(f"[{status}] {file_path}", fg=color))
        
        if errors and (verbose or not is_valid):
            for error in errors:
                click.echo(click.style(f"  - {error}", fg="yellow"))
    
    # 统计摘要
    click.echo("-" * 50)
    click.echo(f"总文件数: {total_files}")
    click.echo(click.style(f"有效文件: {valid_files}", fg="green"))
    click.echo(click.style(f"无效文件: {invalid_files}", fg="red" if invalid_files > 0 else "green"))
    
    # 输出JSON报告
    if output:
        report_data = {
            "generated_at": datetime.now().isoformat(),
            "input_path": input_path,
            "total_files": total_files,
            "valid_files": valid_files,
            "invalid_files": invalid_files,
            "results": {
                file_path: {
                    "is_valid": is_valid,
                    "errors": [str(e) for e in errors],
                }
                for file_path, (is_valid, errors, _) in results.items()
            }
        }
        
        with open(output, "w", encoding="utf-8") as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        
        click.echo(click.style(f"\n校验报告已保存到: {output}", fg="green"))
    
    # 设置退出码
    if invalid_files > 0:
        sys.exit(1)


@main.command()
@click.argument(
    "input_path", 
    type=click.Path(exists=True, file_okay=True, dir_okay=True)
)
@click.option(
    "--recursive", 
    "-r", 
    is_flag=True, 
    help="递归处理子目录"
)
@click.option(
    "--output-dir", 
    "-o", 
    type=click.Path(file_okay=False, dir_okay=True),
    default="./output",
    help="输出目录路径 (默认: ./output)"
)
@click.option(
    "--no-terminal", 
    is_flag=True, 
    help="不在终端显示摘要"
)
@click.option(
    "--no-markdown", 
    is_flag=True, 
    help="不生成Markdown报告"
)
@click.option(
    "--no-csv", 
    is_flag=True, 
    help="不导出异常样本CSV"
)
@click.pass_context
def analyze(ctx: click.Context, input_path: str, recursive: bool, output_dir: str,
            no_terminal: bool, no_markdown: bool, no_csv: bool):
    """
    执行质检分析
    
    检测承诺未兑现、情绪升级、敏感词、超时回复等违规情况。
    
    INPUT_PATH: 输入文件或目录路径
    """
    click.echo(f"开始质检分析: {input_path}")
    click.echo("-" * 50)
    
    strict_mode = ctx.obj["strict"]
    verbose = ctx.obj["verbose"]
    config = ctx.obj["config"]
    
    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)
    
    # 加载和解析数据
    conversations: List[Conversation] = []
    validation_errors: List[ValidationError] = []
    
    if os.path.isfile(input_path):
        # 单个文件
        validator = DataValidator(strict_mode=strict_mode)
        is_valid, errors, data = validator.validate_file(input_path)
        
        if is_valid and data:
            try:
                if "_is_markdown" in data:
                    # Markdown格式
                    conv = Conversation.from_markdown(data["content"], input_path)
                else:
                    # JSON格式
                    conv = Conversation.from_dict(data, input_path)
                conversations.append(conv)
            except Exception as e:
                validation_errors.append(ValidationError(
                    message=f"解析数据失败: {str(e)}",
                    source_file=input_path
                ))
        else:
            validation_errors.extend(errors)
    else:
        # 目录
        validator = DataValidator(strict_mode=strict_mode)
        dir_results = validate_directory(input_path, strict_mode, recursive)
        
        for file_path, (is_valid, errors, data) in dir_results.items():
            if is_valid and data:
                try:
                    if "_is_markdown" in data:
                        conv = Conversation.from_markdown(data["content"], file_path)
                    else:
                        conv = Conversation.from_dict(data, file_path)
                    conversations.append(conv)
                except Exception as e:
                    validation_errors.append(ValidationError(
                        message=f"解析数据失败: {str(e)}",
                        source_file=file_path
                    ))
            else:
                validation_errors.extend(errors)
    
    # 统计信息
    total_conversations = len(conversations) + len(validation_errors)
    valid_conversations = len(conversations)
    invalid_conversations = len(validation_errors)
    
    click.echo(f"解析完成: {valid_conversations} 个有效对话, {invalid_conversations} 个无效")
    
    # 执行质检分析
    click.echo("\n执行质检规则...")
    
    rule_engine = RuleEngine(config)
    quality_report = QualityReport(
        total_conversations=total_conversations,
        valid_conversations=valid_conversations,
        invalid_conversations=invalid_conversations,
    )
    
    # 分析每个对话
    all_violations: List[Violation] = []
    for conv in conversations:
        violations = rule_engine.analyze(conv)
        all_violations.extend(violations)
        
        # 按类型分类
        for violation in violations:
            if violation.violation_type == ViolationType.BROKEN_PROMISE:
                quality_report.broken_promises.append(violation)
            elif violation.violation_type == ViolationType.EMOTION_ESCALATION:
                quality_report.emotion_escalations.append(violation)
            elif violation.violation_type == ViolationType.SENSITIVE_WORD:
                quality_report.sensitive_words.append(violation)
            elif violation.violation_type == ViolationType.TIMEOUT_RESPONSE:
                quality_report.timeout_responses.append(violation)
    
    quality_report.violations = all_violations
    
    # 统计信息
    quality_report.statistics = {
        "total_violations": len(all_violations),
        "broken_promises_count": len(quality_report.broken_promises),
        "emotion_escalations_count": len(quality_report.emotion_escalations),
        "sensitive_words_count": len(quality_report.sensitive_words),
        "timeout_responses_count": len(quality_report.timeout_responses),
        "by_severity": {
            "critical": sum(1 for v in all_violations if v.severity == Severity.CRITICAL),
            "high": sum(1 for v in all_violations if v.severity == Severity.HIGH),
            "medium": sum(1 for v in all_violations if v.severity == Severity.MEDIUM),
            "low": sum(1 for v in all_violations if v.severity == Severity.LOW),
        },
        "by_agent": {},
        "validation_errors_count": len(validation_errors),
    }
    
    # 按坐席统计
    for violation in all_violations:
        agent = violation.agent_name or "未知"
        if agent not in quality_report.statistics["by_agent"]:
            quality_report.statistics["by_agent"][agent] = 0
        quality_report.statistics["by_agent"][agent] += 1
    
    # 输出结果
    click.echo("-" * 50)
    click.echo("质检分析完成!")
    click.echo("-" * 50)
    
    # 终端摘要
    if not no_terminal:
        export_terminal_summary(quality_report, validation_errors, verbose)
    
    # Markdown报告
    if not no_markdown:
        report_path = os.path.join(output_dir, f"quality_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md")
        export_markdown_report(quality_report, report_path, validation_errors)
        click.echo(click.style(f"\nMarkdown报告已保存到: {report_path}", fg="green"))
    
    # CSV导出
    if not no_csv and all_violations:
        csv_path = os.path.join(output_dir, f"exception_samples_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
        export_csv_exceptions(quality_report, csv_path)
        click.echo(click.style(f"异常样本CSV已保存到: {csv_path}", fg="green"))
    
    # 设置退出码（如果有严重违规）
    critical_count = quality_report.statistics["by_severity"].get("critical", 0)
    if critical_count > 0:
        click.echo(click.style(f"\n警告: 检测到 {critical_count} 个严重违规!", fg="red"))
        sys.exit(2)


@main.command()
@click.argument(
    "input_path", 
    type=click.Path(exists=True, file_okay=True, dir_okay=True)
)
@click.option(
    "--recursive", 
    "-r", 
    is_flag=True, 
    help="递归处理子目录"
)
@click.option(
    "--output", 
    "-o", 
    type=click.Path(file_okay=True, dir_okay=False),
    required=True,
    help="输出Markdown报告的路径"
)
@click.pass_context
def report(ctx: click.Context, input_path: str, recursive: bool, output: str):
    """
    生成完整质检报告
    
    执行完整的质检分析并生成详细的Markdown报告。
    
    INPUT_PATH: 输入文件或目录路径
    """
    # 实际上是analyze命令的一个简化版本，只生成Markdown报告
    ctx.invoke(
        analyze,
        input_path=input_path,
        recursive=recursive,
        output_dir=os.path.dirname(output) or ".",
        no_terminal=False,
        no_markdown=False,
        no_csv=True
    )


@main.command()
@click.argument(
    "input_path", 
    type=click.Path(exists=True, file_okay=True, dir_okay=True)
)
@click.option(
    "--recursive", 
    "-r", 
    is_flag=True, 
    help="递归处理子目录"
)
@click.option(
    "--output", 
    "-o", 
    type=click.Path(file_okay=True, dir_okay=False),
    required=True,
    help="输出CSV文件的路径"
)
@click.pass_context
def export(ctx: click.Context, input_path: str, recursive: bool, output: str):
    """
    导出异常样本
    
    执行质检分析并将所有违规记录导出为CSV文件。
    
    INPUT_PATH: 输入文件或目录路径
    """
    # 实际上是analyze命令的一个简化版本，只导出CSV
    ctx.invoke(
        analyze,
        input_path=input_path,
        recursive=recursive,
        output_dir=os.path.dirname(output) or ".",
        no_terminal=True,
        no_markdown=True,
        no_csv=False
    )


@main.command()
@click.option(
    "--output-dir", 
    "-o", 
    type=click.Path(file_okay=False, dir_okay=True),
    default="./examples",
    help="输出目录路径 (默认: ./examples)"
)
@click.option(
    "--count", 
    "-n", 
    type=int,
    default=5,
    help="生成示例数据的数量 (默认: 5)"
)
def examples(output_dir: str, count: int):
    """
    生成示例数据
    
    创建用于测试的示例JSON和Markdown文件，包含各种违规场景。
    """
    click.echo(f"生成 {count} 个示例数据到: {output_dir}")
    click.echo("-" * 50)
    
    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)
    
    # 示例对话模板
    example_templates = [
        # 示例1: 正常对话
        {
            "id": "conv_001",
            "agent": "张小明",
            "customer": "李女士",
            "time": "2024-01-15 09:30:00",
            "messages": [
                {"index": 0, "speaker": "agent", "content": "您好，这里是客服中心，我是张小明，有什么可以帮助您的？", "time": "2024-01-15 09:30:00"},
                {"index": 1, "speaker": "customer", "content": "你好，我想咨询一下我的订单物流情况。", "time": "2024-01-15 09:30:15"},
                {"index": 2, "speaker": "agent", "content": "好的，请您提供一下订单号，我帮您查询。", "time": "2024-01-15 09:30:30"},
                {"index": 3, "speaker": "customer", "content": "订单号是ORD20240115001。", "time": "2024-01-15 09:30:45"},
                {"index": 4, "speaker": "agent", "content": "好的，我帮您查询一下... 您的订单已于今天早上8:30派送，预计今天下午可以送达。", "time": "2024-01-15 09:31:00"},
                {"index": 5, "speaker": "customer", "content": "好的，谢谢，我知道了。", "time": "2024-01-15 09:31:15"},
                {"index": 6, "speaker": "agent", "content": "不客气，如有其他问题欢迎随时联系我们。祝您生活愉快！", "time": "2024-01-15 09:31:30"},
            ],
            "description": "正常客服对话示例"
        },
        # 示例2: 包含敏感词
        {
            "id": "conv_002",
            "agent": "王小红",
            "customer": "陈先生",
            "time": "2024-01-16 14:20:00",
            "messages": [
                {"index": 0, "speaker": "agent", "content": "您好，这里是客服中心，我是王小红，有什么可以帮助您的？", "time": "2024-01-16 14:20:00"},
                {"index": 1, "speaker": "customer", "content": "你好，我要投诉你们的产品质量有问题！", "time": "2024-01-16 14:20:15"},
                {"index": 2, "speaker": "agent", "content": "非常抱歉给您带来不好的体验，请您详细描述一下问题。", "time": "2024-01-16 14:20:30"},
                {"index": 3, "speaker": "customer", "content": "我收到的商品和描述完全不符，这是虚假宣传！我要求退款赔偿。", "time": "2024-01-16 14:21:00"},
                {"index": 4, "speaker": "agent", "content": "非常抱歉，我们会尽快处理您的问题。请您提供一下订单号和相关照片。", "time": "2024-01-16 14:21:30"},
            ],
            "description": "包含敏感词（投诉、虚假宣传、退款赔偿）的对话"
        },
        # 示例3: 承诺未兑现
        {
            "id": "conv_003",
            "agent": "刘小刚",
            "customer": "赵女士",
            "time": "2024-01-17 10:15:00",
            "messages": [
                {"index": 0, "speaker": "agent", "content": "您好，这里是客服中心，我是刘小刚，有什么可以帮助您的？", "time": "2024-01-17 10:15:00"},
                {"index": 1, "speaker": "customer", "content": "你好，我上周申请的退款还没到账。", "time": "2024-01-17 10:15:15"},
                {"index": 2, "speaker": "agent", "content": "非常抱歉让您久等了，我帮您查询一下... 您的退款申请正在处理中，我保证今天下午一定会处理完成。", "time": "2024-01-17 10:15:30"},
                {"index": 3, "speaker": "customer", "content": "好的，那我再等等。", "time": "2024-01-17 10:15:45"},
                {"index": 4, "speaker": "agent", "content": "感谢您的理解，处理完成后会有短信通知您。", "time": "2024-01-17 10:16:00"},
                # 模拟后续对话显示承诺未兑现
                {"index": 5, "speaker": "customer", "content": "你好，我是赵女士，今天上午你说下午会处理我的退款，现在还没消息。", "time": "2024-01-17 16:30:00"},
                {"index": 6, "speaker": "agent", "content": "非常抱歉，系统今天有些延迟，退款还没处理好。", "time": "2024-01-17 16:30:15"},
            ],
            "description": "坐席承诺当天处理但后续表示还没处理好（承诺未兑现）"
        },
        # 示例4: 情绪升级
        {
            "id": "conv_004",
            "agent": "陈小华",
            "customer": "孙先生",
            "time": "2024-01-18 15:45:00",
            "messages": [
                {"index": 0, "speaker": "agent", "content": "您好，这里是客服中心，我是陈小华，有什么可以帮助您的？", "time": "2024-01-18 15:45:00"},
                {"index": 1, "speaker": "customer", "content": "你好，我的订单已经延迟三天了，怎么还没发货？", "time": "2024-01-18 15:45:15"},
                {"index": 2, "speaker": "agent", "content": "非常抱歉让您久等了，我帮您查询一下... 您的订单因为库存问题暂时无法发货。", "time": "2024-01-18 15:45:30"},
                {"index": 3, "speaker": "customer", "content": "什么？那你们为什么不提前通知我？我很生气！", "time": "2024-01-18 15:46:00"},
                {"index": 4, "speaker": "agent", "content": "非常抱歉，我们确实有疏忽。您可以选择等待或者申请退款。", "time": "2024-01-18 15:46:15"},
                {"index": 5, "speaker": "customer", "content": "这不是退款的问题！我等了这么久，你们的服务越来越差了！我非常不满！", "time": "2024-01-18 15:46:30"},
            ],
            "description": "客户情绪逐渐升级（生气→非常不满→越来越差）"
        },
        # 示例5: 超时回复
        {
            "id": "conv_005",
            "agent": "周小丽",
            "customer": "吴先生",
            "time": "2024-01-19 11:00:00",
            "messages": [
                {"index": 0, "speaker": "agent", "content": "您好，这里是客服中心，我是周小丽，有什么可以帮助您的？", "time": "2024-01-19 11:00:00"},
                {"index": 1, "speaker": "customer", "content": "你好，我想咨询一下会员权益。", "time": "2024-01-19 11:00:15"},
                # 模拟长时间等待
                {"index": 2, "speaker": "agent", "content": "非常抱歉让您久等了，我帮您查询一下会员权益...", "time": "2024-01-19 11:08:00"},  # 8分钟后回复
                {"index": 3, "speaker": "customer", "content": "你们怎么这么慢？我等了快十分钟了！", "time": "2024-01-19 11:08:15"},
                {"index": 4, "speaker": "agent", "content": "非常抱歉，系统查询有些慢。您的会员等级是黄金会员，可以享受...", "time": "2024-01-19 11:15:00"},  # 又等了7分钟
            ],
            "description": "包含超时回复的对话（坐席回复延迟超过阈值）"
        },
    ]
    
    # 生成示例文件
    generated_count = 0
    for i, template in enumerate(example_templates[:count]):
        # 生成JSON文件
        json_data = {
            "conversation_id": template["id"],
            "agent_name": template["agent"],
            "customer_name": template["customer"],
            "conversation_time": template["time"],
            "messages": [
                {
                    "index": msg["index"],
                    "speaker": msg["speaker"],
                    "content": msg["content"],
                    "timestamp": msg["time"]
                }
                for msg in template["messages"]
            ],
            "description": template["description"]
        }
        
        json_path = os.path.join(output_dir, f"example_{i+1:02d}.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        
        click.echo(click.style(f"✓ 已生成: {json_path}", fg="green"))
        
        # 同时生成一个Markdown格式的示例
        if i == 0:
            md_content = f"""---
conversation_id: {template['id']}
agent_name: {template['agent']}
customer_name: {template['customer']}
conversation_time: {template['time']}
description: {template['description']}
---

# 客服对话记录

## 对话详情

**坐席**: {template['agent']}  
**客户**: {template['customer']}  
**时间**: {template['time']}

---

"""
            for msg in template["messages"]:
                speaker_label = "坐席" if msg["speaker"] == "agent" else "客户"
                md_content += f"**{speaker_label}** ({msg['time']}): {msg['content']}\n\n"
            
            md_path = os.path.join(output_dir, f"example_{i+1:02d}.md")
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(md_content)
            
            click.echo(click.style(f"✓ 已生成: {md_path}", fg="green"))
        
        generated_count += 1
    
    click.echo("-" * 50)
    click.echo(click.style(f"成功生成 {generated_count} 个示例数据文件!", fg="green"))
    click.echo(f"输出目录: {output_dir}")
    click.echo("\n示例说明:")
    click.echo("  - example_001: 正常对话（无违规）")
    click.echo("  - example_002: 包含敏感词（投诉、虚假宣传、退款赔偿）")
    click.echo("  - example_003: 承诺未兑现（坐席承诺当天处理但后续未兑现）")
    click.echo("  - example_004: 情绪升级（客户情绪逐渐升级）")
    click.echo("  - example_005: 超时回复（坐席回复延迟超过阈值）")


if __name__ == "__main__":
    main()
