import json
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, make_response
from extensions import db
from models import Equipment, Fridge, Volunteer, Application, AuditLog
from services import (
    EquipmentService, FridgeService, VolunteerService, ApplicationService,
    AuditLogService, EquipmentUsageService, FridgeUsageService
)
from risk_control import RiskControlService
from export_service import ExportService

api_bp = Blueprint('api', __name__)


# 基础数据管理接口

# 设备管理
@api_bp.route('/equipment', methods=['GET'])
def get_equipment():
    equipment_list = EquipmentService.get_all()
    return jsonify([eq.to_dict() for eq in equipment_list])


@api_bp.route('/equipment/<int:equipment_id>', methods=['GET'])
def get_equipment_by_id(equipment_id):
    equipment = EquipmentService.get_by_id(equipment_id)
    if equipment:
        return jsonify(equipment.to_dict())
    return jsonify({'error': '设备不存在'}), 404


@api_bp.route('/equipment', methods=['POST'])
def create_equipment():
    data = request.get_json()
    if not data.get('name') or not data.get('type'):
        return jsonify({'error': '设备名称和类型不能为空'}), 400
    
    equipment = EquipmentService.create(data)
    return jsonify(equipment.to_dict()), 201


@api_bp.route('/equipment/<int:equipment_id>', methods=['PUT'])
def update_equipment(equipment_id):
    data = request.get_json()
    equipment = EquipmentService.update(equipment_id, data)
    if equipment:
        return jsonify(equipment.to_dict())
    return jsonify({'error': '设备不存在'}), 404


@api_bp.route('/equipment/<int:equipment_id>', methods=['DELETE'])
def delete_equipment(equipment_id):
    if EquipmentService.delete(equipment_id):
        return jsonify({'message': '设备已删除'})
    return jsonify({'error': '设备不存在'}), 404


# 冷藏格管理
@api_bp.route('/fridges', methods=['GET'])
def get_fridges():
    fridge_list = FridgeService.get_all()
    return jsonify([f.to_dict() for f in fridge_list])


@api_bp.route('/fridges/<int:fridge_id>', methods=['GET'])
def get_fridge_by_id(fridge_id):
    fridge = FridgeService.get_by_id(fridge_id)
    if fridge:
        return jsonify(fridge.to_dict())
    return jsonify({'error': '冷藏格不存在'}), 404


@api_bp.route('/fridges', methods=['POST'])
def create_fridge():
    data = request.get_json()
    if not data.get('name') or not data.get('type') or data.get('total_capacity') is None:
        return jsonify({'error': '冷藏格名称、类型和总容量不能为空'}), 400
    
    fridge = FridgeService.create(data)
    return jsonify(fridge.to_dict()), 201


@api_bp.route('/fridges/<int:fridge_id>', methods=['PUT'])
def update_fridge(fridge_id):
    data = request.get_json()
    fridge = FridgeService.update(fridge_id, data)
    if fridge:
        return jsonify(fridge.to_dict())
    return jsonify({'error': '冷藏格不存在'}), 404


@api_bp.route('/fridges/<int:fridge_id>', methods=['DELETE'])
def delete_fridge(fridge_id):
    if FridgeService.delete(fridge_id):
        return jsonify({'message': '冷藏格已删除'})
    return jsonify({'error': '冷藏格不存在'}), 404


# 志愿者/负责人管理
@api_bp.route('/volunteers', methods=['GET'])
def get_volunteers():
    volunteer_list = VolunteerService.get_all()
    return jsonify([v.to_dict() for v in volunteer_list])


@api_bp.route('/volunteers/<int:volunteer_id>', methods=['GET'])
def get_volunteer_by_id(volunteer_id):
    volunteer = VolunteerService.get_by_id(volunteer_id)
    if volunteer:
        return jsonify(volunteer.to_dict())
    return jsonify({'error': '负责人不存在'}), 404


@api_bp.route('/volunteers', methods=['POST'])
def create_volunteer():
    data = request.get_json()
    required_fields = ['name', 'qualification_type', 'qualification_valid_from', 'qualification_valid_until']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} 不能为空'}), 400
    
    volunteer = VolunteerService.create(data)
    return jsonify(volunteer.to_dict()), 201


@api_bp.route('/volunteers/<int:volunteer_id>', methods=['PUT'])
def update_volunteer(volunteer_id):
    data = request.get_json()
    volunteer = VolunteerService.update(volunteer_id, data)
    if volunteer:
        return jsonify(volunteer.to_dict())
    return jsonify({'error': '负责人不存在'}), 404


