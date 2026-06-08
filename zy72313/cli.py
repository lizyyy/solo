#!/usr/bin/env python3
import click
import yaml
import json
import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import Dict

from markov_churn import (
    MarkovChurnModel,
    DataImporter,
    HistoryManager,
    ReviewSystem,
    Visualizer
)


def load_config(config_path: str = "config.yaml"):
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def get_model_path(data_dir: Path) -> Path:
    return data_dir / "model_state.json"


def load_or_init_model(config: Dict) -> MarkovChurnModel:
    data_dir = Path(config['system']['data_dir'])
    model_path = get_model_path(data_dir)
    if model_path.exists():
        try:
            return MarkovChurnModel.load(str(model_path))
        except Exception:
            pass
    return MarkovChurnModel(
        states=config['markov_model']['states'],
        smoothing_factor=config['markov_model']['smoothing_factor']
    )


def save_model(model: MarkovChurnModel, config: Dict) -> None:
    data_dir = Path(config['system']['data_dir'])
    model_path = get_model_path(data_dir)
    model_path.parent.mkdir(parents=True, exist_ok=True)
    model.save(str(model_path))


@click.group()
@click.option('--config', default='config.yaml', help='配置文件路径')
@click.pass_context
def cli(ctx, config):
    """Markov 客户流失转移分析系统"""
    ctx.ensure_object(dict)
    ctx.obj['config'] = load_config(config)
    ctx.obj['data_dir'] = Path(ctx.obj['config']['system']['data_dir'])
    ctx.obj['data_dir'].mkdir(parents=True, exist_ok=True)


@cli.command()
@click.pass_context
def init(ctx):
    """初始化系统目录结构"""
    config = ctx.obj['config']
    for dir_key in ['data_dir', 'history_dir', 'import_dir', 'export_dir']:
        Path(config['system'][dir_key]).mkdir(parents=True, exist_ok=True)
    click.echo("系统初始化完成")


@cli.command()
@click.argument('file_path')
@click.option('--skip-duplicates/--no-skip-duplicates', default=True, help='跳过重复文件')
@click.option('--check-multiple/--no-check-multiple', default=True, help='检查多版本答案')
@click.pass_context
def import_data(ctx, file_path, skip_duplicates, check_multiple):
    """导入CSV数据文件（旧公式截图第一次导入）"""
    config = ctx.obj['config']
    
    history_mgr = HistoryManager(config['system']['history_dir'])
    importer = DataImporter(config['system']['import_dir'], history_mgr)
    model = load_or_init_model(config)
    
    result = importer.import_csv(file_path, model, skip_duplicates, check_multiple)

    printable = dict(result)
    if "duplicate_reasons" in printable:
        printable["duplicate_reasons_count"] = len(printable["duplicate_reasons"])
    click.echo(json.dumps(printable, ensure_ascii=False, indent=2))
    
    if result.get('requires_review'):
        review_sys = ReviewSystem(
            Path(config['system']['data_dir']) / "reviews.json",
            history_mgr
        )
        summaries = []
        for student_id in result.get('multiple_answer_students', []):
            summaries.append(model.get_student_version_summary(student_id))
        created = review_sys.create_batch_multiple_answer_reviews(
            summaries, result.get('source_file', '')
        )
        for rev in created:
            data = rev.data
            click.echo(
                f"创建独立复核任务: {rev.review_id} | 学生{data.get('student_id')} | "
                f"{data.get('version_count')}版答案 | 状态:{rev.status}"
            )

    save_model(model, config)


@cli.command()
@click.option('--student-id', help='学生ID')
@click.pass_context
def check_answers(ctx, student_id):
    """唐老师补看老师批注 - 检查学生多版答案情况"""
    config = ctx.obj['config']
    
    history_mgr = HistoryManager(config['system']['history_dir'])
    review_sys = ReviewSystem(
        Path(config['system']['data_dir']) / "reviews.json",
        history_mgr
    )
    model = load_or_init_model(config)
    
    if student_id:
        has_multiple, version_groups = model.check_multiple_answers(student_id)
        summary = model.get_student_version_summary(student_id)
        click.echo(json.dumps(summary, ensure_ascii=False, indent=2))
    else:
        pending = review_sys.get_pending_reviews('multiple_answers')
        click.echo(f"待处理的多版答案复核任务: {len(pending)}")
        for p in pending:
            d = p.data
            click.echo(
                f"  {p.review_id} | 学生{d.get('student_id')} | "
                f"{d.get('version_count')}版 | 分配给:{','.join(p.assigned_to)} | "
                f"创建于{p.created_at}"
            )


