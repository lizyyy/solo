import click
from building_change_detection.pipeline import EvaluationPipeline


@click.group()
@click.option('--data-dir', default='data', help='数据目录路径')
@click.pass_context
def cli(ctx, data_dir):
    """城市遥感建筑变化检测 - 评测系统"""
    ctx.ensure_object(dict)
    ctx.obj['pipeline'] = EvaluationPipeline(data_dir)


@cli.command()
@click.argument('model_version')
@click.option('--old-caliber', default=None, help='旧口径版本号')
@click.option('--overwrite', is_flag=True, help='是否覆盖已有报告')
@click.option('--log-file', default=None, help='指定评测日志文件名')
@click.pass_context
def run(ctx, model_version, old_caliber, overwrite, log_file):
    """运行完整评测流程"""
    pipeline = ctx.obj['pipeline']
    try:
        result = pipeline.run_full_evaluation(
            model_version=model_version,
            old_caliber_version=old_caliber,
            overwrite=overwrite,
            log_file=log_file
        )
        click.echo("\n" + "=" * 50)
        click.echo("评测完成!")
        click.echo(f"报告ID: {result['report_id']}")
        click.echo(f"报告目录: {result['report_dir']}")
        click.echo(f"总记录数: {result['total_records']}")
        click.echo("\n处理建议:")
        for i, rec in enumerate(result['recommendations'], 1):
            click.echo(f"  {i}. {rec}")
    except FileExistsError as e:
        click.echo(f"错误: {e}", err=True)
    except Exception as e:
        click.echo(f"评测失败: {e}", err=True)


@cli.group()
def model():
    """模型版本管理"""
    pass