@api_bp.route('/volunteers/<int:volunteer_id>', methods=['DELETE'])
def delete_volunteer(volunteer_id):
    if VolunteerService.delete(volunteer_id):
        return jsonify({'message': '负责人已删除'})
    return jsonify({'error': '负责人不存在'}), 404


# 申请管理接口

@api_bp.route('/applications', methods=['GET'])
def get_applications():
    status = request.args.get('status')
    if status:
        applications = ApplicationService.get_by_status(status)
    else:
        applications = ApplicationService.get_all()
    return jsonify([app.to_dict() for app in applications])


@api_bp.route('/applications/<int:application_id>', methods=['GET'])
def get_application_by_id(application_id):
    application = ApplicationService.get_by_id(application_id)
    if application:
        return jsonify(application.to_dict())
    return jsonify({'error': '申请不存在'}), 404


@api_bp.route('/applications', methods=['POST'])
def create_application():
    data = request.get_json()
    
    # 验证必填字段
    required_fields = ['applicant_name', 'activity_name', 'participant_count', 
                       'start_time', 'end_time']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} 不能为空'}), 400
    
    # 创建申请
    application = ApplicationService.create(data)
    
    # 自动执行风控检查
    risk_result = RiskControlService.check_application(data)
    application.risk_level = risk_result.risk_level
    application.risk_notes = '\n'.join(risk_result.notes) if risk_result.notes else ''
    db.session.commit()
    
    # 记录风控检查日志
    AuditLogService.create({
        'application_id': application.id,
        'action': 'check_risk',
        'old_status': 'pending',
        'new_status': 'pending',
        'risk_level': risk_result.risk_level,
        'risk_notes': '\n'.join(risk_result.notes) if risk_result.notes else '',
        'notes': '自动风控检查'
    })
    
    # 如果风控检查不通过，标记为需要人工审核
    if not risk_result.passed:
        application.status = 'pending'
    
    result = application.to_dict()
    result['risk_check'] = risk_result.to_dict()
    
    return jsonify(result), 201


# 风控检查接口
@api_bp.route('/applications/<int:application_id>/check-risk', methods=['POST'])
def check_application_risk(application_id):
    application = ApplicationService.get_by_id(application_id)
    if not application:
        return jsonify({'error': '申请不存在'}), 404
    
    # 构建申请数据
    app_data = {
        'equipment_ids': json.loads(application.equipment_ids) if application.equipment_ids else [],
        'fridge_usage': json.loads(application.fridge_usage) if application.fridge_usage else [],
        'volunteer_id': application.volunteer_id,
        'participant_count': application.participant_count,
        'start_time': application.start_time,
        'end_time': application.end_time
    }
    
    # 执行风控检查
    risk_result = RiskControlService.check_application(
        app_data, exclude_application_id=application_id
    )
    
    # 更新申请信息
    application.risk_level = risk_result.risk_level
    application.risk_notes = '\n'.join(risk_result.notes) if risk_result.notes else ''
    db.session.commit()
    
    # 记录审核日志
    AuditLogService.create({
        'application_id': application.id,
        'action': 'check_risk',
        'old_status': application.status,
        'new_status': application.status,
        'risk_level': risk_result.risk_level,
        'risk_notes': '\n'.join(risk_result.notes) if risk_result.notes else '',
        'notes': '人工执行风控检查'
    })
    
    result = application.to_dict()
    result['risk_check'] = risk_result.to_dict()
    
    return jsonify(result)


# 人工改判接口
@api_bp.route('/applications/<int:application_id>/review', methods=['POST'])
def review_application(application_id):
    application = ApplicationService.get_by_id(application_id)
    if not application:
        return jsonify({'error': '申请不存在'}), 404
    
    data = request.get_json()
    new_status = data.get('status')
    reviewer_name = data.get('reviewer_name', '系统管理员')
    review_notes = data.get('review_notes', '')
    materials_needed = data.get('materials_needed')
    
    valid_statuses = ['approved', 'rejected', 'need_materials', 'pending']
    if new_status not in valid_statuses:
        return jsonify({'error': f'无效的状态: {new_status}，有效值为 {valid_statuses}'}), 400
    
    old_status = application.status
    
    # 更新申请
    update_data = {
        'status': new_status,
        'reviewer_name': reviewer_name,
        'review_notes': review_notes,
        'reviewed_at': datetime.utcnow()
    }
    
    if materials_needed:
        update_data['materials_needed'] = materials_needed
    
    ApplicationService.update(application_id, update_data)
    
    # 记录审核日志
    AuditLogService.create({
        'application_id': application.id,
        'action': 'review',
        'old_status': old_status,
        'new_status': new_status,
        'reviewer_name': reviewer_name,
        'notes': review_notes
    })
    
    application = ApplicationService.get_by_id(application_id)
    return jsonify(application.to_dict())


