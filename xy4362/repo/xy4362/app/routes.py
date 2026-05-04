from flask import Blueprint, request, jsonify, make_response
from datetime import datetime, date
from app import db
from app.models import Tank, FillRecord, OxygenTarget, DivePlan, DivePlanTank, RiskAssessment, Review
from app.risk_detector import RiskDetector
import json
import io
import csv

main = Blueprint('main', __name__)
risk_detector = RiskDetector()

@main.route('/')
def index():
    return jsonify({
        'message': '潜水俱乐部后端服务',
        'version': '1.0.0',
        'endpoints': {
            'tanks': '/api/tanks',
            'fill_records': '/api/fill-records',
            'oxygen_targets': '/api/oxygen-targets',
            'dive_plans': '/api/dive-plans',
            'import': '/api/import',
            'review': '/api/review',
            'export': '/api/export'
        }
    })

@main.route('/api/tanks', methods=['GET'])
def get_tanks():
    tanks = Tank.query.all()
    return jsonify([tank.to_dict() for tank in tanks])

@main.route('/api/tanks/<int:tank_id>', methods=['GET'])
def get_tank(tank_id):
    tank = Tank.query.get_or_404(tank_id)
    return jsonify(tank.to_dict())

@main.route('/api/tanks', methods=['POST'])
def create_tank():
    data = request.get_json()
    
    if Tank.query.filter_by(serial_number=data['serial_number']).first():
        return jsonify({'error': '气瓶编号已存在'}), 400
    
    tank = Tank(
        serial_number=data['serial_number'],
        volume=data['volume'],
        tank_type=data['tank_type'],
        current_pressure=data.get('current_pressure', 0),
        inspection_expiry_date=datetime.strptime(data['inspection_expiry_date'], '%Y-%m-%d').date()
    )
    
    db.session.add(tank)
    db.session.commit()
    
    return jsonify(tank.to_dict()), 201

@main.route('/api/tanks/<int:tank_id>', methods=['PUT'])
def update_tank(tank_id):
    tank = Tank.query.get_or_404(tank_id)
    data = request.get_json()
    
    if 'serial_number' in data:
        existing = Tank.query.filter_by(serial_number=data['serial_number']).first()
        if existing and existing.id != tank_id:
            return jsonify({'error': '气瓶编号已存在'}), 400
        tank.serial_number = data['serial_number']
    
    if 'volume' in data:
        tank.volume = data['volume']
    if 'tank_type' in data:
        tank.tank_type = data['tank_type']
    if 'current_pressure' in data:
        tank.current_pressure = data['current_pressure']
    if 'inspection_expiry_date' in data:
        tank.inspection_expiry_date = datetime.strptime(data['inspection_expiry_date'], '%Y-%m-%d').date()
    
    db.session.commit()
    return jsonify(tank.to_dict())

@main.route('/api/tanks/<int:tank_id>', methods=['DELETE'])
def delete_tank(tank_id):
    tank = Tank.query.get_or_404(tank_id)
    db.session.delete(tank)
    db.session.commit()
    return jsonify({'message': '气瓶已删除'}), 200

@main.route('/api/fill-records', methods=['GET'])
def get_fill_records():
    records = FillRecord.query.all()
    return jsonify([record.to_dict() for record in records])

@main.route('/api/fill-records', methods=['POST'])
def create_fill_record():
    data = request.get_json()
    
    tank = Tank.query.get(data.get('tank_id'))
    if not tank:
        return jsonify({'error': '气瓶不存在'}), 404
    
    record = FillRecord(
        tank_id=data['tank_id'],
        oxygen_partial_pressure=data['oxygen_partial_pressure'],
        fill_pressure=data['fill_pressure'],
        operator=data.get('operator'),
        notes=data.get('notes')
    )
    
    tank.current_pressure = data['fill_pressure']
    
    db.session.add(record)
    db.session.commit()
    
    return jsonify(record.to_dict()), 201

@main.route('/api/oxygen-targets', methods=['GET'])
def get_oxygen_targets():
    targets = OxygenTarget.query.all()
    return jsonify([target.to_dict() for target in targets])

