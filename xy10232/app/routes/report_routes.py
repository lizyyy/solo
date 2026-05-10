from flask import Blueprint, request, jsonify, make_response
from datetime import datetime, timedelta, date
import json
from app import db
from app.models import PatrolReport, PatrolRoute, Caregiver, CheckinEvent, RoutePoint, MissedPatrol, SupplementRequest
from app.errors import BusinessError

report_bp = Blueprint('report', __name__)


@report_bp.route('', methods=['GET'])
def list_reports():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    route_id = request.args.get('route_id', type=int)
    caregiver_id = request.args.get('caregiver_id', type=int)
    
    query = PatrolReport.query
    
    if start_date:
        start_dt = datetime.strptime(start_date, '%Y-%m-%d').date()
        query = query.filter(PatrolReport.report_date >= start_dt)
    if end_date:
        end_dt = datetime.strptime(end_date, '%Y-%m-%d').date()
        query = query.filter(PatrolReport.report_date <= end_dt)
    if route_id:
        query = query.filter_by(route_id=route_id)
    if caregiver_id:
        query = query.filter_by(caregiver_id=caregiver_id)
    
    reports = query.order_by(PatrolReport.report_date.desc()).all()
    return jsonify({
        'success': True,
        'count': len(reports),
        'data': [r.to_dict() for r in reports]
    })


@report_bp.route('/<int:report_id>', methods=['GET'])
def get_report(report_id):
    report = PatrolReport.query.get_or_404(report_id)
    return jsonify({
        'success': True,
        'data': report.to_dict()
    })


@report_bp.route('/generate', methods=['POST'])
def generate_report():
    data = request.get_json()
    
    report_date_str = data.get('report_date')
    route_id = data.get('route_id')
    caregiver_id = data.get('caregiver_id')
    
    if not report_date_str:
        raise BusinessError('REPORT_ERROR', '缺少报表日期')
    
    try:
        report_date = datetime.strptime(report_date_str, '%Y-%m-%d').date()
    except ValueError:
        raise BusinessError('REPORT_ERROR', '日期格式错误，应为 YYYY-MM-DD')
    
    if not route_id:
        raise BusinessError('REPORT_ERROR', '缺少巡更路线ID')
    
    if not caregiver_id:
        raise BusinessError('REPORT_ERROR', '缺少护理员ID')
    
    route = PatrolRoute.query.get(route_id)
    if not route:
        raise BusinessError('REPORT_ERROR', '巡更路线不存在', {'route_id': route_id})
    
    caregiver = Caregiver.query.get(caregiver_id)
    if not caregiver:
        raise BusinessError('REPORT_ERROR', '护理员不存在', {'caregiver_id': caregiver_id})
    
    existing = PatrolReport.query.filter_by(
        report_date=report_date,
        route_id=route_id,
        caregiver_id=caregiver_id
    ).first()
    
    if existing:
        return jsonify({
            'success': True,
            'data': existing.to_dict(),
            'message': '报表已存在，返回现有数据'
        })
    
    start_dt = datetime.combine(report_date, route.start_time)
    end_dt = datetime.combine(report_date, route.end_time)
    if route.start_time > route.end_time:
        end_dt += timedelta(days=1)
    
    required_points = RoutePoint.query.filter_by(
        route_id=route_id,
        required=True
    ).all()
    total_points = len(required_points)
    
    checked_points = 0
    supplement_count = 0
    
    for rp in required_points:
        checkin = CheckinEvent.query.filter(
            CheckinEvent.route_id == route_id,
            CheckinEvent.point_id == rp.point_id,
            CheckinEvent.caregiver_id == caregiver_id,
            CheckinEvent.checkin_time >= start_dt,
            CheckinEvent.checkin_time <= end_dt
        ).first()
        
        if checkin:
            checked_points += 1
            if checkin.checkin_type == 'supplement':
                supplement_count += 1
    
    missed_points = total_points - checked_points
    completion_rate = (checked_points / total_points * 100) if total_points > 0 else 0
    
    report = PatrolReport(
        report_date=report_date,
        route_id=route_id,
        caregiver_id=caregiver_id,
        total_points=total_points,
        checked_points=checked_points,
        missed_points=missed_points,
        supplement_count=supplement_count,
        completion_rate=round(completion_rate, 2)
    )
    
    db.session.add(report)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': report.to_dict(),
        'message': '夜巡报表生成成功'
    }), 201