@cli.command()
@click.argument('review_id')
@click.argument('action', type=click.Choice(['approve', 'reject', 'info']))
@click.option('--approver', 'author', required=True, help='操作人')
@click.option('--comment', default='', help='评论')
@click.pass_context
def review(ctx, review_id, action, author, comment):
    """处理复核任务（approve/reject/info）"""
    config = ctx.obj['config']
    history_mgr = HistoryManager(config['system']['history_dir'])
    review_sys = ReviewSystem(
        Path(config['system']['data_dir']) / "reviews.json",
        history_mgr
    )
    
    if action == 'approve':
        result = review_sys.approve(review_id, approver=author, comment=comment)
        click.echo(f"已批准: {result.review_id} by {result.resolved_by} at {result.resolved_at}")
    elif action == 'reject':
        result = review_sys.reject(review_id, rejector=author, reason=comment)
        click.echo(f"已拒绝: {result.review_id} by {result.resolved_by}")
    elif action == 'info':
        result = review_sys.request_more_info(review_id, requester=author, info_requested=comment)
        click.echo(f"已请求更多信息: {result.review_id}")


@cli.command()
@click.option('--limit', default=10, help='显示数量')
@click.option('--status', help='状态过滤')
@click.pass_context
def list_reviews(ctx, limit, status):
    """列出复核任务"""
    config = ctx.obj['config']
    history_mgr = HistoryManager(config['system']['history_dir'])
    review_sys = ReviewSystem(
        Path(config['system']['data_dir']) / "reviews.json",
        history_mgr
    )
    
    reviews = review_sys.list_reviews(status=status, limit=limit)
    for r in reviews:
        click.echo(f"{r.review_id} | {r.status:12} | {r.review_type:20} | {r.created_at}")


@cli.command()
@click.option('--limit', default=10, help='显示数量')
@click.pass_context
def history(ctx, limit):
    """查看版本历史"""
    config = ctx.obj['config']
    history_mgr = HistoryManager(config['system']['history_dir'])
    versions = history_mgr.list_versions(limit=limit)
    
    for v in versions:
        rollback_marker = "[回滚]" if v.is_rollback else ""
        click.echo(f"{v.version_id} | {v.author:10} | {v.description} {rollback_marker}")


@cli.command()
@click.argument('version1')
@click.argument('version2')
@click.pass_context
def compare(ctx, version1, version2):
    """对比两个版本"""
    config = ctx.obj['config']
    history_mgr = HistoryManager(config['system']['history_dir'])
    
    result = history_mgr.compare_versions(version1, version2)
    click.echo('\n'.join(result['diff']))


@cli.command()
@click.argument('version_id')
@click.option('--author', required=True, help='操作人')
@click.option('--reason', default='', help='回滚原因')
@click.pass_context
def rollback(ctx, version_id, author, reason):
    """回滚到指定版本"""
    config = ctx.obj['config']
    history_mgr = HistoryManager(config['system']['history_dir'])
    
    result = history_mgr.rollback_to_version(version_id, author, reason)
    click.echo(f"回滚完成，新版本: {result['rollback_version_id']}")


