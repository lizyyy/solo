#!/usr/bin/env python3
import click
import sys
from pathlib import Path
from colorama import init

from cache_invalidator import (
    ConfigLoader,
    TemplateManager,
    MockCacheClient,
    InvalidationExecutor,
    ReportGenerator
)

init(autoreset=True)


@click.group()
@click.version_option(version='1.0.0')
def cli():
    """多区域缓存失效 CLI 工具
    
    用于管理多区域分布式缓存的失效操作，支持预检、执行、重试和报告生成。
    """
    pass


@cli.command()
@click.option('--regions', '-r', default='config/regions.yaml', help='区域配置文件路径')
@click.option('--templates', '-t', default='config/templates.yaml', help='模板配置文件路径')
@click.option('--tasks', '-f', default='examples/tasks.yaml', help='任务清单文件路径')
@click.option('--mock-cache', '-m', default='examples/mock_cache.json', help='模拟缓存快照文件')
def precheck(regions, templates, tasks, mock_cache):
    """执行预检，检查配置和区域可达性"""
    click.echo("开始预检...")
    
    try:
        config_loader = ConfigLoader(regions, templates, tasks)
        template_manager = TemplateManager(templates)
        cache_client = MockCacheClient(mock_cache)
        executor = InvalidationExecutor(template_manager, cache_client)
        
        regions_data = config_loader.load_regions()
        tasks_data = config_loader.load_tasks()
        
        errors, warnings, info = executor.pre_check(regions_data, tasks_data)
        
        if errors:
            click.echo(f"\n发现 {len(errors)} 个错误，需要修复后才能执行")
            sys.exit(1)
        else:
            click.echo("\n预检通过，可以执行失效任务")
            if warnings:
                click.echo(f"注意: 存在 {len(warnings)} 个警告")
            
    except Exception as e:
        click.echo(f"预检失败: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.option('--regions', '-r', default='config/regions.yaml', help='区域配置文件路径')
@click.option('--templates', '-t', default='config/templates.yaml', help='模板配置文件路径')
@click.option('--tasks', '-f', default='examples/tasks.yaml', help='任务清单文件路径')
@click.option('--mock-cache', '-m', default='examples/mock_cache.json', help='模拟缓存快照文件')
@click.option('--max-retries', default=3, help='最大重试次数')
@click.option('--retry-delay', default=1.0, help='重试延迟秒数')
@click.option('--output-dir', '-o', default='reports', help='报告输出目录')
@click.option('--report-name', help='报告文件名（不含扩展名）')
@click.option('--skip-precheck', is_flag=True, help='跳过预检')
@click.option('--yes', '-y', is_flag=True, help='自动确认执行')
def execute(regions, templates, tasks, mock_cache, max_retries, retry_delay, output_dir, report_name, skip_precheck, yes):
    """执行缓存失效任务"""
    
    if not yes:
        click.confirm("确认执行缓存失效任务？", abort=True)
    
    click.echo("开始执行缓存失效...")
    
    try:
        config_loader = ConfigLoader(regions, templates, tasks)
        template_manager = TemplateManager(templates)
        cache_client = MockCacheClient(mock_cache)
        executor = InvalidationExecutor(
            template_manager, 
            cache_client,
            max_retries=max_retries,
            retry_delay=retry_delay
        )
        reporter = ReportGenerator(output_dir=output_dir)
        
        regions_data = config_loader.load_regions()
        tasks_data = config_loader.load_tasks()
        
        pre_check_errors = []
        pre_check_warnings = []
        pre_check_info = []
        
        if not skip_precheck:
            click.echo("执行预检...")
            pre_check_errors, pre_check_warnings, pre_check_info = executor.pre_check(
                regions_data, tasks_data
            )
            
            if pre_check_errors:
                click.echo(f"发现 {len(pre_check_errors)} 个错误，终止执行")
                sys.exit(1)
        
        click.echo("执行失效任务...")
        results = executor.execute_all(regions_data, tasks_data)
        
        report_path = reporter.generate_report(
            results,
            pre_check_errors=pre_check_errors,
            pre_check_warnings=pre_check_warnings,
            pre_check_info=pre_check_info,
            report_name=report_name
        )
        
        click.echo(f"\n执行完成！报告已保存到: {report_path}")
        
        failed_count = sum(1 for r in results if r.status.value in ['failed', 'inconsistent'])
        if failed_count > 0:
            sys.exit(2)
            
    except Exception as e:
        click.echo(f"执行失败: {e}", err=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.option('--regions', '-r', default='config/regions.yaml', help='区域配置文件路径')
@click.option('--templates', '-t', default='config/templates.yaml', help='模板配置文件路径')
@click.option('--tasks', '-f', default='examples/tasks.yaml', help='任务清单文件路径')
@click.option('--mock-cache', '-m', default='examples/mock_cache.json', help='模拟缓存快照文件')
@click.option('--output-dir', '-o', default='reports', help='报告输出目录')
def verify(regions, templates, tasks, mock_cache, output_dir):
    """验证缓存一致性（复查）"""
    click.echo("开始验证缓存一致性...")
    
    try:
        config_loader = ConfigLoader(regions, templates, tasks)
        template_manager = TemplateManager(templates)
        cache_client = MockCacheClient(mock_cache)
        
        regions_data = config_loader.load_regions()
        tasks_data = config_loader.load_tasks()
        
        inconsistent_count = 0
        verification_results = []
        
        for task in tasks_data:
            cache_key, errors = template_manager.build_cache_key(task.template, task.variables)
            if not cache_key:
                click.echo(f"任务 {task.id}: 构建缓存键失败 - {', '.join(errors)}")
                continue
            
            task_result = {
                'task_id': task.id,
                'cache_key': cache_key,
                'regions': {}
            }
            
            for region_id, region in regions_data.items():
                result = cache_client.get(region_id, cache_key)
                has_old_value = result.success and result.value is not None
                
                task_result['regions'][region_id] = {
                    'name': region.name,
                    'has_old_value': has_old_value,
                    'value': result.value if has_old_value else None
                }
                
                if has_old_value:
                    inconsistent_count += 1
                    click.echo(f"  发现旧值: {region.name} - {cache_key}")
            
            verification_results.append(task_result)
        
        click.echo("\n" + "=" * 50)
        if inconsistent_count == 0:
            click.echo("✓ 所有区域缓存一致，无旧值残留")
        else:
            click.echo(f"✗ 发现 {inconsistent_count} 个区域存在旧值残留")
            click.echo("请查看详细报告并执行清理")
        
        report_dir = Path(output_dir)
        report_dir.mkdir(parents=True, exist_ok=True)
        
        import json
        from datetime import datetime
        report_file = report_dir / f"verification_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump({
                'generated_at': datetime.now().isoformat(),
                'inconsistent_count': inconsistent_count,
                'results': verification_results
            }, f, ensure_ascii=False, indent=2)
        
        click.echo(f"\n验证报告已保存到: {report_file}")
        
        if inconsistent_count > 0:
            sys.exit(1)
            
    except Exception as e:
        click.echo(f"验证失败: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.argument('task_id')
@click.option('--regions', '-r', default='config/regions.yaml', help='区域配置文件路径')
@click.option('--templates', '-t', default='config/templates.yaml', help='模板配置文件路径')
@click.option('--mock-cache', '-m', default='examples/mock_cache.json', help='模拟缓存快照文件')
@click.option('--template', required=True, help='模板名称')
@click.option('--variable', '-v', multiple=True, help='变量值，格式: key=value')
@click.option('--output-dir', '-o', default='reports', help='报告输出目录')
def retry(task_id, regions, templates, mock_cache, template, variable, output_dir):
    """重试特定任务"""
    click.echo(f"重试任务: {task_id}")
    
    try:
        from cache_invalidator.executor import Task
        from cache_invalidator import (
            ConfigLoader,
            TemplateManager,
            MockCacheClient,
            InvalidationExecutor,
            ReportGenerator
        )
        
        variables = {}
        for var in variable:
            if '=' in var:
                key, value = var.split('=', 1)
                variables[key] = value
        
        config_loader = ConfigLoader(regions, templates, regions)
        template_manager = TemplateManager(templates)
        cache_client = MockCacheClient(mock_cache)
        executor = InvalidationExecutor(template_manager, cache_client)
        reporter = ReportGenerator(output_dir=output_dir)
        
        regions_data = config_loader.load_regions()
        
        # 构建临时任务
        temp_task = Task(
            id=task_id,
            template=template,
            variables=variables,
            expected_value=""
        )
        
        result = executor.execute_task(temp_task, regions_data)
        
        reporter.generate_report(
            [result],
            report_name=f"retry_{task_id}"
        )
        
        if result.status.value == 'success':
            click.echo("重试成功！")
        else:
            click.echo("重试仍然失败，请查看报告")
            sys.exit(1)
            
    except Exception as e:
        click.echo(f"重试失败: {e}", err=True)
        sys.exit(1)


@cli.command()
def list_templates():
    """列出可用的缓存模板"""
    from cache_invalidator.templates import TemplateManager
    
    manager = TemplateManager('config/templates.yaml')
    templates = manager.get_all_templates()
    
    click.echo("可用缓存模板:")
    click.echo("-" * 50)
    
    for name, template in templates.items():
        click.echo(f"\n名称: {name}")
        click.echo(f"描述: {template.description}")
        click.echo(f"模式: {template.pattern}")
        click.echo("变量:")
        for var in template.variables:
            required = "必需" if var.required else "可选"
            click.echo(f"  - {var.name} ({required}): {var.description}")


if __name__ == '__main__':
    cli()
