#!/usr/bin/env python3
import click
import sys
import json
from datetime import date, datetime, timedelta
from typing import Optional

from models import Secret, Owner, SystemAccount, SecretLevel, ProcessingStatus, ConclusionType
from store import SecretStore
from rules import apply_automatic_rules, should_remind, get_reminder_content
from reporter import generate_machine_readable, generate_human_readable_report, \
    generate_secret_detail_report, export_json, export_markdown

store = SecretStore()


def validate_date(ctx, param, value):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise click.BadParameter('日期格式应为 YYYY-MM-DD')


@click.group()
@click.version_option(version='1.0.0')
def cli():
    """密钥到期催办负责人转交排查CLI"""
    pass


@cli.command()
@click.option('--secret-id', required=True, help='密钥ID')
@click.option('--secret-name', required=True, help='密钥名称')
@click.option('--usage', required=True, help='密钥用途')
@click.option('--account-id', required=True, help='系统账号ID')
@click.option('--system-name', required=True, help='系统名称')
@click.option('--environment', required=True, help='环境')
@click.option('--expire-date', required=True, help='到期日期 YYYY-MM-DD', callback=validate_date)
@click.option('--owner-name', required=True, help='负责人姓名')
@click.option('--owner-email', required=True, help='负责人邮箱')
@click.option('--owner-dept', required=True, help='负责人部门')
@click.option('--level', type=click.Choice(['critical', 'high', 'medium', 'low']), default='medium', help='密钥级别')
def add(secret_id, secret_name, usage, account_id, system_name, environment, 
        expire_date, owner_name, owner_email, owner_dept, level):
    """添加密钥"""
    existing = store.get_secret(secret_id)
    if existing:
        click.echo(f"错误: 密钥ID {secret_id} 已存在", err=True)
        sys.exit(1)
    
    system_account = SystemAccount(
        account_id=account_id,
        system_name=system_name,
        environment=environment
    )
    owner = Owner(
        name=owner_name,
        email=owner_email,
        department=owner_dept
    )
    secret = Secret(
        secret_id=secret_id,
        secret_name=secret_name,
        usage=usage,
        system_account=system_account,
        expire_date=expire_date,
        owner=owner,
        level=SecretLevel(level)
    )
    
    store.add_secret(secret)
    click.echo(f"成功添加密钥: {secret_id}")


@cli.command()
@click.option('--name', help='负责人姓名')
@click.option('--email', help='负责人邮箱')
@click.option('--dept', help='负责人部门')
@click.option('--on-vacation', is_flag=True, help='是否休假')
@click.option('--backup', help='备份负责人姓名')
def add_owner(name, email, dept, on_vacation, backup):
    """添加负责人"""
    owners = store.load_owners()
    existing = next((o for o in owners if o.name == name), None)
    if existing:
        click.echo(f"错误: 负责人 {name} 已存在", err=True)
        sys.exit(1)
    
    owner = Owner(
        name=name,
        email=email,
        department=dept,
        is_on_vacation=on_vacation,
        backup_owner=backup
    )
    owners.append(owner)
    store.save_owners(owners)
    click.echo(f"成功添加负责人: {name}")