@main.route('/api/oxygen-targets', methods=['POST'])
def create_oxygen_target():
    data = request.get_json()
    
    target = OxygenTarget(
        depth=data['depth'],
        max_oxygen_partial_pressure=data.get('max_oxygen_partial_pressure', 1.4),
        description=data.get('description')
    )
    
    db.session.add(target)
    db.session.commit()
    
    return jsonify(target.to_dict()), 201

@main.route('/api/dive-plans', methods=['GET'])
def get_dive_plans():
    plans = DivePlan.query.all()
    result = []
    for plan in plans:
        plan_dict = plan.to_dict()
        plan_dict['tanks'] = [{
            'tank_id': dpt.tank_id,
            'tank': dpt.tank.to_dict() if dpt.tank else None,
            'role': dpt.role
        } for dpt in plan.dive_plan_tanks]
        plan_dict['risks'] = [risk.to_dict() for risk in plan.risk_assessments]
        result.append(plan_dict)
    return jsonify(result)

@main.route('/api/dive-plans/<int:plan_id>', methods=['GET'])
def get_dive_plan(plan_id):
    plan = DivePlan.query.get_or_404(plan_id)
    plan_dict = plan.to_dict()
    plan_dict['tanks'] = [{
        'tank_id': dpt.tank_id,
        'tank': dpt.tank.to_dict() if dpt.tank else None,
        'role': dpt.role
    } for dpt in plan.dive_plan_tanks]
    plan_dict['risks'] = [risk.to_dict() for risk in plan.risk_assessments]
    plan_dict['reviews'] = [review.to_dict() for review in plan.reviews]
    return jsonify(plan_dict)

@main.route('/api/dive-plans', methods=['POST'])
def create_dive_plan():
    data = request.get_json()
    
    plan = DivePlan(
        plan_name=data['plan_name'],
        dive_date=datetime.strptime(data['dive_date'], '%Y-%m-%d').date(),
        dive_site=data['dive_site'],
        coach=data['coach'],
        status='draft'
    )
    
    db.session.add(plan)
    db.session.commit()
    
    return jsonify(plan.to_dict()), 201

@main.route('/api/import/json', methods=['POST'])
def import_json():
    data = request.get_json()
    
    if 'dive_plan' not in data or 'tanks' not in data:
        return jsonify({'error': '缺少必要的 dive_plan 或 tanks 字段'}), 400
    
    plan_data = data['dive_plan']
    tanks_data = data['tanks']
    
    plan = DivePlan(
        plan_name=plan_data['plan_name'],
        dive_date=datetime.strptime(plan_data['dive_date'], '%Y-%m-%d').date(),
        dive_site=plan_data['dive_site'],
        coach=plan_data['coach'],
        status='pending_review'
    )
    
    db.session.add(plan)
    db.session.flush()
    
    dive_plan_tanks = []
    for tank_item in tanks_data:
        tank_id = tank_item.get('tank_id')
        serial_number = tank_item.get('serial_number')
        role = tank_item.get('role', 'primary')
        
        tank = None
        if tank_id:
            tank = Tank.query.get(tank_id)
        elif serial_number:
            tank = Tank.query.filter_by(serial_number=serial_number).first()
        
        if not tank:
            db.session.rollback()
            return jsonify({'error': f'未找到气瓶: {tank_id or serial_number}'}), 404
        
        existing = DivePlanTank.query.filter_by(
            dive_plan_id=plan.id,
            tank_id=tank.id
        ).first()
        
        if existing:
            db.session.rollback()
            return jsonify({'error': f'气瓶 {tank.serial_number} 已被分配到该计划'}), 400
        
        dpt = DivePlanTank(
            dive_plan_id=plan.id,
            tank_id=tank.id,
            role=role
        )
        db.session.add(dpt)
        dive_plan_tanks.append(dpt)
    
    db.session.flush()
    
    risks = risk_detector.check_all_risks(plan, dive_plan_tanks)
    risk_detector.create_risk_assessments(plan, risks)
    
    if risk_detector.has_unresolved_critical_risks(plan):
        plan.status = 'blocked'
    else:
        plan.status = 'pending_review'
    
    db.session.commit()
    
    plan_dict = plan.to_dict()
    plan_dict['tanks'] = [{
        'tank_id': dpt.tank_id,
        'tank': dpt.tank.to_dict() if dpt.tank else None,
        'role': dpt.role
    } for dpt in dive_plan_tanks]
    plan_dict['risks'] = [risk.to_dict() for risk in RiskAssessment.query.filter_by(dive_plan_id=plan.id).all()]
    plan_dict['has_critical_risks'] = risk_detector.has_unresolved_critical_risks(plan)
    
    return jsonify({
        'message': '导入成功',
        'dive_plan': plan_dict
    }), 201