@report_bp.route('/summary', methods=['GET'])
def get_report_summary():
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    
    query = PatrolReport.query
    
    if start_date_str:
        start_dt = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        query = query.filter(PatrolReport.report_date >= start_dt)
    if end_date_str:
        end_dt = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        query = query.filter(PatrolReport.report_date <= end_dt)
    
    reports = query.all()
    
    if not reports:
        return jsonify({
            'success': True,
            'data': {
                'total_reports': 0,
                'avg_completion_rate': 0,
                'total_missed': 0,
                'total_supplements': 0,
                'by_route': {},
                'by_caregiver': {}
            }
        })
    
    summary = {
        'total_reports': len(reports),
        'avg_completion_rate': round(sum(r.completion_rate for r in reports) / len(reports), 2),
        'total_missed': sum(r.missed_points for r in reports),
        'total_supplements': sum(r.supplement_count for r in reports),
        'by_route': {},
        'by_caregiver': {}
    }
    
    for report in reports:
        route_name = report.route.name if report.route else 'Unknown'
        if route_name not in summary['by_route']:
            summary['by_route'][route_name] = {'count': 0, 'total_missed': 0, 'completion_rates': []}
        summary['by_route'][route_name]['count'] += 1
        summary['by_route'][route_name]['total_missed'] += report.missed_points
        summary['by_route'][route_name]['completion_rates'].append(report.completion_rate)
        
        caregiver_name = report.caregiver.name if report.caregiver else 'Unknown'
        if caregiver_name not in summary['by_caregiver']:
            summary['by_caregiver'][caregiver_name] = {'count': 0, 'total_missed': 0, 'completion_rates': []}
        summary['by_caregiver'][caregiver_name]['count'] += 1
        summary['by_caregiver'][caregiver_name]['total_missed'] += report.missed_points
        summary['by_caregiver'][caregiver_name]['completion_rates'].append(report.completion_rate)
    
    for route_name in summary['by_route']:
        rates = summary['by_route'][route_name]['completion_rates']
        summary['by_route'][route_name]['avg_completion_rate'] = round(sum(rates) / len(rates), 2) if rates else 0
        del summary['by_route'][route_name]['completion_rates']
    
    for caregiver_name in summary['by_caregiver']:
        rates = summary['by_caregiver'][caregiver_name]['completion_rates']
        summary['by_caregiver'][caregiver_name]['avg_completion_rate'] = round(sum(rates) / len(rates), 2) if rates else 0
        del summary['by_caregiver'][caregiver_name]['completion_rates']
    
    return jsonify({
        'success': True,
        'data': summary
    })


@report_bp.route('/export', methods=['GET'])
def export_report():
    report_id = request.args.get('report_id', type=int)
    format_type = request.args.get('format', 'json')
    
    if report_id:
        report = PatrolReport.query.get_or_404(report_id)
        reports = [report]
    else:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        query = PatrolReport.query
        if start_date:
            start_dt = datetime.strptime(start_date, '%Y-%m-%d').date()
            query = query.filter(PatrolReport.report_date >= start_dt)
        if end_date:
            end_dt = datetime.strptime(end_date, '%Y-%m-%d').date()
            query = query.filter(PatrolReport.report_date <= end_dt)
        reports = query.all()
    
    if format_type == 'json':
        response = make_response(json.dumps([r.to_dict() for r in reports], ensure_ascii=False, indent=2))
        response.headers['Content-Type'] = 'application/json; charset=utf-8'
        response.headers['Content-Disposition'] = 'attachment; filename="patrol_reports.json"'
        return response
    else:
        lines = ['夜巡报表导出', '='*50, '']
        for report in reports:
            lines.append(f'报表日期: {report.report_date}')
            lines.append(f'巡更路线: {report.route.name if report.route else "-"}')
            lines.append(f'护理员: {report.caregiver.name if report.caregiver else "-"}')
            lines.append(f'应巡点数: {report.total_points}')
            lines.append(f'已巡点数: {report.checked_points}')
            lines.append(f'漏巡点数: {report.missed_points}')
            lines.append(f'补录数量: {report.supplement_count}')
            lines.append(f'完成率: {report.completion_rate}%')
            lines.append('-'*50)
        
        content = '\n'.join(lines)
        response = make_response(content)
        response.headers['Content-Type'] = 'text/plain; charset=utf-8'
        response.headers['Content-Disposition'] = 'attachment; filename="patrol_reports.txt"'
        return response
