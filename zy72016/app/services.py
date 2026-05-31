from datetime import datetime, date
from typing import List, Dict, Tuple, Optional
from app import db
from app.models import (
    Batch, MarginCall, StatusHistory, NoteHistory, OperationLog,
    STATUS_PENDING, STATUS_NEEDS_CONFIRM, STATUS_CONFIRMED,
    STATUS_EXCEPTION, STATUS_CLOSED,
    SOURCE_CONTRACT_SCAN, SOURCE_PAYMENT_FLOW, SOURCE_REFUND_REQUEST,
    SOURCE_APPROVAL_EMAIL, SOURCE_MANUAL_NOTE, SOURCE_LATE_ATTACHMENT, SOURCE_SYSTEM,
    DATA_QUALITY_NORMAL, DATA_QUALITY_NULL, DATA_QUALITY_DUPLICATE,
    DATA_QUALITY_BOUNDARY, DATA_QUALITY_DIRTY
)


def log_operation(batch_id=None, margin_call_id=None, operation='',
                  operation_type='', detail='', operator='SYSTEM',
                  source=SOURCE_SYSTEM, ip_address=None):
    log = OperationLog(
        batch_id=batch_id,
        margin_call_id=margin_call_id,
        operation=operation,
        operation_type=operation_type,
        detail=detail,
        operator=operator,
        source=source,
        ip_address=ip_address
    )
    db.session.add(log)


def check_data_quality(record_data: Dict) -> Tuple[str, List[str]]:
    issues = []
    null_fields = []
    for field in ['record_no', 'customer_name', 'account_no', 'shortfall_amount']:
        if record_data.get(field) is None or record_data.get(field) == '':
            null_fields.append(field)
    if null_fields:
        issues.append(f'空值字段: {", ".join(null_fields)}')
    quality = DATA_QUALITY_NORMAL
    if issues:
        quality = DATA_QUALITY_NULL
    return quality, issues


def check_duplicate(batch_id: int, record_no: str) -> Optional[MarginCall]:
    return MarginCall.query.filter_by(
        batch_id=batch_id,
        record_no=record_no
    ).order_by(MarginCall.version.desc()).first()


def check_boundary_condition(record_data: Dict) -> Tuple[bool, str]:
    shortfall = record_data.get('shortfall_amount')
    if shortfall is not None and isinstance(shortfall, (int, float)):
        if shortfall == 0:
            return True, '穿仓金额为0，边界情况'
        if shortfall < 0:
            return True, f'穿仓金额为负数({shortfall})，边界情况'
        if shortfall > 10000000:
            return True, f'穿仓金额过大({shortfall})，边界情况'
    refund = record_data.get('refund_amount')
    payment = record_data.get('payment_amount')
    if refund is not None and payment is not None:
        if refund > payment:
            return True, f'退款金额({refund})大于已缴金额({payment})，边界情况'
    return False, ''


def create_batch(batch_no: str, name: str, description: str = None,
                 created_by: str = 'SYSTEM') -> Batch:
    batch = Batch(
        batch_no=batch_no,
        name=name,
        description=description,
        created_by=created_by
    )
    db.session.add(batch)
    db.session.flush()
    log_operation(
        batch_id=batch.id,
        operation='创建复盘批次',
        operation_type='BATCH_CREATE',
        detail=f'批次号: {batch_no}, 名称: {name}',
        operator=created_by
    )
    return batch


