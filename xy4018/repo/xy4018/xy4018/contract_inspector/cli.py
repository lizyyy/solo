"""
命令行入口模块
"""

import click
from pathlib import Path
from datetime import datetime

from contract_inspector.config import ensure_data_dirs
from contract_inspector.parser import ContractParser
from contract_inspector.diff import ContractDiffer
from contract_inspector.rules import RuleEngine, load_rules
from contract_inspector.storage import TaskStorage
from contract_inspector.exporter import MarkdownExporter, CSVExporter


@click.group()
@click.version_option(version="0.1.0")
def cli():
    """合同改稿巡检器 - 小法务团队的本地命令行工具
    
    用于对比合同版本变化和风险规则扫描。
    """
    ensure_data_dirs()


@cli.command()
@click.argument('old_file', type=click.Path(exists=True, dir_okay=False))
@click.argument('new_file', type=click.Path(exists=True, dir_okay=False))
@click.option('--client', '-c', required=True, help='客户名称')
@click.option('--contract-name', '-n', required=True, help='合同名称')
@click.option('--rules', '-r', type=click.Path(exists=True, dir_okay=False), help='规则文件路径（YAML/JSON）')
def diff(old_file, new_file, client, contract_name, rules):
    """对比两版合同，生成差异摘要和风险扫描
    
    OLD_FILE: 旧版合同文件路径（.txt 或 .md）
    NEW_FILE: 新版合同文件路径（.txt 或 .md）
    """
    click.echo(f"📄 开始对比合同...")
    click.echo(f"   旧版: {old_file}")
    click.echo(f"   新版: {new_file}")
    
    parser = ContractParser()
    
    old_content = Path(old_file).read_text(encoding='utf-8')
    new_content = Path(new_file).read_text(encoding='utf-8')
    
    old_doc = parser.parse(old_content)
    new_doc = parser.parse(new_content)
    
    click.echo(f"\n📊 解析结果:")
    click.echo(f"   旧版: {old_doc['section_count']} 章节, {old_doc['clause_count']} 条款")
    click.echo(f"   新版: {new_doc['section_count']} 章节, {new_doc['clause_count']} 条款")
    
    differ = ContractDiffer()
    diff_result = differ.compare(old_doc, new_doc)
    
    click.echo(f"\n📋 差异摘要:")
    click.echo(f"   新增章节: {len(diff_result['added_sections'])} 个")
    click.echo(f"   删除章节: {len(diff_result['removed_sections'])} 个")
    click.echo(f"   修改章节: {len(diff_result['modified_sections'])} 个")
    click.echo(f"   新增条款: {len(diff_result['added_clauses'])} 个")
    click.echo(f"   删除条款: {len(diff_result['removed_clauses'])} 个")
    click.echo(f"   修改条款: {len(diff_result['modified_clauses'])} 个")
    
    risk_results = None
    if rules:
        click.echo(f"\n🔍 开始风险规则扫描...")
        rule_engine = RuleEngine()
        rules_data = load_rules(Path(rules))
        rule_engine.load_rules(rules_data)
        
        risk_results = rule_engine.scan(old_content, new_content, diff_result)
        
        total_risks = sum(len(risks) for risks in risk_results.values())
        high_risks = sum(1 for risks in risk_results.values() for r in risks if r.get('level') == 'high')
        medium_risks = sum(1 for risks in risk_results.values() for r in risks if r.get('level') == 'medium')
        low_risks = sum(1 for risks in risk_results.values() for r in risks if r.get('level') == 'low')
        
        click.echo(f"   扫描完成，发现 {total_risks} 个风险点:")
        if total_risks > 0:
            click.echo(f"   🔴 高风险: {high_risks} 个")
            click.echo(f"   🟡 中风险: {medium_risks} 个")
            click.echo(f"   🟢 低风险: {low_risks} 个")
    
    click.echo(f"\n💾 保存巡检任务...")
    storage = TaskStorage()
    task = storage.save_task(
        client=client,
        contract_name=contract_name,
        old_file=old_file,
        new_file=new_file,
        old_content=old_content,
        new_content=new_content,
        old_doc=old_doc,
        new_doc=new_doc,
        diff_result=diff_result,
        risk_results=risk_results
    )
    
    click.echo(f"   任务已保存: {task['id']}")
    click.echo(f"\n✅ 巡检完成！")
    click.echo(f"   使用 'contract-inspector show {task['id']}' 查看详细结果")
    click.echo(f"   使用 'contract-inspector export {task['id']}' 导出报告")


