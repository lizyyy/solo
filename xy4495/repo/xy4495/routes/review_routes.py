from flask import Blueprint, request, jsonify
from extensions import db
from models.models import (
    CustomsDeclaration,
    RiskAssessment,
    ReviewRecord
)
from datetime import datetime

review_bp = Blueprint('review', __name__)


@review_bp.route('/list', methods=['GET'])
def get_reviews():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        declaration_no = request.args.get('declaration_no')
        review_status = request.args.get('review_status')
        reviewer_name = request.args.get('reviewer_name')
        
        query = ReviewRecord.query
        
        if declaration_no:
            declaration = CustomsDeclaration.query.filter_by(
                declaration_no=declaration_no
            ).first()
            if declaration:
                query = query.filter_by(declaration_id=declaration.id)
        
        if review_status:
            query = query.filter_by(review_status=review_status)
        
        if reviewer_name:
            query = query.filter(ReviewRecord.reviewer_name.contains(reviewer_name))
        
        pagination = query.order_by(
            ReviewRecord.review_date.desc()
        ).paginate(page=page, per_page=per_page, error_out=False)
        
        reviews = []
        for review in pagination.items:
            declaration = CustomsDeclaration.query.get(review.declaration_id)
            reviews.append({
                'id': review.id,
                'declaration_id': review.declaration_id,
                'declaration_no': declaration.declaration_no if declaration else None,
                'risk_id': review.risk_id,
                'review_type': review.review_type,
                'reviewer_name': review.reviewer_name,
                'review_date': review.review_date.isoformat() if review.review_date else None,
                'review_status': review.review_status,
                'review_notes': review.review_notes,
                'related_item_no': review.related_item_no,
                'related_container_no': review.related_container_no,
                'created_at': review.created_at.isoformat() if review.created_at else None
            })
        
        return jsonify({
            'reviews': reviews,
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'pages': pagination.pages
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@review_bp.route('/create', methods=['POST'])
def create_review():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        declaration_id = None
        if data.get('declaration_no'):
            declaration = CustomsDeclaration.query.filter_by(
                declaration_no=data.get('declaration_no')
            ).first()
            if declaration:
                declaration_id = declaration.id
        
        review_type = data.get('review_type', 'risk')
        risk_id = data.get('risk_id')
        
        if risk_id:
            risk = RiskAssessment.query.get(risk_id)
            if risk:
                risk.is_reviewed = True
                risk.reviewed_at = datetime.utcnow()
                risk.reviewer_name = data.get('reviewer_name')
                risk.review_status = data.get('review_status', 'reviewed')
                risk.review_notes = data.get('review_notes')
                
                if not declaration_id:
                    declaration_id = risk.declaration_id
        
        review = ReviewRecord(
            declaration_id=declaration_id,
            risk_id=risk_id,
            review_type=review_type,
            reviewer_name=data.get('reviewer_name'),
            review_date=datetime.utcnow(),
            review_status=data.get('review_status', 'reviewed'),
            review_notes=data.get('review_notes'),
            related_item_no=data.get('related_item_no'),
            related_container_no=data.get('related_container_no')
        )
        
        db.session.add(review)
        db.session.commit()
        
        return jsonify({
            'message': 'Review record created successfully',
            'review_id': review.id,
            'review_status': review.review_status
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@review_bp.route('/batch', methods=['POST'])
def batch_review():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        risk_ids = data.get('risk_ids', [])
        reviewer_name = data.get('reviewer_name')
        review_status = data.get('review_status', 'reviewed')
        review_notes = data.get('review_notes')
        
        if not risk_ids:
            return jsonify({'error': 'No risk IDs provided'}), 400
        
        if not reviewer_name:
            return jsonify({'error': 'Reviewer name is required'}), 400
        
        results = {
            'successful': [],
            'failed': []
        }
        
        for risk_id in risk_ids:
            try:
                risk = RiskAssessment.query.get(risk_id)
                if not risk:
                    results['failed'].append({
                        'risk_id': risk_id,
                        'error': 'Risk not found'
                    })
                    continue
                
                risk.is_reviewed = True
                risk.reviewed_at = datetime.utcnow()
                risk.reviewer_name = reviewer_name
                risk.review_status = review_status
                risk.review_notes = review_notes
                
                review = ReviewRecord(
                    declaration_id=risk.declaration_id,
                    risk_id=risk_id,
                    review_type='risk',
                    reviewer_name=reviewer_name,
                    review_date=datetime.utcnow(),
                    review_status=review_status,
                    review_notes=review_notes,
                    related_item_no=str(risk.item_id)
                )
                
                db.session.add(review)
                results['successful'].append({
                    'risk_id': risk_id,
                    'review_id': review.id
                })
                
            except Exception as e:
                results['failed'].append({
                    'risk_id': risk_id,
                    'error': str(e)
                })
        
        db.session.commit()
        
        return jsonify({
            'message': 'Batch review completed',
            'total': len(risk_ids),
            'successful_count': len(results['successful']),
            'failed_count': len(results['failed']),
            'results': results
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@review_bp.route('/<review_id>', methods=['GET'])
def get_review_detail(review_id):
    try:
        review = ReviewRecord.query.get(review_id)
        
        if not review:
            return jsonify({'error': 'Review not found'}), 404
        
        declaration = CustomsDeclaration.query.get(review.declaration_id)
        risk = RiskAssessment.query.get(review.risk_id) if review.risk_id else None
        
        return jsonify({
            'id': review.id,
            'declaration_id': review.declaration_id,
            'declaration_no': declaration.declaration_no if declaration else None,
            'risk_id': review.risk_id,
            'risk': {
                'id': risk.id,
                'risk_type': risk.risk_type,
                'risk_level': risk.risk_level,
                'risk_description': risk.risk_description
            } if risk else None,
            'review_type': review.review_type,
            'reviewer_name': review.reviewer_name,
            'review_date': review.review_date.isoformat() if review.review_date else None,
            'review_status': review.review_status,
            'review_notes': review.review_notes,
            'related_item_no': review.related_item_no,
            'related_container_no': review.related_container_no,
            'created_at': review.created_at.isoformat() if review.created_at else None
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@review_bp.route('/<review_id>', methods=['PUT'])
def update_review(review_id):
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        review = ReviewRecord.query.get(review_id)
        
        if not review:
            return jsonify({'error': 'Review not found'}), 404
        
        if 'review_status' in data:
            review.review_status = data['review_status']
        
        if 'review_notes' in data:
            review.review_notes = data['review_notes']
        
        if 'reviewer_name' in data:
            review.reviewer_name = data['reviewer_name']
        
        db.session.commit()
        
        if review.risk_id:
            risk = RiskAssessment.query.get(review.risk_id)
            if risk:
                if 'review_status' in data:
                    risk.review_status = data['review_status']
                if 'review_notes' in data:
                    risk.review_notes = data['review_notes']
                if 'reviewer_name' in data:
                    risk.reviewer_name = data['reviewer_name']
                
                db.session.commit()
        
        return jsonify({
            'message': 'Review updated successfully',
            'review_id': review.id
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@review_bp.route('/summary', methods=['GET'])
def get_review_summary():
    try:
        declaration_no = request.args.get('declaration_no')
        
        query = ReviewRecord.query
        
        if declaration_no:
            declaration = CustomsDeclaration.query.filter_by(
                declaration_no=declaration_no
            ).first()
            if declaration:
                query = query.filter_by(declaration_id=declaration.id)
        
        all_reviews = query.all()
        
        summary = {
            'total_reviews': len(all_reviews),
            'by_status': {
                'pending': 0,
                'reviewed': 0,
                'approved': 0,
                'rejected': 0
            },
            'by_type': {
                'risk': 0,
                'manual': 0,
                'high_risk': 0
            }
        }
        
        for review in all_reviews:
            if review.review_status in summary['by_status']:
                summary['by_status'][review.review_status] += 1
            
            if review.review_type in summary['by_type']:
                summary['by_type'][review.review_type] += 1
        
        return jsonify(summary)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