# 确认排期接口
@api_bp.route('/applications/<int:application_id>/confirm', methods=['POST'])
def confirm_application(application_id):
    application = ApplicationService.get_by_id(application_id)
    if not application:
        return jsonify({'error': '申请不存在'}), 404
    
    # 只能确认已通过审核的申请
    if application.status not in ['approved', 'need_materials']:
        return jsonify({'error': '只能确认已通过审核的申请'}), 400
    
    # 创建设备使用记录
    equipment_ids = json.loads(application.equipment_ids) if application.equipment_ids else []
    for eq_id in equipment_ids:
        EquipmentUsageService.create({
            'application_id': application.id,
            'equipment_id': eq_id,
            'start_time': application.start_time,
            'end_time': application.end_time
        })
    
    # 创建冷藏格使用记录
    fridge_usage = json.loads(application.fridge_usage) if application.fridge_usage else []
    for usage in fridge_usage:
        FridgeUsageService.create({
            'application_id': application.id,
            'fridge_id': usage.get('fridge_id'),
            'usage_capacity': usage.get('usage_capacity', 0.0),
            'start_time': application.start_time,
            'end_time': application.end_time
        })
    
    # 更新申请状态
    old_status = application.status
    ApplicationService.update(application_id, {
        'status': 'confirmed',
        'reviewed_at': datetime.utcnow()
    })
    
    # 记录审核日志
    AuditLogService.create({
        'application_id': application.id,
        'action': 'confirm',
        'old_status': old_status,
        'new_status': 'confirmed',
        'notes': '确认排期，已创建设备和冷藏格使用记录'
    })
    
    application = ApplicationService.get_by_id(application_id)
    return jsonify(application.to_dict())


# 查询待补材料名单接口
@api_bp.route('/applications/need-materials', methods=['GET'])
def get_need_materials_applications():
    applications = ApplicationService.get_need_materials()
    result = []
    for app in applications:
        app_dict = app.to_dict()
        if app.materials_needed:
            app_dict['materials_needed'] = json.loads(app.materials_needed)
        result.append(app_dict)
    return jsonify(result)


# 导出 Markdown 值班交接单接口
@api_bp.route('/applications/export/handover', methods=['GET'])
def export_handover_report():
    date_str = request.args.get('date')
    if date_str:
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': '日期格式无效，请使用 YYYY-MM-DD 格式'}), 400
    else:
        target_date = datetime.utcnow().date()
    
    # 获取当天已确认的申请
    start_of_day = datetime.combine(target_date, datetime.min.time())
    end_of_day = datetime.combine(target_date + timedelta(days=1), datetime.min.time())
    
    applications = Application.query.filter(
        Application.status == 'confirmed',
        Application.start_time >= start_of_day,
        Application.start_time < end_of_day
    ).order_by(Application.start_time.asc()).all()
    
    # 生成 Markdown
    markdown = ExportService.generate_handover_report(applications, target_date)
    
    # 返回 Markdown 文件
    response = make_response(markdown)
    response.headers['Content-Type'] = 'text/markdown; charset=utf-8'
    response.headers['Content-Disposition'] = f'attachment; filename=handover-{target_date.isoformat()}.md'
    
    return response


# 审核日志接口
@api_bp.route('/applications/<int:application_id>/audit-logs', methods=['GET'])
def get_audit_logs(application_id):
    logs = AuditLogService.get_by_application(application_id)
    return jsonify([log.to_dict() for log in logs])


# 统计接口
@api_bp.route('/statistics', methods=['GET'])
def get_statistics():
    today = datetime.utcnow().date()
    start_of_day = datetime.combine(today, datetime.min.time())
    end_of_day = datetime.combine(today + timedelta(days=1), datetime.min.time())
    
    # 今日申请数
    today_applications = Application.query.filter(
        Application.created_at >= start_of_day,
        Application.created_at < end_of_day
    ).count()
    
    # 待审核数
    pending_count = Application.query.filter_by(status='pending').count()
    
    # 已确认排期数
    confirmed_count = Application.query.filter_by(status='confirmed').count()
    
    # 待补材料数
    need_materials_count = Application.query.filter_by(status='need_materials').count()
    
    # 今日已确认的活动
    today_confirmed = Application.query.filter(
        Application.status == 'confirmed',
        Application.start_time >= start_of_day,
        Application.start_time < end_of_day
    ).count()
    
    return jsonify({
        'today_applications': today_applications,
        'pending_count': pending_count,
        'confirmed_count': confirmed_count,
        'need_materials_count': need_materials_count,
        'today_confirmed': today_confirmed
    })