@cli.command()
@click.option('--view', type=click.Choice(['2d', '3d', 'all']), default='all', help='可视化类型')
@click.option('--prefix', default='', help='输出文件前缀')
@click.pass_context
def visualize(ctx, view, prefix):
    """生成可视化图表（点击数据点可回到原始数据+复核链接）"""
    config = ctx.obj['config']
    model = load_or_init_model(config)
    viz = Visualizer(
        model,
        config['system']['export_dir'],
        enable_3d=config['visualization']['enable_3d']
    )
    
    model.estimate_transition_matrix()
    
    exports = {}
    if view in ['2d', 'all']:
        exports['heatmap'] = viz.plot_transition_matrix_heatmap(
            save_path=f"{prefix}transition_matrix_heatmap.png"
        )
        exports['distribution'] = viz.plot_state_distribution(
            save_path=f"{prefix}state_distribution.png"
        )
        exports['sankey'] = viz.plot_transition_sankey(
            save_path=f"{prefix}transition_sankey.html"
        )
    
    if view in ['3d', 'all'] and viz.enable_3d:
        exports['3d'] = viz.plot_3d_transition(
            save_path=f"{prefix}3d_transition.html"
        )
    
    click.echo("生成的图表:")
    for name, path in exports.items():
        if path:
            click.echo(f"  {name}: {path}")
    click.echo("\n点击数据点溯源命令:")
    click.echo("  python cli.py lookup <customer_id>")


@cli.command()
@click.argument('customer_id')
@click.pass_context
def lookup(ctx, customer_id):
    """查看客户详细数据+当前误差说明/备注（点击图表时回到原始数据）"""
    config = ctx.obj['config']
    model = load_or_init_model(config)
    viz = Visualizer(model, config['system']['export_dir'])
    
    data = viz.get_clickable_data_point(customer_id)

    history_mgr = HistoryManager(config['system']['history_dir'])
    review_sys = ReviewSystem(
        Path(config['system']['data_dir']) / "reviews.json",
        history_mgr
    )
    reviews = [r for r in review_sys.list_reviews()
               if r.data.get("customer_id") == customer_id
               or r.data.get("student_id") in {
                   h.get("student_id") for h in data.get("state_history", []) if h.get("student_id")
               }]
    data["linked_reviews"] = [
        {"review_id": r.review_id, "status": r.status,
         "review_type": r.review_type, "description": r.description}
        for r in reviews
    ]
    click.echo(json.dumps(data, ensure_ascii=False, indent=2))


@cli.command(name="update-error-note")
@click.argument('customer_id')
@click.argument('timestamp')
@click.argument('new_text')
@click.option('--modifier', required=True, help='修改人，如 唐老师')
@click.option('--reason', default='', help='处理原因/误差说明来源')
@click.option('--need-review/--no-need-review', default=False, help='是否同时发起复核')
@click.pass_context
def update_error_note(ctx, customer_id, timestamp, new_text, modifier, reason, need_review):
    """更新误差说明（竞赛教练唐老师改备注：保存改前/改后文本+修改人+原因）"""
    config = ctx.obj['config']
    model = load_or_init_model(config)
    history_mgr = HistoryManager(config['system']['history_dir'])
    review_sys = ReviewSystem(
        Path(config['system']['data_dir']) / "reviews.json",
        history_mgr
    )

    ts = pd.to_datetime(timestamp).to_pydatetime()
    current = model.find_state_record(customer_id, ts)
    if current is None:
        click.echo(json.dumps({
            "status": "error",
            "message": f"未找到客户{customer_id}在{timestamp}的记录；请先使用 python cli.py import-data 导入数据"
        }, ensure_ascii=False, indent=2))
        ctx.exit(1)
    old_text = current.error_notes

    result = model.update_error_notes(customer_id, ts, new_text, modifier, reason)
    click.echo(json.dumps(result, ensure_ascii=False, indent=2))

    if result["status"] == "success":
        version_id, change = history_mgr.record_error_note_update(result)
        click.echo(f"已记录版本: {version_id}")

        if need_review:
            rev = review_sys.create_error_note_review(
                customer_id=customer_id,
                timestamp=result["timestamp"],
                old_error=result["old_value"],
                new_error=result["new_value"],
                student_id=result.get("student_id"),
                answer_version=result.get("answer_version"),
                author=modifier,
                reason=reason
            )
            click.echo(f"已创建复核任务: {rev.review_id}")

    save_model(model, config)