def import_single_record(batch_id: int, record_data: Dict,
                         source: str = SOURCE_CONTRACT_SCAN,
                         operator: str = 'SYSTEM',
                         is_late_attachment: bool = False) -> Dict:
    result = {
        'success': False,
        'record': None,
        'warnings': [],
        'errors': [],
        'is_duplicate': False,
        'is_boundary': False,
        'has_null': False,
        'created_new_version': False
    }

    quality, quality_issues = check_data_quality(record_data)
    if quality_issues:
        result['warnings'].extend(quality_issues)
        result['has_null'] = True

    is_boundary, boundary_note = check_boundary_condition(record_data)
    if is_boundary:
        result['warnings'].append(boundary_note)
        result['is_boundary'] = True
        if quality == DATA_QUALITY_NORMAL:
            quality = DATA_QUALITY_BOUNDARY

    record_no = record_data.get('record_no')
    if not record_no:
        result['errors'].append('缺少必填字段: record_no')
        return result

    existing = check_duplicate(batch_id, record_no)

    if existing and not is_late_attachment:
        result['is_duplicate'] = True
        result['warnings'].append(f'记录重复: record_no={record_no} 已存在，保留原始记录')
        if quality == DATA_QUALITY_NORMAL:
            quality = DATA_QUALITY_DUPLICATE
        existing.data_quality = quality
        existing.has_exception = True
        if existing.exception_reason:
            existing.exception_reason += f'; 重复导入: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}'
        else:
            existing.exception_reason = f'重复导入: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}'
        result['record'] = existing.to_dict(include_history=True)
        result['success'] = True
        log_operation(
            batch_id=batch_id,
            margin_call_id=existing.id,
            operation='重复导入检测',
            operation_type='DUPLICATE_DETECT',
            detail=f'record_no={record_no} 重复导入，保留原始记录',
            operator=operator,
            source=source
        )
        return result

    contract_note = record_data.get('contract_original_note', '')

    if is_late_attachment and existing:
        new_version = existing.version + 1
        late_payment_date = existing.payment_date
        if record_data.get('payment_date'):
            if isinstance(record_data['payment_date'], date):
                late_payment_date = record_data['payment_date']
            else:
                try:
                    late_payment_date = datetime.strptime(str(record_data['payment_date']), '%Y-%m-%d').date()
                except (ValueError, TypeError):
                    pass

        new_record = MarginCall(
            batch_id=batch_id,
            record_no=record_no,
            customer_name=record_data.get('customer_name', existing.customer_name),
            account_no=record_data.get('account_no', existing.account_no),
            currency=record_data.get('currency', existing.currency),
            margin_amount=record_data.get('margin_amount', existing.margin_amount),
            shortfall_amount=record_data.get('shortfall_amount', existing.shortfall_amount),
            payment_date=late_payment_date,
            payment_amount=record_data.get('payment_amount', existing.payment_amount),
            refund_amount=record_data.get('refund_amount', existing.refund_amount),
            current_status=STATUS_NEEDS_CONFIRM,
            data_quality=quality if quality != DATA_QUALITY_NORMAL else DATA_QUALITY_DIRTY,
            source=source,
            contract_original_note=existing.contract_original_note,
            processed_by=operator,
            processed_at=datetime.now(),
            has_exception=True,
            exception_reason=f'晚到附件更新，原记录ID={existing.id}',
            version=new_version,
            is_late_attachment=True,
            original_record_id=existing.id
        )
        db.session.add(new_record)
        db.session.flush()

        status_history = StatusHistory(
            margin_call_id=new_record.id,
            from_status=existing.current_status,
            to_status=STATUS_NEEDS_CONFIRM,
            change_reason='晚到附件到达，需重新确认',
            source=source,
            operator=operator,
            previous_shortfall=existing.shortfall_amount,
            new_shortfall=new_record.shortfall_amount,
            previous_refund=existing.refund_amount,
            new_refund=new_record.refund_amount
        )
        db.session.add(status_history)

        for note in existing.note_history.all():
            new_note = NoteHistory(
                margin_call_id=new_record.id,
                note_content=note.note_content,
                note_type=note.note_type,
                source=note.source,
                operator=note.operator,
                is_original=note.is_original
            )
            db.session.add(new_note)

        late_note = NoteHistory(
            margin_call_id=new_record.id,
            note_content=f'【晚到附件】{record_data.get("note_content", "补充材料")}，原判断: {existing.current_status}',
            note_type='LATE_ATTACHMENT',
            source=SOURCE_LATE_ATTACHMENT,
            operator=operator,
            is_original=False
        )
        db.session.add(late_note)

        result['success'] = True
        result['record'] = new_record.to_dict(include_history=True)
        result['created_new_version'] = True
        result['warnings'].append(f'已创建新版本 v{new_version}，原版本 v{existing.version} 保留')

        log_operation(
            batch_id=batch_id,
            margin_call_id=new_record.id,
            operation='晚到附件处理',
            operation_type='LATE_ATTACHMENT',
            detail=f'记录 {record_no} 收到晚到附件，创建新版本 v{new_version}，原版本ID={existing.id}',
            operator=operator,
            source=source
        )
        return result

    payment_date = None
    if record_data.get('payment_date'):
        if isinstance(record_data['payment_date'], date):
            payment_date = record_data['payment_date']
        else:
            try:
                payment_date = datetime.strptime(str(record_data['payment_date']), '%Y-%m-%d').date()
            except (ValueError, TypeError):
                result['warnings'].append(f'付款日期格式错误: {record_data["payment_date"]}，已设为空')

    initial_status = STATUS_PENDING
    if result['warnings']:
        initial_status = STATUS_NEEDS_CONFIRM
        if quality == DATA_QUALITY_NORMAL:
            quality = DATA_QUALITY_DIRTY

    new_record = MarginCall(
        batch_id=batch_id,
        record_no=record_no,
        customer_name=record_data.get('customer_name'),
        account_no=record_data.get('account_no'),
        currency=record_data.get('currency', 'USD'),
        margin_amount=record_data.get('margin_amount'),
        shortfall_amount=record_data.get('shortfall_amount'),
        payment_date=payment_date,
        payment_amount=record_data.get('payment_amount'),
        refund_amount=record_data.get('refund_amount'),
        current_status=initial_status,
        data_quality=quality,
        source=source,
        contract_original_note=contract_note,
        processed_by=operator if initial_status != STATUS_PENDING else None,
        processed_at=datetime.now() if initial_status != STATUS_PENDING else None,
        has_exception=len(result['warnings']) > 0,
        exception_reason='; '.join(result['warnings']) if result['warnings'] else None,
        version=1,
        is_late_attachment=is_late_attachment
    )
    db.session.add(new_record)
    db.session.flush()

    status_history = StatusHistory(
        margin_call_id=new_record.id,
        from_status=None,
        to_status=initial_status,
        change_reason='初始导入' + ('，存在数据问题需人工确认' if result['warnings'] else ''),
        source=source,
        operator=operator,
        previous_shortfall=None,
        new_shortfall=new_record.shortfall_amount,
        previous_refund=None,
        new_refund=new_record.refund_amount
    )
    db.session.add(status_history)

    if contract_note:
        note = NoteHistory(
            margin_call_id=new_record.id,
            note_content=contract_note,
            note_type='CONTRACT_ORIGINAL',
            source=SOURCE_CONTRACT_SCAN,
            operator=operator,
            is_original=True
        )
        db.session.add(note)

    for i, note_content in enumerate(record_data.get('manual_notes', [])):
        note = NoteHistory(
            margin_call_id=new_record.id,
            note_content=note_content,
            note_type='MANUAL_NOTE',
            source=SOURCE_MANUAL_NOTE,
            operator=operator,
            is_original=False
        )
        db.session.add(note)

    result['success'] = True
    result['record'] = new_record.to_dict(include_history=True)

    log_operation(
        batch_id=batch_id,
        margin_call_id=new_record.id,
        operation='导入穿仓记录',
        operation_type='RECORD_IMPORT',
        detail=f'导入记录 {record_no}, 状态: {initial_status}, 质量: {quality}',
        operator=operator,
        source=source
    )

    return result


