#!/usr/bin/env python3
"""模型训练数据剔除 CLI 工具"""

import click
import json
import sys
from pathlib import Path

from data_purge_cli.engine import PurgeEngine
from data_purge_cli.formatter import Formatter


class PurgeCLI:
    """CLI 应用类"""
    
    def __init__(self):
        self.engine = PurgeEngine()
        self.formatter = Formatter()
    
    def _check_initialized(self):
        """检查是否已初始化"""
        if not self.engine.storage.is_initialized():
            click.echo(self.formatter.error("工作空间未初始化，请先运行 'purge init'"))
            sys.exit(1)
    
    def _handle_result(self, result: dict, json_output: bool = False):
        """处理命令结果"""
        if json_output:
            click.echo(self.formatter.format_json(result))
            if not result.get("success", True):
                sys.exit(1)
            return
        
        if result.get("success"):
            message = result.get("message", "操作成功")
            stats = result.get("stats")
            if stats:
                click.echo(self.formatter.success(message, stats))
            else:
                click.echo(self.formatter.success(message))
        else:
            error = result.get("error")
            message = result.get("message", "操作失败")
            click.echo(self.formatter.error(message, error))
            sys.exit(1)


pass_cli = click.make_pass_decorator(PurgeCLI)


@click.group()
@click.version_option()
@click.option("--json", "json_output", is_flag=True, help="输出 JSON 格式")
@click.pass_context
def cli(ctx, json_output):
    """模型训练数据剔除 CLI 工具
    
    用于在发现敏感样本后，按来源、标签、版本和下游集合进行剔除并留痕。
    """
    ctx.obj = PurgeCLI()
    ctx.obj.json_output = json_output


@cli.command()
@click.option("--force", is_flag=True, help="强制重新初始化")
@pass_cli
def init(cli_app, force):
    """初始化工作空间"""
    if force:
        import shutil
        if cli_app.engine.storage.data_dir.exists():
            shutil.rmtree(cli_app.engine.storage.data_dir)
    result = cli_app.engine.initialize()
    cli_app._handle_result(result, cli_app.json_output)


@cli.group()
@pass_cli
def import_cmd(cli_app):
    """导入数据（数据集、标签、敏感样本）"""
    cli_app._check_initialized()


@import_cmd.command("dataset")
@click.argument("name")
@click.option("--description", default="", help="数据集描述")
@click.option("--sample-index", "sample_index_path", type=click.Path(exists=True),
              help="样本索引文件路径 (JSON/JSONL)")
@click.option("--labels", "label_file_path", type=click.Path(exists=True),
              help="标签文件路径 (JSON/JSONL)")
@click.option("--version", default="v1.0.0", help="数据集版本")
@click.option("--source", default="manual", help="数据集来源")
@click.option("--published", "is_published", is_flag=True, help="标记为已发布版本")
@click.option("--operator", default="system", help="操作者")
@pass_cli
def import_dataset(cli_app, name, description, sample_index_path, label_file_path,
                   version, source, is_published, operator):
    """导入数据集
    
    NAME: 数据集名称
    """
    result = cli_app.engine.import_dataset(
        name=name,
        description=description,
        sample_index_path=sample_index_path,
        label_file_path=label_file_path,
        version=version,
        source=source,
        is_published=is_published,
        operator=operator
    )
    cli_app._handle_result(result, cli_app.json_output)


@import_cmd.command("sensitive")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--reason", default="", help="敏感原因说明")
@click.option("--operator", default="system", help="操作者")
@pass_cli
def import_sensitive(cli_app, file_path, reason, operator):
    """导入敏感样本清单
    
    FILE_PATH: 敏感样本清单文件路径 (JSON/JSONL)
    """
    result = cli_app.engine.import_sensitive_samples(
        sensitive_file_path=file_path,
        reason=reason,
        operator=operator
    )
    cli_app._handle_result(result, cli_app.json_output)


