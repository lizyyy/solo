import json
from flask import Blueprint, request, jsonify
from app import db
from app.models import (
    ConstructionApplication, UndergroundPipeline, BusStop, 
    CalendarEvent, RiskAssessment, ReviewRecord
)

query_bp = Blueprint('query', __name__)

@query_bp.route('/road', methods=['GET'])
def query_by_road():
    """按路段查询相关信息"""
    road_name = request.args.get('road_name')
    road_section = request.args.get('road_section')
    
    if not road_name:
        return jsonify({'error': '请提供道路名称'}), 400
    
    try:
        # 构建查询条件
        app_query = ConstructionApplication.query.filter_by(road_name=road_name)
        if road_section:
            app_query = app_query.filter_by(road_section=road_section)
        
        applications = app_query.order_by(ConstructionApplication.start_date.desc()).all()
        
        # 查询该路段的管线
        pipeline_query = UndergroundPipeline.query.filter_by(road_name=road_name)
        if road_section:
            pipeline_query = pipeline_query.filter(
                UndergroundPipeline.road_section.like(f'%{road_section}%')
            )
        pipelines = pipeline_query.all()
        
        # 查询该路段的公交站点
        bus_query = BusStop.query.filter_by(road_name=road_name)
        bus_stops = bus_query.all()
        
        # 查询影响该路段的日历事件
        calendar_events = CalendarEvent.query.all()
        relevant_calendar = []
        for event in calendar_events:
            affected_roads = json.loads(event.affected_roads) if event.affected_roads else []
            if not affected_roads or road_name in affected_roads:
                relevant_calendar.append(event)
        
        # 整理结果
        result = {
            'road_name': road_name,
            'road_section': road_section or '全部路段',
            'applications': [],
            'pipelines': [],
            'bus_stops': [],
            'calendar_events': [],
            'risk_summary': {}
        }
        
        # 整理施工申请
        all_risks = []
        for app in applications:
            app_data = {
                'id': app.id,
                'application_id': app.application_id,
                'project_name': app.project_name,
                'road_section': app.road_section,
                'start_date': app.start_date.isoformat(),
                'end_date': app.end_date.isoformat(),
                'construction_type': app.construction_type,
                'applicant': app.applicant,
                'risks': []
            }
            
            # 获取该申请的风险
            risks = RiskAssessment.query.filter_by(application_id=app.id).all()
            for risk in risks:
                risk_data = {
                    'id': risk.id,
                    'risk_type': risk.risk_type,
                    'risk_level': risk.risk_level,
                    'description': risk.description,
                    'reviewed': risk.reviewed,
                    'review_decision': risk.review_decision
                }
                app_data['risks'].append(risk_data)
                all_risks.append(risk_data)
            
            result['applications'].append(app_data)
        
        # 整理管线
        for pipe in pipelines:
            result['pipelines'].append({
                'id': pipe.id,
                'pipeline_id': pipe.pipeline_id,
                'pipeline_type': pipe.pipeline_type,
                'material': pipe.material,
                'diameter': pipe.diameter,
                'depth': pipe.depth,
                'buffer_distance': pipe.buffer_distance,
                'road_section': pipe.road_section
            })
        
        # 整理公交站点
        for stop in bus_stops:
            result['bus_stops'].append({
                'id': stop.id,
                'stop_id': stop.stop_id,
                'stop_name': stop.stop_name,
                'latitude': stop.latitude,
                'longitude': stop.longitude,
                'bus_routes': json.loads(stop.bus_routes) if stop.bus_routes else [],
                'contact_person': stop.contact_person,
                'contact_phone': stop.contact_phone,
                'notification_status': stop.notification_status
            })
        
        # 整理日历事件
        for event in relevant_calendar:
            result['calendar_events'].append({
                'id': event.id,
                'event_id': event.event_id,
                'event_type': event.event_type,
                'event_name': event.event_name,
                'start_date': event.start_date.isoformat(),
                'end_date': event.end_date.isoformat(),
                'start_time': event.start_time.isoformat() if event.start_time else None,
                'end_time': event.end_time.isoformat() if event.end_time else None,
                'description': event.description
            })
        
        # 风险汇总
        risk_levels = [r['risk_level'] for r in all_risks]
        result['risk_summary'] = {
            'total_risks': len(all_risks),
            'by_level': {
                'critical': risk_levels.count('critical'),
                'high': risk_levels.count('high'),
                'medium': risk_levels.count('medium'),
                'low': risk_levels.count('low')
            },
            'by_type': {}
        }
        
        for risk in all_risks:
            risk_type = risk['risk_type']
            if risk_type not in result['risk_summary']['by_type']:
                result['risk_summary']['by_type'][risk_type] = 0
            result['risk_summary']['by_type'][risk_type] += 1
        
        return jsonify({
            'success': True,
            'data': result,
            'message': f'查询完成，找到 {len(applications)} 个施工申请'
        })
        
    except Exception as e:
        return jsonify({'error': f'查询失败: {str(e)}'}), 500

