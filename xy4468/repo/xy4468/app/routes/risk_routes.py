import json
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from shapely.geometry import shape, Point, LineString
from shapely.ops import unary_union
from app import db
from app.models import (
    ConstructionApplication, UndergroundPipeline, BusStop, 
    CalendarEvent, RiskAssessment
)

risk_bp = Blueprint('risk', __name__)

def check_duplicate_excavation(application):
    """检查同一路段重复开挖风险"""
    risks = []
    
    # 查找同一路段的其他施工申请
    overlapping_applications = ConstructionApplication.query.filter(
        ConstructionApplication.id != application.id,
        ConstructionApplication.road_name == application.road_name,
        ConstructionApplication.road_section == application.road_section,
        # 时间范围重叠
        ConstructionApplication.start_date <= application.end_date,
        ConstructionApplication.end_date >= application.start_date
    ).all()
    
    if overlapping_applications:
        affected = []
        for app in overlapping_applications:
            affected.append({
                'application_id': app.application_id,
                'project_name': app.project_name,
                'start_date': app.start_date.isoformat(),
                'end_date': app.end_date.isoformat()
            })
        
        risks.append({
            'risk_type': 'duplicate_excavation',
            'risk_level': 'high',
            'description': f"发现同一路段 ({application.road_name} - {application.road_section}) 存在时间重叠的施工申请",
            'affected_elements': affected
        })
    
    return risks

def check_pipeline_buffer_violation(application):
    """检查燃气管线缓冲区被忽略风险"""
    risks = []
    
    # 获取所有管线
    pipelines = UndergroundPipeline.query.filter(
        UndergroundPipeline.road_name == application.road_name
    ).all()
    
    if not pipelines:
        return risks
    
    # 简化处理：假设施工区域是一个点（实际应该用GeoJSON定义施工区域）
    # 这里我们用管线的几何来判断是否可能有冲突
    gas_pipelines = [p for p in pipelines if 'gas' in p.pipeline_type.lower()]
    
    if gas_pipelines:
        affected = []
        for pipe in gas_pipelines:
            affected.append({
                'pipeline_id': pipe.pipeline_id,
                'pipeline_type': pipe.pipeline_type,
                'buffer_distance': pipe.buffer_distance,
                'material': pipe.material,
                'road_section': pipe.road_section
            })
        
        risks.append({
            'risk_type': 'pipeline_buffer_violation',
            'risk_level': 'critical',
            'description': f"施工路段 ({application.road_name}) 存在燃气管线，需注意 {gas_pipelines[0].buffer_distance} 米缓冲区要求",
            'affected_elements': affected
        })
    
    return risks

def check_bus_stop_notification(application):
    """检查公交临停未通知风险"""
    risks = []
    
    # 查找施工路段的公交站点
    bus_stops = BusStop.query.filter(
        BusStop.road_name == application.road_name
    ).all()
    
    if bus_stops:
        # 检查是否有未通知的站点
        pending_stops = [s for s in bus_stops if s.notification_status == 'pending']
        
        if pending_stops:
            affected = []
            for stop in pending_stops:
                affected.append({
                    'stop_id': stop.stop_id,
                    'stop_name': stop.stop_name,
                    'bus_routes': json.loads(stop.bus_routes) if stop.bus_routes else [],
                    'contact_person': stop.contact_person,
                    'contact_phone': stop.contact_phone
                })
            
            risks.append({
                'risk_type': 'bus_stop_notification',
                'risk_level': 'medium',
                'description': f"施工路段 ({application.road_name}) 有 {len(pending_stops)} 个公交站点尚未通知",
                'affected_elements': affected
            })
    
    return risks

def check_schedule_conflict(application):
    """检查工期撞上禁噪时段风险"""
    risks = []
    
    # 查找时间范围重叠的日历事件
    conflicting_events = CalendarEvent.query.filter(
        # 时间范围重叠
        CalendarEvent.start_date <= application.end_date,
        CalendarEvent.end_date >= application.start_date
    ).all()
    
    if conflicting_events:
        # 检查是否影响当前道路
        affected_events = []
        for event in conflicting_events:
            affected_roads = json.loads(event.affected_roads) if event.affected_roads else []
            
            # 如果事件影响所有道路（空列表）或包含当前道路
            if not affected_roads or application.road_name in affected_roads:
                affected_events.append({
                    'event_id': event.event_id,
                    'event_type': event.event_type,
                    'event_name': event.event_name,
                    'start_date': event.start_date.isoformat(),
                    'end_date': event.end_date.isoformat(),
                    'start_time': event.start_time.isoformat() if event.start_time else None,
                    'end_time': event.end_time.isoformat() if event.end_time else None
                })
        
        if affected_events:
            # 按事件类型确定风险等级
            event_types = [e['event_type'] for e in affected_events]
            if 'exam' in event_types:
                risk_level = 'high'
            else:
                risk_level = 'medium'
            
            risks.append({
                'risk_type': 'schedule_conflict',
                'risk_level': risk_level,
                'description': f"施工工期与 {len(affected_events)} 个禁噪/考试事件时间重叠",
                'affected_elements': affected_events
            })
    
    return risks

