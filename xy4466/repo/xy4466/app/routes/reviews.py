from flask import request, jsonify
from app.routes import api
from app import db
from app.models import Review, StampApplication
from datetime import datetime
import json

@api.route('/reviews', methods=['GET'])
def get_reviews():
    """获取复核记录列表，支持筛选"""
    application_id = request.args.get('application_id', type=int)
    reviewer_id = request.args.get('reviewer_id')
    reviewer_name = request.args.get('reviewer_name')
    original_status = request.args.get('original_status')
    new_status = request.args.get('new_status')
    
    query = Review.query
    
    if application_id:
        query = query.filter(Review.application_id == application_id)
    if reviewer_id:
        query = query.filter(Review.reviewer_id == reviewer_id)
    if reviewer_name:
        query = query.filter(Review.reviewer_name.contains(reviewer_name))
    if original_status:
        query = query.filter(Review.original_status == original_status)
    if new_status:
        query = query.filter(Review.new_status == new_status)
    
    sort_by = request.args.get('sort_by', 'review_date')
    sort_order = request.args.get('sort_order', 'desc')
    
    if sort_order == 'desc':
        query = query.order_by(getattr(Review, sort_by).desc())
    else:
        query = query.order_by(getattr(Review, sort_by))
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'reviews': [review.to_dict() for review in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page
    })

@api.route('/reviews/<int:review_id>', methods=['GET'])
def get_review(review_id):
    """获取单个复核记录详情"""
    review = Review.query.get_or_404(review_id)
    return jsonify(review.to_dict())

@api.route('/reviews', methods=['POST'])
def create_review():
    """创建新的复核记录（人工复核备注/改判）"""
    data = request.get_json()
    
    required_fields = ['application_id', 'reviewer_id', 'reviewer_name', 'new_status', 'notes']
    
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    application = StampApplication.query.get(data['application_id'])
    if not application:
        return jsonify({'error': 'Application not found'}), 404
    
    original_status = application.status
    
    new_review = Review(
        application_id=data['application_id'],
        reviewer_id=data['reviewer_id'],
        reviewer_name=data['reviewer_name'],
        original_status=original_status,
        new_status=data['new_status'],
        notes=data['notes'],
        risk_adjustment=data.get('risk_adjustment', 0.0),
        risk_override=data.get('risk_override', False)
    )
    
    application.status = data['new_status']
    if data.get('risk_override', False):
        application.risk_score = application.risk_score + data.get('risk_adjustment', 0.0)
    
    db.session.add(new_review)
    db.session.commit()
    
    return jsonify({
        'message': 'Review created successfully',
        'review': new_review.to_dict(),
        'application': application.to_dict()
    }), 201

@api.route('/applications/<int:application_id>/reviews', methods=['GET'])
def get_application_reviews(application_id):
    """获取特定申请的所有复核记录"""
    application = StampApplication.query.get_or_404(application_id)
    
    reviews = Review.query.filter_by(application_id=application_id).order_by(
        Review.review_date.desc()
    ).all()
    
    return jsonify({
        'application_id': application_id,
        'application_number': application.application_number,
        'reviews': [review.to_dict() for review in reviews]
    })

@api.route('/applications/<int:application_id>/review', methods=['POST'])
def review_application(application_id):
    """对特定申请进行复核（人工复核备注/改判）"""
    application = StampApplication.query.get_or_404(application_id)
    data = request.get_json()
    
    required_fields = ['reviewer_id', 'reviewer_name', 'new_status', 'notes']
    
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    original_status = application.status
    
    new_review = Review(
        application_id=application_id,
        reviewer_id=data['reviewer_id'],
        reviewer_name=data['reviewer_name'],
        original_status=original_status,
        new_status=data['new_status'],
        notes=data['notes'],
        risk_adjustment=data.get('risk_adjustment', 0.0),
        risk_override=data.get('risk_override', False)
    )
    
    application.status = data['new_status']
    if data.get('risk_override', False):
        application.risk_score = max(0.0, application.risk_score + data.get('risk_adjustment', 0.0))
    
    db.session.add(new_review)
    db.session.commit()
    
    return jsonify({
        'message': 'Application reviewed successfully',
        'review': new_review.to_dict(),
        'application': application.to_dict()
    })
