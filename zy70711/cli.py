#!/usr/bin/env python3
import click
import json
import sys
from datetime import datetime
import uuid

from models import (
    NotebookRecord, ParameterSet, RuntimeEnvironment,
    OutputArtifact, ReviewComment
)
from storage import StorageManager
from reporter import ReportGenerator


@click.group()
@click.option('--base-dir', default='./notebook_artifacts', help='存储目录路径')
@click.pass_context
def cli(ctx, base_dir):
    """Notebook 参数制品排查 CLI 工具"""
    ctx.ensure_object(dict)
    ctx.obj['storage'] = StorageManager(base_dir)
    ctx.obj['reporter'] = ReportGenerator()


@cli.command()
@click.option('--name', required=True, help='Notebook 名称')
@click.option('--path', required=True, help='Notebook 文件路径')
@click.option('--params', type=str, help='JSON 格式的参数集')
@click.option('--params-file', type=click.Path(exists=True), help='参数集文件路径')
@click.pass_context
def add(ctx, name, path, params, params_file):
    """添加 Notebook 运行记录"""
    if params_file:
        with open(params_file, 'r') as f:
            params_data = json.load(f)
    elif params:
        params_data = json.loads(params)
    else:
        params_data = {}
    
    param_set = ParameterSet(
        name=f"{name}_params",
        values=params_data
    )
    param_set.generate_signature()
    
    import platform
    import psutil
    env = RuntimeEnvironment(
        python_version=platform.python_version(),
        os=platform.platform(),
        cpu_info=platform.processor() or "Unknown",
        memory_total=psutil.virtual_memory().total,
        disk_space=psutil.disk_usage('/').total,
        libraries={"numpy": "1.24.0", "pandas": "2.0.0", "scikit-learn": "1.3.0"}
    )
    env.generate_hash()
    
    notebook_id = str(uuid.uuid4())[:8]
    record = NotebookRecord(
        notebook_id=notebook_id,
        name=name,
        path=path,
        parameters=param_set,
        environment=env,
        executed_at=datetime.now().isoformat()
    )
    
    ctx.obj['storage'].save_record(record)
    click.echo(f"✓ 记录已添加, ID: {notebook_id}")
    click.echo(f"  参数签名: {param_set.signature}")
    click.echo(f"  环境哈希: {env.env_hash}")


@cli.command()
@click.pass_context
def list(ctx):
    """列出所有记录"""
    records = ctx.obj['storage'].get_all_records()
    if not records:
        click.echo("暂无记录")
        return
    
    click.echo(f"{'ID':<12} {'名称':<20} {'参数签名':<18} {'复核状态':<12} {'创建时间':<20}")
    click.echo("-" * 80)
    for r in records:
        click.echo(f"{r.notebook_id:<12} {r.name:<20} {r.parameters.signature:<18} "
                   f"{r.review_status:<12} {r.created_at[:19]}")


@cli.command()
@click.argument('notebook_id')
@click.pass_context
def show(ctx, notebook_id):
    """显示单个记录详情"""
    record = ctx.obj['storage'].load_record(notebook_id)
    if not record:
        click.echo(f"✗ 未找到记录: {notebook_id}")
        return
    
    reporter = ctx.obj['reporter']
    report = reporter.generate_human_readable([record])
    click.echo(report)


@cli.command()
@click.argument('notebook_id')
@click.pass_context
def verify(ctx, notebook_id):
    """验证记录完整性"""
    result = ctx.obj['storage'].verify_record(notebook_id)
    
    if result['valid']:
        click.echo(f"✓ 记录 {notebook_id} 验证通过")
    else:
        click.echo(f"✗ 记录 {notebook_id} 验证失败")
        for issue in result['issues']:
            click.echo(f"  - {issue}")


@cli.command()
@click.argument('notebook_id')
@click.option('--name', required=True, help='制品名称')
@click.option('--type', default='file', help='制品类型')
@click.option('--file', type=click.Path(exists=True), help='制品文件路径')
@click.pass_context
def add_artifact(ctx, notebook_id, name, type, file):
    """添加输出制品"""
    content = b""
    if file:
        with open(file, 'rb') as f:
            content = f.read()
    
    artifact = OutputArtifact(
        name=name,
        type=type,
        size=len(content)
    )
    
    version = ctx.obj['storage'].add_artifact_version(notebook_id, artifact, content)
    if version:
        click.echo(f"✓ 制品已添加, 版本: v{version}")
    else:
        click.echo(f"✗ 添加失败: Notebook ID '{notebook_id}' 不存在")


@cli.command()
@click.argument('notebook_id')
@click.option('--reviewer', required=True, help='复核人')
@click.option('--comment', required=True, help='复核意见')
@click.option('--status', type=click.Choice(['approved', 'rejected', 'pending']), 
              default='pending', help='复核状态')
@click.pass_context
def review(ctx, notebook_id, reviewer, comment, status):
    """添加复核意见"""
    review_comment = ReviewComment(
        reviewer=reviewer,
        comment=comment,
        status=status
    )
    
    if ctx.obj['storage'].add_review(notebook_id, review_comment):
        click.echo(f"✓ 复核意见已添加")
    else:
        click.echo(f"✗ 添加失败: Notebook ID '{notebook_id}' 不存在")


@cli.command()
@click.option('--output', default='report', help='报告文件名前缀')
@click.pass_context
def report(ctx, output):
    """生成排查报告"""
    records = ctx.obj['storage'].get_all_records()
    result = ctx.obj['reporter'].save_reports(records, output)
    
    click.echo("✓ 报告已生成:")
    click.echo(f"  机器可读: {result['machine_path']}")
    click.echo(f"  人读报告: {result['human_path']}")
    click.echo(f"  一致性验证: {'✓ 通过' if result['consistency_verified'] else '✗ 失败'}")


