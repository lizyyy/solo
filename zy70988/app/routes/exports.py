from flask import Blueprint, request, jsonify, send_file, current_app
from datetime import datetime
import os
import pandas as pd
from app.models import SettlementRecord
from app.utils import log_operation

bp = Blueprint('exports', __name__, url_prefix='/api/exports')

@bp.route('/records', methods=['GET'])
def export_records():
    property_id = request.args.get('property_id')
    deposit_receipt_no = request.args.get('deposit_receipt_no')
    checkout_start = request.args.get('checkout_start')
    checkout_end = request.args.get('checkout_end')
    status = request.args.get('status')
    batch_id = request.args.get('batch_id', type=int)
    operator = request.args.get('operator', 'system')
    export_format = request.args.get('format', 'xlsx')
    
    query = SettlementRecord.query
    
    if property_id:
        query = query.filter_by(property_id=property_id)
    if deposit_receipt_no:
        query = query.filter_by(deposit_receipt_no=deposit_receipt_no)
    if checkout_start:
        query = query.filter(SettlementRecord.checkout_date >= datetime.strptime(checkout_start, '%Y-%m-%d').date())
    if checkout_end:
        query = query.filter(SettlementRecord.checkout_date <= datetime.strptime(checkout_end, '%Y-%m-%d').date())
    if status:
        query = query.filter_by(status=status)
    if batch_id:
        query = query.filter_by(batch_id=batch_id)
    
    records = query.order_by(SettlementRecord.created_at.desc()).all()
    
    data = []
    for r in records:
        data.append({
            '记录编号': r.record_no,
            '房源编号': r.property_id,
            '房间号': r.room_no,
            '租客姓名': r.tenant_name,
            '入住日期': r.checkin_date.isoformat() if r.checkin_date else '',
            '退房日期': r.checkout_date.isoformat() if r.checkout_date else '',
            '押金单号': r.deposit_receipt_no,
            '押金金额': float(r.deposit_amount) if r.deposit_amount else 0,
            '水表起度': float(r.water_start) if r.water_start else 0,
            '水表止度': float(r.water_end) if r.water_end else 0,
            '用水量': float(r.water_usage) if r.water_usage else 0,
            '水费': float(r.water_amount) if r.water_amount else 0,
            '电表起度': float(r.electricity_start) if r.electricity_start else 0,
            '电表止度': float(r.electricity_end) if r.electricity_end else 0,
            '用电量': float(r.electricity_usage) if r.electricity_usage else 0,
            '电费': float(r.electricity_amount) if r.electricity_amount else 0,
            '阶梯电价': r.electricity_tier or '',
            '损坏赔偿': float(r.damage_amount) if r.damage_amount else 0,
            '清洁费': float(r.cleaning_fee) if r.cleaning_fee else 0,
            '其他费用': float(r.other_fees) if r.other_fees else 0,
            '应退押金': float(r.refund_amount) if r.refund_amount else 0,
            '实退押金': float(r.actual_refund) if r.actual_refund else 0,
            '退款冲正': '是' if r.has_refund_reversal else '否',
            '状态': r.status,
            '证据数量': len(r.evidences),
            '创建时间': r.created_at.isoformat()
        })
    
    df = pd.DataFrame(data)
    
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    filename = f'settlement_records_{timestamp}.{export_format}'
    filepath = os.path.join(current_app.config['EXPORT_FOLDER'], filename)
    
    if export_format == 'csv':
        df.to_csv(filepath, index=False, encoding='utf-8-sig')
        mimetype = 'text/csv'
    else:
        df.to_excel(filepath, index=False, engine='openpyxl')
        mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    
    log_operation(
        operation='导出明细',
        operator=operator,
        reason=f'导出{len(data)}条记录, 格式: {export_format}',
        batch_id=batch_id
    )
    
    return send_file(
        filepath,
        mimetype=mimetype,
        as_attachment=True,
        download_name=filename
    )