@cli.command(name="update-annotation")
@click.argument('customer_id')
@click.argument('timestamp')
@click.argument('annotation_json')
@click.option('--modifier', required=True, help='修改人')
@click.option('--reason', default='', help='处理原因')
@click.option('--need-review/--no-need-review', default=False)
@click.pass_context
def update_annotation(ctx, customer_id, timestamp, annotation_json, modifier, reason, need_review):
    """更新备注/老师批注（保存改前改后+修改人+原因）"""
    config = ctx.obj['config']
    model = load_or_init_model(config)
    history_mgr = HistoryManager(config['system']['history_dir'])
    review_sys = ReviewSystem(
        Path(config['system']['data_dir']) / "reviews.json",
        history_mgr
    )

    ts = pd.to_datetime(timestamp).to_pydatetime()
    if model.find_state_record(customer_id, ts) is None:
        click.echo(json.dumps({
            "status": "error",
            "message": f"未找到客户{customer_id}在{timestamp}的记录"
        }, ensure_ascii=False, indent=2))
        ctx.exit(1)

    new_ann = json.loads(annotation_json)
    result = model.update_annotations(customer_id, ts, new_ann, modifier, reason)
    click.echo(json.dumps(result, ensure_ascii=False, indent=2))

    if result["status"] == "success":
        version_id, change = history_mgr.record_annotation_update(result)
        click.echo(f"已记录版本: {version_id}")

        if need_review:
            item_id = f"{customer_id}@{result['timestamp']}"
            rev = review_sys.create_annotation_review(
                item_id=item_id,
                old_annotation=result["old_value"],
                new_annotation=result["new_value"],
                author=modifier,
                customer_id=customer_id,
                timestamp=result["timestamp"],
                student_id=result.get("student_id"),
                answer_version=result.get("answer_version"),
                reason=reason
            )
            click.echo(f"已创建复核任务: {rev.review_id}")

    save_model(model, config)


@cli.command(name="rollback-field")
@click.argument('customer_id')
@click.argument('timestamp')
@click.argument('field', type=click.Choice(['error_notes', 'annotations']))
@click.option('--modifier', required=True, help='执行回滚的人')
@click.option('--reason', default='回滚到上一份说明', help='回滚原因')
@click.pass_context
def rollback_field(ctx, customer_id, timestamp, field, modifier, reason):
    """回滚误差说明或备注到上一份（从历史中找旧值）"""
    config = ctx.obj['config']
    model = load_or_init_model(config)
    history_mgr = HistoryManager(config['system']['history_dir'])

    old = history_mgr.find_previous_field_value(customer_id, timestamp, field)
    if old is None:
        click.echo(json.dumps({
            "status": "error",
            "message": "在历史版本中未找到上一份对应字段的值，无法回滚"
        }, ensure_ascii=False, indent=2))
        ctx.exit(1)

    ts = pd.to_datetime(timestamp).to_pydatetime()
    rb = model.rollback_field_update(customer_id, ts, field, old, modifier, reason)
    click.echo(json.dumps(rb, ensure_ascii=False, indent=2))

    if rb["status"] == "success":
        vid, _ = history_mgr.record_field_rollback(rb)
        click.echo(f"已记录回滚版本: {vid}")

    save_model(model, config)