def import_batch_records(batch_id: int, records: List[Dict],
                         source: str = SOURCE_CONTRACT_SCAN,
                         operator: str = 'SYSTEM') -> Dict:
    batch = Batch.query.get(batch_id)
    if not batch:
        return {'success': False, 'error': '批次不存在'}

    results = {
        'success': True,
        'total': len(records),
        'imported': 0,
        'duplicates': 0,
        'has_null': 0,
        'boundary': 0,
        'warnings': [],
        'errors': [],
        'records': []
    }

    for idx, record_data in enumerate(records):
        try:
            result = import_single_record(batch_id, record_data, source, operator)
            results['records'].append(result)
            if result['success']:
                results['imported'] += 1
            if result['is_duplicate']:
                results['duplicates'] += 1
            if result['has_null']:
                results['has_null'] += 1
            if result['is_boundary']:
                results['boundary'] += 1
            if result['warnings']:
                results['warnings'].extend([f'记录{idx}: {w}' for w in result['warnings']])
        except Exception as e:
            results['errors'].append(f'记录{idx}导入失败: {str(e)}')
            results['success'] = False

    batch.updated_at = datetime.now()
    db.session.commit()

    log_operation(
        batch_id=batch_id,
        operation='批量导入完成',
        operation_type='BATCH_IMPORT',
        detail=f'共{len(records)}条，成功{results["imported"]}条，重复{results["duplicates"]}条，空值{results["has_null"]}条，边界{results["boundary"]}条',
        operator=operator,
        source=source
    )

    return results