@main.route('/api/import/csv', methods=['POST'])
def import_csv():
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    plan_name = request.form.get('plan_name', '未命名计划')
    dive_date = request.form.get('dive_date', date.today().strftime('%Y-%m-%d'))
    dive_site = request.form.get('dive_site', '未指定潜点')
    coach = request.form.get('coach', '未指定教练')
    
    stream = io.StringIO(file.stream.read().decode('UTF-8'))
    reader = csv.DictReader(stream)
    
    plan = DivePlan(
        plan_name=plan_name,
        dive_date=datetime.strptime(dive_date, '%Y-%m-%d').date(),
        dive_site=dive_site,
        coach=coach,
        status='pending_review'
    )
    
    db.session.add(plan)
    db.session.flush()
    
    dive_plan_tanks = []
    errors = []
    
    for row_num, row in enumerate(reader, start=2):
        try:
            serial_number = row.get('serial_number', '').strip()
            role = row.get('role', 'primary').strip().lower()
            
            if not serial_number:
                errors.append(f'第 {row_num} 行: 缺少气瓶编号')
                continue
            
            tank = Tank.query.filter_by(serial_number=serial_number).first()
            if not tank:
                errors.append(f'第 {row_num} 行: 未找到气瓶 {serial_number}')
                continue
            
            existing = DivePlanTank.query.filter_by(
                dive_plan_id=plan.id,
                tank_id=tank.id
            ).first()
            
            if existing:
                errors.append(f'第 {row_num} 行: 气瓶 {serial_number} 已被分配')
                continue
            
            dpt = DivePlanTank(
                dive_plan_id=plan.id,
                tank_id=tank.id,
                role=role
            )
            db.session.add(dpt)
            dive_plan_tanks.append(dpt)
            
        except Exception as e:
            errors.append(f'第 {row_num} 行: {str(e)}')
    
    if errors and not dive_plan_tanks:
        db.session.rollback()
        return jsonify({
            'error': '导入失败',
            'errors': errors
        }), 400
    
    db.session.flush()
    
    risks = risk_detector.check_all_risks(plan, dive_plan_tanks)
    risk_detector.create_risk_assessments(plan, risks)
    
    if risk_detector.has_unresolved_critical_risks(plan):
        plan.status = 'blocked'
    else:
        plan.status = 'pending_review'
    
    db.session.commit()
    
    plan_dict = plan.to_dict()
    plan_dict['tanks'] = [{
        'tank_id': dpt.tank_id,
        'tank': dpt.tank.to_dict() if dpt.tank else None,
        'role': dpt.role
    } for dpt in dive_plan_tanks]
    plan_dict['risks'] = [risk.to_dict() for risk in RiskAssessment.query.filter_by(dive_plan_id=plan.id).all()]
    plan_dict['has_critical_risks'] = risk_detector.has_unresolved_critical_risks(plan)
    
    return jsonify({
        'message': '导入成功',
        'warnings': errors,
        'dive_plan': plan_dict
    }), 201

@main.route('/api/review/<int:plan_id>/risks', methods=['GET'])
def get_risks_for_review(plan_id):
    plan = DivePlan.query.get_or_404(plan_id)
    risks = RiskAssessment.query.filter_by(dive_plan_id=plan_id).all()
    
    return jsonify({
        'dive_plan': plan.to_dict(),
        'risks': [risk.to_dict() for risk in risks],
        'has_unresolved_critical': risk_detector.has_unresolved_critical_risks(plan)
    })