@bp.route('/record/<int:record_id>/report', methods=['GET'])
def export_record_report(record_id):
    record = SettlementRecord.query.get_or_404(record_id)
    operator = request.args.get('operator', 'system')
    
    summary_data = [{
        '项目': '基本信息',
        '内容': ''
    }, {
        '项目': '记录编号',
        '内容': record.record_no
    }, {
        '项目': '房源编号',
        '内容': record.property_id
    }, {
        '项目': '房间号',
        '内容': record.room_no or ''
    }, {
        '项目': '租客姓名',
        '内容': record.tenant_name or ''
    }, {
        '项目': '入住日期',
        '内容': record.checkin_date.isoformat() if record.checkin_date else ''
    }, {
        '项目': '退房日期',
        '内容': record.checkout_date.isoformat() if record.checkout_date else ''
    }, {
        '项目': '押金单号',
        '内容': record.deposit_receipt_no or ''
    }, {
        '项目': '',
        '内容': ''
    }, {
        '项目': '费用明细',
        '内容': ''
    }, {
        '项目': '押金金额',
        '内容': f'{float(record.deposit_amount) if record.deposit_amount else 0:.2f} 元'
    }, {
        '项目': '水费',
        '内容': f'{float(record.water_amount) if record.water_amount else 0:.2f} 元 (用量: {float(record.water_usage) if record.water_usage else 0:.2f}吨)'
    }, {
        '项目': '电费',
        '内容': f'{float(record.electricity_amount) if record.electricity_amount else 0:.2f} 元 (用量: {float(record.electricity_usage) if record.electricity_usage else 0:.2f}度)'
    }, {
        '项目': '损坏赔偿',
        '内容': f'{float(record.damage_amount) if record.damage_amount else 0:.2f} 元'
    }, {
        '项目': '清洁费',
        '内容': f'{float(record.cleaning_fee) if record.cleaning_fee else 0:.2f} 元'
    }, {
        '项目': '其他费用',
        '内容': f'{float(record.other_fees) if record.other_fees else 0:.2f} 元'
    }, {
        '项目': '应退押金',
        '内容': f'{float(record.refund_amount) if record.refund_amount else 0:.2f} 元'
    }, {
        '项目': '实退押金',
        '内容': f'{float(record.actual_refund) if record.actual_refund else 0:.2f} 元'
    }, {
        '项目': '',
        '内容': ''
    }, {
        '项目': '处理状态',
        '内容': record.status
    }, {
        '项目': '是否有退款冲正',
        '内容': '是' if record.has_refund_reversal else '否'
    }, {
        '项目': '证据数量',
        '内容': len(record.evidences)
    }]
    
    log_data = []
    for log in record.operation_logs:
        log_data.append({
            '操作时间': log.operated_at.isoformat(),
            '操作类型': log.operation,
            '操作人': log.operator,
            '原因/备注': log.reason or '',
            '状态变更': f'{log.old_status or ""} -> {log.new_status or ""}'
        })
    
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    filename = f'report_{record.record_no}_{timestamp}.xlsx'
    filepath = os.path.join(current_app.config['EXPORT_FOLDER'], filename)
    
    with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
        pd.DataFrame(summary_data).to_excel(writer, sheet_name='结算报告', index=False)
        if log_data:
            pd.DataFrame(log_data).to_excel(writer, sheet_name='操作日志', index=False)
        
        if record.tier_details:
            tier_data = []
            for t in record.tier_details:
                tier_data.append({
                    '阶梯名称': t.tier_name,
                    '用电量': float(t.usage),
                    '单价': float(t.unit_price),
                    '金额': float(t.amount)
                })
            pd.DataFrame(tier_data).to_excel(writer, sheet_name='电价明细', index=False)
        
        if record.evidences:
            evidence_data = []
            for e in record.evidences:
                evidence_data.append({
                    '证据类型': e.evidence_type,
                    '文件名': e.file_name,
                    '上传人': e.uploaded_by,
                    '上传时间': e.uploaded_at.isoformat(),
                    '描述': e.description or ''
                })
            pd.DataFrame(evidence_data).to_excel(writer, sheet_name='证据列表', index=False)
    
    log_operation(
        operation='导出报告',
        operator=operator,
        reason=f'导出记录{record.record_no}的结算报告',
        record_id=record_id
    )
    
    return send_file(
        filepath,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=filename
    )