def update_record_status(record_id: int, new_status: str, operator: str,
                         change_reason: str = '', source: str = SOURCE_SYSTEM,
                         manual_notes: List[str] = None) -> Dict:
    record = MarginCall.query.get(record_id)
    if not record:
        return {'success': False, 'error': '记录不存在'}

    old_status = record.current_status
    old_shortfall = record.shortfall_amount
    old_refund = record.refund_amount

    record.current_status = new_status
    record.processed_by = operator
    record.processed_at = datetime.now()

    if new_status == STATUS_CONFIRMED and record.has_exception:
        pass

    if manual_notes:
        for note_content in manual_notes:
            note = NoteHistory(
                margin_call_id=record.id,
                note_content=note_content,
                note_type='MANUAL_CONFIRM',
                source=source,
                operator=operator,
                is_original=False
            )
            db.session.add(note)

    status_history = StatusHistory(
        margin_call_id=record.id,
        from_status=old_status,
        to_status=new_status,
        change_reason=change_reason or '人工确认更新',
        source=source,
        operator=operator,
        previous_shortfall=old_shortfall,
        new_shortfall=record.shortfall_amount,
        previous_refund=old_refund,
        new_refund=record.refund_amount
    )
    db.session.add(status_history)

    db.session.flush()

    log_operation(
        batch_id=record.batch_id,
        margin_call_id=record.id,
        operation='状态更新',
        operation_type='STATUS_UPDATE',
        detail=f'状态从 {old_status} 变更为 {new_status}，原因: {change_reason}',
        operator=operator,
        source=source
    )

    db.session.commit()
    return {'success': True, 'record': record.to_dict(include_history=True)}


def add_note_to_record(record_id: int, note_content: str, note_type: str,
                       operator: str, source: str = SOURCE_MANUAL_NOTE,
                       is_original: bool = False) -> Dict:
    record = MarginCall.query.get(record_id)
    if not record:
        return {'success': False, 'error': '记录不存在'}

    note = NoteHistory(
        margin_call_id=record.id,
        note_content=note_content,
        note_type=note_type,
        source=source,
        operator=operator,
        is_original=is_original
    )
    db.session.add(note)
    db.session.commit()

    log_operation(
        batch_id=record.batch_id,
        margin_call_id=record.id,
        operation='添加备注',
        operation_type='NOTE_ADD',
        detail=f'添加{note_type}备注: {note_content[:50]}...',
        operator=operator,
        source=source
    )

    return {'success': True, 'note': note.to_dict()}


