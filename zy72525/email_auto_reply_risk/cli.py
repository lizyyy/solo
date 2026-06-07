"""命令行工具

提供可复现的命令行接口，支持：
- 初始化数据库
- 导入模型输出
- 人工改判
- 产品复盘
- 查看变更历史
- 生成复盘命令
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
from .core import get_fragment_history, get_sample_risk_timeline


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


@cli.command()
@click.option("--file", "-f", required=True, help="模型输出文件路径 (CSV/JSON)")
@click.option("--model-version", "-m", required=True, help="模型版本号")
@click.option("--by", "-b", required=True, help="导入人")
@click.option("--batch-id", help="指定批次ID（用于重复导入检测）")
@click.option("--remark", help="备注")
@click.option("--db-path", default="data/email_risk.db", help="数据库路径")
def import_model(file, model_version, by, batch_id, remark, db_path):
    """步骤1：导入模型输出片段"""
    session = get_session(db_path)
    result = step1_import_model_outputs(
        session, file, model_version, by,
        batch_id=batch_id, remark=remark
    )
    click.echo(json.dumps(result, ensure_ascii=False, indent=2))
    click.echo(f"\n可重放命令: {result['replay_command']}")


@cli.command()
@click.option("--file", "-f", required=True, help="人工改判表 JSON 文件")
@click.option("--reviewer", "-r", required=True, help="改判人（如：周姐）")
@click.option("--batch-id", help="改判批次ID")
@click.option("--db-path", default="data/email_risk.db", help="数据库路径")
def review(file, reviewer, batch_id, db_path):
    """步骤2：人工改判 - 标注负责人补看人工改判表"""
    with open(file, 'r', encoding='utf-8') as f:
        review_records = json.load(f)
    
    session = get_session(db_path)
    result = step2_manual_review(session, review_records, reviewer, batch_id)
    click.echo(json.dumps(result, ensure_ascii=False, indent=2))


@cli.command()
@click.option("--sample-id", help="样本编号")
@click.option("--batch-id", help="导入批次ID")
@click.option("--export", "-e", help="导出JSON路径")
@click.option("--db-path", default="data/email_risk.db", help="数据库路径")
def product_review(sample_id, batch_id, export, db_path):
    """步骤3：产品复盘 - 生成完整时间线"""
    if not sample_id and not batch_id:
        click.echo("错误：必须指定 --sample-id 或 --batch-id")
        sys.exit(1)
    
    session = get_session(db_path)
    result = step3_product_review(session, sample_id, batch_id, export)
    click.echo(json.dumps(result, ensure_ascii=False, indent=2))


@cli.command()
@click.option("--fragment-id", type=int, required=True, help="片段ID")
@click.option("--db-path", default="data/email_risk.db", help="数据库路径")
def fragment_history(fragment_id, db_path):
    """查看单条片段的完整变更历史 - 运营复核人追问时用"""
    session = get_session(db_path)
    history = get_fragment_history(session, fragment_id)
    
    click.echo(f"=== 片段 {fragment_id} 变更历史 ===")
    for h in history:
        click.echo(f"\n变更ID: {h['change_id']}")
        click.echo(f"  类型: {h['change_type']}")
        click.echo(f"  操作人: {h['changed_by']}")
        click.echo(f"  时间: {h['changed_at']}")
        click.echo(f"  原始行号: {h['original_line_number']}")
        if h['model_version_before'] or h['model_version_after']:
            click.echo(f"  模型版本: {h['model_version_before']} → {h['model_version_after']}")
        click.echo(f"  风险标记: {h['is_risk_before']} → {h['is_risk_after']}")
        if h['status_before'] or h['status_after']:
            click.echo(f"  状态: {h['status_before']} → {h['status_after']}")
        if h['remark']:
            click.echo(f"  备注: {h['remark']}")


@cli.command()
@click.option("--sample-id", required=True, help="样本编号")
@click.option("--db-path", default="data/email_risk.db", help="数据库路径")
def sample_timeline(sample_id, db_path):
    """查看单样本的完整风险时间线 - 产品复盘用"""
    session = get_session(db_path)
    timeline = get_sample_risk_timeline(session, sample_id)
    click.echo(json.dumps(timeline, ensure_ascii=False, indent=2))


@cli.command()
@click.option("--batch-id", required=True, help="导入批次ID")
@click.option("--db-path", default="data/email_risk.db", help="数据库路径")
def replay_commands(batch_id, db_path):
    """生成可重新跑的命令列表 - 复盘时复现"""
    session = get_session(db_path)
    commands = generate_replay_commands(session, batch_id)
    
    click.echo(f"=== 批次 {batch_id} 可重放命令 ===")
    for cmd in commands:
        click.echo()
        click.echo(cmd)


if __name__ == "__main__":
    cli()