@model.command('list')
@click.pass_context
def list_models(ctx):
    """列出所有模型版本"""
    pipeline = ctx.obj['pipeline']
    versions = pipeline.list_model_versions()

    if not versions:
        click.echo("暂无模型版本")
        return

    click.echo("模型版本列表:")
    click.echo("-" * 60)
    for v in versions:
        active = "*" if v.is_active else " "
        click.echo(f"{active} {v.version} - {v.description}")
        click.echo(f"    创建时间: {v.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        if v.caliber_note:
            click.echo(f"    口径说明: {v.caliber_note}")


@model.command('register')
@click.argument('version')
@click.argument('description')
@click.option('--threshold', multiple=True, help='阈值配置，格式: key=value')
@click.option('--caliber-note', default=None, help='口径说明')
@click.pass_context
def register_model(ctx, version, description, threshold, caliber_note):
    """注册新模型版本"""
    pipeline = ctx.obj['pipeline']

    threshold_config = {}
    for t in threshold:
        if '=' in t:
            key, value = t.split('=', 1)
            try:
                threshold_config[key] = float(value)
            except ValueError:
                threshold_config[key] = value

    model_version = pipeline.register_model_version(
        version=version,
        description=description,
        threshold_config=threshold_config,
        caliber_note=caliber_note
    )

    click.echo(f"模型版本已注册: {model_version.version}")


@model.command('use')
@click.argument('version')
@click.pass_context
def use_model(ctx, version):
    """切换激活的模型版本"""
    pipeline = ctx.obj['pipeline']
    success = pipeline.set_active_version(version)

    if success:
        click.echo(f"已切换到模型版本: {version}")
    else:
        click.echo(f"模型版本不存在: {version}")


@model.command('current')
@click.pass_context
def current_model(ctx):
    """显示当前激活的模型版本"""
    pipeline = ctx.obj['pipeline']
    active = pipeline.get_active_version()

    if active:
        click.echo(f"当前激活版本: {active.version}")
        click.echo(f"描述: {active.description}")
    else:
        click.echo("暂无激活的模型版本")


@cli.group()
def report():
    """报告管理"""
    pass


@report.command('list')
@click.option('--model-version', default=None, help='按模型版本筛选')
@click.pass_context
def list_reports(ctx, model_version):
    """列出报告"""
    pipeline = ctx.obj['pipeline']
    reports = pipeline.list_reports(model_version)

    if not reports:
        click.echo("暂无报告")
        return

    click.echo("报告列表:")
    for r in reports:
        click.echo(f"  {r}")


@report.command('show')
@click.argument('report_id')
@click.pass_context
def show_report(ctx, report_id):
    """查看报告摘要"""
    pipeline = ctx.obj['pipeline']
    summary = pipeline.view_report_summary(report_id)

    if summary:
        click.echo(summary)
    else:
        click.echo(f"报告不存在: {report_id}")


@report.command('conflicts')
@click.argument('report_id')
@click.pass_context
def show_conflicts(ctx, report_id):
    """查看冲突清单"""
    pipeline = ctx.obj['pipeline']
    conflict_list = pipeline.view_conflict_list(report_id)

    if conflict_list:
        click.echo(conflict_list)
    else:
        click.echo(f"报告不存在: {report_id}")


@cli.command()
@click.pass_context
def demo(ctx):
    """生成样例数据并运行演示评测"""
    import os
    import json
    from datetime import datetime

    data_dir = ctx.obj['pipeline'].data_dir

    click.echo("生成样例数据...")

    eval_logs_dir = os.path.join(data_dir, 'eval_logs', 'v2.0')
    os.makedirs(eval_logs_dir, exist_ok=True)

    sample_data = [
        {
            'record_id': 'REC001',
            'city': '北京市',
            'district': '朝阳区',
            'grid_id': 'G001',
            'change_type': '新增建筑',
            'confidence': '高',
            'confidence_score': 0.92,
            'verify_status': '通过',
            'material_sources': ['评测日志', '标注表'],
            'eval_timestamp': datetime.now().isoformat()
        },
        {
            'record_id': 'REC002',
            'city': '北京市',
            'district': '海淀区',
            'grid_id': 'G002',
            'change_type': '拆除建筑',
            'confidence': '中',
            'confidence_score': 0.65,
            'verify_status': '待人工确认',
            'material_sources': ['评测日志'],
            'eval_timestamp': datetime.now().isoformat()
        },
        {
            'record_id': 'REC003',
            'city': '上海市',
            'district': '浦东新区',
            'grid_id': 'G003',
            'change_type': '扩建',
            'confidence': '高',
            'confidence_score': 0.88,
            'verify_status': '通过',
            'material_sources': ['评测日志', '标注表'],
            'eval_timestamp': datetime.now().isoformat()
        },
        {
            'record_id': 'REC004',
            'city': '广州市',
            'district': '天河区',
            'grid_id': 'G004',
            'change_type': '改建',
            'confidence': '低',
            'confidence_score': 0.45,
            'verify_status': '待人工确认',
            'material_sources': ['评测日志'],
            'eval_timestamp': datetime.now().isoformat()
        },
        {
            'record_id': 'REC005',
            'city': '深圳市',
            'district': '南山区',
            'grid_id': 'G005',
            'change_type': '新增建筑',
            'confidence': '中',
            'confidence_score': 0.58,
            'verify_status': '待人工确认',
            'material_sources': ['评测日志'],
            'eval_timestamp': datetime.now().isoformat()
        },
        {
            'record_id': 'REC006',
            'city': '北京市',
            'district': '朝阳区',
            'grid_id': 'G001',
            'change_type': '新增建筑',
            'confidence': '高',
            'confidence_score': 0.90,
            'verify_status': '通过',
            'material_sources': ['评测日志'],
            'eval_timestamp': datetime.now().isoformat()
        },
        {
            'record_id': 'REC007',
            'city': '',
            'district': '未知区域',
            'grid_id': '',
            'change_type': '待判定',
            'confidence': '低',
            'confidence_score': 0.30,
            'verify_status': '待人工确认',
            'material_sources': [],
            'eval_timestamp': datetime.now().isoformat()
        },
        {
            'record_id': 'REC008',
            'city': '杭州市',
            'district': '西湖区',
            'grid_id': 'G008',
            'change_type': '新增建筑',
            'confidence': '高',
            'confidence_score': 0.95,
            'verify_status': '通过',
            'material_sources': ['评测日志', '标注表'],
            'eval_timestamp': datetime.now().isoformat()
        }
    ]

    with open(os.path.join(eval_logs_dir, 'eval_logs.json'), 'w', encoding='utf-8') as f:
        json.dump(sample_data, f, ensure_ascii=False, indent=2)

    annotation_dir = os.path.join(data_dir, 'annotation_tables')
    os.makedirs(annotation_dir, exist_ok=True)

    annotation_data = [
        {
            'material_id': 'MAT001',
            'record_id': 'REC001',
            'source_type': '标注表',
            'content': '2024年Q1卫星影像对比确认新增',
            'caliber_version': 'v1.0',
            'is_active': True,
            'created_at': datetime.now().isoformat()
        },
        {
            'material_id': 'MAT003',
            'record_id': 'REC003',
            'source_type': '标注表',
            'content': '现场勘查确认扩建',
            'caliber_version': 'v1.0',
            'is_active': True,
            'created_at': datetime.now().isoformat()
        },
        {
            'material_id': 'MAT008',
            'record_id': 'REC008',
            'source_type': '标注表',
            'content': '沿用旧口径判定',
            'caliber_version': 'v1.0',
            'is_active': True,
            'created_at': datetime.now().isoformat()
        }
    ]

    with open(os.path.join(annotation_dir, 'annotations.json'), 'w', encoding='utf-8') as f:
        json.dump(annotation_data, f, ensure_ascii=False, indent=2)

    conflict_dir = os.path.join(data_dir, 'conflict_cases')
    os.makedirs(conflict_dir, exist_ok=True)

    conflict_data = [
        {
            'case_id': 'CASE001',
            'record_ids': ['REC002'],
            'description': '与2024年Q2人工标注结果冲突',
            'severity': 'high',
            'resolved': False
        }
    ]

    with open(os.path.join(conflict_dir, 'conflicts.json'), 'w', encoding='utf-8') as f:
        json.dump(conflict_data, f, ensure_ascii=False, indent=2)

    threshold_dir = os.path.join(data_dir, 'threshold_notes')
    os.makedirs(threshold_dir, exist_ok=True)

    with open(os.path.join(threshold_dir, 'thresholds.txt'), 'w', encoding='utf-8') as f:
        f.write("北京市_新增建筑=严格阈值0.9\n")
        f.write("上海市_扩建=标准阈值0.85\n")

    click.echo("样例数据已生成!")
    click.echo("\n现在运行评测流程...")
    click.echo("=" * 50)

    result = ctx.obj['pipeline'].run_full_evaluation(
        model_version='v2.0',
        old_caliber_version='v1.0',
        overwrite=True
    )

    click.echo("\n" + "=" * 50)
    click.echo("演示完成!")
    click.echo(f"报告ID: {result['report_id']}")
    click.echo("\n运行以下命令查看更多详情:")
    click.echo(f"  python cli.py report show {result['report_id']}")
    click.echo(f"  python cli.py report conflicts {result['report_id']}")


if __name__ == '__main__':
    cli()
