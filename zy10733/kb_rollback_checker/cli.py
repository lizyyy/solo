import click
import sys
from datetime import datetime
from .parser import LogParser
from .validator import RollbackValidator
from .reporter import ReportGenerator


@click.group()
def cli():
    """📚 知识库发布日志文章回滚核验 CLI"""
    pass


@cli.command()
@click.argument('log_file', type=click.Path(exists=True))
@click.option('--detailed', '-d', is_flag=True, help='显示详细处理过程')
@click.option('--output', '-o', type=click.Path(), help='输出报告文件路径')
@click.option('--continue-on-error/--stop-on-error', default=True, 
              help='遇到错误时继续处理/中断处理')
def check(log_file, detailed, output, continue_on_error):
    """核验知识库文章回滚日志
    
    LOG_FILE: 回滚日志文件路径 (支持 JSON/CSV/LOG 格式)
    """
    click.echo("📚 知识库发布日志文章回滚核验")
    click.echo(f"📂 读取日志文件: {log_file}")
    click.echo("")
    
    try:
        parser = LogParser()
        records = parser.parse_file(log_file)
        
        if not records:
            click.echo("⚠️  没有解析到任何回滚记录")
            return
        
        click.echo(f"✅ 解析到 {len(records)} 条回滚记录")
        click.echo("")
        
        validator = RollbackValidator(continue_on_error=continue_on_error)
        result = validator.validate(records)
        
        reporter = ReportGenerator(detailed=detailed)
        report = reporter.generate_console_report(result)
        
        click.echo(report)
        
        if output:
            reporter.save_report(result, output)
            click.echo(f"")
            click.echo(f"💾 报告已保存到: {output}")
        
        sys.exit(0 if result.incomplete_rollbacks == 0 else 1)
        
    except Exception as e:
        click.echo(f"❌ 核验失败: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
@click.argument('output_file', type=click.Path())
def sample(output_file):
    """生成样例回滚日志文件用于测试
    
    OUTPUT_FILE: 输出样例文件路径
    """
    import json
    
    now = datetime.now()
    
    sample_data = [
        {
            "article_id": "KB-2024-001",
            "article_title": "2024年度产品规划白皮书",
            "space_id": "SPACE-PRODUCT",
            "space_name": "产品研发部",
            "publish_time": (now.replace(hour=9, minute=0, second=0)).strftime('%Y-%m-%d %H:%M:%S'),
            "rollback_time": (now.replace(hour=10, minute=30, second=0)).strftime('%Y-%m-%d %H:%M:%S'),
            "operator": "张三",
            "rollback_version": "v1.0",
            "previous_version": "v1.0",
            "status": "SUCCESS",
            "attachments": ["产品路线图.pdf", "Q1规划.docx"],
            "rolled_back_attachments": ["产品路线图.pdf", "Q1规划.docx"],
            "processing_log": ["开始回滚处理", "版本恢复完成"]
        },
        {
            "article_id": "KB-2024-002",
            "article_title": "API接口规范v2.0",
            "space_id": "SPACE-DEV",
            "space_name": "技术开发部",
            "publish_time": (now.replace(hour=14, minute=0, second=0)).strftime('%Y-%m-%d %H:%M:%S'),
            "rollback_time": (now.replace(hour=15, minute=0, second=0)).strftime('%Y-%m-%d %H:%M:%S'),
            "operator": "李四",
            "rollback_version": "v1.9",
            "previous_version": "v1.9",
            "status": "SUCCESS",
            "attachments": [],
            "rolled_back_attachments": [],
            "processing_log": ["开始回滚处理", "版本恢复完成"]
        },
        {
            "article_id": "KB-2024-003",
            "article_title": "Q2季度预算方案",
            "space_id": "SPACE-FINANCE",
            "space_name": "财务部",
            "publish_time": (now.replace(hour=16, minute=0, second=0)).strftime('%Y-%m-%d %H:%M:%S'),
            "rollback_time": (now.replace(minute=now.minute-1, second=0)).strftime('%Y-%m-%d %H:%M:%S'),
            "operator": "王五",
            "rollback_version": "v2.1",
            "previous_version": "v2.1",
            "status": "SUCCESS",
            "attachments": ["预算表格.xlsx"],
            "rolled_back_attachments": ["预算表格.xlsx"],
            "processing_log": ["开始回滚处理", "版本恢复完成"]
        },
        {
            "article_id": "KB-2024-004",
            "article_title": "用户操作手册完整版",
            "space_id": "SPACE-SUPPORT",
            "space_name": "客户支持部",
            "publish_time": (now.replace(hour=8, minute=0, second=0)).strftime('%Y-%m-%d %H:%M:%S'),
            "rollback_time": (now.replace(hour=9, minute=0, second=0)).strftime('%Y-%m-%d %H:%M:%S'),
            "operator": "赵六",
            "rollback_version": "v3.0",
            "previous_version": "v3.0",
            "status": "SUCCESS",
            "attachments": ["手册插图1.png", "流程图.svg", "附录.docx"],
            "rolled_back_attachments": ["手册插图1.png", "流程图.svg"],
            "processing_log": ["开始回滚处理", "版本恢复完成"]
        },
        {
            "article_id": "KB-2024-005",
            "article_title": "系统架构设计文档",
            "space_id": "SPACE-ARCH",
            "space_name": "架构组",
            "publish_time": (now.replace(hour=11, minute=0, second=0)).strftime('%Y-%m-%d %H:%M:%S'),
            "rollback_time": (now.replace(hour=12, minute=0, second=0)).strftime('%Y-%m-%d %H:%M:%S'),
            "operator": "钱七",
            "rollback_version": "v2.5",
            "previous_version": "v2.5",
            "status": "SUCCESS",
            "attachments": ["架构图.pdf"],
            "rolled_back_attachments": ["架构图.pdf"],
            "processing_log": ["开始回滚处理", "cache_hit detected", "版本恢复完成"]
        }
    ]
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(sample_data, f, ensure_ascii=False, indent=2)
    
    click.echo(f"✅ 样例日志文件已生成: {output_file}")
    click.echo("   包含 5 条测试记录:")
    click.echo("   • 2 条正常回滚成功")
    click.echo("   • 1 条索引延迟（回滚时间 < 5分钟）")
    click.echo("   • 1 条附件未完全回滚")
    click.echo("   • 1 条缓存命中")


def main():
    cli()


if __name__ == '__main__':
    main()