@cli.command()
@click.argument('task_id')
def show(task_id):
    """显示巡检任务详情
    
    TASK_ID: 任务ID
    """
    storage = TaskStorage()
    task = storage.get_task(task_id)
    
    if not task:
        click.echo(f"❌ 未找到任务: {task_id}")
        return
    
    click.echo(f"\n{'='*60}")
    click.echo(f"📋 巡检任务详情")
    click.echo(f"{'='*60}")
    click.echo(f"   任务ID: {task['id']}")
    click.echo(f"   客户名称: {task['client']}")
    click.echo(f"   合同名称: {task['contract_name']}")
    click.echo(f"   巡检时间: {task['created_at']}")
    
    diff_result = task.get('diff_result', {})
    click.echo(f"\n📊 差异统计:")
    click.echo(f"   新增章节: {len(diff_result.get('added_sections', []))} 个")
    click.echo(f"   删除章节: {len(diff_result.get('removed_sections', []))} 个")
    click.echo(f"   修改章节: {len(diff_result.get('modified_sections', []))} 个")
    click.echo(f"   新增条款: {len(diff_result.get('added_clauses', []))} 个")
    click.echo(f"   删除条款: {len(diff_result.get('removed_clauses', []))} 个")
    click.echo(f"   修改条款: {len(diff_result.get('modified_clauses', []))} 个")
    
    risk_results = task.get('risk_results')
    if risk_results:
        total_risks = sum(len(risks) for risks in risk_results.values())
        click.echo(f"\n⚠️  风险扫描结果:")
        click.echo(f"   总计风险点: {total_risks} 个")
        
        for rule_id, risks in risk_results.items():
            for risk in risks:
                level = risk.get('level', 'medium')
                level_icon = '🔴' if level == 'high' else '🟡' if level == 'medium' else '🟢'
                click.echo(f"\n   {level_icon} [{level.upper()}] {risk.get('rule_name', rule_id)}")
                if risk.get('old_text'):
                    click.echo(f"      原文: {risk['old_text'][:80]}..." if len(risk['old_text']) > 80 else f"      原文: {risk['old_text']}")
                if risk.get('new_text'):
                    click.echo(f"      新文: {risk['new_text'][:80]}..." if len(risk['new_text']) > 80 else f"      新文: {risk['new_text']}")
                if risk.get('suggestion'):
                    click.echo(f"      💡 建议: {risk['suggestion']}")


@cli.command('list')
@click.option('--client', '-c', help='按客户名称筛选')
@click.option('--contract-name', '-n', help='按合同名称筛选')
@click.option('--limit', '-l', type=int, default=20, help='显示最近N条记录（默认20）')
def list_tasks(client, contract_name, limit):
    """列出历史巡检任务"""
    storage = TaskStorage()
    tasks = storage.list_tasks(client=client, contract_name=contract_name, limit=limit)
    
    if not tasks:
        click.echo("📭 暂无巡检记录")
        return
    
    click.echo(f"\n{'='*100}")
    click.echo(f"{'ID':<20} {'客户':<15} {'合同名称':<25} {'巡检时间':<20}")
    click.echo(f"{'-'*100}")
    
    for task in tasks:
        click.echo(f"{task['id']:<20} {task['client'][:14]:<15} {task['contract_name'][:24]:<25} {task['created_at'][:19]:<20}")
    
    click.echo(f"{'='*100}")
    click.echo(f"\n共 {len(tasks)} 条记录")


@cli.command()
@click.argument('task_id')
@click.option('--format', '-f', type=click.Choice(['markdown', 'csv', 'both']), default='both', help='导出格式（默认both）')
@click.option('--output', '-o', help='输出目录路径')
def export(task_id, format, output):
    """导出巡检报告
    
    TASK_ID: 任务ID
    """
    storage = TaskStorage()
    task = storage.get_task(task_id)
    
    if not task:
        click.echo(f"❌ 未找到任务: {task_id}")
        return
    
    output_dir = Path(output) if output else None
    
    click.echo(f"📤 导出报告: {task_id}")
    
    if format in ['markdown', 'both']:
        exporter = MarkdownExporter()
        md_path = exporter.export(task, output_dir=output_dir)
        click.echo(f"   ✅ Markdown报告: {md_path}")
    
    if format in ['csv', 'both']:
        exporter = CSVExporter()
        csv_path = exporter.export(task, output_dir=output_dir)
        click.echo(f"   ✅ CSV风险清单: {csv_path}")
    
    click.echo(f"\n✅ 导出完成！")


@cli.command()
def demo():
    """运行演示任务（使用自带样例合同）"""
    click.echo("🎬 运行演示任务...")
    click.echo("   这将使用自带的样例合同执行一次完整的巡检流程")
    
    demo_dir = Path(__file__).parent.parent / "demo"
    old_file = demo_dir / "contract_v1.md"
    new_file = demo_dir / "contract_v2.md"
    rules_file = demo_dir / "rules.yaml"
    
    if not old_file.exists() or not new_file.exists() or not rules_file.exists():
        click.echo("❌ 演示文件不存在，请确保demo目录已完整创建")
        return
    
    from contract_inspector.cli import diff
    with click.Context(diff) as ctx:
        ctx.invoke(
            diff,
            old_file=str(old_file),
            new_file=str(new_file),
            client="演示客户",
            contract_name="演示合同",
            rules=str(rules_file)
        )


if __name__ == '__main__':
    cli()
