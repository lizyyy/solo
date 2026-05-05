import json
from datetime import datetime
from flask import Blueprint, request, jsonify
from app import db
from app.models import RiskAssessment, ReviewRecord, ConstructionApplication

review_bp = Blueprint('review', __name__)

@review_bp.route('/risk/<int:risk_id>', methods=['POST'])
def review_risk(risk_id):
    """人工复核改判单个风险"""
    risk = RiskAssessment.query.get_or_404(risk_id)
    
    data = request.get_json()
    if not data:
        return jsonify({'error': '请提供复核数据'}), 400
    
    decision = data.get('decision')
    comment = data.get('comment', '')
    reviewer = data.get('reviewer', '未知审核人')
    
    if not decision:
        return jsonify({'error': '请提供复核决定'}), 400
    
    valid_decisions = ['approve', 'reject', 'modify', 'dismiss']
    if decision not in valid_decisions:
        return jsonify({'error': f'无效的复核决定，有效值为: {", ".join(valid_decisions)}'}), 400
    
    try:
        # 更新风险评估
        risk.reviewed = True
        risk.review_decision = decision
        risk.review_comment = comment
        risk.reviewed_at = datetime.utcnow()
        risk.reviewer = reviewer
        
        # 创建复核记录
        review = ReviewRecord(
            application_id=risk.application_id,
            reviewer=reviewer,
            review_date=datetime.utcnow(),
            decision=decision,
            comments=comment,
            next_steps=_get_next_steps(decision, risk.risk_type)
        )
        
        db.session.add(review)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'risk_id': risk.id,
            'application_id': risk.application.application_id,
            'risk_type': risk.risk_type,
            'original_risk_level': risk.risk_level,
            'review_decision': decision,
            'review_comment': comment,
            'reviewer': reviewer,
            'reviewed_at': risk.reviewed_at.isoformat(),
            'next_steps': review.next_steps,
            'message': '风险复核完成'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'复核失败: {str(e)}'}), 500

def _get_next_steps(decision, risk_type):
    """根据决策和风险类型获取下一步措施"""
    steps_map = {
        'approve': {
            'duplicate_excavation': '协调施工单位调整施工顺序，确保不同时开挖',
            'pipeline_buffer_violation': '要求施工单位提交管线保护方案，经管线单位确认后施工',
            'bus_stop_notification': '立即通知公交公司，安排临时停靠点',
            'schedule_conflict': '调整施工时间，避开禁噪/考试时段'
        },
        'reject': {
            'duplicate_excavation': '驳回申请，要求重新规划施工时间',
            'pipeline_buffer_violation': '驳回申请，需重新选址或提交详细的管线保护方案',
            'bus_stop_notification': '驳回申请，需先完成公交站点通知工作',
            'schedule_conflict': '驳回申请，需调整施工工期'
        },
        'modify': {
            'duplicate_excavation': '修改施工方案，错开与其他项目的施工时间',
            'pipeline_buffer_violation': '修改施工方案，增加与燃气管线的安全距离',
            'bus_stop_notification': '修改施工方案，减少对公交站点的影响',
            'schedule_conflict': '修改施工方案，调整施工时间'
        },
        'dismiss': {
            'duplicate_excavation': '风险已排除，可正常施工',
            'pipeline_buffer_violation': '经核实，施工区域不在管线缓冲区范围内',
            'bus_stop_notification': '公交站点已通知完毕',
            'schedule_conflict': '施工时间已调整，不再冲突'
        }
    }
    
    return steps_map.get(decision, {}).get(risk_type, '请根据实际情况确定下一步措施')

