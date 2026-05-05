import os
import json
import pandas as pd
from datetime import datetime, date
from flask import Flask, request, jsonify, send_file
from werkzeug.utils import secure_filename
from config import Config
from models import db, AccessRequest, TemperatureHumidity, SecurityClearance, \
    PestMoldTreatment, OutboundSeal, ReviewRecord, AuditLog

app = Flask(__name__)
app.config.from_object(Config)
Config.init_app(app)
db.init_app(app)

# 密级等级映射，用于比较
SECURITY_LEVEL_ORDER = {
    '公开': 0,
    '内部': 1,
    '秘密': 2,
    '机密': 3,
    '绝密': 4
}


def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS


def log_audit(action_type, module, operator, related_record_id=None, 
              related_record_no=None, action_details=None, ip_address=None):
    """记录审计日志"""
    audit_log = AuditLog(
        action_type=action_type,
        module=module,
        related_record_id=related_record_id,
        related_record_no=related_record_no,
        operator=operator,
        action_details=action_details,
        ip_address=ip_address or request.remote_addr
    )
    db.session.add(audit_log)
    db.session.commit()


def parse_date(date_str):
    """解析日期字符串，支持多种格式"""
    if not date_str or pd.isna(date_str):
        return None
    if isinstance(date_str, date):
        return date_str
    if isinstance(date_str, datetime):
        return date_str.date()
    date_formats = ['%Y-%m-%d', '%Y/%m/%d', '%d-%m-%Y', '%d/%m/%Y', '%Y%m%d']
    for fmt in date_formats:
        try:
            return datetime.strptime(str(date_str).strip(), fmt).date()
        except (ValueError, TypeError):
            continue
    return None


def check_security_clearance(request_obj):
    """检查密级授权是否足够"""
    if not request_obj.security_level or request_obj.security_level == '公开':
        return True, None
    
    user_clearances = SecurityClearance.query.filter_by(
        user_name=request_obj.requester_name,
        is_active=True
    ).all()
    
    if not user_clearances:
        if request_obj.requester_id_card:
            user_clearances = SecurityClearance.query.filter_by(
                user_id_card=request_obj.requester_id_card,
                is_active=True
            ).all()
    
    if not user_clearances:
        return False, "未查询到调阅人的密级授权记录"
    
    requested_level = SECURITY_LEVEL_ORDER.get(request_obj.security_level, 0)
    today = datetime.utcnow().date()
    
    for clearance in user_clearances:
        if clearance.valid_to and clearance.valid_to < today:
            continue
        
        user_level = SECURITY_LEVEL_ORDER.get(clearance.clearance_level, 0)
        if user_level >= requested_level:
            if clearance.authorized_archive_categories:
                authorized_cats = [cat.strip() for cat in clearance.authorized_archive_categories.split(',')]
                if request_obj.archive_category and request_obj.archive_category not in authorized_cats:
                    continue
            
            return True, None
    
    return False, f"调阅人密级授权不足。申请密级：{request_obj.security_level}，授权密级：{max([SECURITY_LEVEL_ORDER.get(c.clearance_level, 0) for c in user_clearances], default=0)}"


def check_pest_mold_status(request_obj):
    """检查档案是否有虫霉问题需要处理"""
    if not request_obj.archive_no:
        return True, None
    
    treatments = PestMoldTreatment.query.filter_by(
        archive_no=request_obj.archive_no
    ).all()
    
    active_treatments = [t for t in treatments if t.treatment_status in ['pending', '处理中', '已隔离']]
    
    if active_treatments:
        today = datetime.utcnow().date()
        for treatment in active_treatments:
            if treatment.quarantine_end_date and treatment.quarantine_end_date >= today:
                return False, f"档案存在{treatment.problem_type}问题，处于隔离期，隔离结束日期：{treatment.quarantine_end_date}"
            if treatment.treatment_status == 'pending':
                return False, f"档案存在{treatment.problem_type}问题，尚未处理"
            if treatment.treatment_status == '处理中':
                return False, f"档案存在{treatment.problem_type}问题，正在处理中"
    
    return True, None


def check_outbound_seal(request_obj):
    """检查出库封签状态"""
    if not request_obj.archive_no:
        return True, None
    
    seals = OutboundSeal.query.filter_by(
        archive_no=request_obj.archive_no,
        seal_status='active'
    ).all()
    
    if seals:
        return False, f"档案当前有有效封签，需先解除封签后才能调阅"
    
    return True, None


