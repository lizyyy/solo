from flask import Blueprint, request, jsonify
from extensions import db
from models.models import (
    CustomsDeclaration,
    RiskAssessment
)
from datetime import datetime

risk_bp = Blueprint('risk', __name__)


@risk_bp.route('/all', methods=['GET'])
def get_all_risks():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        risk_type = request.args.get('risk_type')
        risk_level = request.args.get('risk_level')
        review_status = request.args.get('review_status')
        declaration_no = request.args.get('declaration_no')
        
        query = RiskAssessment.query
        
        if declaration_no:
            declaration = CustomsDeclaration.query.filter_by(
                declaration_no=declaration_no
            ).first()
            if declaration:
                query = query.filter_by(declaration_id=declaration.id)
        
        if risk_type:
            query = query.filter_by(risk_type=risk_type)
        
        if risk_level:
            query = query.filter_by(risk_level=risk_level)
        
        if review_status:
            query = query.filter_by(review_status=review_status)
        
        pagination = query.order_by(
            db.case(
                (RiskAssessment.risk_level == 'critical', 1),
                (RiskAssessment.risk_level == 'high', 2),
                (RiskAssessment.risk_level == 'medium', 3),
                (RiskAssessment.risk_level == 'low', 4),
                else_=5
            ),
            RiskAssessment.detected_at.desc()
        ).paginate(page=page, per_page=per_page, error_out=False)
        
        risks = []
        for risk in pagination.items:
            declaration = CustomsDeclaration.query.get(risk.declaration_id)
            risks.append({
                'id': risk.id,
                'declaration_id': risk.declaration_id,
                'declaration_no': declaration.declaration_no if declaration else None,
                'item_id': risk.item_id,
                'risk_type': risk.risk_type,
                'risk_level': risk.risk_level,
                'risk_description': risk.risk_description,
                'detected_at': risk.detected_at.isoformat() if risk.detected_at else None,
                'is_reviewed': risk.is_reviewed,
                'reviewed_at': risk.reviewed_at.isoformat() if risk.reviewed_at else None,
                'reviewer_name': risk.reviewer_name,
                'review_status': risk.review_status,
                'review_notes': risk.review_notes
            })
        
        return jsonify({
            'risks': risks,
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'pages': pagination.pages
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@risk_bp.route('/summary', methods=['GET'])
def get_risk_summary_api():
    try:
        declaration_no = request.args.get('declaration_no')
        
        declaration_id = None
        if declaration_no:
            declaration = CustomsDeclaration.query.filter_by(
                declaration_no=declaration_no
            ).first()
            if declaration:
                declaration_id = declaration.id
        
        query = RiskAssessment.query
        if declaration_id:
            query = query.filter_by(declaration_id=declaration_id)
        
        all_risks = query.all()
        
        summary = {
            'total_risks': len(all_risks),
            'by_type': {
                'hs_discrepancy': 0,
                'weight_package_difference': 0,
                'seal_chain_broken': 0,
                'sample_overdue': 0,
                'high_risk_not_reviewed': 0
            },
            'by_severity': {
                'critical': 0,
                'high': 0,
                'medium': 0,
                'low': 0
            },
            'by_review_status': {
                'pending': 0,
                'reviewed': 0,
                'approved': 0,
                'rejected': 0
            }
        }
        
        for risk in all_risks:
            if risk.risk_type in summary['by_type']:
                summary['by_type'][risk.risk_type] += 1
            
            if risk.risk_level in summary['by_severity']:
                summary['by_severity'][risk.risk_level] += 1
            
            if risk.review_status in summary['by_review_status']:
                summary['by_review_status'][risk.review_status] += 1
        
        return jsonify(summary)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@risk_bp.route('/types', methods=['GET'])
def get_risk_types():
    try:
        risk_types = [
            {
                'type': 'hs_discrepancy',
                'name': 'HS编码与货描不符',
                'description': '检测HS编码归类与货物描述是否一致',
                'default_level': 'high'
            },
            {
                'type': 'weight_package_difference',
                'name': '重量件数差异',
                'description': '比较报关单与舱单的重量、件数差异',
                'default_level': 'medium'
            },
            {
                'type': 'seal_chain_broken',
                'name': '封签断链',
                'description': '检测集装箱封签是否完整，有无断链情况',
                'default_level': 'critical'
            },
            {
                'type': 'sample_overdue',
                'name': '抽检超期',
                'description': '检测实验室抽检是否超过检测期限',
                'default_level': 'high'
            },
            {
                'type': 'high_risk_not_reviewed',
                'name': '高风险货物未复核',
                'description': '检测被标记为高风险的货物是否已完成复核',
                'default_level': 'high'
            }
        ]
        
        return jsonify({
            'risk_types': risk_types,
            'total': len(risk_types)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@risk_bp.route('/<risk_id>', methods=['GET'])
def get_risk_detail(risk_id):
    try:
        risk = RiskAssessment.query.get(risk_id)
        
        if not risk:
            return jsonify({'error': 'Risk not found'}), 404
        
        declaration = CustomsDeclaration.query.get(risk.declaration_id)
        
        return jsonify({
            'id': risk.id,
            'declaration_id': risk.declaration_id,
            'declaration_no': declaration.declaration_no if declaration else None,
            'item_id': risk.item_id,
            'risk_type': risk.risk_type,
            'risk_level': risk.risk_level,
            'risk_description': risk.risk_description,
            'detected_at': risk.detected_at.isoformat() if risk.detected_at else None,
            'related_data': risk.related_data,
            'is_reviewed': risk.is_reviewed,
            'reviewed_at': risk.reviewed_at.isoformat() if risk.reviewed_at else None,
            'reviewer_name': risk.reviewer_name,
            'review_status': risk.review_status,
            'review_notes': risk.review_notes,
            'created_at': risk.created_at.isoformat() if risk.created_at else None
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@risk_bp.route('/evaluate/<declaration_no>', methods=['POST'])
def evaluate_declaration_risks(declaration_no):
    try:
        declaration = CustomsDeclaration.query.filter_by(
            declaration_no=declaration_no
        ).first()
        
        if not declaration:
            return jsonify({'error': 'Declaration not found'}), 404
        
        from routes.import_routes import evaluate_all_risks
        evaluate_all_risks(declaration.id)
        
        query = RiskAssessment.query.filter_by(declaration_id=declaration.id)
        all_risks = query.all()
        
        summary = {
            'total_risks': len(all_risks),
            'by_type': {
                'hs_discrepancy': 0,
                'weight_package_difference': 0,
                'seal_chain_broken': 0,
                'sample_overdue': 0,
                'high_risk_not_reviewed': 0
            },
            'by_severity': {
                'critical': 0,
                'high': 0,
                'medium': 0,
                'low': 0
            }
        }
        
        for risk in all_risks:
            if risk.risk_type in summary['by_type']:
                summary['by_type'][risk.risk_type] += 1
            
            if risk.risk_level in summary['by_severity']:
                summary['by_severity'][risk.risk_level] += 1
        
        return jsonify({
            'message': 'Risk evaluation completed successfully',
            'declaration_no': declaration_no,
            'summary': summary
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
