"""命令行工具

提供可复现的命令行接口，支持：
- 初始化数据库
- 导入模型输出
- 人工改判（完整改判 / 只改备注）
- 产品复盘
- 查看变更历史
- 生成复盘命令

设计原则：
- 每条命令都输出当前处理状态和结果说明
- 产品复盘输出完整的可追溯证据，不是功能清单
"""

import json
import sys
import click
from .database import get_session, init_db as db_init
from .workflow import (
    step1_import_model_outputs,
    step2_manual_review,
    step3_product_review,
    generate_replay_commands
)
from .core import (
    get_fragment_history, get_sample_risk_timeline,
    get_fragment_current_state, update_status
)


@click.group()
def cli():
    """邮件自动回复风险管理系统"""
    pass


@cli.command()
@click.option("--db-path", default="data/email_risk.db", help="数据库路径")
def init_db(db_path):
    """初始化数据库"""
    db_init(db_path)
    click.echo(f"数据库已初始化: {db_path}")


@cli.command("import")
@click.option("--file", "-f", "file_path", required=True, help="模型输出文件路径 (CSV/JSON)")
@click.option("--model-version", "-m", required=True, help="模型版本号")
@click.option("--by", "-b", "imported_by", required=True, help="导入人")
@click.option("--batch-id", help="指定批次ID（用于重复导入检测）")
@click.option("--remark", help="备注")
@click.option("--db-path", default="data/email_risk.db", help="数据库路径")
def import_model(file_path, model_version, imported_by, batch_id, remark, db_path):
    """步骤1：导入模型输出片段"""
    session = get_session(db_path)
    result = step1_import_model_outputs(
        session, file_path, model_version, imported_by,
        batch_id=batch_id, remark=remark
    )
    
    click.echo("=" * 70)
    click.echo(result["step_name"])
    click.echo("=" * 70)
    click.echo(f"批次ID: {result['batch_id']}")
    click.echo(f"模型版本: {result['model_version']}")
    click.echo(f"导入人: {result['imported_by']}")
    click.echo(f"片段数: {result['fragments_count']}")
    click.echo()
    
    click.echo("当前处理状态分布:")
    for status, count in result["current_status_breakdown"].items():
        click.echo(f"  {status}: {count} 条")
    click.echo()
    
    click.echo(result["result_explanation"])
    click.echo()
    
    click.echo(f"可重放命令: {result['replay_command']}")
    
    click.echo()
    click.echo("片段当前状态一览:")
    for f in result["fragments_current_state"]:
        click.echo(f"  片段{f['fragment_id']} 行{f['original_line_number']} "
                   f"版本{f['model_version']}: "
                   f"风险={f['current_is_auto_reply_risk']} "
                   f"状态={f['processing_status']}")
        if f["current_remark"]:
            click.echo(f"    备注: {f['current_remark']}")


