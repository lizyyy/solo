from flask import Blueprint, request, jsonify, current_app
from datetime import datetime
import os
import csv
import json
import uuid
from werkzeug.utils import secure_filename
from app import db
from app.models import Batch, SettlementRecord, Evidence, ElectricityTierDetail
from app.utils import generate_no, log_operation, allowed_file, calculate_electricity_tier

bp = Blueprint('files', __name__, url_prefix='/api/files')

@bp.route('/upload/csv', methods=['POST'])
def upload_csv():
    if 'file' not in request.files:
        return jsonify({'code': 400, 'message': '没有上传文件'}), 400
    
    file = request.files['file']
    batch_id = request.form.get('batch_id', type=int)
    operator = request.form.get('operator', 'system')
    
    if not batch_id:
        return jsonify({'code': 400, 'message': '缺少批次ID'}), 400
    
    batch = Batch.query.get_or_404(batch_id)
    
    if file.filename == '':
        return jsonify({'code': 400, 'message': '没有选择文件'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(f"{uuid.uuid4().hex}_{file.filename}")
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        count = 0
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                record = parse_csv_row(row, batch_id, operator)
                if record:
                    db.session.add(record)
                    count += 1
        
        
        db.session.commit()
        
        log_operation(
            operation='导入CSV抄表数据',
            operator=operator,
            reason=f'文件: {file.filename}, 导入{count}条记录',
            batch_id=batch_id
        )
        
        return jsonify({
            'code': 0,
            'message': f'成功导入{count}条记录',
            'data': {'count': count}
        })
    
    return jsonify({'code': 400, 'message': '不支持的文件类型'}), 400

@bp.route('/upload/json', methods=['POST'])
def upload_json():
    if 'file' not in request.files:
        return jsonify({'code': 400, 'message': '没有上传文件'}), 400
    
    file = request.files['file']
    batch_id = request.form.get('batch_id', type=int)
    operator = request.form.get('operator', 'system')
    
    if not batch_id:
        return jsonify({'code': 400, 'message': '缺少批次ID'}), 400
    
    batch = Batch.query.get_or_404(batch_id)
    
    if file.filename == '':
        return jsonify({'code': 400, 'message': '没有选择文件'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(f"{uuid.uuid4().hex}_{file.filename}")
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        with open(filepath, 'r', encoding='utf-8') as f:
            order_data = json.load(f)
        
        updated_count = update_records_with_order(order_data, batch_id)
        
        log_operation(
            operation='导入订单JSON数据',
            operator=operator,
            reason=f'文件: {file.filename}, 更新{updated_count}条记录',
            batch_id=batch_id
        )
        
        return jsonify({
            'code': 0,
            'message': f'成功更新{updated_count}条记录',
            'data': {'count': updated_count}
        })
    
    return jsonify({'code': 400, 'message': '不支持的文件类型'}), 400

@bp.route('/upload/evidence', methods=['POST'])
def upload_evidence():
    if 'file' not in request.files:
        return jsonify({'code': 400, 'message': '没有上传文件'}), 400
    
    file = request.files['file']
    record_id = request.form.get('record_id', type=int)
    evidence_type = request.form.get('evidence_type', 'damage')
    operator = request.form.get('operator', 'system')
    description = request.form.get('description', '')
    
    if not record_id:
        return jsonify({'code': 400, 'message': '缺少记录ID'}), 400
    
    record = SettlementRecord.query.get_or_404(record_id)
    
    if file.filename == '':
        return jsonify({'code': 400, 'message': '没有选择文件'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(f"{uuid.uuid4().hex}_{file.filename}")
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        evidence = Evidence(
            record_id=record_id,
            evidence_type=evidence_type,
            file_path=filepath,
            file_name=file.filename,
            uploaded_by=operator,
            description=description
        )
        
        db.session.add(evidence)
        db.session.commit()
        
        log_operation(
            operation='上传证据',
            operator=operator,
            reason=f'{evidence_type}: {description}',
            record_id=record_id
        )
        
        return jsonify({
            'code': 0,
            'message': '证据上传成功',
            'data': {
                'id': evidence.id,
                'file_name': file.filename,
                'evidence_type': evidence_type
            }
        })
    
    return jsonify({'code': 400, 'message': '不支持的文件类型'}), 400

def parse_csv_row(row, batch_id, operator):
    try:
        record_no = generate_no('R')
        
        water_start = float(row.get('water_start', 0) or 0)
        water_end = float(row.get('water_end', 0) or 0)
        water_usage = water_end - water_start
        water_amount = water_usage * 5.0
        
        electricity_start = float(row.get('electricity_start', 0) or 0)
        electricity_end = float(row.get('electricity_end', 0) or 0)
        electricity_usage = electricity_end - electricity_start
        
        tier_result = calculate_electricity_tier(electricity_usage)
        electricity_amount = tier_result['total_amount']
        
        deposit_amount = float(row.get('deposit_amount', 0) or 0)
        damage_amount = float(row.get('damage_amount', 0) or 0)
        cleaning_fee = float(row.get('cleaning_fee', 0) or 0)
        other_fees = float(row.get('other_fees', 0) or 0)
        
        total_deduction = water_amount + electricity_amount + damage_amount + cleaning_fee + other_fees
        refund_amount = max(0, deposit_amount - total_deduction)
        
        checkout_date = None
        if row.get('checkout_date'):
            checkout_date = datetime.strptime(row['checkout_date'], '%Y-%m-%d').date()
        
        checkin_date = None
        if row.get('checkin_date'):
            checkin_date = datetime.strptime(row['checkin_date'], '%Y-%m-%d').date()
        
        record = SettlementRecord(
            record_no=record_no,
            batch_id=batch_id,
            property_id=row.get('property_id', ''),
            room_no=row.get('room_no', ''),
            tenant_name=row.get('tenant_name', ''),
            checkin_date=checkin_date,
            checkout_date=checkout_date,
            deposit_receipt_no=row.get('deposit_receipt_no', ''),
            deposit_amount=deposit_amount,
            water_start=water_start,
            water_end=water_end,
            water_usage=water_usage,
            water_amount=water_amount,
            electricity_start=electricity_start,
            electricity_end=electricity_end,
            electricity_usage=electricity_usage,
            electricity_amount=electricity_amount,
            electricity_tier='tiered',
            damage_amount=damage_amount,
            cleaning_fee=cleaning_fee,
            other_fees=other_fees,
            refund_amount=refund_amount,
            actual_refund=refund_amount
        )
        for detail in tier_result["details"]:
            tier_detail = ElectricityTierDetail(
                tier_name=detail["tier_name"],
                usage=detail["usage"],
                unit_price=detail["unit_price"],
                amount=detail["amount"]
            )
            record.tier_details.append(tier_detail)
        
        return record
    except Exception as e:
        print(f"Error parsing row: {e}")
        return None

def update_records_with_order(order_data, batch_id):
    updated_count = 0
    
    if isinstance(order_data, dict):
        order_data = [order_data]
    
    for order in order_data:
        deposit_receipt_no = order.get('deposit_receipt_no')
        if not deposit_receipt_no:
            continue
        
        record = SettlementRecord.query.filter_by(
            batch_id=batch_id,
            deposit_receipt_no=deposit_receipt_no
        ).first()
        
        if record:
            if order.get('tenant_name'):
                record.tenant_name = order['tenant_name']
            if order.get('checkin_date'):
                record.checkin_date = datetime.strptime(order['checkin_date'], '%Y-%m-%d').date()
            if order.get('checkout_date'):
                record.checkout_date = datetime.strptime(order['checkout_date'], '%Y-%m-%d').date()
            if order.get('property_id'):
                record.property_id = order['property_id']
            if order.get('room_no'):
                record.room_no = order['room_no']
            if order.get('deposit_amount'):
                record.deposit_amount = float(order['deposit_amount'])
            
            updated_count += 1
    
    db.session.commit()
    return updated_count