@cli.command()
@click.argument('notebook_id')
@click.option('--output-dir', required=True, help='归档目录')
@click.pass_context
def archive(ctx, notebook_id, output_dir):
    """归档记录"""
    if ctx.obj['storage'].archive_record(notebook_id, output_dir):
        click.echo(f"✓ 记录 {notebook_id} 已归档至 {output_dir}")
    else:
        click.echo(f"✗ 归档失败: Notebook ID '{notebook_id}' 不存在")


@cli.command()
@click.option('--output', default='index_export', help='导出文件名')
@click.pass_context
def export_index(ctx, output):
    """导出制品索引"""
    index = ctx.obj['storage'].load_index()
    data = {
        "index_id": index.index_id,
        "records": index.records,
        "created_at": index.created_at,
        "updated_at": index.updated_at,
        "record_count": len(index.records)
    }
    
    with open(f"{output}.json", 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    click.echo(f"✓ 索引已导出至 {output}.json")
    click.echo(f"  包含记录数: {len(index.records)}")


@cli.command()
@click.pass_context
def samples(ctx):
    """生成样例数据（正常、脏数据、边界冲突、空结果）"""
    storage = ctx.obj['storage']
    
    click.echo("正在生成样例数据...")
    
    # 1. 正常输入
    normal_params = {"learning_rate": 0.001, "batch_size": 32, "epochs": 100, "optimizer": "adam"}
    normal_param_set = ParameterSet(name="normal_params", values=normal_params)
    normal_env = RuntimeEnvironment(
        python_version="3.10.0",
        os="Darwin-22.5.0-x86_64-i386-64bit",
        cpu_info="Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz",
        memory_total=34359738368,
        disk_space=1000204886016,
        libraries={"numpy": "1.24.0", "pandas": "2.0.0"}
    )
    normal_record = NotebookRecord(
        notebook_id="NB001_NORMAL",
        name="模型训练_正常记录",
        path="./notebooks/train.ipynb",
        parameters=normal_param_set,
        environment=normal_env,
        executed_at=datetime.now().isoformat()
    )
    normal_record.add_review(ReviewComment(
        reviewer="数据科学家A",
        comment="参数设置合理，结果可复现",
        status="approved"
    ))
    storage.save_record(normal_record)
    click.echo("✓ 正常输入样例已添加")
    
    # 2. 脏数据（参数签名不匹配）
    dirty_params = {"threshold": 0.5, "method": "cosine"}
    dirty_param_set = ParameterSet(name="dirty_params", values=dirty_params)
    dirty_param_set.signature = "fake_signature_123456"  # 伪造签名
    dirty_env = RuntimeEnvironment(
        python_version="3.9.0",
        os="Linux-5.15.0-generic-x86_64-with-glibc2.31",
        cpu_info="AMD Ryzen 9 5900X 12-Core Processor",
        memory_total=68719476736,
        disk_space=2000409772032,
        libraries={"scipy": "1.10.0", "scikit-learn": "1.2.0"}
    )
    dirty_record = NotebookRecord(
        notebook_id="NB002_DIRTY",
        name="相似度计算_脏数据",
        path="./notebooks/similarity.ipynb",
        parameters=dirty_param_set,
        environment=dirty_env,
        executed_at=datetime.now().isoformat()
    )
    storage.save_record(dirty_record)
    click.echo("✓ 脏数据样例已添加（参数签名伪造）")
    
    # 3. 边界冲突（环境哈希冲突模拟）
    conflict_params = {"n_clusters": 5, "max_iter": 300}
    conflict_param_set = ParameterSet(name="conflict_params", values=conflict_params)
    conflict_env = RuntimeEnvironment(
        python_version="3.10.0",
        os="Windows-10-10.0.19045-SP0",
        cpu_info="Intel(R) Xeon(R) W-1290 CPU @ 3.20GHz",
        memory_total=137438953472,
        disk_space=4000819544064,
        libraries={"numpy": "1.23.0", "pandas": "1.5.0"}  # 版本与env_hash不匹配
    )
    conflict_env.env_hash = "conflict_hash_7890abcd"  # 强制错误哈希
    conflict_record = NotebookRecord(
        notebook_id="NB003_CONFLICT",
        name="聚类分析_边界冲突",
        path="./notebooks/cluster.ipynb",
        parameters=conflict_param_set,
        environment=conflict_env,
        executed_at=datetime.now().isoformat(),
        review_status="rejected"
    )
    conflict_record.add_review(ReviewComment(
        reviewer="复核专家B",
        comment="运行环境不匹配，依赖库版本冲突",
        status="rejected"
    ))
    storage.save_record(conflict_record)
    click.echo("✓ 边界冲突样例已添加")
    
    # 4. 空结果
    empty_params = {}
    empty_param_set = ParameterSet(name="empty_params", values=empty_params)
    empty_env = RuntimeEnvironment(
        python_version="3.11.0",
        os="Darwin-23.0.0-arm64-arm-64bit",
        cpu_info="Apple M2 Pro",
        memory_total=34359738368,
        disk_space=1000204886016,
        libraries={}
    )
    empty_record = NotebookRecord(
        notebook_id="NB004_EMPTY",
        name="空参数测试_空结果",
        path="./notebooks/empty.ipynb",
        parameters=empty_param_set,
        environment=empty_env,
        executed_at=datetime.now().isoformat(),
        exit_code=1
    )
    storage.save_record(empty_record)
    click.echo("✓ 空结果样例已添加")
    
    click.echo("")
    click.echo("✓ 所有样例数据已生成完成！")
    click.echo("  使用 'nbcli list' 查看所有记录")
    click.echo("  使用 'nbcli report' 生成完整报告")


if __name__ == '__main__':
    cli()