def evaluate_request_status(request_obj):
    """综合评估调阅申请状态"""
    issues = []
    
    seal_ok, seal_msg = check_outbound_seal(request_obj)
    if not seal_ok:
        issues.append(('seal', seal_msg))
    
    pest_ok, pest_msg = check_pest_mold_status(request_obj)
    if not pest_ok:
        issues.append(('pest_mold', pest_msg))
    
    security_ok, security_msg = check_security_clearance(request_obj)
    if not security_ok:
        issues.append(('security', security_msg))
    
    status = 'approved'
    status_desc = '可以调阅'
    issues_detail = []
    
    for issue_type, msg in issues:
        issues_detail.append(msg)
        if issue_type == 'security':
            status = 'needs_authorization'
            status_desc = '需补充授权'
        elif issue_type == 'pest_mold':
            status = 'needs_quarantine'
            status_desc = '需先隔离处理'
        elif issue_type == 'seal':
            status = 'needs_supervisor'
            status_desc = '要主管复核'
    
    if len(issues) > 1:
        status = 'needs_supervisor'
        status_desc = '存在多个问题，要主管复核'
    
    return {
        'request_no': request_obj.request_no,
        'status': status,
        'status_description': status_desc,
        'issues': issues_detail,
        'can_access': status == 'approved',
        'needs_authorization': status == 'needs_authorization',
        'needs_quarantine': status == 'needs_quarantine' or '隔离' in status_desc,
        'needs_supervisor': status == 'needs_supervisor'
    }