@cli.command(name="report-summary")
@click.pass_context
def report_summary(ctx):
    """生成复盘报告摘要：复核列表、学生编号、版本、状态、历史、操作统计"""
    config = ctx.obj['config']
    history_mgr = HistoryManager(config['system']['history_dir'])
    review_sys = ReviewSystem(
        Path(config['system']['data_dir']) / "reviews.json",
        history_mgr
    )

    all_reviews = review_sys.list_reviews()
    review_summary = []
    student_status = {}
    for r in all_reviews:
        d = r.data
        row = {
            "review_id": r.review_id,
            "type": r.review_type,
            "status": r.status,
            "student_id": d.get("student_id", d.get("customer_id", "")),
            "answer_versions": (
                sorted(d["versions"].keys()) if r.review_type == "multiple_answers" and "versions" in d
                else ([d.get("answer_version")] if d.get("answer_version") else [])
            ),
            "assigned_to": r.assigned_to,
            "created_at": r.created_at,
            "resolved_by": r.resolved_by,
            "resolution": r.resolution,
            "description": r.description
        }
        review_summary.append(row)
        sid = row["student_id"]
        if sid:
            if sid not in student_status:
                student_status[sid] = {"reviews": 0, "pending": 0, "approved": 0, "rejected": 0}
            student_status[sid]["reviews"] += 1
            student_status[sid][r.status] = student_status[sid].get(r.status, 0) + 1

    report = {
        "generated_at": datetime.now().isoformat(),
        "review_summary": review_summary,
        "student_review_status": student_status,
        "history_summary": history_mgr.summary_report(),
        "consistency_check": {
            "review_count_match": (
                len(all_reviews)
                == history_mgr.summary_report()["operation_counts"].get("review_approve", 0)
                + sum(1 for r in all_reviews if r.status != "approved")
            ),
            "pending_multiple_answers_count": len(review_sys.get_pending_reviews("multiple_answers"))
        }
    }
    click.echo(json.dumps(report, ensure_ascii=False, indent=2))


@cli.command()
@click.pass_context
def run_workflow(ctx):
    """运行标准三步工作流: 导入->检查批注->更新误差说明"""
    config = ctx.obj['config']
    click.echo("=== 三步工作流开始 ===")
    
    click.echo("\n步骤1: 导入旧公式截图数据")
    import_file = Path(config['system']['import_dir']) / "formula_data.csv"
    if import_file.exists():
        ctx.invoke(import_data, file_path=str(import_file), skip_duplicates=True, check_multiple=True)
    else:
        click.echo(f"  提示: 请将公式截图数据放入 {import_file}")
    
    click.echo("\n步骤2: 检查老师批注")
    ctx.invoke(check_answers, student_id=None)
    
    click.echo("\n步骤3: 更新误差说明")
    click.echo("  待复核任务批准后，使用 review 命令处理")
    
    click.echo("\n=== 工作流完成 ===")
    click.echo("\n可复现命令记录:")
    click.echo(f"  python cli.py import-data {import_file}")
    click.echo("  python cli.py check-answers")
    click.echo("  python cli.py review <review_id> approve --author 唐老师")


@cli.command()
@click.pass_context
def boundary_rules(ctx):
    """显示边界规则"""
    config = ctx.obj['config']
    rules = config['boundary_rules']
    
    click.echo("=== Markov 客户流失转移边界规则 ===")
    click.echo(f"\n1. 同一学生多版答案: {rules['same_student_multiple_answers']}")
    click.echo("   - 触发: 导入时检测到同一student_id存在多版answer_version")
    click.echo("   - 处理: 创建复核任务，等待业务运营确认")
    click.echo("   - 不自动合并，不覆盖")
    
    click.echo(f"\n2. 重复导入处理: {rules['duplicate_import_handling']}")
    click.echo("   - 触发: 文件哈希匹配之前导入的文件")
    click.echo("   - 处理: 跳过导入，不重复计数")
    click.echo("   - 可通过 --no-skip-duplicates 强制导入")
    
    click.echo(f"\n3. 批注更新模式: {rules['annotation_update_mode']}")
    click.echo("   - 触发: 唐老师修改备注时")
    click.echo("   - 处理: 记录版本历史，保留改前改后对比")
    click.echo("   - 可通过 history/compare 命令查看差异")
    
    click.echo(f"\n4. 3D/图表展示复核: {'启用' if config['visualization']['show_raw_data_on_click'] else '禁用'}")
    click.echo("   - 触发: 点击图表数据点时")
    click.echo("   - 处理: 显示原始数据、学生ID、答案版本、来源文件")
    click.echo("   - 提供复核链接和批注链接")
    
    click.echo("\n5. 回滚机制")
    click.echo("   - 支持按版本号回滚")
    click.echo("   - 回滚操作本身也记录为新版本")
    click.echo("   - 保留完整操作审计链")


if __name__ == '__main__':
    cli()