@query_bp.route('/applications', methods=['GET'])
def list_applications():
    """获取施工申请列表"""
    try:
        # 获取查询参数
        road_name = request.args.get('road_name')
        status = request.args.get('status')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        
        # 构建查询
        query = ConstructionApplication.query
        
        if road_name:
            query = query.filter(ConstructionApplication.road_name.like(f'%{road_name}%'))
        
        if date_from:
            from datetime import datetime
            try:
                date_from_obj = datetime.strptime(date_from, '%Y-%m-%d').date()
                query = query.filter(ConstructionApplication.start_date >= date_from_obj)
            except:
                pass
        
        if date_to:
            from datetime import datetime
            try:
                date_to_obj = datetime.strptime(date_to, '%Y-%m-%d').date()
                query = query.filter(ConstructionApplication.end_date <= date_to_obj)
            except:
                pass
        
        applications = query.order_by(ConstructionApplication.created_at.desc()).all()
        
        results = []
        for app in applications:
            # 获取风险统计
            risks = RiskAssessment.query.filter_by(application_id=app.id).all()
            risk_levels = [r.risk_level for r in risks]
            reviewed_count = sum(1 for r in risks if r.reviewed)
            
            # 计算总体风险等级
            if not risks:
                overall_risk = 'low'
            else:
                if 'critical' in risk_levels:
                    overall_risk = 'critical'
                elif 'high' in risk_levels:
                    overall_risk = 'high'
                elif 'medium' in risk_levels:
                    overall_risk = 'medium'
                else:
                    overall_risk = 'low'
            
            results.append({
                'id': app.id,
                'application_id': app.application_id,
                'project_name': app.project_name,
                'road_name': app.road_name,
                'road_section': app.road_section,
                'start_date': app.start_date.isoformat(),
                'end_date': app.end_date.isoformat(),
                'construction_type': app.construction_type,
                'applicant': app.applicant,
                'overall_risk': overall_risk,
                'total_risks': len(risks),
                'reviewed_risks': reviewed_count,
                'created_at': app.created_at.isoformat()
            })
        
        return jsonify({
            'success': True,
            'count': len(results),
            'applications': results
        })
        
    except Exception as e:
        return jsonify({'error': f'获取申请列表失败: {str(e)}'}), 500

@query_bp.route('/application/<int:application_id>', methods=['GET'])
def get_application_detail(application_id):
    """获取施工申请详情"""
    application = ConstructionApplication.query.get_or_404(application_id)
    
    try:
        # 获取风险评估
        risks = RiskAssessment.query.filter_by(application_id=application.id).all()
        
        # 获取复核记录
        reviews = ReviewRecord.query.filter_by(application_id=application.id).order_by(
            ReviewRecord.review_date.desc()
        ).all()
        
        # 整理风险数据
        risks_data = []
        for risk in risks:
            risks_data.append({
                'id': risk.id,
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
        
        # 整理复核记录
        reviews_data = []
        for review in reviews:
            reviews_data.append({
                'id': review.id,
                'reviewer': review.reviewer,
                'review_date': review.review_date.isoformat(),
                'decision': review.decision,
                'comments': review.comments,
                'next_steps': review.next_steps
            })
        
        return jsonify({
            'success': True,
            'application': {
                'id': application.id,
                'application_id': application.application_id,
                'project_name': application.project_name,
                'road_name': application.road_name,
                'road_section': application.road_section,
                'start_date': application.start_date.isoformat(),
                'end_date': application.end_date.isoformat(),
                'construction_type': application.construction_type,
                'applicant': application.applicant,
                'contact_info': application.contact_info,
                'description': application.description,
                'created_at': application.created_at.isoformat(),
                'updated_at': application.updated_at.isoformat()
            },
            'risks': {
                'count': len(risks_data),
                'items': risks_data
            },
            'reviews': {
                'count': len(reviews_data),
                'items': reviews_data
            }
        })
        
    except Exception as e:
        return jsonify({'error': f'获取申请详情失败: {str(e)}'}), 500