@cli.command()
@click.option("--file", "-f", "file_path", required=True, help="人工改判表 JSON 文件")
@click.option("--reviewer", "-r", required=True, help="改判人（如：周姐）")
@click.option("--batch-id", "review_batch_id", help="改判批次ID")
@click.option("--db-path", default="data/email_risk.db", help="数据库路径")
def review(file_path, reviewer, review_batch_id, db_path):
    """步骤2：人工改判 - 标注负责人补看人工改判表
    
    支持两种改判模式：
    1. 完整改判: {"fragment_id": 1, "reviewed_is_risk": false, "remark": "..."}
    2. 只改备注: {"fragment_id": 1, "only_edit_remark": true, "remark": "..."}
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        review_records = json.load(f)
    
    session = get_session(db_path)
    result = step2_manual_review(
        session, review_records, reviewer, review_batch_id,
        source_file=file_path
    )
    
    click.echo("=" * 70)
    click.echo(result["step_name"])
    click.echo("=" * 70)
    click.echo(f"改判人: {result['reviewer']}")
    click.echo(f"总改判: {result['total_reviewed']} 条")
    click.echo(f"  完整改判: {result['manual_edit_count']} 条")
    click.echo(f"  仅改备注: {result['remark_edit_count']} 条")
    click.echo()
    
    click.echo(result["result_explanation"])
    click.echo()
    
    click.echo(f"可重放命令: {result['replay_command']}")
    
    click.echo()
    click.echo("改判后当前状态:")
    for f in result["fragments_current_state_after"]:
        click.echo(f"  片段{f['fragment_id']}: "
                   f"风险={f['current_is_auto_reply_risk']} "
                   f"状态={f['processing_status']}")
        if f["current_remark"]:
            click.echo(f"    备注: {f['current_remark']}")


@cli.command("product-review")
@click.option("--sample-id", help="样本编号")
@click.option("--batch-id", help="导入批次ID")
@click.option("--export", "-e", "export_path", help="导出JSON路径")
@click.option("--db-path", default="data/email_risk.db", help="数据库路径")
def product_review(sample_id, batch_id, export_path, db_path):
    """步骤3：产品复盘 - 生成完整时间线
    
    核心产出（不是功能清单）：
    - 当前处理状态一览
    - 完整变更历史
    - 结果说明文字
    - 可重跑命令
    """
    if not sample_id and not batch_id:
        click.echo("错误：必须指定 --sample-id 或 --batch-id")
        sys.exit(1)
    
    session = get_session(db_path)
    result = step3_product_review(session, sample_id, batch_id, export_path)
    
    click.echo("=" * 70)
    click.echo(result["step_name"])
    click.echo("=" * 70)
    
    if sample_id:
        click.echo(f"样本: {sample_id}")
        click.echo(f"片段数: {result['fragments_count']}")
        click.echo(f"涉及版本: {', '.join(result['model_versions'])}")
        click.echo()
        
        click.echo("当前处理状态分布:")
        for status, count in result["current_status_breakdown"].items():
            click.echo(f"  {status}: {count} 条")
        click.echo()
        
        click.echo("各片段当前状态:")
        for f in result["fragments_current_state"]:
            click.echo(f"  片段{f['fragment_id']} 行{f['original_line_number']} "
                       f"版本{f['model_version']}: "
                       f"风险={f['current_is_auto_reply_risk']} "
                       f"状态={f['processing_status']}")
            if f["current_remark"]:
                click.echo(f"    备注: {f['current_remark']}")
        click.echo()
        
        click.echo("-" * 70)
        click.echo("结果说明:")
        click.echo("-" * 70)
        click.echo(result["result_explanation"])
        
        click.echo()
        click.echo("-" * 70)
        click.echo("可重跑命令:")
        click.echo("-" * 70)
        for cmd in result["replay_commands"]:
            click.echo(f"  [{cmd['step']}] {cmd['description']}")
            click.echo(f"    {cmd['command']}")
    
    if batch_id:
        click.echo(f"批次: {batch_id}")
        click.echo(f"模型版本: {result['model_version']}")
        click.echo(f"样本数: {result['sample_count']}")
        click.echo(f"片段数: {result['fragment_count']}")
        click.echo()
        
        click.echo("-" * 70)
        click.echo("结果说明:")
        click.echo("-" * 70)
        click.echo(result["result_explanation"])
        
        click.echo()
        click.echo("-" * 70)
        click.echo("可重跑命令:")
        click.echo("-" * 70)
        for cmd in result["replay_commands"]:
            click.echo(f"  [{cmd['step']}] {cmd['description']}")
            click.echo(f"    {cmd['command']}")
    
    if export_path:
        click.echo()
        click.echo(f"复盘报告已导出到: {export_path}")


@cli.command("fragment-history")
@click.option("--fragment-id", type=int, required=True, help="片段ID")
@click.option("--db-path", default="data/email_risk.db", help="数据库路径")
def fragment_history(fragment_id, db_path):
    """查看单条片段的完整变更历史 - 运营复核人追问时用"""
    session = get_session(db_path)
    
    current = get_fragment_current_state(session, fragment_id)
    history = get_fragment_history(session, fragment_id)
    
    click.echo("=" * 70)
    click.echo(f"片段 {fragment_id} - 当前状态")
    click.echo("=" * 70)
    click.echo(f"  样本: {current['sample_id']}")
    click.echo(f"  模型版本: {current['model_version']}")
    click.echo(f"  原始行号: {current['original_line_number']}")
    click.echo(f"  模型原始判断: {current['original_is_auto_reply_risk']}")
    click.echo(f"  当前风险标记: {current['current_is_auto_reply_risk']}")
    click.echo(f"  当前处理状态: {current['processing_status']}")
    click.echo(f"  当前备注: {current['current_remark']}")
    click.echo(f"  最后更新: {current['last_updated_at']} by {current['last_updated_by']}")
    
    click.echo()
    click.echo("=" * 70)
    click.echo(f"片段 {fragment_id} - 变更历史（共 {len(history)} 条）")
    click.echo("=" * 70)
    
    for i, h in enumerate(history, 1):
        click.echo()
        click.echo(f"[{i}] 变更ID: {h['change_id']}  类型: {h['change_type']}")
        click.echo(f"    操作人: {h['changed_by']}  时间: {h['changed_at']}")
        click.echo(f"    原始行号: {h['original_line_number']}")
        
        if h['model_version_before'] or h['model_version_after']:
            click.echo(f"    模型版本: {h['model_version_before']} → {h['model_version_after']}")
        
        click.echo(f"    风险标记: {h['is_risk_before']} → {h['is_risk_after']}")
        click.echo(f"    处理状态: {h['status_before']} → {h['status_after']}")
        
        if h['remark']:
            click.echo(f"    备注: {h['remark']}")
        
        if h['batch_id']:
            click.echo(f"    批次: {h['batch_id']}")


@cli.command("sample-timeline")
@click.option("--sample-id", required=True, help="样本编号")
@click.option("--db-path", default="data/email_risk.db", help="数据库路径")
def sample_timeline(sample_id, db_path):
    """查看单样本的完整风险时间线 - 产品复盘用"""
    session = get_session(db_path)
    timeline = get_sample_risk_timeline(session, sample_id)
    
    click.echo("=" * 70)
    click.echo(f"样本 {sample_id} - 风险时间线")
    click.echo("=" * 70)
    click.echo(f"片段数: {timeline['fragments_count']}")
    click.echo(f"涉及模型版本: {', '.join(timeline['model_versions'])}")
    click.echo()
    
    click.echo("当前处理状态分布:")
    for status, count in timeline["current_status_breakdown"].items():
        click.echo(f"  {status}: {count} 条")
    click.echo()
    
    click.echo("各版本风险分布:")
    for version, breakdown in timeline["risk_breakdown_by_version"].items():
        click.echo(f"  版本 {version}: 风险{breakdown['risk']} / 正常{breakdown['normal']} / 总计{breakdown['total']}")
    click.echo()
    
    click.echo("-" * 70)
    click.echo("结果说明:")
    click.echo("-" * 70)
    click.echo(timeline["result_explanation"])
    
    click.echo()
    click.echo("-" * 70)
    click.echo("可重跑命令:")
    click.echo("-" * 70)
    for cmd in timeline["replay_commands"]:
        click.echo(f"  [{cmd['step']}] {cmd['description']}")
        click.echo(f"    {cmd['command']}")


@cli.command("replay-commands")
@click.option("--batch-id", required=True, help="导入批次ID")
@click.option("--db-path", default="data/email_risk.db", help="数据库路径")
def replay_commands(batch_id, db_path):
    """生成可重新跑的命令列表 - 复盘时复现"""
    session = get_session(db_path)
    commands = generate_replay_commands(session, batch_id)
    
    click.echo("=" * 70)
    click.echo(f"批次 {batch_id} - 可重放命令")
    click.echo("=" * 70)
    
    for cmd in commands:
        click.echo()
        click.echo(f"# [{cmd['step']}] {cmd['description']}")
        click.echo(cmd['command'])


@cli.command("update-status")
@click.option("--fragment-id", type=int, required=True, help="片段ID")
@click.option("--new-status", required=True, help="新状态")
@click.option("--by", "changed_by", required=True, help="操作人")
@click.option("--remark", help="备注")
@click.option("--db-path", default="data/email_risk.db", help="数据库路径")
def update_status_cmd(fragment_id, new_status, changed_by, remark, db_path):
    """更新风险处理状态（运营复核人用）"""
    session = get_session(db_path)
    result = update_status(session, fragment_id, new_status, changed_by, remark)
    
    click.echo(f"片段 {fragment_id} 状态已更新:")
    click.echo(f"  原状态: {result['original_status']}")
    click.echo(f"  新状态: {result['new_status']}")
    click.echo(f"  操作人: {result['changed_by']}")


if __name__ == "__main__":
    cli()
