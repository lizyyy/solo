#!/usr/bin/env python3
import click
import json
from typing import Optional
from models import (
    ReleaseRecord, ReleaseItem, EvidenceField, FailureItem,
    ManualNote, ModelReview, Status, CompActionStatus,
    generate_id, get_current_time
)
from storage import StorageManager


storage = StorageManager()


def calculate_overall_status(items: list) -> Status:
    has_success = False
    has_failure = False
    has_needs_review = False
    has_pending = False
    
    for item in items:
        if item.status == Status.FAILED or item.comp_action_status == CompActionStatus.NOT_EXECUTED:
            has_failure = True
        elif item.status == Status.SUCCESS and item.comp_action_status != CompActionStatus.NOT_EXECUTED:
            has_success = True
        elif item.status == Status.NEEDS_REVIEW:
            has_needs_review = True
        else:
            has_pending = True
    
    if has_failure and has_success:
        return Status.PARTIAL
    elif has_failure:
        return Status.FAILED
    elif has_needs_review:
        return Status.NEEDS_REVIEW
    elif has_success and not has_pending:
        return Status.SUCCESS
    else:
        return Status.PENDING


@click.group()
def cli():
    """版本发布说明命令行工具"""
    pass


@cli.command()
@click.option('--version', '-v', required=True, help='版本号')
@click.option('--description', '-d', required=True, help='版本描述')
@click.option('--release-date', '-r', help='发布日期 (ISO格式)')
@click.option('--material-summary', '-m', default='', help='材料摘要')
def create(version: str, description: str, release_date: Optional[str], material_summary: str):
    """创建新的发布记录"""
    if not release_date:
        release_date = get_current_time().split('T')[0]
    
    record = ReleaseRecord(
        id=generate_id(),
        version=version,
        release_date=release_date,
        description=description,
        items=[],
        overall_status=Status.PENDING,
        created_at=get_current_time(),
        updated_at=get_current_time(),
        material_summary=material_summary
    )
    
    record_id = storage.save_record(record)
    click.echo(f'✓ 已创建发布记录: {record_id}')
    click.echo(f'  版本: {version}')
    click.echo(f'  描述: {description}')


@cli.command('add-item')
@click.argument('record_id')
@click.option('--file-summary', '-s', required=True, help='文件摘要')
@click.option('--file-path', '-p', required=True, help='文件路径')
@click.option('--status', '-t', type=click.Choice(['pending', 'success', 'failed', 'partial', 'needs_review']),
              default='pending', help='状态')
@click.option('--comp-action', '-c', type=click.Choice(['not_executed', 'executed', 'skipped']),
              default='not_executed', help='补偿动作状态')
def add_item(record_id: str, file_summary: str, file_path: str, status: str, comp_action: str):
    """向发布记录添加项目"""
    record = storage.load_record(record_id)
    if not record:
        click.echo(f'✗ 未找到发布记录: {record_id}')
        return
    
    evidence_fields = []
    
    item = ReleaseItem(
        id=generate_id(),
        file_summary=file_summary,
        file_path=file_path,
        status=Status(status),
        comp_action_status=CompActionStatus(comp_action),
        evidence_fields=evidence_fields
    )
    
    record.items.append(item)
    record.overall_status = calculate_overall_status(record.items)
    record.updated_at = get_current_time()
    
    if item.status == Status.FAILED or item.comp_action_status == CompActionStatus.NOT_EXECUTED:
        failure = FailureItem(
            id=generate_id(),
            item_id=item.id,
            item_type='release_item',
            reason='处理失败' if item.status == Status.FAILED else '补偿动作未执行',
            details={
                'file_summary': file_summary,
                'file_path': file_path,
                'status': status,
                'comp_action': comp_action
            },
            created_at=get_current_time()
        )
        record.failure_items.append(failure)
    
    storage.save_record(record)
    click.echo(f'✓ 已添加项目: {item.id}')
    click.echo(f'  文件摘要: {file_summary}')
    click.echo(f'  状态: {status}')


@cli.command('add-evidence')
@click.argument('record_id')
@click.argument('item_id')
@click.option('--key', '-k', required=True, help='字段键')
@click.option('--value', '-v', required=True, help='字段值')
@click.option('--source', '-s', required=True, help='原始来源')
def add_evidence(record_id: str, item_id: str, key: str, value: str, source: str):
    """添加证据字段（可追溯到原始输入）"""
    record = storage.load_record(record_id)
    if not record:
        click.echo(f'✗ 未找到发布记录: {record_id}')
        return
    
    item = next((i for i in record.items if i.id == item_id), None)
    if not item:
        click.echo(f'✗ 未找到项目: {item_id}')
        return
    
    evidence = EvidenceField(
        key=key,
        value=value,
        original_source=source,
        trace_id=generate_id()
    )
    
    item.evidence_fields.append(evidence)
    record.updated_at = get_current_time()
    storage.save_record(record)
    
    click.echo(f'✓ 已添加证据字段')
    click.echo(f'  键: {key}')
    click.echo(f'  值: {value}')
    click.echo(f'  来源: {source}')
    click.echo(f'  追踪ID: {evidence.trace_id}')