@risk_bp.route('/calculate/<int:application_id>', methods=['POST'])
def calculate_risk(application_id):
    """计算指定施工申请的风险"""
    application = ConstructionApplication.query.get_or_404(application_id)
    
    try:
        # 清除旧的风险评估
        RiskAssessment.query.filter_by(application_id=application.id).delete()
        db.session.commit()
        
        # 执行各项风险检查
        all_risks = []
        all_risks.extend(check_duplicate_excavation(application))
        all_risks.extend(check_pipeline_buffer_violation(application))
        all_risks.extend(check_bus_stop_notification(application))
        all_risks.extend(check_schedule_conflict(application))
        
        # 保存风险评估结果
        saved_risks = []
        for risk_data in all_risks:
            risk = RiskAssessment(
                application_id=application.id,
                risk_type=risk_data['risk_type'],
                risk_level=risk_data['risk_level'],
                description=risk_data['description'],
                affected_elements=json.dumps(risk_data['affected_elements'])
            )
            db.session.add(risk)
            saved_risks.append({
                'id': risk.id,
                'risk_type': risk.risk_type,
                'risk_level': risk.risk_level,
                'description': risk.description,
                'affected_elements': risk_data['affected_elements'],
                'created_at': risk.created_at.isoformat()
            })
        
        db.session.commit()
        
        # 计算总体风险等级
        if not saved_risks:
            overall_risk = 'low'
        else:
            levels = [r['risk_level'] for r in saved_risks]
            if 'critical' in levels:
                overall_risk = 'critical'
            elif 'high' in levels:
                overall_risk = 'high'
            elif 'medium' in levels:
                overall_risk = 'medium'
            else:
                overall_risk = 'low'
        
        return jsonify({
            'success': True,
            'application_id': application.application_id,
            'project_name': application.project_name,
            'overall_risk': overall_risk,
            'risk_count': len(saved_risks),
            'risks': saved_risks,
            'message': f'风险计算完成，发现 {len(saved_risks)} 个风险点'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'风险计算失败: {str(e)}'}), 500

@risk_bp.route('/batch', methods=['POST'])
def batch_calculate_risk():
    """批量计算所有施工申请的风险"""
    applications = ConstructionApplication.query.all()
    
    if not applications:
        return jsonify({'error': '没有找到施工申请'}), 404
    
    results = []
    for application in applications:
        try:
            # 清除旧的风险评估
            RiskAssessment.query.filter_by(application_id=application.id).delete()
            
            # 执行各项风险检查
            all_risks = []
            all_risks.extend(check_duplicate_excavation(application))
            all_risks.extend(check_pipeline_buffer_violation(application))
            all_risks.extend(check_bus_stop_notification(application))
            all_risks.extend(check_schedule_conflict(application))
            
            # 保存风险评估结果
            for risk_data in all_risks:
                risk = RiskAssessment(
                    application_id=application.id,
                    risk_type=risk_data['risk_type'],
                    risk_level=risk_data['risk_level'],
                    description=risk_data['description'],
                    affected_elements=json.dumps(risk_data['affected_elements'])
                )
                db.session.add(risk)
            
            # 计算总体风险等级
            if not all_risks:
                overall_risk = 'low'
            else:
                levels = [r['risk_level'] for r in all_risks]
                if 'critical' in levels:
                    overall_risk = 'critical'
                elif 'high' in levels:
                    overall_risk = 'high'
                elif 'medium' in levels:
                    overall_risk = 'medium'
                else:
                    overall_risk = 'low'
            
            results.append({
                'application_id': application.application_id,
                'project_name': application.project_name,
                'risk_count': len(all_risks),
                'overall_risk': overall_risk
            })
            
        except Exception as e:
            results.append({
                'application_id': application.application_id,
                'project_name': application.project_name,
                'error': str(e)
            })
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'total_processed': len(applications),
        'results': results,
        'message': f'批量风险计算完成，共处理 {len(applications)} 个申请'
    })

@risk_bp.route('/list', methods=['GET'])
def list_risks():
    """获取所有风险评估列表"""
    try:
        # 获取查询参数
        application_id = request.args.get('application_id')
        risk_type = request.args.get('risk_type')
        risk_level = request.args.get('risk_level')
        
        # 构建查询
        query = RiskAssessment.query
        
        if application_id:
            app = ConstructionApplication.query.filter_by(application_id=application_id).first()
            if app:
                query = query.filter_by(application_id=app.id)
        
        if risk_type:
            query = query.filter_by(risk_type=risk_type)
        
        if risk_level:
            query = query.filter_by(risk_level=risk_level)
        
        risks = query.all()
        
        results = []
        for risk in risks:
            app = risk.application
            results.append({
                'id': risk.id,
                'application_id': app.application_id,
                'project_name': app.project_name,
                'road_name': app.road_name,
                'road_section': app.road_section,
                'risk_type': risk.risk_type,
                'risk_level': risk.risk_level,
                'description': risk.description,
                'affected_elements': json.loads(risk.affected_elements) if risk.affected_elements else [],
                'reviewed': risk.reviewed,
                'review_decision': risk.review_decision,
                'review_comment': risk.review_comment,
                'reviewed_at': risk.reviewed_at.isoformat() if risk.reviewed_at else None,
                'reviewer': risk.reviewer,
                'created_at': risk.created_at.isoformat()
            })
        
        return jsonify({
            'success': True,
            'count': len(results),
            'risks': results
        })
        
    except Exception as e:
        return jsonify({'error': f'获取风险列表失败: {str(e)}'}), 500