def generate_export_report(batch_id: int = None, status_filter: str = None) -> Dict:
    query = MarginCall.query
    if batch_id:
        query = query.filter_by(batch_id=batch_id)
    if status_filter:
        query = query.filter_by(current_status=status_filter)

    records = query.all()

    summary = {
        'total_records': len(records),
        'total_margin': 0.0,
        'total_shortfall': 0.0,
        'total_payment': 0.0,
        'total_refund': 0.0,
        'net_shortfall': 0.0,
        'by_status': {},
        'by_quality': {},
        'exception_count': 0,
        'late_attachment_count': 0,
        'needs_confirm_count': 0
    }

    status_map = {
        STATUS_PENDING: '待审核',
        STATUS_NEEDS_CONFIRM: '需人工确认',
        STATUS_CONFIRMED: '已确认',
        STATUS_EXCEPTION: '例外',
        STATUS_CLOSED: '已完结'
    }

    quality_map = {
        DATA_QUALITY_NORMAL: '正常',
        DATA_QUALITY_NULL: '有空值',
        DATA_QUALITY_DUPLICATE: '有重复',
        DATA_QUALITY_BOUNDARY: '边界记录',
        DATA_QUALITY_DIRTY: '脏数据'
    }

    for status in status_map:
        summary['by_status'][status_map[status]] = 0
    for quality in quality_map:
        summary['by_quality'][quality_map[quality]] = 0

    report_records = []
    for r in records:
        summary['total_margin'] += r.margin_amount or 0
        summary['total_shortfall'] += r.shortfall_amount or 0
        summary['total_payment'] += r.payment_amount or 0
        summary['total_refund'] += r.refund_amount or 0

        if r.current_status in status_map:
            summary['by_status'][status_map[r.current_status]] += 1
        if r.data_quality in quality_map:
            summary['by_quality'][quality_map[r.data_quality]] += 1

        if r.has_exception:
            summary['exception_count'] += 1
        if r.is_late_attachment:
            summary['late_attachment_count'] += 1
        if r.current_status == STATUS_NEEDS_CONFIRM:
            summary['needs_confirm_count'] += 1

        notes = []
        for nh in r.note_history.all():
            src_map = {
                SOURCE_CONTRACT_SCAN: '合同扫描件',
                SOURCE_PAYMENT_FLOW: '收款流水',
                SOURCE_REFUND_REQUEST: '退款申请',
                SOURCE_APPROVAL_EMAIL: '审批邮件',
                SOURCE_MANUAL_NOTE: '手写备注',
                SOURCE_LATE_ATTACHMENT: '晚到附件',
                SOURCE_SYSTEM: '系统'
            }
            src = src_map.get(nh.source, nh.source)
            original_mark = '【原始】' if nh.is_original else ''
            notes.append(f'{original_mark}[{src}]{nh.created_at.strftime("%Y-%m-%d %H:%M")} {nh.operator}: {nh.note_content}')

        status_history = []
        for sh in r.status_history.all():
            from_s = status_map.get(sh.from_status, sh.from_status or '-')
            to_s = status_map.get(sh.to_status, sh.to_status)
            status_history.append(
                f'{sh.created_at.strftime("%Y-%m-%d %H:%M")} {sh.operator}: {from_s} → {to_s} | '
                f'原因: {sh.change_reason} | 穿仓: {sh.previous_shortfall}→{sh.new_shortfall} | '
                f'退款: {sh.previous_refund}→{sh.new_refund}'
            )

        report_records.append({
            '批次号': r.batch.batch_no if r.batch else '',
            '记录编号': r.record_no,
            '版本': r.version,
            '客户名称': r.customer_name or '-',
            '账号': r.account_no or '-',
            '币种': r.currency or '-',
            '保证金金额': r.margin_amount or 0,
            '穿仓金额': r.shortfall_amount or 0,
            '付款日期': r.payment_date.strftime('%Y-%m-%d') if r.payment_date else '-',
            '已缴金额': r.payment_amount or 0,
            '应退金额': r.refund_amount or 0,
            '当前状态': status_map.get(r.current_status, r.current_status),
            '数据质量': quality_map.get(r.data_quality, r.data_quality),
            '数据来源': src_map.get(r.source, r.source),
            '是否例外': '是' if r.has_exception else '否',
            '例外原因': r.exception_reason or '-',
            '是否晚到附件': '是' if r.is_late_attachment else '否',
            '原始记录ID': r.original_record_id or '-',
            '合同原始备注': r.contract_original_note or '-',
            '处理人': r.processed_by or '-',
            '处理时间': r.processed_at.strftime('%Y-%m-%d %H:%M:%S') if r.processed_at else '-',
            '创建时间': r.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            '更新时间': r.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
            '状态流转历史': '\n'.join(status_history),
            '所有备注': '\n'.join(notes)
        })

    summary['net_shortfall'] = summary['total_shortfall'] - summary['total_refund']

    for k, v in summary['by_status'].items():
        summary['by_status'][k] = v
    for k, v in summary['by_quality'].items():
        summary['by_quality'][k] = v

    return {
        'export_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'summary': summary,
        'records': report_records
    }


def get_record_versions(record_no: str, batch_id: int = None) -> List[Dict]:
    query = MarginCall.query.filter_by(record_no=record_no)
    if batch_id:
        query = query.filter_by(batch_id=batch_id)
    versions = query.order_by(MarginCall.version).all()
    return [v.to_dict(include_history=True) for v in versions]


def get_operation_logs(batch_id: int = None, margin_call_id: int = None,
                       limit: int = 100) -> List[Dict]:
    query = OperationLog.query.order_by(OperationLog.created_at.desc())
    if batch_id:
        query = query.filter_by(batch_id=batch_id)
    if margin_call_id:
        query = query.filter_by(margin_call_id=margin_call_id)
    logs = query.limit(limit).all()
    return [log.to_dict() for log in logs]