@cli.command('add-note')
@click.argument('record_id')
@click.argument('item_id')
@click.option('--author', '-a', required=True, help='作者')
@click.option('--content', '-c', required=True, help='备注内容')
@click.option('--original-json', '-j', help='原始值JSON')
def add_note(record_id: str, item_id: str, author: str, content: str, original_json: Optional[str]):
    """添加人工备注（不覆盖原始判断）"""
    record = storage.load_record(record_id)
    if not record:
        click.echo(f'✗ 未找到发布记录: {record_id}')
        return
    
    item = next((i for i in record.items if i.id == item_id), None)
    if not item:
        click.echo(f'✗ 未找到项目: {item_id}')
        return
    
    original_value = None
    if original_json:
        original_value = json.loads(original_json)
    
    note = ManualNote(
        id=generate_id(),
        author=author,
        content=content,
        created_at=get_current_time(),
        original_value=original_value
    )
    
    item.manual_notes.append(note)
    record.updated_at = get_current_time()
    storage.save_record(record)
    
    click.echo(f'✓ 已添加人工备注')
    click.echo(f'  作者: {author}')
    click.echo(f'  内容: {content}')


@cli.command('add-model-review')
@click.argument('record_id')
@click.argument('item_id')
@click.option('--snippet-id', '-s', required=True, help='片段ID')
@click.option('--snippet-content', '-c', required=True, help='片段内容')
@click.option('--model-name', '-m', required=True, help='模型名称')
@click.option('--result-json', '-r', required=True, help='模型结果JSON')
def add_model_review(record_id: str, item_id: str, snippet_id: str, snippet_content: str,
                     model_name: str, result_json: str):
    """添加模型评测结果"""
    record = storage.load_record(record_id)
    if not record:
        click.echo(f'✗ 未找到发布记录: {record_id}')
        return
    
    item = next((i for i in record.items if i.id == item_id), None)
    if not item:
        click.echo(f'✗ 未找到项目: {item_id}')
        return
    
    model_result = json.loads(result_json)
    
    review = ModelReview(
        id=generate_id(),
        snippet_id=snippet_id,
        snippet_content=snippet_content,
        model_name=model_name,
        model_result=model_result
    )
    
    item.model_review = review
    record.updated_at = get_current_time()
    storage.save_record(record)
    
    click.echo(f'✓ 已添加模型评测结果')
    click.echo(f'  模型: {model_name}')
    click.echo(f'  片段ID: {snippet_id}')


@cli.command('confirm-model')
@click.argument('record_id')
@click.argument('item_id')
@click.option('--confirmer', '-c', required=True, help='确认人')
@click.option('--notes', '-n', help='确认备注')
def confirm_model(record_id: str, item_id: str, confirmer: str, notes: Optional[str]):
    """人工确认模型评测结果"""
    record = storage.load_record(record_id)
    if not record:
        click.echo(f'✗ 未找到发布记录: {record_id}')
        return
    
    item = next((i for i in record.items if i.id == item_id), None)
    if not item:
        click.echo(f'✗ 未找到项目: {item_id}')
        return
    
    if not item.model_review:
        click.echo(f'✗ 该项目没有模型评测记录')
        return
    
    item.model_review.human_confirmed = True
    item.model_review.confirmer = confirmer
    item.model_review.confirmed_at = get_current_time()
    item.model_review.confirmation_notes = notes
    
    record.updated_at = get_current_time()
    storage.save_record(record)
    
    click.echo(f'✓ 已人工确认模型评测结果')
    click.echo(f'  确认人: {confirmer}')
    if notes:
        click.echo(f'  备注: {notes}')


@cli.command()
def list():
    """列出所有发布记录"""
    records = storage.list_records()
    
    if not records:
        click.echo('暂无发布记录')
        return
    
    click.echo('发布记录列表:')
    click.echo('-' * 80)
    for r in records:
        click.echo(f"ID: {r['id']}")
        click.echo(f"  版本: {r['version']}")
        click.echo(f"  日期: {r['release_date']}")
        click.echo(f"  状态: {r['overall_status']}")
        click.echo(f"  描述: {r['description']}")
        if r.get('material_summary'):
            click.echo(f"  材料摘要: {r['material_summary']}")
        click.echo()