@cli.command()
@click.argument("sensitive_operation_id")
@click.option("--dataset", "dataset_name", help="指定数据集名称（可选，默认检查所有）")
@click.option("--version", help="指定版本（可选，默认检查所有版本）")
@click.option("--operator", default="system", help="操作者")
@pass_cli
def check(cli_app, sensitive_operation_id, dataset_name, version, operator):
    """检查敏感样本在数据集中的分布
    
    SENSITIVE_OPERATION_ID: 敏感样本导入操作ID
    """
    cli_app._check_initialized()
    
    result = cli_app.engine.check(
        sensitive_operation_id=sensitive_operation_id,
        dataset_name=dataset_name,
        version=version,
        operator=operator
    )
    
    if result.get("success"):
        if cli_app.json_output:
            click.echo(cli_app.formatter.format_json(result))
        else:
            check_result = result.get("result", {})
            click.echo(cli_app.formatter.format_check_result(check_result))
            click.echo("")
            click.echo(f"检查操作ID: {result['operation_id']}")
            click.echo(f"已检查数据集: {result['stats']['checked_datasets']}")
            click.echo(f"受影响数据集: {result['stats']['affected_datasets']}")
    else:
        cli_app._handle_result(result, cli_app.json_output)


@cli.command()
@click.option("--check-id", "check_operation_id", help="检查操作ID")
@click.option("--sensitive-id", "sensitive_operation_id", help="敏感样本导入操作ID")
@click.option("--dataset", "dataset_name", help="数据集名称")
@click.option("--all", "show_all", is_flag=True, help="显示所有操作历史")
@click.option("--status", help="按状态筛选操作 (running/completed/failed)")
@pass_cli
def detail(cli_app, check_operation_id, sensitive_operation_id, dataset_name, show_all, status):
    """查看详情信息"""
    cli_app._check_initialized()
    
    if show_all:
        operations = cli_app.engine.storage.list_operations(status=status)
        if cli_app.json_output:
            click.echo(cli_app.formatter.format_json(operations))
        else:
            click.echo(cli_app.formatter.format_operations(operations))
        return
    
    result = cli_app.engine.detail(
        check_operation_id=check_operation_id,
        sensitive_operation_id=sensitive_operation_id,
        dataset_name=dataset_name
    )
    
    if result.get("success"):
        if cli_app.json_output:
            click.echo(cli_app.formatter.format_json(result))
        else:
            click.echo(cli_app.formatter.format_detail(result))
    else:
        cli_app._handle_result(result, cli_app.json_output)


@cli.command()
@click.argument("check_operation_id")
@click.argument("dataset_name")
@click.argument("version")
@click.option("--patch-version", help="补丁版本号（已发布版本必须使用）")
@click.option("--operator", default="system", help="操作者")
@click.option("--reason", default="", help="剔除原因")
@pass_cli
def execute(cli_app, check_operation_id, dataset_name, version, patch_version, operator, reason):
    """执行剔除操作
    
    CHECK_OPERATION_ID: 检查操作ID
    DATASET_NAME: 数据集名称
    VERSION: 版本号
    """
    cli_app._check_initialized()
    
    result = cli_app.engine.execute_purge(
        check_operation_id=check_operation_id,
        dataset_name=dataset_name,
        version=version,
        patch_version=patch_version,
        operator=operator,
        reason=reason
    )
    cli_app._handle_result(result, cli_app.json_output)


@cli.command()
@click.option("--check-id", "check_operation_id", help="基于检查操作生成报告")
@click.option("--purge-id", "purge_operation_id", help="基于剔除操作生成报告")
@click.option("--operator", default="system", help="操作者")
@pass_cli
def report(cli_app, check_operation_id, purge_operation_id, operator):
    """生成报告"""
    cli_app._check_initialized()
    
    result = cli_app.engine.generate_report(
        check_operation_id=check_operation_id,
        purge_operation_id=purge_operation_id,
        operator=operator
    )
    
    if result.get("success"):
        report_data = result.get("report", {})
        if cli_app.json_output:
            click.echo(cli_app.formatter.format_json(report_data))
        else:
            click.echo(cli_app.formatter.format_report(report_data))
    else:
        cli_app._handle_result(result, cli_app.json_output)


if __name__ == "__main__":
    cli()