@app.route('/api/import/<data_type>', methods=['POST'])
def import_data(data_type):
    """导入数据接口"""
    valid_types = ['access_request', 'temperature_humidity', 'security_clearance', 
                   'pest_mold_treatment', 'outbound_seal']
    
    if data_type not in valid_types:
        return jsonify({'error': f'无效的数据类型，支持的类型：{valid_types}'}), 400
    
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': f'不支持的文件格式，支持：{Config.ALLOWED_EXTENSIONS}'}), 400
    
    try:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        if filename.endswith('.csv'):
            df = pd.read_csv(filepath, encoding='utf-8')
        else:
            df = pd.read_json(filepath, encoding='utf-8')
        
        imported_count = 0
        errors = []
        
        model_map = {
            'access_request': AccessRequest,
            'temperature_humidity': TemperatureHumidity,
            'security_clearance': SecurityClearance,
            'pest_mold_treatment': PestMoldTreatment,
            'outbound_seal': OutboundSeal
        }
        
        Model = model_map[data_type]
        module_names = {
            'access_request': '调阅申请',
            'temperature_humidity': '温湿度',
            'security_clearance': '密级授权',
            'pest_mold_treatment': '虫霉处理',
            'outbound_seal': '出库封签'
        }
        
        for idx, row in df.iterrows():
            try:
                if data_type == 'access_request':
                    existing = AccessRequest.query.filter_by(request_no=str(row.get('申请单号', row.get('request_no', '')))).first()
                    if existing:
                        errors.append(f"第{idx+2}行：申请单号已存在")
                        continue
                    
                    obj = AccessRequest(
                        request_no=str(row.get('申请单号', row.get('request_no', f'REQ{datetime.now().strftime("%Y%m%d%H%M%S")}'))),
                        request_date=parse_date(row.get('申请日期', row.get('request_date'))),
                        requester_name=str(row.get('调阅人', row.get('requester_name', ''))),
                        requester_department=str(row.get('部门', row.get('requester_department', ''))),
                        requester_id_card=str(row.get('身份证号', row.get('requester_id_card', ''))),
                        archive_category=str(row.get('档案类别', row.get('archive_category', ''))),
                        archive_no=str(row.get('档案号', row.get('archive_no', ''))),
                        archive_title=str(row.get('档案标题', row.get('archive_title', ''))),
                        archive_date_range=str(row.get('年代范围', row.get('archive_date_range', ''))),
                        access_reason=str(row.get('调阅理由', row.get('access_reason', ''))),
                        access_method=str(row.get('调阅方式', row.get('access_method', ''))),
                        access_duration=str(row.get('调阅时长', row.get('access_duration', ''))),
                        security_level=str(row.get('密级', row.get('security_level', '公开'))),
                        status='pending'
                    )
                
                elif data_type == 'temperature_humidity':
                    temp = row.get('温度', row.get('temperature', 0))
                    humidity = row.get('湿度', row.get('humidity', 0))
                    
                    temp_status = 'normal'
                    if temp < 14 or temp > 24:
                        temp_status = '异常' if (temp < 10 or temp > 28) else ('偏低' if temp < 14 else '偏高')
                    
                    humidity_status = 'normal'
                    if humidity < 45 or humidity > 60:
                        humidity_status = '异常' if (humidity < 40 or humidity > 65) else ('偏低' if humidity < 45 else '偏高')
                    
                    obj = TemperatureHumidity(
                        storage_room=str(row.get('库房', row.get('storage_room', ''))),
                        record_date=parse_date(row.get('记录日期', row.get('record_date'))),
                        record_time=datetime.strptime(str(row.get('记录时间', row.get('record_time', '00:00:00'))), '%H:%M:%S').time() if row.get('记录时间', row.get('record_time')) else None,
                        temperature=float(temp) if pd.notna(temp) else None,
                        humidity=float(humidity) if pd.notna(humidity) else None,
                        temp_status=temp_status,
                        humidity_status=humidity_status,
                        recorder=str(row.get('记录人', row.get('recorder', ''))),
                        remarks=str(row.get('备注', row.get('remarks', '')))
                    )
                
                elif data_type == 'security_clearance':
                    obj = SecurityClearance(
                        user_name=str(row.get('用户名', row.get('user_name', ''))),
                        user_id_card=str(row.get('身份证号', row.get('user_id_card', ''))),
                        department=str(row.get('部门', row.get('department', ''))),
                        clearance_level=str(row.get('授权密级', row.get('clearance_level', '公开'))),
                        authorized_archive_categories=str(row.get('授权类别', row.get('authorized_archive_categories', ''))),
                        authorized_date_range=str(row.get('年代范围', row.get('authorized_date_range', ''))),
                        valid_from=parse_date(row.get('生效日期', row.get('valid_from'))) or datetime.utcnow().date(),
                        valid_to=parse_date(row.get('失效日期', row.get('valid_to'))),
                        authorization_doc_no=str(row.get('授权文件号', row.get('authorization_doc_no', ''))),
                        authorizer=str(row.get('授权人', row.get('authorizer', ''))),
                        is_active=bool(row.get('是否有效', row.get('is_active', True)))
                    )
                
                elif data_type == 'pest_mold_treatment':
                    obj = PestMoldTreatment(
                        archive_no=str(row.get('档案号', row.get('archive_no', ''))),
                        archive_title=str(row.get('档案标题', row.get('archive_title', ''))),
                        problem_type=str(row.get('问题类型', row.get('problem_type', '虫害'))),
                        discovery_date=parse_date(row.get('发现日期', row.get('discovery_date'))),
                        severity=str(row.get('严重程度', row.get('severity', '轻微'))),
                        treatment_status=str(row.get('处理状态', row.get('treatment_status', 'pending'))),
                        treatment_method=str(row.get('处理方法', row.get('treatment_method', ''))),
                        treatment_date=parse_date(row.get('处理日期', row.get('treatment_date'))),
                        treated_by=str(row.get('处理人', row.get('treated_by', ''))),
                        quarantine_end_date=parse_date(row.get('隔离结束日期', row.get('quarantine_end_date'))),
                        inspection_result=str(row.get('检查结果', row.get('inspection_result', ''))),
                        remarks=str(row.get('备注', row.get('remarks', '')))
                    )
                
                elif data_type == 'outbound_seal':
                    existing = OutboundSeal.query.filter_by(seal_no=str(row.get('封签编号', row.get('seal_no', '')))).first()
                    if existing:
                        errors.append(f"第{idx+2}行：封签编号已存在")
                        continue
                    
                    obj = OutboundSeal(
                        seal_no=str(row.get('封签编号', row.get('seal_no', f'SEAL{datetime.now().strftime("%Y%m%d%H%M%S")}'))),
                        archive_no=str(row.get('档案号', row.get('archive_no', ''))),
                        archive_title=str(row.get('档案标题', row.get('archive_title', ''))),
                        seal_type=str(row.get('封签类型', row.get('seal_type', '出库封签'))),
                        seal_date=parse_date(row.get('封签日期', row.get('seal_date'))) or datetime.utcnow().date(),
                        sealed_by=str(row.get('封签人', row.get('sealed_by', ''))),
                        seal_status=str(row.get('封签状态', row.get('seal_status', 'active'))),
                        unseal_date=parse_date(row.get('拆封日期', row.get('unseal_date'))),
                        unsealed_by=str(row.get('拆封人', row.get('unsealed_by', ''))),
                        unseal_reason=str(row.get('拆封原因', row.get('unseal_reason', ''))),
                        remarks=str(row.get('备注', row.get('remarks', '')))
                    )
                
                db.session.add(obj)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"第{idx+2}行：{str(e)}")
                continue
        
        db.session.commit()
        
        log_audit(
            action_type='导入',
            module=module_names[data_type],
            operator=request.headers.get('X-Operator', 'system'),
            action_details=f"成功导入{imported_count}条记录，错误{len(errors)}条"
        )
        
        return jsonify({
            'success': True,
            'imported_count': imported_count,
            'errors': errors,
            'message': f'导入完成，成功{imported_count}条，失败{len(errors)}条'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'导入失败：{str(e)}'}), 500