@main.route('/api/review/risk/<int:risk_id>', methods=['POST'])
def resolve_risk(risk_id):
    risk = RiskAssessment.query.get_or_404(risk_id)
    data = request.get_json()
    
    action = data.get('action')
    reviewer = data.get('reviewer', '未知')
    reason = data.get('reason', '')
    
    if action not in ['approve', 'reject', 'override']:
        return jsonify({'error': '无效的操作类型'}), 400
    
    if action == 'override':
        risk.resolved = True
        risk.resolved_by = reviewer
        risk.resolved_reason = reason
        
        review = Review(
            dive_plan_id=risk.dive_plan_id,
            risk_assessment_id=risk.id,
            reviewer=reviewer,
            action='override',
            reason=reason
        )
        db.session.add(review)
        
        plan = DivePlan.query.get(risk.dive_plan_id)
        if plan and not risk_detector.has_unresolved_critical_risks(plan):
            plan.status = 'pending_review'
    
    elif action == 'reject':
        plan = DivePlan.query.get(risk.dive_plan_id)
        if plan:
            plan.status = 'rejected'
        
        review = Review(
            dive_plan_id=risk.dive_plan_id,
            risk_assessment_id=risk.id,
            reviewer=reviewer,
            action='reject',
            reason=reason
        )
        db.session.add(review)
    
    elif action == 'approve':
        risk.resolved = True
        risk.resolved_by = reviewer
        risk.resolved_reason = reason
        
        review = Review(
            dive_plan_id=risk.dive_plan_id,
            risk_assessment_id=risk.id,
            reviewer=reviewer,
            action='approve',
            reason=reason
        )
        db.session.add(review)
        
        plan = DivePlan.query.get(risk.dive_plan_id)
        if plan and not risk_detector.has_unresolved_critical_risks(plan):
            plan.status = 'approved'
    
    db.session.commit()
    
    return jsonify({
        'message': '操作成功',
        'risk': risk.to_dict()
    })

@main.route('/api/review/<int:plan_id>/approve', methods=['POST'])
def approve_plan(plan_id):
    plan = DivePlan.query.get_or_404(plan_id)
    data = request.get_json()
    reviewer = data.get('reviewer', '未知')
    
    if risk_detector.has_unresolved_critical_risks(plan):
        return jsonify({
            'error': '存在未解决的关键风险，无法批准计划',
            'risks': [risk.to_dict() for risk in plan.risk_assessments.filter_by(severity='critical', resolved=False).all()]
        }), 400
    
    plan.status = 'approved'
    
    review = Review(
        dive_plan_id=plan_id,
        reviewer=reviewer,
        action='approve_plan',
        reason='整体批准'
    )
    db.session.add(review)
    db.session.commit()
    
    return jsonify({
        'message': '计划已批准',
        'dive_plan': plan.to_dict()
    })