@cli.command('list')
@click.option('--status', help='按状态过滤')
@click.option('--owner', help='按负责人过滤')
@click.option('--system', help='按系统过滤')
@click.option('--json-output', is_flag=True, help='输出JSON格式')
def list_secrets(status, owner, system, json_output):
    """列出所有密钥"""
    filters = {}
    if status:
        filters['status'] = ProcessingStatus(status)
    if owner:
        filters['name'] = owner
    if system:
        filters['system_name'] = system
    
    secrets = store.find_secrets(**filters)
    owners = store.load_owners()
    
    for secret in secrets:
        apply_automatic_rules(secret, owners)
        store.update_secret(secret)
    
    if json_output:
        result = generate_machine_readable(secrets)
        click.echo(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        report = generate_human_readable_report(secrets)
        click.echo(report)


@cli.command()
@click.argument('secret_id')
@click.option('--json-output', is_flag=True, help='输出JSON格式')
def show(secret_id, json_output):
    """显示密钥详情"""
    secret = store.get_secret(secret_id)
    if not secret:
        click.echo(f"错误: 密钥ID {secret_id} 不存在", err=True)
        sys.exit(1)
    
    if json_output:
        result = generate_machine_readable([secret])
        click.echo(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        report = generate_secret_detail_report(secret)
        click.echo(report)


@cli.command()
@click.argument('secret_id')
@click.option('--channel', default='email', help='催办渠道')
def remind(secret_id, channel):
    """发送催办通知"""
    secret = store.get_secret(secret_id)
    if not secret:
        click.echo(f"错误: 密钥ID {secret_id} 不存在", err=True)
        sys.exit(1)
    
    if secret.status in [ProcessingStatus.RESOLVED, ProcessingStatus.CLOSED]:
        click.echo(f"警告: 密钥已{secret.status.value}，跳过催办")
        return
    
    content = get_reminder_content(secret)
    reminder = secret.add_reminder(channel=channel, content=content)
    
    store.update_secret(secret)
    
    if reminder.is_duplicate:
        click.echo(f"检测到重复催办 (24小时内已发送过)，未发送新通知")
    else:
        click.echo(f"已发送催办通知: {content}")
        click.echo(f"收件人: {secret.owner.email}")


@cli.command('remind-all')
@click.option('--dry-run', is_flag=True, help='仅预览，不实际发送')
def remind_all(dry_run):
    """批量催办所有需要处理的密钥"""
    secrets = store.load_secrets()
    owners = store.load_owners()
    
    to_remind = []
    for secret in secrets:
        apply_automatic_rules(secret, owners)
        if should_remind(secret):
            to_remind.append(secret)
    
    if not to_remind:
        click.echo("没有需要催办的密钥")
        return
    
    click.echo(f"找到 {len(to_remind)} 个需要催办的密钥:")
    for secret in to_remind:
        content = get_reminder_content(secret)
        click.echo(f"  - {secret.secret_name}: {content}")
        
        if not dry_run:
            secret.add_reminder(content=content)
            store.update_secret(secret)
    
    if dry_run:
        click.echo("\n(预览模式，未实际发送通知)")
    else:
        click.echo(f"\n已发送 {len(to_remind)} 条催办通知")


@cli.command()
@click.argument('secret_id')
@click.argument('new_owner_name')
@click.option('--operator', required=True, help='操作人')
@click.option('--reason', required=True, help='转交原因')
def transfer(secret_id, new_owner_name, operator, reason):
    """转交密钥负责人"""
    secret = store.get_secret(secret_id)
    if not secret:
        click.echo(f"错误: 密钥ID {secret_id} 不存在", err=True)
        sys.exit(1)
    
    owners = store.load_owners()
    new_owner = next((o for o in owners if o.name == new_owner_name), None)
    if not new_owner:
        click.echo(f"错误: 负责人 {new_owner_name} 不存在，请先添加", err=True)
        sys.exit(1)
    
    secret.transfer_owner(new_owner, operator, reason)
    store.update_secret(secret)
    
    click.echo(f"已将密钥 {secret_id} 从 {secret.transfer_history[-1]['from_owner']} "
               f"转交给 {new_owner_name}")
    click.echo(f"原因: {reason}")
    click.echo(f"操作人: {operator}")


@cli.command()
@click.argument('secret_id')
@click.option('--type', 'conclusion_type', required=True,
              type=click.Choice(['renewed', 'deprecated', 'transferred_permanently', 'other']),
              help='结论类型')
@click.option('--operator', required=True, help='操作人')
@click.option('--remarks', default='', help='备注')
def resolve(secret_id, conclusion_type, operator, remarks):
    """处理密钥并添加结论"""
    secret = store.get_secret(secret_id)
    if not secret:
        click.echo(f"错误: 密钥ID {secret_id} 不存在", err=True)
        sys.exit(1)
    
    secret.resolve(ConclusionType(conclusion_type), operator, remarks)
    store.update_secret(secret)
    
    click.echo(f"已处理密钥 {secret_id}")
    click.echo(f"结论: {conclusion_type}")
    if remarks:
        click.echo(f"备注: {remarks}")


@cli.command()
@click.argument('secret_id')
def close(secret_id):
    """关闭密钥"""
    secret = store.get_secret(secret_id)
    if not secret:
        click.echo(f"错误: 密钥ID {secret_id} 不存在", err=True)
        sys.exit(1)
    
    secret.close()
    store.update_secret(secret)
    click.echo(f"已关闭密钥 {secret_id}")


@cli.command()
@click.option('--output', '-o', required=True, help='输出文件路径')
@click.option('--format', 'fmt', type=click.Choice(['json', 'md']), default='json', help='输出格式')
@click.option('--title', default='密钥到期催办报告', help='报告标题')
def export(output, fmt, title):
    """导出报告"""
    secrets = store.load_secrets()
    owners = store.load_owners()
    
    for secret in secrets:
        apply_automatic_rules(secret, owners)
        store.update_secret(secret)
    
    if fmt == 'json':
        result = generate_machine_readable(secrets)
        export_json(result, output)
    else:
        report = generate_human_readable_report(secrets, title)
        export_markdown(report, output)
    
    click.echo(f"已导出报告到: {output}")


@cli.command()
@click.option('--sample', type=click.Choice(['normal', 'dirty', 'conflict', 'empty']), 
              help='导入样例数据类型')
@click.argument('filepath', type=click.Path(exists=True), required=False)
def import_data(sample, filepath):
    """导入数据"""
    if filepath:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if 'secrets' in data:
            from store import decode_secret
            for s in data['secrets']:
                secret = decode_secret(s)
                if not store.get_secret(secret.secret_id):
                    store.add_secret(secret)
            click.echo(f"从文件导入了 {len(data['secrets'])} 个密钥")
        
        if 'owners' in data:
            owners = [Owner(**o) for o in data['owners']]
            store.save_owners(owners)
            click.echo(f"从文件导入了 {len(owners)} 个负责人")
    
    elif sample:
        import_sample_data(sample)
    else:
        click.echo("请指定文件路径或样例类型", err=True)
        sys.exit(1)


def import_sample_data(sample_type):
    """导入样例数据"""
    owners = [
        Owner(name="张三", email="zhangsan@example.com", department="技术部", 
              is_on_vacation=False, backup_owner="李四"),
        Owner(name="李四", email="lisi@example.com", department="技术部", 
              is_on_vacation=True, backup_owner="王五"),
        Owner(name="王五", email="wangwu@example.com", department="运维部", 
              is_on_vacation=False),
    ]
    store.save_owners(owners)
    
    today = date.today()
    
    if sample_type == 'normal':
        secrets = [
            Secret(
                secret_id="DB001",
                secret_name="生产数据库密码",
                usage="数据库访问",
                system_account=SystemAccount(account_id="SA001", system_name="订单系统", environment="prod"),
                expire_date=today + timedelta(days=2),
                owner=owners[0],
                level=SecretLevel.CRITICAL
            ),
            Secret(
                secret_id="API001",
                secret_name="支付API密钥",
                usage="外部接口调用",
                system_account=SystemAccount(account_id="SA002", system_name="支付系统", environment="prod"),
                expire_date=today + timedelta(days=5),
                owner=owners[1],
                level=SecretLevel.HIGH
            ),
            Secret(
                secret_id="SSH001",
                secret_name="服务器SSH密钥",
                usage="服务器登录",
                system_account=SystemAccount(account_id="SA003", system_name="监控系统", environment="prod"),
                expire_date=today + timedelta(days=60),
                owner=owners[2],
                level=SecretLevel.MEDIUM
            ),
        ]
        for s in secrets:
            store.add_secret(s)
        click.echo("已导入正常样例数据: 3个密钥，3个负责人")
    
    elif sample_type == 'dirty':
        dirty_secrets = [
            Secret(
                secret_id="DIRTY001",
                secret_name="过期密钥1",
                usage="测试",
                system_account=SystemAccount(account_id="DIRTY", system_name="测试系统", environment="test"),
                expire_date=today - timedelta(days=5),
                owner=owners[0],
                level=SecretLevel.LOW
            ),
            Secret(
                secret_id="DIRTY002",
                secret_name="重复催办密钥",
                usage="测试",
                system_account=SystemAccount(account_id="DIRTY", system_name="测试系统", environment="test"),
                expire_date=today + timedelta(days=1),
                owner=owners[0],
                level=SecretLevel.CRITICAL
            ),
        ]
        for s in dirty_secrets:
            store.add_secret(s)
        click.echo("已导入脏数据样例")
    
    elif sample_type == 'conflict':
        secrets = [
            Secret(
                secret_id="CONFLICT001",
                secret_name="冲突密钥-休假",
                usage="测试转交",
                system_account=SystemAccount(account_id="CONFLICT", system_name="测试系统", environment="test"),
                expire_date=today + timedelta(days=3),
                owner=owners[1],
                level=SecretLevel.HIGH
            ),
        ]
        for s in secrets:
            store.add_secret(s)
        click.echo("已导入边界冲突样例")
    
    elif sample_type == 'empty':
        click.echo("已导入空结果样例 (无密钥数据)")


@cli.command()
@click.argument('secret_id')
def delete(secret_id):
    """删除密钥"""
    secret = store.get_secret(secret_id)
    if not secret:
        click.echo(f"错误: 密钥ID {secret_id} 不存在", err=True)
        sys.exit(1)
    
    store.delete_secret(secret_id)
    click.echo(f"已删除密钥: {secret_id}")


if __name__ == '__main__':
    cli()