@app.route('/api/request/<request_no>', methods=['GET'])
def get_request_status(request_no):
    """查询调阅申请状态"""
    request_obj = AccessRequest.query.filter_by(request_no=request_no).first()
    
    if not request_obj:
        return jsonify({'error': '未找到该申请单号'}), 404
    
    evaluation = evaluate_request_status(request_obj)
    
    log_audit(
        action_type='查询',
        module='调阅申请',
        operator=request.headers.get('X-Operator', 'system'),
        related_record_id=request_obj.id,
        related_record_no=request_no,
        action_details=f"查询申请单状态：{evaluation['status_description']}"
    )
    
    return jsonify({
        'request_info': request_obj.to_dict(),
        'evaluation': evaluation,
        'reviews': [r.to_dict() for r in request_obj.reviews.order_by(ReviewRecord.review_date.desc()).all()]
    })


@app.route('/api/request/<request_no>/review', methods=['POST'])
def submit_review(request_no):
    """提交复核意见"""
    request_obj = AccessRequest.query.filter_by(request_no=request_no).first()
    
    if not request_obj:
        return jsonify({'error': '未找到该申请单号'}), 404
    
    data = request.get_json()
    
    review_result = data.get('review_result')
    reviewer = data.get('reviewer', request.headers.get('X-Operator', 'system'))
    review_remark = data.get('review_remark', '')
    needs_supervisor = data.get('needs_supervisor_review', False)
    
    valid_results = ['通过', '拒绝', '需补充授权', '需先隔离处理', '要主管复核']
    if review_result not in valid_results:
        return jsonify({'error': f'无效的复核结果，有效值：{valid_results}'}), 400
    
    try:
        review = ReviewRecord(
            request_id=request_obj.id,
            review_result=review_result,
            reviewer=reviewer,
            review_remark=review_remark,
            needs_supervisor_review=needs_supervisor
        )
        
        if needs_supervisor:
            review.supervisor_reviewer = data.get('supervisor_reviewer')
            review.supervisor_remark = data.get('supervisor_remark')
        
        db.session.add(review)
        
        status_map = {
            '通过': 'approved',
            '拒绝': 'rejected',
            '需补充授权': 'needs_authorization',
            '需先隔离处理': 'needs_quarantine',
            '要主管复核': 'needs_supervisor'
        }
        request_obj.status = status_map.get(review_result, 'pending')
        
        db.session.commit()
        
        log_audit(
            action_type='复核',
            module='调阅申请',
            operator=reviewer,
            related_record_id=request_obj.id,
            related_record_no=request_no,
            action_details=f"提交复核结果：{review_result}，备注：{review_remark[:100] if review_remark else '无'}"
        )
        
        return jsonify({
            'success': True,
            'message': '复核意见已保存',
            'review': review.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'保存失败：{str(e)}'}), 500


@app.route('/api/audit/export', methods=['GET'])
def export_audit_logs():
    """导出审计日志为JSON包"""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    module = request.args.get('module')
    action_type = request.args.get('action_type')
    
    query = AuditLog.query
    
    if start_date:
        try:
            start = datetime.strptime(start_date, '%Y-%m-%d')
            query = query.filter(AuditLog.created_at >= start)
        except ValueError:
            pass
    
    if end_date:
        try:
            end = datetime.strptime(end_date, '%Y-%m-%d')
            end = end.replace(hour=23, minute=59, second=59)
            query = query.filter(AuditLog.created_at <= end)
        except ValueError:
            pass
    
    if module:
        query = query.filter(AuditLog.module == module)
    if action_type:
        query = query.filter(AuditLog.action_type == action_type)
    
    logs = query.order_by(AuditLog.created_at.desc()).all()
    
    export_data = {
        'export_info': {
            'export_time': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
            'export_criteria': {
                'start_date': start_date,
                'end_date': end_date,
                'module': module,
                'action_type': action_type
            },
            'total_records': len(logs)
        },
        'audit_logs': [log.to_dict() for log in logs]
    }
    
    filename = f'audit_export_{datetime.now().strftime("%Y%m%d%H%M%S")}.json'
    filepath = os.path.join(app.config['EXPORT_FOLDER'], filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(export_data, f, ensure_ascii=False, indent=2)
    
    log_audit(
        action_type='导出',
        module='审计日志',
        operator=request.headers.get('X-Operator', 'system'),
        action_details=f'导出审计日志{len(logs)}条'
    )
    
    return send_file(
        filepath,
        mimetype='application/json',
        as_attachment=True,
        download_name=filename
    )


@app.route('/api/requests', methods=['GET'])
def list_requests():
    """列出所有调阅申请"""
    status = request.args.get('status')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    query = AccessRequest.query
    
    if status:
        query = query.filter_by(status=status)
    
    pagination = query.order_by(AccessRequest.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        'total': pagination.total,
        'page': pagination.page,
        'per_page': pagination.per_page,
        'requests': [r.to_dict() for r in pagination.items]
    })


@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        'status': 'healthy',
        'database': 'connected',
        'timestamp': datetime.utcnow().isoformat()
    })


with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