@main.route('/api/export/<int:plan_id>/markdown', methods=['GET'])
def export_markdown(plan_id):
    plan = DivePlan.query.get_or_404(plan_id)
    
    tanks = [{
        'tank': dpt.tank.to_dict(),
        'role': dpt.role,
        'latest_fill': FillRecord.query.filter_by(tank_id=dpt.tank_id).order_by(FillRecord.fill_date.desc()).first()
    } for dpt in plan.dive_plan_tanks]
    
    risks = [risk.to_dict() for risk in plan.risk_assessments]
    reviews = [review.to_dict() for review in plan.reviews]
    
    md_lines = []
    md_lines.append(f'# 装船清单 - {plan.plan_name}')
    md_lines.append('')
    md_lines.append('## 基本信息')
    md_lines.append(f'- **计划名称**: {plan.plan_name}')
    md_lines.append(f'- **潜水日期**: {plan.dive_date.strftime("%Y-%m-%d")}')
    md_lines.append(f'- **潜点**: {plan.dive_site}')
    md_lines.append(f'- **负责教练**: {plan.coach}')
    md_lines.append(f'- **状态**: {plan.status}')
    md_lines.append('')
    
    md_lines.append('## 气瓶分配')
    md_lines.append('')
    md_lines.append('| 编号 | 类型 | 容积(L) | 当前压力(bar) | 角色 | 氧分压 | 年检到期 |')
    md_lines.append('|------|------|---------|---------------|------|--------|----------|')
    
    for tank_info in tanks:
        tank = tank_info['tank']
        latest_fill = tank_info['latest_fill']
        ppo2 = latest_fill.oxygen_partial_pressure if latest_fill else 'N/A'
        md_lines.append(f'| {tank["serial_number"]} | {tank["tank_type"]} | {tank["volume"]} | {tank["current_pressure"]} | {tank_info["role"]} | {ppo2} | {tank["inspection_expiry_date"]} |')
    
    md_lines.append('')
    
    unresolved_risks = [r for r in risks if not r['resolved']]
    resolved_risks = [r for r in risks if r['resolved']]
    
    if unresolved_risks:
        md_lines.append('## ⚠️ 未解决风险')
        md_lines.append('')
        for risk in unresolved_risks:
            md_lines.append(f'### [{risk["severity"].upper()}] {risk["risk_type"]}')
            md_lines.append(f'{risk["details"]}')
            md_lines.append('')
    
    if resolved_risks:
        md_lines.append('## ✅ 已解决风险')
        md_lines.append('')
        for risk in resolved_risks:
            md_lines.append(f'### [{risk["severity"].upper()}] {risk["risk_type"]}')
            md_lines.append(f'{risk["details"]}')
            md_lines.append(f'- 解决人: {risk["resolved_by"]}')
            md_lines.append(f'- 原因: {risk["resolved_reason"]}')
            md_lines.append('')
    
    if reviews:
        md_lines.append('## 📝 复核记录')
        md_lines.append('')
        for review in reviews:
            md_lines.append(f'- **{review["reviewer"]}** ({review["created_at"]}): {review["action"]}')
            if review["reason"]:
                md_lines.append(f'  - 原因: {review["reason"]}')
        md_lines.append('')
    
    md_lines.append('---')
    md_lines.append(f'*生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}*')
    
    markdown_content = '\n'.join(md_lines)
    
    response = make_response(markdown_content)
    response.headers['Content-Type'] = 'text/markdown; charset=utf-8'
    response.headers['Content-Disposition'] = f'attachment; filename=装船清单_{plan.plan_name}.md'
    
    return response

@main.route('/api/export/<int:plan_id>/json', methods=['GET'])
def export_json(plan_id):
    plan = DivePlan.query.get_or_404(plan_id)
    
    tanks_info = []
    for dpt in plan.dive_plan_tanks:
        tank = dpt.tank
        latest_fill = FillRecord.query.filter_by(tank_id=tank.id).order_by(FillRecord.fill_date.desc()).first()
        tanks_info.append({
            'tank': tank.to_dict(),
            'role': dpt.role,
            'latest_fill': latest_fill.to_dict() if latest_fill else None
        })
    
    audit_data = {
        'export_metadata': {
            'export_time': datetime.now().isoformat(),
            'plan_id': plan.id,
            'plan_name': plan.plan_name
        },
        'dive_plan': plan.to_dict(),
        'tanks': tanks_info,
        'risk_assessments': [risk.to_dict() for risk in plan.risk_assessments],
        'reviews': [review.to_dict() for review in plan.reviews],
        'risk_summary': {
            'total_risks': plan.risk_assessments.count(),
            'resolved_risks': plan.risk_assessments.filter_by(resolved=True).count(),
            'unresolved_risks': plan.risk_assessments.filter_by(resolved=False).count(),
            'critical_risks': plan.risk_assessments.filter_by(severity='critical').count()
        }
    }
    
    response = make_response(json.dumps(audit_data, ensure_ascii=False, indent=2))
    response.headers['Content-Type'] = 'application/json; charset=utf-8'
    response.headers['Content-Disposition'] = f'attachment; filename=审计包_{plan.plan_name}.json'
    
    return response

@main.route('/api/export/<int:plan_id>/all', methods=['GET'])
def export_all(plan_id):
    plan = DivePlan.query.get_or_404(plan_id)
    
    markdown_resp = export_markdown(plan_id)
    json_resp = export_json(plan_id)
    
    return jsonify({
        'plan_id': plan_id,
        'plan_name': plan.plan_name,
        'markdown_preview': markdown_resp.get_data(as_text=True),
        'audit_package': json.loads(json_resp.get_data(as_text=True))
    })