@review_bp.route('/application/<int:application_id>', methods=['POST'])
def review_application(application_id):
    """复核改判整个施工申请的所有风险"""
    application = ConstructionApplication.query.get_or_404(application_id)
    
    data = request.get_json()
    if not data:
        return jsonify({'error': '请提供复核数据'}), 400
    
    overall_decision = data.get('overall_decision')
    reviewer = data.get('reviewer', '未知审核人')
    comments = data.get('comments', '')
    
    if not overall_decision:
        return jsonify({'error': '请提供总体复核决定'}), 400
    
    try:
        # 获取该申请的所有未复核风险
        risks = RiskAssessment.query.filter_by(
            application_id=application.id,
            reviewed=False
        ).all()
        
        reviewed_count = 0
        for risk in risks:
            risk.reviewed = True
            risk.review_decision = overall_decision
            risk.review_comment = comments
            risk.reviewed_at = datetime.utcnow()
            risk.reviewer = reviewer
            reviewed_count += 1
        
        # 创建复核记录
        review = ReviewRecord(
            application_id=application.id,
            reviewer=reviewer,
            review_date=datetime.utcnow(),
            decision=overall_decision,
            comments=comments,
            next_steps=f'已复核 {reviewed_count} 个风险点，请根据各风险详情确定具体措施'
        )
        
        db.session.add(review)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'application_id': application.application_id,
            'project_name': application.project_name,
            'overall_decision': overall_decision,
            'reviewed_risk_count': reviewed_count,
            'reviewer': reviewer,
            'reviewed_at': datetime.utcnow().isoformat(),
            'message': f'申请复核完成，共处理 {reviewed_count} 个风险点'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'复核失败: {str(e)}'}), 500

@review_bp.route('/list', methods=['GET'])
def list_reviews():
    """获取复核记录列表"""
    try:
        # 获取查询参数
        application_id = request.args.get('application_id')
        reviewer = request.args.get('reviewer')
        decision = request.args.get('decision')
        
        # 构建查询
        query = ReviewRecord.query
        
        if application_id:
            app = ConstructionApplication.query.filter_by(application_id=application_id).first()
            if app:
                query = query.filter_by(application_id=app.id)
        
        if reviewer:
            query = query.filter(ReviewRecord.reviewer.like(f'%{reviewer}%'))
        
        if decision:
            query = query.filter_by(decision=decision)
        
        reviews = query.order_by(ReviewRecord.review_date.desc()).all()
        
        results = []
        for review in reviews:
            app = review.application
            results.append({
                'id': review.id,
                'application_id': app.application_id,
                'project_name': app.project_name,
                'road_name': app.road_name,
                'road_section': app.road_section,
                'reviewer': review.reviewer,
                'review_date': review.review_date.isoformat(),
                'decision': review.decision,
                'comments': review.comments,
                'next_steps': review.next_steps,
                'created_at': review.created_at.isoformat()
            })
        
        return jsonify({
            'success': True,
            'count': len(results),
            'reviews': results
        })
        
    except Exception as e:
        return jsonify({'error': f'获取复核记录失败: {str(e)}'}), 500

@review_bp.route('/risk/<int:risk_id>', methods=['GET'])
def get_risk_review(risk_id):
    """获取单个风险的复核详情"""
    risk = RiskAssessment.query.get_or_404(risk_id)
    
    app = risk.application
    
    return jsonify({
        'success': True,
        'risk': {
            'id': risk.id,
            'risk_type': risk.risk_type,
            'risk_level': risk.risk_level,
            'description': risk.description,
            'affected_elements': json.loads(risk.affected_elements) if risk.affected_elements else [],
            'created_at': risk.created_at.isoformat()
        },
        'application': {
            'id': app.id,
            'application_id': app.application_id,
            'project_name': app.project_name,
            'road_name': app.road_name,
            'road_section': app.road_section,
            'start_date': app.start_date.isoformat(),
            'end_date': app.end_date.isoformat()
        },
        'review': {
            'reviewed': risk.reviewed,
            'review_decision': risk.review_decision,
            'review_comment': risk.review_comment,
            'reviewed_at': risk.reviewed_at.isoformat() if risk.reviewed_at else None,
            'reviewer': risk.reviewer
        }
    })