@cli.command()
@click.argument('record_id')
def show(record_id: str):
    """显示发布记录详情"""
    record = storage.load_record(record_id)
    if not record:
        click.echo(f'✗ 未找到发布记录: {record_id}')
        return
    
    click.echo(f'版本: {record.version}')
    click.echo(f'日期: {record.release_date}')
    click.echo(f'整体状态: {record.overall_status.value}')
    click.echo(f'描述: {record.description}')
    if record.material_summary:
        click.echo(f'材料摘要: {record.material_summary}')
    click.echo()
    
    click.echo('项目明细:')
    click.echo('-' * 60)
    for item in record.items:
        item_status = item.status.value
        comp_status = item.comp_action_status.value
        
        is_failure_path = item.status == Status.FAILED or item.comp_action_status == CompActionStatus.NOT_EXECUTED
        
        click.echo(f"  项目ID: {item.id}")
        click.echo(f"  文件摘要: {item.file_summary}")
        click.echo(f"  文件路径: {item.file_path}")
        click.echo(f"  状态: {item_status}")
        click.echo(f"  补偿动作: {comp_status}")
        if is_failure_path:
            click.echo(f"  ⚠️  失败路径: 是 - {'补偿动作漏执行' if item.comp_action_status == CompActionStatus.NOT_EXECUTED else '处理失败'}")
        
        if item.evidence_fields:
            click.echo('  证据字段:')
            for ef in item.evidence_fields:
                click.echo(f"    - {ef.key}: {ef.value}")
                click.echo(f"      来源: {ef.original_source}, 追踪ID: {ef.trace_id}")
        
        if item.manual_notes:
            click.echo('  人工备注:')
            for mn in item.manual_notes:
                click.echo(f"    - [{mn.created_at}] {mn.author}: {mn.content}")
                if mn.original_value:
                    click.echo(f"      原始值: {json.dumps(mn.original_value, ensure_ascii=False)}")
        
        if item.model_review:
            click.echo('  模型评测:')
            click.echo(f"    模型: {item.model_review.model_name}")
            click.echo(f"    已人工确认: {'是' if item.model_review.human_confirmed else '否'}")
            if item.model_review.human_confirmed:
                click.echo(f"    确认人: {item.model_review.confirmer}")
        
        click.echo()
    
    if record.failure_items:
        click.echo('失败项:')
        click.echo('-' * 60)
        for fi in record.failure_items:
            click.echo(f"  失败ID: {fi.id}")
            click.echo(f"  原因: {fi.reason}")
            click.echo(f"  详情: {json.dumps(fi.details, ensure_ascii=False)}")
            click.echo()


@cli.command('list-failures')
def list_failures():
    """列出所有失败项"""
    failures = storage.list_all_failures()
    
    if not failures:
        click.echo('暂无失败项')
        return
    
    click.echo('所有失败项:')
    click.echo('-' * 80)
    for f in failures:
        click.echo(f"失败ID: {f['id']}")
        click.echo(f"  记录ID: {f['record_id']}")
        click.echo(f"  项目ID: {f['item_id']}")
        click.echo(f"  原因: {f['reason']}")
        click.echo(f"  详情: {json.dumps(f['details'], ensure_ascii=False)}")
        if f.get('assignee'):
            click.echo(f"  处理人: {f['assignee']}")
        click.echo()


@cli.command()
@click.argument('pattern')
def search(pattern: str):
    """按文件摘要搜索发布记录"""
    record_ids = storage.search_by_file_summary(pattern)
    
    if not record_ids:
        click.echo(f'未找到匹配文件摘要: {pattern} 的记录')
        return
    
    click.echo(f'找到 {len(record_ids)} 条匹配记录:')
    click.echo('-' * 80)
    
    for rid in record_ids:
        record = storage.load_record(rid)
        if record:
            click.echo(f"记录ID: {record.id}")
            click.echo(f"  版本: {record.version}")
            click.echo(f"  日期: {record.release_date}")
            click.echo(f"  状态: {record.overall_status.value}")
            click.echo(f"  匹配项目:")
            for item in record.items:
                if pattern.lower() in item.file_summary.lower():
                    click.echo(f"    - {item.file_summary} ({item.status.value})")
            click.echo()


@cli.command()
@click.argument('record_id')
@click.option('--output', '-o', help='导出文件路径')
def export(record_id: str, output: Optional[str]):
    """导出发布记录为JSON"""
    record = storage.load_record(record_id)
    if not record:
        click.echo(f'✗ 未找到发布记录: {record_id}')
        return
    
    data = record.to_dict()
    
    if output:
        with open(output, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        click.echo(f'✓ 已导出到: {output}')
    else:
        click.echo(json.dumps(data, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    cli()
